/**
 * Rutas de Proveedores - Solo Encargado de Compras (purchasing)
 */
const express = require('express');
const router = express.Router();
const { authenticateToken, authorize } = require('../middleware/authMiddleware');
const { createSupplier, getSuppliers, regenerateInvitationLink } = require('../controllers/supplierController');

router.use(authenticateToken);
router.use(authorize(['purchasing']));

router.route('/')
    .get(getSuppliers)
    .post(createSupplier);

router.post('/:id/invitation', regenerateInvitationLink);

module.exports = router;
