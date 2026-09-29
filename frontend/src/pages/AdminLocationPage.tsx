import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import { MapPin, Plus, Pencil, Trash2, Search, X } from 'lucide-react';
import api from '../config/axiosConfig';
import { clCard, clInput, clModalPanel, clTdCompact as clTd, clThCompact as clTh, clThCompactRight as clThRight } from '../utils/cleanLightUi';

interface Company {
    id: number;
    name: string;
}

interface Location {
    id: number;
    name: string;
    type: string;
    company_id: number;
    company_name: string;
}

interface LocationFormState {
    name: string;
    type: string;
    company_id: string;
}

const EMPTY_FORM: LocationFormState = { name: '', type: 'Ubicación', company_id: '' };

const LocationFormModal: React.FC<{
    isOpen: boolean;
    editing: Location | null;
    companies: Company[];
    onClose: () => void;
    onSaved: () => void;
}> = ({ isOpen, editing, companies, onClose, onSaved }) => {
    const [formData, setFormData] = useState<LocationFormState>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setFormData(
            editing
                ? { name: editing.name, type: editing.type, company_id: String(editing.company_id) }
                : EMPTY_FORM
        );
    }, [isOpen, editing]);

    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            toast.warn('El nombre es obligatorio.');
            return;
        }
        if (!formData.company_id) {
            toast.warn('Por favor, selecciona una empresa.');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/api/admin/locations/${editing.id}`, formData);
            } else {
                await api.post('/api/admin/locations', formData);
            }
            toast.success(`Ubicación ${editing ? 'actualizada' : 'creada'}!`);
            onSaved();
            onClose();
        } catch (error) {
            toast.error('Error al guardar la ubicación.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            role="dialog"
            aria-modal="true"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div className={`${clModalPanel} max-w-lg`}>
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <MapPin className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 break-words">
                                {editing ? 'Editar ubicación' : 'Nueva ubicación'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {editing ? `Modificando "${editing.name}"` : 'Completá los datos para registrar la ubicación'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <div>
                        <label htmlFor="loc-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                        <input id="loc-name" name="name" value={formData.name} onChange={handleChange} className={clInput} placeholder="Ej.: Sucursal Centro" required autoFocus />
                    </div>
                    <div>
                        <label htmlFor="loc-type" className="block text-sm font-medium text-gray-700 mb-1">Tipo</label>
                        <input id="loc-type" name="type" value={formData.type} onChange={handleChange} className={clInput} placeholder="Ej.: Sucursal, Depósito, Oficina" required />
                    </div>
                    <div>
                        <label htmlFor="loc-company" className="block text-sm font-medium text-gray-700 mb-1">Empresa</label>
                        <select id="loc-company" name="company_id" value={formData.company_id} onChange={handleChange} className={clInput} required>
                            <option value="">Seleccione...</option>
                            {companies.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200/80">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:opacity-60">
                            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear ubicación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminLocationsPage: React.FC = () => {
    const [locations, setLocations] = useState<Location[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Location | null>(null);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [locRes, compRes] = await Promise.all([
                api.get('/api/admin/locations'),
                api.get('/api/companies')
            ]);
            setLocations(locRes.data.data || []);
            setCompanies(compRes.data.data || []);
        } catch (error) {
            toast.error('No se pudieron cargar los datos.');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const openCreate = () => {
        setEditing(null);
        setIsFormOpen(true);
    };

    const openEdit = (location: Location) => {
        setEditing(location);
        setIsFormOpen(true);
    };

    const handleDelete = async (loc: Location) => {
        if (window.confirm(`¿Seguro que quieres eliminar la ubicación "${loc.name}"?`)) {
            try {
                await api.delete(`/api/admin/locations/${loc.id}`);
                toast.success('Ubicación eliminada.');
                fetchData();
            } catch (error) {
                toast.error('Error al eliminar.');
            }
        }
    };

    const filteredLocations = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return locations;
        return locations.filter(
            (loc) =>
                loc.name.toLowerCase().includes(term) ||
                (loc.company_name || '').toLowerCase().includes(term) ||
                (loc.type || '').toLowerCase().includes(term)
        );
    }, [locations, searchTerm]);

    if (isLoading) return <div className="p-8 text-center">Cargando...</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Administrar Ubicaciones</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {locations.length} {locations.length === 1 ? 'ubicación registrada' : 'ubicaciones registradas'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Nueva ubicación
                </button>
            </div>

            <div className={`${clCard} min-w-0 overflow-hidden`}>
                <div className="p-4 border-b border-gray-100">
                    <label className="relative block">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="search"
                            placeholder="Buscar por nombre, tipo o empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`${clInput} pl-9`}
                        />
                    </label>
                </div>

                {filteredLocations.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        {locations.length === 0 ? (
                            <>
                                <p className="font-semibold text-slate-700">Todavía no hay ubicaciones.</p>
                                <p className="text-sm mt-1">Usá el botón "Nueva ubicación" para crear la primera.</p>
                            </>
                        ) : (
                            'No hay ubicaciones que coincidan con la búsqueda.'
                        )}
                    </div>
                ) : (
                    <>
                        {/* Tabla (sm y superior) */}
                        <table className="hidden sm:table w-full table-fixed divide-y divide-gray-100">
                            <thead className="bg-gray-50/90">
                                <tr>
                                    <th className={clTh}>Nombre</th>
                                    <th className={`${clTh} w-[20%]`}>Tipo</th>
                                    <th className={`${clTh} w-[26%]`}>Empresa</th>
                                    <th className={`${clThRight} w-28`}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredLocations.map((loc) => (
                                    <tr key={loc.id} className="hover:bg-gray-50/80 transition-colors">
                                        <td className={`${clTd} font-medium`}>{loc.name}</td>
                                        <td className={clTd}>{loc.type}</td>
                                        <td className={clTd}>{loc.company_name}</td>
                                        <td className={`${clTd} text-right`}>
                                            <div className="inline-flex items-center gap-1">
                                                <button type="button" onClick={() => openEdit(loc)} className="p-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50" title="Editar" aria-label={`Editar ${loc.name}`}>
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button type="button" onClick={() => handleDelete(loc)} className="p-2 rounded-lg text-gray-600 hover:text-red-700 hover:bg-red-50" title="Eliminar" aria-label={`Eliminar ${loc.name}`}>
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>

                        {/* Tarjetas (móvil) */}
                        <div className="sm:hidden divide-y divide-gray-100">
                            {filteredLocations.map((loc) => (
                                <div key={loc.id} className="p-4 flex items-start justify-between gap-3 min-w-0">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-slate-900 break-words">{loc.name}</p>
                                        <p className="text-xs text-slate-500 mt-0.5 break-words">{loc.type} · {loc.company_name}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button type="button" onClick={() => openEdit(loc)} className="p-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50" aria-label={`Editar ${loc.name}`}>
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button type="button" onClick={() => handleDelete(loc)} className="p-2 rounded-lg text-gray-600 hover:text-red-700 hover:bg-red-50" aria-label={`Eliminar ${loc.name}`}>
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            <LocationFormModal
                isOpen={isFormOpen}
                editing={editing}
                companies={companies}
                onClose={() => setIsFormOpen(false)}
                onSaved={fetchData}
            />
        </div>
    );
};

export default AdminLocationsPage;
