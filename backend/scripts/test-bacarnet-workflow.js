/**
 * Flujo Bacarnet: asignar, horas, resolver, cerrar y cerrar-completo.
 * Uso: node scripts/test-bacarnet-workflow.js
 *
 * No modifica los tickets ya existentes de la integración.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const express = require('express');
const pool = require('../src/config/db');
const { createBacarnetRateLimit } = require('../src/middleware/bacarnetRateLimitMiddleware');
const { resetLastBacarnetWebhookAttempt } = require('../src/services/bacarnetWebhookService');

const API_KEY = process.env.BACARNET_INTEGRATION_API_KEY;
const TEST_EMAIL = `m2m-workflow-${Date.now()}@sistema.local`;
const RUN = Date.now();

if (!API_KEY) {
    console.error('Falta BACARNET_INTEGRATION_API_KEY en backend/.env');
    process.exit(1);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

async function readJsonOrThrow(res, label) {
    const raw = await res.text();
    if (!res.ok) throw new Error(`${label} falló: ${res.status} ${raw}`);
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
    return { status: res.status, message: json.message || raw, code: json.code || null };
}

async function cleanup(ticketIds, userIds) {
    const conn = await pool.getConnection();
    try {
        const ids = new Set((userIds || []).filter(Boolean));
        const [foundUsers] = await conn.execute('SELECT id FROM users WHERE email = ?', [TEST_EMAIL]);
        if (foundUsers[0]) ids.add(foundUsers[0].id);
        let tickets = [...new Set((ticketIds || []).filter(Boolean))];
        if (ids.size > 0) {
            const userList = [...ids];
            const ph = userList.map(() => '?').join(',');
            const [foundTickets] = await conn.execute(
                `SELECT id FROM tickets WHERE user_id IN (${ph}) AND (title LIKE ? OR title LIKE ?)`,
                [...userList, '[M2M-WF]%', 'Bacarnet - [M2M-WF]%']
            );
            tickets = [...new Set([...tickets, ...foundTickets.map((row) => row.id)])];
        }
        if (tickets.length > 0) {
            const ph = tickets.map(() => '?').join(',');
            await conn.execute(
                `DELETE FROM activity_logs WHERE target_type = 'ticket' AND target_id IN (${ph})`,
                tickets
            ).catch(() => {});
            await conn.execute(`DELETE FROM comments WHERE ticket_id IN (${ph})`, tickets).catch(() => {});
            await conn.execute(
                `DELETE FROM notifications WHERE related_type = 'ticket' AND related_id IN (${ph})`,
                tickets.map(String)
            ).catch(() => {});
            await conn.execute(`DELETE FROM ticket_assignees WHERE ticket_id IN (${ph})`, tickets).catch(() => {});
            await conn.execute(`DELETE FROM ticket_attachments WHERE ticket_id IN (${ph})`, tickets).catch(() => {});
            await conn.execute(`DELETE FROM tickets WHERE id IN (${ph})`, tickets).catch(() => {});
        }
        for (const userId of ids) {
            await conn.execute('DELETE FROM notifications WHERE user_id = ?', [userId]).catch(() => {});
            await conn.execute('DELETE FROM users WHERE id = ? AND email = ?', [userId, TEST_EMAIL]);
        }
    } finally {
        conn.release();
    }
}

function snapshotRows(rows) {
    return rows
        .map((row) => [
            row.id,
            row.status,
            row.assigned_to_user_id,
            row.horas_reales == null ? '' : String(row.horas_reales),
            row.updated_at instanceof Date ? row.updated_at.getTime() : String(row.updated_at),
        ].join(':'))
        .join('|');
}

async function legacyFingerprint() {
    const [rows] = await pool.execute(
        `SELECT id, status, assigned_to_user_id, horas_reales, updated_at
         FROM tickets
         WHERE id BETWEEN 2268 AND 2305 AND id <> 2271
         ORDER BY id`
    );
    return snapshotRows(rows);
}

async function main() {
    const createdTicketIds = [];
    const createdUserIds = [];
    let apiServer;
    let webhookServer;
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

    const webhookApp = http.createServer((req, res) => {
        let raw = '';
        req.on('data', (chunk) => { raw += chunk; });
        req.on('end', () => {
            let body = {};
            try { body = JSON.parse(raw || '{}'); } catch { body = {}; }
            const item = { apiKey: req.headers['x-api-key'] || '', body };
            webhookInbox.push(item);
            if (webhookResolve) webhookResolve(webhookInbox.shift());
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('{"ok":true}');
        });
    });

    await new Promise((resolve) => {
        webhookServer = webhookApp.listen(0, '127.0.0.1', resolve);
    });
    process.env.BACARNET_WEBHOOK_URL = `http://127.0.0.1:${webhookServer.address().port}/bacarnet-status`;

    const ioStub = { emit() {}, to() { return ioStub; } };
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
        req.io = ioStub;
        next();
    });
    app.use('/api/integrations/bacarnet', require('../src/routes/bacarnetIntegrationRoutes'));
    app.use((err, req, res, _next) => {
        const status = res.statusCode >= 400 ? res.statusCode : 500;
        res.status(status).json({ success: false, message: err.message });
    });

    await new Promise((resolve) => {
        apiServer = app.listen(0, '127.0.0.1', resolve);
    });
    const base = `http://127.0.0.1:${apiServer.address().port}`;
    const headers = { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY };
    const beforeLegacy = await legacyFingerprint();

    try {
        const limiter = createBacarnetRateLimit({ max: 2, windowMs: 60000 });
        let passed = 0;
        const fakeReq = { ip: '203.0.113.10', socket: {} };
        await new Promise((resolve, reject) => {
            limiter(fakeReq, {}, (err) => (err ? reject(err) : resolve()));
        });
        await new Promise((resolve, reject) => {
            limiter(fakeReq, {}, (err) => (err ? reject(err) : resolve()));
        });
        passed = 2;
        const limited = await new Promise((resolve) => {
            const res = {
                statusCode: 200,
                body: null,
                set() {},
                status(code) { this.statusCode = code; return this; },
                json(payload) { this.body = payload; resolve(this); return this; },
            };
            limiter(fakeReq, res, () => resolve({ statusCode: 200, body: null }));
        });
        assert(passed === 2 && limited.statusCode === 429, `rate limit debía cortar en la 3ª, dio ${limited.statusCode}`);
        assert(limited.body && limited.body.success === false, 'rate limit debe responder success:false');
        console.log('OK rate limit 429');

        const [[agent]] = await pool.execute(
            'SELECT id, email, username, role, is_active FROM users WHERE id = 1'
        );
        assert(agent && Number(agent.is_active) === 1, 'el usuario 1 tiene que estar activo');
        assert(['agent', 'admin', 'boss', 'purchasing'].includes(agent.role), 'el usuario 1 tiene que poder recibir tickets');
        assert(agent.email && String(agent.email).includes('@'), 'el usuario 1 necesita email para agentEmail');

        const [[notAgent]] = await pool.execute(
            `SELECT id FROM users
             WHERE (is_active = 0 OR role NOT IN ('agent', 'admin', 'boss', 'purchasing'))
             ORDER BY id LIMIT 1`
        );
        assert(notAgent, 'hace falta un usuario que no sea agente activo para la prueba negativa');

        async function createTicket(title) {
            const res = await fetch(`${base}/api/integrations/bacarnet/tickets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    requesterEmail: TEST_EMAIL,
                    requesterNombre: 'Workflow Tester',
                    title,
                    description: 'Ticket de prueba del flujo Bacarnet. Se borra al terminar.',
                    priority: 'medium',
                    department_id: 52,
                    category_id: 25,
                }),
            });
            const json = await readJsonOrThrow(res, 'crear ticket');
            assert(res.status === 201, `alta: status ${res.status}`);
            assert(json.status === 'open' && json.stTicketId, 'alta debe devolver stTicketId open');
            createdTicketIds.push(json.stTicketId);
            const [[row]] = await pool.execute(
                'SELECT user_id, integration_source, status, assigned_to_user_id FROM tickets WHERE id = ?',
                [json.stTicketId]
            );
            assert(row.integration_source === 'bacarnet', 'el alta tiene que marcar integration_source');
            assert(row.status === 'open' && row.assigned_to_user_id == null, 'el alta queda open y sin asignar');
            if (!createdUserIds.includes(row.user_id)) createdUserIds.push(row.user_id);
            return { id: json.stTicketId, userId: row.user_id };
        }

        const badKey = await fetch(`${base}/api/integrations/bacarnet/tickets/1/asignar`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'clave-incorrecta' },
            body: JSON.stringify({ agentId: 1 }),
        });
        const badKeyErr = await readError(badKey);
        assert(badKeyErr.status === 401 && badKeyErr.code === 'INVALID_API_KEY', `clave inválida en asignar: ${badKeyErr.status}`);
        for (const path of ['horas', 'estado', 'cerrar-completo']) {
            const method = path === 'horas' ? 'POST' : 'PUT';
            const denied = await fetch(`${base}/api/integrations/bacarnet/tickets/1/${path}`, {
                method,
                headers: { 'Content-Type': 'application/json', 'X-Api-Key': 'clave-incorrecta' },
                body: '{}',
            });
            const deniedErr = await readError(denied);
            assert(deniedErr.status === 401, `clave inválida en ${path}: ${deniedErr.status}`);
        }
        console.log('OK clave inválida');

        const missing = await fetch(`${base}/api/integrations/bacarnet/tickets/99999999/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: agent.id }),
        });
        const missingErr = await readError(missing);
        assert(missingErr.status === 404, `ticket inexistente: ${missingErr.status} ${missingErr.message}`);
        const missingHours = await fetch(`${base}/api/integrations/bacarnet/tickets/99999999/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 60 }),
        });
        assert((await readError(missingHours)).status === 404, 'horas sobre ticket inexistente debe ser 404');
        const missingClose = await fetch(`${base}/api/integrations/bacarnet/tickets/99999999/cerrar-completo`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 60 }),
        });
        assert((await readError(missingClose)).status === 404, 'cerrar-completo sobre ticket inexistente debe ser 404');
        console.log('OK ticket inexistente');

        const flow = await createTicket(`[M2M-WF] flujo ${RUN}`);

        const unknownAgent = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentEmail: 'agente-inexistente-bacarnet@example.com' }),
        });
        const unknownErr = await readError(unknownAgent);
        assert(unknownErr.status === 404, `agente inexistente: ${unknownErr.status} ${unknownErr.message}`);
        const unknownId = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: 99999999 }),
        });
        assert((await readError(unknownId)).status === 404, 'agentId inexistente debe ser 404');
        const inactive = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: notAgent.id }),
        });
        const inactiveErr = await readError(inactive);
        assert(inactiveErr.status === 400, `usuario no asignable: ${inactiveErr.status} ${inactiveErr.message}`);
        console.log('OK agente inexistente o no asignable');

        const [foreignInsert] = await pool.execute(
            `INSERT INTO tickets (user_id, title, description, priority, category_id, department_id, status)
             VALUES (?, ?, 'no es de la integración', 'medium', 25, 52, 'open')`,
            [flow.userId, `[M2M-WF] ajeno ${RUN}`]
        );
        createdTicketIds.push(foreignInsert.insertId);
        const foreign = await fetch(`${base}/api/integrations/bacarnet/tickets/${foreignInsert.insertId}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: agent.id }),
        });
        const foreignErr = await readError(foreign);
        assert(foreignErr.status === 403, `ticket ajeno: ${foreignErr.status} ${foreignErr.message}`);
        const foreignResolve = await fetch(`${base}/api/integrations/bacarnet/tickets/${foreignInsert.insertId}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'resolver' }),
        });
        assert((await readError(foreignResolve)).status === 403, 'resolver un ticket ajeno debe ser 403');
        const [[foreignRow]] = await pool.execute(
            'SELECT status, assigned_to_user_id FROM tickets WHERE id = ?',
            [foreignInsert.insertId]
        );
        assert(foreignRow.status === 'open' && foreignRow.assigned_to_user_id == null, 'el ticket ajeno no debe cambiar');
        console.log('OK ticket que no es de la integración');

        const assigned = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: agent.id, agentEmail: agent.email }),
        });
        const assignedJson = await readJsonOrThrow(assigned, 'asignar');
        assert(assigned.status === 200 && assignedJson.success === true, 'asignar success');
        assert(assignedJson.data.assigned_to_user_id === agent.id, 'asignado al usuario 1');
        assert(assignedJson.data.status === 'open', 'asignar no cambia el estado');
        assert(assignedJson.data.agentEmail === agent.email, 'responde el email del agente');
        console.log('OK asignar', flow.id);

        const badMinutes = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 0 }),
        });
        assert((await readError(badMinutes)).status === 400, 'minutos en cero debe ser 400');

        const hours = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                agentEmail: agent.email,
                minutos: 60,
                descripcion: 'Prueba de carga de una hora',
            }),
        });
        const hoursJson = await readJsonOrThrow(hours, 'horas');
        assert(hours.status === 201 && hoursJson.success === true, 'horas success');
        assert(Number(hoursJson.data.horas_reales) === 1, `60 minutos deben ser 1 h, dio ${hoursJson.data.horas_reales}`);
        assert(hoursJson.data.descripcion === 'Prueba de carga de una hora', 'guarda la descripcion');
        console.log('OK horas 60 minutos');

        const earlyClose = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'cerrar' }),
        });
        const earlyCloseErr = await readError(earlyClose);
        assert(earlyCloseErr.status === 400, `cerrar en open: ${earlyCloseErr.status}`);
        assert(/resolved/i.test(earlyCloseErr.message), 'cerrar en open sigue exigiendo resolved');

        const noHours = await createTicket(`[M2M-WF] sin horas ${RUN}`);
        const resolveNoHours = await fetch(`${base}/api/integrations/bacarnet/tickets/${noHours.id}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'resolver' }),
        });
        const noHoursErr = await readError(resolveNoHours);
        assert(noHoursErr.status === 400, `resolver sin horas: ${noHoursErr.status} ${noHoursErr.message}`);
        assert(/horas reales/i.test(noHoursErr.message), 'debe exigir horas reales en Desarrollo');
        const [[stillOpen]] = await pool.execute('SELECT status FROM tickets WHERE id = ?', [noHours.id]);
        assert(stillOpen.status === 'open', 'sin horas el ticket sigue open');
        console.log('OK resolver sin horas rechazado');

        resetLastBacarnetWebhookAttempt();
        const resolved = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'resolver' }),
        });
        const resolvedJson = await readJsonOrThrow(resolved, 'resolver');
        assert(resolvedJson.data.status === 'resolved' && resolvedJson.data.previousStatus === 'open', 'open → resolved');
        const webhookResolved = await waitForWebhook();
        assert(webhookResolved.body.source === 'bacarnet', 'webhook resolver source=bacarnet');
        assert(webhookResolved.body.status === 'resolved', 'webhook resolver status');
        assert(webhookResolved.apiKey === API_KEY, 'webhook resolver envía la clave');
        console.log('OK resolver');

        const resolveAgain = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'resolver' }),
        });
        const againErr = await readError(resolveAgain);
        assert(againErr.status === 400, `resolver de nuevo: ${againErr.status} ${againErr.message}`);
        assert(/open/i.test(againErr.message), 'la transición inválida tiene que explicar que solo vale desde open');
        console.log('OK transición inválida al resolver');

        resetLastBacarnetWebhookAttempt();
        const closed = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/estado`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ requesterEmail: TEST_EMAIL, accion: 'cerrar' }),
        });
        const closedJson = await readJsonOrThrow(closed, 'cerrar');
        assert(closedJson.data.status === 'closed' && closedJson.data.previousStatus === 'resolved', 'resolved → closed');
        const webhookClosed = await waitForWebhook();
        assert(webhookClosed.body.source === 'client', 'cerrar sigue notificando source=client');
        console.log('OK cerrar');

        const hoursWhenClosed = await fetch(`${base}/api/integrations/bacarnet/tickets/${flow.id}/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 15 }),
        });
        assert((await readError(hoursWhenClosed)).status === 400, 'no se cargan horas en un ticket cerrado');

        const [notes] = await pool.execute(
            `SELECT comment_text, is_internal, user_id FROM comments WHERE ticket_id = ? ORDER BY id`,
            [flow.id]
        );
        assert(notes.length >= 3, `faltan notas de historial: ${notes.length}`);
        assert(
            notes.every((note) => String(note.comment_text).startsWith('Integración bacarnet')),
            'cada nota tiene que identificar a la integración bacarnet'
        );
        assert(notes.every((note) => Number(note.is_internal) === 1), 'las notas de integración son internas');
        assert(notes.some((note) => Number(note.user_id) === agent.id), 'el historial tiene que nombrar al agente');
        const [logs] = await pool.execute(
            `SELECT description, user_id FROM activity_logs
             WHERE target_type = 'ticket' AND target_id = ?`,
            [flow.id]
        );
        assert(logs.length >= 3, 'faltan activity_logs');
        assert(
            logs.every((log) => String(log.description).includes('Integración bacarnet')),
            'activity_logs tiene que decir que vino de bacarnet'
        );

        const publicNotes = await fetch(
            `${base}/api/integrations/bacarnet/tickets/${flow.id}/comentarios?requesterEmail=${encodeURIComponent(TEST_EMAIL)}`,
            { headers }
        );
        const publicJson = await readJsonOrThrow(publicNotes, 'comentarios públicos');
        assert(
            publicJson.data.every((note) => !String(note.texto).includes('Integración bacarnet')),
            'el listado público no debe mostrar el historial interno'
        );
        console.log('OK historial interno');

        const additive = await createTicket(`[M2M-WF] horas sumadas ${RUN}`);
        const firstHour = await fetch(`${base}/api/integrations/bacarnet/tickets/${additive.id}/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 60 }),
        });
        await readJsonOrThrow(firstHour, 'primera carga');
        const secondHour = await fetch(`${base}/api/integrations/bacarnet/tickets/${additive.id}/horas`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ agentId: agent.id, minutos: 30 }),
        });
        const secondJson = await readJsonOrThrow(secondHour, 'segunda carga');
        assert(Number(secondJson.data.horas_reales) === 1.5, `60+30 minutos deben ser 1.50 h, dio ${secondJson.data.horas_reales}`);
        console.log('OK las horas se suman');

        const batch = await createTicket(`[M2M-WF] cierre completo ${RUN}`);
        resetLastBacarnetWebhookAttempt();
        const complete = await fetch(`${base}/api/integrations/bacarnet/tickets/${batch.id}/cerrar-completo`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({
                agentEmail: agent.email,
                minutos: 60,
                descripcion: 'Cierre automático de prueba',
            }),
        });
        const completeJson = await readJsonOrThrow(complete, 'cerrar-completo');
        assert(completeJson.data.status === 'closed' && completeJson.data.previousStatus === 'open', 'cerrar-completo termina closed');
        assert(completeJson.data.assigned_to_user_id === agent.id, 'cerrar-completo asigna');
        assert(Number(completeJson.data.horas_reales) === 1, 'cerrar-completo carga 1 h');
        const webhookComplete = await waitForWebhook();
        assert(webhookComplete.body.status === 'closed' && webhookComplete.body.source === 'bacarnet', 'webhook del cierre completo');
        const [[batchRow]] = await pool.execute(
            'SELECT status, assigned_to_user_id, horas_reales FROM tickets WHERE id = ?',
            [batch.id]
        );
        assert(batchRow.status === 'closed' && Number(batchRow.assigned_to_user_id) === agent.id, 'persistió el cierre completo');
        assert(Number(batchRow.horas_reales) === 1, 'persistió 1 hora');
        console.log('OK cerrar-completo', batch.id);

        const blocked = await createTicket(`[M2M-WF] no open ${RUN}`);
        await pool.execute("UPDATE tickets SET status = 'resolved' WHERE id = ?", [blocked.id]);
        const blockedRes = await fetch(`${base}/api/integrations/bacarnet/tickets/${blocked.id}/cerrar-completo`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentEmail: agent.email, minutos: 60 }),
        });
        const blockedErr = await readError(blockedRes);
        assert(blockedErr.status === 400, `cerrar-completo fuera de open: ${blockedErr.status} ${blockedErr.message}`);
        const [[blockedRow]] = await pool.execute(
            'SELECT status, assigned_to_user_id, horas_reales FROM tickets WHERE id = ?',
            [blocked.id]
        );
        assert(blockedRow.status === 'resolved', 'un cierre rechazado no cambia el estado');
        assert(blockedRow.assigned_to_user_id == null, 'un cierre rechazado no asigna agente');
        assert(Number(blockedRow.horas_reales) === 0, 'un cierre rechazado no carga horas');
        console.log('OK cerrar-completo no aplica cambios parciales');

        const [legacyInsert] = await pool.execute(
            `INSERT INTO tickets (user_id, title, description, priority, category_id, department_id, status, integration_source)
             VALUES (?, ?, 'lote anterior', 'medium', 25, 52, 'open', NULL)`,
            [flow.userId, `Bacarnet - [M2M-WF] legacy ${RUN}`]
        );
        createdTicketIds.push(legacyInsert.insertId);
        const legacyAssign = await fetch(`${base}/api/integrations/bacarnet/tickets/${legacyInsert.insertId}/asignar`, {
            method: 'PUT',
            headers,
            body: JSON.stringify({ agentId: agent.id }),
        });
        const legacyJson = await readJsonOrThrow(legacyAssign, 'asignar legacy');
        assert(legacyJson.data.assigned_to_user_id === agent.id, 'un ticket viejo con título Bacarnet se puede asignar');
        console.log('OK ticket legacy por título');

        const afterLegacy = await legacyFingerprint();
        assert(beforeLegacy === afterLegacy, 'no hay que modificar los tickets Bacarnet que ya existían');
        console.log('OK tickets existentes intactos');

        console.log('\nTodas las verificaciones del flujo pasaron.');
    } finally {
        await cleanup(createdTicketIds, createdUserIds);
        if (apiServer) await new Promise((resolve) => apiServer.close(resolve));
        if (webhookServer) await new Promise((resolve) => webhookServer.close(resolve));
        await pool.end();
        console.log('Datos de prueba eliminados.');
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
