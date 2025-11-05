CREATE SCHEMA IF NOT EXISTS venta;
CREATE SCHEMA IF NOT EXISTS compra;

CREATE TABLE IF NOT EXISTS public.users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('compra', 'venta'))
);

INSERT INTO public.users (username, password, role) VALUES
  ('compra', '1234', 'compra'),
  ('venta', '1234', 'venta')
ON CONFLICT (username) DO NOTHING;

SET search_path TO venta, public;

DO $$
DECLARE
  schema_name TEXT;
BEGIN
  FOR schema_name IN SELECT unnest(ARRAY['venta', 'compra']) LOOP
    EXECUTE format('ALTER TABLE IF EXISTS %I.relacion_articulos DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_interna_key', schema_name);
    EXECUTE format('ALTER TABLE IF EXISTS %I.relacion_articulos DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_interna_idx', schema_name);
    EXECUTE format('DROP INDEX IF EXISTS %I.relacion_articulos_id_lista_interna_idx', schema_name);
    EXECUTE format('DROP INDEX IF EXISTS %I.relacion_articulos_id_lista_interna_key', schema_name);
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS lista_precios (
  id_externo BIGSERIAL PRIMARY KEY,
  nom_externo TEXT NOT NULL,
  cod_externo TEXT,
  precio_final NUMERIC(18, 4) NOT NULL,
  tipo_empresa TEXT NOT NULL,
  fecha DATE NOT NULL,
  proveedor TEXT NOT NULL,
  mes_actualizacion TEXT,
  familia TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lp_cod_prov_not_null
  ON lista_precios (cod_externo, proveedor)
  WHERE cod_externo IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lp_nom_prov
  ON lista_precios (LOWER(nom_externo), proveedor);

CREATE TABLE IF NOT EXISTS lista_interna (
  id_interno BIGSERIAL PRIMARY KEY,
  nom_interno TEXT NOT NULL,
  cod_interno TEXT,
  precio_final NUMERIC(18, 4) NOT NULL,
  fecha DATE NOT NULL,
  mes_actualizacion TEXT,
  familia TEXT
);

ALTER TABLE lista_precios
  ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT;
ALTER TABLE lista_interna
  ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT;

UPDATE lista_precios
   SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
 WHERE mes_actualizacion IS NULL;
UPDATE lista_interna
   SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
 WHERE mes_actualizacion IS NULL;

ALTER TABLE lista_precios
  ALTER COLUMN mes_actualizacion SET NOT NULL,
  ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM');
ALTER TABLE lista_interna
  ALTER COLUMN mes_actualizacion SET NOT NULL,
  ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS ux_li_cod_not_null
  ON lista_interna (cod_interno)
  WHERE cod_interno IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_li_nom
  ON lista_interna (LOWER(nom_interno));

CREATE TABLE IF NOT EXISTS relacion_articulos (
  id BIGSERIAL PRIMARY KEY,
  id_lista_precios BIGINT NOT NULL,
  id_lista_interna BIGINT NOT NULL,
  criterio_relacion TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rel_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  CONSTRAINT fk_rel_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  UNIQUE (id_lista_precios)
);
CREATE INDEX IF NOT EXISTS ix_rel_created_at ON relacion_articulos (created_at);
CREATE INDEX IF NOT EXISTS ix_rel_id_lista_interna ON relacion_articulos (id_lista_interna);

CREATE TABLE IF NOT EXISTS articulos_no_relacionados (
  id BIGSERIAL PRIMARY KEY,
  id_lista_precios BIGINT NOT NULL,
  motivo TEXT,
  CONSTRAINT fk_anr_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  UNIQUE (id_lista_precios)
);

CREATE TABLE IF NOT EXISTS articulos_gampack_no_relacionados (
  id BIGSERIAL PRIMARY KEY,
  id_lista_interna BIGINT NOT NULL,
  motivo TEXT,
  CONSTRAINT fk_agnr_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  UNIQUE (id_lista_interna)
);

CREATE TABLE IF NOT EXISTS imports_log (
  id BIGSERIAL PRIMARY KEY,
  source_filename TEXT,
  imported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS column_mappings (
  id BIGSERIAL PRIMARY KEY,
  proveedor TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (proveedor)
);

CREATE TABLE IF NOT EXISTS familias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subfamilias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  familia_id BIGINT NOT NULL REFERENCES familias (id) ON DELETE CASCADE,
  UNIQUE (nombre, familia_id)
);

CREATE TABLE IF NOT EXISTS rubros (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  subfamilia_id BIGINT NOT NULL REFERENCES subfamilias (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS producto_rubro (
  id_interno BIGINT NOT NULL REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
  PRIMARY KEY (id_interno)
);

CREATE TABLE IF NOT EXISTS producto_externo_rubro (
  id_externo BIGINT NOT NULL REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
  PRIMARY KEY (id_externo)
);

CREATE INDEX IF NOT EXISTS ix_rubros_nombre ON rubros (LOWER(nombre));
CREATE INDEX IF NOT EXISTS ix_producto_rubro_rubro ON producto_rubro (id_rubro);

SET search_path TO compra, public;

CREATE TABLE IF NOT EXISTS lista_precios (
  id_externo BIGSERIAL PRIMARY KEY,
  nom_externo TEXT NOT NULL,
  cod_externo TEXT,
  precio_final NUMERIC(18, 4) NOT NULL,
  tipo_empresa TEXT NOT NULL,
  fecha DATE NOT NULL,
  proveedor TEXT NOT NULL,
  mes_actualizacion TEXT,
  familia TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_lp_cod_prov_not_null
  ON lista_precios (cod_externo, proveedor)
  WHERE cod_externo IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_lp_nom_prov
  ON lista_precios (LOWER(nom_externo), proveedor);

CREATE TABLE IF NOT EXISTS lista_interna (
  id_interno BIGSERIAL PRIMARY KEY,
  nom_interno TEXT NOT NULL,
  cod_interno TEXT,
  precio_final NUMERIC(18, 4) NOT NULL,
  fecha DATE NOT NULL,
  mes_actualizacion TEXT,
  familia TEXT
);

ALTER TABLE lista_precios
  ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT;
ALTER TABLE lista_interna
  ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT;

UPDATE lista_precios
   SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
 WHERE mes_actualizacion IS NULL;
UPDATE lista_interna
   SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
 WHERE mes_actualizacion IS NULL;

ALTER TABLE lista_precios
  ALTER COLUMN mes_actualizacion SET NOT NULL,
  ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM');
ALTER TABLE lista_interna
  ALTER COLUMN mes_actualizacion SET NOT NULL,
  ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM');

CREATE UNIQUE INDEX IF NOT EXISTS ux_li_cod_not_null
  ON lista_interna (cod_interno)
  WHERE cod_interno IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_li_nom
  ON lista_interna (LOWER(nom_interno));

CREATE TABLE IF NOT EXISTS relacion_articulos (
  id BIGSERIAL PRIMARY KEY,
  id_lista_precios BIGINT NOT NULL,
  id_lista_interna BIGINT NOT NULL,
  criterio_relacion TEXT NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rel_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  CONSTRAINT fk_rel_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  UNIQUE (id_lista_precios)
);
CREATE INDEX IF NOT EXISTS ix_rel_created_at ON relacion_articulos (created_at);
CREATE INDEX IF NOT EXISTS ix_rel_id_lista_interna ON relacion_articulos (id_lista_interna);

CREATE TABLE IF NOT EXISTS articulos_no_relacionados (
  id BIGSERIAL PRIMARY KEY,
  id_lista_precios BIGINT NOT NULL,
  motivo TEXT,
  CONSTRAINT fk_anr_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  UNIQUE (id_lista_precios)
);

CREATE TABLE IF NOT EXISTS articulos_gampack_no_relacionados (
  id BIGSERIAL PRIMARY KEY,
  id_lista_interna BIGINT NOT NULL,
  motivo TEXT,
  CONSTRAINT fk_agnr_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  UNIQUE (id_lista_interna)
);

CREATE TABLE IF NOT EXISTS imports_log (
  id BIGSERIAL PRIMARY KEY,
  source_filename TEXT,
  imported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS column_mappings (
  id BIGSERIAL PRIMARY KEY,
  proveedor TEXT NOT NULL,
  mapping_json TEXT NOT NULL,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (proveedor)
);

CREATE TABLE IF NOT EXISTS familias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS subfamilias (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  familia_id BIGINT NOT NULL REFERENCES familias (id) ON DELETE CASCADE,
  UNIQUE (nombre, familia_id)
);

CREATE TABLE IF NOT EXISTS rubros (
  id BIGSERIAL PRIMARY KEY,
  nombre TEXT NOT NULL UNIQUE,
  subfamilia_id BIGINT NOT NULL REFERENCES subfamilias (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS producto_rubro (
  id_interno BIGINT NOT NULL REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
  id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
  PRIMARY KEY (id_interno)
);

CREATE TABLE IF NOT EXISTS producto_externo_rubro (
  id_externo BIGINT NOT NULL REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
  id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
  PRIMARY KEY (id_externo)
);

CREATE INDEX IF NOT EXISTS ix_rubros_nombre ON rubros (LOWER(nombre));
CREATE INDEX IF NOT EXISTS ix_producto_rubro_rubro ON producto_rubro (id_rubro);
