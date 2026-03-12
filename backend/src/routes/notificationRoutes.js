const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/authMiddleware');
const {
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
} = require('../controllers/notificationController');

router.use(authenticateToken);

// Rutas POST primero (evitar conflicto con /:id)
router.post('/subscribe', subscribeWebPush);
router.post('/register-token', registerToken);
router.get('/config-status', authorize(['admin', 'purchasing']), getConfigStatus);
router.get('/whatsapp-help', authorize(['admin', 'purchasing', 'supplier', 'boss']), getWhatsAppHelp);
router.post('/test-whatsapp', testWhatsApp);
router.post('/test-email', testEmail);

// GET /api/notifications -> Obtiene todas las notificaciones
// PUT /api/notifications -> Marca todas como leídas
router.route('/')
    .get(getNotifications)
    .put(markAllNotificationsAsRead); // ✅ AJUSTE: Esta ruta ahora es PUT

router.get('/unread-count', getUnreadNotificationCount);

router.put('/:id/read', markNotificationAsRead);
router.delete('/:id', deleteNotification);
router.delete('/delete-all', deleteAllNotifications);

// La ruta /mark-all-read se elimina porque ya está cubierta por PUT /
// router.put('/mark-all-read', authenticateToken, markAllNotificationsAsRead);

module.exports = router;