/**
 * Page Object: Página de Login
 */
import { Page } from '@playwright/test';

export class LoginPage {
    readonly page: Page;
    readonly emailInput = () => this.page.locator('#email-address');
    readonly passwordInput = () => this.page.locator('#password');
    readonly submitButton = () => this.page.getByRole('button', { name: /Iniciar Sesión/i });

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/login');
    }

    async login(email: string, password: string) {
        await this.emailInput().fill(email);
        await this.passwordInput().fill(password);
        await this.submitButton().click();
    }

    async expectLoginSuccess() {
        await this.page.waitForURL(/\/(client|purchases|agent|admin|profile)/, { timeout: 30000 }).catch(async () => {
            const hasError = await this.page.getByText(/Error|credenciales|incorrecto/i).isVisible().catch(() => false);
            throw new Error(
                hasError ? 'Login falló: credenciales incorrectas o backend no responde.' : 'Login no redirigió. Verifique .env.e2e y que backend/frontend estén corriendo.'
            );
        });
    }

    async expectLoginError() {
        await this.page.locator('.Toastify__toast--error').waitFor({ state: 'visible', timeout: 5000 });
    }
}
