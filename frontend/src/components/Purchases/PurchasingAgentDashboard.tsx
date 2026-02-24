import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import InviteSupplierModal from './InviteSupplierModal';
import HelpBox from '../Common/HelpBox';

interface AreaSummary {
    departmentId: number;
    departmentName: string;
    total: number;
    newCount: number;
    purchases: { id: string; productOrService: string; status: string; createdAt?: string }[];
}

interface RubroSummary {
    rubro: string;
    total: number;
    newCount: number;
    purchases: { id: string; productOrService: string; status: string; createdAt?: string }[];
}

interface Purchase {
    id: string;
    productOrService: string;
    description: string;
    quantity: number;
    referenceLink?: string;
    deliveryDeadline?: string;
    requesterUsername: string;
    status: string;
    departmentId?: number;
    departmentName?: string;
    rubro?: string;
    createdAt: string;
}

const PURCHASING_STATUSES = [
    'Aprobado',
    'Recibido',
    'Esperando presupuesto',
    'Compra Aprobada',
    'Esperando entrega',
    'Entregado',
    'Conforme / Cerrado'
];

const STATUS_PRIORITY: Record<string, number> = {
    'Aprobado': 0,
    'Recibido': 1,
    'Esperando presupuesto': 2,
    'Compra Aprobada': 3,
    'Esperando entrega': 4,
    'Entregado': 5,
    'Conforme / Cerrado': 6
};

type GroupByMode = 'area' | 'rubro';

const PurchasingAgentDashboard: React.FC = () => {
    const navigate = useNavigate();
    const [groupBy, setGroupBy] = useState<GroupByMode>('area');
    const [areas, setAreas] = useState<AreaSummary[]>([]);
    const [allPurchases, setAllPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState<string | null>(null);
    const [inviteModalOpen, setInviteModalOpen] = useState(false);
    const [accordionOpen, setAccordionOpen] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dashboardRes, allRes] = await Promise.all([
                api.get('/api/purchases/dashboard'),
                api.get('/api/purchases/all')
            ]);
            if (dashboardRes.data.success && dashboardRes.data.data?.areas) {
                setAreas(dashboardRes.data.data.areas);
            }
            if (allRes.data.success && allRes.data.data) {
                const deptMap: Record<number, string> = {};
                dashboardRes.data.data?.areas?.forEach((a: AreaSummary) => {
                    deptMap[a.departmentId] = a.departmentName;
                });
                const sorted = (allRes.data.data as Purchase[])
                    .map(p => ({ ...p, departmentName: deptMap[p.departmentId || 0] || 'Sin área' }))
                    .sort((a, b) => {
                        const pa = STATUS_PRIORITY[a.status] ?? 99;
                        const pb = STATUS_PRIORITY[b.status] ?? 99;
                        if (pa !== pb) return pa - pb;
                        const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return db - da;
                    });
                setAllPurchases(sorted);
            }
        } catch (err: unknown) {
            const e = err as { response?: { status?: number; data?: { message?: string } } };
            if (e.response?.status === 503) {
                toast.error('El módulo de compras no está disponible.');
            } else {
                toast.error(e.response?.data?.message || 'Error al cargar.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const rubroSummaries: RubroSummary[] = React.useMemo(() => {
        const byRubro: Record<string, Purchase[]> = {};
        for (const p of allPurchases) {
            const rubroKey = (p.rubro && String(p.rubro).trim()) || 'Sin clasificar';
            if (!byRubro[rubroKey]) byRubro[rubroKey] = [];
            byRubro[rubroKey].push(p);
        }
        return Object.entries(byRubro)
            .map(([rubro, purchases]) => ({
                rubro,
                total: purchases.length,
                newCount: purchases.filter(x => ['Aprobado', 'Recibido'].includes(x.status)).length,
                purchases: purchases.map(p => ({
                    id: p.id,
                    productOrService: p.productOrService,
                    status: p.status,
                    createdAt: p.createdAt
                }))
            }))
            .sort((a, b) => a.rubro.localeCompare(b.rubro));
    }, [allPurchases]);

    const handleStatusChange = async (id: string, newStatus: string) => {
        setStatusLoading(id);
        try {
            const { data } = await api.put(`/api/purchases/${id}/status`, { status: newStatus });
            if (data.success) {
                toast.success('Estado actualizado.');
                setAllPurchases(prev =>
                    prev.map(p => (p.id === id ? { ...p, status: newStatus } : p))
                );
            } else {
                toast.error(data.message || 'Error al actualizar.');
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e.response?.data?.message || 'Error al actualizar.');
        } finally {
            setStatusLoading(null);
        }
    };

    const formatDate = (dateStr?: string) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-AR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusColor = (status: string) => {
        if (status === 'Entregado' || status === 'Conforme / Cerrado') return 'bg-green-100 text-green-800';
        if (status === 'Rechazado') return 'bg-red-100 text-red-800';
        if (status === 'Aprobado' || status === 'Recibido') return 'bg-blue-100 text-blue-800';
        if (status.includes('Esperando')) return 'bg-amber-100 text-amber-800';
        return 'bg-gray-100 text-gray-800';
    };

    const featuredPurchases = allPurchases.slice(0, 4);
    const restPurchases = allPurchases.slice(4);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[300px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Dashboard de Compras</h1>
                    <p className="text-gray-600">Resumen por área y solicitudes pendientes.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => navigate('/purchases/metrics')}
                        className="px-4 py-2 border border-red-600 text-red-600 hover:bg-red-50 font-medium rounded-md"
                    >
                        Métricas / Reportes
                    </button>
                    <button
                        onClick={() => setInviteModalOpen(true)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md"
                    >
                        Invitar Proveedor
                    </button>
                </div>
            </div>

            <div className="flex items-center gap-2 mb-2">
                <span className="text-sm font-medium text-gray-700">Agrupar por:</span>
                <div className="inline-flex rounded-lg border border-gray-300 bg-gray-50 p-0.5">
                    <button
                        type="button"
                        onClick={() => setGroupBy('area')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${groupBy === 'area' ? 'bg-white text-red-600 shadow' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                        Área
                    </button>
                    <button
                        type="button"
                        onClick={() => setGroupBy('rubro')}
                        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${groupBy === 'rubro' ? 'bg-white text-red-600 shadow' : 'text-gray-600 hover:text-gray-800'}`}
                    >
                        Rubro
                    </button>
                </div>
            </div>

            <HelpBox title="¿Cómo funciona la gestión de compras?" defaultExpanded={false}>
                <p><strong>1.</strong> Las tarjetas superiores muestran el resumen por área o rubro. Haga clic en una solicitud para ver el detalle (se marcará como "Recibida" automáticamente si está recién aprobada).</p>
                <p><strong>2.</strong> Use "Solicitar Presupuestos" en el detalle para enviar la solicitud a proveedores.</p>
                <p><strong>3.</strong> En la comparativa de cotizaciones podrá elegir ganadores por ítem cuando los proveedores respondan.</p>
            </HelpBox>

            {/* Tarjetas de resumen: por Área o por Rubro */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {groupBy === 'area'
                    ? areas.map((area) => (
                        <div
                            key={area.departmentId}
                            className="bg-white rounded-lg shadow p-5 border border-gray-200"
                        >
                            <h3 className="font-bold text-gray-800 text-lg mb-2">{area.departmentName}</h3>
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                    Total: <strong>{area.total}</strong>
                                </span>
                                {area.newCount > 0 && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">
                                        Nuevas: <strong>{area.newCount}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                    : rubroSummaries.map((r) => (
                        <div
                            key={r.rubro}
                            className="bg-white rounded-lg shadow p-5 border border-gray-200"
                        >
                            <h3 className="font-bold text-gray-800 text-lg mb-2">{r.rubro}</h3>
                            <div className="flex flex-wrap gap-2 text-sm">
                                <span className="px-2 py-1 bg-gray-100 rounded">
                                    Total: <strong>{r.total}</strong>
                                </span>
                                {r.newCount > 0 && (
                                    <span className="px-2 py-1 bg-amber-100 text-amber-800 rounded">
                                        Nuevas: <strong>{r.newCount}</strong>
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
            </div>

            {((groupBy === 'area' && areas.length === 0) || (groupBy === 'rubro' && rubroSummaries.length === 0)) && !loading && (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No hay compras aprobadas para gestionar.
                </div>
            )}

            {/* Primera sección: 4 solicitudes destacadas */}
            {featuredPurchases.length > 0 && (
                <>
                    <h2 className="text-lg font-semibold text-gray-800">Solicitudes prioritarias</h2>
                    <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                        {featuredPurchases.map((p) => (
                            <div
                                key={p.id}
                                className="bg-white rounded-lg shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <button
                                        onClick={() => navigate(`/purchases/management/${p.id}`)}
                                        className="font-bold text-gray-800 text-lg hover:text-red-600 text-left"
                                    >
                                        {p.productOrService}
                                    </button>
                                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(p.status)}`}>
                                        {p.status}
                                    </span>
                                </div>
                                <p className="text-gray-600 text-sm mb-3 line-clamp-2">{p.description}</p>
                                <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-4">
                                    <span>{p.departmentName}</span>
                                    <span>• Solicitante: {p.requesterUsername}</span>
                                    <span>• Cantidad: {p.quantity}</span>
                                    <span>• {formatDate(p.createdAt)}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => navigate(`/purchases/management/${p.id}`)}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-sm"
                                    >
                                        Ver detalle y cotizaciones
                                    </button>
                                    <select
                                        value={p.status}
                                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                                        disabled={statusLoading === p.id}
                                        className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-red-500 focus:border-red-500 disabled:opacity-50"
                                    >
                                        {PURCHASING_STATUSES.map((s) => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Segunda sección: acordeón con el resto */}
            {restPurchases.length > 0 && (
                <>
                    <h2 className="text-lg font-semibold text-gray-800 mt-8">Resto de solicitudes</h2>
                    <div className="space-y-2">
                        {restPurchases.map((p) => (
                            <div
                                key={p.id}
                                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
                            >
                                <button
                                    onClick={() => setAccordionOpen(accordionOpen === p.id ? null : p.id)}
                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
                                >
                                    <span className="font-medium text-gray-800">{p.productOrService}</span>
                                    <div className="flex items-center gap-3">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(p.status)}`}>
                                            {p.status}
                                        </span>
                                        <span className="text-xs text-gray-500">{formatDate(p.createdAt)}</span>
                                        <svg
                                            className={`w-5 h-5 text-gray-500 transition-transform ${accordionOpen === p.id ? 'rotate-180' : ''}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </div>
                                </button>
                                {accordionOpen === p.id && (
                                    <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                                        <p className="text-gray-600 text-sm my-3">{p.description}</p>
                                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                                            <span>{p.departmentName}</span>
                                            <span>• Solicitante: {p.requesterUsername}</span>
                                            <span>• Cantidad: {p.quantity}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => navigate(`/purchases/management/${p.id}`)}
                                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md text-sm"
                                            >
                                                Ver detalle
                                            </button>
                                            <select
                                                value={p.status}
                                                onChange={(e) => handleStatusChange(p.id, e.target.value)}
                                                disabled={statusLoading === p.id}
                                                className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            >
                                                {PURCHASING_STATUSES.map((s) => (
                                                    <option key={s} value={s}>{s}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            <InviteSupplierModal
                isOpen={inviteModalOpen}
                onClose={() => setInviteModalOpen(false)}
                onSuccess={() => fetchData()}
            />
        </div>
    );
};

export default PurchasingAgentDashboard;
