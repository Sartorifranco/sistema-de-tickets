/**
 * Script para ejecutar la migración de roles boss/purchasing
 * Ejecutar: node run-purchase-migration.js
 */
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

    console.log('Conectando a MySQL...');
    const conn = await mysql.createConnection(config);

    try {
        const [cols] = await conn.execute("SHOW COLUMNS FROM users LIKE 'role'");
        if (cols.length === 0) {
            console.error('Columna role no encontrada.');
            process.exit(1);
        }
        const col = cols[0];
        console.log('Tipo actual de role:', col.Type);

        if (col.Type.toLowerCase().includes('enum')) {
            console.log('Ejecutando ALTER para agregar boss y purchasing al ENUM...');
            await conn.execute(`
                ALTER TABLE users 
                MODIFY COLUMN role ENUM('admin', 'agent', 'client', 'boss', 'purchasing') NOT NULL 
                DEFAULT 'client'
                COMMENT 'admin, agent, client, boss (jefe depto), purchasing (encargado compras)'
            `);
            console.log('Migración completada correctamente.');
        } else {
            console.log('La columna role es VARCHAR. No se requiere ALTER.');
            console.log('Los roles boss y purchasing funcionarán directamente.');
        }
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    } finally {
        await conn.end();
    }
}

run();
