const express = require('express');
const router = express.Router();
const { getPublicCompanies, getPublicDepartments } = require('../controllers/publicDataController');
const { e2eGetApproveUrl } = require('../controllers/purchaseController');

// Rutas públicas - SIN token (E2E mock-email, registro)
router.get('/companies', getPublicCompanies);
router.get('/departments', getPublicDepartments);
router.get('/e2e-get-approve-url/:purchaseId', e2eGetApproveUrl);

module.exports = router;