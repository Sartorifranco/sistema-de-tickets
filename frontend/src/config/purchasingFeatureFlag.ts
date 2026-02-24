/**
 * Deploy Oculto - Feature Flag para Módulo de Compras
 * Solo los correos en este array verán los enlaces y podrán acceder a las rutas de compras.
 */
export const PURCHASING_ALLOWED_EMAILS: string[] = [
    // Demo Directorio
    'admin@bacarsa.com.ar',      // Perfil Jefe - ve el deploy con rol jefe
    'sistemas.ti@bacarsa.com.ar', // Admin - acceso completo al módulo
    // Usuarios E2E (para que el test purchasing-flow funcione)
    'francosartori.dev@gmail.com',
    'compras@bacarsa.com.ar',
    'francosarto11@gmail.com',
];

export const canAccessPurchasingModule = (userEmail: string | undefined | null): boolean => {
    if (!userEmail) return false;
    const normalized = userEmail.trim().toLowerCase();
    return PURCHASING_ALLOWED_EMAILS.some(
        (e) => e.trim().toLowerCase() === normalized
    );
};
