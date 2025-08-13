// initDB.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error('Error al conectar con SQLite:', err.message);
  }
  console.log('Conectado a la base de datos SQLite en', dbPath);
});

const sql = `
PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

DROP TABLE IF EXISTS relacion_articulos;
DROP TABLE IF EXISTS articulos_no_relacionados;
DROP TABLE IF EXISTS articulos_gampack_no_relacionados;
DROP TABLE IF EXISTS lista_precios;
DROP TABLE IF EXISTS lista_interna;

-- Proveedores externos
CREATE TABLE lista_precios (
  id_externo   INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_externo  TEXT    NOT NULL,
  cod_externo  TEXT,                 -- puede ser NULL
  precio_final REAL    NOT NULL,
  tipo_empresa TEXT    NOT NULL,
  fecha        TEXT    NOT NULL,
  proveedor    TEXT    NOT NULL
);

-- Único parcial: evita duplicados cuando HAY código
CREATE UNIQUE INDEX IF NOT EXISTS ux_lp_cod_prov_not_null
  ON lista_precios(cod_externo, proveedor)
  WHERE cod_externo IS NOT NULL;

-- Búsquedas/updates por nombre+proveedor (case-insensitive en nombre)
CREATE INDEX IF NOT EXISTS ix_lp_nom_prov
  ON lista_precios(LOWER(nom_externo), proveedor);

-- Internos Gampack
CREATE TABLE lista_interna (
  id_interno   INTEGER PRIMARY KEY AUTOINCREMENT,
  nom_interno  TEXT    NOT NULL,
  cod_interno  TEXT,                 -- puede ser NULL
  precio_final REAL    NOT NULL,
  fecha        TEXT    NOT NULL
);

-- Único parcial: evita duplicados cuando HAY código
CREATE UNIQUE INDEX IF NOT EXISTS ux_li_cod_not_null
  ON lista_interna(cod_interno)
  WHERE cod_interno IS NOT NULL;

-- Búsquedas/updates por nombre (case-insensitive)
CREATE INDEX IF NOT EXISTS ix_li_nom
  ON lista_interna(LOWER(nom_interno));

-- Relación entre externos e internos
CREATE TABLE relacion_articulos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  id_lista_precios INTEGER NOT NULL,  -- proveedor
  id_lista_interna INTEGER NOT NULL,  -- gampack
  criterio_relacion TEXT NOT NULL,
  FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
  FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
  UNIQUE(id_lista_precios)
);

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

db.exec(sql, (err) => {
  if (err) {
    console.error('Error creando tablas:', err.message);
  } else {
    console.log('Tablas creadas correctamente.');
  }
  db.close();
});
