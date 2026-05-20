const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const {
    PERMISSION_GROUPS,
    ALL_PERMISSION_KEYS,
    LIMITED_ADMIN_PRESET,
} = require('../constants/permissions');
const {
    loadUserAuthExtras,
    setUserPermissions,
    countSuperAdmins,
} = require('../services/userPermissionsService');

const getCatalog = asyncHandler(async (req, res) => {
    res.status(200).json({
        success: true,
        data: {
            groups: PERMISSION_GROUPS,
            allKeys: ALL_PERMISSION_KEYS,
            limitedAdminPreset: LIMITED_ADMIN_PRESET,
        },
    });
});

const getUserPermissions = asyncHandler(async (req, res) => {
    const targetId = parseInt(req.params.userId, 10);
    const [[target]] = await pool.execute(
        'SELECT id, username, role, is_super_admin FROM users WHERE id = ?',
        [targetId]
    );
    if (!target) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    if (target.role !== 'admin') {
        res.status(400);
        throw new Error('Los permisos granulares solo aplican a usuarios con rol admin.');
    }
    const extras = await loadUserAuthExtras(targetId);
    res.status(200).json({
        success: true,
        data: {
            userId: target.id,
            username: target.username,
            is_super_admin: extras.is_super_admin,
            permissions: extras.permissions,
        },
    });
});

const updateUserPermissions = asyncHandler(async (req, res) => {
    const targetId = parseInt(req.params.userId, 10);
    const { permissions = [], is_super_admin: isSuperAdmin } = req.body;

    const [[target]] = await pool.execute(
        'SELECT id, username, role, is_super_admin FROM users WHERE id = ?',
        [targetId]
    );
    if (!target) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }
    if (target.role !== 'admin') {
        res.status(400);
        throw new Error('Solo se pueden asignar permisos a usuarios admin.');
    }

    if (targetId === req.user.id && isSuperAdmin === false && target.is_super_admin) {
        res.status(400);
        throw new Error('No podés quitarte el rol de super administrador a vos mismo.');
    }

    if (target.is_super_admin && isSuperAdmin === false) {
        const remaining = await countSuperAdmins(targetId);
        if (remaining < 1) {
            res.status(400);
            throw new Error('Debe quedar al menos un super administrador en el sistema.');
        }
    }

    if (!req.user.is_super_admin && isSuperAdmin === true) {
        res.status(403);
        throw new Error('Solo un super administrador puede otorgar super administrador.');
    }

    const wantsManage = Array.isArray(permissions) && permissions.includes('permissions.manage');
    if (wantsManage && !req.user.is_super_admin) {
        res.status(403);
        throw new Error('Solo un super administrador puede otorgar gestión de permisos.');
    }

    const keys = Array.isArray(permissions) ? permissions : [];
    const extras = await setUserPermissions(
        targetId,
        keys,
        typeof isSuperAdmin === 'boolean' ? isSuperAdmin : undefined
    );

    res.status(200).json({
        success: true,
        message: 'Permisos actualizados.',
        data: {
            userId: targetId,
            is_super_admin: extras.is_super_admin,
            permissions: extras.permissions,
        },
    });
});

module.exports = {
    getCatalog,
    getUserPermissions,
    updateUserPermissions,
};
