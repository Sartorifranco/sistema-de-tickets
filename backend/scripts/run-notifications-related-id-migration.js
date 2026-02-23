/**
 * Migración: related_id de INT a VARCHAR para soportar IDs de Firestore
 * node scripts/run-notifications-related-id-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ticket_system',
    });

    try {
        await conn.query('ALTER TABLE notifications MODIFY COLUMN related_id VARCHAR(64) NULL');
        console.log('Columna related_id modificada a VARCHAR(64).');
    } catch (err) {
        if (err.message && err.message.includes('Duplicate')) {
            console.log('La columna ya tiene el tipo correcto.');
        } else {
            console.error('Error:', err.message);
            throw err;
        }
    }
    await conn.end();
    console.log('Migración completada.');
}

run().catch((err) => {
    console.error(err);
    process.exit(1);
});
