/**
 * WebPushHandler - Suscripción a Web Push nativas al iniciar sesión
 */
import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { subscribeUserToPush } from '../../utils/pushNotifications';

const WebPushHandler: React.FC = () => {
    const { isAuthenticated, user } = useAuth();
    const hasAttemptedRef = useRef(false);

    useEffect(() => {
        if (!isAuthenticated || !user || hasAttemptedRef.current) return;

        hasAttemptedRef.current = true;
        subscribeUserToPush();
    }, [isAuthenticated, user]);

    return null;
};

export default WebPushHandler;
