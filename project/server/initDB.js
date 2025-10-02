const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function loadSchema() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅ Esquema aplicado correctamente.');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌ Error aplicando esquema:', err.message);
    throw err;
  } finally {
    client.release();
  }
}

loadSchema()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
