import React, { useState } from 'react';
import { Depositario } from '../../types';
import { RouteSheet, WEEKDAYS, formatDuration, weekdayLabel } from './routePlanner';
import RouteMap from './RouteMap';

export interface WeekPlanProps {
    today: number;
    focusDay: number;
    plans: Record<number, number[]>;
    companies: [number, string][];
    source: 'programado' | 'automatico';
    saving: boolean;
    planDirty: boolean;
    banner: string;
    onSelectDay: (day: number) => void;
    onAddCompany: (companyId: number) => void;
    onSave: () => void;
    onUseAutomatic: () => void;
    onUseProgrammed: () => void;
}

export const WeekPlanControls: React.FC<WeekPlanProps & { dense?: boolean }> = ({
    today,
    focusDay,
    plans,
    companies,
    source,
    saving,
    planDirty,
    banner,
    onSelectDay,
    onAddCompany,
    onSave,
    onUseAutomatic,
    onUseProgrammed,
    dense,
}) => {
    const saved = (plans[focusDay] || []).length > 0;
    return (
        <div className={dense ? 'space-y-3' : 'space-y-2'}>
            <p className={`${dense ? 'text-sm' : 'text-xs'} text-slate-700`}>{banner}</p>
            <div className="grid grid-cols-7 gap-1">
                {WEEKDAYS.map((day) => {
                    const active = focusDay === day.id;
                    const hasPlan = (plans[day.id] || []).length > 0;
                    return (
                        <button
                            key={day.id}
                            type="button"
                            onClick={() => onSelectDay(day.id)}
                            className={`min-h-11 rounded-lg border text-xs font-semibold ${active ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700'}`}
                        >
                            {day.short}
                            <span className={`block text-[10px] font-normal ${active ? 'text-slate-300' : 'text-slate-400'}`}>
                                {day.id === today ? 'hoy' : hasPlan ? 'listo' : '—'}
                            </span>
                        </button>
                    );
                })}
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1">
                {companies.map(([id, name]) => (
                    <button
                        key={id}
                        type="button"
                        onClick={() => onAddCompany(id)}
                        className="shrink-0 min-h-11 px-3 rounded-full bg-white border border-purple-200 text-sm font-medium text-purple-900"
                    >
                        + {name}
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onSave}
                    disabled={saving || !planDirty}
                    className="min-h-11 px-3 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-40"
                >
                    {saving ? 'Guardando…' : `Dejar programado el ${weekdayLabel(focusDay)}`}
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
    matches: Depositario[];
    onAddMatch: (id: number) => void;
    sheet: RouteSheet;
    mapPoints: [number, number][];
    selectedIds: number[];
    onRemove: (id: number) => void;
    onShift: (id: number, direction: -1 | 1) => void;
    onRegister: (dep: Depositario) => void;
    onDraft: (id: number, field: 'bill_counter' | 'observations', value: string) => void;
    onSaveRoute: () => void;
    onPdf: () => void;
    onFinalize: () => void;
    sending: boolean;
    routeId: number | null;
    closeLabel?: string;
}

const MobileRouteSheet: React.FC<MobileProps> = (props) => {
    const [tab, setTab] = useState<'ruta' | 'programar' | 'mapa'>('ruta');
    const dayName = weekdayLabel(props.focusDay);

    return (
        <div className="fixed inset-0 z-[1050] bg-slate-100 flex flex-col">
            <header className="bg-slate-900 text-white px-4 pt-4 pb-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <p className="text-xs uppercase tracking-wide text-slate-400">
                            {props.focusDay === props.today ? 'Hoy' : 'Día'} · {dayName}
                        </p>
                        <h1 className="text-lg font-bold">Recorrido</h1>
                        <p className="text-xs text-slate-300 mt-0.5">
                            {props.unitCount} equipos · {props.stopCount} paradas
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
                <p className="text-xs text-slate-300 mt-1">
                    {props.distanceLabel} · de vuelta {props.backAtBase}
                    {' · '}
                    {props.roadPending ? 'ajustando por calles…' : props.timeSource}
                </p>
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {tab === 'programar' && (
                    <div className="p-4">
                        <WeekPlanControls {...props} dense />
                        <p className="text-xs text-slate-500 mt-4">
                            Sumá una empresa para meter todos sus equipos. Después podés quitar uno solo desde Recorrido. Si el día queda vacío y lo guardás, ese día vuelve a usar la hoja automática.
                        </p>
                    </div>
                )}

                {tab === 'mapa' && (
                    <div className="h-full min-h-[70vh]">
                        <RouteMap sheet={props.sheet} mapPoints={props.mapPoints} overBudget={props.overBudget} />
                    </div>
                )}

                {tab === 'ruta' && (
                    <div className="p-4 space-y-3 pb-28">
                        <div className="bg-white border rounded-xl p-3">
                            <WeekPlanControls {...props} />
                        </div>
                        <input
                            type="text"
                            value={props.query}
                            onChange={(event) => props.onQuery(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') props.onSearchEnter();
                            }}
                            placeholder="Sumar un equipo"
                            className="w-full min-h-12 px-3 border rounded-xl text-base"
                        />
                        {props.matches.length > 0 && (
                            <div className="bg-white border rounded-xl overflow-hidden">
                                {props.matches.map((dep) => (
                                    <button
                                        key={dep.id}
                                        type="button"
                                        onClick={() => props.onAddMatch(dep.id)}
                                        className="w-full text-left px-3 py-3 border-b last:border-b-0 min-h-12"
                                    >
                                        <span className="font-semibold">{dep.alias}</span>
                                        <span className="text-slate-500 text-sm"> · {dep.company_name || 'Sin empresa'}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        {props.sheet.stops.length === 0 ? (
                            <p className="text-sm text-slate-500">No hay equipos en este día. Sumá una empresa en Programar o usá la hoja automática.</p>
                        ) : (
                            props.sheet.stops.map((stop, stopIndex) => (
                                <article key={stop.key} className="bg-white border rounded-xl p-3 shadow-sm">
                                    <div className="flex justify-between gap-2 mb-2">
                                        <h2 className="font-bold text-slate-900">{stopIndex + 1}. {stop.companyName}</h2>
                                        <p className="text-xs text-slate-500 text-right">Llega {stop.arrivalLabel}</p>
                                    </div>
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
                                                <div className="flex gap-2 mt-2">
                                                    <input
                                                        type="number"
                                                        inputMode="numeric"
                                                        placeholder="Contador"
                                                        value={item.bill_counter}
                                                        onChange={(event) => props.onDraft(item.id, 'bill_counter', event.target.value)}
                                                        className="w-28 min-h-11 border rounded-lg px-2"
                                                    />
                                                    <input
                                                        type="text"
                                                        placeholder="Observación"
                                                        value={item.observations}
                                                        onChange={(event) => props.onDraft(item.id, 'observations', event.target.value)}
                                                        className="flex-1 min-h-11 border rounded-lg px-2"
                                                    />
                                                </div>
                                                <div className="flex gap-2 mt-2">
                                                    {!item.done && (
                                                        <button type="button" onClick={() => props.onRegister(item.raw)} className="flex-1 min-h-11 rounded-lg bg-blue-600 text-white font-semibold">
                                                            Registrar
                                                        </button>
                                                    )}
                                                    <button type="button" onClick={() => props.onRemove(item.id)} className="flex-1 min-h-11 rounded-lg border border-red-200 text-red-700 font-semibold">
                                                        Quitar
                                                    </button>
                                                </div>
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

            <nav className="shrink-0 grid grid-cols-3 bg-white border-t pb-[env(safe-area-inset-bottom)]">
                {([
                    ['ruta', 'Recorrido'],
                    ['programar', 'Programar'],
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
