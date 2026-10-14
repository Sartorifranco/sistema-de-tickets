import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Search, UserSearch, BarChart3, X } from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, User, Department, TicketStatus, TicketPriority } from '../types';
import { ticketStatusTranslations, ticketPriorityTranslations } from '../utils/traslations';
import TicketFormModal from '../components/Tickets/TicketFormModal';
import TicketReportModal, { ReportFilterChip } from '../components/Tickets/TicketReportModal';
import { formatLocalDate } from '../utils/dateFormatter';
import { ticketRealHoursValid, ticketRequiresRealHoursForClosure } from '../utils/ticketAccess';
import { clCard, clInput, clTdCompact as clTd, clThCompact as clTh, clThCompactRight as clThRight } from '../utils/cleanLightUi';
import { hasAnyPermission } from '../utils/permissions';
import { PERMISSION_KEYS as P } from '../constants/permissions';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { toastTicketCreated } from '../utils/ticketCreatedToast';
import { AuthorizationPill } from '../components/Tickets/TicketAuthorizationBanner';
import { ticketLinkClickHandler, ticketRowClass, useRestoreTicketRow, useSyncListQuery } from '../utils/ticketListReturn';

const TabButton: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => (
    <button
        onClick={onClick}
        className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors duration-200 border ${
            isActive
                ? 'bg-white text-gray-900 shadow-sm border-gray-200'
                : 'bg-transparent text-gray-600 hover:bg-white/80 border-transparent'
        }`}
    >
        {label}
    </button>
);

type AgentView = 'assigned' | 'unassigned' | 'all';

const VIEW_LABELS: Record<AgentView, string> = {
    assigned: 'Mis tickets asignados',
    unassigned: 'Tickets sin asignar',
    all: 'Todos los tickets',
};

const AgentTicketsPage: React.FC = () => {
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [agents, setAgents] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const { user } = useAuth();
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    const [searchParams] = useSearchParams();
    const initialTab = searchParams.get('tab');
    const [view, setView] = useState<AgentView>(
        initialTab === 'unassigned' || initialTab === 'all' ? initialTab : 'assigned'
    );
    
    const [filters, setFilters] = useState({
        status: searchParams.get('status') || '',
        startDate: searchParams.get('startDate') || '',
        endDate: searchParams.get('endDate') || '',
        agentId: searchParams.get('agentId') || '',
        priority: searchParams.get('priority') || '',
    });
    const [searchTitle, setSearchTitle] = useState(searchParams.get('q') || '');
    const [searchClient, setSearchClient] = useState(searchParams.get('cliente') || '');
    const debouncedTitle = useDebouncedValue(searchTitle.trim(), 400);
    const debouncedClient = useDebouncedValue(searchClient.trim(), 400);

    useSyncListQuery({
        tab: view === 'assigned' ? '' : view,
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        agentId: filters.agentId,
        priority: filters.priority,
        q: searchTitle,
        cliente: searchClient,
    });
    const focusId = useRestoreTicketRow('/agent/tickets', !loading && tickets.length > 0);

    const handleViewChange = (newView: AgentView) => {
        setView(newView);
        setFilters(prev => ({
            ...prev,
            status: '',
            agentId: '',
            priority: '',
        }));
    };

    const getStatusSelectClasses = (status: TicketStatus): string => {
        const baseClasses =
            'w-full px-2 py-2 border rounded-xl text-sm transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-400 bg-white';
        switch (status) {
            case 'open':
            case 'reopened':
                return `${baseClasses} bg-sky-50 text-sky-900 border-sky-200`;
            case 'in-progress':
                return `${baseClasses} bg-blue-50 text-blue-900 border-blue-200`;
            case 'resolved':
                return `${baseClasses} bg-green-50 text-green-900 border-green-200`;
            case 'closed':
                return `${baseClasses} bg-gray-50 text-gray-900 border-gray-200`;
            default:
                return `${baseClasses} bg-gray-50 text-gray-900 border-gray-200`;
        }
    };

    const fetchPageData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams();
            params.append('view', view);
            if (filters.status) params.append('status', filters.status);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (filters.agentId) params.append('agentId', filters.agentId);
            if (filters.priority) params.append('priority', filters.priority); 
            if (debouncedTitle) params.append('search', debouncedTitle);
            if (debouncedClient) params.append('clientName', debouncedClient);

            const ticketsResponse = await api.get(`/api/tickets?${params.toString()}`);
            setTickets(ticketsResponse.data.data || []);

            const canLoadUserLists = hasAnyPermission(user, [P.USERS_VIEW, P.TICKETS_VIEW]);
            const [deptsResponse, agentsResponse, usersResponse] = await Promise.all([
                api.get('/api/departments'),
                canLoadUserLists ? api.get('/api/users/agents') : Promise.resolve({ data: { data: [] } }),
                canLoadUserLists ? api.get('/api/users') : Promise.resolve({ data: { data: [] } }),
            ]);
            setDepartments(deptsResponse.data.data || []);
            setAgents(agentsResponse.data.data || []);
            setAllUsers(usersResponse.data.data || []);
        } catch (err) {
            const errorMessage = "No se pudieron cargar los datos.";
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [user, view, filters, debouncedTitle, debouncedClient]); 

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);
    
    const handleSaveTicket = async (ticketData: Partial<TicketData>, attachments: File[]) => {
        try {
            const formData = new FormData();
            Object.entries(ticketData).forEach(([key, value]) => {
                if (value !== null && value !== undefined && value !== '') {
                    formData.append(
                        key,
                        Array.isArray(value) ? JSON.stringify(value) : String(value)
                    );
                }
            });
            attachments.forEach(file => formData.append('attachments', file));
            const res = await api.post('/api/tickets', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            toastTicketCreated(res.data);
            setIsModalOpen(false);
            await fetchPageData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al guardar el ticket.');
        }
    };

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const clearFilters = () => {
        setFilters({ 
            status: '', 
            startDate: '', 
            endDate: '', 
            agentId: '', 
            priority: '' 
        });
        setSearchTitle('');
        setSearchClient('');
    };

    const hasActiveFilters =
        Object.values(filters).some((v) => v !== '') || searchTitle.trim() !== '' || searchClient.trim() !== '';

    const reportFilters: ReportFilterChip[] = useMemo(() => {
        const a = agents.find((x) => String(x.id) === filters.agentId);
        const agentLabel = a ? (a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.username) : '';
        return [
            { label: 'Vista', value: VIEW_LABELS[view] },
            { label: 'Título', value: debouncedTitle },
            { label: 'Cliente', value: debouncedClient },
            { label: 'Agente', value: agentLabel },
            { label: 'Estado', value: filters.status ? ticketStatusTranslations[filters.status as TicketStatus] || filters.status : '' },
            { label: 'Prioridad', value: filters.priority ? ticketPriorityTranslations[filters.priority as TicketPriority] || filters.priority : '' },
            { label: 'Desde', value: filters.startDate },
            { label: 'Hasta', value: filters.endDate },
        ];
    }, [view, filters, agents, debouncedTitle, debouncedClient]);

    const handleTakeTicket = async (ticketId: number) => {
        try {
            await api.put(`/api/tickets/${ticketId}/assign`);
            toast.success(`¡Has tomado el ticket #${ticketId}!`);
            fetchPageData();
        } catch (error) {
            toast.error("No se pudo tomar el ticket.");
        }
    };

    const handleStatusChange = async (ticketId: number, newStatus: TicketStatus) => {
        if (newStatus === 'resolved' || newStatus === 'closed') {
            const t = tickets.find((x) => x.id === ticketId);
            if (
                t &&
                ticketRequiresRealHoursForClosure(
                    t.ticket_department_name ?? t.department_name,
                    t.es_tarea_interna
                ) &&
                !ticketRealHoursValid(t.horas_reales)
            ) {
                toast.warn(
                    'Este ticket (Desarrollo o tarea interna) requiere horas reales antes de resolver o cerrar.'
                );
                return;
            }
        }
        try {
            await api.put(`/api/tickets/${ticketId}/status`, { status: newStatus });
            toast.success("Estado actualizado.");
            setTickets(prevTickets => prevTickets.map(t => 
                t.id === ticketId ? { ...t, status: newStatus } : t
            ));
        } catch (error) {
            toast.error("No se pudo actualizar el estado.");
        }
    };

    const handlePriorityChange = async (ticketId: number, newPriority: TicketPriority) => {
        try {
            await api.put(`/api/tickets/${ticketId}`, { priority: newPriority });
            toast.info("Prioridad actualizada.");
             setTickets(prevTickets => prevTickets.map(t => 
                t.id === ticketId ? { ...t, priority: newPriority } : t
            ));
        } catch (error) {
            toast.error("No se pudo actualizar la prioridad.");
        }
    };

    const renderActions = (ticket: TicketData, compact = false) => {
        const linkClass = 'text-blue-700 hover:text-blue-900 font-semibold underline-offset-2 hover:underline';
        if (view === 'unassigned') {
            return (
                <div className={`flex gap-3 items-center flex-wrap ${compact ? '' : 'justify-end'}`}>
                    <Link to={`/agent/tickets/${ticket.id}`} className={linkClass}>Ver</Link>
                    <button type="button" onClick={() => handleTakeTicket(ticket.id)} className="px-3 py-1.5 bg-green-600 text-white rounded-full text-sm font-medium hover:bg-green-700 shadow-sm">Tomar</button>
                </div>
            );
        }
        return (
            <Link to={`/agent/tickets/${ticket.id}`} className={linkClass}>
                {view === 'assigned' ? 'Gestionar' : 'Ver'}
            </Link>
        );
    };

    const renderStatusSelect = (ticket: TicketData) => (
        <select 
            value={ticket.status} 
            onChange={(e) => handleStatusChange(ticket.id, e.target.value as TicketStatus)}
            className={getStatusSelectClasses(ticket.status as TicketStatus)}
            aria-label={`Estado del ticket ${ticket.id}`}
        >
            {Object.entries(ticketStatusTranslations).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
            ))}
        </select>
    );

    const renderPrioritySelect = (ticket: TicketData) => (
        <select 
            value={ticket.priority} 
            onChange={(e) => handlePriorityChange(ticket.id, e.target.value as TicketPriority)}
            className={`${clInput} py-2 px-2`}
            aria-label={`Prioridad del ticket ${ticket.id}`}
        >
            {Object.entries(ticketPriorityTranslations).map(([key, value]) => (
                <option key={key} value={key}>{value}</option>
            ))}
        </select>
    );

    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0" onClick={ticketLinkClickHandler('/agent/tickets')}>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Panel de Agente</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={() => setIsReportOpen(true)}
                            disabled={loading}
                            className="inline-flex items-center gap-2 bg-white hover:bg-gray-50 text-gray-800 font-semibold py-2.5 px-4 rounded-xl border border-gray-200 shadow-sm disabled:opacity-50"
                            title="Generar reporte gráfico de la consulta actual"
                        >
                            <BarChart3 className="w-5 h-5 text-red-600" />
                            <span className="text-sm">Generar reporte</span>
                        </button>
                        <button 
                            onClick={() => setIsModalOpen(true)}
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm"
                        >
                            Crear Nuevo Ticket
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-1 mb-6 p-1 bg-gray-100/90 rounded-xl border border-gray-100">
                    <TabButton label="Mis Tickets Asignados" isActive={view === 'assigned'} onClick={() => handleViewChange('assigned')} />
                    <TabButton label="Tickets Sin Asignar" isActive={view === 'unassigned'} onClick={() => handleViewChange('unassigned')} />
                    <TabButton label="Todos los Tickets" isActive={view === 'all'} onClick={() => handleViewChange('all')} />
                </div>

                <div className={`${clCard} p-4 sm:p-5 mb-6`}>
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Filtrar Tickets</h3>
                        <span className="text-xs text-gray-500">
                            {loading ? 'Consultando…' : `${tickets.length} ${tickets.length === 1 ? 'resultado' : 'resultados'}`}
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <label className="relative block">
                            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                value={searchTitle}
                                onChange={(e) => setSearchTitle(e.target.value)}
                                placeholder="Buscar por título o #ID…"
                                className={`${clInput} pl-9`}
                                aria-label="Buscar por título"
                            />
                        </label>
                        <label className="relative block">
                            <UserSearch className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                                type="search"
                                value={searchClient}
                                onChange={(e) => setSearchClient(e.target.value)}
                                placeholder="Buscar por cliente (nombre, usuario o email)…"
                                className={`${clInput} pl-9`}
                                aria-label="Buscar por cliente"
                            />
                        </label>
                    </div>

                    <div className={`grid grid-cols-1 sm:grid-cols-2 ${view === 'all' ? 'xl:grid-cols-3' : ''} gap-4 mb-4`}>
                        {view === 'all' && (
                             <select name="agentId" value={filters.agentId} onChange={handleFilterChange} className={clInput}>
                                <option value="">Todos los Agentes</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>
                                        {agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : agent.username}
                                    </option>
                                ))}
                            </select>
                        )}
                        <select name="status" value={filters.status} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todos los Estados</option>
                            <option value="open">Abierto</option>
                            <option value="in-progress">En Progreso</option>
                            <option value="resolved">Resuelto</option>
                            <option value="closed">Cerrado</option>
                        </select>
                        <select name="priority" value={filters.priority} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todas las Prioridades</option>
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                        </select>
                    </div>

                    <div className="flex flex-wrap items-end gap-3">
                        <label className="flex-1 min-w-[10rem] sm:flex-none sm:w-48">
                            <span className="block text-xs font-medium text-gray-500 mb-1">Desde</span>
                            <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={clInput} />
                        </label>
                        <label className="flex-1 min-w-[10rem] sm:flex-none sm:w-48">
                            <span className="block text-xs font-medium text-gray-500 mb-1">Hasta</span>
                            <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={clInput} />
                        </label>
                        <button
                            onClick={clearFilters}
                            disabled={!hasActiveFilters}
                            className="w-full sm:w-auto sm:ml-auto inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200/80 disabled:opacity-50"
                        >
                            <X className="w-4 h-4" /> Limpiar filtros
                        </button>
                    </div>
                </div>

                <div className={`${clCard} p-4 sm:p-6 min-w-0`}>
                    {loading ? (
                        <div className="text-center py-8 text-gray-600">Cargando tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <p className="text-lg">No hay tickets en esta vista.</p>
                        </div>
                    ) : (
                        <>
                            {/* Tabla (lg y superior) */}
                            <table className="hidden xl:table w-full table-fixed divide-y divide-gray-100">
                                <thead className="bg-gray-50/90">
                                    <tr>
                                        <th className={`${clTh} w-16`}>ID</th>
                                        <th className={clTh}>Título</th>
                                        <th className={`${clTh} w-[16%]`}>Cliente</th>
                                        {view === 'all' && <th className={`${clTh} w-[14%] hidden 2xl:table-cell`}>Agente</th>}
                                        <th className={`${clTh} w-[12%] hidden 2xl:table-cell`}>Creación</th>
                                        <th className={`${clTh} w-36`}>Estado</th>
                                        <th className={`${clTh} w-32`}>Prioridad</th>
                                        <th className={`${clThRight} ${view === 'unassigned' ? 'w-36' : 'w-24'}`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {tickets.map(ticket => (
                                        <tr key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'hover:bg-gray-50/80 transition-colors')}>
                                            <td className={`${clTd} whitespace-nowrap`}>#{ticket.id}</td>
                                            <td className={`${clTd} font-medium text-gray-900`}>
                                                {ticket.title}
                                                {ticket.authorization_status && (
                                                    <span className="ml-2 align-middle">
                                                        <AuthorizationPill status={ticket.authorization_status} />
                                                    </span>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1 font-normal 2xl:hidden">{formatLocalDate(ticket.created_at)}</p>
                                                {view === 'all' && (
                                                    <p className="text-xs text-gray-500 mt-1 font-normal 2xl:hidden">
                                                        {ticket.agent_names || ticket.agent_name || 'Sin asignar'}
                                                    </p>
                                                )}
                                            </td>
                                            <td className={clTd}>{ticket.client_name}</td>
                                            {view === 'all' && <td className={`${clTd} hidden 2xl:table-cell`}>{ticket.agent_names || ticket.agent_name || 'N/A'}</td>}
                                            <td className={`${clTd} text-gray-600 hidden 2xl:table-cell`}>
                                                {formatLocalDate(ticket.created_at)}
                                            </td>
                                            <td className={clTd}>{renderStatusSelect(ticket)}</td>
                                            <td className={clTd}>{renderPrioritySelect(ticket)}</td>
                                            <td className={`${clTd} text-right`}>{renderActions(ticket)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Tarjetas (hasta lg) */}
                            <div className="xl:hidden space-y-3">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'rounded-xl border border-gray-100 bg-gray-50/70 p-4 min-w-0')}>
                                        <p className="font-bold text-gray-900 break-words">#{ticket.id} · {ticket.title}</p>
                                        {ticket.authorization_status && (
                                            <div className="mt-1">
                                                <AuthorizationPill status={ticket.authorization_status} />
                                            </div>
                                        )}
                                        <dl className="mt-2 text-sm text-gray-700 space-y-1">
                                            <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Cliente:</dt><dd className="break-words min-w-0">{ticket.client_name}</dd></div>
                                            {view === 'all' && (
                                                <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Agente:</dt><dd className="break-words min-w-0">{ticket.agent_names || ticket.agent_name || 'N/A'}</dd></div>
                                            )}
                                            <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Creado:</dt><dd className="break-words min-w-0">{formatLocalDate(ticket.created_at)}</dd></div>
                                        </dl>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Estado</p>
                                                {renderStatusSelect(ticket)}
                                            </div>
                                            <div>
                                                <p className="text-xs font-semibold text-gray-500 mb-1">Prioridad</p>
                                                {renderPrioritySelect(ticket)}
                                            </div>
                                        </div>
                                        <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
                                            {renderActions(ticket, true)}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isModalOpen && user && (
                <TicketFormModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSaveTicket}
                    initialData={null}
                    departments={departments}
                    users={allUsers}
                    currentUserRole={user.role}
                />
            )}

            <TicketReportModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                tickets={tickets}
                filters={reportFilters}
                title={`Reporte · ${VIEW_LABELS[view]}`}
            />
        </>
    );
};

export default AgentTicketsPage;
