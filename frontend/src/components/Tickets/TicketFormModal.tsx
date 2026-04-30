import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../../config/axiosConfig';
import { useAuth } from '../../context/AuthContext';
import { Department, User, TicketData, UserRole } from '../../types';
import {
    canUseTicketInternalControlBlock,
    findDesarrolloCategoryId,
    isDesarrolloDepartmentName,
    matchesBacarDepartmentDropdownOption,
    matchesStandardDepartmentDropdownOption,
    staffAssignableUsers,
    ticketRequiresRealHoursForClosure,
} from '../../utils/ticketAccess';

/** Valores enviados al backend en `subcategoria` */
export const DESARROLLO_SUBCATEGORIAS = [
    'Bug / Error',
    'Mejora / Nueva Funcionalidad',
    'Mantenimiento de Servidores / BD',
    'Reunión / Planificación',
] as const;

const EMPTY_FORM_BASE = {
    title: '',
    description: '',
    priority: 'medium' as const,
    department_id: undefined as number | undefined,
    category_id: undefined as number | undefined,
    user_id: undefined as number | undefined,
    location_id: undefined as number | undefined,
    depositario_id: undefined as number | string | undefined,
    predefined_problem_id: undefined as number | string | undefined,
    subcategoria: '' as string | undefined,
    es_tarea_interna: false,
    horas_estimadas: undefined as number | undefined,
    horas_reales: undefined as number | undefined,
    assigned_to_user_id: undefined as number | undefined,
};

// --- INTERFACES LOCALES ---
interface Location {
    id: number;
    alias: string;
    serial_number?: string;
    name?: string;
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

type FormDataType = Partial<TicketData> & {
    predefined_problem_id?: number | string;
    depositario_id?: number | string;
    subcategoria?: string;
    es_tarea_interna?: boolean;
    horas_estimadas?: number;
    horas_reales?: number;
    assigned_to_user_id?: number;
};

function buildFormFromTicket(t: TicketData): FormDataType {
    const hEst = t.horas_estimadas;
    const hReal = t.horas_reales;
    return {
        ...EMPTY_FORM_BASE,
        title: t.title ?? '',
        description: t.description ?? '',
        priority: t.priority ?? 'medium',
        department_id: t.department_id ?? undefined,
        category_id: t.category_id ?? undefined,
        user_id: t.user_id ?? undefined,
        location_id: t.location_id ?? undefined,
        depositario_id: t.depositario_id ?? undefined,
        assigned_to_user_id: t.assigned_to_user_id ?? undefined,
        subcategoria: t.subcategoria ? String(t.subcategoria) : '',
        es_tarea_interna: !!(t.es_tarea_interna === true || t.es_tarea_interna === 1 || String(t.es_tarea_interna ?? '') === '1'),
        horas_estimadas: hEst !== undefined && hEst !== null && hEst !== '' ? Number(hEst) : undefined,
        horas_reales: hReal !== undefined && hReal !== null && hReal !== '' ? Number(hReal) : undefined,
    };
}

interface TicketFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: Partial<TicketData>, attachments: File[]) => Promise<void>;
    initialData: TicketData | null;
    departments: Department[];
    users: User[];
    currentUserRole: UserRole;
}

const TicketFormModal: React.FC<TicketFormModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    departments,
    users,
    currentUserRole,
}) => {
    const { user: loggedInUser } = useAuth();

    const [formData, setFormData] = useState<FormDataType>({ ...EMPTY_FORM_BASE });
    const [attachments, setAttachments] = useState<File[]>([]);
    const [loading, setLoading] = useState(false);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const analysisTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [categories, setCategories] = useState<TicketCategoryLocal[]>([]);
    const [predefinedProblems, setPredefinedProblems] = useState<PredefinedProblemLocal[]>([]);
    const [isOther, setIsOther] = useState(false);
    const [locations, setLocations] = useState<Location[]>([]);
    const [depositarios, setDepositarios] = useState<DepositarioOption[]>([]);
    const [isCustomCategory, setIsCustomCategory] = useState(false);

    const hardStyle = {
        backgroundColor: '#ffffff',
        color: '#000000',
        borderColor: '#d1d5db',
    };

    const targetCompanyId = useMemo(() => {
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && formData.user_id) {
            return users.find((u) => u.id === formData.user_id)?.company_id;
        }
        return loggedInUser?.company_id || '0';
    }, [currentUserRole, formData.user_id, users, loggedInUser]);

    const assignableStaff = useMemo(
        () => staffAssignableUsers(users, loggedInUser ?? undefined),
        [users, loggedInUser]
    );

    const showAdminStaffFields = currentUserRole === 'admin' || currentUserRole === 'agent';

    /** Al cerrar el modal: limpiar todo (evita resets parciales mientras está abierto) */
    useEffect(() => {
        if (!isOpen) {
            setFormData({ ...EMPTY_FORM_BASE });
            setAttachments([]);
            setLocations([]);
            setDepositarios([]);
            setCategories([]);
            setPredefinedProblems([]);
            setIsCustomCategory(false);
            setIsOther(false);
            setIsAnalyzing(false);
        }
    }, [isOpen]);

    /** Al abrir: cargar ticket en edición o formulario vacío en alta (solo depende de isOpen + id ticket) */
    useEffect(() => {
        if (!isOpen) return;
        if (initialData?.id) {
            setFormData(buildFormFromTicket(initialData));
        } else {
            setFormData({ ...EMPTY_FORM_BASE });
        }
    }, [isOpen, initialData?.id]);

    /** Datos remotos: categorías, ubicaciones, depositarios — no toca el texto que escribió el usuario */
    useEffect(() => {
        if (!isOpen) return;
        const fetchModalData = async () => {
            try {
                let locationsUrl: string;
                if (currentUserRole === 'client') {
                    locationsUrl = '/api/locations/0';
                    if (targetCompanyId && targetCompanyId !== '0') {
                        locationsUrl = `/api/locations/${targetCompanyId}`;
                    }
                } else {
                    locationsUrl = `/api/locations/${targetCompanyId}`;
                }
                const safeCompanyId = targetCompanyId || '0';
                const [catRes, locRes, depRes] = await Promise.all([
                    api.get(`/api/problems/categories/${safeCompanyId}`),
                    api.get(locationsUrl),
                    api.get(`/api/depositarios?companyId=${safeCompanyId}`),
                ]);
                setCategories(catRes.data.data || []);
                setLocations(locRes.data.data || []);
                setDepositarios(depRes.data.data || []);
            } catch (error) {
                console.error('Error cargando datos iniciales:', error);
            }
        };
        fetchModalData();
    }, [isOpen, targetCompanyId, currentUserRole]);

    /** Problemas predefinidos solo cuando aplica categoría estándar */
    useEffect(() => {
        const otherOption: PredefinedProblemLocal = { id: -999, title: 'Otro...', description: '', department_id: undefined };

        if (formData.category_id && !isCustomCategory) {
            const fetchProblems = async () => {
                try {
                    const res = await api.get(`/api/problems/predefined/${formData.category_id}`);
                    const dbProblems = res.data.data || [];
                    setPredefinedProblems([...dbProblems, otherOption]);
                } catch (error) {
                    console.error('Error cargando problemas:', error);
                    setPredefinedProblems([otherOption]);
                }
            };
            fetchProblems();
        } else {
            setPredefinedProblems([]);
        }
    }, [formData.category_id, isCustomCategory]);

    const filteredDepartments = useMemo(() => {
        if (!departments || !loggedInUser) return [];
        let targetUserForFiltering: User | undefined;
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && formData.user_id) {
            targetUserForFiltering = users.find((u) => u.id === formData.user_id);
        } else {
            targetUserForFiltering = loggedInUser as User;
        }
        let filtered: Department[];
        if (targetUserForFiltering?.company_id === 1) {
            filtered = departments.filter((d) => matchesBacarDepartmentDropdownOption(d));
        } else {
            filtered = departments.filter((d) => matchesStandardDepartmentDropdownOption(d));
        }
        const targetCo = targetUserForFiltering?.company_id;
        const byName = new Map<string, Department>();
        for (const d of filtered) {
            const existing = byName.get(d.name);
            const dMatchesCompany = d.company_id === targetCo;
            const existingMatchesCompany = existing?.company_id === targetCo;
            if (!existing || (dMatchesCompany && !existingMatchesCompany)) {
                byName.set(d.name, d);
            }
        }
        return Array.from(byName.values()).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    }, [departments, loggedInUser, formData.user_id, users, currentUserRole]);

    const isDesarrolloArea = useMemo(() => {
        const id = formData.department_id;
        if (!id) return false;
        const d = departments.find((x) => x.id === id) || filteredDepartments.find((x) => x.id === id);
        return d ? isDesarrolloDepartmentName(d.name) : false;
    }, [formData.department_id, departments, filteredDepartments]);

    /** Desarrollo: category_id = categoría DESARROLLO (por nombre), sin usar la primera ni IMPLEMENTACIONES */
    useEffect(() => {
        if (!isOpen || !isDesarrolloArea || !categories.length) return;
        const devId = findDesarrolloCategoryId(categories);
        if (!devId) return;
        setFormData((prev) => {
            if (prev.category_id === devId) return prev;
            return { ...prev, category_id: devId };
        });
    }, [isOpen, isDesarrolloArea, categories]);

    const mayUseControlBlock = useMemo(
        () => canUseTicketInternalControlBlock(loggedInUser ?? undefined, departments),
        [loggedInUser, departments]
    );

    // IA — solo completa campos vacíos; usa siempre actualizaciones funcionales
    useEffect(() => {
        if (!isOpen || !formData.description || formData.description.length < 10 || formData.predefined_problem_id) return;
        if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        analysisTimeoutRef.current = setTimeout(async () => {
            setIsAnalyzing(true);
            try {
                const res = await api.post('/api/ai/predict', { text: formData.description });
                const { suggestedCategory, suggestedPriority, suggestedDepartment } = res.data.data;
                const priorityMap: Record<string, string> = {
                    Crítica: 'urgent',
                    Alta: 'high',
                    Media: 'medium',
                    Baja: 'low',
                };

                if (suggestedPriority && priorityMap[suggestedPriority]) {
                    setFormData((prev) =>
                        prev.priority && prev.priority !== 'medium'
                            ? prev
                            : { ...prev, priority: priorityMap[suggestedPriority] as TicketData['priority'] }
                    );
                }
                if (suggestedDepartment === 'Desarrollo') {
                    const targetCo = targetCompanyId && targetCompanyId !== '0' ? Number(targetCompanyId) : undefined;
                    const devDept =
                        (targetCo !== undefined
                            ? departments.find(
                                  (d) => isDesarrolloDepartmentName(d.name) && Number(d.company_id) === targetCo
                              )
                            : undefined) || departments.find((d) => isDesarrolloDepartmentName(d.name));
                    if (devDept) {
                        setFormData((prev) =>
                            prev.department_id ? prev : { ...prev, department_id: devDept.id }
                        );
                    }
                }
                if (suggestedCategory && categories.length > 0) {
                    const foundCat = categories.find((c) =>
                        c.name.toLowerCase().includes(suggestedCategory.toLowerCase())
                    );
                    if (foundCat) {
                        setFormData((prev) => {
                            const dep = departments.find((d) => d.id === prev.department_id);
                            if (dep && isDesarrolloDepartmentName(dep.name)) return prev;
                            const next = { ...prev };
                            if (!prev.category_id) {
                                const isSpecial =
                                    foundCat.name.includes('Area de Implementaciones') ||
                                    foundCat.name.includes('Area de Mantenimiento');
                                setIsCustomCategory(!!isSpecial);
                                next.category_id = foundCat.id;
                            }
                            if (!prev.title?.trim() && prev.description) {
                                const desc = prev.description;
                                next.title = desc.length > 50 ? `${desc.substring(0, 50)}...` : desc;
                            }
                            return next;
                        });
                    }
                }
            } catch (error) {
                console.error('Error IA:', error);
            } finally {
                setIsAnalyzing(false);
            }
        }, 1200);
        return () => {
            if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
        };
    }, [
        formData.description,
        categories,
        isOpen,
        departments,
        targetCompanyId,
        formData.predefined_problem_id,
    ]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        const numValue = parseInt(value, 10);

        if (e.target instanceof HTMLInputElement && e.target.type === 'checkbox') {
            const checked = e.target.checked;
            if (name === 'es_tarea_interna') {
                setFormData((prev) => ({ ...prev, es_tarea_interna: checked }));
            }
            return;
        }

        if (name === 'horas_estimadas' || name === 'horas_reales') {
            const v = value.trim();
            setFormData((prev) => ({
                ...prev,
                [name]: v === '' ? undefined : Number(v),
            }));
            return;
        }

        if (name === 'user_id') {
            setFormData((prev) => ({
                ...prev,
                user_id: numValue || undefined,
            }));
            setIsCustomCategory(false);
            setIsOther(false);
            return;
        }

        if (name === 'department_id') {
            const newDepId = numValue || undefined;
            const dept = departments.find((d) => d.id === newDepId);
            setFormData((prev) => ({
                ...prev,
                department_id: newDepId,
                ...(dept && !isDesarrolloDepartmentName(dept.name)
                    ? { subcategoria: '', category_id: prev.category_id }
                    : {}),
                ...(dept && isDesarrolloDepartmentName(dept.name)
                    ? { predefined_problem_id: undefined }
                    : {}),
            }));
            return;
        }

        if (name === 'category_id') {
            const selectedCategory = categories.find((c) => c.id === numValue);
            const isSpecial =
                selectedCategory &&
                (selectedCategory.name.includes('Area de Implementaciones') ||
                    selectedCategory.name.includes('Area de Mantenimiento'));
            setIsCustomCategory(!!isSpecial);
            setFormData((prev) => ({
                ...prev,
                category_id: numValue || undefined,
                predefined_problem_id: undefined,
            }));
            setIsOther(false);
            return;
        }

        if (name === 'predefined_problem') {
            const problem = predefinedProblems.find((p) => p.id === numValue);
            if (problem) {
                const isOptionOther = problem.title === 'Otro...' || problem.id === -999;
                setFormData((prev) => ({
                    ...prev,
                    predefined_problem_id: numValue || undefined,
                    title: isOptionOther ? prev.title : problem.title,
                    description: isOptionOther
                        ? prev.description
                        : `${problem.description}\n\n--- (Por favor, añada más detalles aquí si es necesario) ---\n`,
                    department_id: problem.department_id ?? prev.department_id,
                }));
                setIsOther(isOptionOther);
            } else {
                setFormData((prev) => ({ ...prev, predefined_problem_id: undefined }));
            }
            return;
        }

        if (name === 'assigned_to_user_id') {
            setFormData((prev) => ({
                ...prev,
                assigned_to_user_id: value === '' ? undefined : numValue || undefined,
            }));
            return;
        }

        const newValue = name.endsWith('_id') ? numValue || undefined : value;
        setFormData((prev) => ({ ...prev, [name]: newValue }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setAttachments(Array.from(e.target.files));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((currentUserRole === 'admin' || currentUserRole === 'agent') && !formData.user_id) {
            toast.warn('Por favor, selecciona el cliente para quien es este ticket.');
            return;
        }

        const desarrolloCatId = findDesarrolloCategoryId(categories);
        const resolvedCategoryId = isDesarrolloArea ? desarrolloCatId ?? formData.category_id : formData.category_id;

        if (!isDesarrolloArea && !formData.category_id) {
            toast.warn('Seleccioná una categoría del problema.');
            return;
        }
        if (isDesarrolloArea && !resolvedCategoryId) {
            toast.warn(
                'No se encontró la categoría DESARROLLO para esta empresa. Verificá la configuración o intentá de nuevo.'
            );
            return;
        }
        if (isDesarrolloArea && (!formData.subcategoria || !String(formData.subcategoria).trim())) {
            toast.warn('Seleccioná una sub-categoría para el área Desarrollo.');
            return;
        }

        const requiredFields: unknown[] = [formData.title, formData.description, formData.department_id];
        if (!isDesarrolloArea) {
            requiredFields.push(formData.category_id);
        }
        if (locations.length > 0) {
            requiredFields.push(formData.location_id);
        }
        if (requiredFields.some((field) => !field)) {
            toast.warn('Por favor, completá todos los campos requeridos.');
            return;
        }

        const payload: Partial<TicketData> = {
            ...formData,
            category_id: resolvedCategoryId ?? formData.category_id ?? null,
        };

        if (!isDesarrolloArea) {
            delete payload.subcategoria;
        } else if (payload.subcategoria) {
            payload.subcategoria = String(payload.subcategoria).trim();
        }

        if (!mayUseControlBlock) {
            delete payload.es_tarea_interna;
            delete payload.horas_estimadas;
            delete payload.horas_reales;
        } else {
            payload.es_tarea_interna = !!formData.es_tarea_interna;
        }

        if (!showAdminStaffFields) {
            delete payload.assigned_to_user_id;
        }

        const selectedDeptName =
            departments.find((d) => d.id === formData.department_id)?.name ??
            filteredDepartments.find((d) => d.id === formData.department_id)?.name;
        const requiresRealHoursControlUi = ticketRequiresRealHoursForClosure(
            selectedDeptName,
            formData.es_tarea_interna
        );

        if (!initialData?.id) {
            delete payload.horas_reales;
        } else if (mayUseControlBlock && !requiresRealHoursControlUi) {
            delete payload.horas_reales;
        }

        setLoading(true);
        await onSave(payload, attachments);
        setLoading(false);
    };

    if (!isOpen) return null;

    const isCreateMode = !initialData?.id;
    const selectedDeptNameForUi =
        departments.find((d) => d.id === formData.department_id)?.name ??
        filteredDepartments.find((d) => d.id === formData.department_id)?.name;
    const requiresRealHoursControlUi = ticketRequiresRealHoursForClosure(
        selectedDeptNameForUi,
        formData.es_tarea_interna
    );
    const showHorasRealesInControl = !isCreateMode && requiresRealHoursControlUi;
    const titleDisabled = !isOther && !isCustomCategory && !!formData.predefined_problem_id && !isDesarrolloArea;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4 border-b pb-2">
                    <h2 className="text-2xl font-bold text-gray-800">
                        {initialData?.id ? 'Editar Ticket' : 'Crear Nuevo Ticket'}
                    </h2>
                    {isAnalyzing && (
                        <span className="text-sm font-bold text-blue-600 animate-pulse bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
                            🤖 IA Analizando...
                        </span>
                    )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 1. Asunto / Título */}
                    <div>
                        <label className="block text-gray-700 font-medium">Asunto / Título</label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title || ''}
                            onChange={handleChange}
                            placeholder="Título del ticket"
                            className="w-full p-2 border rounded mt-1"
                            style={hardStyle}
                            required
                            disabled={titleDisabled}
                        />
                    </div>

                    {/* 2. Departamento */}
                    <div>
                        <label className="block text-gray-700 font-medium">Departamento</label>
                        <select
                            name="department_id"
                            value={formData.department_id || ''}
                            onChange={handleChange}
                            className="w-full p-2 border rounded mt-1"
                            style={hardStyle}
                            required
                        >
                            <option value="">Seleccioná un departamento</option>
                            {filteredDepartments.map((dept) => (
                                <option key={dept.id} value={dept.id} style={hardStyle}>
                                    {dept.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* 3. Categoría condicional: Desarrollo → Sub-categoría; si no → categoría estándar (+ problema predefinido) */}
                    {isDesarrolloArea ? (
                        <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-4 space-y-2">
                            <label className="block text-gray-800 font-medium">
                                Sub-categoría <span className="text-red-600">*</span>
                            </label>
                            <select
                                name="subcategoria"
                                value={formData.subcategoria || ''}
                                onChange={handleChange}
                                className="w-full p-2 border border-violet-200 rounded mt-1 bg-white"
                                style={hardStyle}
                                required
                            >
                                <option value="">-- Seleccioná una opción --</option>
                                {DESARROLLO_SUBCATEGORIAS.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-gray-700 font-medium">Categoría del problema</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id || ''}
                                    onChange={handleChange}
                                    className={`w-full p-2 border rounded mt-1 transition-all ${isAnalyzing ? 'opacity-50' : 'opacity-100'}`}
                                    style={hardStyle}
                                    required
                                >
                                    <option value="">-- Seleccioná una categoría --</option>
                                    {categories.map((cat) => {
                                        const isSpecial = cat.name.includes('Area de');
                                        const optionStyle = isSpecial
                                            ? { ...hardStyle, fontWeight: 'bold', backgroundColor: '#e5e7eb' }
                                            : hardStyle;
                                        return (
                                            <option key={cat.id} value={cat.id} style={optionStyle}>
                                                {isSpecial ? `--- ${cat.name.toUpperCase()} ---` : cat.name}
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>
                            {!isCustomCategory && formData.category_id && (
                                <div>
                                    <label className="block text-gray-700 font-medium">Problema específico</label>
                                    <select
                                        name="predefined_problem"
                                        value={formData.predefined_problem_id || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 border rounded mt-1"
                                        style={hardStyle}
                                        required={!isCustomCategory}
                                    >
                                        <option value="">-- Seleccioná un problema --</option>
                                        {predefinedProblems.length > 0 ? (
                                            predefinedProblems.map((prob) => (
                                                <option key={prob.id} value={prob.id} style={hardStyle}>
                                                    {prob.title}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="" disabled style={hardStyle}>
                                                Cargando o sin opciones...
                                            </option>
                                        )}
                                    </select>
                                </div>
                            )}
                        </>
                    )}

                    {/* 4. Prioridad */}
                    <div>
                        <label className="block text-gray-700 font-medium">Prioridad</label>
                        <select
                            name="priority"
                            value={formData.priority || 'medium'}
                            onChange={handleChange}
                            className="w-full p-2 border rounded mt-1"
                            style={hardStyle}
                            required
                        >
                            <option value="low" style={hardStyle}>
                                Baja
                            </option>
                            <option value="medium" style={hardStyle}>
                                Media
                            </option>
                            <option value="high" style={hardStyle}>
                                Alta
                            </option>
                            <option value="urgent" style={{ ...hardStyle, color: 'red', fontWeight: 'bold' }}>
                                Urgente
                            </option>
                        </select>
                    </div>

                    {/* 5. Descripción */}
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-gray-700 font-bold mb-1">
                            Descripción{' '}
                            <span className="text-xs font-normal text-gray-500">(la IA puede sugerir prioridad o área)</span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description || ''}
                            onChange={handleChange}
                            placeholder="Detalle del pedido o incidente..."
                            rows={5}
                            className="w-full p-2 border rounded mt-1 outline-none transition-all"
                            style={hardStyle}
                            required
                        />
                    </div>

                    {/* Clientes (y roles sin bloque admin): ubicación / depositario si aplica */}
                    {!showAdminStaffFields && (locations.length > 0 || depositarios.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {locations.length > 0 && (
                                <div>
                                    <label className="block text-gray-700 font-medium">
                                        {locations[0]?.type || 'Ubicación'}
                                    </label>
                                    <select
                                        name="location_id"
                                        value={formData.location_id || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 border rounded mt-1"
                                        style={hardStyle}
                                        required
                                    >
                                        <option value="">-- Seleccioná ubicación --</option>
                                        {locations.map((loc) => (
                                            <option key={loc.id} value={loc.id} style={hardStyle}>
                                                {loc.alias || loc.name}{' '}
                                                {loc.serial_number ? `(S/N: ${loc.serial_number})` : ''}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {depositarios.length > 0 && (
                                <div>
                                    <label className="block text-gray-700 font-medium">Equipo / Depositario (opcional)</label>
                                    <select
                                        name="depositario_id"
                                        value={formData.depositario_id || ''}
                                        onChange={handleChange}
                                        className="w-full p-2 border rounded mt-1"
                                        style={hardStyle}
                                    >
                                        <option value="">-- Ninguno --</option>
                                        {depositarios.map((dep) => (
                                            <option key={dep.id} value={dep.id} style={hardStyle}>
                                                {dep.alias} (S/N: {dep.serial_number})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 6. Bloque Admin: cliente destino, ubicación, depositario, asignación */}
                    {showAdminStaffFields && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 space-y-4">
                            <p className="text-sm font-semibold text-slate-800">Administración</p>
                            <div>
                                <label className="block text-gray-700 font-medium">Ticket para (cliente)</label>
                                <select
                                    name="user_id"
                                    value={formData.user_id || ''}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded mt-1 bg-white"
                                    style={hardStyle}
                                    required
                                >
                                    <option value="">-- Seleccioná un usuario --</option>
                                    {users.filter((u) => u.role === 'client').map((client) => (
                                        <option key={client.id} value={client.id} style={hardStyle}>
                                            {client.username}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {locations.length > 0 && (
                                    <div>
                                        <label className="block text-gray-700 font-medium">
                                            {locations[0]?.type || 'Ubicación'}
                                        </label>
                                        <select
                                            name="location_id"
                                            value={formData.location_id || ''}
                                            onChange={handleChange}
                                            className="w-full p-2 border rounded mt-1 bg-white"
                                            style={hardStyle}
                                            required
                                        >
                                            <option value="">-- Ubicación --</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.id} style={hardStyle}>
                                                    {loc.alias || loc.name}{' '}
                                                    {loc.serial_number ? `(S/N: ${loc.serial_number})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {depositarios.length > 0 && (
                                    <div>
                                        <label className="block text-gray-700 font-medium flex items-center gap-2">
                                            <span>Equipo / Depositario</span>
                                            <span className="text-xs text-gray-400 font-normal">(opcional)</span>
                                        </label>
                                        <select
                                            name="depositario_id"
                                            value={formData.depositario_id || ''}
                                            onChange={handleChange}
                                            className="w-full p-2 border rounded mt-1 bg-white"
                                            style={hardStyle}
                                        >
                                            <option value="">-- Ninguno --</option>
                                            {depositarios.map((dep) => (
                                                <option key={dep.id} value={dep.id} style={hardStyle}>
                                                    {dep.alias} (S/N: {dep.serial_number})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-medium">Asignado a</label>
                                <select
                                    name="assigned_to_user_id"
                                    value={formData.assigned_to_user_id ?? ''}
                                    onChange={handleChange}
                                    className="w-full p-2 border rounded mt-1 bg-white"
                                    style={hardStyle}
                                >
                                    <option value="">Sin asignar</option>
                                    {assignableStaff.map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.first_name && u.last_name
                                                ? `${u.first_name} ${u.last_name}`
                                                : u.username}{' '}
                                            {u.role === 'admin' ? '(Admin)' : ''}
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">
                                    Incluye tu usuario para usar el ticket como bitácora personal.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* 7. Control interno (permisos estrictos) */}
                    {mayUseControlBlock && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-4">
                            <p className="text-sm font-semibold text-slate-700">Control (solo administración)</p>
                            <label className="flex items-center gap-2 cursor-pointer text-gray-800">
                                <input
                                    type="checkbox"
                                    name="es_tarea_interna"
                                    checked={!!formData.es_tarea_interna}
                                    onChange={handleChange}
                                    className="rounded border-gray-400 text-red-600 focus:ring-red-500"
                                />
                                Marcar como tarea interna
                            </label>
                            <div
                                className={`grid grid-cols-1 gap-4 ${showHorasRealesInControl ? 'sm:grid-cols-2' : ''}`}
                            >
                                <div>
                                    <label className="block text-gray-700 text-sm font-medium">Horas estimadas</label>
                                    <input
                                        type="number"
                                        name="horas_estimadas"
                                        step={0.5}
                                        min={0}
                                        value={
                                            formData.horas_estimadas === undefined || formData.horas_estimadas === null
                                                ? ''
                                                : formData.horas_estimadas
                                        }
                                        onChange={handleChange}
                                        className="w-full p-2 border rounded mt-1 bg-white"
                                        style={hardStyle}
                                        placeholder="0"
                                    />
                                </div>
                                {showHorasRealesInControl && (
                                    <div>
                                        <label className="block text-gray-700 text-sm font-medium">Horas reales</label>
                                        <input
                                            type="number"
                                            name="horas_reales"
                                            step={0.5}
                                            min={0}
                                            value={
                                                formData.horas_reales === undefined || formData.horas_reales === null
                                                    ? ''
                                                    : formData.horas_reales
                                            }
                                            onChange={handleChange}
                                            className="w-full p-2 border rounded mt-1 bg-white"
                                            style={hardStyle}
                                            placeholder="0"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* 8. Archivos */}
                    <div>
                        <label className="block text-gray-700 font-medium">Adjuntar archivos</label>
                        <input
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="w-full text-sm mt-1"
                            style={{ color: '#000000' }}
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                            disabled={loading}
                        >
                            {loading ? 'Guardando...' : 'Guardar ticket'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default TicketFormModal;
