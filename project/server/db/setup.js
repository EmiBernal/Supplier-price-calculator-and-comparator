const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('Error: DATABASE_URL no está definida en las variables de entorno.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' || process.env.PGSSLMODE === 'disable'
    ? false
    : { rejectUnauthorized: false }
});

const defaultUsers = [
  { username: 'compra', password: '1234', role: 'compra' },
  { username: 'venta', password: '1234', role: 'venta' }
];

const sharedTableDefinitions = [
  {
    description: 'Creando tabla de productos externos enviados por proveedores',
    sql: `CREATE TABLE IF NOT EXISTS lista_precios (
      id_externo BIGSERIAL PRIMARY KEY,
      nom_externo TEXT NOT NULL,
      cod_externo TEXT,
      precio_final NUMERIC(18, 4) NOT NULL,
      tipo_empresa TEXT NOT NULL,
      fecha DATE NOT NULL,
      proveedor TEXT NOT NULL,
      mes_actualizacion TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
      familia TEXT
    )`
  },
  {
    description: 'Asegurando columna de seguimiento de actualización para productos externos',
    sql: `ALTER TABLE lista_precios
          ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT`
  },
  {
    description: 'Actualizando valores nulos en la fecha de actualización externa',
    sql: `UPDATE lista_precios
          SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
          WHERE mes_actualizacion IS NULL`
  },
  {
    description: 'Definiendo restricción NOT NULL y default para mes_actualizacion externa',
    sql: `ALTER TABLE lista_precios
          ALTER COLUMN mes_actualizacion SET NOT NULL,
          ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM')`
  },
  {
    description: 'Creando índice único para evitar códigos externos duplicados por proveedor',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_lp_cod_prov_not_null
          ON lista_precios (cod_externo, proveedor)
          WHERE cod_externo IS NOT NULL`
  },
  {
    description: 'Creando índice para búsquedas rápidas por nombre de producto externo',
    sql: `CREATE INDEX IF NOT EXISTS ix_lp_nom_prov
          ON lista_precios (LOWER(nom_externo), proveedor)`
  },
  {
    description: 'Creando tabla de productos internos de Gampack',
    sql: `CREATE TABLE IF NOT EXISTS lista_interna (
      id_interno BIGSERIAL PRIMARY KEY,
      nom_interno TEXT NOT NULL,
      cod_interno TEXT,
      precio_final NUMERIC(18, 4) NOT NULL,
      fecha DATE NOT NULL,
      mes_actualizacion TEXT NOT NULL DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
      familia TEXT
    )`
  },
  {
    description: 'Asegurando columna de seguimiento de actualización para productos internos',
    sql: `ALTER TABLE lista_interna
          ADD COLUMN IF NOT EXISTS mes_actualizacion TEXT`
  },
  {
    description: 'Actualizando valores nulos en la fecha de actualización interna',
    sql: `UPDATE lista_interna
          SET mes_actualizacion = TO_CHAR(fecha, 'YYYY-MM')
          WHERE mes_actualizacion IS NULL`
  },
  {
    description: 'Definiendo restricción NOT NULL y default para mes_actualizacion interna',
    sql: `ALTER TABLE lista_interna
          ALTER COLUMN mes_actualizacion SET NOT NULL,
          ALTER COLUMN mes_actualizacion SET DEFAULT TO_CHAR(CURRENT_DATE, 'YYYY-MM')`
  },
  {
    description: 'Creando índice único para códigos internos normalizados',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS ux_li_cod_not_null
          ON lista_interna (cod_interno)
          WHERE cod_interno IS NOT NULL`
  },
  {
    description: 'Creando índice para búsquedas por nombre de producto interno',
    sql: `CREATE INDEX IF NOT EXISTS ix_li_nom
          ON lista_interna (LOWER(nom_interno))`
  },
  {
    description: 'Creando tabla que almacena relaciones confirmadas entre productos externos e internos',
    sql: `CREATE TABLE IF NOT EXISTS relacion_articulos (
      id BIGSERIAL PRIMARY KEY,
      id_lista_precios BIGINT NOT NULL,
      id_lista_interna BIGINT NOT NULL,
      criterio_relacion TEXT NOT NULL,
      created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_rel_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
      CONSTRAINT fk_rel_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
      UNIQUE (id_lista_precios)
    )`
  },
  {
    description: 'Creando índice temporal para auditar cuándo se generó cada relación',
    sql: `CREATE INDEX IF NOT EXISTS ix_rel_created_at ON relacion_articulos (created_at)`
  },
  {
    description: 'Creando tabla de productos externos pendientes de relacionar',
    sql: `CREATE TABLE IF NOT EXISTS articulos_no_relacionados (
      id BIGSERIAL PRIMARY KEY,
      id_lista_precios BIGINT NOT NULL,
      motivo TEXT,
      CONSTRAINT fk_anr_lp FOREIGN KEY (id_lista_precios) REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
      UNIQUE (id_lista_precios)
    )`
  },
  {
    description: 'Creando tabla de productos internos pendientes de relacionar',
    sql: `CREATE TABLE IF NOT EXISTS articulos_gampack_no_relacionados (
      id BIGSERIAL PRIMARY KEY,
      id_lista_interna BIGINT NOT NULL,
      motivo TEXT,
      CONSTRAINT fk_agnr_li FOREIGN KEY (id_lista_interna) REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
      UNIQUE (id_lista_interna)
    )`
  },
  {
    description: 'Creando tabla de auditoría para registrar importaciones de archivos',
    sql: `CREATE TABLE IF NOT EXISTS imports_log (
      id BIGSERIAL PRIMARY KEY,
      source_filename TEXT,
      imported_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )`
  },
  {
    description: 'Creando tabla que guarda mapeos personalizados de columnas por proveedor',
    sql: `CREATE TABLE IF NOT EXISTS column_mappings (
      id BIGSERIAL PRIMARY KEY,
      proveedor TEXT NOT NULL,
      mapping_json TEXT NOT NULL,
      updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (proveedor)
    )`
  },
  {
    description: 'Creando catálogo de familias de productos',
    sql: `CREATE TABLE IF NOT EXISTS familias (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE
    )`
  },
  {
    description: 'Creando catálogo de subfamilias dentro de cada familia',
    sql: `CREATE TABLE IF NOT EXISTS subfamilias (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL,
      familia_id BIGINT NOT NULL REFERENCES familias (id) ON DELETE CASCADE,
      UNIQUE (nombre, familia_id)
    )`
  },
  {
    description: 'Creando catálogo de rubros que agrupan productos específicos',
    sql: `CREATE TABLE IF NOT EXISTS rubros (
      id BIGSERIAL PRIMARY KEY,
      nombre TEXT NOT NULL UNIQUE,
      subfamilia_id BIGINT NOT NULL REFERENCES subfamilias (id) ON DELETE CASCADE
    )`
  },
  {
    description: 'Creando tabla que vincula productos internos con un rubro',
    sql: `CREATE TABLE IF NOT EXISTS producto_rubro (
      id_interno BIGINT NOT NULL REFERENCES lista_interna (id_interno) ON DELETE CASCADE,
      id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
      PRIMARY KEY (id_interno)
    )`
  },
  {
    description: 'Creando tabla que vincula productos externos con un rubro',
    sql: `CREATE TABLE IF NOT EXISTS producto_externo_rubro (
      id_externo BIGINT NOT NULL REFERENCES lista_precios (id_externo) ON DELETE CASCADE,
      id_rubro BIGINT NOT NULL REFERENCES rubros (id) ON DELETE CASCADE,
      PRIMARY KEY (id_externo)
    )`
  },
  {
    description: 'Creando índice auxiliar para acelerar filtros por rubro en productos internos',
    sql: `CREATE INDEX IF NOT EXISTS ix_producto_rubro_rubro ON producto_rubro (id_rubro)`
  },
  {
    description: 'Creando índice auxiliar para búsquedas insensibles a mayúsculas en rubros',
    sql: `CREATE INDEX IF NOT EXISTS ix_rubros_nombre ON rubros (LOWER(nombre))`
  }
];

async function ensureSchemas(client) {
  await client.query('CREATE SCHEMA IF NOT EXISTS venta');
  await client.query('CREATE SCHEMA IF NOT EXISTS compra');
}

async function setupTenantSchema(client, schema) {
  console.log(`\nConfigurando estructura para el schema "${schema}"...`);
  await client.query(`SET search_path TO ${schema}, public`);

  for (const step of sharedTableDefinitions) {
    console.log(`- ${step.description}`);
    await client.query(step.sql);
  }
}

async function ensureUsers(client) {
  console.log('\nVerificando usuarios por defecto...');
  await client.query(`CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('compra', 'venta'))
  )`);

  for (const user of defaultUsers) {
    await client.query(
      `INSERT INTO public.users (username, password, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password, role = EXCLUDED.role`,
      [user.username, user.password, user.role]
    );
  }
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await ensureSchemas(client);
    await ensureUsers(client);

    await setupTenantSchema(client, 'venta');
    await setupTenantSchema(client, 'compra');

    await client.query('COMMIT');
    console.log('\nEstructura de base de datos sincronizada correctamente ✔');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante la sincronización de la base de datos:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();