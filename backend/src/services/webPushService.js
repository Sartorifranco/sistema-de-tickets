/**
 * Web Push nativas - envía notificaciones al SO via web-push
 */
const webpush = require('web-push');
const pool = require('../config/db');

const VAPID_PUBLIC = 'BFGJT3QJNAj6Zibb8ZNCvXJMo4pqQvz0jqdu2gJvmb_HN2hrwYF0i7RA8rNt7cU30qt3Ij8RIBhlusSIKluF3ig';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';

let initialized = false;
function ensureVapid() {
    if (initialized) return;
    if (VAPID_PRIVATE) {
        webpush.setVapidDetails('mailto:support@bacarsa.com.ar', VAPID_PUBLIC, VAPID_PRIVATE);
        initialized = true;
    } else {
        console.warn('[WebPush] VAPID_PRIVATE_KEY no definida. Web Push deshabilitado.');
    }
}

/**
 * Envía push nativo a usuarios por sus IDs
 * @param {number[]} userIds
 * @param {string} title
 * @param {string} body
 * @param {object} data - { ticketId, url, etc }
 */
async function sendWebPushToUsers(userIds, title, body, data = {}) {
    if (!userIds || userIds.length === 0) return;
    ensureVapid();
    if (!initialized) return;

    try {
        const placeholders = userIds.map(() => '?').join(',');
        const [rows] = await pool.execute(
            `SELECT endpoint, p256dh, auth FROM user_web_push_subscriptions WHERE user_id IN (${placeholders})`,
            userIds
        );
        if (rows.length === 0) return;

        const payload = JSON.stringify({
            title,
            body,
            icon: '/logo192.png',
            url: data.ticketId ? `/admin/tickets/${data.ticketId}` : '/',
            data: { ...data, ticketId: data.ticketId },
        });

        const sendPromises = rows.map(async (row) => {
            const sub = {
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth },
            };
            try {
                await webpush.sendNotification(sub, payload);
                return { ok: true };
            } catch (err) {
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await pool.execute('DELETE FROM user_web_push_subscriptions WHERE endpoint = ?', [row.endpoint]);
                }
                return { ok: false };
            }
        });

        const results = await Promise.all(sendPromises);
        const ok = results.filter((r) => r.ok).length;
        if (ok > 0) console.log(`[WebPush] Enviadas ${ok} notificaciones nativas: "${title}"`);
    } catch (err) {
        console.error('[WebPush] Error:', err.message);
    }
}

module.exports = { sendWebPushToUsers };
