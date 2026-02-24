/**
 * Page Object: Presupuestos del Proveedor
 *
 * ANTI-STRICT-MODE: los métodos que interactúan con listas acotados al card
 * específico con `productName` para no confundirse con historial en la BD.
 */
import { Page } from '@playwright/test';

export class SupplierQuotesPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases');
        await this.page.waitForLoadState('networkidle');
        // Confirmar que SupplierQuotesPage cargó (heading único de este componente)
        await this.page
            .getByRole('heading', { name: /Mis presupuestos/i })
            .waitFor({ state: 'visible', timeout: 15000 });
    }

    /**
     * Verifica que exista una cotización PENDIENTE para `productName`.
     *
     * SCOPED: filtra a la card que tiene el título Y la badge "Pendiente",
     * evitando que getByText() global coincida con el HelpBox, breadcrumbs
     * u otras solicitudes de la BD con el mismo nombre.
     */
    async expectPendingQuote(productName: string) {
        const pendingCard = this.page.locator('.bg-white.rounded-lg')
            .filter({ hasText: productName })
            .filter({ hasText: 'Pendiente' })
            .first();
        await pendingCard.waitFor({ state: 'visible', timeout: 15000 });
    }

    /**
     * Abre el modal de cotización para la solicitud `productName`.
     *
     * SCOPED al card específico → el botón "Enviar cotización" está
     * dentro de esa card, sin ambigüedad con otras solicitudes pendientes.
     */
    async openQuoteModal(productName: string) {
        const card = this.page.locator('.bg-white.rounded-lg')
            .filter({ hasText: productName })
            .first();
        await card.waitFor({ state: 'visible', timeout: 10000 });
        await card.getByRole('button', { name: /Cotizar|Enviar cotización/i }).click();
        // Espera real: el modal cargó los precios o el formulario
        await this.page
            .getByText(/Precios por ítem|Precio \(\$\)/i)
            .first()
            .waitFor({ state: 'visible', timeout: 8000 });
    }

    async fillQuoteFormWithItems(unitPrice1: number, unitPrice2: number) {
        // SCOPED: todas las interacciones dentro del modal activo
        const modal = this.page.locator('.fixed.inset-0')
            .filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
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

    /**
     * Completa el formulario con métodos de pago complejos (Tarjeta, Visa, 3 cuotas)
     * para demostrar el valor agregado del módulo.
     *
     * SCOPED: todo dentro del modal activo '.fixed.inset-0' filtrado por su heading.
     */
    async fillQuoteFormWithItemsAndComplexPayment(unitPrice1: number, unitPrice2: number) {
        const modal = this.page.locator('.fixed.inset-0')
            .filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
        await modal
            .getByText(/Precios por ítem|Forma de pago/i)
            .first()
            .waitFor({ state: 'visible', timeout: 5000 });

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

        // Métodos de pago — SCOPED al modal para no hacer clic en checkboxes externos
        const tarjetaCheckbox = modal.getByRole('checkbox', { name: /Tarjeta/i });
        if (await tarjetaCheckbox.isVisible().catch(() => false)) {
            await tarjetaCheckbox.check();
            await this.page.waitForTimeout(600);
            const visaCheckbox = modal.getByRole('checkbox', { name: /Visa/i });
            if (await visaCheckbox.isVisible().catch(() => false)) {
                await visaCheckbox.check();
            }
            const cuotasLabel = modal.getByText(/Cantidad de cuotas sin interés/i);
            if (await cuotasLabel.isVisible().catch(() => false)) {
                const cuotasInput = cuotasLabel.locator('..').locator('input[type="number"]');
                if (await cuotasInput.first().isVisible().catch(() => false)) {
                    await cuotasInput.first().fill('3');
                }
            }
        }
    }

    async fillQuoteFormSimple(price: number) {
        // Para formularios simples (sin ítems) — SCOPED: usa placeholders únicos
        await this.page.getByPlaceholder(/5 días hábiles/i).fill('5 días');
        await this.page.getByPlaceholder(/30 días/i).fill('30 días');
        await this.page.locator('select').filter({ hasText: 'Factura' }).selectOption('Factura A');
        await this.page.getByLabel(/Precio/i).fill(String(price));
    }

    async submitQuote() {
        // SCOPED al modal — evita hacer clic en "Enviar" de otro formulario visible
        const modal = this.page.locator('.fixed.inset-0')
            .filter({ has: this.page.getByRole('heading', { name: /Enviar cotización/i }) });
        await modal.getByRole('button', { name: /^Enviar$/ }).click();
    }

    async expectQuoteSubmittedSuccess() {
        await this.page
            .locator('.Toastify__toast--success')
            .filter({ hasText: /enviada correctamente|Cotización enviada/i })
            .waitFor({ state: 'visible', timeout: 8000 });
    }
}
