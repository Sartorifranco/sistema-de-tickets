import React, { useState, useEffect, useCallback } from 'react';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { BacarKey, ApiResponseError } from '../../types';
import { isAxiosErrorTypeGuard } from '../../utils/typeGuards';
import BacarKeyEditModal from './BacarKeyEditModal';
import { formatLocalDate } from '../../utils/dateFormatter'; // Asegúrate de tener este helper

// --- Componente interno para el Modal de Confirmación ---
interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-sm">
                <h2 className="text-xl font-bold mb-4 text-gray-800">{title}</h2>
                <p className="mb-6 text-gray-700">{message}</p>
                <div className="flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg">
                        Cancelar
                    </button>
                    <button type="button" onClick={onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg">
                        Confirmar
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- Componente Principal ---
const BacarKeys: React.FC = () => {
    const { token } = useAuth();
    const { addNotification } = useNotification();
    const [bacarKeys, setBacarKeys] = useState<BacarKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentKey, setCurrentKey] = useState<BacarKey | null>(null);
    const [isConfirmDeleteModalOpen, setIsConfirmDeleteModalOpen] = useState(false);
    const [keyToDeleteId, setKeyToDeleteId] = useState<number | null>(null);

    const fetchBacarKeys = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/bacar-keys', {
                headers: { Authorization: `Bearer ${token}` },
            });
            setBacarKeys(response.data.data || []);
        } catch (err: unknown) {
            console.error('Error fetching Bacar keys:', err);
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar las claves.' : 'Error inesperado.';
            setError(message);
            addNotification(message, 'error');
        } finally {
            setLoading(false);
        }
    }, [token, addNotification]);

    useEffect(() => {
        fetchBacarKeys();
    }, [fetchBacarKeys]);

    const openCreateModal = () => {
        setCurrentKey(null);
        setIsModalOpen(true);
    };

    const openEditModal = (key: BacarKey) => {
        setCurrentKey(key);
        setIsModalOpen(true);
    };

    const openConfirmDeleteModal = (id: number) => {
        setKeyToDeleteId(id);
        setIsConfirmDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!keyToDeleteId || !token) return;
        try {
            await api.delete(`/api/bacar-keys/${keyToDeleteId}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            addNotification('Clave Bacar eliminada exitosamente.', 'success');
            fetchBacarKeys();
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al eliminar la clave.' : 'Error inesperado.';
            addNotification(message, 'error');
        } finally {
            setIsConfirmDeleteModalOpen(false);
            setKeyToDeleteId(null);
        }
    };
    
    if (loading) return <div className="p-8 text-center">Cargando claves...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">Gestión de Claves Bacar</h1>
                <button
                    onClick={openCreateModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md self-start sm:self-center"
                >
                    Añadir Nueva Clave
                </button>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-lg shadow-lg">
                {bacarKeys.length === 0 ? (
                    <p className="text-gray-600 text-center py-8">No hay claves Bacar registradas.</p>
                ) : (
                    <>
                        {/* ✅ VISTA DE TABLA PARA ESCRITORIO */}
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
                                {bacarKeys.map((key) => (
                                    <tr key={key.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">{key.device_user}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{key.username}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{key.password}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => openEditModal(key)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                                            <button onClick={() => openConfirmDeleteModal(key.id)} className="text-red-600 hover:text-red-900">Eliminar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {/* ✅ VISTA DE TARJETAS PARA MÓVILES */}
                        <div className="md:hidden space-y-4">
                            {bacarKeys.map((key) => (
                                <div key={key.id} className="bg-gray-50 p-4 rounded-lg border">
                                    <p className="font-bold text-gray-800">{key.device_user}</p>
                                    <div className="text-sm text-gray-600 mt-2 space-y-1 border-t pt-2">
                                        <p><strong>Usuario:</strong> {key.username}</p>
                                        <p><strong>Contraseña:</strong> {key.password}</p>
                                        <p><strong>Notas:</strong> {key.notes || 'N/A'}</p>
                                        <p><strong>Creado por:</strong> {key.created_by_username || 'N/A'} el {formatLocalDate(key.created_at)}</p>
                                    </div>
                                    <div className="mt-4 pt-2 border-t flex justify-end gap-4">
                                        <button onClick={() => openEditModal(key)} className="text-indigo-600 font-semibold hover:underline">Editar</button>
                                        <button onClick={() => openConfirmDeleteModal(key.id)} className="text-red-600 font-semibold hover:underline">Eliminar</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {isModalOpen && (
                <BacarKeyEditModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSaveSuccess={fetchBacarKeys}
                    initialData={currentKey}
                />
            )}
            {isConfirmDeleteModalOpen && (
                <ConfirmModal
                    isOpen={isConfirmDeleteModalOpen}
                    onClose={() => setIsConfirmDeleteModalOpen(false)}
                    onConfirm={handleDelete}
                    title="Confirmar Eliminación"
                    message="¿Estás seguro de que quieres eliminar esta clave Bacar? Esta acción no se puede deshacer."
                />
            )}
        </div>
    );
};

export default BacarKeys;