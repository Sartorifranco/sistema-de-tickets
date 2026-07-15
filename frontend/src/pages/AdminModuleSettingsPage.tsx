import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { clCard } from '../utils/cleanLightUi';
import { useSystemModules } from '../context/SystemModulesContext';
import { SystemModuleKey } from '../constants/systemModules';

const AdminModuleSettingsPage: React.FC = () => {
    const { modules, loading, saveModules, refreshModules } = useSystemModules();
    const [draft, setDraft] = useState<Record<SystemModuleKey, boolean>>({} as Record<SystemModuleKey, boolean>);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const next = {} as Record<SystemModuleKey, boolean>;
        modules.forEach((m) => {
            next[m.key] = m.enabled;
        });
        setDraft(next);
    }, [modules]);

    const toggle = (key: SystemModuleKey) => {
        setDraft((prev) => ({ ...prev, [key]: !prev[key] }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await saveModules(draft);
            toast.success('Módulos actualizados. El menú se refresca para todos los usuarios.');
            await refreshModules();
        } catch {
            toast.error('No se pudieron guardar los cambios.');
        } finally {
            setSaving(false);
        }
    };

    const dirty = modules.some((m) => draft[m.key] !== m.enabled);

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
            <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Configuración de módulos</h1>
                <p className="text-sm text-gray-600 mt-2 max-w-2xl">
                    Elegí qué módulos se muestran en el menú. Los desmarcados quedan ocultos para todos los roles
                    (aunque el usuario tenga permiso). Dashboard, Tickets, Usuarios y Perfil siempre están visibles.
                </p>
            </div>

            <div className={`${clCard} p-6 space-y-4`}>
                {loading && modules.length === 0 ? (
                    <p className="text-gray-500">Cargando módulos...</p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {modules.map((mod) => (
                            <li key={mod.key} className="py-4 flex items-start gap-4">
                                <input
                                    id={`mod-${mod.key}`}
                                    type="checkbox"
                                    checked={draft[mod.key] !== false}
                                    onChange={() => toggle(mod.key)}
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-[#2B6CB0] focus:ring-[#2B6CB0]"
                                />
                                <label htmlFor={`mod-${mod.key}`} className="cursor-pointer flex-1 min-w-0">
                                    <span className="block font-semibold text-slate-900">{mod.label}</span>
                                    <span className="block text-sm text-gray-500 mt-0.5">{mod.description}</span>
                                </label>
                                <span
                                    className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${
                                        draft[mod.key] !== false
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-gray-100 text-gray-500'
                                    }`}
                                >
                                    {draft[mod.key] !== false ? 'Visible' : 'Oculto'}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <div className="pt-4 flex flex-wrap gap-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || !dirty}
                        className="px-5 py-2.5 rounded-xl bg-[#DC2626] text-white font-semibold hover:bg-[#B91C1C] disabled:bg-gray-300 disabled:cursor-not-allowed"
                    >
                        {saving ? 'Guardando...' : 'Guardar cambios'}
                    </button>
                    <button
                        type="button"
                        onClick={() => refreshModules()}
                        className="px-5 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-700 font-medium hover:bg-gray-50"
                    >
                        Recargar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdminModuleSettingsPage;
