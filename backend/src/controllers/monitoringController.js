const asyncHandler = require('express-async-handler');
const {
    getRealtimeMonitoringData,
    getWebhookUrls,
    parsePingTargets,
} = require('../services/monitoringService');

/**
 * @desc    Proxy / fallback de monitoreo en tiempo real (n8n o ping local)
 * @route   GET /api/monitoring/realtime
 * @access  Admin/Agent con permiso monitoring.realtime
 */
const getRealtimeMonitoring = asyncHandler(async (req, res) => {
    const result = await getRealtimeMonitoringData();
    res.status(200).json({
        success: true,
        source: result.source,
        webhookUrl: result.webhookUrl || null,
        fallbackFrom: result.fallbackFrom || null,
        data: result.data,
    });
});

/**
 * @desc    Diagnóstico de conectividad (solo super admin o permiso monitoring.realtime)
 * @route   GET /api/monitoring/diagnostics
 */
const getMonitoringDiagnostics = asyncHandler(async (req, res) => {
    const urls = getWebhookUrls();
    const pingTargets = parsePingTargets();
    const timeoutMs = Number(process.env.N8N_MONITORING_TIMEOUT_MS) || 12_000;
    const attempts = [];

    for (const url of urls) {
        const started = Date.now();
        try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), Math.min(timeoutMs, 8000));
            const response = await fetch(url, {
                method: 'GET',
                headers: { Accept: 'application/json' },
                signal: controller.signal,
            });
            clearTimeout(timer);
            attempts.push({
                url,
                ok: response.ok,
                status: response.status,
                ms: Date.now() - started,
            });
        } catch (err) {
            attempts.push({
                url,
                ok: false,
                error: err.cause?.code || err.code || err.message,
                ms: Date.now() - started,
            });
        }
    }

    res.json({
        success: true,
        mode: process.env.MONITORING_MODE || 'auto',
        webhookUrls: urls,
        pingTargetsCount: pingTargets.length,
        attempts,
    });
});

module.exports = { getRealtimeMonitoring, getMonitoringDiagnostics };
