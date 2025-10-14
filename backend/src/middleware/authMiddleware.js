const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const pool = require('../config/db');

const authenticateToken = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            const [rows] = await pool.execute(
                'SELECT id, username, email, role, department_id, company_id FROM users WHERE id = ?', 
                [decoded.id]
            );
            
            req.user = rows[0];

            if (!req.user) {
                res.status(401);
                throw new Error('No autorizado, usuario no encontrado.');
            }
            next();
        } catch (error) {
            console.error('[AuthMiddleware] Error de token:', error.message);
            res.status(401);
            throw new Error('No autorizado, el token ha fallado.');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('No autorizado, no se encontró un token.');
    }
});

const authorize = (roles = []) => {
    // Asegurarse de que 'roles' sea siempre un array
    if (typeof roles === 'string') {
        roles = [roles];
    }

    return (req, res, next) => {
        if (!req.user) {
            res.status(401);
            throw new Error('No autorizado.');
        }
        
        // Si el array de roles permitidos incluye el rol del usuario, se le da acceso.
        if (roles.length && !roles.includes(req.user.role)) {
            res.status(403); // 403 Forbidden es más apropiado aquí
            throw new Error('No tienes permiso para acceder a este recurso.');
        }
        
        next();
    };
};

module.exports = { authenticateToken, authorize };
