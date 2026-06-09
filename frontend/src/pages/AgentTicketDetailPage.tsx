import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
// ✅ MODIFICACIÓN: Se importa TicketPriority
import { TicketData, Comment as TicketComment, TicketStatus, User, Attachment, TicketPriority } from '../types';
import { ticketStatusTranslations, ticketPriorityTranslations } from '../utils/traslations';
import { formatLocalDate } from '../utils/dateFormatter';
import CommentForm from '../components/Common/CommentForm';
import CommentBody from '../components/Common/CommentBody';
import { isInternalComment } from '../utils/commentHtml';
import { postTicketComment } from '../utils/ticketComments';
import ContactPhoneRow from '../components/Common/ContactPhoneRow';
import TicketWorklogSidebar from '../components/Tickets/TicketWorklogSidebar';
import { staffAssignableUsers, ticketRequiresRealHoursForClosure } from '../utils/ticketAccess';
import { clCard, clInput, clModalPanel } from '../utils/cleanLightUi';

// ✅ AÑADIDO: Icono de Archivo Genérico
const FileIcon: React.FC<{ className?: string }> = ({ className = "w-16 h-16" }) => (
    <svg className={`${className} mx-auto text-gray-400 mb-2`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
    </svg>
);

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
                api.get('/api/users/agents')
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

    const agentsForReassign = useMemo(
        () => staffAssignableUsers(agents, user ?? undefined),
        [agents, user]
    );

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
            await fetchAllData(); 
        } catch (error) {
            toast.error("Error al reasignar el ticket.");
        } finally {
            setIsReassignModalOpen(false);
        }
    };

    // Maneja el envío de un nuevo comentario.
    const handleAddComment = async (commentText: string, isInternal: boolean, images: File[] = []) => {
        if (!ticket) return;
        try {
            await postTicketComment(ticket.id, commentText, isInternal, images);
            toast.success(isInternal ? 'Nota interna añadida.' : 'Comentario añadido.');
            await fetchAllData();
        } catch {
            toast.error('Error al añadir comentario.');
        }
    };

    // ✅ AÑADIDO: Función para cambiar la prioridad (para Agente)
    const handlePriorityChange = async (newPriority: TicketPriority) => {
        if (!ticket) return;
        try {
            await api.put(`/api/tickets/${ticket.id}`, { priority: newPriority });
            toast.success(`La prioridad del ticket se actualizó a "${ticketPriorityTranslations[newPriority] || newPriority}".`);
            fetchAllData(); // Recargamos los datos del ticket
        } catch (error) {
            toast.error("No se pudo actualizar la prioridad del ticket.");
        }
    };
    // FIN MODIFICACIÓN
    
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

    const showWorklogSidebar =
        (user?.role === 'admin' || user?.role === 'agent') &&
        ticketRequiresRealHoursForClosure(
            ticket.ticket_department_name ?? ticket.department_name,
            ticket.es_tarea_interna
        );

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 break-words">Ticket #{ticket.id}: {ticket.title}</h1>
                <button type="button" onClick={() => navigate(-1)} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2.5 px-5 rounded-xl shadow-sm shrink-0">Volver</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    {/* Sección de Detalles del Ticket */}
                    <div className={`${clCard} p-6`}>
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Detalles del Ticket</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            <div>
                                <strong className="block text-sm text-gray-500">Cliente</strong>
                                <p className="text-lg">{ticket.client_name}</p>
                            </div>
                            <ContactPhoneRow phone={ticket.telefono_contacto} className="text-lg" />
                            <div>
                                <strong className="block text-sm text-gray-500">Departamento</strong>
                                <p className="text-lg">{ticket.ticket_department_name || ticket.department_id}</p>
                            </div>
                            {ticket.github_repo && String(ticket.github_repo).trim() !== '' ? (
                                <div className="sm:col-span-2">
                                    <strong className="block text-sm text-gray-500">Repo GitHub</strong>
                                    <p className="text-lg font-mono break-all">{String(ticket.github_repo).trim()}</p>
                                </div>
                            ) : null}
                            <div>
                                <strong className="block text-sm text-gray-500">Creado</strong>
                                <p className="text-lg">{formatLocalDate(ticket.created_at)}</p>
                            </div>
                            <div className="sm:col-span-2">
                                <strong className="block text-sm text-gray-500">Descripción</strong>
                                <p className="whitespace-pre-wrap mt-1 p-3 bg-gray-50 rounded-md border">{ticket.description}</p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Sección de Archivos Adjuntos */}
                    {ticket.attachments && ticket.attachments.length > 0 && (
                        <div className={`${clCard} p-6`}>
                            <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Archivos Adjuntos</h2>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {ticket.attachments.map(att => (
                                    <a 
                                        key={att.id}
                                        href={`/${att.file_path.replace(/\\/g, '/')}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="border border-gray-200 rounded-xl p-2 text-center hover:bg-gray-50/80 transition-colors group bg-white"
                                        title={`Ver: ${att.file_name}`}
                                    >
                                        {att.file_type && att.file_type.startsWith('image/') ? (
                                            <img src={`/${att.file_path.replace(/\\/g, '/')}`} alt={att.file_name} className="w-full h-24 object-cover rounded-md mb-2"/>
                                        ) : att.file_type && att.file_type.startsWith('video/') ? (
                                            <div className="w-full h-24 bg-black rounded-md mb-2 flex items-center justify-center">
                                                <svg className="w-10 h-10 text-white opacity-75" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
                                                </svg>
                                            </div>
                                        ) : (
                                            <FileIcon className="w-full h-24" />
                                        )}
                                        <p className="text-sm text-gray-700 truncate group-hover:underline">
                                            {att.file_name}
                                        </p>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Sección de Conversación */}
                    <div className={`${clCard} p-6`}>
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Conversación</h2>
                        <div className="space-y-5 max-h-[60vh] overflow-y-auto pr-2">
                            {ticket.comments && ticket.comments.length > 0 ? (
                                ticket.comments.map(comment => (
                                    <div
                                        key={comment.id}
                                        className={`p-4 rounded-xl ${
                                            isInternalComment(comment)
                                                ? 'bg-slate-50 border border-slate-200/90'
                                                : 'bg-white border border-gray-100 shadow-sm'
                                        }`}
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1">
                                            <p className="text-sm font-semibold text-gray-800">{comment.username || 'Sistema'}</p>
                                            {isInternalComment(comment) && (
                                                <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full shrink-0">NOTA INTERNA</span>
                                            )}
                                        </div>
                                        <CommentBody text={comment.comment_text} className="text-gray-700" />
                                        <p className="text-xs text-gray-500 text-right mt-2">{formatLocalDate(comment.created_at)}</p>
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-gray-500 py-8">No hay comentarios aún.</p>
                            )}
                        </div>
                        
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            {user && <CommentForm onAddComment={handleAddComment} userRole={user.role} />}
                        </div>
                    </div>
                </div>

                {/* Columna Lateral de Acciones */}
                <div className="lg:col-span-1 space-y-6">
                    {showWorklogSidebar && (
                        <TicketWorklogSidebar
                            ticketId={ticket.id}
                            horasReales={ticket.horas_reales}
                            status={ticket.status}
                            departmentName={ticket.ticket_department_name ?? ticket.department_name ?? null}
                            esTareaInterna={ticket.es_tarea_interna}
                            disabled={ticket.status === 'closed'}
                            onSaved={fetchAllData}
                        />
                    )}
                    {/* ✅ MODIFICACIÓN: Se separa Estado y Prioridad, y Prioridad ahora es un <select> */}
                    <div className={`${clCard} p-6`}>
                        <h2 className="text-xl font-bold text-gray-800 mb-4 border-b border-gray-100 pb-2">Estado y Prioridad</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Estado Actual</label>
                                <div className="mt-1">
                                    <Badge color={getStatusBadgeColor(ticket.status)}>
                                        {ticketStatusTranslations[ticket.status] || ticket.status}
                                    </Badge>
                                </div>
                            </div>
                            <div>
                                <label htmlFor="priority-select" className="block text-sm font-medium text-gray-700">Prioridad</label>
                                <select 
                                    id="priority-select"
                                    value={ticket.priority}
                                    onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
                                    className={`mt-1 block w-full ${clInput}`}
                                    disabled={ticket.status === 'closed'}
                                >
                                    {Object.entries(ticketPriorityTranslations).map(([key, value]) => (
                                        <option key={key} value={key}>{value}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                    {/* FIN MODIFICACIÓN */}
                    
                    <div className={`${clCard} p-6`}>
                        <strong className="block text-sm text-gray-500 mb-2">Agente Asignado</strong>
                        <p className="text-lg font-medium">{ticket.agent_name || 'No asignado'}</p>
                    </div>
                    {(user?.role === 'admin' || user?.role === 'agent') && (
                        <div className={`${clCard} p-6`}>
                            <h3 className="text-lg font-semibold text-gray-800 mb-2 border-b border-gray-100 pb-2">Reasignar Ticket</h3>
                            <div className="flex flex-col gap-3">
                                <select 
                                    value={selectedAgentId} 
                                    onChange={(e) => setSelectedAgentId(e.target.value)} 
                                    className={`w-full ${clInput}`}
                                >
                                    <option value="">-- Selecciona un agente --</option>
                                    {agentsForReassign.map((agent) => (
                                        <option key={agent.id} value={agent.id}>
                                            {agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : agent.username}
                                        </option>
                                    ))}
                                </select>
                                <button 
                                    type="button"
                                    onClick={() => setIsReassignModalOpen(true)} 
                                    disabled={!selectedAgentId} 
                                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-4 rounded-xl disabled:bg-gray-400 shadow-sm"
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                    <div className={`${clModalPanel} max-w-md p-6`}>
                        <h3 className="text-lg font-bold text-gray-900 border-b border-gray-100 pb-2">Confirmar Reasignación</h3>
                        <p className="my-4 text-gray-700">¿Estás seguro de que quieres reasignar este ticket?</p>
                        <div className="flex justify-end gap-4 flex-wrap">
                            <button type="button" onClick={() => setIsReassignModalOpen(false)} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-5 py-2.5 rounded-xl">Cancelar</button>
                            <button type="button" onClick={handleConfirmReassign} className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-xl shadow-sm">Confirmar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AgentTicketDetailPage;

