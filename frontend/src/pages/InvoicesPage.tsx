import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import HelpBox from '../components/Common/HelpBox';

interface Invoice {
    quoteId: string;
    purchaseId: string;
    productOrService: string;
    supplierId: number;
    supplierName: string;
    supplierEmail?: string;
    price: number | null;
    invoiceFileUrl: string;
    invoiceUploadedAt: string | null;
    createdAt: string | null;
}

interface SupplierOption {
    id: number;
    first_name?: string;
    last_name?: string;
    email: string;
}

const InvoicesPage: React.FC = () => {
    const navigate = useNavigate();
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSupplier, setFilterSupplier] = useState<string>('');
    const [filterDateFrom, setFilterDateFrom] = useState('');
    const [filterDateTo, setFilterDateTo] = useState('');
    const [filterAmountMin, setFilterAmountMin] = useState('');
    const [filterAmountMax, setFilterAmountMax] = useState('');

    const fetchInvoices = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filterSupplier) params.set('supplierId', filterSupplier);
            if (filterDateFrom) params.set('dateFrom', filterDateFrom);
            if (filterDateTo) params.set('dateTo', filterDateTo);
            if (filterAmountMin) params.set('amountMin', filterAmountMin);
            if (filterAmountMax) params.set('amountMax', filterAmountMax);
            const { data } = await api.get(`/api/purchases/invoices?${params.toString()}`);
            if (data.success && data.data) {
                setInvoices(data.data);
            } else {
                toast.error(data.message || 'Error al cargar facturas.');
            }
        } catch (err: unknown) {
            const e = err as { response?: { status?: number; data?: { message?: string } } };
            if (e.response?.status === 503) {
                toast.error('El módulo de compras no está disponible.');
            } else {
                toast.error(e.response?.data?.message || 'Error al cargar facturas.');
            }
        } finally {
            setLoading(false);
        }
    }, [filterSupplier, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax]);

    useEffect(() => {
        fetchInvoices();
    }, [fetchInvoices]);

    useEffect(() => {
        api.get('/api/suppliers').then((r) => {
            if (r.data.success && r.data.data) {
                setSuppliers(r.data.data);
            }
        }).catch(() => {});
    }, []);

    const formatDate = (dateStr?: string | null) => {
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Facturas</h1>
                <button
                    onClick={() => navigate('/purchases/management')}
                    className="text-gray-600 hover:text-gray-800 font-medium"
                >
                    ← Volver a gestión
                </button>
            </div>

            <HelpBox title="Módulo de facturas">
                <p>Se listan las facturas y comprobantes subidos por los proveedores ganadores. Puede filtrar por proveedor, rango de fechas y montos. Cada factura está vinculada a la solicitud de compra correspondiente.</p>
            </HelpBox>

            <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
                <h2 className="text-lg font-semibold text-gray-700 mb-3">Filtros</h2>
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Proveedor</label>
                        <select
                            value={filterSupplier}
                            onChange={(e) => setFilterSupplier(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        >
                            <option value="">Todos</option>
                            {suppliers.map((s) => (
                                <option key={s.id} value={s.id}>
                                    {s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.email}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Desde fecha</label>
                        <input
                            type="date"
                            value={filterDateFrom}
                            onChange={(e) => setFilterDateFrom(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Hasta fecha</label>
                        <input
                            type="date"
                            value={filterDateTo}
                            onChange={(e) => setFilterDateTo(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Monto mínimo ($)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={filterAmountMin}
                            onChange={(e) => setFilterAmountMin(e.target.value)}
                            placeholder="0"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Monto máximo ($)</label>
                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={filterAmountMax}
                            onChange={(e) => setFilterAmountMax(e.target.value)}
                            placeholder="Sin límite"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                        />
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Cargando facturas...
                </div>
            ) : invoices.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    No hay facturas. Los proveedores ganadores pueden subir comprobantes desde sus presupuestos.
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Compra</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Proveedor</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Monto</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Fecha factura</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {invoices.map((inv) => (
                                    <tr key={inv.quoteId} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => navigate(`/purchases/management/${inv.purchaseId}`)}
                                                className="text-left font-medium text-red-600 hover:underline"
                                            >
                                                {inv.productOrService}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">{inv.supplierName}</td>
                                        <td className="px-4 py-3 text-sm font-semibold text-gray-800">
                                            {inv.price != null ? `$ ${Number(inv.price).toLocaleString('es-AR')}` : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-600">
                                            {formatDate(inv.invoiceUploadedAt)}
                                        </td>
                                        <td className="px-4 py-3">
                                            <a
                                                href={inv.invoiceFileUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded"
                                            >
                                                Ver factura
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoicesPage;
