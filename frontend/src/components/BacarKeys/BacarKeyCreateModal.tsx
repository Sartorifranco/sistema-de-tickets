// frontend/src/components/BacarKeys/BacarKeyCreateModal.tsx
import React, { useState, useCallback } from 'react';
import Modal from '../Common/Modal'; // Asegúrate de que la ruta a tu componente Modal sea correcta
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { isAxiosErrorTypeGuard, ApiResponseError } from '../../utils/typeGuards';

interface BacarKeyCreateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreateSuccess: () => void; // Callback para cuando la clave se crea exitosamente
}

const BacarKeyCreateModal: React.FC<BacarKeyCreateModalProps> = ({
    isOpen,
    onClose,
    onCreateSuccess,
}) => {
    const { token } = useAuth();
    const { addNotification } = useNotification();
    const [newDeviceUser, setNewDeviceUser] = useState<string>('');
    const [newUsername, setNewUsername] = useState<string>('');
    const [newPassword, setNewPassword] = useState<string>('');
    const [newNotes, setNewNotes] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleCreateKey = useCallback(async () => {
        setLoading(true);
        setError(null);

        if (!newDeviceUser.trim() || !newUsername.trim() || !newPassword.trim()) {
            setError('Los campos "Usuario Dispositivo", "Usuario" y "Contraseña" son obligatorios.');
            addNotification('Faltan campos obligatorios para crear la clave.', 'error');
            setLoading(false);
            return;
        }

        try {
            if (!token) {
                // No es necesario lanzar un error aquí, la notificación ya es suficiente.
                addNotification('No autorizado. Token no disponible.', 'error');
                setLoading(false);
                return;
            }

            const payload = {
                device_user: newDeviceUser,
                username: newUsername,
                password: newPassword,
                notes: newNotes.trim() === '' ? null : newNotes,
            };

            await api.post('/api/bacar-keys', payload, {
                headers: { Authorization: `Bearer ${token}` },
            });
            addNotification('Clave Bacar creada exitosamente.', 'success');
            // Limpiar campos y cerrar modal
            setNewDeviceUser('');
            setNewUsername('');
            setNewPassword('');
            setNewNotes('');
            onCreateSuccess(); // Notificar al componente padre para recargar las claves
            onClose(); // Cerrar el modal
        } catch (err: unknown) {
            if (isAxiosErrorTypeGuard(err)) {
                const apiError = err.response?.data as ApiResponseError;
                setError(apiError?.message || 'Error al crear clave Bacar.');
                addNotification(`Error al crear clave: ${apiError?.message || 'Error desconocido'}`, 'error');
            } else {
                setError('Ocurrió un error inesperado al crear la clave Bacar.');
                addNotification('Ocurrió un error inesperado al crear la clave Bacar.', 'error');
            }
            console.error('Error creating Bacar key:', err);
        } finally {
            setLoading(false);
        }
    }, [token, newDeviceUser, newUsername, newPassword, newNotes, addNotification, onCreateSuccess, onClose]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Crear Nueva Clave Bacar">
            <div className="p-4">
                {error && <p className="text-red-600 bg-red-100 p-3 rounded-md text-center mb-4">{error}</p>} {/* Aplicadas clases Tailwind */}
                <form onSubmit={(e) => { e.preventDefault(); handleCreateKey(); }}>
                    <div className="grid grid-cols-1 gap-4 mb-4">
                        <div className="mb-4"> {/* Reemplazado form-group */}
                            <label htmlFor="deviceUser" className="block text-gray-700 text-sm font-bold mb-2">Usuario Dispositivo:</label> {/* Reemplazado form-label */}
                            <input
                                type="text"
                                id="deviceUser"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" // Reemplazado form-input
                                value={newDeviceUser}
                                onChange={(e) => setNewDeviceUser(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="mb-4"> {/* Reemplazado form-group */}
                            <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Usuario (Login):</label> {/* Reemplazado form-label */}
                            <input
                                type="text"
                                id="username"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" // Reemplazado form-input
                                value={newUsername}
                                onChange={(e) => setNewUsername(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="mb-4"> {/* Reemplazado form-group */}
                            <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Contraseña:</label> {/* Reemplazado form-label */}
                            <input
                                type="password"
                                id="password"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" // Reemplazado form-input
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>
                        <div className="mb-4"> {/* Reemplazado form-group */}
                            <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">Notas (Opcional):</label> {/* Reemplazado form-label */}
                            <input
                                type="text"
                                id="notes"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" // Reemplazado form-input
                                value={newNotes}
                                onChange={(e) => setNewNotes(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>
                    <div className="flex justify-end gap-2 mt-6">
                        <button
                            type="submit"
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md transition-colors duration-200" // Reemplazado button primary-button
                            disabled={loading}
                        >
                            {loading ? 'Generando...' : 'Generar Clave'}
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-md transition-colors duration-200" // Reemplazado button secondary-button
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                    </div>
                </form>
            </div>
        </Modal>
    );
};

export default BacarKeyCreateModal;
