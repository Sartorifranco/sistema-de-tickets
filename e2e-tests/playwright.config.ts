/**
 * Configuración de Playwright para E2E - Módulo de Compras
 * Copie .env.e2e.example a .env.e2e y configure E2E_BASE_URL y credenciales
 */
try {
    require('dotenv').config({ path: require('path').join(__dirname, '.env.e2e') });
} catch {
    // dotenv opcional
}
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
    testDir: './',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: [['html', { outputFolder: 'playwright-report' }]],
    use: {
        baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        video: 'on-first-retry',
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
    timeout: 60000,
    expect: { timeout: 10000 },
});
