/**
 * Agrega propietario, acción comercial y fecha de instalación,
 * y completa los datos del listado actualizado de depositarios.
 *
 * node scripts/run-depositario-commercial-migration.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const COMMERCIAL_BY_ID = {
    1: ['BACAR', 'COMPRADO', 'Marcos Juarez'],
    2: ['BACAR', 'COMPRADO', 'Marcos Juarez'],
    3: ['ANJOR', 'VENDIDO'],
    4: ['ANJOR', 'VENDIDO'],
    5: ['ANJOR', 'VENDIDO'],
    6: ['ANJOR', 'VENDIDO'],
    7: ['ANJOR', 'VENDIDO'],
    8: ['ANJOR', 'VENDIDO'],
    9: ['ANJOR', 'VENDIDO'],
    10: ['BACAR', 'COMPRADO'],
    11: ['BACAR', 'COMPRADO'],
    12: ['BACAR', 'COMPRADO'],
    13: ['BACAR', 'COMPRADO'],
    14: ['BACAR', 'COMPRADO'],
    15: ['BACAR', 'COMPRADO'],
    16: ['BACAR', 'COMPRADO'],
    17: ['BACAR', 'COMPRADO'],
    18: ['BACAR', 'COMPRADO'],
    19: ['BACAR', 'COMPRADO'],
    20: ['BACAR', 'COMPRADO'],
    21: ['BACAR', 'COMPRADO'],
    22: ['BACAR', 'COMPRADO'],
    23: ['BACAR', 'COMPRADO'],
    24: ['BACAR', 'COMPRADO'],
    25: ['BACAR', 'COMPRADO'],
    26: ['BACAR', 'COMPRADO'],
    27: ['BACAR', 'COMPRADO'],
    28: ['BACAR', 'COMPRADO'],
    29: ['BACAR', 'COMPRADO'],
    30: ['BACAR', 'COMPRADO'],
    31: ['BACAR', 'COMPRADO'],
    32: ['BACAR', 'COMPRADO'],
    33: ['BACAR', 'COMPRADO'],
    34: ['BACAR', 'COMPRADO'],
    35: ['BACAR', 'COMPRADO'],
    36: ['BACAR', 'COMPRADO'],
    39: ['PERMAQUIM', 'ALQUILADO'],
    40: ['PERMAQUIM', 'ALQUILADO'],
    42: ['PERMAQUIM', 'ALQUILADO'],
    43: ['PERMAQUIM', 'ALQUILADO'],
    44: ['PERMAQUIM', 'ALQUILADO'],
    45: ['PERMAQUIM', 'ALQUILADO'],
    46: ['LA CUARTA', 'VENDIDO'],
    48: ['PERMAQUIM', 'ALQUILADO'],
    49: ['PERMAQUIM', 'ALQUILADO'],
    50: ['PERMAQUIM', 'ALQUILADO'],
    51: ['PERMAQUIM', 'ALQUILADO'],
    52: ['ANJOR', 'VENDIDO'],
    53: ['PERMAQUIM', 'ALQUILADO'],
    54: ['PERMAQUIM', 'ALQUILADO'],
    55: ['PERMAQUIM', 'ALQUILADO'],
    56: ['PERMAQUIM', 'ALQUILADO'],
    57: ['PERMAQUIM', 'ALQUILADO'],
    58: ['PERMAQUIM', 'ALQUILADO'],
    59: ['PERMAQUIM', 'ALQUILADO'],
};

function parseInstallMonth(serial) {
    const compact = String(serial || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const match = compact.match(/(\d{2})(\d{2})(\d{3})$/);
    if (!match) return null;
    const month = Number(match[1]);
    const year = 2000 + Number(match[2]);
    if (month < 1 || month > 12 || year < 2018 || year > 2027) return null;
    return `${year}-${String(month).padStart(2, '0')}-01`;
}

async function ensureColumns(conn) {
    const [rows] = await conn.query(
        `SELECT COLUMN_NAME AS name
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'depositarios'`
    );
    const present = new Set(rows.map((row) => row.name));
    const pending = [
        ['owner', 'ALTER TABLE depositarios ADD COLUMN owner VARCHAR(100) NULL AFTER serial_number'],
        ['commercial_action', 'ALTER TABLE depositarios ADD COLUMN commercial_action VARCHAR(20) NULL AFTER owner'],
        ['installed_on', 'ALTER TABLE depositarios ADD COLUMN installed_on DATE NULL AFTER commercial_action'],
        ['install_date_source', 'ALTER TABLE depositarios ADD COLUMN install_date_source VARCHAR(32) NULL AFTER installed_on'],
    ];
    for (const [name, sql] of pending) {
        if (present.has(name)) continue;
        await conn.query(sql);
        console.log('Columna agregada:', name);
    }
}

async function applyCommercialData(conn) {
    let updated = 0;
    for (const [id, [owner, action, address]] of Object.entries(COMMERCIAL_BY_ID)) {
        const [result] = await conn.query(
            `UPDATE depositarios
             SET owner = ?, commercial_action = ?
             WHERE id = ? AND owner IS NULL`,
            [owner, action, Number(id)]
        );
        updated += result.affectedRows;
        if (address) {
            await conn.query(
                `UPDATE depositarios
                 SET address = ?
                 WHERE id = ? AND (address IS NULL OR TRIM(address) = '')`,
                [address, Number(id)]
            );
        }
    }
    console.log('Depositarios con propietario y condición cargados:', updated);
}

async function cleanSerials(conn) {
    await conn.query(
        `UPDATE depositarios
         SET serial_number = TRIM(REPLACE(serial_number, CHAR(9), ''))
         WHERE serial_number IS NOT NULL`
    );
    const [cleared] = await conn.query(
        `UPDATE depositarios
         SET serial_number = NULL,
             location_description = CASE
                WHEN location_description IS NULL OR TRIM(location_description) = ''
                THEN 'Falta el número de serie real. FD1225-982 estaba duplicada y el listado la asigna a RF Logística.'
                ELSE location_description
             END
         WHERE id = 56
           AND REPLACE(REPLACE(UPPER(serial_number), '-', ''), ' ', '') = 'FD1225982'`
    );
    console.log('Serie duplicada retirada de Maestro Vidal:', cleared.affectedRows);
}

async function applyInstallDates(conn) {
    const [rows] = await conn.query(
        `SELECT id, serial_number, install_date_source
         FROM depositarios
         WHERE install_date_source IS NULL OR install_date_source = 'numero_de_serie'`
    );
    let estimated = 0;
    for (const row of rows) {
        if (row.install_date_source === 'manual') continue;
        const installedOn = parseInstallMonth(row.serial_number);
        if (!installedOn) {
            if (row.install_date_source === 'numero_de_serie') {
                await conn.query(
                    `UPDATE depositarios
                     SET installed_on = NULL, install_date_source = NULL
                     WHERE id = ?`,
                    [row.id]
                );
            }
            continue;
        }
        const [result] = await conn.query(
            `UPDATE depositarios
             SET installed_on = ?, install_date_source = 'numero_de_serie'
             WHERE id = ?
               AND (
                    installed_on IS NULL
                    OR install_date_source IS NULL
                    OR install_date_source <> 'numero_de_serie'
                    OR installed_on <> ?
               )`,
            [installedOn, row.id, installedOn]
        );
        estimated += result.affectedRows;
    }
    console.log('Fechas estimadas por número de serie:', estimated);
}

async function ensureTirolesa(conn) {
    await conn.query(
        `INSERT INTO companies (name, is_active)
         SELECT 'MUNI TIROLESA', 1 FROM DUAL
         WHERE NOT EXISTS (SELECT 1 FROM companies WHERE name = 'MUNI TIROLESA')`
    );
    const [company] = await conn.query(
        `SELECT id FROM companies WHERE name = 'MUNI TIROLESA' ORDER BY id LIMIT 1`
    );
    const [existing] = await conn.query(
        `SELECT id FROM depositarios WHERE alias = 'MUNI TIROLESA' AND is_active = 1 LIMIT 1`
    );
    if (existing.length > 0) {
        console.log('MUNI TIROLESA ya existía, id', existing[0].id);
        return;
    }
    const [result] = await conn.query(
        `INSERT INTO depositarios
            (alias, company_id, address, owner, commercial_action, maintenance_freq, is_active)
         VALUES (?, ?, ?, 'PERMAQUIM', 'ALQUILADO', 30, 1)`,
        [
            'MUNI TIROLESA',
            company[0].id,
            'Av. Pres. Arturo Illia Sur 16, X5101 Col. Tirolesa',
        ]
    );
    console.log('MUNI TIROLESA creada, id', result.insertId);
}

async function report(conn) {
    const [rows] = await conn.query(
        `SELECT
            SUM(is_active = 1) AS active_count,
            SUM(is_active = 1 AND owner IS NOT NULL) AS with_owner,
            SUM(is_active = 1 AND commercial_action IS NOT NULL) AS with_action,
            SUM(is_active = 1 AND installed_on IS NOT NULL) AS with_date,
            SUM(is_active = 1 AND (serial_number IS NULL OR TRIM(serial_number) = '')) AS without_serial,
            SUM(is_active = 1 AND (address IS NULL OR TRIM(address) = '')) AS without_address
         FROM depositarios`
    );
    const [dups] = await conn.query(
        `SELECT COUNT(*) AS groups_count FROM (
            SELECT REPLACE(REPLACE(UPPER(TRIM(serial_number)), '-', ''), ' ', '') AS sn
            FROM depositarios
            WHERE is_active = 1 AND serial_number IS NOT NULL AND TRIM(serial_number) <> ''
            GROUP BY sn
            HAVING COUNT(*) > 1
         ) d`
    );
    console.log('Resumen activos:', rows[0]);
    console.log('Grupos de serie duplicada entre activos:', dups[0].groups_count);
}

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT, 10) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ticket_system',
    });
    try {
        await ensureColumns(conn);
        await cleanSerials(conn);
        await applyCommercialData(conn);
        await applyInstallDates(conn);
        await ensureTirolesa(conn);
        await report(conn);
        console.log('Migración de depositarios aplicada.');
    } finally {
        await conn.end();
    }
}

run().catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
});
