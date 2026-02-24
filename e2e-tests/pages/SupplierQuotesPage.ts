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
        await this.page.getByText(/Precios por ítem|Precio \(\$\)/i).first().waitFor({ state: 'visible', timeout: 8000 });
    }

    async fillQuoteFormWithItems(unitPrice1: number, unitPrice2: number) {
        const modal = this.page.locator('.fixed.inset-0').filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
        await modal.getByText(/Precios por ítem/i).waitFor({ state: 'visible', timeout: 5000 });

        await modal.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await modal.getByPlaceholder(/30 días/i).fill('30 días');
        await modal.locator('select').filter({ hasText: 'Factura' }).first().selectOption('Factura A');

        const itemBlocks = modal.locator('.p-3.bg-gray-50.rounded-lg');
        await itemBlocks.first().waitFor({ state: 'visible', timeout: 5000 });
        const blockCount = await itemBlocks.count();
        if (blockCount >= 2) {
            await itemBlocks.nth(0).locator('input[type="checkbox"]').check();
            await this.page.waitForTimeout(300);
            await itemBlocks.nth(0).locator('input[type="number"]').fill(String(unitPrice1));
            await itemBlocks.nth(1).locator('input[type="checkbox"]').check();
            await this.page.waitForTimeout(300);
            await itemBlocks.nth(1).locator('input[type="number"]').fill(String(unitPrice2));
        }
    }

    /** Completa el formulario incluyendo métodos de pago complejos (Tarjeta, Visa, 3 cuotas) para mostrar el valor agregado */
    async fillQuoteFormWithItemsAndComplexPayment(unitPrice1: number, unitPrice2: number) {
        const modal = this.page.locator('.fixed.inset-0').filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
        await modal.getByText(/Precios por ítem|Forma de pago/i).first().waitFor({ state: 'visible', timeout: 5000 });

        await modal.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await modal.getByPlaceholder(/30 días/i).fill('30 días');
        await modal.locator('select').filter({ hasText: 'Factura' }).first().selectOption('Factura A');
        await this.page.waitForTimeout(500);

        const itemBlocks = modal.locator('.p-3.bg-gray-50.rounded-lg');
        if ((await itemBlocks.count()) >= 2) {
            await itemBlocks.nth(0).locator('input[type="checkbox"]').check();
            await this.page.waitForTimeout(300);
            await itemBlocks.nth(0).locator('input[type="number"]').fill(String(unitPrice1));
            await itemBlocks.nth(1).locator('input[type="checkbox"]').check();
            await this.page.waitForTimeout(300);
            await itemBlocks.nth(1).locator('input[type="number"]').fill(String(unitPrice2));
        }
        await this.page.waitForTimeout(500);

        const tarjetaCheckbox = modal.getByRole('checkbox', { name: /Tarjeta/i });
        if (await tarjetaCheckbox.isVisible()) {
            await tarjetaCheckbox.check();
            await this.page.waitForTimeout(600);
            const visaCheckbox = modal.getByRole('checkbox', { name: /Visa/i });
            if (await visaCheckbox.isVisible()) {
                await visaCheckbox.check();
            }
            const cuotasLabel = modal.getByText(/Cantidad de cuotas sin interés/i);
            if (await cuotasLabel.isVisible()) {
                const cuotasInput = cuotasLabel.locator('..').locator('input[type="number"]');
                if (await cuotasInput.first().isVisible()) {
                    await cuotasInput.first().fill('3');
                }
            }
        }
    }

    async fillQuoteFormSimple(price: number) {
        await this.page.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await this.page.getByPlaceholder(/30 días/i).fill('30 días');
        await this.page.locator('select').filter({ hasText: 'Factura' }).selectOption('Factura A');
        await this.page.getByLabel(/Precio/i).fill(String(price));
    }

    async submitQuote() {
        const modal = this.page.locator('.fixed.inset-0').filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
        await modal.getByRole('button', { name: /^Enviar$/ }).click();
    }

    async expectQuoteSubmittedSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /enviada correctamente|Cotización enviada/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
