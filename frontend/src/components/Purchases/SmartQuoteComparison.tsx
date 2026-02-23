import React, { useState, useMemo } from 'react';
import api from '../../config/axiosConfig';
import { toast } from 'react-toastify';
import QuoteComparison from './QuoteComparison';

const NONE_QUOTE = '__none__';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface QuoteItemPrice {
    itemIndex: number;
    inStock: boolean;
    unitPrice: number;
}

interface ItemWinner {
    itemIndex: number;
    quoteId: string;
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
}

interface HistoricalPrice {
    price: number;
    date: string;
}

interface SmartQuoteComparisonProps {
    purchaseId: string;
    items: PurchaseItem[];
    quotes: Quote[];
    itemWinners?: ItemWinner[];
    historicalPrices?: Record<string, HistoricalPrice>;
    onWinnerSelected: () => void;
}

// Extrae número de días del plazo de entrega (ej. "15 días" -> 15)
const parseDeliveryDays = (term?: string): number | null => {
    if (!term) return null;
    const m = term.match(/(\d+)\s*(días?|día)/i) || term.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : null;
};

// Extrae cantidad de cuotas del plazo de pago (ej. "3 cuotas" -> 3, "30 días" -> 0)
const parsePaymentCuotas = (term?: string): number => {
    if (!term) return 0;
    const m = term.match(/(\d+)\s*cuotas?/i);
    return m ? parseInt(m[1], 10) : 0;
};

const SmartQuoteComparison: React.FC<SmartQuoteComparisonProps> = ({
    purchaseId,
    items,
    quotes,
    itemWinners: initialItemWinners = [],
    historicalPrices = {},
    onWinnerSelected,
}) => {
    const submittedQuotes = quotes.filter(q => q.status === 'submitted' || q.status === 'winner');
    const isCompleted = Array.isArray(initialItemWinners) && initialItemWinners.length >= items.length;

    const getUnitPriceForInit = (quote: Quote, idx: number): number | null => {
        const ip = quote.itemPrices?.find(p => p.itemIndex === idx);
        if (!ip || !ip.inStock) return null;
        return ip.unitPrice;
    };

    const [selectedByItem, setSelectedByItem] = useState<Record<number, string>>(() => {
        const map: Record<number, string> = {};
        for (const w of initialItemWinners) {
            map[w.itemIndex] = w.quoteId;
        }
        for (let i = 0; i < items.length; i++) {
            if (map[i] != null) continue;
            const candidates = submittedQuotes
                .map(q => ({ q, price: getUnitPriceForInit(q, i) }))
                .filter((x): x is { q: Quote; price: number } => x.price != null);
            if (candidates.length === 0) continue;
            const lowest = Math.min(...candidates.map(c => c.price));
            const cheapest = candidates.filter(c => c.price === lowest);
            const withGoodRating = cheapest
                .filter(c => (c.q.supplierRating ?? 0) >= 4.0)
                .sort((a, b) => (b.q.supplierRating ?? 0) - (a.q.supplierRating ?? 0));
            if (withGoodRating.length > 0) {
                map[i] = withGoodRating[0].q.id;
            }
        }
        return map;
    });
    const [saving, setSaving] = useState(false);

    const getUnitPrice = (quote: Quote, itemIndex: number): number | null => {
        const ip = quote.itemPrices?.find(p => p.itemIndex === itemIndex);
        if (!ip || !ip.inStock) return null;
        return ip.unitPrice;
    };

    const getLowestPriceForItem = (itemIndex: number): number | null => {
        let lowest: number | null = null;
        submittedQuotes.forEach(q => {
            const p = getUnitPrice(q, itemIndex);
            if (p != null && (lowest == null || p < lowest)) lowest = p;
        });
        return lowest;
    };

    const itemHasAnyQuote = (itemIndex: number): boolean => getLowestPriceForItem(itemIndex) != null;

    const handleSelectItemWinner = (itemIndex: number, quoteId: string) => {
        setSelectedByItem(prev => ({ ...prev, [itemIndex]: quoteId }));
    };

    const handleConfirmItemWinners = async () => {
        const winners: { itemIndex: number; quoteId: string }[] = [];
        for (let i = 0; i < items.length; i++) {
            const qid = selectedByItem[i];
            if (!qid) {
                toast.warning(`Seleccione un proveedor o "Sin cotización" para el ítem "${items[i].producto}".`);
                return;
            }
            winners.push({ itemIndex: i, quoteId: qid });
        }
        setSaving(true);
        try {
            const { data } = await api.put(`/api/purchases/${purchaseId}/item-winners`, { itemWinners: winners });
            if (data.success) {
                toast.success('Ganadores por ítem guardados.');
                onWinnerSelected();
            } else {
                toast.error(data.message || 'Error al guardar.');
            }
        } catch (err: unknown) {
            const e = err as { response?: { data?: { message?: string } } };
            toast.error(e.response?.data?.message || 'Error al guardar ganadores.');
        } finally {
            setSaving(false);
        }
    };

    // Recomendación por ítem según múltiples criterios
    const recommendations = useMemo(() => {
        const rec: Record<number, { quoteId: string; reasons: string[] }> = {};
        for (let i = 0; i < items.length; i++) {
            const lowest = getLowestPriceForItem(i);
            if (lowest == null) continue;

            const candidates = submittedQuotes
                .filter(q => getUnitPrice(q, i) != null)
                .map(q => ({
                    q,
                    price: getUnitPrice(q, i)!,
                    deliveryDays: parseDeliveryDays(q.deliveryTerm),
                    cuotas: parsePaymentCuotas(q.paymentTerm),
                    paymentMethodsCount: Array.isArray(q.paymentMethods) ? q.paymentMethods.length : 0,
                }));

            if (candidates.length === 0) continue;

            const best = candidates.slice(1).reduce((a, c) => {
                if (c.price < a.price) return c;
                if (c.price > a.price) return a;
                if (c.deliveryDays != null && (a.deliveryDays == null || c.deliveryDays < a.deliveryDays)) return c;
                if (c.cuotas > a.cuotas) return c;
                if (c.paymentMethodsCount > a.paymentMethodsCount) return c;
                return a;
            }, candidates[0]);

            const reasons: string[] = [];
            if (best.price === lowest) reasons.push('Mejor precio');
            if (best.deliveryDays != null) reasons.push(`Entrega: ${submittedQuotes.find(x => x.id === best.q.id)?.deliveryTerm || best.q.deliveryTerm}`);
            if (best.cuotas > 0) reasons.push(`Hasta ${best.cuotas} cuotas`);
            if (best.paymentMethodsCount > 0) reasons.push(`${best.paymentMethodsCount} formas de pago`);
            rec[i] = { quoteId: best.q.id, reasons };
        }
        return rec;
    }, [items.length, submittedQuotes]);

    const allItemsHaveSelection = items.every((_, i) => selectedByItem[i] != null);

    if (submittedQuotes.length === 0) {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                Aún no hay cotizaciones enviadas. Solicite presupuestos a proveedores para comparar.
            </div>
        );
    }

    const hasItemPrices = submittedQuotes.some(q => Array.isArray(q.itemPrices) && q.itemPrices.length > 0);

    if (!hasItemPrices || items.length === 0) {
        return (
            <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                    Las cotizaciones no incluyen precios por ítem. Use la comparativa clásica a continuación.
                </div>
                <QuoteComparison purchaseId={purchaseId} quotes={quotes} onWinnerSelected={onWinnerSelected} />
            </div>
        );
    }

    return (
        <div className="overflow-x-auto">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">Comparativa inteligente por ítem</h3>
            <p className="text-sm text-gray-600 mb-3">
                Se resalta el mejor precio. Las recomendaciones consideran: precio, cuotas, formas de pago y plazo de entrega. Seleccione un proveedor por ítem (o &quot;Sin cotización&quot; si nadie tiene stock) y confirme.
            </p>

            {/* Fila de recomendaciones por ítem */}
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="text-sm font-semibold text-blue-900 mb-2">Recomendaciones por ítem</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                    {items.map((item, i) => {
                        const rec = recommendations[i];
                        const q = rec ? submittedQuotes.find(x => x.id === rec.quoteId) : null;
                        const hasNoQuote = !itemHasAnyQuote(i);
                        return (
                            <li key={i} className="flex flex-wrap items-center gap-2">
                                <span className="font-medium">{item.producto}:</span>
                                {hasNoQuote ? (
                                    <span className="text-amber-700">Ningún proveedor tiene stock — seleccione &quot;Sin cotización&quot;</span>
                                ) : rec && q ? (
                                    <>
                                        <span className="text-green-700 font-medium">{q.supplierName || q.supplierEmail}</span>
                                        <span className="text-blue-600">— {rec.reasons.join(', ')}</span>
                                    </>
                                ) : (
                                    <span className="text-gray-500">Sin datos suficientes</span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>

            <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
                <thead className="bg-gray-100">
                    <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ítem</th>
                        {submittedQuotes.map(q => (
                            <th key={q.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                                <span>{q.supplierName || q.supplierEmail || 'Proveedor'}</span>
                                {q.supplierRating != null && (
                                    <span className="ml-1 text-amber-500 font-normal" title="Calificación promedio">⭐ {q.supplierRating}</span>
                                )}
                                {q.status === 'winner' && <span className="ml-1 text-green-600">✓</span>}
                            </th>
                        ))}
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Sin cotización</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                    {items.map((item, itemIndex) => {
                        const lowest = getLowestPriceForItem(itemIndex);
                        const hasNoQuote = !itemHasAnyQuote(itemIndex);
                        return (
                            <tr key={itemIndex}>
                                <td className="px-4 py-3 text-sm">
                                    <span className="font-medium text-gray-800">{item.producto}</span>
                                    <span className="text-gray-500 text-xs block">Cant: {item.cantidad}</span>
                                </td>
                                {submittedQuotes.map(q => {
                                    const price = getUnitPrice(q, itemIndex);
                                    const isLowest = price != null && lowest != null && price === lowest;
                                    const isSelected = selectedByItem[itemIndex] === q.id;
                                    const isRecommended = recommendations[itemIndex]?.quoteId === q.id;
                                    const hist = historicalPrices[item.producto];
                                    const isOverpriced = price != null && hist && hist.price > 0 && price >= hist.price * 1.2;
                                    const fmtDate = hist?.date
                                        ? new Date(hist.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                        : 'N/A';
                                    const tooltipText = hist
                                        ? `Precio histórico reciente: $${hist.price.toLocaleString('es-AR')} (Pagado el ${fmtDate})`
                                        : '';
                                    return (
                                        <td
                                            key={q.id}
                                            className={`px-4 py-3 text-sm align-top ${isLowest ? 'bg-green-100 text-green-800' : ''} ${isRecommended ? 'ring-1 ring-blue-300' : ''}`}
                                        >
                                            <div className="flex flex-col gap-1">
                                                {price != null ? (
                                                    <span className={`font-semibold inline-flex items-center gap-1 ${isLowest ? 'text-green-800' : ''}`}>
                                                        $ {price.toLocaleString('es-AR')}
                                                        {isOverpriced && (
                                                            <span
                                                                className="text-red-600 cursor-help"
                                                                title={tooltipText}
                                                            >
                                                                ⚠️
                                                            </span>
                                                        )}
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">—</span>
                                                )}
                                                {(q.deliveryTerm || q.paymentTerm || (Array.isArray(q.paymentMethods) && q.paymentMethods.length > 0)) && (
                                                    <div className="text-xs text-gray-500 mt-0.5">
                                                        {q.deliveryTerm && <span title="Plazo entrega">{q.deliveryTerm}</span>}
                                                        {q.paymentTerm && <span className="ml-1" title="Plazo pago">{q.paymentTerm}</span>}
                                                        {Array.isArray(q.paymentMethods) && q.paymentMethods.length > 0 && (
                                                            <span className="ml-1" title="Formas de pago">({q.paymentMethods.length} formas)</span>
                                                        )}
                                                    </div>
                                                )}
                                                {!isCompleted && price != null && (
                                                    <label className="flex items-center gap-1 cursor-pointer mt-1">
                                                        <input
                                                            type="radio"
                                                            name={`item-${itemIndex}`}
                                                            checked={isSelected}
                                                            onChange={() => handleSelectItemWinner(itemIndex, q.id)}
                                                            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                                        />
                                                        <span className="text-xs text-gray-600">Ganador</span>
                                                    </label>
                                                )}
                                                {isCompleted && isSelected && (
                                                    <span className="text-green-600 text-xs font-medium">✓ Seleccionado</span>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                                {/* Columna Sin cotización */}
                                <td className="px-4 py-3 text-sm align-top bg-gray-50">
                                    <div className="flex flex-col gap-1">
                                        {hasNoQuote && <span className="text-amber-600 text-xs font-medium">Nadie cotizó</span>}
                                        {!isCompleted && (
                                            <label className="flex items-center gap-1 cursor-pointer mt-1">
                                                <input
                                                    type="radio"
                                                    name={`item-${itemIndex}`}
                                                    checked={selectedByItem[itemIndex] === NONE_QUOTE}
                                                    onChange={() => handleSelectItemWinner(itemIndex, NONE_QUOTE)}
                                                    className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                                                />
                                                <span className="text-xs text-gray-600">Sin cotización</span>
                                            </label>
                                        )}
                                        {isCompleted && selectedByItem[itemIndex] === NONE_QUOTE && (
                                            <span className="text-amber-600 text-xs font-medium">✓ Sin cotización</span>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                    <tr className="bg-gray-50">
                        <td className="px-4 py-3 text-sm font-semibold">Total</td>
                        {submittedQuotes.map(q => (
                            <td key={q.id} className="px-4 py-3 text-sm font-semibold">
                                $ {(q.price ?? 0).toLocaleString('es-AR')}
                            </td>
                        ))}
                        <td className="px-4 py-3"></td>
                    </tr>
                    {!isCompleted && (
                        <tr>
                            <td colSpan={submittedQuotes.length + 2} className="px-4 py-3">
                                <button
                                    onClick={handleConfirmItemWinners}
                                    disabled={saving || !allItemsHaveSelection}
                                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg"
                                >
                                    {saving ? 'Guardando...' : 'Confirmar ganadores por ítem'}
                                </button>
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default SmartQuoteComparison;
