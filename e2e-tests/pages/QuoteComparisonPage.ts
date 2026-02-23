/**
 * Page Object: Comparativa de cotizaciones - Seleccionar ganador
 */
import { Page } from '@playwright/test';

export class QuoteComparisonPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    /** Selecciona el proveedor como ganador en todos los ítems (SmartQuoteComparison) */
    async selectSupplierAsWinnerForAllItems() {
        const ganadorLabels = this.page.locator('label').filter({ hasText: 'Ganador' }).filter({ has: this.page.locator('input[type="radio"]') });
        const count = await ganadorLabels.count();
        for (let i = 0; i < count; i++) {
            await ganadorLabels.nth(i).click();
        }
    }

    /** Para comparativa simple (1 ítem) - botón Seleccionar ganador */
    async clickSelectWinnerButton() {
        const btn = this.page.locator('button').filter({ hasText: /Seleccionar.*[Gg]anador/i }).first();
        await btn.click();
    }

    /** SmartQuoteComparison - confirmar ganadores por ítem */
    async confirmItemWinners() {
        await this.page.getByRole('button', { name: /Confirmar ganadores por ítem/i }).click();
    }

    async expectWinnerSelectedSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /ganador|guardados/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
