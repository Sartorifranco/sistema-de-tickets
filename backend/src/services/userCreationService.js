const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

function splitRequesterNombre(requesterNombre) {
    const raw = String(requesterNombre || '').trim().replace(/\s+/g, ' ');
    if (!raw) {
        return { firstName: 'Usuario', lastName: 'Bacarnet' };
    }
    const parts = raw.split(' ');
    if (parts.length === 1) {
        return { firstName: parts[0], lastName: 'Bacarnet' };
    }
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

async function generateUniqueUsername(firstName, lastName) {
    const baseUsername = (firstName.trim().charAt(0) + lastName.trim())
        .toLowerCase()
        .replace(/\s+/g, '');
    let username = baseUsername || `bacarnet${Date.now()}`;
    let counter = 1;
    let [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    while (existing.length > 0) {
        username = `${baseUsername}${counter}`;
        counter += 1;
        [existing] = await pool.execute('SELECT id FROM users WHERE username = ?', [username]);
    }
    return username;
}

async function findUserByEmail(email) {
    const emailNorm = String(email || '').trim().toLowerCase();
    if (!emailNorm) return null;
    const [rows] = await pool.execute(
        'SELECT id, email, first_name, last_name, username, role, company_id, department_id, is_active FROM users WHERE email = ?',
        [emailNorm]
    );
    return rows[0] || null;
}

/**
 * Alta interna de cliente (sin JWT admin ni email de bienvenida).
 * Misma persistencia que el alta de usuarios del sistema.
 */
async function insertClientUser({ email, firstName, lastName, companyId, departmentId }) {
    const username = await generateUniqueUsername(firstName, lastName);
    const randomPassword = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(randomPassword, 10);

    const [result] = await pool.execute(
        `INSERT INTO users (username, email, password, role, department_id, company_id, first_name, last_name, is_active)
         VALUES (?, ?, ?, 'client', ?, ?, ?, ?, 1)`,
        [
            username,
            email,
            hashedPassword,
            departmentId || null,
            companyId,
            firstName,
            lastName,
        ]
    );

    return {
        id: result.insertId,
        email,
        first_name: firstName,
        last_name: lastName,
        username,
        role: 'client',
        company_id: companyId,
        department_id: departmentId || null,
        is_active: 1,
        created: true,
    };
}

async function findOrCreateBacarnetClient({ email, requesterNombre, companyId, departmentId }) {
    const emailNorm = String(email || '').trim().toLowerCase();
    const existing = await findUserByEmail(emailNorm);
    if (existing) {
        return { user: existing, created: false };
    }
    const { firstName, lastName } = splitRequesterNombre(requesterNombre);
    const user = await insertClientUser({
        email: emailNorm,
        firstName,
        lastName,
        companyId,
        departmentId,
    });
    return { user, created: true };
}

module.exports = {
    splitRequesterNombre,
    generateUniqueUsername,
    findUserByEmail,
    insertClientUser,
    findOrCreateBacarnetClient,
};
