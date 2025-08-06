const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'database.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    return console.error('Error al conectar con SQLite:', err.message);
  }
  console.log('Conectado a la base de datos SQLite en', dbPath);
});

const initSql = `
DROP TABLE IF EXISTS relacion_articulos;
DROP TABLE IF EXISTS articulos_no_relacionados;
DROP TABLE IF EXISTS articulos_gampack_no_relacionados;
DROP TABLE IF EXISTS lista_precios;
DROP TABLE IF EXISTS lista_interna;

CREATE TABLE lista_precios (
    id_externo INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_externo TEXT NOT NULL,
    cod_externo TEXT NOT NULL,
    precio_final REAL NOT NULL,
    tipo_empresa TEXT NOT NULL,
    fecha TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    UNIQUE (cod_externo, proveedor)
);

CREATE TABLE lista_interna (
    id_interno INTEGER PRIMARY KEY AUTOINCREMENT,
    nom_interno TEXT NOT NULL,
    cod_interno TEXT NOT NULL,
    precio_final REAL NOT NULL,
    fecha TEXT NOT NULL,
    UNIQUE (cod_interno)
);

CREATE TABLE relacion_articulos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,  -- proveedor
    id_lista_interna INTEGER NOT NULL,  -- gampack
    criterio_relacion TEXT NOT NULL,
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
    UNIQUE(id_lista_precios)
);

CREATE TABLE articulos_no_relacionados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_precios INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (id_lista_precios) REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
    UNIQUE (id_lista_precios)
);

CREATE TABLE articulos_gampack_no_relacionados (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    id_lista_interna INTEGER NOT NULL,
    motivo TEXT,
    FOREIGN KEY (id_lista_interna) REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
    UNIQUE (id_lista_interna)
);
`;

db.exec(initSql, (err) => {
  if (err) {
    console.error('Error creando tablas:', err.message);
  } else {
    console.log('Tablas creadas correctamente');
  }
  db.close();
});
