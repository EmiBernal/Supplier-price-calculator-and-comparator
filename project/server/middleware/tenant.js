// server/middleware/tenant.js
const pool = require('../db');
const { prepareSql } = require('../utils/sql');

function normalizeTenant(v) {
  const s = String(v || '').toLowerCase().trim();
  if (['compra', 'compras'].includes(s)) return 'compra';
  if (['venta', 'ventas'].includes(s)) return 'venta';
  return null;
}

const SCHEMA_BY_TENANT = {
  compra: 'compra',
  venta: 'venta'
};

async function tenantMiddleware(req, res, next) {
  const h = normalizeTenant(req.get('X-Role'));
  const c = normalizeTenant(req.signedCookies?.tenant);
  const tenant = h || c || 'venta';
  const schema = SCHEMA_BY_TENANT[tenant] || 'venta';
  const searchPath = schema === 'compra' ? 'compra' : 'venta';

  let client;
  let adapter;
  let released = false;

  const release = () => {
    if (released) return;
    released = true;
    if (adapter) {
      adapter.release();
    } else if (client) {
      client.release();
    }
  };

  try {
    client = await pool.connect();
    await client.query(`SET search_path TO ${searchPath}, public`);

    req.ctx = req.ctx || {};
    req.ctx.tenant = tenant;
    req.ctx.schema = searchPath;
    adapter = createDbAdapter(client);
    req.ctx.db = adapter;

    res.on('finish', release);
    res.on('close', release);
    res.on('error', release);

    next();
  } catch (err) {
    release();
    next(err);
  }
}

module.exports = { tenantMiddleware, normalizeTenant };
function createDbAdapter(client) {
  const query = (sql, params = []) => client.query(prepareSql(sql), params);

  const normalizeArgs = (params, callback) => {
    if (typeof params === 'function') {
      return { values: [], callback: params };
    }
    return {
      values: Array.isArray(params) ? params : [],
      callback: typeof callback === 'function' ? callback : null
    };
  };

  const buildContext = (result) => {
    const firstRow = result?.rows?.[0] || {};
    const idCandidate = firstRow.id ?? firstRow.id_externo ?? firstRow.id_interno ?? firstRow.id_relacion ?? null;
    return {
      lastID: idCandidate,
      changes: result?.rowCount ?? 0
    };
  };

  const run = (sql, params, callback) => {
    const { values, callback: cb } = normalizeArgs(params, callback);
    const text = String(sql || '').trim();
    const isInsert = /^insert/i.test(text);
    const promise = query(sql, values).then(async (result) => {
      let context = buildContext(result);
      if (isInsert && context.lastID == null && (result?.rowCount ?? 0) > 0) {
        const lastVal = await client.query('SELECT LASTVAL() AS id');
        context = {
          ...context,
          lastID: lastVal.rows[0]?.id ?? null
        };
      }
      if (cb) cb.call(context, null);
      return context;
    }).catch((err) => {
      if (cb) cb(err);
      throw err;
    });
    return promise;
  };

  const get = (sql, params, callback) => {
    const { values, callback: cb } = normalizeArgs(params, callback);
    const promise = query(sql, values).then((result) => {
      const row = result.rows[0] || null;
      if (cb) cb(null, row);
      return row;
    }).catch((err) => {
      if (cb) cb(err);
      throw err;
    });
    return promise;
  };

  const all = (sql, params, callback) => {
    const { values, callback: cb } = normalizeArgs(params, callback);
    const promise = query(sql, values).then((result) => {
      const rows = result.rows;
      if (cb) cb(null, rows);
      return rows;
    }).catch((err) => {
      if (cb) cb(err);
      throw err;
    });
    return promise;
  };

  const release = () => client.release();

  return {
    query,
    run,
    get,
    all,
    serialize: (fn) => { if (typeof fn === 'function') fn(); },
    release
  };
}

