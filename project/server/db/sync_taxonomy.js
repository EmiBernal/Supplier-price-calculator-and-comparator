const fs = require('fs');
const path = require('path');
const pool = require('../db');

const taxonomyPath = path.resolve(__dirname, 'taxonomy.json');
const tenantArg = (process.argv[2] || '').toLowerCase();
const tenantEnv = (process.env.TENANT || '').toLowerCase();
const tenant = ['compra', 'compras'].includes(tenantArg)
  ? 'compra'
  : ['compra', 'compras'].includes(tenantEnv)
    ? 'compra'
    : 'venta';
const schema = tenant === 'compra' ? 'compra' : 'venta';

async function withClient(fn) {
  const client = await pool.connect();
  try {
    await client.query(`SET search_path TO ${schema}, public`);
    return await fn(client);
  } finally {
    client.release();
  }
}

async function getOrCreateFamilia(client, nombre) {
  const result = await client.query(
    'SELECT id FROM familias WHERE LOWER(nombre) = LOWER($1)',
    [nombre]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const insert = await client.query(
    'INSERT INTO familias(nombre) VALUES ($1) RETURNING id',
    [nombre]
  );
  return insert.rows[0].id;
}

async function getOrCreateSubfamilia(client, nombre, familiaId) {
  const result = await client.query(
    'SELECT id FROM subfamilias WHERE LOWER(nombre) = LOWER($1) AND familia_id = $2',
    [nombre, familiaId]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const insert = await client.query(
    'INSERT INTO subfamilias(nombre, familia_id) VALUES ($1, $2) RETURNING id',
    [nombre, familiaId]
  );
  return insert.rows[0].id;
}

async function getOrCreateRubro(client, nombre, subfamiliaId) {
  const result = await client.query(
    'SELECT id FROM rubros WHERE LOWER(nombre) = LOWER($1)',
    [nombre]
  );
  if (result.rows.length > 0) return result.rows[0].id;

  const insert = await client.query(
    'INSERT INTO rubros(nombre, subfamilia_id) VALUES ($1, $2) RETURNING id',
    [nombre, subfamiliaId]
  );
  return insert.rows[0].id;
}

(async () => {
  try {
    const raw = fs.readFileSync(taxonomyPath, 'utf8');
    const taxonomy = JSON.parse(raw);

    await withClient(async (client) => {
      await client.query('BEGIN');
      try {
        for (const fam of Object.keys(taxonomy)) {
          const famId = await getOrCreateFamilia(client, fam);
          for (const sub of Object.keys(taxonomy[fam])) {
            const subId = await getOrCreateSubfamilia(client, sub, famId);
            for (const rubro of taxonomy[fam][sub]) {
              await getOrCreateRubro(client, rubro, subId);
            }
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    });

    console.log(`Taxonomía sincronizada ✔ (schema=${schema})`);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
