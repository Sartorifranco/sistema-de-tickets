const crypto = require('crypto');
const pool = require('../config/db');
const { isEmailConfigured, sendMailWithRetry } = require('../config/mailTransport');

const AUTHORIZERS_KEY = 'equipment_authorizers';
const DEPARTMENT_AUTHORIZERS_KEY = 'equipment_authorizers_by_department';
const MAX_PER_LIST = 5;
const TOKEN_TTL_DAYS = 30;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EQUIPMENT_TYPES = ['PC', 'Notebook', 'PC con monitor, teclado y mouse', 'Otro'];

const STATUS_LABEL = {
    pending: 'Pendiente de autorización',
    approved: 'Autorizado',
    rejected: 'No autorizado',
};

let tableCheck = { at: 0, exists: false };

/** Permite que el resto del backend funcione aunque la migración todavía no se haya aplicado. */
async function hasAuthorizationTable() {
    if (Date.now() - tableCheck.at < 5 * 60 * 1000) return tableCheck.exists;
    const [rows] = await pool.execute(
        `SELECT 1 FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'ticket_authorizations' LIMIT 1`
    );
    tableCheck = { at: Date.now(), exists: rows.length > 0 };
    return tableCheck.exists;
}

/** Columna calculada para listados: approved | rejected | pending | NULL */
const AUTHORIZATION_STATUS_SQL = `(
    SELECT CASE
        WHEN SUM(ta.status = 'approved') > 0 THEN 'approved'
        WHEN SUM(ta.status = 'rejected') > 0 THEN 'rejected'
        WHEN SUM(ta.status = 'pending') > 0 THEN 'pending'
        ELSE NULL END
    FROM ticket_authorizations ta WHERE ta.ticket_id = t.id
)`;

function hashToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function frontendUrl() {
    return String(process.env.FRONTEND_URL || 'http://bacarsa.dyndns.org:8001').replace(/\/+$/, '');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function clean(value, max) {
    const s = value === undefined || value === null ? '' : String(value).trim();
    return s.length > max ? s.slice(0, max) : s;
}

/** Valida y normaliza lo que llega del formulario. Devuelve null si no es una solicitud de equipamiento. */
function parseEquipmentRequest(raw) {
    if (raw === undefined || raw === null || raw === '') return null;
    let data = raw;
    if (typeof raw === 'string') {
        try {
            data = JSON.parse(raw);
        } catch {
            const err = new Error('Los datos de la solicitud de equipamiento son inválidos.');
            err.statusCode = 400;
            throw err;
        }
    }
    if (!data || typeof data !== 'object') return null;

    const request = {
        equipment_type: clean(data.equipment_type, 80),
        equipment_type_other: clean(data.equipment_type_other, 150),
        purpose: clean(data.purpose, 2000),
        software: clean(data.software, 1000),
        assigned_to: clean(data.assigned_to, 255),
    };
    const missing = [];
    if (!EQUIPMENT_TYPES.includes(request.equipment_type)) missing.push('tipo de equipo');
    if (request.equipment_type === 'Otro' && !request.equipment_type_other) missing.push('detalle del equipo');
    if (!request.purpose) missing.push('para qué se va a usar');
    if (!request.assigned_to) missing.push('a quién o dónde se asigna');
    if (missing.length) {
        const err = new Error(`Completá en la solicitud de equipamiento: ${missing.join(', ')}.`);
        err.statusCode = 400;
        throw err;
    }
    if (request.equipment_type !== 'Otro') request.equipment_type_other = '';
    return request;
}

function equipmentLabel(request) {
    if (!request) return '';
    return request.equipment_type === 'Otro' ? request.equipment_type_other || 'Otro' : request.equipment_type;
}

function readStoredList(list) {
    return Array.isArray(list)
        ? list
              .map((a) => ({ name: clean(a && a.name, 150), email: clean(a && a.email, 255).toLowerCase() }))
              .filter((a) => EMAIL_RE.test(a.email))
        : [];
}

async function readSetting(key) {
    try {
        const [[row]] = await pool.execute('SELECT setting_value FROM app_settings WHERE setting_key = ?', [key]);
        if (!row || !row.setting_value) return null;
        return JSON.parse(row.setting_value);
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE' || err instanceof SyntaxError) return null;
        throw err;
    }
}

/** Autorizantes generales: se usan cuando el área del solicitante no tiene autorizantes propios. */
async function getAuthorizers() {
    return readStoredList(await readSetting(AUTHORIZERS_KEY));
}

/** { [departmentId]: [{ name, email }] } */
async function getDepartmentAuthorizers() {
    const raw = await readSetting(DEPARTMENT_AUTHORIZERS_KEY);
    const map = {};
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
        for (const [deptId, list] of Object.entries(raw)) {
            const items = readStoredList(list);
            if (/^\d+$/.test(deptId) && items.length) map[deptId] = items;
        }
    }
    return map;
}

function validateList(list, context) {
    if (!Array.isArray(list)) {
        const err = new Error('Enviá la lista de autorizantes.');
        err.statusCode = 400;
        throw err;
    }
    const seen = new Set();
    const normalized = [];
    for (const item of list) {
        const email = clean(item && item.email, 255).toLowerCase();
        const name = clean(item && item.name, 150);
        if (!email && !name) continue;
        if (!EMAIL_RE.test(email)) {
            const err = new Error(`${context}: el correo "${email || '(vacío)'}" no es válido.`);
            err.statusCode = 400;
            throw err;
        }
        if (seen.has(email)) continue;
        seen.add(email);
        normalized.push({ name, email });
    }
    if (normalized.length > MAX_PER_LIST) {
        const err = new Error(`${context}: podés cargar hasta ${MAX_PER_LIST} autorizantes.`);
        err.statusCode = 400;
        throw err;
    }
    return normalized;
}

async function writeSetting(key, value) {
    await pool.execute(
        `INSERT INTO app_settings (setting_key, setting_value) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
        [key, JSON.stringify(value)]
    );
}

/**
 * Guarda autorizantes generales y por área.
 * byDepartment: [{ department_id, authorizers: [{ name, email }] }]
 */
async function saveAuthorizerSettings({ authorizers, byDepartment }) {
    const general = validateList(authorizers, 'Autorizantes generales');
    const map = {};
    if (byDepartment !== undefined) {
        if (!Array.isArray(byDepartment)) {
            const err = new Error('Formato inválido de autorizantes por área.');
            err.statusCode = 400;
            throw err;
        }
        const ids = byDepartment.map((d) => Number(d && d.department_id)).filter((id) => Number.isInteger(id) && id > 0);
        const names = {};
        if (ids.length) {
            const [rows] = await pool.query('SELECT id, name FROM departments WHERE id IN (?)', [ids]);
            rows.forEach((r) => {
                names[r.id] = r.name;
            });
        }
        for (const entry of byDepartment) {
            const id = Number(entry && entry.department_id);
            if (!names[id]) {
                const err = new Error('Hay un área que no existe. Recargá la página y probá de nuevo.');
                err.statusCode = 400;
                throw err;
            }
            const list = validateList(entry.authorizers, `Área ${names[id]}`);
            if (list.length) map[id] = list;
        }
    }
    await writeSetting(AUTHORIZERS_KEY, general);
    if (byDepartment !== undefined) await writeSetting(DEPARTMENT_AUTHORIZERS_KEY, map);
    return { authorizers: general, byDepartment: byDepartment !== undefined ? map : await getDepartmentAuthorizers() };
}

/** Elige a quién pedirle autorización según el área del solicitante. */
async function resolveAuthorizers(departmentId) {
    if (departmentId) {
        const byDept = await getDepartmentAuthorizers();
        const list = byDept[String(departmentId)];
        if (list && list.length) return { list, source: 'department' };
    }
    return { list: await getAuthorizers(), source: 'default' };
}

async function loadTicketContext(ticketId) {
    const [[ticket]] = await pool.execute(
        `SELECT t.id, t.title, t.description, t.priority, t.created_at, t.user_id, t.telefono_contacto,
                u.first_name, u.last_name, u.username, u.email,
                co.name AS company_name, d.name AS department_name, c.name AS category_name,
                ud.name AS requester_department, u.department_id AS requester_department_id
         FROM tickets t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN companies co ON co.id = u.company_id
         LEFT JOIN departments ud ON ud.id = u.department_id
         LEFT JOIN departments d ON d.id = t.department_id
         LEFT JOIN ticket_categories c ON c.id = t.category_id
         WHERE t.id = ?`,
        [ticketId]
    );
    if (!ticket) return null;
    const requesterName =
        ticket.first_name && ticket.last_name ? `${ticket.first_name} ${ticket.last_name}` : ticket.username || 'Usuario';
    return { ...ticket, requester_name: requesterName };
}

const PRIORITY_LABEL = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function buildEmail({ ticket, request, approverName, reviewUrl }) {
    const rows = [
        ['Solicitante', `${ticket.requester_name}${ticket.email ? ` (${ticket.email})` : ''}`],
        ['Empresa / área', [ticket.company_name, ticket.requester_department].filter(Boolean).join(' · ') || '—'],
        ['Teléfono', ticket.telefono_contacto || '—'],
        ['Equipo solicitado', equipmentLabel(request)],
        ['Para qué se va a usar', request.purpose],
        ['Programas específicos', request.software || 'Ninguno indicado'],
        ['Se asigna a', request.assigned_to],
        ['Prioridad', PRIORITY_LABEL[ticket.priority] || ticket.priority || '—'],
    ];
    const rowsHtml = rows
        .map(
            ([k, v]) => `
            <tr>
                <td style="padding:8px 12px;color:#6b7280;font-size:13px;width:38%;vertical-align:top;border-bottom:1px solid #f3f4f6;">${escapeHtml(k)}</td>
                <td style="padding:8px 12px;color:#111827;font-size:14px;vertical-align:top;border-bottom:1px solid #f3f4f6;white-space:pre-wrap;">${escapeHtml(v)}</td>
            </tr>`
        )
        .join('');
    const greeting = approverName ? `Hola ${escapeHtml(approverName)},` : 'Hola,';

    const html = `
    <div style="background:#f3f4f6;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e5e7eb;">
        <div style="background:#dc2626;padding:18px 24px;color:#ffffff;">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.9;">Sistema de Tickets · Grupo Bacar</div>
          <div style="font-size:20px;font-weight:bold;margin-top:4px;">Solicitud de nuevo equipamiento</div>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 12px;color:#111827;font-size:15px;">${greeting}</p>
          <p style="margin:0 0 18px;color:#374151;font-size:14px;line-height:1.5;">
            <strong>${escapeHtml(ticket.requester_name)}</strong> pidió un equipo nuevo en el ticket
            <strong>#${ticket.id}</strong>. Necesitamos tu autorización para comprarlo o asignarlo.
          </p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #f3f4f6;border-radius:10px;">
            ${rowsHtml}
          </table>
          <div style="text-align:center;margin:26px 0 8px;">
            <a href="${reviewUrl}&d=approve" style="background:#16a34a;color:#ffffff;text-decoration:none;font-weight:bold;padding:13px 26px;border-radius:10px;display:inline-block;margin:4px;">Autorizar</a>
            <a href="${reviewUrl}&d=reject" style="background:#ffffff;color:#b91c1c;text-decoration:none;font-weight:bold;padding:12px 25px;border-radius:10px;display:inline-block;margin:4px;border:1px solid #fca5a5;">No autorizo</a>
          </div>
          <p style="margin:14px 0 0;color:#6b7280;font-size:12px;line-height:1.5;text-align:center;">
            Al tocar un botón se abre una página para confirmar tu decisión. El enlace vence en ${TOKEN_TTL_DAYS} días.<br>
            Si el botón no funciona, copiá este enlace: <a href="${reviewUrl}" style="color:#dc2626;">${reviewUrl}</a>
          </p>
        </div>
      </div>
    </div>`;

    return {
        subject: `Autorización requerida: ${equipmentLabel(request)} para ${request.assigned_to} (ticket #${ticket.id})`,
        html,
    };
}

async function sendAuthorizationEmail(rowId, token, ticket, request) {
    const [[row]] = await pool.execute('SELECT approver_name, approver_email FROM ticket_authorizations WHERE id = ?', [rowId]);
    if (!row) return { ok: false, error: 'Registro no encontrado.' };
    if (!isEmailConfigured()) {
        await pool.execute('UPDATE ticket_authorizations SET email_error = ? WHERE id = ?', ['Correo no configurado en el servidor.', rowId]);
        return { ok: false, error: 'Correo no configurado en el servidor.' };
    }
    const reviewUrl = `${frontendUrl()}/autorizar?t=${token}`;
    const { subject, html } = buildEmail({ ticket, request, approverName: row.approver_name, reviewUrl });
    const result = await sendMailWithRetry({
        from: `"Sistema de Tickets BACAR" <${process.env.EMAIL_USER}>`,
        to: row.approver_email,
        subject,
        html,
    });
    if (result.ok) {
        await pool.execute('UPDATE ticket_authorizations SET email_sent_at = NOW(), email_error = NULL WHERE id = ?', [rowId]);
    } else {
        await pool.execute('UPDATE ticket_authorizations SET email_error = ? WHERE id = ?', [clean(result.error, 500), rowId]);
    }
    return result;
}

/** Crea los registros pendientes y envía un correo a cada autorizante configurado. */
async function requestAuthorization(ticketId, request) {
    const ticket = await loadTicketContext(ticketId);
    if (!ticket) return { sent: 0, total: 0, missingAuthorizers: false };
    const { list: authorizers } = await resolveAuthorizers(ticket.requester_department_id);

    if (authorizers.length === 0) {
        // Sin autorizante configurado: queda pendiente para que un admin lo cargue y reenvíe.
        const token = crypto.randomBytes(32).toString('hex');
        await pool.execute(
            `INSERT INTO ticket_authorizations (ticket_id, status, request_data, approver_name, approver_email, token_hash, expires_at, email_error)
             VALUES (?, 'pending', ?, NULL, '', ?, DATE_ADD(NOW(), INTERVAL ? DAY), ?)`,
            [ticketId, JSON.stringify(request), hashToken(token), TOKEN_TTL_DAYS, 'No hay autorizante configurado.']
        );
        return { sent: 0, total: 0, missingAuthorizers: true };
    }

    let sent = 0;
    for (const a of authorizers) {
        const token = crypto.randomBytes(32).toString('hex');
        const [r] = await pool.execute(
            `INSERT INTO ticket_authorizations (ticket_id, status, request_data, approver_name, approver_email, token_hash, expires_at)
             VALUES (?, 'pending', ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))`,
            [ticketId, JSON.stringify(request), a.name || null, a.email, hashToken(token), TOKEN_TTL_DAYS]
        );
        const result = await sendAuthorizationEmail(r.insertId, token, ticket, request);
        if (result.ok) sent += 1;
    }
    return { sent, total: authorizers.length, missingAuthorizers: false };
}

function parseRequestData(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

/** Resumen para mostrar en el ticket. */
async function getTicketAuthorization(ticketId) {
    let rows;
    try {
        [rows] = await pool.execute(
            `SELECT id, status, request_data, approver_name, approver_email, email_sent_at, email_error,
                    decided_at, decision_note, created_at, expires_at
             FROM ticket_authorizations WHERE ticket_id = ? ORDER BY id ASC`,
            [ticketId]
        );
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') return null;
        throw err;
    }
    if (!rows.length) return null;

    const decided = rows.find((r) => r.status === 'approved' || r.status === 'rejected');
    const pending = rows.filter((r) => r.status === 'pending');
    const status = decided ? decided.status : 'pending';
    const request = parseRequestData((decided || rows[rows.length - 1]).request_data);
    const decidedByLabel = decided ? decided.approver_name || decided.approver_email : null;

    return {
        status,
        label: decided ? `${STATUS_LABEL[status]} por ${decidedByLabel}` : STATUS_LABEL.pending,
        decided_by_name: decided ? decided.approver_name : null,
        decided_by_email: decided ? decided.approver_email : null,
        decided_at: decided ? decided.decided_at : null,
        decision_note: decided ? decided.decision_note : null,
        request,
        equipment_label: equipmentLabel(request),
        approvers: (decided ? [decided] : pending)
            .filter((r) => r.approver_email)
            .map((r) => ({
                name: r.approver_name,
                email: r.approver_email,
                email_sent_at: r.email_sent_at,
                email_error: r.email_error,
            })),
        email_error: !decided && pending.length > 0 && pending.every((r) => !r.email_sent_at) ? pending[0].email_error : null,
    };
}

/** Anula los enlaces pendientes y manda un correo nuevo a los autorizantes actuales. */
async function resendAuthorization(ticketId) {
    const current = await getTicketAuthorization(ticketId);
    if (!current) {
        const err = new Error('Este ticket no tiene una solicitud de autorización.');
        err.statusCode = 404;
        throw err;
    }
    if (current.status !== 'pending') {
        const err = new Error('La solicitud ya fue respondida.');
        err.statusCode = 409;
        throw err;
    }
    await pool.execute(`UPDATE ticket_authorizations SET status = 'cancelled' WHERE ticket_id = ? AND status = 'pending'`, [ticketId]);
    return requestAuthorization(ticketId, current.request);
}

async function findByToken(token) {
    if (!token || !/^[a-f0-9]{64}$/i.test(String(token))) return null;
    const [[row]] = await pool.execute(
        `SELECT id, ticket_id, status, request_data, approver_name, approver_email, expires_at, decided_at, decision_note,
                (expires_at < NOW()) AS expired
         FROM ticket_authorizations WHERE token_hash = ?`,
        [hashToken(token)]
    );
    return row || null;
}

/** Datos que ve el autorizante en la página pública. */
async function getPublicReview(token) {
    const row = await findByToken(token);
    if (!row) return { state: 'invalid' };
    const ticket = await loadTicketContext(row.ticket_id);
    if (!ticket) return { state: 'invalid' };
    const summary = await getTicketAuthorization(row.ticket_id);
    const request = parseRequestData(row.request_data);

    let state = 'pending';
    if (summary && summary.status !== 'pending') state = 'decided';
    else if (row.status === 'cancelled') state = 'replaced';
    else if (Number(row.expired) === 1) state = 'expired';

    return {
        state,
        decision:
            summary && summary.status !== 'pending'
                ? {
                      status: summary.status,
                      label: summary.label,
                      decided_at: summary.decided_at,
                      decision_note: summary.decision_note,
                  }
                : null,
        approver: { name: row.approver_name, email: row.approver_email },
        ticket: {
            id: ticket.id,
            title: ticket.title,
            created_at: ticket.created_at,
            priority: ticket.priority,
            requester_name: ticket.requester_name,
            requester_email: ticket.email,
            company_name: ticket.company_name,
            requester_department: ticket.requester_department,
            phone: ticket.telefono_contacto,
        },
        request: { ...request, equipment_label: equipmentLabel(request) },
    };
}

async function notifyTicketPeople(io, ticket, message) {
    const ids = new Set();
    if (ticket.user_id) ids.add(ticket.user_id);
    const [staff] = await pool.execute(
        `SELECT DISTINCT u.id FROM users u
         WHERE u.is_active != 0 AND (
             u.role = 'admin'
             OR u.id = (SELECT assigned_to_user_id FROM tickets WHERE id = ?)
             OR u.id IN (SELECT user_id FROM ticket_assignees WHERE ticket_id = ?)
         )`,
        [ticket.id, ticket.id]
    );
    staff.forEach((s) => ids.add(s.id));
    for (const userId of ids) {
        const [r] = await pool.execute(
            'INSERT INTO notifications (user_id, message, type, related_id, related_type) VALUES (?, ?, ?, ?, ?)',
            [userId, message, 'ticket_authorization', ticket.id, 'ticket']
        );
        const [[n]] = await pool.execute('SELECT * FROM notifications WHERE id = ?', [r.insertId]);
        if (io && n) io.to(`user-${userId}`).emit('new_notification', n);
    }
    return Array.from(ids);
}

/** Registra la decisión del autorizante. */
async function decide(token, decision, note, io) {
    if (decision !== 'approve' && decision !== 'reject') {
        const err = new Error('Decisión inválida.');
        err.statusCode = 400;
        throw err;
    }
    const conn = await pool.getConnection();
    let row;
    try {
        await conn.beginTransaction();
        const [[locked]] = await conn.execute(
            `SELECT id, ticket_id, status, approver_name, approver_email, (expires_at < NOW()) AS expired
             FROM ticket_authorizations WHERE token_hash = ? FOR UPDATE`,
            [hashToken(token)]
        );
        if (!locked) {
            const err = new Error('El enlace no es válido.');
            err.statusCode = 404;
            throw err;
        }
        const [[already]] = await conn.execute(
            `SELECT id FROM ticket_authorizations WHERE ticket_id = ? AND status IN ('approved', 'rejected') LIMIT 1 FOR UPDATE`,
            [locked.ticket_id]
        );
        if (already) {
            const err = new Error('Esta solicitud ya fue respondida.');
            err.statusCode = 409;
            throw err;
        }
        if (locked.status !== 'pending') {
            const err = new Error('Este enlace fue reemplazado por uno más nuevo. Usá el último correo recibido.');
            err.statusCode = 410;
            throw err;
        }
        if (Number(locked.expired) === 1) {
            const err = new Error('El enlace venció. Pedí que te reenvíen la solicitud.');
            err.statusCode = 410;
            throw err;
        }
        const newStatus = decision === 'approve' ? 'approved' : 'rejected';
        await conn.execute(
            'UPDATE ticket_authorizations SET status = ?, decided_at = NOW(), decision_note = ? WHERE id = ?',
            [newStatus, clean(note, 1000) || null, locked.id]
        );
        await conn.execute(
            `UPDATE ticket_authorizations SET status = 'cancelled' WHERE ticket_id = ? AND status = 'pending' AND id != ?`,
            [locked.ticket_id, locked.id]
        );
        await conn.commit();
        row = { ...locked, status: newStatus };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }

    const who = row.approver_name ? `${row.approver_name} (${row.approver_email})` : row.approver_email;
    const verb = row.status === 'approved' ? 'Autorizado' : 'No autorizado';
    const noteText = clean(note, 1000);
    const commentHtml =
        `<p><strong>${verb} por ${escapeHtml(who)}</strong> - solicitud de nuevo equipamiento.</p>` +
        (noteText ? `<p>Comentario: ${escapeHtml(noteText)}</p>` : '');
    await pool.execute('INSERT INTO comments (ticket_id, user_id, comment_text, is_internal) VALUES (?, NULL, ?, 0)', [
        row.ticket_id,
        commentHtml,
    ]);
    await pool.execute('UPDATE tickets SET updated_at = NOW() WHERE id = ?', [row.ticket_id]);

    const ticket = await loadTicketContext(row.ticket_id);
    let notifiedIds = [];
    if (ticket) {
        const label = row.approver_name || row.approver_email;
        notifiedIds = await notifyTicketPeople(io, ticket, `Ticket #${ticket.id}: ${verb.toLowerCase()} por ${label} ("${ticket.title}")`);
    }
    if (io) io.to('admin').to('agent').emit('dashboard_update', { message: `Autorización respondida en ticket #${row.ticket_id}` });

    return { ticketId: row.ticket_id, status: row.status, notifiedIds, summary: await getTicketAuthorization(row.ticket_id) };
}

module.exports = {
    EQUIPMENT_TYPES,
    AUTHORIZATION_STATUS_SQL,
    hasAuthorizationTable,
    parseEquipmentRequest,
    getAuthorizers,
    getDepartmentAuthorizers,
    saveAuthorizerSettings,
    requestAuthorization,
    resendAuthorization,
    getTicketAuthorization,
    getPublicReview,
    decide,
};
