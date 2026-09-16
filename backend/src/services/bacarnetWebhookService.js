let lastAttempt = null;

function peekLastBacarnetWebhookAttempt() {
    return lastAttempt;
}

function resetLastBacarnetWebhookAttempt() {
    lastAttempt = null;
}

function buildStatusPayload({
    stTicketId,
    status,
    previousStatus,
    requesterEmail,
    title,
    assignedToUserId,
    changedAt,
    source,
}) {
    return {
        stTicketId: Number(stTicketId),
        status,
        previousStatus,
        requesterEmail: requesterEmail || null,
        title: title || '',
        assignedToUserId: assignedToUserId == null ? null : Number(assignedToUserId),
        changedAt: changedAt || new Date().toISOString(),
        source,
    };
}

/**
 * Aviso saliente a Bacarnet. Nunca lanza: si la URL está vacía o falla, solo loguea.
 */
async function notifyBacarnetTicketStatusChange(input) {
    const payload = buildStatusPayload(input);
    const url = (process.env.BACARNET_WEBHOOK_URL || '').trim();
    const apiKey = (process.env.BACARNET_INTEGRATION_API_KEY || '').trim();

    if (!url) {
        lastAttempt = { skipped: true, reason: 'empty_url', payload };
        console.warn('[Bacarnet webhook] BACARNET_WEBHOOK_URL vacía; se omite el POST.', payload);
        return lastAttempt;
    }

    try {
        const headers = {
            Accept: 'application/json',
            'Content-Type': 'application/json',
        };
        if (apiKey) {
            headers['X-Api-Key'] = apiKey;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(payload),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const bodyText = await res.text().catch(() => '');
            lastAttempt = { ok: false, status: res.status, payload, bodyText };
            console.error(
                `[Bacarnet webhook] POST respondió ${res.status} para ticket #${payload.stTicketId}: ${bodyText}`
            );
            return lastAttempt;
        }

        lastAttempt = { ok: true, status: res.status, payload };
        return lastAttempt;
    } catch (err) {
        lastAttempt = {
            ok: false,
            reason: err instanceof Error ? err.message : String(err),
            payload,
        };
        console.error(
            `[Bacarnet webhook] Falló el POST para ticket #${payload.stTicketId}:`,
            lastAttempt.reason
        );
        return lastAttempt;
    }
}

function notifyBacarnetTicketStatusChangeSafe(input) {
    notifyBacarnetTicketStatusChange(input).catch((err) => {
        console.error('[Bacarnet webhook] Error no controlado:', err.message || err);
    });
}

module.exports = {
    buildStatusPayload,
    notifyBacarnetTicketStatusChange,
    notifyBacarnetTicketStatusChangeSafe,
    peekLastBacarnetWebhookAttempt,
    resetLastBacarnetWebhookAttempt,
};
