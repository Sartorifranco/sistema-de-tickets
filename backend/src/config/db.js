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
    
    // ✅ --- LÍNEA CLAVE AÑADIDA ---
    // Esto asegura que todas las fechas y horas leídas y escritas en la base de datos
    // se manejen en formato UTC ('Z' significa Zulu time, que es UTC).
    // Es la solución más robusta para problemas de zona horaria.
    timezone: 'Z' 
});

pool.getConnection()
  .then(connection => {
    console.log('Conectado a la base de datos MySQL!');
    connection.release();
  })
  .catch(err => {
    console.error('Error al conectar con la base de datos:', err);
    process.exit(1);
  });

module.exports = pool;