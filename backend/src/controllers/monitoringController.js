const asyncHandler = require('express-async-handler');

const DEFAULT_WEBHOOK_URL =
    'https://autbacar.dnsalias.com/webhook/b176be3d-9eec-4c45-a89f-94460dee1461';

function getWebhookUrl() {
    return (process.env.N8N_MONITORING_WEBHOOK_URL || DEFAULT_WEBHOOK_URL).trim();
}

/**
 * @desc    Proxy al webhook n8n de monitoreo en tiempo real (evita CORS en el navegador)
 * @route   GET /api/monitoring/realtime
 * @access  Admin/Agent con permiso monitoring.realtime
 */
const getRealtimeMonitoring = asyncHandler(async (req, res) => {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
        res.status(503);
        throw new Error('Monitoreo no configurado: falta N8N_MONITORING_WEBHOOK_URL en el servidor.');
    }

    const timeoutMs = Number(process.env.N8N_MONITORING_TIMEOUT_MS) || 20_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(webhookUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (!response.ok) {
            res.status(502);
            throw new Error(`El servidor n8n respondió HTTP ${response.status}.`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            res.status(502);
            throw new Error(`n8n no devolvió JSON. Respuesta: ${text.slice(0, 120)}`);
        }

        const data = await response.json();
        res.status(200).json({ success: true, data });
    } catch (err) {
        if (err.name === 'AbortError') {
            res.status(504);
            throw new Error(
                `El servidor n8n no respondió a tiempo (${Math.round(timeoutMs / 1000)} s). Verificá que n8n esté activo en ${webhookUrl.split('/webhook')[0]}.`
            );
        }

        const code = err.cause?.code || err.code;
        if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') {
            res.status(502);
            throw new Error(`No se pudo resolver el host de n8n (${webhookUrl}). Revisá DNS o la URL en N8N_MONITORING_WEBHOOK_URL.`);
        }
        if (code === 'ECONNREFUSED' || code === 'ETIMEDOUT' || code === 'UND_ERR_CONNECT_TIMEOUT') {
            res.status(502);
            throw new Error(
                `No hay conexión con n8n (${webhookUrl.split('/webhook')[0]}). Confirmá que el servicio esté encendido y accesible desde el servidor de tickets.`
            );
        }

        if (!res.statusCode || res.statusCode < 400) {
            res.status(502);
        }
        throw err;
    } finally {
        clearTimeout(timer);
    }
});

module.exports = { getRealtimeMonitoring };
