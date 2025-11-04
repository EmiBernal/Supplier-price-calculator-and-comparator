-- Migración para renombrar lista_interna -> productos_gampack y habilitar relaciones 1:N
BEGIN;

-- ===== Esquema venta =====
-- Renombrar tabla principal de productos
ALTER TABLE IF EXISTS venta.lista_interna RENAME TO productos_gampack;
-- Renombrar índices asociados al catálogo interno
ALTER INDEX IF EXISTS venta.ux_li_cod_not_null RENAME TO ux_pg_cod_not_null;
ALTER INDEX IF EXISTS venta.ix_li_nom RENAME TO ix_pg_nom;

-- Actualizar tabla de relaciones para permitir múltiples externos por producto interno
ALTER TABLE IF EXISTS venta.relacion_articulos
  DROP CONSTRAINT IF EXISTS fk_rel_li,
  DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_precios_key,
  DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_interna_key;
ALTER TABLE IF EXISTS venta.relacion_articulos
  RENAME COLUMN id_lista_interna TO id_productos_gampack;
ALTER TABLE IF EXISTS venta.relacion_articulos
  DROP CONSTRAINT IF EXISTS fk_rel_pg,
  DROP CONSTRAINT IF EXISTS uq_relacion_articulos_pair;
ALTER TABLE IF EXISTS venta.relacion_articulos
  ADD CONSTRAINT fk_rel_pg FOREIGN KEY (id_productos_gampack) REFERENCES venta.productos_gampack (id_interno) ON DELETE CASCADE,
  ADD CONSTRAINT uq_relacion_articulos_pair UNIQUE (id_lista_precios, id_productos_gampack);

-- Renombrar columna auxiliar para artículos internos sin relación
ALTER TABLE IF EXISTS venta.articulos_gampack_no_relacionados
  DROP CONSTRAINT IF EXISTS fk_agnr_li,
  DROP CONSTRAINT IF EXISTS articulos_gampack_no_relacionados_id_lista_interna_key;
ALTER TABLE IF EXISTS venta.articulos_gampack_no_relacionados
  RENAME COLUMN id_lista_interna TO id_productos_gampack;
ALTER TABLE IF EXISTS venta.articulos_gampack_no_relacionados
  DROP CONSTRAINT IF EXISTS fk_agnr_pg,
  DROP CONSTRAINT IF EXISTS articulos_gampack_no_relacionados_id_productos_gampack_key;
ALTER TABLE IF EXISTS venta.articulos_gampack_no_relacionados
  ADD CONSTRAINT fk_agnr_pg FOREIGN KEY (id_productos_gampack) REFERENCES venta.productos_gampack (id_interno) ON DELETE CASCADE,
  ADD CONSTRAINT articulos_gampack_no_relacionados_id_productos_gampack_key UNIQUE (id_productos_gampack);

-- ===== Esquema compra =====
ALTER TABLE IF EXISTS compra.lista_interna RENAME TO productos_gampack;
ALTER INDEX IF EXISTS compra.ux_li_cod_not_null RENAME TO ux_pg_cod_not_null;
ALTER INDEX IF EXISTS compra.ix_li_nom RENAME TO ix_pg_nom;

ALTER TABLE IF EXISTS compra.relacion_articulos
  DROP CONSTRAINT IF EXISTS fk_rel_li,
  DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_precios_key,
  DROP CONSTRAINT IF EXISTS relacion_articulos_id_lista_interna_key;
ALTER TABLE IF EXISTS compra.relacion_articulos
  RENAME COLUMN id_lista_interna TO id_productos_gampack;
ALTER TABLE IF EXISTS compra.relacion_articulos
  DROP CONSTRAINT IF EXISTS fk_rel_pg,
  DROP CONSTRAINT IF EXISTS uq_relacion_articulos_pair;
ALTER TABLE IF EXISTS compra.relacion_articulos
  ADD CONSTRAINT fk_rel_pg FOREIGN KEY (id_productos_gampack) REFERENCES compra.productos_gampack (id_interno) ON DELETE CASCADE,
  ADD CONSTRAINT uq_relacion_articulos_pair UNIQUE (id_lista_precios, id_productos_gampack);

ALTER TABLE IF EXISTS compra.articulos_gampack_no_relacionados
  DROP CONSTRAINT IF EXISTS fk_agnr_li,
  DROP CONSTRAINT IF EXISTS articulos_gampack_no_relacionados_id_lista_interna_key;
ALTER TABLE IF EXISTS compra.articulos_gampack_no_relacionados
  RENAME COLUMN id_lista_interna TO id_productos_gampack;
ALTER TABLE IF EXISTS compra.articulos_gampack_no_relacionados
  DROP CONSTRAINT IF EXISTS fk_agnr_pg,
  DROP CONSTRAINT IF EXISTS articulos_gampack_no_relacionados_id_productos_gampack_key;
ALTER TABLE IF EXISTS compra.articulos_gampack_no_relacionados
  ADD CONSTRAINT fk_agnr_pg FOREIGN KEY (id_productos_gampack) REFERENCES compra.productos_gampack (id_interno) ON DELETE CASCADE,
  ADD CONSTRAINT articulos_gampack_no_relacionados_id_productos_gampack_key UNIQUE (id_productos_gampack);

COMMIT;

-- Ejemplo: listar productos Gampack junto con proveedores relacionados
-- SELECT pg.id_interno,
--        pg.cod_interno,
--        pg.nom_interno,
--        ra.id_lista_precios,
--        lp.proveedor,
--        lp.nom_externo,
--        lp.precio_final
--   FROM venta.productos_gampack pg
--   LEFT JOIN venta.relacion_articulos ra ON ra.id_productos_gampack = pg.id_interno
--   LEFT JOIN venta.lista_precios lp ON lp.id_externo = ra.id_lista_precios
--  ORDER BY pg.nom_interno;
