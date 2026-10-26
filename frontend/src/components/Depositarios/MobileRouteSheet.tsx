import React, { useState } from 'react';
import { MaintenanceTask } from '../../types';
import { RouteSheet, formatDuration, weekdayLabel } from './routePlanner';
import RouteCalendar from './RouteCalendar';
import StopWorkFields, { CompanionOption, RouteCrewBar } from './StopWorkFields';
import RouteMap from './RouteMap';

export interface AddableUnit {
    id: number;
    alias: string;
    companyName: string;
    address: string;
    daysLabel: string;
    minutes: number | null;
    hasGps: boolean;
}

export interface PickerUnit {
    id: number;
    alias: string;
    companyName: string;
    hasGps: boolean;
}

export interface WeekPlanProps {
    today: number;
    focusDay: number;
    plans: Record<number, number[]>;
    companies: [number, string][];
    units: PickerUnit[];
    checkedIds: number[];
    source: 'programado' | 'automatico';
    saving: boolean;
    planDirty: boolean;
    banner: string;
    onSelectDay: (day: number) => boolean | void;
    onToggleUnit: (id: number) => void;
    onSave: () => void;
    onUseAutomatic: () => void;
    onUseProgrammed: () => void;
}

export const WeekPlanControls: React.FC<WeekPlanProps & { dense?: boolean }> = ({
    focusDay,
    plans,
    units,
    checkedIds,
    source,
    saving,
    planDirty,
    banner,
    onToggleUnit,
    onSave,
    onUseAutomatic,
    onUseProgrammed,
    dense,
}) => {
    const saved = (plans[focusDay] || []).length > 0;
    const chosen = new Set(checkedIds);
    const groups: { name: string; units: PickerUnit[] }[] = [];
    units.forEach((unit) => {
        const name = unit.companyName || 'Sin cliente';
        let group = groups.find((item) => item.name === name);
        if (!group) {
            group = { name, units: [] };
            groups.push(group);
        }
        group.units.push(unit);
    });
    groups.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    groups.forEach((group) => group.units.sort((a, b) => a.alias.localeCompare(b.alias, 'es')));

    return (
        <div className={dense ? 'space-y-3' : 'space-y-2'}>
            <p className={`${dense ? 'text-sm' : 'text-xs'} text-slate-700`}>{banner}</p>
            <div className="border rounded-xl bg-white max-h-80 overflow-y-auto">
                <p className="px-3 pt-3 text-sm font-semibold text-slate-900">Elegí los depositarios</p>
                <p className="px-3 pb-2 text-xs text-slate-500">{chosen.size} elegidos. Están agrupados por cliente.</p>
                {groups.map((group) => (
                    <div key={group.name}>
                        <p className="sticky top-0 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{group.name}</p>
                        {group.units.map((unit) => (
                            <label key={unit.id} className={`flex items-center gap-3 px-3 min-h-11 border-t text-sm ${unit.hasGps ? 'text-slate-900' : 'text-slate-400'}`}>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5"
                                    checked={chosen.has(unit.id)}
                                    disabled={!unit.hasGps}
                                    onChange={() => onToggleUnit(unit.id)}
                                />
                                <span className="font-medium">{unit.alias}</span>
                                {!unit.hasGps && <span className="text-xs text-red-600">sin GPS</span>}
                            </label>
                        ))}
                    </div>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !planDirty}
                    className="min-h-11 px-3 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                    {saving ? 'Guardando…' : `Guardar hoja fija del ${weekdayLabel(focusDay)}`}
                </button>
                <button type="button" onClick={onUseAutomatic} className="min-h-11 px-3 rounded-lg border bg-white text-sm font-semibold">
                    Hoja automática
                </button>
                {saved && source === 'automatico' && (
                    <button type="button" onClick={onUseProgrammed} className="min-h-11 px-3 rounded-lg border bg-white text-sm font-semibold">
                        Volver a lo programado
                    </button>
                )}
            </div>
        </div>
    );
};

interface MobileProps extends WeekPlanProps {
    onClose: () => void;
    unitCount: number;
    stopCount: number;
    totalLabel: string;
    distanceLabel: string;
    backAtBase: string;
    overBudget: boolean;
    roadPending: boolean;
    timeSource: string;
    query: string;
    onQuery: (value: string) => void;
    onSearchEnter: () => void;
    matches: AddableUnit[];
    onAddMatch: (id: number) => void;
    serviceMin: number;
    startTime: string;
    onServiceMin: (minutes: number) => void;
    onStartTime: (value: string) => void;
    sheet: RouteSheet;
    mapPoints: [number, number][];
    selectedIds: number[];
    onRemove: (id: number) => void;
    onShift: (id: number, direction: -1 | 1) => void;
    onDraft: (id: number, field: 'bill_counter' | 'observations', value: string) => void;
    onTasks: (id: number, tasks: MaintenanceTask[]) => void;
    tasksFor: (id: number) => MaintenanceTask[];
    onFinishStop: (id: number) => void;
    finishingId: number | null;
    ticketByStop: Record<number, number>;
    planLabels: Record<number, string>;
    pendingCounts: Record<string, number>;
    carryover: { id: number; alias: string; companyName: string }[];
    carryoverFromLabel: string;
    pickedLabel: string;
    onPickDate: (date: Date) => boolean | void;
    performedBy: 'bacar' | 'permaquim';
    companionUserId: string;
    agents: CompanionOption[];
    onPerformedBy: (value: 'bacar' | 'permaquim') => void;
    onCompanion: (id: string) => void;
    onSaveRoute: () => void;
    onPdf: () => void;
    onFinalize: () => void;
    sending: boolean;
    routeId: number | null;
    closeLabel?: string;
}

const SERVICE_CHOICES = [10, 15, 20, 30];

function legText(travelMin: number, km: number, index: number): string {
    if (travelMin < 1 && index > 0) return 'Mismo lugar';
    return `${formatDuration(travelMin)} de viaje · ${km.toFixed(1)} km${index === 0 ? ' desde central' : ''}`;
}

const MobileRouteSheet: React.FC<MobileProps> = (props) => {
    const [tab, setTab] = useState<'ruta' | 'mapa'>('ruta');
    const [detailOpen, setDetailOpen] = useState(false);
    const dayName = weekdayLabel(props.focusDay);
    const driveOut = Math.max(0, props.sheet.driveMin - props.sheet.returnMin);

    const openDay = (date: Date) => {
        const accepted = props.onPickDate(date);
        if (accepted === false) return;
        setTab('ruta');
        setDetailOpen(true);
    };

    if (!detailOpen) {
        return (
            <div className="fixed inset-0 z-[1050] bg-slate-100 flex flex-col">
                <header className="bg-slate-900 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Recorridos</p>
                            <h1 className="text-2xl font-bold">Hojas fijas</h1>
                            <p className="text-sm text-slate-300 mt-1">Cada día muestra la hoja de esa semana. Tocá uno para verla o cambiarla.</p>
                        </div>
                        <button type="button" onClick={props.onClose} className="min-h-11 px-2 text-sm font-semibold text-slate-200">
                            {props.closeLabel || 'Cerrar'}
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                    <RouteCalendar
                        plans={props.plans}
                        labels={props.planLabels}
                        focusDay={props.focusDay}
                        pendingCounts={props.pendingCounts}
                        onPick={openDay}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[1050] bg-slate-100 flex flex-col">
            <header className="bg-slate-900 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <button type="button" onClick={() => setDetailOpen(false)} className="text-xs font-semibold text-slate-300 mb-1">
                            ‹ Calendario
                        </button>
                        <p className="text-xs uppercase tracking-wide text-slate-400 capitalize">{props.pickedLabel}</p>
                        <h1 className="text-lg font-bold">Hoja del {dayName}</h1>
                        <p className="text-xs text-slate-300 mt-0.5">
                            Se repite cada {dayName} · {props.unitCount} equipos · {props.stopCount} paradas
                            {props.routeId ? ` · #${props.routeId}` : ''}
                        </p>
                    </div>
                    <button type="button" onClick={props.onClose} className="min-h-11 px-2 text-sm font-semibold text-slate-200">
                        {props.closeLabel || 'Cerrar'}
                    </button>
                </div>
                <div className={`text-4xl font-bold mt-2 ${props.overBudget ? 'text-red-400' : 'text-emerald-400'}`}>
                    {props.totalLabel}
                </div>
                <p className="text-xs text-slate-200 mt-1">
                    {formatDuration(driveOut)} de viaje · {formatDuration(props.sheet.serviceMin)} en equipos · {formatDuration(props.sheet.returnMin)} de regreso
                </p>
                <p className="text-xs text-slate-400 mt-1">
                    Salida {props.sheet.startLabel} · de vuelta {props.backAtBase} · {props.distanceLabel}
                    {' · '}
                    {props.roadPending ? 'ajustando por calles…' : props.timeSource}
                </p>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === 'mapa' && (
                    <div className="h-full min-h-[70vh]">
                        <RouteMap sheet={props.sheet} mapPoints={props.mapPoints} overBudget={props.overBudget} />
                    </div>
                )}

                {tab === 'ruta' && (
                    <div className="p-4 space-y-3 pb-28">
                        {props.carryover.length > 0 && (
                            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
                                <p className="text-sm font-bold text-amber-950">Quedaron sin hacer {props.carryoverFromLabel}</p>
                                <p className="text-sm text-amber-900 mt-1">
                                    {props.carryover.length === 1
                                        ? '1 depositario pasa a este día. Hacelo primero.'
                                        : `${props.carryover.length} depositarios pasan a este día. Hacelos primero.`}
                                </p>
                                <ul className="mt-2 space-y-1">
                                    {props.carryover.map((item) => (
                                        <li key={item.id} className="text-sm text-amber-950">
                                            <span className="font-semibold">{item.alias}</span>
                                            <span className="text-amber-800"> · {item.companyName}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        <RouteCrewBar
                            performedBy={props.performedBy}
                            companionUserId={props.companionUserId}
                            agents={props.agents}
                            onPerformedBy={props.onPerformedBy}
                            onCompanion={props.onCompanion}
                        />
                        <WeekPlanControls {...props} dense />
                        <div className="bg-white border rounded-xl p-3">
                            <p className="text-sm font-semibold text-slate-900">Sumar un depositario</p>
                            <p className="text-xs text-slate-500 mt-0.5 mb-2">Cualquiera del parque, esté o no en la sugerencia. Entra en el lugar del recorrido que menos alarga la hoja.</p>
                            <input
                                type="text"
                                value={props.query}
                                onChange={(event) => props.onQuery(event.target.value)}
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter') props.onSearchEnter();
                                }}
                                placeholder="Alias, empresa, dirección o serie"
                                className="w-full min-h-12 px-3 border rounded-xl text-base"
                            />
                            {props.matches.length > 0 && (
                                <div className="mt-2 border rounded-xl overflow-hidden">
                                    {props.matches.map((dep) => (
                                        <button
                                            key={dep.id}
                                            type="button"
                                            onClick={() => props.onAddMatch(dep.id)}
                                            className="w-full text-left px-3 py-3 border-b last:border-b-0 min-h-12"
                                        >
                                            <span className="font-semibold">{dep.alias}</span>
                                            <span className="text-slate-500 text-sm"> · {dep.companyName}</span>
                                            <span className="block text-xs text-slate-500 mt-0.5">
                                                {dep.address || 'Sin dirección'} · {dep.daysLabel}
                                                {dep.minutes !== null ? ` · suma ${formatDuration(dep.minutes)}` : ''}
                                                {!dep.hasGps ? ' · sin GPS' : ''}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <label className="flex-1 bg-white border rounded-xl px-3 py-2 text-xs text-slate-600">
                                Salida
                                <input
                                    type="time"
                                    value={props.startTime}
                                    onChange={(event) => props.onStartTime(event.target.value)}
                                    className="mt-1 w-full min-h-11 text-base text-slate-900"
                                />
                            </label>
                            <label className="flex-1 bg-white border rounded-xl px-3 py-2 text-xs text-slate-600">
                                Min por equipo
                                <select
                                    value={props.serviceMin}
                                    onChange={(event) => props.onServiceMin(Number(event.target.value))}
                                    className="mt-1 w-full min-h-11 text-base text-slate-900 bg-white"
                                >
                                    {SERVICE_CHOICES.map((minutes) => (
                                        <option key={minutes} value={minutes}>{minutes} min</option>
                                    ))}
                                </select>
                            </label>
                        </div>
                        {props.sheet.stops.length === 0 ? (
                            <p className="text-sm text-slate-500">Este día no tiene equipos. Marcalos en la lista de arriba y guardá la hoja fija.</p>
                        ) : (
                            props.sheet.stops.map((stop, stopIndex) => (
                                <article key={stop.key} className="bg-white border rounded-xl p-3 shadow-sm">
                                    <div className="flex justify-between gap-2 mb-1">
                                        <h2 className="font-bold text-slate-900">{stopIndex + 1}. {stop.companyName}</h2>
                                        <p className="text-xs text-slate-500 text-right">Llega {stop.arrivalLabel}<br />Sale {stop.departureLabel}</p>
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">
                                        {legText(stop.travelMin, stop.distanceFromPrevKm, stopIndex)}
                                        {' · '}
                                        {stop.serviceMin} min en el lugar
                                    </p>
                                    {stop.items.map((item) => {
                                        const index = props.selectedIds.indexOf(item.id);
                                        return (
                                            <div key={item.id} className="border-t py-3 first:border-t-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div>
                                                        <p className="font-semibold">{item.alias}</p>
                                                        <p className="text-xs text-slate-500">
                                                            {item.daysLabel}
                                                            {item.tickets > 0 ? ' · falla abierta' : ''}
                                                            {item.done ? ' · hecho hoy' : ''}
                                                        </p>
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <button type="button" disabled={index <= 0} onClick={() => props.onShift(item.id, -1)} className="min-h-11 min-w-11 border rounded-lg disabled:opacity-30">↑</button>
                                                        <button type="button" disabled={index < 0 || index >= props.selectedIds.length - 1} onClick={() => props.onShift(item.id, 1)} className="min-h-11 min-w-11 border rounded-lg disabled:opacity-30">↓</button>
                                                    </div>
                                                </div>
                                                <StopWorkFields
                                                    counter={item.bill_counter}
                                                    observations={item.observations}
                                                    tasks={props.tasksFor(item.id)}
                                                    done={item.done}
                                                    ticketId={props.ticketByStop[item.id]}
                                                    finishing={props.finishingId === item.id}
                                                    onCounter={(value) => props.onDraft(item.id, 'bill_counter', value)}
                                                    onObservations={(value) => props.onDraft(item.id, 'observations', value)}
                                                    onTasks={(tasks) => props.onTasks(item.id, tasks)}
                                                    onFinish={() => props.onFinishStop(item.id)}
                                                />
                                                <button type="button" onClick={() => props.onRemove(item.id)} className="mt-2 w-full min-h-11 rounded-lg border border-red-200 text-red-700 font-semibold">
                                                    Quitar de la hoja
                                                </button>
                                            </div>
                                        );
                                    })}
                                </article>
                            ))
                        )}
                        {props.sheet.stops.length > 0 && (
                            <p className="text-sm text-slate-600">Regreso a central · {formatDuration(props.sheet.returnMin)} · {props.sheet.backAtBase}</p>
                        )}
                    </div>
                )}
            </div>

            {tab === 'ruta' && (
                <div className="shrink-0 bg-white border-t px-3 py-2 flex gap-2">
                    <button type="button" onClick={props.onPdf} disabled={props.unitCount === 0} className="min-h-12 px-3 rounded-xl border font-bold disabled:opacity-40">
                        PDF
                    </button>
                    <button type="button" onClick={props.onSaveRoute} disabled={props.unitCount === 0} className="flex-1 min-h-12 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-40">
                        Iniciar
                    </button>
                    <button type="button" onClick={props.onFinalize} disabled={props.sending || props.unitCount === 0} className="flex-1 min-h-12 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-40">
                        {props.sending ? 'Enviando…' : 'Finalizar'}
                    </button>
                </div>
            )}

            <nav className="shrink-0 grid grid-cols-2 bg-white border-t pb-[env(safe-area-inset-bottom)]">
                {([
                    ['ruta', 'Recorrido'],
                    ['mapa', 'Mapa'],
                ] as const).map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => setTab(id)}
                        className={`min-h-14 text-sm font-semibold ${tab === id ? 'text-purple-700' : 'text-slate-500'}`}
                    >
                        {label}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default MobileRouteSheet;
