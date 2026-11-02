const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 300;

/**
 * Tope por IP para /api/integrations/bacarnet.
 * No usa ni registra la API key.
 */
function createBacarnetRateLimit(options = {}) {
    const windowMs = options.windowMs || WINDOW_MS;
    const max = options.max || MAX_REQUESTS;
    const buckets = new Map();

    return function bacarnetRateLimit(req, res, next) {
        const now = Date.now();
        const ip = req.ip || (req.socket && req.socket.remoteAddress) || 'unknown';
        let bucket = buckets.get(ip);
        if (!bucket || now - bucket.start >= windowMs) {
            bucket = { start: now, count: 0 };
            buckets.set(ip, bucket);
        }
        bucket.count += 1;

        if (buckets.size > 5000) {
            for (const [key, value] of buckets) {
                if (now - value.start >= windowMs) buckets.delete(key);
            }
        }

        if (bucket.count > max) {
            res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
            return res.status(429).json({
                success: false,
                message: 'Demasiadas solicitudes a la integración. Probá de nuevo en un minuto.',
            });
        }
        return next();
    };
}

const bacarnetRateLimit = createBacarnetRateLimit();

module.exports = {
    createBacarnetRateLimit,
    bacarnetRateLimit,
    BACARNET_RATE_LIMIT_MAX: MAX_REQUESTS,
    BACARNET_RATE_LIMIT_WINDOW_MS: WINDOW_MS,
};
