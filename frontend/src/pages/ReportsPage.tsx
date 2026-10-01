import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
    Award,
    CalendarDays,
    CheckCircle2,
    Clock,
    Flame,
    Gauge,
    Inbox,
    MessageSquare,
    Timer,
    TrendingDown,
    TrendingUp,
    Trophy,
    Users,
} from 'lucide-react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { TicketPriority } from '../types';
import { clCard, priorityPillClass } from '../utils/cleanLightUi';
import { ticketPriorityTranslations } from '../utils/traslations';
import { formatLocalDate } from '../utils/dateFormatter';

// ---------------------------------------------------------------------------
// Tipos (respuesta de GET /api/metrics/agent)
// ---------------------------------------------------------------------------

interface AgentPerformance {
    agent: { id: number; name: string; username: string };
    summary: {
        resolvedTotal: number;
        activeNow: number;
        activeUrgent: number;
        closedThisMonth: number;
        oldestActiveDays: number | null;
        avgSecondsAll: number | null;
        avgFormattedAll: string;
        resolved30d: number;
        resolvedPrev30d: number;
        avgSeconds30d: number | null;
        avgFormatted30d: string | null;
        avgSecondsPrev30d: number | null;
        urgentResolved30d: number;
        withinDayRate30d: number | null;
        hoursLogged30d: number;
        ticketsWithHours30d: number;
        comments30d: number;
        bestMonth: { month: string; label: string; year: string; count: number } | null;
    };
    team: {
        resolved30d: number;
        agents30d: number;
        perAgent30d: number;
        avgSeconds30d: number | null;
        avgFormatted30d: string | null;
        withinDayRate30d: number | null;
        rank: { position: number | null; total: number };
    };
    monthly: Array<{ month: string; label: string; mine: number; teamAvg: number }>;
    byWeekday: Array<{ day: string; count: number }>;
    byPriority: Array<{ priority: TicketPriority; count: number; avgSeconds: number | null; avgFormatted: string | null }>;
    byCategory: Array<{ name: string; count: number }>;
    recent: Array<{
        id: number;
        title: string;
        priority: TicketPriority;
        closed_at: string;
        seconds: number;
        durationFormatted: string;
        client_name: string | null;
        company_name: string | null;
    }>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function shortDuration(seconds: number | null): string {
    if (seconds == null) return '—';
    if (seconds < 3600) return `${Math.max(1, Math.round(seconds / 60))} min`;
    if (seconds < 86400) return `${Math.round(seconds / 3600)} h`;
    const days = seconds / 86400;
    return days < 10 ? `${Math.round(days * 10) / 10} d` : `${Math.round(days)} d`;
}

function ordinal(n: number): string {
    return `${n}°`;
}

const PRIORITY_COLORS: Record<TicketPriority, string> = {
    urgent: '#dc2626',
    high: '#f97316',
    medium: '#f59e0b',
    low: '#10b981',
};

// ---------------------------------------------------------------------------
// Piezas de UI
// ---------------------------------------------------------------------------

const Delta: React.FC<{ current: number; previous: number; lowerIsBetter?: boolean; suffix?: string }> = ({
    current,
    previous,
    lowerIsBetter = false,
    suffix = '',
}) => {
    if (previous === 0 && current === 0) return <span className="text-xs text-slate-400">sin cambios</span>;
    const diff = current - previous;
    if (diff === 0) return <span className="text-xs text-slate-400">igual que el período anterior</span>;
    const better = lowerIsBetter ? diff < 0 : diff > 0;
    const Icon = diff > 0 ? TrendingUp : TrendingDown;
    const pct = previous > 0 ? Math.round((Math.abs(diff) / previous) * 100) : null;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-semibold ${better ? 'text-emerald-600' : 'text-rose-600'}`}>
            <Icon className="w-3.5 h-3.5" />
            {diff > 0 ? '+' : '−'}
            {Math.abs(diff)}
            {suffix}
            {pct != null && ` (${pct}%)`} vs. 30 días previos
        </span>
    );
};

const Kpi: React.FC<{
    label: string;
    value: React.ReactNode;
    tone: string;
    icon: React.ReactNode;
    children?: React.ReactNode;
}> = ({ label, value, tone, icon, children }) => (
    <div className={`${clCard} p-4 min-w-0 flex flex-col`}>
        <div className="flex items-start justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
            <span className={`shrink-0 rounded-lg p-1.5 ${tone}`}>{icon}</span>
        </div>
        <p className="text-3xl font-bold text-slate-900 mt-2 break-words">{value}</p>
        <div className="mt-1.5 space-y-0.5 text-xs text-slate-500">{children}</div>
    </div>
);

const Section: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; children: React.ReactNode; className?: string }> = ({
    title,
    subtitle,
    icon,
    children,
    className = '',
}) => (
    <section className={`${clCard} p-4 sm:p-5 min-w-0 ${className}`}>
        <div className="flex items-start gap-3 mb-4">
            <span className="rounded-lg bg-slate-100 text-slate-700 p-2 shrink-0">{icon}</span>
            <div className="min-w-0">
                <h2 className="text-base font-bold text-slate-900">{title}</h2>
                {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
        </div>
        {children}
    </section>
);

const Empty: React.FC<{ text: string }> = ({ text }) => (
    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-slate-500">{text}</div>
);

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const ReportsPage: React.FC = () => {
    const { user } = useAuth();
    const [data, setData] = useState<AgentPerformance | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await api.get('/api/metrics/agent');
                setData(response.data.data);
            } catch {
                toast.error('No se pudieron cargar tus métricas.');
            } finally {
                setLoading(false);
            }
        };
        fetchMetrics();
    }, []);

    const ticketBase = user?.role === 'admin' ? '/admin/tickets' : '/agent/tickets';

    const maxCategory = useMemo(() => Math.max(1, ...(data?.byCategory.map((c) => c.count) || [1])), [data]);
    const busiestDay = useMemo(() => {
        if (!data) return null;
        const top = data.byWeekday.reduce((a, b) => (b.count > a.count ? b : a), data.byWeekday[0]);
        return top && top.count > 0 ? top : null;
    }, [data]);

    if (loading) {
        return <div className="p-8 text-center text-slate-600">Cargando tus métricas...</div>;
    }
    if (!data) {
        return (
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <Empty text="No hay datos para mostrar todavía." />
            </div>
        );
    }

    const { summary: s, team, agent } = data;
    const firstName = agent.name.split(' ')[0] || agent.username;
    const fasterThanTeam = s.avgSeconds30d != null && team.avgSeconds30d != null ? s.avgSeconds30d <= team.avgSeconds30d : null;
    const aboveTeamVolume = team.perAgent30d > 0 ? s.resolved30d >= team.perAgent30d : null;
    const noActivity = s.resolvedTotal === 0 && s.activeNow === 0;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0 space-y-6">
            {/* Cabecera */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Tu rendimiento, {firstName}</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        Solo tus tickets (como titular o asignado), comparados con el promedio del equipo.
                    </p>
                </div>
                <p className="text-xs text-slate-500 shrink-0">
                    Histórico: <strong className="text-slate-700">{s.resolvedTotal}</strong> resueltos · promedio{' '}
                    <strong className="text-slate-700">{s.avgFormattedAll}</strong>
                </p>
            </div>

            {noActivity ? (
                <Empty text="Todavía no tenés tickets asignados. Cuando empieces a resolver, acá vas a ver tu evolución." />
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                        <Kpi label="Resueltos · 30 días" value={s.resolved30d} tone="bg-emerald-50 text-emerald-700" icon={<CheckCircle2 className="w-4 h-4" />}>
                            <Delta current={s.resolved30d} previous={s.resolvedPrev30d} />
                            <p>
                                Equipo: {team.perAgent30d} por agente
                                {aboveTeamVolume != null && (
                                    <span className={aboveTeamVolume ? ' text-emerald-600' : ' text-slate-500'}>
                                        {aboveTeamVolume ? ' · estás por encima' : ''}
                                    </span>
                                )}
                            </p>
                        </Kpi>

                        <Kpi label="Tiempo de resolución" value={shortDuration(s.avgSeconds30d)} tone="bg-indigo-50 text-indigo-700" icon={<Timer className="w-4 h-4" />}>
                            {s.avgSeconds30d != null && s.avgSecondsPrev30d != null ? (
                                <Delta
                                    current={Math.round(s.avgSeconds30d / 3600)}
                                    previous={Math.round(s.avgSecondsPrev30d / 3600)}
                                    lowerIsBetter
                                    suffix=" h"
                                />
                            ) : (
                                <span>promedio de los últimos 30 días</span>
                            )}
                            <p>
                                Equipo: {shortDuration(team.avgSeconds30d)}
                                {fasterThanTeam != null && (fasterThanTeam ? ' · vas más rápido' : '')}
                            </p>
                        </Kpi>

                        <Kpi
                            label="Cerrados en < 24 h"
                            value={s.withinDayRate30d != null ? `${s.withinDayRate30d}%` : '—'}
                            tone="bg-sky-50 text-sky-700"
                            icon={<Gauge className="w-4 h-4" />}
                        >
                            <p>de tus resueltos en 30 días</p>
                            <p>Equipo: {team.withinDayRate30d != null ? `${team.withinDayRate30d}%` : '—'}</p>
                        </Kpi>

                        <Kpi
                            label="Tu posición"
                            value={team.rank.position ? ordinal(team.rank.position) : '—'}
                            tone="bg-amber-50 text-amber-700"
                            icon={<Trophy className="w-4 h-4" />}
                        >
                            <p>
                                de {team.rank.total} {team.rank.total === 1 ? 'agente' : 'agentes'} por resueltos en 30 días
                            </p>
                            {team.rank.position === 1 && <p className="text-amber-700 font-semibold">Vas primero este mes.</p>}
                        </Kpi>

                        <Kpi label="Urgentes y altas" value={s.urgentResolved30d} tone="bg-rose-50 text-rose-700" icon={<Flame className="w-4 h-4" />}>
                            <p>resueltas en 30 días</p>
                            <p>
                                {s.resolved30d > 0 ? `${Math.round((s.urgentResolved30d / s.resolved30d) * 100)}% de lo que cerraste` : 'sin cierres aún'}
                            </p>
                        </Kpi>

                        <Kpi label="En curso ahora" value={s.activeNow} tone="bg-slate-100 text-slate-700" icon={<Inbox className="w-4 h-4" />}>
                            <p>{s.activeUrgent > 0 ? `${s.activeUrgent} de prioridad alta o urgente` : 'ninguno urgente'}</p>
                            {s.oldestActiveDays != null && s.activeNow > 0 && (
                                <p className={s.oldestActiveDays > 7 ? 'text-amber-700' : ''}>el más antiguo lleva {s.oldestActiveDays} días</p>
                            )}
                        </Kpi>
                    </div>

                    {/* Evolución mensual + mejor mes */}
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                        <Section
                            title="Tu evolución"
                            subtitle="Tickets resueltos por mes frente al promedio por agente del equipo"
                            icon={<CalendarDays className="w-4 h-4" />}
                            className="xl:col-span-2"
                        >
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={data.monthly} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                        <CartesianGrid vertical={false} stroke="#f1f5f9" />
                                        <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                        <Tooltip
                                            cursor={{ fill: '#f8fafc' }}
                                            contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
                                            formatter={(value: number, name: string) => [value, name === 'mine' ? 'Vos' : 'Promedio del equipo']}
                                        />
                                        <Legend
                                            iconType="circle"
                                            wrapperStyle={{ fontSize: 12 }}
                                            formatter={(value: string) => (value === 'mine' ? 'Vos' : 'Promedio por agente')}
                                        />
                                        <Bar dataKey="mine" fill="#dc2626" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                        <Bar dataKey="teamAvg" fill="#cbd5e1" radius={[6, 6, 0, 0]} maxBarSize={36} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </Section>

                        <div className="space-y-4">
                            <div className={`${clCard} p-4 bg-gradient-to-br from-amber-50 to-white border-amber-100`}>
                                <div className="flex items-center gap-2 text-amber-700">
                                    <Award className="w-5 h-5" />
                                    <p className="text-xs font-semibold uppercase tracking-wide">Tu mejor mes</p>
                                </div>
                                {s.bestMonth ? (
                                    <>
                                        <p className="text-2xl font-bold text-slate-900 mt-2 capitalize">
                                            {s.bestMonth.label} {s.bestMonth.year}
                                        </p>
                                        <p className="text-sm text-slate-600">{s.bestMonth.count} tickets resueltos</p>
                                        {s.closedThisMonth > 0 && (
                                            <p className="text-xs text-slate-500 mt-2">
                                                Este mes llevás {s.closedThisMonth}
                                                {s.closedThisMonth >= s.bestMonth.count ? ' · ¡récord personal!' : ` · te faltan ${s.bestMonth.count - s.closedThisMonth} para igualarlo`}
                                            </p>
                                        )}
                                    </>
                                ) : (
                                    <p className="text-sm text-slate-500 mt-2">Todavía sin cierres.</p>
                                )}
                            </div>

                            <div className={`${clCard} p-4`}>
                                <div className="flex items-center gap-2 text-slate-700">
                                    <Users className="w-5 h-5" />
                                    <p className="text-xs font-semibold uppercase tracking-wide">El equipo en 30 días</p>
                                </div>
                                <dl className="mt-3 space-y-2 text-sm">
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-slate-500">Resueltos entre todos</dt>
                                        <dd className="font-semibold text-slate-900">{team.resolved30d}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-slate-500">Agentes activos</dt>
                                        <dd className="font-semibold text-slate-900">{team.agents30d}</dd>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <dt className="text-slate-500">Tu aporte</dt>
                                        <dd className="font-semibold text-slate-900">
                                            {team.resolved30d > 0 ? `${Math.round((s.resolved30d / team.resolved30d) * 100)}%` : '—'}
                                        </dd>
                                    </div>
                                    {s.comments30d > 0 && (
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-slate-500 inline-flex items-center gap-1">
                                                <MessageSquare className="w-3.5 h-3.5" /> Tus comentarios
                                            </dt>
                                            <dd className="font-semibold text-slate-900">{s.comments30d}</dd>
                                        </div>
                                    )}
                                    {s.hoursLogged30d > 0 && (
                                        <div className="flex justify-between gap-3">
                                            <dt className="text-slate-500 inline-flex items-center gap-1">
                                                <Clock className="w-3.5 h-3.5" /> Horas registradas
                                            </dt>
                                            <dd className="font-semibold text-slate-900">{s.hoursLogged30d} h</dd>
                                        </div>
                                    )}
                                </dl>
                            </div>
                        </div>
                    </div>

                    {/* Detalle: días, prioridades, categorías */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <Section
                            title="Tus días fuertes"
                            subtitle={busiestDay ? `Cerrás más tickets los ${busiestDay.day.toLowerCase()} (últimos 90 días)` : 'Cierres por día de la semana, últimos 90 días'}
                            icon={<CalendarDays className="w-4 h-4" />}
                        >
                            {data.byWeekday.every((d) => d.count === 0) ? (
                                <Empty text="Sin cierres en los últimos 90 días." />
                            ) : (
                                <div className="h-44">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={data.byWeekday} margin={{ top: 8, right: 0, left: -24, bottom: 0 }}>
                                            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                            <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [v, 'Cerrados']} />
                                            <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={28}>
                                                {data.byWeekday.map((d) => (
                                                    <Cell key={d.day} fill={busiestDay && d.day === busiestDay.day ? '#dc2626' : '#e2e8f0'} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            )}
                        </Section>

                        <Section title="Por prioridad" subtitle="Cuántos resolviste y cuánto tardaste, últimos 90 días" icon={<Flame className="w-4 h-4" />}>
                            {data.byPriority.every((p) => p.count === 0) ? (
                                <Empty text="Sin cierres en los últimos 90 días." />
                            ) : (
                                <ul className="space-y-2.5">
                                    {data.byPriority.map((p) => {
                                        const total = data.byPriority.reduce((acc, x) => acc + x.count, 0) || 1;
                                        const pct = Math.round((p.count / total) * 100);
                                        return (
                                            <li key={p.priority} className="min-w-0">
                                                <div className="flex items-center justify-between gap-2 text-sm">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${priorityPillClass(p.priority)}`}>
                                                        {ticketPriorityTranslations[p.priority]}
                                                    </span>
                                                    <span className="text-slate-700 font-semibold tabular-nums">
                                                        {p.count}
                                                        <span className="text-slate-400 font-normal"> · {p.avgSeconds != null ? shortDuration(p.avgSeconds) : '—'}</span>
                                                    </span>
                                                </div>
                                                <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                                                    <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PRIORITY_COLORS[p.priority] }} />
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </Section>

                        <Section title="En qué trabajás más" subtitle="Categorías de tus tickets resueltos, últimos 90 días" icon={<Gauge className="w-4 h-4" />}>
                            {data.byCategory.length === 0 ? (
                                <Empty text="Sin cierres en los últimos 90 días." />
                            ) : (
                                <ul className="space-y-2.5">
                                    {data.byCategory.map((c) => (
                                        <li key={c.name} className="min-w-0">
                                            <div className="flex items-center justify-between gap-2 text-sm">
                                                <span className="text-slate-700 truncate">{c.name}</span>
                                                <span className="text-slate-900 font-semibold tabular-nums shrink-0">{c.count}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-slate-100 mt-1.5 overflow-hidden">
                                                <div className="h-full rounded-full bg-slate-700" style={{ width: `${Math.round((c.count / maxCategory) * 100)}%` }} />
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Section>
                    </div>

                    {/* Últimos cierres */}
                    <Section title="Tus últimos cierres" subtitle="Los 8 tickets más recientes que resolviste y cuánto tardó cada uno" icon={<CheckCircle2 className="w-4 h-4" />}>
                        {data.recent.length === 0 ? (
                            <Empty text="Todavía no cerraste tickets." />
                        ) : (
                            <>
                                <table className="hidden md:table w-full table-fixed">
                                    <thead>
                                        <tr className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-gray-100">
                                            <th className="py-2 pr-3 w-16">ID</th>
                                            <th className="py-2 pr-3">Ticket</th>
                                            <th className="py-2 pr-3 w-[22%] hidden lg:table-cell">Cliente</th>
                                            <th className="py-2 pr-3 w-24">Prioridad</th>
                                            <th className="py-2 pr-3 w-32 hidden xl:table-cell">Cerrado</th>
                                            <th className="py-2 w-28 text-right">Duración</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.recent.map((t) => (
                                            <tr key={t.id} className="text-sm hover:bg-gray-50/80">
                                                <td className="py-2.5 pr-3 whitespace-nowrap">
                                                    <Link to={`${ticketBase}/${t.id}`} className="font-semibold text-red-700 hover:underline">
                                                        #{t.id}
                                                    </Link>
                                                </td>
                                                <td className="py-2.5 pr-3 text-slate-900 break-words">{t.title}</td>
                                                <td className="py-2.5 pr-3 text-slate-600 break-words hidden lg:table-cell">
                                                    {t.client_name}
                                                    {t.company_name && <span className="block text-xs text-slate-400">{t.company_name}</span>}
                                                </td>
                                                <td className="py-2.5 pr-3">
                                                    <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${priorityPillClass(t.priority)}`}>
                                                        {ticketPriorityTranslations[t.priority]}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 pr-3 text-slate-600 whitespace-nowrap hidden xl:table-cell">{formatLocalDate(t.closed_at)}</td>
                                                <td className="py-2.5 text-right text-slate-700 font-semibold tabular-nums whitespace-nowrap">{shortDuration(t.seconds)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                <ul className="md:hidden divide-y divide-gray-100">
                                    {data.recent.map((t) => (
                                        <li key={t.id} className="py-3 flex items-start justify-between gap-3 min-w-0">
                                            <div className="min-w-0">
                                                <Link to={`${ticketBase}/${t.id}`} className="text-sm font-semibold text-slate-900 hover:text-red-700 break-words">
                                                    #{t.id} · {t.title}
                                                </Link>
                                                <p className="text-xs text-slate-500 mt-0.5 break-words">
                                                    {t.client_name} · {formatLocalDate(t.closed_at)}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${priorityPillClass(t.priority)}`}>
                                                    {ticketPriorityTranslations[t.priority]}
                                                </span>
                                                <p className="text-xs font-semibold text-slate-700 mt-1">{shortDuration(t.seconds)}</p>
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </Section>
                </>
            )}
        </div>
    );
};

export default ReportsPage;
