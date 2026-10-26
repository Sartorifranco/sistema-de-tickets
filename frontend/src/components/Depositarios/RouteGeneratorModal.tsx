import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Depositario, MaintenanceTask, User } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import {
    RoadRoute,
    RouteSheetStop,
    applyRoadFactor,
    buildRouteSheet,
    estimateRouteMinutes,
    formatDuration,
    hasCoords,
    insertStop,
    insertionCost,
    isoWeekday,
    maintenanceProfile,
    moveStop,
    optimizeOrder,
    planRoute,
    roadFactorOf,
    weekdayLabel,
} from './routePlanner';
import RouteMap from './RouteMap';
import MobileRouteSheet, { WeekPlanControls } from './MobileRouteSheet';
import RouteCalendar from './RouteCalendar';
import StopWorkFields, { CompanionOption, emptyTasks, RouteCrewBar } from './StopWorkFields';

const BUDGET_HOURS = [4, 6, 8];
const SERVICE_CHOICES = [10, 15, 20, 30];

const toneClass: Record<string, string> = {
    green: 'bg-green-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    blue: 'bg-blue-600',
};

function stopTone(stop: RouteSheetStop): keyof typeof toneClass {
    if (stop.items.every((item) => item.done)) return 'green';
    if (stop.items.some((item) => item.tickets > 0)) return 'red';
    if (stop.items.some((item) => item.never || item.overdue > 0)) return 'amber';
    return 'blue';
}

interface Props {
    depositarios: Depositario[];
    onClose: () => void;
    /** Recarga la gestión de depositarios después de cerrar una parada. */
    onMaintenanceSaved?: () => void;
    /** Pantalla de la app instalable. No depende del tamaño de la ventana. */
    appMode?: boolean;
}

interface OsrmLeg {
    duration: number;
    distance: number;
}

interface OsrmResponse {
    routes?: {
        distance: number;
        geometry?: { coordinates?: number[][] };
        legs?: OsrmLeg[];
    }[];
}

const RouteGeneratorModal: React.FC<Props> = ({ depositarios, onClose, onMaintenanceSaved, appMode = false }) => {
    const { user } = useAuth();
    const [catalog, setCatalog] = useState<Depositario[]>(depositarios);
    const [catalogReady, setCatalogReady] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [drafts, setDrafts] = useState<Record<number, { bill_counter?: string; observations?: string; tasks?: MaintenanceTask[] }>>({});
    const [performedBy, setPerformedBy] = useState<'bacar' | 'permaquim'>('bacar');
    const [companionUserId, setCompanionUserId] = useState('');
    const [agents, setAgents] = useState<CompanionOption[]>([]);
    const [finishingId, setFinishingId] = useState<number | null>(null);
    const [ticketByStop, setTicketByStop] = useState<Record<number, number>>({});
    const [pickedDate, setPickedDate] = useState(() => new Date());
    const [budgetHours, setBudgetHours] = useState(6);
    const [serviceMin, setServiceMin] = useState(15);
    const [startTime, setStartTime] = useState('09:00');
    const [companyFilter, setCompanyFilter] = useState<number | ''>('');
    const [query, setQuery] = useState('');
    const [edited, setEdited] = useState(false);
    const [road, setRoad] = useState<RoadRoute | null>(null);
    const [roadPending, setRoadPending] = useState(false);
    const [routeId, setRouteId] = useState<number | null>(null);
    const [isSending, setIsSending] = useState(false);
    const [plans, setPlans] = useState<Record<number, number[]>>({});
    const [plansReady, setPlansReady] = useState(false);
    const [focusDay, setFocusDay] = useState(() => isoWeekday(new Date()));
    const [source, setSource] = useState<'programado' | 'automatico'>('automatico');
    const [savingPlan, setSavingPlan] = useState(false);
    const todayWeekday = useMemo(() => isoWeekday(new Date()), []);

    const manual = useRef(false);
    const lastPlanKey = useRef<string | null>(null);
    const bootstrapped = useRef(false);

    const budgetMin = budgetHours * 60;
    const companyId = companyFilter === '' ? null : companyFilter;

    useEffect(() => {
        let cancelled = false;
        api.get('/api/depositarios')
            .then((res) => {
                if (!cancelled) setCatalog(res.data.data || []);
            })
            .catch(() => {
                /* Si falla, se usa el listado que ya tenía la pantalla. */
            })
            .finally(() => {
                if (!cancelled) setCatalogReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, [depositarios]);

    const planKey = `${budgetMin}|${serviceMin}`;

    useEffect(() => {
        let cancelled = false;
        api.get('/api/depositarios/route-plans')
            .then((res) => {
                if (cancelled) return;
                const next: Record<number, number[]> = {};
                (res.data.data || []).forEach((row: { weekday: number; depositario_ids: number[] }) => {
                    next[Number(row.weekday)] = (row.depositario_ids || []).map(Number).filter((id) => Number.isInteger(id));
                });
                setPlans(next);
            })
            .catch(() => {
                /* Sin programación guardada se usa la hoja automática. */
            })
            .finally(() => {
                if (!cancelled) setPlansReady(true);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        let cancelled = false;
        api.get('/api/users/agents')
            .then((res) => {
                if (cancelled) return;
                const list: CompanionOption[] = (res.data?.data || [])
                    .filter((agent: User) => (agent.role === 'agent' || agent.role === 'admin') && agent.id !== user?.id)
                    .map((agent: User) => ({
                        id: agent.id,
                        name: agent.first_name && agent.last_name ? `${agent.first_name} ${agent.last_name}` : agent.username,
                    }));
                setAgents(list);
            })
            .catch(() => {
                if (!cancelled) setAgents([]);
            });
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    const validPlanIds = (day: number) => (plans[day] || []).filter((id) => catalog.some((dep) => dep.id === id && hasCoords(dep)));

    useEffect(() => {
        if (!catalogReady || !plansReady || bootstrapped.current) return;
        bootstrapped.current = true;
        const saved = validPlanIds(todayWeekday);
        if (saved.length > 0) {
            manual.current = true;
            setEdited(true);
            setSource('programado');
            lastPlanKey.current = planKey;
            setSelectedIds(saved);
        } else {
            setSource('automatico');
        }
    }, [catalogReady, plansReady, plans, catalog, todayWeekday, planKey]);

    useEffect(() => {
        if (!catalogReady || !plansReady || manual.current || bootstrapped.current === false) return;
        if (validPlanIds(todayWeekday).length > 0 && source === 'programado') return;
        if (lastPlanKey.current === planKey) return;
        lastPlanKey.current = planKey;
        if (!catalog.some(hasCoords)) {
            setSelectedIds([]);
            return;
        }
        setSelectedIds(planRoute(catalog, { budgetMin, serviceMin }));
    }, [catalogReady, plansReady, catalog, planKey, budgetMin, serviceMin, todayWeekday, source, plans]);

    const sheet = useMemo(
        () => buildRouteSheet(selectedIds, catalog, drafts, startTime, serviceMin, road),
        [selectedIds, catalog, drafts, startTime, serviceMin, road],
    );

    useEffect(() => {
        const key = sheet.routeKey;
        const path = sheet.osrmPath;
        if (!key || !path || sheet.stops.length > 90) {
            setRoad(null);
            setRoadPending(false);
            return;
        }
        const controller = new AbortController();
        const timer = window.setTimeout(async () => {
            setRoadPending(true);
            try {
                const response = await fetch(
                    `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson`,
                    { signal: controller.signal },
                );
                const data = (await response.json()) as OsrmResponse;
                const found = data.routes?.[0];
                const legs = found?.legs || [];
                const coordinates = found?.geometry?.coordinates || [];
                if (!found || legs.length !== key.split('|').length + 1) {
                    throw new Error('ruta incompleta');
                }
                setRoad({
                    key,
                    geometry: coordinates.map((pair) => [pair[1], pair[0]] as [number, number]),
                    legMinutes: legs.map((leg) => leg.duration / 60),
                    legKm: legs.map((leg) => leg.distance / 1000),
                    distanceKm: found.distance / 1000,
                });
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
                setRoad(null);
            } finally {
                if (!controller.signal.aborted) setRoadPending(false);
            }
        }, 400);
        return () => {
            controller.abort();
            window.clearTimeout(timer);
        };
    }, [sheet.routeKey, sheet.osrmPath, sheet.stops.length]);

    const factor = roadFactorOf(sheet.driveMin, sheet.estimateDriveMin, sheet.source);
    // La línea del mapa solo cambia con el recorrido o cuando llega el trazado por calles.
    const mapPoints = useMemo(
        () => sheet.geometry,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [sheet.routeKey, sheet.source],
    );
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const companies = useMemo(() => {
        const map = new Map<number, string>();
        catalog.forEach((dep) => {
            if (dep.company_id) map.set(dep.company_id, dep.company_name || `Empresa ${dep.company_id}`);
        });
        const companies: [number, string][] = [];
        map.forEach((name, id) => companies.push([id, name]));
        return companies.sort((a, b) => a[1].localeCompare(b[1], 'es'));
    }, [catalog]);

    const matches = useMemo(() => {
        const text = query.trim().toLowerCase();
        if (text.length < 1) return [];
        return catalog
            .filter((dep) => !selectedSet.has(dep.id))
            .filter((dep) => `${dep.alias} ${dep.company_name || ''} ${dep.address || ''} ${dep.serial_number || ''}`.toLowerCase().includes(text))
            .slice(0, 12)
            .map((dep) => {
                const profile = maintenanceProfile(dep);
                const cost = insertionCost(selectedIds, dep, catalog, serviceMin);
                return {
                    dep,
                    profile,
                    minutes: cost ? applyRoadFactor(cost, factor, serviceMin) : null,
                };
            });
    }, [catalog, factor, query, selectedIds, selectedSet, serviceMin]);

    const overMin = Math.round(sheet.totalMin - budgetMin);
    const remainingMin = Math.round(budgetMin - sheet.totalMin);
    const pct = budgetMin > 0 ? Math.round((sheet.totalMin / budgetMin) * 100) : 0;
    const unitCount = sheet.stops.reduce((sum, stop) => sum + stop.items.length, 0);

    const markEdited = () => {
        manual.current = true;
        setEdited(true);
    };

    const savedIds = plans[focusDay] || [];
    const planDirty = savedIds.join(',') !== selectedIds.join(',');
    const dayName = weekdayLabel(focusDay);
    const hasSavedDay = savedIds.length > 0;
    const planBanner = source === 'automatico'
        ? hasSavedDay
            ? `Estás en la hoja automática. El ${dayName} también tiene un recorrido guardado.`
            : `Sin recorrido fijo para el ${dayName}. Estás viendo la hoja automática.`
        : !hasSavedDay && selectedIds.length === 0
            ? `El ${dayName} no tiene hoja fija. Sumá empresas o equipos y guardala: va a verse cada ${dayName} en el calendario.`
            : planDirty
                ? `Hay cambios sin guardar en el ${dayName}.`
                : `Hoja fija de cada ${dayName}. Podés quitar, sumar o terminar cada parada.`;

    const planLabels = useMemo(() => {
        const labels: Record<number, string> = {};
        Object.keys(plans).forEach((key) => {
            const weekday = Number(key);
            const names = (plans[weekday] || [])
                .map((id) => catalog.find((dep) => dep.id === id)?.alias)
                .filter((name): name is string => !!name);
            if (names.length === 0) return;
            labels[weekday] = names.length <= 2 ? names.join(' · ') : `${names.slice(0, 2).join(' · ')} +${names.length - 2}`;
        });
        return labels;
    }, [catalog, plans]);

    const pickedLabel = pickedDate.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

    const selectWeekday = (day: number): boolean => {
        if (day === focusDay) return true;
        if (source === 'programado' && planDirty && !window.confirm('Hay cambios sin guardar en este día. ¿Cambiar de día igual?')) return false;
        setFocusDay(day);
        const saved = validPlanIds(day);
        if (saved.length > 0) {
            markEdited();
            setSource('programado');
            setSelectedIds(saved);
            return true;
        }
        if (day === todayWeekday) {
            markEdited();
            setSource('automatico');
            setSelectedIds(planRoute(catalog, { budgetMin, serviceMin }));
            return true;
        }
        markEdited();
        setSource('programado');
        setSelectedIds([]);
        return true;
    };

    const pickDate = (date: Date): boolean => {
        const accepted = selectWeekday(isoWeekday(date));
        if (accepted) setPickedDate(date);
        return accepted;
    };

    const addCompany = (companyToAdd: number) => {
        const ids = catalog
            .filter((dep) => Number(dep.company_id) === companyToAdd && hasCoords(dep) && !selectedSet.has(dep.id))
            .map((dep) => dep.id);
        if (ids.length === 0) {
            toast.info('Esa empresa ya está en el recorrido, o sus equipos no tienen GPS.');
            return;
        }
        markEdited();
        setSource('programado');
        setSelectedIds((prev) => {
            let next = prev;
            ids.forEach((id) => {
                next = insertStop(next, id, catalog);
            });
            return next;
        });
        toast.success(`Sumé ${ids.length} equipo${ids.length === 1 ? '' : 's'}.`);
    };

    const saveWeekPlan = async () => {
        setSavingPlan(true);
        try {
            await api.put(`/api/depositarios/route-plans/${focusDay}`, { depositario_ids: selectedIds });
            setPlans((prev) => {
                const next = { ...prev };
                if (selectedIds.length === 0) delete next[focusDay];
                else next[focusDay] = [...selectedIds];
                return next;
            });
            setSource(selectedIds.length === 0 ? 'automatico' : 'programado');
            toast.success(selectedIds.length === 0
                ? `Se borró la programación del ${dayName}. Ese día vuelve la hoja automática.`
                : `El ${dayName} quedó fijo con ${selectedIds.length} equipos. El calendario lo muestra todas las semanas.`);
        } catch (error) {
            console.error(error);
            toast.error('No se pudo guardar la programación.');
        } finally {
            setSavingPlan(false);
        }
    };

    const useAutomatic = () => {
        if (source !== 'automatico' && selectedIds.length > 0 && !window.confirm('Se reemplaza este recorrido por la hoja automática del día. ¿Continuar?')) return;
        markEdited();
        setSource('automatico');
        setSelectedIds(planRoute(catalog, { budgetMin, serviceMin, companyId }));
    };

    const useProgrammed = () => {
        const saved = validPlanIds(focusDay);
        if (saved.length === 0) {
            toast.info(`El ${dayName} no tiene un recorrido guardado.`);
            return;
        }
        markEdited();
        setSource('programado');
        setSelectedIds(saved);
    };

    const addDepositary = (id: number) => {
        const dep = catalog.find((item) => item.id === id);
        if (!dep) return;
        if (selectedSet.has(id)) return;
        if (!hasCoords(dep)) {
            toast.warn(`${dep.alias} no tiene coordenadas. Cargá la ubicación para sumarlo a la ruta.`);
            return;
        }
        const next = insertStop(selectedIds, id, catalog);
        const after = buildRouteSheet(next, catalog, drafts, startTime, serviceMin, null);
        const place = after.stops.findIndex((stop) => stop.items.some((item) => item.id === id)) + 1;
        const delta = Math.max(0, Math.round(after.totalMin - sheet.totalMin));
        markEdited();
        setSource('programado');
        setSelectedIds(next);
        setQuery('');
        toast.success(delta < 1
            ? `Sumé ${dep.alias} en la parada ${place}. No agrega viaje.`
            : `Sumé ${dep.alias} en la parada ${place}. Suma ${formatDuration(delta)}.`);
    };

    const removeDepositary = (id: number) => {
        markEdited();
        setSource('programado');
        setSelectedIds((prev) => prev.filter((item) => item !== id));
    };

    const shiftDepositary = (id: number, direction: -1 | 1) => {
        markEdited();
        setSelectedIds((prev) => moveStop(prev, id, direction));
    };

    const handleOptimize = () => {
        if (selectedIds.length < 2) return;
        const before = estimateRouteMinutes(selectedIds, catalog, serviceMin);
        const next = optimizeOrder(selectedIds, catalog);
        const after = estimateRouteMinutes(next, catalog, serviceMin);
        markEdited();
        setSelectedIds(next);
        const saved = Math.round(before - after);
        if (saved >= 2) toast.success(`Orden más corto. El viaje baja unos ${saved} min.`);
        else toast.info('Ese orden ya aprovecha la cercanía.');
    };

    const handleSuggest = () => {
        if (edited && selectedIds.length > 0) {
            const ok = window.confirm('Se reemplaza la ruta actual por una sugerida con los más atrasados que entran en la jornada. ¿Continuar?');
            if (!ok) return;
        }
        const next = planRoute(catalog, { budgetMin, serviceMin, companyId });
        markEdited();
        setSource('automatico');
        lastPlanKey.current = planKey;
        setSelectedIds(next);
        if (next.length === 0) toast.info('Ningún atrasado entra en esa jornada. Podés sumar uno igual para ver cuánto tardaría.');
        else toast.success(`Sugerencia de ${next.length} equipos. El tiempo de arriba ya incluye viaje, servicio y regreso.`);
    };

    const handleFill = () => {
        const next = planRoute(catalog, { budgetMin, serviceMin, companyId, keepIds: selectedIds });
        const added = next.filter((id) => !selectedSet.has(id)).length;
        markEdited();
        setSelectedIds(next);
        if (added === 0) toast.info('No entra ningún atrasado más en el tiempo que queda.');
        else toast.success(`Sumé ${added} equipo${added === 1 ? '' : 's'} sin pasarme de la jornada.`);
    };

    const handleClear = () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm('¿Vaciar la hoja de ruta?')) return;
        markEdited();
        setSource('programado');
        setSelectedIds([]);
    };

    const updateDraft = (id: number, field: 'bill_counter' | 'observations', value: string) => {
        setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
    };

    const tasksFor = (id: number): MaintenanceTask[] => drafts[id]?.tasks || emptyTasks();

    const updateTasks = (id: number, tasks: MaintenanceTask[]) => {
        setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], tasks } }));
    };

    const finishStop = async (id: number) => {
        const dep = catalog.find((item) => item.id === id);
        if (!dep || finishingId !== null) return;
        const draft = drafts[id] || {};
        const counter = (draft.bill_counter || '').trim();
        if (!counter) {
            toast.warn(`Cargá el contador de ${dep.alias} antes de terminar la parada.`);
            return;
        }
        setFinishingId(id);
        try {
            const now = new Date();
            now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
            const res = await api.post(`/api/depositarios/${id}/maintenance`, {
                performed_by: performedBy,
                date: now.toISOString().slice(0, 16),
                observations: draft.observations || '',
                tasks: draft.tasks?.length ? draft.tasks : emptyTasks(),
                bill_counter: counter,
                ...(companionUserId ? { companion_user_id: Number(companionUserId) } : {}),
            });
            const ticketId = res.data?.ticketId as number | undefined;
            if (ticketId) setTicketByStop((prev) => ({ ...prev, [id]: ticketId }));
            const list = await api.get('/api/depositarios');
            setCatalog(list.data.data || []);
            onMaintenanceSaved?.();
            toast.success(
                ticketId
                    ? `${dep.alias} quedó en Gestión de depositarios. Ticket #${ticketId} creado y cerrado.`
                    : `${dep.alias} quedó en Gestión de depositarios.`
            );
        } catch (error) {
            const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'No se pudo cargar el mantenimiento.');
        } finally {
            setFinishingId(null);
        }
    };

    const saveRoute = async () => {
        if (unitCount === 0) return;
        try {
            const res = await api.post('/api/depositarios/route', {
                total_distance_km: Number(sheet.distanceKm.toFixed(1)),
                total_time_minutes: Math.round(sheet.totalMin),
                stops: sheet.stops.flatMap((stop) => stop.items.map((item) => ({ id: item.id, alias: item.alias }))),
            });
            setRouteId(res.data.routeId);
            toast.success(`Ruta #${res.data.routeId} guardada.`);
        } catch (error) {
            console.error(error);
            toast.error('Error al guardar la ruta.');
        }
    };

    const handleFinalizeRoute = async () => {
        if (!routeId) {
            toast.warning('Primero guardá la ruta.');
            return;
        }
        if (!window.confirm('¿Finalizar el recorrido y enviar el reporte por correo?')) return;
        setIsSending(true);
        try {
            await api.post('/api/depositarios/route/finalize', {
                routeId,
                total_km: Number(sheet.distanceKm.toFixed(1)),
                total_minutes: Math.round(sheet.totalMin),
                stopsData: sheet.stops.flatMap((stop) => stop.items.map((item) => ({
                    id: item.id,
                    alias: item.alias,
                    serial_number: item.serial_number,
                    status: item.done ? 'Hecho' : 'Pendiente',
                    bill_counter: item.bill_counter,
                    observations: item.observations,
                }))),
            });
            toast.success('Ruta finalizada y reporte enviado.');
            onClose();
        } catch (error) {
            console.error(error);
            toast.error('No se pudo enviar el reporte.');
        } finally {
            setIsSending(false);
        }
    };

    const downloadPDF = () => {
        const doc = new jsPDF();
        const today = new Date().toLocaleDateString('es-AR');
        doc.setFillColor(30, 41, 59);
        doc.rect(0, 0, 210, 42, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(20);
        doc.text('HOJA DE RUTA - BACAR', 14, 16);
        doc.setFontSize(11);
        doc.text(`Fecha: ${today} | ID: #${routeId || 'Borrador'} | Salida ${startTime}`, 14, 26);
        doc.text(
            `${formatDuration(sheet.totalMin)} · ${sheet.distanceKm.toFixed(1)} km · Regreso ${sheet.backAtBase} · ${unitCount} equipos`,
            14,
            34,
        );
        doc.setTextColor(30, 41, 59);

        autoTable(doc, {
            startY: 48,
            head: [['#', 'Llegada', 'Ubicación', 'Equipos', 'Tiempo']],
            body: sheet.stops.map((stop, index) => [
                index + 1,
                stop.arrivalLabel,
                stop.companyName,
                stop.items.map((item) => {
                    const delay = item.never ? 'sin mantenimiento' : item.overdue > 0 ? `${item.overdue} días de atraso` : 'en plazo';
                    const fail = item.tickets > 0 ? ' · FALLA' : '';
                    const done = item.done ? ' · HECHO' : '';
                    return `• ${item.alias} (${item.daysLabel}, ${delay}${fail}${done})`;
                }).join('\n'),
                `${Math.round(stop.travelMin)} min viaje + ${stop.serviceMin} min trabajo`,
            ]),
            theme: 'striped',
            styles: { fontSize: 9, cellPadding: 2 },
            headStyles: { fillColor: [30, 41, 59] },
        });
        doc.save(`Ruta_BACAR_${today.replace(/\//g, '-')}.pdf`);
    };

    const weekPlan = {
        today: todayWeekday,
        focusDay,
        plans,
        companies,
        source,
        saving: savingPlan,
        planDirty,
        banner: planBanner,
        onSelectDay: selectWeekday,
        onAddCompany: addCompany,
        onSave: saveWeekPlan,
        onUseAutomatic: useAutomatic,
        onUseProgrammed: useProgrammed,
    };

    if (appMode) {
        return (
            <MobileRouteSheet
                {...weekPlan}
                closeLabel="Salir"
                onClose={onClose}
                unitCount={unitCount}
                stopCount={sheet.stops.length}
                totalLabel={formatDuration(sheet.totalMin)}
                distanceLabel={`${sheet.distanceKm.toFixed(1)} km`}
                backAtBase={sheet.backAtBase}
                overBudget={overMin > 0}
                roadPending={roadPending}
                timeSource={roadPending ? 'ajustando por calles…' : sheet.source === 'calles' ? 'tiempo por calles' : 'tiempo estimado'}
                query={query}
                onQuery={setQuery}
                onSearchEnter={() => { if (matches[0]) addDepositary(matches[0].dep.id); }}
                matches={matches.map((row) => ({
                    id: row.dep.id,
                    alias: row.dep.alias,
                    companyName: row.dep.company_name || 'Sin empresa',
                    address: row.dep.address || '',
                    daysLabel: row.profile.daysLabel,
                    minutes: row.minutes,
                    hasGps: hasCoords(row.dep),
                }))}
                serviceMin={serviceMin}
                startTime={startTime}
                onServiceMin={setServiceMin}
                onStartTime={setStartTime}
                onAddMatch={addDepositary}
                sheet={sheet}
                mapPoints={mapPoints}
                selectedIds={selectedIds}
                onRemove={removeDepositary}
                onShift={shiftDepositary}
                onDraft={updateDraft}
                onTasks={updateTasks}
                tasksFor={tasksFor}
                onFinishStop={finishStop}
                finishingId={finishingId}
                ticketByStop={ticketByStop}
                planLabels={planLabels}
                pickedLabel={pickedLabel}
                onPickDate={pickDate}
                performedBy={performedBy}
                companionUserId={companionUserId}
                agents={agents}
                onPerformedBy={setPerformedBy}
                onCompanion={setCompanionUserId}
                onSaveRoute={saveRoute}
                onPdf={downloadPDF}
                onFinalize={handleFinalizeRoute}
                sending={isSending}
                routeId={routeId}
            />
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-[1050] p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[92vh] flex flex-col overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-3 shadow-md z-10 shrink-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <h2 className="text-xl font-bold">Hoja de ruta</h2>
                            <p className="text-xs text-slate-300 mt-1">
                                {weekdayLabel(focusDay)} · {source === 'programado' ? 'programado' : 'automática'} · {unitCount} equipos · {sheet.stops.length} paradas
                                {routeId ? ` · ruta #${routeId}` : ''}
                            </p>
                        </div>
                        <div className="text-right min-w-[220px]" aria-live="polite">
                            <div className={`text-3xl font-bold ${overMin > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                {formatDuration(sheet.totalMin)}
                            </div>
                            <div className="text-xs text-slate-300">
                                {sheet.distanceKm.toFixed(1)} km · viaje {formatDuration(Math.max(0, sheet.driveMin - sheet.returnMin))} · en equipos {formatDuration(sheet.serviceMin)} · regreso {formatDuration(sheet.returnMin)}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                                {sheet.stops.length === 0
                                    ? 'Sin paradas'
                                    : `Salida ${startTime} · de vuelta ${sheet.backAtBase}`}
                                {' · '}
                                {roadPending ? 'ajustando por calles…' : sheet.source === 'calles' ? 'tiempo por calles' : 'tiempo estimado'}
                            </div>
                        </div>
                    </div>
                    <div className="mt-2">
                        <div className="h-1.5 bg-slate-700 rounded overflow-hidden">
                            <div
                                className={`h-full ${overMin > 0 ? 'bg-red-500' : pct > 85 ? 'bg-amber-400' : 'bg-emerald-400'}`}
                                style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                            />
                        </div>
                        <div className={`text-[11px] mt-1 ${overMin > 0 ? 'text-red-300' : 'text-slate-400'}`}>
                            {overMin > 0
                                ? `Supera la jornada de ${budgetHours} h por ${formatDuration(overMin)}.`
                                : `Quedan ${formatDuration(Math.max(0, remainingMin))} de ${budgetHours} h.`}
                        </div>
                    </div>
                </div>

                <div className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row">
                    <div className="w-full lg:w-[46%] lg:h-full lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-gray-200 bg-gray-50">
                        <div className="p-4 space-y-3 border-b border-gray-200 bg-white">
                            <RouteCalendar plans={plans} labels={planLabels} focusDay={focusDay} onPick={pickDate} />
                            <p className="text-sm font-semibold capitalize text-slate-800">{pickedLabel}</p>
                            <RouteCrewBar
                                performedBy={performedBy}
                                companionUserId={companionUserId}
                                agents={agents}
                                onPerformedBy={setPerformedBy}
                                onCompanion={setCompanionUserId}
                            />
                            <WeekPlanControls {...weekPlan} />
                            <div className="relative">
                                <input
                                    type="text"
                                    value={query}
                                    onChange={(event) => setQuery(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter' && matches[0]) {
                                            event.preventDefault();
                                            addDepositary(matches[0].dep.id);
                                        }
                                    }}
                                    placeholder="Sumar un depositario: alias, empresa, dirección o serie"
                                    className="w-full p-2 border rounded text-sm outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {matches.length > 0 && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border rounded shadow-lg max-h-56 overflow-y-auto">
                                        {matches.map((row) => (
                                                <button
                                                    key={row.dep.id}
                                                    type="button"
                                                    onMouseDown={(event) => {
                                                        event.preventDefault();
                                                        addDepositary(row.dep.id);
                                                    }}
                                                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b last:border-b-0"
                                                >
                                                    <span className="font-medium">{row.dep.alias}</span>
                                                    <span className="text-gray-500"> · {row.dep.company_name || 'Sin empresa'} · {row.profile.daysLabel}</span>
                                                    {row.minutes !== null && <span className="text-slate-700"> · +{formatDuration(row.minutes)}</span>}
                                                    {!hasCoords(row.dep) && <span className="text-red-600"> · sin GPS</span>}
                                                </button>
                                            ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 text-xs">
                                <span className="font-semibold text-gray-600">Jornada</span>
                                {BUDGET_HOURS.map((hours) => (
                                    <button
                                        key={hours}
                                        type="button"
                                        onClick={() => setBudgetHours(hours)}
                                        className={`px-2 py-1 rounded border ${budgetHours === hours ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-gray-700'}`}
                                    >
                                        {hours} h
                                    </button>
                                ))}
                                <label className="flex items-center gap-1 text-gray-600">
                                    Salida
                                    <input
                                        type="time"
                                        value={startTime}
                                        onChange={(event) => setStartTime(event.target.value)}
                                        className="border rounded px-1 py-1"
                                    />
                                </label>
                                <label className="flex items-center gap-1 text-gray-600">
                                    Min/equipo
                                    <select
                                        value={serviceMin}
                                        onChange={(event) => setServiceMin(Number(event.target.value))}
                                        className="border rounded px-1 py-1 bg-white"
                                    >
                                        {SERVICE_CHOICES.map((minutes) => (
                                            <option key={minutes} value={minutes}>{minutes}</option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <select
                                    value={companyFilter}
                                    onChange={(event) => setCompanyFilter(event.target.value ? Number(event.target.value) : '')}
                                    className="border rounded px-2 py-1 text-xs bg-white"
                                >
                                    <option value="">Todas las empresas</option>
                                    {companies.map(([id, name]) => (
                                        <option key={id} value={id}>{name}</option>
                                    ))}
                                </select>
                                <button type="button" onClick={handleSuggest} className="text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-2 py-1 rounded">
                                    Rearmar sugerida
                                </button>
                                <button type="button" onClick={handleFill} className="text-xs bg-white border border-purple-300 text-purple-800 font-semibold px-2 py-1 rounded">
                                    Completar jornada
                                </button>
                                <button type="button" onClick={handleOptimize} disabled={selectedIds.length < 2} className="text-xs bg-white border font-semibold px-2 py-1 rounded disabled:opacity-40">
                                    Optimizar orden
                                </button>
                                <button type="button" onClick={handleClear} className="text-xs bg-white border text-gray-600 px-2 py-1 rounded">
                                    Vaciar
                                </button>
                            </div>
                            <p className="text-[11px] text-gray-500">
                                {edited
                                    ? 'La ruta quedó a mano. El tiempo se recalcula al sumar, quitar o reordenar. Rearmar vuelve a elegir por atraso.'
                                    : 'Hasta que edites, cambiar la jornada o los minutos por equipo rearma la sugerencia.'}
                            </p>
                        </div>

                        <div className="p-4 space-y-3">
                            <div className="text-sm text-gray-500">Salida: <strong>Central BACAR</strong> ({startTime})</div>
                            {!catalogReady && selectedIds.length === 0 ? (
                                <p className="text-sm text-gray-500">Armando la sugerencia con los más atrasados que entran en la jornada…</p>
                            ) : sheet.stops.length === 0 ? (
                                <p className="text-sm text-gray-500">La ruta está vacía. Sumá un recomendado o rearmá la sugerencia.</p>
                            ) : (
                                sheet.stops.map((stop, stopIndex) => (
                                    <div key={stop.key} className="relative pl-8">
                                        <div className={`absolute left-0 top-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center ${toneClass[stopTone(stop)]}`}>
                                            {stopIndex + 1}
                                        </div>
                                        <div className="bg-white border border-gray-200 rounded shadow-sm p-3">
                                            <div className="flex justify-between gap-2 border-b pb-2 mb-2">
                                                <div>
                                                    <h3 className="font-bold text-gray-800 text-sm">{stop.companyName}</h3>
                                                    <p className="text-[11px] text-gray-500">
                                                        {stop.travelMin < 1 && stopIndex > 0
                                                            ? 'Mismo lugar'
                                                            : `${formatDuration(stop.travelMin)} de viaje · ${stop.distanceFromPrevKm.toFixed(1)} km${stopIndex === 0 ? ' desde central' : ''}`}
                                                        {' · '}
                                                        {stop.serviceMin} min en el lugar ({stop.items.length} {stop.items.length === 1 ? 'equipo' : 'equipos'})
                                                        {stop.longLeg ? ' · viaje largo' : ''}
                                                    </p>
                                                </div>
                                                <div className="text-xs text-gray-500 text-right">
                                                    <div>Llega {stop.arrivalLabel}</div>
                                                    <div>Sale {stop.departureLabel}</div>
                                                </div>
                                            </div>
                                            {stop.items.map((item) => {
                                                const index = selectedIds.indexOf(item.id);
                                                const delay = item.never
                                                    ? 'Sin mantenimientos'
                                                    : item.overdue > 0
                                                        ? `${item.overdue} días de atraso`
                                                        : 'En plazo';
                                                return (
                                                    <div key={item.id} className="py-2 border-b last:border-b-0">
                                                        <div className="flex items-start gap-2">
                                                            <div className="flex flex-col">
                                                                <button type="button" title="Subir" disabled={index <= 0} onClick={() => shiftDepositary(item.id, -1)} className="text-xs px-1 disabled:opacity-30">↑</button>
                                                                <button type="button" title="Bajar" disabled={index < 0 || index >= selectedIds.length - 1} onClick={() => shiftDepositary(item.id, 1)} className="text-xs px-1 disabled:opacity-30">↓</button>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex flex-wrap items-center gap-1 text-sm font-medium">
                                                                    <span>{item.alias}</span>
                                                                    {item.tickets > 0 && <span className="bg-red-100 text-red-700 text-[10px] px-1 rounded font-bold">FALLA</span>}
                                                                    {item.done && <span className="bg-green-100 text-green-700 text-[10px] px-1 rounded font-bold">HECHO HOY</span>}
                                                                </div>
                                                                <p className="text-[11px] text-gray-500">{item.daysLabel} · cada {item.freq} días · {delay}</p>
                                                                <StopWorkFields
                                                                    counter={item.bill_counter}
                                                                    observations={item.observations}
                                                                    tasks={tasksFor(item.id)}
                                                                    done={item.done}
                                                                    ticketId={ticketByStop[item.id]}
                                                                    finishing={finishingId === item.id}
                                                                    onCounter={(value) => updateDraft(item.id, 'bill_counter', value)}
                                                                    onObservations={(value) => updateDraft(item.id, 'observations', value)}
                                                                    onTasks={(tasks) => updateTasks(item.id, tasks)}
                                                                    onFinish={() => finishStop(item.id)}
                                                                />
                                                            </div>
                                                            <div className="flex flex-col gap-1">
                                                                <button type="button" onClick={() => removeDepositary(item.id)} className="text-[11px] px-2 py-1 rounded border text-red-700 border-red-200">
                                                                    Quitar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))
                            )}
                            {sheet.stops.length > 0 && (
                                <div className="text-sm text-gray-600 pl-8">
                                    Regreso a central · {formatDuration(sheet.returnMin)} · llegada {sheet.backAtBase}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="h-80 lg:h-full lg:flex-1 relative">
                        <RouteMap sheet={sheet} mapPoints={mapPoints} overBudget={overMin > 0} />
                    </div>
                </div>

                <div className="bg-gray-100 px-3 py-3 flex flex-wrap justify-between gap-2 border-t shrink-0">
                    <div className="flex gap-2">
                        <button type="button" onClick={saveRoute} disabled={unitCount === 0} className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-bold py-2 px-4 rounded shadow">
                            Guardar
                        </button>
                        <button type="button" onClick={downloadPDF} disabled={unitCount === 0} className="bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-bold py-2 px-4 rounded shadow">
                            PDF
                        </button>
                    </div>
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleFinalizeRoute}
                            disabled={isSending || unitCount === 0}
                            className="bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white font-bold py-2 px-4 rounded shadow"
                        >
                            {isSending ? 'Enviando…' : 'Finalizar y enviar'}
                        </button>
                        <button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteGeneratorModal;
