/**
 * Script para activar y/o resetear la contraseña del usuario admin.
 * Uso: node scripts/reset-admin-password.js [email] [nueva_contraseña]
 * Ejemplo: node scripts/reset-admin-password.js admin@ejemplo.com admin123
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

async function main() {
    const [email, newPassword] = process.argv.slice(2);
    
    if (!email) {
        console.log('Uso: node scripts/reset-admin-password.js <email> [nueva_contraseña]');
        console.log('Ejemplo: node scripts/reset-admin-password.js admin@bacarsa.com.ar Admin123!');
        process.exit(1);
    }

    const password = newPassword || 'admin123';

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
            [email]
        );

        if (rows.length === 0) {
            console.log('❌ No se encontró usuario con email:', email);
            console.log('\nUsuarios admin en la base de datos:');
            const [admins] = await conn.execute(
                "SELECT id, username, email, is_active FROM users WHERE role = 'admin'"
            );
            admins.forEach(u => console.log(`  - ${u.email} (${u.username}) is_active=${u.is_active}`));
            process.exit(1);
        }

        const user = rows[0];
        const hashedPassword = await bcrypt.hash(password, 10);

        await conn.execute(
            'UPDATE users SET password = ?, is_active = 1 WHERE id = ?',
            [hashedPassword, user.id]
        );

        console.log('✅ Usuario actualizado correctamente:');
        console.log('   Email:', user.email);
        console.log('   Username:', user.username);
        console.log('   Rol:', user.role);
        console.log('   is_active: 1 (activado)');
        console.log('   Contraseña: ' + password);
        console.log('\nYa podés iniciar sesión con este usuario.');
    } finally {
        await conn.end();
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
