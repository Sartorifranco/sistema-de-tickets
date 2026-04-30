const express = require('express');
const router = express.Router();

const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const { getDeveloperSettings, saveDeveloperSettings } = require('../controllers/developerController');

router.use(authenticateToken);

router.get('/settings', authorize(['admin', 'agent']), getDeveloperSettings);
router.post('/settings', authorize(['admin', 'agent']), saveDeveloperSettings);

module.exports = router;
