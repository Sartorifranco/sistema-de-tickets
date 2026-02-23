/**
 * Firebase Client - FCM (Push Notifications)
 * Módulo de Compras - Fase 3
 */
import { app } from './firebaseConfig';
import { getMessaging, getToken, Messaging } from 'firebase/messaging';

let messaging: Messaging | null = null;

const getMessagingInstance = (): Messaging | null => {
    if (typeof window === 'undefined') return null;
    try {
        if (!messaging) {
            messaging = getMessaging(app);
        }
        return messaging;
    } catch {
        return null;
    }
};

/**
 * Solicita permiso y obtiene el token FCM.
 * Requiere que exista public/firebase-messaging-sw.js
 */
export const requestNotificationPermissionAndToken = async (): Promise<string | null> => {
    if (typeof window === 'undefined' || !('Notification' in window)) return null;
    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const msg = getMessagingInstance();
        if (!msg) return null;

        const vapidKey = process.env.REACT_APP_FIREBASE_VAPID_KEY;
        const token = await getToken(msg, vapidKey ? { vapidKey } : {});
        return token || null;
    } catch (err) {
        console.warn('[FCM] No se pudo obtener token:', err);
        return null;
    }
};
