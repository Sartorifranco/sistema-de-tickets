const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const WEBHOOK_PATH = '/webhook/b176be3d-9eec-4c45-a89f-94460dee1461';
const DEFAULT_WEBHOOK_URL = `https://autbacar.dnsalias.com${WEBHOOK_PATH}`;

function getWebhookUrls() {
    const primary = (process.env.N8N_MONITORING_WEBHOOK_URL || DEFAULT_WEBHOOK_URL).trim();
    const extra = (process.env.N8N_MONITORING_WEBHOOK_FALLBACKS || '')
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);

    const localDefaults = [
        `http://127.0.0.1:5678${WEBHOOK_PATH}`,
        `http://localhost:5678${WEBHOOK_PATH}`,
        `http://192.168.0.9:5678${WEBHOOK_PATH}`,
    ];

    return [...new Set([primary, ...extra, ...localDefaults].filter(Boolean))];
}

function parsePingTargets() {
    const raw = (process.env.MONITORING_PING_TARGETS || '').trim();
    if (!raw) return [];

    if (raw.startsWith('[')) {
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((item) => ({
                    name: String(item.name || item.host || item.ip || '').trim(),
                    ip: String(item.ip || item.host || '').trim(),
                }))
                .filter((item) => item.name && item.ip);
        } catch {
            return [];
        }
    }

    return raw
        .split(',')
        .map((part) => {
            const [name, ip] = part.split('|').map((s) => s.trim());
            return name && ip ? { name, ip } : null;
        })
        .filter(Boolean);
}

function normalizeEquipmentPayload(raw) {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object') {
        const obj = raw;
        const arr = obj.body ?? obj.data ?? obj.payload ?? obj.items ?? obj.equipos ?? obj.results;
        if (Array.isArray(arr)) return arr;
    }
    return [];
}

async function fetchWebhookJson(webhookUrl, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(webhookUrl, {
            method: 'GET',
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (!response.ok) {
            const err = new Error(`HTTP ${response.status}`);
            err.code = 'HTTP_ERROR';
            throw err;
        }

        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const text = await response.text();
            const err = new Error(`Respuesta no JSON: ${text.slice(0, 120)}`);
            err.code = 'INVALID_JSON';
            throw err;
        }

        return response.json();
    } finally {
        clearTimeout(timer);
    }
}

async function pingHost(host, timeoutMs = 2000) {
    const args = ['-n', '1', '-w', String(timeoutMs), host];
    try {
        const { stdout } = await execFileAsync('ping', args, { timeout: timeoutMs + 1500, windowsHide: true });
        const text = stdout.toLowerCase();

        const offlineMarkers = [
            'no disponible',
            'unreachable',
            'timed out',
            '100%',
            'could not find host',
            'could not resolve',
            'host desconocido',
        ];
        if (offlineMarkers.some((marker) => text.includes(marker))) {
            return { online: false, latencyMs: 0, packetLoss: 100 };
        }

        const match =
            stdout.match(/tiempo[=<](\d+)\s*ms/i) ||
            stdout.match(/time[=<](\d+)\s*ms/i) ||
            stdout.match(/average\s*=\s*(\d+)\s*ms/i);

        const latencyMs = match ? parseInt(match[1], 10) : 1;
        return { online: true, latencyMs, packetLoss: 0 };
    } catch {
        return { online: false, latencyMs: 0, packetLoss: 100 };
    }
}

async function fetchFromN8n() {
    const timeoutMs = Number(process.env.N8N_MONITORING_TIMEOUT_MS) || 12_000;
    const urls = getWebhookUrls();
    const errors = [];

    for (const url of urls) {
        try {
            const data = await fetchWebhookJson(url, timeoutMs);
            const equipos = normalizeEquipmentPayload(data);
            if (equipos.length === 0 && data && typeof data === 'object' && !Array.isArray(data)) {
                errors.push(`${url}: JSON vacío o sin equipos`);
                continue;
            }
            return { source: 'n8n', webhookUrl: url, data: equipos.length ? equipos : data };
        } catch (err) {
            const code = err.cause?.code || err.code || err.name;
            errors.push(`${url}: ${code || err.message}`);
        }
    }

    const err = new Error(
        `No se pudo conectar con n8n. URLs probadas: ${urls.join(', ')}. Detalle: ${errors.join(' | ')}`
    );
    err.code = 'N8N_UNREACHABLE';
    err.attempts = errors;
    throw err;
}

async function fetchFromPingTargets() {
    const targets = parsePingTargets();
    if (targets.length === 0) {
        const err = new Error(
            'n8n no responde y no hay respaldo configurado. Agregá MONITORING_PING_TARGETS en el .env del backend o levantá n8n.'
        );
        err.code = 'NO_FALLBACK';
        throw err;
    }

    const checkedAt = new Date().toISOString();
    const equipos = [];

    for (const target of targets) {
        const result = await pingHost(target.ip);
        equipos.push({
            name: target.name,
            ip: target.ip,
            status: result.online ? 'ONLINE' : 'OFFLINE',
            packetLoss: result.packetLoss,
            latencyMs: result.latencyMs,
            checkedAt,
        });
    }

    return { source: 'ping', data: equipos };
}

async function getRealtimeMonitoringData() {
    const mode = (process.env.MONITORING_MODE || 'auto').toLowerCase();

    if (mode === 'ping') {
        return fetchFromPingTargets();
    }

    if (mode === 'n8n') {
        return fetchFromN8n();
    }

    try {
        return await fetchFromN8n();
    } catch (n8nErr) {
        try {
            const pingResult = await fetchFromPingTargets();
            pingResult.fallbackFrom = 'n8n';
            pingResult.fallbackReason = n8nErr.message;
            return pingResult;
        } catch {
            throw n8nErr;
        }
    }
}

module.exports = {
    getWebhookUrls,
    parsePingTargets,
    getRealtimeMonitoringData,
};
