/**
 * Page Object: Formulario de Nueva Solicitud de Compra
 */
import { expect } from '@playwright/test';
import { Page } from '@playwright/test';

export class PurchaseRequestPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases/new');
    }

    /** Completa el formulario con 2 ítems y rubro (con pausas para lectura en video) */
    async fillFormWithTwoItems(
        item1: { producto: string; cantidad: number; descripcion: string },
        item2: { producto: string; cantidad: number; descripcion: string },
        title?: string,
        options?: { pauseMs?: number }
    ) {
        const pause = options?.pauseMs ?? 800;
        const fillWithPause = async (selector: Parameters<Page['locator']>[0], value: string, delay = pause) => {
            const el = typeof selector === 'string' ? this.page.locator(selector) : selector;
            await el.fill(value);
            await this.page.waitForTimeout(delay);
        };

        const titleSelector = this.page.getByPlaceholder(/Compra de Teclados|Título/i).first();
        await fillWithPause(titleSelector, title || item1.producto, pause);
        await this.page.locator('select').first().selectOption('Tecnología / IT');
        await this.page.waitForTimeout(pause);

        const item1Block = this.page.locator('.p-4.border.border-gray-200').first();
        await fillWithPause(item1Block.getByPlaceholder(/Monitor Dell|Producto o servicio/i), item1.producto);
        await fillWithPause(item1Block.locator('input[type="number"]'), String(item1.cantidad));
        await fillWithPause(item1Block.getByPlaceholder(/Describa por qué necesita/i), item1.descripcion);

        await this.page.getByRole('button', { name: /Añadir ítem/i }).click();
        await this.page.waitForTimeout(pause);

        const item2Block = this.page.locator('.p-4.border.border-gray-200').last();
        await fillWithPause(item2Block.getByPlaceholder(/Monitor Dell|Producto o servicio/i), item2.producto);
        await fillWithPause(item2Block.locator('input[type="number"]'), String(item2.cantidad));
        await fillWithPause(item2Block.getByPlaceholder(/Describa por qué necesita/i), item2.descripcion);
    }

    async submit() {
        await this.page.getByRole('button', { name: /Enviar solicitud/i }).click();
    }

    async expectSuccessToast() {
        await expect(this.page.getByText(/creada correctamente/i)).toBeVisible({ timeout: 15000 });
    }
}
