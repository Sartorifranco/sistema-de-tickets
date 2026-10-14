import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Laptop, Plus, Trash2 } from 'lucide-react';
import api from '../../config/axiosConfig';
import { clCard, clInput } from '../../utils/cleanLightUi';

interface Authorizer {
    name: string;
    email: string;
}

const MAX_AUTHORIZERS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EquipmentAuthorizersSettings: React.FC = () => {
    const [saved, setSaved] = useState<Authorizer[]>([]);
    const [draft, setDraft] = useState<Authorizer[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await api.get('/api/authorizations/settings');
            const list: Authorizer[] = res.data?.data?.authorizers || [];
            setSaved(list);
            setDraft(list.length ? list : [{ name: '', email: '' }]);
        } catch (err: any) {
            setLoadError(err.response?.data?.message || 'No se pudo cargar la configuración.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const update = (idx: number, field: keyof Authorizer, value: string) => {
        setDraft((prev) => prev.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
    };

    const remove = (idx: number) => {
        setDraft((prev) => {
            const next = prev.filter((_, i) => i !== idx);
            return next.length ? next : [{ name: '', email: '' }];
        });
    };

    const cleaned = draft
        .map((a) => ({ name: a.name.trim(), email: a.email.trim().toLowerCase() }))
        .filter((a) => a.name || a.email);
    const invalid = cleaned.some((a) => !EMAIL_RE.test(a.email));
    const dirty = JSON.stringify(cleaned) !== JSON.stringify(saved.map((a) => ({ name: a.name, email: a.email })));

    const handleSave = async () => {
        if (invalid) {
            toast.error('Revisá los correos: hay alguno incompleto o mal escrito.');
            return;
        }
        setSaving(true);
        try {
            const res = await api.put('/api/authorizations/settings', { authorizers: cleaned });
            const list: Authorizer[] = res.data?.data?.authorizers || cleaned;
            setSaved(list);
            setDraft(list.length ? list : [{ name: '', email: '' }]);
            toast.success('Autorizantes guardados.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'No se pudieron guardar los autorizantes.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${clCard} p-6 space-y-4`}>
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Laptop className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Autorización de nuevo equipamiento</h2>
                    <p className="text-sm text-gray-600 mt-0.5 max-w-2xl">
                        Cuando alguien crea un ticket de &quot;Solicitud de nuevo equipamiento&quot;, se envía un correo a
                        estas personas para que autoricen o no. La primera respuesta es la que queda registrada en el ticket.
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
            ) : loadError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
            ) : (
                <>
                    {saved.length === 0 && (
                        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                            Todavía no hay autorizantes. Las solicitudes quedan pendientes sin enviar correo hasta que cargues al menos uno.
                        </p>
                    )}
                    <div className="space-y-2">
                        {draft.map((a, idx) => {
                            const emailBad = a.email.trim() !== '' && !EMAIL_RE.test(a.email.trim());
                            return (
                                <div key={idx} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.3fr_auto] sm:items-center">
                                    <input
                                        type="text"
                                        value={a.name}
                                        onChange={(e) => update(idx, 'name', e.target.value)}
                                        placeholder="Nombre (ej: Juan Pérez)"
                                        maxLength={120}
                                        className={clInput}
                                    />
                                    <input
                                        type="email"
                                        value={a.email}
                                        onChange={(e) => update(idx, 'email', e.target.value)}
                                        placeholder="correo@bacarsa.com.ar"
                                        maxLength={190}
                                        className={`${clInput} ${emailBad ? 'border-red-300 focus:border-red-400' : ''}`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => remove(idx)}
                                        className="inline-flex items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                        title="Quitar"
                                        aria-label="Quitar autorizante"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                    {draft.length < MAX_AUTHORIZERS && (
                        <button
                            type="button"
                            onClick={() => setDraft((prev) => [...prev, { name: '', email: '' }])}
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2B6CB0] hover:underline"
                        >
                            <Plus className="h-4 w-4" />
                            Agregar autorizante
                        </button>
                    )}
                    <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !dirty || invalid}
                            className="px-5 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Guardando...' : 'Guardar autorizantes'}
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

export default EquipmentAuthorizersSettings;
