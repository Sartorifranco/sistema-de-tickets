import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Company, ApiResponseError } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';
import { Pencil, Trash2, Plus, Building, Search, X } from 'lucide-react';
import { clCard, clInput, clModalPanel } from '../utils/cleanLightUi';

const CompanyFormModal: React.FC<{
    isOpen: boolean;
    editing: Company | null;
    onClose: () => void;
    onSaved: () => void;
}> = ({ isOpen, editing, onClose, onSaved }) => {
    const [name, setName] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) setName(editing?.name || '');
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = name.trim();
        if (!trimmed) {
            toast.warn('El nombre de la empresa no puede estar vacío.');
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await api.put(`/api/companies/${editing.id}`, { name: trimmed });
            } else {
                await api.post('/api/companies', { name: trimmed });
            }
            toast.success(`Empresa ${editing ? 'actualizada' : 'creada'} exitosamente.`);
            onSaved();
            onClose();
        } catch (err) {
            const message = isAxiosErrorTypeGuard(err)
                ? (err.response?.data as ApiResponseError)?.message || 'Error al guardar empresa.'
                : 'Error inesperado.';
            toast.error(message);
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
            <div className={`${clModalPanel} max-w-md`}>
                <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                            <Building className="w-5 h-5" />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-lg font-bold text-slate-900 break-words">
                                {editing ? 'Editar empresa' : 'Nueva empresa'}
                            </h2>
                            <p className="text-xs text-slate-500">
                                {editing ? `Modificando "${editing.name}"` : 'Ingresá el nombre de la empresa a registrar'}
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-800" aria-label="Cerrar">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
                    <div>
                        <label htmlFor="company-name" className="block text-sm font-medium text-gray-700 mb-1">Nombre de la empresa</label>
                        <input
                            id="company-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className={clInput}
                            placeholder="Ej.: Bacar S.A."
                            autoFocus
                            required
                        />
                    </div>
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                        <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl text-sm font-medium bg-gray-100 text-gray-800 border border-gray-200 hover:bg-gray-200/80">
                            Cancelar
                        </button>
                        <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 shadow-sm disabled:opacity-60">
                            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : <><Plus className="w-4 h-4" /> Añadir empresa</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const AdminCompaniesPage: React.FC = () => {
    const { user } = useAuth();
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editing, setEditing] = useState<Company | null>(null);

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.get('/api/companies');
            setCompanies(response.data.data || []);
        } catch (err: unknown) {
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al cargar empresas.' : 'Error inesperado.';
            setError(message);
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (user?.role === 'admin') fetchCompanies();
    }, [user, fetchCompanies]);

    const handleDeleteCompany = async (company: Company) => {
        if (window.confirm(`¿Estás seguro de que quieres eliminar la empresa "${company.name}"?`)) {
            try {
                await api.delete(`/api/companies/${company.id}`);
                toast.success('Empresa eliminada exitosamente.');
                fetchCompanies();
            } catch (err) {
                const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error al eliminar empresa.' : 'Error inesperado.';
                toast.error(message);
            }
        }
    };
    
    const openCreate = () => {
        setEditing(null);
        setIsFormOpen(true);
    };

    const openEdit = (company: Company) => {
        setEditing(company);
        setIsFormOpen(true);
    };

    const filteredCompanies = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return companies;
        return companies.filter((c) => c.name.toLowerCase().includes(term));
    }, [companies, searchTerm]);

    if (loading) return <div className="p-8 text-center">Cargando empresas...</div>;
    if (error) return <div className="p-8 text-center text-red-500">{error}</div>;

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Gestión de Empresas</h1>
                    <p className="text-sm text-slate-500 mt-1">
                        {companies.length} {companies.length === 1 ? 'empresa registrada' : 'empresas registradas'}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={openCreate}
                    className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl shadow-sm"
                >
                    <Plus className="w-5 h-5" /> Nueva empresa
                </button>
            </div>

            <div className={`${clCard} min-w-0 overflow-hidden`}>
                <div className="p-4 border-b border-gray-100">
                    <label className="relative block">
                        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="search"
                            placeholder="Buscar empresa..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className={`${clInput} pl-9`}
                        />
                    </label>
                </div>

                {filteredCompanies.length === 0 ? (
                    <div className="p-10 text-center text-slate-500">
                        {companies.length === 0 ? (
                            <>
                                <p className="font-semibold text-slate-700">No hay empresas registradas.</p>
                                <p className="text-sm mt-1">Usá el botón "Nueva empresa" para crear la primera.</p>
                            </>
                        ) : (
                            'No hay empresas que coincidan con la búsqueda.'
                        )}
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {filteredCompanies.map((company) => (
                            <li key={company.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-gray-50/80 transition-colors min-w-0">
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className="w-9 h-9 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                                        <Building className="w-4 h-4" />
                                    </span>
                                    <span className="font-medium text-slate-900 break-words min-w-0">{company.name}</span>
                                </div>
                                <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap justify-end">
                                    <Link
                                        to={`/admin/companies/${company.id}/departments`}
                                        className="text-red-600 hover:text-red-800 hover:underline text-sm font-semibold"
                                    >
                                        Gestionar Deptos.
                                    </Link>
                                    <button type="button" onClick={() => openEdit(company)} className="p-2 rounded-lg text-gray-600 hover:text-blue-700 hover:bg-blue-50" title="Editar" aria-label={`Editar ${company.name}`}>
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button type="button" onClick={() => handleDeleteCompany(company)} className="p-2 rounded-lg text-gray-600 hover:text-red-700 hover:bg-red-50" title="Eliminar" aria-label={`Eliminar ${company.name}`}>
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <CompanyFormModal
                isOpen={isFormOpen}
                editing={editing}
                onClose={() => setIsFormOpen(false)}
                onSaved={fetchCompanies}
            />
        </div>
    );
};

export default AdminCompaniesPage;
