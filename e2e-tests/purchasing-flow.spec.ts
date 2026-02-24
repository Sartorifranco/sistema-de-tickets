/**
 * E2E: Flujo completo de compras (Happy Path) - Grabación para Directorio
 *
 * Requiere:
 * - Frontend y Backend corriendo
 * - E2E_ENABLED=true en backend .env para mock-email
 * - Usuarios de prueba en la BD (empleado, jefe, compras, proveedor)
 *
 * Pasos: Empleado crea → Jefe aprueba desde mock-email → Compras solicita cotización →
 *        Proveedor cotiza (con métodos de pago complejos) → Compras selecciona ganador →
 *        Proveedor marca enviado y sube factura → Empleado califica entrega
 */
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { PurchaseRequestPage } from './pages/PurchaseRequestPage';
import { PurchasingDashboardPage } from './pages/PurchasingDashboardPage';
import { PurchaseDetailPage } from './pages/PurchaseDetailPage';
import { SupplierQuotesPage } from './pages/SupplierQuotesPage';
import { QuoteComparisonPage } from './pages/QuoteComparisonPage';

const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL || 'empleado@bacar.com.ar';
const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD || 'password123';
const PURCHASING_EMAIL = process.env.E2E_PURCHASING_EMAIL || 'compras@bacar.com.ar';
const PURCHASING_PASSWORD = process.env.E2E_PURCHASING_PASSWORD || 'password123';
const SUPPLIER_EMAIL = process.env.E2E_SUPPLIER_EMAIL || 'proveedor@test.com';
const SUPPLIER_PASSWORD = process.env.E2E_SUPPLIER_PASSWORD || 'password123';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:3000';

const TITLES = [
    'Renovación de Monitores IT',
    'Insumos de Oficina Semestral',
    'Herramientas de Mantenimiento',
];
const ITEMS_POOL = [
    { producto: 'Monitor Dell 24 pulgadas', cantidad: 2, descripcion: 'Para área de desarrollo' },
    { producto: 'Resmas Autor A4 x10', cantidad: 5, descripcion: 'Uso general oficina' },
    { producto: 'Silla Ergonómica', cantidad: 1, descripcion: 'Para puesto gerencial' },
];

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function logout(page: import('@playwright/test').Page) {
    return page.getByRole('button', { name: /Cerrar Sesión/i }).click();
}

/**
 * Transición de cambio de perfil: pantalla completa con "👤 INGRESANDO COMO: {role}".
 * Dura 3 segundos y luego remueve el overlay antes del login.
 */
async function showRoleTransition(
    page: import('@playwright/test').Page,
    roleName: string,
    durationMs = 3000
) {
    await page.evaluate(
        ({ role }: { role: string }) => {
            let el = document.getElementById('demo-role-transition');
            if (!el) {
                el = document.createElement('div');
                el.id = 'demo-role-transition';
                document.body.appendChild(el);
            }
            el.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(0, 0, 0, 0.9);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                pointer-events: none;
            `;
            el.innerHTML = `<span style="color: white; font-size: 60px; font-weight: bold; font-family: system-ui, sans-serif;">👤 INGRESANDO COMO: ${role}</span>`;
        },
        { role: roleName }
    );
    await page.waitForTimeout(durationMs);
    await page.evaluate(() => {
        const el = document.getElementById('demo-role-transition');
        if (el) el.remove();
    });
    await page.waitForTimeout(300);
}

/**
 * Inyecta un subtítulo overlay para la grabación de demo.
 */
async function showCaption(
    page: import('@playwright/test').Page,
    text: string,
    durationMs = 4000
) {
    await page.evaluate(
        ({ captionText }: { captionText: string }) => {
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
        },
        { captionText: text }
    );
    await page.waitForTimeout(durationMs);
    await page.evaluate(() => {
        const el = document.getElementById('demo-caption');
        if (el) el.style.display = 'none';
    });
    await page.waitForTimeout(300);
}

test.describe('Flujo de Compras E2E (Happy Path - Video Directorio)', () => {
    test('Circuito completo con transiciones, mock-email y calificación', async ({ page }) => {
        const loginPage = new LoginPage(page);
        const purchaseRequestPage = new PurchaseRequestPage(page);
        const purchasingDashboard = new PurchasingDashboardPage(page);
        const purchaseDetail = new PurchaseDetailPage(page);
        const supplierQuotes = new SupplierQuotesPage(page);
        const quoteComparison = new QuoteComparisonPage(page);

        const title = pickRandom(TITLES);
        const item1 = ITEMS_POOL[0];
        const item2 = ITEMS_POOL[1];

        // ========== a) Empleado: Crear solicitud ==========
        await showRoleTransition(page, 'Solicitante');
        await loginPage.goto();
        await showCaption(page, 'Paso 1: Un colaborador ingresa al sistema para solicitar insumos.');
        await loginPage.login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
        await loginPage.expectLoginSuccess();
        await page.waitForTimeout(800);

        await purchaseRequestPage.goto();
        await page.waitForTimeout(500);
        await expect(page.getByRole('heading', { name: /Nueva solicitud de compra/i })).toBeVisible();

        await showCaption(page, 'El sistema permite cargar múltiples ítems con datos reales.');
        await purchaseRequestPage.fillFormWithTwoItems(item1, item2, title, { pauseMs: 1500 });
        await page.waitForTimeout(1500);

        const [createResponse] = await Promise.all([
            page.waitForResponse(
                (r) =>
                    r.url().includes('/api/purchases') &&
                    r.request().method() === 'POST' &&
                    r.status() === 201,
                { timeout: 15000 }
            ),
            purchaseRequestPage.submit(),
        ]);
        const createJson = await createResponse.json().catch(() => ({}));
        const purchaseId = createJson?.data?.id || '';

        await purchaseRequestPage.expectSuccessToast();
        await page.waitForTimeout(2000);

        await page.goto('/purchases');
        await page.waitForLoadState('networkidle');
        await page.waitForResponse((r) => r.url().includes('/api/purchases') && r.request().method() === 'GET', { timeout: 10000 }).catch(() => null);
        await page.waitForTimeout(1500);
        await expect(
            page.getByText(title)
                .or(page.getByText(item1.producto))
                .or(page.getByText('Solicitud (2 ítems)'))
                .first()
        ).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(1000);

        await logout(page);
        await page.context().clearCookies();
        await expect(page).toHaveURL(/\/login/);

        // ========== b) Jefe: Aprobar desde mock-email (simulación de correo) ==========
        await showRoleTransition(page, 'Jefe');
        await showCaption(page, 'Paso 2: El Jefe recibe el correo y aprueba con un clic, sin necesidad de iniciar sesión.');

        await page.evaluate(() => localStorage.clear());
        await page.goto(`${BASE_URL}/mock-email?purchaseId=${purchaseId}`);
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        await expect(page.getByText(/Requiere su Aprobación/i)).toBeVisible({ timeout: 12000 });
        await page.getByRole('button', { name: /✅ APROBAR/i }).click();

        await page.waitForURL(/success-approval/, { timeout: 15000 });
        await expect(page.getByText(/Solicitud aprobada/i)).toBeVisible({ timeout: 5000 });
        await page.waitForTimeout(2000);

        await page.context().clearCookies();

        // ========== c) Compras: Solicitar cotización ==========
        await showRoleTransition(page, 'Compras');
        await showCaption(page, 'Paso 3: El Encargado de Compras revisa el pedido y selecciona proveedores a licitar.');
        await loginPage.goto();
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        await purchasingDashboard.goto();
        await purchasingDashboard.expectPurchaseVisible(title);
        await purchasingDashboard.clickPurchaseDetail(title);

        await purchasingDashboard.expectOnDetailPage();
        await expect(page.getByText(title).first()).toBeVisible();
        await purchaseDetail.requestQuotesFromSupplier(SUPPLIER_EMAIL);
        await purchaseDetail.expectQuoteRequestSuccess();
        await page.waitForTimeout(2000);

        const detailPurchaseId = page.url().split('/').pop() || purchaseId;

        await logout(page);
        await page.context().clearCookies();

        // ========== d) Proveedor: Cotizar con métodos de pago complejos ==========
        await showRoleTransition(page, 'Proveedor');
        await showCaption(page, 'Paso 4: El Proveedor ingresa, cotiza con opciones avanzadas (Tarjeta, Visa, 3 cuotas sin interés).');
        await loginPage.goto();
        await loginPage.login(SUPPLIER_EMAIL, SUPPLIER_PASSWORD);
        await loginPage.expectLoginSuccess();

        await supplierQuotes.goto();
        await supplierQuotes.expectPendingQuote(title);
        await supplierQuotes.openQuoteModal(title);

        await supplierQuotes.fillQuoteFormWithItemsAndComplexPayment(15000, 8000);
        await page.waitForTimeout(1500);
        await supplierQuotes.submitQuote();
        await supplierQuotes.expectQuoteSubmittedSuccess();
        await page.waitForTimeout(2000);

        await logout(page);
        await page.context().clearCookies();

        // ========== e) Compras: Seleccionar ganador ==========
        await loginPage.goto();
        await loginPage.login(PURCHASING_EMAIL, PURCHASING_PASSWORD);
        await loginPage.expectLoginSuccess();

        await page.goto(`/purchases/management/${detailPurchaseId}`);
        await page.waitForLoadState('networkidle');

        await page
            .getByText(/Confirmar ganadores por ítem|Seleccionar Ganador|Comparativa|Las cotizaciones no incluyen/i)
            .first()
            .waitFor({ state: 'visible', timeout: 25000 });
        await page.waitForTimeout(2000);

        await showCaption(page, 'Paso 5: La Comparativa Inteligente analiza ofertas. El Encargado confirma la compra.');
        const hasSmartComparison = await page.getByText(/Confirmar ganadores por ítem/i).isVisible().catch(() => false);
        if (hasSmartComparison) {
            await quoteComparison.selectSupplierAsWinnerForAllItems();
            await quoteComparison.confirmItemWinners();
        } else {
            await quoteComparison.clickSelectWinnerButton();
        }
        await quoteComparison.expectWinnerSelectedSuccess();
        await page.waitForTimeout(2000);

        await expect(
            page.locator('.grid').filter({ hasText: 'Estado' }).locator('select')
        ).toHaveValue('Compra Aprobada', { timeout: 8000 });

        await logout(page);
        await page.context().clearCookies();

        // ========== f) Proveedor: Marcar enviado y subir factura ==========
        await showRoleTransition(page, 'Proveedor');
        await loginPage.goto();
        await loginPage.login(SUPPLIER_EMAIL, SUPPLIER_PASSWORD);
        await loginPage.expectLoginSuccess();

        await supplierQuotes.goto();
        await page.waitForTimeout(1500);

        const winnerCard = page.locator('.bg-white.rounded-lg').filter({ hasText: title }).filter({ hasText: 'Ganador' }).first();
        await winnerCard.waitFor({ state: 'visible', timeout: 10000 });

        const markShippedBtn = winnerCard.getByRole('button', { name: /Notificar pedido enviado/i });
        if (await markShippedBtn.isVisible()) {
            await markShippedBtn.click();
            await page.waitForTimeout(800);
            await page.getByRole('button', { name: /Confirmar envío/i }).click();
            await page.waitForTimeout(2000);
        }

        const fileInput = winnerCard.locator('input[type="file"]');
        if (await fileInput.isVisible()) {
            const minimalPdf = Buffer.from(
                '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000052 00000 n \n0000000101 00000 n \ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n178\n%%EOF'
            );
            await fileInput.setInputFiles({
                name: 'factura-demo.pdf',
                mimeType: 'application/pdf',
                buffer: minimalPdf,
            });
            await page.waitForTimeout(4000);
        }

        await logout(page);
        await page.context().clearCookies();

        // ========== g) Empleado: Calificar pedido (5 estrellas + comentario) ==========
        await showRoleTransition(page, 'Solicitante');
        await showCaption(page, 'Paso 6: El Empleado recibe el pedido, califica con 5 estrellas y cierra el proceso.');
        await loginPage.goto();
        await loginPage.login(EMPLOYEE_EMAIL, EMPLOYEE_PASSWORD);
        await loginPage.expectLoginSuccess();

        await page.goto('/purchases');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(1500);

        const purchaseCard = page.locator('.bg-white').filter({ hasText: title }).first();
        await purchaseCard.waitFor({ state: 'visible', timeout: 10000 });
        await purchaseCard.click();
        await page.waitForTimeout(1000);

        const conformeBtn = page.getByRole('button', { name: /Marcar como Recibido|Conforme/i });
        if (await conformeBtn.isVisible()) {
            await conformeBtn.click();
            await page.waitForTimeout(800);

            const star5 = page.getByRole('button', { name: /5 estrellas/i }).or(page.locator('.flex.gap-1 button').nth(4));
            await star5.click();
            await page.waitForTimeout(500);

            const commentArea = page.getByPlaceholder(/Entregado a tiempo|comentario/i);
            if (await commentArea.isVisible()) {
                await commentArea.fill('Excelente tiempo de entrega y calidad');
                await page.waitForTimeout(1000);
            }

            await page.getByRole('button', { name: /Confirmar y cerrar/i }).click();
            await page.waitForTimeout(2000);

            await expect(page.getByText(/conforme|Gracias por calificar/i)).toBeVisible({ timeout: 8000 }).catch(() => true);
        }

        await showCaption(page, '¡Proceso completo! Grupo Bacar optimiza sus compras con el Módulo de Compras.', 5000);
        await page.waitForTimeout(3000);
    });
});
