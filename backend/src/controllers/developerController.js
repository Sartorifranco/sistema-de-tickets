const asyncHandler = require('express-async-handler');
const pool = require('../config/db');
const { encryptGithubToken } = require('../utils/tokenEncryption');

/**
 * GET /api/developer/settings
 * Devuelve configuración para la UI. El token nunca se expone en claro por HTTP;
 * la desencriptación queda reservada para servicios internos (p. ej. githubService).
 */
const getDeveloperSettings = asyncHandler(async (req, res) => {
    const userId = req.user.id;

    const [rows] = await pool.execute(
        `SELECT github_username, github_token_encrypted
         FROM developer_settings WHERE user_id = ? LIMIT 1`,
        [userId]
    );

    if (!rows.length) {
        return res.status(200).json({
            success: true,
            data: {
                github_username: null,
                has_github_token: false,
            },
        });
    }

    const row = rows[0];
    const hasToken = !!(row.github_token_encrypted && String(row.github_token_encrypted).length > 0);

    res.status(200).json({
        success: true,
        data: {
            github_username: row.github_username || null,
            has_github_token: hasToken,
        },
    });
});

/**
 * POST /api/developer/settings
 * Body: { github_username?, github_token? }
 * Si github_token es cadena vacía o null, se borra el token guardado.
 */
const saveDeveloperSettings = asyncHandler(async (req, res) => {
    const userId = req.user.id;
    const { github_username, github_token } = req.body;

    let encryptedTokenUpdate = undefined;
    if (github_token !== undefined) {
        if (github_token === null || String(github_token).trim() === '') {
            encryptedTokenUpdate = null;
        } else {
            encryptedTokenUpdate = encryptGithubToken(String(github_token).trim());
        }
    }

    const username =
        github_username !== undefined
            ? github_username === null || String(github_username).trim() === ''
                ? null
                : String(github_username).trim().slice(0, 255)
            : undefined;

    const [existing] = await pool.execute(
        'SELECT id FROM developer_settings WHERE user_id = ? LIMIT 1',
        [userId]
    );

    if (existing.length === 0) {
        await pool.execute(
            `INSERT INTO developer_settings (user_id, github_username, github_token_encrypted)
             VALUES (?, ?, ?)`,
            [
                userId,
                username !== undefined ? username : null,
                encryptedTokenUpdate !== undefined ? encryptedTokenUpdate : null,
            ]
        );
    } else {
        const fields = [];
        const params = [];
        if (username !== undefined) {
            fields.push('github_username = ?');
            params.push(username);
        }
        if (encryptedTokenUpdate !== undefined) {
            fields.push('github_token_encrypted = ?');
            params.push(encryptedTokenUpdate);
        }
        if (fields.length === 0) {
            res.status(400);
            throw new Error('No se envió ningún campo para actualizar.');
        }
        params.push(userId);
        await pool.execute(
            `UPDATE developer_settings SET ${fields.join(', ')} WHERE user_id = ?`,
            params
        );
    }

    const [[after]] = await pool.execute(
        `SELECT github_username, github_token_encrypted FROM developer_settings WHERE user_id = ?`,
        [userId]
    );

    res.status(200).json({
        success: true,
        message: 'Configuración de desarrollador guardada.',
        data: {
            github_username: after?.github_username ?? null,
            has_github_token: !!(after?.github_token_encrypted && String(after.github_token_encrypted).length),
        },
    });
});

module.exports = {
    getDeveloperSettings,
    saveDeveloperSettings,
};
