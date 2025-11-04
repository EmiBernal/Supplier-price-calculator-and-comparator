BEGIN;

CREATE TABLE IF NOT EXISTS familias (
  id   BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subfamilias (
  id         BIGSERIAL PRIMARY KEY,
  nombre     TEXT NOT NULL,
  familia_id BIGINT NOT NULL REFERENCES familias(id) ON DELETE CASCADE,
  UNIQUE (nombre, familia_id)
);

CREATE TABLE IF NOT EXISTS rubros (
  id            BIGSERIAL PRIMARY KEY,
  nombre        TEXT NOT NULL UNIQUE,
  subfamilia_id BIGINT NOT NULL REFERENCES subfamilias(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS producto_rubro (
  id_interno BIGINT NOT NULL REFERENCES productos_gampack(id_interno) ON DELETE CASCADE,
  id_rubro   BIGINT NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  PRIMARY KEY (id_interno)
);

CREATE TABLE IF NOT EXISTS producto_externo_rubro (
  id_externo BIGINT NOT NULL REFERENCES lista_precios(id_externo) ON DELETE CASCADE,
  id_rubro   BIGINT NOT NULL REFERENCES rubros(id) ON DELETE CASCADE,
  PRIMARY KEY (id_externo)
);

CREATE INDEX IF NOT EXISTS ix_rubros_nombre ON rubros(LOWER(nombre));
CREATE INDEX IF NOT EXISTS ix_pr_rubro ON producto_rubro(id_rubro);

COMMIT;
