const express = require('express');
const router = express.Router();
const { getReports } = require('../controllers/reportController');
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.use(authenticateToken);
router.use(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.REPORTS_VIEW] }));

router.get('/', getReports);

module.exports = router;
