require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const config = {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    };
    console.log('Ejecutando migración supplier_rubro...');
    const conn = await mysql.createConnection(config);
    try {
        await conn.execute(`
            ALTER TABLE users ADD COLUMN supplier_rubro VARCHAR(100) NULL
            COMMENT 'Rubro del proveedor para matching con solicitudes'
        `);
        console.log('Columna supplier_rubro agregada.');
    } catch (e) {
        if (e.message.includes('Duplicate column')) {
            console.log('Columna supplier_rubro ya existe.');
        } else {
            throw e;
        }
    }
    await conn.end();
    console.log('Migración completada.');
}

run().catch(err => { console.error(err); process.exit(1); });
