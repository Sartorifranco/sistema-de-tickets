import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import QuoteComparison from '../components/Purchases/QuoteComparison';
import SmartQuoteComparison from '../components/Purchases/SmartQuoteComparison';
import HelpBox from '../components/Common/HelpBox';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface ItemWinner {
    itemIndex: number;
    quoteId: string;
}

interface Purchase {
    id: string;
    productOrService: string;
    description: string;
    quantity: number;
    items?: PurchaseItem[];
    itemWinners?: ItemWinner[];
    status: string;
    requesterUsername: string;
    referenceLink?: string;
    deliveryDeadline?: string;
    estimatedDeliveryDate?: string;
    createdAt: string;
}

interface QuoteItemPrice {
    itemIndex: number;
    inStock: boolean;
    unitPrice: number;
}

interface Quote {
    id: string;
    supplierId: number;
    supplierName?: string;
    supplierEmail?: string;
    supplierRating?: number | null;
    status: string;
    price?: number;
    itemPrices?: QuoteItemPrice[];
    paymentMethods?: string[];
    deliveryTerm?: string;
    paymentTerm?: string;
    receiptType?: string;
    submittedAt?: string;
}

const PURCHASING_STATUSES = [
    'Aprobado por Jefe',
    'Recibido',
    'Esperando presupuesto',
    'Compra Aprobada',
    'Esperando entrega',
    'Entregado',
    'Conforme / Cerrado'
];

const PurchaseDetailPage: React.FC = () => {
    const { purchaseId } = useParams<{ purchaseId: string }>();
    const navigate = useNavigate();
    const [purchase, setPurchase] = useState<Purchase | null>(null);
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const [historicalPrices, setHistoricalPrices] = useState<Record<string, { price: number; date: string }>>({});
    const [loading, setLoading] = useState(true);
    const [statusLoading, setStatusLoading] = useState(false);
    const [status, setStatus] = useState('');
    const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState('');
    const [showQuoteRequest, setShowQuoteRequest] = useState(false);
    const [supplierIds, setSupplierIds] = useState<number[]>([]);
    const [paymentPrefCheckboxes, setPaymentPrefCheckboxes] = useState<string[]>([]);
    const [paymentPrefOtros, setPaymentPrefOtros] = useState('');
    const [suppliers, setSuppliers] = useState<{ id: number; first_name?: string; last_name?: string; email: string; is_active?: number }[]>([]);

    const fetchData = async () => {
        if (!purchaseId) return;
        setLoading(true);
        try {
            const [purchaseRes, quotesRes] = await Promise.all([
                api.get(`/api/purchases/${purchaseId}`),
                api.get(`/api/purchases/${purchaseId}/quotes`)
            ]);
            if (purchaseRes.data.success && purchaseRes.data.data) {
                const p = purchaseRes.data.data;
                setPurchase(p);
                setStatus(p.status);
                setEstimatedDeliveryDate(p.estimatedDeliveryDate || '');
                if (p.status === 'Aprobado por Jefe') {
                    api.put(`/api/purchases/${purchaseId}/mark-received`).then((r) => {
                        if (r.data.success && r.data.data?.status === 'Recibido') {
                            setPurchase(prev => prev ? { ...prev, status: 'Recibido' } : null);
                            setStatus('Recibido');
                        }
                    }).catch(() => {});
                }
            }
            if (quotesRes.data.success && quotesRes.data.data) {
                setQuotes(quotesRes.data.data.quotes || []);
                setHistoricalPrices(quotesRes.data.data.historicalPrices || {});
            }
        } catch {
            toast.error('Error al cargar el detalle.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [purchaseId]);

    useEffect(() => {
        api.get('/api/suppliers').then((r) => {
            if (r.data.success && r.data.data) {
                setSuppliers(r.data.data);
            }
        }).catch(() => {});
    }, []);

    const handleStatusChange = async () => {
        if (!purchaseId) return;
        setStatusLoading(true);
        try {
            const { data } = await api.put(`/api/purchases/${purchaseId}/status`, {
                status,
                estimatedDeliveryDate: estimatedDeliveryDate.trim() || undefined
            });
            if (data.success) {
                toast.success('Estado actualizado.');
                setPurchase(prev => prev ? { ...prev, status, estimatedDeliveryDate: estimatedDeliveryDate.trim() } : null);
            } else {
                toast.error(data.message || 'Error al actualizar.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al actualizar.');
        } finally {
            setStatusLoading(false);
        }
    };

    const handleRequestQuotes = async () => {
        if (!purchaseId || supplierIds.length === 0) {
            toast.error('Seleccione al menos un proveedor.');
            return;
        }
        try {
            const { data } = await api.post(`/api/purchases/${purchaseId}/request-quotes`, {
                supplierIds,
                paymentPreferences: (() => {
                    const opts = paymentPrefCheckboxes.filter(x => x !== 'Otros');
                    if (paymentPrefCheckboxes.includes('Otros') && paymentPrefOtros.trim()) {
                        opts.push(`Otros: ${paymentPrefOtros.trim()}`);
                    } else if (paymentPrefCheckboxes.includes('Otros')) {
                        opts.push('Otros');
                    }
                    return opts.length ? opts.join(', ') : undefined;
                })(),
            });
            if (data.success) {
                toast.success(data.message || 'Solicitud enviada.');
                setShowQuoteRequest(false);
                fetchData();
            } else {
                toast.error(data.message || 'Error.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al enviar.');
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

    const canRequestQuotes = ['Aprobado por Jefe', 'Recibido', 'Esperando presupuesto'].includes(purchase?.status || '');

    if (loading || !purchase) {
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                {loading ? 'Cargando...' : 'Solicitud no encontrada.'}
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <button
                onClick={() => navigate('/purchases/management')}
                className="text-gray-600 hover:text-gray-800 font-medium"
            >
                ← Volver a gestión
            </button>

            <HelpBox title="Gestión de esta solicitud de compra">
                <p>En esta pantalla puede actualizar el estado, solicitar presupuestos a proveedores y elegir al ganador. Las preferencias de pago son opcionales: indíquelas si desea que el proveedor las tenga en cuenta; si no las completa, el proveedor ofrecerá lo que mejor le convenga.</p>
                <p>Al seleccionar un ganador, el proveedor recibirá notificaciones por email, push y WhatsApp para continuar con el pedido (subir factura, coordinar entrega, etc.).</p>
            </HelpBox>
            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                <h1 className="text-2xl font-bold text-gray-800 mb-4">{purchase.productOrService}</h1>
                <p className="text-gray-600 mb-4">{purchase.description}</p>
                <div className="flex flex-wrap gap-2 text-sm text-gray-500 mb-4">
                    <span>Solicitante: {purchase.requesterUsername}</span>
                    <span>• Cantidad: {purchase.quantity}</span>
                    <span>• Creado: {formatDate(purchase.createdAt)}</span>
                    {purchase.referenceLink && (
                        <a href={purchase.referenceLink} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">
                            Ver referencia
                        </a>
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 mb-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                        <select
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        >
                            {PURCHASING_STATUSES.map((s) => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Plazo de entrega estimado</label>
                        <input
                            type="text"
                            value={estimatedDeliveryDate}
                            onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                            placeholder="Ej: 5 días hábiles, 15/03/2025"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                        />
                    </div>
                </div>
                <button
                    onClick={handleStatusChange}
                    disabled={statusLoading}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-md disabled:opacity-50"
                >
                    {statusLoading ? 'Guardando...' : 'Guardar estado'}
                </button>

                {canRequestQuotes && (
                    <div className="mt-6 pt-6 border-t">
                        <button
                            onClick={() => setShowQuoteRequest(true)}
                            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-base shadow-md hover:shadow-lg transition-all"
                        >
                            📤 Solicitar Presupuestos
                        </button>
                    </div>
                )}

            {/* Modal Solicitar Presupuestos */}
            {showQuoteRequest && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Solicitar Presupuestos</h2>
                        <p className="text-gray-600 text-sm mb-4">Seleccione los proveedores a quienes desea enviar esta solicitud de cotización.</p>
                        {suppliers.filter(s => s.is_active).length === 0 ? (
                            <p className="text-amber-700 text-sm py-4">No hay proveedores activos. Invite proveedores y espere a que activen su cuenta.</p>
                        ) : (
                            <>
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Preferencias de pago (opcional)</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        {['Pago contado', 'Pago a 30 días', 'Pago a 60 días', 'Pago a 90 días', 'Transferencia bancaria', 'Cheque', 'Factura A', 'Factura B', 'Cuotas 3x', 'Cuotas 6x', 'Cuotas 12x'].map((opt) => (
                                            <label key={opt} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={paymentPrefCheckboxes.includes(opt)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setPaymentPrefCheckboxes(prev => [...prev, opt]);
                                                        else setPaymentPrefCheckboxes(prev => prev.filter(x => x !== opt));
                                                    }}
                                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                />
                                                <span className="text-sm text-gray-700">{opt}</span>
                                            </label>
                                        ))}
                                        <label className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer sm:col-span-2">
                                            <input
                                                type="checkbox"
                                                checked={paymentPrefCheckboxes.includes('Otros')}
                                                onChange={(e) => {
                                                    if (e.target.checked) setPaymentPrefCheckboxes(prev => [...prev, 'Otros']);
                                                    else setPaymentPrefCheckboxes(prev => prev.filter(x => x !== 'Otros'));
                                                }}
                                                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                            />
                                            <span className="text-sm text-gray-700">Otros</span>
                                        </label>
                                    </div>
                                    {paymentPrefCheckboxes.includes('Otros') && (
                                        <input
                                            type="text"
                                            value={paymentPrefOtros}
                                            onChange={(e) => setPaymentPrefOtros(e.target.value)}
                                            placeholder="Especifique otras preferencias..."
                                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500 text-sm"
                                        />
                                    )}
                                </div>
                                <div className="space-y-2 mb-6 max-h-48 overflow-y-auto">
                                    {suppliers.filter(s => s.is_active).map((s) => (
                                        <label key={s.id} className="flex items-center p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={supplierIds.includes(s.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSupplierIds(prev => [...prev, s.id]);
                                                    else setSupplierIds(prev => prev.filter(x => x !== s.id));
                                                }}
                                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                            />
                                            <span className="ml-3 font-medium text-gray-800">
                                                {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.email}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowQuoteRequest(false)}
                                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-md"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => handleRequestQuotes()}
                                disabled={supplierIds.length === 0}
                                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md disabled:opacity-50"
                            >
                                Enviar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>

            <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
                {purchase.items && purchase.items.length > 0 ? (
                    <SmartQuoteComparison
                        purchaseId={purchaseId!}
                        items={purchase.items}
                        quotes={quotes}
                        itemWinners={purchase.itemWinners}
                        historicalPrices={historicalPrices}
                        onWinnerSelected={fetchData}
                    />
                ) : (
                    <QuoteComparison
                        purchaseId={purchaseId!}
                        quotes={quotes}
                        onWinnerSelected={fetchData}
                    />
                )}
            </div>
        </div>
    );
};

export default PurchaseDetailPage;
