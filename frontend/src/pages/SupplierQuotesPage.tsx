import React, { useState, useEffect } from 'react';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import HelpBox from '../components/Common/HelpBox';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface QuoteItem {
    quoteId: string;
    purchaseRequestId: string;
    status?: string;
    price?: number;
    invoiceFileUrl?: string | null;
    invoiceUploadedAt?: string | null;
    shippedAt?: string | null;
    purchaseRequest: {
        title?: string;
        productOrService: string;
        description: string;
        quantity: number;
        items?: PurchaseItem[];
        referenceLink?: string;
        deliveryDeadline?: string;
        payment_receipt_url?: string | null;
    };
    createdAt?: string;
    submittedAt?: string;
}

interface PendingQuote extends QuoteItem {
    purchaseRequest: QuoteItem['purchaseRequest'] & {
        title?: string;
        items?: PurchaseItem[];
        referenceLink?: string;
        deliveryDeadline?: string;
        paymentPreferences?: string | null;
        payment_receipt_url?: string | null;
    };
}

interface QuoteOptions {
    paymentMethods: string[];
    receiptTypes: string[];
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
    efectivo: 'Efectivo',
    tarjeta: 'Tarjeta',
    cheque: 'Cheque',
    transferencia: 'Transferencia',
    cc: 'Cuenta Corriente'
};

const TARJETA_OPTIONS = ['Visa', 'Master', 'AMEX', 'Naranja'];

interface PaymentDetails {
    efectivo?: { discountPercent?: number };
    tarjeta?: { cards: string[]; cuotasSinInteres?: number };
    cheque?: { dias?: number };
    transferencia?: { aclaraciones?: string };
    cc?: { aclaraciones?: string };
}

const SupplierQuotesPage: React.FC = () => {
    const [myQuotes, setMyQuotes] = useState<QuoteItem[]>([]);
    const [pendingQuotes, setPendingQuotes] = useState<PendingQuote[]>([]);
    const [options, setOptions] = useState<QuoteOptions | null>(null);
    const [loading, setLoading] = useState(true);
    const [submittingQuote, setSubmittingQuote] = useState<string | null>(null);
    const [markingShipped, setMarkingShipped] = useState<string | null>(null);
    const [uploadingInvoice, setUploadingInvoice] = useState<string | null>(null);
    const [shippedModalQuote, setShippedModalQuote] = useState<string | null>(null);
    const [shippingNotes, setShippingNotes] = useState('');
    const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
    const [modalOpen, setModalOpen] = useState<string | null>(null);
    const [formData, setFormData] = useState<{
        price: string;
        deliveryTerm: string;
        paymentTerm: string;
        receiptType: string;
        paymentMethods: string[];
        paymentDetails: PaymentDetails;
        itemPrices: Record<number, { inStock: boolean; unitPrice: string }>;
        budgetPdfUrl: string | null;
    }>({ price: '', deliveryTerm: '', paymentTerm: '', receiptType: '', paymentMethods: [], paymentDetails: {}, itemPrices: {}, budgetPdfUrl: null });
    const [uploadingBudget, setUploadingBudget] = useState<string | null>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [quotesRes, pendingRes, optionsRes] = await Promise.all([
                api.get('/api/purchases/quotes/my-quotes'),
                api.get('/api/purchases/quotes/pending'),
                api.get('/api/purchases/quotes/options')
            ]);
            if (quotesRes.data.success && quotesRes.data.data) setMyQuotes(quotesRes.data.data);
            if (pendingRes.data.success && pendingRes.data.data) setPendingQuotes(pendingRes.data.data);
            if (optionsRes.data.success && optionsRes.data.data) setOptions(optionsRes.data.data);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string }; status?: number } };
            if (err.response?.status === 503) {
                toast.error('El módulo de compras no está disponible.');
            } else {
                toast.error(err.response?.data?.message || 'Error al cargar presupuestos.');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSubmitQuote = async (quoteId: string) => {
        const { price, deliveryTerm, paymentTerm, receiptType, paymentMethods, paymentDetails, itemPrices, budgetPdfUrl } = formData;
        const currentQuote = pendingQuotes.find(q => q.quoteId === quoteId);
        const items = currentQuote?.purchaseRequest?.items || [];
        const hasItems = items.length > 0;

        if (!deliveryTerm || !paymentTerm || !receiptType) {
            toast.error('Complete plazo de entrega, plazo de pago y tipo de comprobante.');
            return;
        }
        if (hasItems) {
            const atLeastOne = Object.values(itemPrices).some(ip => ip.inStock && parseFloat(ip.unitPrice) > 0);
            if (!atLeastOne) {
                toast.error('Indique al menos un ítem con stock y precio unitario.');
                return;
            }
        } else if (!price || parseFloat(price) <= 0) {
            toast.error('Complete el precio.');
            return;
        }
        setSubmittingQuote(quoteId);
        try {
            const payload: Record<string, unknown> = {
                deliveryTerm,
                paymentTerm,
                receiptType,
                paymentMethods,
                paymentDetails: Object.keys(paymentDetails || {}).length > 0 ? paymentDetails : undefined
            };
            if (hasItems) {
                payload.itemPrices = Object.entries(itemPrices).map(([idx, ip]) => ({
                    itemIndex: parseInt(idx, 10),
                    inStock: ip.inStock,
                    unitPrice: ip.inStock ? parseFloat(ip.unitPrice) || 0 : 0
                }));
                if (budgetPdfUrl) payload.budgetPdfUrl = budgetPdfUrl;
            } else {
                payload.price = parseFloat(price);
            }
            const { data } = await api.post(`/api/purchases/quotes/${quoteId}/submit`, payload);
            if (data.success) {
                toast.success('Cotización enviada correctamente. La verá en la pestaña "Todas".');
                setModalOpen(null);
                setFormData({ price: '', deliveryTerm: '', paymentTerm: '', receiptType: '', paymentMethods: [], paymentDetails: {}, itemPrices: {}, budgetPdfUrl: null });
                setActiveTab('all');
                fetchData();
            } else {
                toast.error(data.message || 'Error al enviar cotización.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al enviar cotización.');
        } finally {
            setSubmittingQuote(null);
        }
    };

    const openModal = (quoteId: string) => {
        setModalOpen(quoteId);
        const q = pendingQuotes.find(p => p.quoteId === quoteId);
        const items = q?.purchaseRequest?.items || [];
        const initItemPrices: Record<number, { inStock: boolean; unitPrice: string }> = {};
        items.forEach((_, i) => { initItemPrices[i] = { inStock: false, unitPrice: '' }; });
        setFormData({ price: '', deliveryTerm: '', paymentTerm: '', receiptType: '', paymentMethods: [], paymentDetails: {}, itemPrices: initItemPrices, budgetPdfUrl: null });
    };

    const handleUploadBudget = async (quoteId: string, file: File) => {
        setUploadingBudget(quoteId);
        try {
            const fd = new FormData();
            fd.append('budget', file);
            const { data } = await api.post(`/api/purchases/quotes/${quoteId}/upload-budget`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
            if (data.success && data.data?.budgetPdfUrl) {
                setFormData(f => ({ ...f, budgetPdfUrl: data.data.budgetPdfUrl }));
                toast.success('Presupuesto PDF subido.');
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e.response?.data?.message || 'Error al subir PDF.');
        } finally {
            setUploadingBudget(null);
        }
    };

    const handleUploadInvoice = async (quoteId: string, file: File) => {
        setUploadingInvoice(quoteId);
        try {
            const formData = new FormData();
            formData.append('invoice', file);
            const { data } = await api.post(`/api/purchases/quotes/${quoteId}/upload-invoice`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            if (data.success) {
                toast.success('Comprobante/factura subido correctamente.');
                fetchData();
            } else {
                toast.error(data.message || 'Error al subir.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al subir comprobante.');
        } finally {
            setUploadingInvoice(null);
        }
    };

    const handleMarkShipped = async () => {
        if (!shippedModalQuote) return;
        setMarkingShipped(shippedModalQuote);
        try {
            const { data } = await api.put(`/api/purchases/quotes/${shippedModalQuote}/mark-shipped`, {
                shippingNotes: shippingNotes.trim() || undefined,
            });
            if (data.success) {
                toast.success('Pedido marcado como enviado. Compras recibirá la notificación.');
                setShippedModalQuote(null);
                setShippingNotes('');
                fetchData();
            } else {
                toast.error(data.message || 'Error.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al notificar envío.');
        } finally {
            setMarkingShipped(null);
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

    const getStatusColor = (status?: string) => {
        if (!status) return 'bg-gray-100 text-gray-800';
        if (status === 'winner') return 'bg-green-100 text-green-800';
        if (status === 'submitted') return 'bg-blue-100 text-blue-800';
        if (status === 'rejected') return 'bg-red-100 text-red-800';
        return 'bg-amber-100 text-amber-800';
    };

    const getStatusLabel = (status?: string) => {
        if (!status) return 'Pendiente';
        if (status === 'winner') return 'Ganador';
        if (status === 'submitted') return 'Enviada';
        if (status === 'rejected') return 'Rechazada';
        return status;
    };

    if (loading) {
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                Cargando presupuestos...
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <HelpBox title="¿Cómo funcionan los presupuestos para proveedores?" defaultExpanded={true}>
                <p><strong>1.</strong> Cuando el encargado de compras solicita presupuestos, aparecen aquí en "Pendientes".</p>
                <p><strong>2.</strong> Revise cada solicitud: producto, cantidad, descripción y preferencias de pago (si las indicó el comprador). Si no hay preferencias, ofrezca lo que mejor le convenga.</p>
                <p><strong>3.</strong> Complete el formulario con precio, plazo de entrega, plazo de pago, tipo de comprobante y métodos de pago aceptados.</p>
                <p><strong>4.</strong> Si su cotización es elegida como ganadora, recibirá notificaciones por email, push y WhatsApp.</p>
                <p><strong>5.</strong> Cuando envíe el pedido, use "Notificar pedido enviado" para avisar a compras. Opcionalmente indique número de seguimiento o transportista.</p>
                <p><strong>6.</strong> Suba el comprobante o factura cuando esté disponible (PDF, JPG, PNG, etc.) usando "Subir comprobante / factura" en la tarjeta de la compra ganadora.</p>
                <p><strong>7.</strong> Configure sus preferencias de notificación en su perfil para recibir alertas por los canales que prefiera.</p>
            </HelpBox>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Mis presupuestos</h1>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 rounded-md font-medium ${activeTab === 'pending' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Pendientes ({pendingQuotes.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('all')}
                        className={`px-4 py-2 rounded-md font-medium ${activeTab === 'all' ? 'bg-red-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                    >
                        Todas ({myQuotes.length})
                    </button>
                </div>
            </div>

            {activeTab === 'pending' && (
                <>
                    {pendingQuotes.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            No hay solicitudes de cotización pendientes.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                            {pendingQuotes.map((q) => (
                                <div
                                    key={q.quoteId}
                                    className="bg-white rounded-lg shadow p-5 border border-gray-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-gray-800 text-lg">{q.purchaseRequest.productOrService}</h3>
                                        <span className="px-2 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800">
                                            Pendiente
                                        </span>
                                    </div>
                                    {Array.isArray(q.purchaseRequest.items) && q.purchaseRequest.items.length > 0 ? (
                                        <div className="mb-3 rounded-lg border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Producto</th>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Cant.</th>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {q.purchaseRequest.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-3 py-2 font-medium text-gray-800">{item.producto}</td>
                                                            <td className="px-3 py-2">{item.cantidad}</td>
                                                            <td className="px-3 py-2 text-gray-600">{item.descripcion}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">{q.purchaseRequest.description}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-4">
                                        {q.purchaseRequest.deliveryDeadline && (
                                            <span>Entrega solicitada: {formatDate(q.purchaseRequest.deliveryDeadline)}</span>
                                        )}
                                        <span>• Solicitado: {formatDate(q.createdAt)}</span>
                                    </div>
                                    {q.purchaseRequest.referenceLink && (
                                        <a
                                            href={q.purchaseRequest.referenceLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-sm text-red-600 hover:underline mb-3 inline-block"
                                        >
                                            Ver referencia →
                                        </a>
                                    )}
                                    {q.purchaseRequest.paymentPreferences && (
                                        <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                            <span className="font-medium text-amber-800">Preferencias de pago del comprador:</span>
                                            <p className="text-amber-900 mt-1">{q.purchaseRequest.paymentPreferences}</p>
                                            <p className="text-xs text-amber-700 mt-1">Indique en su cotización si puede cumplir o proponga alternativas.</p>
                                        </div>
                                    )}
                                    <button
                                        onClick={() => openModal(q.quoteId)}
                                        className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md"
                                    >
                                        Enviar cotización
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeTab === 'all' && (
                <>
                    {myQuotes.length === 0 ? (
                        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                            No tienes cotizaciones.
                        </div>
                    ) : (
                        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
                            {myQuotes.map((q) => (
                                <div
                                    key={q.quoteId}
                                    className="bg-white rounded-lg shadow p-5 border border-gray-200 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-gray-800 text-lg">{q.purchaseRequest.productOrService}</h3>
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(q.status)}`}>
                                            {getStatusLabel(q.status)}
                                        </span>
                                    </div>
                                    {Array.isArray(q.purchaseRequest.items) && q.purchaseRequest.items.length > 0 ? (
                                        <div className="mb-3 rounded-lg border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                                <thead className="bg-gray-100">
                                                    <tr>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Producto</th>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Cant.</th>
                                                        <th className="px-3 py-2 text-left font-semibold text-gray-700">Descripción</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {q.purchaseRequest.items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="px-3 py-2 font-medium text-gray-800">{item.producto}</td>
                                                            <td className="px-3 py-2">{item.cantidad}</td>
                                                            <td className="px-3 py-2 text-gray-600">{item.descripcion}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : (
                                        <p className="text-gray-600 text-sm mb-2 line-clamp-2">{q.purchaseRequest.description}</p>
                                    )}
                                    {q.price != null && (
                                        <p className="text-gray-800 font-semibold mb-2">Precio total: $ {Number(q.price).toLocaleString('es-AR')}</p>
                                    )}
                                    <div className="flex flex-wrap gap-2 text-xs text-gray-500">
                                        {q.submittedAt && <span>Enviada: {formatDate(q.submittedAt)}</span>}
                                        {q.createdAt && <span>• Creada: {formatDate(q.createdAt)}</span>}
                                        {q.shippedAt && <span>• Pedido enviado: {formatDate(q.shippedAt)}</span>}
                                        {q.invoiceUploadedAt && <span>• Factura subida: {formatDate(q.invoiceUploadedAt)}</span>}
                                    </div>
                                    {q.status === 'winner' && (q as PendingQuote).purchaseRequest?.payment_receipt_url && (
                                        <div className="mt-3">
                                            <a
                                                href={(q as PendingQuote).purchaseRequest!.payment_receipt_url!}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md"
                                            >
                                                📥 Descargar Comprobante de Pago de Bacar
                                            </a>
                                        </div>
                                    )}
                                    {q.status === 'winner' && q.invoiceFileUrl && (
                                        <div className="mt-3">
                                            <a
                                                href={q.invoiceFileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-800 font-medium rounded-md"
                                            >
                                                📄 Ver comprobante / factura
                                            </a>
                                        </div>
                                    )}
                                    {q.status === 'winner' && !q.invoiceFileUrl && (
                                        <div className="mt-3 space-y-2">
                                            <input
                                                id={`invoice-${q.quoteId}`}
                                                type="file"
                                                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const f = e.target.files?.[0];
                                                    if (f) handleUploadInvoice(q.quoteId, f);
                                                    e.target.value = '';
                                                }}
                                                disabled={!!uploadingInvoice}
                                            />
                                            <label
                                                htmlFor={`invoice-${q.quoteId}`}
                                                className={`inline-flex items-center justify-center w-full px-4 py-2 rounded-md font-medium cursor-pointer ${uploadingInvoice === q.quoteId ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                            >
                                                {uploadingInvoice === q.quoteId ? 'Subiendo...' : '📄 Subir comprobante / factura'}
                                            </label>
                                            <p className="text-xs text-gray-500">PDF, JPG, JPEG, PNG, GIF o WEBP (máx. 10 MB)</p>
                                        </div>
                                    )}
                                    {q.status === 'winner' && !q.shippedAt && (
                                        <button
                                            onClick={() => setShippedModalQuote(q.quoteId)}
                                            className="mt-3 w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded-md"
                                        >
                                            📦 Notificar pedido enviado
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Modal notificar pedido enviado */}
            {shippedModalQuote && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Notificar pedido enviado</h2>
                        <p className="text-gray-600 text-sm mb-4">
                            Indique que el pedido fue enviado. Compras recibirá una notificación.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Detalles opcionales (ej: número de seguimiento, transportista)
                            </label>
                            <textarea
                                value={shippingNotes}
                                onChange={(e) => setShippingNotes(e.target.value)}
                                placeholder="Ej: Enviado por OCA, tracking #123456"
                                rows={2}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-amber-500 focus:border-amber-500"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleMarkShipped}
                                disabled={markingShipped === shippedModalQuote}
                                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 rounded-md disabled:opacity-50"
                            >
                                {markingShipped === shippedModalQuote ? 'Enviando...' : 'Confirmar envío'}
                            </button>
                            <button
                                onClick={() => { setShippedModalQuote(null); setShippingNotes(''); }}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-md"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal enviar cotización */}
            {modalOpen && options && (() => {
                const currentQuote = pendingQuotes.find(q => q.quoteId === modalOpen);
                const pr = currentQuote?.purchaseRequest;
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold text-gray-800 mb-4">Enviar cotización</h2>
                        {pr && (
                            <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                                <h3 className="font-semibold text-blue-900 mb-2">Detalles de la solicitud de Bacar</h3>
                                <p className="text-blue-800 font-medium mb-1">Título: {pr.title || pr.productOrService}</p>
                                {pr.deliveryDeadline && (
                                    <p className="text-blue-800 mb-1">Fecha límite solicitada: {formatDate(pr.deliveryDeadline)}</p>
                                )}
                                <p className="text-blue-900 mt-2">Descripción de la necesidad:</p>
                                <p className="text-blue-800 mt-0.5">{pr.description || '-'}</p>
                            </div>
                        )}
                        {currentQuote?.purchaseRequest.paymentPreferences && (
                            <div className="mb-4 p-2 bg-amber-50 border border-amber-200 rounded text-sm">
                                <span className="font-medium text-amber-800">Preferencias de pago del comprador:</span>
                                <p className="text-amber-900 mt-1">{currentQuote.purchaseRequest.paymentPreferences}</p>
                            </div>
                        )}
                        <div className="space-y-4">
                            {currentQuote?.purchaseRequest?.items && currentQuote.purchaseRequest.items.length > 0 ? (
                                <>
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-gray-700">Precios por ítem</p>
                                        {currentQuote.purchaseRequest.items.map((item, idx) => (
                                            <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <p className="text-sm font-medium text-gray-800 mb-2">{item.producto} (cant: {item.cantidad})</p>
                                                <div className="flex flex-wrap items-center gap-4">
                                                    <label className="inline-flex items-center">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.itemPrices[idx]?.inStock ?? false}
                                                            onChange={(e) => setFormData(f => ({
                                                                ...f,
                                                                itemPrices: { ...f.itemPrices, [idx]: { ...f.itemPrices[idx], inStock: e.target.checked, unitPrice: f.itemPrices[idx]?.unitPrice ?? '' } }
                                                            }))}
                                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                        />
                                                        <span className="ml-2 text-sm">¿Lo tiene en stock?</span>
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-sm">Precio unitario $</label>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            min="0"
                                                            value={formData.itemPrices[idx]?.unitPrice ?? ''}
                                                            onChange={(e) => setFormData(f => ({
                                                                ...f,
                                                                itemPrices: { ...f.itemPrices, [idx]: { ...f.itemPrices[idx], inStock: f.itemPrices[idx]?.inStock ?? false, unitPrice: e.target.value } }
                                                            }))}
                                                            disabled={!formData.itemPrices[idx]?.inStock}
                                                            className="w-24 px-2 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Presupuesto oficial (PDF, opcional)</label>
                                        <input
                                            type="file"
                                            accept=".pdf"
                                            className="hidden"
                                            id="budget-pdf"
                                            onChange={(e) => {
                                                const f = e.target.files?.[0];
                                                if (f && modalOpen) handleUploadBudget(modalOpen, f);
                                                e.target.value = '';
                                            }}
                                            disabled={!!uploadingBudget}
                                        />
                                        <label htmlFor="budget-pdf" className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium cursor-pointer ${uploadingBudget ? 'bg-gray-300' : 'bg-blue-100 hover:bg-blue-200 text-blue-800'}`}>
                                            {uploadingBudget ? 'Subiendo...' : formData.budgetPdfUrl ? '✓ PDF subido' : 'Subir PDF'}
                                        </label>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Precio ($)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={formData.price}
                                        onChange={(e) => setFormData(f => ({ ...f, price: e.target.value }))}
                                        className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                    />
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Fecha límite</label>
                                <input
                                    type="text"
                                    value={formData.deliveryTerm}
                                    onChange={(e) => setFormData(f => ({ ...f, deliveryTerm: e.target.value }))}
                                    placeholder="Ej: 5 días hábiles"
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Plazo de pago</label>
                                <input
                                    type="text"
                                    value={formData.paymentTerm}
                                    onChange={(e) => setFormData(f => ({ ...f, paymentTerm: e.target.value }))}
                                    placeholder="Ej: 30 días"
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Tipo de comprobante</label>
                                <select
                                    value={formData.receiptType}
                                    onChange={(e) => setFormData(f => ({ ...f, receiptType: e.target.value }))}
                                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500"
                                >
                                    <option value="">Seleccione...</option>
                                    {options.receiptTypes.map((r) => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Forma de pago</label>
                                <div className="space-y-3">
                                    {options.paymentMethods.map((m) => (
                                        <div key={m} className="p-3 border border-gray-200 rounded-lg">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.paymentMethods.includes(m)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setFormData(f => ({
                                                                ...f,
                                                                paymentMethods: [...f.paymentMethods, m],
                                                                paymentDetails: {
                                                                    ...f.paymentDetails,
                                                                    [m]: m === 'tarjeta' ? { cards: [], cuotasSinInteres: 0 }
                                                                        : (m === 'transferencia' || m === 'cc') ? { aclaraciones: '' }
                                                                        : {}
                                                                }
                                                            }));
                                                        } else {
                                                            setFormData(prev => {
                                                                const pd = (prev.paymentDetails || {}) as Record<string, unknown>;
                                                                const rest = { ...pd };
                                                                delete rest[m];
                                                                return { ...prev, paymentMethods: prev.paymentMethods.filter(x => x !== m), paymentDetails: rest as PaymentDetails };
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                />
                                                <span className="ml-2 text-sm font-medium">{PAYMENT_METHOD_LABELS[m] || m}</span>
                                            </label>
                                            {formData.paymentMethods.includes(m) && m === 'efectivo' && (
                                                <div className="mt-2 ml-6">
                                                    <label className="block text-xs text-gray-600 mb-1">¿Ofrece % de descuento por pago en efectivo? (opcional)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="100"
                                                        step="0.5"
                                                        placeholder="Ej: 5"
                                                        value={formData.paymentDetails?.efectivo?.discountPercent ?? ''}
                                                        onChange={(e) => setFormData(f => ({
                                                            ...f,
                                                            paymentDetails: { ...f.paymentDetails, efectivo: { discountPercent: e.target.value ? parseFloat(e.target.value) : undefined } }
                                                        }))}
                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                            )}
                                            {formData.paymentMethods.includes(m) && m === 'tarjeta' && (
                                                <div className="mt-2 ml-6 space-y-2">
                                                    <div>
                                                        <span className="block text-xs text-gray-600 mb-1">Tarjetas aceptadas</span>
                                                        <div className="flex flex-wrap gap-2">
                                                            {TARJETA_OPTIONS.map((card) => (
                                                                <label key={card} className="inline-flex items-center">
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={(formData.paymentDetails?.tarjeta?.cards || []).includes(card)}
                                                                        onChange={(e) => {
                                                                            const cards = formData.paymentDetails?.tarjeta?.cards || [];
                                                                            const newCards = e.target.checked ? [...cards, card] : cards.filter(c => c !== card);
                                                                            setFormData(f => ({ ...f, paymentDetails: { ...f.paymentDetails, tarjeta: { ...f.paymentDetails?.tarjeta, cards: newCards, cuotasSinInteres: f.paymentDetails?.tarjeta?.cuotasSinInteres } } }));
                                                                        }}
                                                                        className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                                    />
                                                                    <span className="ml-1 text-xs">{card}</span>
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs text-gray-600 mb-1">Cantidad de cuotas sin interés</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            value={formData.paymentDetails?.tarjeta?.cuotasSinInteres ?? ''}
                                                            onChange={(e) => setFormData(f => ({
                                                                ...f,
                                                                paymentDetails: { ...f.paymentDetails, tarjeta: { ...f.paymentDetails?.tarjeta, cards: f.paymentDetails?.tarjeta?.cards || [], cuotasSinInteres: e.target.value ? parseInt(e.target.value, 10) : 0 } }
                                                            }))}
                                                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                            {formData.paymentMethods.includes(m) && m === 'cheque' && (
                                                <div className="mt-2 ml-6">
                                                    <label className="block text-xs text-gray-600 mb-1">A cuántos días (ej: 30, 60, 90)</label>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        placeholder="30"
                                                        value={formData.paymentDetails?.cheque?.dias ?? ''}
                                                        onChange={(e) => setFormData(f => ({
                                                            ...f,
                                                            paymentDetails: { ...f.paymentDetails, cheque: { dias: e.target.value ? parseInt(e.target.value, 10) : undefined } }
                                                        }))}
                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                            )}
                                            {(formData.paymentMethods.includes(m) && (m === 'transferencia' || m === 'cc')) && (
                                                <div className="mt-2 ml-6">
                                                    <label className="block text-xs text-gray-600 mb-1">Aclaraciones / CBU / Alias</label>
                                                    <textarea
                                                        rows={2}
                                                        placeholder="Indique detalles de transferencia, CBU o Alias"
                                                        value={formData.paymentDetails?.[m]?.aclaraciones ?? ''}
                                                        onChange={(e) => setFormData(f => ({
                                                            ...f,
                                                            paymentDetails: { ...f.paymentDetails, [m]: { aclaraciones: e.target.value } }
                                                        }))}
                                                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => handleSubmitQuote(modalOpen)}
                                disabled={submittingQuote === modalOpen}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2 rounded-md disabled:opacity-50"
                            >
                                {submittingQuote === modalOpen ? 'Enviando...' : 'Enviar'}
                            </button>
                            <button
                                onClick={() => setModalOpen(null)}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-md"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
                );
            })()}
        </div>
    );
};

export default SupplierQuotesPage;
