/**
 * Migración máquinas de tesorería
 * node scripts/run-treasury-machines-migration.js
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

    const sqlPath = path.join(__dirname, '../migrations/create_treasury_machines.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await conn.query(sql);
    console.log('Migración treasury_machines aplicada.');
    await conn.end();
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
