const express = require('express');
const router = express.Router();
const { authenticateToken, requirePermissionsManager } = require('../middleware/authMiddleware');
const {
    getCatalog,
    getUserPermissions,
    updateUserPermissions,
} = require('../controllers/permissionController');

router.use(authenticateToken, requirePermissionsManager);

router.get('/catalog', getCatalog);
router.get('/users/:userId', getUserPermissions);
router.put('/users/:userId', updateUserPermissions);

module.exports = router;
