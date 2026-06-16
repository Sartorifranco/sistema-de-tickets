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

/** Decodifica entidades HTML (&amp; → &, etc.) */
export function decodeHtmlEntities(text: string): string {
    return text
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

/** Repara comentarios guardados con doble escape (&amp;amp; → &) */
function repairOverEncodedEntities(input: string): string {
    let result = input;
    for (let i = 0; i < 3; i += 1) {
        const next = decodeHtmlEntities(result);
        if (next === result) break;
        result = next;
    }
    return result;
}

function sanitizeImgSrc(src: string | null | undefined): string | null {
    if (!src) return null;
    const trimmed = src.trim();
    if (/^\/uploads\/[a-zA-Z0-9._-]+$/.test(trimmed)) return trimmed;
    return null;
}

export function sanitizeCommentHtml(input: string): string {
    if (!input?.trim()) return '';

    const trimmed = repairOverEncodedEntities(input.trim());
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
            return `<img src="${safeSrc}" alt="${alt}" class="comment-inline-img" loading="lazy" />`;
        }

        const isClosing = match.startsWith('</');
        return isClosing ? `</${tag}>` : `<${tag}>`;
    });

    return html.trim();
}

export function isInternalComment(comment: { is_internal?: boolean | number | null }): boolean {
    return comment.is_internal === true || comment.is_internal === 1;
}

/** Extrae contenido del editor: texto plano si no hay formato, HTML si hay negrita/cursiva/etc. */
export function getCommentEditorContent(editor: HTMLDivElement): string {
    const html = editor.innerHTML.trim();
    if (!html) return '';

    const hasRichFormatting = /<(b|strong|i|em|u)\b/i.test(html);
    if (!hasRichFormatting) {
        return editor.innerText.trim();
    }
    return html;
}
