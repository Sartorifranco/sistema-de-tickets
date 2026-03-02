import React, { createContext, useState, useContext, useEffect, useCallback, ReactNode } from 'react';
import api from '../config/axiosConfig';
import { User, ApiResponseError } from '../types';
import { isAxiosErrorTypeGuard } from '../utils/typeGuards';

interface LoginData {
    email: string;
    password: string;
}

interface RegisterData {
    username: string;
    email: string;
    password: string;
    role: 'client' | 'agent' | 'admin';
    department_id?: number | null;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    loading: boolean;
    error: string | null;
    login: (credentials: LoginData) => Promise<boolean>;
    register: (userData: any) => Promise<boolean>;
    logout: () => void;
    refreshSession: () => Promise<boolean>;
    clearError: () => void;
    updateUserContext: (updatedUserData: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true); // Inicia en true para la verificación inicial
    const [error, setError] = useState<string | null>(null);

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        delete api.defaults.headers.common['Authorization'];
        setToken(null);
        setUser(null);
        setIsAuthenticated(false);
        setError(null);
    }, []);
    
    // ✅ CORRECCIÓN: El 'useEffect' de verificación de sesión es más simple y robusto.
    useEffect(() => {
        const verifyUserSession = async () => {
            const storedToken = localStorage.getItem('token');
            if (storedToken) {
                try {
                    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                    const response = await api.get('/api/auth/me');
                    const userData = response.data.user;
                    // Usar token actual de localStorage (puede haberse actualizado por refresh del interceptor)
                    setUser(userData);
                    setIsAuthenticated(true);
                    setToken(localStorage.getItem('token'));
                } catch (err) {
                    // Si el token es inválido o expiró, llama a logout para limpiar todo
                    logout(); 
                }
            }
            setLoading(false); // La carga inicial termina aquí, haya o no token
        };
        verifyUserSession();
    }, [logout]); // logout está en las dependencias

    // ✅ CORRECCIÓN: La función 'login' ahora es más segura y explícita.
    const login = useCallback(async (credentials: LoginData) => {
        setLoading(true);
        setError(null);
        try {
            const response = await api.post('/api/auth/login', credentials);
            
            if (response.data && response.data.token && response.data.user) {
                const { token: newToken, refreshToken: newRefreshToken, user: userData } = response.data;
    
                localStorage.setItem('token', newToken);
                if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);
                api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
                setToken(newToken);
                setUser(userData);
                setIsAuthenticated(true);
    
                setLoading(false);
                return true; // Login fue exitoso
            } else {
                throw new Error('La respuesta del servidor no tiene el formato esperado.');
            }
        } catch (err: unknown) {
            setLoading(false);
            const message = isAxiosErrorTypeGuard(err) ? (err.response?.data as ApiResponseError)?.message || 'Error de inicio de sesión.' : 'Error inesperado.';
            setError(message);
            logout(); // Llama a logout para limpiar cualquier estado inconsistente
            return false; // Login falló
        }
    }, [logout]);


    const refreshSession = useCallback(async (): Promise<boolean> => {
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (!storedRefreshToken) return false;
        try {
            const response = await api.post('/api/auth/refresh', { refreshToken: storedRefreshToken });
            const { token: newToken, user: userData } = response.data;
            localStorage.setItem('token', newToken);
            api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;
            setToken(newToken);
            setUser(userData);
            setIsAuthenticated(true);
            return true;
        } catch {
            logout();
            return false;
        }
    }, [logout]);

    const register = useCallback(async (userData: any) => { return false; }, []);
    const clearError = useCallback(() => setError(null), []);
    const updateUserContext = useCallback((updatedUserData: Partial<User>) => {
        setUser(prevUser => prevUser ? { ...prevUser, ...updatedUserData } : null);
    }, []);

    const value = { user, token, isAuthenticated, loading, error, login, register, logout, refreshSession, clearError, updateUserContext };
    
    // Muestra una pantalla de carga solo durante la verificación inicial
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600"></div>
            </div>
        );
    }

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};