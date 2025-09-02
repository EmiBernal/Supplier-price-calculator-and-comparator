// server/data/initDB.js
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// (por seguridad) asegurá que exista esta carpeta
fs.mkdirSync(__dirname, { recursive: true });

const SCHEMA_SQL = `
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS relacion_articulos;
DROP TABLE IF EXISTS articulos_no_relacionados;
DROP TABLE IF EXISTS articulos_gampack_no_relacionados;
DROP TABLE IF EXISTS lista_precios;
DROP TABLE IF EXISTS lista_interna;
DROP TABLE IF EXISTS imports_log;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS column_mappings;

-- Proveedores externos
CREATE TABLE lista_precios (
  id_externo   INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_externo  TEXT    NOT NULL,
  cod_externo  TEXT,
  precio_final REAL    NOT NULL,
  tipo_empresa TEXT    NOT NULL,
  fecha        TEXT    NOT NULL,      -- YYYY-MM-DD
  proveedor    TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_lp_cod_prov_not_null
  ON lista_precios(cod_externo, proveedor)
  WHERE cod_externo IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lp_nom_prov
  ON lista_precios(LOWER(nom_externo), proveedor);

-- Internos Gampack
CREATE TABLE lista_interna (
  id_interno   INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_interno  TEXT    NOT NULL,
  cod_interno  TEXT,
  precio_final REAL    NOT NULL,
  fecha        TEXT    NOT NULL       -- YYYY-MM-DD
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_li_cod_not_null
  ON lista_interna(cod_interno)
  WHERE cod_interno IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_li_nom
  ON lista_interna(LOWER(nom_interno));

-- Relación entre externos e internos
CREATE TABLE relacion_articulos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lista_precios INTEGER NOT NULL,  -- proveedor
  id_lista_interna INTEGER NOT NULL,  -- gampack
  criterio_relacion TEXT NOT NULL,    -- 'manual' | 'automatic' | 'name' | 'codigo' etc.
  created_at TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
  FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
  UNIQUE(id_lista_precios)
);
CREATE INDEX IF NOT EXISTS ix_rel_created_at ON relacion_articulos(created_at);

-- No relacionados (externos)
CREATE TABLE articulos_no_relacionados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lista_precios INTEGER NOT NULL,
  motivo TEXT,
  FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
  UNIQUE (id_lista_precios)
);

-- No relacionados (internos)
CREATE TABLE articulos_gampack_no_relacionados (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lista_interna INTEGER NOT NULL,
  motivo TEXT,
  FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
  UNIQUE (id_lista_interna)
);

-- Log de importaciones
CREATE TABLE IF NOT EXISTS imports_log (
  id INTEGER PRIMARY KEY,
  source_filename TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Usuarios (uno por base para que /api/login funcione en ambas)
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,  
  role TEXT NOT NULL CHECK(role IN ('compra','venta'))
);

INSERT INTO users (username, password, role)
VALUES 
  ('compra', '1234', 'compra'),
  ('venta', '1234', 'venta');

-- Plantillas de mapeo por proveedor
CREATE TABLE IF NOT EXISTS column_mappings (
  id INTEGER PRIMARY KEY,
  proveedor TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(proveedor)
);

COMMIT;
PRAGMA foreign_keys=ON;
`;

function initOne(filename) {
  return new Promise((resolve, reject) => {
    const dbFile = path.join(__dirname, filename);
    const db = new sqlite3.Database(dbFile, (err) => {
      if (err) return reject(err);
      console.log('✅ Abierta:', dbFile);
    });

    db.serialize(() => {
      // PRAGMAs recomendados para tu app
      db.run('PRAGMA journal_mode=WAL');
      db.run('PRAGMA busy_timeout=5000');

      db.exec(SCHEMA_SQL, (err) => {
        if (err) {
          console.error('❌ Error creando esquema en', filename, err.message);
          db.close();
          return reject(err);
        }
        console.log('🧱 Esquema creado en', filename);
        db.close((e) => {
          if (e) return reject(e);
          console.log('🔒 Cerrada:', filename);
          resolve();
        });
      });
    });
  });
}

(async () => {
  try {
    await initOne('db_ventas.sqlite');
    await initOne('db_compras.sqlite');
    console.log('🎉 Listo: bases creadas en server/data/');
  } catch (e) {
    console.error('Error en inicialización:', e);
    process.exit(1);
  }
})();
