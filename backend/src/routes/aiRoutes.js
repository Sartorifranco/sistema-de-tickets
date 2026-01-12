const express = require('express');
const router = express.Router();
const { predictTicket } = require('../controllers/aiController');
const { authenticateToken } = require('../middleware/authMiddleware');

router.post('/predict', authenticateToken, predictTicket);

module.exports = router;