/**
 * Page Object: Detalle de solicitud - Solicitar presupuestos
 */
import { Page } from '@playwright/test';

export class PurchaseDetailPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async requestQuotesFromFirstSupplier() {
        await this.page.getByRole('button', { name: /Solicitar Presupuestos/i }).click();
        await this.page.locator('.max-h-48').locator('input[type="checkbox"]').first().check();
        await this.page.getByRole('button', { name: /^Enviar$/ }).click();
    }

    async expectQuoteRequestSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /enviada|Solicitud enviada/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
