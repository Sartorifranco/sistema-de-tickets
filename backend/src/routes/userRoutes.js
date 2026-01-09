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
    getAgentActiveTickets
} = require('../controllers/userController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Proteger todas las rutas
router.use(authenticateToken);

// --- RUTAS DE GESTIÓN DE USUARIOS ---

router.route('/')
    .get(authorize(['admin', 'agent']), getAllUsers) // ✅ Agentes pueden ver la lista (para asignar)
    .post(authorize(['admin', 'agent']), createUser); // ✅ CRÍTICO: Agentes pueden crear usuarios (Internos)

router.route('/agents')
    .get(authorize(['admin', 'agent']), getAgents);

router.route('/:id')
    .get(authorize(['admin', 'agent']), getUserById)
    .put(authorize(['admin']), updateUser)   // Solo admin edita datos sensibles por ahora
    .delete(authorize(['admin']), deleteUser); // Solo admin borra

// --- OTRAS RUTAS ---
router.get('/:id/stats', authorize(['admin', 'agent']), getAgentStats);
router.put('/change-password', changePassword);
router.put('/:id/reset-password', authorize(['admin']), adminResetPassword);
router.get('/:id/active-tickets', authorize(['admin', 'agent']), getAgentActiveTickets);

module.exports = router;