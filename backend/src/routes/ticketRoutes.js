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
    getTicketGithubCommits,
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
router.get('/categories', authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getCategories);
router.get('/departments', authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getDepartments);

// Rutas para la colección de tickets
router.route('/')
    .get(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getTickets)
    .post(upload.array('attachments'), authorize(['client', 'admin', 'agent', 'boss', 'purchasing']), createTicket);

// Rutas para acciones específicas sobre un ticket
router.route('/:id/assign')
    .put(authorize(['admin', 'agent']), assignTicketToSelf);

router.route('/:id/reassign')
    .put(authorize(['admin', 'agent']), reassignTicket);

router.route('/:id/status')
    .put(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), updateTicketStatus);

router
    .route('/:id/github-commits')
    .get(authorize(['admin', 'agent']), getTicketGithubCommits);

// Rutas para un ticket individual (por ID)
router.route('/:id')
    .get(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getTicketById)
    .put(authorize(['admin', 'agent']), updateTicket)
    .delete(authorize(['admin']), deleteTicket);

// Rutas para los comentarios de un ticket
router.route('/:id/comments')
    .get(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getTicketComments)
    .post(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), addCommentToTicket);

module.exports = router;

