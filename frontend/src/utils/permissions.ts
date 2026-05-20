import { User } from '../types';
import { PERMISSION_KEYS as P, PermissionKey } from '../constants/permissions';

export function hasPermission(user: User | null | undefined, permission: PermissionKey): boolean {
    if (!user) return false;
    if (user.role !== 'admin') return true;
    if (user.is_super_admin) return true;
    return (user.permissions || []).includes(permission);
}

export function hasAnyPermission(user: User | null | undefined, permissions: PermissionKey[]): boolean {
    if (!user) return false;
    if (user.role !== 'admin') return true;
    if (user.is_super_admin) return true;
    const list = user.permissions || [];
    return permissions.some((p) => list.includes(p));
}

export function canManagePermissions(user: User | null | undefined): boolean {
    return !!user && (user.is_super_admin === true || hasPermission(user, P.PERMISSIONS_MANAGE));
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
