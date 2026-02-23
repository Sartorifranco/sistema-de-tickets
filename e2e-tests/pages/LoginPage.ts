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
        await this.page.waitForURL(/\/(client|purchases|agent|admin)/);
    }

    async expectLoginError() {
        await this.page.locator('.Toastify__toast--error').waitFor({ state: 'visible', timeout: 5000 });
    }
}
