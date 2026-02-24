/**
 * Page Object: Página de Login
 * Selectores user-facing, esperas basadas en estado del DOM, sin waitForTimeout.
 */
import { Page, expect } from '@playwright/test';

export class LoginPage {
    readonly page: Page;

    // User-facing locators: resistentes a cambios de ID/clase CSS.
    // El input tiene placeholder "Correo Electrónico" y label sr-only "Correo".
    readonly emailInput    = () => this.page.getByPlaceholder('Correo Electrónico');
    readonly passwordInput = () => this.page.getByPlaceholder('Contraseña');
    readonly submitButton  = () => this.page.getByRole('button', { name: /Iniciar Sesión/i });
    readonly errorToast    = () => this.page.locator('.Toastify__toast--error');

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Navega a /login y limpia cualquier sesión previa que pudiera
     * interferir con la redirección post-login.
     */
    async goto() {
        await this.page.goto('/login');
        // Limpiar localStorage DESPUÉS de cargar la página para no interferir
        // con el enrutador de React si ya está en /login.
        await this.page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        // Esperar a que el formulario esté listo antes de entregar el control.
        await this.emailInput().waitFor({ state: 'visible' });
    }

    /**
     * Rellena credenciales y hace submit.
     * - Usa fill() para velocidad; React captura onChange correctamente.
     * - Hace click y espera simultáneamente la respuesta de red (Promise.all)
     *   para eliminar race conditions.
     */
    async login(email: string, password: string) {
        await this.emailInput().waitFor({ state: 'visible' });
        await this.emailInput().fill(email);
        await this.passwordInput().fill(password);

        // Promise.all garantiza que el clic y la espera de red se lancen juntos,
        // evitando que waitForResponse pierda la respuesta si el clic fue muy rápido.
        await Promise.all([
            this.page.waitForResponse(
                (res) =>
                    res.url().includes('/api/auth/login') &&
                    res.request().method() === 'POST',
                { timeout: 15000 }
            ),
            this.submitButton().click(),
        ]);
    }

    /**
     * Verifica que el login fue exitoso esperando la redirección.
     * Si la URL no cambia en 20s, busca mensajes de error visibles
     * para dar un diagnóstico útil en lugar de un timeout genérico.
     */
    async expectLoginSuccess() {
        try {
            await this.page.waitForURL(
                /\/(client|purchases|agent|admin|profile|supplier)/,
                { timeout: 20000 }
            );
        } catch {
            // Intentar capturar el mensaje de error visible para diagnóstico.
            const errorText = await this.page
                .getByText(/Error|credenciales|incorrecto|no encontrado|inválid/i)
                .first()
                .textContent({ timeout: 3000 })
                .catch(() => null);

            const toastText = await this.errorToast()
                .first()
                .textContent({ timeout: 3000 })
                .catch(() => null);

            const currentUrl = this.page.url();
            const diagnosis = toastText || errorText;

            throw new Error(
                diagnosis
                    ? `Login falló: "${diagnosis.trim()}" (URL actual: ${currentUrl})`
                    : `Login no redirigió tras 20s. URL actual: ${currentUrl}. ` +
                      `Verificar credenciales en .env.e2e, que el backend esté corriendo y E2E_BASE_URL sea correcto.`
            );
        }
    }

    /**
     * Verifica que el login falló mostrando un toast de error.
     */
    async expectLoginError() {
        await this.errorToast().waitFor({ state: 'visible', timeout: 8000 });
    }
}
