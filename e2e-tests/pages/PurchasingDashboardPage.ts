/**
 * Page Object: Dashboard de Compras (Encargado)
 *
 * ANTI-STRICT-MODE: clickPurchaseDetail acota la búsqueda a la card con el
 * título pasado, evitando colisiones con el historial de la BD de producción.
 */
import { Page } from '@playwright/test';

export class PurchasingDashboardPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases/management');
        await this.page
            .getByText(/Solicitudes prioritarias|Resto de solicitudes|No hay compras aprobadas|Dashboard de Compras/i)
            .first()
            .waitFor({ state: 'visible', timeout: 15000 });
    }

    async expectPurchaseVisible(productName: string) {
        await this.page
            .getByText(/Resto de solicitudes|Solicitudes prioritarias|Dashboard de Compras/i)
            .first()
            .waitFor({ state: 'visible', timeout: 10000 });
        const safeName = productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        await this.page
            .getByText(new RegExp(safeName, 'i'))
            .first()
            .waitFor({ state: 'attached', timeout: 20000 });
        await this.page
            .getByText(new RegExp(safeName, 'i'))
            .first()
            .scrollIntoViewIfNeeded();
    }

    /**
     * Navega al detalle de la solicitud con `productName`.
     *
     * Estrategia ANTI-STRICT-MODE:
     * 1. Localiza la card de la BD que contiene `productName` (filter hasText).
     * 2. Busca el botón "Ver detalle" DENTRO de esa card.
     * 3. Si no está, hace clic en el texto del título dentro de la card.
     * 4. Como último recurso, busca "Ver detalle" globalmente con .first().
     *
     * Con un DB llena de solicitudes con el mismo título, .first() devuelve
     * la más reciente (la que acaba de crear el bot), siempre que la lista
     * esté ordenada por fecha descendente.
     */
    async clickPurchaseDetail(productName: string) {
        // SCOPED: encontrar la card que contiene el título (la más reciente = primera)
        const card = this.page.locator('.bg-white')
            .filter({ hasText: productName })
            .first();

        await card.scrollIntoViewIfNeeded();

        // Intento 1: botón "Ver detalle" dentro de la card específica
        const detailBtnInCard = card.getByRole('button', { name: /Ver detalle/i });
        if (await detailBtnInCard.isVisible().catch(() => false)) {
            await detailBtnInCard.click();
            return;
        }

        // Intento 2: clic en el texto del título dentro de la card
        const titleEl = card
            .getByText(new RegExp(productName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))
            .first();
        await titleEl.click();
        await this.page.waitForTimeout(400);

        // Intento 3: si no navegó al detalle, buscar "Ver detalle" en la card o globalmente
        const onList =
            this.page.url().includes('/purchases/management') &&
            !this.page.url().match(/\/purchases\/management\/[a-zA-Z0-9-]+$/);
        if (onList) {
            // Preferir el botón dentro de la card ya localizada
            const btnInCard = card.getByRole('button', { name: /Ver detalle/i });
            if (await btnInCard.isVisible().catch(() => false)) {
                await btnInCard.click();
            } else {
                // Fallback global con .first() para evitar strict-mode
                await this.page.getByRole('button', { name: /Ver detalle/i }).first().click();
            }
        }
    }

    async expectOnDetailPage() {
        await this.page
            .getByText(/Volver a gestión/i)
            .waitFor({ state: 'visible', timeout: 5000 });
    }
}
