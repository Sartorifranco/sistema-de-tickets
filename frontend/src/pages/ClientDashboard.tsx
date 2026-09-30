import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { Link, useNavigate } from 'react-router-dom';
import { TicketPriority, TicketStatus } from '../types';
import StatusBadge from '../components/Tickets/StatusBadge';
import { clCard, priorityPillClass } from '../utils/cleanLightUi';
import { ticketPriorityTranslations } from '../utils/traslations';
import { formatLocalDate } from '../utils/dateFormatter';
import { WorldCupDashboardBanner } from '../components/Common/WorldCupArgentinaTheme';
import { ArrowRight, CheckCircle2, Clock, Hourglass, Ticket } from 'lucide-react';

interface ClientWork {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
    resolved30d: number;
    oldestWaitingDays: number | null;
    recent: Array<{
        id: number;
        title: string;
        status: TicketStatus;
        priority: TicketPriority;
        updated_at: string;
        agent_name: string | null;
    }>;
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

const ClientDashboard: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [work, setWork] = useState<ClientWork | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/dashboard/client');
            setWork(response.data.data);
        } catch (err) {
            setError('No se pudieron cargar las estadísticas.');
            console.error('Error fetching client dashboard:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (['client', 'boss', 'purchasing'].includes(user?.role || '')) {
            fetchMetrics();
        }
    }, [user, fetchMetrics]);

    if (loading) {
        return <div className="p-8 text-center text-slate-600">Cargando dashboard...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    const waiting = (work?.open ?? 0) + (work?.inProgress ?? 0);
    const finished = (work?.resolved ?? 0) + (work?.closed ?? 0);
    const total = waiting + finished || 1;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
            <WorldCupDashboardBanner pageTitle="Tu panel de tickets" userName={user?.username} />
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Tu panel de tickets</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Hola, {user?.username}. Acá ves solo lo que sigue abierto. El historial completo está en Mis Tickets.
                    </p>
                </div>
                <Link to="/client/tickets" className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm shrink-0">
                    Mis tickets <ArrowRight className="w-4 h-4" />
                </Link>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
                <Kpi label="En espera" value={waiting} hint={work?.oldestWaitingDays != null ? `El más antiguo lleva ${work.oldestWaitingDays} días` : 'Nada pendiente'} tone="bg-amber-50 text-amber-600" icon={<Hourglass className="w-4 h-4" />} />
                <Kpi label="Abiertos" value={work?.open ?? 0} hint="Todavía sin tomar" tone="bg-sky-50 text-sky-600" icon={<Ticket className="w-4 h-4" />} />
                <Kpi label="En progreso" value={work?.inProgress ?? 0} hint="Alguien ya los está viendo" tone="bg-indigo-50 text-indigo-600" icon={<Clock className="w-4 h-4" />} />
                <Kpi label="Resueltos 30 días" value={work?.resolved30d ?? 0} hint={`${finished} finalizados en total`} tone="bg-emerald-50 text-emerald-600" icon={<CheckCircle2 className="w-4 h-4" />} />
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <section className={`${clCard} p-4 sm:p-6 xl:col-span-3 min-w-0`}>
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">Solicitudes en curso</h2>
                            <p className="text-xs text-slate-500">Hasta 5 abiertas o en progreso.</p>
                        </div>
                        <Link to="/client/tickets" className="text-sm font-semibold text-red-600 hover:underline shrink-0">Ver todas</Link>
                    </div>
                    {(work?.recent || []).length === 0 ? (
                        <div className="py-10 text-center">
                            <p className="text-slate-500 text-sm">No tenés solicitudes abiertas.</p>
                            <Link to="/client/tickets" className="inline-block mt-4 text-sm font-semibold text-red-600 hover:underline">Crear un ticket</Link>
                        </div>
                    ) : (
                        <ul className="divide-y divide-gray-100">
                            {work!.recent.map((ticket) => (
                                <li key={ticket.id}>
                                    <button type="button" onClick={() => navigate(`/client/tickets/${ticket.id}`)} className="w-full text-left py-3 flex items-start gap-3 hover:bg-slate-50 rounded-lg px-1 min-w-0">
                                        <span className="text-sm font-semibold text-slate-400 shrink-0 pt-0.5">#{ticket.id}</span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block font-medium text-slate-900 break-words">{ticket.title}</span>
                                            <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                                                <StatusBadge status={ticket.status} />
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-semibold ${priorityPillClass(ticket.priority)}`}>
                                                    {ticketPriorityTranslations[ticket.priority] || ticket.priority}
                                                </span>
                                                <span className="break-words">{ticket.agent_name || 'Sin asignar'}</span>
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
                    <h2 className="text-lg font-bold text-slate-900">Cómo vienen tus pedidos</h2>
                    <p className="text-xs text-slate-500 mb-4">Proporción sobre todo tu historial.</p>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="bg-sky-500" style={{ width: `${((work?.open ?? 0) / total) * 100}%` }} />
                        <div className="bg-indigo-500" style={{ width: `${((work?.inProgress ?? 0) / total) * 100}%` }} />
                        <div className="bg-emerald-500" style={{ width: `${(finished / total) * 100}%` }} />
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                        <div className="flex justify-between gap-3"><dt className="text-slate-600">Abiertos</dt><dd className="font-semibold text-slate-900">{work?.open ?? 0}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-600">En progreso</dt><dd className="font-semibold text-slate-900">{work?.inProgress ?? 0}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-600">Resueltos</dt><dd className="font-semibold text-slate-900">{work?.resolved ?? 0}</dd></div>
                        <div className="flex justify-between gap-3"><dt className="text-slate-600">Cerrados</dt><dd className="font-semibold text-slate-900">{work?.closed ?? 0}</dd></div>
                    </dl>
                </section>
            </div>
        </div>
    );
};

export default ClientDashboard;
