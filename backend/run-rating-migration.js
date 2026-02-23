/**
 * Ejecuta la migración para agregar columnas de rating a users.
 * Uso: node run-rating-migration.js
 */
require('dotenv').config();
const pool = require('./src/config/db');

async function run() {
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN rating_sum INT DEFAULT 0');
    console.log('✓ Columna rating_sum agregada.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ rating_sum ya existe, omitiendo.');
    } else throw err;
  }
  try {
    await pool.execute('ALTER TABLE users ADD COLUMN rating_count INT DEFAULT 0');
    console.log('✓ Columna rating_count agregada.');
  } catch (err) {
    if (err.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠ rating_count ya existe, omitiendo.');
    } else throw err;
  }
  console.log('Migración completada.');
  await pool.end();
  process.exit(0);
}

run().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
