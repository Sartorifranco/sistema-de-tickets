import React, { createContext, useState, useContext, ReactNode, useCallback, useEffect } from 'react';
import { toast } from 'react-toastify';
import { Notification } from '../types';
import api from '../config/axiosConfig';
import { useAuth } from './AuthContext';
import { SocketInstance } from '../App';

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (notificationId: number) => Promise<void>;
    markAllNotificationsAsRead: () => Promise<void>;
    deleteNotification: (notificationId: number) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    addNotification: (message: string, type: 'info' | 'success' | 'error' | 'warning') => void;
    socket: SocketInstance | null;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode, socket: SocketInstance | null }> = ({ children, socket }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const { isAuthenticated } = useAuth();

    const addNotification = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning') => {
        toast[type](message);
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (!isAuthenticated) return;
        try {
            const response = await api.get('/api/notifications');
            const fetched = response.data.data || [];
            setNotifications(fetched);
            setUnreadCount(fetched.filter((n: Notification) => !n.is_read).length);
        } catch (error) {
            console.error("Error fetching notifications:", error);
        }
    }, [isAuthenticated]);

    const markNotificationAsRead = useCallback(async (id: number) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            fetchNotifications();
        } catch (err) {
            addNotification('Error al marcar la notificación.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    const markAllNotificationsAsRead = useCallback(async () => {
        try {
            await api.put(`/api/notifications`); // Ruta corregida para coincidir con el backend
            addNotification('Todas las notificaciones marcadas como leídas.', 'success');
            fetchNotifications();
        } catch (err) {
            addNotification('Error al marcar todas las notificaciones.', 'error');
        }
    }, [fetchNotifications, addNotification]);
    
    const deleteNotification = useCallback(async (id: number) => {
        try {
            await api.delete(`/api/notifications/${id}`);
            addNotification('Notificación eliminada.', 'success');
            fetchNotifications();
        } catch (err) {
            addNotification('Error al eliminar la notificación.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    const deleteAllNotifications = useCallback(async () => {
        try {
            await api.delete(`/api/notifications/delete-all`);
            addNotification('Todas las notificaciones han sido eliminadas.', 'success');
            fetchNotifications();
        } catch (err) {
            addNotification('Error al eliminar las notificaciones.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    useEffect(() => {
        if (isAuthenticated) {
            fetchNotifications();
        }
    }, [isAuthenticated, fetchNotifications]);

    // ✅ CORRECCIÓN: Lógica para escuchar y manejar notificaciones en tiempo real
    useEffect(() => {
        if (socket) {
            const handleNotification = (newNotification: Notification) => {
                toast.info(`🔔 ${newNotification.message}`);
                // Actualiza el estado de forma optimista para una respuesta instantánea
                setNotifications(prev => [newNotification, ...prev]);
                setUnreadCount(prev => prev + 1);
            };

            // Escucha el evento 'new_notification' que envía el backend
            socket.on('new_notification', handleNotification);

            // Limpia el listener al desmontar el componente para evitar duplicados
            return () => {
                socket.off('new_notification', handleNotification);
            };
        }
    }, [socket]); // El array de dependencias solo necesita el socket

    const value = {
        notifications,
        unreadCount,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        deleteAllNotifications,
        addNotification,
        socket,
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};