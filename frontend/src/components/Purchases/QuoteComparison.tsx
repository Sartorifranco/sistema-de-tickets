import React from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';

interface PaymentDetails {
    efectivo?: { discountPercent?: number };
    tarjeta?: { cards: string[]; cuotasSinInteres?: number };
    cheque?: { dias?: number };
    transferencia?: { aclaraciones?: string };
    cc?: { aclaraciones?: string };
}

interface Quote {
    id: string;
    supplierId: number;
    supplierName?: string;
    supplierEmail?: string;
    status: string;
    price?: number;
    paymentMethods?: string[];
    paymentDetails?: PaymentDetails;
    deliveryTerm?: string;
    paymentTerm?: string;
    receiptType?: string;
    budgetFileUrl?: string;
    invoiceFileUrl?: string | null;
    invoiceUploadedAt?: string | null;
    submittedAt?: string;
}

const formatPaymentDetails = (q: Quote): string => {
    const pd = q.paymentDetails;
    if (!pd) return Array.isArray(q.paymentMethods) && q.paymentMethods.length > 0 ? q.paymentMethods.join(', ') : '-';
    const parts: string[] = [];
    if (pd.efectivo?.discountPercent != null) parts.push(`Efectivo ${pd.efectivo.discountPercent}% dto`);
    if (pd.tarjeta) {
        const cards = pd.tarjeta.cards?.length ? ` (${pd.tarjeta.cards.join(', ')})` : '';
        const cuotas = pd.tarjeta.cuotasSinInteres ? ` ${pd.tarjeta.cuotasSinInteres} cuotas s/i` : '';
        parts.push(`Tarjeta${cards}${cuotas}`);
    }
    if (pd.cheque?.dias != null) parts.push(`Cheque ${pd.cheque.dias} días`);
    if (pd.transferencia?.aclaraciones) parts.push(`Transferencia: ${pd.transferencia.aclaraciones.slice(0, 40)}${pd.transferencia.aclaraciones.length > 40 ? '...' : ''}`);
    if (pd.cc?.aclaraciones) parts.push(`Cta Cte: ${pd.cc.aclaraciones.slice(0, 40)}${pd.cc.aclaraciones.length > 40 ? '...' : ''}`);
    return parts.length > 0 ? parts.join(' | ') : (Array.isArray(q.paymentMethods) && q.paymentMethods.length > 0 ? q.paymentMethods.join(', ') : '-');
};

interface QuoteComparisonProps {
    purchaseId: string;
    quotes: Quote[];
    onWinnerSelected: () => void;
}

const QuoteComparison: React.FC<QuoteComparisonProps> = ({ purchaseId, quotes, onWinnerSelected }) => {
    const submittedQuotes = quotes.filter(q => q.status === 'submitted' || q.status === 'winner');

    const handleSelectWinner = async (quoteId: string) => {
        if (!window.confirm('¿Confirmar este proveedor como ganador? Las demás cotizaciones quedarán rechazadas.')) return;
        try {
            const { data } = await api.put(`/api/purchases/quotes/${quoteId}/select-winner`);
            if (data.success) {
                toast.success('Ganador seleccionado.');
                onWinnerSelected();
            } else {
                toast.error(data.message || 'Error al seleccionar ganador.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al seleccionar ganador.');
        }
    };

    if (submittedQuotes.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                Aún no hay cotizaciones enviadas. Solicite presupuestos a proveedores para comparar.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Comparativa de presupuestos</h3>
            <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Proveedor</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Precio</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plazo entrega</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Plazo pago</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Comprobante</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Factura</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Forma de pago</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Acción</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {submittedQuotes.map((q) => (
                        <tr key={q.id} className={q.status === 'winner' ? 'bg-green-50' : ''}>
                            <td className="px-4 py-3 text-sm">
                                <span className="font-medium">{q.supplierName || q.supplierEmail || 'Proveedor'}</span>
                                {q.status === 'winner' && (
                                    <span className="ml-2 px-2 py-0.5 bg-green-600 text-white text-xs rounded">Ganador</span>
                                )}
                            </td>
                            <td className="px-4 py-3 text-sm font-semibold">
                                $ {(q.price ?? 0).toLocaleString('es-AR')}
                            </td>
                            <td className="px-4 py-3 text-sm">{q.deliveryTerm || '-'}</td>
                            <td className="px-4 py-3 text-sm">{q.paymentTerm || '-'}</td>
                            <td className="px-4 py-3 text-sm">{q.receiptType || '-'}</td>
                            <td className="px-4 py-3 text-sm">
                                {q.invoiceFileUrl ? (
                                    <a
                                        href={q.invoiceFileUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline font-medium"
                                    >
                                        Ver factura
                                    </a>
                                ) : q.status === 'winner' ? (
                                    <span className="text-amber-600">Pendiente</span>
                                ) : (
                                    '-'
                                )}
                            </td>
                            <td className="px-4 py-3 text-sm">
                                {formatPaymentDetails(q)}
                            </td>
                            <td className="px-4 py-3 text-sm">
                                {q.status === 'winner' ? (
                                    <span className="text-green-600 font-medium">Seleccionado</span>
                                ) : (
                                    <button
                                        onClick={() => handleSelectWinner(q.id)}
                                        className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium rounded"
                                    >
                                        Seleccionar Ganador
                                    </button>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default QuoteComparison;
