import React, { useState } from 'react';
import { MaintenanceTask } from '../../types';
import { MaintenanceLight, RouteSheet, formatDuration } from './routePlanner';
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
    light: MaintenanceLight;
    lightLabel: string;
    pending: boolean;
}

export interface PickerUnit {
    id: number;
    alias: string;
    companyName: string;
    hasGps: boolean;
    light: MaintenanceLight;
    lightLabel: string;
    pending: boolean;
}

export interface RouteTemplateChip {
    id: number;
    name: string;
}

export interface WeekPlanProps {
    units: PickerUnit[];
    checkedIds: number[];
    saving: boolean;
    planDirty: boolean;
    banner: string;
    saveLabel: string;
    onToggleUnit: (id: number) => void;
    onSave: () => void;
}

const LIGHT_CLASS: Record<MaintenanceLight, string> = {
    green: 'bg-green-500',
    yellow: 'bg-yellow-400',
    red: 'bg-red-500',
};

export function MaintenanceDot({ light, label }: { light: MaintenanceLight; label: string }) {
    return (
        <span
            title={label}
            aria-label={label}
            className={`inline-block w-3 h-3 rounded-full shrink-0 ${LIGHT_CLASS[light]}`}
        />
    );
}

export const WeekPlanControls: React.FC<WeekPlanProps & { dense?: boolean }> = ({
    units,
    checkedIds,
    saving,
    planDirty,
    banner,
    saveLabel,
    onToggleUnit,
    onSave,
    dense,
}) => {
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
    groups.forEach((group) => group.units.sort((a, b) => {
        if (a.pending !== b.pending) return a.pending ? -1 : 1;
        const rank = { red: 0, yellow: 1, green: 2 };
        if (rank[a.light] !== rank[b.light]) return rank[a.light] - rank[b.light];
        return a.alias.localeCompare(b.alias, 'es');
    }));

    return (
        <div className={dense ? 'space-y-3' : 'space-y-2'}>
            <p className={`${dense ? 'text-sm' : 'text-xs'} text-slate-700`}>{banner}</p>
            <div className="border rounded-xl bg-white max-h-80 overflow-y-auto">
                <p className="px-3 pt-3 text-sm font-semibold text-slate-900">Elegí los depositarios</p>
                <p className="px-3 text-xs text-slate-500">{chosen.size} elegidos. El punto es el mismo semáforo de Gestión de depositarios.</p>
                <div className="px-3 pb-2 pt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> menos de 20 días</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> 20 a 30 días</span>
                    <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> más de 30 o nunca</span>
                </div>
                {groups.map((group) => (
                    <div key={group.name}>
                        <p className="sticky top-0 bg-slate-100 px-3 py-2 text-xs font-bold uppercase tracking-wide text-slate-600">{group.name}</p>
                        {group.units.map((unit) => (
                            <label key={unit.id} className={`flex items-center gap-3 px-3 min-h-11 border-t text-sm ${unit.pending ? 'bg-amber-50' : ''} ${unit.hasGps ? 'text-slate-900' : 'text-slate-400'}`}>
                                <input
                                    type="checkbox"
                                    className="w-5 h-5"
                                    checked={chosen.has(unit.id)}
                                    disabled={!unit.hasGps}
                                    onChange={() => onToggleUnit(unit.id)}
                                />
                                <MaintenanceDot light={unit.light} label={unit.lightLabel} />
                                <span className="font-medium">{unit.alias}</span>
                                <span className="text-[11px] text-slate-500">{unit.lightLabel}</span>
                                {unit.pending && <span className="text-[11px] font-semibold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded">Sin hacer</span>}
                                {!unit.hasGps && <span className="text-xs text-red-600">sin GPS</span>}
                            </label>
                        ))}
                    </div>
                ))}
            </div>
            <button
                type="button"
                onClick={onSave}
                disabled={saving || !planDirty}
                className="min-h-11 px-3 rounded-lg bg-purple-600 text-white text-sm font-semibold disabled:opacity-40"
            >
                {saving ? 'Guardando…' : saveLabel}
            </button>
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
    templates: RouteTemplateChip[];
    dayLabels: Record<string, string>;
    selectedKey: string;
    editMode: 'day' | 'template';
    templateName: string;
    onTemplateName: (value: string) => void;
    activeTemplateId: number | null;
    onAssignTemplate: (templateId: number | null) => void;
    onOpenTemplate: (id: number) => boolean | void;
    onCreateTemplate: () => Promise<boolean>;
    onDeleteTemplate: () => void;
    customDay: boolean;
    onUseBase: () => void;
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
    const [screen, setScreen] = useState<'home' | 'work'>('home');
    const driveOut = Math.max(0, props.sheet.driveMin - props.sheet.returnMin);
    const hojaName = props.templates.find((item) => item.id === props.activeTemplateId)?.name;

    const openDay = (date: Date) => {
        const accepted = props.onPickDate(date);
        if (accepted === false) return;
        setTab('ruta');
        setScreen('work');
    };

    const openTemplate = (id: number) => {
        const accepted = props.onOpenTemplate(id);
        if (accepted === false) return;
        setScreen('work');
    };

    const createTemplate = async () => {
        const accepted = await props.onCreateTemplate();
        if (accepted === false) return;
        setScreen('work');
    };

    if (screen === 'home') {
        return (
            <div className="fixed inset-0 z-[1050] bg-slate-100 flex flex-col">
                <header className="bg-slate-900 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <p className="text-xs uppercase tracking-wide text-slate-400">Recorridos</p>
                            <h1 className="text-2xl font-bold">Hojas de ruta</h1>
                            <p className="text-sm text-slate-300 mt-1">Armá la hoja 1, 2, 3 y elegí en qué fecha se hace.</p>
                        </div>
                        <button type="button" onClick={props.onClose} className="min-h-11 px-2 text-sm font-semibold text-slate-200">
                            {props.closeLabel || 'Cerrar'}
                        </button>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-3">
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {props.templates.map((template) => (
                            <button
                                key={template.id}
                                type="button"
                                onClick={() => openTemplate(template.id)}
                                className="shrink-0 min-h-11 px-3 rounded-full bg-white border font-semibold text-sm text-slate-900"
                            >
                                {template.name}
                            </button>
                        ))}
                        <button type="button" onClick={createTemplate} className="shrink-0 min-h-11 px-3 rounded-full bg-purple-600 text-white text-sm font-semibold">
                            + Nueva hoja
                        </button>
                    </div>
                    <RouteCalendar dayLabels={props.dayLabels} selectedKey="" onPick={openDay} />
                </div>
            </div>
        );
    }

    const editingBase = props.editMode === 'template';

    return (
        <div className="fixed inset-0 z-[1050] bg-slate-100 flex flex-col">
            <header className="bg-slate-900 text-white px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <button type="button" onClick={() => setScreen('home')} className="text-xs font-semibold text-slate-300 mb-1">
                            ‹ Calendario
                        </button>
                        {editingBase ? (
                            <>
                                <p className="text-xs uppercase tracking-wide text-slate-400">Hoja base</p>
                                <h1 className="text-lg font-bold">{props.templateName || 'Nueva hoja'}</h1>
                                <p className="text-xs text-slate-300 mt-0.5">Los cambios de esta pantalla quedan en la hoja. Un día ya modificado no se toca.</p>
                            </>
                        ) : (
                            <>
                                <p className="text-xs uppercase tracking-wide text-slate-400 capitalize">{props.pickedLabel}</p>
                                <h1 className="text-lg font-bold">{hojaName || 'Sin hoja asignada'}</h1>
                                <p className="text-xs text-slate-300 mt-0.5">
                                    Solo esta fecha · {props.unitCount} equipos · {props.stopCount} paradas
                                    {props.routeId ? ` · #${props.routeId}` : ''}
                                </p>
                            </>
                        )}
                    </div>
                    <button type="button" onClick={props.onClose} className="min-h-11 px-2 text-sm font-semibold text-slate-200">
                        {props.closeLabel || 'Cerrar'}
                    </button>
                </div>
                {!editingBase && (
                    <>
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
                    </>
                )}
            </header>

            <div className="flex-1 min-h-0 overflow-y-auto">
                {!editingBase && tab === 'mapa' && (
                    <div className="h-full min-h-[70vh]">
                        <RouteMap sheet={props.sheet} mapPoints={props.mapPoints} overBudget={props.overBudget} />
                    </div>
                )}

                {(editingBase || tab === 'ruta') && (
                    <div className="p-4 space-y-3 pb-28">
                        {editingBase ? (
                            <label className="block bg-white border rounded-xl px-3 py-2 text-xs text-slate-600">
                                Nombre de la hoja
                                <input
                                    type="text"
                                    value={props.templateName}
                                    onChange={(event) => props.onTemplateName(event.target.value)}
                                    className="mt-1 w-full min-h-11 text-base text-slate-900"
                                />
                            </label>
                        ) : (
                            <RouteCrewBar
                                performedBy={props.performedBy}
                                companionUserId={props.companionUserId}
                                agents={props.agents}
                                onPerformedBy={props.onPerformedBy}
                                onCompanion={props.onCompanion}
                            />
                        )}
                        {!editingBase && (
                            <label className="block bg-white border rounded-xl px-3 py-2 text-xs text-slate-600">
                                Hoja de este día
                                <select
                                    value={props.activeTemplateId ?? ''}
                                    onChange={(event) => props.onAssignTemplate(event.target.value ? Number(event.target.value) : null)}
                                    className="mt-1 w-full min-h-11 text-base text-slate-900 bg-white"
                                >
                                    <option value="">Sin hoja</option>
                                    {props.templates.map((template) => (
                                        <option key={template.id} value={template.id}>{template.name}</option>
                                    ))}
                                </select>
                            </label>
                        )}
                        {props.customDay && !editingBase && (
                            <button type="button" onClick={props.onUseBase} className="min-h-11 px-3 rounded-lg border bg-white text-sm font-semibold">
                                Volver a la hoja base
                            </button>
                        )}
                        <WeekPlanControls {...props} dense />
                        {editingBase && (
                            <button type="button" onClick={props.onDeleteTemplate} className="min-h-11 px-3 rounded-lg border border-red-200 text-red-700 text-sm font-semibold">
                                Eliminar esta hoja
                            </button>
                        )}
                        {!editingBase && (
                            <>
                                <div className="bg-white border rounded-xl p-3">
                                    <p className="text-sm font-semibold text-slate-900">Sumar un depositario</p>
                                    <p className="text-xs text-slate-500 mt-0.5 mb-2">Entra en el lugar del recorrido que menos alarga la hoja. El cambio queda solo en esta fecha.</p>
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
                                                    <span className="inline-flex items-center gap-2">
                                                        <MaintenanceDot light={dep.light} label={dep.lightLabel} />
                                                        <span className="font-semibold">{dep.alias}</span>
                                                    </span>
                                                    <span className="text-slate-500 text-sm"> · {dep.companyName}</span>
                                                    {dep.pending && <span className="ml-2 text-[11px] font-semibold text-amber-900">Sin hacer</span>}
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
                                    <p className="text-sm text-slate-500">Este día no tiene equipos. Elegí una hoja o marcalos en la lista y guardá solo esta fecha.</p>
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
                            </>
                        )}
                    </div>
                )}
            </div>

            {!editingBase && tab === 'ruta' && (
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

            {!editingBase && (
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
            )}
        </div>
    );
};

export default MobileRouteSheet;
