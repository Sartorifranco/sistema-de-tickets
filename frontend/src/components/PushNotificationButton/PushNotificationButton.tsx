/**
 * Botón interactivo para activar notificaciones Web Push (requiere User Gesture)
 * Estados según Notification.permission: default | granted | denied
 */
import React, { useState } from 'react';
import { Bell, BellRing } from 'lucide-react';
import { toast } from 'react-toastify';
import { subscribeUserToPush } from '../../utils/pushNotifications';

const baseButtonClass =
    'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2';

const PushNotificationButton: React.FC = () => {
    const [loading, setLoading] = useState(false);
    const [permission, setPermission] = useState<NotificationPermission | null>(() =>
        typeof Notification !== 'undefined' ? Notification.permission : null
    );

    const handleClick = async () => {
        if (permission === 'granted') {
            toast.info('Las notificaciones ya están configuradas en este dispositivo.');
            return;
        }
        if (permission === 'denied') {
            toast.warn('Por favor, haz clic en el candado junto a la URL para permitir las notificaciones.');
            return;
        }

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

    // ESTADO ACEPTADO ('granted')
    if (permission === 'granted') {
        return (
            <button
                type="button"
                onClick={handleClick}
                className={`${baseButtonClass} bg-green-100 text-green-800 border border-green-300 hover:bg-green-200 focus:ring-green-500`}
                aria-label="Notificaciones activadas"
            >
                <BellRing className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Notificaciones Activadas</span>
            </button>
        );
    }

    // ESTADO BLOQUEADO ('denied')
    if (permission === 'denied') {
        return (
            <button
                type="button"
                onClick={handleClick}
                className={`${baseButtonClass} bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 focus:ring-red-500`}
                aria-label="Notificaciones bloqueadas"
            >
                <Bell className="w-5 h-5 flex-shrink-0" />
                <span className="hidden sm:inline">Notificaciones Bloqueadas</span>
            </button>
        );
    }

    // ESTADO POR DEFECTO ('default')
    return (
        <button
            type="button"
            onClick={handleClick}
            disabled={loading}
            className={`${baseButtonClass} bg-white text-blue-700 border border-blue-300 hover:bg-blue-50 hover:border-blue-400 focus:ring-blue-500 disabled:opacity-60 disabled:cursor-not-allowed`}
            aria-label="Activar notificaciones"
        >
            <Bell className="w-5 h-5 flex-shrink-0" />
            <span className="hidden sm:inline">{loading ? 'Activando...' : 'Activar Notificaciones'}</span>
        </button>
    );
};

export default PushNotificationButton;
