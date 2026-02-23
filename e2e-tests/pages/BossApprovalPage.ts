/**
 * Page Object: Aprobaciones pendientes (Jefe)
 */
import { Page } from '@playwright/test';

export class BossApprovalPage {
    readonly page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    async goto() {
        await this.page.goto('/purchases/approvals');
    }

    async expectPendingRequest(productName: string) {
        await this.page.getByText(productName).first().waitFor({ state: 'visible', timeout: 10000 });
    }

    async approveFirstRequest() {
        await this.page.getByRole('button', { name: /^Aprobar$/ }).first().click();
    }

    async expectApprovalSuccess() {
        await this.page.locator('.Toastify__toast--success').filter({ hasText: /aprobada/i }).waitFor({ state: 'visible', timeout: 8000 });
    }
}
