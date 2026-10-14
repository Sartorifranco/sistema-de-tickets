import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Laptop, Plus, Trash2, Users, X } from 'lucide-react';
import api from '../../config/axiosConfig';
import { clCard, clInput } from '../../utils/cleanLightUi';

interface Authorizer {
    name: string;
    email: string;
}

interface Department {
    id: number;
    name: string;
    company_name: string | null;
    users_count: number;
}

interface DepartmentRule {
    department_id: number;
    authorizers: Authorizer[];
}

interface SettingsData {
    authorizers: Authorizer[];
    by_department: DepartmentRule[];
    departments: Department[];
}

const MAX_AUTHORIZERS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY: Authorizer = { name: '', email: '' };

function cleanList(list: Authorizer[]): Authorizer[] {
    return list
        .map((a) => ({ name: a.name.trim(), email: a.email.trim().toLowerCase() }))
        .filter((a) => a.name || a.email);
}

function departmentLabel(d: Department | undefined): string {
    if (!d) return 'Área eliminada';
    return d.company_name ? `${d.name} · ${d.company_name}` : d.name;
}

const AuthorizerRows: React.FC<{
    list: Authorizer[];
    onChange: (list: Authorizer[]) => void;
}> = ({ list, onChange }) => {
    const rows = list.length ? list : [EMPTY];
    const update = (idx: number, field: keyof Authorizer, value: string) =>
        onChange(rows.map((a, i) => (i === idx ? { ...a, [field]: value } : a)));
    const remove = (idx: number) => onChange(rows.filter((_, i) => i !== idx));

    return (
        <div className="space-y-2">
            {rows.map((a, idx) => {
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
            {rows.length < MAX_AUTHORIZERS && (
                <button
                    type="button"
                    onClick={() => onChange([...rows, { ...EMPTY }])}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[#2B6CB0] hover:underline"
                >
                    <Plus className="h-4 w-4" />
                    Agregar autorizante
                </button>
            )}
        </div>
    );
};

const EquipmentAuthorizersSettings: React.FC = () => {
    const [saved, setSaved] = useState<SettingsData | null>(null);
    const [general, setGeneral] = useState<Authorizer[]>([]);
    const [rules, setRules] = useState<DepartmentRule[]>([]);
    const [newDept, setNewDept] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);

    const apply = (data: SettingsData) => {
        setSaved(data);
        setGeneral(data.authorizers);
        setRules(data.by_department);
    };

    const load = useCallback(async () => {
        setLoading(true);
        setLoadError(null);
        try {
            const res = await api.get('/api/authorizations/settings');
            apply(res.data.data);
        } catch (err: any) {
            setLoadError(err.response?.data?.message || 'No se pudo cargar la configuración.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const departments = useMemo(() => saved?.departments || [], [saved]);
    const deptById = useMemo(() => {
        const m = new Map<number, Department>();
        departments.forEach((d) => m.set(d.id, d));
        return m;
    }, [departments]);
    const availableDepts = departments.filter((d) => !rules.some((r) => r.department_id === d.id));

    const payload = {
        authorizers: cleanList(general),
        by_department: rules.map((r) => ({ department_id: r.department_id, authorizers: cleanList(r.authorizers) })),
    };
    const savedPayload = saved
        ? {
              authorizers: cleanList(saved.authorizers),
              by_department: saved.by_department.map((r) => ({ department_id: r.department_id, authorizers: cleanList(r.authorizers) })),
          }
        : null;
    const dirty = JSON.stringify(payload) !== JSON.stringify(savedPayload);
    const invalid =
        payload.authorizers.some((a) => !EMAIL_RE.test(a.email)) ||
        payload.by_department.some((r) => r.authorizers.some((a) => !EMAIL_RE.test(a.email)));
    const emptyRule = payload.by_department.find((r) => r.authorizers.length === 0);

    const addRule = () => {
        const id = Number(newDept);
        if (!id) return;
        setRules((prev) => [...prev, { department_id: id, authorizers: [{ ...EMPTY }] }]);
        setNewDept('');
    };

    const handleSave = async () => {
        if (invalid) {
            toast.error('Revisá los correos: hay alguno incompleto o mal escrito.');
            return;
        }
        if (emptyRule) {
            toast.error(`El área ${departmentLabel(deptById.get(emptyRule.department_id))} no tiene autorizantes: cargalos o quitá el área.`);
            return;
        }
        setSaving(true);
        try {
            const res = await api.put('/api/authorizations/settings', payload);
            apply(res.data.data);
            toast.success('Autorizantes guardados.');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'No se pudieron guardar los autorizantes.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className={`${clCard} p-6 space-y-5`}>
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                    <Laptop className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-slate-900">Autorización de nuevo equipamiento</h2>
                    <p className="text-sm text-gray-600 mt-0.5 max-w-2xl">
                        Cuando alguien crea un ticket de &quot;Solicitud de nuevo equipamiento&quot;, se envía un correo a
                        los autorizantes del <strong>área del solicitante</strong>. Si esa área no tiene autorizantes
                        cargados, se usa la lista general. La primera respuesta es la que queda registrada en el ticket.
                    </p>
                </div>
            </div>

            {loading ? (
                <p className="text-sm text-gray-500">Cargando...</p>
            ) : loadError ? (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
            ) : (
                <>
                    <section className="space-y-3">
                        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Por área</h3>
                        {rules.length === 0 && (
                            <p className="text-sm text-gray-500">
                                Todavía no hay áreas con autorizante propio: todas las solicitudes van a la lista general.
                            </p>
                        )}
                        {rules.map((rule) => {
                            const dept = deptById.get(rule.department_id);
                            return (
                                <div key={rule.department_id} className="rounded-xl border border-gray-200 bg-gray-50/60 p-4 space-y-3">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <p className="font-semibold text-slate-900">{departmentLabel(dept)}</p>
                                            {dept && (
                                                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-gray-500">
                                                    <Users className="h-3.5 w-3.5" />
                                                    {dept.users_count} {dept.users_count === 1 ? 'usuario' : 'usuarios'} en esta área
                                                </p>
                                            )}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setRules((prev) => prev.filter((r) => r.department_id !== rule.department_id))}
                                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-red-50 hover:text-red-600"
                                        >
                                            <X className="h-3.5 w-3.5" />
                                            Quitar área
                                        </button>
                                    </div>
                                    <AuthorizerRows
                                        list={rule.authorizers}
                                        onChange={(list) =>
                                            setRules((prev) =>
                                                prev.map((r) => (r.department_id === rule.department_id ? { ...r, authorizers: list } : r))
                                            )
                                        }
                                    />
                                </div>
                            );
                        })}
                        {availableDepts.length > 0 && (
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <select value={newDept} onChange={(e) => setNewDept(e.target.value)} className={`${clInput} sm:max-w-md`}>
                                    <option value="">Elegí un área para asignarle autorizante…</option>
                                    <optgroup label="Áreas con usuarios">
                                        {availableDepts
                                            .filter((d) => d.users_count > 0)
                                            .map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {departmentLabel(d)} ({d.users_count} {d.users_count === 1 ? 'usuario' : 'usuarios'})
                                                </option>
                                            ))}
                                    </optgroup>
                                    <optgroup label="Áreas sin usuarios todavía">
                                        {availableDepts
                                            .filter((d) => d.users_count === 0)
                                            .map((d) => (
                                                <option key={d.id} value={d.id}>
                                                    {departmentLabel(d)}
                                                </option>
                                            ))}
                                    </optgroup>
                                </select>
                                <button
                                    type="button"
                                    onClick={addRule}
                                    disabled={!newDept}
                                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                                >
                                    <Plus className="h-4 w-4" />
                                    Agregar área
                                </button>
                            </div>
                        )}
                    </section>

                    <section className="space-y-3 border-t border-gray-100 pt-5">
                        <div>
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">General</h3>
                            <p className="text-xs text-gray-500 mt-0.5">
                                Reciben las solicitudes de las áreas sin autorizante propio y de usuarios sin área.
                            </p>
                        </div>
                        {cleanList(general).length === 0 && (
                            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                                Sin autorizante general, las solicitudes de áreas no configuradas quedan pendientes sin enviar correo.
                            </p>
                        )}
                        <AuthorizerRows list={general} onChange={setGeneral} />
                    </section>

                    <div className="pt-4 flex flex-wrap items-center gap-3 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={saving || !dirty || invalid}
                            className="px-5 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] disabled:bg-gray-300 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Guardando...' : 'Guardar autorizantes'}
                        </button>
                        {dirty && !saving && <span className="text-xs text-amber-700">Hay cambios sin guardar.</span>}
                    </div>
                </>
            )}
        </div>
    );
};

export default EquipmentAuthorizersSettings;
