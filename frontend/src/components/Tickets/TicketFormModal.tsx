import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { Department, User, TicketData, UserRole, TicketCategory, PredefinedProblem } from '../../types';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';

interface Location {
    id: number;
    name: string;
    type: string;
}

type FormDataType = Partial<TicketData> & { predefined_problem_id?: number | string };

interface TicketFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<TicketData>, attachments: File[]) => Promise<void>;
    initialData: TicketData | null;
    departments: Department[];
    users: User[];
    currentUserRole: UserRole;
}

const TicketFormModal: React.FC<TicketFormModalProps> = ({ isOpen, onClose, onSave, departments, users, currentUserRole }) => {
    const { user: loggedInUser } = useAuth();
    
    const initialFormData: FormDataType = {
        title: '',
        description: '',
        priority: 'medium',
        department_id: undefined,
        category_id: undefined,
        user_id: undefined,
        location_id: undefined,
        predefined_problem_id: undefined,
    };

    const [formData, setFormData] = useState<FormDataType>(initialFormData);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [predefinedProblems, setPredefinedProblems] = useState<PredefinedProblem[]>([]);
    const [isOther, setIsOther] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    

    const targetCompanyId = useMemo(() => {
        // ✅ CORRECCIÓN: Se incluye 'agent' en la lógica para determinar el companyId
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && formData.user_id) {
            return users.find(u => u.id === formData.user_id)?.company_id;
        }
        return loggedInUser?.company_id;
    }, [currentUserRole, formData.user_id, users, loggedInUser]);

    useEffect(() => {
        if (isOpen && targetCompanyId) {
            const fetchModalData = async () => {
                try {
                    let locationsUrl;
                    // ✅ CORRECCIÓN: Se incluye 'agent' en la lógica para obtener las ubicaciones
                    if (currentUserRole === 'client') {
                        locationsUrl = '/api/locations'; 
                    } else { // admin o agent
                        locationsUrl = `/api/locations/${targetCompanyId}`;
                    }

                    const [catRes, locRes] = await Promise.all([
                        api.get(`/api/problems/categories/${targetCompanyId}`),
                        api.get(locationsUrl)
                    ]);
                    setCategories(catRes.data.data || []);
                    setLocations(locRes.data.data || []);
                } catch (error) {
                    toast.error("No se pudieron cargar los datos para el formulario.");
                }
            };
            fetchModalData();
        }
        if (!isOpen) {
            setFormData(initialFormData);
            setLocations([]);
            setCategories([]);
            setPredefinedProblems([]);
            setIsCustomCategory(false);
            setIsOther(false);
        }
    }, [isOpen, targetCompanyId, currentUserRole]);
    
    useEffect(() => {
        if (formData.category_id && !isCustomCategory) {
            const fetchProblems = async () => {
                try {
                    const res = await api.get(`/api/problems/predefined/${formData.category_id}`);
                    setPredefinedProblems(res.data.data || []);
                } catch (error) { toast.error("No se pudieron cargar los problemas específicos."); }
            };
            fetchProblems();
        } else {
            setPredefinedProblems([]);
        }
    }, [formData.category_id, isCustomCategory]);
    
    const filteredDepartments = useMemo(() => {
        if (!departments || !loggedInUser) return [];
        let targetUserForFiltering;
        // ✅ CORRECCIÓN: Se incluye 'agent' en la lógica de filtrado
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && formData.user_id) {
            targetUserForFiltering = users.find(u => u.id === formData.user_id);
        } else {
            targetUserForFiltering = loggedInUser;
        }
        const bacarDepartments = ['Mantenimiento', 'Implementaciones', 'SOPORTE - IT'];
        if (targetUserForFiltering?.company_id === 1) {
            return departments.filter(d => bacarDepartments.includes(d.name));
        }
        return departments.filter(d => d.name === 'SOPORTE - IT');
    }, [departments, loggedInUser, formData.user_id, users, currentUserRole]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numValue = parseInt(value, 10);
        
        if (name === 'user_id') {
            setFormData({ ...initialFormData, user_id: numValue || undefined });
            setIsCustomCategory(false);
            setIsOther(false);
            return;
        }
        
        if (name === 'category_id') {
            const selectedCategory = categories.find(c => c.id === numValue);
            const isSpecial = selectedCategory && (selectedCategory.name.includes('Area de Implementaciones') || selectedCategory.name.includes('Area de Mantenimiento'));
            setIsCustomCategory(!!isSpecial);
            setFormData(prev => ({ ...prev, category_id: numValue || undefined, title: '', description: '', predefined_problem_id: undefined }));
            setIsOther(false);
            return;
        }

        if (name === 'predefined_problem') {
            const problem = predefinedProblems.find(p => p.id === numValue) as (PredefinedProblem & { department_id?: number }) | undefined;
            if (problem) {
                setFormData(prev => ({ 
                    ...prev, 
                    predefined_problem_id: numValue || undefined,
                    title: problem.title, 
                    description: problem.title === 'Otro...' ? '' : `${problem.description}\n\n--- (Por favor, añada más detalles aquí si es necesario) ---\n`,
                    department_id: problem.department_id 
                }));
                setIsOther(problem.title === 'Otro...');
            } else {
                setFormData(prev => ({...prev, predefined_problem_id: undefined}));
            }
            return; 
        }
        
        const newValue = name.endsWith('_id') ? numValue || undefined : value;
        setFormData(prev => ({ ...prev, [name]: newValue }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setAttachments(Array.from(e.target.files));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // ✅ CORRECCIÓN: Se incluye 'agent' en la validación
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && !formData.user_id) {
            toast.warn("Por favor, selecciona el cliente para quien es este ticket.");
            return;
        }
        const requiredFields = [formData.title, formData.description, formData.department_id, formData.category_id];
        if (locations.length > 0) {
            requiredFields.push(formData.location_id);
        }
        if (requiredFields.some(field => !field)) {
            toast.warn("Por favor, complete todos los campos requeridos.");
            return;
        }
        setLoading(true);
        await onSave(formData, attachments);
        setLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <h2 className="text-2xl font-bold mb-4 border-b pb-2">Crear Nuevo Ticket</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* ✅ CORRECCIÓN: Se muestra el selector de clientes para 'admin' y 'agent' */}
                    {(currentUserRole === 'admin' || currentUserRole === 'agent') && (
                        <div>
                            <label className="block text-gray-700 font-medium">Crear Ticket para (Cliente):</label>
                            <select name="user_id" value={formData.user_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                                <option value="">-- Seleccione un usuario --</option>
                                {users.filter(u => u.role === 'client').map(client => (
                                    <option key={client.id} value={client.id}>{client.username}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {locations.length > 0 && (
                        <div>
                            <label className="block text-gray-700 font-medium">{locations[0]?.type || 'Ubicación'}:</label>
                            <select name="location_id" value={formData.location_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                                <option value="">-- Seleccione su {locations[0]?.type.toLowerCase() || 'ubicación'} --</option>
                                {locations.map(loc => (<option key={loc.id} value={loc.id}>{loc.name}</option>))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="block text-gray-700 font-medium">Categoría del Problema:</label>
                        <select name="category_id" value={formData.category_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                            <option value="">-- Seleccione una categoría --</option>
                            {categories.map(cat => {
                                const isSpecial = cat.name.includes('Area de');
                                return (
                                    <option key={cat.id} value={cat.id} className={isSpecial ? 'font-bold bg-gray-100' : ''}>
                                        {isSpecial ? `--- ${cat.name.toUpperCase()} ---` : cat.name}
                                    </option>
                                );
                            })}
                        </select>
                    </div>
                    
                    {!isCustomCategory && formData.category_id && (
                        <div>
                            <label className="block text-gray-700 font-medium">Problema Específico:</label>
                            <select 
                                name="predefined_problem" 
                                value={formData.predefined_problem_id || ''}
                                onChange={handleChange} 
                                className="w-full p-2 border rounded mt-1" 
                                required={!isCustomCategory}
                            >
                                <option value="">-- Seleccione un problema --</option>
                                {predefinedProblems.map(prob => <option key={prob.id} value={prob.id}>{prob.title}</option>)}
                            </select>
                        </div>
                    )}

                    <input 
                        type="text" 
                        name="title" 
                        value={formData.title || ''} 
                        onChange={handleChange} 
                        placeholder="Título del ticket" 
                        className="w-full p-2 border rounded mt-1" 
                        required 
                        disabled={!isOther && !isCustomCategory} 
                    />
                    <textarea 
                        name="description" 
                        value={formData.description || ''} 
                        onChange={handleChange} 
                        placeholder="Descripción del problema" 
                        rows={5} 
                        className="w-full p-2 border rounded mt-1" 
                        required 
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-medium">Prioridad:</label>
                            <select name="priority" value={formData.priority || 'medium'} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium">Departamento (a quien se dirige):</label>
                            <select name="department_id" value={formData.department_id || ''} onChange={handleChange} className="w-full p-2 border rounded mt-1" required>
                                <option value="">Seleccione un departamento</option>
                                {filteredDepartments.map(dept => <option key={dept.id} value={dept.id}>{dept.name}</option>)}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium">Adjuntar Archivos:</label>
                        <input type="file" multiple onChange={handleFileChange} className="w-full text-sm mt-1" />
                    </div>
                    
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" disabled={loading}>
                            {loading ? 'Guardando...' : 'Guardar Ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TicketFormModal;

