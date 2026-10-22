/**
 * Recorridos semanales por técnico.
 * node scripts/run-technician-route-plans-migration.js
 * Idempotente: crea la tabla solo si no existe.
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
        const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'add_technician_route_plans.sql'), 'utf8');
        await conn.query(sql);
        console.log('Tabla technician_route_plans lista.');
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
