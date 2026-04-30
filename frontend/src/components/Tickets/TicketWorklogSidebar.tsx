import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/axiosConfig';
import { TicketStatus } from '../../types';
import {
    isDesarrolloDepartmentName,
    isTruthyInternalTask,
} from '../../utils/ticketAccess';
import { clCard, clInput } from '../../utils/cleanLightUi';

export interface TicketWorklogSidebarProps {
    ticketId: number;
    horasReales: number | string | null | undefined;
    status: TicketStatus;
    /** Nombre del departamento (join API), p. ej. para detectar Desarrollo */
    departmentName?: string | null;
    esTareaInterna?: boolean | number | string | null;
    disabled?: boolean;
    onSaved: () => void;
}

function normalizeHoursInput(raw: string): string {
    return raw.trim().replace(',', '.');
}

/** Comparación laxa entre valor local y el guardado en servidor */
function hoursChanged(local: string, server: number | string | null | undefined): boolean {
    const l = normalizeHoursInput(local);
    if (l === '') {
        return server !== undefined && server !== null && server !== '';
    }
    const ln = parseFloat(l);
    if (!Number.isFinite(ln)) return true;
    if (server === undefined || server === null || server === '') return true;
    const sn = typeof server === 'number' ? server : parseFloat(String(server).replace(',', '.'));
    if (!Number.isFinite(sn)) return true;
    return Math.abs(ln - sn) > 1e-6;
}

/**
 * Bloque lateral para registrar horas reales sin abrir el modal de edición.
 * Resalta en ámbar si el ticket es de Desarrollo y está en progreso (recordatorio antes de finalizar).
 */
const TicketWorklogSidebar: React.FC<TicketWorklogSidebarProps> = ({
    ticketId,
    horasReales,
    status,
    departmentName,
    esTareaInterna,
    disabled = false,
    onSaved,
}) => {
    const [value, setValue] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const v = horasReales;
        if (v === undefined || v === null || v === '') {
            setValue('');
        } else {
            setValue(String(v));
        }
    }, [ticketId, horasReales]);

    const isDevDept = isDesarrolloDepartmentName(departmentName ?? undefined);
    const isInternal = isTruthyInternalTask(esTareaInterna);
    const highlightReminder =
        status === 'in-progress' && (isDevDept || isInternal);

    const persist = async () => {
        if (disabled || saving) return;
        const normalized = normalizeHoursInput(value);
        if (normalized !== '' && !Number.isFinite(parseFloat(normalized))) {
            toast.warn('Ingresá un número válido de horas.');
            return;
        }
        const num = normalized === '' ? null : parseFloat(normalized);
        if (num !== null && num < 0) {
            toast.warn('Las horas no pueden ser negativas.');
            return;
        }

        setSaving(true);
        try {
            await api.put(`/api/tickets/${ticketId}`, {
                horas_reales: num,
            });
            toast.success('Horas reales guardadas.');
            onSaved();
        } catch {
            toast.error('No se pudieron guardar las horas reales.');
        } finally {
            setSaving(false);
        }
    };

    const handleBlur = () => {
        if (disabled || saving) return;
        if (hoursChanged(value, horasReales)) {
            void persist();
        }
    };

    return (
        <div className={`${clCard} p-6`}>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Registro de trabajo</h2>
            <p className="text-xs text-gray-500 mb-4">Horas reales dedicadas al ticket</p>
            <div
                className={
                    highlightReminder
                        ? 'rounded-md p-2 border-2 border-amber-300 bg-amber-50/70 ring-1 ring-amber-200/80'
                        : 'rounded-md p-2 border border-gray-200 bg-gray-50/50'
                }
            >
                {highlightReminder && (
                    <p className="text-xs text-amber-900/90 mb-2 font-medium">
                        {isDevDept
                            ? 'Desarrollo en curso: registrá las horas antes de marcar como resuelto.'
                            : 'Tarea interna en curso: registrá las horas antes de marcar como resuelto.'}
                    </p>
                )}
                <label htmlFor={`worklog-horas-${ticketId}`} className="block text-sm font-medium text-gray-700 mb-1">
                    Horas reales
                </label>
                <div className="flex gap-2 items-center">
                    <input
                        id={`worklog-horas-${ticketId}`}
                        type="number"
                        step={0.5}
                        min={0}
                        disabled={disabled}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onBlur={handleBlur}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                void persist();
                            }
                        }}
                        className={`flex-1 min-w-0 ${clInput} disabled:bg-gray-50 disabled:text-gray-500`}
                        placeholder="0"
                    />
                    <button
                        type="button"
                        onClick={() => void persist()}
                        disabled={disabled || saving}
                        title="Guardar horas"
                        className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-md border border-gray-300 bg-white hover:bg-gray-50 text-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label="Guardar horas reales"
                    >
                        {saving ? (
                            <span className="text-xs text-gray-500">…</span>
                        ) : (
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketWorklogSidebar;
