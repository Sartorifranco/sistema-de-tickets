import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    
    // Estados de IA
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [categories, setCategories] = useState<TicketCategory[]>([]);
    const [predefinedProblems, setPredefinedProblems] = useState<PredefinedProblem[]>([]);
    const [isOther, setIsOther] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    const targetCompanyId = useMemo(() => {
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
                    if (currentUserRole === 'client') {
                        locationsUrl = '/api/locations'; 
                    } else { 
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
            setIsAnalyzing(false);
        }
    }, [isOpen, targetCompanyId, currentUserRole]);
    
    useEffect(() => {
        if (formData.category_id && !isCustomCategory) {
            const fetchProblems = async () => {
                try {
                    const res = await api.get(`/api/problems/predefined/${formData.category_id}`);
                    const dbProblems = res.data.data || [];

                    // --- MODIFICACIÓN: INYECTAR OPCIÓN "OTRO..." ---
                    // Agregamos manualmente la opción al final de la lista
                    const otherOption = {
                        id: -999, // ID negativo para no chocar con la base de datos
                        title: 'Otro...',
                        description: '', // Descripción vacía para que escriban
                        department_id: undefined // Sin departamento fijo, para forzar elección manual si es necesario
                    };
                    
                    // Unimos los problemas de la DB con nuestra opción manual
                    setPredefinedProblems([...dbProblems, otherOption] as PredefinedProblem[]);
                    // -----------------------------------------------

                } catch (error) { toast.error("No se pudieron cargar los problemas específicos."); }
            };
            fetchProblems();
        } else {
            setPredefinedProblems([]);
        }
    }, [formData.category_id, isCustomCategory]);

    // --- LÓGICA DE IA: DETECCIÓN AUTOMÁTICA ---
    useEffect(() => {
        // Solo analizamos si hay descripción, si no está editando un problema predefinido y si el modal está abierto
        if (!isOpen || !formData.description || formData.description.length < 10 || formData.predefined_problem_id) return;

        // Limpiar timeout anterior (debounce)
        if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);

        // Esperar 1.2 segundos después de que deje de escribir para analizar
        analysisTimeoutRef.current = setTimeout(async () => {
            setIsAnalyzing(true);
            try {
                const res = await api.post('/api/ai/predict', { text: formData.description });
                const { suggestedCategory, suggestedPriority } = res.data.data;

                // 1. Mapear Prioridad
                const priorityMap: Record<string, string> = {
                    'Crítica': 'urgent',
                    'Alta': 'high',
                    'Media': 'medium',
                    'Baja': 'low'
                };
                
                if (suggestedPriority && priorityMap[suggestedPriority]) {
                    setFormData(prev => ({ ...prev, priority: priorityMap[suggestedPriority] as any }));
                }

                // 2. Mapear Categoría (Buscamos la categoría por nombre)
                if (suggestedCategory) {
                    // Buscamos una categoría que contenga la palabra clave (ej: "Hardware" dentro de "Soporte Hardware")
                    const foundCat = categories.find(c => 
                        c.name.toLowerCase().includes(suggestedCategory.toLowerCase())
                    );

                    if (foundCat) {
                        setFormData(prev => {
                            const newData = { ...prev };

                            // Solo cambiamos la categoría si no ha seleccionado una manualmente todavía
                            if (!prev.category_id) {
                                // Verificar si es categoría especial para activar flags
                                const isSpecial = foundCat.name.includes('Area de Implementaciones') || foundCat.name.includes('Area de Mantenimiento');
                                setIsCustomCategory(!!isSpecial);
                                newData.category_id = foundCat.id;
                            }

                            // --- NUEVO: Autocompletar Título automáticamente ---
                            if (!prev.title) {
                                newData.title = formData.description!.length > 50 
                                    ? formData.description!.substring(0, 50) + '...' 
                                    : formData.description;
                            }
                            return newData;
                        });
                    }
                }

            } catch (error) {
                console.error("Error IA:", error);
            } finally {
                setIsAnalyzing(false);
            }
        }, 1200); 

        return () => {
            if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        };
    }, [formData.description, categories, isOpen]);

    
    const filteredDepartments = useMemo(() => {
        if (!departments || !loggedInUser) return [];
        let targetUserForFiltering;
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
                // Detectar si es "Otro..." (nuestro ID negativo o por título)
                const isOptionOther = problem.title === 'Otro...' || problem.id === -999;

                setFormData(prev => ({ 
                    ...prev, 
                    predefined_problem_id: numValue || undefined,
                    // Si es "Otro...", habilitamos edición de título. Si no, ponemos el título fijo.
                    title: isOptionOther ? '' : problem.title, 
                    // Si es "Otro...", limpiamos la descripción para que escriba.
                    description: isOptionOther ? '' : `${problem.description}\n\n--- (Por favor, añada más detalles aquí si es necesario) ---\n`,
                    // Si es "Otro...", el departamento queda undefined para que el usuario elija.
                    department_id: problem.department_id 
                }));
                setIsOther(isOptionOther);
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
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-2xl font-bold">Crear Nuevo Ticket</h2>
                    {isAnalyzing && (
                        <span className="text-sm font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            🤖 IA Analizando...
                        </span>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    
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

                    {/* --- DESCRIPCIÓN PRIMERO --- */}
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-gray-700 font-bold mb-1">
                            ¿Qué está sucediendo? <span className="text-xs font-normal text-gray-500">(La IA completará los detalles por ti)</span>
                        </label>
                        <textarea 
                            name="description" 
                            value={formData.description || ''} 
                            onChange={handleChange} 
                            placeholder="Ej: La impresora no enciende y sale humo..." 
                            rows={4} 
                            className="w-full p-2 border rounded mt-1 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none transition-all" 
                            required 
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-medium">Categoría del Problema:</label>
                            <select 
                                name="category_id" 
                                value={formData.category_id || ''} 
                                onChange={handleChange} 
                                className={`w-full p-2 border rounded mt-1 transition-all ${isAnalyzing ? 'opacity-50' : 'opacity-100'} ${formData.category_id && !isAnalyzing ? 'bg-blue-50 border-blue-300' : ''}`}
                                required
                            >
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
                    </div>

                    <input 
                        type="text" 
                        name="title" 
                        value={formData.title || ''} 
                        onChange={handleChange} 
                        placeholder="Título del ticket" 
                        className="w-full p-2 border rounded mt-1" 
                        required 
                        // Habilitar título si es "Otro...", o si no hay problema predefinido seleccionado
                        disabled={!isOther && !isCustomCategory && !!formData.predefined_problem_id} 
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-medium">Prioridad:</label>
                            <select 
                                name="priority" 
                                value={formData.priority || 'medium'} 
                                onChange={handleChange} 
                                className={`w-full p-2 border rounded mt-1 transition-all ${formData.priority === 'urgent' || formData.priority === 'high' ? 'text-red-600 font-bold bg-red-50' : ''}`}
                                required
                            >
                                <option value="low">Baja</option>
                                <option value="medium">Media</option>
                                <option value="high">Alta</option>
                                <option value="urgent">Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium">Departamento:</label>
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