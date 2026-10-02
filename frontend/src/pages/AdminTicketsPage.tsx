import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LayoutGrid, List, Search, UserSearch, BarChart3, X } from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, User, Department, Company, TicketStatus } from '../types';
import TicketFormModal from '../components/Tickets/TicketFormModal';
import StatusBadge from '../components/Tickets/StatusBadge';
import KanbanBoard from '../components/Tickets/KanbanBoard';
import TicketReportModal, { ReportFilterChip } from '../components/Tickets/TicketReportModal';
import { formatLocalDate } from '../utils/dateFormatter';
import { InternalTaskBadge, isTicketInternalTask } from '../components/Tickets/InternalTaskBadge';
import { ticketRealHoursValid, ticketRequiresRealHoursForClosure } from '../utils/ticketAccess';
import { clCard, clInput, clTdCompact as clTd, clThCompact as clTh, clThCompactRight as clThRight, priorityPillClass } from '../utils/cleanLightUi';
import { ticketPriorityTranslations, ticketStatusTranslations } from '../utils/traslations';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { ticketLinkClickHandler, ticketRowClass, useRestoreTicketRow, useSyncListQuery } from '../utils/ticketListReturn';

// Interfaces para los datos de los filtros
interface FilterData {
    companies: Company[];
    agents: User[];
}

type ViewMode = 'table' | 'kanban';

const AdminTicketsPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [searchParams] = useSearchParams();
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>(searchParams.get('vista') === 'kanban' ? 'kanban' : 'table');
    
    // Estados para el modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    // Estados para los filtros
    const [filterData, setFilterData] = useState<FilterData>({ companies: [], agents: [] });
    const [filters, setFilters] = useState({
        companyId: searchParams.get('companyId') || '',
        agentId: searchParams.get('agentId') || '',
        status: searchParams.get('status') || '',
        priority: searchParams.get('priority') || '',
        startDate: searchParams.get('startDate') || '',
        endDate: searchParams.get('endDate') || '',
    });
    // Búsquedas de texto (con retardo para no consultar en cada tecla)
    const [searchTitle, setSearchTitle] = useState(searchParams.get('q') || '');
    const [searchClient, setSearchClient] = useState(searchParams.get('cliente') || '');
    const debouncedTitle = useDebouncedValue(searchTitle.trim(), 400);
    const debouncedClient = useDebouncedValue(searchClient.trim(), 400);

    useSyncListQuery({
        companyId: filters.companyId,
        agentId: filters.agentId,
        status: filters.status,
        priority: filters.priority,
        startDate: filters.startDate,
        endDate: filters.endDate,
        q: searchTitle,
        cliente: searchClient,
        vista: viewMode === 'kanban' ? 'kanban' : '',
    });
    const focusId = useRestoreTicketRow('/admin/tickets', !loading && tickets.length > 0);

    // Carga los datos para los dropdowns de los filtros y el modal
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [companiesRes, agentsRes, usersRes, deptsRes] = await Promise.all([
                    api.get('/api/companies'),
                    api.get('/api/users/agents'),
                    api.get('/api/users'),
                    api.get('/api/departments')
                ]);
                setFilterData({
                    companies: companiesRes.data.data || [],
                    agents: agentsRes.data.data || [],
                });
                setAllUsers(usersRes.data.data || []);
                setDepartments(deptsRes.data.data || []);
            } catch (error) {
                toast.error("No se pudieron cargar las opciones de filtro.");
            }
        };
        fetchInitialData();
    }, []);

    // Carga los tickets
    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.companyId) params.append('companyId', filters.companyId);
            
            if (filters.agentId === 'unassigned') {
                params.append('unassigned', 'true');
            } else if (filters.agentId) {
                params.append('agentId', filters.agentId);
            }
            
            if (filters.status) params.append('status', filters.status);
            if (filters.priority) params.append('priority', filters.priority);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (debouncedTitle) params.append('search', debouncedTitle);
            if (debouncedClient) params.append('clientName', debouncedClient);

            const response = await api.get(`/api/tickets?${params.toString()}`);
            setTickets(response.data.data || []);
        } catch (err) {
            toast.error("No se pudieron cargar los tickets.");
        } finally {
            setLoading(false);
        }
    }, [filters, debouncedTitle, debouncedClient]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const clearFilters = () => {
        setFilters({ companyId: '', agentId: '', status: '', priority: '', startDate: '', endDate: '' });
        setSearchTitle('');
        setSearchClient('');
    };

    const hasActiveFilters =
        Object.values(filters).some((v) => v !== '') || searchTitle.trim() !== '' || searchClient.trim() !== '';

    // Resumen de filtros para el reporte
    const reportFilters: ReportFilterChip[] = useMemo(() => {
        const companyName = filterData.companies.find((c) => String(c.id) === filters.companyId)?.name || '';
        let agentLabel = '';
        if (filters.agentId === 'unassigned') agentLabel = 'Sin asignar';
        else if (filters.agentId) {
            const a = filterData.agents.find((x) => String(x.id) === filters.agentId);
            agentLabel = a ? (a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.username) : '';
        }
        return [
            { label: 'Título', value: debouncedTitle },
            { label: 'Cliente', value: debouncedClient },
            { label: 'Empresa', value: companyName },
            { label: 'Agente', value: agentLabel },
            { label: 'Estado', value: filters.status ? ticketStatusTranslations[filters.status as TicketStatus] || filters.status : '' },
            { label: 'Prioridad', value: filters.priority ? ticketPriorityTranslations[filters.priority as keyof typeof ticketPriorityTranslations] || filters.priority : '' },
            { label: 'Desde', value: filters.startDate },
            { label: 'Hasta', value: filters.endDate },
        ];
    }, [filters, filterData, debouncedTitle, debouncedClient]);
    
    const handleUpdateTicketStatus = useCallback(
        async (ticketId: number, newStatus: TicketStatus) => {
            if (user?.role !== 'client' && (newStatus === 'resolved' || newStatus === 'closed')) {
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
            setTickets((prev) => {
                const updated = prev.map((x) => (x.id === ticketId ? { ...x, status: newStatus } : x));
                return updated;
            });
            const prevTickets = tickets;
            try {
                await api.put(`/api/tickets/${ticketId}/status`, { status: newStatus });
                toast.success('Estado actualizado correctamente.');
            } catch (err: unknown) {
                setTickets(prevTickets);
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                toast.error(msg || 'Error al actualizar el estado del ticket.');
            }
        },
        [tickets, user?.role]
    );

    const handleSaveTicket = async (ticketData: Partial<TicketData>, attachments: File[]) => {
        try {
            const formData = new FormData();
            Object.entries(ticketData).forEach(([key, value]) => {
                if (value !== null && value !== undefined) {
                    formData.append(
                        key,
                        Array.isArray(value) ? JSON.stringify(value) : String(value)
                    );
                }
            });
            attachments.forEach(file => formData.append('attachments', file));
    
            await api.post('/api/tickets', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            
            toast.success('¡Ticket creado exitosamente!');
            setIsModalOpen(false);
            fetchTickets();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al guardar el ticket.');
        }
    };

    const renderHours = (ticket: TicketData) => {
        const hasEst = ticket.horas_estimadas !== undefined && ticket.horas_estimadas !== null && ticket.horas_estimadas !== '';
        const hasReal = ticket.horas_reales !== undefined && ticket.horas_reales !== null && ticket.horas_reales !== '';
        if (!isAdmin || (!hasEst && !hasReal)) return null;
        return (
            <p className="text-xs text-gray-500 mt-1 font-normal">
                {hasEst && <>Est. {Number(ticket.horas_estimadas)} h</>}
                {hasEst && hasReal && ' · '}
                {hasReal && <>Reales {Number(ticket.horas_reales)} h</>}
            </p>
        );
    };

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0" onClick={ticketLinkClickHandler('/admin/tickets')}>
                <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight whitespace-nowrap">Panel de Tickets</h1>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex bg-gray-100/80 rounded-xl p-1 border border-gray-100">
                            <button
                                onClick={() => setViewMode('table')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                    viewMode === 'table' ? 'bg-white shadow-sm border border-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-800'
                                }`}
                                title="Vista tabla"
                            >
                                <List className="w-5 h-5" />
                                <span className="hidden sm:inline text-sm font-medium">Tabla</span>
                            </button>
                            <button
                                onClick={() => setViewMode('kanban')}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
                                    viewMode === 'kanban' ? 'bg-white shadow-sm border border-gray-100 text-gray-900' : 'text-gray-600 hover:text-gray-800'
                                }`}
                                title="Vista Kanban"
                            >
                                <LayoutGrid className="w-5 h-5" />
                                <span className="hidden sm:inline text-sm font-medium">Kanban</span>
                            </button>
                        </div>
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
                        <button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm">
                            Crear Nuevo Ticket
                        </button>
                    </div>
                </div>

                <div className={`${clCard} p-4 sm:p-5 mb-6`}>
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Filtrar Tickets</h3>
                        <span className="text-xs text-gray-500">
                            {loading ? 'Consultando…' : `${tickets.length} ${tickets.length === 1 ? 'resultado' : 'resultados'}`}
                        </span>
                    </div>

                    {/* Búsquedas de texto */}
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                        <select name="companyId" value={filters.companyId} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todas las Empresas</option>
                            {filterData.companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <select name="agentId" value={filters.agentId} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todos los Agentes</option>
                            <option value="unassigned">Sin Asignar</option>
                            {filterData.agents.map(a => (
                                <option key={a.id} value={a.id}>
                                    {a.first_name && a.last_name ? `${a.first_name} ${a.last_name}` : a.username}
                                </option>
                            ))}
                        </select>
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
                        <div className="text-center text-gray-500 py-8">No se encontraron tickets con los filtros seleccionados.</div>
                    ) : viewMode === 'kanban' ? (
                        <KanbanBoard tickets={tickets} onUpdateTicketStatus={handleUpdateTicketStatus} />
                    ) : (
                        <>
                            {/* Tabla (md y superior): ancho fijo, celdas con salto de línea, sin scroll horizontal */}
                            <table className="hidden md:table w-full table-fixed divide-y divide-gray-100">
                                <thead className="bg-gray-50/90">
                                    <tr>
                                        <th className={`${clTh} w-16`}>ID</th>
                                        <th className={clTh}>Título</th>
                                        <th className={`${clTh} w-[18%]`}>Cliente</th>
                                        <th className={`${clTh} w-[16%] hidden xl:table-cell`}>Agente</th>
                                        <th className={`${clTh} w-32 hidden xl:table-cell`}>Creación</th>
                                        <th className={`${clTh} w-32`}>Estado</th>
                                        <th className={`${clThRight} w-24`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {tickets.map(ticket => (
                                        <tr key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'hover:bg-gray-50/80 transition-colors')}>
                                            <td className={`${clTd} text-gray-900 whitespace-nowrap`}>#{ticket.id}</td>
                                            <td className={`${clTd} font-medium text-gray-900 break-words`}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span>{ticket.title}</span>
                                                    {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                                                </div>
                                                {renderHours(ticket)}
                                                {/* Datos ocultos en pantallas medianas se muestran debajo del título */}
                                                <p className="xl:hidden text-xs text-gray-500 mt-1 font-normal break-words">
                                                    {ticket.agent_names || ticket.agent_name || 'Sin asignar'}
                                                    <span className="xl:hidden"> · {formatLocalDate(ticket.created_at)}</span>
                                                </p>
                                            </td>
                                            <td className={`${clTd} break-words`}>{ticket.client_name}</td>
                                            <td className={`${clTd} break-words hidden xl:table-cell`}>{ticket.agent_names || ticket.agent_name || 'Sin Asignar'}</td>
                                            <td className={`${clTd} text-gray-600 hidden xl:table-cell`}>
                                                {formatLocalDate(ticket.created_at)}
                                            </td>
                                            <td className={clTd}>
                                                <StatusBadge status={ticket.status as TicketStatus} />
                                            </td>
                                            <td className={`${clTd} text-right`}>
                                                <Link to={`/admin/tickets/${ticket.id}`} className="text-blue-700 hover:text-blue-900 font-semibold underline-offset-2 hover:underline">Gestionar</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Tarjetas (móvil) */}
                            <div className="md:hidden space-y-3">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'rounded-xl border border-gray-100 bg-gray-50/70 p-4 min-w-0')}>
                                        <div className="flex justify-between items-start gap-2">
                                            <p className="font-bold text-gray-900 break-words min-w-0">#{ticket.id} · {ticket.title}</p>
                                            <div className="shrink-0"><StatusBadge status={ticket.status as TicketStatus} /></div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                            </span>
                                            {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                                        </div>
                                        <dl className="mt-3 text-sm text-gray-700 space-y-1">
                                            <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Cliente:</dt><dd className="break-words min-w-0">{ticket.client_name}</dd></div>
                                            <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Agente:</dt><dd className="break-words min-w-0">{ticket.agent_names || ticket.agent_name || 'Sin asignar'}</dd></div>
                                            <div className="flex gap-2"><dt className="text-gray-500 shrink-0">Creado:</dt><dd className="break-words min-w-0">{formatLocalDate(ticket.created_at)}</dd></div>
                                        </dl>
                                        {renderHours(ticket)}
                                        <div className="mt-3 pt-2 border-t border-gray-100 text-right">
                                            <Link to={`/admin/tickets/${ticket.id}`} className="text-blue-700 font-semibold hover:underline">Gestionar</Link>
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
                title="Reporte de tickets"
            />
        </>
    );
};

export default AdminTicketsPage;
