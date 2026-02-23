# E2E Tests - Módulo de Compras

Pruebas End-to-End con Playwright para el flujo completo de compras.

## Instalación

```bash
cd e2e-tests
npm install
npx playwright install chromium
```

O desde la raíz del proyecto:

```bash
cd c:\sistema-de-tickets\e2e-tests
npm install
npx playwright install chromium
```

## Configuración

1. **Copie el archivo de ejemplo y edítelo con sus credenciales:**

```bash
copy .env.e2e.example .env.e2e
```

2. **Complete `.env.e2e` con:**

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `E2E_BASE_URL` | URL del frontend | `http://localhost:3000` |
| `E2E_EMPLOYEE_EMAIL` | Email del empleado (cliente Bacar) | `empleado@bacar.com.ar` |
| `E2E_EMPLOYEE_PASSWORD` | Contraseña del empleado | `password123` |
| `E2E_BOSS_EMAIL` | Email del jefe | `jefe@bacar.com.ar` |
| `E2E_BOSS_PASSWORD` | Contraseña del jefe | `password123` |
| `E2E_PURCHASING_EMAIL` | Email del encargado de compras | `compras@bacar.com.ar` |
| `E2E_PURCHASING_PASSWORD` | Contraseña de compras | `password123` |
| `E2E_SUPPLIER_EMAIL` | Email del proveedor | `proveedor@test.com` |
| `E2E_SUPPLIER_PASSWORD` | Contraseña del proveedor | `password123` |

3. **Requisitos previos:**
   - Frontend corriendo (ej: `npm start` en /frontend)
   - Backend corriendo (ej: `node server.js` en /backend)
   - Los 4 usuarios de prueba existen en la BD y el proveedor está activo/invitado

## Ejecución

```bash
# Todas las pruebas
npm test

# Solo el flujo de compras
npm run test:purchasing

# Con interfaz gráfica
npm run test:ui

# Modo visible (ver el navegador)
npm run test:headed
```

## Flujo cubierto

1. **Empleado:** Login → Nueva Compra → 2 ítems + rubro → Enviar
2. **Jefe:** Login → Aprobaciones pendientes → Aprobar
3. **Compras:** Login → Dashboard → Ver solicitud → Solicitar presupuesto a 1 proveedor
4. **Proveedor:** Login → Presupuestos → Pendientes → Cotizar (precios por ítem) → Enviar
5. **Compras:** Login → Ver solicitud → Comparativa → Seleccionar ganador → Confirmar
