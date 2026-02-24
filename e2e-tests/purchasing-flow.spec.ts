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

/**
 * Inyecta un subtítulo overlay en el DOM para la grabación de demo.
 * Diseño tipo subtítulo corporativo: fixed, centro inferior, fondo oscuro semitransparente.
 * pointer-events: none para no interferir con los clics de Playwright.
 */
async function showCaption(
    page: import('@playwright/test').Page,
    text: string,
    durationMs = 4000
) {
    await page.evaluate(({ captionText }: { captionText: string }) => {
        let el = document.getElementById('demo-caption');
        if (!el) {
            el = document.createElement('div');
            el.id = 'demo-caption';
            el.style.cssText = `
                position: fixed;
                bottom: 50px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.85);
                color: white;
                font-size: 26px;
                font-weight: 500;
                padding: 18px 36px;
                border-radius: 10px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.5);
                z-index: 9999;
                pointer-events: none;
                max-width: 85%;
                text-align: center;
                font-family: system-ui, -apple-system, sans-serif;
                line-height: 1.4;
                transition: opacity 0.3s ease;
            `;
            document.body.appendChild(el);
        }
        el.textContent = captionText;
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.opacity = '1';
    }, { captionText: text });
    await page.waitForTimeout(durationMs);
    await page.evaluate(() => {
        const el = document.getElementById('demo-caption');
        if (el) el.style.display = 'none';
    });
    await page.waitForTimeout(300);
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
        await showCaption(page, 'Paso 1: Un colaborador ingresa al sistema para solicitar insumos.');
        await loginPage.login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
        await loginPage.expectLoginSuccess();
        await page.waitForTimeout(800);

        await purchaseRequestPage.goto();
        await page.waitForTimeout(500);
        await expect(page.getByRole('heading', { name: /Nueva solicitud de compra/i })).toBeVisible();

        await showCaption(page, 'El sistema permite cargar múltiples ítems especificando el rubro y cantidades.');
        await purchaseRequestPage.fillFormWithTwoItems(
            { producto: TEST_PRODUCT_NAME, cantidad: 2, descripcion: 'Monitor para oficina E2E' },
            { producto: 'Teclado inalámbrico', cantidad: 1, descripcion: 'Teclado ergonómico E2E' }
        );
        await purchaseRequestPage.submit();
        await purchaseRequestPage.expectSuccessToast();
        await page.waitForTimeout(2000);

        // Navegar a Compras para verificar que la solicitud aparece
        await page.goto('/purchases');
        await expect(page.getByText(TEST_PRODUCT_NAME).first()).toBeVisible();
        await page.waitForTimeout(2000);

        await logout(page);
        await expect(page).toHaveURL(/\/login/);

        // ========== b) Jefe: Aprobar solicitud ==========
        await showCaption(page, 'Paso 2: El Jefe de Área recibe la notificación y aprueba la solicitud con un clic.');
        await loginPage.login(BOSS_EMAIL, BOSS_PASSWORD);
        await loginPage.expectLoginSuccess();

        await bossApprovalPage.goto();
        await bossApprovalPage.expectPendingRequest(TEST_PRODUCT_NAME);
        await bossApprovalPage.approveFirstRequest();
        await bossApprovalPage.expectApprovalSuccess();
        await page.waitForTimeout(2000);

        await logout(page);

        // ========== c) Compras: Ver solicitud y enviar petición de presupuesto ==========
        await showCaption(page, 'Paso 3: El Encargado de Compras revisa el pedido y selecciona los proveedores a licitar.');
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        await purchasingDashboard.goto();
        await purchasingDashboard.expectPurchaseVisible(TEST_PRODUCT_NAME);
        await purchasingDashboard.clickPurchaseDetail(TEST_PRODUCT_NAME);

        await purchasingDashboard.expectOnDetailPage();
        await expect(page.getByText(TEST_PRODUCT_NAME).first()).toBeVisible();

        await purchaseDetail.requestQuotesFromSupplier(SUPPLIER_EMAIL);
        await purchaseDetail.expectQuoteRequestSuccess();
        await page.waitForTimeout(2000);

        const purchaseId = page.url().split('/').pop() || '';
        await logout(page);

        // ========== d) Proveedor: Cotizar ==========
        await showCaption(page, 'Paso 4: El Proveedor ingresa a su portal privado, carga sus precios y sube la factura oficial.');
        await loginPage.login(SUPPLIER_EMAIL, SUPPLIER_PASSWORD);
        await loginPage.expectLoginSuccess();

        await supplierQuotes.goto();
        await supplierQuotes.expectPendingQuote(TEST_PRODUCT_NAME);
        await supplierQuotes.openQuoteModal(TEST_PRODUCT_NAME);

        await supplierQuotes.fillQuoteFormWithItems(15000, 8000);
        await supplierQuotes.submitQuote();
        await supplierQuotes.expectQuoteSubmittedSuccess();
        await page.waitForTimeout(2000);

        await logout(page);

        // ========== e) Compras: Seleccionar ganador ==========
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        if (purchaseId) {
            await page.goto(`/purchases/management/${purchaseId}`);
        } else {
            await purchasingDashboard.goto();
            await page.waitForLoadState('networkidle');
            await purchasingDashboard.expectPurchaseVisible(TEST_PRODUCT_NAME);
            await purchasingDashboard.clickPurchaseDetail(TEST_PRODUCT_NAME);
        }

        await purchasingDashboard.expectOnDetailPage();
        await page.waitForTimeout(2000);

        await page.getByText(/Confirmar ganadores por ítem|Seleccionar Ganador|Comparativa de presupuestos|Las cotizaciones no incluyen/i).first().waitFor({ state: 'visible', timeout: 25000 });
        await page.waitForTimeout(2000);

        await showCaption(page, 'Paso 5: La Comparativa Inteligente analiza las ofertas y resalta en verde el precio más bajo automáticamente.');
        await showCaption(page, 'El Encargado confirma la compra asegurando el mejor precio para Grupo Bacar.');
        const hasSmartComparison = await page.getByText(/Confirmar ganadores por ítem/i).isVisible().catch(() => false);
        if (hasSmartComparison) {
            await quoteComparison.selectSupplierAsWinnerForAllItems();
            await quoteComparison.confirmItemWinners();
        } else {
            await quoteComparison.clickSelectWinnerButton();
        }
        await quoteComparison.expectWinnerSelectedSuccess();
        await page.waitForTimeout(2000);

        await expect(page.locator('.grid').filter({ hasText: 'Estado' }).locator('select')).toHaveValue('Compra Aprobada', { timeout: 8000 });
    });
});
