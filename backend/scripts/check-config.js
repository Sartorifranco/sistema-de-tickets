/**
 * Script de verificación de configuración del backend
 * Ejecutar: node scripts/check-config.js (desde la carpeta backend)
 * Requiere: dotenv para cargar .env
 */
require('dotenv').config();
const path = require('path');
const fs = require('fs');

const results = { ok: [], fail: [], warn: [] };

function check(name, condition, message) {
    if (condition) results.ok.push(`✅ ${name}: ${message}`);
    else results.fail.push(`❌ ${name}: ${message}`);
}

function warn(name, message) {
    results.warn.push(`⚠️ ${name}: ${message}`);
}

// --- Variables de entorno requeridas ---
check('DB_HOST', !!process.env.DB_HOST, process.env.DB_HOST || 'no definido');
check('DB_USER', !!process.env.DB_USER, process.env.DB_USER || 'no definido');
check('DB_PASSWORD', !!process.env.DB_PASSWORD, '***' + (process.env.DB_PASSWORD ? ' (definido)' : ' (no definido)'));
check('DB_NAME', !!process.env.DB_NAME, process.env.DB_NAME || 'no definido');
check('JWT_SECRET', !!process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32, 'secreto definido (>= 32 chars)');
check('PORT', !!process.env.PORT, process.env.PORT || 'no definido');
check('FRONTEND_URL', !!process.env.FRONTEND_URL, process.env.FRONTEND_URL || 'no definido');

// --- Email ---
check('EMAIL_HOST', !!process.env.EMAIL_HOST, process.env.EMAIL_HOST || 'no definido');
check('EMAIL_USER', !!process.env.EMAIL_USER, process.env.EMAIL_USER || 'no definido');
check('EMAIL_PASS', !!process.env.EMAIL_PASS, process.env.EMAIL_PASS ? '*** (definido)' : 'no definido');

// --- Firebase ---
const fbCred = process.env.FIREBASE_CREDENTIALS;
check('FIREBASE_CREDENTIALS (en .env)', !!fbCred, fbCred || 'no definido');

if (fbCred) {
    const trimmed = String(fbCred).trim();
    const candidates = [
        path.resolve(process.cwd(), trimmed.replace(/^\.\//, '')),
        path.resolve(process.cwd(), 'firebase-service-account.json'),
    ];
    let found = false;
    for (const p of candidates) {
        if (fs.existsSync(p)) {
            found = true;
            break;
        }
    }
    check('Archivo firebase-service-account.json', found, found ? 'existe' : `no encontrado en ${process.cwd()}`);
    if (!found) {
        warn('Firebase', 'El Módulo de Compras no funcionará sin el JSON. Descargar de Firebase Console → Cuentas de servicio.');
    }
} else {
    warn('Firebase', 'FIREBASE_CREDENTIALS no definido. Módulo de Compras deshabilitado.');
}

if (process.env.FIREBASE_STORAGE_BUCKET) {
    results.ok.push(`✅ FIREBASE_STORAGE_BUCKET: ${process.env.FIREBASE_STORAGE_BUCKET}`);
} else {
    results.warn.push(`⚠️ FIREBASE_STORAGE_BUCKET: no definido (Storage deshabilitado)`);
}

// --- Twilio ---
const hasTwilioSid = !!process.env.TWILIO_ACCOUNT_SID;
const hasTwilioToken = !!process.env.TWILIO_AUTH_TOKEN;
if (hasTwilioSid && hasTwilioToken) {
    results.ok.push(`✅ Twilio: configurado (${process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886'})`);
} else {
    results.warn.push(`⚠️ Twilio: faltan TWILIO_ACCOUNT_SID o TWILIO_AUTH_TOKEN (WhatsApp deshabilitado)`);
}

// --- Salida ---
console.log('\n--- Verificación de configuración (backend) ---\n');
results.ok.forEach((m) => console.log(m));
results.fail.forEach((m) => console.log(m));
results.warn.forEach((m) => console.log(m));
console.log('');

if (results.fail.length > 0) {
    console.log('❌ Hay errores. Corrija el archivo backend/.env y vuelva a ejecutar.\n');
    process.exit(1);
}
console.log('✅ Configuración básica OK. Reinicie el backend (npm run dev) para aplicar cambios.\n');
process.exit(0);
