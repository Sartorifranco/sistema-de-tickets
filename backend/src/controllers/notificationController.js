const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const { logActivity } = require('../services/activityLogService');
const { getNotificationConfigStatus, sendTestWhatsApp, sendTestEmail, getUserNotificationPrefs } = require('../services/notificationService');

// Almacén temporal en memoria para suscripciones Web Push (para pruebas)
const webPushSubscriptions = [];

// @desc    Suscribir usuario a Web Push nativas
// @route   POST /api/notifications/subscribe
// @access  Private
const subscribeWebPush = asyncHandler(async (req, res) => {
    const { subscription, endpoint, keys } = req.body;
    if (!subscription || !endpoint) {
        res.status(400);
        throw new Error('Se requiere subscription y endpoint.');
    }
    const userId = req.user.id;
    const subData = {
        userId,
        subscription,
        endpoint,
        keys: keys || subscription.keys,
        createdAt: new Date().toISOString(),
    };
    webPushSubscriptions.push(subData);
    console.log('[WebPush] Suscripción recibida:', { userId, endpoint, total: webPushSubscriptions.length });
    res.status(200).json({
        success: true,
        message: 'Suscripción Web Push registrada.',
    });
});

// @desc    Registrar token FCM para Push Notifications (multi-dispositivo)
// @route   POST /api/notifications/register-token
// @access  Private
const registerToken = asyncHandler(async (req, res) => {
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string') {
        res.status(400);
        throw new Error('Se requiere fcmToken.');
    }
    const token = fcmToken.trim();
    const userId = req.user.id;

    await pool.execute(
        `INSERT INTO user_fcm_tokens (user_id, token) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), created_at = NOW()`,
        [userId, token]
    );

    res.status(200).json({
        success: true,
        message: 'Token de notificaciones registrado.',
    });
});

// @desc    Enviar mensaje de prueba por WhatsApp al número del usuario
// @route   POST /api/notifications/test-whatsapp
// @access  Private (cualquier usuario con preferencias de notificación)
const testWhatsApp = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }
    const prefs = await getUserNotificationPrefs(req.user.id);
    const numero = prefs?.whatsapp_number || req.body?.phoneNumber;
    if (!numero) {
        res.status(400).json({
            success: false,
            message: 'Debe configurar su número de WhatsApp en preferencias de notificación y guardar primero.',
        });
        return;
    }
    const result = await sendTestWhatsApp(numero);
    if (result.ok) {
        res.status(200).json({
            success: true,
            message: 'Mensaje de prueba enviado. Revíselo en su WhatsApp.',
        });
    } else {
        res.status(400).json({
            success: false,
            message: result.error || 'Error al enviar mensaje de prueba.',
        });
    }
});

// @desc    Enviar email de prueba
// @route   POST /api/notifications/test-email
// @access  Private (usuarios con preferencias de notificación)
const testEmail = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }
    const prefs = await getUserNotificationPrefs(req.user.id);
    const email = prefs?.email || req.body?.email || req.user.email;
    if (!email) {
        res.status(400).json({
            success: false,
            message: 'Configure un email en preferencias de notificación o use el de su cuenta.',
        });
        return;
    }
    const result = await sendTestEmail(email);
    if (result.ok) {
        res.status(200).json({
            success: true,
            message: 'Email de prueba enviado. Revíselo en su bandeja (incluya spam).',
        });
    } else {
        res.status(400).json({
            success: false,
            message: result.error || 'Error al enviar email de prueba.',
        });
    }
});

// @desc    Instrucciones para unirse al sandbox de WhatsApp (para usuarios que configuran notificaciones)
// @route   GET /api/notifications/whatsapp-help
// @access  Private (admin, purchasing, supplier, boss)
const getWhatsAppHelp = asyncHandler(async (req, res) => {
    const status = await getNotificationConfigStatus();
    const wa = status.whatsapp || {};
    res.status(200).json({
        success: true,
        data: {
            sandboxNumber: wa.sandboxNumber || '+1 415 523 8886',
            sandboxJoinCode: wa.sandboxJoinCode || null,
            configured: wa.configured,
        },
    });
});

// @desc    Verificar estado de configuración de notificaciones (Email, Push, WhatsApp)
// @route   GET /api/notifications/config-status
// @access  Private (admin, purchasing)
const getConfigStatus = asyncHandler(async (req, res) => {
    const status = await getNotificationConfigStatus();
    res.status(200).json({ success: true, data: status });
});

// @desc    Obtener todas las notificaciones para el usuario autenticado
// @route   GET /api/notifications
// @access  Private
const getNotifications = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [notifications] = await pool.execute(
        `SELECT id, user_id, type, message, related_id, related_type, is_read, created_at
         FROM notifications
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [req.user.id]
    );
    // Se estandariza la respuesta para que siempre devuelva un objeto con una propiedad 'data'
    res.status(200).json({ success: true, data: notifications });
});

// @desc    Obtener el conteo de notificaciones no leídas
// @route   GET /api/notifications/unread-count
// @access  Private
const getUnreadNotificationCount = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [result] = await pool.execute(
        `SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE`,
        [req.user.id]
    );
    res.status(200).json({ count: result[0].count });
});

// @desc    Marcar notificación como leída
// @route   PUT /api/notifications/:id/read
// @access  Private
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [notificationRows] = await pool.execute(
        `SELECT * FROM notifications WHERE id = ?`,
        [id]
    );
    const notification = notificationRows[0];

    if (!notification) {
        res.status(404);
        throw new Error('Notificación no encontrada.');
    }

    if (notification.user_id !== req.user.id) {
        res.status(403);
        throw new Error('No autorizado para marcar esta notificación.');
    }

    await pool.execute(
        `UPDATE notifications SET is_read = TRUE WHERE id = ?`,
        [id]
    );

    await logActivity(
        req.user.id,
        req.user.username,
        req.user.role,
        'notification_read',
        `marcó la notificación #${id} como leída`,
        'notification',
        parseInt(id),
        { is_read: false },
        { is_read: true }
    );

    res.status(200).json({ success: true, message: 'Notificación marcada como leída exitosamente.' });
});

// @desc    Marcar todas las notificaciones del usuario como leídas
// @route   PUT /api/notifications/mark-all-read
// @access  Private
const markAllNotificationsAsRead = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [result] = await pool.execute(
        `UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE`,
        [req.user.id]
    );

    if (result.affectedRows > 0) {
        await logActivity(
            req.user.id,
            req.user.username,
            req.user.role,
            'notification_read_all',
            `marcó ${result.affectedRows} notificaciones como leídas`,
            'user',
            req.user.id,
            null,
            null
        );
        res.status(200).json({ success: true, message: `${result.affectedRows} notificaciones marcadas como leídas.` });
    } else {
        res.status(200).json({ success: true, message: 'No hay notificaciones no leídas para marcar.' });
    }
});

// @desc    Eliminar notificación
// @route   DELETE /api/notifications/:id
// @access  Private
const deleteNotification = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [notificationRows] = await pool.execute(
        `SELECT * FROM notifications WHERE id = ?`,
        [id]
    );
    const notification = notificationRows[0];

    if (!notification) {
        res.status(404);
        throw new Error('Notificación no encontrada.');
    }

    if (notification.user_id !== req.user.id && req.user.role !== 'admin') {
        res.status(403);
        throw new Error('No autorizado para eliminar esta notificación.');
    }

    await pool.execute(
        `DELETE FROM notifications WHERE id = ?`,
        [id]
    );

    await logActivity(
        req.user.id,
        req.user.username,
        req.user.role,
        'notification_deleted',
        `eliminó la notificación #${id}`,
        'notification',
        parseInt(id),
        notification,
        null
    );

    res.status(200).json({ success: true, message: 'Notificación eliminada exitosamente.' });
});

// @desc    Eliminar todas las notificaciones del usuario
// @route   DELETE /api/notifications/delete-all
// @access  Private
const deleteAllNotifications = asyncHandler(async (req, res) => {
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado');
    }

    const [result] = await pool.execute(
        `DELETE FROM notifications WHERE user_id = ?`,
        [req.user.id]
    );

    if (result.affectedRows > 0) {
        await logActivity(
            req.user.id,
            req.user.username,
            req.user.role,
            'notification_deleted_all',
            `eliminó todas sus notificaciones (${result.affectedRows} en total)`,
            'user',
            req.user.id,
            null,
            null
        );
        res.status(200).json({ success: true, message: `Se eliminaron ${result.affectedRows} notificaciones.` });
    } else {
        res.status(200).json({ success: true, message: 'No hay notificaciones para eliminar.' });
    }
});

module.exports = {
    getNotifications,
    getUnreadNotificationCount,
    getConfigStatus,
    getWhatsAppHelp,
    testWhatsApp,
    testEmail,
    markNotificationAsRead,
    deleteNotification,
    markAllNotificationsAsRead,
    deleteAllNotifications,
    registerToken,
    subscribeWebPush,
};
