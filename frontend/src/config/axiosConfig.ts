import axios, { InternalAxiosRequestConfig } from 'axios';

// 1. Detección Inteligente del Host
// Si estás en 'bacarsa.dyndns.org:8001', el host es 'bacarsa.dyndns.org'
// Si estás en '192.168.0.9:8001', el host es '192.168.0.9'
const currentHost = window.location.hostname;

// 2. Construcción de la URL Base
// IMPORTANTE: El puerto del backend es 5040.
// NO agregamos '/api' aquí para evitar confusiones. Axios apuntará a la raíz del servidor.
const API_BASE_URL = `http://${currentHost}:5040`;

console.log(`[Axios] Configurado apuntando a: ${API_BASE_URL}`);

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
    // withCredentials: true es vital si usas Cookies, pero si usas Bearer Token no molesta.
});

// 3. Interceptor para inyectar el Token
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

// 4. Interceptor de Respuestas (Manejo de Errores Global)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.code === "ERR_NETWORK") {
            console.error("❌ Error de Red: No se puede conectar al Backend en puerto 5040.");
        }
        if (error.response && error.response.status === 401) {
            console.warn("⚠️ Sesión expirada.");
            // Opcional: localStorage.removeItem('token'); window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export default api;