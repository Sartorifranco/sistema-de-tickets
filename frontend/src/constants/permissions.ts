/** Catálogo de permisos (sincronizado con backend/src/constants/permissions.js) */

export const PERMISSION_KEYS = {
    DASHBOARD_VIEW: 'dashboard.view',
    TICKETS_VIEW: 'tickets.view',
    TICKETS_CREATE: 'tickets.create',
    TICKETS_EDIT: 'tickets.edit',
    TICKETS_DELETE: 'tickets.delete',
    TICKETS_ASSIGN: 'tickets.assign',
    USERS_VIEW: 'users.view',
    USERS_CREATE: 'users.create',
    USERS_EDIT: 'users.edit',
    USERS_DELETE: 'users.delete',
    USERS_RESET_PASSWORD: 'users.reset_password',
    COMPANIES_VIEW: 'companies.view',
    COMPANIES_MANAGE: 'companies.manage',
    DEPOSITARIOS_VIEW: 'depositarios.view',
    DEPOSITARIOS_MANAGE: 'depositarios.manage',
    MONITORING_EQUIPOS: 'monitoring.equipos',
    MONITORING_REALTIME: 'monitoring.realtime',
    LOCATIONS_MANAGE: 'locations.manage',
    PROBLEMS_MANAGE: 'problems.manage',
    REPORTS_VIEW: 'reports.view',
    PURCHASES_VIEW: 'purchases.view',
    PURCHASES_INVOICES: 'purchases.invoices',
    BACAR_KEYS_MANAGE: 'bacar_keys.manage',
    TREASURY_MACHINES_VIEW: 'treasury_machines.view',
    TREASURY_MACHINES_MANAGE: 'treasury_machines.manage',
    PERMISSIONS_MANAGE: 'permissions.manage',
} as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[keyof typeof PERMISSION_KEYS];

export interface PermissionGroupItem {
    key: PermissionKey;
    label: string;
}

export interface PermissionGroup {
    id: string;
    label: string;
    permissions: PermissionGroupItem[];
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
    {
        id: 'dashboard',
        label: 'Dashboard',
        permissions: [{ key: PERMISSION_KEYS.DASHBOARD_VIEW, label: 'Ver panel principal' }],
    },
    {
        id: 'tickets',
        label: 'Tickets',
        permissions: [
            { key: PERMISSION_KEYS.TICKETS_VIEW, label: 'Ver tickets' },
            { key: PERMISSION_KEYS.TICKETS_CREATE, label: 'Crear tickets' },
            { key: PERMISSION_KEYS.TICKETS_EDIT, label: 'Editar tickets' },
            { key: PERMISSION_KEYS.TICKETS_DELETE, label: 'Eliminar tickets' },
            { key: PERMISSION_KEYS.TICKETS_ASSIGN, label: 'Asignar / reasignar' },
        ],
    },
    {
        id: 'users',
        label: 'Usuarios',
        permissions: [
            { key: PERMISSION_KEYS.USERS_VIEW, label: 'Ver usuarios' },
            { key: PERMISSION_KEYS.USERS_CREATE, label: 'Crear usuarios' },
            { key: PERMISSION_KEYS.USERS_EDIT, label: 'Editar usuarios' },
            { key: PERMISSION_KEYS.USERS_DELETE, label: 'Eliminar usuarios' },
            { key: PERMISSION_KEYS.USERS_RESET_PASSWORD, label: 'Resetear contraseña' },
        ],
    },
    {
        id: 'companies',
        label: 'Empresas y departamentos',
        permissions: [
            { key: PERMISSION_KEYS.COMPANIES_VIEW, label: 'Ver empresas' },
            { key: PERMISSION_KEYS.COMPANIES_MANAGE, label: 'Gestionar empresas y departamentos' },
        ],
    },
    {
        id: 'depositarios',
        label: 'Depositarios',
        permissions: [
            { key: PERMISSION_KEYS.DEPOSITARIOS_VIEW, label: 'Ver depositarios' },
            { key: PERMISSION_KEYS.DEPOSITARIOS_MANAGE, label: 'Gestionar depositarios' },
        ],
    },
    {
        id: 'treasury',
        label: 'Máquinas de tesorería',
        permissions: [
            { key: PERMISSION_KEYS.TREASURY_MACHINES_VIEW, label: 'Ver máquinas de tesorería' },
            { key: PERMISSION_KEYS.TREASURY_MACHINES_MANAGE, label: 'Gestionar máquinas y mantenimientos' },
        ],
    },
    {
        id: 'monitoring',
        label: 'Monitoreo',
        permissions: [
            { key: PERMISSION_KEYS.MONITORING_EQUIPOS, label: 'Monitoreo de equipos' },
            { key: PERMISSION_KEYS.MONITORING_REALTIME, label: 'Monitoreo en tiempo real' },
        ],
    },
    {
        id: 'config',
        label: 'Configuración',
        permissions: [
            { key: PERMISSION_KEYS.LOCATIONS_MANAGE, label: 'Ubicaciones' },
            { key: PERMISSION_KEYS.PROBLEMS_MANAGE, label: 'Problemáticas' },
            { key: PERMISSION_KEYS.BACAR_KEYS_MANAGE, label: 'Claves Bacar' },
        ],
    },
    {
        id: 'reports',
        label: 'Reportes',
        permissions: [{ key: PERMISSION_KEYS.REPORTS_VIEW, label: 'Ver reportes' }],
    },
    {
        id: 'purchases',
        label: 'Compras',
        permissions: [
            { key: PERMISSION_KEYS.PURCHASES_VIEW, label: 'Acceso módulo compras' },
            { key: PERMISSION_KEYS.PURCHASES_INVOICES, label: 'Facturas de compras' },
        ],
    },
    {
        id: 'permissions',
        label: 'Permisos',
        permissions: [{ key: PERMISSION_KEYS.PERMISSIONS_MANAGE, label: 'Gestionar permisos de admins y agentes' }],
    },
];

export const LIMITED_ADMIN_PRESET: PermissionKey[] = [
    PERMISSION_KEYS.DASHBOARD_VIEW,
    PERMISSION_KEYS.TICKETS_VIEW,
    PERMISSION_KEYS.TICKETS_CREATE,
    PERMISSION_KEYS.TICKETS_EDIT,
    PERMISSION_KEYS.TICKETS_ASSIGN,
];

const ADMIN_ONLY_PERMISSION_KEYS = new Set<PermissionKey>([
    PERMISSION_KEYS.DASHBOARD_VIEW,
    PERMISSION_KEYS.TICKETS_DELETE,
    PERMISSION_KEYS.USERS_EDIT,
    PERMISSION_KEYS.USERS_DELETE,
    PERMISSION_KEYS.USERS_RESET_PASSWORD,
    PERMISSION_KEYS.COMPANIES_VIEW,
    PERMISSION_KEYS.COMPANIES_MANAGE,
    PERMISSION_KEYS.LOCATIONS_MANAGE,
    PERMISSION_KEYS.PROBLEMS_MANAGE,
    PERMISSION_KEYS.BACAR_KEYS_MANAGE,
    PERMISSION_KEYS.PERMISSIONS_MANAGE,
]);

export const AGENT_ASSIGNABLE_KEYS: PermissionKey[] = (
    Object.values(PERMISSION_KEYS) as PermissionKey[]
).filter((k) => !ADMIN_ONLY_PERMISSION_KEYS.has(k));

export const AGENT_PERMISSION_GROUPS: PermissionGroup[] = PERMISSION_GROUPS.map((g) => ({
    ...g,
    permissions: g.permissions.filter((p) => AGENT_ASSIGNABLE_KEYS.includes(p.key)),
})).filter((g) => g.permissions.length > 0);

export const LIMITED_AGENT_PRESET: PermissionKey[] = [
    PERMISSION_KEYS.TICKETS_VIEW,
    PERMISSION_KEYS.TICKETS_CREATE,
    PERMISSION_KEYS.TICKETS_EDIT,
    PERMISSION_KEYS.TICKETS_ASSIGN,
];

/** Agente sin permisos guardados en BD: preset operativo completo */
export const AGENT_DEFAULT_PRESET: PermissionKey[] = [...AGENT_ASSIGNABLE_KEYS];

export const STAFF_ROLES_WITH_PERMISSIONS = ['admin', 'agent'] as const;
