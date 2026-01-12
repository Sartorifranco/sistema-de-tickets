const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const {
    getDepositarios,
    createDepositario,
    updateDepositario,
    deleteDepositario,
    addMaintenance,
    getMaintenanceHistory,
    getDepositarioMetrics,
    getMapData,
    saveRoute,
    getRouteHistory // <--- NUEVA IMPORTACIÓN
} = require('../controllers/depositarioController');

router.use(authenticateToken);

// Rutas Generales
router.route('/')
    .get(getDepositarios)
    .post(authorize(['admin', 'agent']), createDepositario);

// Métricas y Mapa (ANTES de los ID)
router.get('/metrics', getDepositarioMetrics);
router.get('/map-data', authorize(['admin', 'agent']), getMapData);

// Rutas de Hoja de Ruta
router.route('/route')
    .post(authorize(['admin', 'agent']), saveRoute)      // Guardar nueva ruta
    .get(authorize(['admin', 'agent']), getRouteHistory); // Ver historial

// Rutas Específicas por ID
router.route('/:id')
    .put(authorize(['admin']), updateDepositario)
    .delete(authorize(['admin']), deleteDepositario);

router.route('/:id/maintenance')
    .get(getMaintenanceHistory)
    .post(authorize(['admin', 'agent']), addMaintenance);

module.exports = router;