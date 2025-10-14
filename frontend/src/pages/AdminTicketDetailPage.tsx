import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, TicketStatus, User } from '../types';
import { ticketStatusTranslations } from '../utils/traslations';
import { formatLocalDate } from '../utils/dateFormatter';
import CommentForm from '../components/Common/CommentForm';

// Se extiende el tipo TicketData para que TypeScript reconozca las nuevas propiedades
type DetailedTicketData = TicketData & {
    ticket_category_name?: string;
    ticket_department_name?: string;
};

const AdminTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [ticket, setTicket] = useState<DetailedTicketData | null>(null);
    const [agents, setAgents] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchTicketDetails = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [ticketRes, agentsRes] = await Promise.all([
                api.get(`/api/tickets/${id}`),
                api.get('/api/users/agents')
            ]);
            setTicket(ticketRes.data.data);
            setAgents(agentsRes.data.data);
        } catch (err) {
            setError('No se pudo cargar el ticket o no tienes permiso para verlo.');
            toast.error('Error al cargar los datos del ticket.');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchTicketDetails();
    }, [fetchTicketDetails]);

    const handleAddComment = async (commentText: string, isInternal: boolean) => {
        if (!commentText.trim() || !ticket) return;
        try {
            await api.post(`/api/tickets/${ticket.id}/comments`, {
                comment_text: commentText,
                is_internal: isInternal
            });
            toast.success("Comentario añadido exitosamente.");
            fetchTicketDetails();
        } catch (err) {
            toast.error("Error al añadir el comentario.");
        }
    };
    
    const handleStatusChange = async (newStatus: TicketStatus) => {
        if (!ticket) return;
        try {
            await api.put(`/api/tickets/${ticket.id}/status`, { status: newStatus });
            toast.success(`El estado del ticket se actualizó a "${ticketStatusTranslations[newStatus] || newStatus}".`);
            fetchTicketDetails();
        } catch (error) {
            toast.error("No se pudo actualizar el estado del ticket.");
        }
    };

    const handleReassignTicket = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const newAgentId = formData.get('agentId');
        if (!newAgentId || !ticket) return;

        try {
            await api.put(`/api/tickets/${ticket.id}/reassign`, { newAgentId });
            toast.success('Ticket reasignado exitosamente.');
            fetchTicketDetails();
        } catch (error) {
            toast.error('Error al reasignar el ticket.');
        }
    };

    if (loading) return <div className="p-8 text-center">Cargando ticket...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;
    if (!ticket) return <div className="p-8 text-center">Ticket no encontrado.</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Ticket #{ticket.id}: {ticket.title}</h1>
                <button onClick={() => navigate(-1)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg">Volver</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Izquierda: Detalles y Conversación */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Detalles del Ticket</h2>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><strong className="block text-gray-500">Cliente:</strong> {ticket.client_name}</div>
                            {/* ✅ CORRECCIÓN: Se usan las nuevas propiedades del backend */}
                            <div><strong className="block text-gray-500">Departamento:</strong> {ticket.ticket_department_name ? `${ticket.ticket_department_name} (${ticket.department_id})` : ticket.department_id}</div>
                            <div><strong className="block text-gray-500">Categoría:</strong> {ticket.ticket_category_name || 'N/A'}</div>
                            <div><strong className="block text-gray-500">Creado:</strong> {formatLocalDate(ticket.created_at)}</div>
                        </div>
                        <h3 className="text-lg font-semibold mt-6 mb-2">Descripción</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Conversación</h2>
                        <div className="space-y-4 mb-6 max-h-[60vh] overflow-y-auto pr-2">
                            {ticket.comments?.map(comment => (
                                <div key={comment.id} className={`p-4 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                                    <div className="flex justify-between items-center text-xs text-gray-500">
                                        <span className="font-bold">{comment.username || 'Sistema'}</span>
                                        <span>{formatLocalDate(comment.created_at)}</span>
                                    </div>
                                    <p className="text-gray-800 mt-2">{comment.comment_text}</p>
                                    {comment.is_internal && <span className="text-xs font-bold text-yellow-600 mt-2 block">NOTA INTERNA</span>}
                                </div>
                            ))}
                        </div>
                        {ticket.status !== 'closed' && user && <CommentForm onAddComment={handleAddComment} userRole={user.role} />}
                    </div>
                </div>

                {/* Columna Derecha: Acciones */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Estado y Prioridad</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Estado Actual</label>
                                <select 
                                    value={ticket.status}
                                    onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
                                    className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-red-500 focus:border-red-500"
                                >
                                    <option value="open">Abierto</option>
                                    <option value="in-progress">En Progreso</option>
                                    <option value="resolved">Resuelto</option>
                                    <option value="closed">Cerrado</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Prioridad</label>
                                <p className="mt-1 font-semibold">{ticket.priority}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Agente Asignado</h2>
                        <p className="font-semibold text-lg">{ticket.agent_name || 'Sin asignar'}</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Reasignar Ticket</h2>
                        <form onSubmit={handleReassignTicket}>
                            <select name="agentId" className="w-full p-2 border border-gray-300 rounded-md" defaultValue="">
                                <option value="" disabled>-- Selecciona un agente --</option>
                                {agents.map(agent => (
                                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                                ))}
                            </select>
                            <button type="submit" className="w-full bg-red-600 text-white font-bold py-2 px-4 rounded-md mt-4 hover:bg-red-700">
                                Reasignar
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminTicketDetailPage;

