import { Depositario } from '../../types';

/** Central BACAR, Córdoba. */
export const BASE_COORDS: [number, number] = [-31.4166, -64.1835];

/** 1 = lunes … 7 = domingo. */
export const WEEKDAYS: { id: number; short: string; label: string }[] = [
    { id: 1, short: 'Lun', label: 'lunes' },
    { id: 2, short: 'Mar', label: 'martes' },
    { id: 3, short: 'Mié', label: 'miércoles' },
    { id: 4, short: 'Jue', label: 'jueves' },
    { id: 5, short: 'Vie', label: 'viernes' },
    { id: 6, short: 'Sáb', label: 'sábado' },
    { id: 7, short: 'Dom', label: 'domingo' },
];

export function isoWeekday(date: Date): number {
    const day = date.getDay();
    return day === 0 ? 7 : day;
}

export function weekdayLabel(id: number): string {
    const found = WEEKDAYS.find((day) => day.id === id);
    return found ? found.label : 'día';
}

const AVG_SPEED_KMH = 35;
/** Menos de 150 m en línea recta: mismo predio, un solo viaje. */
const SAME_SITE_STRAIGHT_KM = 0.15;
const AGE_CAP = 120;
const NEVER_SORT = 100000;

export interface MaintenanceProfile {
    days: number | null;
    daysSort: number;
    daysLabel: string;
    freq: number;
    overdue: number;
    never: boolean;
    tickets: number;
    due: boolean;
}

export interface StopDraft {
    bill_counter?: string;
    observations?: string;
}

export interface MarginalCost {
    minutes: number;
    drivingMin: number;
    km: number;
}

export interface RoadRoute {
    key: string;
    geometry: [number, number][];
    legMinutes: number[];
    legKm: number[];
    distanceKm: number;
}

export interface RouteSheetItem {
    id: number;
    alias: string;
    serial_number: string;
    address: string;
    companyName: string;
    daysLabel: string;
    freq: number;
    overdue: number;
    never: boolean;
    tickets: number;
    done: boolean;
    bill_counter: string;
    observations: string;
    raw: Depositario;
}

export interface RouteSheetStop {
    key: string;
    companyName: string;
    lat: number;
    lng: number;
    items: RouteSheetItem[];
    distanceFromPrevKm: number;
    travelMin: number;
    serviceMin: number;
    arrivalLabel: string;
    departureLabel: string;
    longLeg: boolean;
}

export interface RouteSheet {
    stops: RouteSheetStop[];
    distanceKm: number;
    driveMin: number;
    returnMin: number;
    serviceMin: number;
    totalMin: number;
    startLabel: string;
    backAtBase: string;
    source: 'estimado' | 'calles';
    routeKey: string;
    osrmPath: string;
    estimateDriveMin: number;
    geometry: [number, number][];
}

export interface PlanOptions {
    budgetMin: number;
    serviceMin: number;
    keepIds?: number[];
    companyId?: number | null;
}

export function hasCoords(dep: Depositario): boolean {
    const lat = Number(dep.lat);
    const lng = Number(dep.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
    if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return false;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
    return true;
}

/** Distancia en línea recta, en km. */
export function straightKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const earth = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sameSite(lat1: number, lon1: number, lat2: number, lon2: number): boolean {
    return straightKm(lat1, lon1, lat2, lon2) < SAME_SITE_STRAIGHT_KM;
}

/** Distancia aproximada por calle (recta × 1.4), en km. Solo se usa si el ruteo no responde. */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    return straightKm(lat1, lon1, lat2, lon2) * 1.4;
}

/**
 * Si el ruteo se dispara respecto de la recta, el GPS quedó mal enganchado a la calle.
 * En ese caso se queda el estimado. Un desvío real de hasta ~2 veces se respeta.
 */
function plausible(road: number, estimate: number, extra: number): number {
    if (!Number.isFinite(road) || road < 0) return estimate;
    const cap = Math.max(estimate * 2.2, estimate + extra);
    return road > cap ? estimate : road;
}

export function formatDuration(minutes: number): string {
    const total = Math.max(0, Math.round(minutes));
    const hours = Math.floor(total / 60);
    const mins = total % 60;
    if (hours === 0) return `${mins} min`;
    return `${hours} h ${String(mins).padStart(2, '0')} min`;
}

export function formatClock(date: Date): string {
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function parseStart(startTime: string): Date {
    const match = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
    const date = new Date();
    const hours = match ? Math.min(23, Number(match[1])) : 9;
    const minutes = match ? Math.min(59, Number(match[2])) : 0;
    date.setHours(hours, minutes, 0, 0);
    return date;
}

function argentinaDayStart(value: Date): number {
    const key = value.toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    const [year, month, day] = key.split('-').map(Number);
    return Date.UTC(year, month - 1, day);
}

function daysSince(value?: string | null): number | null {
    if (!value) return null;
    const last = new Date(value);
    if (Number.isNaN(last.getTime())) return null;
    const diff = argentinaDayStart(new Date()) - argentinaDayStart(last);
    return Math.max(0, Math.round(diff / 86400000));
}

export function dateKey(date: Date): string {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

export function maintainedOn(dep: Depositario, day: Date): boolean {
    if (!dep.last_maintenance) return false;
    const last = new Date(dep.last_maintenance);
    if (Number.isNaN(last.getTime())) return false;
    return argentinaDayStart(last) === argentinaDayStart(day);
}

export function maintainedToday(dep: Depositario): boolean {
    return maintainedOn(dep, new Date());
}

export function maintenanceProfile(dep: Depositario): MaintenanceProfile {
    const freqRaw = Number(dep.maintenance_freq);
    const freq = Number.isFinite(freqRaw) && freqRaw > 0 ? freqRaw : 30;
    const tickets = Number(dep.open_tickets_count) || 0;
    const days = daysSince(dep.last_maintenance);
    const never = days === null;
    const overdue = never ? freq : Math.max(0, days - freq);
    let daysLabel = 'Nunca';
    if (days === 0) daysLabel = 'Hoy';
    else if (days === 1) daysLabel = '1 día';
    else if (days !== null) daysLabel = `${days} días`;

    return {
        days,
        daysSort: never ? NEVER_SORT : days,
        daysLabel,
        freq,
        overdue,
        never,
        tickets,
        due: never || tickets > 0 || (days !== null && days >= freq),
    };
}

function indexById(deps: Depositario[]): Map<number, Depositario> {
    return new Map(deps.map((dep) => [dep.id, dep]));
}

function driveMinutes(km: number): number {
    return (km / AVG_SPEED_KMH) * 60;
}

/** Minutos reales de meter este equipo donde va a quedar (al lado, si comparte predio). */
export function insertionCost(
    ids: number[],
    dep: Depositario,
    deps: Depositario[],
    serviceMin: number,
): MarginalCost | null {
    if (!hasCoords(dep) || ids.includes(dep.id)) return null;
    const byId = indexById(deps);
    let nearest = getDistance(BASE_COORDS[0], BASE_COORDS[1], Number(dep.lat), Number(dep.lng));
    ids.forEach((id) => {
        const other = byId.get(id);
        if (!other || !hasCoords(other)) return;
        nearest = Math.min(nearest, getDistance(Number(other.lat), Number(other.lng), Number(dep.lat), Number(dep.lng)));
    });
    const before = estimateRouteMinutes(ids, deps, serviceMin);
    const after = estimateRouteMinutes(insertStop(ids, dep.id, deps), deps, serviceMin);
    const delta = Math.max(0, after - before);
    return {
        drivingMin: Math.max(0, delta - serviceMin),
        minutes: Math.max(1, Math.round(delta)),
        km: nearest,
    };
}

export function applyRoadFactor(cost: MarginalCost, factor: number, serviceMin: number): number {
    const safe = Number.isFinite(factor) && factor >= 0.45 && factor <= 2.4 ? factor : 1;
    return Math.max(1, Math.round(cost.drivingMin * safe + serviceMin));
}

export function roadFactorOf(driveMin: number, estimateDriveMin: number, source: RouteSheet['source']): number {
    if (source !== 'calles' || estimateDriveMin < 5) return 1;
    const factor = driveMin / estimateDriveMin;
    if (!Number.isFinite(factor) || factor < 0.45 || factor > 2.4) return 1;
    return factor;
}

export function estimateRouteMinutes(ids: number[], deps: Depositario[], serviceMin: number): number {
    const byId = indexById(deps);
    let lat = BASE_COORDS[0];
    let lng = BASE_COORDS[1];
    let total = 0;
    let count = 0;
    ids.forEach((id) => {
        const dep = byId.get(id);
        if (!dep || !hasCoords(dep)) return;
        total += driveMinutes(getDistance(lat, lng, Number(dep.lat), Number(dep.lng))) + serviceMin;
        lat = Number(dep.lat);
        lng = Number(dep.lng);
        count += 1;
    });
    if (!count) return 0;
    return total + driveMinutes(getDistance(lat, lng, BASE_COORDS[0], BASE_COORDS[1]));
}

/**
 * Arma una ruta dentro de la jornada.
 * Solo entra equipo vencido, nunca mantenido o con falla abierta.
 * El orden equilibra atraso y cercanía para no cruzar la ciudad al pedo.
 * keepIds queda fijo al principio (lo que el técnico ya eligió).
 */
export function planRoute(deps: Depositario[], options: PlanOptions): number[] {
    const byId = indexById(deps);
    const keep = (options.keepIds || []).filter((id) => {
        const dep = byId.get(id);
        return !!dep && hasCoords(dep);
    });
    const keepSet = new Set(keep);
    const inCompany = (dep: Depositario) => !options.companyId || Number(dep.company_id) === Number(options.companyId);

    let lat = BASE_COORDS[0];
    let lng = BASE_COORDS[1];
    let cursor = 0;
    keep.forEach((id) => {
        const dep = byId.get(id)!;
        cursor += driveMinutes(getDistance(lat, lng, Number(dep.lat), Number(dep.lng))) + options.serviceMin;
        lat = Number(dep.lat);
        lng = Number(dep.lng);
    });

    const pool = deps.filter((dep) => hasCoords(dep) && !keepSet.has(dep.id) && inCompany(dep) && maintenanceProfile(dep).due);
    const chosen = [...keep];

    while (pool.length && chosen.length < 60) {
        let bestIndex = -1;
        let bestScore = -1;
        for (let i = 0; i < pool.length; i += 1) {
            const candidate = pool[i];
            const dist = getDistance(lat, lng, Number(candidate.lat), Number(candidate.lng));
            const travel = driveMinutes(dist);
            const back = driveMinutes(getDistance(Number(candidate.lat), Number(candidate.lng), BASE_COORDS[0], BASE_COORDS[1]));
            if (cursor + travel + options.serviceMin + back > options.budgetMin) continue;

            const profile = maintenanceProfile(candidate);
            const age = Math.min(profile.daysSort, AGE_CAP) + (profile.never ? 30 : 0);
            const cluster = dist < 2 ? 2 : dist < 5 ? 1.35 : 1;
            const score = ((age + profile.tickets * 140) * cluster) / Math.pow(travel + 10, 0.75);
            if (score > bestScore) {
                bestScore = score;
                bestIndex = i;
            }
        }
        if (bestIndex < 0) break;
        const next = pool.splice(bestIndex, 1)[0];
        cursor += driveMinutes(getDistance(lat, lng, Number(next.lat), Number(next.lng))) + options.serviceMin;
        lat = Number(next.lat);
        lng = Number(next.lng);
        chosen.push(next.id);
    }

    return chosen;
}

/** Reordena los equipos elegidos para acortar el viaje. No agrega ni quita. */
export function optimizeOrder(ids: number[], deps: Depositario[]): number[] {
    const byId = indexById(deps);
    const pool = ids
        .map((id) => byId.get(id))
        .filter((dep): dep is Depositario => !!dep && hasCoords(dep));
    const ordered: number[] = [];
    let lat = BASE_COORDS[0];
    let lng = BASE_COORDS[1];

    while (pool.length) {
        let best = 0;
        let bestDist = Infinity;
        for (let i = 0; i < pool.length; i += 1) {
            const dist = getDistance(lat, lng, Number(pool[i].lat), Number(pool[i].lng));
            if (dist < bestDist) {
                bestDist = dist;
                best = i;
            }
        }
        const next = pool.splice(best, 1)[0];
        ordered.push(next.id);
        lat = Number(next.lat);
        lng = Number(next.lng);
    }
    return ordered;
}

/**
 * Inserta el equipo donde menos alarga la hoja.
 * Si ya hay otro en el mismo predio, lo deja al lado y no suma otro viaje.
 */
export function insertStop(ids: number[], id: number, deps: Depositario[]): number[] {
    if (ids.includes(id)) return ids;
    const byId = indexById(deps);
    const dep = byId.get(id);
    if (!dep || !hasCoords(dep)) return ids;

    const lat = Number(dep.lat);
    const lng = Number(dep.lng);
    for (let i = 0; i < ids.length; i += 1) {
        const other = byId.get(ids[i]);
        if (!other || !hasCoords(other)) continue;
        if (!sameSite(lat, lng, Number(other.lat), Number(other.lng))) continue;
        let insertAt = i + 1;
        while (insertAt < ids.length) {
            const neighbor = byId.get(ids[insertAt]);
            if (!neighbor || !hasCoords(neighbor)) break;
            if (!sameSite(lat, lng, Number(neighbor.lat), Number(neighbor.lng))) break;
            insertAt += 1;
        }
        const beside = [...ids];
        beside.splice(insertAt, 0, id);
        return beside;
    }

    let bestAt = ids.length;
    let bestMin = Infinity;
    for (let i = 0; i <= ids.length; i += 1) {
        const candidate = [...ids];
        candidate.splice(i, 0, id);
        const minutes = estimateRouteMinutes(candidate, deps, 0);
        if (minutes < bestMin) {
            bestMin = minutes;
            bestAt = i;
        }
    }
    const next = [...ids];
    next.splice(bestAt, 0, id);
    return next;
}

export function moveStop(ids: number[], id: number, direction: -1 | 1): number[] {
    const index = ids.indexOf(id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return ids;
    const next = [...ids];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    return next;
}

export function buildRouteSheet(
    ids: number[],
    deps: Depositario[],
    drafts: Record<number, StopDraft>,
    startTime: string,
    servicePerUnit: number,
    road: RoadRoute | null,
): RouteSheet {
    const byId = indexById(deps);
    const ordered = ids
        .map((id) => byId.get(id))
        .filter((dep): dep is Depositario => !!dep && hasCoords(dep));

    type Group = {
        deps: Depositario[];
        distKm: number;
        travelMin: number;
        lat: number;
        lng: number;
    };

    const groups: Group[] = [];
    let lat = BASE_COORDS[0];
    let lng = BASE_COORDS[1];
    ordered.forEach((dep) => {
        const nextLat = Number(dep.lat);
        const nextLng = Number(dep.lng);
        const distKm = getDistance(lat, lng, nextLat, nextLng);
        const previous = groups[groups.length - 1];
        const sharesSite = previous && sameSite(previous.lat, previous.lng, nextLat, nextLng);
        if (sharesSite && previous) {
            previous.deps.push(dep);
        } else {
            groups.push({
                deps: [dep],
                distKm,
                travelMin: driveMinutes(distKm),
                lat: nextLat,
                lng: nextLng,
            });
        }
        lat = nextLat;
        lng = nextLng;
    });

    const returnKm = ordered.length ? getDistance(lat, lng, BASE_COORDS[0], BASE_COORDS[1]) : 0;
    const returnEstimate = driveMinutes(returnKm);
    const estimateDriveMin = groups.reduce((sum, group) => sum + group.travelMin, 0) + returnEstimate;
    const routeKey = groups.map((group) => `${group.lat.toFixed(5)},${group.lng.toFixed(5)}`).join('|');
    const osrmPath = groups.length
        ? [
            `${BASE_COORDS[1]},${BASE_COORDS[0]}`,
            ...groups.map((group) => `${group.lng},${group.lat}`),
            `${BASE_COORDS[1]},${BASE_COORDS[0]}`,
        ].join(';')
        : '';

    const estimateTravel = groups.map((group) => group.travelMin);
    const estimateKm = groups.map((group) => group.distKm);
    const useRoad = !!road && road.key === routeKey && road.legMinutes.length === groups.length + 1;
    if (useRoad && road) {
        groups.forEach((group, index) => {
            group.travelMin = plausible(road.legMinutes[index], estimateTravel[index], 12);
            group.distKm = plausible(road.legKm[index], estimateKm[index], 8);
        });
    }

    let cursor = parseStart(startTime);
    const stops: RouteSheetStop[] = groups.map((group, index) => {
        const arrival = new Date(cursor.getTime() + group.travelMin * 60000);
        const serviceMin = group.deps.length * servicePerUnit;
        const departure = new Date(arrival.getTime() + serviceMin * 60000);
        cursor = departure;
        const names: string[] = [];
        group.deps.forEach((dep) => {
            const name = dep.company_name || 'Sin empresa';
            if (names.indexOf(name) === -1) names.push(name);
        });
        return {
            key: `${group.lat.toFixed(5)}-${group.lng.toFixed(5)}-${index}`,
            companyName: names.join(' · '),
            lat: group.lat,
            lng: group.lng,
            distanceFromPrevKm: group.distKm,
            travelMin: group.travelMin,
            serviceMin,
            arrivalLabel: formatClock(arrival),
            departureLabel: formatClock(departure),
            longLeg: group.travelMin >= 40,
            items: group.deps.map((dep) => {
                const profile = maintenanceProfile(dep);
                const draft = drafts[dep.id] || {};
                return {
                    id: dep.id,
                    alias: dep.alias,
                    serial_number: dep.serial_number,
                    address: dep.address,
                    companyName: dep.company_name || 'Sin empresa',
                    daysLabel: profile.daysLabel,
                    freq: profile.freq,
                    overdue: profile.overdue,
                    never: profile.never,
                    tickets: profile.tickets,
                    done: maintainedToday(dep),
                    bill_counter: draft.bill_counter || '',
                    observations: draft.observations || '',
                    raw: dep,
                };
            }),
        };
    });

    const returnMin = useRoad && road ? plausible(road.legMinutes[groups.length], returnEstimate, 12) : returnEstimate;
    const returnKmFinal = useRoad && road ? plausible(road.legKm[groups.length], returnKm, 8) : returnKm;
    const back = new Date(cursor.getTime() + returnMin * 60000);
    const driveMin = groups.reduce((sum, group) => sum + group.travelMin, 0) + returnMin;
    const serviceMin = ordered.length * servicePerUnit;
    const straight: [number, number][] = [
        [BASE_COORDS[0], BASE_COORDS[1]],
        ...groups.map((group) => [group.lat, group.lng] as [number, number]),
        [BASE_COORDS[0], BASE_COORDS[1]],
    ];

    return {
        stops,
        distanceKm: Number((groups.reduce((sum, group) => sum + group.distKm, 0) + returnKmFinal).toFixed(1)),
        driveMin,
        returnMin,
        serviceMin,
        totalMin: driveMin + serviceMin,
        startLabel: formatClock(parseStart(startTime)),
        backAtBase: ordered.length ? formatClock(back) : formatClock(parseStart(startTime)),
        source: useRoad ? 'calles' : 'estimado',
        routeKey,
        osrmPath,
        estimateDriveMin,
        geometry: useRoad && road?.geometry?.length
            ? road.geometry
            : groups.length
                ? straight
                : [[BASE_COORDS[0], BASE_COORDS[1]]],
    };
}
