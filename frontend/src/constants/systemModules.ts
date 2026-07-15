/** Módulos opcionales — sincronizado con backend/src/constants/systemModules.js */

export type SystemModuleKey =
    | 'companies'
    | 'depositarios'
    | 'treasury'
    | 'monitoring'
    | 'locations'
    | 'problems'
    | 'reports'
    | 'purchases';

export interface SystemModuleDef {
    key: SystemModuleKey;
    label: string;
    description: string;
}

export const SYSTEM_MODULES: SystemModuleDef[] = [
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

export const SYSTEM_MODULE_KEYS = SYSTEM_MODULES.map((m) => m.key);

/** Defaults: todos visibles si aún no cargó la API */
export function defaultEnabledMap(): Record<SystemModuleKey, boolean> {
    return Object.fromEntries(SYSTEM_MODULE_KEYS.map((k) => [k, true])) as Record<
        SystemModuleKey,
        boolean
    >;
}
