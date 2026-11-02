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

/** Valor de tickets.integration_source para altas hechas por esta API. */
const BACARNET_INTEGRATION_SOURCE = 'bacarnet';

/**
 * Tickets creados por la integración antes de existir integration_source.
 * No se reescriben: se reconocen por este prefijo de título.
 */
const BACARNET_LEGACY_TITLE_PREFIX = 'Bacarnet - ';

/** Tope de tickets.horas_reales (decimal 5,2). */
const HORAS_REALES_MAX = 999.99;

module.exports = {
    BACAR_COMPANY_ID,
    BACAR_TICKET_DEPARTMENT_IDS,
    BACAR_TICKET_DEPARTMENT_ID_LIST,
    ALLOWED_PRIORITIES,
    CATALOG_CACHE_TTL_MS,
    BACARNET_INTEGRATION_SOURCE,
    BACARNET_LEGACY_TITLE_PREFIX,
    HORAS_REALES_MAX,
};
