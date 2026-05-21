const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');
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
    finalizeRoute,
} = require('../controllers/depositarioController');

const depView = {
    adminPermissions: [P.DEPOSITARIOS_VIEW],
    agentPermissions: [P.DEPOSITARIOS_VIEW, P.TICKETS_VIEW],
    permissionMode: 'any',
};
const depManage = { adminPermissions: [P.DEPOSITARIOS_MANAGE] };
const monEquipos = { adminPermissions: [P.MONITORING_EQUIPOS] };

router.use(authenticateToken);

router
    .route('/')
    .get(
        authorizeAccess(['admin', 'agent', 'client', 'boss', 'purchasing'], depView),
        getDepositarios
    )
    .post(authorizeAccess(['admin', 'agent'], depManage), createDepositario);

router.get('/metrics', getDepositarioMetrics);
router.get('/map-data', authorizeAccess(['admin', 'agent'], monEquipos), getMapData);
router.get('/reports', authorizeAccess(['admin', 'agent'], depView), getDepositaryReports);

router.get('/:id/analysis', authorizeAccess(['admin', 'agent'], depView), getDepositaryAnalysis);

router
    .route('/route')
    .post(authorizeAccess(['admin', 'agent'], depManage), saveRoute)
    .get(authorizeAccess(['admin', 'agent'], depView), getRouteHistory);

router.post('/route/finalize', authorizeAccess(['admin', 'agent'], depManage), finalizeRoute);

router
    .route('/:id')
    .put(authorizeAccess(['admin'], depManage), updateDepositario)
    .delete(authorizeAccess(['admin'], depManage), deleteDepositario);

router
    .route('/:id/maintenance')
    .get(authorizeAccess(['admin', 'agent'], depView), getMaintenanceHistory)
    .post(authorizeAccess(['admin', 'agent'], depManage), addMaintenance);

module.exports = router;
