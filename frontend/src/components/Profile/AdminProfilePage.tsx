import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import api from '../../config/axiosConfig';
import { ActivityLog } from '../../types';
import { formatLocalDate } from '../../utils/dateFormatter';
import { clCard } from '../../utils/cleanLightUi';

// Interfaz para los datos que esperamos del dashboard de admin
interface AdminDashboardMetrics {
    totalTickets: number;
    openTickets: number;
    totalUsers: number;
    recentActivity: ActivityLog[];
}

const AdminProfilePage: React.FC = () => {
    const { user } = useAuth();
    const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAdminData = useCallback(async () => {
        try {
            // ✅ --- CORRECCIÓN CLAVE ---
            // La ruta correcta para las métricas del admin es '/api/dashboard/admin'
            const metricsRes = await api.get('/api/dashboard/admin');
            setMetrics(metricsRes.data.data);
        } catch (error) {
            console.error("Error al cargar datos del dashboard:", error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role === 'admin') {
            fetchAdminData();
        }
    }, [user, fetchAdminData]);

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
            <div>
                {/* ✅ Títulos responsivos */}
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">Perfil de Administrador</h1>
                <p className="text-md sm:text-lg text-gray-500">Bienvenido de nuevo, {user?.username}.</p>
            </div>

            <div className={`${clCard} p-6`}>
                <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-4 border-b border-gray-100 pb-2">Información de la Cuenta</h2>
                {/* La grilla ya era responsiva, se mantiene */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-600">
                    <p><strong>Nombre de Usuario:</strong> {user?.username}</p>
                    <p><strong>Email:</strong> {user?.email}</p>
                    <p><strong>Rol:</strong> <span className="font-semibold text-indigo-600 capitalize">{user?.role}</span></p>
                </div>
            </div>

            {loading ? (
                <div className="text-center p-8">Cargando métricas...</div>
            ) : metrics && (
                <div className={`${clCard} p-6`}>
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-800 mb-6 border-b border-gray-100 pb-2">Visión General del Sistema</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center mb-8">
                        <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200/80 shadow-sm">
                            <p className="text-3xl sm:text-4xl font-bold text-blue-600">{metrics.totalTickets}</p>
                            <p className="text-md text-blue-800 mt-1">Tickets Totales</p>
                        </div>
                        <div className="bg-green-50 p-6 rounded-2xl border border-green-200/80 shadow-sm">
                            <p className="text-3xl sm:text-4xl font-bold text-green-600">{metrics.openTickets}</p>
                            <p className="text-md text-green-800 mt-1">Tickets Abiertos</p>
                        </div>
                        <div className="bg-purple-50 p-6 rounded-2xl border border-purple-200/80 shadow-sm">
                            <p className="text-3xl sm:text-4xl font-bold text-purple-600">{metrics.totalUsers}</p>
                            <p className="text-md text-purple-800 mt-1">Usuarios Totales</p>
                        </div>
                    </div>
                    
                    <h3 className="text-lg sm:text-xl font-semibold text-gray-800 mb-4">Actividad Reciente</h3>
                    <ul className="divide-y divide-gray-100">
                        {metrics.recentActivity.slice(0, 5).map(log => (
                            <li key={log.id} className="py-3 flex flex-col sm:flex-row justify-between items-start">
                                <div>
                                    <p className="text-sm text-gray-800">{log.description}</p>
                                    <p className="text-xs text-gray-500 mt-1">Por: {log.username || 'Sistema'}</p>
                                </div>
                                <p className="text-xs text-gray-500 mt-1 sm:mt-0 flex-shrink-0">{formatLocalDate(log.created_at)}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AdminProfilePage;