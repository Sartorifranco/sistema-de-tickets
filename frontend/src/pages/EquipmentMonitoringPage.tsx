import React, { useState, useEffect } from 'react';
import { collection, getDocs, Timestamp } from 'firebase/firestore';
import { db, EQUIPMENT_COLLECTION } from '../config/firebaseConfig';
import { toast } from 'react-toastify';

// Tipos según estructura de HWAgente (scanner.py + firebase_client.py)
interface Disco {
  dispositivo: string;
  punto_montaje: string;
  modelo_disco?: string;
  total_gb: number;
  usado_gb: number;
  libre_gb: number;
  porcentaje_usado: number;
}

interface ServicioCritico {
  servicio: string;
  estado: string;
  critico: boolean;
}

interface EquipoMonitor {
  uuid: string;
  hostname: string;
  sistema_operativo?: string;
  procesador?: string;
  nucleos_fisicos?: number;
  ram_total_gb?: number;
  cpu_uso_porcentaje?: number;
  ram_uso_porcentaje?: number;
  discos?: Disco[];
  servicios_criticos?: ServicioCritico[];
  ip_publica?: string;
  anydesk_id?: string;
  usuarios?: { usuario_actual?: string; usuarios_activos?: string[] };
  errores_recientes?: Array<{ fecha?: string; mensaje?: string; fuente?: string }>;
  ultima_sincronizacion?: Timestamp | { _seconds?: number };
  aplicaciones_activas?: Array<{ nombre?: string; ram_mb?: number; cpu_porcentaje?: number }>;
}

const formatLastSync = (ts: Timestamp | { _seconds?: number } | undefined): string => {
  if (!ts) return 'Sin datos';
  try {
    const sec = ts instanceof Timestamp ? ts.seconds : (ts as any)?._seconds;
    if (!sec) return 'Sin datos';
    const date = new Date(sec * 1000);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 2) return 'Hace instantes';
    if (diffMin < 60) return `Hace ${diffMin} min`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `Hace ${diffHr}h`;
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return 'Sin datos';
  }
};

const getStatusColor = (ts: Timestamp | { _seconds?: number } | undefined): string => {
  if (!ts) return 'bg-gray-400';
  try {
    const sec = ts instanceof Timestamp ? ts.seconds : (ts as any)?._seconds;
    if (!sec) return 'bg-gray-400';
    const diffMin = (Date.now() / 1000 - sec) / 60;
    if (diffMin <= 10) return 'bg-green-500';
    if (diffMin <= 30) return 'bg-yellow-500';
    return 'bg-red-500';
  } catch {
    return 'bg-gray-400';
  }
};

const EquipmentMonitoringPage: React.FC = () => {
  const [equipos, setEquipos] = useState<EquipoMonitor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEquipo, setSelectedEquipo] = useState<EquipoMonitor | null>(null);

  const fetchEquipos = async () => {
    setLoading(true);
    setError(null);
    try {
      const snapshot = await getDocs(collection(db, EQUIPMENT_COLLECTION));
      const datos: EquipoMonitor[] = snapshot.docs.map(doc => ({
        uuid: doc.id,
        ...doc.data()
      } as EquipoMonitor));
      // Ordenar por última sincronización (más reciente primero)
      datos.sort((a, b) => {
        const tsa = (a.ultima_sincronizacion as any)?.seconds ?? (a.ultima_sincronizacion as any)?._seconds ?? 0;
        const tsb = (b.ultima_sincronizacion as any)?.seconds ?? (b.ultima_sincronizacion as any)?._seconds ?? 0;
        return tsb - tsa;
      });
      setEquipos(datos);
    } catch (err: any) {
      console.error('Error leyendo Firestore:', err);
      setError(err?.message || 'No se pudo conectar a Firebase. Verifica las reglas de Firestore.');
      toast.error('Error al cargar equipos monitoreados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEquipos();
  }, []);

  return (
    <div className="container mx-auto p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
      <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold text-gray-800">Monitoreo de Equipos (HWAgente)</h1>
        <button
          onClick={fetchEquipos}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors flex items-center gap-2 disabled:opacity-50"
        >
          {loading ? '⟳ Cargando...' : '↻ Actualizar'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
          <p className="font-semibold">⚠️ {error}</p>
          <p className="text-sm mt-2">
            En Firebase Console → Firestore → Reglas, agrega (o usa temporalmente para lectura):
            <code className="block mt-2 p-2 bg-gray-100 rounded text-xs overflow-x-auto">
              allow read: if true;
            </code>
          </p>
        </div>
      )}

      {loading && equipos.length === 0 ? (
        <p className="text-center py-16 text-gray-500">Cargando equipos...</p>
      ) : equipos.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-md border border-gray-200">
          <span className="text-6xl">🖥️</span>
          <p className="text-lg text-gray-600 mt-4">No hay equipos monitoreados</p>
          <p className="text-sm text-gray-500 mt-2">
            Instalá el <a href="https://github.com/surlymeyer24/HWAgente" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">HWAgente</a> en las PCs para que envíen datos a Firebase.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {equipos.map((eq) => (
            <div
              key={eq.uuid}
              onClick={() => setSelectedEquipo(eq)}
              className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 border-l-4 cursor-pointer overflow-hidden"
              style={{ borderLeftColor: getStatusColor(eq.ultima_sincronizacion) === 'bg-green-500' ? '#22c55e' : getStatusColor(eq.ultima_sincronizacion) === 'bg-yellow-500' ? '#eab308' : '#ef4444' }}
            >
              <div className="p-5">
                <div className="flex justify-between items-start">
                  <h3 className="font-bold text-xl text-gray-800 truncate" title={eq.hostname}>{eq.hostname || eq.uuid}</h3>
                  <span className={`w-3 h-3 rounded-full ${getStatusColor(eq.ultima_sincronizacion)} flex-shrink-0 mt-1.5`} title="Estado de conexión" />
                </div>
                <p className="text-xs text-gray-500 mt-1">{eq.sistema_operativo || 'Windows'}</p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500 block text-xs">CPU</span>
                    <span className={`font-bold ${(eq.cpu_uso_porcentaje ?? 0) > 80 ? 'text-red-600' : (eq.cpu_uso_porcentaje ?? 0) > 60 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {eq.cpu_uso_porcentaje ?? '—'}%
                    </span>
                  </div>
                  <div className="bg-gray-50 p-2 rounded">
                    <span className="text-gray-500 block text-xs">RAM</span>
                    <span className={`font-bold ${(eq.ram_uso_porcentaje ?? 0) > 85 ? 'text-red-600' : (eq.ram_uso_porcentaje ?? 0) > 70 ? 'text-yellow-600' : 'text-green-600'}`}>
                      {eq.ram_uso_porcentaje ?? '—'}%
                    </span>
                  </div>
                </div>
                {(eq.servicios_criticos?.filter(s => s.critico).length ?? 0) > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {eq.servicios_criticos?.filter(s => s.critico).slice(0, 2).map((s, i) => (
                      <span key={i} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">⚠ {s.servicio}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-gray-50 px-5 py-2 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
                <span>Última sync: {formatLastSync(eq.ultima_sincronizacion)}</span>
                {eq.anydesk_id && eq.anydesk_id !== 'No instalado' && (
                  <span className="font-mono text-blue-600">AnyDesk: {eq.anydesk_id}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal detalle */}
      {selectedEquipo && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm" onClick={() => setSelectedEquipo(null)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b flex justify-between items-center bg-gray-50">
              <h2 className="text-2xl font-bold text-gray-800">🖥️ {selectedEquipo.hostname}</h2>
              <button onClick={() => setSelectedEquipo(null)} className="text-gray-500 hover:text-red-600 font-bold text-2xl">✕</button>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500">Procesador</p>
                  <p className="font-medium text-sm">{selectedEquipo.procesador || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">RAM Total</p>
                  <p className="font-medium text-sm">{selectedEquipo.ram_total_gb ?? '—'} GB</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Usuario actual</p>
                  <p className="font-medium text-sm">{selectedEquipo.usuarios?.usuario_actual || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">AnyDesk ID</p>
                  <p className="font-mono text-sm text-blue-600">{selectedEquipo.anydesk_id || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">IP Pública</p>
                  <p className="font-mono text-sm">{selectedEquipo.ip_publica || '—'}</p>
                </div>
              </div>

              {selectedEquipo.discos && selectedEquipo.discos.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Discos</h3>
                  <div className="space-y-2">
                    {selectedEquipo.discos.map((d, i) => (
                      <div key={i} className="bg-gray-50 p-3 rounded flex justify-between items-center">
                        <span className="font-mono text-sm">{d.dispositivo}</span>
                        <span className={`font-bold ${d.porcentaje_usado > 90 ? 'text-red-600' : d.porcentaje_usado > 75 ? 'text-yellow-600' : 'text-green-600'}`}>
                          {d.porcentaje_usado}% usado ({d.libre_gb} GB libres)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEquipo.servicios_criticos && selectedEquipo.servicios_criticos.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Servicios críticos</h3>
                  <div className="space-y-1">
                    {selectedEquipo.servicios_criticos.map((s, i) => (
                      <div key={i} className={`flex justify-between p-2 rounded ${s.critico ? 'bg-red-50' : 'bg-green-50'}`}>
                        <span>{s.servicio}</span>
                        <span className={s.critico ? 'text-red-600 font-semibold' : 'text-green-600'}>{s.estado}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEquipo.errores_recientes && selectedEquipo.errores_recientes.length > 0 && (
                <div>
                  <h3 className="font-bold text-red-800 mb-2">Errores recientes</h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {selectedEquipo.errores_recientes.map((e, i) => (
                      <div key={i} className="bg-red-50 p-2 rounded text-sm border border-red-100">
                        <span className="text-gray-600">{e.fuente}</span>: {e.mensaje || (e as any).error}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedEquipo.aplicaciones_activas && selectedEquipo.aplicaciones_activas.length > 0 && (
                <div>
                  <h3 className="font-bold text-gray-800 mb-2">Apps activas (top)</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedEquipo.aplicaciones_activas.slice(0, 8).map((a, i) => (
                      <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs">{a.nombre} ({a.ram_mb ?? 0} MB)</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EquipmentMonitoringPage;
