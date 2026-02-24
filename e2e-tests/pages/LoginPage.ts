/**
 * Page Object: Página de Login
 * Selectores user-facing, esperas basadas en estado del DOM, sin waitForTimeout.
 */
import { Page } from '@playwright/test';

export class LoginPage {
    readonly page: Page;

    // User-facing locators: resistentes a cambios de ID/clase CSS.
    readonly emailInput    = () => this.page.getByPlaceholder('Correo Electrónico');
    readonly passwordInput = () => this.page.getByPlaceholder('Contraseña');
    readonly submitButton  = () => this.page.getByRole('button', { name: /Iniciar Sesión/i });
    readonly errorToast    = () => this.page.locator('.Toastify__toast--error');

    constructor(page: Page) {
        this.page = page;
    }

    /**
     * Limpia la sesión previa y navega a /login.
     *
     * ORDEN CRÍTICO: limpiar localStorage ANTES de navegar.
     * Si se limpia DESPUÉS, React ya habrá leído el token y redirigido
     * fuera del login antes de que podamos borrarlo.
     */
    async goto() {
        // 1. Borrar sesión en la página actual (sea cual sea)
        await this.page.evaluate(() => {
            localStorage.clear();
            sessionStorage.clear();
        });
        // 2. Ahora navegar: React no encontrará token y permanecerá en /login
        await this.page.goto('/login');
        // 3. Esperar a que el formulario esté realmente listo
        await this.emailInput().waitFor({ state: 'visible' });
    }

    /**
     * Rellena credenciales y hace submit.
     * Simple y robusto: fill + click. La verificación la hace expectLoginSuccess().
     * Se evita Promise.all + waitForResponse porque con slowMo el servidor puede
     * tardar más de 15s en responder y genera TimeoutError en el listener.
     */
    async login(email: string, password: string) {
        await this.emailInput().waitFor({ state: 'visible' });
        await this.emailInput().fill(email);
        await this.passwordInput().fill(password);
        await this.submitButton().click();
    }

    /**
     * Verifica que el login fue exitoso esperando la redirección.
     * Si la URL no cambia en 30s, captura el mensaje de error visible
     * para dar un diagnóstico útil en lugar de un timeout genérico.
     */
    async expectLoginSuccess() {
        try {
            await this.page.waitForURL(
                /\/(client|purchases|agent|admin|profile|supplier)/,
                { timeout: 30000 }
            );
        } catch {
            const toastText = await this.errorToast()
                .first()
                .textContent({ timeout: 3000 })
                .catch(() => null);

            const errorText = await this.page
                .getByText(/Error|credenciales|incorrecto|no encontrado|inválid/i)
                .first()
                .textContent({ timeout: 3000 })
                .catch(() => null);

            const currentUrl = this.page.url();
            const diagnosis = toastText || errorText;

            throw new Error(
                diagnosis
                    ? `Login falló: "${diagnosis.trim()}" (URL actual: ${currentUrl})`
                    : `Login no redirigió tras 30s. URL actual: ${currentUrl}. ` +
                      `Verificar credenciales en .env.e2e y que E2E_BASE_URL sea correcto (puerto del backend).`
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
