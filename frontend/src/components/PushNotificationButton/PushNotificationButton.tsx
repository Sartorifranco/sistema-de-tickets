/**
 * Botón para activar notificaciones Web Push (requiere User Gesture)
 */
import React, { useState } from 'react';
import { Bell, BellRing, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { subscribeUserToPush } from '../../utils/pushNotifications';

const PushNotificationButton: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | null>(() =>
        typeof Notification !== 'undefined' ? Notification.permission : null
    );

    const handleClick = async () => {
        if (permission === 'denied') return;
        if (permission === 'granted') return;

        setLoading(true);
        try {
            const ok = await subscribeUserToPush();
            setPermission(typeof Notification !== 'undefined' ? Notification.permission : null);
            if (ok) {
                toast.success('Notificaciones activadas correctamente.');
            } else {
                toast.warn('No se pudieron activar las notificaciones.');
            }
        } catch {
            toast.error('Error al activar notificaciones.');
        } finally {
            setLoading(false);
        }
    };

    if (typeof Notification === 'undefined') return null;

    if (permission === 'granted') {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200">
                <BellRing className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium hidden sm:inline">Notificaciones Activadas</span>
                <CheckCircle className="w-4 h-4 text-green-600 sm:hidden" />
            </div>
        );
    }

    if (permission === 'denied') {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 text-amber-800 border border-amber-200" title="Habilitar desde el candado del navegador">
                <Bell className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium hidden sm:inline">Habilitar desde el candado del navegador</span>
            </div>
        );
    }

    return (
        <button
            onClick={handleClick}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <span className="hidden sm:inline">{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
        </button>
    );
};

export default PushNotificationButton;
