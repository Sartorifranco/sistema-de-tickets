const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeAccess } = require('../middleware/authMiddleware');
const { PERMISSION_KEYS: P } = require('../constants/permissions');
const asyncHandler = require('../middleware/asyncHandler');

const {
    getBacarKeys,
    getBacarKeyById,
    createBacarKey,
    updateBacarKey,
    deleteBacarKey,
} = require('../controllers/bacarKeyController');

const adminBacar = { adminPermissions: [P.BACAR_KEYS_MANAGE] };

router
    .route('/')
    .get(authenticateToken, authorizeAccess(['admin'], adminBacar), asyncHandler(getBacarKeys))
    .post(authenticateToken, authorizeAccess(['admin'], adminBacar), asyncHandler(createBacarKey));

router
    .route('/:id')
    .get(authenticateToken, authorizeAccess(['admin'], adminBacar), asyncHandler(getBacarKeyById))
    .put(authenticateToken, authorizeAccess(['admin'], adminBacar), asyncHandler(updateBacarKey))
    .delete(authenticateToken, authorizeAccess(['admin'], adminBacar), asyncHandler(deleteBacarKey));

module.exports = router;
