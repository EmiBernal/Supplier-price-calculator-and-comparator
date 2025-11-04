const pool = require('../db');

const TARGET_SCHEMAS = ['venta', 'compra'];
const COLUMN_NAME = 'mes_actualizacion';
const CURRENT_MONTH_EXPR = "TO_CHAR(CURRENT_DATE, 'YYYY-MM')";

async function ensureMesActualizacionColumn() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const schema of TARGET_SCHEMAS) {
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
      const qualified = `${schema}.lista_precios`;
      await client.query(`ALTER TABLE IF EXISTS ${qualified} ADD COLUMN IF NOT EXISTS ${COLUMN_NAME} TEXT`);
      await client.query(`ALTER TABLE ${qualified} ALTER COLUMN ${COLUMN_NAME} SET DEFAULT ${CURRENT_MONTH_EXPR}`);
      await client.query(`UPDATE ${qualified}
                             SET ${COLUMN_NAME} = ${CURRENT_MONTH_EXPR}
                           WHERE ${COLUMN_NAME} IS NULL OR TRIM(${COLUMN_NAME}) = ''`);
      await client.query(`ALTER TABLE ${qualified} ALTER COLUMN ${COLUMN_NAME} SET NOT NULL`);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { ensureMesActualizacionColumn };
