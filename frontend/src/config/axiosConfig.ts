import axios, { InternalAxiosRequestConfig } from 'axios';

// URL del backend: variable de entorno (local) o según host actual (producción)
const apiPort = process.env.REACT_APP_API_PORT || '5040';
const explicitUrl = process.env.REACT_APP_BACKEND_URL;
const currentHost = window.location.hostname;
const API_BASE_URL = explicitUrl || `http://${currentHost}:${apiPort}`;

console.log(`[Axios] Configurado apuntando a: ${API_BASE_URL}`);
export { API_BASE_URL };

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// ─── Request interceptor: inyectar token en cada petición ───────────────────
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

// ─── Guardia para evitar múltiples redirects cuando varias peticiones
//     concurrentes fallan con 401 al mismo tiempo ────────────────────────────
let isHandlingExpiredSession = false;

/**
 * Limpia TODO el estado de sesión del navegador y redirige al login.
 * Se usa cuando el backend devuelve 401 en una petición autenticada.
 */
function handleExpiredSession(): void {
    if (isHandlingExpiredSession) return;
    isHandlingExpiredSession = true;

    console.warn('[Auth] Sesión inválida o expirada — limpiando estado y redirigiendo al login.');

    // Limpiar token del almacenamiento local
    localStorage.removeItem('token');
    // Limpiar el header por defecto de Axios (evita que peticiones en vuelo lo sigan enviando)
    delete api.defaults.headers.common['Authorization'];

    // window.location.replace no agrega entrada al historial del navegador,
    // así el usuario no puede volver atrás con el botón "Atrás" a una pantalla vacía.
    window.location.replace('/login');
}

// ─── Response interceptor: manejar sesiones expiradas globalmente ────────────
api.interceptors.response.use(
    // Respuestas exitosas pasan sin modificación
    (response) => response,

    (error) => {
        // Error de red (backend caído, sin conexión, etc.)
        if (error.code === 'ERR_NETWORK') {
            console.error('❌ Error de red: no se puede conectar al backend en', API_BASE_URL);
            return Promise.reject(error);
        }

        const status: number | undefined = error.response?.status;
        const url: string = error.config?.url ?? '';
        const hasAuthHeader: boolean = !!error.config?.headers?.Authorization;

        // Solo actuar si:
        //  1. El servidor respondió 401
        //  2. La petición llevaba un token (era una petición autenticada)
        //  3. No es el propio endpoint de login (evita bucle si las credenciales son incorrectas)
        const isAuthenticatedRequest = hasAuthHeader;
        const isLoginEndpoint = url.includes('/login');

        if (status === 401 && isAuthenticatedRequest && !isLoginEndpoint) {
            const code: string = error.response?.data?.code ?? '';
            // Cubrir todos los casos de sesión inválida devueltos por el middleware
            const isSessionInvalid =
                code === 'TOKEN_EXPIRED' ||
                code === 'TOKEN_INVALID' ||
                code === 'USER_NOT_FOUND' ||
                code === '';   // ← respuestas 401 sin `code` explícito (retrocompatibilidad)

            if (isSessionInvalid) {
                handleExpiredSession();
            }
        }

        return Promise.reject(error);
    }
);

export default api;
