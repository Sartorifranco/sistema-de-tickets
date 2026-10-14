// ClientTicketsPage.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Search, BarChart3, X } from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, Department, TicketStatus } from '../types';
import { ticketStatusTranslations, ticketPriorityTranslations } from '../utils/traslations';
import TicketFormModal from '../components/Tickets/TicketFormModal';
import StatusBadge from '../components/Tickets/StatusBadge';
import TicketReportModal, { ReportFilterChip } from '../components/Tickets/TicketReportModal';
import { clCard, clInput, clTdCompact as clTd, clThCompact as clTh, clThCompactRight as clThRight, priorityPillClass } from '../utils/cleanLightUi';
import { formatLocalDate } from '../utils/dateFormatter';
import { useDebouncedValue } from '../utils/useDebouncedValue';
import { toastTicketCreated } from '../utils/ticketCreatedToast';
import { AuthorizationPill } from '../components/Tickets/TicketAuthorizationBanner';
import { ticketLinkClickHandler, ticketRowClass, useRestoreTicketRow, useSyncListQuery } from '../utils/ticketListReturn';

const ClientTicketsPage: React.FC = () => {
    const { user } = useAuth();
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);

    const [searchParams] = useSearchParams();
    const [filters, setFilters] = useState({
        status: searchParams.get('status') || '',
        startDate: searchParams.get('startDate') || '',
        endDate: searchParams.get('endDate') || '',
    });
    const [searchTitle, setSearchTitle] = useState(searchParams.get('q') || '');
    const debouncedTitle = useDebouncedValue(searchTitle.trim(), 400);

    useSyncListQuery({
        status: filters.status,
        startDate: filters.startDate,
        endDate: filters.endDate,
        q: searchTitle,
    });
    const focusId = useRestoreTicketRow('/client/tickets', !loading && tickets.length > 0);

    const fetchPageData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filters.status) params.append('status', filters.status);
            if (filters.startDate) params.append('startDate', filters.startDate);
            if (filters.endDate) params.append('endDate', filters.endDate);
            if (debouncedTitle) params.append('search', debouncedTitle);

            const [ticketsRes, deptsRes] = await Promise.all([
                api.get(`/api/tickets?${params.toString()}`),
                api.get('/api/departments')
            ]);
            
            setTickets(ticketsRes.data.data || []);
            setDepartments(deptsRes.data.data || []);
        } catch (err) {
            toast.error("No se pudieron cargar los datos.");
        } finally {
            setLoading(false);
        }
    }, [user, filters, debouncedTitle]);

    useEffect(() => {
        fetchPageData();
    }, [fetchPageData]);

    const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const clearFilters = () => {
        setFilters({ status: '', startDate: '', endDate: '' });
        setSearchTitle('');
    };

    const hasActiveFilters = Object.values(filters).some((v) => v !== '') || searchTitle.trim() !== '';

    const reportFilters: ReportFilterChip[] = useMemo(
        () => [
            { label: 'Título', value: debouncedTitle },
            { label: 'Estado', value: filters.status ? ticketStatusTranslations[filters.status as TicketStatus] || filters.status : '' },
            { label: 'Desde', value: filters.startDate },
            { label: 'Hasta', value: filters.endDate },
        ],
        [filters, debouncedTitle]
    );

    const handleSaveTicket = async (ticketData: Partial<TicketData>, attachments: File[]) => {
        try {
            const formData = new FormData();
            Object.entries(ticketData).forEach(([key, value]) => {
                if (value !== null && value !== undefined) formData.append(key, String(value));
            });
            attachments.forEach(file => formData.append('attachments', file));
            
            const res = await api.post('/api/tickets', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
            toastTicketCreated(res.data);
            setIsModalOpen(false);
            fetchPageData();
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Error al guardar el ticket.');
        }
    };

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0" onClick={ticketLinkClickHandler('/client/tickets')}>
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Mis Tickets</h1>
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

                <div className={`${clCard} p-4 sm:p-5 mb-6`}>
                    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                        <h3 className="font-semibold text-sm uppercase tracking-wide text-gray-500">Filtrar Mis Tickets</h3>
                        <span className="text-xs text-gray-500">
                            {loading ? 'Consultando…' : `${tickets.length} ${tickets.length === 1 ? 'resultado' : 'resultados'}`}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
                        <label className="relative block sm:col-span-2 xl:col-span-3">
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
                        <select name="status" value={filters.status} onChange={handleFilterChange} className={clInput}>
                            <option value="">Todos los Estados</option>
                            <option value="open">Abierto</option>
                            <option value="in-progress">En Progreso</option>
                            <option value="resolved">Resuelto</option>
                            <option value="closed">Cerrado</option>
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
                         <div className="text-center py-8">Cargando tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                            <p className="text-lg">No has creado ningún ticket todavía o no hay tickets que coincidan con los filtros.</p>
                        </div>
                    ) : (
                        <>
                            {/* VISTA DE TABLA PARA ESCRITORIO (sin scroll horizontal) */}
                            <table className="hidden md:table w-full table-fixed divide-y divide-gray-100">
                                <thead className="bg-gray-50/90">
                                    <tr>
                                        <th className={`${clTh} w-16`}>ID</th>
                                        <th className={clTh}>Título</th>
                                        <th className={`${clTh} w-[15%] hidden lg:table-cell`}>Creación</th>
                                        <th className={`${clTh} w-[14%]`}>Estado</th>
                                        <th className={`${clTh} w-[12%]`}>Prioridad</th>
                                        <th className={`${clThRight} w-28`}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {tickets.map(ticket => (
                                        <tr key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'hover:bg-gray-50/80 transition-colors')}>
                                            <td className={clTd}>#{ticket.id}</td>
                                            <td className={`${clTd} font-medium text-gray-900`}>
                                                {ticket.title}
                                                {ticket.authorization_status && (
                                                    <span className="ml-2 align-middle">
                                                        <AuthorizationPill status={ticket.authorization_status} />
                                                    </span>
                                                )}
                                                <p className="text-xs text-gray-500 mt-1 font-normal lg:hidden">{formatLocalDate(ticket.created_at)}</p>
                                            </td>
                                            <td className={`${clTd} text-gray-600 hidden lg:table-cell`}>{formatLocalDate(ticket.created_at)}</td>
                                            <td className={clTd}>
                                                <StatusBadge status={ticket.status as TicketStatus} />
                                            </td>
                                            <td className={clTd}>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                                </span>
                                            </td>
                                            <td className={`${clTd} text-right font-medium`}>
                                                <Link to={`/client/tickets/${ticket.id}`} className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline">Ver Detalles</Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* VISTA DE TARJETAS PARA MÓVIL */}
                            <div className="md:hidden space-y-4">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} data-ticket-id={ticket.id} className={ticketRowClass(focusId, ticket.id, 'rounded-xl border border-gray-100 bg-gray-50/70 p-4 min-w-0')}>
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="font-bold text-gray-900 break-words min-w-0">
                                                #{ticket.id} · {ticket.title}
                                                {ticket.authorization_status && (
                                                    <span className="ml-2 align-middle">
                                                        <AuthorizationPill status={ticket.authorization_status} />
                                                    </span>
                                                )}
                                            </span>
                                            <div className="flex-shrink-0">
                                                <StatusBadge status={ticket.status as TicketStatus} />
                                            </div>
                                        </div>
                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                            <p className="flex flex-wrap items-center gap-2">
                                                <strong>Prioridad:</strong>
                                                <span className={`inline-flex items-center px-3 py-0.5 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                                </span>
                                            </p>
                                            <p><strong>Creado:</strong> {formatLocalDate(ticket.created_at)}</p>
                                        </div>
                                        <div className="mt-4 pt-2 border-t border-gray-100 text-right">
                                            <Link to={`/client/tickets/${ticket.id}`} className="text-blue-700 font-semibold hover:underline">Ver Detalles</Link>
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
                    users={user ? [user] : []} 
                    currentUserRole={user.role}
                />
            )}

            <TicketReportModal
                isOpen={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                tickets={tickets}
                filters={reportFilters}
                title="Reporte de mis tickets"
                hideClientBreakdown
            />
        </>
    );
};

export default ClientTicketsPage;
