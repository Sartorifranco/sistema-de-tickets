import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { toast } from 'react-toastify';
import SupplierQuotesPage from './SupplierQuotesPage';
import HelpBox from '../components/Common/HelpBox';
import PurchaseStepper from '../components/Purchases/PurchaseStepper';

interface PurchaseItem {
    producto: string;
    cantidad: number;
    descripcion: string;
}

interface PurchaseRequest {
    id: string;
    title?: string;
    productOrService: string;
    description: string;
    quantity: number;
    items?: PurchaseItem[];
    referenceLink?: string;
    deliveryDeadline?: string;
    estimatedDeliveryDate?: string;
    rejectionComment?: string;
    status: string;
    createdAt: string;
}

const MyPurchasesPage: React.FC = () => {
    const { user } = useAuth();
    const [purchases, setPurchases] = useState<PurchaseRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [ratingModal, setRatingModal] = useState<{ id: string; productOrService: string } | null>(null);
    const [rating, setRating] = useState(0);
    const [ratingHover, setRatingHover] = useState(0);
    const [ratingComment, setRatingComment] = useState('');
    const [submittingRating, setSubmittingRating] = useState(false);

    const isBacar = ['admin', 'agent', 'boss', 'purchasing'].includes(user?.role || '') ||
        (user?.role === 'client' && user?.company_name && String(user.company_name).toLowerCase().includes('bacar'));
    const shouldFetchPurchases = user?.role === 'supplier' ? false : isBacar;

    const fetchPurchases = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/api/purchases');
            if (data.success && data.data) {
                setPurchases(data.data);
            } else {
                toast.error(data.message || 'Error al cargar solicitudes.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string }; status?: number } };
            if (err.response?.status === 503) {
                toast.error('El módulo de compras no está disponible.');
            } else {
                toast.error(err.response?.data?.message || 'Error al cargar solicitudes.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (shouldFetchPurchases) fetchPurchases();
    }, [shouldFetchPurchases, fetchPurchases]);

    if (user?.role === 'supplier') {
        return <SupplierQuotesPage />;
    }

    if (user && user.role === 'client' && !isBacar) {
        return (
            <div className="bg-white rounded-lg shadow p-8 text-center">
                <p className="text-gray-600 mb-4">Solo empleados de Bacar pueden acceder al módulo de compras. Las otras empresas solo pueden usar el módulo de tickets.</p>
                <Link to="/client" className="text-red-600 hover:underline font-medium">Ir al Dashboard</Link>
            </div>
        );
    }

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
        if (status === 'Conforme / Cerrado') return 'bg-green-100 text-green-800';
        if (status === 'Entregado') return 'bg-emerald-100 text-emerald-800';
        if (status.includes('Pendiente')) return 'bg-amber-100 text-amber-800';
        if (status.includes('Aprobad')) return 'bg-blue-100 text-blue-800';
        if (status.includes('Rechazad')) return 'bg-red-100 text-red-800';
        return 'bg-gray-100 text-gray-800';
    };

    const openRatingModal = (p: PurchaseRequest) => {
        setRatingModal({ id: p.id, productOrService: p.productOrService });
        setRating(0);
        setRatingComment('');
    };

    const handleSubmitRating = async () => {
        if (!ratingModal) return;
        if (rating < 1 || rating > 5) {
            toast.warning('Seleccione una calificación de 1 a 5 estrellas.');
            return;
        }
        setSubmittingRating(true);
        try {
            const { data } = await api.put(`/api/purchases/${ratingModal.id}/conforme`, {
                rating: Math.round(rating),
                comment: ratingComment.trim() || undefined
            });
            if (data.success) {
                toast.success('Solicitud marcada como conforme. ¡Gracias por calificar!');
                setRatingModal(null);
                fetchPurchases();
            } else {
                toast.error(data.message || 'Error.');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Error al marcar conforme.');
        } finally {
            setSubmittingRating(false);
        }
    };

    return (
        <div className="space-y-6">
            <HelpBox title="¿Cómo funciona mi solicitud de compra?">
                <p><strong>1.</strong> Cree una solicitud con uno o más ítems (producto, descripción, cantidad). Su jefe la revisará y aprobará o rechazará.</p>
                <p><strong>2.</strong> Si es aprobada, el encargado de compras solicitará presupuestos a proveedores.</p>
                <p><strong>3.</strong> Una vez elegido el proveedor y realizada la compra, podrá dar seguimiento hasta la entrega.</p>
                <p><strong>4.</strong> Cuando reciba el pedido, márquelo como "Satisfecho con la entrega" para cerrar el proceso.</p>
            </HelpBox>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-2xl font-bold text-gray-800">Mis solicitudes de compra</h1>
                <Link
                    to="/purchases/new"
                    className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-md inline-flex items-center"
                >
                    + Nueva solicitud
                </Link>
            </div>

            {loading ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    Cargando solicitudes...
                </div>
            ) : purchases.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                    <p className="mb-4">No tienes solicitudes de compra.</p>
                    <Link to="/purchases/new" className="text-red-600 hover:underline font-medium">
                        Crear primera solicitud
                    </Link>
                </div>
            ) : (
                <div className="space-y-3">
                    {purchases.map((p) => {
                        const isExpanded = expandedId === p.id;
                        const itemCount = Array.isArray(p.items) ? p.items.length : 0;
                        const totalItems = itemCount > 0 ? itemCount : 1;
                        const displayTitle = (p.title || p.productOrService) || `Solicitud (${totalItems} ítem${totalItems !== 1 ? 's' : ''})`;
                        return (
                            <div
                                key={p.id}
                                className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <button
                                    type="button"
                                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50/50 transition-colors"
                                >
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-gray-800 text-lg truncate">{displayTitle}</h3>
                                        <div className="flex flex-wrap items-center gap-3 mt-1 text-sm text-gray-500">
                                            <span>{formatDate(p.createdAt)}</span>
                                            <span>• {totalItems} ítem{totalItems !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 ml-4 shrink-0">
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(p.status)}`}>
                                            {p.status}
                                        </span>
                                        <span className="text-gray-400 text-xl">
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </div>
                                </button>
                                {isExpanded && (
                                    <div className="px-4 pb-4 pt-0 border-t border-gray-100">
                                        <PurchaseStepper status={p.status} className="my-4" />
                                        {Array.isArray(p.items) && p.items.length > 0 ? (
                                            <div className="mb-4">
                                                <p className="text-sm font-medium text-gray-700 mb-2">Ítems de la solicitud</p>
                                                <ul className="space-y-2">
                                                    {p.items.map((item, idx) => (
                                                        <li key={idx} className="p-3 bg-gray-50 rounded-lg text-sm">
                                                            <div className="flex justify-between items-center">
                                                                <span className="font-medium text-gray-800">{item.producto}</span>
                                                                <span className="text-gray-500">x{item.cantidad}</span>
                                                            </div>
                                                            {item.descripcion && <p className="text-gray-600 text-xs mt-1">{item.descripcion}</p>}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : (
                                            <p className="text-gray-600 text-sm mb-4 line-clamp-2">{p.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-2 text-xs text-gray-500 mb-3">
                                            {p.deliveryDeadline && (
                                                <span>Fecha límite: {formatDate(p.deliveryDeadline)}</span>
                                            )}
                                            {p.estimatedDeliveryDate && (
                                                <span className="text-amber-700">• Entrega estimada: {p.estimatedDeliveryDate}</span>
                                            )}
                                        </div>
                                        {p.status === 'Rechazado' && p.rejectionComment && (
                                            <div className="mb-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                                                <p className="text-xs font-medium text-red-800">Motivo de rechazo:</p>
                                                <p className="text-sm text-red-700">{p.rejectionComment}</p>
                                            </div>
                                        )}
                                        {p.status === 'Entregado' && (
                                            <button
                                                onClick={() => openRatingModal(p)}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg shadow-sm"
                                            >
                                                ✓ Marcar como Recibido / Conforme
                                            </button>
                                        )}
                                        {p.referenceLink && (
                                            <a
                                                href={p.referenceLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-sm text-red-600 hover:underline mt-3 inline-block"
                                            >
                                                Ver referencia →
                                            </a>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal Calificar Entrega */}
            {ratingModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
                        <h2 className="text-xl font-bold text-gray-800 mb-1">Calificar Entrega</h2>
                        <p className="text-sm text-gray-600 mb-4">{ratingModal.productOrService}</p>
                        <p className="text-sm font-medium text-gray-700 mb-2">¿Cómo fue la entrega?</p>
                        <div className="flex gap-1 mb-4" onMouseLeave={() => setRatingHover(0)}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setRatingHover(star)}
                                    className="p-1 text-2xl focus:outline-none focus:ring-2 focus:ring-red-500 rounded transition-transform hover:scale-110"
                                    aria-label={`${star} estrellas`}
                                >
                                    <span className={(ratingHover || rating) >= star ? 'text-amber-400' : 'text-gray-300'}>
                                        ⭐
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Comentarios (opcional)</label>
                            <textarea
                                value={ratingComment}
                                onChange={(e) => setRatingComment(e.target.value)}
                                placeholder="Ej: Entregado a tiempo, bien empaquetado..."
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-red-500 focus:border-red-500 text-sm"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSubmitRating}
                                disabled={submittingRating || rating < 1}
                                className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-2 rounded-md"
                            >
                                {submittingRating ? 'Guardando...' : 'Confirmar y cerrar'}
                            </button>
                            <button
                                onClick={() => setRatingModal(null)}
                                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 rounded-md"
                            >
                                Cancelar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyPurchasesPage;
