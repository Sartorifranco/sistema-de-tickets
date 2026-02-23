/**
 * Controlador de Proveedores - Módulo de Compras
 * Solo Encargado de Compras (purchasing) puede gestionar proveedores
 */
const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendSupplierInvitationEmail } = require('../services/emailService');

// @desc    Crear proveedor y enviar invitación
// @route   POST /api/suppliers
// @access  Private (purchasing)
const createSupplier = asyncHandler(async (req, res) => {
    const { companyName, email, contactName } = req.body;

    if (!email || !contactName) {
        res.status(400).json({
            success: false,
            message: 'Email y nombre de contacto son obligatorios.'
        });
        return;
    }

    const [existingEmail] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
        res.status(409).json({
            success: false,
            message: 'El email ya está registrado.'
        });
        return;
    }

    const nameParts = String(contactName).trim().split(/\s+/);
    const firstName = nameParts[0] || 'Proveedor';
    const lastName = nameParts.slice(1).join(' ') || companyName || '';

    const baseUsername = (firstName.charAt(0) + lastName.replace(/\s+/g, '')).toLowerCase().slice(0, 20) || 'prov';
    let username = baseUsername;
    let counter = 1;
    let [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    while (existing.length > 0) {
        username = `${baseUsername}${counter}`;
        counter++;
        [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    }

    const tempPassword = crypto.randomBytes(16).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(tempPassword, salt);

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000); // 72 horas

    await pool.execute(
        `INSERT INTO users (username, email, password, role, company_id, first_name, last_name, is_active,
         supplier_invitation_token, supplier_invitation_expires) 
         VALUES (?, ?, ?, 'supplier', NULL, ?, ?, 0, ?, ?)`,
        [username, email, hashedPassword, firstName, lastName, invitationToken, invitationExpires]
    );

    const [rows] = await pool.execute('SELECT id, username, email FROM users WHERE email = ?', [email]);
    const supplier = rows[0];

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3020';
    const invitationUrl = `${frontendUrl}/set-password/${invitationToken}`;

    try {
        await sendSupplierInvitationEmail(email, companyName || null, invitationUrl);
    } catch (mailErr) {
        console.error('[SupplierController] Error enviando email de invitación:', mailErr.message);
    }

    res.status(201).json({
        success: true,
        message: 'Proveedor creado. Se envió el link de invitación por email.',
        data: {
            id: supplier.id,
            username: supplier.username,
            email: supplier.email,
            invitationLink: invitationUrl
        }
    });
});

// @desc    Listar proveedores
// @route   GET /api/suppliers
// @access  Private (purchasing)
const getSuppliers = asyncHandler(async (req, res) => {
    const [suppliers] = await pool.execute(
        `SELECT id, username, email, first_name, last_name, is_active, created_at
         FROM users WHERE role = 'supplier' ORDER BY first_name, last_name ASC`
    );
    res.status(200).json({ success: true, data: suppliers });
});

// @desc    Generar nuevo link de invitación
// @route   POST /api/suppliers/:id/invitation
// @access  Private (purchasing)
const regenerateInvitationLink = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const [users] = await pool.execute(
        'SELECT id, email, first_name FROM users WHERE id = ? AND role = ?',
        [id, 'supplier']
    );
    if (users.length === 0) {
        res.status(404).json({ success: false, message: 'Proveedor no encontrado.' });
        return;
    }
    const supplier = users[0];

    const invitationToken = crypto.randomBytes(32).toString('hex');
    const invitationExpires = new Date(Date.now() + 72 * 60 * 60 * 1000);

    await pool.execute(
        'UPDATE users SET supplier_invitation_token = ?, supplier_invitation_expires = ? WHERE id = ?',
        [invitationToken, invitationExpires, id]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3020';
    const invitationUrl = `${frontendUrl}/set-password/${invitationToken}`;

    try {
        await sendSupplierInvitationEmail(supplier.email, null, invitationUrl);
    } catch (mailErr) {
        console.error('[SupplierController] Error enviando email:', mailErr.message);
    }

    res.status(200).json({
        success: true,
        message: 'Nuevo link de invitación enviado por email.',
        data: { invitationLink: invitationUrl }
    });
});

module.exports = {
    createSupplier,
    getSuppliers,
    regenerateInvitationLink
};
