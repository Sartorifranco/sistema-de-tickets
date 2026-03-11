/**
 * Ejecuta la migración create_user_fcm_tokens.sql
 * Uso: node run-migration-fcm.js
 */
require('dotenv').config();
const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, 'migrations', 'create_user_fcm_tokens.sql');
const sql = fs.readFileSync(sqlPath, 'utf8')
    .split(';')
    .map(s => s.replace(/--.*$/gm, '').trim())
    .filter(s => s.length > 0);

(async () => {
    try {
        for (const stmt of sql) {
            if (stmt.toUpperCase().startsWith('CREATE')) {
                await pool.execute(stmt);
                console.log('[OK] Tabla user_fcm_tokens creada.');
            }
        }
        process.exit(0);
    } catch (err) {
        console.error('[Error]', err.message);
        process.exit(1);
    }
})();
