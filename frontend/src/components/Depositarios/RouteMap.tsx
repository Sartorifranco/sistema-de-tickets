import React, { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { BASE_COORDS, RouteSheet, RouteSheetStop } from './routePlanner';

const baseIcon = L.divIcon({
    className: 'custom-base-icon',
    html: '<div class="bg-blue-800 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg text-lg">🏢</div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
});

const toneClass: Record<string, string> = {
    green: 'bg-green-600',
    red: 'bg-red-600',
    amber: 'bg-amber-500',
    blue: 'bg-blue-600',
};

function stopTone(stop: RouteSheetStop): keyof typeof toneClass {
    if (stop.items.every((item) => item.done)) return 'green';
    if (stop.items.some((item) => item.tickets > 0)) return 'red';
    if (stop.items.some((item) => item.never || item.overdue > 0)) return 'amber';
    return 'blue';
}

function numberIcon(n: number, tone: keyof typeof toneClass) {
    return L.divIcon({
        className: 'custom-number-icon',
        html: `<div class="${toneClass[tone]} text-white w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-md font-bold text-sm">${n}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
    });
}

const MapBounds = ({ points }: { points: [number, number][] }) => {
    const map = useMap();
    useEffect(() => {
        const timer = window.setTimeout(() => map.invalidateSize(), 200);
        if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
        return () => window.clearTimeout(timer);
    }, [points, map]);
    return null;
};

interface Props {
    sheet: RouteSheet;
    mapPoints: [number, number][];
    overBudget: boolean;
}

const RouteMap: React.FC<Props> = ({ sheet, mapPoints, overBudget }) => (
    <div className="h-full w-full relative">
        <MapContainer center={BASE_COORDS} zoom={11} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
            <MapBounds points={sheet.stops.length > 0 ? mapPoints : [BASE_COORDS]} />
            {sheet.stops.length > 0 && (
                <Polyline positions={mapPoints} color={overBudget ? '#dc2626' : '#2563eb'} weight={5} opacity={0.75} />
            )}
            <Marker position={BASE_COORDS} icon={baseIcon} />
            {sheet.stops.map((stop, index) => (
                <Marker key={stop.key} position={[stop.lat, stop.lng]} icon={numberIcon(index + 1, stopTone(stop))}>
                    <Popup>
                        <div className="text-sm">
                            <div className="font-bold">{stop.companyName}</div>
                            <div>Llega {stop.arrivalLabel}</div>
                            {stop.items.map((item) => (
                                <div key={item.id}>{item.alias} · {item.daysLabel}</div>
                            ))}
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 rounded-lg shadow px-3 py-2 text-[11px] text-gray-700 space-y-0.5">
            <div><span className="inline-block w-2 h-2 rounded-full bg-red-600 mr-1" />Falla abierta</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />Atrasado</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-blue-600 mr-1" />En plazo</div>
            <div><span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1" />Hecho hoy</div>
        </div>
    </div>
);

export default RouteMap;
