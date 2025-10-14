const pool = require('../config/db');
const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');

// @desc    Crear nuevo usuario (por Admin)
const createUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, email, password, company_id, department_id, role } = req.body;

    if (!firstName || !lastName || !email || !password || !company_id) {
        res.status(400).json({ message: 'Por favor, complete todos los campos requeridos.' });
        return;
    }

    const baseUsername = `${firstName.trim().toLowerCase()}${lastName.trim().charAt(0).toUpperCase() + lastName.trim().slice(1).toLowerCase()}`.replace(/\s+/g, '');
    let username = baseUsername;
    let counter = 1;
    let [existingUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);

    while (existingUser.length > 0) {
        username = `${baseUsername}${counter}`;
        counter++;
        [existingUser] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    }

    const [existingEmail] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length > 0) {
        res.status(409);
        throw new Error('El email ya está en uso.');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const userRole = role || 'client';

    const [result] = await pool.execute(
        'INSERT INTO users (username, email, password, role, department_id, company_id, first_name, last_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [username, email, hashedPassword, userRole, department_id || null, company_id, firstName, lastName]
    );

    res.status(201).json({
        success: true,
        message: 'Usuario creado exitosamente.',
        data: { id: result.insertId, username, email, role: userRole },
    });
});

// @desc    Obtener todos los usuarios
const getAllUsers = asyncHandler(async (req, res) => {
    const [users] = await pool.execute(
        `SELECT 
            u.id, u.username, u.email, u.role, u.department_id, u.company_id, u.created_at, 
            c.name AS company_name, 
            d.name AS department_name 
         FROM users u 
         LEFT JOIN companies c ON u.company_id = c.id 
         LEFT JOIN departments d ON u.department_id = d.id 
         ORDER BY u.username ASC`
    );
    res.status(200).json({
        success: true,
        count: users.length,
        data: users,
    });
});


// @desc    Obtener un solo usuario por ID
const getUserById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [userRows] = await pool.execute('SELECT id, username, email, role, department_id, company_id, created_at FROM users WHERE id = ?', [id]);

    if (userRows.length === 0) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    res.status(200).json({ success: true, data: userRows[0] });
});

// @desc    Actualizar usuario
const updateUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { username, email, role, department_id, company_id, password } = req.body;

    const [user] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const updateFields = [];
    const updateValues = [];

    if (username) { updateFields.push('username = ?'); updateValues.push(username); }
    if (email) { updateFields.push('email = ?'); updateValues.push(email); }
    if (role) { updateFields.push('role = ?'); updateValues.push(role); }
    if (department_id) { updateFields.push('department_id = ?'); updateValues.push(department_id); }
    if (company_id) { updateFields.push('company_id = ?'); updateValues.push(company_id); }
    if (password) {
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);
        updateFields.push('password = ?');
        updateValues.push(hashedPassword);
    }

    if (updateFields.length === 0) {
        return res.status(200).json({ success: true, message: 'No se proporcionaron campos para actualizar.' });
    }

    const query = `UPDATE users SET ${updateFields.join(', ')} WHERE id = ?`;
    updateValues.push(id);

    await pool.execute(query, updateValues);

    res.status(200).json({ success: true, message: 'Usuario actualizado exitosamente.' });
});

// @desc    Eliminar usuario
const deleteUser = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const [user] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (user.length === 0) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    
    await pool.execute('DELETE FROM users WHERE id = ?', [id]);

    res.status(200).json({ success: true, message: 'Usuario eliminado exitosamente.' });
});

// @desc    Obtener estadísticas de un agente
const getAgentStats = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { id: authenticatedUserId, role: authenticatedUserRole } = req.user;

    if (authenticatedUserRole === 'agent' && parseInt(id, 10) !== authenticatedUserId) {
        res.status(403);
        throw new Error('No autorizado para ver las estadísticas de otro agente.');
    }

    const [ticketCounts] = await pool.execute(
        `SELECT status, COUNT(*) AS count FROM tickets WHERE assigned_to_user_id = ? GROUP BY status`,
        [id]
    );

    const stats = {
        totalTicketsAssigned: 0,
        openTickets: 0,
        inProgressTickets: 0,
        resolvedTickets: 0,
        closedTickets: 0,
    };

    ticketCounts.forEach((row) => {
        stats.totalTicketsAssigned += row.count;
        if (row.status === 'open') stats.openTickets = row.count;
        if (row.status === 'in-progress') stats.inProgressTickets = row.count;
        if (row.status === 'resolved') stats.resolvedTickets = row.count;
        if (row.status === 'closed') stats.closedTickets = row.count;
    });

    res.status(200).json(stats);
});

// @desc    Que cualquier usuario cambie su contraseña
const changePassword = asyncHandler(async (req, res) => {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user.id;

    if (!currentPassword || !newPassword || !confirmPassword) {
        res.status(400).json({ message: 'Por favor, complete todos los campos.' });
        return;
    }
    if (newPassword !== confirmPassword) {
        res.status(400).json({ message: 'La nueva contraseña y su confirmación no coinciden.' });
        return;
    }
    if (newPassword.length < 6) {
        res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres.' });
        return;
    }

    const [userRows] = await pool.execute('SELECT password FROM users WHERE id = ?', [userId]);
    const user = userRows[0];
    if (!user) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        res.status(401).json({ message: 'La contraseña actual es incorrecta.' });
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

    res.status(200).json({ success: true, message: 'Contraseña actualizada exitosamente.' });
});

// @desc    Que el admin resetee contraseñas de otros
const adminResetPassword = asyncHandler(async (req, res) => {
    const { id: userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ message: 'La nueva contraseña es requerida y debe tener al menos 6 caracteres.' });
        return;
    }

    const [userRows] = await pool.execute('SELECT id FROM users WHERE id = ?', [userId]);
    if (userRows.length === 0) {
        res.status(404).json({ message: 'Usuario no encontrado.' });
        return;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedNewPassword = await bcrypt.hash(newPassword, salt);

    await pool.execute('UPDATE users SET password = ? WHERE id = ?', [hashedNewPassword, userId]);

    res.status(200).json({ success: true, message: 'Contraseña del usuario actualizada exitosamente.' });
});

// @desc    Obtener todos los agentes y administradores
const getAgents = asyncHandler(async (req, res) => {
    const [agents] = await pool.execute(
        "SELECT id, username FROM users WHERE role IN ('agent', 'admin') ORDER BY username ASC"
    );
    res.status(200).json({ success: true, data: agents });
});

// @desc    Obtener tickets activos de un agente específico
const getAgentActiveTickets = asyncHandler(async (req, res) => {
    const { id: agentId } = req.params;
    
    const [tickets] = await pool.execute(
        `SELECT id, title, status, created_at 
         FROM tickets 
         WHERE assigned_to_user_id = ? AND status IN ('open', 'in-progress')
         ORDER BY created_at DESC`,
        [agentId]
    );

    res.status(200).json({ success: true, data: tickets });
});

module.exports = {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAgentStats,
    changePassword,
    adminResetPassword,
    getAgents,
    getAgentActiveTickets
};