import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Depositario, MaintenanceTask, MaintenanceRecord, Company, User } from '../types';
import { toast } from 'react-toastify';
import { formatLocalDate } from '../utils/dateFormatter';
import DepositaryMap from '../components/Depositarios/DepositaryMap';
import RouteGeneratorModal from '../components/Depositarios/RouteGeneratorModal';
import RouteHistoryModal from '../components/Depositarios/RouteHistoryModal';
import DepositaryReportModal from '../components/Depositarios/DepositaryReportModal';

// --- HELPERS ---
const getMaintenanceCardClass = (lastMaintenance: string | null | undefined): string => {
    if (!lastMaintenance) return 'border-t-4 border-red-500 bg-red-50';
    const last = new Date(lastMaintenance);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    last.setHours(0, 0, 0, 0);
    const daysSince = Math.floor((today.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    if (daysSince <= 15) return 'border-t-4 border-green-500 bg-green-50';
    if (daysSince <= 30) return 'border-t-4 border-yellow-500 bg-yellow-50';
    return 'border-t-4 border-red-500 bg-red-50';
};

const getCompanyBadgeClass = (companyName?: string | null) => {
    const name = String(companyName ?? '').toUpperCase();
    if (name.includes('COCA')) return 'bg-red-100 text-red-800 border-red-200';
    if (name.includes('CASISA')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (name.includes('ANJOR')) return 'bg-green-100 text-green-800 border-green-200';
    if (name.includes('ALT') || name.includes('SHELL')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (name.includes('EDASA') || name.includes('BANCOR')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (name.includes('BECERRA')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
};

// --- MODAL: CREAR / EDITAR DEPOSITARIO ---
const DepositarioModal: React.FC<{ 
    companies: Company[];
    initialData?: Depositario;
    onClose: () => void; 
    onSave: () => void;
}> = ({ companies, initialData, onClose, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const [formData, setFormData] = useState({
        alias: initialData?.alias || '',
        company_id: initialData?.company_id || '',
        serial_number: initialData?.serial_number || '',
        address: initialData?.address || '',
        location_description: initialData?.location_description || '',
        km_from_base: initialData?.km_from_base || '',
        duration_trip: initialData?.duration_trip || '',
        lat: initialData?.lat || '',
        lng: initialData?.lng || '',
        maintenance_freq: initialData?.maintenance_freq || '30'
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setFormData({ ...formData, address: value });
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        if (value.length < 3) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        searchTimeoutRef.current = setTimeout(async () => {
            setIsSearching(true);
            try {
                const viewbox = '-66.0,-29.0,-61.0,-35.0';
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&addressdetails=1&limit=8&countrycodes=ar&viewbox=${viewbox}`;
                const res = await axios.get(url);
                setSuggestions(res.data);
                setShowSuggestions(true);
            } catch (error) {
                console.error("Error buscando dirección:", error);
            } finally {
                setIsSearching(false);
            }
        }, 600);
    };

    const handleSelectSuggestion = (place: any) => {
        const shortAddress = place.display_name.split(',').slice(0, 3).join(','); 
        setFormData(prev => ({
            ...prev,
            address: shortAddress, 
            lat: place.lat,
            lng: place.lon
        }));
        setSuggestions([]);
        setShowSuggestions(false);
        toast.success("Ubicación seleccionada");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (initialData) {
                await api.put(`/api/depositarios/${initialData.id}`, formData);
                toast.success('Depositario actualizado');
            } else {
                await api.post('/api/depositarios', formData);
                toast.success('Depositario creado exitosamente');
            }
            onSave();
            onClose();
        } catch (error) {
            toast.error('Error al guardar datos');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-800">{initialData ? 'Editar Depositario' : 'Nuevo Depositario'}</h2>
                </div>
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Alias / Nombre *</label>
                        <input name="alias" required value={formData.alias} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: Peaje Ruta 9" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Empresa *</label>
                        <select name="company_id" required value={formData.company_id} onChange={handleChange} className="w-full p-2 border rounded bg-white">
                            <option value="">Seleccione Empresa</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="bg-blue-50 p-4 rounded border border-blue-100 relative">
                        <h3 className="text-xs font-bold text-blue-800 uppercase mb-3">Geolocalización</h3>
                        <div className="mb-3 relative">
                            <label className="block text-xs font-medium text-gray-700 mb-1">Buscar Dirección</label>
                            <input name="address" value={formData.address} onChange={handleAddressChange} autoComplete="off" className="w-full p-2 border rounded text-sm focus:ring-2 focus:ring-blue-400 outline-none" placeholder="Ej: Av. Colón 5000..." />
                            {isSearching && <span className="absolute right-3 top-8 text-xs text-gray-500 animate-pulse">Buscando...</span>}
                            {showSuggestions && suggestions.length > 0 && (
                                <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
                                    {suggestions.map((place, idx) => (
                                        <li key={idx} onClick={() => handleSelectSuggestion(place)} className="px-3 py-2 text-sm text-gray-700 hover:bg-blue-100 cursor-pointer border-b last:border-b-0 flex items-start gap-2">
                                            <span className="mt-1">📍</span><span>{place.display_name}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Latitud</label>
                                <input name="lat" value={formData.lat} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white outline-none" placeholder="-31.xxxxxx" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-700">Longitud</label>
                                <input name="lng" value={formData.lng} onChange={handleChange} className="w-full p-2 border rounded text-sm bg-white outline-none" placeholder="-64.xxxxxx" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nro. Serie</label>
                            <input name="serial_number" value={formData.serial_number} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Frec. Mantenimiento (Días)</label>
                            <input type="number" name="maintenance_freq" value={formData.maintenance_freq} onChange={handleChange} className="w-full p-2 border rounded" placeholder="30" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Descripción Ubicación</label>
                        <textarea name="location_description" value={formData.location_description} onChange={handleChange} className="w-full p-2 border rounded" rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Km desde Base</label>
                            <input name="km_from_base" value={formData.km_from_base} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: 25" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Duración Viaje</label>
                            <input name="duration_trip" value={formData.duration_trip} onChange={handleChange} className="w-full p-2 border rounded" placeholder="Ej: 45min" />
                        </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">Cancelar</button>
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 font-medium shadow">{initialData ? 'Actualizar' : 'Guardar'}</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// --- MODAL: REGISTRAR MANTENIMIENTO ---
const MaintenanceModal: React.FC<{ 
    depositario: Depositario; 
    onClose: () => void; 
    onSave: () => void 
}> = ({ depositario, onClose, onSave }) => {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [agents, setAgents] = useState<User[]>([]);
    
    const [performedBy, setPerformedBy] = useState<'permaquim' | 'bacar'>('bacar');
    const [companionUserId, setCompanionUserId] = useState<string>('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [date, setDate] = useState(now.toISOString().slice(0, 16));
    const [observations, setObservations] = useState('');
    const [billCounter, setBillCounter] = useState('');
    
    const [tasks, setTasks] = useState<MaintenanceTask[]>([
        { name: 'Limpieza', done: false, comment: '' },
        { name: 'Clear RAM', done: false, comment: '' },
        { name: 'Reposición de pieza/cabezal/sensor', done: false, comment: '' },
        { name: 'Desatasco de billete/sobre', done: false, comment: '' },
        { name: 'Atención remota', done: false, comment: '' },
        { name: 'Otro', done: false, comment: '' },
    ]);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await api.get('/api/users/agents');
                const list: User[] = (res.data?.data || []).filter(
                    (a: User) =>
                        (a.role === 'agent' || a.role === 'admin') &&
                        a.id !== user?.id
                );
                if (!cancelled) setAgents(list);
            } catch {
                if (!cancelled) setAgents([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.id]);

    const handleTaskChange = (index: number, field: keyof MaintenanceTask, value: any) => {
        const newTasks = [...tasks];
        newTasks[index] = { ...newTasks[index], [field]: value };
        setTasks(newTasks);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                performed_by: performedBy,
                date: date,
                observations: observations,
                tasks: tasks,
                bill_counter: billCounter,
            };
            if (companionUserId) {
                payload.companion_user_id = Number(companionUserId);
            }
            const res = await api.post(`/api/depositarios/${depositario.id}/maintenance`, payload);
            const ticketId = res.data?.ticketId;
            toast.success(
                ticketId
                    ? `Mantenimiento registrado. Ticket #${ticketId} creado y cerrado.`
                    : 'Mantenimiento registrado con éxito'
            );
            onSave();
            onClose();
        } catch (error) {
            toast.error('Error al registrar mantenimiento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[1100] p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Mantenimiento: {depositario.alias}</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl">✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Técnico Responsable</label>
                                <input type="text" value={user?.username} disabled className="w-full p-2 border bg-gray-100 rounded text-gray-600"/>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha y Hora</label>
                                <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500" required/>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Realizado por *</label>
                                <select value={performedBy} onChange={e => setPerformedBy(e.target.value as 'permaquim' | 'bacar')} className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 bg-white" required>
                                    <option value="bacar">Bacar</option>
                                    <option value="permaquim">Permaquim</option>
                                </select>
                            </div>
                        </div>

                        {/* INPUT DE CONTADOR DE BILLETES */}
                        <div className="mb-4 bg-yellow-50 p-4 rounded border border-yellow-200">
                            <label className="block text-sm font-bold text-gray-800 mb-1">📟 Contador del Cabezal (Billetes)</label>
                            <div className="flex items-center gap-2">
                                <input 
                                    type="number" 
                                    value={billCounter} 
                                    onChange={e => setBillCounter(e.target.value)} 
                                    className="w-full p-2 border rounded font-mono text-lg text-blue-900 font-bold" 
                                    placeholder="Ej: 54320" 
                                />
                                <span className="text-gray-500 text-sm">unidades</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Ingrese el valor total que muestra el display.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Acompañante (Opcional)</label>
                            <select
                                value={companionUserId}
                                onChange={(e) => setCompanionUserId(e.target.value)}
                                className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500 bg-white"
                            >
                                <option value="">Sin acompañante</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.first_name && a.last_name
                                            ? `${a.first_name} ${a.last_name}`
                                            : a.username}
                                        {a.role === 'admin' ? ' (Admin)' : ''}
                                    </option>
                                ))}
                            </select>
                            <p className="text-xs text-gray-500 mt-1">
                                Si elegís acompañante, se sumará automáticamente al ticket cerrado que se genera.
                            </p>
                        </div>
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="font-bold text-lg mb-3 text-gray-800">Checklist de Tareas</h3>
                            <div className="space-y-3">
                                {tasks.map((task, idx) => (
                                    <div key={idx} className="flex flex-col md:flex-row gap-3 items-start md:items-center bg-white p-3 rounded shadow-sm border">
                                        <div className="flex items-center h-full min-w-[220px]">
                                            <input type="checkbox" checked={task.done} onChange={e => handleTaskChange(idx, 'done', e.target.checked)} className="w-5 h-5 text-blue-600 rounded mr-3 cursor-pointer" id={`task-${idx}`} />
                                            <label htmlFor={`task-${idx}`} className={`cursor-pointer font-medium ${task.done ? 'text-blue-800' : 'text-gray-600'}`}>{task.name}</label>
                                        </div>
                                        <input type="text" placeholder="Detalles..." value={task.comment} onChange={e => handleTaskChange(idx, 'comment', e.target.value)} className="flex-grow p-2 border rounded text-sm focus:outline-none" disabled={!task.done} />
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Observaciones Generales</label>
                            <textarea value={observations} onChange={e => setObservations(e.target.value)} rows={3} className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500" placeholder="Observaciones..."></textarea>
                        </div>
                        <div className="flex justify-end gap-3 pt-4 border-t">
                            <button type="button" onClick={onClose} className="px-6 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium">Cancelar</button>
                            <button type="submit" disabled={loading} className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-md">{loading ? 'Guardando...' : 'Registrar Mantenimiento'}</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

// --- PÁGINA PRINCIPAL ---
const DepositariosPage: React.FC = () => {
    const { user } = useAuth();
    const [depositarios, setDepositarios] = useState<Depositario[]>([]);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [filterCompany, setFilterCompany] = useState('');

    // Estado de VISTA (Lista vs Mapa)
    const [viewMode, setViewMode] = useState<'list' | 'map'>('list'); 
    
    // Estados Modales
    const [selectedDepositario, setSelectedDepositario] = useState<Depositario | null>(null);
    const [editingDepositario, setEditingDepositario] = useState<Depositario | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [isRouteModalOpen, setIsRouteModalOpen] = useState(false); 
    const [isRouteHistoryOpen, setIsRouteHistoryOpen] = useState(false); 
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [historyData, setHistoryData] = useState<MaintenanceRecord[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (filterCompany) params.append('companyId', filterCompany);

            const depRes = await api.get(`/api/depositarios?${params.toString()}`);
            setDepositarios(depRes.data.data);

            try {
                const compRes = await api.get('/api/companies');
                setCompanies(compRes.data.data);
            } catch {
                setCompanies([]);
            }
        } catch (error) {
            toast.error("Error al cargar datos");
        } finally {
            setLoading(false);
        }
    }, [searchTerm, filterCompany]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleViewHistory = async (dep: Depositario) => {
        try {
            const res = await api.get(`/api/depositarios/${dep.id}/maintenance`);
            setHistoryData(res.data.data);
            setShowHistory(true);
        } catch (error) {
            toast.error("Error al cargar historial");
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm("¿Seguro que deseas eliminar este depositario?")) return;
        try {
            await api.delete(`/api/depositarios/${id}`);
            toast.success("Depositario eliminado");
            fetchData();
        } catch (error) {
            toast.error("Error al eliminar");
        }
    };

    // Función que llama la Hoja de Ruta al tocar "Realizar"
    const handleMaintenanceFromRoute = (dep: Depositario) => {
        setSelectedDepositario(dep); // Abre el modal de mantenimiento
        // No cerramos la hoja de ruta para no perder el contexto
    };

    // Función que se ejecuta al guardar el mantenimiento
    const handleMaintenanceSave = () => {
        fetchData(); // Recarga los datos (el depositario tendrá fecha HOY)
        // La Hoja de Ruta detectará el cambio y pondrá el check verde
    };

    // --- HELPER PARA RENDERIZAR TAREAS DEL CHECKLIST ---
    const renderTasks = (tasksJson: any) => {
        let tasks = [];
        try {
            // A veces viene como string desde MySQL, a veces ya como objeto
            tasks = typeof tasksJson === 'string' ? JSON.parse(tasksJson) : tasksJson;
        } catch (e) {
            return <span className="text-gray-400 italic">Error leyendo tareas</span>;
        }

        if (!Array.isArray(tasks) || tasks.length === 0) return <span className="text-gray-400 italic">Sin tareas registradas</span>;

        // Filtramos para mostrar solo las hechas, o todas si quieres ver las pendientes también
        const completedTasks = tasks.filter((t: any) => t.done);

        if (completedTasks.length === 0) return <span className="text-gray-400 italic">No se marcaron tareas específicas.</span>;

        return (
            <div className="grid grid-cols-1 gap-2 mt-2">
                {completedTasks.map((t: any, idx: number) => (
                    <div key={idx} className="flex items-start gap-2 text-sm bg-green-50 p-2 rounded border border-green-100">
                        <span className="text-green-600 font-bold">✓</span>
                        <div className="flex-grow">
                            <span className="font-medium text-gray-800">{t.name}</span>
                            {t.comment && (
                                <div className="text-xs text-gray-600 italic border-l-2 border-green-200 pl-2 mt-1">
                                    "{t.comment}"
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            {/* CABECERA Y CONTROLES */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Depositarios</h1>
                
                <div className="flex gap-4 items-center flex-wrap justify-end">
                    {/* TOGGLE DE VISTAS */}
                    <div className="bg-gray-200 p-1 rounded-lg flex shadow-inner">
                        <button
                            onClick={() => setViewMode('list')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'list' 
                                ? 'bg-white text-blue-600 shadow' 
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            📋 Lista
                        </button>
                        <button
                            onClick={() => setViewMode('map')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                                viewMode === 'map' 
                                ? 'bg-white text-blue-600 shadow' 
                                : 'text-gray-600 hover:text-gray-800'
                            }`}
                        >
                            🗺️ Mapa Inteligente
                        </button>
                    </div>

                    {/* BOTÓN REPORTES (NUEVO) */}
                    <button
                        onClick={() => setIsReportModalOpen(true)}
                        className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
                    >
                        📊 Reportes
                    </button>

                    {/* BOTÓN HISTORIAL RUTAS */}
                    <button
                        onClick={() => setIsRouteHistoryOpen(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
                    >
                        📂 Historial
                    </button>

                    {/* BOTÓN RUTA INTELIGENTE */}
                    <button
                        onClick={() => setIsRouteModalOpen(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2"
                    >
                        🚚 Hoja de Ruta
                    </button>

                    {['admin', 'agent'].includes(user?.role || '') && (
                        <button 
                            onClick={() => setIsCreateModalOpen(true)}
                            className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors flex items-center gap-2"
                        >
                            <span>+</span> Nuevo
                        </button>
                    )}
                </div>
            </div>

            {/* CONTENIDO PRINCIPAL */}
            {viewMode === 'list' ? (
                <>
                    {/* Filtros */}
                    <div className="bg-white p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4 items-center animate-fade-in">
                        <div className="flex-grow w-full">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar</label>
                            <input type="text" placeholder="Alias, Nro Serie o Dirección..." className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="w-full sm:w-64">
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                            <select className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white" value={filterCompany} onChange={e => setFilterCompany(e.target.value)}>
                                <option value="">Todas las Empresas</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Listado */}
                    {loading ? (
                        <p className="text-center py-10 text-gray-500">Cargando depositarios...</p>
                    ) : depositarios.length === 0 ? (
                        <p className="text-center py-10 text-gray-500">No se encontraron depositarios.</p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-fade-in">
                            {depositarios.map(dep => (
                                <div key={dep.id} className={`rounded-lg shadow-md hover:shadow-xl transition-all duration-300 flex flex-col relative group ${getMaintenanceCardClass(dep.last_maintenance)}`}>
                                    {user?.role === 'admin' && (
                                        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => setEditingDepositario(dep)} className="bg-white p-1 rounded-full shadow hover:bg-blue-50 text-blue-600">✏️</button>
                                            <button onClick={() => handleDelete(dep.id)} className="bg-white p-1 rounded-full shadow hover:bg-red-50 text-red-600">🗑️</button>
                                        </div>
                                    )}
                                    <div className="p-5 flex-grow">
                                        <div className="flex justify-between items-start mb-3 pr-14">
                                            <h3 className="font-bold text-xl text-gray-800 truncate" title={dep.alias}>{dep.alias}</h3>
                                        </div>
                                        <div className="mb-4">
                                            <span className={`text-xs px-2 py-1 rounded-full font-bold border ${getCompanyBadgeClass(dep.company_name)}`}>{dep.company_name || 'Sin empresa'}</span>
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-600">
                                            <p><span className="font-semibold text-gray-900">Serie:</span> {dep.serial_number || 'N/A'}</p>
                                            <p><span className="font-semibold text-gray-900">Ubicación:</span> {dep.address}</p>
                                            <div className="flex items-center gap-4 mt-2">
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs">🚗 {dep.km_from_base} km</span>
                                                <span className="bg-gray-100 px-2 py-1 rounded text-xs">⏱ {dep.duration_trip}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-5 py-3 border-t border-gray-100">
                                        <div className="text-xs text-gray-500 mb-3 flex justify-between">
                                            <span>Último mantenimiento:</span>
                                            <span className={`font-semibold ${dep.last_maintenance ? 'text-green-600' : 'text-red-500'}`}>
                                                {dep.last_maintenance ? formatLocalDate(dep.last_maintenance) : 'Nunca'}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button onClick={() => handleViewHistory(dep)} className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50 text-sm font-medium">Historial</button>
                                            <button onClick={() => setSelectedDepositario(dep)} className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium shadow">Mantenimiento</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="bg-white p-1 rounded-lg shadow-lg h-[700px] animate-fade-in border border-gray-200 relative z-0">
                    <DepositaryMap />
                </div>
            )}

            {/* MODALES */}
            
            {/* 1. Modal de Mantenimiento */}
            {selectedDepositario && (
                <MaintenanceModal 
                    depositario={selectedDepositario} 
                    onClose={() => setSelectedDepositario(null)} 
                    onSave={handleMaintenanceSave} 
                />
            )}

            {/* 2. Modal de Generar Ruta */}
            {isRouteModalOpen && (
                <RouteGeneratorModal 
                    depositarios={depositarios} 
                    onClose={() => setIsRouteModalOpen(false)} 
                    onMaintenanceOpen={handleMaintenanceFromRoute}
                />
            )}

            {/* 3. Modal de Historial de Rutas */}
            {isRouteHistoryOpen && (
                <RouteHistoryModal onClose={() => setIsRouteHistoryOpen(false)} />
            )}

            {/* 4. Modal de Reportes (NUEVO) */}
            {isReportModalOpen && (
                <DepositaryReportModal onClose={() => setIsReportModalOpen(false)} />
            )}

            {(isCreateModalOpen || editingDepositario) && (
                <DepositarioModal 
                    companies={companies}
                    initialData={editingDepositario || undefined}
                    onClose={() => { setIsCreateModalOpen(false); setEditingDepositario(null); }}
                    onSave={fetchData}
                />
            )}

            {/* =========================================================================== */}
            {/* MODAL DE HISTORIAL DE MANTENIMIENTO MEJORADO */}
            {/* =========================================================================== */}
            {showHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
                            <h2 className="text-2xl font-bold text-gray-800">📋 Historial de Mantenimiento</h2>
                            <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-red-600 font-bold text-2xl transition-colors">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow bg-gray-100 space-y-6">
                            {historyData.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                                    <span className="text-6xl mb-4">📭</span>
                                    <p className="text-lg">No hay registros de mantenimiento aún.</p>
                                </div>
                            ) : (
                                historyData.map(log => (
                                    <div key={log.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                        
                                        {/* HEADER DEL REGISTRO */}
                                        <div className="bg-gradient-to-r from-blue-50 to-white px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-blue-600 text-white rounded-full w-12 h-12 flex items-center justify-center font-bold text-lg shadow-md">
                                                    {(log.first_name || log.username || 'U').charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-900 text-lg">{log.first_name ? `${log.first_name} ${log.last_name}` : log.username}</p>
                                                    <p className="text-xs text-gray-500 uppercase tracking-wide">Técnico Responsable</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-sm font-bold text-blue-900 bg-blue-100 px-3 py-1 rounded-full inline-block">
                                                    📅 {formatLocalDate(log.maintenance_date)}
                                                </p>
                                                {((log as any).performed_by) && (
                                                    <p className="text-xs text-gray-600 mt-1 font-semibold">
                                                        🏢 {(log as any).performed_by === 'permaquim' ? 'Permaquim' : 'Bacar'}
                                                    </p>
                                                )}
                                                {(log as any).companion_name && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        <span className="font-bold">Acompañante:</span> {(log as any).companion_name}
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* CUERPO DEL REGISTRO */}
                                        <div className="p-6">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                                {/* COLUMNA IZQUIERDA: DATOS */}
                                                <div>
                                                    {/* Contador */}
                                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 mb-4">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-gray-500 font-bold uppercase">Contador Cabezal</span>
                                                            <span className="font-mono text-2xl text-blue-700 font-bold">
                                                                {(log as any).bill_counter ? (log as any).bill_counter.toLocaleString() : 'N/A'}
                                                            </span>
                                                        </div>
                                                        {(log as any).usage_delta > 0 && (
                                                            <div className="text-right mt-1">
                                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-bold border border-green-200">
                                                                    ▲ +{(log as any).usage_delta.toLocaleString()} desde el último
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Observaciones */}
                                                    <div>
                                                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Observaciones</h4>
                                                        <p className="text-sm text-gray-700 italic bg-yellow-50 p-3 rounded border border-yellow-100">
                                                            "{log.observations || 'Sin observaciones adicionales.'}"
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* COLUMNA DERECHA: TAREAS (CHECKLIST) */}
                                                <div>
                                                    <h4 className="text-xs font-bold text-gray-400 uppercase mb-3 pb-1 border-b">Tareas Realizadas</h4>
                                                    {renderTasks((log as any).tasks_log)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 rounded-b-xl flex justify-end">
                            <button onClick={() => setShowHistory(false)} className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded shadow transition-colors">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepositariosPage;