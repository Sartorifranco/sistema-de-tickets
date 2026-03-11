/**
 * Módulo de Monitoreo de Equipos en Tiempo Real
 * Consume el endpoint n8n para obtener latidos/estado de equipos.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { Activity } from 'lucide-react';

const MONITORING_URL = 'https://autbacar.dnsalias.com/mcp-server/http';
const POLL_INTERVAL_MS = 30_000;

const MonitoringPage: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        try {
            setError(null);
            const response = await fetch(MONITORING_URL, {
                method: 'GET',
                headers: { Accept: 'application/json' },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const json = await response.json();
            setData(json);
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const isCors = message.toLowerCase().includes('cors') || message.toLowerCase().includes('failed to fetch');
            setError(
                isCors
                    ? `Error CORS/Red: ${message}. Verifica que el servidor n8n permita peticiones desde este origen.`
                    : `Error al obtener datos: ${message}`
            );
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

            {error && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                    <p className="font-semibold">⚠️ {error}</p>
                    <p className="text-sm mt-2 text-red-700">
                        Si el error es por CORS, configura el servidor n8n para permitir el origen de esta aplicación.
                    </p>
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
                <pre className="bg-gray-800 text-green-400 p-4 rounded-lg overflow-auto text-sm font-mono max-h-[calc(100vh-280px)]">
                    {data != null ? JSON.stringify(data, null, 2) : 'Sin datos'}
                </pre>
            )}
        </div>
    );
};

export default MonitoringPage;
