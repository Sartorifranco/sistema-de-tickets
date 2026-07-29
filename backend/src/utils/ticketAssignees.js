const pool = require('../config/db');

const ASSIGNABLE_ROLES = ['agent', 'admin', 'boss', 'purchasing'];
const MAINTENANCE_COMPANION_ROLES = ['agent', 'admin'];

function parseAssigneeIdList(raw) {
    if (raw === undefined || raw === null || raw === '') return [];
    let list = raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            list = Array.isArray(parsed) ? parsed : [raw];
        } catch {
            list = raw.includes(',') ? raw.split(',') : [raw];
        }
    }
    if (!Array.isArray(list)) list = [list];
    const ids = [];
    const seen = new Set();
    for (const item of list) {
        const id = parseInt(item, 10);
        if (Number.isNaN(id) || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
    }
    return ids;
}

/**
 * Valida IDs contra roles asignables y conserva el orden.
 * @param {number[]} ids
 * @param {string[]} [allowedRoles]
 * @returns {Promise<number[]>}
 */
async function resolveAssignableUserIds(ids, allowedRoles = ASSIGNABLE_ROLES) {
    if (!ids.length) return [];
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
        `SELECT id, role FROM users WHERE id IN (${placeholders})`,
        ids
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    return ids.filter((id) => {
        const row = byId.get(id);
        return row && allowedRoles.includes(row.role);
    });
}

/**
 * Reemplaza assignees de un ticket. El primero es primario.
 * También actualiza tickets.assigned_to_user_id.
 */
async function syncTicketAssignees(ticketId, userIds) {
    const unique = [];
    const seen = new Set();
    for (const id of userIds || []) {
        const n = parseInt(id, 10);
        if (Number.isNaN(n) || seen.has(n)) continue;
        seen.add(n);
        unique.push(n);
    }

    await pool.execute('DELETE FROM ticket_assignees WHERE ticket_id = ?', [ticketId]);

    if (unique.length === 0) {
        await pool.execute('UPDATE tickets SET assigned_to_user_id = NULL WHERE id = ?', [ticketId]);
        return { primaryId: null, assigneeIds: [] };
    }

    const primaryId = unique[0];
    for (let i = 0; i < unique.length; i += 1) {
        await pool.execute(
            'INSERT INTO ticket_assignees (ticket_id, user_id, is_primary) VALUES (?, ?, ?)',
            [ticketId, unique[i], i === 0 ? 1 : 0]
        );
    }
    await pool.execute('UPDATE tickets SET assigned_to_user_id = ? WHERE id = ?', [primaryId, ticketId]);
    return { primaryId, assigneeIds: unique };
}

async function getTicketAssignees(ticketId) {
    const [rows] = await pool.execute(
        `SELECT ta.user_id AS id, ta.is_primary,
                u.username, u.first_name, u.last_name, u.role
         FROM ticket_assignees ta
         INNER JOIN users u ON u.id = ta.user_id
         WHERE ta.ticket_id = ?
         ORDER BY ta.is_primary DESC, u.first_name ASC, u.last_name ASC`,
        [ticketId]
    );
    return rows;
}

async function isUserTicketAssignee(ticketId, userId, primaryAssignedId = null) {
    if (primaryAssignedId != null && Number(primaryAssignedId) === Number(userId)) return true;
    const [rows] = await pool.execute(
        'SELECT 1 FROM ticket_assignees WHERE ticket_id = ? AND user_id = ? LIMIT 1',
        [ticketId, userId]
    );
    return rows.length > 0;
}

function formatAssigneeLabel(u) {
    if (!u) return 'Sin asignar';
    if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
    return u.username || `Usuario #${u.id}`;
}

async function enrichTicketsWithAssignees(tickets) {
    if (!tickets || tickets.length === 0) return tickets;
    const ids = tickets.map((t) => t.id);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await pool.execute(
        `SELECT ta.ticket_id, ta.user_id AS id, ta.is_primary,
                u.username, u.first_name, u.last_name, u.role
         FROM ticket_assignees ta
         INNER JOIN users u ON u.id = ta.user_id
         WHERE ta.ticket_id IN (${placeholders})
         ORDER BY ta.is_primary DESC, u.first_name ASC, u.last_name ASC`,
        ids
    );
    const byTicket = new Map();
    for (const row of rows) {
        if (!byTicket.has(row.ticket_id)) byTicket.set(row.ticket_id, []);
        byTicket.get(row.ticket_id).push(row);
    }
    return tickets.map((t) => {
        let assignees = byTicket.get(t.id) || [];
        if (assignees.length === 0 && t.assigned_to_user_id) {
            assignees = [{
                id: t.assigned_to_user_id,
                is_primary: 1,
                username: null,
                first_name: null,
                last_name: null,
                role: null,
            }];
        }
        const labels = assignees.map(formatAssigneeLabel).filter(Boolean);
        return {
            ...t,
            assignees,
            agent_names: labels.length ? labels.join(', ') : (t.agent_name || 'No asignado'),
        };
    });
}

module.exports = {
    ASSIGNABLE_ROLES,
    MAINTENANCE_COMPANION_ROLES,
    parseAssigneeIdList,
    resolveAssignableUserIds,
    syncTicketAssignees,
    getTicketAssignees,
    isUserTicketAssignee,
    formatAssigneeLabel,
    enrichTicketsWithAssignees,
};
