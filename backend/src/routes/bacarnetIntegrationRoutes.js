const express = require('express');
const { requireBacarnetApiKey } = require('../middleware/bacarnetApiKeyMiddleware');
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
} = require('../controllers/bacarnetIntegrationController');

const router = express.Router();

router.use(requireBacarnetApiKey);

router.get('/catalogo', getCatalogo);
router.post('/tickets', withUploadErrors(upload.array('attachments')), createBacarnetTicket);
router.get('/tickets/:id/comentarios', getBacarnetComments);
router.post('/tickets/:id/comentarios', addBacarnetComment);
router.post('/tickets/:id/adjuntos', withUploadErrors(upload.array('attachments')), addBacarnetAttachments);
router.put('/tickets/:id/estado', updateBacarnetTicketEstado);
router.get('/tickets/:id', getBacarnetTicketById);

module.exports = router;
