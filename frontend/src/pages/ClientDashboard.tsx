import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../config/axiosConfig';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { TicketData } from '../types';
import { clModalPanel } from '../utils/cleanLightUi';

// Interfaz para la estructura de las métricas que esperamos del backend
interface ClientMetrics {
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
}

// --- Componente genérico para el Modal de Detalles ---
const DetailsModal: React.FC<{ title: string; items: Partial<TicketData>[]; onClose: () => void; loading: boolean }> = ({ title, items, onClose, loading }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className={`${clModalPanel} max-w-2xl p-6`}>
                <h2 className="text-2xl font-bold mb-4 border-b border-gray-100 pb-2 text-gray-900">{title}</h2>
                <div className="max-h-96 overflow-y-auto border-t border-b py-2">
                    {loading ? (
                        <p className="text-center text-gray-500 py-4">Cargando...</p>
                    ) : items.length > 0 ? (
                        <ul className="space-y-2">
                            {items.map((ticket) => (
                                <li key={ticket.id} className="p-2 border-b flex justify-between items-center">
                                    <span>#{ticket.id} - {ticket.title}</span>
                                    <Link to={`/client/tickets/${ticket.id}`} className="text-red-600 hover:underline">Ver</Link>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-center text-gray-500 py-4">No hay tickets para mostrar en esta categoría.</p>
                    )}
                </div>
                <button type="button" onClick={onClose} className="mt-6 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold py-2.5 px-5 rounded-xl w-full">Cerrar</button>
            </div>
        </div>
    );
};


const ClientDashboard: React.FC = () => {
    const { user } = useAuth();
    const [metrics, setMetrics] = useState<ClientMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // ✅ Estados para manejar el modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState<{ title: string; items: TicketData[] }>({ title: '', items: [] });
    const [modalLoading, setModalLoading] = useState(false);

    const fetchMetrics = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/dashboard/client');
            setMetrics(response.data.data);
        } catch (err) {
            setError('No se pudieron cargar las estadísticas.');
            console.error("Error fetching client dashboard:", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (['client', 'boss', 'purchasing'].includes(user?.role || '')) {
            fetchMetrics();
        }
    }, [user, fetchMetrics]);

    // ✅ Nueva función para manejar el click en las tarjetas
    const handleCardClick = async (status: 'open' | 'in-progress' | 'resolved' | 'closed') => {
        setModalLoading(true);
        setIsModalOpen(true);
        
        const titleMap = {
            open: 'Tickets Abiertos',
            'in-progress': 'Tickets En Progreso',
            resolved: 'Tickets Resueltos',
            closed: 'Tickets Cerrados'
        };

        try {
            // Llama a la API de tickets con el filtro de estado correspondiente
            const response = await api.get(`/api/tickets?status=${status}`);
            setModalContent({ title: titleMap[status], items: response.data.data || [] });
        } catch (error) {
            toast.error('No se pudo cargar la lista de tickets.');
            setIsModalOpen(false);
        } finally {
            setModalLoading(false);
        }
    };

    if (loading) {
        return <div className="p-8 text-center">Cargando dashboard...</div>;
    }

    if (error) {
        return <div className="p-8 text-center text-red-500">{error}</div>;
    }

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-2">Tu panel de tickets</h1>
                <p className="text-md sm:text-lg text-gray-500 mb-2">
                    Bienvenido, {user?.username}. Acá ves un resumen de tus solicitudes.
                </p>
                <p className="text-sm text-gray-500 mb-8">
                    Hacé clic en una tarjeta para ver el detalle por estado, o usá el botón de abajo para ir a la lista completa y crear un ticket nuevo.
                </p>

                {metrics && (
                    // ✅ Las tarjetas ahora son botones clicables (colores de KPI sin cambios)
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <button type="button" onClick={() => handleCardClick('open')} className="bg-blue-100 p-6 rounded-2xl border border-blue-200/60 shadow-sm text-center transition-transform hover:scale-[1.02] hover:shadow-md">
                            <p className="text-3xl sm:text-4xl font-bold text-blue-600">{metrics.open}</p>
                            <p className="text-md text-blue-800 mt-1">Tickets Abiertos</p>
                        </button>
                        <button type="button" onClick={() => handleCardClick('in-progress')} className="bg-yellow-100 p-6 rounded-2xl border border-yellow-200/60 shadow-sm text-center transition-transform hover:scale-[1.02] hover:shadow-md">
                            <p className="text-3xl sm:text-4xl font-bold text-yellow-600">{metrics.inProgress}</p>
                            <p className="text-md text-yellow-800 mt-1">En Progreso</p>
                        </button>
                        <button type="button" onClick={() => handleCardClick('resolved')} className="bg-green-100 p-6 rounded-2xl border border-green-200/60 shadow-sm text-center transition-transform hover:scale-[1.02] hover:shadow-md">
                            <p className="text-3xl sm:text-4xl font-bold text-green-600">{metrics.resolved}</p>
                            <p className="text-md text-green-800 mt-1">Resueltos</p>
                        </button>
                        <button type="button" onClick={() => handleCardClick('closed')} className="bg-gray-200 p-6 rounded-2xl border border-gray-300/80 shadow-sm text-center transition-transform hover:scale-[1.02] hover:shadow-md">
                            <p className="text-3xl sm:text-4xl font-bold text-gray-600">{metrics.closed}</p>
                            <p className="text-md text-gray-800 mt-1">Cerrados</p>
                        </button>
                    </div>
                )}
                
                <div className="mt-12 text-center">
                    <Link to="/client/tickets" className="bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-8 rounded-xl shadow-md transition-transform transform hover:scale-105 inline-block">
                        Ver Todos Mis Tickets
                    </Link>
                </div>
            </div>
            {/* ✅ Renderizado condicional del modal */}
            {isModalOpen && <DetailsModal title={modalContent.title} items={modalContent.items} onClose={() => setIsModalOpen(false)} loading={modalLoading} />}
        </>
    );
};

export default ClientDashboard;

