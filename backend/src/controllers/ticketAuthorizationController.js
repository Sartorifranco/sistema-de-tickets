const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const { sendPushToUsers } = require('../services/pushNotificationService');
const { sendWebPushToUsers } = require('../services/webPushService');
const service = require('../services/ticketAuthorizationService');

function fail(res, err) {
    if (err && err.statusCode) {
        res.status(err.statusCode);
    }
    throw err;
}

async function assertCanSeeTicket(req, res, ticketId) {
    const [[ticket]] = await pool.execute('SELECT id, user_id FROM tickets WHERE id = ?', [ticketId]);
    if (!ticket) {
        res.status(404);
        throw new Error('Ticket no encontrado.');
    }
    if (['client', 'boss', 'purchasing'].includes(req.user.role) && ticket.user_id !== req.user.id) {
        res.status(403);
        throw new Error('No tenés permiso para ver este ticket.');
    }
    return ticket;
}

// @route GET /api/tickets/:id/authorization
const getTicketAuthorization = asyncHandler(async (req, res) => {
    await assertCanSeeTicket(req, res, req.params.id);
    const data = await service.getTicketAuthorization(req.params.id);
    if (data && ['client', 'boss', 'purchasing'].includes(req.user.role)) {
        data.approvers = data.approvers.map((a) => ({ name: a.name, email: a.email }));
        delete data.email_error;
    }
    res.status(200).json({ success: true, data });
});

// @route POST /api/tickets/:id/authorization/resend
const resendTicketAuthorization = asyncHandler(async (req, res) => {
    await assertCanSeeTicket(req, res, req.params.id);
    try {
        const result = await service.resendAuthorization(req.params.id);
        const data = await service.getTicketAuthorization(req.params.id);
        let message;
        if (result.missingAuthorizers) message = 'No hay autorizante configurado. Cargalo en Configuración y reenviá.';
        else if (result.sent === 0) message = 'No se pudo enviar el correo. Revisá la configuración de correo del servidor.';
        else message = `Correo de autorización reenviado (${result.sent} de ${result.total}).`;
        res.status(200).json({ success: result.sent > 0, message, data });
    } catch (err) {
        fail(res, err);
    }
});

// @route GET /api/authorizations/settings
async function settingsPayload(authorizers, byDepartmentMap) {
    const [departments] = await pool.execute(
        `SELECT d.id, d.name, co.name AS company_name,
                (SELECT COUNT(*) FROM users u WHERE u.department_id = d.id) AS users_count
         FROM departments d
         LEFT JOIN companies co ON co.id = d.company_id
         ORDER BY co.name IS NULL, co.name, d.name`
    );
    return {
        authorizers,
        by_department: Object.entries(byDepartmentMap).map(([id, list]) => ({
            department_id: Number(id),
            authorizers: list,
        })),
        departments: departments.map((d) => ({ ...d, users_count: Number(d.users_count) })),
    };
}

const getSettings = asyncHandler(async (req, res) => {
    const [authorizers, byDepartment] = await Promise.all([service.getAuthorizers(), service.getDepartmentAuthorizers()]);
    res.status(200).json({ success: true, data: await settingsPayload(authorizers, byDepartment) });
});

// @route PUT /api/authorizations/settings body { authorizers, by_department: [{ department_id, authorizers }] }
const updateSettings = asyncHandler(async (req, res) => {
    try {
        const body = req.body || {};
        const saved = await service.saveAuthorizerSettings({
            authorizers: body.authorizers,
            byDepartment: body.by_department,
        });
        res.status(200).json({
            success: true,
            message: 'Autorizantes guardados.',
            data: await settingsPayload(saved.authorizers, saved.byDepartment),
        });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            res.status(503);
            throw new Error('Falta aplicar la migración: node scripts/run-equipment-authorization-migration.js');
        }
        fail(res, err);
    }
});

// @route GET /api/authorizations/review?t=TOKEN (público)
const getReview = asyncHandler(async (req, res) => {
    const data = await service.getPublicReview(String(req.query.t || ''));
    res.status(200).json({ success: true, data });
});

// @route POST /api/authorizations/decision (público) body { t, decision: 'approve'|'reject', note? }
const postDecision = asyncHandler(async (req, res) => {
    const { t, decision, note } = req.body || {};
    try {
        const result = await service.decide(String(t || ''), decision, note, req.io);
        if (result.notifiedIds.length) {
            const title = result.status === 'approved' ? 'Equipamiento autorizado' : 'Equipamiento no autorizado';
            const body = `Ticket #${result.ticketId}: ${result.summary ? result.summary.label : title}`;
            sendPushToUsers(result.notifiedIds, title, body, { ticketId: String(result.ticketId) }).catch(() => {});
            sendWebPushToUsers(result.notifiedIds, title, body, { ticketId: String(result.ticketId) }).catch(() => {});
        }
        res.status(200).json({ success: true, data: result.summary });
    } catch (err) {
        fail(res, err);
    }
});

module.exports = {
    getTicketAuthorization,
    resendTicketAuthorization,
    getSettings,
    updateSettings,
    getReview,
    postDecision,
};
