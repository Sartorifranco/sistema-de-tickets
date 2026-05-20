const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const {
    PERMISSION_GROUPS,
    AGENT_PERMISSION_GROUPS,
    ALL_PERMISSION_KEYS,
    LIMITED_ADMIN_PRESET,
    LIMITED_AGENT_PRESET,
    STAFF_ROLES_WITH_PERMISSIONS,
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
            agentGroups: AGENT_PERMISSION_GROUPS,
            allKeys: ALL_PERMISSION_KEYS,
            limitedAdminPreset: LIMITED_ADMIN_PRESET,
            limitedAgentPreset: LIMITED_AGENT_PRESET,
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
    if (!STAFF_ROLES_WITH_PERMISSIONS.includes(target.role)) {
        res.status(400);
        throw new Error('Los permisos granulares solo aplican a usuarios admin o agente.');
    }
    const extras = await loadUserAuthExtras(targetId);
    res.status(200).json({
        success: true,
        data: {
            userId: target.id,
            username: target.username,
            role: target.role,
            is_super_admin: target.role === 'admin' ? !!extras.is_super_admin : false,
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
    if (!STAFF_ROLES_WITH_PERMISSIONS.includes(target.role)) {
        res.status(400);
        throw new Error('Solo se pueden asignar permisos a usuarios admin o agente.');
    }

    if (target.role === 'admin' && targetId === req.user.id && isSuperAdmin === false && target.is_super_admin) {
        res.status(400);
        throw new Error('No podés quitarte el rol de super administrador a vos mismo.');
    }

    if (target.role === 'admin' && target.is_super_admin && isSuperAdmin === false) {
        const remaining = await countSuperAdmins(targetId);
        if (remaining < 1) {
            res.status(400);
            throw new Error('Debe quedar al menos un super administrador en el sistema.');
        }
    }

    if (target.role === 'admin' && !req.user.is_super_admin && isSuperAdmin === true) {
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
        target.role === 'admin' && typeof isSuperAdmin === 'boolean' ? isSuperAdmin : undefined
    );

    res.status(200).json({
        success: true,
        message: 'Permisos actualizados.',
        data: {
            userId: targetId,
            role: target.role,
            is_super_admin: target.role === 'admin' ? extras.is_super_admin : false,
            permissions: extras.permissions,
        },
    });
});

module.exports = {
    getCatalog,
    getUserPermissions,
    updateUserPermissions,
};
