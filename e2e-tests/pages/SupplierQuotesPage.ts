/**
 * Page Object: Presupuestos del Proveedor
 */
import { Page } from '@playwright/test';

export class SupplierQuotesPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases');
    }

    async expectPendingQuote(productName: string) {
        await this.page.getByText(productName).first().waitFor({ state: 'visible', timeout: 15000 });
    }

    async openQuoteModal(productName: string) {
        const card = this.page.locator('.bg-white.rounded-lg').filter({ hasText: productName }).first();
        await card.getByRole('button', { name: /Cotizar|Enviar cotización/i }).click();
    }

    async fillQuoteFormWithItems(unitPrice1: number, unitPrice2: number) {
        await this.page.getByText(/Precios por ítem/i).waitFor({ state: 'visible', timeout: 5000 });

        await this.page.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await this.page.getByPlaceholder(/30 días/i).fill('30 días');
        await this.page.locator('select').filter({ hasText: 'Factura' }).selectOption('Factura A');

        const itemBlocks = this.page.locator('.p-3.bg-gray-50.rounded-lg');
        await itemBlocks.first().waitFor({ state: 'visible', timeout: 5000 });
        const blockCount = await itemBlocks.count();
        if (blockCount >= 2) {
            await itemBlocks.nth(0).locator('input[type="checkbox"]').check();
            await itemBlocks.nth(0).locator('input[type="number"]').fill(String(unitPrice1));
            await itemBlocks.nth(1).locator('input[type="checkbox"]').check();
            await itemBlocks.nth(1).locator('input[type="number"]').fill(String(unitPrice2));
        }
    }

    async fillQuoteFormSimple(price: number) {
        await this.page.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await this.page.getByPlaceholder(/30 días/i).fill('30 días');
        await this.page.locator('select').filter({ hasText: 'Factura' }).selectOption('Factura A');
        await this.page.getByLabel(/Precio/i).fill(String(price));
    }

    async submitQuote() {
        await this.page.getByRole('button', { name: /^Enviar$/ }).click();
    }

    async expectQuoteSubmittedSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /enviada correctamente|Cotización enviada/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
