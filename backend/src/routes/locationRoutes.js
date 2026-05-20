const express = require('express');
const router = express.Router();
const { getLocationsByCompany, getLocationsForAdmin } = require('../controllers/locationController');
const { authenticateToken, authorize, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');

// Aplica autenticación a todas las rutas de este archivo
router.use(authenticateToken);

// ✅ CORRECCIÓN: Se añade el rol 'agent' para que puedan obtener las ubicaciones de su propia empresa si es necesario.
router.route('/').get(authorize(['client', 'admin', 'agent']), getLocationsByCompany);

// ✅ CORRECCIÓN CLAVE: Se añade el rol 'agent' para que puedan obtener las ubicaciones de CUALQUIER empresa al crear un ticket.
router
    .route('/:companyId')
    .get(authorizeAccess(['admin', 'agent'], { adminPermissions: [P.TICKETS_VIEW] }), getLocationsForAdmin);

module.exports = router;

