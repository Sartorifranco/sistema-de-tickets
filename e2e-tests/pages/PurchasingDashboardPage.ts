/**
 * Page Object: Dashboard de Compras (Encargado)
 */
import { Page } from '@playwright/test';

export class PurchasingDashboardPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases/management');
        await this.page.getByText(/Solicitudes prioritarias|Resto de solicitudes|No hay compras aprobadas|Dashboard de Compras/i).first().waitFor({ state: 'visible', timeout: 15000 });
    }

    async expectPurchaseVisible(productName: string) {
        await this.page.getByText(/Resto de solicitudes|Solicitudes prioritarias|Dashboard de Compras/i).first().waitFor({ state: 'visible', timeout: 10000 });
        const safeName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await this.page.getByText(new RegExp(safeName, 'i')).first().waitFor({ state: 'attached', timeout: 20000 });
        await this.page.getByText(new RegExp(safeName, 'i')).first().scrollIntoViewIfNeeded();
    }

    async clickPurchaseDetail(productName: string) {
        const regex = new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        const loc = this.page.getByText(regex).first();
        await loc.scrollIntoViewIfNeeded();
        await loc.click();
        await this.page.waitForTimeout(400);
        if (this.page.url().includes('/purchases/management') && !this.page.url().match(/\/purchases\/management\/[a-zA-Z0-9-]+$/)) {
            await this.page.getByRole('button', { name: /Ver detalle/i }).first().click();
        }
    }

    async expectOnDetailPage() {
        await this.page.getByText(/Volver a gestión/i).waitFor({ state: 'visible', timeout: 5000 });
    }
}
