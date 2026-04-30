/** Clases reutilizables del sistema de diseño Clean & Light (solo estilos). */
export const clInput =
    'w-full px-3 py-2.5 text-sm bg-white border border-gray-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400';
export const clTh =
    'px-6 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500';
export const clThRight =
    'px-6 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-gray-500';
export const clTd = 'px-6 py-4 align-top text-sm text-gray-900';
export const clCard = 'bg-white rounded-2xl border border-gray-100 shadow-sm';

/** Panel interior de modales (overlay oscuro se mantiene fuera). */
export const clModalPanel = 'bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-h-[90vh] overflow-y-auto';

/** Píldora de prioridad (solo estilo; el texto sigue siendo el mismo que antes). */
export function priorityPillClass(priority: string): string {
    switch (priority) {
        case 'urgent':
        case 'high':
            return 'bg-red-100 text-red-800';
        case 'medium':
            return 'bg-amber-100 text-amber-800';
        case 'low':
        default:
            return 'bg-emerald-100 text-emerald-800';
    }
}
