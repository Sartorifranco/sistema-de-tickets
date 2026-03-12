/**
 * Web Push nativas - Suscripción del usuario
 */
import api from '../config/axiosConfig';

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

export const subscribeUserToPush = async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        throw new Error('El navegador no soporta notificaciones Push.');
    }

    try {
        // 1. Registrar y ESPERAR a que el SW esté activo
        const registration = await navigator.serviceWorker.register('/sw.js');
        await navigator.serviceWorker.ready;

        // 2. Comprobar si ya existe una suscripción
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            // 3. Suscribir si no existe
            const publicVapidKey = process.env.REACT_APP_VAPID_PUBLIC_KEY;
            if (!publicVapidKey) throw new Error('VAPID Key no configurada');

            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(publicVapidKey),
            });
        }

        // 4. Enviar al backend (subscription.toJSON() para serialización correcta)
        const subJson = subscription.toJSON();
        await api.post('/api/notifications/subscribe', subJson);
        return subscription;
    } catch (error) {
        console.error('[WebPush] Error al suscribir:', error);
        throw error;
    }
};
