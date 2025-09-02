PRAGMA foreign_keys=ON;
BEGIN TRANSACTION;

-- Familias (nivel 1)
CREATE TABLE IF NOT EXISTS familias (
  id     INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

-- Subfamilias (nivel 2)
CREATE TABLE IF NOT EXISTS subfamilias (
  id         INTEGER PRIMARY KEY,
  nombre     TEXT NOT NULL,
  familia_id INTEGER NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  UNIQUE(nombre, familia_id)
);

-- Rubros (nivel 3) - nombre del rubro tal cual en tu Excel
CREATE TABLE IF NOT EXISTS rubros (
  id             INTEGER PRIMARY KEY,
  nombre         TEXT NOT NULL UNIQUE,
  subfamilia_id  INTEGER NOT NULL REFERENCES subfamilias(id) ON DELETE CASCADE
);

-- Relación producto interno → rubro (un producto pertenece a 1 rubro)
CREATE TABLE IF NOT EXISTS producto_rubro (
  id_interno INTEGER NOT NULL REFERENCES lista_interna(id_interno) ON DELETE CASCADE,
  id_rubro   INTEGER NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  PRIMARY KEY (id_interno)
);

-- (Opcional) Clasificar también productos externos si te sirve
CREATE TABLE IF NOT EXISTS producto_externo_rubro (
  id_externo INTEGER NOT NULL REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
  id_rubro   INTEGER NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  PRIMARY KEY (id_externo)
);

-- Índices útiles
CREATE INDEX IF NOT EXISTS ix_rubros_nombre ON rubros(LOWER(nombre));
CREATE INDEX IF NOT EXISTS ix_pr_rubro      ON producto_rubro(id_rubro);

COMMIT;
