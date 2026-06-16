/**
 * Problemas predefinidos depositarios: Atención remota + Error de software
 * node scripts/run-depositario-problems-migration.js
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

    const sqlPath = path.join(__dirname, '../migrations/add_depositario_predefined_problems.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    try {
        await conn.query(sql);
        const [rows] = await conn.query(
            `SELECT p.id, p.title, c.name AS category_name
             FROM predefined_problems p
             JOIN ticket_categories c ON c.id = p.category_id
             WHERE p.title IN ('Atención remota', 'Error de software')
             ORDER BY c.name, p.title`
        );
        console.log('Migración aplicada. Problemas insertados/encontrados:', rows.length);
        rows.forEach((r) => console.log(`  - [${r.id}] ${r.title} → ${r.category_name}`));
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
