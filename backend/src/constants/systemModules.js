/** Catálogo de módulos opcionales (visibilidad global). Sincronizar con frontend/src/constants/systemModules.ts */

const SYSTEM_MODULES = [
    {
        key: 'companies',
        label: 'Empresas',
        description: 'Gestión de empresas y departamentos.',
    },
    {
        key: 'depositarios',
        label: 'Depositarios / Mantenimiento equipos',
        description: 'Equipos depositarios, mantenimientos y hojas de ruta.',
    },
    {
        key: 'treasury',
        label: 'Máquinas de tesorería',
        description: 'Contadoras, clasificadoras y mantenimientos de tesorería.',
    },
    {
        key: 'monitoring',
        label: 'Monitoreo',
        description: 'Monitoreo de equipos HWAgente y monitoreo en tiempo real.',
    },
    {
        key: 'locations',
        label: 'Ubicaciones',
        description: 'Catálogo de ubicaciones para tickets.',
    },
    {
        key: 'problems',
        label: 'Problemáticas',
        description: 'Categorías y problemas predefinidos.',
    },
    {
        key: 'reports',
        label: 'Reportes',
        description: 'Reportes e indicadores.',
    },
    {
        key: 'purchases',
        label: 'Compras y facturas',
        description: 'Módulo de compras, aprobaciones y facturas.',
    },
];

const SYSTEM_MODULE_KEYS = SYSTEM_MODULES.map((m) => m.key);

module.exports = { SYSTEM_MODULES, SYSTEM_MODULE_KEYS };
