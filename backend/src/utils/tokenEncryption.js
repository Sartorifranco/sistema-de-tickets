/**
 * Cifrado simétrico AES-256-GCM para secretos (p. ej. github_token).
 * Requiere ENCRYPTION_KEY en .env (se deriva clave de 32 bytes con SHA-256).
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function deriveKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw || String(raw).length < 16) {
        throw new Error(
            'ENCRYPTION_KEY no está definida o es demasiado corta (definí al menos 16 caracteres en .env)'
        );
    }
    return crypto.createHash('sha256').update(String(raw), 'utf8').digest();
}

/**
 * @param {string} plaintext
 * @returns {string} Cadena base64 (iv + authTag + ciphertext)
 */
function encryptGithubToken(plaintext) {
    if (plaintext === undefined || plaintext === null || plaintext === '') {
        return null;
    }
    const key = deriveKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, enc]).toString('base64');
}

/**
 * @param {string|null|undefined} ciphertextB64
 * @returns {string|null}
 */
function decryptGithubToken(ciphertextB64) {
    if (!ciphertextB64 || typeof ciphertextB64 !== 'string') {
        return null;
    }
    const key = deriveKey();
    let buf;
    try {
        buf = Buffer.from(ciphertextB64, 'base64');
    } catch {
        return null;
    }
    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
        throw new Error('Token cifrado inválido o corrupto');
    }
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const data = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { encryptGithubToken, decryptGithubToken };
