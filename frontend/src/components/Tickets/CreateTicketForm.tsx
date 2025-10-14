import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';

// ✅ CORRECCIÓN DE RUTA:
// Se ha ajustado la ruta de importación para que refleje correctamente la
// estructura de carpetas (desde 'src/components/tickets/' hasta 'src/config/').
// Este era el origen del error de compilación.
import api from '../../config/axiosConfig';
import { Department, TicketCategory } from '../../types';

interface CreateTicketFormProps {
    onTicketCreated: () => void;
    onClose: () => void;
}

const CreateTicketForm: React.FC<CreateTicketFormProps> = ({ onTicketCreated, onClose }) => {
    const [formData, setFormData] = useState({
        title: '',
        description: `Puedo entrar a la computadora, pero al intentar abrir una carpeta o documento importante, me dice "Acceso denegado" o "No tiene permiso".

--- (Por favor, añada más detalles aquí si es necesario) ---
`,
        priority: 'medium',
        departmentId: '',
        categoryId: '',
    });

    const [departments, setDepartments] = useState<Department[]>([]);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingInitialData, setLoadingInitialData] = useState(true);

    useEffect(() => {
        const fetchInitialData = async () => {
            setLoadingInitialData(true);
            try {
                const [deptsRes, catsRes] = await Promise.all([
                    api.get('/api/tickets/departments'),
                    api.get('/api/tickets/categories')
                ]);

                const depts = deptsRes.data.data || [];
                const cats = catsRes.data.data || [];
                
                setDepartments(depts);
                setCategories(cats);

                setFormData(prev => ({
                    ...prev,
                    departmentId: prev.departmentId || (depts.length > 0 ? String(depts[0].id) : ''),
                    categoryId: prev.categoryId || (cats.length > 0 ? String(cats[0].id) : ''),
                }));
            } catch (err: any) {
                toast.error('Error al cargar datos iniciales.');
                console.error('Error al obtener departamentos/categorías:', err.response?.data || err.message);
            } finally {
                setLoadingInitialData(false);
            }
        };
        fetchInitialData();
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!formData.title.trim() || !formData.description.trim() || !formData.departmentId || !formData.categoryId) {
            toast.warn('Por favor, completa todos los campos requeridos.');
            return;
        }

        setLoading(true);

        const ticketPayload = {
            title: formData.title.trim(),
            description: formData.description.trim(),
            priority: formData.priority,
            department_id: formData.departmentId,
            category_id: formData.categoryId,
        };

        const data = new FormData();
        for (const [key, value] of Object.entries(ticketPayload)) {
            data.append(key, value);
        }
        
        attachments.forEach(file => {
            data.append('attachments', file);
        });
        
        console.log("Payload a enviar al backend:", Object.fromEntries(data.entries()));

        try {
            await api.post('/api/tickets', data, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            toast.success('¡Ticket creado exitosamente!');
            onTicketCreated();
            onClose();
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Error desconocido al crear el ticket.';
            toast.error(errorMessage);
            console.error('Detalle del error al crear ticket:', err.response?.data || err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-lg shadow-xl max-w-2xl w-full mx-auto">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-6 text-center">Crear Nuevo Ticket</h2>
            <div className="space-y-4">
                {/* Asunto */}
                <div>
                    <label htmlFor="title" className="block text-gray-700 text-sm font-bold mb-2">Asunto:</label>
                    <input type="text" id="title" name="title" className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={formData.title} onChange={handleInputChange} required disabled={loading} />
                </div>
                {/* Descripción */}
                <div>
                    <label htmlFor="description" className="block text-gray-700 text-sm font-bold mb-2">Descripción:</label>
                    <textarea id="description" name="description" className="shadow appearance-none border rounded-md w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-red-500 h-32 resize-y"
                        value={formData.description} onChange={handleInputChange} required disabled={loading} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Prioridad */}
                    <div>
                        <label htmlFor="priority" className="block text-gray-700 text-sm font-bold mb-2">Prioridad:</label>
                        <select id="priority" name="priority" className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.priority} onChange={handleInputChange} disabled={loading}>
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent">Urgente</option>
                        </select>
                    </div>
                    {/* Departamento */}
                    <div>
                        <label htmlFor="departmentId" className="block text-gray-700 text-sm font-bold mb-2">Departamento:</label>
                        <select id="departmentId" name="departmentId" className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                            value={formData.departmentId} onChange={handleInputChange} required disabled={loading || loadingInitialData}>
                            {loadingInitialData ? <option>Cargando...</option> : (
                                <>
                                    <option value="">Selecciona un departamento</option>
                                    {departments.map(dep => (<option key={dep.id} value={dep.id}>{dep.name}</option>))}
                                </>
                            )}
                        </select>
                    </div>
                </div>
                {/* Categoría */}
                <div>
                    <label htmlFor="categoryId" className="block text-gray-700 text-sm font-bold mb-2">Categoría:</label>
                    <select id="categoryId" name="categoryId" className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-3 pr-8 rounded-md leading-tight focus:outline-none focus:ring-2 focus:ring-red-500"
                        value={formData.categoryId} onChange={handleInputChange} required disabled={loading || loadingInitialData}>
                        {loadingInitialData ? <option>Cargando...</option> : (
                            <>
                                <option value="">Selecciona una categoría</option>
                                {categories.map(cat => (<option key={cat.id} value={cat.id}>{cat.name}</option>))}
                            </>
                        )}
                    </select>
                </div>
                {/* Adjuntos */}
                <div>
                    <label className="block text-gray-700 text-sm font-bold mb-2">Adjuntar Archivos:</label>
                    <input type="file" multiple onChange={(e) => setAttachments(Array.from(e.target.files || []))} className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-red-50 file:text-red-700 hover:file:bg-red-100" disabled={loading} />
                </div>
            </div>
            {/* Botones */}
            <div className="flex justify-end gap-4 mt-8 pt-4 border-t">
                <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg" disabled={loading}>Cancelar</button>
                <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg disabled:bg-gray-400" disabled={loading || loadingInitialData}>{loading ? 'Creando...' : 'Crear Ticket'}</button>
            </div>
        </form>
    );
};

export default CreateTicketForm;

