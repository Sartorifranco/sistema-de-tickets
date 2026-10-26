import React from 'react';
import { MaintenanceTask } from '../../types';

export const MAINTENANCE_TASKS = [
    'Limpieza',
    'Clear RAM',
    'Reposición de pieza/cabezal/sensor',
    'Desatasco de billete/sobre',
    'Atención remota',
    'Otro',
];

export function emptyTasks(): MaintenanceTask[] {
    return MAINTENANCE_TASKS.map((name) => ({ name, done: false, comment: '' }));
}

export interface CompanionOption {
    id: number;
    name: string;
}

interface CrewProps {
    performedBy: 'bacar' | 'permaquim';
    companionUserId: string;
    agents: CompanionOption[];
    onPerformedBy: (value: 'bacar' | 'permaquim') => void;
    onCompanion: (id: string) => void;
}

export const RouteCrewBar: React.FC<CrewProps> = ({
    performedBy,
    companionUserId,
    agents,
    onPerformedBy,
    onCompanion,
}) => (
    <div className="bg-white border rounded-xl p-3 space-y-2">
        <p className="text-sm font-semibold text-slate-900">Quiénes hacen esta hoja</p>
        <p className="text-xs text-slate-500">El responsable es quien está logueado. El compañero queda en el mantenimiento y en el ticket de cada parada.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="text-xs text-slate-600">
                Realizado por
                <select
                    value={performedBy}
                    onChange={(event) => onPerformedBy(event.target.value as 'bacar' | 'permaquim')}
                    className="mt-1 w-full min-h-11 rounded-lg border bg-white px-2 text-base text-slate-900"
                >
                    <option value="bacar">Bacar</option>
                    <option value="permaquim">Permaquim</option>
                </select>
            </label>
            <label className="text-xs text-slate-600">
                Compañero
                <select
                    value={companionUserId}
                    onChange={(event) => onCompanion(event.target.value)}
                    className="mt-1 w-full min-h-11 rounded-lg border bg-white px-2 text-base text-slate-900"
                >
                    <option value="">Sin acompañante</option>
                    {agents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                    ))}
                </select>
            </label>
        </div>
    </div>
);

interface StopProps {
    counter: string;
    observations: string;
    tasks: MaintenanceTask[];
    done: boolean;
    ticketId?: number;
    finishing: boolean;
    onCounter: (value: string) => void;
    onObservations: (value: string) => void;
    onTasks: (tasks: MaintenanceTask[]) => void;
    onFinish: () => void;
}

const StopWorkFields: React.FC<StopProps> = ({
    counter,
    observations,
    tasks,
    done,
    ticketId,
    finishing,
    onCounter,
    onObservations,
    onTasks,
    onFinish,
}) => {
    if (done) {
        return (
            <p className="mt-2 text-sm font-semibold text-emerald-700">
                Cargado en Gestión de depositarios
                {ticketId ? ` · ticket #${ticketId}` : ''}.
            </p>
        );
    }

    const toggle = (index: number, doneTask: boolean) => {
        const next = tasks.map((task, taskIndex) => (
            taskIndex === index ? { ...task, done: doneTask, comment: doneTask ? task.comment : '' } : task
        ));
        onTasks(next);
    };

    return (
        <div className="mt-2 space-y-2">
            <label className="block text-xs font-semibold text-slate-600">
                Contador del cabezal
                <input
                    type="number"
                    inputMode="numeric"
                    placeholder="Lo que muestra el display"
                    value={counter}
                    onChange={(event) => onCounter(event.target.value)}
                    className="mt-1 w-full min-h-11 border rounded-lg px-2 text-base font-semibold"
                />
            </label>
            <div className="space-y-1">
                <p className="text-xs font-semibold text-slate-600">Tareas</p>
                {tasks.map((task, index) => (
                    <label key={task.name} className="flex items-center gap-2 min-h-10 text-sm text-slate-800">
                        <input
                            type="checkbox"
                            checked={task.done}
                            onChange={(event) => toggle(index, event.target.checked)}
                            className="w-5 h-5"
                        />
                        {task.name}
                    </label>
                ))}
            </div>
            <label className="block text-xs font-semibold text-slate-600">
                Observación
                <input
                    type="text"
                    placeholder="Opcional"
                    value={observations}
                    onChange={(event) => onObservations(event.target.value)}
                    className="mt-1 w-full min-h-11 border rounded-lg px-2 text-base"
                />
            </label>
            <button
                type="button"
                onClick={onFinish}
                disabled={finishing}
                className="w-full min-h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-50"
            >
                {finishing ? 'Guardando…' : 'Terminar parada'}
            </button>
        </div>
    );
};

export default StopWorkFields;
