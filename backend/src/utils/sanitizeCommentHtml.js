/**
 * Sanitiza HTML de comentarios: negrita, cursiva, subrayado, saltos e imágenes en /uploads/.
 */

const ALLOWED_TAG = /^(b|strong|i|em|u|br|p|div|img)$/i;

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function decodeHtmlEntities(text) {
    return String(text)
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function repairOverEncodedEntities(input) {
    let result = input;
    for (let i = 0; i < 3; i += 1) {
        const next = decodeHtmlEntities(result);
        if (next === result) break;
        result = next;
    }
    return result;
}

function sanitizeImgSrc(src) {
    if (!src || typeof src !== 'string') return null;
    const trimmed = src.trim();
    if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed;
    return null;
}

function plainTextToHtml(text) {
    const decoded = repairOverEncodedEntities(String(text).trim());
    return escapeHtml(decoded).replace(/\n/g, '<br>');
}

/**
 * @param {string} input
 * @returns {string} HTML seguro para guardar y mostrar
 */
function sanitizeCommentHtml(input) {
    if (!input || typeof input !== 'string') return '';

    const trimmed = repairOverEncodedEntities(input.trim());
    if (!trimmed) return '';

    const looksLikeHtml = /<\s*\w+/i.test(trimmed);
    if (!looksLikeHtml) {
        return plainTextToHtml(trimmed);
    }

    let html = trimmed
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript:/gi, '');

    html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName, attrs) => {
        const tag = tagName.toLowerCase();
        if (!ALLOWED_TAG.test(tag)) return '';

        if (tag === 'br') return '<br>';

        if (tag === 'img') {
            const srcMatch = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
            const rawSrc = srcMatch ? (srcMatch[2] || srcMatch[3] || srcMatch[4] || '') : '';
            const safeSrc = sanitizeImgSrc(rawSrc);
            if (!safeSrc) return '';
            const altMatch = attrs.match(/\salt\s*=\s*("([^"]*)"|'([^']*)')/i);
            const alt = altMatch ? escapeHtml(altMatch[2] || altMatch[3] || 'Imagen') : 'Imagen';
            return `<img src="${safeSrc}" alt="${alt}" class="comment-inline-img" loading="lazy" />`;
        }

        const isClosing = match.startsWith('</');
        return isClosing ? `</${tag}>` : `<${tag}>`;
    });

    return html.trim();
}

module.exports = { sanitizeCommentHtml, plainTextToHtml, decodeHtmlEntities };
