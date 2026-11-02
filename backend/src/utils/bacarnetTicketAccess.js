const pool = require('../config/db');
const { findUserByEmail } = require('../services/userCreationService');
const {
    BACARNET_INTEGRATION_SOURCE,
    BACARNET_LEGACY_TITLE_PREFIX,
    BACAR_TICKET_DEPARTMENT_ID_LIST,
} = require('../constants/bacarnetIntegration');

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
                t.horas_reales, t.es_tarea_interna, t.department_id, t.integration_source,
                d.name AS department_name,
                u.email AS requester_email
         FROM tickets t
         LEFT JOIN users u ON t.user_id = u.id
         LEFT JOIN departments d ON t.department_id = d.id
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

/**
 * La clave solo opera tickets creados por la integración:
 * columna integration_source, o el lote anterior (título "Bacarnet - " en un área Bacar).
 */
function isBacarnetOriginTicket(ticket) {
    if (!ticket) return false;
    if (ticket.integration_source === BACARNET_INTEGRATION_SOURCE) return true;
    const source = ticket.integration_source;
    const unmarked = source == null || source === '';
    const legacyTitle = String(ticket.title || '').startsWith(BACARNET_LEGACY_TITLE_PREFIX);
    const bacarDepartment = BACAR_TICKET_DEPARTMENT_ID_LIST.includes(Number(ticket.department_id));
    return unmarked && legacyTitle && bacarDepartment;
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
    isBacarnetOriginTicket,
    commentAuthorLabel,
    isStaffRole,
};
