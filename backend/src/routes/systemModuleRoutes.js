const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { getSystemModules, updateSystemModules } = require('../controllers/systemModuleController');

router.get('/', authenticateToken, getSystemModules);
router.put(
    '/',
    authenticateToken,
    authorizeAccess(['admin']),
    updateSystemModules
);

module.exports = router;
