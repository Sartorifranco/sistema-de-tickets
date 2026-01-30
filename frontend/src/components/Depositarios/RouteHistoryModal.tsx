import React, { useState, useEffect } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';

interface RouteStop {
    id: number;
    alias: string;
    serial_number?: string;
    tasks_done?: string[]; 
    bill_counter?: string;
    observations?: string;
    status?: string;
}

interface RouteRecord {
    id: number;
    username: string; 
    total_distance_km: number;
    stops_json: any; 
    created_at: string;
}

interface Props {
    onClose: () => void;
}

const RouteHistoryModal: React.FC<Props> = ({ onClose }) => {
    const [history, setHistory] = useState<RouteRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoute, setSelectedRoute] = useState<RouteRecord | null>(null);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await api.get('/api/depositarios/route');
            if (res.data.success) {
                // Parseo robusto del JSON que viene de la BD
                const parsedData = res.data.data.map((r: any) => {
                    let stops = [];
                    try {
                        stops = typeof r.stops_json === 'string' ? JSON.parse(r.stops_json) : r.stops_json;
                    } catch (e) {
                        console.error("Error parseando historial:", e);
                    }
                    return { ...r, stops_json: Array.isArray(stops) ? stops : [] };
                });
                setHistory(parsedData);
            }
        } catch (error) {
            console.error(error);
            toast.error("Error cargando historial");
        } finally {
            setLoading(false);
        }
    };

    // VISTA: LISTA DE RUTAS
    const renderList = () => (
        <div className="overflow-auto max-h-[70vh]">
            <table className="w-full text-left border-collapse">
                <thead className="bg-gray-100 text-gray-600 uppercase text-xs sticky top-0 z-10">
                    <tr>
                        <th className="p-3">ID</th>
                        <th className="p-3">Fecha</th>
                        <th className="p-3">Técnico</th>
                        <th className="p-3 text-center">Equipos</th>
                        <th className="p-3 text-center">Acción</th>
                    </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-200">
                    {history.map(route => (
                        <tr key={route.id} className="hover:bg-gray-50 transition-colors">
                            <td className="p-3 font-bold text-blue-600">#{route.id}</td>
                            <td className="p-3">
                                {new Date(route.created_at).toLocaleDateString()}
                                <div className="text-xs text-gray-400">{new Date(route.created_at).toLocaleTimeString()}</div>
                            </td>
                            <td className="p-3 font-medium uppercase text-xs">{route.username}</td>
                            <td className="p-3 text-center">
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">
                                    {route.stops_json.length}
                                </span>
                            </td>
                            <td className="p-3 text-center">
                                <button 
                                    onClick={() => setSelectedRoute(route)}
                                    className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 font-bold text-xs px-3 py-1 rounded transition-colors"
                                >
                                    Ver Detalle
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
            {history.length === 0 && !loading && <div className="p-10 text-center text-gray-400">Sin historial.</div>}
        </div>
    );

    // VISTA: DETALLE DE UNA RUTA
    const renderDetail = () => {
        if (!selectedRoute) return null;
        const stops: RouteStop[] = selectedRoute.stops_json;

        return (
            <div className="flex flex-col h-full animate-fade-in">
                {/* Header Interno */}
                <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mb-4 flex justify-between items-center shrink-0">
                    <div>
                        <h3 className="font-bold text-lg text-blue-900">Ruta #{selectedRoute.id}</h3>
                        <p className="text-xs text-blue-600 uppercase font-bold">{selectedRoute.username}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-sm text-blue-800">{new Date(selectedRoute.created_at).toLocaleString()}</p>
                        <p className="text-xs text-blue-500">{selectedRoute.total_distance_km} km estimados</p>
                    </div>
                </div>

                {/* Lista de Equipos */}
                <div className="space-y-3 overflow-y-auto pr-2 flex-grow">
                    {stops.map((stop, idx) => {
                        const isDone = stop.status === 'Hecho';
                        const hasTasks = stop.tasks_done && stop.tasks_done.length > 0;

                        return (
                            <div key={idx} className={`bg-white border rounded p-3 shadow-sm relative overflow-hidden ${isDone ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-400'}`}>
                                <div className="flex flex-col md:flex-row gap-4">
                                    {/* Bloque 1: Identificación */}
                                    <div className="w-full md:w-1/3">
                                        <div className="font-bold text-gray-800 text-sm mb-1">{stop.alias}</div>
                                        <div className="text-xs text-gray-400">S/N: {stop.serial_number || '-'}</div>
                                        <div className="mt-2">
                                            <span className="text-[10px] uppercase font-bold text-gray-500 block">Contador:</span>
                                            <span className="font-mono text-blue-600 bg-blue-50 px-1 rounded text-sm">
                                                {stop.bill_counter || '-'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bloque 2: Tareas */}
                                    <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Tareas:</span>
                                        {hasTasks ? (
                                            <div className="grid grid-cols-1 gap-1">
                                                {stop.tasks_done!.map((t, i) => (
                                                    <div key={i} className="text-xs text-gray-700 flex items-center gap-1">
                                                        <span className="text-green-500 font-bold">✓</span> {t}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <span className="text-xs text-gray-400 italic">--</span>
                                        )}
                                    </div>

                                    {/* Bloque 3: Obs */}
                                    <div className="w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-100 pt-2 md:pt-0 md:pl-4">
                                        <span className="text-[10px] uppercase font-bold text-gray-500 block mb-1">Observaciones:</span>
                                        <p className="text-xs text-gray-600 italic">
                                            {stop.observations || '--'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-white border-b p-4 flex justify-between items-center shrink-0">
                    <h2 className="text-xl font-bold text-gray-800">📂 Historial Operativo</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-bold">✕</button>
                </div>

                <div className="flex-grow p-4 bg-gray-50 overflow-hidden relative">
                    {loading && (
                        <div className="absolute inset-0 flex justify-center items-center bg-white/80 z-20">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    )}
                    {selectedRoute ? renderDetail() : renderList()}
                </div>

                <div className="bg-white p-4 border-t flex justify-between items-center shrink-0">
                    {selectedRoute ? (
                        <button onClick={() => setSelectedRoute(null)} className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-2 px-4 rounded text-sm transition-colors">
                            ← Volver
                        </button>
                    ) : <span></span>}
                    <button onClick={onClose} className="bg-gray-800 hover:bg-gray-900 text-white font-bold py-2 px-4 rounded text-sm transition-colors">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RouteHistoryModal;