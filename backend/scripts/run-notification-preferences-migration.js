/**
 * Ejecuta la migración de preferencias de notificación
 * node scripts/run-notification-preferences-migration.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ticket_system',
    });

    const cols = [
        { name: 'notification_email', sql: 'ADD COLUMN notification_email VARCHAR(255) NULL' },
        { name: 'whatsapp_number', sql: 'ADD COLUMN whatsapp_number VARCHAR(30) NULL' },
        { name: 'push_enabled', sql: 'ADD COLUMN push_enabled BOOLEAN NOT NULL DEFAULT TRUE' },
    ];
    for (const col of cols) {
        try {
            await conn.query(`ALTER TABLE users ${col.sql}`);
            console.log(`Columna ${col.name} agregada.`);
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log(`Columna ${col.name} ya existe.`);
            } else {
                throw err;
            }
        }
    }
    console.log('Migración completada.');
    await conn.end();
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
