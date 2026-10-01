/**
 * Migración: personalización del módulo Problemáticas
 * (orden, activo/inactivo y prioridad sugerida en categorías y problemas predefinidos)
 *
 * node scripts/run-problems-customization-migration.js
 *
 * Idempotente: revisa information_schema y agrega solo las columnas que faltan.
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const COLUMNS = [
    {
        table: 'predefined_problems',
        column: 'is_active',
        ddl: 'ALTER TABLE predefined_problems ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
    },
    {
        table: 'predefined_problems',
        column: 'sort_order',
        ddl: 'ALTER TABLE predefined_problems ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
    },
    {
        table: 'predefined_problems',
        column: 'default_priority',
        ddl: "ALTER TABLE predefined_problems ADD COLUMN default_priority ENUM('low','medium','high','urgent') NULL DEFAULT NULL",
    },
    {
        table: 'ticket_categories',
        column: 'is_active',
        ddl: 'ALTER TABLE ticket_categories ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1',
    },
    {
        table: 'ticket_categories',
        column: 'sort_order',
        ddl: 'ALTER TABLE ticket_categories ADD COLUMN sort_order INT NOT NULL DEFAULT 0',
    },
];

async function run() {
    const database = process.env.DB_NAME || 'ticket_system';
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database,
    });

    try {
        const [rows] = await conn.query(
            `SELECT TABLE_NAME, COLUMN_NAME
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = ?
               AND TABLE_NAME IN ('predefined_problems', 'ticket_categories')`,
            [database]
        );
        const existing = new Set(rows.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));

        let added = 0;
        for (const col of COLUMNS) {
            const key = `${col.table}.${col.column}`;
            if (existing.has(key)) {
                console.log(`  = ${key} ya existe`);
                continue;
            }
            await conn.query(col.ddl);
            added += 1;
            console.log(`  + ${key} agregada`);
        }

        // Orden inicial estable: respeta el orden alfabético actual para no cambiar
        // lo que hoy ve el usuario en los desplegables.
        if (added > 0) {
            await conn.query(`
                UPDATE ticket_categories tc
                JOIN (
                    SELECT id, ROW_NUMBER() OVER (ORDER BY name ASC, id ASC) AS rn
                    FROM ticket_categories
                ) o ON o.id = tc.id
                SET tc.sort_order = o.rn
                WHERE tc.sort_order = 0
            `);
            await conn.query(`
                UPDATE predefined_problems p
                JOIN (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY category_id ORDER BY title ASC, id ASC) AS rn
                    FROM predefined_problems
                ) o ON o.id = p.id
                SET p.sort_order = o.rn
                WHERE p.sort_order = 0
            `);
            console.log('  ~ orden inicial asignado (alfabético, como hasta ahora)');
        }

        console.log(added > 0 ? `Migración aplicada (${added} columnas nuevas).` : 'Nada que hacer: la migración ya estaba aplicada.');
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
