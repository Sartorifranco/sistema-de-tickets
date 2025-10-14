// src/components/Users/UserFormModal.tsx
import React, { useState, useEffect } from 'react';
import { User, Department, Company, NewUser, UpdateUser } from '../../types';

interface UserFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (userData: NewUser | UpdateUser) => Promise<void>;
    initialData: User | null;
    departments: Department[];
    companies: Company[];
}

const UserFormModal: React.FC<UserFormModalProps> = ({ isOpen, onClose, onSave, initialData, departments, companies }) => {
    // Estado inicial del formulario
    const getInitialFormData = () => ({
        firstName: '',
        lastName: '',
        email: initialData?.email || '',
        password: '',
        confirmPassword: '',
        role: initialData?.role || 'client' as 'admin' | 'agent' | 'client',
        department_id: initialData?.department_id || null as number | null,
        company_id: initialData?.company_id || null as number | null,
    });

    const [formData, setFormData] = useState(getInitialFormData);
    const [loading, setLoading] = useState(false);

    // Efecto para resetear el formulario cuando se abre o cambian los datos iniciales
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialFormData());
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: ['department_id', 'company_id'].includes(name) && value ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!initialData && formData.password !== formData.confirmPassword) {
            alert("Las contraseñas no coinciden.");
            return;
        }

        setLoading(true);
        try {
            let dataToSave: NewUser | UpdateUser;

            if (initialData) {
                // Editando un usuario existente
                const updateData: UpdateUser = {
                    email: formData.email,
                    role: formData.role,
                    department_id: formData.department_id,
                    company_id: formData.company_id,
                };
                if (formData.password) {
                    updateData.password = formData.password;
                }
                dataToSave = updateData;
            } else {
                // Creando un nuevo usuario
                const newData: NewUser = {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    password: formData.password,
                    role: formData.role,
                    department_id: formData.department_id,
                    company_id: formData.company_id,
                };
                dataToSave = newData;
            }

            await onSave(dataToSave);
            onClose();
        } catch (error) {
            console.error('Error en UserFormModal al guardar:', error);
            // La notificación de error se maneja en la página padre
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                <h2 className="text-2xl font-bold mb-4 border-b pb-2">
                    {initialData ? 'Editar Usuario' : 'Crear Nuevo Usuario'}
                </h2>
                <form onSubmit={handleSubmit}>
                    {/* Campos de Nombre y Apellido (solo para creación) */}
                    {!initialData && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div>
                                <label className="block text-gray-700 font-medium">Nombre:</label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} className="w-full p-2 border rounded mt-1" required disabled={loading} />
                            </div>
                            <div>
                                <label className="block text-gray-700 font-medium">Apellido:</label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} className="w-full p-2 border rounded mt-1" required disabled={loading} />
                            </div>
                        </div>
                    )}
                    
                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium">Email:</label>
                        <input type="email" name="email" value={formData.email} onChange={handleChange} className="w-full p-2 border rounded mt-1" required disabled={loading} />
                    </div>

                    <div className="mb-4">
                        <label className="block text-gray-700 font-medium">{initialData ? 'Nueva Contraseña (opcional)' : 'Contraseña'}:</label>
                        <input type="password" name="password" value={formData.password} onChange={handleChange} className="w-full p-2 border rounded mt-1" required={!initialData} disabled={loading} />
                    </div>

                    {!initialData && (
                         <div className="mb-4">
                            <label className="block text-gray-700 font-medium">Confirmar Contraseña:</label>
                            <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} className="w-full p-2 border rounded mt-1" required={!initialData} disabled={loading} />
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                            <label htmlFor="company" className="block text-gray-700 font-medium">Empresa:</label>
                            <select id="company" name="company_id" className="w-full p-2 border rounded mt-1" value={formData.company_id || ''} onChange={handleChange} required disabled={loading}>
                                <option value="">Seleccionar Empresa</option>
                                {companies.map(comp => (
                                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="department" className="block text-gray-700 font-medium">Departamento:</label>
                            <select id="department" name="department_id" className="w-full p-2 border rounded mt-1" value={formData.department_id || ''} onChange={handleChange} required disabled={loading}>
                                <option value="">Seleccionar Departamento</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="role" className="block text-gray-700 font-medium">Rol:</label>
                        <select id="role" name="role" className="w-full p-2 border rounded mt-1" value={formData.role} onChange={handleChange} required disabled={loading}>
                            <option value="client">Cliente</option>
                            <option value="agent">Agente</option>
                            <option value="admin">Administrador</option>
                        </select>
                    </div>

                    <div className="flex justify-end gap-4">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded" disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded" disabled={loading}>
                            {loading ? 'Guardando...' : (initialData ? 'Actualizar' : 'Crear Usuario')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UserFormModal;
