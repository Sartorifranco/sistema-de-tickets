import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import {
    Plus,
    Pencil,
    Trash2,
    Search,
    X,
    Copy,
    Eye,
    EyeOff,
    ChevronUp,
    ChevronDown,
    Layers,
    AlertTriangle,
    Building2,
    Globe,
    ArrowRightLeft,
    Info,
    Ticket,
    FolderOpen,
    Check,
    GripVertical,
} from 'lucide-react';
import api from '../config/axiosConfig';
import { clCard, clInput, clModalPanel, priorityPillClass } from '../utils/cleanLightUi';

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

interface Department {
    id: number;
    name: string;
    company_id?: number | null;
    company_name?: string | null;
}
interface Company {
    id: number;
    name: string;
}
interface Category {
    id: number;
    name: string;
    company_id: number | null;
    company_name: string | null;
    is_active: boolean;
    sort_order: number;
    problem_count: number;
    ticket_count: number;
}
type Priority = 'low' | 'medium' | 'high' | 'urgent';
interface Problem {
    id: number;
    title: string;
    description: string;
    category_id: number;
    department_id: number;
    is_active: boolean;
    sort_order: number;
    default_priority: Priority | null;
    category_name: string | null;
    department_name: string | null;
    department_company_name: string | null;
    ticket_count: number;
}
interface Features {
    customization: boolean;
}

type Selection = 'all' | number;
type StatusFilter = 'all' | 'active' | 'inactive';

const PRIORITY_LABEL: Record<Priority, string> = {
    low: 'Baja',
    medium: 'Media',
    high: 'Alta',
    urgent: 'Urgente',
};

const HELP_DISMISSED_KEY = 'problems-help-dismissed';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function apiError(err: unknown, fallback: string): string {
    const anyErr = err as { response?: { data?: { message?: string } } };
    return anyErr?.response?.data?.message || fallback;
}

function normalizeCategory(raw: Record<string, unknown>): Category {
    return {
        id: Number(raw.id),
        name: String(raw.name ?? ''),
        company_id: raw.company_id != null ? Number(raw.company_id) : null,
        company_name: raw.company_name != null ? String(raw.company_name) : null,
        is_active: raw.is_active == null ? true : Number(raw.is_active) === 1 || raw.is_active === true,
        sort_order: Number(raw.sort_order ?? 0),
        problem_count: Number(raw.problem_count ?? 0),
        ticket_count: Number(raw.ticket_count ?? 0),
    };
}

function normalizeProblem(raw: Record<string, unknown>): Problem {
    const pr = raw.default_priority as string | null | undefined;
    return {
        id: Number(raw.id),
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        category_id: Number(raw.category_id),
        department_id: Number(raw.department_id),
        is_active: raw.is_active == null ? true : Number(raw.is_active) === 1 || raw.is_active === true,
        sort_order: Number(raw.sort_order ?? 0),
        default_priority: pr && pr in PRIORITY_LABEL ? (pr as Priority) : null,
        category_name: raw.category_name != null ? String(raw.category_name) : null,
        department_name: raw.department_name != null ? String(raw.department_name) : null,
        department_company_name: raw.department_company_name != null ? String(raw.department_company_name) : null,
        ticket_count: Number(raw.ticket_count ?? 0),
    };
}

/**
 * Los departamentos son por empresa y los nombres se repiten ("Administración" x4),
 * así que se muestran agrupados por empresa, con la empresa de la categoría primero.
 */
const DepartmentOptions: React.FC<{ departments: Department[]; preferredCompanyId?: number | null }> = ({
    departments,
    preferredCompanyId,
}) => {
    const groups = new Map<string, Department[]>();
    for (const d of departments) {
        const key = d.company_name || 'Sin empresa';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(d);
    }
    const entries = Array.from(groups.entries()).sort(([a, da], [b, db]) => {
        const pa = preferredCompanyId != null && da[0]?.company_id === preferredCompanyId ? 0 : 1;
        const pb = preferredCompanyId != null && db[0]?.company_id === preferredCompanyId ? 0 : 1;
        return pa - pb || a.localeCompare(b, 'es');
    });
    return (
        <>
            {entries.map(([company, list]) => (
                <optgroup key={company} label={company}>
                    {list.map((d) => (
                        <option key={d.id} value={d.id}>
                            {d.name}
                        </option>
                    ))}
                </optgroup>
            ))}
        </>
    );
};

function scopeLabel(cat: Pick<Category, 'company_id' | 'company_name'>): string {
    if (cat.company_id == null) return 'Todas las empresas';
    return cat.company_name || `Empresa #${cat.company_id}`;
}

function plural(n: number, singular: string, pluralForm: string): string {
    return `${n} ${n === 1 ? singular : pluralForm}`;
}

const sortCategories = (list: Category[]) =>
    [...list].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'es'));

const sortProblems = (list: Problem[]) =>
    [...list].sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'es'));

// ---------------------------------------------------------------------------
// UI básicos
// ---------------------------------------------------------------------------

const ModalShell: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    icon: React.ReactNode;
    title: string;
    subtitle?: string;
    maxWidth?: string;
    children: React.ReactNode;
}> = ({ isOpen, onClose, icon, title, subtitle, maxWidth = 'max-w-lg', children }) => {
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${clModalPanel} ${maxWidth}`}>
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            {icon}
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 break-words">{title}</h2>
                            {subtitle && <p className="text-xs text-slate-500 break-words">{subtitle}</p>}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                        aria-label="Cerrar"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
};

const btnPrimary =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:opacity-60';
const btnSecondary =
    'inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200/80 disabled:opacity-60';
const btnGhost =
    'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50';
const iconBtn = 'p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-40';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';
const hintCls = 'text-xs text-gray-500 mt-1';

const ScopeBadge: React.FC<{ category: Pick<Category, 'company_id' | 'company_name'>; light?: boolean }> = ({
    category,
    light,
}) => {
    const generic = category.company_id == null;
    const Icon = generic ? Globe : Building2;
    const cls = light
        ? 'bg-white/20 text-white'
        : generic
          ? 'bg-slate-100 text-slate-700'
          : 'bg-indigo-50 text-indigo-700';
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${cls}`}>
            <Icon className="w-3 h-3" />
            {scopeLabel(category)}
        </span>
    );
};

const InactiveBadge: React.FC<{ light?: boolean }> = ({ light }) => (
    <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold ${
            light ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
        }`}
    >
        <EyeOff className="w-3 h-3" /> Oculto
    </span>
);

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }> = ({
    checked,
    onChange,
    label,
    hint,
}) => (
    <label className="flex items-start gap-3 cursor-pointer select-none">
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            onClick={() => onChange(!checked)}
            className={`relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                checked ? 'bg-emerald-500' : 'bg-gray-300'
            }`}
        >
            <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                    checked ? 'translate-x-5' : 'translate-x-0.5'
                }`}
            />
        </button>
        <span className="min-w-0">
            <span className="block text-sm font-medium text-gray-800">{label}</span>
            {hint && <span className="block text-xs text-gray-500">{hint}</span>}
        </span>
    </label>
);

// ---------------------------------------------------------------------------
// Modal: confirmación
// ---------------------------------------------------------------------------

interface ConfirmState {
    title: string;
    message: React.ReactNode;
    confirmLabel?: string;
    onConfirm: () => Promise<void> | void;
}

const ConfirmModal: React.FC<{ state: ConfirmState | null; onClose: () => void }> = ({ state, onClose }) => {
    const [working, setWorking] = useState(false);
    if (!state) return null;
    const run = async () => {
        setWorking(true);
        try {
            await state.onConfirm();
            onClose();
        } finally {
            setWorking(false);
        }
    };
    return (
        <ModalShell
            isOpen
            onClose={onClose}
            icon={<AlertTriangle className="w-5 h-5" />}
            title={state.title}
            maxWidth="max-w-md"
        >
            <div className="px-6 py-5 space-y-4">
                <div className="text-sm text-gray-700 space-y-2">{state.message}</div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={btnSecondary}>
                        Cancelar
                    </button>
                    <button type="button" onClick={run} disabled={working} className={btnPrimary}>
                        {working ? 'Aplicando…' : state.confirmLabel || 'Confirmar'}
                    </button>
                </div>
            </div>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Modal: categoría (crear / editar)
// ---------------------------------------------------------------------------

const CategoryFormModal: React.FC<{
    isOpen: boolean;
    editing: Category | null;
    companies: Company[];
    features: Features;
    onClose: () => void;
    onSaved: (newId?: number) => void;
}> = ({ isOpen, editing, companies, features, onClose, onSaved }) => {
    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState<string>('');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setName(editing?.name || '');
        setCompanyId(editing?.company_id != null ? String(editing.company_id) : '');
        setIsActive(editing ? editing.is_active : true);
    }, [isOpen, editing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            toast.warn('El nombre de la categoría es obligatorio.');
            return;
        }
        setSaving(true);
        try {
            const payload = { name: trimmed, company_id: companyId === '' ? null : Number(companyId), is_active: isActive };
            if (editing) {
                await api.put(`/api/admin/categories/${editing.id}`, payload);
                toast.success('Categoría actualizada.');
                onSaved();
            } else {
                const res = await api.post('/api/admin/categories', payload);
                toast.success('Categoría creada.');
                onSaved(res.data?.data?.id);
            }
            onClose();
        } catch (err) {
            toast.error(apiError(err, 'No se pudo guardar la categoría.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            icon={<FolderOpen className="w-5 h-5" />}
            title={editing ? 'Editar categoría' : 'Nueva categoría'}
            subtitle={
                editing
                    ? `Modificando "${editing.name}"`
                    : 'Una categoría agrupa problemas y es lo primero que elige el usuario'
            }
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                    <label htmlFor="cat-name" className={labelCls}>
                        Nombre
                    </label>
                    <input
                        id="cat-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={clInput}
                        placeholder="Ej.: Impresoras, Depositarios, Accesos"
                        autoFocus
                        required
                        maxLength={100}
                    />
                </div>
                <div>
                    <label htmlFor="cat-company" className={labelCls}>
                        ¿Quién la ve?
                    </label>
                    <select
                        id="cat-company"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className={clInput}
                    >
                        <option value="">Todas las empresas (genérica)</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                                Solo {c.name}
                            </option>
                        ))}
                    </select>
                    <p className={hintCls}>
                        Las categorías genéricas aparecen para todos. Si elegís una empresa, solo sus usuarios la
                        verán además de las genéricas.
                    </p>
                </div>
                {features.customization && (
                    <Toggle
                        checked={isActive}
                        onChange={setIsActive}
                        label="Visible en el formulario de tickets"
                        hint="Si la ocultás, nadie podrá elegirla, pero se conservan sus problemas y el historial."
                    />
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={btnSecondary}>
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving} className={btnPrimary}>
                        {saving ? 'Guardando…' : editing ? 'Guardar cambios' : <><Plus className="w-4 h-4" /> Crear categoría</>}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Modal: duplicar categoría
// ---------------------------------------------------------------------------

const DuplicateCategoryModal: React.FC<{
    category: Category | null;
    companies: Company[];
    onClose: () => void;
    onSaved: (newId?: number) => void;
}> = ({ category, companies, onClose, onSaved }) => {
    const [name, setName] = useState('');
    const [companyId, setCompanyId] = useState<string>('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!category) return;
        setName(`${category.name} (copia)`);
        setCompanyId(category.company_id != null ? String(category.company_id) : '');
    }, [category]);

    if (!category) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await api.post(`/api/admin/categories/${category.id}/duplicate`, {
                name: name.trim(),
                company_id: companyId === '' ? null : Number(companyId),
            });
            toast.success(`Categoría duplicada con ${plural(category.problem_count, 'problema', 'problemas')}.`);
            onSaved(res.data?.data?.id);
            onClose();
        } catch (err) {
            toast.error(apiError(err, 'No se pudo duplicar la categoría.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <ModalShell
            isOpen
            onClose={onClose}
            icon={<Copy className="w-5 h-5" />}
            title="Duplicar categoría"
            subtitle={`Se copia "${category.name}" con sus ${plural(category.problem_count, 'problema', 'problemas')}`}
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                    <label htmlFor="dup-name" className={labelCls}>
                        Nombre de la copia
                    </label>
                    <input
                        id="dup-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={clInput}
                        required
                        autoFocus
                        maxLength={100}
                    />
                </div>
                <div>
                    <label htmlFor="dup-company" className={labelCls}>
                        ¿Quién la ve?
                    </label>
                    <select
                        id="dup-company"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className={clInput}
                    >
                        <option value="">Todas las empresas (genérica)</option>
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                                Solo {c.name}
                            </option>
                        ))}
                    </select>
                    <p className={hintCls}>
                        Útil para darle a una empresa su propia versión de una categoría genérica y después ajustarla.
                    </p>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={btnSecondary}>
                        Cancelar
                    </button>
                    <button type="submit" disabled={saving} className={btnPrimary}>
                        {saving ? 'Duplicando…' : <><Copy className="w-4 h-4" /> Duplicar</>}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Modal: problema (crear / editar)
// ---------------------------------------------------------------------------

const ProblemFormModal: React.FC<{
    isOpen: boolean;
    editing: Problem | null;
    defaultCategoryId: number | null;
    categories: Category[];
    departments: Department[];
    features: Features;
    onClose: () => void;
    onSaved: () => void;
}> = ({ isOpen, editing, defaultCategoryId, categories, departments, features, onClose, onSaved }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState<string>('');
    const [departmentId, setDepartmentId] = useState<string>('');
    const [priority, setPriority] = useState<string>('');
    const [isActive, setIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [keepOpen, setKeepOpen] = useState(false);
    const singleDepartmentId = departments.length === 1 ? departments[0].id : null;

    useEffect(() => {
        if (!isOpen) return;
        setTitle(editing?.title || '');
        setDescription(editing?.description || '');
        setCategoryId(
            editing ? String(editing.category_id) : defaultCategoryId != null ? String(defaultCategoryId) : ''
        );
        setDepartmentId(
            editing ? String(editing.department_id) : singleDepartmentId != null ? String(singleDepartmentId) : ''
        );
        setPriority(editing?.default_priority || '');
        setIsActive(editing ? editing.is_active : true);
        setKeepOpen(false);
    }, [isOpen, editing, defaultCategoryId, singleDepartmentId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) {
            toast.warn('El título es obligatorio.');
            return;
        }
        if (!categoryId) {
            toast.warn('Elegí una categoría.');
            return;
        }
        if (!departmentId) {
            toast.warn('Elegí el departamento que atiende.');
            return;
        }
        setSaving(true);
        try {
            const payload = {
                title: title.trim(),
                description: description.trim(),
                category_id: Number(categoryId),
                department_id: Number(departmentId),
                default_priority: priority || null,
                is_active: isActive,
            };
            if (editing) {
                await api.put(`/api/admin/problems/${editing.id}`, payload);
                toast.success('Problema actualizado.');
            } else {
                await api.post('/api/admin/problems', payload);
                toast.success(`Problema "${payload.title}" creado.`);
            }
            onSaved();
            if (!editing && keepOpen) {
                setTitle('');
                setDescription('');
                setPriority('');
            } else {
                onClose();
            }
        } catch (err) {
            toast.error(apiError(err, 'No se pudo guardar el problema.'));
        } finally {
            setSaving(false);
        }
    };

    const sortedCats = sortCategories(categories);

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            icon={<Layers className="w-5 h-5" />}
            title={editing ? 'Editar problema' : 'Nuevo problema'}
            subtitle={
                editing
                    ? `Modificando "${editing.title}"`
                    : 'Lo que el usuario elige después de la categoría; define a qué departamento va el ticket'
            }
            maxWidth="max-w-2xl"
        >
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                <div>
                    <label htmlFor="prob-title" className={labelCls}>
                        Título
                    </label>
                    <input
                        id="prob-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        className={clInput}
                        placeholder="Ej.: Impresora no responde"
                        autoFocus
                        required
                        maxLength={255}
                    />
                    <p className={hintCls}>Es el texto que aparece en el desplegable y se usa como título del ticket.</p>
                </div>
                <div>
                    <label htmlFor="prob-desc" className={labelCls}>
                        Descripción sugerida <span className="text-gray-400 font-normal">(opcional)</span>
                    </label>
                    <textarea
                        id="prob-desc"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className={`${clInput} min-h-[84px] resize-y`}
                        placeholder="Se precarga en la descripción del ticket; el usuario puede completarla."
                        maxLength={1000}
                    />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="prob-cat" className={labelCls}>
                            Categoría
                        </label>
                        <select
                            id="prob-cat"
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className={clInput}
                            required
                        >
                            <option value="">Seleccioná…</option>
                            {sortedCats.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.name} · {scopeLabel(c)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="prob-dept" className={labelCls}>
                            Departamento que atiende
                        </label>
                        <select
                            id="prob-dept"
                            value={departmentId}
                            onChange={(e) => setDepartmentId(e.target.value)}
                            className={clInput}
                            required
                        >
                            <option value="">Seleccioná…</option>
                            <DepartmentOptions
                                departments={departments}
                                preferredCompanyId={
                                    categoryId ? sortedCats.find((c) => c.id === Number(categoryId))?.company_id : null
                                }
                            />
                        </select>
                        <p className={hintCls}>Los departamentos están agrupados por empresa.</p>
                    </div>
                </div>
                {features.customization && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="prob-priority" className={labelCls}>
                                Prioridad sugerida
                            </label>
                            <select
                                id="prob-priority"
                                value={priority}
                                onChange={(e) => setPriority(e.target.value)}
                                className={clInput}
                            >
                                <option value="">Sin sugerencia (queda Media)</option>
                                {(Object.keys(PRIORITY_LABEL) as Priority[]).map((p) => (
                                    <option key={p} value={p}>
                                        {PRIORITY_LABEL[p]}
                                    </option>
                                ))}
                            </select>
                            <p className={hintCls}>Se precarga al elegir el problema; el usuario puede cambiarla.</p>
                        </div>
                        <div className="pt-1 sm:pt-7">
                            <Toggle
                                checked={isActive}
                                onChange={setIsActive}
                                label="Visible en el formulario"
                                hint="Ocultalo para sacarlo del desplegable sin borrarlo."
                            />
                        </div>
                    </div>
                )}
                <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
                    {!editing ? (
                        <label className="inline-flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={keepOpen}
                                onChange={(e) => setKeepOpen(e.target.checked)}
                                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                            />
                            Crear otro al guardar
                        </label>
                    ) : (
                        <span />
                    )}
                    <div className="flex flex-col-reverse sm:flex-row gap-3">
                        <button type="button" onClick={onClose} className={btnSecondary}>
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className={btnPrimary}>
                            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : <><Plus className="w-4 h-4" /> Crear problema</>}
                        </button>
                    </div>
                </div>
            </form>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Modal: destino de acción masiva (mover / cambiar departamento)
// ---------------------------------------------------------------------------

const BulkTargetModal: React.FC<{
    mode: 'move' | 'department' | null;
    count: number;
    categories: Category[];
    departments: Department[];
    onClose: () => void;
    onConfirm: (targetId: number) => Promise<void>;
}> = ({ mode, count, categories, departments, onClose, onConfirm }) => {
    const [target, setTarget] = useState('');
    const [working, setWorking] = useState(false);

    useEffect(() => {
        setTarget('');
    }, [mode]);

    if (!mode) return null;
    const isMove = mode === 'move';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!target) return;
        setWorking(true);
        try {
            await onConfirm(Number(target));
            onClose();
        } catch {
            // el error ya se notificó con toast
        } finally {
            setWorking(false);
        }
    };

    return (
        <ModalShell
            isOpen
            onClose={onClose}
            icon={<ArrowRightLeft className="w-5 h-5" />}
            title={isMove ? 'Mover a otra categoría' : 'Cambiar departamento'}
            subtitle={`Se aplica a ${plural(count, 'problema seleccionado', 'problemas seleccionados')}`}
            maxWidth="max-w-md"
        >
            <form onSubmit={submit} className="px-6 py-5 space-y-4">
                <div>
                    <label htmlFor="bulk-target" className={labelCls}>
                        {isMove ? 'Categoría destino' : 'Departamento que atiende'}
                    </label>
                    <select
                        id="bulk-target"
                        value={target}
                        onChange={(e) => setTarget(e.target.value)}
                        className={clInput}
                        required
                        autoFocus
                    >
                        <option value="">Seleccioná…</option>
                        {isMove
                            ? sortCategories(categories).map((c) => (
                                  <option key={c.id} value={c.id}>
                                      {c.name} · {scopeLabel(c)}
                                  </option>
                              ))
                            : <DepartmentOptions departments={departments} />}
                    </select>
                </div>
                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                    <button type="button" onClick={onClose} className={btnSecondary}>
                        Cancelar
                    </button>
                    <button type="submit" disabled={working || !target} className={btnPrimary}>
                        {working ? 'Aplicando…' : 'Aplicar'}
                    </button>
                </div>
            </form>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Modal: vista previa (lo que ve una empresa en el formulario)
// ---------------------------------------------------------------------------

const PreviewModal: React.FC<{
    isOpen: boolean;
    categories: Category[];
    problems: Problem[];
    companies: Company[];
    onClose: () => void;
}> = ({ isOpen, categories, problems, companies, onClose }) => {
    const [companyId, setCompanyId] = useState<string>('');

    useEffect(() => {
        if (isOpen && companyId === '' && companies.length > 0) setCompanyId(String(companies[0].id));
    }, [isOpen, companies, companyId]);

    const visibleCats = useMemo(() => {
        const cid = companyId === '' ? null : Number(companyId);
        return sortCategories(
            categories.filter((c) => c.is_active && (c.company_id == null || c.company_id === cid))
        );
    }, [categories, companyId]);

    const hiddenCount = useMemo(() => {
        const cid = companyId === '' ? null : Number(companyId);
        return categories.filter((c) => !c.is_active && (c.company_id == null || c.company_id === cid)).length;
    }, [categories, companyId]);

    return (
        <ModalShell
            isOpen={isOpen}
            onClose={onClose}
            icon={<Eye className="w-5 h-5" />}
            title="Vista previa del formulario"
            subtitle="Así queda el desplegable de categorías y problemas para los usuarios de una empresa"
            maxWidth="max-w-3xl"
        >
            <div className="px-6 py-5 space-y-4">
                <div>
                    <label htmlFor="preview-company" className={labelCls}>
                        Empresa
                    </label>
                    <select
                        id="preview-company"
                        value={companyId}
                        onChange={(e) => setCompanyId(e.target.value)}
                        className={clInput}
                    >
                        {companies.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                        <option value="">(Usuario sin empresa: solo genéricas)</option>
                    </select>
                    <p className={hintCls}>
                        Ve las categorías genéricas más las propias de su empresa. Lo oculto no aparece.
                        {hiddenCount > 0 && ` Hay ${plural(hiddenCount, 'categoría oculta', 'categorías ocultas')} para este caso.`}
                    </p>
                </div>

                {visibleCats.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-600">
                        Esta empresa no vería ninguna categoría. Creá una genérica o una específica para ella.
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {visibleCats.map((cat) => {
                                            // El formulario muestra un único "Otro..." al final: si hay uno cargado lo reutiliza
                                            const probs = sortProblems(
                                                problems.filter(
                                                    (p) =>
                                                        p.category_id === cat.id &&
                                                        p.is_active &&
                                                        !/^otros?\s*(\.{3}|…)?$/i.test(p.title.trim())
                                                )
                                            );                            return (
                                <div key={cat.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-2">
                                        <p className="font-semibold text-sm text-gray-900 break-words">{cat.name}</p>
                                        <ScopeBadge category={cat} />
                                    </div>
                                    {probs.length === 0 ? (
                                        <p className="text-xs text-amber-700">
                                            Sin problemas visibles: el usuario solo verá «Otro…».
                                        </p>
                                    ) : (
                                        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
                                            {probs.map((p) => (
                                                <li key={p.id} className="break-words">
                                                    {p.title}
                                                    {p.default_priority && (
                                                        <span
                                                            className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityPillClass(
                                                                p.default_priority
                                                            )}`}
                                                        >
                                                            {PRIORITY_LABEL[p.default_priority]}
                                                        </span>
                                                    )}
                                                </li>
                                            ))}
                                            <li className="text-gray-400 italic">Otro… (título libre)</li>
                                        </ol>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </ModalShell>
    );
};

// ---------------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------------

const AdminProblemsPage: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [features, setFeatures] = useState<Features>({ customization: false });
    const [loading, setLoading] = useState(true);

    const [selection, setSelection] = useState<Selection>('all');
    const [categorySearch, setCategorySearch] = useState('');
    const [problemSearch, setProblemSearch] = useState('');
    const [deptFilter, setDeptFilter] = useState<string>('');
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [showHelp, setShowHelp] = useState(() => localStorage.getItem(HELP_DISMISSED_KEY) !== '1');

    const [categoryModal, setCategoryModal] = useState<{ open: boolean; editing: Category | null }>({
        open: false,
        editing: null,
    });
    const [problemModal, setProblemModal] = useState<{ open: boolean; editing: Problem | null }>({
        open: false,
        editing: null,
    });
    const [duplicating, setDuplicating] = useState<Category | null>(null);
    const [bulkMode, setBulkMode] = useState<'move' | 'department' | null>(null);
    const [previewOpen, setPreviewOpen] = useState(false);
    const [confirm, setConfirm] = useState<ConfirmState | null>(null);

    const fetchData = useCallback(async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const res = await api.get('/api/admin/problems-all');
            const d = res.data.data || {};
            setCategories((d.categories || []).map(normalizeCategory));
            setProblems((d.problems || []).map(normalizeProblem));
            setDepartments(d.departments || []);
            setCompanies(d.companies || []);
            setFeatures({ customization: Boolean(d.features?.customization) });
        } catch {
            toast.error('No se pudieron cargar las problemáticas.');
        } finally {
            if (!silent) setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Limpiar selección al cambiar de vista
    useEffect(() => {
        setSelectedIds(new Set());
    }, [selection, problemSearch, deptFilter, statusFilter]);

    const categoryById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
    const sortedCategories = useMemo(() => sortCategories(categories), [categories]);

    const filteredCategories = useMemo(() => {
        const q = categorySearch.trim().toLowerCase();
        if (!q) return sortedCategories;
        return sortedCategories.filter(
            (c) => c.name.toLowerCase().includes(q) || scopeLabel(c).toLowerCase().includes(q)
        );
    }, [sortedCategories, categorySearch]);

    const selectedCategory = typeof selection === 'number' ? categoryById.get(selection) : undefined;

    useEffect(() => {
        if (typeof selection === 'number' && !loading && !categoryById.has(selection)) setSelection('all');
    }, [selection, categoryById, loading]);

    const orphanCount = useMemo(
        () => problems.filter((p) => !categoryById.has(p.category_id)).length,
        [problems, categoryById]
    );
    const inactiveProblemCount = useMemo(() => problems.filter((p) => !p.is_active).length, [problems]);

    const visibleProblems = useMemo(() => {
        const q = problemSearch.trim().toLowerCase();
        let list = problems;
        if (typeof selection === 'number') list = list.filter((p) => p.category_id === selection);
        if (deptFilter) list = list.filter((p) => p.department_id === Number(deptFilter));
        if (statusFilter === 'active') list = list.filter((p) => p.is_active);
        if (statusFilter === 'inactive') list = list.filter((p) => !p.is_active);
        if (q) {
            list = list.filter(
                (p) =>
                    p.title.toLowerCase().includes(q) ||
                    p.description.toLowerCase().includes(q) ||
                    (p.category_name || '').toLowerCase().includes(q) ||
                    (p.department_name || '').toLowerCase().includes(q)
            );
        }
        if (typeof selection === 'number') return sortProblems(list);
        // Vista "todas": ordenar por categoría (según su orden) y luego por problema
        const catRank = new Map(sortedCategories.map((c, i) => [c.id, i]));
        return [...list].sort((a, b) => {
            const ra = catRank.get(a.category_id) ?? Number.MAX_SAFE_INTEGER;
            const rb = catRank.get(b.category_id) ?? Number.MAX_SAFE_INTEGER;
            if (ra !== rb) return ra - rb;
            return a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'es');
        });
    }, [problems, selection, deptFilter, statusFilter, problemSearch, sortedCategories]);

    const hasFilters = problemSearch.trim() !== '' || deptFilter !== '' || statusFilter !== 'all';
    const canReorderProblems = features.customization && typeof selection === 'number' && !hasFilters;
    const canReorderCategories = features.customization && categorySearch.trim() === '';

    const allVisibleSelected = visibleProblems.length > 0 && visibleProblems.every((p) => selectedIds.has(p.id));

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };
    const toggleSelectAll = () => {
        setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleProblems.map((p) => p.id)));
    };

    const clearFilters = () => {
        setProblemSearch('');
        setDeptFilter('');
        setStatusFilter('all');
    };

    const dismissHelp = () => {
        setShowHelp(false);
        localStorage.setItem(HELP_DISMISSED_KEY, '1');
    };

    // ---- Acciones: categorías -------------------------------------------------

    const openCreateCategory = () => setCategoryModal({ open: true, editing: null });
    const openEditCategory = (cat: Category) => setCategoryModal({ open: true, editing: cat });

    const toggleCategoryActive = async (cat: Category) => {
        try {
            await api.put(`/api/admin/categories/${cat.id}`, {
                name: cat.name,
                company_id: cat.company_id,
                is_active: !cat.is_active,
            });
            toast.success(cat.is_active ? 'Categoría oculta del formulario.' : 'Categoría visible nuevamente.');
            fetchData(true);
        } catch (err) {
            toast.error(apiError(err, 'No se pudo cambiar la visibilidad.'));
        }
    };

    const askDeleteCategory = (cat: Category) => {
        setConfirm({
            title: `Eliminar "${cat.name}"`,
            confirmLabel: 'Eliminar categoría',
            message: (
                <>
                    <p>
                        Se eliminará la categoría junto con sus{' '}
                        <strong>{plural(cat.problem_count, 'problema predefinido', 'problemas predefinidos')}</strong>.
                    </p>
                    {cat.ticket_count > 0 && (
                        <p className="text-amber-700">
                            Hay {plural(cat.ticket_count, 'ticket creado', 'tickets creados')} con esta categoría: conservan
                            su historial pero quedarán sin categoría.
                        </p>
                    )}
                    {features.customization && (
                        <p className="text-gray-500">
                            Si solo querés sacarla del formulario, mejor ocultala desde la cabecera.
                        </p>
                    )}
                </>
            ),
            onConfirm: async () => {
                try {
                    await api.delete(`/api/admin/categories/${cat.id}`);
                    toast.success('Categoría eliminada.');
                    if (selection === cat.id) setSelection('all');
                    await fetchData(true);
                } catch (err) {
                    toast.error(apiError(err, 'No se pudo eliminar la categoría.'));
                }
            },
        });
    };

    const moveCategory = async (cat: Category, dir: -1 | 1) => {
        const idx = sortedCategories.findIndex((c) => c.id === cat.id);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= sortedCategories.length) return;
        const next = [...sortedCategories];
        [next[idx], next[target]] = [next[target], next[idx]];
        setCategories(next.map((c, i) => ({ ...c, sort_order: i + 1 })));
        try {
            await api.put('/api/admin/categories/reorder', { ordered_ids: next.map((c) => c.id) });
        } catch (err) {
            toast.error(apiError(err, 'No se pudo guardar el orden.'));
            fetchData(true);
        }
    };

    // ---- Acciones: problemas --------------------------------------------------

    const openCreateProblem = () => setProblemModal({ open: true, editing: null });
    const openEditProblem = (p: Problem) => setProblemModal({ open: true, editing: p });

    const toggleProblemActive = async (p: Problem) => {
        try {
            await api.put(`/api/admin/problems/${p.id}`, {
                title: p.title,
                description: p.description,
                category_id: p.category_id,
                department_id: p.department_id,
                default_priority: p.default_priority,
                is_active: !p.is_active,
            });
            setProblems((prev) => prev.map((x) => (x.id === p.id ? { ...x, is_active: !p.is_active } : x)));
        } catch (err) {
            toast.error(apiError(err, 'No se pudo cambiar la visibilidad.'));
        }
    };

    const askDeleteProblem = (p: Problem) => {
        setConfirm({
            title: `Eliminar "${p.title}"`,
            confirmLabel: 'Eliminar problema',
            message: (
                <>
                    <p>El problema dejará de aparecer en el formulario de tickets.</p>
                    {p.ticket_count > 0 && (
                        <p className="text-gray-500">
                            Los {plural(p.ticket_count, 'ticket ya creado', 'tickets ya creados')} con este título no se
                            modifican.
                        </p>
                    )}
                </>
            ),
            onConfirm: async () => {
                try {
                    await api.delete(`/api/admin/problems/${p.id}`);
                    toast.success('Problema eliminado.');
                    await fetchData(true);
                } catch (err) {
                    toast.error(apiError(err, 'No se pudo eliminar el problema.'));
                }
            },
        });
    };

    const moveProblem = async (p: Problem, dir: -1 | 1) => {
        const idx = visibleProblems.findIndex((x) => x.id === p.id);
        const target = idx + dir;
        if (idx < 0 || target < 0 || target >= visibleProblems.length) return;
        const next = [...visibleProblems];
        [next[idx], next[target]] = [next[target], next[idx]];
        const orderMap = new Map(next.map((x, i) => [x.id, i + 1]));
        setProblems((prev) => prev.map((x) => (orderMap.has(x.id) ? { ...x, sort_order: orderMap.get(x.id)! } : x)));
        try {
            await api.put('/api/admin/problems/reorder', { ordered_ids: next.map((x) => x.id) });
        } catch (err) {
            toast.error(apiError(err, 'No se pudo guardar el orden.'));
            fetchData(true);
        }
    };

    const runBulk = async (action: string, extra: Record<string, unknown> = {}) => {
        const ids = Array.from(selectedIds);
        try {
            await api.patch('/api/admin/problems/bulk', { ids, action, ...extra });
            toast.success(`Cambios aplicados a ${plural(ids.length, 'problema', 'problemas')}.`);
            setSelectedIds(new Set());
            await fetchData(true);
        } catch (err) {
            toast.error(apiError(err, 'No se pudo aplicar la acción.'));
            throw err;
        }
    };

    const askBulkDelete = () => {
        const n = selectedIds.size;
        setConfirm({
            title: `Eliminar ${plural(n, 'problema', 'problemas')}`,
            confirmLabel: 'Eliminar',
            message: <p>Los problemas seleccionados dejarán de aparecer en el formulario. Esta acción no se puede deshacer.</p>,
            onConfirm: () => runBulk('delete').catch(() => undefined),
        });
    };

    // ---- Render ---------------------------------------------------------------

    if (loading) {
        return <div className="text-center p-8 text-gray-600">Cargando problemáticas...</div>;
    }

    const showCategoryColumn = selection === 'all';

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
            {/* Cabecera */}
            <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4 mb-5">
                <div className="min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Problemáticas</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {plural(categories.length, 'categoría', 'categorías')} ·{' '}
                        {plural(problems.length, 'problema predefinido', 'problemas predefinidos')}
                        {inactiveProblemCount > 0 && ` · ${inactiveProblemCount} ocultos`}
                        {orphanCount > 0 && (
                            <span className="text-amber-700"> · {orphanCount} sin categoría válida</span>
                        )}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                    <button type="button" onClick={() => setPreviewOpen(true)} className={btnSecondary}>
                        <Eye className="w-4 h-4" /> Vista previa
                    </button>
                    <button type="button" onClick={openCreateCategory} className={btnSecondary}>
                        <FolderOpen className="w-4 h-4" /> Nueva categoría
                    </button>
                    <button type="button" onClick={openCreateProblem} className={btnPrimary} disabled={categories.length === 0}>
                        <Plus className="w-4 h-4" /> Nuevo problema
                    </button>
                </div>
            </div>

            {showHelp && (
                <div className={`${clCard} p-4 mb-5 border-l-4 border-blue-500 bg-blue-50/40 flex gap-3`}>
                    <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-900/90 min-w-0 flex-1">
                        <p className="font-semibold text-blue-900">¿Cómo funciona?</p>
                        <p className="mt-1">
                            Al crear un ticket el usuario elige una <strong>categoría</strong> y luego un{' '}
                            <strong>problema</strong>. El problema completa el título, una descripción sugerida
                            {features.customization ? ', la prioridad' : ''} y define el <strong>departamento</strong> que
                            lo atiende. Las categorías pueden ser genéricas (todas las empresas) o de una empresa puntual.
                            Usá <strong>Vista previa</strong> para ver exactamente qué le aparece a cada empresa.
                        </p>
                    </div>
                    <button type="button" onClick={dismissHelp} className={iconBtn} aria-label="Ocultar ayuda">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {!features.customization && (
                <div className={`${clCard} p-4 mb-5 border-l-4 border-amber-400 bg-amber-50/50 text-sm text-amber-900`}>
                    <p className="font-semibold">Personalización avanzada pendiente de activar</p>
                    <p className="mt-1">
                        Para poder <strong>ordenar</strong>, <strong>ocultar sin borrar</strong> y definir{' '}
                        <strong>prioridad sugerida</strong>, hay que ejecutar en el servidor{' '}
                        <code className="px-1 py-0.5 rounded bg-white/70 text-xs">
                            node scripts/run-problems-customization-migration.js
                        </code>{' '}
                        y reiniciar el backend. Todo lo demás ya funciona.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)] gap-5 min-w-0">
                {/* Columna: categorías */}
                <aside className={`${clCard} p-4 flex flex-col lg:max-h-[calc(100vh-11rem)] min-w-0`}>
                    <div className="flex items-center justify-between gap-2 mb-3">
                        <h2 className="text-base font-bold text-slate-900">Categorías</h2>
                        <button type="button" onClick={openCreateCategory} className={iconBtn} title="Nueva categoría" aria-label="Nueva categoría">
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                    <label className="relative block mb-3">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="search"
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className={`${clInput} pl-9`}
                            placeholder="Buscar categoría…"
                            aria-label="Buscar categoría"
                        />
                    </label>
                    <ul className="space-y-1.5 overflow-y-auto flex-1 pr-1 -mr-1">
                        <li>
                            <button
                                type="button"
                                onClick={() => setSelection('all')}
                                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                                    selection === 'all'
                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                        : 'bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-900'
                                }`}
                            >
                                <span className="font-semibold text-sm flex items-center gap-2">
                                    <Layers className="w-4 h-4" /> Todas las categorías
                                </span>
                                <span className={`block text-xs mt-0.5 ${selection === 'all' ? 'text-red-100' : 'text-gray-500'}`}>
                                    {plural(problems.length, 'problema', 'problemas')} en total
                                </span>
                            </button>
                        </li>
                        {filteredCategories.length === 0 ? (
                            <li className="text-sm text-gray-500 text-center py-4">
                                {categories.length === 0 ? 'Todavía no hay categorías.' : 'Ninguna coincide con la búsqueda.'}
                            </li>
                        ) : (
                            filteredCategories.map((cat, i) => {
                                const isSelected = selection === cat.id;
                                return (
                                    <li key={cat.id} className="flex items-stretch gap-1 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => setSelection(cat.id)}
                                            className={`flex-1 min-w-0 text-left px-3 py-2.5 rounded-xl border transition-colors ${
                                                isSelected
                                                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                    : cat.is_active
                                                      ? 'bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-900'
                                                      : 'bg-gray-50/60 hover:bg-gray-100 border-dashed border-gray-200 text-gray-500'
                                            }`}
                                        >
                                            <span className="font-semibold text-sm block break-words">{cat.name}</span>
                                            <span className="flex flex-wrap items-center gap-1.5 mt-1">
                                                <ScopeBadge category={cat} light={isSelected} />
                                                {!cat.is_active && <InactiveBadge light={isSelected} />}
                                                <span className={`text-xs ${isSelected ? 'text-red-100' : 'text-gray-500'}`}>
                                                    {plural(cat.problem_count, 'problema', 'problemas')}
                                                </span>
                                            </span>
                                        </button>
                                        {canReorderCategories && (
                                            <div className="flex flex-col justify-center shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => moveCategory(cat, -1)}
                                                    disabled={i === 0}
                                                    className="p-0.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30"
                                                    aria-label={`Subir ${cat.name}`}
                                                    title="Subir"
                                                >
                                                    <ChevronUp className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => moveCategory(cat, 1)}
                                                    disabled={i === filteredCategories.length - 1}
                                                    className="p-0.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30"
                                                    aria-label={`Bajar ${cat.name}`}
                                                    title="Bajar"
                                                >
                                                    <ChevronDown className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </aside>

                {/* Columna: contenido */}
                <section className="min-w-0 space-y-4">
                    {/* Cabecera de la categoría seleccionada */}
                    {selectedCategory && (
                        <div className={`${clCard} p-4 sm:p-5`}>
                            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h2 className="text-xl font-bold text-slate-900 break-words">{selectedCategory.name}</h2>
                                        <ScopeBadge category={selectedCategory} />
                                        {!selectedCategory.is_active && <InactiveBadge />}
                                    </div>
                                    <p className="text-sm text-slate-500 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                                        <span className="inline-flex items-center gap-1">
                                            <Layers className="w-3.5 h-3.5" />
                                            {plural(selectedCategory.problem_count, 'problema', 'problemas')}
                                        </span>
                                        <span className="inline-flex items-center gap-1">
                                            <Ticket className="w-3.5 h-3.5" />
                                            {plural(selectedCategory.ticket_count, 'ticket creado', 'tickets creados')}
                                        </span>
                                    </p>
                                </div>
                                <div className="flex flex-wrap gap-1 shrink-0">
                                    <button type="button" onClick={() => openEditCategory(selectedCategory)} className={btnGhost}>
                                        <Pencil className="w-4 h-4" /> Editar
                                    </button>
                                    <button type="button" onClick={() => setDuplicating(selectedCategory)} className={btnGhost}>
                                        <Copy className="w-4 h-4" /> Duplicar
                                    </button>
                                    {features.customization && (
                                        <button type="button" onClick={() => toggleCategoryActive(selectedCategory)} className={btnGhost}>
                                            {selectedCategory.is_active ? (
                                                <><EyeOff className="w-4 h-4" /> Ocultar</>
                                            ) : (
                                                <><Eye className="w-4 h-4" /> Mostrar</>
                                            )}
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => askDeleteCategory(selectedCategory)}
                                        className={`${btnGhost} text-red-600 hover:bg-red-50`}
                                    >
                                        <Trash2 className="w-4 h-4" /> Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Listado de problemas */}
                    <div className={`${clCard} min-w-0 overflow-hidden`}>
                        <div className="p-4 border-b border-gray-100 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                <label className="relative block flex-1 min-w-0">
                                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                                    <input
                                        type="search"
                                        value={problemSearch}
                                        onChange={(e) => setProblemSearch(e.target.value)}
                                        className={`${clInput} pl-9`}
                                        placeholder={
                                            selectedCategory
                                                ? 'Buscar en esta categoría…'
                                                : 'Buscar por título, descripción, categoría o departamento…'
                                        }
                                        aria-label="Buscar problema"
                                    />
                                </label>
                                <select
                                    value={deptFilter}
                                    onChange={(e) => setDeptFilter(e.target.value)}
                                    className={`${clInput} sm:w-52`}
                                    aria-label="Filtrar por departamento"
                                >
                                    <option value="">Todos los departamentos</option>
                                    <DepartmentOptions departments={departments} />
                                </select>
                                {features.customization && (
                                    <select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                                        className={`${clInput} sm:w-40`}
                                        aria-label="Filtrar por visibilidad"
                                    >
                                        <option value="all">Visibles y ocultos</option>
                                        <option value="active">Solo visibles</option>
                                        <option value="inactive">Solo ocultos</option>
                                    </select>
                                )}
                                {hasFilters && (
                                    <button type="button" onClick={clearFilters} className={`${btnGhost} shrink-0`}>
                                        <X className="w-4 h-4" /> Limpiar
                                    </button>
                                )}
                            </div>

                            {selectedIds.size > 0 && (
                                <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 text-white px-3 py-2">
                                    <span className="text-sm font-semibold mr-1">
                                        {plural(selectedIds.size, 'seleccionado', 'seleccionados')}
                                    </span>
                                    <button type="button" onClick={() => setBulkMode('move')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1">
                                        <ArrowRightLeft className="w-3.5 h-3.5" /> Mover a…
                                    </button>
                                    <button type="button" onClick={() => setBulkMode('department')} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1">
                                        <Building2 className="w-3.5 h-3.5" /> Departamento…
                                    </button>
                                    {features.customization && (
                                        <>
                                            <button type="button" onClick={() => runBulk('activate').catch(() => undefined)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1">
                                                <Eye className="w-3.5 h-3.5" /> Mostrar
                                            </button>
                                            <button type="button" onClick={() => runBulk('deactivate').catch(() => undefined)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 inline-flex items-center gap-1">
                                                <EyeOff className="w-3.5 h-3.5" /> Ocultar
                                            </button>
                                        </>
                                    )}
                                    <button type="button" onClick={askBulkDelete} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-red-500/80 hover:bg-red-500 inline-flex items-center gap-1">
                                        <Trash2 className="w-3.5 h-3.5" /> Eliminar
                                    </button>
                                    <button type="button" onClick={() => setSelectedIds(new Set())} className="ml-auto p-1.5 rounded-lg hover:bg-white/10" aria-label="Quitar selección">
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                        </div>

                        {visibleProblems.length === 0 ? (
                            <div className="p-10 text-center text-slate-500">
                                {problems.length === 0 ? (
                                    <>
                                        <p className="font-semibold text-slate-700">Todavía no hay problemas predefinidos.</p>
                                        <p className="text-sm mt-1">
                                            {categories.length === 0
                                                ? 'Primero creá una categoría y después agregá problemas dentro.'
                                                : 'Usá "Nuevo problema" para cargar el primero.'}
                                        </p>
                                    </>
                                ) : hasFilters ? (
                                    <>
                                        <p className="font-semibold text-slate-700">Ningún problema coincide con los filtros.</p>
                                        <button type="button" onClick={clearFilters} className={`${btnGhost} mt-2 mx-auto`}>
                                            <X className="w-4 h-4" /> Limpiar filtros
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <p className="font-semibold text-slate-700">Esta categoría todavía no tiene problemas.</p>
                                        <p className="text-sm mt-1">
                                            Los usuarios solo verán la opción «Otro…». Agregá el primero con "Nuevo problema".
                                        </p>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Tabla (md y superior) */}
                                <table className="hidden md:table w-full table-fixed divide-y divide-gray-100">
                                    <thead className="bg-gray-50/90">
                                        <tr>
                                            <th className="w-10 px-3 py-3">
                                                <input
                                                    type="checkbox"
                                                    checked={allVisibleSelected}
                                                    onChange={toggleSelectAll}
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                                                    aria-label="Seleccionar todos"
                                                />
                                            </th>
                                            {canReorderProblems && <th className="w-10 px-1 py-3" aria-label="Orden" />}
                                            <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                Problema
                                            </th>
                                            {showCategoryColumn && (
                                                <th className="w-[20%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                    Categoría
                                                </th>
                                            )}
                                            <th className="w-[18%] px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                                                Atiende
                                            </th>
                                            {features.customization && (
                                                <th className="w-24 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hidden xl:table-cell">
                                                    Prioridad
                                                </th>
                                            )}
                                            <th className="w-20 px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500 hidden xl:table-cell">
                                                Tickets
                                            </th>
                                            <th className={`${features.customization ? 'w-32' : 'w-24'} px-3 py-3 text-right text-xs font-semibold uppercase tracking-wider text-gray-500`}>
                                                Acciones
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-100">
                                        {visibleProblems.map((p, i) => {
                                            const orphan = !categoryById.has(p.category_id);
                                            return (
                                                <tr
                                                    key={p.id}
                                                    className={`transition-colors ${
                                                        selectedIds.has(p.id) ? 'bg-red-50/60' : 'hover:bg-gray-50/80'
                                                    } ${!p.is_active ? 'text-gray-400' : ''}`}
                                                >
                                                    <td className="px-3 py-3 align-top">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedIds.has(p.id)}
                                                            onChange={() => toggleSelect(p.id)}
                                                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-0.5"
                                                            aria-label={`Seleccionar ${p.title}`}
                                                        />
                                                    </td>
                                                    {canReorderProblems && (
                                                        <td className="px-1 py-2 align-top">
                                                            <div className="flex flex-col items-center">
                                                                <button type="button" onClick={() => moveProblem(p, -1)} disabled={i === 0} className="p-0.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30" aria-label="Subir" title="Subir">
                                                                    <ChevronUp className="w-4 h-4" />
                                                                </button>
                                                                <button type="button" onClick={() => moveProblem(p, 1)} disabled={i === visibleProblems.length - 1} className="p-0.5 rounded text-gray-400 hover:text-gray-800 hover:bg-gray-100 disabled:opacity-30" aria-label="Bajar" title="Bajar">
                                                                    <ChevronDown className="w-4 h-4" />
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-3 align-top min-w-0">
                                                        <div className="flex items-start gap-2 min-w-0">
                                                            {canReorderProblems && <GripVertical className="w-4 h-4 text-gray-300 shrink-0 mt-0.5" />}
                                                            <div className="min-w-0">
                                                                <p className={`text-sm font-semibold break-words ${p.is_active ? 'text-gray-900' : 'text-gray-500 line-through decoration-gray-300'}`}>
                                                                    {p.title}
                                                                </p>
                                                                {p.description.trim() && (
                                                                    <p className="text-xs text-gray-500 mt-0.5 break-words line-clamp-2">{p.description}</p>
                                                                )}
                                                                <div className="flex flex-wrap gap-1.5 mt-1 xl:hidden">
                                                                    {features.customization && p.default_priority && (
                                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityPillClass(p.default_priority)}`}>
                                                                            {PRIORITY_LABEL[p.default_priority]}
                                                                        </span>
                                                                    )}
                                                                    {p.ticket_count > 0 && (
                                                                        <span className="text-[11px] text-gray-500 inline-flex items-center gap-1">
                                                                            <Ticket className="w-3 h-3" /> {p.ticket_count}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {showCategoryColumn && (
                                                        <td className="px-3 py-3 align-top text-sm min-w-0">
                                                            {orphan ? (
                                                                <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
                                                                    <AlertTriangle className="w-3.5 h-3.5" /> Sin categoría válida
                                                                </span>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelection(p.category_id)}
                                                                    className="text-left text-sm text-gray-800 hover:text-red-700 hover:underline break-words"
                                                                >
                                                                    {p.category_name}
                                                                </button>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-3 align-top text-sm text-gray-700 break-words">
                                                        {p.department_name ? (
                                                            <>
                                                                <span className="block">{p.department_name}</span>
                                                                {p.department_company_name && (
                                                                    <span className="block text-xs text-gray-400">{p.department_company_name}</span>
                                                                )}
                                                            </>
                                                        ) : (
                                                            <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold">
                                                                <AlertTriangle className="w-3.5 h-3.5" /> Sin departamento
                                                            </span>
                                                        )}
                                                    </td>
                                                    {features.customization && (
                                                        <td className="px-3 py-3 align-top hidden xl:table-cell">
                                                            {p.default_priority ? (
                                                                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${priorityPillClass(p.default_priority)}`}>
                                                                    {PRIORITY_LABEL[p.default_priority]}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-400">—</span>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="px-3 py-3 align-top text-right text-sm text-gray-700 tabular-nums hidden xl:table-cell">
                                                        {p.ticket_count}
                                                    </td>
                                                    <td className="px-3 py-2 align-top text-right">
                                                        <div className="inline-flex items-center gap-0.5">
                                                            {features.customization && (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => toggleProblemActive(p)}
                                                                    className={iconBtn}
                                                                    title={p.is_active ? 'Ocultar del formulario' : 'Mostrar en el formulario'}
                                                                    aria-label={p.is_active ? `Ocultar ${p.title}` : `Mostrar ${p.title}`}
                                                                >
                                                                    {p.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                                </button>
                                                            )}
                                                            <button type="button" onClick={() => openEditProblem(p)} className={`${iconBtn} hover:text-blue-700 hover:bg-blue-50`} title="Editar" aria-label={`Editar ${p.title}`}>
                                                                <Pencil className="w-4 h-4" />
                                                            </button>
                                                            <button type="button" onClick={() => askDeleteProblem(p)} className={`${iconBtn} hover:text-red-700 hover:bg-red-50`} title="Eliminar" aria-label={`Eliminar ${p.title}`}>
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                {/* Tarjetas (móvil) */}
                                <ul className="md:hidden divide-y divide-gray-100">
                                    {visibleProblems.map((p, i) => {
                                        const orphan = !categoryById.has(p.category_id);
                                        return (
                                            <li key={p.id} className={`p-4 flex gap-3 min-w-0 ${selectedIds.has(p.id) ? 'bg-red-50/60' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(p.id)}
                                                    onChange={() => toggleSelect(p.id)}
                                                    className="rounded border-gray-300 text-red-600 focus:ring-red-500 mt-1 shrink-0"
                                                    aria-label={`Seleccionar ${p.title}`}
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className={`font-semibold break-words ${p.is_active ? 'text-slate-900' : 'text-gray-500 line-through'}`}>{p.title}</p>
                                                    {p.description.trim() && <p className="text-xs text-gray-500 mt-0.5 break-words">{p.description}</p>}
                                                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-gray-600">
                                                        {showCategoryColumn && (
                                                            orphan ? (
                                                                <span className="text-amber-700 font-semibold">Sin categoría válida</span>
                                                            ) : (
                                                                <span className="px-1.5 py-0.5 rounded bg-gray-100">{p.category_name}</span>
                                                            )
                                                        )}
                                                        <span>
                                                            Atiende:{' '}
                                                            {p.department_name
                                                                ? `${p.department_name}${p.department_company_name ? ` (${p.department_company_name})` : ''}`
                                                                : '—'}
                                                        </span>
                                                        {p.default_priority && (
                                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${priorityPillClass(p.default_priority)}`}>
                                                                {PRIORITY_LABEL[p.default_priority]}
                                                            </span>
                                                        )}
                                                        {!p.is_active && <InactiveBadge />}
                                                        {p.ticket_count > 0 && <span>{plural(p.ticket_count, 'ticket', 'tickets')}</span>}
                                                    </div>
                                                    <div className="flex items-center gap-1 mt-2 -ml-2">
                                                        {canReorderProblems && (
                                                            <>
                                                                <button type="button" onClick={() => moveProblem(p, -1)} disabled={i === 0} className={iconBtn} aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
                                                                <button type="button" onClick={() => moveProblem(p, 1)} disabled={i === visibleProblems.length - 1} className={iconBtn} aria-label="Bajar"><ChevronDown className="w-4 h-4" /></button>
                                                            </>
                                                        )}
                                                        {features.customization && (
                                                            <button type="button" onClick={() => toggleProblemActive(p)} className={iconBtn} aria-label={p.is_active ? 'Ocultar' : 'Mostrar'}>
                                                                {p.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                                            </button>
                                                        )}
                                                        <button type="button" onClick={() => openEditProblem(p)} className={`${iconBtn} hover:text-blue-700`} aria-label="Editar"><Pencil className="w-4 h-4" /></button>
                                                        <button type="button" onClick={() => askDeleteProblem(p)} className={`${iconBtn} hover:text-red-700`} aria-label="Eliminar"><Trash2 className="w-4 h-4" /></button>
                                                    </div>
                                                </div>
                                            </li>
                                        );
                                    })}
                                </ul>

                                <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-500 flex flex-wrap items-center justify-between gap-2">
                                    <span>
                                        Mostrando {plural(visibleProblems.length, 'problema', 'problemas')}
                                        {selectedCategory ? ` de "${selectedCategory.name}"` : ''}
                                    </span>
                                    {canReorderProblems && (
                                        <span className="inline-flex items-center gap-1">
                                            <Check className="w-3.5 h-3.5 text-emerald-600" /> El orden de esta lista es el que ve el usuario
                                        </span>
                                    )}
                                    {features.customization && typeof selection === 'number' && hasFilters && (
                                        <span>Quitá los filtros para poder reordenar</span>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </section>
            </div>

            {/* Modales */}
            <CategoryFormModal
                isOpen={categoryModal.open}
                editing={categoryModal.editing}
                companies={companies}
                features={features}
                onClose={() => setCategoryModal((s) => ({ ...s, open: false }))}
                onSaved={async (newId) => {
                    await fetchData(true);
                    if (newId) setSelection(newId);
                }}
            />
            <ProblemFormModal
                isOpen={problemModal.open}
                editing={problemModal.editing}
                defaultCategoryId={typeof selection === 'number' ? selection : null}
                categories={categories}
                departments={departments}
                features={features}
                onClose={() => setProblemModal((s) => ({ ...s, open: false }))}
                onSaved={() => fetchData(true)}
            />
            <DuplicateCategoryModal
                category={duplicating}
                companies={companies}
                onClose={() => setDuplicating(null)}
                onSaved={async (newId) => {
                    await fetchData(true);
                    if (newId) setSelection(newId);
                }}
            />
            <BulkTargetModal
                mode={bulkMode}
                count={selectedIds.size}
                categories={categories}
                departments={departments}
                onClose={() => setBulkMode(null)}
                onConfirm={(targetId) =>
                    bulkMode === 'move'
                        ? runBulk('move', { category_id: targetId })
                        : runBulk('department', { department_id: targetId })
                }
            />
            <PreviewModal
                isOpen={previewOpen}
                categories={categories}
                problems={problems}
                companies={companies}
                onClose={() => setPreviewOpen(false)}
            />
            <ConfirmModal state={confirm} onClose={() => setConfirm(null)} />
        </div>
    );
};

export default AdminProblemsPage;
