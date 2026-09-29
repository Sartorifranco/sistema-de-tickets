import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
    ResponsiveContainer,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from 'recharts';
import {
    Activity,
    X,
    Clock,
    Percent,
    UserX,
    AlertTriangle,
    Hourglass,
    CalendarDays,
    TrendingUp,
    TrendingDown,
    Minus,
} from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ActivityLog, ApiResponseError, TicketData, User } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import { formatLocalDate } from '../utils/dateFormatter';
import { toast } from 'react-toastify';
import { useDepositariosMetrics, DepositariosCriticalListModal } from '../components/Dashboard/DepositariosWidget';
import { clCard, clModalPanel } from '../utils/cleanLightUi';
import { WorldCupDashboardBanner } from '../components/Common/WorldCupArgentinaTheme';
import StatusBadge from '../components/Tickets/StatusBadge';

const activityTypeTranslations: { [key: string]: string } = {
    user_registered: 'Usuario Registrado',
    user_logged_in: 'Inicio de Sesión',
    ticket_created: 'Ticket Creado',
    ticket_assigned: 'Ticket Asignado',
    comment_added: 'Comentario Añadido',
    department_created: 'Departamento Creado',
    company_created: 'Empresa Creada',
    ticket_resolved: 'Ticket Resuelto',
    ticket_closed: 'Ticket Cerrado',
    notification_read: 'Notificación leída',
    notification_read_all: 'Notificaciones leídas',
};

const activityTypeColors: { [key: string]: string } = {
    ticket_created: 'bg-sky-50 text-sky-700',
    ticket_resolved: 'bg-emerald-50 text-emerald-700',
    ticket_closed: 'bg-slate-100 text-slate-700',
    comment_added: 'bg-amber-50 text-amber-700',
    ticket_assigned: 'bg-violet-50 text-violet-700',
};

/** Evento del feed de actividad del dashboard (log + hitos de tickets). */
type DashboardActivity = Pick<ActivityLog, 'username' | 'action_type' | 'description' | 'created_at'> & {
    id: number | string;
    ticket_id?: number | null;
};

interface ServiceHealth {
    unassignedActive: number;
    highPriorityActive: number;
    staleActive: number;
    createdLast30d: number;
    createdPrev30d: number;
    resolvedLast30d: number;
    resolutionRate30d: number | null;
    avgResolutionHours30d: number | null;
    avgResolutionHoursPrev30d: number | null;
    createdToday: number;
    resolvedToday: number;
    activeByPriority: { low: number; medium: number; high: number; urgent: number };
    dailyTrend: { date: string; created: number; resolved: number }[];
}

interface DashboardMetrics {
    totalTickets: number;
    activeTickets: number;
    totalUsers: number;
    recentActivity: DashboardActivity[];
    departmentCounts: {
        'Soporte - IT'?: number;
        'Implementaciones'?: number;
        'Mantenimiento'?: number;
        'Desarrollo'?: number;
    };
    agentWorkload: {
        agentId: number;
        agentName: string;
        assignedTickets: number;
    }[];
    serviceHealth?: ServiceHealth;
}

// --- Componente genérico para el Modal de Detalles ---
const DetailsModal: React.FC<{ title: string; items: any[]; onClose: () => void; renderItem: (item: any, index?: number) => React.ReactNode; loading: boolean }> = ({ title, items, onClose, renderItem, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className={`${clModalPanel} max-w-2xl p-6`}>
                <h2 className="text-2xl font-bold mb-4 border-b border-gray-100 pb-2 text-slate-900 break-words">{title}</h2>
                <div className="max-h-96 overflow-y-auto overflow-x-hidden">
                    {loading ? (
                        <p className="text-center text-gray-500 py-4">Cargando...</p>
                    ) : items.length > 0 ? (
                        <ul className="divide-y divide-gray-200">
                            {items.map((item, index) => renderItem(item, index))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">No hay elementos para mostrar.</p>
                    )}
                </div>
                <button type="button" onClick={onClose} className="mt-6 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 px-5 rounded-xl w-full">Cerrar</button>
            </div>
        </div>
    );
};

// --- Componente del Pop-up de Agentes ---
const AgentTicketsModal: React.FC<{ agent: { agentId: number, agentName: string } | null, onClose: () => void }> = ({ agent, onClose }) => {
    const [tickets, setTickets] = useState<Partial<TicketData>[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (agent) {
            const fetchAgentTickets = async () => {
                setLoading(true);
                try {
                    const response = await api.get(`/api/users/${agent.agentId}/active-tickets`);
                    setTickets(response.data.data);
                } catch (error) {
                    toast.error(`No se pudieron cargar los tickets de ${agent.agentName}.`);
                } finally {
                    setLoading(false);
                }
            };
            fetchAgentTickets();
        }
    }, [agent]);

    if (!agent) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className={`${clModalPanel} max-w-lg p-6`}>
                <h2 className="text-xl font-bold mb-4 text-slate-900 break-words">Tickets Activos de {agent.agentName}</h2>
                {loading ? (
                    <p>Cargando tickets...</p>
                ) : (
                    <ul className="space-y-2 max-h-80 overflow-y-auto overflow-x-hidden">
                        {tickets.length > 0 ? tickets.map(ticket => (
                            <li key={ticket.id} className="border p-3 rounded-md flex justify-between items-center gap-3 hover:bg-gray-50">
                                <span className="min-w-0 break-words">#{ticket.id} - {ticket.title}</span>
                                <Link to={`/admin/tickets/${ticket.id}`} className="text-red-600 hover:underline text-sm font-semibold shrink-0">Ver</Link>
                            </li>
                        )) : <p className="text-gray-500">Este agente no tiene tickets activos asignados.</p>}
                    </ul>
                )}
                <button type="button" onClick={onClose} className="mt-6 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2.5 px-5 rounded-xl w-full">Cerrar</button>
            </div>
        </div>
    );
};

// --- Panel lateral de Actividad Reciente ---
const ActivityDrawer: React.FC<{ isOpen: boolean; onClose: () => void; logs: DashboardActivity[] }> = ({ isOpen, onClose, logs }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Actividad reciente">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <aside className="relative h-full w-full max-w-md bg-white shadow-2xl border-l border-gray-100 flex flex-col">
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
                            <Activity className="w-5 h-5" />
                        </span>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Actividad reciente</h2>
                            <p className="text-xs text-slate-500">Últimos {logs.length} eventos del sistema</p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto overflow-x-hidden px-5 py-3">
                    {logs.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No hay actividad reciente.</p>
                    ) : (
                        <ol className="relative border-l border-gray-200 ml-2 space-y-4 py-2">
                            {logs.map((log) => (
                                <li key={log.id} className="ml-4 min-w-0">
                                    <span className="absolute -left-[5px] mt-1.5 w-2.5 h-2.5 rounded-full bg-red-500 ring-4 ring-white" />
                                    <p className="text-sm font-semibold text-gray-900 break-words">
                                        {log.username || 'Sistema'}
                                        <span className={`ml-1.5 text-xs font-medium rounded-full px-2 py-0.5 align-middle ${activityTypeColors[log.action_type] || 'bg-red-50 text-red-700'}`}>
                                            {activityTypeTranslations[log.action_type] || log.action_type.replace(/_/g, ' ')}
                                        </span>
                                    </p>
                                    <p className="text-sm text-gray-600 mt-0.5 break-words">{log.description}</p>
                                    <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap items-center gap-x-2">
                                        <span>{formatLocalDate(log.created_at)}</span>
                                        {log.ticket_id ? (
                                            <Link to={`/admin/tickets/${log.ticket_id}`} onClick={onClose} className="text-red-600 hover:underline font-medium">
                                                Ver ticket #{log.ticket_id}
                                            </Link>
                                        ) : null}
                                    </p>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </aside>
        </div>
    );
};

// --- Tile de KPI de salud del servicio ---
const HealthTile: React.FC<{
    label: string;
    value: string | number;
    hint?: React.ReactNode;
    icon: React.ReactNode;
    accent: string;
    onClick?: () => void;
    highlight?: boolean;
}> = ({ label, value, hint, icon, accent, onClick, highlight }) => {
    const content = (
        <>
            <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
            <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 leading-tight break-words">{label}</p>
                <p className={`text-2xl font-bold leading-tight mt-1 break-words ${highlight ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
                {hint && <div className="text-[11px] text-slate-500 mt-0.5 break-words">{hint}</div>}
            </div>
        </>
    );
    const base = `rounded-xl border p-3.5 flex items-start gap-3 min-w-0 text-left w-full ${
        highlight ? 'border-red-100 bg-red-50/40' : 'border-gray-100 bg-gray-50/70'
    }`;
    if (onClick) {
        return (
            <button type="button" onClick={onClick} className={`${base} hover:bg-white hover:shadow-sm transition-all cursor-pointer`}>
                {content}
            </button>
        );
    }
    return <div className={base}>{content}</div>;
};

const DeltaBadge: React.FC<{ current: number | null; previous: number | null; lowerIsBetter?: boolean; unit?: string }> = ({
    current,
    previous,
    lowerIsBetter = false,
    unit = '',
}) => {
    if (current === null || previous === null || previous === 0) {
        return <span className="inline-flex items-center gap-1 text-slate-400"><Minus className="w-3 h-3" /> sin comparativo</span>;
    }
    const diff = current - previous;
    const pct = Math.round((diff / previous) * 100);
    if (pct === 0) return <span className="inline-flex items-center gap-1 text-slate-500"><Minus className="w-3 h-3" /> igual que el período anterior</span>;
    const improved = lowerIsBetter ? diff < 0 : diff > 0;
    const Icon = diff > 0 ? TrendingUp : TrendingDown;
    return (
        <span className={`inline-flex items-center gap-1 font-semibold ${improved ? 'text-emerald-600' : 'text-red-600'}`}>
            <Icon className="w-3 h-3" /> {pct > 0 ? '+' : ''}{pct}%{unit} vs. 30 días previos
        </span>
    );
};

function formatHours(hours: number | null): string {
    if (hours === null || !Number.isFinite(hours)) return '—';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 48) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} d`;
}

const PRIORITY_META: { key: 'urgent' | 'high' | 'medium' | 'low'; label: string; color: string }[] = [
    { key: 'urgent', label: 'Urgente', color: '#dc2626' },
    { key: 'high', label: 'Alta', color: '#f97316' },
    { key: 'medium', label: 'Media', color: '#f59e0b' },
    { key: 'low', label: 'Baja', color: '#10b981' },
];

// --- Componente Principal del Dashboard ---
const AdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const { socket } = useNotification();
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // Estados para los modales
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
    const [isAgentModalOpen, setIsAgentModalOpen] = useState(false);
    const [isActivityOpen, setIsActivityOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; items: any[]; renderItem: (item: any, index?: number) => React.ReactNode } | null>(null);
    const [modalLoading, setModalLoading] = useState(false);
    const [selectedAgent, setSelectedAgent] = useState<{ agentId: number, agentName: string } | null>(null);
    const depMetrics = useDepositariosMetrics();
    const [showDepCriticalModal, setShowDepCriticalModal] = useState(false);

    const fetchMetrics = useCallback(async (isInitialLoad = false) => {
        if (isInitialLoad) setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/dashboard/admin');
            setMetrics(response.data.data);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar datos.' : 'Error inesperado.';
            setError(message);
            toast.error(message);
        } finally {
            if (isInitialLoad) setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role === 'admin') fetchMetrics(true);
    }, [user, fetchMetrics]);

    useEffect(() => {
        if (socket) {
            const handleDashboardUpdate = () => fetchMetrics(false);
            socket.on('dashboard_update', handleDashboardUpdate);
            return () => { socket.off('dashboard_update', handleDashboardUpdate); };
        }
    }, [socket, fetchMetrics]);

    const renderTicketItem = (ticket: TicketData) => (
        <li key={ticket.id} className="p-3 hover:bg-gray-50 flex justify-between items-center gap-3">
            <div className="min-w-0">
                <span className="font-semibold break-words">#{ticket.id} - {ticket.title}</span>
                <span className="text-gray-500 ml-2 break-words">({ticket.client_name})</span>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    <StatusBadge status={ticket.status} />
                    <span>{ticket.agent_names || ticket.agent_name || 'Sin asignar'}</span>
                </div>
            </div>
            <Link to={`/admin/tickets/${ticket.id}`} className="text-red-600 hover:underline shrink-0">Ver</Link>
        </li>
    );

    const handleCardClick = async (type: 'total' | 'active' | 'users' | 'department', departmentName?: string) => {
        setModalLoading(true);
        setIsDetailsModalOpen(true);
    
        let title = '';
        let items: any[] = [];
        let renderItem: (item: any, index?: number) => React.ReactNode = () => null;
    
        try {
            if (type === 'users') {
                title = 'Todos los Usuarios';
                const response = await api.get('/api/users');
                items = response.data.data;
                renderItem = (u: User) => (
                    <li key={u.id} className="p-3 hover:bg-gray-50 break-words">{u.username} - ({u.role})</li>
                );
            } else {
                const params = new URLSearchParams();
                if (type === 'active') {
                    title = 'Tickets Activos';
                    params.append('status', 'open');
                    params.append('status', 'in-progress');
                } else if (type === 'department' && departmentName) {
                    title = `Tickets Activos en ${departmentName}`;
                    params.append('status', 'open');
                    params.append('status', 'in-progress');
                    params.append('departmentName', departmentName);
                } else {
                    title = 'Todos los Tickets';
                }
    
                const response = await api.get(`/api/tickets?${params.toString()}`);
                items = response.data.data;
                renderItem = renderTicketItem;
            }
            setModalContent({ title, items, renderItem });
        } catch (error) {
            toast.error('No se pudo cargar la información detallada.');
            setIsDetailsModalOpen(false);
        } finally {
            setModalLoading(false);
        }
    };

    /** Listas de salud del servicio: se calculan sobre los tickets activos. */
    const handleHealthClick = async (kind: 'unassigned' | 'highPriority' | 'stale') => {
        setModalLoading(true);
        setIsDetailsModalOpen(true);
        const titles = {
            unassigned: 'Tickets activos sin asignar',
            highPriority: 'Tickets activos de prioridad alta o urgente',
            stale: 'Tickets activos sin movimiento hace más de 3 días',
        };
        try {
            const params = new URLSearchParams();
            params.append('status', 'open');
            params.append('status', 'in-progress');
            if (kind === 'unassigned') params.append('unassigned', 'true');
            const response = await api.get(`/api/tickets?${params.toString()}`);
            let items: TicketData[] = response.data.data || [];
            if (kind === 'highPriority') {
                items = items.filter((t) => t.priority === 'high' || t.priority === 'urgent');
            } else if (kind === 'stale') {
                const limit = Date.now() - 3 * 24 * 60 * 60 * 1000;
                items = items.filter((t) => new Date(t.updated_at || t.created_at).getTime() < limit);
            }
            setModalContent({ title: titles[kind], items, renderItem: renderTicketItem });
        } catch (error) {
            toast.error('No se pudo cargar la información detallada.');
            setIsDetailsModalOpen(false);
        } finally {
            setModalLoading(false);
        }
    };

    const handleAgentClick = (agent: { agentId: number, agentName: string }) => {
        setSelectedAgent(agent);
        setIsAgentModalOpen(true);
    };

    const health = metrics?.serviceHealth;

    const trendData = useMemo(
        () =>
            (health?.dailyTrend || []).map((d) => {
                const [, m, day] = d.date.split('-');
                return { label: `${day}/${m}`, Creados: d.created, Finalizados: d.resolved };
            }),
        [health]
    );

    const activePriorityTotal = health
        ? PRIORITY_META.reduce((acc, p) => acc + (health.activeByPriority[p.key] || 0), 0)
        : 0;

    if (loading) return <div className="p-8 text-center">Cargando dashboard...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;
    if (!metrics) return <div className="p-8 text-center">No se encontraron datos para mostrar.</div>;

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8 min-w-0">
                <WorldCupDashboardBanner pageTitle="Dashboard de Administrador" userName={user?.username} />
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard de Administrador</h1>
                    <button
                        type="button"
                        onClick={() => setIsActivityOpen(true)}
                        className="inline-flex items-center gap-2 self-start sm:self-auto bg-white hover:bg-gray-50 text-gray-800 font-semibold py-2.5 px-4 rounded-xl border border-gray-200 shadow-sm"
                        title="Ver actividad reciente del sistema"
                    >
                        <Activity className="w-5 h-5 text-red-600" />
                        <span className="text-sm">Actividad reciente</span>
                        {metrics.recentActivity.length > 0 && (
                            <span className="ml-1 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-1.5 rounded-full bg-red-600 text-white text-xs font-bold">
                                {metrics.recentActivity.length}
                            </span>
                        )}
                    </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 sm:gap-6">
                    <button type="button" onClick={() => handleCardClick('total')} className={`text-left ${clCard} p-5 hover:shadow-md transition-shadow cursor-pointer min-w-0`}>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Tickets Totales</h3>
                        <p className="text-3xl sm:text-4xl font-bold text-violet-600 mt-2">{metrics.totalTickets}</p>
                    </button>
                    <button type="button" onClick={() => handleCardClick('active')} className={`text-left ${clCard} p-5 hover:shadow-md transition-shadow cursor-pointer min-w-0`}>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Tickets Activos</h3>
                        <p className="text-3xl sm:text-4xl font-bold text-green-600 mt-2">{metrics.activeTickets}</p>
                    </button>
                    <button type="button" onClick={() => handleCardClick('users')} className={`text-left ${clCard} p-5 hover:shadow-md transition-shadow cursor-pointer min-w-0`}>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Usuarios Totales</h3>
                        <p className="text-3xl sm:text-4xl font-bold text-blue-600 mt-2">{metrics.totalUsers}</p>
                    </button>

                    <div className={`${clCard} p-5 min-w-0`}>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Mantenimientos</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Este mes</p>
                        <p className="text-3xl sm:text-4xl font-bold text-green-600 mt-2">{depMetrics.maintainedThisMonth}</p>
                    </div>
                    <button
                        type="button"
                        onClick={() => depMetrics.criticalCount > 0 && setShowDepCriticalModal(true)}
                        className={`text-left ${clCard} p-5 hover:shadow-md transition-shadow min-w-0 ${depMetrics.criticalCount > 0 ? 'cursor-pointer ring-1 ring-red-100' : 'cursor-default opacity-95'}`}
                    >
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Pendientes</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1 break-words">Sin mantenimiento +30 días</p>
                        <p className="text-3xl sm:text-4xl font-bold text-red-600 mt-2">{depMetrics.criticalCount}</p>
                        {depMetrics.criticalCount > 0 && (
                            <p className="text-xs font-semibold text-red-600 mt-2">Tocar para ver lista</p>
                        )}
                    </button>
                    <div className={`${clCard} p-5 min-w-0`}>
                        <h3 className="text-sm sm:text-base font-bold text-slate-900 break-words">Total de Equipos</h3>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mt-1">Activos en sistema</p>
                        <p className="text-3xl sm:text-4xl font-bold text-slate-900 mt-2">{depMetrics.totalDepositarios}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                    <div className={`lg:col-span-3 ${clCard} p-6 min-w-0`}>
                        <h2 className="text-xl font-bold mb-4 border-b border-gray-100 pb-2 text-slate-900">Estado por Área (Tickets Activos)</h2>
                        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
                             <button type="button" onClick={() => handleCardClick('department', 'Soporte - IT')} className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/80 transition-colors cursor-pointer min-w-0">
                                <h4 className="font-bold text-gray-700 break-words">Soporte - IT</h4>
                                <p className="text-4xl font-bold text-red-600 mt-2">{metrics.departmentCounts['Soporte - IT'] || 0}</p>
                            </button>
                            <button type="button" onClick={() => handleCardClick('department', 'Implementaciones')} className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/80 transition-colors cursor-pointer min-w-0">
                                <h4 className="font-bold text-gray-700 break-words">Implementaciones</h4>
                                <p className="text-4xl font-bold text-red-600 mt-2">{metrics.departmentCounts['Implementaciones'] || 0}</p>
                            </button>
                            <button type="button" onClick={() => handleCardClick('department', 'Mantenimiento')} className="text-center p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100/80 transition-colors cursor-pointer min-w-0">
                                <h4 className="font-bold text-gray-700 break-words">Mantenimiento</h4>
                                <p className="text-4xl font-bold text-red-600 mt-2">{metrics.departmentCounts['Mantenimiento'] || 0}</p>
                            </button>
                            <button type="button" onClick={() => handleCardClick('department', 'Desarrollo')} className="text-center p-4 rounded-xl border border-violet-300/80 bg-gradient-to-br from-violet-50 to-indigo-50 hover:from-violet-100 hover:to-indigo-100 transition-colors cursor-pointer shadow-sm min-w-0">
                                <h4 className="font-bold text-indigo-950 break-words">Desarrollo</h4>
                                <p className="text-4xl font-bold text-violet-700 mt-2">{metrics.departmentCounts['Desarrollo'] || 0}</p>
                            </button>
                        </div>
                    </div>
                    <div className={`lg:col-span-2 ${clCard} p-6 min-w-0`}>
                        <h2 className="text-xl font-bold mb-4 border-b border-gray-100 pb-2 text-slate-900">Carga de Agentes (Tickets Activos)</h2>
                        <ul className="space-y-3 max-h-60 overflow-y-auto overflow-x-hidden">
                            {metrics.agentWorkload.length > 0 ? metrics.agentWorkload.map(agent => (
                                <li key={agent.agentId}>
                                    <button type="button" onClick={() => handleAgentClick(agent)} className="w-full flex justify-between items-center gap-3 p-2 rounded-xl hover:bg-gray-50 text-left transition-colors border border-transparent hover:border-gray-100">
                                        <span className="font-medium text-gray-800 min-w-0 break-words">{agent.agentName}</span>
                                        <span className="font-bold text-white bg-red-600 rounded-full h-6 min-w-[1.5rem] px-1.5 flex items-center justify-center text-xs shrink-0">{agent.assignedTickets}</span>
                                    </button>
                                </li>
                            )) : (
                                <p className="text-gray-500 text-center py-4">No hay agentes con tickets activos.</p>
                            )}
                        </ul>
                    </div>
                </div>

                {/* Salud del servicio: reemplaza al bloque de Actividad Reciente */}
                {health && (
                    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                        <div className={`lg:col-span-3 ${clCard} p-6 min-w-0`}>
                            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-4 border-b border-gray-100 pb-2">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">Flujo de tickets · últimos 14 días</h2>
                                    <p className="text-xs text-slate-500 mt-0.5">Creados por día vs. finalizados (resueltos o cerrados)</p>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-slate-600 shrink-0">
                                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="w-3.5 h-3.5 text-slate-400" /> Hoy: <strong className="text-slate-900">{health.createdToday}</strong> creados · <strong className="text-emerald-700">{health.resolvedToday}</strong> finalizados</span>
                                </div>
                            </div>
                            <div className="h-64 w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '0.75rem', fontSize: 12 }}
                                            cursor={{ fill: '#f1f5f9' }}
                                        />
                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                        <Bar dataKey="Creados" fill="#be0000" radius={[6, 6, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                                        <Line type="monotone" dataKey="Finalizados" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3, fill: '#16a34a' }} isAnimationActive={false} />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>

                            {/* Backlog activo por prioridad */}
                            <div className="mt-5 pt-4 border-t border-gray-100">
                                <div className="flex items-center justify-between gap-3 mb-2">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Backlog activo por prioridad</p>
                                    <p className="text-xs text-slate-500">{activePriorityTotal} activos</p>
                                </div>
                                {activePriorityTotal === 0 ? (
                                    <p className="text-sm text-slate-500">Sin tickets activos. ¡Todo al día!</p>
                                ) : (
                                    <>
                                        <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-100">
                                            {PRIORITY_META.map((p) => {
                                                const v = health.activeByPriority[p.key] || 0;
                                                if (v === 0) return null;
                                                return (
                                                    <div
                                                        key={p.key}
                                                        style={{ width: `${(v / activePriorityTotal) * 100}%`, backgroundColor: p.color }}
                                                        title={`${p.label}: ${v}`}
                                                    />
                                                );
                                            })}
                                        </div>
                                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                                            {PRIORITY_META.map((p) => (
                                                <span key={p.key} className="inline-flex items-center gap-1.5">
                                                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                                                    {p.label}: <strong className="text-slate-900">{health.activeByPriority[p.key] || 0}</strong>
                                                </span>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`lg:col-span-2 ${clCard} p-6 min-w-0`}>
                            <h2 className="text-xl font-bold mb-4 border-b border-gray-100 pb-2 text-slate-900">Salud del servicio</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
                                <HealthTile
                                    label="Resolución promedio"
                                    value={formatHours(health.avgResolutionHours30d)}
                                    hint={<DeltaBadge current={health.avgResolutionHours30d} previous={health.avgResolutionHoursPrev30d} lowerIsBetter />}
                                    icon={<Clock className="w-5 h-5 text-violet-700" />}
                                    accent="bg-violet-50"
                                />
                                <HealthTile
                                    label="Tasa de cierre 30d"
                                    value={health.resolutionRate30d === null ? '—' : `${health.resolutionRate30d}%`}
                                    hint={`${health.resolvedLast30d} finalizados / ${health.createdLast30d} creados`}
                                    icon={<Percent className="w-5 h-5 text-emerald-700" />}
                                    accent="bg-emerald-50"
                                />
                                <HealthTile
                                    label="Sin asignar"
                                    value={health.unassignedActive}
                                    hint={health.unassignedActive > 0 ? 'Tocar para ver la lista' : 'Todos los activos tienen agente'}
                                    icon={<UserX className="w-5 h-5 text-amber-700" />}
                                    accent="bg-amber-50"
                                    onClick={health.unassignedActive > 0 ? () => handleHealthClick('unassigned') : undefined}
                                    highlight={health.unassignedActive > 0}
                                />
                                <HealthTile
                                    label="Alta / Urgente activos"
                                    value={health.highPriorityActive}
                                    hint={health.highPriorityActive > 0 ? 'Tocar para ver la lista' : 'Sin prioridades críticas'}
                                    icon={<AlertTriangle className="w-5 h-5 text-red-700" />}
                                    accent="bg-red-50"
                                    onClick={health.highPriorityActive > 0 ? () => handleHealthClick('highPriority') : undefined}
                                    highlight={health.highPriorityActive > 0}
                                />
                                <HealthTile
                                    label="Estancados (+3 días)"
                                    value={health.staleActive}
                                    hint={health.staleActive > 0 ? 'Activos sin movimiento · tocar para ver' : 'Todo el backlog tiene movimiento'}
                                    icon={<Hourglass className="w-5 h-5 text-slate-700" />}
                                    accent="bg-slate-100"
                                    onClick={health.staleActive > 0 ? () => handleHealthClick('stale') : undefined}
                                    highlight={health.staleActive > 0}
                                />
                                <HealthTile
                                    label="Demanda 30 días"
                                    value={health.createdLast30d}
                                    hint={<DeltaBadge current={health.createdLast30d} previous={health.createdPrev30d} lowerIsBetter />}
                                    icon={<TrendingUp className="w-5 h-5 text-blue-700" />}
                                    accent="bg-blue-50"
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <ActivityDrawer isOpen={isActivityOpen} onClose={() => setIsActivityOpen(false)} logs={metrics.recentActivity} />

            {showDepCriticalModal && (
                <DepositariosCriticalListModal
                    title="Equipos sin mantenimiento reciente"
                    items={depMetrics.criticalList}
                    onClose={() => setShowDepCriticalModal(false)}
                />
            )}
            {isAgentModalOpen && <AgentTicketsModal agent={selectedAgent} onClose={() => setIsAgentModalOpen(false)} />}
            {isDetailsModalOpen && <DetailsModal title={modalContent?.title || ''} items={modalContent?.items || []} onClose={() => setIsDetailsModalOpen(false)} renderItem={modalContent?.renderItem || (() => null)} loading={modalLoading} />}
        </>
    );
};

export default AdminDashboard;
