/**
 * Visibilidad global de módulos
 * node scripts/run-system-modules-migration.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ticket_system',
        multipleStatements: true,
    });

    const sqlPath = path.join(__dirname, '../migrations/create_system_module_settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await conn.query(sql);
        const [rows] = await conn.query(
            'SELECT module_key, is_enabled FROM system_module_settings ORDER BY module_key'
        );
        console.log('Migración system_module_settings aplicada.');
        rows.forEach((r) => console.log(`  - ${r.module_key}: ${r.is_enabled ? 'ON' : 'OFF'}`));
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
