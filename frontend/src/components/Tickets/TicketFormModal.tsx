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
import { clInput, clModalPanel } from '../../utils/cleanLightUi';

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
    assigned_to_user_ids: [] as number[],
    telefono_contacto: '' as string,
    github_repo: '' as string,
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
    /** Prioridad sugerida configurada en Problemáticas (opcional) */
    default_priority?: TicketData['priority'] | null;
    /** Es la opción "Otro...": el usuario escribe su propio título */
    is_other?: boolean;
}

/** "Otro", "Otros", "Otro..." o "Otro…" cargados como problema predefinido */
const OTHER_TITLE_RE = /^otros?\s*(\.{3}|…)?$/i;

/** Problemática que dispara el pedido de autorización por correo */
const EQUIPMENT_TITLE_RE = /solicitud\s+de\s+nuevo\s+equipamiento/i;

const EQUIPMENT_TYPES = ['PC', 'Notebook', 'PC con monitor, teclado y mouse', 'Otro'] as const;

const SOFTWARE_EMAIL = 'Correo de Bacar';
const SOFTWARE_OTHER = 'Otro';
const SOFTWARE_OPTIONS = ['Vientri', 'Salario', 'Sheet y Docs', SOFTWARE_EMAIL, SOFTWARE_OTHER] as const;

const EMPTY_EQUIPMENT = {
    equipment_type: '',
    equipment_type_other: '',
    purpose: '',
    software_options: [] as string[],
    email_account: '',
    software_other: '',
    assigned_person: '',
    assigned_location: '',
};

type EquipmentRequest = typeof EMPTY_EQUIPMENT;
type EquipmentTextField = Exclude<keyof EquipmentRequest, 'software_options'>;

function softwareSummary(eq: EquipmentRequest): string {
    return SOFTWARE_OPTIONS.filter((opt) => eq.software_options.includes(opt))
        .map((opt) => {
            if (opt === SOFTWARE_EMAIL) return `${opt} (cuenta: ${eq.email_account.trim()})`;
            if (opt === SOFTWARE_OTHER) return `Otro: ${eq.software_other.trim()}`;
            return opt;
        })
        .join(', ');
}

function buildEquipmentDescription(eq: EquipmentRequest, extra: string): string {
    const type = eq.equipment_type === 'Otro' ? eq.equipment_type_other.trim() || 'Otro' : eq.equipment_type;
    const lines = [
        'SOLICITUD DE NUEVO EQUIPAMIENTO',
        `Equipo: ${type}`,
        `Uso: ${eq.purpose.trim()}`,
        `Programas y accesos: ${softwareSummary(eq) || 'Ninguno indicado'}`,
        `Se asigna a: ${eq.assigned_person.trim()}`,
        `Lugar / área: ${eq.assigned_location.trim()}`,
    ];
    const notes = extra.trim();
    if (notes) lines.push('', `Comentarios: ${notes}`);
    return lines.join('\n');
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
    assigned_to_user_ids?: number[];
};

function buildFormFromTicket(t: TicketData): FormDataType {
    const hEst = t.horas_estimadas;
    const hReal = t.horas_reales;
    const assigneeIds =
        t.assignees && t.assignees.length > 0
            ? t.assignees.map((a) => a.id)
            : t.assigned_to_user_id
              ? [t.assigned_to_user_id]
              : [];
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
        assigned_to_user_id: assigneeIds[0],
        assigned_to_user_ids: assigneeIds,
        subcategoria: t.subcategoria ? String(t.subcategoria) : '',
        es_tarea_interna: !!(t.es_tarea_interna === true || t.es_tarea_interna === 1 || String(t.es_tarea_interna ?? '') === '1'),
        horas_estimadas: hEst !== undefined && hEst !== null && hEst !== '' ? Number(hEst) : undefined,
        horas_reales: hReal !== undefined && hReal !== null && hReal !== '' ? Number(hReal) : undefined,
        telefono_contacto:
            t.telefono_contacto !== undefined && t.telefono_contacto !== null
                ? String(t.telefono_contacto).trim()
                : '',
        github_repo:
            t.github_repo !== undefined && t.github_repo !== null && String(t.github_repo).trim() !== ''
                ? String(t.github_repo).trim()
                : '',
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
    const [equipment, setEquipment] = useState<EquipmentRequest>({ ...EMPTY_EQUIPMENT });

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
            setEquipment({ ...EMPTY_EQUIPMENT });
        }
    }, [isOpen]);

    /** Al abrir: cargar ticket en edición o formulario vacío en alta (solo depende de isOpen + id ticket) */
    useEffect(() => {
        if (!isOpen) return;
        if (initialData?.id) {
            setFormData(buildFormFromTicket(initialData));
        } else {
            const base = { ...EMPTY_FORM_BASE };
            if (
                loggedInUser?.id &&
                (currentUserRole === 'admin' || currentUserRole === 'agent')
            ) {
                base.user_id = loggedInUser.id;
            }
            setFormData(base);
        }
    }, [isOpen, initialData?.id, currentUserRole, loggedInUser?.id]);

    /** Datos remotos: categorías (crítico), ubicaciones y depositarios (opcionales) */
    useEffect(() => {
        if (!isOpen) return;
        const fetchModalData = async () => {
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

            try {
                const catRes = await api.get(`/api/problems/categories/${safeCompanyId}`);
                setCategories(catRes.data.data || []);
            } catch (error) {
                console.error('Error cargando categorías:', error);
                setCategories([]);
                toast.error('No se pudieron cargar las categorías del problema. Recargá la página o contactá a soporte.');
            }

            try {
                const locRes = await api.get(locationsUrl);
                setLocations(locRes.data.data || []);
            } catch (error) {
                console.error('Error cargando ubicaciones:', error);
                setLocations([]);
            }

            try {
                const depRes = await api.get(`/api/depositarios?companyId=${safeCompanyId}`);
                setDepositarios(depRes.data.data || []);
            } catch (error) {
                console.error('Error cargando depositarios (opcional):', error);
                setDepositarios([]);
            }
        };
        fetchModalData();
    }, [isOpen, targetCompanyId, currentUserRole]);

    /** Problemas predefinidos solo cuando aplica categoría estándar */
    useEffect(() => {
        const otherOption: PredefinedProblemLocal = { id: -999, title: 'Otro...', description: '', department_id: undefined, is_other: true };

        if (formData.category_id && !isCustomCategory) {
            const fetchProblems = async () => {
                try {
                    const res = await api.get(`/api/problems/predefined/${formData.category_id}`);
                    const dbProblems: PredefinedProblemLocal[] = res.data.data || [];
                    // Si la categoría ya tiene un "Otro" cargado, se usa ese como opción libre
                    // (conserva su departamento) en vez de mostrar dos "Otro..." en el desplegable.
                    const regular = dbProblems.filter((p) => !OTHER_TITLE_RE.test(String(p.title || '').trim()));
                    const dbOther = dbProblems.find((p) => OTHER_TITLE_RE.test(String(p.title || '').trim()));
                    const other: PredefinedProblemLocal = dbOther
                        ? { ...dbOther, title: 'Otro...', description: '', is_other: true }
                        : otherOption;
                    setPredefinedProblems([...regular, other]);
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

    const isEquipmentRequest = useMemo(() => {
        if (initialData?.id || isDesarrolloArea || isCustomCategory || !formData.predefined_problem_id) return false;
        const problem = predefinedProblems.find((p) => p.id === Number(formData.predefined_problem_id));
        return !!problem && !problem.is_other && EQUIPMENT_TITLE_RE.test(problem.title);
    }, [initialData?.id, isDesarrolloArea, isCustomCategory, formData.predefined_problem_id, predefinedProblems]);

    const setEquipmentField = (field: EquipmentTextField, value: string) =>
        setEquipment((prev) => ({ ...prev, [field]: value }));

    const toggleSoftware = (option: string) =>
        setEquipment((prev) => ({
            ...prev,
            software_options: prev.software_options.includes(option)
                ? prev.software_options.filter((o) => o !== option)
                : [...prev.software_options, option],
        }));

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
                const isOptionOther = Boolean(problem.is_other) || problem.id === -999;
                const isEquipmentOption = !isOptionOther && EQUIPMENT_TITLE_RE.test(problem.title);
                setFormData((prev) => ({
                    ...prev,
                    predefined_problem_id: numValue || undefined,
                    title: isOptionOther ? prev.title : problem.title,
                    description: isOptionOther
                        ? prev.description
                        : isEquipmentOption
                          ? ''
                          : `${problem.description}\n\n--- (Por favor, añada más detalles aquí si es necesario) ---\n`,
                    department_id: problem.department_id ?? prev.department_id,
                    priority: !isOptionOther && problem.default_priority ? problem.default_priority : prev.priority,
                }));
                setIsOther(isOptionOther);
            } else {
                setFormData((prev) => ({ ...prev, predefined_problem_id: undefined }));
            }
            return;
        }

        if (name === 'assigned_to_user_id') {
            // Compat: un solo valor → lista de uno
            const nextId = value === '' ? undefined : numValue || undefined;
            setFormData((prev) => ({
                ...prev,
                assigned_to_user_id: nextId,
                assigned_to_user_ids: nextId ? [nextId] : [],
            }));
            return;
        }

        const newValue = name.endsWith('_id') ? numValue || undefined : value;
        setFormData((prev) => ({ ...prev, [name]: newValue }));
    };

    const toggleAssignee = (userId: number) => {
        setFormData((prev) => {
            const current = prev.assigned_to_user_ids || [];
            const exists = current.includes(userId);
            const next = exists ? current.filter((id) => id !== userId) : [...current, userId];
            return {
                ...prev,
                assigned_to_user_ids: next,
                assigned_to_user_id: next[0],
            };
        });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) setAttachments(Array.from(e.target.files));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

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

        if (isEquipmentRequest) {
            if (!equipment.equipment_type) {
                toast.warn('Elegí qué tipo de equipo necesitás.');
                return;
            }
            if (equipment.equipment_type === 'Otro' && !equipment.equipment_type_other.trim()) {
                toast.warn('Indicá qué equipo necesitás.');
                return;
            }
            if (!equipment.purpose.trim()) {
                toast.warn('Contá para qué se va a usar el equipo.');
                return;
            }
            if (equipment.software_options.includes(SOFTWARE_EMAIL) && !equipment.email_account.trim()) {
                toast.warn('Indicá cómo se va a llamar la cuenta de correo de Bacar.');
                return;
            }
            if (equipment.software_options.includes(SOFTWARE_OTHER) && !equipment.software_other.trim()) {
                toast.warn('Indicá qué otro programa necesita.');
                return;
            }
            if (!equipment.assigned_person.trim()) {
                toast.warn('Indicá a quién se le asigna el equipo.');
                return;
            }
            if (!equipment.assigned_location.trim()) {
                toast.warn('Indicá a dónde se asigna el equipo.');
                return;
            }
        }

        const descriptionToSend = isEquipmentRequest
            ? buildEquipmentDescription(equipment, formData.description || '')
            : formData.description;

        const requiredFields: unknown[] = [formData.title, descriptionToSend, formData.department_id];
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
            description: descriptionToSend,
            category_id: resolvedCategoryId ?? formData.category_id ?? null,
        };
        if (isEquipmentRequest) {
            (payload as any).equipment_request = JSON.stringify({
                equipment_type: equipment.equipment_type,
                equipment_type_other: equipment.equipment_type_other.trim(),
                purpose: equipment.purpose.trim(),
                software_options: equipment.software_options,
                email_account: equipment.email_account.trim(),
                software_other: equipment.software_other.trim(),
                assigned_person: equipment.assigned_person.trim(),
                assigned_location: equipment.assigned_location.trim(),
            });
        }

        if (!isDesarrolloArea) {
            delete payload.subcategoria;
            delete payload.github_repo;
        } else {
            if (payload.subcategoria) {
                payload.subcategoria = String(payload.subcategoria).trim();
            }
            const gr = formData.github_repo != null ? String(formData.github_repo).trim() : '';
            if (gr === '') {
                delete payload.github_repo;
            } else {
                payload.github_repo = gr.slice(0, 255);
            }
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
            delete (payload as any).assigned_to_user_ids;
        } else {
            const ids = formData.assigned_to_user_ids || [];
            (payload as any).assigned_to_user_ids = ids;
            payload.assigned_to_user_id = ids[0] ?? null;
        }

        const phoneTrim =
            formData.telefono_contacto !== undefined && formData.telefono_contacto !== null
                ? String(formData.telefono_contacto).trim().slice(0, 64)
                : '';
        if (phoneTrim === '') {
            delete payload.telefono_contacto;
        } else {
            payload.telefono_contacto = phoneTrim;
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

        const creatingForSelfAsStaff =
            !initialData?.id &&
            showAdminStaffFields &&
            loggedInUser?.id &&
            (payload.user_id === undefined ||
                payload.user_id === null ||
                payload.user_id === loggedInUser.id);

        if (creatingForSelfAsStaff && (currentUserRole === 'agent' || currentUserRole === 'admin')) {
            const currentIds = (payload as any).assigned_to_user_ids as number[] | undefined;
            if (!currentIds || currentIds.length === 0) {
                (payload as any).assigned_to_user_ids = [loggedInUser.id];
                payload.assigned_to_user_id = loggedInUser.id;
            }
        }

        setLoading(true);
        await onSave(payload, attachments);
        setLoading(false);
    };

    if (!isOpen) return null;

    const isCreateMode = !initialData?.id;
    const isSelfRequesterInUi =
        showAdminStaffFields &&
        !!loggedInUser?.id &&
        (formData.user_id === undefined || formData.user_id === null || formData.user_id === loggedInUser.id);
    const willAutoAssignToSelf =
        isCreateMode &&
        isSelfRequesterInUi &&
        (currentUserRole === 'agent' || currentUserRole === 'admin') &&
        (!(formData.assigned_to_user_ids || []).length);
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
            <div className={`${clModalPanel} max-w-2xl p-6`}>
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
                            className={`${clInput} mt-1`}
                            required
                            disabled={titleDisabled}
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 font-medium">Teléfono de contacto</label>
                        <input
                            type="text"
                            name="telefono_contacto"
                            value={formData.telefono_contacto ?? ''}
                            onChange={handleChange}
                            placeholder="Ej: 3511234567 (Opcional)"
                            className={`${clInput} mt-1`}
                            autoComplete="tel"
                            maxLength={64}
                        />
                    </div>

                    {/* 2. Departamento */}
                    <div>
                        <label className="block text-gray-700 font-medium">Departamento</label>
                        <select
                            name="department_id"
                            value={formData.department_id || ''}
                            onChange={handleChange}
                            className={`${clInput} mt-1`}
                            required
                        >
                            <option value="">Seleccioná un departamento</option>
                            {filteredDepartments.map((dept) => (
                                <option key={dept.id} value={dept.id}>
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
                                className={`${clInput} mt-1 border-violet-200`}
                                required
                            >
                                <option value="">-- Seleccioná una opción --</option>
                                {DESARROLLO_SUBCATEGORIAS.map((opt) => (
                                    <option key={opt} value={opt}>
                                        {opt}
                                    </option>
                                ))}
                            </select>
                            <div className="pt-2">
                                <label className="block text-gray-800 font-medium text-sm">
                                    Repositorio GitHub (owner/repo){' '}
                                    <span className="text-gray-500 font-normal">(opcional)</span>
                                </label>
                                <input
                                    type="text"
                                    name="github_repo"
                                    value={formData.github_repo ?? ''}
                                    onChange={handleChange}
                                    placeholder="ej: mi-org/mi-repo"
                                    className={`${clInput} mt-1 border-violet-200`}
                                    maxLength={255}
                                    autoComplete="off"
                                />
                                <p className="text-xs text-violet-700/90 mt-1">Formato owner/nombre del repo</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div>
                                <label className="block text-gray-700 font-medium">Categoría del problema</label>
                                <select
                                    name="category_id"
                                    value={formData.category_id || ''}
                                    onChange={handleChange}
                                    className={`${clInput} mt-1 transition-all ${isAnalyzing ? 'opacity-50' : 'opacity-100'}`}
                                    required
                                    disabled={categories.length === 0}
                                >
                                    <option value="">
                                        {categories.length === 0
                                            ? '-- Sin categorías disponibles --'
                                            : '-- Seleccioná una categoría --'}
                                    </option>
                                    {categories.map((cat) => {
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
                                    <label className="block text-gray-700 font-medium">Problema específico</label>
                                    <select
                                        name="predefined_problem"
                                        value={formData.predefined_problem_id || ''}
                                        onChange={handleChange}
                                        className={`${clInput} mt-1`}
                                        required={!isCustomCategory}
                                    >
                                        <option value="">-- Seleccioná un problema --</option>
                                        {predefinedProblems.length > 0 ? (
                                            predefinedProblems.map((prob) => (
                                                <option key={prob.id} value={prob.id}>
                                                    {prob.title}
                                                </option>
                                            ))
                                        ) : (
                                            <option value="" disabled>
                                                Cargando o sin opciones...
                                            </option>
                                        )}
                                    </select>
                                </div>
                            )}
                            {isEquipmentRequest && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 space-y-4">
                                    <div>
                                        <p className="font-semibold text-gray-900">Detalle del equipo solicitado</p>
                                        <p className="text-xs text-amber-800 mt-0.5">
                                            Este pedido necesita autorización: al crear el ticket se envía un correo al
                                            responsable con estos datos para que lo autorice o no.
                                        </p>
                                    </div>

                                    <div>
                                        <span className="block text-gray-700 font-medium text-sm mb-1.5">
                                            ¿Qué equipo necesitás? <span className="text-red-600">*</span>
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {EQUIPMENT_TYPES.map((type) => {
                                                const checked = equipment.equipment_type === type;
                                                return (
                                                    <label
                                                        key={type}
                                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                                                            checked
                                                                ? 'border-red-300 bg-white text-gray-900 ring-2 ring-red-100'
                                                                : 'border-gray-200 bg-white/70 text-gray-700 hover:bg-white'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name="equipment_type"
                                                            value={type}
                                                            checked={checked}
                                                            onChange={() => setEquipmentField('equipment_type', type)}
                                                            className="accent-red-600"
                                                        />
                                                        {type}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {equipment.equipment_type === 'Otro' && (
                                            <input
                                                type="text"
                                                value={equipment.equipment_type_other}
                                                onChange={(e) => setEquipmentField('equipment_type_other', e.target.value)}
                                                placeholder="Ej: impresora, tablet, segundo monitor…"
                                                className={`${clInput} mt-2`}
                                                maxLength={150}
                                            />
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-gray-700 font-medium text-sm">
                                            ¿Para qué se va a usar? <span className="text-red-600">*</span>
                                        </label>
                                        <textarea
                                            value={equipment.purpose}
                                            onChange={(e) => setEquipmentField('purpose', e.target.value)}
                                            placeholder="Ej: puesto nuevo de facturación, reemplazo de una PC que no enciende…"
                                            rows={3}
                                            className={`${clInput} mt-1`}
                                            maxLength={2000}
                                        />
                                    </div>

                                    <div>
                                        <span className="block text-gray-700 font-medium text-sm mb-1.5">
                                            ¿Necesita algún programa o acceso?{' '}
                                            <span className="text-gray-500 font-normal">(marcá los que correspondan)</span>
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {SOFTWARE_OPTIONS.map((opt) => {
                                                const checked = equipment.software_options.includes(opt);
                                                return (
                                                    <label
                                                        key={opt}
                                                        className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${
                                                            checked
                                                                ? 'border-red-300 bg-white text-gray-900 ring-2 ring-red-100'
                                                                : 'border-gray-200 bg-white/70 text-gray-700 hover:bg-white'
                                                        }`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => toggleSoftware(opt)}
                                                            className="accent-red-600"
                                                        />
                                                        {opt}
                                                    </label>
                                                );
                                            })}
                                        </div>
                                        {equipment.software_options.includes(SOFTWARE_EMAIL) && (
                                            <div className="mt-2">
                                                <label className="block text-gray-700 text-xs font-medium">
                                                    ¿Cómo se va a llamar la cuenta de correo? <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={equipment.email_account}
                                                    onChange={(e) => setEquipmentField('email_account', e.target.value)}
                                                    placeholder="Ej: juan.perez@bacarsa.com.ar"
                                                    className={`${clInput} mt-1`}
                                                    maxLength={150}
                                                />
                                            </div>
                                        )}
                                        {equipment.software_options.includes(SOFTWARE_OTHER) && (
                                            <div className="mt-2">
                                                <label className="block text-gray-700 text-xs font-medium">
                                                    ¿Qué otro programa necesita? <span className="text-red-600">*</span>
                                                </label>
                                                <input
                                                    type="text"
                                                    value={equipment.software_other}
                                                    onChange={(e) => setEquipmentField('software_other', e.target.value)}
                                                    placeholder="Ej: AutoCAD, sistema de facturación…"
                                                    className={`${clInput} mt-1`}
                                                    maxLength={500}
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-gray-700 font-medium text-sm">
                                                ¿A quién se le asigna? <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={equipment.assigned_person}
                                                onChange={(e) => setEquipmentField('assigned_person', e.target.value)}
                                                placeholder="Ej: Juan Pérez"
                                                className={`${clInput} mt-1`}
                                                maxLength={150}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-gray-700 font-medium text-sm">
                                                ¿A dónde se asigna? <span className="text-red-600">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={equipment.assigned_location}
                                                onChange={(e) => setEquipmentField('assigned_location', e.target.value)}
                                                placeholder="Ej: Administración - Planta Córdoba"
                                                className={`${clInput} mt-1`}
                                                maxLength={150}
                                            />
                                        </div>
                                    </div>
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
                            className={`${clInput} mt-1`}
                            required
                        >
                            <option value="low">Baja</option>
                            <option value="medium">Media</option>
                            <option value="high">Alta</option>
                            <option value="urgent" className="text-red-600 font-bold">
                                Urgente
                            </option>
                        </select>
                    </div>

                    {/* 5. Descripción */}
                    <div className="bg-gray-50 p-3 rounded border">
                        <label className="block text-gray-700 font-bold mb-1">
                            {isEquipmentRequest ? 'Comentarios adicionales' : 'Descripción'}{' '}
                            <span className="text-xs font-normal text-gray-500">
                                {isEquipmentRequest ? '(opcional)' : '(la IA puede sugerir prioridad o área)'}
                            </span>
                        </label>
                        <textarea
                            name="description"
                            value={formData.description || ''}
                            onChange={handleChange}
                            placeholder={
                                isEquipmentRequest
                                    ? 'Algo más que el responsable deba saber (urgencia, presupuesto, etc.)'
                                    : 'Detalle del pedido o incidente...'
                            }
                            rows={isEquipmentRequest ? 3 : 5}
                            className={`${clInput} mt-1 ${isEquipmentRequest ? '' : 'min-h-[120px]'}`}
                            required={!isEquipmentRequest}
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
                                        className={`${clInput} mt-1`}
                                        required
                                    >
                                        <option value="">-- Seleccioná ubicación --</option>
                                        {locations.map((loc) => (
                                            <option key={loc.id} value={loc.id}>
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
                                        className={`${clInput} mt-1`}
                                    >
                                        <option value="">-- Ninguno --</option>
                                        {depositarios.map((dep) => (
                                            <option key={dep.id} value={dep.id}>
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
                                <label className="block text-gray-700 font-medium">Solicitante</label>
                                <p className="text-xs text-slate-600 mt-0.5 mb-1">
                                    Podés registrarte a vos como solicitante o elegir un cliente.
                                </p>
                                <select
                                    name="user_id"
                                    value={formData.user_id || ''}
                                    onChange={handleChange}
                                    className={`${clInput} mt-1`}
                                >
                                    {loggedInUser?.id ? (
                                        <option value={loggedInUser.id}>
                                            Yo ({loggedInUser.username}) — a mi nombre
                                        </option>
                                    ) : (
                                        <option value="">— Seleccioná solicitante —</option>
                                    )}
                                    {users
                                        .filter((u) => u.role === 'client')
                                        .map((client) => (
                                            <option key={client.id} value={client.id}>
                                                {client.username}
                                            </option>
                                        ))}
                                </select>
                                <button
                                    type="button"
                                    className="mt-2 text-sm font-medium text-blue-700 hover:text-blue-900 underline-offset-2 hover:underline"
                                    onClick={() => {
                                        if (!loggedInUser?.id) return;
                                        setFormData((prev) => ({
                                            ...prev,
                                            user_id: loggedInUser.id,
                                        }));
                                        setIsCustomCategory(false);
                                        setIsOther(false);
                                    }}
                                >
                                    Crear a mi nombre
                                </button>
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
                                            className={`${clInput} mt-1`}
                                            required
                                        >
                                            <option value="">-- Ubicación --</option>
                                            {locations.map((loc) => (
                                                <option key={loc.id} value={loc.id}>
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
                                            className={`${clInput} mt-1`}
                                        >
                                            <option value="">-- Ninguno --</option>
                                            {depositarios.map((dep) => (
                                                <option key={dep.id} value={dep.id}>
                                                    {dep.alias} (S/N: {dep.serial_number})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-gray-700 font-medium">Agentes asignados</label>
                                <div className={`${clInput} mt-1 max-h-40 overflow-y-auto space-y-1 py-2`}>
                                    {assignableStaff.length === 0 ? (
                                        <p className="text-sm text-gray-500 px-1">No hay agentes disponibles.</p>
                                    ) : (
                                        assignableStaff.map((u) => {
                                            const checked = (formData.assigned_to_user_ids || []).includes(u.id);
                                            const label =
                                                u.first_name && u.last_name
                                                    ? `${u.first_name} ${u.last_name}`
                                                    : u.username;
                                            const isPrimary =
                                                checked && (formData.assigned_to_user_ids || [])[0] === u.id;
                                            return (
                                                <label
                                                    key={u.id}
                                                    className="flex items-center gap-2 cursor-pointer text-sm text-gray-800 px-1 py-0.5 hover:bg-gray-50 rounded"
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleAssignee(u.id)}
                                                        className="rounded border-gray-300 text-blue-600"
                                                    />
                                                    <span>
                                                        {label}
                                                        {u.role === 'admin' ? ' (Admin)' : ''}
                                                        {isPrimary ? ' — responsable' : ''}
                                                    </span>
                                                </label>
                                            );
                                        })
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    Podés elegir 2 o más. El primero marcado queda como responsable principal.
                                </p>
                                {willAutoAssignToSelf && loggedInUser?.username && (
                                    <p className="text-xs mt-2 rounded-md border border-blue-200 bg-blue-50 text-blue-800 px-2 py-1">
                                        Se autoasignará a {loggedInUser.username} al crear este ticket a tu nombre.
                                    </p>
                                )}
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
                                    className="rounded border-gray-300 text-red-600 focus:ring-2 focus:ring-blue-100 focus:border-blue-400"
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
                                        className={`${clInput} mt-1`}
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
                                            className={`${clInput} mt-1`}
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
                            className={`w-full text-sm mt-2 ${clInput} file:mr-3 file:rounded-lg file:border-0 file:bg-gray-100 file:px-3 file:py-1.5 file:text-sm file:font-medium text-gray-900`}
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2.5 px-5 rounded-xl"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm"
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
