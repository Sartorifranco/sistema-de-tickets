const pool = require('../config/db');
const { findUserByEmail } = require('../services/userCreationService');

const STAFF_ROLES = new Set(['admin', 'agent', 'boss', 'purchasing']);

function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
}

function requireRequesterEmail(value) {
    const email = normalizeEmail(value);
    if (!email || !email.includes('@')) {
        const err = new Error('requesterEmail es obligatorio y debe ser un email válido.');
        err.statusCode = 400;
        throw err;
    }
    return email;
}

/**
 * El ticket pertenece al solicitante si tickets.user_id === users.id del email.
 */
async function getOwnedBacarnetTicket(ticketIdRaw, requesterEmailRaw) {
    const ticketId = parseInt(ticketIdRaw, 10);
    if (Number.isNaN(ticketId)) {
        const err = new Error('id de ticket inválido.');
        err.statusCode = 400;
        throw err;
    }

    const email = requireRequesterEmail(requesterEmailRaw);

    const [rows] = await pool.execute(
        `SELECT t.id, t.user_id, t.title, t.status, t.assigned_to_user_id,
                u.email AS requester_email
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         WHERE t.id = ?`,
        [ticketId]
    );
    if (rows.length === 0) {
        const err = new Error('Ticket no encontrado.');
        err.statusCode = 404;
        throw err;
    }

    const ticket = rows[0];
    const user = await findUserByEmail(email);
    if (!user || Number(ticket.user_id) !== Number(user.id)) {
        const err = new Error('El ticket no pertenece a ese solicitante.');
        err.statusCode = 403;
        throw err;
    }

    return { ticket, user, email };
}

function commentAuthorLabel(comment, requesterUserId) {
    if (comment.user_id == null) {
        return 'Sistema';
    }
    if (Number(comment.user_id) === Number(requesterUserId)) {
        return 'Vos';
    }
    const fullName = [comment.first_name, comment.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;
    return comment.username || 'Agente';
}

function isStaffRole(role) {
    return STAFF_ROLES.has(role);
}

module.exports = {
    STAFF_ROLES,
    normalizeEmail,
    requireRequesterEmail,
    getOwnedBacarnetTicket,
    commentAuthorLabel,
    isStaffRole,
};
