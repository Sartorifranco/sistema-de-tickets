const express = require('express');
const router = express.Router();
const { 
    getAdminDashboardMetrics, 
    getAgentDashboardMetrics, 
    getClientDashboardMetrics 
} = require('../controllers/dashboardController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Todas las rutas en este archivo requieren que el usuario esté logueado
router.use(authenticateToken);

// Ruta específica para ADMIN, protegida para el rol 'admin'
router.get('/admin', authorize('admin'), getAdminDashboardMetrics);

// Ruta específica para AGENTE, protegida para el rol 'agent'
router.get('/agent', authorize('agent'), getAgentDashboardMetrics);

// Ruta específica para CLIENTE, protegida para el rol 'client'
router.get('/client', authorize('client'), getClientDashboardMetrics);

module.exports = router;