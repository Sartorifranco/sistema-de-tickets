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
    getRouteHistory,
    getDepositaryReports,
    getDepositaryAnalysis,
    finalizeRoute // <--- 1. IMPORTANTE: Que esté importado aquí
} = require('../controllers/depositarioController');

router.use(authenticateToken);

// Rutas Generales
router.route('/')
    .get(getDepositarios)
    .post(authorize(['admin', 'agent']), createDepositario);

// Métricas, Mapa y REPORTES
router.get('/metrics', getDepositarioMetrics);
router.get('/map-data', authorize(['admin', 'agent']), getMapData);
router.get('/reports', authorize(['admin', 'agent']), getDepositaryReports); 

// Análisis IA Individual
router.get('/:id/analysis', authorize(['admin', 'agent']), getDepositaryAnalysis);

// Rutas de Hoja de Ruta
router.route('/route')
    .post(authorize(['admin', 'agent']), saveRoute)
    .get(authorize(['admin', 'agent']), getRouteHistory);

// NUEVA RUTA PARA FINALIZAR Y ENVIAR MAIL (Esta es la que te falta o no se cargó)
router.post('/route/finalize', authorize(['admin', 'agent']), finalizeRoute); 

// Rutas Específicas por ID
router.route('/:id')
    .put(authorize(['admin']), updateDepositario)
    .delete(authorize(['admin']), deleteDepositario);

router.route('/:id/maintenance')
    .get(getMaintenanceHistory)
    .post(authorize(['admin', 'agent']), addMaintenance);

module.exports = router;