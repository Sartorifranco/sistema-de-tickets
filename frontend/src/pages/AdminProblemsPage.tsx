import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { clCard, clInput } from '../utils/cleanLightUi';

interface Department {
    id: number;
    name: string;
}
interface Category {
    id: number;
    name: string;
    company_id: number | null;
}
interface Problem {
    id: number;
    title: string;
    description: string;
    category_id: number;
    department_id: number;
    category_name?: string | null;
}

type ViewMode = 'all' | 'category';

function categoryScopeLabel(cat: Category): string {
    return cat.company_id ? `Empresa ID ${cat.company_id}` : 'Todas las empresas (genérico)';
}

function normalizeCategory(raw: Category): Category {
    return {
        ...raw,
        id: Number(raw.id),
        company_id: raw.company_id != null ? Number(raw.company_id) : null,
    };
}

function normalizeProblem(raw: Problem): Problem {
    return {
        ...raw,
        id: Number(raw.id),
        category_id: Number(raw.category_id),
        department_id: Number(raw.department_id),
    };
}

const AdminProblemsPage: React.FC = () => {
    const [categories, setCategories] = useState<Category[]>([]);
    const [problems, setProblems] = useState<Problem[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [viewMode, setViewMode] = useState<ViewMode>('all');
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
    const [categorySearch, setCategorySearch] = useState('');
    const [problemSearch, setProblemSearch] = useState('');
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [dataRes, deptsRes] = await Promise.all([
                api.get('/api/admin/problems-all'),
                api.get('/api/departments'),
            ]);
            setCategories((dataRes.data.data.categories || []).map(normalizeCategory));
            setProblems((dataRes.data.data.problems || []).map(normalizeProblem));
            setDepartments(deptsRes.data.data || []);
        } catch {
            toast.error('No se pudieron cargar los datos.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const categoryById = useMemo(
        () => new Map(categories.map((c) => [c.id, c])),
        [categories]
    );

    const problemCountByCategory = useMemo(() => {
        const map = new Map<number, number>();
        for (const p of problems) {
            const cid = Number(p.category_id);
            map.set(cid, (map.get(cid) || 0) + 1);
        }
        return map;
    }, [problems]);

    const orphanedProblems = useMemo(
        () => problems.filter((p) => !categoryById.has(Number(p.category_id))),
        [problems, categoryById]
    );

    const sortedCategories = useMemo(
        () => [...categories].sort((a, b) => a.name.localeCompare(b.name, 'es')),
        [categories]
    );

    const filteredCategories = useMemo(() => {
        const q = categorySearch.trim().toLowerCase();
        if (!q) return sortedCategories;
        return sortedCategories.filter(
            (c) =>
                c.name.toLowerCase().includes(q) ||
                categoryScopeLabel(c).toLowerCase().includes(q)
        );
    }, [sortedCategories, categorySearch]);

    const selectedCategory = selectedCategoryId != null ? categoryById.get(selectedCategoryId) : undefined;

    const filterProblemsBySearch = (list: Problem[], query: string) => {
        const q = query.trim().toLowerCase();
        if (!q) return list;
        return list.filter(
            (p) =>
                p.title.toLowerCase().includes(q) ||
                (p.description || '').toLowerCase().includes(q) ||
                (p.category_name || '').toLowerCase().includes(q)
        );
    };

    const problemsForSelectedCategory = useMemo(() => {
        if (selectedCategoryId == null) return [];
        const list = problems.filter((p) => Number(p.category_id) === selectedCategoryId);
        return filterProblemsBySearch(list, problemSearch).sort((a, b) =>
            a.title.localeCompare(b.title, 'es')
        );
    }, [problems, selectedCategoryId, problemSearch]);

    const allProblemsGrouped = useMemo(() => {
        const q = problemSearch.trim().toLowerCase();
        const filtered = filterProblemsBySearch(problems, problemSearch);

        const groups: { key: string; label: string; hint: string; problems: Problem[] }[] = [];

        for (const cat of sortedCategories) {
            const catProblems = filtered
                .filter((p) => Number(p.category_id) === cat.id)
                .sort((a, b) => a.title.localeCompare(b.title, 'es'));
            if (catProblems.length > 0 || !q) {
                groups.push({
                    key: `cat-${cat.id}`,
                    label: cat.name,
                    hint: categoryScopeLabel(cat),
                    problems: catProblems,
                });
            }
        }

        const orphans = filtered.filter((p) => !categoryById.has(Number(p.category_id)));
        if (orphans.length > 0) {
            groups.push({
                key: 'orphan',
                label: 'Sin categoría válida',
                hint: 'Estos problemas existen en la base pero su categoría fue eliminada o cambió de ID',
                problems: orphans.sort((a, b) => a.title.localeCompare(b.title, 'es')),
            });
        }

        return groups.filter((g) => g.problems.length > 0);
    }, [problems, sortedCategories, categoryById, problemSearch]);

    const selectAllView = () => {
        setViewMode('all');
        setSelectedCategoryId(null);
        setProblemSearch('');
    };

    const selectCategory = (catId: number) => {
        setViewMode('category');
        setSelectedCategoryId(catId);
        setProblemSearch('');
    };

    if (loading) {
        return <div className="text-center p-8 text-gray-600">Cargando problemáticas...</div>;
    }

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="mb-6">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
                    Administrar problemáticas
                </h1>
                <p className="text-sm text-gray-600 mt-2 max-w-3xl">
                    Definí las opciones que ven los usuarios al crear un ticket: primero eligen una{' '}
                    <strong>categoría</strong> y luego un <strong>problema predefinido</strong>. Cada
                    problema se deriva al departamento que indiques.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                    Total cargado: <strong>{problems.length}</strong>{' '}
                    {problems.length === 1 ? 'problema' : 'problemas'} en{' '}
                    <strong>{categories.length}</strong>{' '}
                    {categories.length === 1 ? 'categoría' : 'categorías'}.
                    {orphanedProblems.length > 0 && (
                        <span className="text-amber-700 ml-1">
                            ({orphanedProblems.length} sin categoría válida)
                        </span>
                    )}
                </p>
            </div>

            <div className={`${clCard} p-4 sm:p-5 mb-6 border-l-4 border-blue-500 bg-blue-50/40`}>
                <p className="text-sm font-semibold text-blue-900 mb-2">¿Cómo usar este módulo?</p>
                <ol className="text-sm text-blue-900/90 space-y-1 list-decimal list-inside">
                    <li>
                        Usá <strong>Ver todos</strong> para revisar de un vistazo todo lo que ya está
                        cargado en el sistema.
                    </li>
                    <li>O elegí una categoría en la columna izquierda para editar solo esa sección.</li>
                    <li>Agregá nuevos problemas con el formulario; el departamento define quién atiende el ticket.</li>
                </ol>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                <div className={`${clCard} p-4 sm:p-5 lg:col-span-1 flex flex-col max-h-[calc(100vh-12rem)]`}>
                    <h2 className="text-lg font-bold text-gray-900 mb-1">Categorías</h2>
                    <p className="text-xs text-gray-500 mb-3">
                        Elegí <strong>Ver todos</strong> o una categoría concreta.
                    </p>
                    <input
                        type="text"
                        value={categorySearch}
                        onChange={(e) => setCategorySearch(e.target.value)}
                        className={`${clInput} mb-3`}
                        placeholder="Buscar categoría..."
                        aria-label="Buscar categoría"
                    />
                    <ul className="space-y-2 overflow-y-auto flex-1 pr-1">
                        <li>
                            <button
                                type="button"
                                onClick={selectAllView}
                                className={`w-full text-left p-3 rounded-xl transition-colors border ${
                                    viewMode === 'all'
                                        ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                        : 'bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-900'
                                }`}
                            >
                                <span className="font-semibold text-sm block">Ver todos los problemas</span>
                                <span
                                    className={`block text-xs mt-0.5 ${
                                        viewMode === 'all' ? 'text-red-100' : 'text-gray-500'
                                    }`}
                                >
                                    {problems.length} en total · todas las categorías
                                </span>
                            </button>
                        </li>
                        {filteredCategories.length === 0 ? (
                            <li className="text-sm text-gray-500 text-center py-4">
                                No hay categorías que coincidan con la búsqueda.
                            </li>
                        ) : (
                            filteredCategories.map((cat) => {
                                const count = problemCountByCategory.get(cat.id) || 0;
                                const isSelected =
                                    viewMode === 'category' && selectedCategoryId === cat.id;
                                return (
                                    <li key={cat.id}>
                                        <button
                                            type="button"
                                            onClick={() => selectCategory(cat.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-colors border ${
                                                isSelected
                                                    ? 'bg-red-600 text-white border-red-600 shadow-sm'
                                                    : 'bg-gray-50 hover:bg-gray-100 border-gray-100 text-gray-900'
                                            }`}
                                        >
                                            <span className="font-semibold text-sm block">{cat.name}</span>
                                            <span
                                                className={`block text-xs mt-0.5 ${
                                                    isSelected ? 'text-red-100' : 'text-gray-500'
                                                }`}
                                            >
                                                {categoryScopeLabel(cat)} · {count}{' '}
                                                {count === 1 ? 'problema' : 'problemas'}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>

                <div className="lg:col-span-2 space-y-4">
                    {viewMode === 'all' ? (
                        <div className={`${clCard} p-5 sm:p-6`}>
                            <div className="mb-5 pb-4 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900">Todos los problemas</h2>
                                <p className="text-sm text-gray-600 mt-1">
                                    Listado completo de lo que ya está en el sistema, agrupado por
                                    categoría. Hacé clic en una categoría del panel izquierdo para
                                    editarla o agregar más problemas ahí.
                                </p>
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Buscar en todo el listado
                                </label>
                                <input
                                    type="text"
                                    value={problemSearch}
                                    onChange={(e) => setProblemSearch(e.target.value)}
                                    className={clInput}
                                    placeholder="Filtrar por título, descripción o categoría..."
                                />
                            </div>

                            {problems.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                                    <p className="text-sm text-gray-600">
                                        Todavía no hay problemas predefinidos en el sistema.
                                    </p>
                                    <p className="text-xs text-gray-500 mt-2">
                                        Elegí una categoría a la izquierda y usá el formulario para
                                        cargar el primero.
                                    </p>
                                </div>
                            ) : allProblemsGrouped.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                                    <p className="text-sm text-gray-600">
                                        Ningún problema coincide con el filtro.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    {allProblemsGrouped.map((group) => (
                                        <section key={group.key}>
                                            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                                                <div>
                                                    <h3 className="text-sm font-bold text-gray-800">
                                                        {group.label}
                                                        <span className="font-normal text-gray-500 ml-2">
                                                            ({group.problems.length})
                                                        </span>
                                                    </h3>
                                                    <p className="text-xs text-gray-500">{group.hint}</p>
                                                </div>
                                                {group.key.startsWith('cat-') && (
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            selectCategory(Number(group.key.replace('cat-', '')))
                                                        }
                                                        className="text-xs font-semibold text-blue-700 hover:underline"
                                                    >
                                                        Administrar esta categoría →
                                                    </button>
                                                )}
                                            </div>
                                            <ul className="space-y-2">
                                                {group.problems.map((prob) => (
                                                    <AllViewProblemRow
                                                        key={prob.id}
                                                        problem={prob}
                                                        departments={departments}
                                                        onGoToCategory={
                                                            categoryById.has(Number(prob.category_id))
                                                                ? () => selectCategory(Number(prob.category_id))
                                                                : undefined
                                                        }
                                                    />
                                                ))}
                                            </ul>
                                        </section>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : selectedCategory ? (
                        <div className={`${clCard} p-5 sm:p-6`}>
                            <CategoryHeader
                                category={selectedCategory}
                                problemCount={problemCountByCategory.get(selectedCategory.id) || 0}
                                onSaved={fetchData}
                            />

                            <div className="mb-4">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">
                                    Buscar en esta categoría
                                </label>
                                <input
                                    type="text"
                                    value={problemSearch}
                                    onChange={(e) => setProblemSearch(e.target.value)}
                                    className={clInput}
                                    placeholder="Filtrar por título o descripción..."
                                />
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-800 mb-2">
                                    Problemas registrados ({problemsForSelectedCategory.length})
                                </h3>
                                {problemsForSelectedCategory.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                                        <p className="text-sm text-gray-600">
                                            {problemSearch.trim()
                                                ? 'Ningún problema coincide con el filtro.'
                                                : 'Esta categoría aún no tiene problemas.'}
                                        </p>
                                        {!problemSearch.trim() && (
                                            <p className="text-xs text-gray-500 mt-2">
                                                Usá el formulario de abajo para cargar el primero.
                                            </p>
                                        )}
                                    </div>
                                ) : (
                                    <ul className="space-y-3">
                                        {problemsForSelectedCategory.map((prob) => (
                                            <ProblemItem
                                                key={prob.id}
                                                problem={prob}
                                                departments={departments}
                                                onSave={fetchData}
                                            />
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <CreateProblemForm
                                categoryId={selectedCategory.id}
                                departments={departments}
                                onCreate={fetchData}
                            />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
};

const CategoryHeader: React.FC<{
    category: Category;
    problemCount: number;
    onSaved: () => void;
}> = ({ category, problemCount, onSaved }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(category.name);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setName(category.name);
        setEditing(false);
    }, [category.id, category.name]);

    const handleSaveName = async () => {
        const trimmed = name.trim();
        if (!trimmed) {
            toast.error('El nombre no puede estar vacío.');
            return;
        }
        setSaving(true);
        try {
            await api.put(`/api/admin/categories/${category.id}`, {
                name: trimmed,
                company_id: category.company_id,
            });
            toast.success('Categoría renombrada.');
            setEditing(false);
            onSaved();
        } catch {
            toast.error('No se pudo renombrar la categoría.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mb-5 pb-4 border-b border-gray-100">
            {editing ? (
                <div className="space-y-3">
                    <label className="block text-xs font-semibold text-gray-600">Nombre de la categoría</label>
                    <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className={clInput}
                        autoFocus
                    />
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleSaveName}
                            disabled={saving}
                            className="bg-green-600 text-white px-4 py-2 text-sm rounded-lg font-semibold hover:bg-green-700 disabled:opacity-60"
                        >
                            {saving ? 'Guardando...' : 'Guardar nombre'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setName(category.name);
                                setEditing(false);
                            }}
                            className="bg-gray-500 text-white px-4 py-2 text-sm rounded-lg font-semibold hover:bg-gray-600"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">{category.name}</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            {categoryScopeLabel(category)}.{' '}
                            {problemCount} {problemCount === 1 ? 'problema cargado' : 'problemas cargados'} en
                            esta categoría.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => setEditing(true)}
                        className="text-sm font-semibold text-blue-700 hover:underline"
                    >
                        Renombrar categoría
                    </button>
                </div>
            )}
        </div>
    );
};

const AllViewProblemRow: React.FC<{
    problem: Problem;
    departments: Department[];
    onGoToCategory?: () => void;
}> = ({ problem, departments, onGoToCategory }) => {
    const deptName = departments.find((d) => d.id === problem.department_id)?.name || 'N/A';

    return (
        <li className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 p-3 bg-gray-50 rounded-lg border border-gray-100">
            <div className="min-w-0">
                <p className="font-medium text-gray-900 text-sm">{problem.title}</p>
                {problem.description?.trim() && (
                    <p className="text-xs text-gray-600 mt-0.5">{problem.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-0.5">
                    Se deriva a: <span className="font-medium">{deptName}</span>
                </p>
            </div>
            {onGoToCategory && (
                <button
                    type="button"
                    onClick={onGoToCategory}
                    className="text-xs font-semibold text-blue-700 hover:underline shrink-0"
                >
                    Editar en categoría
                </button>
            )}
        </li>
    );
};

const ProblemItem: React.FC<{
    problem: Problem;
    departments: Department[];
    onSave: () => void;
}> = ({ problem, departments, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [values, setValues] = useState({
        title: problem.title,
        description: problem.description,
        department_id: problem.department_id,
    });

    const deptName = departments.find((d) => d.id === problem.department_id)?.name || 'N/A';

    const handleSave = async () => {
        try {
            await api.put(`/api/admin/problems/${problem.id}`, {
                ...values,
                category_id: problem.category_id,
            });
            toast.success('Problema actualizado.');
            setIsEditing(false);
            onSave();
        } catch {
            toast.error('Error al actualizar.');
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`¿Eliminar el problema "${problem.title}"?`)) return;
        try {
            await api.delete(`/api/admin/problems/${problem.id}`);
            toast.success('Problema eliminado.');
            onSave();
        } catch {
            toast.error('Error al eliminar.');
        }
    };

    if (isEditing) {
        return (
            <li className="p-4 bg-blue-50/80 border border-blue-200 rounded-xl space-y-3">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Título</label>
                    <input
                        value={values.title}
                        onChange={(e) => setValues({ ...values, title: e.target.value })}
                        className={clInput}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Descripción (opcional)
                    </label>
                    <input
                        value={values.description}
                        onChange={(e) => setValues({ ...values, description: e.target.value })}
                        className={clInput}
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Departamento que atiende
                    </label>
                    <select
                        value={values.department_id}
                        onChange={(e) =>
                            setValues({ ...values, department_id: parseInt(e.target.value, 10) })
                        }
                        className={clInput}
                    >
                        {departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleSave}
                        className="bg-green-600 text-white px-4 py-2 text-sm rounded-lg font-semibold hover:bg-green-700"
                    >
                        Guardar
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="bg-gray-500 text-white px-4 py-2 text-sm rounded-lg font-semibold hover:bg-gray-600"
                    >
                        Cancelar
                    </button>
                </div>
            </li>
        );
    }

    return (
        <li className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="min-w-0">
                <p className="font-semibold text-gray-900">{problem.title}</p>
                {problem.description?.trim() && (
                    <p className="text-sm text-gray-600 mt-0.5">{problem.description}</p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                    Se deriva a: <span className="font-medium text-gray-700">{deptName}</span>
                </p>
            </div>
            <div className="flex gap-3 shrink-0">
                <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="text-blue-700 text-sm font-semibold hover:underline"
                >
                    Editar
                </button>
                <button
                    type="button"
                    onClick={handleDelete}
                    className="text-red-600 text-sm font-semibold hover:underline"
                >
                    Eliminar
                </button>
            </div>
        </li>
    );
};

const CreateProblemForm: React.FC<{
    categoryId: number;
    departments: Department[];
    onCreate: () => void;
}> = ({ categoryId, departments, onCreate }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [departmentId, setDepartmentId] = useState<number | ''>(departments[0]?.id || '');
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!departmentId) {
            toast.warn('Seleccioná un departamento.');
            return;
        }
        setSubmitting(true);
        try {
            await api.post('/api/admin/problems', {
                title,
                description,
                category_id: categoryId,
                department_id: departmentId,
            });
            toast.success('Problema creado.');
            setTitle('');
            setDescription('');
            onCreate();
        } catch {
            toast.error('Error al crear el problema.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="border-t border-gray-100 pt-5 mt-2">
            <h4 className="font-bold text-gray-800 mb-1">Añadir nuevo problema</h4>
            <p className="text-xs text-gray-500 mb-4">
                El título es lo que verá el usuario en el desplegable del ticket. Elegí el
                departamento al que debe ir ese tipo de consulta.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Título del problema *
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Ej: Impresora no responde"
                        className={clInput}
                        required
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">
                        Descripción (opcional)
                    </label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Detalle interno o ayuda extra"
                        className={clInput}
                    />
                </div>
            </div>
            <div className="mt-4">
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Departamento que atiende *
                </label>
                <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(parseInt(e.target.value, 10))}
                    className={clInput}
                    required
                >
                    {departments.length === 0 ? (
                        <option value="">Sin departamentos cargados</option>
                    ) : (
                        departments.map((d) => (
                            <option key={d.id} value={d.id}>
                                {d.name}
                            </option>
                        ))
                    )}
                </select>
            </div>
            <button
                type="submit"
                disabled={submitting || departments.length === 0}
                className="mt-4 w-full bg-red-600 text-white py-2.5 rounded-xl font-semibold hover:bg-red-700 disabled:opacity-60"
            >
                {submitting ? 'Guardando...' : 'Añadir problema'}
            </button>
        </form>
    );
};

export default AdminProblemsPage;
