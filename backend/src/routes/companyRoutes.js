const express = require('express');
const router = express.Router();
const {
    getAllCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany,
} = require('../controllers/companyController');
const { getDepartmentsByCompany } = require('../controllers/departmentController');
const { authenticateToken, authorize, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.use(authenticateToken);

router
    .route('/')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.COMPANIES_VIEW] }), getAllCompanies)
    .post(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), createCompany);

router
    .route('/:id')
    .get(authorize(['admin', 'agent', 'client', 'boss', 'purchasing', 'supplier']), getCompanyById)
    .put(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), updateCompany)
    .delete(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), deleteCompany);

router
    .route('/:companyId/departments')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.COMPANIES_VIEW] }), getDepartmentsByCompany);

module.exports = router;
