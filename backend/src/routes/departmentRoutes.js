const express = require('express');
const router = express.Router();
const {
    getAllDepartments,
    getDepartmentById,
    createDepartment,
    updateDepartment,
    deleteDepartment
} = require('../controllers/departmentController');
const { authenticateToken, authorize } = require('../middleware/authMiddleware');

// Se aplica el middleware de autenticación a todas las rutas de este archivo.
router.use(authenticateToken);

// Rutas para /api/departments
router.route('/')
    // La función ya maneja la lógica de roles internamente.
    .get(getAllDepartments)
    // Solo los administradores pueden crear nuevos departamentos.
    .post(authorize(['admin']), createDepartment);

// Rutas para /api/departments/:id
router.route('/:id')
    // --- CORRECCIÓN CLAVE ---
    // Esta ruta ahora es accesible para todos los roles autenticados.
    // La lógica de seguridad que verifica si el usuario pertenece a la empresa
    // del departamento está ahora dentro del controlador.
    .get(getDepartmentById)
    .put(authorize(['admin']), updateDepartment)
    .delete(authorize(['admin']), deleteDepartment);

module.exports = router;

