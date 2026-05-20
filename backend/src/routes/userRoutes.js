const express = require('express');
const router = express.Router();
const {
    createUser,
    getAllUsers,
    getUserById,
    updateUser,
    deleteUser,
    getAgentStats,
    changePassword,
    adminResetPassword,
    getAgents,
    getAgentActiveTickets,
    getMyNotificationPreferences,
    updateMyNotificationPreferences,
} = require('../controllers/userController');
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.use(authenticateToken);

router
    .route('/')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.USERS_VIEW] }), getAllUsers)
    .post(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.USERS_CREATE] }), createUser);

router.route('/agents').get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.USERS_VIEW] }), getAgents);

router
    .route('/me/notification-preferences')
    .get(getMyNotificationPreferences)
    .put(updateMyNotificationPreferences);

router
    .route('/:id')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.USERS_VIEW] }), getUserById)
    .put(authorizeAccess(['admin'], { adminPermissions: [P.USERS_EDIT] }), updateUser)
    .delete(authorizeAccess(['admin'], { adminPermissions: [P.USERS_DELETE] }), deleteUser);

router.get('/:id/stats', authorizeAccess(['admin', 'agent'], { adminPermissions: [P.USERS_VIEW] }), getAgentStats);
router.put('/change-password', changePassword);
router.put(
    '/:id/reset-password',
    authorizeAccess(['admin'], { adminPermissions: [P.USERS_RESET_PASSWORD] }),
    adminResetPassword
);
router.get(
    '/:id/active-tickets',
    authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_VIEW] }),
    getAgentActiveTickets
);

module.exports = router;
