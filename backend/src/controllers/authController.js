const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const { sendActivationEmail, sendWelcomeEmail } = require('../services/emailService');

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

    const [existingEmail] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
        res.status(400);
        throw new Error('El email ya está en uso.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const activationToken = crypto.randomBytes(32).toString('hex');
    const activationTokenExpires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours

    const sql = `
        INSERT INTO users 
        (username, email, password, role, company_id, department_id, first_name, last_name, is_active, activation_token, activation_token_expires) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const params = [username, email, hashedPassword, 'client', company_id, department_id, firstName, lastName, false, activationToken, activationTokenExpires];
    
    await pool.execute(sql, params);
    await sendActivationEmail(email, activationToken);

    res.status(201).json({
        success: true,
        message: 'Registro exitoso. Por favor, revisa tu email para activar tu cuenta.',
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
    if (user.role === 'client' && !user.is_active) {
        res.status(401);
        throw new Error('Tu cuenta no ha sido activada. Por favor, revisa tu correo electrónico.');
    }
    const token = jwt.sign({ 
        id: user.id, 
        role: user.role, 
        company_id: user.company_id,
        department_id: user.department_id 
    }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({
        success: true,
        message: 'Inicio de sesión exitoso',
        token,
        user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            department_id: user.department_id,
        },
    });
});

// --- getMe (sin cambios) ---
const getMe = asyncHandler(async (req, res) => {
    const user = req.user; 
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    res.status(200).json({ success: true, user: {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            company_id: user.company_id,
            department_id: user.department_id,
        },
    });
});

module.exports = {
    registerUser,
    loginUser,
    getMe,
    activateAccount,
};
