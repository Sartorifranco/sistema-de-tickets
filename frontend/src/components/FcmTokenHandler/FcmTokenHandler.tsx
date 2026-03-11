/**
 * FcmTokenHandler - Solicita permisos de notificaciones, obtiene el token FCM
 * y lo envía al backend para recibir Push Notifications del Módulo de Compras.
 * Módulo de Compras - Fase 3
 */
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { requestNotificationPermissionAndToken } from '../../config/firebaseClient';
import api from '../../config/axiosConfig';

const FcmTokenHandler: React.FC = () => {
    const { user, isAuthenticated } = useAuth();
    const hasAttemptedRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !user || hasAttemptedRef.current) return;

        const registerFcmToken = async () => {
            hasAttemptedRef.current = true;
            try {
                // Registrar el service worker si aún no está registrado
                if ('serviceWorker' in navigator) {
                    const registration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
                    if (!registration) {
                        await navigator.serviceWorker.register('/firebase-messaging-sw.js');
                    }
                }

                const token = await requestNotificationPermissionAndToken();
                if (token) {
                    await api.post('/api/notifications/register-token', { fcmToken: token });
                    console.log('[FCM] Token enviado al backend correctamente.');
                }
            } catch (err) {
                console.warn('[FCM] No se pudo registrar el token:', err);
            }
        };

        registerFcmToken();
    }, [isAuthenticated, user]);

    return null;
};

export default FcmTokenHandler;
