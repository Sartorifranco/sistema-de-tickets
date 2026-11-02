/**
 * Agrega tickets.integration_source si no existe.
 * No modifica filas existentes.
 *
 * node scripts/run-bacarnet-integration-source-migration.js
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
        const sql = fs.readFileSync(
            path.join(__dirname, '..', 'migrations', 'add_bacarnet_integration_source.sql'),
            'utf8'
        );
        await conn.query(sql);
        const [rows] = await conn.query(
            `SELECT COLUMN_NAME, IS_NULLABLE, COLUMN_TYPE
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = 'tickets'
               AND COLUMN_NAME = 'integration_source'`
        );
        if (!rows.length) {
            throw new Error('La columna integration_source no quedó creada.');
        }
        console.log('OK tickets.integration_source', rows[0].COLUMN_TYPE, 'null=' + rows[0].IS_NULLABLE);
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Migración falló:', err.message);
    process.exit(1);
});
