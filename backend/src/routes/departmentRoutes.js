const express = require('express');
const router = express.Router();
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment,
} = require('../controllers/departmentController');
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

router.use(authenticateToken);

router
    .route('/')
    .get(getAllDepartments)
    .post(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), createDepartment);

router
    .route('/:id')
    .get(getDepartmentById)
    .put(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), updateDepartment)
    .delete(authorizeAccess(['admin'], { adminPermissions: [P.COMPANIES_MANAGE] }), deleteDepartment);

module.exports = router;
