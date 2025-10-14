// backend/src/routes/bacarKeyRoutes.js
const express = require('express');
const router = express.Router();
// CAMBIADO: Importa 'authenticateToken' en lugar de 'protect'
const { authenticateToken, authorize } = require('../middleware/authMiddleware'); // <-- ¡CAMBIO AQUÍ!
const asyncHandler = require('../middleware/asyncHandler'); // Asegúrate de importar asyncHandler

const {
    getBacarKeys,
    getBacarKeyById,
    createBacarKey,
    updateBacarKey,
    deleteBacarKey,
} = require('../controllers/bacarKeyController'); // Asegúrate de que estas funciones existan y se exporten correctamente

// Rutas para claves Bacar
router.route('/')
    .get(authenticateToken, authorize('admin'), asyncHandler(getBacarKeys)) // GET /api/bacar-keys <-- ¡CAMBIO AQUÍ!
    .post(authenticateToken, authorize('admin'), asyncHandler(createBacarKey)); // POST /api/bacar-keys (solo admin) <-- ¡CAMBIO AQUÍ!

router.route('/:id')
    .get(authenticateToken, authorize('admin'), asyncHandler(getBacarKeyById)) // GET /api/bacar-keys/:id <-- ¡CAMBIO AQUÍ!
    .put(authenticateToken, authorize('admin'), asyncHandler(updateBacarKey)) // PUT /api/bacar-keys/:id (solo admin) <-- ¡CAMBIO AQUÍ!
    .delete(authenticateToken, authorize('admin'), asyncHandler(deleteBacarKey)); // DELETE /api/bacar-keys/:id (solo admin) <-- ¡CAMBIO AQUÍ!

module.exports = router;
