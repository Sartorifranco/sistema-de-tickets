import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import api from '../../config/axiosConfig';

interface MapPoint {
    id: number;
    alias: string;
    address: string;
    lat: number;
    lng: number;
    company_name: string;
    last_maintenance_date: string | null;
    open_tickets_count: number;
    daysPassed: number;
    mapStatus: 'red' | 'yellow' | 'green';
}

const MapRecenter = ({ lat, lng }: { lat: number; lng: number }) => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => map.invalidateSize(), 300);
        map.setView([lat, lng], map.getZoom());
    }, [lat, lng, map]);
    return null;
};

const DepositaryMap: React.FC = () => {
    const [points, setPoints] = useState<MapPoint[]>([]);
    const [loading, setLoading] = useState(true);
    const defaultCenter: [number, number] = [-31.4201, -64.1888]; 

    useEffect(() => {
        const fetchMapData = async () => {
            try {
                const response = await api.get('/api/depositarios/map-data');
                if (response.data.success) {
                    setPoints(response.data.data);
                }
            } catch (error) {
                console.error('Error cargando mapa:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchMapData();
    }, []);

    const getIcon = (status: string) => {
        let colorClass = 'bg-green-500';
        if (status === 'red') colorClass = 'bg-red-600 animate-pulse'; 
        if (status === 'yellow') colorClass = 'bg-yellow-500';

        return L.divIcon({
            className: 'custom-marker',
            html: `<div class="${colorClass} w-5 h-5 rounded-full border-2 border-white shadow-md"></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
            popupAnchor: [0, -10]
        });
    };

    if (loading) return <div className="h-96 flex items-center justify-center text-gray-700 font-medium">Cargando Mapa...</div>;

    return (
        <div className="h-full w-full rounded-lg overflow-hidden relative z-0">
            {points.length === 0 && (
                <div className="absolute top-4 right-4 z-[1000] bg-white p-4 rounded shadow-lg max-w-sm border border-gray-200">
                    <h3 className="font-bold text-gray-800">Mapa Vacío</h3>
                    <p className="text-sm text-gray-600">No hay coordenadas cargadas.</p>
                </div>
            )}

            <MapContainer center={defaultCenter} zoom={11} style={{ height: '100%', width: '100%' }}>
                <MapRecenter lat={defaultCenter[0]} lng={defaultCenter[1]} />
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© OpenStreetMap' />

                {points.map((point) => (
                    <Marker key={point.id} position={[point.lat, point.lng]} icon={getIcon(point.mapStatus)}>
                        <Popup className="custom-popup">
                            <div className="p-3 min-w-[250px] font-sans">
                                <div className="border-b pb-3 mb-3">
                                    <h3 className="font-extrabold text-lg text-gray-900 leading-tight mb-2">{point.alias}</h3>
                                    <span className="text-xs font-bold bg-slate-200 text-slate-800 px-2 py-1 rounded-full border border-slate-300">
                                        {point.company_name}
                                    </span>
                                </div>
                                
                                {/* SEMÁFORO DE ESTADO (Sin porcentajes raros) */}
                                {point.mapStatus === 'red' && (
                                    <div className="bg-red-100 border-l-4 border-red-500 text-red-800 px-3 py-2 rounded mb-3 text-sm">
                                        <div className="font-bold flex items-center gap-2">🚨 CRÍTICO</div>
                                        {point.open_tickets_count > 0 ? (
                                            <span className="block text-xs mt-1">• Tiene {point.open_tickets_count} ticket(s) de falla.</span>
                                        ) : (
                                            <span className="block text-xs mt-1">• Mantenimiento vencido (+30 días).</span>
                                        )}
                                    </div>
                                )}
                                {point.mapStatus === 'yellow' && (
                                    <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-800 px-3 py-2 rounded mb-3 text-sm">
                                        <div className="font-bold">⚠️ ALERTA</div>
                                        <span className="block text-xs mt-1">Mantenimiento hace +15 días.</span>
                                    </div>
                                )}
                                {point.mapStatus === 'green' && (
                                    <div className="bg-green-100 border-l-4 border-green-500 text-green-800 px-3 py-2 rounded mb-3 text-sm">
                                        <div className="font-bold">✅ ESTADO ÓPTIMO</div>
                                        <span className="block text-xs mt-1">Mantenimiento al día.</span>
                                    </div>
                                )}
                                
                                <p className="text-sm font-semibold text-gray-700 text-center mb-4">
                                    {point.daysPassed >= 999 ? 'Nunca visitado.' : `${point.daysPassed} días desde la última visita.`}
                                </p>
                                
                                <p className="text-xs text-gray-500 mb-2 flex items-start gap-1">
                                    <span>📍</span> {point.address || 'Sin dirección'}
                                </p>

                                <a 
                                    href={`https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-md transition-colors no-underline shadow-sm"
                                >
                                    Ver ruta en Google Maps 🚗
                                </a>
                            </div>
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};

export default DepositaryMap;