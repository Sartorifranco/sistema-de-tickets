import React, { useState, useEffect } from 'react';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { BacarKey, BacarKeyFormData, ApiResponseError } from '../../types';
import { isAxiosErrorTypeGuard } from '../../utils/typeGuards';
import { toast } from 'react-toastify';

interface BacarKeyEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialData: BacarKey | null;
    onSaveSuccess: () => void;
}

const BacarKeyEditModal: React.FC<BacarKeyEditModalProps> = ({ isOpen, onClose, initialData, onSaveSuccess }) => {
    const { token } = useAuth();
    const { addNotification } = useNotification();
    const [formData, setFormData] = useState<BacarKeyFormData>({
        device_user: '',
        username: '',
        password: '',
        notes: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    device_user: initialData.device_user,
                    username: initialData.username,
                    password: initialData.password,
                    notes: initialData.notes || '',
                });
            } else {
                setFormData({
                    device_user: '',
                    username: '',
                    password: '',
                    notes: '',
                });
            }
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (!formData.device_user.trim() || !formData.username.trim() || !formData.password.trim()) {
            toast.warn('Usuario de dispositivo, usuario y contraseña son obligatorios.');
            setLoading(false);
            return;
        }

        try {
            const dataToSave = {
                ...formData,
                notes: formData.notes || null,
            };

            if (initialData) {
                await api.put(`/api/bacar-keys/${initialData.id}`, dataToSave, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                addNotification('Clave Bacar actualizada exitosamente.', 'success');
            } else {
                await api.post('/api/bacar-keys', dataToSave, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                addNotification('Clave Bacar creada exitosamente.', 'success');
            }
            onSaveSuccess();
            onClose();
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error desconocido' : 'Error inesperado';
            addNotification(`Error al guardar clave Bacar: ${message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            {/* ✅ Se ajusta el padding para que sea menor en pantallas pequeñas */}
            <div className="bg-white p-6 sm:p-8 rounded-lg shadow-xl w-full max-w-md my-8">
                {/* ✅ Título responsivo */}
                <h2 className="text-xl sm:text-2xl font-bold mb-4 text-gray-800 border-b pb-2">
                    {initialData ? 'Editar Clave Bacar' : 'Añadir Nueva Clave Bacar'}
                </h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="deviceUser" className="block text-gray-700 text-sm font-bold mb-2">Usuario Dispositivo:</label>
                        <input
                            type="text"
                            id="deviceUser"
                            name="device_user"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.device_user}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="username" className="block text-gray-700 text-sm font-bold mb-2">Usuario:</label>
                        <input
                            type="text"
                            id="username"
                            name="username"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-gray-700 text-sm font-bold mb-2">Contraseña:</label>
                        <input
                            type="text" // Se mantiene como 'text' para poder ver la contraseña al editar
                            id="password"
                            name="password"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            disabled={loading}
                        />
                    </div>
                    <div>
                        <label htmlFor="notes" className="block text-gray-700 text-sm font-bold mb-2">Notas (Opcional):</label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.notes || ''}
                            onChange={handleChange}
                            rows={3}
                            disabled={loading}
                        ></textarea>
                    </div>
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg" disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg" disabled={loading}>
                            {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BacarKeyEditModal;