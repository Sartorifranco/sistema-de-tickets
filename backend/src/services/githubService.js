const axios = require('axios');
const pool = require('../config/db');
const { decryptGithubToken } = require('../utils/tokenEncryption');

const GITHUB_API = 'https://api.github.com';

/**
 * Token de GitHub desencriptado para un usuario (solo uso interno en el servidor).
 * @param {number} userId
 * @returns {Promise<string|null>}
 */
async function getDecryptedGithubTokenForUser(userId) {
    const [rows] = await pool.execute(
        'SELECT github_token_encrypted FROM developer_settings WHERE user_id = ? LIMIT 1',
        [userId]
    );
    if (!rows.length || !rows[0].github_token_encrypted) {
        return null;
    }
    try {
        return decryptGithubToken(rows[0].github_token_encrypted);
    } catch (e) {
        console.error('[githubService] Error al desencriptar token:', e.message);
        throw e;
    }
}

/**
 * Lista commits del repo que mencionan el ID del ticket en el mensaje (subject o body).
 * @param {string} repo - formato `owner/repo`
 * @param {number|string} ticketId
 * @param {number} userId - usuario cuyo token en developer_settings se usa para la API
 * @returns {Promise<Array<{ sha: string, message: string, date: string|null, html_url: string }>>}
 */
async function getLatestCommits(repo, ticketId, userId) {
    const token = await getDecryptedGithubTokenForUser(userId);
    if (!token) {
        const err = new Error('No hay token de GitHub configurado para este usuario.');
        err.statusCode = 400;
        throw err;
    }

    const ownerRepo = String(repo || '').trim();
    if (!ownerRepo || !ownerRepo.includes('/')) {
        const err = new Error('El repositorio debe tener formato owner/repo');
        err.statusCode = 400;
        throw err;
    }

    const idStr = String(ticketId);
    const needleHash = `#${idStr}`;
    const matchesTicket = (message) => {
        if (!message) return false;
        if (message.includes(needleHash)) return true;
        // Coincidencia de palabra completa para ID numérico
        const re = new RegExp(`(^|[^\\d])${idStr}([^\\d]|$)`);
        return re.test(message);
    };

    const matches = [];
    const seen = new Set();
    let page = 1;
    const maxPages = 10;

    while (page <= maxPages) {
        const url = `${GITHUB_API}/repos/${ownerRepo}/commits`;
        let data;
        try {
            const response = await axios.get(url, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                params: { per_page: 100, page },
                validateStatus: () => true,
            });
            if (response.status !== 200) {
                const msg =
                    response.data?.message ||
                    `GitHub API (${response.status}) al listar commits de ${ownerRepo}`;
                const err = new Error(msg);
                err.statusCode = response.status >= 400 ? response.status : 502;
                throw err;
            }
            data = response.data;
        } catch (e) {
            if (e.statusCode) throw e;
            const status = e.response?.status;
            const msg = e.response?.data?.message || e.message;
            const err = new Error(msg);
            err.statusCode = status || 502;
            throw err;
        }

        if (!Array.isArray(data)) {
            const err = new Error('Respuesta inesperada de GitHub al listar commits.');
            err.statusCode = 502;
            throw err;
        }

        if (data.length === 0) break;

        for (const c of data) {
            const msg = c.commit?.message || '';
            if (matchesTicket(msg) && c.sha && !seen.has(c.sha)) {
                seen.add(c.sha);
                const authorLogin = c.author && c.author.login ? c.author.login : '';
                const authorName = (c.commit && c.commit.author && c.commit.author.name) ? c.commit.author.name : '';
                matches.push({
                    sha: c.sha,
                    message: msg.split('\n')[0] || msg,
                    date: c.commit?.author?.date || null,
                    html_url: c.html_url || '',
                    author_name: authorName,
                    author_login: authorLogin,
                });
            }
        }

        if (data.length < 100) break;
        page += 1;
    }

    return matches;
}

module.exports = {
    getLatestCommits,
    getDecryptedGithubTokenForUser,
};
