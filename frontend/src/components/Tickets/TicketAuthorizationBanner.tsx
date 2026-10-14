import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { CheckCircle2, Clock, Mail, RefreshCw, XCircle } from 'lucide-react';
import api from '../../config/axiosConfig';

export type AuthorizationStatus = 'pending' | 'approved' | 'rejected';

interface AuthorizationApprover {
    name?: string | null;
    email: string;
    email_sent_at?: string | null;
    email_error?: string | null;
}

interface TicketAuthorization {
    status: AuthorizationStatus;
    label: string;
    decided_by_name?: string | null;
    decided_by_email?: string | null;
    decided_at?: string | null;
    decision_note?: string | null;
    equipment_label?: string;
    request?: {
        purpose?: string;
        software?: string;
        assigned_to?: string;
    } | null;
    approvers: AuthorizationApprover[];
    email_error?: string | null;
}

function formatDateTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STYLES: Record<AuthorizationStatus, { box: string; icon: React.ReactNode; title: string }> = {
    pending: {
        box: 'border-amber-200 bg-amber-50',
        icon: <Clock className="h-5 w-5 text-amber-600" />,
        title: 'text-amber-900',
    },
    approved: {
        box: 'border-emerald-200 bg-emerald-50',
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-600" />,
        title: 'text-emerald-900',
    },
    rejected: {
        box: 'border-red-200 bg-red-50',
        icon: <XCircle className="h-5 w-5 text-red-600" />,
        title: 'text-red-900',
    },
};

/** Estado de la autorización de equipamiento; no muestra nada si el ticket no la requiere. */
const TicketAuthorizationBanner: React.FC<{
    ticketId: number;
    canResend?: boolean;
    refreshKey?: string | number;
    className?: string;
}> = ({ ticketId, canResend = false, refreshKey, className = '' }) => {
    const [data, setData] = useState<TicketAuthorization | null>(null);
    const [resending, setResending] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await api.get(`/api/tickets/${ticketId}/authorization`);
            setData(res.data.data || null);
        } catch {
            setData(null);
        }
    }, [ticketId]);

    useEffect(() => {
        load();
    }, [load, refreshKey]);

    if (!data) return null;

    const style = STYLES[data.status] || STYLES.pending;

    const resend = async () => {
        setResending(true);
        try {
            const res = await api.post(`/api/tickets/${ticketId}/authorization/resend`);
            if (res.data.success) toast.success(res.data.message);
            else toast.warn(res.data.message);
            setData(res.data.data || null);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'No se pudo reenviar el correo.');
        } finally {
            setResending(false);
        }
    };

    const sentTo = data.approvers.filter((a) => a.email_sent_at);
    const noApprover = data.status === 'pending' && data.approvers.length === 0;

    return (
        <div className={`rounded-2xl border p-4 sm:p-5 ${style.box} ${className}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <span className="mt-0.5 shrink-0">{style.icon}</span>
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Autorización de equipamiento</p>
                    <p className={`mt-0.5 text-lg font-bold break-words ${style.title}`}>
                        {data.status === 'pending'
                            ? 'Pendiente de autorización'
                            : `${data.status === 'approved' ? 'Autorizado' : 'No autorizado'} por ${
                                  data.decided_by_name || data.decided_by_email
                              }`}
                    </p>
                    {data.status !== 'pending' && (
                        <p className="text-sm text-gray-600 break-words">
                            {data.decided_by_name && data.decided_by_email ? `${data.decided_by_email} · ` : ''}
                            {formatDateTime(data.decided_at)}
                        </p>
                    )}
                    {data.decision_note && (
                        <p className="mt-2 rounded-lg bg-white/70 px-3 py-2 text-sm text-gray-700 break-words">
                            “{data.decision_note}”
                        </p>
                    )}

                    {data.request && (
                        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                            <div className="min-w-0">
                                <dt className="text-gray-500">Equipo</dt>
                                <dd className="font-medium text-gray-900 break-words">{data.equipment_label}</dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-gray-500">Se asigna a</dt>
                                <dd className="font-medium text-gray-900 break-words">{data.request.assigned_to}</dd>
                            </div>
                            <div className="min-w-0 sm:col-span-2">
                                <dt className="text-gray-500">Uso</dt>
                                <dd className="text-gray-900 break-words whitespace-pre-wrap">{data.request.purpose}</dd>
                            </div>
                            {data.request.software && (
                                <div className="min-w-0 sm:col-span-2">
                                    <dt className="text-gray-500">Programas</dt>
                                    <dd className="text-gray-900 break-words">{data.request.software}</dd>
                                </div>
                            )}
                        </dl>
                    )}

                    {data.status === 'pending' && (
                        <div className="mt-3 text-sm text-gray-700">
                            {noApprover ? (
                                <p className="text-red-700">
                                    No hay un autorizante configurado. Un administrador debe cargarlo en Configuración y
                                    reenviar el pedido.
                                </p>
                            ) : sentTo.length > 0 ? (
                                <p className="flex flex-wrap items-center gap-1.5">
                                    <Mail className="h-4 w-4 text-gray-500" />
                                    Correo enviado a{' '}
                                    {sentTo.map((a, i) => (
                                        <span key={a.email} className="font-medium break-all">
                                            {a.name ? `${a.name} (${a.email})` : a.email}
                                            {i < sentTo.length - 1 ? ', ' : ''}
                                        </span>
                                    ))}
                                    {sentTo[0]?.email_sent_at && (
                                        <span className="text-gray-500">· {formatDateTime(sentTo[0].email_sent_at)}</span>
                                    )}
                                </p>
                            ) : (
                                <p className="text-red-700">
                                    El correo todavía no se pudo enviar
                                    {data.email_error ? ` (${data.email_error})` : ''}.
                                </p>
                            )}
                        </div>
                    )}
                </div>
                {canResend && data.status === 'pending' && (
                    <button
                        type="button"
                        onClick={resend}
                        disabled={resending}
                        className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                    >
                        <RefreshCw className={`h-4 w-4 ${resending ? 'animate-spin' : ''}`} />
                        Reenviar correo
                    </button>
                )}
            </div>
        </div>
    );
};

export const AuthorizationPill: React.FC<{ status?: AuthorizationStatus | null }> = ({ status }) => {
    if (!status) return null;
    const map: Record<AuthorizationStatus, { cls: string; text: string }> = {
        pending: { cls: 'bg-amber-100 text-amber-800', text: 'Pend. autorización' },
        approved: { cls: 'bg-emerald-100 text-emerald-800', text: 'Autorizado' },
        rejected: { cls: 'bg-red-100 text-red-800', text: 'No autorizado' },
    };
    const item = map[status];
    if (!item) return null;
    return (
        <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.cls}`}>
            {item.text}
        </span>
    );
};

export default TicketAuthorizationBanner;
