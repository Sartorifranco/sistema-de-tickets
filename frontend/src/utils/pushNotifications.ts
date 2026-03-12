/**
 * Web Push nativas - Suscripción del usuario
 */
import api from '../config/axiosConfig';

const VAPID_PUBLIC_KEY = 'BFGJT3QJNAj6Zibb8ZNCvXJMo4pqQvz0jqdu2gJvmb_HN2hrwYF0i7RA8rNt7cU30qt3Ij8RIBhlusSIKluF3ig';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export async function subscribeUserToPush(): Promise<boolean> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('[WebPush] Navegador no soporta Service Worker o PushManager');
        return false;
    }

    try {
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');
        let swRegistration = registration;
        if (!swRegistration) {
            swRegistration = await navigator.serviceWorker.register('/sw.js');
            await navigator.serviceWorker.ready;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            console.warn('[WebPush] Permiso de notificaciones denegado');
            return false;
        }

        const subscription = await swRegistration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        });

        const subJson = subscription.toJSON();
        await api.post('/api/notifications/subscribe', {
            subscription: subJson,
            endpoint: subscription.endpoint,
            keys: subJson.keys,
        });

        console.log('[WebPush] Suscripción enviada al backend');
        return true;
    } catch (err) {
        console.error('[WebPush] Error al suscribir:', err);
        return false;
    }
}
