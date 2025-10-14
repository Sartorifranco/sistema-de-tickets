const express = require('express');
const router = express.Router();
const {
    getAllCompanies,
    getCompanyById, // <-- Se importa la nueva función
    createCompany,
    updateCompany,
    deleteCompany
} = require('../controllers/companyController');
const { getDepartmentsByCompany } = require('../controllers/departmentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Se aplica el middleware de autenticación a todas las rutas de este archivo.
router.use(authenticateToken);

// Rutas para /api/companies
router.route('/')
    // Solo los administradores pueden ver la lista completa de empresas.
    .get(authorize(['admin']), getAllCompanies)
    // Solo los administradores pueden crear nuevas empresas.
    .post(authorize(['admin']), createCompany);

// Rutas para /api/companies/:id
router.route('/:id')
    // --- CORRECCIÓN CLAVE ---
    // Esta ruta ahora es accesible para todos los roles autenticados.
    // La lógica de seguridad que verifica si el usuario pertenece a la empresa está dentro del controlador.
    .get(getCompanyById)
    .put(authorize(['admin']), updateCompany)
    .delete(authorize(['admin']), deleteCompany);

// Ruta para obtener los departamentos de una empresa específica (solo para administradores)
router.route('/:companyId/departments')
    .get(authorize(['admin']), getDepartmentsByCompany);

module.exports = router;

