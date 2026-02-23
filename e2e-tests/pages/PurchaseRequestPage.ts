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

    /** Completa el formulario con 2 ítems y rubro */
    async fillFormWithTwoItems(
        item1: { producto: string; cantidad: number; descripcion: string },
        item2: { producto: string; cantidad: number; descripcion: string }
    ) {
        await this.page.locator('select').first().selectOption('Tecnología / IT');

        const item1Block = this.page.locator('.p-4.border.border-gray-200').first();
        await item1Block.getByPlaceholder(/Monitor Dell/i).fill(item1.producto);
        await item1Block.locator('input[type="number"]').fill(String(item1.cantidad));
        await item1Block.getByPlaceholder(/Describa por qué necesita/i).fill(item1.descripcion);

        await this.page.getByRole('button', { name: /Añadir ítem/i }).click();

        const item2Block = this.page.locator('.p-4.border.border-gray-200').last();
        await item2Block.getByPlaceholder(/Monitor Dell/i).fill(item2.producto);
        await item2Block.locator('input[type="number"]').fill(String(item2.cantidad));
        await item2Block.getByPlaceholder(/Describa por qué necesita/i).fill(item2.descripcion);
    }

    async submit() {
        await this.page.getByRole('button', { name: /Enviar solicitud/i }).click();
    }

    async expectSuccessToast() {
        await expect(this.page.getByText(/creada correctamente/i)).toBeVisible({ timeout: 15000 });
    }
}
