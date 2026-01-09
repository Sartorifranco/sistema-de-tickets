import React, { useState, useEffect, useCallback } from 'react';
import api from '../config/axiosConfig';
import { useAuth } from '../context/AuthContext';
import { Depositario, MaintenanceTask, MaintenanceRecord, Company } from '../types';
import { toast } from 'react-toastify';
import { formatLocalDate } from '../utils/dateFormatter';

// --- HELPERS ---
const getCompanyBadgeClass = (companyName: string = '') => {
    const name = companyName.toUpperCase();
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
    const [formData, setFormData] = useState({
        alias: initialData?.alias || '',
        company_id: initialData?.company_id || '',
        serial_number: initialData?.serial_number || '',
        address: initialData?.address || '',
        location_description: initialData?.location_description || '',
        km_from_base: initialData?.km_from_base || '',
        duration_trip: initialData?.duration_trip || ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
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
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
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
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Nro. Serie</label>
                            <input name="serial_number" value={formData.serial_number} onChange={handleChange} className="w-full p-2 border rounded" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Dirección</label>
                            <input name="address" value={formData.address} onChange={handleChange} className="w-full p-2 border rounded" />
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
                        <button type="submit" disabled={loading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{initialData ? 'Actualizar' : 'Guardar'}</button>
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
    
    const [companion, setCompanion] = useState('');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const [date, setDate] = useState(now.toISOString().slice(0, 16));
    const [observations, setObservations] = useState('');
    
    const [tasks, setTasks] = useState<MaintenanceTask[]>([
        { name: 'Limpieza', done: false, comment: '' },
        { name: 'Clear RAM', done: false, comment: '' },
        { name: 'Reposición de pieza/cabezal/sensor', done: false, comment: '' },
        { name: 'Desatasco de billete/sobre', done: false, comment: '' },
        { name: 'Otro', done: false, comment: '' },
    ]);

    const handleTaskChange = (index: number, field: keyof MaintenanceTask, value: any) => {
        const newTasks = [...tasks];
        newTasks[index] = { ...newTasks[index], [field]: value };
        setTasks(newTasks);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await api.post(`/api/depositarios/${depositario.id}/maintenance`, {
                companion_name: companion,
                date: date,
                observations: observations,
                tasks: tasks
            });
            toast.success('Mantenimiento registrado con éxito');
            onSave();
            onClose();
        } catch (error) {
            toast.error('Error al registrar mantenimiento');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6 border-b pb-4">
                        <h2 className="text-2xl font-bold text-gray-800">Mantenimiento: {depositario.alias}</h2>
                        <button onClick={onClose} className="text-gray-500 hover:text-gray-700 font-bold text-xl">✕</button>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Técnico Responsable</label>
                                <input type="text" value={user?.username} disabled className="w-full p-2 border bg-gray-100 rounded text-gray-600"/>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-1">Fecha y Hora</label>
                                <input type="datetime-local" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500" required/>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Acompañante (Opcional)</label>
                            <input type="text" value={companion} onChange={e => setCompanion(e.target.value)} className="w-full p-2 border rounded focus:ring-blue-500 focus:border-blue-500" placeholder="Nombre del acompañante"/>
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
    
    // Estados Modales
    const [selectedDepositario, setSelectedDepositario] = useState<Depositario | null>(null);
    const [editingDepositario, setEditingDepositario] = useState<Depositario | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyData, setHistoryData] = useState<MaintenanceRecord[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchTerm) params.append('search', searchTerm);
            if (filterCompany) params.append('companyId', filterCompany);

            const [depRes, compRes] = await Promise.all([
                api.get(`/api/depositarios?${params.toString()}`),
                api.get('/api/companies')
            ]);
            setDepositarios(depRes.data.data);
            setCompanies(compRes.data.data);
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

    return (
        <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <h1 className="text-3xl font-bold text-gray-800">Gestión de Depositarios</h1>
                {['admin', 'agent'].includes(user?.role || '') && (
                    <button 
                        onClick={() => setIsCreateModalOpen(true)}
                        className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors flex items-center gap-2"
                    >
                        <span>+</span> Nuevo Depositario
                    </button>
                )}
            </div>

            {/* Filtros */}
            <div className="bg-white p-4 rounded-lg shadow-md mb-8 flex flex-col sm:flex-row gap-4 items-center">
                <div className="flex-grow w-full">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Buscar</label>
                    <input 
                        type="text" 
                        placeholder="Alias, Nro Serie o Dirección..." 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="w-full sm:w-64">
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Empresa</label>
                    <select 
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                        value={filterCompany}
                        onChange={e => setFilterCompany(e.target.value)}
                    >
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
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {depositarios.map(dep => (
                        <div key={dep.id} className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border-t-4 border-gray-300 flex flex-col relative group">
                            
                            {user?.role === 'admin' && (
                                <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => setEditingDepositario(dep)} className="bg-white p-1 rounded-full shadow hover:bg-blue-50 text-blue-600" title="Editar">✏️</button>
                                    <button onClick={() => handleDelete(dep.id)} className="bg-white p-1 rounded-full shadow hover:bg-red-50 text-red-600" title="Eliminar">🗑️</button>
                                </div>
                            )}

                            <div className="p-5 flex-grow">
                                <div className="flex justify-between items-start mb-3 pr-14">
                                    <h3 className="font-bold text-xl text-gray-800 truncate" title={dep.alias}>{dep.alias}</h3>
                                </div>
                                <div className="mb-4">
                                    <span className={`text-xs px-2 py-1 rounded-full font-bold border ${getCompanyBadgeClass(dep.company_name)}`}>
                                        {dep.company_name}
                                    </span>
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
                                    <button 
                                        onClick={() => handleViewHistory(dep)}
                                        className="flex-1 bg-white border border-gray-300 text-gray-700 py-2 rounded hover:bg-gray-50 text-sm font-medium transition-colors"
                                    >
                                        Historial
                                    </button>
                                    <button 
                                        onClick={() => setSelectedDepositario(dep)}
                                        className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm font-medium shadow transition-colors"
                                    >
                                        Mantenimiento
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modales */}
            {selectedDepositario && (
                <MaintenanceModal depositario={selectedDepositario} onClose={() => setSelectedDepositario(null)} onSave={fetchData} />
            )}

            {(isCreateModalOpen || editingDepositario) && (
                <DepositarioModal 
                    companies={companies}
                    initialData={editingDepositario || undefined}
                    onClose={() => { setIsCreateModalOpen(false); setEditingDepositario(null); }}
                    onSave={fetchData}
                />
            )}

            {/* ✅ MODAL DE HISTORIAL MEJORADO */}
            {showHistory && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
                        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                            <h2 className="text-2xl font-bold text-gray-800">Historial de Mantenimiento</h2>
                            <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-red-600 font-bold text-xl">✕</button>
                        </div>
                        
                        <div className="p-6 overflow-y-auto flex-grow bg-gray-100 space-y-4">
                            {historyData.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">No hay registros de mantenimiento para este equipo.</div>
                            ) : (
                                historyData.map(log => (
                                    <div key={log.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                        {/* Encabezado de la tarjeta */}
                                        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex flex-col sm:flex-row justify-between items-start sm:items-center">
                                            <div className="flex items-center gap-3">
                                                <div className="bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold text-sm">
                                                    {(log.first_name || log.username).charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-gray-800 text-sm">
                                                        {log.first_name ? `${log.first_name} ${log.last_name}` : log.username}
                                                    </p>
                                                    {log.companion_name && (
                                                        <p className="text-xs text-gray-500">Acompañante: {log.companion_name}</p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right mt-2 sm:mt-0">
                                                <span className="text-xs font-semibold text-blue-700 bg-blue-100 px-2 py-1 rounded">
                                                    {formatLocalDate(log.maintenance_date)}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Cuerpo de la tarjeta */}
                                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                            {/* Columna Izquierda: Tareas */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 border-b pb-1">Checklist</h4>
                                                <ul className="space-y-2">
                                                    {(typeof log.tasks_log === 'string' ? JSON.parse(log.tasks_log) : log.tasks_log).map((t: MaintenanceTask, i: number) => (
                                                        t.done && (
                                                            <li key={i} className="text-sm flex items-start gap-2">
                                                                <span className="text-green-500">✔</span>
                                                                <span className="text-gray-700">
                                                                    <strong>{t.name}</strong>
                                                                    {t.comment && <span className="text-gray-500 text-xs block italic ml-4">↳ {t.comment}</span>}
                                                                </span>
                                                            </li>
                                                        )
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Columna Derecha: Observaciones */}
                                            <div>
                                                <h4 className="text-xs font-bold text-gray-400 uppercase mb-2 border-b pb-1">Observaciones Generales</h4>
                                                {log.observations ? (
                                                    <p className="text-sm text-gray-600 italic bg-gray-50 p-3 rounded">
                                                        "{log.observations}"
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-400">Sin observaciones adicionales.</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        <div className="p-4 border-t bg-gray-50 rounded-b-lg flex justify-end">
                            <button onClick={() => setShowHistory(false)} className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold rounded shadow">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DepositariosPage;