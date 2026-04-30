import React, { useState, useEffect } from 'react';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import { clCard } from '../utils/cleanLightUi';

// ✅ NUEVO: Definimos el tipo para las métricas que recibiremos
interface ResolutionMetrics {
    resolvedTicketsCount: number;
    averageResolutionTimeFormatted: string;
}

const ReportsPage: React.FC = () => {
    const [metrics, setMetrics] = useState<ResolutionMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const response = await api.get('/api/metrics/resolution-time');
                setMetrics(response.data.data);
            } catch (error) {
                toast.error("Error al cargar las métricas.");
            } finally {
                setLoading(false);
            }
        };

        fetchMetrics();
    }, []);

    if (loading) {
        return <div className="p-8 text-center">Cargando métricas...</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-6 tracking-tight">Reportes y Métricas</h1>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Tarjeta para el Tiempo de Resolución */}
                <div className={`${clCard} p-6`}>
                    <h2 className="text-lg font-semibold text-gray-500 border-b border-gray-100 pb-2 mb-2">Tiempo Promedio de Resolución</h2>
                    {metrics ? (
                        <p className="text-3xl font-bold text-indigo-600 mt-2">
                            {metrics.averageResolutionTimeFormatted}
                        </p>
                    ) : <p className="text-gray-600 mt-2">No hay datos</p>}
                </div>

                {/* Tarjeta para el Total de Tickets Resueltos */}
                <div className={`${clCard} p-6`}>
                    <h2 className="text-lg font-semibold text-gray-500 border-b border-gray-100 pb-2 mb-2">Total de Tickets Resueltos</h2>
                     {metrics ? (
                        <p className="text-3xl font-bold text-green-600 mt-2">
                            {metrics.resolvedTicketsCount}
                        </p>
                    ) : <p className="text-gray-600 mt-2">0</p>}
                </div>
                
                {/* Puedes añadir más tarjetas de métricas aquí en el futuro */}
            </div>
        </div>
    );
};

export default ReportsPage;