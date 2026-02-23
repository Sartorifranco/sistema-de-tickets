/**
 * E2E: Flujo completo de compras (Happy Path)
 *
 * Requiere:
 * - Frontend y Backend corriendo
 * - Usuarios de prueba en la BD (empleado, jefe, compras, proveedor)
 * - Archivo .env.e2e con credenciales y E2E_BASE_URL
 *
 * Pasos: Empleado crea → Jefe aprueba → Compras solicita cotización →
 *        Proveedor cotiza → Compras selecciona ganador
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { PurchaseRequestPage } from './pages/PurchaseRequestPage';
import { BossApprovalPage } from './pages/BossApprovalPage';
import { PurchasingDashboardPage } from './pages/PurchasingDashboardPage';
import { PurchaseDetailPage } from './pages/PurchaseDetailPage';
import { SupplierQuotesPage } from './pages/SupplierQuotesPage';
import { QuoteComparisonPage } from './pages/QuoteComparisonPage';

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL || 'empleado@bacar.com.ar';
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD || 'password123';
const BOSS_EMAIL = process.env.E2E_BOSS_EMAIL || 'jefe@bacar.com.ar';
const BOSS_PASSWORD = process.env.E2E_BOSS_PASSWORD || 'password123';
const PURCHASING_EMAIL = process.env.E2E_PURCHASING_EMAIL || 'compras@bacar.com.ar';
const PURCHASING_PASSWORD = process.env.E2E_PURCHASING_PASSWORD || 'password123';
const SUPPLIER_EMAIL = process.env.E2E_SUPPLIER_EMAIL || 'proveedor@test.com';
const SUPPLIER_PASSWORD = process.env.E2E_SUPPLIER_PASSWORD || 'password123';

const TEST_PRODUCT_NAME = `E2E Test - ${Date.now()}`;

function logout(page: import('@playwright/test').Page) {
    return page.getByRole('button', { name: /Cerrar Sesión/i }).click();
}

test.describe('Flujo de Compras E2E (Happy Path)', () => {
    test('Circuito completo: Empleado → Jefe → Compras → Proveedor → Compras', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const purchaseRequestPage = new PurchaseRequestPage(page);
        const bossApprovalPage = new BossApprovalPage(page);
        const purchasingDashboard = new PurchasingDashboardPage(page);
        const purchaseDetail = new PurchaseDetailPage(page);
        const supplierQuotes = new SupplierQuotesPage(page);
        const quoteComparison = new QuoteComparisonPage(page);

        // ========== a) Empleado: Crear solicitud con 2 ítems ==========
        await loginPage.goto();
        await loginPage.login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
        await loginPage.expectLoginSuccess();

        await purchaseRequestPage.goto();
        await expect(page.getByRole('heading', { name: /Nueva solicitud de compra/i })).toBeVisible();

        await purchaseRequestPage.fillFormWithTwoItems(
            { producto: TEST_PRODUCT_NAME, cantidad: 2, descripcion: 'Monitor para oficina E2E' },
            { producto: 'Teclado inalámbrico', cantidad: 1, descripcion: 'Teclado ergonómico E2E' }
        );
        await purchaseRequestPage.submit();
        await purchaseRequestPage.expectSuccessToast();

        // Navegar a Compras para poder ir luego a Nueva solicitud como empleado... en realidad el empleado ya envió.
        await page.goto('/purchases');
        await expect(page.getByText(TEST_PRODUCT_NAME).first()).toBeVisible();

        await logout(page);
        await expect(page).toHaveURL(/\/login/);

        // ========== b) Jefe: Aprobar solicitud ==========
        await loginPage.login(BOSS_EMAIL, BOSS_PASSWORD);
        await loginPage.expectLoginSuccess();

        await bossApprovalPage.goto();
        await bossApprovalPage.expectPendingRequest(TEST_PRODUCT_NAME);
        await bossApprovalPage.approveFirstRequest();
        await bossApprovalPage.expectApprovalSuccess();

        await logout(page);

        // ========== c) Compras: Ver solicitud y enviar petición de presupuesto ==========
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        await purchasingDashboard.goto();
        await purchasingDashboard.expectPurchaseVisible(TEST_PRODUCT_NAME);
        await purchasingDashboard.clickPurchaseDetail(TEST_PRODUCT_NAME);

        await purchasingDashboard.expectOnDetailPage();
        await expect(page.getByText(TEST_PRODUCT_NAME).first()).toBeVisible();

        await purchaseDetail.requestQuotesFromFirstSupplier();
        await purchaseDetail.expectQuoteRequestSuccess();

        await logout(page);

        // ========== d) Proveedor: Cotizar ==========
        await loginPage.login(SUPPLIER_EMAIL, SUPPLIER_PASSWORD);
        await loginPage.expectLoginSuccess();

        await supplierQuotes.goto();
        await supplierQuotes.expectPendingQuote(TEST_PRODUCT_NAME);
        await supplierQuotes.openQuoteModal(TEST_PRODUCT_NAME);

        await supplierQuotes.fillQuoteFormWithItems(15000, 8000);
        await supplierQuotes.submitQuote();
        await supplierQuotes.expectQuoteSubmittedSuccess();

        await logout(page);

        // ========== e) Compras: Seleccionar ganador ==========
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        await purchasingDashboard.goto();
        await purchasingDashboard.clickPurchaseDetail(TEST_PRODUCT_NAME);

        await page.getByText(/Confirmar ganadores|Seleccionar Ganador|Comparativa inteligente|comparativa clásica|cotizaciones enviadas/i).first().waitFor({ state: 'visible', timeout: 20000 });

        const hasSmartComparison = await page.getByText(/Confirmar ganadores por ítem/i).isVisible().catch(() => false);
        if (hasSmartComparison) {
            await quoteComparison.selectSupplierAsWinnerForAllItems();
            await quoteComparison.confirmItemWinners();
        } else {
            await quoteComparison.clickSelectWinnerButton();
        }
        await quoteComparison.expectWinnerSelectedSuccess();

        await expect(page.getByText(/Compra Aprobada|ganador/i).first()).toBeVisible({ timeout: 5000 });
    });
});
