import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';

const PRODUCTION_HOST = 'bacarsa.dyndns.org';
const PRODUCTION_URL = `https://${PRODUCTION_HOST}`;

function getApiBaseUrl(): string {
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
    const explicitUrl = process.env.REACT_APP_BACKEND_URL;

    // Producción: siempre https://bacarsa.dyndns.org (sin puerto)
    if (currentHost === PRODUCTION_HOST) return PRODUCTION_URL;
    if (explicitUrl && (explicitUrl.includes(PRODUCTION_HOST) || explicitUrl.includes('bacarsa'))) {
        return PRODUCTION_URL;
    }

    // Si hay URL explícita, normalizar: https y sin puerto 5040
    if (explicitUrl) {
        let url = explicitUrl.trim();
        if (url.startsWith('http://')) url = 'https://' + url.slice(7);
        url = url.replace(/:5040\/?$/, '').replace(/:5040$/, '');
        return url;
    }

    // Desarrollo local
    const apiPort = process.env.REACT_APP_API_PORT || '5040';
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    return isHttps ? `https://${currentHost}` : `http://${currentHost}:${apiPort}`;
}

const API_BASE_URL = getApiBaseUrl();

console.log(`[Axios] Configurado apuntando a: ${API_BASE_URL}`);
export { API_BASE_URL };

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: { 'Content-Type': 'application/json' },
});

// Request interceptor: inyectar token (excepto en login y refresh)
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const url = config.url ?? '';
        const isPublicRequest = url.includes('/login') || url.includes('/refresh');
        if (!isPublicRequest) {
            const token = localStorage.getItem('token');
            if (token) config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

let isHandlingExpiredSession = false;
let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function onRefreshed(token: string) {
    refreshSubscribers.forEach((cb) => cb(token));
    refreshSubscribers = [];
}

function addRefreshSubscriber(cb: (token: string) => void) {
    refreshSubscribers.push(cb);
}

function handleExpiredSession(): void {
    if (isHandlingExpiredSession) return;
    isHandlingExpiredSession = true;

    console.warn('[Auth] Sesión inválida o expirada — limpiando estado y redirigiendo al login.');

    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    delete api.defaults.headers.common['Authorization'];

    window.location.replace('/login');
}

async function tryRefreshAndRetry(originalRequest: InternalAxiosRequestConfig): Promise<unknown> {
    const refreshToken = localStorage.getItem('refreshToken');
    const isRefreshEndpoint = (originalRequest.url ?? '').includes('/refresh');

    // Si el 401 viene del propio /refresh, no reintentar — ir directo a login
    if (isRefreshEndpoint || !refreshToken) {
        handleExpiredSession();
        return Promise.reject(new Error('Session expired'));
    }

    // Si ya hay un refresh en curso, encolar esta request para retry cuando termine
    if (isRefreshing) {
        return new Promise((resolve, reject) => {
            addRefreshSubscriber((newToken: string) => {
                originalRequest.headers.Authorization = `Bearer ${newToken}`;
                resolve(api(originalRequest));
            });
            // Si el refresh falla, handleExpiredSession ya habrá redirigido
        });
    }

    isRefreshing = true;

    try {
        const { data } = await api.post('/api/auth/refresh', { refreshToken });
        const newToken = data.token;

        localStorage.setItem('token', newToken);
        api.defaults.headers.common['Authorization'] = `Bearer ${newToken}`;

        onRefreshed(newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
    } catch {
        handleExpiredSession();
        return Promise.reject(new Error('Refresh failed'));
    } finally {
        isRefreshing = false;
    }
}

api.interceptors.response.use(
    (response) => response,

    async (error: AxiosError) => {
        if (error.code === 'ERR_NETWORK') {
            console.error('❌ Error de red: no se puede conectar al backend en', API_BASE_URL);
            return Promise.reject(error);
        }

        const status = error.response?.status;
        const url = (error.config?.url ?? '') as string;
        const hasAuthHeader = !!error.config?.headers?.Authorization;
        const isLoginEndpoint = url.includes('/login');

        if (status === 401 && hasAuthHeader && !isLoginEndpoint) {
            const code = (error.response?.data as { code?: string })?.code ?? '';
            const isSessionInvalid =
                code === 'TOKEN_EXPIRED' ||
                code === 'TOKEN_INVALID' ||
                code === 'USER_NOT_FOUND' ||
                code === '';

            if (isSessionInvalid && error.config) {
                return tryRefreshAndRetry(error.config as InternalAxiosRequestConfig);
            }
        }

        return Promise.reject(error);
    }
);

export default api;
