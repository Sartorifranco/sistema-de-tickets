/**
 * Migración RBAC (permisos por usuario)
 * node scripts/run-rbac-migration.js
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

    const sqlPath = path.join(__dirname, '../migrations/add_user_permissions_rbac.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await conn.query(sql);
        console.log('Migración RBAC aplicada.');
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME' || err.code === 'ER_TABLE_EXISTS_ERROR') {
            console.log('Migración parcialmente aplicada (columna/tabla ya existen). Intentando UPDATE admins...');
            try {
                await conn.query('UPDATE users SET is_super_admin = 1 WHERE role = ? AND is_super_admin = 0', ['admin']);
                console.log('Admins marcados como super_admin donde correspondía.');
            } catch (e2) {
                throw e2;
            }
        } else {
            throw err;
        }
    }

    await conn.end();
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
