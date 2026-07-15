const pool = require('../config/db');
const asyncHandler = require('express-async-handler');
const { SYSTEM_MODULES, SYSTEM_MODULE_KEYS } = require('../constants/systemModules');

async function ensureDefaults() {
    for (const key of SYSTEM_MODULE_KEYS) {
        await pool.execute(
            `INSERT INTO system_module_settings (module_key, is_enabled)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE module_key = module_key`,
            [key]
        );
    }
}

function rowsToMap(rows) {
    const map = {};
    SYSTEM_MODULE_KEYS.forEach((key) => {
        map[key] = true;
    });
    (rows || []).forEach((row) => {
        if (SYSTEM_MODULE_KEYS.includes(row.module_key)) {
            map[row.module_key] = Boolean(row.is_enabled);
        }
    });
    return map;
}

async function loadEnabledMap() {
    const [rows] = await pool.execute('SELECT module_key, is_enabled FROM system_module_settings');
    return rowsToMap(rows);
}

/** GET /api/system-modules — cualquier usuario autenticado */
const getSystemModules = asyncHandler(async (req, res) => {
    try {
        await ensureDefaults();
        const enabledMap = await loadEnabledMap();
        res.status(200).json({
            success: true,
            data: {
                modules: SYSTEM_MODULES.map((m) => ({
                    ...m,
                    enabled: enabledMap[m.key] !== false,
                })),
                enabledMap,
            },
        });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            const enabledMap = Object.fromEntries(SYSTEM_MODULE_KEYS.map((k) => [k, true]));
            return res.status(200).json({
                success: true,
                data: {
                    modules: SYSTEM_MODULES.map((m) => ({ ...m, enabled: true })),
                    enabledMap,
                    warning: 'Tabla system_module_settings no existe. Ejecutá la migración.',
                },
            });
        }
        throw err;
    }
});

/** PUT /api/system-modules — admin */
const updateSystemModules = asyncHandler(async (req, res) => {
    const { modules } = req.body || {};
    if (!modules || typeof modules !== 'object') {
        res.status(400);
        throw new Error('Enviá un objeto modules con { moduleKey: boolean }.');
    }

    try {
        await ensureDefaults();

        for (const key of SYSTEM_MODULE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(modules, key)) {
                const enabled = modules[key] ? 1 : 0;
                await pool.execute(
                    `INSERT INTO system_module_settings (module_key, is_enabled)
                     VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled)`,
                    [key, enabled]
                );
            }
        }

        const enabledMap = await loadEnabledMap();

        res.status(200).json({
            success: true,
            message: 'Visibilidad de módulos actualizada.',
            data: {
                modules: SYSTEM_MODULES.map((m) => ({
                    ...m,
                    enabled: enabledMap[m.key] !== false,
                })),
                enabledMap,
            },
        });
    } catch (err) {
        if (err.code === 'ER_NO_SUCH_TABLE') {
            res.status(503);
            throw new Error('Falta aplicar la migración create_system_module_settings.sql');
        }
        throw err;
    }
});

module.exports = { getSystemModules, updateSystemModules };
