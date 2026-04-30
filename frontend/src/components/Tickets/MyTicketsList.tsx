import React, { useState, useEffect, useCallback } from 'react';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { TicketData, ApiResponseError, Department, User, TicketStatus } from '../../types';
import { isAxiosErrorTypeGuard } from '../../utils/typeGuards';
import { ticketPriorityTranslations } from '../../utils/traslations';
import TicketDetailModal from './TicketDetailModal'; 
import { formatLocalDate } from '../../utils/dateFormatter';
import { InternalTaskBadge, isTicketInternalTask } from './InternalTaskBadge';
import StatusBadge from './StatusBadge';
import { clCard, clTd, clTh, clThRight, priorityPillClass } from '../../utils/cleanLightUi';

const MyTicketsList: React.FC = () => {
    const { user, token } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { addNotification } = useNotification();

    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState<TicketData | null>(null);

    const fetchClientTickets = useCallback(async () => {
        if (!token || !user) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/tickets');
            setTickets(response.data.data || []);
        } catch (err: unknown) {
            console.error('Error fetching client tickets:', err);
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar tus tickets.' : 'Ocurrió un error inesperado.';
            setError(message);
            addNotification(`Error al cargar tickets: ${message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [token, user, addNotification]);

    useEffect(() => {
        fetchClientTickets();
    }, [fetchClientTickets]);

    const handleViewDetails = (ticket: TicketData) => {
        setSelectedTicket(ticket);
        setIsDetailModalOpen(true);
    };

    const handleSaveTicketChanges = async (updatedFields: Partial<TicketData>) => {
        if (!selectedTicket || !token) return;
        try {
            await api.put(`/api/tickets/${selectedTicket.id}`, updatedFields, {
                headers: { Authorization: `Bearer ${token}` },
            });
            addNotification('Ticket actualizado exitosamente.', 'success');
            fetchClientTickets();
        } catch (err: unknown) {
            console.error('Error saving ticket changes:', err);
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al actualizar ticket.' : 'Ocurrió un error inesperado.';
            addNotification(`Error al actualizar ticket: ${message}`, 'error');
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando tus tickets...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight mb-6">Mis Tickets</h1>

                <div className={`${clCard} p-4 sm:p-6`}>
                    {tickets.length === 0 ? (
                        <p className="text-center text-gray-500 py-8">No tienes tickets registrados.</p>
                    ) : (
                        <>
                            {/* Desktop Table View */}
                            <table className="min-w-full divide-y divide-gray-100 hidden md:table">
                                <thead className="bg-gray-50/90">
                                    <tr>
                                        <th className={clTh}>ID</th>
                                        <th className={clTh}>Título</th>
                                        <th className={clTh}>Estado</th>
                                        <th className={clTh}>Prioridad</th>
                                        <th className={clTh}>Creado En</th>
                                        <th className={clThRight}>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-100">
                                    {tickets.map((ticket) => (
                                        <tr key={ticket.id} className="hover:bg-gray-50/80 transition-colors">
                                            <td className={`${clTd} whitespace-nowrap`}>{ticket.id}</td>
                                            <td className={`${clTd}`}>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="break-words">{ticket.title}</span>
                                                    {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                                                </div>
                                                {isAdmin && [ticket.horas_estimadas, ticket.horas_reales].some((h) => h !== undefined && h !== null && h !== '') && (
                                                    <p className="text-xs text-gray-500 mt-1">
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
                                            <td className={`${clTd} whitespace-nowrap`}>
                                                <StatusBadge status={ticket.status as TicketStatus} />
                                            </td>
                                            <td className={`${clTd} whitespace-nowrap`}>
                                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority]}
                                                </span>
                                            </td>
                                            <td className={`${clTd} whitespace-nowrap text-gray-600`}>{formatLocalDate(ticket.created_at)}</td>
                                            <td className={`${clTd} whitespace-nowrap text-right font-medium`}>
                                                <button
                                                    onClick={() => handleViewDetails(ticket)}
                                                    className="text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                                                    title="Ver Detalles"
                                                >
                                                    Ver Detalles
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {/* Mobile Card View */}
                            <div className="md:hidden space-y-4">
                                {tickets.map(ticket => (
                                    <div key={ticket.id} className={`${clCard} p-4`}>
                                        <div className="flex justify-between items-start gap-2">
                                            <span className="font-bold text-gray-800 break-words pr-2 flex flex-wrap items-center gap-2">
                                                #{ticket.id} - {ticket.title}
                                                {isTicketInternalTask(ticket) && <InternalTaskBadge />}
                                            </span>
                                            <span className="flex-shrink-0"><StatusBadge status={ticket.status as TicketStatus} /></span>
                                        </div>
                                        {isAdmin && [ticket.horas_estimadas, ticket.horas_reales].some((h) => h !== undefined && h !== null && h !== '') && (
                                            <p className="text-xs text-gray-500 mt-1">
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
                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                            <p className="flex flex-wrap items-center gap-2">
                                                <strong>Prioridad:</strong>
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority]}
                                                </span>
                                            </p>
                                            <p><strong>Creado:</strong> {formatLocalDate(ticket.created_at)}</p>
                                        </div>
                                        <div className="mt-4 pt-2 border-t border-gray-100 text-right">
                                            <button onClick={() => handleViewDetails(ticket)} className="text-blue-700 font-semibold hover:underline">
                                                Ver Detalles
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {/* ✅ --- CORRECCIÓN ---
                Se eliminó el paréntesis ')' extra que causaba el error de cierre.
            */}
            {isDetailModalOpen && selectedTicket && (
                <TicketDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => setIsDetailModalOpen(false)}
                    ticket={selectedTicket}
                    onSave={handleSaveTicketChanges}
                    departments={[]}
                    users={[]}
                />
            )}
        </>
    );
};

export default MyTicketsList;