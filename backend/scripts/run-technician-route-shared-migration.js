/**
 * Una sola hoja por fecha, visible para todos los técnicos.
 * node scripts/run-technician-route-shared-migration.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const { ensureSharedTechnicianRoutes } = require('../src/services/technicianRouteSchema');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ticket_system',
        multipleStatements: true,
    });

    try {
        await ensureSharedTechnicianRoutes(conn);
        console.log('Las hojas de ruta quedan compartidas: una sola por fecha.');
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
