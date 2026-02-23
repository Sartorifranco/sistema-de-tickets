import axios, { InternalAxiosRequestConfig } from 'axios';

// 1. URL del backend: variable de entorno (local) o según host actual (producción)
// En local: crea frontend/.env con REACT_APP_API_PORT=5042 (o la URL completa en REACT_APP_BACKEND_URL)
const apiPort = process.env.REACT_APP_API_PORT || '5040';
const explicitUrl = process.env.REACT_APP_BACKEND_URL;
const currentHost = window.location.hostname;
const API_BASE_URL = explicitUrl || `http://${currentHost}:${apiPort}`;

console.log(`[Axios] Configurado apuntando a: ${API_BASE_URL}`);
export { API_BASE_URL };

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
            console.error("❌ Error de Red: No se puede conectar al Backend en", API_BASE_URL);
        }
        // Solo "sesión expirada" cuando teníamos token y nos rechazaron (no en login)
        if (error.response?.status === 401 && error.config?.headers?.Authorization && !error.config?.url?.includes('/login')) {
            console.warn("⚠️ Sesión expirada.");
        }
        return Promise.reject(error);
    }
);

export default api;