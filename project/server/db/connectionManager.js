// server/db/connectionManager.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DBS = {}; // cache por tenant

function openDB(filePath) {
  const db = new sqlite3.Database(filePath, (err) => {
    if (err) {
      console.error('❌ Error al abrir SQLite:', err.message, '->', filePath);
    } else {
      console.log('✅ SQLite abierto:', filePath);
    }
  });

  db.serialize(() => {
    db.run('PRAGMA journal_mode=WAL');
    db.run('PRAGMA foreign_keys=ON');
    db.run('PRAGMA busy_timeout=5000');
  });

  return db;
}

function getDb(tenant = 'ventas') {
  const key = tenant === 'compras' ? 'compras' : 'ventas';
  if (!DBS[key]) {
    const file = key === 'ventas'
      ? path.join(__dirname, '../data/db_ventas.sqlite')
      : path.join(__dirname, '../data/db_compras.sqlite');
    DBS[key] = openDB(file);
  }
  return DBS[key];
}

module.exports = { getDb };
