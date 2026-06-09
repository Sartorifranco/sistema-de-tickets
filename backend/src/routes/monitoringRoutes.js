const express = require('express');
const router = express.Router();
const { getRealtimeMonitoring } = require('../controllers/monitoringController');
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.get(
    '/realtime',
    authenticateToken,
    authorizeAccess(['admin', 'agent'], { adminPermissions: [P.MONITORING_REALTIME] }),
    getRealtimeMonitoring
);

module.exports = router;
