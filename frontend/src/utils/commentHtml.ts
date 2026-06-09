/**
 * Sanitiza y prepara HTML de comentarios para mostrar en pantalla.
 */

const ALLOWED_TAG = /^(b|strong|i|em|u|br|p|div|img)$/i;

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function sanitizeImgSrc(src: string | null | undefined): string | null {
    if (!src) return null;
    const trimmed = src.trim();
    if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed;
    return null;
}

export function sanitizeCommentHtml(input: string): string {
    if (!input?.trim()) return '';

    const trimmed = input.trim();
    const looksLikeHtml = /<\s*\w+/i.test(trimmed);

    if (!looksLikeHtml) {
        return escapeHtml(trimmed).replace(/\n/g, '<br>');
    }

    let html = trimmed
        .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/javascript:/gi, '');

    html = html.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tagName: string, attrs: string) => {
        const tag = tagName.toLowerCase();
        if (!ALLOWED_TAG.test(tag)) return '';

        if (tag === 'br') return '<br>';

        if (tag === 'img') {
            const srcMatch = attrs.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
            const rawSrc = srcMatch ? srcMatch[2] || srcMatch[3] || srcMatch[4] || '' : '';
            const safeSrc = sanitizeImgSrc(rawSrc);
            if (!safeSrc) return '';
            const altMatch = attrs.match(/\salt\s*=\s*("([^"]*)"|'([^']*)')/i);
            const alt = altMatch ? escapeHtml(altMatch[2] || altMatch[3] || 'Imagen') : 'Imagen';
            return `<img src="${safeSrc}" alt="${alt}" />`;
        }

        const isClosing = match.startsWith('</');
        return isClosing ? `</${tag}>` : `<${tag}>`;
    });

    return html.trim();
}

export function isInternalComment(comment: { is_internal?: boolean | number | null }): boolean {
    return comment.is_internal === true || comment.is_internal === 1;
}
