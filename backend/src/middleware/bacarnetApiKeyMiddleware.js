const crypto = require('crypto');

function safeEqual(provided, expected) {
    const a = Buffer.from(String(provided), 'utf8');
    const b = Buffer.from(String(expected), 'utf8');
    if (a.length !== b.length) {
        crypto.timingSafeEqual(b, b);
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

/**
 * Valida X-Api-Key contra BACARNET_INTEGRATION_API_KEY.
 * Solo para las rutas /api/integrations/bacarnet/*.
 */
function requireBacarnetApiKey(req, res, next) {
    const expected = (process.env.BACARNET_INTEGRATION_API_KEY || '').trim();
    if (!expected) {
        return res.status(503).json({
            success: false,
            message: 'Integración Bacarnet no configurada (falta BACARNET_INTEGRATION_API_KEY).',
            code: 'INTEGRATION_NOT_CONFIGURED',
        });
    }

    const provided = String(req.get('X-Api-Key') || '').trim();
    if (!provided || !safeEqual(provided, expected)) {
        return res.status(401).json({
            success: false,
            message: 'API key inválida o ausente.',
            code: 'INVALID_API_KEY',
        });
    }

    return next();
}

module.exports = { requireBacarnetApiKey };
