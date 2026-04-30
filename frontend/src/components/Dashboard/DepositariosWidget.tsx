import React, { useEffect, useState } from 'react';
import api from '../../config/axiosConfig';
import { clCard } from '../../utils/cleanLightUi';

export interface DepositariosMetricsData {
    totalDepositarios: number;
    maintainedThisMonth: number;
    criticalCount: number;
    criticalList: any[];
}

const defaultMetrics: DepositariosMetricsData = {
    totalDepositarios: 0,
    maintainedThisMonth: 0,
    criticalCount: 0,
    criticalList: [],
};

/** Métricas de depositarios reutilizables (Admin/Agente dashboard y KPIs). */
export function useDepositariosMetrics(): DepositariosMetricsData {
    const [metrics, setMetrics] = useState<DepositariosMetricsData>(defaultMetrics);

    useEffect(() => {
        const fetchMetrics = async () => {
            try {
                const res = await api.get('/api/depositarios/metrics');
                if (res.data?.data) {
                    setMetrics(res.data.data);
                }
            } catch (error) {
                console.error('Error cargando métricas de depositarios', error);
            }
        };
        fetchMetrics();
    }, []);

    return metrics;
}

export const DepositariosCriticalListModal: React.FC<{ title: string; items: any[]; onClose: () => void }> = ({
    title,
    items,
    onClose,
}) => (
    <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-50 p-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-red-50">
                <h3 className="font-bold text-slate-900">{title}</h3>
                <button type="button" onClick={onClose} className="text-slate-500 font-semibold hover:text-slate-800">
                    ✕
                </button>
            </div>
            <div className="p-4 overflow-y-auto">
                {items.length === 0 ? (
                    <p className="text-slate-600">Nada por aquí.</p>
                ) : (
                    <ul className="space-y-2">
                        {items.map((item: any, idx: number) => (
                            <li key={idx} className="border-b border-gray-100 pb-2">
                                <p className="font-bold text-slate-900">{item.alias}</p>
                                <p className="text-xs text-slate-600">
                                    {item.company_name} -{' '}
                                    {item.last_maint ? new Date(item.last_maint).toLocaleDateString() : 'Nunca mantenido'}
                                </p>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    </div>
);

const kpiCardClass = `${clCard} p-6 shadow-sm`;
const labelClass = 'text-xs font-semibold uppercase tracking-wide text-slate-600';

const DepositariosWidget: React.FC = () => {
    const metrics = useDepositariosMetrics();
    const [showCriticalModal, setShowCriticalModal] = useState(false);

    return (
        <>
            <div className={`${kpiCardClass} border-l-4 border-slate-800`}>
                <p className={labelClass}>Total Equipos</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{metrics.totalDepositarios}</p>
                <p className="text-xs text-slate-500 mt-1">Activos en sistema</p>
            </div>

            <div className={`${kpiCardClass} border-l-4 border-emerald-500`}>
                <p className={labelClass}>Mantenimientos (Mes)</p>
                <p className="text-3xl font-bold text-green-600 mt-2">{metrics.maintainedThisMonth}</p>
                <p className="text-xs text-slate-500 mt-1">Trabajo realizado este mes</p>
            </div>

            <button
                type="button"
                className={`${kpiCardClass} border-l-4 border-red-600 text-left w-full hover:bg-red-50/80 transition-colors cursor-pointer`}
                onClick={() => metrics.criticalCount > 0 && setShowCriticalModal(true)}
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className={labelClass}>Pendientes (+30 días)</p>
                        <p className="text-3xl font-bold text-red-600 mt-2">{metrics.criticalCount}</p>
                    </div>
                    {metrics.criticalCount > 0 && <span className="text-red-500 text-xs font-semibold">Ver lista →</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">Requieren atención urgente</p>
            </button>

            {showCriticalModal && (
                <DepositariosCriticalListModal
                    title="Equipos sin mantenimiento reciente"
                    items={metrics.criticalList}
                    onClose={() => setShowCriticalModal(false)}
                />
            )}
        </>
    );
};

export default DepositariosWidget;
