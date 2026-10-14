const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { getSettings, updateSettings, getReview, postDecision } = require('../controllers/ticketAuthorizationController');

// Públicas: las usa el autorizante desde el enlace del correo (el token es la credencial).
router.get('/review', getReview);
router.post('/decision', postDecision);

router.get('/settings', authenticateToken, authorizeAccess(['admin']), getSettings);
router.put('/settings', authenticateToken, authorizeAccess(['admin']), updateSettings);

module.exports = router;
