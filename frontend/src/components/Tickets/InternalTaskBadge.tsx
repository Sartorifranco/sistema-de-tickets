import React from 'react';

/** Etiqueta discreta para tickets marcados como tarea interna */
export const InternalTaskBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
    <span
        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-200/90 text-slate-700 border border-slate-300/80 shrink-0 ${className}`}
        title="Tarea interna"
    >
        Tarea Interna
    </span>
);

export const isTicketInternalTask = (ticket: { es_tarea_interna?: boolean | number | string | null }): boolean =>
    ticket.es_tarea_interna === true ||
    ticket.es_tarea_interna === 1 ||
    ticket.es_tarea_interna === '1';
