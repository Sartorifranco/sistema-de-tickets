import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { ApiResponseError, AgentNote, TicketPriority, TicketStatus } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import { toast } from 'react-toastify';
import { formatLocalDate } from '../utils/dateFormatter';
import DepositariosWidget from '../components/Dashboard/DepositariosWidget';
import StatusBadge from '../components/Tickets/StatusBadge';
import { clCard, clInput, priorityPillClass } from '../utils/cleanLightUi';
import { ticketPriorityTranslations } from '../utils/traslations';
import { WorldCupDashboardBanner } from '../components/Common/WorldCupArgentinaTheme';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, Inbox, ListTodo } from 'lucide-react';

interface AgentWork {
    assignedTickets: number;
    unassignedTickets: number;
    resolvedByMe: number;
    closedToday: number;
    highPriorityActive: number;
    staleActive: number;
    byPriority: { low: number; medium: number; high: number; urgent: number };
    recent: Array<{
        id: number;
        title: string;
        client_name: string | null;
        priority: TicketPriority;
        status: TicketStatus;
        updated_at: string;
    }>;
    week: Array<{ date: string; closed: number }>;
}

const Kpi: React.FC<{ label: string; value: number | string; hint: string; tone: string; icon: React.ReactNode }> = ({ label, value, hint, tone, icon }) => (
    <div className={`${clCard} p-4 min-w-0`}>
        <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <span className={`shrink-0 rounded-lg p-1.5 ${tone}`}>{icon}</span>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-2">{value}</p>
        <p className="text-xs text-slate-500 mt-1 break-words">{hint}</p>
    </div>
);

const AgentDashboard: React.FC = () => {
    const { user, token, isAuthenticated, loading: authLoading } = useAuth();
    const { addNotification } = useNotification();
    const navigate = useNavigate();

    const [work, setWork] = useState<AgentWork | null>(null);
    const [notes, setNotes] = useState<AgentNote[]>([]);
    const [newNoteContent, setNewNoteContent] = useState('');
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [editingContent, setEditingContent] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!token || !user?.id) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const [metricsRes, notesRes] = await Promise.allSettled([
                api.get('/api/dashboard/agent'),
                api.get('/api/notes'),
            ]);

            if (metricsRes.status === 'fulfilled') {
                setWork(metricsRes.value.data.data);
            } else {
                const err = metricsRes.reason;
                if (isAxiosErrorTypeGuard(err)) {
                    const apiError = err.response?.data as ApiResponseError;
                    toast.error(apiError?.message || 'No se pudieron cargar las métricas del dashboard.');
                } else {
                    toast.error('No se pudieron cargar las métricas del dashboard.');
                }
            }

            if (notesRes.status === 'fulfilled') {
                setNotes(notesRes.value.data.data || []);
            }
        } catch {
            toast.error('Ocurrió un error inesperado al cargar los datos.');
        } finally {
            setLoading(false);
        }
    }, [token, user?.id]);

    useEffect(() => {
        if (!authLoading && isAuthenticated && user?.role === 'agent') {
            fetchData();
        } else if (!authLoading && (!isAuthenticated || user?.role !== 'agent')) {
            addNotification('Acceso denegado.', 'error');
            navigate('/login', { replace: true });
        }
    }, [authLoading, isAuthenticated, user, navigate, addNotification, fetchData]);

    const handleCreateNote = async () => {
        if (!newNoteContent.trim()) return toast.warn('La nota no puede estar vacía.');
        try {
            await api.post('/api/notes', { content: newNoteContent });
            toast.success('Nota creada con éxito.');
            setNewNoteContent('');
            fetchData();
        } catch {
            toast.error('No se pudo crear la nota.');
        }
    };

    const handleDeleteNote = async (noteId: number) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar esta nota?')) {
            try {
                await api.delete(`/api/notes/${noteId}`);
                toast.success('Nota eliminada.');
                fetchData();
            } catch {
                toast.error('No se pudo eliminar la nota.');
            }
        }
    };

    const handleUpdateNote = async (noteId: number) => {
        if (!editingContent.trim()) return toast.warn('La nota no puede estar vacía.');
        try {
            await api.put(`/api/notes/${noteId}`, { content: editingContent });
            toast.success('Nota actualizada.');
            setEditingNoteId(null);
            fetchData();
        } catch {
            toast.error('No se pudo actualizar la nota.');
        }
    };

    const startEditing = (note: AgentNote) => {
        setEditingNoteId(note.id);
        setEditingContent(note.content);
    };

    if (authLoading || loading) {
        return <div className="flex justify-center items-center h-64"><span className="text-lg text-slate-600">Cargando dashboard...</span></div>;
    }

    const priority = work?.byPriority || { low: 0, medium: 0, high: 0, urgent: 0 };
    const priorityTotal = priority.urgent + priority.high + priority.medium + priority.low || 1;
    const week = (work?.week || []).map((d) => ({
        ...d,
        label: d.date.slice(8, 10) + '/' + d.date.slice(5, 7),
    }));
    const closedWeek = week.reduce((sum, d) => sum + d.closed, 0);

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
            <WorldCupDashboardBanner pageTitle="Dashboard de Agente" userName={user?.username} />
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dashboard de Agente</h1>
                    <p className="text-sm text-slate-500 mt-1">Lo que tenés para atender ahora. El historial completo está en Mis Tickets.</p>
                </div>
                <Link to="/agent/tickets" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm shrink-0">
                    Ir a mis tickets <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-4">
                <Kpi label="Por atender" value={work?.assignedTickets ?? 0} hint="Abiertos o en progreso" tone="bg-indigo-50 text-indigo-600" icon={<ListTodo className="w-4 h-4" />} />
                <Kpi label="Sin asignar" value={work?.unassignedTickets ?? 0} hint="Cola general abierta" tone="bg-amber-50 text-amber-600" icon={<Inbox className="w-4 h-4" />} />
                <Kpi label="Alta / urgente" value={work?.highPriorityActive ?? 0} hint="Entre los tuyos, activos" tone="bg-red-50 text-red-600" icon={<AlertTriangle className="w-4 h-4" />} />
                <Kpi label="Estancados" value={work?.staleActive ?? 0} hint="Sin movimiento +3 días" tone="bg-orange-50 text-orange-600" icon={<Clock className="w-4 h-4" />} />
                <Kpi label="Cerrados hoy" value={work?.closedToday ?? 0} hint="Resueltos o cerrados" tone="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 className="w-4 h-4" />} />
                <Kpi label="Cerrados 30 días" value={work?.resolvedByMe ?? 0} hint="Tu producción del mes" tone="bg-slate-100 text-slate-600" icon={<CheckCircle2 className="w-4 h-4" />} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                <DepositariosWidget />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6 mb-6">
                <section className={`${clCard} p-4 sm:p-6 xl:col-span-3 min-w-0`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Para atender ahora</h2>
                            <p className="text-xs text-slate-500">Hasta 6 activos, primero los urgentes y los más quietos.</p>
                        </div>
                        <Link to="/agent/tickets" className="text-sm font-semibold text-red-600 hover:underline shrink-0">Ver todos</Link>
                    </div>
                    {(work?.recent || []).length === 0 ? (
                        <p className="text-slate-500 text-sm py-10 text-center">No tenés tickets activos. La cola sin asignar tiene {work?.unassignedTickets ?? 0}.</p>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {work!.recent.map((ticket) => (
                                <li key={ticket.id}>
                                    <button type="button" onClick={() => navigate(`/agent/tickets/${ticket.id}`)} className="w-full text-left py-3 flex items-start gap-3 hover:bg-slate-50 rounded-lg px-1 min-w-0">
                                        <span className="text-sm font-semibold text-slate-400 shrink-0 pt-0.5">#{ticket.id}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-900 break-words">{ticket.title}</span>
                                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                                <span className="break-words">{ticket.client_name || 'Sin cliente'}</span>
                                                <StatusBadge status={ticket.status} />
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                                </span>
                                                <span>{formatLocalDate(ticket.updated_at)}</span>
                                            </span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </section>

                <section className={`${clCard} p-4 sm:p-6 xl:col-span-2 min-w-0`}>
                    <h2 className="text-lg font-bold text-slate-900">Tu semana</h2>
                    <p className="text-xs text-slate-500 mb-3">{closedWeek} tickets cerrados en los últimos 7 días</p>
                    <div className="h-40 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={week} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} width={28} />
                                <Tooltip cursor={{ fill: '#f1f5f9' }} formatter={(value) => [Number(value), 'Cerrados']} />
                                <Bar dataKey="closed" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Activos por prioridad</p>
                        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div className="bg-red-600" style={{ width: `${(priority.urgent / priorityTotal) * 100}%` }} />
                            <div className="bg-orange-500" style={{ width: `${(priority.high / priorityTotal) * 100}%` }} />
                            <div className="bg-amber-400" style={{ width: `${(priority.medium / priorityTotal) * 100}%` }} />
                            <div className="bg-slate-300" style={{ width: `${(priority.low / priorityTotal) * 100}%` }} />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                            <span>Urgente {priority.urgent}</span>
                            <span>Alta {priority.high}</span>
                            <span>Media {priority.medium}</span>
                            <span>Baja {priority.low}</span>
                        </div>
                    </div>
                </section>
            </div>

            <div id="quick-notes" className={`${clCard} p-4 sm:p-6`}>
                <h2 className="text-lg font-bold text-slate-900 mb-3">Mis notas rápidas</h2>
                <textarea
                    className={`w-full ${clInput} min-h-[5rem] resize-y`}
                    placeholder="Escribe una nueva nota aquí..."
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                />
                <button type="button" onClick={handleCreateNote} className="mt-3 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm">
                    Añadir nota
                </button>
                <div className="mt-4 border-t border-gray-100 pt-3 space-y-3 max-h-72 overflow-y-auto">
                    {notes.length > 0 ? notes.map((note) => (
                        <div key={note.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            {editingNoteId === note.id ? (
                                <>
                                    <textarea value={editingContent} onChange={(e) => setEditingContent(e.target.value)} className={`w-full ${clInput} min-h-[5rem]`} />
                                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                                        <button type="button" onClick={() => handleUpdateNote(note.id)} className="text-sm bg-red-600 text-white py-2 px-4 rounded-xl hover:bg-red-700 font-semibold">Guardar</button>
                                        <button type="button" onClick={() => setEditingNoteId(null)} className="text-sm bg-gray-200 text-gray-700 py-2 px-4 rounded-xl hover:bg-gray-300 font-medium">Cancelar</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-gray-800 whitespace-pre-wrap break-words">{note.content}</p>
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mt-2 gap-2">
                                        <p className="text-xs text-gray-400">Actualizado: {formatLocalDate(note.updated_at)}</p>
                                        <div className="flex items-center gap-4">
                                            <button type="button" onClick={() => startEditing(note)} className="text-sm text-blue-600 hover:underline">Editar</button>
                                            <button type="button" onClick={() => handleDeleteNote(note.id)} className="text-sm text-red-600 hover:underline">Eliminar</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )) : (
                        <p className="text-center text-gray-500 text-sm py-4">No tienes notas guardadas.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AgentDashboard;
