// En src/routes/metricsRoutes.js
const express = require('express');
const router = express.Router();
const { getResolutionTimeMetrics, getAgentPerformance } = require('../controllers/metricsController');
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.get(
    '/resolution-time',
    authenticateToken,
    authorizeAccess(['admin', 'agent'], { adminPermissions: [P.REPORTS_VIEW] }),
    getResolutionTimeMetrics
);

// Rendimiento personal del agente logueado (admin puede pasar ?agentId=)
router.get(
    '/agent',
    authenticateToken,
    authorizeAccess(['admin', 'agent'], { adminPermissions: [P.REPORTS_VIEW] }),
    getAgentPerformance
);

module.exports = router;