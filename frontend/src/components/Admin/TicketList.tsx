import React, { useState, useEffect, useCallback } from 'react';
import ticketService from '../../services/ticketService';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { isAxiosErrorTypeGuard, ApiResponseError } from '../../utils/typeGuards';
import { TicketData, TicketStatus } from '../../types';
import { ticketPriorityTranslations } from '../../utils/traslations';
import { formatLocalDate } from '../../utils/dateFormatter';
import StatusBadge from '../Tickets/StatusBadge';
import { clCard, clTd, clTh, clThRight, priorityPillClass } from '../../utils/cleanLightUi';

interface TicketListProps {
    onSelectTicket: (ticketId: number) => void;
}

const TicketList: React.FC<TicketListProps> = ({ onSelectTicket }) => {
    const { token } = useAuth();
    const { addNotification } = useNotification();
    const [tickets, setTickets] = useState<TicketData[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            if (!token) {
                addNotification('Not authorized. Please log in again.', 'error');
                setLoading(false);
                return;
            }
            const data = await ticketService.getAllTickets(token);

            const statusOrder: { [key: string]: number } = {
                'open': 1, 'assigned': 2, 'in-progress': 3,
                'resolved': 4, 'closed': 5,
            };

            const sortedTickets = data.sort((a, b) => {
                const statusA = statusOrder[a.status as keyof typeof statusOrder] || 99;
                const statusB = statusOrder[b.status as keyof typeof statusOrder] || 99;
                if (statusA !== statusB) return statusA - statusB;
                return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
            });
            
            // ✅ **CORRECTION:** Ensure the data from the service is cast to the correct type.
            setTickets(sortedTickets as unknown as TicketData[]);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error loading tickets.' : 'An unexpected error occurred.';
            setError(message);
            addNotification(`Error loading tickets: ${message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [token, addNotification]);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    if (loading) return <p className="p-8 text-center text-gray-600">Loading tickets...</p>;
    if (error) return <p className="p-8 text-center text-red-500">Error: {error}</p>;

    return (
        <div className={`${clCard} p-4 sm:p-6`}>
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-4">Ticket List</h3>
            {tickets.length === 0 ? (
                <p className="text-gray-600 py-8 text-center">No tickets to display.</p>
            ) : (
                <>
                    {/* Desktop Table View */}
                    <table className="min-w-full divide-y divide-gray-100 hidden md:table">
                        <thead className="bg-gray-50/90">
                            <tr>
                                <th scope="col" className={clTh}>ID</th>
                                <th scope="col" className={clTh}>Subject</th>
                                <th scope="col" className={clTh}>Status</th>
                                <th scope="col" className={clTh}>Priority</th>
                                <th scope="col" className={clTh}>User</th>
                                <th scope="col" className={clThRight}>Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {tickets.map((ticket) => (
                                <tr key={ticket.id} className="hover:bg-gray-50/80 transition-colors">
                                    <td className={clTd}>{ticket.id}</td>
                                    <td className={clTd}>{ticket.title}</td>
                                    <td className={clTd}>
                                        <StatusBadge status={ticket.status as TicketStatus} />
                                    </td>
                                    <td className={clTd}>
                                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                            {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                        </span>
                                    </td>
                                    <td className={clTd}>{ticket.user_username || 'N/A'}</td>
                                    <td className={`${clTd} text-right`}>
                                        <button type="button" onClick={() => onSelectTicket(ticket.id)} className="text-blue-700 hover:text-blue-900 font-semibold underline-offset-2 hover:underline">
                                            View Details
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {/* Mobile Card View */}
                    <div className="md:hidden space-y-4">
                        {tickets.map((ticket) => (
                            <div key={ticket.id} className={`${clCard} p-4`}>
                                <div className="flex justify-between items-start gap-2">
                                    <span className="font-bold text-gray-900 break-all pr-2">#{ticket.id} - {ticket.title}</span>
                                    <span className="flex-shrink-0"><StatusBadge status={ticket.status as TicketStatus} /></span>
                                </div>
                                <div className="text-sm text-gray-600 mt-2 space-y-1">
                                    <p><strong>Client:</strong> {ticket.user_username || 'N/A'}</p>
                                    <p className="flex flex-wrap items-center gap-2">
                                        <strong>Priority:</strong>
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${priorityPillClass(ticket.priority)}`}>
                                            {ticketPriorityTranslations[ticket.priority]}
                                        </span>
                                    </p>
                                </div>
                                <div className="mt-4 pt-2 border-t border-gray-100 text-right">
                                    <button type="button" onClick={() => onSelectTicket(ticket.id)} className="text-blue-700 font-semibold hover:underline">
                                        View Details
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default TicketList;