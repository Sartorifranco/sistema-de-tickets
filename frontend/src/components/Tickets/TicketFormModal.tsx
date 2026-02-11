import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { Department, User, TicketData, UserRole } from '../../types';

// --- INTERFACES LOCALES ---
interface Location {
    id: number;
    alias: string;        // ✅ CORREGIDO: Mapeado a 'alias' de la DB
    serial_number?: string;
    name?: string;        // Fallback
    type?: string;
}

interface DepositarioOption {
    id: number;
    alias: string;
    serial_number: string;
}

interface PredefinedProblemLocal {
    id: number;
    title: string;
    description: string;
    department_id?: number;
}

interface TicketCategoryLocal {
    id: number;
    name: string;
}

type FormDataType = Partial<TicketData> & { predefined_problem_id?: number | string, depositario_id?: number | string };

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
        depositario_id: undefined, 
        predefined_problem_id: undefined,
    };

    const [formData, setFormData] = useState<FormDataType>(initialFormData);
    const [attachments, setAttachments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Estados de IA
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Estados de datos
    const [categories, setCategories] = useState<TicketCategoryLocal[]>([]);
    const [predefinedProblems, setPredefinedProblems] = useState<PredefinedProblemLocal[]>([]);
    const [isOther, setIsOther] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [depositarios, setDepositarios] = useState<DepositarioOption[]>([]); 
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    // --- ESTILO NUCLEAR (A prueba de fallos visuales) ---
    const hardStyle = {
        backgroundColor: '#ffffff',
        color: '#000000',
        borderColor: '#d1d5db'
    };

    const targetCompanyId = useMemo(() => {
        // Lógica para Admin/Agente
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && formData.user_id) {
            return users.find(u => u.id === formData.user_id)?.company_id;
        }
        // Lógica para Cliente (con fallback seguro)
        return loggedInUser?.company_id || '0'; 
    }, [currentUserRole, formData.user_id, users, loggedInUser]);

    // 1. CARGA INICIAL DE DATOS
    useEffect(() => {
        if (isOpen) {
            const fetchModalData = async () => {
                try {
                    // Determinar URL de ubicaciones
                    // Si es cliente, usamos la ruta general, si es admin, la específica por ID
                    let locationsUrl;
                    if (currentUserRole === 'client') {
                        locationsUrl = '/api/locations/0'; // El backend ahora maneja esto leyendo el usuario del token o validando
                        // Nota: Para clientes, lo ideal es que el backend saque el ID del token, 
                        // pero aquí pasamos el targetCompanyId calculado.
                        if(targetCompanyId && targetCompanyId !== '0') {
                             locationsUrl = `/api/locations/${targetCompanyId}`;
                        }
                    } else { 
                        locationsUrl = `/api/locations/${targetCompanyId}`;
                    }

                    // Definimos ID seguro para categorías (evita enviar 'undefined')
                    const safeCompanyId = targetCompanyId || '0';

                    const [catRes, locRes, depRes] = await Promise.all([
                        api.get(`/api/problems/categories/${safeCompanyId}`),
                        api.get(locationsUrl),
                        api.get(`/api/depositarios?companyId=${safeCompanyId}`)
                    ]);

                    setCategories(catRes.data.data || []);
                    setLocations(locRes.data.data || []);
                    setDepositarios(depRes.data.data || []); 
                } catch (error) {
                    console.error("Error cargando datos iniciales:", error);
                }
            };
            fetchModalData();
        }
        if (!isOpen) {
            // Reset al cerrar
            setFormData(initialFormData);
            setLocations([]);
            setDepositarios([]);
            setCategories([]);
            setPredefinedProblems([]);
            setIsCustomCategory(false);
            setIsOther(false);
            setIsAnalyzing(false);
        }
    }, [isOpen, targetCompanyId, currentUserRole]);
    
    // 2. CARGA DINÁMICA DE PROBLEMAS ESPECÍFICOS
    useEffect(() => {
        const otherOption: PredefinedProblemLocal = { id: -999, title: 'Otro...', description: '', department_id: undefined };

        if (formData.category_id && !isCustomCategory) {
            const fetchProblems = async () => {
                try {
                    const res = await api.get(`/api/problems/predefined/${formData.category_id}`);
                    const dbProblems = res.data.data || [];
                    setPredefinedProblems([...dbProblems, otherOption]);
                } catch (error) { 
                    console.error("Error cargando problemas:", error);
                    setPredefinedProblems([otherOption]); 
                }
            };
            fetchProblems();
        } else {
            setPredefinedProblems([]);
        }
    }, [formData.category_id, isCustomCategory]);

    // 3. IA PREDICTIVA
    useEffect(() => {
        if (!isOpen || !formData.description || formData.description.length < 10 || formData.predefined_problem_id) return;
        if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = setTimeout(async () => {
            setIsAnalyzing(true);
            try {
                const res = await api.post('/api/ai/predict', { text: formData.description });
                const { suggestedCategory, suggestedPriority } = res.data.data;
                const priorityMap: Record<string, string> = { 'Crítica': 'urgent', 'Alta': 'high', 'Media': 'medium', 'Baja': 'low' };
                
                if (suggestedPriority && priorityMap[suggestedPriority]) {
                    setFormData(prev => ({ ...prev, priority: priorityMap[suggestedPriority] as any }));
                }
                if (suggestedCategory) {
                    const foundCat = categories.find(c => c.name.toLowerCase().includes(suggestedCategory.toLowerCase()));
                    if (foundCat) {
                        setFormData(prev => {
                            const newData = { ...prev };
                            if (!prev.category_id) {
                                const isSpecial = foundCat.name.includes('Area de Implementaciones') || foundCat.name.includes('Area de Mantenimiento');
                                setIsCustomCategory(!!isSpecial);
                                newData.category_id = foundCat.id;
                            }
                            if (!prev.title) {
                                newData.title = formData.description!.length > 50 ? formData.description!.substring(0, 50) + '...' : formData.description;
                            }
                            return newData;
                        });
                    }
                }
            } catch (error) { console.error("Error IA:", error); } finally { setIsAnalyzing(false); }
        }, 1200); 
        return () => { if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current); };
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
            const problem = predefinedProblems.find(p => p.id === numValue);
            if (problem) {
                const isOptionOther = problem.title === 'Otro...' || problem.id === -999;
                setFormData(prev => ({ 
                    ...prev, 
                    predefined_problem_id: numValue || undefined,
                    title: isOptionOther ? '' : problem.title, 
                    description: isOptionOther ? '' : `${problem.description}\n\n--- (Por favor, añada más detalles aquí si es necesario) ---\n`,
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
                    <h2 className="text-2xl font-bold text-gray-800">Crear Nuevo Ticket</h2>
                    {isAnalyzing && (
                        <span className="text-sm font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1 rounded-full border border-blue-200">🤖 IA Analizando...</span>
                    )}
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                    
                    {/* CLIENTE (SOLO ADMIN/AGENT) */}
                    {(currentUserRole === 'admin' || currentUserRole === 'agent') && (
                        <div>
                            <label className="block text-gray-700 font-medium">Crear Ticket para (Cliente):</label>
                            <select 
                                name="user_id" 
                                value={formData.user_id || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 border rounded mt-1" 
                                style={hardStyle}
                                required
                            >
                                <option value="" style={hardStyle}>-- Seleccione un usuario --</option>
                                {users.filter(u => u.role === 'client').map(client => (
                                    <option key={client.id} value={client.id} style={hardStyle}>{client.username}</option>
                                ))}
                            </select>
                        </div>
                    )}
                    
                    {/* UBICACIONES Y DEPOSITARIOS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {locations.length > 0 && (
                            <div>
                                <label className="block text-gray-700 font-medium">{locations[0]?.type || 'Ubicación'}:</label>
                                <select 
                                    name="location_id" 
                                    value={formData.location_id || ''} 
                                    onChange={handleChange} 
                                    className="w-full p-2 border rounded mt-1" 
                                    style={hardStyle}
                                    required
                                >
                                    <option value="" style={hardStyle}>-- Seleccione ubicación --</option>
                                    {/* ✅ CORRECCIÓN CLAVE: Usamos loc.alias en lugar de loc.name */}
                                    {locations.map(loc => (
                                        <option key={loc.id} value={loc.id} style={hardStyle}>
                                            {loc.alias || loc.name} {loc.serial_number ? `(S/N: ${loc.serial_number})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {depositarios.length > 0 && (
                            <div>
                                <label className="block text-gray-700 font-medium flex items-center gap-2">
                                    <span>📠 Equipo Afectado:</span>
                                    <span className="text-xs text-gray-400 font-normal">(Opcional)</span>
                                </label>
                                <select 
                                    name="depositario_id" 
                                    value={formData.depositario_id || ''} 
                                    onChange={handleChange} 
                                    className="w-full p-2 border rounded mt-1"
                                    style={hardStyle}
                                >
                                    <option value="" style={hardStyle}>-- Ninguno / No aplica --</option>
                                    {depositarios.map(dep => (
                                        <option key={dep.id} value={dep.id} style={hardStyle}>
                                            {dep.alias} (S/N: {dep.serial_number})
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

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
                            className="w-full p-2 border rounded mt-1 outline-none transition-all"
                            style={hardStyle}
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
                                className={`w-full p-2 border rounded mt-1 transition-all ${isAnalyzing ? 'opacity-50' : 'opacity-100'}`}
                                style={hardStyle}
                                required
                            >
                                <option value="" style={hardStyle}>-- Seleccione una categoría --</option>
                                {categories.map(cat => {
                                    const isSpecial = cat.name.includes('Area de');
                                    const optionStyle = isSpecial 
                                        ? { ...hardStyle, fontWeight: 'bold', backgroundColor: '#e5e7eb' } 
                                        : hardStyle;
                                    return <option key={cat.id} value={cat.id} style={optionStyle}>{isSpecial ? `--- ${cat.name.toUpperCase()} ---` : cat.name}</option>;
                                })}
                            </select>
                        </div>

                        {/* LISTADO DE PROBLEMAS ESPECÍFICOS */}
                        {!isCustomCategory && formData.category_id && (
                            <div>
                                <label className="block text-gray-700 font-medium">Problema Específico:</label>
                                <select 
                                    name="predefined_problem" 
                                    value={formData.predefined_problem_id || ''} 
                                    onChange={handleChange} 
                                    className="w-full p-2 border rounded mt-1" 
                                    style={hardStyle}
                                    required={!isCustomCategory}
                                >
                                    <option value="" style={hardStyle}>-- Seleccione un problema --</option>
                                    {predefinedProblems.length > 0 ? (
                                        predefinedProblems.map(prob => (
                                            <option key={prob.id} value={prob.id} style={hardStyle}>{prob.title}</option>
                                        ))
                                    ) : (
                                        <option value="" disabled style={hardStyle}>Cargando o sin opciones...</option>
                                    )}
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
                        style={hardStyle}
                        required 
                        disabled={!isOther && !isCustomCategory && !!formData.predefined_problem_id} 
                    />
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-700 font-medium">Prioridad:</label>
                            <select 
                                name="priority" 
                                value={formData.priority || 'medium'} 
                                onChange={handleChange} 
                                className="w-full p-2 border rounded mt-1" 
                                style={hardStyle}
                                required
                            >
                                <option value="low" style={hardStyle}>Baja</option>
                                <option value="medium" style={hardStyle}>Media</option>
                                <option value="high" style={hardStyle}>Alta</option>
                                <option value="urgent" style={{ ...hardStyle, color: 'red', fontWeight: 'bold' }}>Urgente</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-700 font-medium">Departamento:</label>
                            <select 
                                name="department_id" 
                                value={formData.department_id || ''} 
                                onChange={handleChange} 
                                className="w-full p-2 border rounded mt-1" 
                                style={hardStyle}
                                required
                            >
                                <option value="" style={hardStyle}>Seleccione un departamento</option>
                                {filteredDepartments.map(dept => (
                                    <option key={dept.id} value={dept.id} style={hardStyle}>{dept.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium">Adjuntar Archivos:</label>
                        <input type="file" multiple onChange={handleFileChange} className="w-full text-sm mt-1" style={{ color: '#000000' }} />
                    </div>
                    
                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button type="button" onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded">Cancelar</button>
                        <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded" disabled={loading}>{loading ? 'Guardando...' : 'Guardar Ticket'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TicketFormModal;