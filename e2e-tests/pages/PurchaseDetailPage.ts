/**
 * Page Object: Detalle de solicitud - Solicitar presupuestos
 */
import { Page } from '@playwright/test';

export class PurchaseDetailPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /** Solicita presupuestos al proveedor indicado (por email) o al primero si no se especifica */
    async requestQuotesFromSupplier(supplierEmail?: string) {
        await this.page.getByRole('button', { name: /Solicitar Presupuestos/i }).click();
        await this.page.getByText(/Solicitar Presupuestos|Seleccione los proveedores/i).first().waitFor({ state: 'visible', timeout: 5000 });
        const modal = this.page.locator('.fixed.inset-0').filter({ has: this.page.getByRole('heading', { name: /Solicitar Presupuestos/i }) });
        if (supplierEmail) {
            const byEmail = modal.locator('label').filter({ hasText: supplierEmail });
            if ((await byEmail.count()) > 0) {
                await byEmail.first().locator('input[type="checkbox"]').check();
            } else {
                await modal.locator('.max-h-48').locator('input[type="checkbox"]').first().check();
            }
        } else {
            await modal.locator('.max-h-48').locator('input[type="checkbox"]').first().check();
        }
        await modal.getByRole('button', { name: /^Enviar$/ }).click();
    }

    async requestQuotesFromFirstSupplier() {
        await this.requestQuotesFromSupplier();
    }

    async expectQuoteRequestSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /enviada|Solicitud enviada/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
