const express = require('express');
const router = express.Router();
const {
    getAllProblemsAndCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    createProblem,
    updateProblem,
    deleteProblem,
    // ✅ Se importan las nuevas funciones
    getAllLocations,
    createLocation,
    updateLocation,
    deleteLocation
} = require('../controllers/adminController');

const { authenticateToken, authorize } = require('../middleware/authMiddleware'); 
router.use(authenticateToken);
router.use(authorize('admin'));

// Rutas para Categorías
router.route('/categories')
    .post(createCategory);

router.route('/categories/:id')
    .put(updateCategory)
    .delete(deleteCategory);

// Rutas para Problemas Predefinidos
router.route('/problems')
    .post(createProblem);

router.route('/problems/:id')
    .put(updateProblem)
    .delete(deleteProblem);
    
router.route('/problems-all')
    .get(getAllProblemsAndCategories);

// ✅ --- NUEVAS RUTAS PARA UBICACIONES ---
router.route('/locations')
    .get(getAllLocations)
    .post(createLocation);

router.route('/locations/:id')
    .put(updateLocation)
    .delete(deleteLocation);

module.exports = router;