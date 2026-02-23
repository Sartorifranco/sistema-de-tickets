import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts';

interface MetricsData {
    totalGastado: number;
    cantidadPedidos: number;
    ticketPromedio: number;
    byArea: { name: string; value: number }[];
    byRubro: { name: string; value: number }[];
    topSuppliers: { id: string; name: string; total: number }[];
}

const CHART_COLORS = [
    '#DC2626', '#EA580C', '#CA8A04', '#16A34A', '#059669',
    '#0284C7', '#7C3AED', '#BE185D', '#64748B', '#0F766E'
];

const PurchasingMetricsPage: React.FC = () => {
    const navigate = useNavigate();
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const [dateFrom, setDateFrom] = useState(firstDay.toISOString().slice(0, 10));
    const [dateTo, setDateTo] = useState(lastDay.toISOString().slice(0, 10));
    const [data, setData] = useState<MetricsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        api.get('/api/purchases/metrics', { params: { dateFrom, dateTo } })
            .then((res) => {
                if (!cancelled && res.data.success && res.data.data) {
                    setData(res.data.data);
                } else if (!cancelled) {
                    setData(null);
                }
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    const e = err as { response?: { data?: { message?: string } } };
                    toast.error(e.response?.data?.message || 'Error al cargar métricas.');
                    setData(null);
                }
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, [dateFrom, dateTo]);

    const formatMoney = (n: number) =>
        new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

    if (loading && !data) {
        return (
            <div className="flex justify-center items-center min-h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Métricas y Reportes</h1>
                    <p className="text-gray-600">Análisis financiero del módulo de compras.</p>
                </div>
                <button
                    onClick={() => navigate('/purchases/management')}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                    ← Volver al panel
                </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg shadow border border-gray-200">
                <span className="text-sm font-medium text-gray-700">Período:</span>
                <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Desde</span>
                    <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => setDateFrom(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                </label>
                <label className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Hasta</span>
                    <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => setDateTo(e.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                    />
                </label>
            </div>

            {!data ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No hay datos disponibles para el período seleccionado.
                </div>
            ) : (
                <>
                    {/* KPIs */}
                    <div className="grid gap-4 sm:grid-cols-3">
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-500 uppercase">Total Gastado</h3>
                            <p className="mt-2 text-2xl font-bold text-red-600">{formatMoney(data.totalGastado)}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-500 uppercase">Cantidad de Pedidos</h3>
                            <p className="mt-2 text-2xl font-bold text-gray-800">{data.cantidadPedidos}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-sm font-medium text-gray-500 uppercase">Ticket Promedio</h3>
                            <p className="mt-2 text-2xl font-bold text-gray-800">{formatMoney(data.ticketPromedio)}</p>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-2">
                        {/* PieChart por Área */}
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Gasto por Área</h3>
                            {data.byArea.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <PieChart>
                                        <Pie
                                            data={data.byArea}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={60}
                                            outerRadius={100}
                                            paddingAngle={2}
                                            dataKey="value"
                                            nameKey="name"
                                            label={({ name, percent }) =>
                                                `${name} (${(percent * 100).toFixed(0)}%)`
                                            }
                                        >
                                            {data.byArea.map((_, i) => (
                                                <Cell
                                                    key={i}
                                                    fill={CHART_COLORS[i % CHART_COLORS.length]}
                                                />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            formatter={(v: number) => formatMoney(v)}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #E5E7EB'
                                            }}
                                        />
                                        <Legend />
                                    </PieChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-gray-500 text-center py-12">Sin datos por área.</p>
                            )}
                        </div>

                        {/* BarChart por Rubro */}
                        <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">Gasto por Rubro</h3>
                            {data.byRubro.length > 0 ? (
                                <ResponsiveContainer width="100%" height={280}>
                                    <BarChart data={data.byRubro} layout="vertical" margin={{ left: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis type="number" tickFormatter={(v) => formatMoney(v)} />
                                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                                        <Tooltip
                                            formatter={(v: number) => formatMoney(v)}
                                            contentStyle={{
                                                borderRadius: '8px',
                                                border: '1px solid #E5E7EB'
                                            }}
                                        />
                                        <Bar dataKey="value" name="Monto" fill={CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : (
                                <p className="text-gray-500 text-center py-12">Sin datos por rubro.</p>
                            )}
                        </div>
                    </div>

                    {/* Top 5 Proveedores */}
                    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Proveedores (por monto comprado)</h3>
                        {data.topSuppliers.length > 0 ? (
                            <ol className="space-y-3">
                                {data.topSuppliers.map((s, i) => (
                                    <li
                                        key={s.id}
                                        className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                                    >
                                        <span className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-red-100 text-red-700 flex items-center justify-center text-sm font-bold">
                                                {i + 1}
                                            </span>
                                            <span className="font-medium text-gray-800">{s.name}</span>
                                        </span>
                                        <span className="font-semibold text-red-600">{formatMoney(s.total)}</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="text-gray-500 text-center py-8">Sin datos de proveedores.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default PurchasingMetricsPage;
