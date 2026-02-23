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
    console.log('Ejecutando migración supplier...');
    const conn = await mysql.createConnection(config);
    try {
        await conn.execute(`
            ALTER TABLE users 
            MODIFY COLUMN role ENUM('admin', 'agent', 'client', 'boss', 'purchasing', 'supplier') NOT NULL DEFAULT 'client'
        `);
        console.log('Rol supplier agregado.');
    } catch (e) {
        if (e.message.includes('Duplicate column')) { console.log('Ya existe.'); }
        else throw e;
    }
    try {
        await conn.execute(`
            ALTER TABLE users 
            ADD COLUMN supplier_invitation_token VARCHAR(64) NULL,
            ADD COLUMN supplier_invitation_expires DATETIME NULL
        `);
        console.log('Columnas de invitación agregadas.');
    } catch (e) {
        if (e.message.includes('Duplicate column')) { console.log('Columnas ya existen.'); }
        else throw e;
    }
    await conn.end();
    console.log('Migración completada.');
}

run().catch(err => { console.error(err); process.exit(1); });
