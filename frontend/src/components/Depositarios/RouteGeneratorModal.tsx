import React, { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Depositario } from '../../types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; 
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';

// --- CONFIGURACIÓN BASE ---
const BASE_COORDS: [number, number] = [-31.4166, -64.1835]; // Central BACAR
const AVG_SPEED_KMH = 35; 
const SERVICE_TIME_PER_UNIT = 15; 
const MAX_TIME_MINUTES = 4 * 60; 

// Interface extendida para soportar datos de reporte
interface RouteStop {
    companyId: number;
    companyName: string;
    lat: number;
    lng: number;
    items: (Depositario & { 
        bill_counter?: string; // Nuevo
        observations?: string; // Nuevo
        is_completed?: boolean; // Nuevo
    })[];
    distanceFromPrev: number;
    travelTimeFromPrev: number;
    serviceTime: number;
    arrivalTime: string;
    departureTime: string;
}

// --- ICONOS ---
const baseIcon = L.divIcon({ className: 'custom-base-icon', html: '<div class="bg-blue-800 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg">🏢</div>', iconSize: [32, 32], iconAnchor: [16, 16] });

const getNumberIcon = (n: number, done: boolean, forced: boolean) => L.divIcon({ 
    className: 'custom-number-icon', 
    html: `<div class="${done ? 'bg-green-600' : forced ? 'bg-purple-600 ring-2 ring-purple-300' : 'bg-red-600'} text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md font-bold text-sm">${forced ? '★' : n}</div>`, 
    iconSize: [28, 28], 
    iconAnchor: [14, 14] 
});

const MapBounds = ({ points }: { points: [number, number][] }) => {
    const map = useMap();
    useEffect(() => { 
        if (points.length > 0) map.fitBounds(L.latLngBounds(points), { padding: [50, 50] }); 
    }, [points, map]);
    return null;
};

interface Props {
    depositarios: Depositario[];
    onClose: () => void;
    onMaintenanceOpen: (dep: Depositario) => void;
}

const RouteGeneratorModal: React.FC<Props> = ({ depositarios, onClose, onMaintenanceOpen }) => {
    // --- ESTADOS ---
    const [routeVisuals, setRouteVisuals] = useState<RouteStop[]>([]);
    const [totalDistance, setTotalDistance] = useState(0);
    const [totalTime, setTotalTime] = useState(0);
    const [forcedDepositaryIds, setForcedDepositaryIds] = useState<number[]>([]); 
    const [routeGeometry, setRouteGeometry] = useState<[number, number][]>([]);
    const [routeId, setRouteId] = useState<number | null>(null);
    const [isCalculating, setIsCalculating] = useState(false); 
    const [isSending, setIsSending] = useState(false); // Nuevo estado para envío

    const sortedDepositarios = useMemo(() => [...depositarios].sort((a, b) => a.alias.localeCompare(b.alias)), [depositarios]);

    // --- MANEJADORES DE PRIORIDAD ---
    const handleAddPriority = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const id = parseInt(e.target.value);
        if (!isNaN(id) && !forcedDepositaryIds.includes(id)) setForcedDepositaryIds([...forcedDepositaryIds, id]);
        e.target.value = "";
    };
    const handleRemovePriority = (id: number) => setForcedDepositaryIds(prev => prev.filter(pid => pid !== id));

    const isLongTrip = (dep: Depositario) => {
        const text = (dep.alias + ' ' + dep.address).toUpperCase();
        return text.includes('RN36') || text.includes('RUTA 36') || text.includes('RIO CUARTO');
    };

    // --- ACTUALIZAR DATOS EN VIVO (Inputs del técnico) ---
    const updateItemData = (stopIdx: number, itemIdx: number, field: 'bill_counter' | 'observations', value: string) => {
        const newRoute = [...routeVisuals];
        newRoute[stopIdx].items[itemIdx] = { ...newRoute[stopIdx].items[itemIdx], [field]: value };
        setRouteVisuals(newRoute);
    };

    // Marcar como completado localmente (para visualización)
    const toggleComplete = (stopIdx: number, itemIdx: number) => {
        const newRoute = [...routeVisuals];
        const item = newRoute[stopIdx].items[itemIdx];
        item.is_completed = !item.is_completed;
        setRouteVisuals(newRoute);
        
        // Si se marca como completado, abrimos el modal de mantenimiento real (opcional)
        if (item.is_completed) {
            onMaintenanceOpen(item);
        }
    };

    // --- CÁLCULO DE RUTA (OSRM) ---
    const fetchRealRouteData = async (stops: RouteStop[]) => {
        if (stops.length === 0) { setIsCalculating(false); return; }
        let coordsString = `${BASE_COORDS[1]},${BASE_COORDS[0]}`;
        stops.forEach(s => coordsString += `;${s.lng},${s.lat}`);
        coordsString += `;${BASE_COORDS[1]},${BASE_COORDS[0]}`; 

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${coordsString}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                const geometry = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
                setRouteGeometry(geometry);
                const realDistKm = (route.distance / 1000).toFixed(1);
                const travelTimeMin = Math.round(route.duration / 60);
                const totalServiceTime = stops.reduce((acc, s) => acc + s.serviceTime, 0);
                
                setTotalDistance(Number(realDistKm));
                setTotalTime(travelTimeMin + totalServiceTime);
            }
        } catch (error) {
            console.error("Error OSRM:", error);
            toast.warn("No se pudo calcular la ruta exacta (Error API Mapa).");
        } finally {
            setIsCalculating(false);
        }
    };

    // --- GUARDAR RUTA (INICIO) ---
    const saveRoute = async () => {
        if (routeVisuals.length === 0) return;
        try {
            const res = await api.post('/api/depositarios/route', {
                total_distance_km: totalDistance,
                total_time_minutes: totalTime,
                stops: routeVisuals.flatMap(s => s.items.map(i => ({ id: i.id, alias: i.alias })))
            });
            setRouteId(res.data.routeId);
            toast.success(`Ruta #${res.data.routeId} guardada correctamente.`);
        } catch (error) {
            console.error(error);
            toast.error("Error al guardar la ruta.");
        }
    };

    // --- FINALIZAR RUTA Y ENVIAR MAIL ---
    // --- FINALIZAR RUTA Y ENVIAR MAIL ---
    const handleFinalizeRoute = async () => {
        if (!routeId) {
            toast.warning("Primero debes guardar/iniciar la ruta.");
            return;
        }

        if (!window.confirm("¿Estás seguro de finalizar el recorrido y enviar el reporte por correo?")) return;

        setIsSending(true);
        try {
            // Aplanamos la estructura y enviamos el ID para que el backend busque los datos reales
            const flatStops = routeVisuals.flatMap(stop => 
                stop.items.map(item => ({
                    id: item.id, // <--- IMPORTANTE: Enviamos el ID
                    alias: item.alias,
                    serial_number: item.serial_number,
                    status: item.is_completed ? 'Hecho' : 'Pendiente',
                    // Enviamos los datos manuales por si acaso no se encuentra mantenimiento en BD
                    bill_counter: item.bill_counter,
                    observations: item.observations,
                }))
            );

            await api.post('/api/depositarios/route/finalize', {
                routeId,
                total_km: totalDistance,
                total_minutes: totalTime,
                stopsData: flatStops
            });

            toast.success("¡Ruta finalizada y reporte enviado con éxito!");
            onClose();
        } catch (error) {
            console.error(error);
            toast.error("Hubo un error al enviar el reporte.");
        } finally {
            setIsSending(false);
        }
    };

    // --- GENERAR PDF ---
    const downloadPDF = () => {
        const doc = new jsPDF();
        const today = new Date().toLocaleDateString();
        doc.setFillColor(41, 128, 185);
        doc.rect(0, 0, 210, 40, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.text("HOJA DE RUTA - BACAR", 14, 20);
        doc.setFontSize(12);
        doc.text(`Fecha: ${today} | ID: #${routeId || 'Borrador'}`, 14, 30);
        
        // ... (Tu lógica de PDF existente se mantiene igual)
        // Solo asegúrate de que use routeVisuals actualizado
        
        const tableBody = routeVisuals.map((stop, i) => {
            const details = stop.items.map(it => `• ${it.alias} ${it.is_completed ? '[OK]' : ''}`).join('\n');
            return [ i + 1, stop.arrivalTime, stop.companyName, stop.items.length, details, `${stop.serviceTime} min` ];
        });

        autoTable(doc, {
            startY: 55,
            head: [['#', 'Hora', 'Ubicación', 'Cant.', 'Detalle', 'Tiempo']],
            body: tableBody,
            theme: 'striped',
        });
        
        doc.save(`Ruta_BACAR_${today.replace(/\//g,'-')}.pdf`);
    };

    function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
        const R = 6371; 
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c * 1.4; 
    }

    // --- ALGORITMO PRINCIPAL (Efecto) ---
    useEffect(() => {
        setIsCalculating(true);
        const timer = setTimeout(() => {
            let pool = depositarios.filter(d => d.lat && d.lng && d.company_id).map(d => ({...d, is_completed: false}));
            let currentLat = BASE_COORDS[0];
            let currentLng = BASE_COORDS[1];
            let accumulatedMinutes = 0;
            let accumulatedKm = 0;
            
            const executionOrder: { dep: any, dist: number, travel: number }[] = [];

            // 1. PRIORIDADES
            let forcedPool = pool.filter(d => forcedDepositaryIds.includes(d.id));
            while (forcedPool.length > 0) {
                let bestIdx = -1; let minDist = Infinity;
                for (let i = 0; i < forcedPool.length; i++) {
                    const d = getDistance(currentLat, currentLng, Number(forcedPool[i].lat), Number(forcedPool[i].lng));
                    if (d < minDist) { minDist = d; bestIdx = i; }
                }
                if (bestIdx !== -1) {
                    const target = forcedPool[bestIdx];
                    const travel = (minDist / AVG_SPEED_KMH) * 60;
                    accumulatedMinutes += (travel + SERVICE_TIME_PER_UNIT);
                    accumulatedKm += minDist;
                    executionOrder.push({ dep: target, dist: minDist, travel });
                    currentLat = Number(target.lat); currentLng = Number(target.lng);
                    pool = pool.filter(p => p.id !== target.id);
                    forcedPool.splice(bestIdx, 1);
                }
            }

            // 2. BARRIDO ZONAL
            while (accumulatedMinutes < MAX_TIME_MINUTES && pool.length > 0) {
                const candidates = pool.map(item => {
                    const dist = getDistance(currentLat, currentLng, Number(item.lat), Number(item.lng));
                    const travel = (dist / AVG_SPEED_KMH) * 60;
                    return { item, dist, travel };
                }).filter(c => (accumulatedMinutes + c.travel + SERVICE_TIME_PER_UNIT) <= MAX_TIME_MINUTES);

                if (candidates.length === 0) break;

                // Optimización simple
                candidates.sort((a, b) => a.dist - b.dist);
                const bestCandidate = candidates[0];

                accumulatedMinutes += (bestCandidate.travel + SERVICE_TIME_PER_UNIT);
                accumulatedKm += bestCandidate.dist;
                executionOrder.push({ dep: bestCandidate.item, dist: bestCandidate.dist, travel: bestCandidate.travel });
                currentLat = Number(bestCandidate.item.lat);
                currentLng = Number(bestCandidate.item.lng);
                pool = pool.filter(p => p.id !== bestCandidate.item.id);
            }

            // Retorno
            const returnMetrics = getDistance(currentLat, currentLng, BASE_COORDS[0], BASE_COORDS[1]);
            const returnTime = (returnMetrics / AVG_SPEED_KMH) * 60;
            setTotalDistance(parseFloat((accumulatedKm + returnMetrics).toFixed(1)));
            setTotalTime(Math.round(accumulatedMinutes + returnTime));

            // 3. AGRUPAR VISUALES
            const visuals: RouteStop[] = [];
            let timeCursor = new Date(); timeCursor.setHours(9, 0, 0);

            executionOrder.forEach((step) => {
                const dep = step.dep;
                let isSameLocation = false;
                if (visuals.length > 0) {
                    const last = visuals[visuals.length - 1];
                    if (getDistance(last.lat, last.lng, Number(dep.lat), Number(dep.lng)) < 0.05) isSameLocation = true;
                }

                const arr = new Date(timeCursor.getTime() + step.travel * 60000);
                const depTime = new Date(arr.getTime() + SERVICE_TIME_PER_UNIT * 60000);
                timeCursor = depTime;

                if (isSameLocation) {
                    const last = visuals[visuals.length - 1];
                    last.items.push(dep);
                    last.serviceTime += SERVICE_TIME_PER_UNIT;
                    last.departureTime = depTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
                } else {
                    visuals.push({
                        companyId: dep.company_id,
                        companyName: dep.company_name || 'Sin Nombre',
                        lat: Number(dep.lat), lng: Number(dep.lng),
                        items: [dep],
                        distanceFromPrev: parseFloat(step.dist.toFixed(1)),
                        travelTimeFromPrev: Math.round(step.travel),
                        serviceTime: SERVICE_TIME_PER_UNIT,
                        arrivalTime: arr.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
                        departureTime: depTime.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})
                    });
                }
            });

            setRouteVisuals(visuals);
            fetchRealRouteData(visuals); 
        }, 100);
        return () => clearTimeout(timer);
    }, [depositarios, forcedDepositaryIds]);


    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-7xl h-[90vh] flex flex-col overflow-hidden">
                {/* HEADER */}
                <div className="bg-slate-800 text-white p-4 shadow-md z-10 flex flex-col justify-between gap-3">
                    <div className="flex justify-between items-center">
                        <h2 className="text-2xl font-bold flex items-center gap-2">🚚 Hoja de Ruta Operativa</h2>
                        <div className="text-right">
                            {isCalculating ? (
                                <div className="text-yellow-400 text-sm animate-pulse">Calculando ruta...</div>
                            ) : (
                                <>
                                    <div className="text-3xl font-bold text-green-400">{Math.floor(totalTime / 60)}h {totalTime % 60}m</div>
                                    <div className="text-xs text-slate-400">{totalDistance} km (Real)</div>
                                </>
                            )}
                            {routeId && <div className="text-[10px] text-gray-500 mt-1">ID Ruta: #{routeId}</div>}
                        </div>
                    </div>
                    {/* Controles de Prioridad */}
                    <div className="flex items-center gap-3 bg-slate-700 p-2 rounded">
                        <span className="text-yellow-400 font-bold">★ Prioridades:</span>
                        <select className="bg-slate-800 text-white border border-slate-500 rounded px-2 py-1 text-sm outline-none" onChange={handleAddPriority} value="">
                            <option value="" disabled>+ Agregar objetivo...</option>
                            {sortedDepositarios.map(d => <option key={d.id} value={d.id}>{d.alias}</option>)}
                        </select>
                        <div className="flex gap-2 flex-wrap">
                            {forcedDepositaryIds.map(id => (
                                <span key={id} className="bg-purple-600 text-xs px-2 py-1 rounded-full flex items-center gap-2">
                                    {depositarios.find(d => d.id === id)?.alias}
                                    <button onClick={() => handleRemovePriority(id)} className="font-bold hover:text-red-300">✕</button>
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* BODY */}
                <div className="flex flex-col lg:flex-row flex-grow overflow-hidden">
                    {/* LISTA DE PARADAS (Interactiva) */}
                    <div className="w-full lg:w-2/5 bg-gray-50 overflow-y-auto border-r border-gray-200 p-5 space-y-4">
                        <div className="flex items-center gap-2 text-gray-500 text-sm mb-4"><span className="text-lg">🏢</span> Salida: <strong>Central BACAR</strong> (09:00)</div>
                        
                        {isCalculating ? (
                            <div className="flex justify-center items-center h-40">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-800"></div>
                            </div>
                        ) : routeVisuals.length === 0 ? (
                            <div className="text-center text-gray-400 mt-10">No hay ruta disponible.</div>
                        ) : (
                            routeVisuals.map((stop, stopIdx) => {
                                const allDone = stop.items.every(d => d.is_completed);
                                const isForced = stop.items.some(d => forcedDepositaryIds.includes(d.id));
                                return (
                                    <div key={stopIdx} className={`relative pl-8 border-l-2 pb-4 ${allDone ? 'border-green-400' : 'border-dashed border-gray-300'}`}>
                                        <div className={`absolute -left-3 top-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shadow ${allDone ? 'bg-green-600' : isForced ? 'bg-purple-600' : 'bg-blue-600'}`}>{stopIdx + 1}</div>
                                        <div className="bg-white p-3 rounded shadow-sm border border-gray-200">
                                            <div className="flex justify-between border-b pb-2 mb-2">
                                                <h3 className="font-bold text-gray-800">{stop.companyName}</h3>
                                                <div className="text-xs text-gray-500 text-right">
                                                    <div>Llegada: {stop.arrivalTime}</div>
                                                </div>
                                            </div>
                                            {stop.items.map((item, itemIdx) => (
                                                <div key={item.id} className="flex flex-col gap-2 py-2 border-b last:border-b-0">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <div className="flex items-center gap-2 font-medium">
                                                            <span>{item.alias}</span>
                                                            {(item as any).open_tickets_count > 0 && <span className="bg-red-100 text-red-600 text-[10px] px-1 rounded font-bold border border-red-200">FALLA</span>}
                                                        </div>
                                                        <button 
                                                            onClick={() => toggleComplete(stopIdx, itemIdx)} 
                                                            className={`text-xs px-2 py-1 rounded border ${item.is_completed ? 'bg-green-100 text-green-700 border-green-300 font-bold' : 'bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100'}`}
                                                        >
                                                            {item.is_completed ? '✔ Completado' : 'Realizar'}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* INPUTS DE REPORTE RAPIDO */}
                                                    <div className="flex gap-2 mt-1">
                                                        <input 
                                                            type="number" 
                                                            placeholder="Contador" 
                                                            className="w-24 p-1 text-xs border rounded bg-gray-50 focus:bg-white"
                                                            value={item.bill_counter || ''}
                                                            onChange={(e) => updateItemData(stopIdx, itemIdx, 'bill_counter', e.target.value)}
                                                        />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Observación breve..." 
                                                            className="flex-grow p-1 text-xs border rounded bg-gray-50 focus:bg-white"
                                                            value={item.observations || ''}
                                                            onChange={(e) => updateItemData(stopIdx, itemIdx, 'observations', e.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* MAPA */}
                    <div className="w-full lg:w-3/5 h-full relative">
                        {isCalculating && (
                            <div className="absolute inset-0 z-[1000] bg-white bg-opacity-50 flex items-center justify-center">
                                <div className="text-blue-900 font-bold bg-white px-4 py-2 rounded shadow">Cargando mapa...</div>
                            </div>
                        )}
                        <MapContainer center={BASE_COORDS} zoom={11} style={{ height: '100%', width: '100%' }}>
                            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />
                            <MapBounds points={routeGeometry.length > 0 ? routeGeometry : [[BASE_COORDS[0], BASE_COORDS[1]]]} />
                            {routeGeometry.length > 0 && <Polyline positions={routeGeometry} color="#3b82f6" weight={5} opacity={0.7} />}
                            <Marker position={BASE_COORDS} icon={baseIcon} />
                            {routeVisuals.map((stop, idx) => (
                                <Marker key={idx} position={[stop.lat, stop.lng]} icon={getNumberIcon(idx + 1, stop.items.every(d => d.is_completed), stop.items.some(d => forcedDepositaryIds.includes(d.id)))}>
                                    <Popup><div className="text-center font-bold">{stop.companyName}</div></Popup>
                                </Marker>
                            ))}
                        </MapContainer>
                    </div>
                </div>

                {/* FOOTER */}
                <div className="bg-gray-100 p-3 flex justify-between border-t items-center">
                    <div className="flex gap-2">
                        <button onClick={saveRoute} disabled={isCalculating} className={`bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow ${isCalculating ? 'opacity-50 cursor-not-allowed' : ''}`}>💾 Guardar / Iniciar</button>
                        <button onClick={downloadPDF} disabled={isCalculating} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded shadow">📄 PDF</button>
                    </div>
                    
                    <div className="flex gap-2">
                        {/* BOTÓN FINALIZAR (Nuevo) */}
                        <button 
                            onClick={handleFinalizeRoute} 
                            disabled={isSending || isCalculating}
                            className={`bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded shadow-lg flex items-center gap-2 ${isSending ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {isSending ? 'Enviando...' : '🏁 Finalizar y Enviar Reporte'}
                        </button>
                        <button onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded">Cerrar</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouteGeneratorModal;