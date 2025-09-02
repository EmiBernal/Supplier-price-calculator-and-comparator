// server/middleware/tenant.js
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const DB_CACHE = new Map();

function normalizeTenant(v) {
  const s = String(v || '').toLowerCase().trim();
  if (['compra', 'compras'].includes(s)) return 'compra';
  if (['venta', 'ventas'].includes(s)) return 'venta';
  return null;
}

function getDbFor(tenant, cb) {
  const safe = tenant === 'compra' ? 'compra' : 'venta';
  if (DB_CACHE.has(safe)) return cb(null, DB_CACHE.get(safe));

  const dbDir = path.join(__dirname, '..', 'data'); // → server/data
  fs.mkdirSync(dbDir, { recursive: true });
  const filename = safe === 'venta' ? 'db_ventas.sqlite' : 'db_compras.sqlite';
  const dbPath = path.join(dbDir, filename);

  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) return cb(err);
    db.run('PRAGMA foreign_keys=ON');
    db.run('PRAGMA busy_timeout=5000');
    db.run('PRAGMA journal_mode=WAL', () => {
      DB_CACHE.set(safe, db);
      cb(null, db);
    });
  });
}

function tenantMiddleware(req, res, next) {
  // prioridad: header → cookie firmada/normal → body/query → default 'venta'
  const h = normalizeTenant(req.get('X-Role') || req.get('X-Tenant'));
  const c = normalizeTenant(
    (req.signedCookies && (req.signedCookies.tenant || req.signedCookies.role)) ||
    (req.cookies && (req.cookies.tenant || req.cookies.role))
  );
  const b = normalizeTenant(req.body?.role || req.query?.role);
  const tenant = h || c || b || 'venta';

  getDbFor(tenant, (err, db) => {
    if (err) return next(err);
    req.ctx = req.ctx || {};
    req.ctx.tenant = tenant;
    req.ctx.db = db;
    next();
  });
}

module.exports = { tenantMiddleware, normalizeTenant, getDbFor };
