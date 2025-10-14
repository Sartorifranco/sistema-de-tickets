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
} = require('../controllers/userController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.use(authenticateToken);

router.get('/agents', authorize(['admin', 'agent']), getAgents);
router.put('/change-password', changePassword);
router.put('/:id/reset-password', authorize(['admin']), adminResetPassword);

router.route('/')
    .get(authorize(['admin', 'agent']), getAllUsers)
    .post(authorize(['admin']), createUser);

router.route('/:id')
    .get(authorize(['admin', 'agent']), getUserById)
    .put(authorize(['admin']), updateUser)
    .delete(authorize(['admin']), deleteUser);

router.route('/:id/stats')
    .get(authorize(['admin', 'agent']), getAgentStats);

router.get('/:id/active-tickets', authorize(['admin']), getAgentActiveTickets);

module.exports = router;