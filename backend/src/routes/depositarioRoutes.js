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
    getDepositarioMetrics
} = require('../controllers/depositarioController');

router.use(authenticateToken);

router.route('/')
    .get(getDepositarios)
    .post(authorize(['admin', 'agent']), createDepositario);

router.route('/:id')
    .put(authorize(['admin']), updateDepositario) // Solo admin edita
    .delete(authorize(['admin']), deleteDepositario); // Solo admin borra

router.get('/metrics', getDepositarioMetrics);

router.route('/:id/maintenance')
    .get(getMaintenanceHistory)
    .post(authorize(['admin', 'agent']), addMaintenance);

module.exports = router;