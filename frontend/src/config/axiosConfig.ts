import axios, { InternalAxiosRequestConfig } from 'axios';

// 1. Detectar automáticamente el host (IP o Dominio)
const currentHost = window.location.hostname;

// 2. Construir la URL base apuntando SIEMPRE al puerto 5040
// NOTA: No agregamos '/api' al final aquí para dar flexibilidad y evitar duplicados (/api/api)
// Las llamadas en las páginas deben incluir el '/api' (ej: api.get('/api/users'))
const API_BASE_URL = `http://${currentHost}:5040`;

console.log(`[Axios] Conectando a: ${API_BASE_URL}`);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor de Token
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Interceptor de Errores (401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            console.error("Sesión expirada o inválida.");
            // Opcional: window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;