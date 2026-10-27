/**
 * Hojas de ruta nombradas y asignación por fecha.
 * node scripts/run-technician-route-templates-migration.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

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
        const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'add_technician_route_templates.sql'), 'utf8');
        await conn.query(sql);
        console.log('Tablas technician_route_templates y technician_route_assignments listas.');
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
