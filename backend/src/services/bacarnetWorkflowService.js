const pool = require('../config/db');
const { findUserByEmail } = require('./userCreationService');
const { ASSIGNABLE_ROLES, syncTicketAssignees } = require('../utils/ticketAssignees');
const { isBacarnetOriginTicket } = require('../utils/bacarnetTicketAccess');
const { realHoursBlockReason } = require('../utils/ticketClosureRules');
const { HORAS_REALES_MAX } = require('../constants/bacarnetIntegration');

const INTEGRATION_LABEL = 'Integración bacarnet';

function httpError(statusCode, message) {
    const err = new Error(message);
    err.statusCode = statusCode;
    return err;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function agentLabel(user) {
    if (!user) return 'sin agente';
    const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
    return full || user.username || `usuario #${user.id}`;
}

function parseTicketId(ticketIdRaw) {
    const ticketId = parseInt(ticketIdRaw, 10);
    if (Number.isNaN(ticketId)) {
        throw httpError(400, 'id de ticket inválido.');
    }
    return ticketId;
}

const TICKET_SQL = `
    SELECT t.id, t.user_id, t.title, t.status, t.assigned_to_user_id,
           t.horas_reales, t.es_tarea_interna, t.department_id, t.integration_source,
           d.name AS department_name,
           u.email AS requester_email
    FROM tickets t
    LEFT JOIN departments d ON t.department_id = d.id
    LEFT JOIN users u ON t.user_id = u.id
    WHERE t.id = ?
`;

async function loadTicketRow(ticketId, db = pool, { forUpdate = false } = {}) {
    if (forUpdate) {
        const [locked] = await db.execute('SELECT id FROM tickets WHERE id = ? FOR UPDATE', [ticketId]);
        if (locked.length === 0) {
            throw httpError(404, 'Ticket no encontrado.');
        }
    }
    const [rows] = await db.execute(TICKET_SQL, [ticketId]);
    if (rows.length === 0) {
        throw httpError(404, 'Ticket no encontrado.');
    }
    return rows[0];
}

function assertIntegrationTicket(ticket) {
    if (!isBacarnetOriginTicket(ticket)) {
        throw httpError(403, 'La integración solo puede operar tickets creados por Bacarnet.');
    }
}

async function getIntegrationTicket(ticketIdRaw) {
    const ticketId = parseTicketId(ticketIdRaw);
    const ticket = await loadTicketRow(ticketId);
    assertIntegrationTicket(ticket);
    return ticket;
}

async function loadUserById(id, db = pool) {
    const [rows] = await db.execute(
        `SELECT id, email, first_name, last_name, username, role, is_active
         FROM users WHERE id = ?`,
        [id]
    );
    return rows[0] || null;
}

function assertActiveAssignable(user, missingMessage) {
    if (!user) {
        throw httpError(404, missingMessage);
    }
    const active = Number(user.is_active) === 1;
    if (!active || !ASSIGNABLE_ROLES.includes(user.role)) {
        throw httpError(
            400,
            'El usuario no es un agente activo. Tiene que estar activo y poder recibir tickets (agente, administrador, jefe o compras).'
        );
    }
    return user;
}

/**
 * agentEmail y/o agentId. Si vienen los dos, tienen que ser la misma persona.
 * Roles asignables: los mismos que la pantalla de reasignación, y además activos.
 */
async function findAssignableAgent({ agentEmail, agentId }) {
    const emailRaw = agentEmail === undefined || agentEmail === null ? '' : String(agentEmail).trim();
    const idRaw = agentId === undefined || agentId === null ? '' : String(agentId).trim();
    if (!emailRaw && !idRaw) {
        throw httpError(400, 'agentEmail o agentId es obligatorio.');
    }

    let byEmail = null;
    if (emailRaw) {
        const email = emailRaw.toLowerCase();
        if (!email.includes('@')) {
            throw httpError(400, 'agentEmail debe ser un email válido.');
        }
        byEmail = await findUserByEmail(email);
        if (!byEmail) {
            throw httpError(404, 'No existe un usuario con ese email.');
        }
    }

    let byId = null;
    if (idRaw) {
        const id = parseInt(idRaw, 10);
        if (Number.isNaN(id)) {
            throw httpError(400, 'agentId inválido.');
        }
        byId = await loadUserById(id);
        if (!byId) {
            throw httpError(404, 'No existe un usuario con ese id.');
        }
    }

    if (byEmail && byId && Number(byEmail.id) !== Number(byId.id)) {
        throw httpError(400, 'agentEmail y agentId no corresponden al mismo usuario.');
    }

    const user = byId || byEmail;
    return assertActiveAssignable(
        user,
        emailRaw ? 'No existe un usuario con ese email.' : 'No existe un usuario con ese id.'
    );
}

function parseMinutos(value) {
    if (value === undefined || value === null || value === '') {
        throw httpError(400, 'minutos es obligatorio. 1 hora = 60 minutos.');
    }
    const n = Number(String(value).replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) {
        throw httpError(400, 'minutos debe ser un número mayor a cero. 1 hora = 60 minutos.');
    }
    const hours = Math.round((n / 60) * 100) / 100;
    if (hours <= 0) {
        throw httpError(
            400,
            'minutos es demasiado chico para registrarse. El sistema guarda horas con 2 decimales (1 hora = 60 minutos).'
        );
    }
    if (hours > HORAS_REALES_MAX) {
        throw httpError(400, `minutos supera el máximo de horas reales del ticket (${HORAS_REALES_MAX} h).`);
    }
    return { minutos: n, hours };
}

function parseDescripcion(value) {
    if (value === undefined || value === null || value === '') return null;
    const text = String(value).trim();
    if (!text) return null;
    if (text.length > 500) {
        throw httpError(400, 'descripcion no puede superar 500 caracteres.');
    }
    return text;
}

function nextHorasReales(current, hoursToAdd) {
    const base = current == null || current === '' ? 0 : parseFloat(String(current).replace(',', '.'));
    const safeBase = Number.isFinite(base) ? base : 0;
    const next = Math.round((safeBase + hoursToAdd) * 100) / 100;
    if (next > HORAS_REALES_MAX) {
        throw httpError(400, `La suma de horas reales supera el máximo permitido (${HORAS_REALES_MAX} h).`);
    }
    return next;
}

function assertCanResolve(ticket) {
    if (ticket.status !== 'open') {
        throw httpError(
            400,
            `No se puede resolver un ticket en estado '${ticket.status}'. ` +
                "Resolver solo es válido si el estado actual es 'open' (pasa a 'resolved')."
        );
    }
    const hoursBlock = realHoursBlockReason(ticket);
    if (hoursBlock) {
        throw httpError(400, hoursBlock);
    }
}

async function recordHistory(db, { ticketId, actor, fallbackUserId, text, actionType, oldValue, newValue }) {
    await db.execute(
        'INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, ?, ?, 1)',
        [ticketId, actor ? actor.id : null, text]
    );

    const logUserId = actor ? actor.id : fallbackUserId;
    if (!logUserId) return;

    await db.execute(
        `INSERT INTO activity_logs
            (user_id, user_username, user_role, action_type, description, target_type, target_id, old_value, new_value)
         VALUES (?, ?, ?, ?, ?, 'ticket', ?, ?, ?)`,
        [
            logUserId,
            actor ? (actor.username || 'bacarnet') : 'bacarnet',
            actor ? (actor.role || 'integration') : 'integration',
            actionType,
            text,
            ticketId,
            oldValue ? JSON.stringify(oldValue) : null,
            newValue ? JSON.stringify({ source: 'bacarnet', ...(newValue || {}) }) : JSON.stringify({ source: 'bacarnet' }),
        ]
    );
}

async function assignBacarnetAgent(ticketIdRaw, body) {
    const ticket = await getIntegrationTicket(ticketIdRaw);
    const agent = await findAssignableAgent({
        agentEmail: body && body.agentEmail,
        agentId: body && body.agentId,
    });

    await syncTicketAssignees(ticket.id, [agent.id]);
    const text =
        `${INTEGRATION_LABEL}: asignó el ticket a ${escapeHtml(agentLabel(agent))} ` +
        `(usuario #${agent.id}).`;
    await recordHistory(pool, {
        ticketId: ticket.id,
        actor: agent,
        text,
        actionType: 'bacarnet_assign',
        oldValue: { assigned_to_user_id: ticket.assigned_to_user_id },
        newValue: { assigned_to_user_id: agent.id },
    });

    return {
        stTicketId: ticket.id,
        status: ticket.status,
        assigned_to_user_id: agent.id,
        agentEmail: agent.email || null,
        agentNombre: agentLabel(agent),
    };
}

async function addBacarnetHours(ticketIdRaw, body) {
    const ticket = await getIntegrationTicket(ticketIdRaw);
    if (ticket.status === 'closed') {
        throw httpError(400, 'No se pueden cargar horas en un ticket cerrado.');
    }
    const agent = await findAssignableAgent({
        agentEmail: body && body.agentEmail,
        agentId: body && body.agentId,
    });
    const { minutos, hours } = parseMinutos(body && body.minutos);
    const descripcion = parseDescripcion(body && body.descripcion);
    const horasReales = nextHorasReales(ticket.horas_reales, hours);

    await pool.execute('UPDATE tickets SET horas_reales = ? WHERE id = ?', [horasReales, ticket.id]);

    let text =
        `${INTEGRATION_LABEL}: cargó ${minutos} minutos (${hours.toFixed(2)} h) ` +
        `a nombre de ${escapeHtml(agentLabel(agent))}. Total: ${horasReales.toFixed(2)} h.`;
    if (descripcion) {
        text += ` Detalle: ${escapeHtml(descripcion)}`;
    }
    await recordHistory(pool, {
        ticketId: ticket.id,
        actor: agent,
        text,
        actionType: 'bacarnet_hours',
        oldValue: { horas_reales: ticket.horas_reales },
        newValue: { horas_reales: horasReales, minutos, descripcion },
    });

    return {
        stTicketId: ticket.id,
        minutos,
        horasAgregadas: hours,
        horas_reales: horasReales,
        descripcion,
        agentEmail: agent.email || null,
    };
}

async function resolveBacarnetTicket(ticket, actorUser) {
    assertIntegrationTicket(ticket);
    assertCanResolve(ticket);
    const previousStatus = ticket.status;
    await pool.execute(
        `UPDATE tickets SET status = 'resolved', closed_at = NOW() WHERE id = ?`,
        [ticket.id]
    );
    const text = `${INTEGRATION_LABEL}: cambió el estado de '${previousStatus}' a 'resolved'.`;
    await recordHistory(pool, {
        ticketId: ticket.id,
        actor: actorUser || null,
        fallbackUserId: ticket.user_id,
        text,
        actionType: 'bacarnet_status',
        oldValue: { status: previousStatus },
        newValue: { status: 'resolved' },
    });
    return {
        stTicketId: ticket.id,
        status: 'resolved',
        previousStatus,
        accion: 'resolver',
    };
}

async function closeBacarnetTicketComplete(ticketIdRaw, body) {
    const ticketId = parseTicketId(ticketIdRaw);
    const agent = await findAssignableAgent({
        agentEmail: body && body.agentEmail,
        agentId: body && body.agentId,
    });
    const { minutos, hours } = parseMinutos(body && body.minutos);
    const descripcion = parseDescripcion(body && body.descripcion);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const ticket = await loadTicketRow(ticketId, conn, { forUpdate: true });
        assertIntegrationTicket(ticket);
        if (ticket.status !== 'open') {
            throw httpError(
                400,
                `No se puede cerrar por completo un ticket en estado '${ticket.status}'. ` +
                    "El cierre completo solo es válido si el estado actual es 'open' (asigna, carga horas, resuelve y cierra)."
            );
        }

        const horasReales = nextHorasReales(ticket.horas_reales, hours);
        const afterHours = { ...ticket, horas_reales: horasReales, status: 'open' };
        const hoursBlock = realHoursBlockReason(afterHours);
        if (hoursBlock) {
            throw httpError(400, hoursBlock);
        }

        await syncTicketAssignees(ticket.id, [agent.id], conn);
        await conn.execute('UPDATE tickets SET horas_reales = ? WHERE id = ?', [horasReales, ticket.id]);
        await conn.execute(
            `UPDATE tickets SET status = 'resolved', closed_at = NOW() WHERE id = ?`,
            [ticket.id]
        );
        await conn.execute(
            `UPDATE tickets SET status = 'closed', closed_at = NOW() WHERE id = ?`,
            [ticket.id]
        );

        const who = escapeHtml(agentLabel(agent));
        const assignText = `${INTEGRATION_LABEL}: asignó el ticket a ${who} (usuario #${agent.id}).`;
        let hoursText =
            `${INTEGRATION_LABEL}: cargó ${minutos} minutos (${hours.toFixed(2)} h) ` +
            `a nombre de ${who}. Total: ${horasReales.toFixed(2)} h.`;
        if (descripcion) hoursText += ` Detalle: ${escapeHtml(descripcion)}`;
        const resolveText = `${INTEGRATION_LABEL}: cambió el estado de 'open' a 'resolved'.`;
        const closeText = `${INTEGRATION_LABEL}: cambió el estado de 'resolved' a 'closed'.`;

        const historyBase = {
            ticketId: ticket.id,
            actor: agent,
            actionType: 'bacarnet_close_complete',
        };
        await recordHistory(conn, {
            ...historyBase,
            text: assignText,
            oldValue: { assigned_to_user_id: ticket.assigned_to_user_id, status: ticket.status },
            newValue: { assigned_to_user_id: agent.id },
        });
        await recordHistory(conn, {
            ...historyBase,
            text: hoursText,
            oldValue: { horas_reales: ticket.horas_reales },
            newValue: { horas_reales: horasReales, minutos, descripcion },
        });
        await recordHistory(conn, {
            ...historyBase,
            text: resolveText,
            oldValue: { status: 'open' },
            newValue: { status: 'resolved' },
        });
        await recordHistory(conn, {
            ...historyBase,
            text: closeText,
            oldValue: { status: 'resolved' },
            newValue: { status: 'closed' },
        });

        await conn.commit();

        return {
            stTicketId: ticket.id,
            status: 'closed',
            previousStatus: ticket.status,
            accion: 'cerrar-completo',
            assigned_to_user_id: agent.id,
            agentEmail: agent.email || null,
            minutos,
            horas_reales: horasReales,
            requesterEmail: ticket.requester_email || null,
            title: ticket.title,
        };
    } catch (err) {
        try {
            await conn.rollback();
        } catch {
            // el rollback no debe tapar el error original
        }
        throw err;
    } finally {
        conn.release();
    }
}

module.exports = {
    getIntegrationTicket,
    findAssignableAgent,
    assignBacarnetAgent,
    addBacarnetHours,
    resolveBacarnetTicket,
    closeBacarnetTicketComplete,
    loadUserById,
};
