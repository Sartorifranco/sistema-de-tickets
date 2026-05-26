const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const { sendActivationEmail, sendWelcomeEmail } = require('../services/emailService');
const { buildAuthUserPayload } = require('../services/userPermissionsService');

// ✅ --- registerUser (VERSIÓN MEJORADA) ---
// Ahora genera el username automáticamente en formato camelCase y asegura que sea único.
const registerUser = asyncHandler(async (req, res) => {
    // Se reciben firstName y lastName en lugar de username.
    const { firstName, lastName, email, password, company_id, department_id } = req.body;

    if (!firstName || !lastName || !email || !password || !company_id || !department_id) {
        res.status(400);
        throw new Error('Por favor, complete todos los campos requeridos.');
    }

    // --- Lógica de generación de Username ---
    const firstNameClean = firstName.trim().toLowerCase().replace(/\s+/g, '');
    const lastNameFormatted = lastName.trim().charAt(0).toUpperCase() + lastName.trim().slice(1).toLowerCase().replace(/\s+/g, '');
    const baseUsername = `${firstNameClean}${lastNameFormatted}`;

    // --- Verificación de unicidad ---
    let username = baseUsername;
    let counter = 1;
    let [existingUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    
    while (existingUser.length > 0) {
        username = `${baseUsername}${counter}`;
        counter++;
        [existingUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    }
    // ------------------------------------

    const emailNorm = String(email).trim().toLowerCase();
    const [existingEmailRows] = await pool.execute(
        'SELECT id, is_active FROM users WHERE email = ?',
        [emailNorm]
    );

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenExpires = new Date(Date.now() + 8 * 60 * 60 * 1000);

    if (existingEmailRows.length > 0) {
        const existing = existingEmailRows[0];
        if (existing.is_active) {
            return res.status(409).json({
                success: false,
                message: 'El email ya está en uso. Iniciá sesión o contactá al administrador.',
                code: 'EMAIL_IN_USE',
            });
        }
        await pool.execute(
            `UPDATE users SET password = ?, company_id = ?, department_id = ?, first_name = ?, last_name = ?,
             activation_token = ?, activation_token_expires = ?, is_active = 0
             WHERE id = ?`,
            [
                hashedPassword,
                company_id,
                department_id,
                firstName,
                lastName,
                activationToken,
                activationTokenExpires,
                existing.id,
            ]
        );
        const mail = await sendActivationEmail(emailNorm, activationToken);
        if (!mail.ok) {
            return res.status(503).json({
                success: false,
                message:
                    'Tu registro quedó guardado pero no pudimos enviar el email. Pedí al administrador que reenvíe la activación.',
                code: 'EMAIL_SEND_FAILED',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'Ya habías iniciado el registro. Te reenviamos el correo de activación.',
        });
    }

    const sql = `
        INSERT INTO users 
        (username, email, password, role, company_id, department_id, first_name, last_name, is_active, activation_token, activation_token_expires) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [
        username,
        emailNorm,
        hashedPassword,
        'client',
        company_id,
        department_id,
        firstName,
        lastName,
        false,
        activationToken,
        activationTokenExpires,
    ];

    await pool.execute(sql, params);
    const mail = await sendActivationEmail(emailNorm, activationToken);

    if (!mail.ok) {
        return res.status(503).json({
            success: false,
            message:
                'Tu cuenta fue creada pero no pudimos enviar el email de activación. Contactá al administrador del sistema.',
            code: 'EMAIL_SEND_FAILED',
        });
    }

    return res.status(201).json({
        success: true,
        message: 'Registro exitoso. Revisá tu email (incluida la carpeta de spam) para activar tu cuenta.',
    });
});

// --- activateAccount (sin cambios) ---
const activateAccount = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        res.status(400);
        throw new Error('No se proporcionó un token de activación.');
    }
    const [users] = await pool.execute('SELECT * FROM users WHERE activation_token = ? AND activation_token_expires > NOW()', [token]);
    if (users.length === 0) {
        res.status(400);
        throw new Error('El token de activación es inválido o ha expirado.');
    }
    const user = users[0];
    await pool.execute('UPDATE users SET is_active = TRUE, activation_token = NULL, activation_token_expires = NULL WHERE id = ?', [user.id]);
    await sendWelcomeEmail(user.email, user.username);
    res.status(200).json({
        success: true,
        message: '¡Tu cuenta ha sido activada exitosamente! Ya puedes iniciar sesión.',
    });
});

// --- loginUser (sin cambios) ---
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const [users] = await pool.execute('SELECT * FROM users WHERE email = ?', [email]);
    const user = users[0];
    if (!user || !(await bcrypt.compare(password, user.password))) {
        res.status(401);
        throw new Error('Credenciales inválidas.');
    }
    if (!user.is_active) {
        if (user.role === 'client') {
            res.status(401);
            throw new Error('Tu cuenta no ha sido activada. Por favor, revisa tu correo electrónico.');
        }
        if (user.role === 'supplier') {
            res.status(401);
            throw new Error('Debe establecer su contraseña usando el link de invitación enviado por email.');
        }
        res.status(401);
        throw new Error('Cuenta inactiva.');
    }
    // Access token: 7 días (para llamadas a la API)
    const token = jwt.sign(
        { id: user.id, role: user.role, company_id: user.company_id, department_id: user.department_id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    // Refresh token: 30 días (para renovar sin volver a loguearse)
    const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        process.env.JWT_SECRET,
        { expiresIn: '30d' }
    );

    const [companyRow] = user.company_id
        ? await pool.execute('SELECT name FROM companies WHERE id = ?', [user.company_id])
        : [[{ name: null }]];
    const company_name = companyRow[0]?.name || null;
    const userPayload = await buildAuthUserPayload({ ...user, company_name });

    res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        token,
        refreshToken,
        user: userPayload,
    });
});

// --- getMe (sin cambios) ---
const getMe = asyncHandler(async (req, res) => {
    const user = req.user; 
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    const userPayload = await buildAuthUserPayload(user);
    res.status(200).json({ success: true, user: userPayload });
});

// --- validateInvitationToken (Proveedores - Público) ---
const validateInvitationToken = asyncHandler(async (req, res) => {
    const { token } = req.params;
    if (!token) {
        res.status(400).json({ success: false, valid: false, message: 'Token requerido.' });
        return;
    }
    const [users] = await pool.execute(
        'SELECT id, email FROM users WHERE supplier_invitation_token = ? AND supplier_invitation_expires > NOW() AND role = ?',
        [token, 'supplier']
    );
    if (users.length === 0) {
        res.status(200).json({ success: true, valid: false, message: 'El link es inválido o ha expirado.' });
        return;
    }
    res.status(200).json({
        success: true,
        valid: true,
        email: users[0].email,
    });
});

// --- setPasswordFromInvitation (Proveedores - Público) ---
const setPasswordFromInvitation = asyncHandler(async (req, res) => {
    const token = req.body.token || req.params.token;
    const { password } = req.body;
    if (!token || !password || password.length < 6) {
        res.status(400);
        throw new Error('Token y contraseña (mínimo 6 caracteres) son requeridos.');
    }
    const [users] = await pool.execute(
        'SELECT id, email, username FROM users WHERE supplier_invitation_token = ? AND supplier_invitation_expires > NOW() AND role = ?',
        [token, 'supplier']
    );
    if (users.length === 0) {
        res.status(400);
        throw new Error('El link de invitación es inválido o ha expirado.');
    }
    const user = users[0];
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    await pool.execute(
        'UPDATE users SET password = ?, is_active = 1, supplier_invitation_token = NULL, supplier_invitation_expires = NULL WHERE id = ?',
        [hashedPassword, user.id]
    );
    res.status(200).json({
        success: true,
        message: 'Contraseña establecida. Ya puede iniciar sesión.',
        data: { email: user.email }
    });
});

// --- refreshToken: renovar sesión sin volver a loguearse ---
const refreshTokenHandler = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken || typeof refreshToken !== 'string') {
        res.status(400).json({
            success: false,
            message: 'Se requiere refreshToken.',
            code: 'NO_REFRESH_TOKEN',
        });
        return;
    }

    let decoded;
    try {
        decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    } catch (err) {
        const isExpired = err.name === 'TokenExpiredError';
        res.status(401).json({
            success: false,
            message: isExpired
                ? 'Sesión expirada. Por favor, iniciá sesión nuevamente.'
                : 'Token de renovación inválido.',
            code: isExpired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        });
        return;
    }

    if (decoded.type !== 'refresh') {
        res.status(401).json({
            success: false,
            message: 'Token inválido.',
            code: 'TOKEN_INVALID',
        });
        return;
    }

    const [rows] = await pool.execute(
        `SELECT u.id, u.username, u.email, u.role, u.department_id, u.company_id,
                u.is_super_admin,
                c.name AS company_name
         FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.id = ?`,
        [decoded.id]
    );

    if (!rows[0]) {
        res.status(401).json({
            success: false,
            message: 'El usuario ya no existe.',
            code: 'USER_NOT_FOUND',
        });
        return;
    }

    const user = rows[0];
    const newAccessToken = jwt.sign(
        { id: user.id, role: user.role, company_id: user.company_id, department_id: user.department_id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );

    const userPayload = await buildAuthUserPayload(user);
    res.status(200).json({
        success: true,
        token: newAccessToken,
        user: userPayload,
    });
});

// --- saveFcmToken (Push Notifications) ---
const saveFcmToken = asyncHandler(async (req, res) => {
    const { fcm_token } = req.body;
    if (!fcm_token || typeof fcm_token !== 'string') {
        res.status(400);
        throw new Error('Se requiere fcm_token.');
    }
    await pool.execute(
        'UPDATE users SET fcm_token = ? WHERE id = ?',
        [fcm_token.trim(), req.user.id]
    );
    res.status(200).json({
        success: true,
        message: 'Token de notificaciones guardado.',
    });
});

module.exports = {
    registerUser,
    loginUser,
    getMe,
    refreshTokenHandler,
    activateAccount,
    validateInvitationToken,
    setPasswordFromInvitation,
    saveFcmToken,
};
