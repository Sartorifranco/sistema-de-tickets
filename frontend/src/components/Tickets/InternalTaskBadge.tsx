import React from 'react';

/** Etiqueta discreta para tickets marcados como tarea interna */
export const InternalTaskBadge: React.FC<{ className?: string }> = ({ className = '' }) => (
    <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200 shrink-0 ${className}`}
        title="Tarea interna"
    >
        Tarea Interna
    </span>
);

export const isTicketInternalTask = (ticket: { es_tarea_interna?: boolean | number | string | null }): boolean =>
    ticket.es_tarea_interna === true ||
    ticket.es_tarea_interna === 1 ||
    ticket.es_tarea_interna === '1';
