import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const RETURN_KEY = 'ticket-list-return';

interface ReturnState {
    path: string;
    ticketId: number;
    scrollTop: number;
}

/** Guarda a qué ticket se entró y dónde estaba el scroll del panel, para restaurarlo al volver. */
export function rememberTicketReturn(listPath: string, ticketId: number) {
    const main = document.querySelector('main');
    const payload: ReturnState = {
        path: listPath,
        ticketId,
        scrollTop: main?.scrollTop ?? 0,
    };
    try {
        sessionStorage.setItem(RETURN_KEY, JSON.stringify(payload));
    } catch {
        /* ignore */
    }
}

function readReturn(listPath: string): ReturnState | null {
    try {
        const raw = sessionStorage.getItem(RETURN_KEY);
        if (!raw) return null;
        const data = JSON.parse(raw) as Partial<ReturnState>;
        if (data.path !== listPath || !data.ticketId) return null;
        return { path: listPath, ticketId: Number(data.ticketId), scrollTop: Number(data.scrollTop) || 0 };
    } catch {
        return null;
    }
}

function clearReturn() {
    try {
        sessionStorage.removeItem(RETURN_KEY);
    } catch {
        /* ignore */
    }
}

/** Click en "Gestionar" / "Ver": recuerda el ticket si la navegación es en la misma pestaña. */
export function ticketLinkClickHandler(listPath: string) {
    return (e: React.MouseEvent) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        const anchor = (e.target as HTMLElement).closest('a');
        if (!anchor) return;
        const match = (anchor.getAttribute('href') || '').match(/\/tickets\/(\d+)/);
        if (!match) return;
        rememberTicketReturn(listPath, Number(match[1]));
    };
}

function visibleTicketRow(ticketId: number): HTMLElement | null {
    const nodes = document.querySelectorAll<HTMLElement>(`[data-ticket-id="${ticketId}"]`);
    for (let i = 0; i < nodes.length; i += 1) {
        const el = nodes[i];
        if (el.getClientRects().length > 0) return el;
    }
    return null;
}

/**
 * Después de cargar el listado, centra el ticket del que se volvió y lo resalta un momento.
 * `ready` debe ser true cuando las filas ya están en el DOM.
 */
export function useRestoreTicketRow(listPath: string, ready: boolean): number | null {
    const [focusId, setFocusId] = useState<number | null>(null);

    useEffect(() => {
        if (!ready) return;
        const saved = readReturn(listPath);
        if (!saved) return;
        const raf = requestAnimationFrame(() => {
            clearReturn();
            setFocusId(saved.ticketId);
            const row = visibleTicketRow(saved.ticketId);
            if (row) {
                row.scrollIntoView({ block: 'center' });
            } else {
                const main = document.querySelector('main');
                if (main) main.scrollTop = saved.scrollTop;
            }
        });
        return () => cancelAnimationFrame(raf);
    }, [ready, listPath]);

    useEffect(() => {
        if (focusId == null) return;
        const timer = window.setTimeout(() => setFocusId(null), 2200);
        return () => window.clearTimeout(timer);
    }, [focusId]);

    return focusId;
}

export function ticketRowClass(focusId: number | null, ticketId: number, base: string): string {
    return focusId === ticketId ? `${base} bg-amber-50` : base;
}

/**
 * Refleja el estado del listado en la query (replace, sin ensuciar el historial).
 * Al volver desde el detalle, el navegador restaura esa URL y el listado nace ya filtrado.
 */
export function useSyncListQuery(values: Record<string, string>) {
    const [searchParams, setSearchParams] = useSearchParams();
    const serialized = Object.keys(values)
        .sort()
        .map((k) => `${k}\u0000${(values[k] ?? '').trim()}`)
        .join('\u0001');

    useEffect(() => {
        const next = new URLSearchParams();
        if (serialized) {
            for (const part of serialized.split('\u0001')) {
                const sep = part.indexOf('\u0000');
                const key = part.slice(0, sep);
                const value = part.slice(sep + 1);
                if (value) next.set(key, value);
            }
        }
        const norm = (sp: URLSearchParams) =>
            Array.from(sp.entries())
                .sort((a, b) => a[0].localeCompare(b[0]))
                .map((pair) => `${pair[0]}=${pair[1]}`)
                .join('&');
        if (norm(searchParams) !== norm(next)) {
            setSearchParams(next, { replace: true });
        }
    }, [serialized, searchParams, setSearchParams]);
}
