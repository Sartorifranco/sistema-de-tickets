import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { LayoutGrid, List } from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, User, Department, Company, TicketStatus } from '../types';
import TicketFormModal from '../components/Tickets/TicketFormModal';
import StatusBadge from '../components/Tickets/StatusBadge';
import KanbanBoard from '../components/Tickets/KanbanBoard';
import { formatLocalDate } from '../utils/dateFormatter';
import { InternalTaskBadge, isTicketInternalTask } from '../components/Tickets/InternalTaskBadge';
import { ticketRealHoursValid, ticketRequiresRealHoursForClosure } from '../utils/ticketAccess';
import { clCard, clInput, clTd, clTh, clThRight } from '../utils/cleanLightUi';

// Interfaces para los datos de los filtros
interface FilterData {
    companies: Company[];
    agents: User[];
}

type ViewMode = 'table' | 'kanban';

const AdminTicketsPage: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>('table');
    
    // Estados para el modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);

    // Estados para los filtros
    const [filterData, setFilterData] = useState<FilterData>({ companies: [], agents: [] });
    const [filters, setFilters] = useState({
        companyId: '',
        agentId: '',
        status: '',
        priority: '', // ✅ AÑADIDO: Estado para el filtro de prioridad
        startDate: '',
        endDate: '',
    });

    // Carga los datos para los dropdowns de los filtros y el modal
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [companiesRes, agentsRes, usersRes, deptsRes] = await Promise.all([
                    api.get('/api/companies'),
                    api.get('/api/users/agents'), // Asumimos que esto devuelve first_name y last_name
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
            if (filters.priority) params.append('priority', filters.priority); // ✅ AÑADIDO: Enviar filtro al backend
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);

            const response = await api.get(`/api/tickets?${params.toString()}`);
            setTickets(response.data.data || []);
        } catch (err) {
            toast.error("No se pudieron cargar los tickets.");
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };
    
    const clearFilters = () => {
        // ✅ MODIFICACIÓN: Resetear también prioridad
        setFilters({ companyId: '', agentId: '', status: '', priority: '', startDate: '', endDate: '' });
    };
    
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

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Panel de Tickets</h1>
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
                        <button onClick={() => setIsModalOpen(true)} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm">
                            Crear Nuevo Ticket
                        </button>
                    </div>
                </div>

                <div className={`${clCard} p-4 sm:p-5 mb-6`}>
                    <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide text-gray-500">Filtrar Tickets</h3>
                    {/* ✅ MODIFICACIÓN: Se cambia lg:grid-cols-6 a lg:grid-cols-7 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 items-end">
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
                        {/* ✅ AÑADIDO: Dropdown de Prioridad */}
                        <select name="priority" value={filters.priority} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todas las Prioridades</option>
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                        </select>
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className={clInput} />
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className={clInput} />
                        <button onClick={clearFilters} className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200/80">Limpiar</button>
                    </div>
                </div>

                <div className={`${clCard} p-4 sm:p-6 overflow-x-auto`}>
                    {loading ? (
                        <div className="text-center py-8 text-gray-600">Cargando tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">No se encontraron tickets con los filtros seleccionados.</div>
                    ) : viewMode === 'kanban' ? (
                        <KanbanBoard tickets={tickets} onUpdateTicketStatus={handleUpdateTicketStatus} />
                    ) : (
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/90">
                                <tr>
                                    <th className={clTh}>ID</th>
                                    <th className={clTh}>Cliente</th>
                                    <th className={clTh}>Título</th>
                                    <th className={clTh}>Agente Asignado</th>
                                    <th className={clTh}>Fecha Creación</th>
                                    <th className={clTh}>Estado</th>
                                    <th className={clThRight}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {tickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className={`${clTd} whitespace-nowrap text-gray-900`}>{ticket.id}</td>
                                        <td className={`${clTd} whitespace-nowrap`}>{ticket.client_name}</td>
                                        <td className={`${clTd} font-medium text-gray-900`}>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span>{ticket.title}</span>
                                                {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                                            </div>
                                            {isAdmin && [ticket.horas_estimadas, ticket.horas_reales].some((h) => h !== undefined && h !== null && h !== '') && (
                                                <p className="text-xs text-gray-500 mt-1 font-normal">
                                                    {ticket.horas_estimadas !== undefined && ticket.horas_estimadas !== null && ticket.horas_estimadas !== '' && (
                                                        <>Est. {Number(ticket.horas_estimadas)} h</>
                                                    )}
                                                    {ticket.horas_estimadas !== undefined && ticket.horas_estimadas !== null && ticket.horas_estimadas !== '' &&
                                                        ticket.horas_reales !== undefined && ticket.horas_reales !== null && ticket.horas_reales !== '' &&
                                                        ' · '}
                                                    {ticket.horas_reales !== undefined && ticket.horas_reales !== null && ticket.horas_reales !== '' && (
                                                        <>Reales {Number(ticket.horas_reales)} h</>
                                                    )}
                                                </p>
                                            )}
                                        </td>
                                        <td className={`${clTd} whitespace-nowrap`}>{ticket.agent_names || ticket.agent_name || 'Sin Asignar'}</td>
                                        <td className={`${clTd} whitespace-nowrap text-gray-600`}>
                                            {formatLocalDate(ticket.created_at)}
                                        </td>
                                        <td className={`${clTd} whitespace-nowrap`}>
                                            <StatusBadge status={ticket.status as TicketStatus} />
                                        </td>
                                        <td className={`${clTd} whitespace-nowrap text-right`}>
                                            <Link to={`/admin/tickets/${ticket.id}`} className="text-blue-700 hover:text-blue-900 font-semibold underline-offset-2 hover:underline">Gestionar</Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
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
        </>
    );
};

export default AdminTicketsPage;