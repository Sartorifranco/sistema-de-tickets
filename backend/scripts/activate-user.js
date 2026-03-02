/**
 * Activa un usuario (is_active = 1) sin cambiar la contraseña.
 * Uso: node scripts/activate-user.js <email>
 * Ejemplo: node scripts/activate-user.js hardware.ti@bacarsa.com.ar
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

async function main() {
    const [email] = process.argv.slice(2);
    if (!email) {
        console.log('Uso: node scripts/activate-user.js <email>');
        console.log('Ejemplo: node scripts/activate-user.js hardware.ti@bacarsa.com.ar');
        process.exit(1);
    }

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: process.env.DB_PORT || 3306
    });

    try {
        const [rows] = await conn.execute(
            'SELECT id, username, email, role, is_active FROM users WHERE email = ?',
            [email.trim().toLowerCase()]
        );

        if (rows.length === 0) {
            console.log('❌ No se encontró usuario con email:', email);
            process.exit(1);
        }

        const user = rows[0];

        if (user.is_active) {
            console.log('✅ El usuario ya está activo:', user.email);
            process.exit(0);
        }

        await conn.execute('UPDATE users SET is_active = 1 WHERE id = ?', [user.id]);

        console.log('✅ Usuario activado correctamente:');
        console.log('   Email:', user.email);
        console.log('   Username:', user.username);
        console.log('   Rol:', user.role);
        console.log('\nYa puede iniciar sesión.');
    } finally {
        await conn.end();
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
