// server/db/connectionManager.js
const pool = require('../db');

const SCHEMA_BY_TENANT = {
  compras: 'compra',
  compra: 'compra',
  ventas: 'venta',
  venta: 'venta'
};

async function getClientForTenant(tenant = 'venta') {
  const schema = SCHEMA_BY_TENANT[tenant] || 'venta';
  const client = await pool.connect();
  try {
    const searchPath = schema === 'compra' ? 'compra' : 'venta';
    await client.query(`SET search_path TO ${searchPath}, public`);
    return client;
  } catch (err) {
    client.release();
    throw err;
  }
}

async function queryForTenant(tenant, sql, params = []) {
  const client = await getClientForTenant(tenant);
  try {
    const result = await client.query(sql, params);
    return result;
  } finally {
    client.release();
  }
}

module.exports = { getClientForTenant, queryForTenant };
