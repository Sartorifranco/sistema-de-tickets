const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { loadUserAuthExtras, userHasAllPermissions } = require('../services/userPermissionsService');

/**
 * Middleware de autenticación JWT.
 *
 * Retorna respuestas JSON explícitas con `code` para que el frontend
 * pueda distinguir cada caso y actuar en consecuencia:
 *
 *  TOKEN_EXPIRED   → sesión expirada, el usuario debe volver a loguearse
 *  TOKEN_INVALID   → token manipulado o de otro entorno
 *  NO_TOKEN        → petición sin cabecera Authorization
 *  USER_NOT_FOUND  → el usuario fue eliminado luego de emitir el token
 */
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado: no se encontró un token.',
            code: 'NO_TOKEN',
        });
    }

    const token = authHeader.split(' ')[1];

    let decoded;
    try {
        decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
        console.error('[AuthMiddleware] Error de token:', jwtError.name);

        if (jwtError.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Tu sesión ha expirado. Por favor, iniciá sesión nuevamente.',
                code: 'TOKEN_EXPIRED',
            });
        }

        return res.status(401).json({
            success: false,
            message: 'No autorizado: el token es inválido.',
            code: 'TOKEN_INVALID',
        });
    }

    try {
        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.email, u.role, u.department_id, u.company_id,
                    u.is_super_admin,
                    c.name AS company_name
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.id = ?`,
            [decoded.id]
        );

        if (!rows[0]) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado: el usuario ya no existe.',
                code: 'USER_NOT_FOUND',
            });
        }

        const user = rows[0];
        const extras = await loadUserAuthExtras(user.id);
        req.user = {
            ...user,
            is_super_admin: extras.is_super_admin,
            permissions: extras.permissions,
        };
        return next();
    } catch (dbError) {
        console.error('[AuthMiddleware] Error de base de datos:', dbError.message);
        return next(dbError);
    }
};

/** Compatibilidad: solo verifica rol (sin RBAC para admin) */
const authorize = (roles = []) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado.',
                code: 'NO_TOKEN',
            });
        }

        if (roles.length && !roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: 'No tenés permiso para acceder a este recurso.',
                code: 'FORBIDDEN',
            });
        }

        return next();
    };
};

/**
 * Control de acceso por rol + permisos granulares (admin y agente).
 *
 * - Cliente y otros roles: solo deben estar en `roles`.
 * - Admin super: acceso total.
 * - Admin/agente: requiere permisos listados en `permissions` o `adminPermissions`.
 */
const authorizeAccess = (roles = [], options = {}) => {
    if (typeof roles === 'string') {
        roles = [roles];
    }
    const requiredPermissions = options.permissions || options.adminPermissions || [];

    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'No autorizado.',
                code: 'NO_TOKEN',
            });
        }

        const { role } = req.user;

        if (!roles.includes(role)) {
            return res.status(403).json({
                success: false,
                message: 'No tenés permiso para acceder a este recurso.',
                code: 'FORBIDDEN',
            });
        }

        if ((role === 'admin' || role === 'agent') && requiredPermissions.length > 0) {
            if (!userHasAllPermissions(req.user, requiredPermissions)) {
                return res.status(403).json({
                    success: false,
                    message: 'No tenés permiso para esta acción.',
                    code: 'FORBIDDEN',
                });
            }
        }

        return next();
    };
};

/** Solo super admin o permiso permissions.manage */
const requirePermissionsManager = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ success: false, message: 'No autorizado.', code: 'NO_TOKEN' });
    }
    if (req.user.is_super_admin || userHasAllPermissions(req.user, ['permissions.manage'])) {
        return next();
    }
    return res.status(403).json({
        success: false,
        message: 'No tenés permiso para gestionar permisos de otros usuarios.',
        code: 'FORBIDDEN',
    });
};

module.exports = {
    authenticateToken,
    authorize,
    authorizeAccess,
    requirePermissionsManager,
};
