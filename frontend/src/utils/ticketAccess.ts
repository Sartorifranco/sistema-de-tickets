import { Department, User, UserRole } from '../types';

const ASSIGNABLE_ROLES: UserRole[] = ['agent', 'admin', 'boss', 'purchasing'];

/** Normaliza nombres de departamento para comparar sin acentos ni mayúsculas */
export function normalizeDepartmentLabel(name: string | null | undefined): string {
    if (!name) return '';
    return name
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
}

export function isDesarrolloDepartmentName(name: string | null | undefined): boolean {
    const n = normalizeDepartmentLabel(name);
    if (!n) return false;
    if (n === 'desarrollo') return true;
    return n.includes('desarrollo');
}

function nameMatchesSoporteIT(name: string | null | undefined): boolean {
    const n = normalizeDepartmentLabel(name);
    return n.includes('soporte') && n.includes('it');
}

function nameMatchesImplementaciones(name: string | null | undefined): boolean {
    return normalizeDepartmentLabel(name).includes('implementacion');
}

function nameMatchesMantenimiento(name: string | null | undefined): boolean {
    return normalizeDepartmentLabel(name).includes('mantenimiento');
}

/** Empresa Bacar (id 1): mantenimiento, implementaciones, soporte IT, desarrollo */
export function matchesBacarDepartmentDropdownOption(d: Department): boolean {
    return (
        isDesarrolloDepartmentName(d.name) ||
        nameMatchesImplementaciones(d.name) ||
        nameMatchesMantenimiento(d.name) ||
        nameMatchesSoporteIT(d.name)
    );
}

/** Otras empresas: típicamente soporte IT + desarrollo */
export function matchesStandardDepartmentDropdownOption(d: Department): boolean {
    return nameMatchesSoporteIT(d.name) || isDesarrolloDepartmentName(d.name);
}

/**
 * Quién puede ver/editar el bloque Control (tarea interna, horas).
 * — Administradores globales.
 * — Agentes cuyo departamento es Soporte IT, Implementaciones o Desarrollo (por nombre en BD).
 * Clientes, jefes, compras y otros roles no ven este bloque jamás.
 */
export function canUseTicketInternalControlBlock(
    user: User | null | undefined,
    departments: Department[]
): boolean {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (user.role !== 'agent') return false;
    if (user.department_id == null) return false;
    const dept = departments.find((x) => x.id === user.department_id);
    if (!dept?.name) return false;
    const n = normalizeDepartmentLabel(dept.name);
    if (n.includes('desarrollo')) return true;
    if (n.includes('implementacion')) return true;
    if (n.includes('soporte') && n.includes('it')) return true;
    return false;
}

/** Asignación de tickets: incluye al usuario actual si es staff y no venía en la lista (p. ej. users vacío). */
export function mergeAssignableStaff(users: User[], currentUser: User | null | undefined): User[] {
    const base = users.filter((u) => ASSIGNABLE_ROLES.includes(u.role));
    if (!currentUser?.id) return base;
    if (base.some((u) => u.id === currentUser.id)) return base;
    if (ASSIGNABLE_ROLES.includes(currentUser.role)) {
        return [...base, currentUser];
    }
    return base;
}
