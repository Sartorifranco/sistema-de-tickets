import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Building2,
    Users,
    UserCheck,
    UserX,
    Pencil,
    KeyRound,
    ShieldCheck,
    Trash2,
    Search,
    Plus,
    Briefcase,
    AlertTriangle,
    X,
} from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { User, Department, Company, ApiResponseError, UserRole } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import { toast } from 'react-toastify';
import UserFormModal from '../components/Users/UserFormModal';
import ResetPasswordModal from '../components/Users/ResetPasswordModal';
import UserPermissionsModal from '../components/Users/UserPermissionsModal';
import { PERMISSION_KEYS as P } from '../constants/permissions';
import { canManagePermissions, hasPermission, isSuperAdmin } from '../utils/permissions';
import { clCard, clInput, clModalPanel, clThCompact, clThCompactRight, clTdCompact } from '../utils/cleanLightUi';

// ---------------------------------------------------------------------------
// Constantes y helpers
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<UserRole, string> = {
    admin: 'Administrador',
    agent: 'Agente',
    client: 'Cliente',
    boss: 'Jefe',
    purchasing: 'Compras',
    supplier: 'Proveedor',
};

/** Orden y título de los grupos dentro de la pestaña Bacar. */
const INTERNAL_GROUPS: { role: UserRole; title: string; hint: string }[] = [
    { role: 'admin', title: 'Administradores', hint: 'Acceso total al panel' },
    { role: 'agent', title: 'Agentes', hint: 'Resuelven tickets' },
    { role: 'boss', title: 'Jefes', hint: 'Supervisan su departamento' },
    { role: 'purchasing', title: 'Compras', hint: 'Gestión de compras' },
    { role: 'client', title: 'Empleados (clientes internos)', hint: 'Crean tickets desde su área' },
    { role: 'supplier', title: 'Proveedores', hint: 'Acceso externo limitado' },
];

const ROLE_PILL: Record<UserRole, string> = {
    admin: 'bg-red-50 text-red-700 ring-red-100',
    agent: 'bg-indigo-50 text-indigo-700 ring-indigo-100',
    boss: 'bg-amber-50 text-amber-800 ring-amber-100',
    purchasing: 'bg-teal-50 text-teal-700 ring-teal-100',
    client: 'bg-slate-100 text-slate-700 ring-slate-200',
    supplier: 'bg-violet-50 text-violet-700 ring-violet-100',
};

const ROLE_AVATAR: Record<UserRole, string> = {
    admin: 'bg-red-100 text-red-700',
    agent: 'bg-indigo-100 text-indigo-700',
    boss: 'bg-amber-100 text-amber-800',
    purchasing: 'bg-teal-100 text-teal-700',
    client: 'bg-slate-200 text-slate-700',
    supplier: 'bg-violet-100 text-violet-700',
};

type Tab = 'internal' | 'external' | 'all';
type StatusFilter = '' | 'active' | 'inactive';

const TAB_STORAGE_KEY = 'users-tab';

function displayName(u: User): string {
    const full = `${u.first_name || ''} ${u.last_name || ''}`.trim();
    return full || u.username;
}

function initials(u: User): string {
    const f = String(u.first_name || '').trim();
    const l = String(u.last_name || '').trim();
    if (f && l) return (f[0] + l[0]).toUpperCase();
    const base = f || u.username || '?';
    return base.slice(0, 2).toUpperCase();
}

function relativeTime(iso?: string | null): string {
    if (!iso) return 'Sin actividad';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Sin actividad';
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Recién';
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days} d`;
    const months = Math.floor(days / 30);
    if (months < 12) return `Hace ${months} mes${months === 1 ? '' : 'es'}`;
    const years = Math.floor(months / 12);
    return `Hace ${years} año${years === 1 ? '' : 's'}`;
}

function formatDate(iso?: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function readStoredTab(): Tab {
    try {
        const v = localStorage.getItem(TAB_STORAGE_KEY);
        if (v === 'internal' || v === 'external' || v === 'all') return v;
    } catch {
        /* ignore */
    }
    return 'internal';
}

// ---------------------------------------------------------------------------
// Sub-componentes
// ---------------------------------------------------------------------------

const RolePill: React.FC<{ role: UserRole; superAdmin?: boolean }> = ({ role, superAdmin }) => (
    <span className="inline-flex items-center gap-1 flex-wrap">
        <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ring-1 ${ROLE_PILL[role]}`}>
            {ROLE_LABELS[role] || role}
        </span>
        {superAdmin && (
            <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                Super
            </span>
        )}
    </span>
);

const StatusPill: React.FC<{ active: boolean }> = ({ active }) =>
    active ? (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Activo
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500">
            <span className="h-2 w-2 rounded-full bg-gray-300" />
            Desactivado
        </span>
    );

const Avatar: React.FC<{ u: User }> = ({ u }) => (
    <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold ${ROLE_AVATAR[u.role] || ROLE_AVATAR.client} ${
            u.is_active === false ? 'opacity-50' : ''
        }`}
        aria-hidden
    >
        {initials(u)}
    </span>
);

const IconButton: React.FC<{
    title: string;
    onClick: () => void;
    tone?: 'default' | 'danger' | 'success';
    children: React.ReactNode;
}> = ({ title, onClick, tone = 'default', children }) => {
    const toneCls =
        tone === 'danger'
            ? 'text-gray-400 hover:text-red-600 hover:bg-red-50'
            : tone === 'success'
              ? 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
              : 'text-gray-400 hover:text-gray-800 hover:bg-gray-100';
    return (
        <button
            type="button"
            title={title}
            aria-label={title}
            onClick={onClick}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${toneCls}`}
        >
            {children}
        </button>
    );
};

interface ConfirmState {
    title: string;
    message: React.ReactNode;
    confirmLabel: string;
    danger?: boolean;
    onConfirm: () => Promise<void> | void;
}

const ConfirmModal: React.FC<{ state: ConfirmState | null; onClose: () => void }> = ({ state, onClose }) => {
    const [busy, setBusy] = useState(false);
    useEffect(() => {
        if (!state) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [state, onClose]);
    if (!state) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div className={`${clModalPanel} max-w-md`} onClick={(e) => e.stopPropagation()}>
                <div className="flex items-start gap-3 p-5">
                    <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            state.danger ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600'
                        }`}
                    >
                        <AlertTriangle className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h3 className="text-base font-bold text-gray-900">{state.title}</h3>
                        <div className="mt-1 text-sm text-gray-600">{state.message}</div>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" aria-label="Cerrar">
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="flex justify-end gap-2 border-t border-gray-100 px-5 py-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100"
                    >
                        Cancelar
                    </button>
                    <button
                        type="button"
                        disabled={busy}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                await state.onConfirm();
                                onClose();
                            } finally {
                                setBusy(false);
                            }
                        }}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm disabled:opacity-60 ${
                            state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-900 hover:bg-gray-800'
                        }`}
                    >
                        {busy ? 'Procesando…' : state.confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const AdminUsersPage: React.FC = () => {
    const { user } = useAuth();
    const { addNotification } = useNotification();

    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState<User | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [selectedUserForReset, setSelectedUserForReset] = useState<User | null>(null);
    const [permissionsTarget, setPermissionsTarget] = useState<User | null>(null);
    const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);

    const [allDepartments, setAllDepartments] = useState<Department[]>([]);
    const [allCompanies, setAllCompanies] = useState<Company[]>([]);

    const [tab, setTab] = useState<Tab>(readStoredTab);
    const [filters, setFilters] = useState({
        search: '',
        role: '' as '' | UserRole,
        companyId: '',
        departmentId: '',
        status: '' as StatusFilter,
    });

    const canView = user?.role === 'admin' && hasPermission(user, P.USERS_VIEW);

    useEffect(() => {
        try {
            localStorage.setItem(TAB_STORAGE_KEY, tab);
        } catch {
            /* ignore */
        }
    }, [tab]);

    const fetchMeta = useCallback(async () => {
        try {
            const [deptsRes, companiesRes] = await Promise.all([api.get('/api/departments'), api.get('/api/companies')]);
            setAllDepartments(deptsRes.data.data || []);
            setAllCompanies(companiesRes.data.data || []);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err)
                ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar empresas/departamentos.'
                : 'Ocurrió un error inesperado.';
            addNotification(message, 'error');
        }
    }, [addNotification]);

    const fetchUsers = useCallback(async () => {
        setError(null);
        try {
            const usersRes = await api.get('/api/users');
            setUsers(usersRes.data.data || []);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err)
                ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar los usuarios.'
                : 'Ocurrió un error inesperado.';
            setError(message);
            addNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [addNotification]);

    useEffect(() => {
        if (canView) {
            fetchMeta();
            fetchUsers();
        } else {
            setLoading(false);
        }
    }, [canView, fetchMeta, fetchUsers]);

    // --- Empresa interna (Bacar) -------------------------------------------------
    const internalCompanyId = useMemo(() => {
        const found = allCompanies.find((c) => /bacar/i.test(c.name));
        return found ? found.id : 1;
    }, [allCompanies]);

    const isInternal = useCallback((u: User) => u.company_id === internalCompanyId, [internalCompanyId]);

    const counts = useMemo(() => {
        const internal = users.filter(isInternal);
        const external = users.filter((u) => !isInternal(u));
        const externalCompanies = new Set(external.map((u) => u.company_id ?? 0));
        return {
            internal: internal.length,
            external: external.length,
            externalCompanies: externalCompanies.size,
            all: users.length,
            inactive: users.filter((u) => u.is_active === false).length,
            staff: internal.filter((u) => u.role === 'admin' || u.role === 'agent').length,
        };
    }, [users, isInternal]);

    // --- Filtrado ---------------------------------------------------------------
    const tabUsers = useMemo(() => {
        if (tab === 'internal') return users.filter(isInternal);
        if (tab === 'external') return users.filter((u) => !isInternal(u));
        return users;
    }, [users, tab, isInternal]);

    const filteredUsers = useMemo(() => {
        const term = filters.search.trim().toLowerCase();
        const companyId = filters.companyId ? parseInt(filters.companyId, 10) : null;
        const departmentId = filters.departmentId ? parseInt(filters.departmentId, 10) : null;
        return tabUsers.filter((u) => {
            if (filters.role && u.role !== filters.role) return false;
            if (filters.status === 'active' && u.is_active === false) return false;
            if (filters.status === 'inactive' && u.is_active !== false) return false;
            if (companyId && u.company_id !== companyId) return false;
            if (departmentId && u.department_id !== departmentId) return false;
            if (term) {
                const hay = `${u.username} ${u.email} ${u.first_name || ''} ${u.last_name || ''} ${u.company_name || ''} ${
                    u.department_name || ''
                }`.toLowerCase();
                if (!hay.includes(term)) return false;
            }
            return true;
        });
    }, [tabUsers, filters]);

    const hasActiveFilters =
        !!filters.search || !!filters.role || !!filters.companyId || !!filters.departmentId || !!filters.status;

    const clearFilters = () => setFilters({ search: '', role: '', companyId: '', departmentId: '', status: '' });

    // Al cambiar de pestaña, los filtros de empresa/departamento dejan de tener sentido.
    const changeTab = (next: Tab) => {
        setTab(next);
        setFilters((f) => ({ ...f, companyId: '', departmentId: '' }));
    };

    const departmentsForFilter = useMemo(() => {
        const cid = tab === 'internal' ? internalCompanyId : filters.companyId ? parseInt(filters.companyId, 10) : null;
        if (!cid) return allDepartments;
        return allDepartments.filter((d) => d.company_id === cid);
    }, [allDepartments, tab, internalCompanyId, filters.companyId]);

    const companiesForFilter = useMemo(
        () => (tab === 'external' ? allCompanies.filter((c) => c.id !== internalCompanyId) : allCompanies),
        [allCompanies, tab, internalCompanyId]
    );

    // --- Agrupado ---------------------------------------------------------------
    type Group = { key: string; title: string; hint?: string; icon: React.ReactNode; items: User[] };

    const groups = useMemo<Group[]>(() => {
        if (tab === 'internal') {
            return INTERNAL_GROUPS.map((g) => ({
                key: g.role,
                title: g.title,
                hint: g.hint,
                icon: <Briefcase className="h-4 w-4" />,
                items: filteredUsers.filter((u) => u.role === g.role),
            })).filter((g) => g.items.length > 0);
        }
        if (tab === 'external') {
            const byCompany = new Map<number, User[]>();
            filteredUsers.forEach((u) => {
                const k = u.company_id ?? 0;
                if (!byCompany.has(k)) byCompany.set(k, []);
                byCompany.get(k)!.push(u);
            });
            return Array.from(byCompany.entries())
                .map(([cid, items]) => {
                    const name = cid === 0 ? 'Sin empresa asignada' : items[0].company_name || `Empresa #${cid}`;
                    const active = items.filter((u) => u.is_active !== false).length;
                    return {
                        key: `c-${cid}`,
                        title: name,
                        hint: `${active} activo${active === 1 ? '' : 's'}`,
                        icon: <Building2 className="h-4 w-4" />,
                        items,
                    };
                })
                .sort((a, b) => (a.key === 'c-0' ? 1 : b.key === 'c-0' ? -1 : a.title.localeCompare(b.title, 'es')));
        }
        return [
            {
                key: 'all',
                title: 'Todos los usuarios',
                icon: <Users className="h-4 w-4" />,
                items: filteredUsers,
            },
        ];
    }, [tab, filteredUsers]);

    // --- Acciones ---------------------------------------------------------------
    const handleCreateUser = () => {
        setCurrentUser(null);
        setIsUserModalOpen(true);
    };

    const handleEditUser = (userToEdit: User) => {
        setCurrentUser(userToEdit);
        setIsUserModalOpen(true);
    };

    const handleSaveUser = async (userData: Partial<User>) => {
        const url = currentUser ? `/api/users/${currentUser.id}` : '/api/users';
        const method = currentUser ? 'put' : 'post';
        const action = currentUser ? 'actualizado' : 'creado';
        try {
            await api[method](url, userData);
            addNotification(`Usuario ${action} exitosamente.`, 'success');
            setIsUserModalOpen(false);
            fetchUsers();
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err)
                ? (err.response?.data as ApiResponseError)?.message || 'Error al guardar usuario.'
                : 'Error inesperado.';
            addNotification(message, 'error');
        }
    };

    const askDeleteUser = (target: User) => {
        setConfirm({
            title: 'Eliminar usuario',
            danger: true,
            confirmLabel: 'Eliminar',
            message: (
                <>
                    Vas a eliminar a <strong>{displayName(target)}</strong> ({target.email}). Esta acción es irreversible.
                    {(target.tickets_created || 0) > 0 && (
                        <span className="mt-2 block rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                            Tiene {target.tickets_created} ticket{target.tickets_created === 1 ? '' : 's'} asociado
                            {target.tickets_created === 1 ? '' : 's'}: probablemente no se pueda borrar. Si solo querés
                            cortarle el acceso, usá <strong>Desactivar</strong>.
                        </span>
                    )}
                </>
            ),
            onConfirm: async () => {
                try {
                    await api.delete(`/api/users/${target.id}`);
                    addNotification('Usuario eliminado exitosamente.', 'success');
                    fetchUsers();
                } catch (err: unknown) {
                    const message = isAxiosErrorTypeGuard(err)
                        ? (err.response?.data as ApiResponseError)?.message || 'Error al eliminar usuario.'
                        : 'Error inesperado.';
                    addNotification(message, 'error');
                }
            },
        });
    };

    const askToggleActive = (target: User) => {
        const activate = target.is_active === false;
        setConfirm({
            title: activate ? 'Reactivar usuario' : 'Desactivar usuario',
            danger: !activate,
            confirmLabel: activate ? 'Reactivar' : 'Desactivar',
            message: activate ? (
                <>
                    <strong>{displayName(target)}</strong> volverá a poder iniciar sesión con su contraseña actual.
                </>
            ) : (
                <>
                    <strong>{displayName(target)}</strong> no podrá iniciar sesión hasta que lo reactives. Sus tickets e
                    historial se conservan.
                </>
            ),
            onConfirm: async () => {
                try {
                    await api.put(`/api/users/${target.id}`, { is_active: activate });
                    addNotification(activate ? 'Usuario reactivado.' : 'Usuario desactivado.', 'success');
                    fetchUsers();
                } catch (err: unknown) {
                    const message = isAxiosErrorTypeGuard(err)
                        ? (err.response?.data as ApiResponseError)?.message || 'No se pudo cambiar el estado.'
                        : 'Error inesperado.';
                    addNotification(message, 'error');
                }
            },
        });
    };

    const handleOpenResetModal = (userToReset: User) => {
        setSelectedUserForReset(userToReset);
        setIsResetModalOpen(true);
    };

    const handleConfirmResetPassword = async (newPassword: string) => {
        if (!selectedUserForReset) return;
        try {
            await api.put(`/api/users/${selectedUserForReset.id}/reset-password`, { newPassword });
            toast.success(`Contraseña para ${selectedUserForReset.username} actualizada.`);
        } catch (err: any) {
            const message = err.response?.data?.message || 'Error al resetear la contraseña.';
            toast.error(message);
        }
    };

    const openPermissions = (target: User) => {
        setPermissionsTarget(target);
        setIsPermissionsModalOpen(true);
    };

    // --- Permisos del usuario logueado -----------------------------------------
    const canEdit = hasPermission(user, P.USERS_EDIT);
    const canReset = hasPermission(user, P.USERS_RESET_PASSWORD);
    const canDelete = hasPermission(user, P.USERS_DELETE);
    const canPerms = canManagePermissions(user);

    const renderActions = (u: User) => {
        const isSelf = u.id === user?.id;
        return (
            <div className="flex items-center justify-end gap-0.5">
                {canEdit && (
                    <IconButton title="Editar" onClick={() => handleEditUser(u)}>
                        <Pencil className="h-4 w-4" />
                    </IconButton>
                )}
                {canReset && (
                    <IconButton title="Resetear contraseña" onClick={() => handleOpenResetModal(u)}>
                        <KeyRound className="h-4 w-4" />
                    </IconButton>
                )}
                {(u.role === 'admin' || u.role === 'agent') && canPerms && (
                    <IconButton title="Permisos" onClick={() => openPermissions(u)}>
                        <ShieldCheck className="h-4 w-4" />
                    </IconButton>
                )}
                {canEdit && !isSelf && (
                    u.is_active === false ? (
                        <IconButton title="Reactivar" tone="success" onClick={() => askToggleActive(u)}>
                            <UserCheck className="h-4 w-4" />
                        </IconButton>
                    ) : (
                        <IconButton title="Desactivar" tone="danger" onClick={() => askToggleActive(u)}>
                            <UserX className="h-4 w-4" />
                        </IconButton>
                    )
                )}
                {canDelete && !isSelf && (
                    <IconButton title="Eliminar" tone="danger" onClick={() => askDeleteUser(u)}>
                        <Trash2 className="h-4 w-4" />
                    </IconButton>
                )}
            </div>
        );
    };

    const renderActivity = (u: User) => {
        const isStaff = u.role === 'admin' || u.role === 'agent';
        return (
            <div className="text-xs leading-5">
                {isStaff ? (
                    <p className="text-gray-900">
                        <span className="font-semibold">{u.assigned_active || 0}</span> en curso
                    </p>
                ) : (
                    <p className="text-gray-900">
                        <span className="font-semibold">{u.tickets_created || 0}</span> ticket
                        {(u.tickets_created || 0) === 1 ? '' : 's'}
                    </p>
                )}
                <p className="text-gray-500">{relativeTime(u.last_activity_at)}</p>
            </div>
        );
    };

    const showCompanyColumn = tab !== 'internal';

    // --- Render -------------------------------------------------------------------
    if (!canView) {
        return <div className="p-8 text-center text-gray-600">No tenés permiso para ver usuarios.</div>;
    }
    if (loading) return <div className="p-8 text-center text-gray-600">Cargando usuarios…</div>;
    if (error) return <div className="p-8 text-center text-red-600">Error: {error}</div>;

    const tabs: { id: Tab; label: string; count: number; icon: React.ReactNode }[] = [
        { id: 'internal', label: 'Bacar', count: counts.internal, icon: <Briefcase className="h-4 w-4" /> },
        { id: 'external', label: 'Clientes externos', count: counts.external, icon: <Building2 className="h-4 w-4" /> },
        { id: 'all', label: 'Todos', count: counts.all, icon: <Users className="h-4 w-4" /> },
    ];

    return (
        <>
            <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">
                    {/* Encabezado */}
                    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Usuarios</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                Equipo de Bacar por un lado, clientes externos por el otro. Activá, desactivá y gestioná
                                permisos sin perder el historial.
                            </p>
                        </div>
                        {hasPermission(user, P.USERS_CREATE) && (
                            <button
                                onClick={handleCreateUser}
                                className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
                            >
                                <Plus className="h-4 w-4" />
                                Nuevo usuario
                            </button>
                        )}
                    </div>

                    {/* KPIs */}
                    <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <div className={`${clCard} p-4`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Equipo Bacar</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{counts.internal}</p>
                            <p className="text-xs text-gray-500">{counts.staff} admins/agentes</p>
                        </div>
                        <div className={`${clCard} p-4`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Clientes externos</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{counts.external}</p>
                            <p className="text-xs text-gray-500">
                                en {counts.externalCompanies} empresa{counts.externalCompanies === 1 ? '' : 's'}
                            </p>
                        </div>
                        <div className={`${clCard} p-4`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Activos</p>
                            <p className="mt-1 text-2xl font-bold text-emerald-700">{counts.all - counts.inactive}</p>
                            <p className="text-xs text-gray-500">pueden iniciar sesión</p>
                        </div>
                        <div className={`${clCard} p-4`}>
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Desactivados</p>
                            <p className="mt-1 text-2xl font-bold text-gray-900">{counts.inactive}</p>
                            <p className="text-xs text-gray-500">sin acceso al sistema</p>
                        </div>
                    </div>

                    {/* Pestañas */}
                    <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-white p-1 shadow-sm sm:inline-flex">
                        {tabs.map((t) => {
                            const active = tab === t.id;
                            return (
                                <button
                                    key={t.id}
                                    type="button"
                                    onClick={() => changeTab(t.id)}
                                    className={`inline-flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold transition-colors sm:flex-none sm:px-4 ${
                                        active ? 'bg-gray-900 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {t.icon}
                                    {t.label}
                                    <span
                                        className={`rounded-full px-2 py-0.5 text-xs ${
                                            active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                                        }`}
                                    >
                                        {t.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Filtros */}
                    <div className={`${clCard} mb-6 p-4`}>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
                            <div className="lg:col-span-2">
                                <label className="mb-1 block text-xs font-semibold text-gray-600">Buscar</label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={filters.search}
                                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                                        className={`${clInput} pl-9`}
                                        placeholder="Nombre, usuario, email, área…"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-600">Rol</label>
                                <select
                                    value={filters.role}
                                    onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value as '' | UserRole }))}
                                    className={clInput}
                                >
                                    <option value="">Todos</option>
                                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                                        <option key={r} value={r}>
                                            {ROLE_LABELS[r]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {tab !== 'internal' && (
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-600">Empresa</label>
                                    <select
                                        value={filters.companyId}
                                        onChange={(e) =>
                                            setFilters((f) => ({ ...f, companyId: e.target.value, departmentId: '' }))
                                        }
                                        className={clInput}
                                    >
                                        <option value="">Todas</option>
                                        {companiesForFilter.map((company) => (
                                            <option key={company.id} value={company.id}>
                                                {company.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {tab !== 'external' && (
                                <div>
                                    <label className="mb-1 block text-xs font-semibold text-gray-600">Departamento</label>
                                    <select
                                        value={filters.departmentId}
                                        onChange={(e) => setFilters((f) => ({ ...f, departmentId: e.target.value }))}
                                        className={clInput}
                                    >
                                        <option value="">Todos</option>
                                        {departmentsForFilter.map((dept) => (
                                            <option key={dept.id} value={dept.id}>
                                                {dept.name}
                                                {tab === 'all' && dept.company_name ? ` · ${dept.company_name}` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-gray-600">Estado</label>
                                <select
                                    value={filters.status}
                                    onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as StatusFilter }))}
                                    className={clInput}
                                >
                                    <option value="">Todos</option>
                                    <option value="active">Activos</option>
                                    <option value="inactive">Desactivados</option>
                                </select>
                            </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3">
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-sm font-semibold text-red-600 hover:text-red-800"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                            <span className="ml-auto text-sm text-gray-500">
                                {filteredUsers.length} de {tabUsers.length} usuario{tabUsers.length === 1 ? '' : 's'}
                            </span>
                        </div>
                    </div>

                    {user?.role === 'admin' && !canPerms && (
                        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                            Para ver el botón <strong>Permisos</strong> necesitás ser super administrador o tener el permiso
                            de gestión de permisos. Cerrá sesión y volvé a entrar.
                        </div>
                    )}
                    {canPerms && tab === 'internal' && (
                        <p className="mb-4 text-sm text-slate-600">
                            En administradores y agentes, usá el ícono <ShieldCheck className="inline h-4 w-4 align-text-bottom" />{' '}
                            <strong>Permisos</strong> para definir qué puede ver cada uno.
                            {isSuperAdmin(user) && (
                                <span className="ml-1 text-emerald-700">(Tu usuario es super administrador.)</span>
                            )}
                        </p>
                    )}

                    {/* Grupos */}
                    {groups.length === 0 ? (
                        <div className={`${clCard} py-12 text-center`}>
                            <Users className="mx-auto h-8 w-8 text-gray-300" />
                            <p className="mt-2 text-sm text-gray-600">No hay usuarios que coincidan con el filtro.</p>
                            {hasActiveFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-2 text-sm font-semibold text-red-600 hover:text-red-800"
                                >
                                    Limpiar filtros
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            {groups.map((g) => (
                                <section key={g.key} className={`${clCard} overflow-hidden`}>
                                    <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 sm:px-5">
                                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                                            {g.icon}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                            <h2 className="truncate text-sm font-bold text-gray-900">{g.title}</h2>
                                            {g.hint && <p className="truncate text-xs text-gray-500">{g.hint}</p>}
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-700">
                                            {g.items.length}
                                        </span>
                                    </header>

                                    {/* Tabla (lg+) */}
                                    <table className="hidden w-full table-fixed divide-y divide-gray-100 lg:table">
                                        <thead className="bg-gray-50/70">
                                            <tr>
                                                <th className={clThCompact}>Usuario</th>
                                                <th className={`${clThCompact} w-32`}>Rol</th>
                                                <th className={`${clThCompact} w-[16%]`}>
                                                    {showCompanyColumn ? 'Empresa / área' : 'Departamento'}
                                                </th>
                                                <th className={`${clThCompact} w-24`}>Estado</th>
                                                <th className={`${clThCompact} w-28`}>Actividad</th>
                                                <th className={`${clThCompact} w-24`}>Alta</th>
                                                <th className={`${clThCompactRight} w-40`}>Acciones</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {g.items.map((u) => (
                                                <tr
                                                    key={u.id}
                                                    className={`hover:bg-gray-50/60 ${u.is_active === false ? 'bg-gray-50/40' : ''}`}
                                                >
                                                    <td className={`${clTdCompact} min-w-0`}>
                                                        <div className="flex items-start gap-3">
                                                            <Avatar u={u} />
                                                            <div className="min-w-0">
                                                                <p
                                                                    className={`truncate font-semibold ${
                                                                        u.is_active === false ? 'text-gray-500' : 'text-gray-900'
                                                                    }`}
                                                                >
                                                                    {displayName(u)}
                                                                    {u.id === user?.id && (
                                                                        <span className="ml-1.5 text-[10px] font-bold uppercase text-red-600">
                                                                            vos
                                                                        </span>
                                                                    )}
                                                                </p>
                                                                <p className="truncate text-xs text-gray-500" title={u.email}>
                                                                    {u.email}
                                                                </p>
                                                                {displayName(u) !== u.username && (
                                                                    <p className="truncate text-[11px] text-gray-400">@{u.username}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className={clTdCompact}>
                                                        <RolePill role={u.role} superAdmin={u.role === 'admin' && u.is_super_admin} />
                                                    </td>
                                                    <td className={clTdCompact}>
                                                        {showCompanyColumn ? (
                                                            <>
                                                                <p className="truncate font-medium text-gray-900">
                                                                    {u.company_name || 'Sin empresa'}
                                                                </p>
                                                                <p className="truncate text-xs text-gray-500">
                                                                    {u.department_name || '—'}
                                                                </p>
                                                            </>
                                                        ) : (
                                                            <p className="truncate text-gray-700">{u.department_name || '—'}</p>
                                                        )}
                                                    </td>
                                                    <td className={clTdCompact}>
                                                        <StatusPill active={u.is_active !== false} />
                                                    </td>
                                                    <td className={clTdCompact}>{renderActivity(u)}</td>
                                                    <td className={`${clTdCompact} text-xs text-gray-500`}>{formatDate(u.created_at)}</td>
                                                    <td className={`${clTdCompact} text-right`}>{renderActions(u)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Tarjetas (hasta lg) */}
                                    <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:hidden">
                                        {g.items.map((u) => (
                                            <div
                                                key={u.id}
                                                className={`min-w-0 rounded-xl border border-gray-100 p-3 ${
                                                    u.is_active === false ? 'bg-gray-50' : 'bg-white'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <Avatar u={u} />
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-semibold text-gray-900">{displayName(u)}</p>
                                                        <p className="truncate text-xs text-gray-500">@{u.username}</p>
                                                        <p className="truncate text-xs text-gray-500">{u.email}</p>
                                                    </div>
                                                    <StatusPill active={u.is_active !== false} />
                                                </div>
                                                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
                                                    <RolePill role={u.role} superAdmin={u.role === 'admin' && u.is_super_admin} />
                                                    {showCompanyColumn && (
                                                        <span className="truncate">{u.company_name || 'Sin empresa'}</span>
                                                    )}
                                                    {u.department_name && <span className="truncate">{u.department_name}</span>}
                                                </div>
                                                <div className="mt-2 flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                                                    {renderActivity(u)}
                                                    {renderActions(u)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {isUserModalOpen && (
                <UserFormModal
                    isOpen={isUserModalOpen}
                    onClose={() => setIsUserModalOpen(false)}
                    onSave={handleSaveUser}
                    onCreated={fetchUsers}
                    initialData={currentUser}
                    departments={allDepartments}
                    companies={allCompanies}
                />
            )}

            <ResetPasswordModal
                isOpen={isResetModalOpen}
                onClose={() => setIsResetModalOpen(false)}
                onConfirm={handleConfirmResetPassword}
                user={selectedUserForReset}
            />

            <UserPermissionsModal
                isOpen={isPermissionsModalOpen}
                onClose={() => {
                    setIsPermissionsModalOpen(false);
                    setPermissionsTarget(null);
                }}
                targetUser={permissionsTarget}
                onSaved={fetchUsers}
                canGrantSuperAdmin={!!user?.is_super_admin}
            />

            <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
        </>
    );
};

export default AdminUsersPage;
