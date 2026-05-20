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

const { authenticateToken, authorize, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');
const upload = require('../middleware/uploadMiddleware');

router.use(authenticateToken);

router.get('/categories', authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getCategories);
router.get('/departments', authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), getDepartments);

router
    .route('/')
    .get(authorizeAccess(['admin', 'agent', 'client', 'boss', 'purchasing'], { adminPermissions: [P.TICKETS_VIEW] }), getTickets)
    .post(
        upload.array('attachments'),
        authorize(['client', 'admin', 'agent', 'boss', 'purchasing']),
        createTicket
    );

router
    .route('/:id/assign')
    .put(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_ASSIGN] }), assignTicketToSelf);

router
    .route('/:id/reassign')
    .put(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_ASSIGN] }), reassignTicket);

router
    .route('/:id/status')
    .put(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), updateTicketStatus);

router
    .route('/:id/github-commits')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_VIEW] }), getTicketGithubCommits);

router
    .route('/:id')
    .get(
        authorizeAccess(['admin', 'agent', 'client', 'boss', 'purchasing'], { adminPermissions: [P.TICKETS_VIEW] }),
        getTicketById
    )
    .put(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_EDIT] }), updateTicket)
    .delete(authorizeAccess(['admin'], { adminPermissions: [P.TICKETS_DELETE] }), deleteTicket);

router
    .route('/:id/comments')
    .get(
        authorizeAccess(['admin', 'agent', 'client', 'boss', 'purchasing'], { adminPermissions: [P.TICKETS_VIEW] }),
        getTicketComments
    )
    .post(authorize(['admin', 'agent', 'client', 'boss', 'purchasing']), addCommentToTicket);

module.exports = router;
