/**
 * Configuración de Firebase Admin (Firestore + Storage)
 * Para el Módulo de Compras - Arquitectura híbrida
 * FIREBASE_CREDENTIALS: ruta a archivo JSON (ej. ./firebase-service-account.json) o JSON string
 */
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db = null;
let bucket = null;

function findCredentialsFile(trimmed) {
    const candidates = [
        path.isAbsolute(trimmed) ? trimmed : path.resolve(__dirname, '..', '..', trimmed),
        path.resolve(process.cwd(), trimmed.replace(/^\.\//, '')),
        path.resolve(process.cwd(), 'firebase-service-account.json'),
        path.resolve(__dirname, '..', '..', 'firebase-service-account.json'),
    ].filter((p, i, arr) => arr.indexOf(p) === i);

    for (const p of candidates) {
        if (fs.existsSync(p)) return p;
    }
    return null;
}

try {
    const credentialsInput = process.env.FIREBASE_CREDENTIALS;
    
    if (!credentialsInput) {
        console.warn('[Firebase] FIREBASE_CREDENTIALS no está definido. El Módulo de Compras no estará disponible.');
    } else {
        let credentials;
        const trimmed = String(credentialsInput).trim();
        if (trimmed.startsWith('{')) {
            credentials = JSON.parse(trimmed);
        } else {
            const filePath = findCredentialsFile(trimmed);
            if (!filePath) {
                const defaultPath = path.resolve(__dirname, '..', '..', trimmed);
                console.warn('[Firebase] Archivo de credenciales no encontrado. Ruta esperada:', defaultPath);
            } else {
                credentials = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log('[Firebase] Credenciales cargadas desde:', filePath);
            }
        }

        if (credentials && !admin.apps.length) {
            const projectId = credentials.project_id || '';
            const storageBucket = (process.env.FIREBASE_STORAGE_BUCKET || '').trim()
                || (projectId + '.firebasestorage.app')
                || (projectId + '.appspot.com');
            admin.initializeApp({
                credential: admin.credential.cert(credentials),
                storageBucket: storageBucket || undefined
            });
            db = admin.firestore();
            if (storageBucket) {
                bucket = admin.storage().bucket(storageBucket);
                console.log('[Firebase] Firestore y Storage. Proyecto:', projectId, 'Bucket:', storageBucket);
            } else {
                console.warn('[Firebase] FIREBASE_STORAGE_BUCKET no definido. Storage deshabilitado.');
            }

            // Verificar conectividad con Firestore (no bloquea si falla)
            db.collection('purchase_requests').limit(1).get()
                .then(() => console.log('[Firebase] Conexión a Firestore verificada.'))
                .catch((err) => console.error('[Firebase] Error al conectar con Firestore:', err.message, '- Asegúrate de crear la base de datos en Firebase Console.'));
        } else if (!credentials) {
            console.warn('[Firebase] No se pudieron cargar las credenciales. Módulo de Compras deshabilitado.');
        }
    }
} catch (error) {
    console.error('[Firebase] Error al inicializar:', error.message);
}

module.exports = {
    db,
    bucket,
    admin
};
