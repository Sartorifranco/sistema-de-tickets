import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { toast } from 'react-toastify';
// 🛑 Importamos 'io' y el namespace completo para los tipos
import io, * as SocketIOClient from 'socket.io-client'; 
import api, { getSocketUrl } from '../config/axiosConfig'; 
import { useAuth } from './AuthContext'; 

// 1. DEFINICIÓN DE TIPOS CLAVE
interface Notification {
    id: number;
    user_id: number;
    message: string;
    type: string;
    related_id: number;
    related_type: string;
    is_read: boolean;
    created_at: string;
}

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface NotificationContextType {
    // ✅ CRÍTICO: Exponemos el socket aquí para que AdminDashboard lo pueda usar
    socket: SocketIOClient.Socket | null; 
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markNotificationAsRead: (id: number) => Promise<void>;
    markAllNotificationsAsRead: () => Promise<void>;
    deleteNotification: (id: number) => Promise<void>;
    deleteAllNotifications: () => Promise<void>;
    addNotification: (message: string, type: ToastType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const SOCKET_SERVER_URL = getSocketUrl();

// 2. COMPONENTE PROVIDER
export const NotificationProvider: React.FC<{ children: ReactNode; socket?: SocketIOClient.Socket | null }> = ({ children, socket: externalSocket }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]); 
    const [unreadCount, setUnreadCount] = useState<number>(0);
    // ✅ Usamos el tipo Socket explícitamente
    const [socket, setSocket] = useState<SocketIOClient.Socket | null>(null); 
    const { isAuthenticated, user } = useAuth(); 

    const addNotification = useCallback((message: string, type: ToastType) => {
        if (toast[type]) {
            (toast[type] as any)(message); 
        } else {
            toast.info(message); 
        }
    }, []);

    const fetchNotifications = useCallback(async () => {
        if (isAuthenticated) {
            try {
                const res = await api.get('/api/notifications');
                const data: Notification[] = res.data.data || []; 
                setNotifications(data);
                setUnreadCount(data.filter((n: Notification) => !n.is_read).length);
            } catch (error) {
                console.error("Error fetching notifications:", error);
            }
        }
    }, [isAuthenticated]);

    // --- Lógica de Conexión de Socket.IO (usa socket externo si existe, sino crea uno) ---
    useEffect(() => {
        if (externalSocket) {
            setSocket(externalSocket);
            return () => {
                setSocket(null);
            };
        }
        if (isAuthenticated && user) {
            const token = localStorage.getItem('token'); 
            
            const newSocket: SocketIOClient.Socket = io(SOCKET_SERVER_URL, { 
                auth: { token: token || undefined }, 
                transports: ['websocket', 'polling']
            });

            setSocket(newSocket); 
            console.log(`[Frontend Socket] Intentando conectar a ${SOCKET_SERVER_URL}...`);

            newSocket.on("connect_error", (err: Error) => {
                console.error(`[Frontend Socket] Error de conexión: ${err.message}`);
            });
            
            newSocket.on('connect', () => {
                console.log(`[Frontend Socket] Conectado. ID: ${newSocket.id}`);
            });

            return () => {
                newSocket.disconnect();
                setSocket(null);
            };
        } else {
            setSocket(null);
        }
    }, [isAuthenticated, user, externalSocket]);

    // --- Lógica de Escucha de Eventos (Real-time) ---
    useEffect(() => {
        if (socket) { 
            const handleNewNotification = (notification: Notification) => {
                setNotifications((prev: Notification[]) => [notification, ...prev]); 
                setUnreadCount((prev) => prev + 1);
            };

            const handleDashboardUpdate = () => {
                fetchNotifications();
            };

            const handleLegacyNotification = () => {
                fetchNotifications();
            };

            socket.on('new_notification', handleNewNotification);
            socket.on('newNotification', handleLegacyNotification);
            socket.on('dashboard_update', handleDashboardUpdate); 

            return () => {
                socket.off('new_notification', handleNewNotification);
                socket.off('newNotification', handleLegacyNotification);
                socket.off('dashboard_update', handleDashboardUpdate);
            };
        }
    }, [socket, fetchNotifications]); 

    // --- Polling y Carga Inicial ---
    useEffect(() => {
        if (!isAuthenticated) return;

        fetchNotifications();

        const intervalId = setInterval(fetchNotifications, 120000); 

        return () => clearInterval(intervalId);
    }, [isAuthenticated, fetchNotifications]);

    // --- Funciones CRUD ---
    const markNotificationAsRead = useCallback(async (id: number) => {
        try {
            await api.put(`/api/notifications/${id}/read`);
            fetchNotifications();
        } catch (error) {
            console.error(error);
        }
    }, [fetchNotifications]);

    const markAllNotificationsAsRead = useCallback(async () => {
        try {
            await api.put('/api/notifications');
            addNotification('Todas las notificaciones marcadas como leídas.', 'success');
            fetchNotifications();
        } catch (error) {
            addNotification('Error al marcar notificaciones.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    const deleteNotification = useCallback(async (id: number) => {
        try {
            await api.delete(`/api/notifications/${id}`);
            addNotification('Notificación eliminada.', 'success');
            fetchNotifications();
        } catch (error) {
            addNotification('Error al eliminar notificación.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    const deleteAllNotifications = useCallback(async () => {
        try {
            await api.delete('/api/notifications/delete-all');
            addNotification('Todas las notificaciones eliminadas.', 'success');
            fetchNotifications();
        } catch (error) {
            addNotification('Error al eliminar notificaciones.', 'error');
        }
    }, [fetchNotifications, addNotification]);

    // 3. OBJETO VALUE: Aquí agregamos 'socket'
    const value: NotificationContextType = { 
        socket, // ✅ AHORA SÍ ESTÁ DISPONIBLE PARA EL RESTO DE LA APP
        notifications,
        unreadCount,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        deleteAllNotifications,
        addNotification,
    };

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
};

// 4. HOOK CUSTOM
export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};