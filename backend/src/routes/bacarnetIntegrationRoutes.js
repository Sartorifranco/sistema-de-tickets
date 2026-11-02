const express = require('express');
const { requireBacarnetApiKey } = require('../middleware/bacarnetApiKeyMiddleware');
const { bacarnetRateLimit } = require('../middleware/bacarnetRateLimitMiddleware');
const upload = require('../middleware/uploadMiddleware');
const { withUploadErrors } = require('../middleware/uploadMiddleware');
const {
    getCatalogo,
    createBacarnetTicket,
    getBacarnetTicketById,
    addBacarnetComment,
    getBacarnetComments,
    addBacarnetAttachments,
    updateBacarnetTicketEstado,
    assignBacarnetTicket,
    addBacarnetTicketHours,
    closeBacarnetTicketFully,
} = require('../controllers/bacarnetIntegrationController');

const router = express.Router();

router.use(bacarnetRateLimit);
router.use(requireBacarnetApiKey);

router.get('/catalogo', getCatalogo);
router.post('/tickets', withUploadErrors(upload.array('attachments')), createBacarnetTicket);
router.get('/tickets/:id/comentarios', getBacarnetComments);
router.post('/tickets/:id/comentarios', addBacarnetComment);
router.post('/tickets/:id/adjuntos', withUploadErrors(upload.array('attachments')), addBacarnetAttachments);
router.put('/tickets/:id/asignar', assignBacarnetTicket);
router.post('/tickets/:id/horas', addBacarnetTicketHours);
router.put('/tickets/:id/cerrar-completo', closeBacarnetTicketFully);
router.put('/tickets/:id/estado', updateBacarnetTicketEstado);
router.get('/tickets/:id', getBacarnetTicketById);

module.exports = router;
