/**
 * Deploy Oculto - Feature Flag para Módulo de Compras
 * Solo los correos en este array verán los enlaces y podrán acceder a las rutas de compras.
 */
export const PURCHASING_ALLOWED_EMAILS: string[] = [
    'admin@bacarsa.com.ar',
    'sistemas.ti@bacarsa.com.ar',
    'compras@bacarsa.com.ar',
    'francosartori.dev@gmail.com',
    'francosarto11@gmail.com',
];

export const canAccessPurchasingModule = (userEmail: string | undefined | null): boolean => {
    if (!userEmail) return false;
    const normalized = userEmail.trim().toLowerCase();
    return PURCHASING_ALLOWED_EMAILS.some(
        (e) => e.trim().toLowerCase() === normalized
    );
};
