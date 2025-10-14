const express = require('express');
const router = express.Router();

const {
    createTicket,
    getTickets,
    getTicketById,
    updateTicket,
    updateTicketStatus,
    deleteTicket,
    addCommentToTicket,
    getTicketComments,
    assignTicketToSelf,
    reassignTicket,
    getCategories,
    getDepartments,
} = require('../controllers/ticketController');

const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

// Este middleware se aplica a todas las rutas de este archivo
router.use(authenticateToken);

// Rutas para que el formulario pueda obtener las categorías y departamentos.
router.get('/categories', authorize(['admin', 'agent', 'client']), getCategories);
router.get('/departments', authorize(['admin', 'agent', 'client']), getDepartments);

// Rutas para la colección de tickets
router.route('/')
    .get(authorize(['admin', 'agent', 'client']), getTickets)
    // ✅ CORRECCIÓN CLAVE: Se añade el rol 'agent' a la lista de roles autorizados para crear tickets.
    .post(upload.array('attachments'), authorize(['client', 'admin', 'agent']), createTicket);

// Rutas para acciones específicas sobre un ticket
router.route('/:id/assign')
    .put(authorize(['admin', 'agent']), assignTicketToSelf);

router.route('/:id/reassign')
    .put(authorize(['admin', 'agent']), reassignTicket);

router.route('/:id/status')
    .put(authorize(['admin', 'agent', 'client']), updateTicketStatus);

// Rutas para un ticket individual (por ID)
router.route('/:id')
    .get(authorize(['admin', 'agent', 'client']), getTicketById)
    .put(authorize(['admin', 'agent']), updateTicket)
    .delete(authorize(['admin']), deleteTicket);

// Rutas para los comentarios de un ticket
router.route('/:id/comments')
    .get(authorize(['admin', 'agent', 'client']), getTicketComments)
    .post(authorize(['admin', 'agent', 'client']), addCommentToTicket);

module.exports = router;

