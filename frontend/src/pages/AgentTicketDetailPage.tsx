import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketData, Comment as TicketComment, TicketStatus, User } from '../types';
import { ticketStatusTranslations, ticketPriorityTranslations } from '../utils/traslations';
import { formatLocalDate } from '../utils/dateFormatter';
import CommentForm from '../components/Common/CommentForm';

// Componente Badge local para simplicidad visual.
const Badge: React.FC<{ color: string; children: React.ReactNode }> = ({ color, children }) => (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${color}`}>
        {children}
    </span>
);

const AgentTicketDetailPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [ticket, setTicket] = useState<TicketData | null>(null);
    const [agents, setAgents] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedAgentId, setSelectedAgentId] = useState<string>('');
    const [isReassignModalOpen, setIsReassignModalOpen] = useState(false);

    // Carga todos los datos necesarios para la página (ticket y agentes) en una sola llamada.
    const fetchAllData = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [ticketResponse, agentsResponse] = await Promise.all([
                api.get(`/api/tickets/${id}`),
                api.get('/api/users/agents') // Endpoint que devuelve la lista de usuarios con rol 'agent'.
            ]);
            setTicket(ticketResponse.data.data);
            setAgents(agentsResponse.data.data || []);
        } catch (error) {
            toast.error("Error al cargar los datos de la página.");
            console.error("Fetch All Data Error:", error);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    // Maneja la confirmación para reasignar el ticket a un nuevo agente.
    const handleConfirmReassign = async () => {
        if (!selectedAgentId || !ticket) {
            toast.warn("Por favor, selecciona un agente.");
            return;
        }
        try {
            await api.put(`/api/tickets/${ticket.id}/reassign`, { newAgentId: selectedAgentId });
            toast.success("¡Ticket reasignado exitosamente!");
            setSelectedAgentId('');
            await fetchAllData(); // Recarga los datos para reflejar el cambio.
        } catch (error) {
            toast.error("Error al reasignar el ticket.");
        } finally {
            setIsReassignModalOpen(false);
        }
    };

    // Maneja el envío de un nuevo comentario.
    const handleAddComment = async (commentText: string, isInternal: boolean) => {
        if (!commentText.trim() || !ticket) return;
        try {
            await api.post(`/api/tickets/${ticket.id}/comments`, {
                comment_text: commentText,
                is_internal: isInternal
            });
            toast.success(isInternal ? "Nota interna añadida." : "Comentario añadido.");
            await fetchAllData(); // Recarga los datos para mostrar el nuevo comentario.
        } catch (err) {
            toast.error("Error al añadir comentario.");
        }
    };
    
    // Funciones auxiliares para estilos...
    const getStatusBadgeColor = (status: TicketStatus) => {
        switch (status) {
            case 'open': return 'bg-blue-100 text-blue-800';
            case 'in-progress': return 'bg-yellow-100 text-yellow-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-200 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) return <div className="p-8 text-center text-lg">Cargando detalles del ticket...</div>;
    if (!ticket) return <div className="p-8 text-center text-lg">Ticket no encontrado.</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Ticket #{ticket.id}: {ticket.title}</h1>
                <button onClick={() => navigate(-1)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg">Volver</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Sección de Detalles del Ticket */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Detalles del Ticket</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <strong className="block text-sm text-gray-500">Cliente</strong>
                                <p className="text-lg">{ticket.client_name}</p>
                            </div>
                            <div>
                                <strong className="block text-sm text-gray-500">Departamento</strong>
                                <p className="text-lg">{ticket.department_id}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <strong className="block text-sm text-gray-500">Descripción</strong>
                                <p className="whitespace-pre-wrap mt-1 p-3 bg-gray-50 rounded-md border">{ticket.description}</p>
                            </div>
                        </div>
                    </div>

                    {/* Sección de Conversación */}
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2">Conversación</h2>
                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                            {ticket.comments && ticket.comments.length > 0 ? (
                                ticket.comments.map(comment => (
                                    <div key={comment.id} className={`p-3 rounded-lg shadow-sm border ${comment.is_internal ? 'bg-yellow-50 border-yellow-200' : 'bg-white'}`}>
                                        <div className="flex justify-between items-center mb-1">
                                            <p className="text-sm font-semibold text-gray-800">{comment.username}</p>
                                            {comment.is_internal && (
                                                <span className="text-xs font-bold bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full">NOTA INTERNA</span>
                                            )}
                                        </div>
                                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.comment_text}</p>
                                        <p className="text-xs text-gray-500 text-right mt-2">{formatLocalDate(comment.created_at)}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-8">No hay comentarios aún.</p>
                            )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t">
                            {user && <CommentForm onAddComment={handleAddComment} userRole={user.role} />}
                        </div>
                    </div>
                </div>

                {/* Columna Lateral de Acciones */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <strong className="block text-sm text-gray-500 mb-2">Estado y Prioridad</strong>
                        <div className="flex items-center gap-4">
                            <Badge color={getStatusBadgeColor(ticket.status)}>
                                {ticketStatusTranslations[ticket.status] || ticket.status}
                            </Badge>
                            <span className="font-semibold">{ticketPriorityTranslations[ticket.priority] || ticket.priority}</span>
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow-md">
                        <strong className="block text-sm text-gray-500 mb-2">Agente Asignado</strong>
                        <p className="text-lg font-medium">{ticket.agent_name || 'No asignado'}</p>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'agent') && (
                        <div className="bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Reasignar Ticket</h3>
                            <div className="flex flex-col gap-3">
                                <select 
                                    value={selectedAgentId} 
                                    onChange={(e) => setSelectedAgentId(e.target.value)} 
                                    className="w-full p-2 border rounded-md bg-white"
                                >
                                    <option value="">-- Selecciona un agente --</option>
                                    {agents.map(agent => (
                                        <option key={agent.id} value={agent.id}>{agent.username}</option>
                                    ))}
                                </select>
                                <button 
                                    onClick={() => setIsReassignModalOpen(true)} 
                                    disabled={!selectedAgentId} 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-400"
                                >
                                    Reasignar
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Confirmación para Reasignar */}
            {isReassignModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
                    <div className="bg-white p-6 rounded-lg shadow-xl">
                        <h3 className="text-lg font-bold">Confirmar Reasignación</h3>
                        <p className="my-4">¿Estás seguro de que quieres reasignar este ticket?</p>
                        <div className="flex justify-end gap-4">
                            <button onClick={() => setIsReassignModalOpen(false)} className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg">Cancelar</button>
                            <button onClick={handleConfirmReassign} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentTicketDetailPage;

