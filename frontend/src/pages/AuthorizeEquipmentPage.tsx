import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Laptop, XCircle } from 'lucide-react';
import api from '../config/axiosConfig';

type ReviewState = 'pending' | 'decided' | 'expired' | 'replaced' | 'invalid';

interface ReviewData {
    state: ReviewState;
    decision?: {
        status: 'approved' | 'rejected';
        label: string;
        decided_at?: string | null;
        decision_note?: string | null;
    } | null;
    approver?: { name?: string | null; email: string };
    ticket?: {
        id: number;
        title: string;
        created_at: string;
        priority: string;
        requester_name: string;
        requester_email?: string | null;
        company_name?: string | null;
        requester_department?: string | null;
        phone?: string | null;
    };
    request?: {
        equipment_label?: string;
        purpose?: string;
        software?: string;
        assigned_to?: string;
        assigned_person?: string;
        assigned_location?: string;
    };
}

const PRIORITY_LABEL: Record<string, string> = { low: 'Baja', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

function formatDateTime(iso?: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-screen bg-gray-100 px-4 py-8 sm:py-12">
        <div className="mx-auto max-w-xl">
            <div className="mb-4 flex items-center justify-center gap-2">
                <img src="/images/logo-b-sola.png" alt="Grupo Bacar" className="h-9 w-auto" />
                <span className="text-sm font-semibold text-gray-600">Sistema de Tickets</span>
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">{children}</div>
        </div>
    </div>
);

const Message: React.FC<{ icon: React.ReactNode; title: string; text: React.ReactNode }> = ({ icon, title, text }) => (
    <Shell>
        <div className="p-8 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gray-50">{icon}</div>
            <h1 className="mt-4 text-xl font-bold text-gray-900">{title}</h1>
            <div className="mt-2 text-sm text-gray-600">{text}</div>
        </div>
    </Shell>
);

const AuthorizeEquipmentPage: React.FC = () => {
    const [params] = useSearchParams();
    const token = params.get('t') || '';
    const preselected = params.get('d') === 'reject' ? 'reject' : params.get('d') === 'approve' ? 'approve' : null;

    const [data, setData] = useState<ReviewData | null>(null);
    const [loading, setLoading] = useState(true);
    const [choice, setChoice] = useState<'approve' | 'reject' | null>(preselected);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        if (!token) {
            setData({ state: 'invalid' });
            setLoading(false);
            return;
        }
        try {
            const res = await api.get('/api/authorizations/review', { params: { t: token } });
            setData(res.data.data);
        } catch {
            setData({ state: 'invalid' });
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        load();
    }, [load]);

    const submit = async () => {
        if (!choice) return;
        setSubmitting(true);
        setError(null);
        try {
            await api.post('/api/authorizations/decision', { t: token, decision: choice, note: note.trim() || undefined });
            await load();
        } catch (err: any) {
            setError(err.response?.data?.message || 'No se pudo registrar tu respuesta. Probá de nuevo.');
            await load();
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <Shell>
                <p className="p-10 text-center text-sm text-gray-500">Cargando solicitud…</p>
            </Shell>
        );
    }

    if (!data || data.state === 'invalid') {
        return (
            <Message
                icon={<XCircle className="h-7 w-7 text-red-500" />}
                title="Enlace inválido"
                text="El enlace no es válido. Revisá que lo hayas copiado completo desde el correo."
            />
        );
    }
    if (data.state === 'decided' && data.decision) {
        const ok = data.decision.status === 'approved';
        return (
            <Message
                icon={ok ? <CheckCircle2 className="h-7 w-7 text-emerald-600" /> : <XCircle className="h-7 w-7 text-red-600" />}
                title={data.decision.label}
                text={
                    <>
                        <p>
                            Ticket #{data.ticket?.id}: {data.ticket?.title}
                        </p>
                        {data.decision.decided_at && <p className="mt-1">{formatDateTime(data.decision.decided_at)}</p>}
                        <p className="mt-3">Ya quedó registrado en el sistema de tickets. Podés cerrar esta página.</p>
                    </>
                }
            />
        );
    }
    if (data.state === 'expired') {
        return (
            <Message
                icon={<Clock className="h-7 w-7 text-amber-500" />}
                title="El enlace venció"
                text="Pedile al equipo de Sistemas que reenvíe la solicitud de autorización."
            />
        );
    }
    if (data.state === 'replaced') {
        return (
            <Message
                icon={<Clock className="h-7 w-7 text-amber-500" />}
                title="Hay un correo más nuevo"
                text="Esta solicitud se reenvió. Usá el enlace del último correo que recibiste."
            />
        );
    }

    const t = data.ticket!;
    const r = data.request || {};
    const rows: [string, React.ReactNode][] = [
        ['Solicitante', `${t.requester_name}${t.requester_email ? ` (${t.requester_email})` : ''}`],
        ['Empresa / área', [t.company_name, t.requester_department].filter(Boolean).join(' · ') || '—'],
        ['Teléfono', t.phone || '—'],
        ['Equipo', r.equipment_label || '—'],
        ['Para qué se va a usar', r.purpose || '—'],
        ['Programas y accesos', r.software || 'Ninguno indicado'],
        ...((r.assigned_person
            ? [
                  ['Se asigna a', r.assigned_person],
                  ['Lugar / área', r.assigned_location || '—'],
              ]
            : [['Se asigna a', r.assigned_to || '—']]) as [string, React.ReactNode][]),
        ['Prioridad', PRIORITY_LABEL[t.priority] || t.priority],
        ['Pedido el', formatDateTime(t.created_at)],
    ];

    return (
        <Shell>
            <div className="bg-red-600 px-5 py-4 text-white sm:px-6">
                <p className="text-xs uppercase tracking-wider text-red-100">Ticket #{t.id}</p>
                <h1 className="mt-0.5 flex items-center gap-2 text-lg font-bold sm:text-xl">
                    <Laptop className="h-5 w-5 shrink-0" />
                    Solicitud de nuevo equipamiento
                </h1>
            </div>
            <div className="p-5 sm:p-6">
                <p className="text-sm text-gray-700">
                    {data.approver?.name ? `${data.approver.name}, ` : ''}
                    revisá el pedido y respondé si autorizás la compra o asignación del equipo.
                </p>

                <dl className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
                    {rows.map(([k, v]) => (
                        <div key={k} className="grid grid-cols-1 gap-0.5 px-4 py-2.5 sm:grid-cols-3 sm:gap-3">
                            <dt className="text-xs font-medium text-gray-500 sm:text-sm">{k}</dt>
                            <dd className="text-sm text-gray-900 break-words whitespace-pre-wrap sm:col-span-2">{v}</dd>
                        </div>
                    ))}
                </dl>

                <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => setChoice('approve')}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                            choice === 'approve'
                                ? 'border-emerald-600 bg-emerald-600 text-white'
                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                        }`}
                    >
                        <CheckCircle2 className="h-5 w-5" />
                        Autorizar
                    </button>
                    <button
                        type="button"
                        onClick={() => setChoice('reject')}
                        className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${
                            choice === 'reject'
                                ? 'border-red-600 bg-red-600 text-white'
                                : 'border-red-200 bg-white text-red-700 hover:bg-red-50'
                        }`}
                    >
                        <XCircle className="h-5 w-5" />
                        No autorizo
                    </button>
                </div>

                {choice && (
                    <div className="mt-4">
                        <label className="block text-sm font-medium text-gray-700">
                            Comentario <span className="font-normal text-gray-500">(opcional)</span>
                        </label>
                        <textarea
                            value={note}
                            onChange={(e) => setNote(e.target.value)}
                            rows={3}
                            maxLength={1000}
                            placeholder={
                                choice === 'approve'
                                    ? 'Ej: autorizado, comprar dentro del presupuesto del área.'
                                    : 'Ej: por ahora no, reutilizar el equipo de depósito.'
                            }
                            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm shadow-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                        />
                        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
                        <button
                            type="button"
                            onClick={submit}
                            disabled={submitting}
                            className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-white shadow-sm disabled:opacity-60 ${
                                choice === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                            }`}
                        >
                            {submitting
                                ? 'Registrando…'
                                : choice === 'approve'
                                  ? 'Confirmar: autorizo este equipo'
                                  : 'Confirmar: no autorizo este equipo'}
                        </button>
                    </div>
                )}
                {!choice && (
                    <p className="mt-3 text-center text-xs text-gray-500">Elegí una opción para confirmar tu respuesta.</p>
                )}
            </div>
        </Shell>
    );
};

export default AuthorizeEquipmentPage;
