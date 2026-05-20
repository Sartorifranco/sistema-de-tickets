import { User } from '../types';
import { PERMISSION_KEYS as P, PermissionKey } from '../constants/permissions';

/** MySQL / JSON pueden devolver 1 o "1" en lugar de true */
export function isSuperAdmin(user: User | null | undefined): boolean {
    if (!user) return false;
    const flag = user.is_super_admin as boolean | number | string | undefined;
    if (flag === true || flag === 1 || flag === '1') return true;
    if (user.role === 'admin' && (user.permissions?.length ?? 0) >= 20) return true;
    return false;
}

/** Normaliza usuario recibido del API antes de guardarlo en contexto */
export function normalizeAuthUser(user: User): User {
    return {
        ...user,
        is_super_admin: isSuperAdmin(user),
        permissions: Array.isArray(user.permissions) ? user.permissions : [],
    };
}

export function hasPermission(user: User | null | undefined, permission: PermissionKey): boolean {
    if (!user) return false;
    if (user.role !== 'admin') return true;
    if (isSuperAdmin(user)) return true;
    return (user.permissions || []).includes(permission);
}

export function hasAnyPermission(user: User | null | undefined, permissions: PermissionKey[]): boolean {
    if (!user) return false;
    if (user.role !== 'admin') return true;
    if (isSuperAdmin(user)) return true;
    const list = user.permissions || [];
    return permissions.some((p) => list.includes(p));
}

export function canManagePermissions(user: User | null | undefined): boolean {
    return !!user && (isSuperAdmin(user) || hasPermission(user, P.PERMISSIONS_MANAGE));
}

/** Primera ruta admin accesible tras el login */
export function getDefaultPathForUser(user: User): string {
    if (user.role === 'supplier') return '/purchases';
    if (user.role === 'boss' || user.role === 'purchasing') return '/client';
    if (user.role !== 'admin') return `/${user.role}`;

    const candidates: { permission: PermissionKey; path: string }[] = [
        { permission: P.DASHBOARD_VIEW, path: '/admin' },
        { permission: P.TICKETS_VIEW, path: '/admin/tickets' },
        { permission: P.USERS_VIEW, path: '/admin/users' },
        { permission: P.COMPANIES_VIEW, path: '/admin/companies' },
        { permission: P.DEPOSITARIOS_VIEW, path: '/admin/depositarios' },
        { permission: P.REPORTS_VIEW, path: '/admin/reports' },
    ];
    const match = candidates.find((c) => hasPermission(user, c.permission));
    return match?.path ?? '/profile';
}
