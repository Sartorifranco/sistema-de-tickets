const express = require('express');
const router = express.Router();
const {
    getAllCompanies,
    getCompanyById,
    createCompany,
    updateCompany,
    deleteCompany
} = require('../controllers/companyController');
const { getDepartmentsByCompany } = require('../controllers/departmentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

router.use(authenticateToken);

// Rutas para /api/companies (Lista general)
router.route('/')
    // La lista completa la ven Admin y Agente (para filtros)
    .get(authorize(['admin', 'agent']), getAllCompanies)
    .post(authorize(['admin']), createCompany);

// Rutas para /api/companies/:id (Detalle de UNA empresa)
router.route('/:id')
    // ✅ CAMBIO AQUÍ: Agregamos 'client'.
    // El cliente necesita permiso para consultar los datos de SU propia empresa en el Perfil.
    .get(authorize(['admin', 'agent', 'client']), getCompanyById)
    .put(authorize(['admin']), updateCompany)
    .delete(authorize(['admin']), deleteCompany);

// Ruta para departamentos
router.route('/:companyId/departments')
    .get(authorize(['admin', 'agent']), getDepartmentsByCompany);

module.exports = router;