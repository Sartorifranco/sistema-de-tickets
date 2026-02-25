const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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

    // 1. Verificar presencia del header
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            message: 'No autorizado: no se encontró un token.',
            code: 'NO_TOKEN',
        });
    }

    const token = authHeader.split(' ')[1];

    // 2. Verificar y decodificar el JWT (separado del lookup en BD)
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

    // 3. Buscar el usuario en la BD con el id del payload
    try {
        const [rows] = await pool.execute(
            `SELECT u.id, u.username, u.email, u.role, u.department_id, u.company_id,
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

        req.user = rows[0];
        return next();
    } catch (dbError) {
        // Los errores de BD se delegan al manejador global de Express
        console.error('[AuthMiddleware] Error de base de datos:', dbError.message);
        return next(dbError);
    }
};

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

module.exports = { authenticateToken, authorize };
