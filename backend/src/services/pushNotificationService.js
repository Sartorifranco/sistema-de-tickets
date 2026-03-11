/**
 * Servicio de Push Notifications (FCM) para Tickets
 * Usa user_fcm_tokens (MySQL) y firebase-admin para enviar notificaciones.
 * Maneja tokens expirados eliminándolos de la BD.
 */
const pool = require('../config/db');
const { admin } = require('../config/firebase');

const INVALID_TOKEN_ERRORS = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token',
    'messaging/invalid-argument',
];

/**
 * Envía push a múltiples usuarios por sus IDs.
 * @param {number[]} userIds - Array de IDs de usuarios
 * @param {string} title - Título de la notificación
 * @param {string} body - Cuerpo del mensaje
 * @param {object} data - Datos adicionales (opcional, ej. { ticketId: '123' })
 */
const sendPushToUsers = async (userIds, title, body, data = {}) => {
    if (!userIds || userIds.length === 0) return;
    if (!admin || !admin.apps?.length) {
        console.warn('[PushNotification] Firebase Admin no inicializado.');
        return;
    }

    try {
        const [rows] = await pool.execute(
            'SELECT token FROM user_fcm_tokens WHERE user_id IN (?)',
            [userIds]
        );
        if (rows.length === 0) return;

        const tokens = [...new Set(rows.map(r => r.token).filter(Boolean))];
        if (tokens.length === 0) return;

        const payload = {
            tokens,
            notification: { title, body },
            data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
        };

        const response = await admin.messaging().sendEachForMulticast(payload);

        if (response.failureCount > 0) {
            const tokensToRemove = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success && resp.error) {
                    const code = resp.error.code || '';
                    if (INVALID_TOKEN_ERRORS.some(e => code.includes(e))) {
                        tokensToRemove.push(tokens[idx]);
                    }
                }
            });
            if (tokensToRemove.length > 0) {
                await removeTokens(tokensToRemove);
            }
        }

        if (response.successCount > 0) {
            console.log(`[PushNotification] Enviadas ${response.successCount} push: "${title}"`);
        }
    } catch (err) {
        console.error('[PushNotification] Error:', err.message);
    }
};

/**
 * Elimina tokens inválidos de la tabla user_fcm_tokens
 */
const removeTokens = async (tokens) => {
    if (!tokens || tokens.length === 0) return;
    try {
        const placeholders = tokens.map(() => '?').join(',');
        await pool.execute(`DELETE FROM user_fcm_tokens WHERE token IN (${placeholders})`, tokens);
        console.log(`[PushNotification] ${tokens.length} token(s) expirados eliminados.`);
    } catch (err) {
        console.error('[PushNotification] Error eliminando tokens:', err.message);
    }
};

/**
 * Obtiene IDs de usuarios admin y agent
 */
const getAdminAndAgentIds = async () => {
    const [rows] = await pool.execute(
        "SELECT id FROM users WHERE role IN ('admin', 'agent') AND is_active != 0"
    );
    return rows.map(r => r.id);
};

module.exports = {
    sendPushToUsers,
    removeTokens,
    getAdminAndAgentIds,
};
