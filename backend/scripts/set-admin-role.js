/**
 * Script para asignar rol admin a un usuario por email.
 * Uso: node scripts/set-admin-role.js <email>
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
    const email = process.argv[2] || 'sistemas.ti@bacarsa.com.ar';

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const [rows] = await conn.execute('SELECT id, username, email, role FROM users WHERE email = ?', [email]);
        if (rows.length === 0) {
            console.log('❌ Usuario no encontrado:', email);
            process.exit(1);
        }
        await conn.execute("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
        console.log('✅ Rol actualizado a admin:', email, '(' + rows[0].username + ')');
    } finally {
        await conn.end();
    }
}

main().catch(err => { console.error(err.message); process.exit(1); });
