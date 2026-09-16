/**
 * Verifica el canal M2M Bacarnet y limpia los datos de prueba al final.
 * Uso: node scripts/test-bacarnet-integration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const pool = require('../src/config/db');
const { BACAR_TICKET_DEPARTMENT_IDS } = require('../src/constants/bacarnetIntegration');
const { closeResolvedTicketDueToInactivity } = require('../src/services/ticketAutoClose');
const {
    resetLastBacarnetWebhookAttempt,
    notifyBacarnetTicketStatusChange,
} = require('../src/services/bacarnetWebhookService');

const API_KEY = process.env.BACARNET_INTEGRATION_API_KEY;
const TEST_EMAIL = `m2m-integration-test-${Date.now()}@sistema.local`;
const OTHER_EMAIL = `m2m-integration-other-${Date.now()}@sistema.local`;
const TEST_TITLE_1 = `[M2M-TEST] alta usuario nuevo ${Date.now()}`;
const TEST_TITLE_2 = `[M2M-TEST] usuario existente ${Date.now()}`;
const TEST_TITLE_OTHER = `[M2M-TEST] ticket ajeno ${Date.now()}`;
const PNG_1X1 = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJTU5ErkJggg==',
    'base64'
);

if (!API_KEY) {
    console.error('Falta BACARNET_INTEGRATION_API_KEY en backend/.env');
    process.exit(1);
}

const webhookInbox = [];
let webhookResolve = null;

function waitForWebhook(timeoutMs = 4000) {
    const existing = webhookInbox.shift();
    if (existing) return Promise.resolve(existing);
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout esperando webhook')), timeoutMs);
        webhookResolve = (payload) => {
            clearTimeout(timer);
            webhookResolve = null;
            resolve(payload);
        };
    });
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function readJsonOrThrow(res, label) {
    const raw = await res.text();
    if (!res.ok) {
        throw new Error(`${label} falló: ${res.status} ${raw}`);
    }
    try {
        return raw ? JSON.parse(raw) : {};
    } catch {
        throw new Error(`${label} devolvió JSON inválido: ${raw}`);
    }
}

async function readError(res) {
    const raw = await res.text();
    let json = {};
    try {
        json = raw ? JSON.parse(raw) : {};
    } catch {
        json = { message: raw };
    }
    return { status: res.status, message: json.message || raw };
}

function unlinkQuiet(filePath) {
    if (!filePath) return;
    const abs = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch {
        // ignore
    }
}

async function cleanup(ticketIds, userIds, extraEmails) {
    const conn = await pool.getConnection();
    try {
        const emails = [TEST_EMAIL, OTHER_EMAIL, ...(extraEmails || [])];
        const ids = new Set((userIds || []).filter(Boolean));
        for (const email of emails) {
            const [found] = await conn.execute('SELECT id FROM users WHERE email = ?', [email]);
            if (found[0]) ids.add(found[0].id);
        }
        if (ticketIds.length === 0 && ids.size > 0) {
            const userList = [...ids];
            const ph = userList.map(() => '?').join(',');
            const [foundTickets] = await conn.execute(
                `SELECT id FROM tickets WHERE user_id IN (${ph}) AND title LIKE ?`,
                [...userList, '[M2M-TEST]%']
            );
            ticketIds = foundTickets.map((row) => row.id);
        }
        if (ticketIds.length > 0) {
            const ph = ticketIds.map(() => '?').join(',');
            const [atts] = await conn.execute(
                `SELECT file_path FROM ticket_attachments WHERE ticket_id IN (${ph})`,
                ticketIds
            ).catch(() => [[]]);
            for (const row of atts || []) unlinkQuiet(row.file_path);
            await conn.execute(`DELETE FROM comments WHERE ticket_id IN (${ph})`, ticketIds).catch(() => {});
            await conn.execute(
                `DELETE FROM notifications WHERE related_type = 'ticket' AND related_id IN (${ph})`,
                ticketIds.map(String)
            ).catch(() => {});
            await conn.execute(`DELETE FROM ticket_assignees WHERE ticket_id IN (${ph})`, ticketIds).catch(() => {});
            await conn.execute(`DELETE FROM ticket_attachments WHERE ticket_id IN (${ph})`, ticketIds).catch(() => {});
            await conn.execute(`DELETE FROM ticket_feedback WHERE ticket_id IN (${ph})`, ticketIds).catch(() => {});
            await conn.execute(`DELETE FROM tickets WHERE id IN (${ph})`, ticketIds).catch(() => {});
        }
        for (const userId of ids) {
            await conn.execute('DELETE FROM notifications WHERE user_id = ?', [userId]).catch(() => {});
            await conn.execute(
                'DELETE FROM users WHERE id = ? AND email IN (?, ?)',
                [userId, TEST_EMAIL, OTHER_EMAIL]
            );
        }
    } finally {
        conn.release();
    }
}

async function main() {
    const createdTicketIds = [];
    const createdUserIds = [];
    let createdUserId = null;
    let webhookServer;
    let apiServer;

    const webhookApp = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            let body = {};
            try { body = JSON.parse(raw || '{}'); } catch { body = { raw }; }
            webhookInbox.push({
                headers: { 'x-api-key': req.headers['x-api-key'] },
                body,
            });
            if (webhookResolve) webhookResolve(webhookInbox.shift());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        });
    });

    await new Promise((resolve) => {
        webhookServer = webhookApp.listen(0, '127.0.0.1', resolve);
    });
    const webhookPort = webhookServer.address().port;
    process.env.BACARNET_WEBHOOK_URL = `http://127.0.0.1:${webhookPort}/bacarnet-status`;

    const ioStub = { emit() {}, to() { return ioStub; } };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.io = ioStub;
        next();
    });
    app.use('/api/integrations/bacarnet', require('../src/routes/bacarnetIntegrationRoutes'));
    app.use('/api/tickets', require('../src/routes/ticketRoutes'));
    app.use((err, req, res, _next) => {
        const status = res.statusCode >= 400 ? res.statusCode : 500;
        res.status(status).json({ success: false, message: err.message });
    });

    await new Promise((resolve) => {
        apiServer = app.listen(0, '127.0.0.1', resolve);
    });
    const apiPort = apiServer.address().port;
    const base = `http://127.0.0.1:${apiPort}`;

    const headers = {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
    };

    try {
        const denied = await fetch(`${base}/api/integrations/bacarnet/catalogo`, {
            headers: { 'X-Api-Key': 'clave-incorrecta' },
        });
        assert(denied.status === 401, `API key inválida debería dar 401, dio ${denied.status}`);

        const catalogRes = await fetch(`${base}/api/integrations/bacarnet/catalogo`, { headers });
        const catalogJson = await readJsonOrThrow(catalogRes, 'catálogo');
        const catalog = catalogJson.data;
        const deptIds = catalog.departments.map((d) => d.id).sort((a, b) => a - b);
        const expectedIds = [
            BACAR_TICKET_DEPARTMENT_IDS.SOPORTE_IT,
            BACAR_TICKET_DEPARTMENT_IDS.MANTENIMIENTO,
            BACAR_TICKET_DEPARTMENT_IDS.IMPLEMENTACIONES,
            BACAR_TICKET_DEPARTMENT_IDS.DESARROLLO,
        ].sort((a, b) => a - b);
        assert(catalog.companyId === 1, 'companyId del catálogo debe ser 1');
        assert(deptIds.join(',') === expectedIds.join(','), `departamentos inesperados: ${deptIds}`);
        assert(catalog.departments.every((d) => d.company_id === 1), 'departamentos deben ser company_id=1');
        assert(Array.isArray(catalog.categories) && catalog.categories.length > 0, 'debe haber categorías');
        const problems = catalog.categories.flatMap((c) => c.predefinedProblems || []);
        assert(problems.length > 0, 'debe haber problemas predefinidos');
        assert(
            problems.every((p) => expectedIds.includes(p.department_id)),
            'los problemas deben apuntar a los department_id de Bacar'
        );
        console.log('OK catálogo:', deptIds, `${catalog.categories.length} categorías, ${problems.length} problemas`);

        const departmentId = BACAR_TICKET_DEPARTMENT_IDS.SOPORTE_IT;
        const categoryWithProblem = catalog.categories.find((c) =>
            (c.predefinedProblems || []).some((p) => p.department_id === departmentId)
        ) || catalog.categories.find((c) => (c.predefinedProblems || []).length > 0) || catalog.categories[0];
        const problem = (categoryWithProblem.predefinedProblems || []).find((p) => p.department_id === departmentId)
            || (categoryWithProblem.predefinedProblems || [])[0];
        const categoryId = categoryWithProblem.id;

        const createPayload = {
            requesterEmail: TEST_EMAIL,
            requesterNombre: 'M2M Tester Bacarnet',
            title: TEST_TITLE_1,
            description: 'Ticket de prueba de integración Bacarnet (usuario nuevo).',
            priority: 'high',
            department_id: departmentId,
            category_id: problem ? problem.category_id || categoryId : categoryId,
        };
        if (problem) createPayload.predefined_problem_id = problem.id;

        const createNew = await fetch(`${base}/api/integrations/bacarnet/tickets`, {
            method: 'POST',
            headers,
            body: JSON.stringify(createPayload),
        });
        const createdNew = await readJsonOrThrow(createNew, 'crear ticket nuevo');
        assert(createNew.status === 201, `crear ticket nuevo: status ${createNew.status}`);
        assert(createdNew.stTicketId, 'debe devolver stTicketId');
        assert(createdNew.status === 'open', 'status inicial debe ser open');
        createdTicketIds.push(createdNew.stTicketId);

        const detailNew = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}`, { headers });
        const ticket1 = (await readJsonOrThrow(detailNew, 'detalle ticket 1')).data;
        createdUserId = ticket1.user_id;
        createdUserIds.push(createdUserId);
        assert(ticket1.requesterEmail === TEST_EMAIL, 'email del ticket 1 no coincide');
        assert(ticket1.user_id, 'ticket 1 debe tener user_id');
        console.log('OK ticket usuario nuevo:', createdNew.stTicketId, 'user_id', createdUserId);

        const createExisting = await fetch(`${base}/api/integrations/bacarnet/tickets`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...createPayload,
                title: TEST_TITLE_2,
                description: 'Ticket de prueba de integración Bacarnet (usuario existente).',
                predefined_problem_id: undefined,
            }),
        });
        const createdExisting = await readJsonOrThrow(createExisting, 'crear ticket existente');
        assert(createExisting.status === 201, `crear ticket existente: status ${createExisting.status}`);
        createdTicketIds.push(createdExisting.stTicketId);

        const detailExisting = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdExisting.stTicketId}`, { headers });
        const ticket2 = (await readJsonOrThrow(detailExisting, 'detalle ticket 2')).data;
        assert(ticket2.user_id === createdUserId, 'el segundo ticket debe reutilizar el mismo user_id');

        const [userRows] = await pool.execute('SELECT COUNT(*) AS c FROM users WHERE email = ?', [TEST_EMAIL]);
        assert(Number(userRows[0].c) === 1, 'no debe duplicar el usuario');
        console.log('OK ticket usuario existente:', createdExisting.stTicketId, 'mismo user_id', ticket2.user_id);

        const commentRes = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}/comentarios`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                requesterEmail: TEST_EMAIL,
                texto: 'Comentario de prueba M2M desde Bacarnet.',
            }),
        });
        const commentCreated = await readJsonOrThrow(commentRes, 'crear comentario');
        assert(commentRes.status === 201, `crear comentario: status ${commentRes.status}`);
        assert(commentCreated.data.texto.includes('Comentario de prueba'), 'texto del comentario');
        assert(commentCreated.data.authorLabel === 'Vos', 'el solicitante debe verse como Vos');
        assert(commentCreated.data.is_internal === false, 'comentario público');

        const listRes = await fetch(
            `${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}/comentarios?requesterEmail=${encodeURIComponent(TEST_EMAIL)}`,
            { headers }
        );
        const listJson = await readJsonOrThrow(listRes, 'listar comentarios');
        assert(listJson.data.some((c) => c.id === commentCreated.data.id), 'el comentario debe aparecer en el listado');
        assert(listJson.data.every((c) => c.authorLabel), 'cada comentario tiene autor');
        console.log('OK comentario creado y listado:', commentCreated.data.id, 'authorLabel=', commentCreated.data.authorLabel);

        const otherCreate = await fetch(`${base}/api/integrations/bacarnet/tickets`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                ...createPayload,
                requesterEmail: OTHER_EMAIL,
                requesterNombre: 'Otro Empleado',
                title: TEST_TITLE_OTHER,
            }),
        });
        const otherTicket = await readJsonOrThrow(otherCreate, 'crear ticket ajeno');
        createdTicketIds.push(otherTicket.stTicketId);
        const otherDetail = await fetch(`${base}/api/integrations/bacarnet/tickets/${otherTicket.stTicketId}`, { headers });
        const otherData = (await readJsonOrThrow(otherDetail, 'detalle ticket ajeno')).data;
        createdUserIds.push(otherData.user_id);

        const foreignComment = await fetch(
            `${base}/api/integrations/bacarnet/tickets/${otherTicket.stTicketId}/comentarios`,
            {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    requesterEmail: TEST_EMAIL,
                    texto: 'No debería poder comentar acá.',
                }),
            }
        );
        const foreignErr = await readError(foreignComment);
        assert(foreignErr.status === 403, `comentar ticket ajeno debe ser 403, fue ${foreignErr.status}`);
        console.log('OK comentar ticket ajeno rechazado:', foreignErr.status, foreignErr.message);

        const form = new FormData();
        form.append('requesterEmail', TEST_EMAIL);
        form.append('attachments', new Blob([PNG_1X1], { type: 'image/png' }), 'm2m-test.png');
        const attachRes = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}/adjuntos`, {
            method: 'POST',
            headers: { 'X-Api-Key': API_KEY },
            body: form,
        });
        const attachJson = await readJsonOrThrow(attachRes, 'subir adjunto');
        assert(attachRes.status === 201, `subir adjunto: status ${attachRes.status}`);
        assert(Array.isArray(attachJson.data) && attachJson.data.length === 1, 'debe devolver el adjunto');
        assert(attachJson.data[0].file_name === 'm2m-test.png', 'nombre del adjunto');
        const [attRows] = await pool.execute(
            'SELECT id, file_name, ticket_id FROM ticket_attachments WHERE ticket_id = ?',
            [createdNew.stTicketId]
        );
        assert(attRows.length === 1 && attRows[0].file_name === 'm2m-test.png', 'adjunto asociado en BD');
        console.log('OK adjunto subido:', attachJson.data[0]);

        const invalidReopen = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'reabrir' }),
        });
        const invalidErr = await readError(invalidReopen);
        assert(invalidErr.status === 400, `reabrir open debe ser 400, fue ${invalidErr.status}`);
        assert(/resolved/i.test(invalidErr.message), `mensaje de transición inválida: ${invalidErr.message}`);
        console.log('OK reabrir ticket open rechazado:', invalidErr.message);

        await pool.execute("UPDATE tickets SET status = 'resolved' WHERE id = ?", [createdNew.stTicketId]);
        resetLastBacarnetWebhookAttempt();
        const reopenRes = await fetch(`${base}/api/integrations/bacarnet/tickets/${createdNew.stTicketId}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'reabrir' }),
        });
        const reopenJson = await readJsonOrThrow(reopenRes, 'reabrir ticket');
        assert(reopenJson.data.status === 'open', 'reabrir debe pasar a open');
        assert(reopenJson.data.previousStatus === 'resolved', 'previousStatus resolved');
        const webhookReopen = await waitForWebhook();
        assert(webhookReopen.body.source === 'client', 'webhook reabrir source=client');
        assert(webhookReopen.body.status === 'open', 'webhook reabrir status=open');
        assert(webhookReopen.body.previousStatus === 'resolved', 'webhook reabrir previousStatus');
        assert(webhookReopen.body.stTicketId === createdNew.stTicketId, 'webhook reabrir stTicketId');
        console.log('OK reabrir resolved + webhook:', webhookReopen.body);

        await pool.execute("UPDATE tickets SET status = 'resolved' WHERE id = ?", [createdNew.stTicketId]);
        const clientToken = jwt.sign(
            { id: createdUserId, role: 'client', company_id: 1, department_id: departmentId },
            process.env.JWT_SECRET,
            { expiresIn: '15m' }
        );
        resetLastBacarnetWebhookAttempt();
        const statusRes = await fetch(`${base}/api/tickets/${createdNew.stTicketId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${clientToken}`,
            },
            body: JSON.stringify({ status: 'closed' }),
        });
        await readJsonOrThrow(statusRes, 'cambio de estado');
        const webhookFromPut = await waitForWebhook();
        assert(webhookFromPut.headers['x-api-key'] === API_KEY, 'webhook PUT debe enviar X-Api-Key');
        assert(webhookFromPut.body.stTicketId === createdNew.stTicketId, 'stTicketId del webhook PUT');
        assert(webhookFromPut.body.status === 'closed', 'status del webhook PUT');
        assert(webhookFromPut.body.previousStatus === 'resolved', 'previousStatus del webhook PUT');
        assert(webhookFromPut.body.requesterEmail === TEST_EMAIL, 'requesterEmail del webhook PUT');
        assert(webhookFromPut.body.title === TEST_TITLE_1, 'title del webhook PUT');
        assert(webhookFromPut.body.source === 'client', 'source del webhook PUT debe ser client');
        assert(webhookFromPut.body.changedAt, 'changedAt del webhook PUT');
        console.log('OK webhook PUT /status:', webhookFromPut.body);

        const previousUrl = process.env.BACARNET_WEBHOOK_URL;
        process.env.BACARNET_WEBHOOK_URL = '';
        resetLastBacarnetWebhookAttempt();
        const skipped = await notifyBacarnetTicketStatusChange({
            stTicketId: createdNew.stTicketId,
            status: 'closed',
            previousStatus: 'resolved',
            requesterEmail: TEST_EMAIL,
            title: TEST_TITLE_1,
            assignedToUserId: null,
            source: 'client',
        });
        assert(skipped.skipped === true && skipped.reason === 'empty_url', 'URL vacía debe omitirse sin error');
        assert(skipped.payload.stTicketId === createdNew.stTicketId, 'payload omitido debe ser el correcto');
        process.env.BACARNET_WEBHOOK_URL = previousUrl;
        console.log('OK webhook con URL vacía: se omite y no rompe');

        await pool.execute(
            "UPDATE tickets SET status = 'resolved', closure_reason = NULL, updated_at = NOW() - INTERVAL 49 HOUR WHERE id = ?",
            [createdExisting.stTicketId]
        );
        const [[cronTicket]] = await pool.execute(
            `SELECT t.id, t.user_id, t.title, t.assigned_to_user_id, u.email AS requester_email
             FROM tickets t LEFT JOIN users u ON t.user_id = u.id WHERE t.id = ?`,
            [createdExisting.stTicketId]
        );
        const conn = await pool.getConnection();
        try {
            await closeResolvedTicketDueToInactivity(cronTicket, conn);
        } finally {
            conn.release();
        }
        const webhookFromCron = await waitForWebhook();
        assert(webhookFromCron.body.stTicketId === createdExisting.stTicketId, 'stTicketId webhook cron');
        assert(webhookFromCron.body.status === 'closed', 'status webhook cron');
        assert(webhookFromCron.body.previousStatus === 'resolved', 'previousStatus webhook cron');
        assert(webhookFromCron.body.source === 'cron', 'source webhook cron');
        assert(webhookFromCron.body.requesterEmail === TEST_EMAIL, 'email webhook cron');
        console.log('OK webhook cron AUTO_INACTIVITY:', webhookFromCron.body);

        console.log('\nTodas las verificaciones pasaron.');
    } finally {
        await cleanup(createdTicketIds, createdUserIds);
        if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
        if (webhookServer) await new Promise((resolve) => webhookServer.close(resolve));
        await pool.end();
        console.log('Datos de prueba eliminados:', { tickets: createdTicketIds, email: TEST_EMAIL });
    }
}

main().catch(async (err) => {
    console.error('TEST FALLÓ:', err.message);
    process.exitCode = 1;
    try {
        await pool.end();
    } catch {
        // pool ya cerrado
    }
});
