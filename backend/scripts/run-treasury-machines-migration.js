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

    const baseSql = fs.readFileSync(
        path.join(__dirname, '../migrations/create_treasury_machines.sql'),
        'utf8'
    );
    await conn.query(baseSql);
    console.log('Tablas treasury_machines OK.');

    const dateSqlPath = path.join(__dirname, '../migrations/add_treasury_maintenance_date.sql');
    if (fs.existsSync(dateSqlPath)) {
        try {
            await conn.query(fs.readFileSync(dateSqlPath, 'utf8'));
            console.log('Columna maintenance_date OK.');
        } catch (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                console.log('Columna maintenance_date ya existía.');
            } else {
                throw err;
            }
        }
    }
    console.log('Migración treasury_machines aplicada.');
    await conn.end();
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
