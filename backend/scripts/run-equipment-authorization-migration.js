/**
 * Migración: autorización de solicitudes de nuevo equipamiento
 *
 * node scripts/run-equipment-authorization-migration.js
 *
 * Idempotente: crea las tablas si no existen y agrega la problemática
 * "Solicitud de nuevo equipamiento" en cada categoría "Hardware y Periféricos" que no la tenga.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const PROBLEM_TITLE = 'Solicitud de nuevo equipamiento';
const PROBLEM_DESCRIPTION =
    'Pedido de un equipo nuevo (PC, notebook o puesto completo). Requiere autorización de un responsable antes de comprarlo o asignarlo.';

async function run() {
    const database = process.env.DB_NAME || 'ticket_system';
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database,
        multipleStatements: true,
    });

    try {
        const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', 'add_equipment_authorization.sql'), 'utf8');
        await conn.query(sql);
        console.log('  = tablas app_settings y ticket_authorizations listas');

        const [cats] = await conn.query(
            `SELECT id, company_id FROM ticket_categories
             WHERE CONVERT(name USING utf8mb4) COLLATE utf8mb4_0900_ai_ci LIKE 'hardware%perif%'`
        );
        if (cats.length === 0) {
            console.log('  ! No se encontró la categoría "Hardware y Periféricos": agregá la problemática a mano.');
        }

        for (const cat of cats) {
            const [exists] = await conn.query(
                `SELECT id FROM predefined_problems
                 WHERE category_id = ? AND CONVERT(title USING utf8mb4) COLLATE utf8mb4_0900_ai_ci = ?`,
                [cat.id, PROBLEM_TITLE]
            );
            if (exists.length > 0) {
                console.log(`  = categoría ${cat.id}: la problemática ya existe (#${exists[0].id})`);
                continue;
            }

            // Mismo departamento que el resto de los problemas de la categoría.
            const [[dept]] = await conn.query(
                `SELECT department_id, COUNT(*) AS n FROM predefined_problems
                 WHERE category_id = ? AND department_id IS NOT NULL
                 GROUP BY department_id ORDER BY n DESC LIMIT 1`,
                [cat.id]
            );
            const [[order]] = await conn.query(
                'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM predefined_problems WHERE category_id = ?',
                [cat.id]
            );
            const [r] = await conn.query(
                `INSERT INTO predefined_problems
                    (category_id, title, description, company_id, department_id, is_active, sort_order, default_priority)
                 VALUES (?, ?, ?, ?, ?, 1, ?, 'medium')`,
                [cat.id, PROBLEM_TITLE, PROBLEM_DESCRIPTION, cat.company_id, dept ? dept.department_id : null, order.next]
            );
            console.log(`  + categoría ${cat.id}: problemática agregada (#${r.insertId})`);
        }

        console.log('Migración de autorización de equipamiento aplicada.');
    } finally {
        await conn.end();
    }
}

run().catch((err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
