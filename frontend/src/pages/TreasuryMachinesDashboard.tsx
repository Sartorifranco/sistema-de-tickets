import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import {
    MachineMaintenance,
    TreasuryMachine,
    TreasuryMachineStatus,
    TreasuryMachinesStats,
} from '../types';
import { clCard, clInput, clModalPanel, clTd, clTh, clThRight } from '../utils/cleanLightUi';
import { formatLocalDate } from '../utils/dateFormatter';
import { hasPermission } from '../utils/permissions';
import { PERMISSION_KEYS as P } from '../constants/permissions';

const URBANIST: React.CSSProperties = {
    fontFamily: "'Urbanist', ui-sans-serif, system-ui, sans-serif",
    fontWeight: 500,
};

const MACHINE_TYPES = ['Contadora', 'Clasificadora', 'Ensachetadora', 'Selladora', 'Otra'] as const;
const STATUS_LABELS: Record<TreasuryMachineStatus, string> = {
    operativa: 'Operativa',
    reparacion: 'En reparación',
    baja: 'Dada de baja',
};

function statusBadgeClass(status: TreasuryMachineStatus): string {
    switch (status) {
        case 'operativa':
            return 'bg-emerald-100 text-emerald-800 border-emerald-200';
        case 'reparacion':
            return 'bg-red-100 text-red-800 border-red-200';
        case 'baja':
        default:
            return 'bg-slate-100 text-slate-700 border-slate-200';
    }
}

interface MachineFormModalProps {
    isOpen: boolean;
    initial: TreasuryMachine | null;
    onClose: () => void;
    onSaved: () => void;
}

const MachineFormModal: React.FC<MachineFormModalProps> = ({ isOpen, initial, onClose, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        type: 'Contadora' as string,
        brand: 'Glory',
        model: '',
        serial_number: '',
        location: '',
        counted_bills: '',
        status: 'operativa' as TreasuryMachineStatus,
    });

    useEffect(() => {
        if (!isOpen) return;
        if (initial) {
            setForm({
                type: initial.type,
                brand: initial.brand || 'Glory',
                model: initial.model,
                serial_number: initial.serial_number,
                location: initial.location,
                counted_bills:
                    initial.counted_bills !== null && initial.counted_bills !== undefined
                        ? String(initial.counted_bills)
                        : '',
                status: initial.status,
            });
        } else {
            setForm({
                type: 'Contadora',
                brand: 'Glory',
                model: '',
                serial_number: '',
                location: '',
                counted_bills: '',
                status: 'operativa',
            });
        }
    }, [isOpen, initial]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.model.trim() || !form.serial_number.trim() || !form.location.trim()) {
            toast.warn('Completá modelo, número de serie y ubicación.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                type: form.type,
                brand: form.brand || 'Glory',
                model: form.model.trim(),
                serial_number: form.serial_number.trim(),
                location: form.location.trim(),
                counted_bills: form.counted_bills === '' ? null : parseInt(form.counted_bills, 10),
                status: form.status,
            };
            if (initial?.id) {
                await api.put(`/api/treasury-machines/${initial.id}`, payload);
                toast.success('Máquina actualizada.');
            } else {
                await api.post('/api/treasury-machines', payload);
                toast.success('Máquina registrada.');
            }
            onSaved();
            onClose();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al guardar.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" style={URBANIST}>
            <div className={`${clModalPanel} max-w-lg w-full p-6`}>
                <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontWeight: 700 }}>
                    {initial ? 'Editar máquina' : 'Alta de máquina'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo *</label>
                        <select
                            name="type"
                            value={form.type}
                            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                            className={clInput}
                            required
                        >
                            {MACHINE_TYPES.map((t) => (
                                <option key={t} value={t}>
                                    {t}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Marca</label>
                            <input
                                type="text"
                                value={form.brand}
                                onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                                className={clInput}
                                placeholder="Glory"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Modelo *</label>
                            <input
                                type="text"
                                value={form.model}
                                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                                className={clInput}
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Nº de serie *</label>
                        <input
                            type="text"
                            value={form.serial_number}
                            onChange={(e) => setForm((f) => ({ ...f, serial_number: e.target.value }))}
                            className={clInput}
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Ubicación *</label>
                        <input
                            type="text"
                            value={form.location}
                            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                            className={clInput}
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">
                                Billetes contados <span className="text-gray-400 font-normal">(opcional)</span>
                            </label>
                            <input
                                type="number"
                                min={0}
                                value={form.counted_bills}
                                onChange={(e) => setForm((f) => ({ ...f, counted_bills: e.target.value }))}
                                className={clInput}
                                placeholder="—"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Estado *</label>
                            <select
                                value={form.status}
                                onChange={(e) =>
                                    setForm((f) => ({
                                        ...f,
                                        status: e.target.value as TreasuryMachineStatus,
                                    }))
                                }
                                className={clInput}
                                required
                            >
                                {(Object.keys(STATUS_LABELS) as TreasuryMachineStatus[]).map((s) => (
                                    <option key={s} value={s}>
                                        {STATUS_LABELS[s]}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                            style={{ fontWeight: 600 }}
                        >
                            {loading ? 'Guardando...' : 'Guardar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface MaintenanceFormModalProps {
    isOpen: boolean;
    machine: TreasuryMachine | null;
    onClose: () => void;
    onSaved: () => void;
}

const MaintenanceFormModal: React.FC<MaintenanceFormModalProps> = ({ isOpen, machine, onClose, onSaved }) => {
    const [loading, setLoading] = useState(false);
    const [form, setForm] = useState({
        maintenance_type: 'preventivo' as 'preventivo' | 'correctivo',
        observations: '',
        new_status: 'operativa' as TreasuryMachineStatus,
    });

    useEffect(() => {
        if (!isOpen || !machine) return;
        setForm({
            maintenance_type: 'preventivo',
            observations: '',
            new_status: machine.status,
        });
    }, [isOpen, machine]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!machine) return;
        if (!form.observations.trim()) {
            toast.warn('Las observaciones son obligatorias.');
            return;
        }
        setLoading(true);
        try {
            await api.post(`/api/treasury-machines/${machine.id}/maintenances`, form);
            toast.success('Mantenimiento registrado. Estado de máquina actualizado.');
            onSaved();
            onClose();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al registrar mantenimiento.';
            toast.error(msg);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !machine) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" style={URBANIST}>
            <div className={`${clModalPanel} max-w-lg w-full p-6`}>
                <h2 className="text-xl font-bold text-gray-900 mb-1" style={{ fontWeight: 700 }}>
                    Registrar mantenimiento
                </h2>
                <p className="text-sm text-gray-600 mb-4">
                    {machine.type} — S/N {machine.serial_number} (estado actual:{' '}
                    {STATUS_LABELS[machine.status]})
                </p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Tipo de mantenimiento *</label>
                        <select
                            value={form.maintenance_type}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    maintenance_type: e.target.value as 'preventivo' | 'correctivo',
                                }))
                            }
                            className={clInput}
                            required
                        >
                            <option value="preventivo">Preventivo</option>
                            <option value="correctivo">Correctivo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Estado resultante *</label>
                        <select
                            value={form.new_status}
                            onChange={(e) =>
                                setForm((f) => ({
                                    ...f,
                                    new_status: e.target.value as TreasuryMachineStatus,
                                }))
                            }
                            className={clInput}
                            required
                        >
                            {(Object.keys(STATUS_LABELS) as TreasuryMachineStatus[]).map((s) => (
                                <option key={s} value={s}>
                                    {STATUS_LABELS[s]}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-slate-500 mt-1">
                            Al guardar, el inventario pasará automáticamente a este estado.
                        </p>
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Observaciones *</label>
                        <textarea
                            value={form.observations}
                            onChange={(e) => setForm((f) => ({ ...f, observations: e.target.value }))}
                            className={`${clInput} min-h-[120px]`}
                            rows={4}
                            required
                            placeholder="Detalle del trabajo realizado, repuestos, tiempos..."
                        />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-4 py-2 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
                            style={{ fontWeight: 600 }}
                        >
                            {loading ? 'Guardando...' : 'Registrar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

interface HistoryModalProps {
    isOpen: boolean;
    machine: TreasuryMachine | null;
    onClose: () => void;
}

const HistoryModal: React.FC<HistoryModalProps> = ({ isOpen, machine, onClose }) => {
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<MachineMaintenance[]>([]);

    useEffect(() => {
        if (!isOpen || !machine) return;
        const load = async () => {
            setLoading(true);
            try {
                const res = await api.get(`/api/treasury-machines/${machine.id}/maintenances`);
                setRows(res.data.data || []);
            } catch {
                toast.error('No se pudo cargar el historial.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [isOpen, machine]);

    if (!isOpen || !machine) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" style={URBANIST}>
            <div className={`${clModalPanel} max-w-3xl w-full p-6 max-h-[90vh] overflow-y-auto`}>
                <div className="flex justify-between items-start mb-4 border-b pb-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900" style={{ fontWeight: 700 }}>
                            Historial de mantenimientos
                        </h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {machine.type} — {machine.model} — S/N {machine.serial_number}
                        </p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-500 hover:text-gray-800 text-2xl">
                        ×
                    </button>
                </div>
                {loading ? (
                    <p className="text-center py-8 text-gray-500">Cargando...</p>
                ) : rows.length === 0 ? (
                    <p className="text-center py-8 text-gray-500">Sin mantenimientos registrados.</p>
                ) : (
                    <div className="space-y-3">
                        {rows.map((r) => (
                            <div key={r.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/80">
                                <div className="flex flex-wrap justify-between gap-2 mb-2">
                                    <span className="text-sm font-semibold text-gray-900 capitalize" style={{ fontWeight: 600 }}>
                                        {r.maintenance_type}
                                    </span>
                                    <span className="text-xs text-gray-500">{formatLocalDate(r.created_at)}</span>
                                </div>
                                <p className="text-sm text-gray-700 mb-2">{r.observations}</p>
                                <div className="flex flex-wrap gap-2 text-xs">
                                    <span className={`px-2 py-0.5 rounded-full border ${statusBadgeClass(r.previous_status)}`}>
                                        {STATUS_LABELS[r.previous_status]} →
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full border ${statusBadgeClass(r.new_status)}`}>
                                        {STATUS_LABELS[r.new_status]}
                                    </span>
                                    {r.user_name && (
                                        <span className="text-gray-500 ml-auto">Por: {r.user_name}</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const TreasuryMachinesDashboard: React.FC = () => {
    const { user } = useAuth();
    const canManage = hasPermission(user, P.TREASURY_MACHINES_MANAGE);

    const [machines, setMachines] = useState<TreasuryMachine[]>([]);
    const [stats, setStats] = useState<TreasuryMachinesStats>({
        operativa: 0,
        reparacion: 0,
        baja: 0,
        byType: [],
    });
    const [loading, setLoading] = useState(true);

    const [machineModal, setMachineModal] = useState<TreasuryMachine | null | 'new'>(null);
    const [maintenanceMachine, setMaintenanceMachine] = useState<TreasuryMachine | null>(null);
    const [historyMachine, setHistoryMachine] = useState<TreasuryMachine | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get('/api/treasury-machines');
            setMachines(res.data.data || []);
            setStats(
                res.data.stats || { operativa: 0, reparacion: 0, baja: 0, byType: [] }
            );
        } catch {
            toast.error('No se pudo cargar el inventario de máquinas.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleDelete = async (m: TreasuryMachine) => {
        if (!window.confirm(`¿Eliminar la máquina S/N ${m.serial_number}?`)) return;
        try {
            await api.delete(`/api/treasury-machines/${m.id}`);
            toast.success('Máquina eliminada.');
            fetchData();
        } catch (err: unknown) {
            const msg =
                (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
                'Error al eliminar.';
            toast.error(msg);
        }
    };

    const totalByType = stats.byType?.reduce((acc, row) => acc + Number(row.count), 0) || 0;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-h-screen" style={URBANIST}>
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight" style={{ fontWeight: 700 }}>
                        Gestión de Máquinas de Tesorería
                    </h1>
                    <p className="text-sm text-gray-600 mt-1">Contadoras, clasificadoras, ensachetadoras, selladoras y más.</p>
                </div>
                {canManage && (
                    <button
                        type="button"
                        onClick={() => setMachineModal('new')}
                        className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm self-start"
                        style={{ fontWeight: 600 }}
                    >
                        Nueva máquina
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className={`${clCard} p-5 border-l-4 border-emerald-500`}>
                    <p className="text-sm font-semibold text-gray-600" style={{ fontWeight: 600 }}>
                        Operativas
                    </p>
                    <p className="text-3xl font-bold text-emerald-700 mt-1" style={{ fontWeight: 700 }}>
                        {stats.operativa}
                    </p>
                </div>
                <div className={`${clCard} p-5 border-l-4 border-red-600`}>
                    <p className="text-sm font-semibold text-gray-600" style={{ fontWeight: 600 }}>
                        En reparación
                    </p>
                    <p className="text-3xl font-bold text-red-700 mt-1" style={{ fontWeight: 700 }}>
                        {stats.reparacion}
                    </p>
                </div>
                <div className={`${clCard} p-5 border-l-4 border-slate-400`}>
                    <p className="text-sm font-semibold text-gray-600" style={{ fontWeight: 600 }}>
                        Dadas de baja
                    </p>
                    <p className="text-3xl font-bold text-slate-700 mt-1" style={{ fontWeight: 700 }}>
                        {stats.baja}
                    </p>
                </div>
            </div>

            <div className={`${clCard} p-5 mb-6`}>
                <h2 className="text-lg font-bold text-gray-900 mb-3" style={{ fontWeight: 600 }}>
                    Cantidad por tipo de máquina
                </h2>
                {stats.byType.length === 0 ? (
                    <p className="text-sm text-gray-500">Sin máquinas registradas.</p>
                ) : (
                    <div className="space-y-2">
                        {stats.byType.map((row) => {
                            const pct = totalByType > 0 ? Math.round((Number(row.count) / totalByType) * 100) : 0;
                            return (
                                <div key={row.type}>
                                    <div className="flex justify-between text-sm mb-1">
                                        <span className="font-semibold text-gray-800">{row.type}</span>
                                        <span className="text-gray-600">
                                            {row.count} ({pct}%)
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-red-500 rounded-full transition-all"
                                            style={{ width: `${pct}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <div className={`${clCard} overflow-hidden`}>
                {loading ? (
                    <p className="p-8 text-center text-gray-500">Cargando inventario...</p>
                ) : machines.length === 0 ? (
                    <p className="p-8 text-center text-gray-500">No hay máquinas en el inventario.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-100">
                            <thead className="bg-gray-50/80">
                                <tr>
                                    <th className={clTh}>Tipo</th>
                                    <th className={clTh}>Modelo</th>
                                    <th className={clTh}>S/N</th>
                                    <th className={clTh}>Ubicación</th>
                                    <th className={clTh}>Billetes</th>
                                    <th className={clTh}>Estado</th>
                                    <th className={clThRight}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {machines.map((m) => (
                                    <tr key={m.id} className="hover:bg-gray-50/50">
                                        <td className={clTd}>{m.type}</td>
                                        <td className={clTd}>
                                            <span className="text-gray-500 text-xs block">{m.brand}</span>
                                            {m.model}
                                        </td>
                                        <td className={clTd}>{m.serial_number}</td>
                                        <td className={clTd}>{m.location}</td>
                                        <td className={clTd}>
                                            {m.counted_bills != null ? m.counted_bills.toLocaleString() : '—'}
                                        </td>
                                        <td className={clTd}>
                                            <span
                                                className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadgeClass(m.status)}`}
                                            >
                                                {STATUS_LABELS[m.status]}
                                            </span>
                                        </td>
                                        <td className={`${clTd} text-right whitespace-nowrap`}>
                                            <button
                                                type="button"
                                                onClick={() => setHistoryMachine(m)}
                                                className="text-slate-700 hover:text-slate-900 font-semibold text-sm mr-3"
                                            >
                                                Historial
                                            </button>
                                            {canManage && (
                                                <>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMaintenanceMachine(m)}
                                                        className="text-blue-700 hover:text-blue-900 font-semibold text-sm mr-3"
                                                    >
                                                        Mantenimiento
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setMachineModal(m)}
                                                        className="text-indigo-600 hover:text-indigo-900 font-semibold text-sm mr-3"
                                                    >
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleDelete(m)}
                                                        className="text-red-600 hover:text-red-800 font-semibold text-sm"
                                                    >
                                                        Eliminar
                                                    </button>
                                                </>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <MachineFormModal
                isOpen={machineModal !== null}
                initial={machineModal === 'new' ? null : machineModal}
                onClose={() => setMachineModal(null)}
                onSaved={fetchData}
            />
            <MaintenanceFormModal
                isOpen={!!maintenanceMachine}
                machine={maintenanceMachine}
                onClose={() => setMaintenanceMachine(null)}
                onSaved={fetchData}
            />
            <HistoryModal
                isOpen={!!historyMachine}
                machine={historyMachine}
                onClose={() => setHistoryMachine(null)}
            />
        </div>
    );
};

export default TreasuryMachinesDashboard;
