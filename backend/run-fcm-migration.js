require('dotenv').config();
const mysql = require('mysql2/promise');

async function run() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });
    try {
        await conn.execute('ALTER TABLE users ADD COLUMN fcm_token VARCHAR(256) NULL');
        console.log('Columna fcm_token agregada.');
    } catch (e) {
        if (e.code === 'ER_DUP_FIELD' || e.code === 'ER_DUP_FIELDNAME') console.log('fcm_token ya existe.');
        else throw e;
    }
    await conn.end();
}
run().catch(e => { console.error(e); process.exit(1); });
