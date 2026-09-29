import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend,
    AreaChart,
    Area,
    LabelList,
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { toast } from 'react-toastify';
import { Download, X, Ticket, Activity, CheckCircle2, AlertTriangle, UserX, Clock, Percent } from 'lucide-react';
import { TicketData } from '../../types';
import { ticketStatusTranslations, ticketPriorityTranslations } from '../../utils/traslations';

export interface ReportFilterChip {
    label: string;
    value: string;
}

interface TicketReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    tickets: TicketData[];
    /** Filtros activos que generaron la consulta (se muestran como chips y en el PDF). */
    filters: ReportFilterChip[];
    title?: string;
    /** Ocultar el desglose por cliente (por ejemplo, en la vista de un cliente). */
    hideClientBreakdown?: boolean;
    /** Ocultar el desglose por agente (por ejemplo, en la vista de un cliente). */
    hideAgentBreakdown?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
    open: '#0ea5e9',
    reopened: '#f59e0b',
    'in-progress': '#3b82f6',
    resolved: '#22c55e',
    closed: '#94a3b8',
};

const PRIORITY_COLORS: Record<string, string> = {
    low: '#10b981',
    medium: '#f59e0b',
    high: '#f97316',
    urgent: '#dc2626',
};

const SERIES_COLORS = ['#be0000', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#0ea5e9', '#ec4899', '#64748b'];

const STATUS_ORDER = ['open', 'reopened', 'in-progress', 'resolved', 'closed'];
const PRIORITY_ORDER = ['urgent', 'high', 'medium', 'low'];

const MONTHS_ES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function toDate(value?: string | null): Date | null {
    if (!value) return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

function formatHours(hours: number | null): string {
    if (hours === null || !Number.isFinite(hours)) return '—';
    if (hours < 1) return `${Math.round(hours * 60)} min`;
    if (hours < 48) return `${hours.toFixed(1)} h`;
    return `${(hours / 24).toFixed(1)} días`;
}

function countBy<T>(items: T[], keyFn: (item: T) => string): Map<string, number> {
    const map = new Map<string, number>();
    items.forEach((item) => {
        const key = keyFn(item);
        map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
}

function topN(map: Map<string, number>, n: number): { name: string; value: number }[] {
    const entries = Array.from(map.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
    if (entries.length <= n) return entries;
    const head = entries.slice(0, n);
    const rest = entries.slice(n).reduce((acc, e) => acc + e.value, 0);
    return [...head, { name: `Otros (${entries.length - n})`, value: rest }];
}

const ChartCard: React.FC<{ title: string; subtitle?: string; children: React.ReactNode; className?: string }> = ({
    title,
    subtitle,
    children,
    className = '',
}) => (
    <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5 min-w-0 ${className}`}>
        <div className="mb-3">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{title}</h3>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {children}
    </div>
);

const KpiTile: React.FC<{
    label: string;
    value: string | number;
    hint?: string;
    icon: React.ReactNode;
    accent: string;
}> = ({ label, value, hint, icon, accent }) => (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-start gap-3 min-w-0">
        <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${accent}`}>{icon}</div>
        <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 leading-tight break-words">{label}</p>
            <p className="text-2xl font-bold text-slate-900 leading-tight mt-1 break-words">{value}</p>
            {hint && <p className="text-[11px] text-slate-500 mt-0.5 break-words">{hint}</p>}
        </div>
    </div>
);

const EmptyChart: React.FC = () => (
    <div className="h-full w-full flex items-center justify-center text-sm text-slate-400">Sin datos para graficar</div>
);

const tooltipStyle = {
    backgroundColor: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '0.75rem',
    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.08)',
    fontSize: '12px',
};

const TicketReportModal: React.FC<TicketReportModalProps> = ({
    isOpen,
    onClose,
    tickets,
    filters,
    title = 'Reporte de tickets',
    hideClientBreakdown = false,
    hideAgentBreakdown = false,
}) => {
    const reportRef = useRef<HTMLDivElement>(null);
    const pdfHeaderRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    const data = useMemo(() => {
        const total = tickets.length;
        const active = tickets.filter((t) => t.status === 'open' || t.status === 'in-progress' || t.status === 'reopened').length;
        const finished = tickets.filter((t) => t.status === 'resolved' || t.status === 'closed');
        const highPriority = tickets.filter((t) => t.priority === 'high' || t.priority === 'urgent').length;
        const unassigned = tickets.filter(
            (t) => !t.assigned_to_user_id && !(t.assignees && t.assignees.length > 0)
        ).length;

        const resolutionHours: number[] = [];
        finished.forEach((t) => {
            const created = toDate(t.created_at);
            const closed = toDate(t.closed_at) || toDate(t.resolved_at);
            if (created && closed && closed >= created) {
                resolutionHours.push((closed.getTime() - created.getTime()) / 36e5);
            }
        });
        const avgResolutionHours =
            resolutionHours.length > 0 ? resolutionHours.reduce((a, b) => a + b, 0) / resolutionHours.length : null;

        const statusMap = countBy(tickets, (t) => t.status);
        const byStatus = STATUS_ORDER.filter((s) => statusMap.has(s)).map((s) => ({
            key: s,
            name: ticketStatusTranslations[s as keyof typeof ticketStatusTranslations] || s,
            value: statusMap.get(s) || 0,
        }));

        const priorityMap = countBy(tickets, (t) => t.priority || 'low');
        const byPriority = PRIORITY_ORDER.map((p) => ({
            key: p,
            name: ticketPriorityTranslations[p as keyof typeof ticketPriorityTranslations] || p,
            value: priorityMap.get(p) || 0,
        }));

        const byAgent = topN(
            countBy(tickets, (t) => (t.agent_names || t.agent_name || '').trim() || 'Sin asignar'),
            8
        );
        const byClient = topN(countBy(tickets, (t) => (t.client_name || '').trim() || 'Sin cliente'), 8);
        const byDepartment = topN(
            countBy(tickets, (t) => (t.ticket_department_name || t.department_name || '').trim() || 'Sin departamento'),
            8
        );

        // Serie temporal: por día si el rango es corto, por mes si es largo
        const dates = tickets.map((t) => toDate(t.created_at)).filter((d): d is Date => d !== null);
        let timeline: { label: string; creados: number; resueltos: number }[] = [];
        let timelineMode: 'day' | 'month' = 'month';
        if (dates.length > 0) {
            const min = new Date(Math.min(...dates.map((d) => d.getTime())));
            const max = new Date(Math.max(...dates.map((d) => d.getTime())));
            const spanDays = (max.getTime() - min.getTime()) / 864e5;
            timelineMode = spanDays <= 45 ? 'day' : 'month';

            const keyOf = (d: Date) =>
                timelineMode === 'day'
                    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                    : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const labelOf = (key: string) => {
                const parts = key.split('-');
                if (timelineMode === 'day') return `${parts[2]}/${parts[1]}`;
                return `${MONTHS_ES[parseInt(parts[1], 10) - 1]} ${parts[0].slice(2)}`;
            };

            const buckets = new Map<string, { creados: number; resueltos: number }>();
            const cursor = new Date(min);
            cursor.setHours(0, 0, 0, 0);
            if (timelineMode === 'month') cursor.setDate(1);
            const end = new Date(max);
            while (cursor <= end) {
                buckets.set(keyOf(cursor), { creados: 0, resueltos: 0 });
                if (timelineMode === 'day') cursor.setDate(cursor.getDate() + 1);
                else cursor.setMonth(cursor.getMonth() + 1);
            }
            tickets.forEach((t) => {
                const c = toDate(t.created_at);
                if (c) {
                    const k = keyOf(c);
                    const b = buckets.get(k);
                    if (b) b.creados += 1;
                }
                if (t.status === 'resolved' || t.status === 'closed') {
                    const r = toDate(t.closed_at) || toDate(t.resolved_at);
                    if (r) {
                        const k = keyOf(r);
                        const b = buckets.get(k);
                        if (b) b.resueltos += 1;
                    }
                }
            });
            timeline = Array.from(buckets.entries()).map(([key, v]) => ({ label: labelOf(key), ...v }));
        }

        return {
            total,
            active,
            finishedCount: finished.length,
            resolutionRate: total > 0 ? Math.round((finished.length / total) * 100) : null,
            highPriority,
            unassigned,
            avgResolutionHours,
            byStatus,
            byPriority,
            byAgent,
            byClient,
            byDepartment,
            timeline,
            timelineMode,
        };
    }, [tickets]);

    if (!isOpen) return null;

    const generatedAt = new Date().toLocaleString('es-AR', { dateStyle: 'medium', timeStyle: 'short' });
    const activeFilters = filters.filter((f) => f.value && f.value.trim() !== '');

    const handleExportPdf = async () => {
        if (!reportRef.current) return;
        setIsExporting(true);
        const pdfHeader = pdfHeaderRef.current;
        try {
            pdfHeader?.classList.remove('hidden');
            const canvas = await html2canvas(reportRef.current, {
                scale: 1.5,
                backgroundColor: '#f8fafc',
                useCORS: true,
                logging: false,
            });
            const pdf = new jsPDF('p', 'mm', 'a4');
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const margin = 8;
            const imgWidth = pageWidth - margin * 2;
            const usableHeight = pageHeight - margin * 2;
            // Alto (en px del canvas) que entra en una página
            const pxPerMm = canvas.width / imgWidth;
            const pageSlicePx = Math.floor(usableHeight * pxPerMm);

            // Se recorta el canvas por página (en vez de incrustar la imagen completa N veces) para que el PDF sea liviano
            let offsetPx = 0;
            let first = true;
            while (offsetPx < canvas.height) {
                const sliceHeight = Math.min(pageSlicePx, canvas.height - offsetPx);
                const slice = document.createElement('canvas');
                slice.width = canvas.width;
                slice.height = sliceHeight;
                const ctx = slice.getContext('2d');
                if (!ctx) break;
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, 0, slice.width, slice.height);
                ctx.drawImage(canvas, 0, offsetPx, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);
                if (!first) pdf.addPage();
                pdf.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, imgWidth, sliceHeight / pxPerMm, undefined, 'FAST');
                first = false;
                offsetPx += sliceHeight;
            }
            const stamp = new Date().toISOString().slice(0, 10);
            pdf.save(`reporte-tickets-${stamp}.pdf`);
            toast.success('Reporte exportado en PDF.');
        } catch (err) {
            toast.error('No se pudo generar el PDF del reporte.');
        } finally {
            pdfHeader?.classList.add('hidden');
            setIsExporting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-2 sm:p-4"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
        >
            <div
                className="bg-slate-50 rounded-2xl border border-gray-100 shadow-2xl w-full max-w-6xl max-h-[94vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Encabezado fijo */}
                <div className="flex items-start justify-between gap-3 px-4 sm:px-6 py-4 border-b border-gray-100 bg-white shrink-0">
                    <div className="min-w-0">
                        <h2 className="text-lg sm:text-2xl font-bold text-slate-900 break-words">{title}</h2>
                        <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                            {data.total} {data.total === 1 ? 'ticket' : 'tickets'} en la consulta · generado el {generatedAt}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={handleExportPdf}
                            disabled={isExporting || data.total === 0}
                            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2 px-3 sm:px-4 rounded-xl shadow-sm"
                        >
                            <Download className="w-4 h-4" />
                            <span className="hidden sm:inline">{isExporting ? 'Generando…' : 'Descargar PDF'}</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                            aria-label="Cerrar reporte"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Cuerpo desplazable (solo vertical) */}
                <div className="overflow-y-auto overflow-x-hidden flex-1 min-h-0">
                    <div ref={reportRef} className="p-4 sm:p-6 space-y-5 bg-slate-50">
                        {/* Encabezado solo para el PDF (se muestra durante la captura) */}
                        <div ref={pdfHeaderRef} className="hidden">
                            <h2 className="text-2xl font-bold text-slate-900">{title}</h2>
                            <p className="text-sm text-slate-500 mt-0.5">
                                {data.total} {data.total === 1 ? 'ticket' : 'tickets'} en la consulta · generado el {generatedAt}
                            </p>
                        </div>
                        {/* Filtros aplicados */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Consulta</p>
                            {activeFilters.length === 0 ? (
                                <p className="text-sm text-slate-700">Sin filtros: se incluyen todos los tickets visibles.</p>
                            ) : (
                                <div className="flex flex-wrap gap-2">
                                    {activeFilters.map((f) => (
                                        <span
                                            key={`${f.label}-${f.value}`}
                                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 border border-slate-200 px-3 py-1 text-xs text-slate-700 max-w-full"
                                        >
                                            <span className="font-semibold shrink-0">{f.label}:</span>
                                            <span className="break-words">{f.value}</span>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {data.total === 0 ? (
                            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-slate-500">
                                La consulta actual no devolvió tickets. Ajustá los filtros y volvé a generar el reporte.
                            </div>
                        ) : (
                            <>
                                {/* KPIs */}
                                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                                    <KpiTile label="Total" value={data.total} icon={<Ticket className="w-5 h-5 text-slate-700" />} accent="bg-slate-100" />
                                    <KpiTile label="Activos" value={data.active} hint="Abiertos + en progreso" icon={<Activity className="w-5 h-5 text-blue-700" />} accent="bg-blue-50" />
                                    <KpiTile label="Finalizados" value={data.finishedCount} hint="Resueltos + cerrados" icon={<CheckCircle2 className="w-5 h-5 text-green-700" />} accent="bg-green-50" />
                                    <KpiTile
                                        label="Tasa de cierre"
                                        value={data.resolutionRate === null ? '—' : `${data.resolutionRate}%`}
                                        icon={<Percent className="w-5 h-5 text-emerald-700" />}
                                        accent="bg-emerald-50"
                                    />
                                    <KpiTile label="Alta / Urgente" value={data.highPriority} icon={<AlertTriangle className="w-5 h-5 text-red-700" />} accent="bg-red-50" />
                                    <KpiTile
                                        label="Resolución prom."
                                        value={formatHours(data.avgResolutionHours)}
                                        hint={data.unassigned > 0 ? `${data.unassigned} sin asignar` : 'Creación → cierre'}
                                        icon={data.unassigned > 0 ? <UserX className="w-5 h-5 text-amber-700" /> : <Clock className="w-5 h-5 text-violet-700" />}
                                        accent={data.unassigned > 0 ? 'bg-amber-50' : 'bg-violet-50'}
                                    />
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    {/* Estado */}
                                    <ChartCard title="Distribución por estado" subtitle="Proporción de tickets según su estado actual">
                                        <div className="h-64 w-full">
                                            {data.byStatus.length === 0 ? (
                                                <EmptyChart />
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <PieChart>
                                                        <Pie
                                                            data={data.byStatus}
                                                            dataKey="value"
                                                            nameKey="name"
                                                            cx="50%"
                                                            cy="50%"
                                                            innerRadius={55}
                                                            outerRadius={90}
                                                            paddingAngle={2}
                                                            isAnimationActive={false}
                                                            label={({ percent }) => `${Math.round((percent || 0) * 100)}%`}
                                                            labelLine={false}
                                                        >
                                                            {data.byStatus.map((entry) => (
                                                                <Cell key={entry.key} fill={STATUS_COLORS[entry.key] || '#94a3b8'} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={tooltipStyle} />
                                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </ChartCard>

                                    {/* Prioridad */}
                                    <ChartCard title="Tickets por prioridad" subtitle="Cantidad de tickets en cada nivel de prioridad">
                                        <div className="h-64 w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={data.byPriority} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#475569' }} axisLine={false} tickLine={false} />
                                                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                                                    <Bar dataKey="value" name="Tickets" radius={[8, 8, 0, 0]} isAnimationActive={false}>
                                                        {data.byPriority.map((entry) => (
                                                            <Cell key={entry.key} fill={PRIORITY_COLORS[entry.key] || '#94a3b8'} />
                                                        ))}
                                                        <LabelList dataKey="value" position="top" style={{ fontSize: 12, fill: '#0f172a', fontWeight: 700 }} />
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </ChartCard>

                                    {/* Evolución temporal */}
                                    <ChartCard
                                        title="Evolución en el tiempo"
                                        subtitle={data.timelineMode === 'day' ? 'Tickets creados y finalizados por día' : 'Tickets creados y finalizados por mes'}
                                        className="lg:col-span-2"
                                    >
                                        <div className="h-64 w-full">
                                            {data.timeline.length === 0 ? (
                                                <EmptyChart />
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={data.timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="gradCreados" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#be0000" stopOpacity={0.35} />
                                                                <stop offset="100%" stopColor="#be0000" stopOpacity={0.02} />
                                                            </linearGradient>
                                                            <linearGradient id="gradResueltos" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
                                                                <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                                        <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                                                        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={tooltipStyle} />
                                                        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                                                        <Area type="monotone" dataKey="creados" name="Creados" stroke="#be0000" strokeWidth={2} fill="url(#gradCreados)" isAnimationActive={false} />
                                                        <Area type="monotone" dataKey="resueltos" name="Finalizados" stroke="#22c55e" strokeWidth={2} fill="url(#gradResueltos)" isAnimationActive={false} />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </ChartCard>

                                    {/* Por agente */}
                                    {!hideAgentBreakdown && (
                                        <ChartCard title="Tickets por agente" subtitle="Top 8 agentes asignados en la consulta">
                                            <div className="h-72 w-full">
                                                {data.byAgent.length === 0 ? (
                                                    <EmptyChart />
                                                ) : (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={data.byAgent} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                                                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                                                            <Bar dataKey="value" name="Tickets" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                                                                {data.byAgent.map((_, i) => (
                                                                    <Cell key={i} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#0f172a', fontWeight: 700 }} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </div>
                                        </ChartCard>
                                    )}

                                    {/* Por cliente */}
                                    {!hideClientBreakdown && (
                                        <ChartCard title="Tickets por cliente" subtitle="Top 8 solicitantes en la consulta">
                                            <div className="h-72 w-full">
                                                {data.byClient.length === 0 ? (
                                                    <EmptyChart />
                                                ) : (
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <BarChart data={data.byClient} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                                                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                                            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                            <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                                                            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                                                            <Bar dataKey="value" name="Tickets" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                                                                {data.byClient.map((_, i) => (
                                                                    <Cell key={i} fill={SERIES_COLORS[(i + 1) % SERIES_COLORS.length]} />
                                                                ))}
                                                                <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#0f172a', fontWeight: 700 }} />
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                )}
                                            </div>
                                        </ChartCard>
                                    )}

                                    {/* Por departamento */}
                                    <ChartCard
                                        title="Tickets por departamento"
                                        subtitle="Áreas que concentran la demanda de la consulta"
                                        className={hideAgentBreakdown && hideClientBreakdown ? 'lg:col-span-2' : ''}
                                    >
                                        <div className="h-72 w-full">
                                            {data.byDepartment.length === 0 ? (
                                                <EmptyChart />
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <BarChart data={data.byDepartment} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                                                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11, fill: '#475569' }} axisLine={false} tickLine={false} />
                                                        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f1f5f9' }} />
                                                        <Bar dataKey="value" name="Tickets" radius={[0, 8, 8, 0]} isAnimationActive={false}>
                                                            {data.byDepartment.map((_, i) => (
                                                                <Cell key={i} fill={SERIES_COLORS[(i + 2) % SERIES_COLORS.length]} />
                                                            ))}
                                                            <LabelList dataKey="value" position="right" style={{ fontSize: 12, fill: '#0f172a', fontWeight: 700 }} />
                                                        </Bar>
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>
                                    </ChartCard>
                                </div>

                                {/* Tabla resumen por estado (útil para el PDF) */}
                                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 sm:p-5">
                                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide mb-3">Resumen numérico</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                                        {data.byStatus.map((s) => (
                                            <div key={s.key} className="rounded-xl border border-gray-100 bg-slate-50 p-3 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: STATUS_COLORS[s.key] || '#94a3b8' }} />
                                                    <span className="text-xs font-semibold text-slate-600 break-words">{s.name}</span>
                                                </div>
                                                <p className="text-xl font-bold text-slate-900 mt-1">
                                                    {s.value}
                                                    <span className="text-xs text-slate-500 font-medium ml-1">
                                                        ({data.total > 0 ? Math.round((s.value / data.total) * 100) : 0}%)
                                                    </span>
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TicketReportModal;
