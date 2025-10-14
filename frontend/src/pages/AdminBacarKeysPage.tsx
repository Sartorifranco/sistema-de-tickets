import React, { useState, useEffect, useCallback } from 'react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';
import { BacarKey, ApiResponseError } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import BacarKeyEditModal from '../components/BacarKeys/BacarKeyEditModal';
import { formatLocalDate } from '../utils/dateFormatter'; // Asegúrate de tener este helper

const AdminBacarKeysPage: React.FC = () => {
    const { user, token } = useAuth();
    const { addNotification } = useNotification();

    const [bacarKeys, setBacarKeys] = useState<BacarKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentBacarKey, setCurrentBacarKey] = useState<BacarKey | null>(null);

    const fetchBacarKeys = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError(null);
        try {
            // La API debería devolver { success: true, data: [...] }
            const response = await api.get('/api/bacar-keys');
            setBacarKeys(response.data.data || []);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error de red' : 'Error inesperado';
            setError(message);
            addNotification(`Error al cargar claves Bacar: ${message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [token, addNotification]);

    useEffect(() => {
        if (user && token && user.role === 'admin') {
            fetchBacarKeys();
        }
    }, [user, token, fetchBacarKeys]);

    const handleCreateBacarKey = () => {
        setCurrentBacarKey(null);
        setIsModalOpen(true);
    };

    const handleEditBacarKey = (key: BacarKey) => {
        setCurrentBacarKey(key);
        setIsModalOpen(true);
    };

    const handleDeleteBacarKey = async (keyId: number) => {
        if (!window.confirm('¿Estás seguro de que quieres eliminar esta clave?')) return;
        try {
            await api.delete(`/api/bacar-keys/${keyId}`);
            addNotification('Clave Bacar eliminada exitosamente.', 'success');
            fetchBacarKeys();
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error de red' : 'Error inesperado';
            addNotification(`Error al eliminar clave Bacar: ${message}`, 'error');
        }
    };

    const handleSaveSuccess = () => {
        fetchBacarKeys();
    };

    if (loading) return <div className="p-8 text-center">Cargando claves Bacar...</div>;
    if (error) return <div className="p-8 text-center text-red-500">Error: {error}</div>;

    return (
        <>
            <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
                <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Gestión de Claves Bacar</h1>
                    <button onClick={handleCreateBacarKey} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md self-start sm:self-center">
                        Añadir Nueva Clave
                    </button>
                </div>

                <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                    {bacarKeys.length === 0 ? (
                        <p className="text-gray-600 text-center py-8">No hay claves Bacar registradas.</p>
                    ) : (
                        <>
                            {/* VISTA DE TABLA PARA ESCRITORIO */}
                            <table className="min-w-full divide-y divide-gray-200 hidden md:table">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario Dispositivo</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Usuario</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contraseña</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {bacarKeys.map(key => (
                                        <tr key={key.id}>
                                            <td className="px-6 py-4 whitespace-nowrap">{key.device_user}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{key.username}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">{key.password}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                                <button onClick={() => handleEditBacarKey(key)} className="text-blue-600 hover:text-blue-900 mr-4 font-medium">Editar</button>
                                                <button onClick={() => handleDeleteBacarKey(key.id)} className="text-red-600 hover:text-red-900 font-medium">Eliminar</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {/* VISTA DE TARJETAS PARA MÓVILES */}
                            <div className="md:hidden space-y-4">
                                {bacarKeys.map(key => (
                                    <div key={key.id} className="bg-gray-50 p-4 rounded-lg border">
                                        <p className="font-bold text-gray-800">{key.device_user}</p>
                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                            <p><strong>Usuario:</strong> {key.username}</p>
                                            <p><strong>Contraseña:</strong> {key.password}</p>
                                            <p><strong>Notas:</strong> {key.notes || 'N/A'}</p>
                                        </div>
                                        <div className="mt-4 pt-2 border-t flex justify-end gap-4">
                                            <button onClick={() => handleEditBacarKey(key)} className="text-blue-600 font-semibold hover:underline">Editar</button>
                                            <button onClick={() => handleDeleteBacarKey(key.id)} className="text-red-600 font-semibold hover:underline">Eliminar</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <BacarKeyEditModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    initialData={currentBacarKey}
                    onSaveSuccess={handleSaveSuccess}
                />
            )}
        </>
    );
};

export default AdminBacarKeysPage;