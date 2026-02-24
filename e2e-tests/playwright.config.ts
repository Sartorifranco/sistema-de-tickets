/**
 * Configuración de Playwright para E2E - Módulo de Compras
 * Copie .env.e2e.example a .env.e2e y configure E2E_BASE_URL y credenciales
 *
 * GRABACIÓN PARA DEMO: video: 'on', slowMo: 1500, viewport Full HD
 * Videos guardados en: e2e-tests/test-results/<nombre-test>-chromium/video.webm
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
        video: {
            mode: 'on',
            size: { width: 1920, height: 1080 },
        },
        viewport: { width: 1920, height: 1080 },
        launchOptions: {
            slowMo: 1500,
        },
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                viewport: { width: 1920, height: 1080 },
                screen: { width: 1920, height: 1080 },
            },
        },
    ],
    timeout: 180000,
    expect: { timeout: 15000 },
});
