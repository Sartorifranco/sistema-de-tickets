import React, { useEffect, useState } from 'react';
import api from '../../config/axiosConfig';
import { User } from '../../types';
import {
    LIMITED_ADMIN_PRESET,
    PERMISSION_GROUPS,
    PermissionKey,
} from '../../constants/permissions';
import { clInput, clModalPanel } from '../../utils/cleanLightUi';
import { toast } from 'react-toastify';

interface UserPermissionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    targetUser: User | null;
    onSaved: () => void;
    canGrantSuperAdmin: boolean;
}

const UserPermissionsModal: React.FC<UserPermissionsModalProps> = ({
    isOpen,
    onClose,
    targetUser,
    onSaved,
    canGrantSuperAdmin,
}) => {
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [selected, setSelected] = useState<Set<PermissionKey>>(new Set());

    useEffect(() => {
        if (!isOpen || !targetUser) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/api/permissions/users/${targetUser.id}`);
                const data = res.data.data;
                setIsSuperAdmin(!!data.is_super_admin);
                setSelected(new Set((data.permissions || []) as PermissionKey[]));
            } catch {
                toast.error('No se pudieron cargar los permisos.');
                onClose();
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isOpen, targetUser, onClose]);

    const toggle = (key: PermissionKey) => {
        if (isSuperAdmin) return;
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const applyPreset = () => {
        setIsSuperAdmin(false);
        setSelected(new Set(LIMITED_ADMIN_PRESET));
    };

    const handleSave = async () => {
        if (!targetUser) return;
        setSaving(true);
        try {
            await api.put(`/api/permissions/users/${targetUser.id}`, {
                permissions: Array.from(selected),
                is_super_admin: isSuperAdmin,
            });
            toast.success('Permisos guardados.');
            onSaved();
            onClose();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al guardar permisos.';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen || !targetUser) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4">
            <div className={`${clModalPanel} max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6`}>
                <div className="flex justify-between items-start mb-4 border-b pb-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Permisos de administrador</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {targetUser.username} — definí qué secciones puede usar en el sistema.
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl leading-none">
                        ×
                    </button>
                </div>

                {loading ? (
                    <p className="text-center py-8 text-gray-600">Cargando permisos...</p>
                ) : (
                    <>
                        {canGrantSuperAdmin && (
                            <label className="flex items-center gap-2 mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={isSuperAdmin}
                                    onChange={(e) => setIsSuperAdmin(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <span className="text-sm font-medium text-amber-900">
                                    Super administrador (acceso total, ignora permisos individuales)
                                </span>
                            </label>
                        )}

                        {!isSuperAdmin && (
                            <>
                                <div className="flex flex-wrap gap-2 mb-4">
                                    <button
                                        type="button"
                                        onClick={applyPreset}
                                        className="text-sm px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100"
                                    >
                                        Perfil limitado (solo tickets)
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {PERMISSION_GROUPS.map((group) => (
                                        <div key={group.id} className="border border-slate-200 rounded-lg p-3">
                                            <p className="text-sm font-semibold text-slate-800 mb-2">{group.label}</p>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                {group.permissions.map((perm) => (
                                                    <label
                                                        key={perm.key}
                                                        className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer"
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={selected.has(perm.key)}
                                                            onChange={() => toggle(perm.key)}
                                                            className="rounded border-gray-300"
                                                        />
                                                        {perm.label}
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {isSuperAdmin && (
                            <p className="text-sm text-slate-600 mb-4">
                                Este usuario tiene acceso completo a todas las funciones de administración.
                            </p>
                        )}

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={saving}
                                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-60"
                            >
                                {saving ? 'Guardando...' : 'Guardar permisos'}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default UserPermissionsModal;
