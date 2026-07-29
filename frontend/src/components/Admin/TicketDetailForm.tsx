import React, { useState, useEffect, useCallback, useMemo } from 'react';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { TicketData, Comment as TicketComment, User, Department, TicketStatus, TicketPriority } from '../../types';
import { isAxiosErrorTypeGuard, ApiResponseError } from '../../utils/typeGuards';
import { formatLocalDate } from '../../utils/dateFormatter';
import { ticketPriorityTranslations, ticketStatusTranslations } from '../../utils/traslations';
import { staffAssignableUsers } from '../../utils/ticketAccess';
import CommentForm from '../Common/CommentForm';
import CommentBody from '../Common/CommentBody';
import { isInternalComment } from '../../utils/commentHtml';
import { postTicketComment } from '../../utils/ticketComments';

interface TicketDetailFormProps {
    ticket: TicketData;
    onSave: (updatedTicket: Partial<TicketData>) => void;
    onCancel: () => void;
    token: string | null;
    departments: Department[];
    users: User[];
}

const TicketDetailForm: React.FC<TicketDetailFormProps> = ({ ticket, onSave, onCancel, token, departments, users }) => {
    const { user: currentUser } = useAuth();
    const { addNotification } = useNotification();

    const [formData, setFormData] = useState<Partial<TicketData>>(ticket);
    const [comments, setComments] = useState<TicketComment[]>([]);
    const [loading, setLoading] = useState(false);

    const assignableForTicket = useMemo(
        () => staffAssignableUsers(users, currentUser ?? undefined),
        [users, currentUser]
    );

    useEffect(() => {
        const assigneeIds =
            ticket.assignees?.length
                ? ticket.assignees.map((a) => a.id)
                : ticket.assigned_to_user_id
                  ? [ticket.assigned_to_user_id]
                  : [];
        setFormData({
            ...ticket,
            assigned_to_user_ids: assigneeIds,
            assigned_to_user_id: assigneeIds[0] ?? null,
        });
    }, [ticket]);

    const fetchComments = useCallback(async () => {
        if (!token) return;
        try {
            const response = await api.get(`/api/tickets/${ticket.id}/comments`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setComments(response.data.data || []);
        } catch (error) {
            addNotification('Failed to load comments.', 'error');
        }
    }, [ticket.id, token, addNotification]);

    useEffect(() => {
        fetchComments();
    }, [fetchComments]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const isNumeric = ['department_id', 'assigned_to_user_id'].includes(name);
        setFormData(prev => ({
            ...prev,
            [name]: isNumeric ? (value ? parseInt(value, 10) : null) : value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        const updatedFields: Partial<TicketData> = {};
        // Logic to find and add only changed fields to updatedFields
        Object.keys(formData).forEach(key => {
            const formKey = key as keyof TicketData;
            if (formData[formKey] !== ticket[formKey]) {
                updatedFields[formKey] = formData[formKey] as any;
            }
        });

        if (Object.keys(updatedFields).length > 0) {
            onSave(updatedFields);
        } else {
            addNotification('No changes detected.', 'info');
        }
        setLoading(false);
    };
    
    const handleAddComment = async (commentText: string, isInternal: boolean, images: File[] = []) => {
        try {
            await postTicketComment(ticket.id, commentText, isInternal, images);
            addNotification('Comentario añadido.', 'success');
            fetchComments();
        } catch {
            addNotification('Error al añadir comentario.', 'error');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="p-4 bg-white rounded-lg shadow-md">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4">Editar Ticket #{ticket.id}</h2>
            
            <div className="space-y-4">
                {/* Responsive grid for main details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium">Título</label>
                        <input type="text" name="title" value={formData.title || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Estado</label>
                        <select name="status" value={formData.status || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                            {Object.entries(ticketStatusTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium">Prioridad</label>
                        <select name="priority" value={formData.priority || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                            {Object.entries(ticketPriorityTranslations).map(([key, value]) => <option key={key} value={key}>{value}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Departamento</label>
                        <select name="department_id" value={formData.department_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1">
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium">Agentes asignados</label>
                        <div className="w-full p-2 border rounded mt-1 max-h-36 overflow-y-auto space-y-1">
                            {assignableForTicket.map((agent) => {
                                const ids = formData.assigned_to_user_ids?.length
                                    ? formData.assigned_to_user_ids
                                    : formData.assigned_to_user_id
                                      ? [formData.assigned_to_user_id]
                                      : [];
                                const checked = ids.includes(agent.id);
                                const label =
                                    agent.first_name && agent.last_name
                                        ? `${agent.first_name} ${agent.last_name}`
                                        : agent.username;
                                return (
                                    <label key={agent.id} className="flex items-center gap-2 text-sm cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => {
                                                const current = formData.assigned_to_user_ids?.length
                                                    ? [...formData.assigned_to_user_ids]
                                                    : formData.assigned_to_user_id
                                                      ? [formData.assigned_to_user_id]
                                                      : [];
                                                const next = checked
                                                    ? current.filter((id) => id !== agent.id)
                                                    : [...current, agent.id];
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    assigned_to_user_ids: next,
                                                    assigned_to_user_id: next[0] ?? null,
                                                }));
                                            }}
                                        />
                                        <span>
                                            {label}
                                            {checked && ids[0] === agent.id ? ' — responsable' : ''}
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium">Descripción</label>
                    <textarea name="description" value={formData.description || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1 h-24"></textarea>
                </div>

                {/* Comments Section */}
                <div className="pt-4 border-t">
                    <h3 className="text-lg font-semibold">Comentarios</h3>
                    <div className="max-h-48 overflow-y-auto my-2 space-y-2 bg-gray-50 p-2 rounded">
                        {comments.length > 0 ? comments.map(comment => (
                            <div key={comment.id} className={`text-sm bg-white p-2 rounded border ${isInternalComment(comment) ? 'border-l-4 border-amber-400' : ''}`}>
                                <p className="font-bold">
                                    {comment.user_username || comment.username}
                                    {isInternalComment(comment) && (
                                        <span className="ml-2 text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">NOTA INTERNA</span>
                                    )}
                                </p>
                                <CommentBody text={comment.comment_text} />
                                <p className="text-xs text-gray-400 text-right">{formatLocalDate(comment.created_at)}</p>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-500 text-center py-4">No hay comentarios aún.</p>
                        )}
                    </div>
                    {currentUser && (
                        <div className="mt-2">
                            <CommentForm onAddComment={handleAddComment} userRole={currentUser.role} />
                        </div>
                    )}
                </div>
            </div>

            <div className="flex justify-end gap-4 mt-6 pt-4 border-t">
                <button type="button" onClick={onCancel} className="bg-gray-200 hover:bg-gray-300 font-bold py-2 px-4 rounded" disabled={loading}>Cancelar</button>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" disabled={loading}>
                    {loading ? 'Guardando...' : 'Guardar Cambios'}
                </button>
            </div>
        </form>
    );
};

export default TicketDetailForm;