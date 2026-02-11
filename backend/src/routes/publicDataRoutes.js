const express = require('express');
const router = express.Router();
const { getPublicCompanies, getPublicDepartments } = require('../controllers/publicDataController');

// Estas rutas son accesibles SIN token
router.get('/companies', getPublicCompanies);
router.get('/departments', getPublicDepartments);

module.exports = router;