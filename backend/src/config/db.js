const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
host: process.env.DB_HOST,
user: process.env.DB_USER,
password: process.env.DB_PASSWORD,
database: process.env.DB_NAME,
port: process.env.DB_PORT,
waitForConnections: true,
connectionLimit: 10,
queueLimit: 0,

// Mantiene vivas las conexiones inactivas: evita que la red o MySQL
// las corte en silencio y la siguiente consulta falle con ETIMEDOUT.
enableKeepAlive: true,
keepAliveInitialDelay: 10000,
connectTimeout: 20000,

// ✅ --- CORRECCIÓN DE ZONA HORARIA ---
// 'Z' significa UTC. Cambiamos a '-03:00' (UTC-3)
// para que todas las funciones de SQL como NOW() o CURRENT_TIMESTAMP
// se inserten directamente con la hora de Argentina.
timezone: '-03:00' 
});

/**
 * Verifica la conexión al arrancar. Si MySQL no responde NO se termina el proceso:
 * el API sigue en pie y se reintenta, para no cortar las peticiones en curso.
 */
async function verifyConnection(attempt = 1) {
    const MAX_ATTEMPTS = 5;
    const RETRY_DELAY_MS = 10000;

    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Conectado a la base de datos MySQL!');

        // Verificamos la zona horaria de la sesión para confirmar
        const [rows] = await connection.query('SELECT @@session.time_zone AS tz;');
        console.log(`Zona horaria de la conexión MySQL establecida en: ${rows[0].tz}`);
    } catch (err) {
        console.error(`[DB] Fallo de conexión (intento ${attempt}/${MAX_ATTEMPTS}): ${err.code || err.message}`);
        if (attempt < MAX_ATTEMPTS) {
            setTimeout(() => verifyConnection(attempt + 1), RETRY_DELAY_MS);
        } else {
            console.error('[DB] MySQL sigue sin responder. El API queda en pie y reintentará en cada consulta. Revisá DB_HOST, la red y el servicio MySQL.');
        }
    } finally {
        if (connection) connection.release();
    }
}

verifyConnection();

module.exports = pool;

