function parseCreateBool(value, defaultValue = false) {
    if (value === undefined || value === null || value === '') return defaultValue;
    if (typeof value === 'boolean') return value;
    const s = String(value).toLowerCase();
    return s === 'true' || s === '1' || value === 1;
}

function normalizeDeptLabel(name) {
    if (!name) return '';
    return String(name)
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

function isDesarrolloDepartmentName(name) {
    const n = normalizeDeptLabel(name);
    if (!n) return false;
    return n === 'desarrollo' || n.includes('desarrollo');
}

/** Horas reales obligatorias al pasar a resolved/closed: número finito > 0. */
function realHoursMeaningful(value) {
    if (value === undefined || value === null || value === '') return false;
    const n = parseFloat(String(value).replace(',', '.'));
    return Number.isFinite(n) && n > 0;
}

const REAL_HOURS_REQUIRED_MESSAGE =
    'Las horas reales son obligatorias (mayores a cero) para tickets de Desarrollo o tareas internas antes de resolver o cerrar.';

/**
 * Misma regla que la pantalla al pasar a resuelto o cerrado.
 * @returns {string|null} mensaje de error, o null si se puede cerrar/resolver
 */
function realHoursBlockReason(ticket) {
    const requires =
        isDesarrolloDepartmentName(ticket && ticket.department_name) ||
        parseCreateBool(ticket && ticket.es_tarea_interna, false);
    if (!requires) return null;
    if (realHoursMeaningful(ticket && ticket.horas_reales)) return null;
    return REAL_HOURS_REQUIRED_MESSAGE;
}

module.exports = {
    parseCreateBool,
    isDesarrolloDepartmentName,
    realHoursMeaningful,
    realHoursBlockReason,
    REAL_HOURS_REQUIRED_MESSAGE,
};
