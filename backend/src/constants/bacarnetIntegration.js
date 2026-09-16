/** Empresa Bacar en `companies`. */
const BACAR_COMPANY_ID = 1;

/**
 * IDs reales de las áreas operativas de Bacar (company_id = 1).
 * No filtrar por nombre: los strings en BD no son consistentes (SOPORTE - IT vs DESARROLLO).
 */
const BACAR_TICKET_DEPARTMENT_IDS = Object.freeze({
    SOPORTE_IT: 16,
    MANTENIMIENTO: 27,
    IMPLEMENTACIONES: 28,
    DESARROLLO: 52,
});

const BACAR_TICKET_DEPARTMENT_ID_LIST = Object.freeze(
    Object.values(BACAR_TICKET_DEPARTMENT_IDS)
);

const ALLOWED_PRIORITIES = Object.freeze(['low', 'medium', 'high', 'urgent']);

const CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

module.exports = {
    BACAR_COMPANY_ID,
    BACAR_TICKET_DEPARTMENT_IDS,
    BACAR_TICKET_DEPARTMENT_ID_LIST,
    ALLOWED_PRIORITIES,
    CATALOG_CACHE_TTL_MS,
};
