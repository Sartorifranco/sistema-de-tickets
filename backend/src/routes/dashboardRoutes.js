const express = require('express');
const router = express.Router();
const { 
    getAdminDashboardMetrics, 
    getAgentDashboardMetrics, 
    getClientDashboardMetrics 
} = require('../controllers/dashboardController');
const { authenticateToken, authorize, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

// Todas las rutas en este archivo requieren que el usuario esté logueado
router.use(authenticateToken);

// Ruta específica para ADMIN, protegida para el rol 'admin'
router.get('/admin', authorizeAccess(['admin'], { adminPermissions: [P.DASHBOARD_VIEW] }), getAdminDashboardMetrics);

// Ruta específica para AGENTE, protegida para el rol 'agent'
router.get('/agent', authorize('agent'), getAgentDashboardMetrics);

// Ruta específica para CLIENTE, JEFE y COMPRAS (acceso a tickets como cliente)
router.get('/client', authorize(['client', 'boss', 'purchasing']), getClientDashboardMetrics);

module.exports = router;