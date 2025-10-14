// frontend/src/config/axiosConfig.ts
import axios, { InternalAxiosRequestConfig } from 'axios';

const API_BASE_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// --- LÓGICA CENTRALIZADA Y ÚNICA PARA EL TOKEN ---
// Este interceptor se ejecuta ANTES de cada petición que sale de la aplicación.
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Lee el token directamente de localStorage en el momento de la petición.
        // Esta es la forma más segura y actualizada de obtenerlo.
        const token = localStorage.getItem('token');
        
        if (token) {
            // Si el token existe, lo añade al encabezado de autorización.
            config.headers.Authorization = `Bearer ${token}`;
        }
        // Si no hay token, el encabezado simplemente no se añade.
        
        return config;
    },
    (error) => {
        // Maneja errores que puedan ocurrir al configurar la petición.
        return Promise.reject(error);
    }
);

// Opcional: Interceptor de respuesta para manejar errores globales como 401
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Si el servidor devuelve 401 (No autorizado), significa que el token
            // es inválido o ha expirado. Podríamos forzar un logout aquí.
            console.error("Error de autenticación (401). El token puede ser inválido.");
            // window.location.href = '/login'; // Ejemplo de redirección forzada
        }
        return Promise.reject(error);
    }
);

export default api;
