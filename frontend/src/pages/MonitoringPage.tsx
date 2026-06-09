/**
 * Módulo de Monitoreo de Equipos en Tiempo Real
 * Consume datos vía proxy del backend (evita CORS y timeouts del navegador a n8n).
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Activity, Wifi, WifiOff, Server } from 'lucide-react';
import api from '../config/axiosConfig';

const POLL_INTERVAL_MS = 30_000;

interface EquipmentItem {
    name: string;
    ip: string;
    status: 'ONLINE' | 'OFFLINE';
    packetLoss: number;
    latencyMs: number;
    checkedAt: string;
}

const normalizeData = (raw: unknown): EquipmentItem[] => {
    if (Array.isArray(raw)) return raw as EquipmentItem[];
    if (raw && typeof raw === 'object') {
        const obj = raw as Record<string, unknown>;
        const arr = obj.body ?? obj.data ?? obj.payload ?? obj.items ?? obj.equipos ?? obj.results;
        if (Array.isArray(arr)) return arr as EquipmentItem[];
    }
    return [];
};

const formatCheckedAt = (iso: string): string => {
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
        return '—';
    }
};

const getLatencyColor = (ms: number): string => {
    if (ms > 150) return 'text-red-600 font-semibold';
    if (ms > 50) return 'text-amber-600 font-medium';
    return 'text-green-600';
};

function extractErrorMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as { response?: { data?: { message?: string }; status?: number } }).response;
        if (response?.data?.message) return response.data.message;
        if (response?.status) return `Error del servidor (HTTP ${response.status}).`;
    }
    if (err instanceof Error) return err.message;
    return 'Error desconocido al obtener datos.';
}

const MonitoringPage: React.FC = () => {
    const [data, setData] = useState<unknown>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);

    const equipos = useMemo(() => normalizeData(data), [data]);

    const metrics = useMemo(() => ({
        total: equipos.length,
        online: equipos.filter((e) => String(e?.status).toUpperCase() === 'ONLINE').length,
        offline: equipos.filter((e) => String(e?.status).toUpperCase() === 'OFFLINE').length,
    }), [equipos]);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            setWarning(null);
            const response = await api.get('/api/monitoring/realtime');
            setData(response.data?.data ?? response.data);
            if (response.data?.source === 'ping' && response.data?.fallbackFrom) {
                setWarning(
                    'n8n no respondió. Se muestran datos de respaldo por ping desde el servidor. Configurá MONITORING_PING_TARGETS o levantá n8n.'
                );
            }
        } catch (err) {
            setError(extractErrorMessage(err));
            setWarning(null);
            setData(null);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, POLL_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [fetchData]);

    const handleRefreshNow = () => {
        setIsLoading(true);
        fetchData();
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-full">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-3">
                    <Activity className="w-8 h-8 text-red-600" />
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
                        Monitoreo de Equipos en Tiempo Real
                    </h1>
                </div>
                <button
                    onClick={handleRefreshNow}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-lg shadow-md transition-colors"
                >
                    {isLoading ? (
                        <>
                            <span className="animate-spin">⟳</span> Actualizando...
                        </>
                    ) : (
                        <>↻ Actualizar Ahora</>
                    )}
                </button>
            </header>

            {warning && (
                <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900">
                    <p className="font-semibold">⚠️ {warning}</p>
                </div>
            )}

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <p className="font-semibold">⚠️ {error}</p>
                    <p className="text-sm mt-2 text-red-700">
                        n8n en <strong>autbacar.dnsalias.com</strong> no responde desde el servidor. Opciones:
                    </p>
                    <ul className="text-sm mt-2 text-red-700 list-disc list-inside space-y-1">
                        <li>Levantar n8n y verificar el webhook en n8n.</li>
                        <li>Si n8n está en la red local, agregar en <code className="text-xs bg-red-100 px-1 rounded">backend/.env</code>: <code className="text-xs bg-red-100 px-1 rounded">N8N_MONITORING_WEBHOOK_FALLBACKS=http://IP:5678/webhook/...</code></li>
                        <li>Respaldo por ping: <code className="text-xs bg-red-100 px-1 rounded">MONITORING_PING_TARGETS=Servidor|192.168.0.9,Router|192.168.0.1</code></li>
                    </ul>
                </div>
            )}

            {isLoading && !data ? (
                <div className="flex items-center justify-center py-16">
                    <div className="flex flex-col items-center gap-3">
                        <span className="animate-spin text-4xl text-red-600">⟳</span>
                        <p className="text-gray-600">Cargando datos...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex items-center gap-4">
                            <div className="p-3 bg-gray-100 rounded-lg">
                                <Server className="w-8 h-8 text-gray-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Total de Equipos</p>
                                <p className="text-2xl font-bold text-gray-800">{metrics.total}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex items-center gap-4">
                            <div className="p-3 bg-green-50 rounded-lg">
                                <Wifi className="w-8 h-8 text-green-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Equipos Online</p>
                                <p className="text-2xl font-bold text-green-600">{metrics.online}</p>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 flex items-center gap-4">
                            <div className="p-3 bg-red-50 rounded-lg">
                                <WifiOff className="w-8 h-8 text-red-600" />
                            </div>
                            <div>
                                <p className="text-sm text-gray-500 font-medium">Equipos Offline</p>
                                <p className="text-2xl font-bold text-red-600">{metrics.offline}</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {equipos.length === 0 ? (
                            <div className="col-span-full text-center py-16 bg-white rounded-xl shadow-md border border-gray-200">
                                <Server className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">No hay equipos para mostrar</p>
                            </div>
                        ) : (
                            equipos.map((eq, idx) => {
                                const isOnline = String(eq?.status ?? '').toUpperCase() === 'ONLINE';
                                const latency = typeof eq?.latencyMs === 'number' ? eq.latencyMs : 0;
                                const packetLoss = typeof eq?.packetLoss === 'number' ? eq.packetLoss : 0;
                                return (
                                    <div
                                        key={eq?.ip ?? eq?.name ?? idx}
                                        className="bg-white rounded-xl shadow-md border border-gray-200 p-5 hover:shadow-lg transition-shadow"
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span
                                                    className={`flex-shrink-0 w-3 h-3 rounded-full animate-pulse ${
                                                        isOnline ? 'bg-green-500' : 'bg-red-500'
                                                    }`}
                                                    title={isOnline ? 'Online' : 'Offline'}
                                                />
                                                <h3 className="font-bold text-gray-800 truncate" title={eq?.name ?? '—'}>
                                                    {eq?.name ?? 'Sin nombre'}
                                                </h3>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-500 font-mono mb-4">{eq?.ip ?? '—'}</p>
                                        <div className="space-y-2 text-sm">
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Latencia</span>
                                                <span className={getLatencyColor(latency)}>{latency} ms</span>
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-gray-500">Pérdida paquetes</span>
                                                <span className={packetLoss > 0 ? 'text-amber-600 font-medium' : 'text-gray-700'}>
                                                    {packetLoss}%
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center pt-2 border-t border-gray-100">
                                                <span className="text-gray-500">Última verificación</span>
                                                <span className="text-gray-600 font-mono text-xs">
                                                    {formatCheckedAt(eq?.checkedAt ?? '')}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default MonitoringPage;
