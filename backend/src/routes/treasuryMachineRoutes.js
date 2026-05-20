const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');
const {
    listTreasuryMachines,
    getTreasuryMachineById,
    createTreasuryMachine,
    updateTreasuryMachine,
    deleteTreasuryMachine,
    listMachineMaintenances,
    createMachineMaintenance,
} = require('../controllers/treasuryMachineController');

router.use(authenticateToken);

const viewPerm = { adminPermissions: [P.TREASURY_MACHINES_VIEW] };
const managePerm = { adminPermissions: [P.TREASURY_MACHINES_MANAGE] };

router
    .route('/')
    .get(authorizeAccess(['admin', 'agent'], viewPerm), listTreasuryMachines)
    .post(authorizeAccess(['admin', 'agent'], managePerm), createTreasuryMachine);

router
    .route('/:id/maintenances')
    .get(authorizeAccess(['admin', 'agent'], viewPerm), listMachineMaintenances)
    .post(authorizeAccess(['admin', 'agent'], managePerm), createMachineMaintenance);

router
    .route('/:id')
    .get(authorizeAccess(['admin', 'agent'], viewPerm), getTreasuryMachineById)
    .put(authorizeAccess(['admin', 'agent'], managePerm), updateTreasuryMachine)
    .delete(authorizeAccess(['admin', 'agent'], managePerm), deleteTreasuryMachine);

module.exports = router;
