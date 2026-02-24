import React, { useState, useEffect } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import HelpBox from '../Common/HelpBox';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface PendingRequest {
    id: string;
    title?: string;
    productOrService: string;
    description: string;
    quantity: number;
    items?: PurchaseItem[];
    referenceLink?: string;
    deliveryDeadline?: string;
    requesterUsername: string;
    status: string;
    createdAt: string;
}

const BossApprovalDashboard: React.FC = () => {
    const [requests, setRequests] = useState<PendingRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchPending = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/api/purchases/pending-approvals');
            if (data.success && data.data) {
                setRequests(data.data);
            } else {
                toast.error(data.message || 'Error al cargar solicitudes.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string }; status?: number } };
            if (err.response?.status === 503) {
                toast.error('El módulo de compras no está disponible.');
            } else if (err.response?.status === 403) {
                toast.error('No tiene permiso para ver esta sección.');
            } else {
                toast.error(err.response?.data?.message || 'Error al cargar solicitudes.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPending();
    }, []);

    const handleApprove = async (id: string, approved: boolean) => {
        setActionLoading(id);
        try {
            const { data } = await api.put(`/api/purchases/${id}/approve`, { approved });
            if (data.success) {
                toast.success(approved ? 'Solicitud aprobada.' : 'Solicitud rechazada.');
                setRequests(prev => prev.filter(r => r.id !== id));
            } else {
                toast.error(data.message || 'Error al procesar.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al procesar.');
        } finally {
            setActionLoading(null);
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

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Aprobación de solicitudes de compra</h1>
            <p className="text-gray-600">Solicitudes pendientes de aprobación en su área.</p>
            <HelpBox title="¿Cómo funciona la aprobación de compras?" defaultExpanded={true}>
                <p><strong>1.</strong> Los empleados de su área crean solicitudes de compra que llegan aquí para su aprobación.</p>
                <p><strong>2.</strong> Revise cada solicitud: producto, cantidad, descripción y solicitante.</p>
                <p><strong>3.</strong> Aprobar o rechazar según corresponda. Las aprobadas pasan al encargado de compras para que solicite presupuestos a proveedores.</p>
                <p><strong>4.</strong> Solo puede aprobar solicitudes de su propio departamento.</p>
                <p><strong>5.</strong> Recibirá notificaciones cuando haya nuevas solicitudes pendientes.</p>
            </HelpBox>

            {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Cargando...
                </div>
            ) : requests.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No hay solicitudes pendientes de aprobación.
                </div>
            ) : (
                <div className="overflow-x-auto bg-white rounded-lg shadow">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800 text-white uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3">Producto/Servicio</th>
                                <th className="px-4 py-3">Solicitante</th>
                                <th className="px-4 py-3">Cantidad</th>
                                <th className="px-4 py-3">Descripción</th>
                                <th className="px-4 py-3">Fecha</th>
                                <th className="px-4 py-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {requests.map((r) => {
                                const hasItems = Array.isArray(r.items) && r.items.length > 0;
                                const isExpanded = expandedId === r.id;
                                return (
                                    <React.Fragment key={r.id}>
                                        <tr className="hover:bg-gray-50">
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2">
                                                    {hasItems && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setExpandedId(isExpanded ? null : r.id)}
                                                            className="p-0.5 rounded hover:bg-gray-200 text-gray-600 transition-transform"
                                                            aria-label={isExpanded ? 'Contraer' : 'Ver detalle'}
                                                        >
                                                            <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                                                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                                            </svg>
                                                        </button>
                                                    )}
                                                    <span className="font-medium">{r.title || r.productOrService}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3">{r.requesterUsername}</td>
                                            <td className="px-4 py-3">{r.quantity}</td>
                                            <td className="px-4 py-3 max-w-xs truncate" title={r.description}>
                                                {r.description}
                                            </td>
                                            <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleApprove(r.id, true)}
                                                        disabled={actionLoading === r.id}
                                                        className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-xs font-medium disabled:opacity-50"
                                                    >
                                                        Aprobar
                                                    </button>
                                                    <button
                                                        onClick={() => handleApprove(r.id, false)}
                                                        disabled={actionLoading === r.id}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium disabled:opacity-50"
                                                    >
                                                        Rechazar
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                        {hasItems && isExpanded && (
                                            <tr>
                                                <td colSpan={6} className="px-4 py-3 bg-gray-50 border-b">
                                                    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-100">
                                                                <tr>
                                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Producto</th>
                                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Cantidad</th>
                                                                    <th className="px-4 py-2 text-left font-semibold text-gray-700">Descripción</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody className="divide-y divide-gray-100">
                                                                {r.items!.map((item, idx) => (
                                                                    <tr key={idx}>
                                                                        <td className="px-4 py-2 font-medium">{item.producto}</td>
                                                                        <td className="px-4 py-2">{item.cantidad}</td>
                                                                        <td className="px-4 py-2 text-gray-600">{item.descripcion}</td>
                                                                    </tr>
                                                                ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default BossApprovalDashboard;
