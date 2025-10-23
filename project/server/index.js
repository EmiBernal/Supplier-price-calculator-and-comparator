const express = require('express');
const cors = require('cors');
const path = require('path');
const multerLib = require('multer');
const multer = multerLib.default || multerLib;
const XLSX = require('xlsx');
const cookieParser = require('cookie-parser');
const { tenantMiddleware } = require('./middleware/tenant');
const { prepareSql } = require('./utils/sql');

const app = express();

// ===== Middlewares base =====
const envOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = [
  ...envOrigins,
  'http://localhost:5173',
  'https://supplier-price-calculator-and-comparator.vercel.app',
  'https://supplier-price-calculator-and-compa.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS bloqueado:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'change-me')); // firma cookies
app.use(tenantMiddleware);

// ===== Upload (para XLSX) =====
const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024 }
});

// === Helpers comunes ===
function normalizeHeaders(raw) {
  const arr = Array.isArray(raw) ? raw : [];
  return Array.from({ length: arr.length }, (_, i) => {
    const h = arr[i];
    if (h == null) return '';
    const s = String(h).trim().replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    return s;
  });
}

function parseNumberAR(value) {
  if (value == null) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  let s = String(value).trim();
  s = s.replace(/\./g, '').replace(',', '.'); // 1.234,56 -> 1234.56
  s = s.replace(/[$\sA-Za-z]/g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function toYMD(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

const YMD_REGEX = /^(\d{4})-(\d{2})-(\d{2})/;

function ensureYMD(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const match = value.match(YMD_REGEX);
    if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

function ensureYearMonth(value) {
  if (value == null) return null;
  if (typeof value === 'string') {
    const ymMatch = value.match(/^(\d{4})-(\d{2})/);
    if (ymMatch) return `${ymMatch[1]}-${ymMatch[2]}`;
  }
  const ymd = ensureYMD(value);
  if (ymd) return ymd.slice(0, 7);
  return null;
}

function getCurrentYearMonth() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
}

function normalizeRowDates(row, fields = []) {
  if (!row || typeof row !== 'object') return row;
  const copy = { ...row };
  for (const field of fields) {
    copy[field] = ensureYMD(copy[field]);
  }
  return copy;
}

function normalizeRowsDates(rows = [], fields = []) {
  return rows.map((row) => normalizeRowDates(row, fields));
}

// ===== Helpers DB (PostgreSQL) =====
async function runDb(db, sql, params = []) {
  const text = prepareSql(sql);
  return db.query(text, params);
}

async function getDbRow(db, sql, params = []) {
  const result = await runDb(db, sql, params);
  return result.rows[0] || null;
}

async function getDbRows(db, sql, params = []) {
  const result = await runDb(db, sql, params);
  return result.rows;
}

function parseLimitParam(raw) {
  const DEFAULT_LIMIT = 500;
  const MIN_LIMIT = 50;
  const MAX_LIMIT = 2000;
  if (raw == null) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  if (parsed < MIN_LIMIT) return MIN_LIMIT;
  if (parsed > MAX_LIMIT) return MAX_LIMIT;
  return parsed;
}

function parseOffsetParam(raw) {
  if (raw == null) return 0;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
}

function parseOnlyPending(raw) {
  if (raw == null) return true;
  return String(raw) === '1';
}

function clampNumber(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function parsePositiveInt(raw, defaultValue, min, max) {
  if (raw == null) return defaultValue;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return defaultValue;
  return clampNumber(parsed, min, max);
}

function normalizeWhitespace(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim();
}

function normalizeNameForExactMatch(value) {
  if (!value) return '';
  return normalizeWhitespace(value).toLowerCase();
}

async function findInternalByExactName(db, normalizedName) {
  if (!normalizedName) return null;
  return getDbRow(
    db,
    `SELECT * FROM lista_interna
     WHERE nom_interno IS NOT NULL
       AND LOWER(REGEXP_REPLACE(TRIM(nom_interno), '\\s+', ' ', 'g')) = $1
     ORDER BY id_interno ASC
     LIMIT 1`,
    [normalizedName]
  );
}

async function findExternalByExactName(db, normalizedName, normalizedSupplier = null) {
  if (!normalizedName) return null;
  const params = [normalizedName];
  const clauses = [
    `SELECT * FROM lista_precios
     WHERE nom_externo IS NOT NULL
       AND LOWER(REGEXP_REPLACE(TRIM(nom_externo), '\\s+', ' ', 'g')) = $1
       AND LOWER(TRIM(tipo_empresa)) = 'proveedor'`
  ];
  if (normalizedSupplier) {
    clauses.push('AND LOWER(TRIM(proveedor)) = $2');
    params.push(normalizedSupplier);
  }
  clauses.push('ORDER BY id_externo ASC\nLIMIT 1');
  return getDbRow(db, clauses.join('\n'), params);
}

async function createRelationAndClean(db, idListaPrecios, idListaInterna, criterio = 'automatic') {
  if (!idListaPrecios || !idListaInterna) {
    return { created: false, reason: 'missing_ids' };
  }

  const existingPair = await getDbRow(
    db,
    `SELECT id FROM relacion_articulos WHERE id_lista_precios = $1 AND id_lista_interna = $2`,
    [idListaPrecios, idListaInterna]
  );
  if (existingPair) {
    await runDb(db, `DELETE FROM articulos_no_relacionados WHERE id_lista_precios = $1`, [idListaPrecios]);
    await runDb(db, `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = $1`, [idListaInterna]);
    return { created: true, relationId: existingPair.id, alreadyExisted: true };
  }

  const existingForExternal = await getDbRow(
    db,
    `SELECT id, id_lista_interna FROM relacion_articulos WHERE id_lista_precios = $1 LIMIT 1`,
    [idListaPrecios]
  );
  if (existingForExternal) {
    return {
      created: false,
      reason: 'external_already_related',
      conflictingRelationId: existingForExternal.id,
      conflictingInternalId: existingForExternal.id_lista_interna,
    };
  }

  const existingForInternal = await getDbRow(
    db,
    `SELECT id, id_lista_precios FROM relacion_articulos WHERE id_lista_interna = $1 LIMIT 1`,
    [idListaInterna]
  );
  if (existingForInternal) {
    return {
      created: false,
      reason: 'internal_already_related',
      conflictingRelationId: existingForInternal.id,
      conflictingExternalId: existingForInternal.id_lista_precios,
    };
  }

  const insertedRelation = await getDbRow(
    db,
    `INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [idListaPrecios, idListaInterna, criterio]
  );

  await runDb(db, `DELETE FROM articulos_no_relacionados WHERE id_lista_precios = $1`, [idListaPrecios]);
  await runDb(db, `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = $1`, [idListaInterna]);

  return { created: true, relationId: insertedRelation?.id ?? null, alreadyExisted: false };
}

function removeDiacritics(value) {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

function normalizeSearchText(value) {
  if (!value) return '';
  const text = removeDiacritics(String(value)).toLowerCase();
  return normalizeWhitespace(text.replace(/[^a-z0-9\s]/g, ' '));
}

function normalizeForKey(value) {
  if (!value) return '';
  const text = removeDiacritics(String(value)).toLowerCase();
  return normalizeWhitespace(text.replace(/[^a-z0-9]/g, ' '));
}

function normalizeCode(value) {
  if (!value) return '';
  const text = removeDiacritics(String(value)).toLowerCase();
  return text.replace(/[^a-z0-9]/g, '');
}

function buildProductKey(name, code) {
  const codeKey = normalizeCode(code);
  const nameKey = normalizeForKey(name);
  if (codeKey && nameKey) return `${codeKey}__${nameKey}`;
  return codeKey || nameKey || null;
}

function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;
  const prev = new Array(b.length + 1).fill(0);
  const curr = new Array(b.length + 1).fill(0);
  for (let j = 0; j <= b.length; j += 1) {
    prev[j] = j;
  }
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    const charA = a.charAt(i - 1);
    for (let j = 1; j <= b.length; j += 1) {
      const cost = charA === b.charAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(
        curr[j - 1] + 1,
        prev[j] + 1,
        prev[j - 1] + cost
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      prev[j] = curr[j];
    }
  }
  return prev[b.length];
}

function computeNameSimilarity(a, b) {
  const normA = normalizeForKey(a);
  const normB = normalizeForKey(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;
  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 0;
  return 1 - distance / maxLen;
}

function buildNameLikePattern(name) {
  if (!name) return null;
  const normalized = normalizeWhitespace(String(name).toLowerCase());
  if (!normalized) return null;
  return `%${normalized.replace(/\s+/g, '%')}%`;
}

function pickRepresentativeValue(values = []) {
  const tally = new Map();
  for (const raw of values) {
    const value = typeof raw === 'string' ? normalizeWhitespace(raw) : normalizeWhitespace(String(raw ?? ''));
    if (!value) continue;
    const key = value.toLowerCase();
    if (!tally.has(key)) {
      tally.set(key, { value, count: 1 });
    } else {
      const entry = tally.get(key);
      entry.count += 1;
      if (value.length > entry.value.length) entry.value = value;
    }
  }

  let best = null;
  for (const entry of tally.values()) {
    if (!best) {
      best = entry;
      continue;
    }
    if (entry.count > best.count) {
      best = entry;
      continue;
    }
    if (entry.count === best.count) {
      if (entry.value.length > best.value.length) {
        best = entry;
        continue;
      }
      if (entry.value.length === best.value.length && entry.value.localeCompare(best.value, 'es') < 0) {
        best = entry;
      }
    }
  }

  return best ? best.value : null;
}

function parseTimestamp(value) {
  if (value == null) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const str = String(value).trim();
  if (!str) return null;
  const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, y, m, d] = isoMatch.map(Number);
    const ts = Date.UTC(y, m - 1, d);
    return Number.isFinite(ts) ? ts : null;
  }
  const parsed = Date.parse(str);
  return Number.isFinite(parsed) ? parsed : null;
}

// ============ Rutas ============

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', tenant: req.ctx?.tenant || null });
});

// ---------- EQUIVALENCIAS ----------
app.get('/api/equivalencias', async (req, res) => {
  const db = req.ctx.db;
  if (!db) {
    return res.status(500).json({ error: 'db_not_available' });
  }

  try {
    const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const params = [];

    let sql = `
    SELECT
      ra.id,
      ra.id_lista_precios,
      ra.id_lista_interna,
      ra.criterio_relacion,
      ra.created_at AS relation_created_at,
      lp.cod_externo,
      lp.nom_externo,
      lp.proveedor,
      lp.fecha AS fecha_externo,
      li.cod_interno,
      li.nom_interno,
      li.fecha AS fecha_interno
    FROM relacion_articulos ra
    LEFT JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    LEFT JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
  `;

    if (search) {
      const searchTerm = `%${search}%`;
      sql += `
      WHERE
        lp.cod_externo ILIKE $1 OR
        lp.nom_externo ILIKE $2 OR
        lp.proveedor ILIKE $3 OR
        li.cod_interno ILIKE $4 OR
        li.nom_interno ILIKE $5
    `;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    sql += ' ORDER BY ra.created_at DESC, lp.fecha DESC NULLS LAST';

    const rows = await getDbRows(db, sql, params);
    const result = rows.map((row) => ({
      id: row.id,
      id_lista_precios: row.id_lista_precios,
      id_lista_interna: row.id_lista_interna,
      supplier: row.proveedor,
      externalCode: row.cod_externo,
      externalName: row.nom_externo,
      externalDate: ensureYMD(row.fecha_externo),
      internalSupplier: 'Gampack',
      internalCode: row.cod_interno,
      internalName: row.nom_interno,
      internalDate: ensureYMD(row.fecha_interno),
      relationDate: ensureYMD(row.relation_created_at),
      matchingCriteria: row.criterio_relacion
    }));

    return res.json(result);
  } catch (err) {
    console.error('Error al obtener equivalencias:', err);
    return res.status(500).json({ error: 'Error al obtener equivalencias' });
  }
});
// ---------- EDITAR RELACIÓN ----------
app.put('/api/relacion/:id', async (req, res) => {
  const db = req.ctx.db;
  if (!db) {
    return res.status(500).json({ success: false, message: 'db_not_available' });
  }

  const relationId = Number(req.params.id);
  const { matchingCriteria, lista_precios, lista_interna } = req.body || {};

  if (!Number.isFinite(relationId)) {
    return res.status(400).json({ success: false, message: 'id de relación inválido' });
  }
  if (!lista_precios?.id_externo || !lista_interna?.id_interno) {
    return res.status(400).json({ success: false, message: 'Faltan id_externo o id_interno' });
  }

  const lp = {
    id_externo: Number(lista_precios.id_externo),
    proveedor: lista_precios.proveedor ?? null,
    cod_externo: lista_precios.cod_externo ?? null,
    nom_externo: lista_precios.nom_externo ?? null,
    fecha: toYMD(lista_precios.fecha)
  };
  const li = {
    id_interno: Number(lista_interna.id_interno),
    cod_interno: lista_interna.cod_interno ?? null,
    nom_interno: lista_interna.nom_interno ?? null,
    fecha: toYMD(lista_interna.fecha)
  };
  const criterio = matchingCriteria ?? null;

  await runDb(db, 'BEGIN');
  try {
    const rel = await getDbRow(
      db,
      `SELECT id, id_lista_precios, id_lista_interna
         FROM relacion_articulos
        WHERE id = $1`,
      [relationId]
    );

    if (!rel) {
      await runDb(db, 'ROLLBACK');
      return res.status(404).json({ success: false, message: 'Relación no encontrada' });
    }

    if (rel.id_lista_precios !== lp.id_externo || rel.id_lista_interna !== li.id_interno) {
      await runDb(db, 'ROLLBACK');
      return res.status(400).json({ success: false, message: 'IDs no coinciden con la relación' });
    }

    await runDb(
      db,
      `UPDATE lista_precios
          SET proveedor = COALESCE($1, proveedor),
              cod_externo = $2,
              nom_externo = COALESCE($3, nom_externo),
              fecha = COALESCE($4, fecha),
              mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        WHERE id_externo = $5`,
      [lp.proveedor, lp.cod_externo, lp.nom_externo, lp.fecha, lp.id_externo]
    );

    await runDb(
      db,
      `UPDATE lista_interna
          SET cod_interno = $1,
              nom_interno = COALESCE($2, nom_interno),
              fecha = COALESCE($3, fecha),
              mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
        WHERE id_interno = $4`,
      [li.cod_interno, li.nom_interno, li.fecha, li.id_interno]
    );

    if (criterio !== null && criterio !== undefined) {
      await runDb(
        db,
        `UPDATE relacion_articulos
            SET criterio_relacion = $1
          WHERE id = $2`,
        [criterio, relationId]
      );
    }

    await runDb(db, 'COMMIT');
    return res.json({ success: true });
  } catch (err) {
    await runDb(db, 'ROLLBACK').catch(() => {});
    console.error('Error actualizando relación:', err);
    return res.status(500).json({ success: false, message: 'Error actualizando relación' });
  }
});

// ---------- LOGOUT ----------
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tenant', { httpOnly: true, sameSite: 'none', secure: true, signed: true });
  res.clearCookie('token', { httpOnly: true, sameSite: 'none', secure: true });
  return res.json({ ok: true });
});

// ---------- PROVEEDORES (resumen) ----------
app.get('/api/providers/summary', async (req, res) => {
  try {
    const db = req.ctx.db;
    const rows = await getDbRows(
      db,
      `SELECT proveedor AS proveedor, COUNT(*)::int AS products
       FROM lista_precios
       WHERE proveedor IS NOT NULL AND TRIM(proveedor) <> ''
       GROUP BY proveedor
       ORDER BY LOWER(proveedor) ASC`,
      []
    );
    res.json(rows || []);
  } catch (err) {
    console.error('Error /api/providers/summary:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// ---------- PROVEEDORES ACTIVOS (vista detallada) ----------
app.get('/api/providers/active', async (req, res) => {
  try {
    const db = req.ctx.db;
    if (!db) {
      return res.status(500).json({ error: 'db_not_available' });
    }

    const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const params = [];
    const conditions = ["proveedor IS NOT NULL", "TRIM(proveedor) <> ''"];

    if (searchRaw) {
      params.push(`%${searchRaw.toLowerCase()}%`);
      conditions.push(`LOWER(TRIM(proveedor)) LIKE $${params.length}`);
    }

    const sql = `
      SELECT
        proveedor AS name,
        COUNT(*)::int AS products,
        MAX(fecha) AS last_update,
        SUM(CASE WHEN fecha >= CURRENT_DATE - INTERVAL '90 day' THEN 1 ELSE 0 END)::int AS recent_products,
        CASE WHEN MAX(fecha) >= CURRENT_DATE - INTERVAL '90 day' THEN TRUE ELSE FALSE END AS is_active
      FROM lista_precios
      WHERE ${conditions.join(' AND ')}
      GROUP BY proveedor
      ORDER BY LOWER(proveedor) ASC
    `;

    const rows = await getDbRows(db, sql, params);
    const normalized = normalizeRowsDates(rows, ['last_update']).map((row) => ({
      name: row.name,
      products: Number(row.products ?? 0),
      last_update: row.last_update ?? null,
      recent_products: Number(row.recent_products ?? 0),
      is_active: Boolean(row.is_active),
    }));

    res.json(normalized);
  } catch (err) {
    console.error('Error /api/providers/active:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

app.get('/api/providers/products', async (req, res) => {
  try {
    const db = req.ctx.db;
    if (!db) {
      return res.status(500).json({ error: 'db_not_available' });
    }

    const rawName = typeof req.query.name === 'string' ? req.query.name.trim() : '';
    if (!rawName) {
      return res.status(400).json({ error: 'Proveedor requerido' });
    }

    const normalizedName = rawName.toLowerCase();
    const rows = await getDbRows(
      db,
      `
        SELECT
          id_externo,
          nom_externo,
          cod_externo,
          precio_final,
          fecha,
          proveedor,
          CASE WHEN fecha >= CURRENT_DATE - INTERVAL '90 day' THEN TRUE ELSE FALSE END AS is_active
        FROM lista_precios
        WHERE TRIM(LOWER(proveedor)) = $1
        ORDER BY LOWER(nom_externo) ASC, cod_externo ASC NULLS LAST
      `,
      [normalizedName]
    );

    const normalized = normalizeRowsDates(rows, ['fecha']).map((row) => ({
      id: row.id_externo,
      name: row.nom_externo,
      code: row.cod_externo,
      price: Number(row.precio_final ?? 0),
      date: row.fecha ?? null,
      provider: row.proveedor,
      is_active: Boolean(row.is_active),
    }));

    res.json({
      provider: normalized[0]?.provider ?? rawName,
      products: normalized,
    });
  } catch (err) {
    console.error('Error /api/providers/products:', err);
    res.status(500).json({ error: 'db_error' });
  }
});

// ---------- LISTA PRECIOS (externos) ----------
app.get('/api/lista_precios', async (req, res) => {
  try {
    const db = req.ctx.db;
    const search = String(req.query.search || '');

    const rows = await getDbRows(
      db,
      `SELECT * FROM lista_precios
       WHERE cod_externo ILIKE $1 OR nom_externo ILIKE $2
       ORDER BY fecha DESC`,
      [`%${search}%`, `%${search}%`]
    );
    res.json(normalizeRowsDates(rows, ['fecha']));
  } catch (err) {
    console.error('Error al obtener lista_precios:', err);
    return res.status(500).json({ error: 'Error al obtener datos' });
  }
});

function createNoRelacionadosHandler(tipo) {
  const isExternos = tipo === 'externos';

  return async (req, res) => {
    if (req.ctx?.tenant === 'compra') {
      return res.status(404).json({ error: 'no_disponible_en_compras' });
    }

    const db = req.ctx.db;
    if (!db) {
      return res.status(500).json({ error: 'db_not_available' });
    }

    try {
      const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';
      const hasSearch = searchRaw.length > 0;
      const searchTerm = hasSearch ? `%${searchRaw.toLowerCase()}%` : null;
      const onlyPending = String(req.query.onlyPending || '1') === '1';
      const limit = parseLimitParam(req.query.limit);
      const offset = parseOffsetParam(req.query.offset);

      const params = [];
      const where = [];

      if (isExternos) {
        where.push('ra.id IS NULL');
        if (onlyPending) {
          where.push('anr.id_lista_precios IS NOT NULL');
        }
        if (hasSearch) {
          where.push(`(
            LOWER(lp.cod_externo) LIKE $1 OR
            LOWER(lp.nom_externo) LIKE $2 OR
            LOWER(lp.proveedor) LIKE $3
          )`);
          params.push(searchTerm, searchTerm, searchTerm);
        }

        const sql = `
          SELECT DISTINCT
            lp.id_externo AS id_externo,
            lp.cod_externo AS codigo,
            lp.nom_externo AS nom_externo,
            lp.proveedor AS proveedor,
            lp.precio_final AS precio_final,
            lp.fecha AS fecha,
            lp.mes_actualizacion AS mes_actualizacion,
            anr.motivo AS motivo,
            CASE WHEN anr.id_lista_precios IS NULL THEN 0 ELSE 1 END AS es_pendiente,
            LOWER(lp.nom_externo) AS nombre_lower
          FROM lista_precios lp
          LEFT JOIN relacion_articulos ra ON ra.id_lista_precios = lp.id_externo
          LEFT JOIN articulos_no_relacionados anr ON anr.id_lista_precios = lp.id_externo
          ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
          ORDER BY es_pendiente DESC,
                   DATE(lp.fecha) DESC,
                   lp.id_externo DESC,
                   nombre_lower ASC
          LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `;
        params.push(limit, offset);

        const rows = await getDbRows(db, sql, params);
        return res.json(normalizeRowsDates(rows, ['fecha']));
      }

      // internos
      where.push('ra.id IS NULL');
      if (onlyPending) {
        where.push('agnr.id_lista_interna IS NOT NULL');
      }
      if (hasSearch) {
        where.push(`(
          LOWER(li.cod_interno) LIKE $1 OR
          LOWER(li.nom_interno) LIKE $2
        )`);
        params.push(searchTerm, searchTerm);
      }

      const sql = `
        SELECT DISTINCT
          li.id_interno AS id_interno,
          li.cod_interno AS codigo,
          li.nom_interno AS nom_interno,
          li.precio_final AS precio_final,
          li.fecha AS fecha,
          li.mes_actualizacion AS mes_actualizacion,
          agnr.motivo AS motivo,
          CASE WHEN agnr.id_lista_interna IS NULL THEN 0 ELSE 1 END AS es_pendiente,
          LOWER(li.nom_interno) AS nombre_lower
        FROM lista_interna li
        LEFT JOIN relacion_articulos ra ON ra.id_lista_interna = li.id_interno
        LEFT JOIN articulos_gampack_no_relacionados agnr ON agnr.id_lista_interna = li.id_interno
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY es_pendiente DESC,
                 DATE(li.fecha) DESC,
                 li.id_interno DESC,
                 nombre_lower ASC
        LIMIT $${params.length + 1} OFFSET $${params.length + 2}
      `;
      params.push(limit, offset);

      const rows = await getDbRows(db, sql, params);
      return res.json(normalizeRowsDates(rows, ['fecha']));
    } catch (err) {
      console.error('Error al obtener productos no relacionados:', err);
      return res.status(500).json({ error: 'db_error' });
    }
  };
}

const handleNoRelacionadosExternos = createNoRelacionadosHandler('externos');
const handleNoRelacionadosInternos = createNoRelacionadosHandler('internos');

app.get('/api/no-relacionados/externos', handleNoRelacionadosExternos);
app.get('/api/no-relacionados/proveedores', handleNoRelacionadosExternos);
app.get('/api/no-relacionados/internos', handleNoRelacionadosInternos);
app.get('/api/no-relacionados/gampack', handleNoRelacionadosInternos);

// ---------- CHECK PRODUCT ----------
app.post('/api/check-product', async (req, res) => {
  const db = req.ctx.db;
  const { productCode, companyType } = req.body;

  if (!productCode || !companyType) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  let sql = '';
  let params = [];

  if (companyType === 'Proveedor') {
    sql = `SELECT * FROM lista_precios WHERE cod_externo = $1`;
    params = [productCode];
  } else if (companyType === 'Gampack') {
    sql = `SELECT * FROM lista_interna WHERE cod_interno = $1`;
    params = [productCode];
  } else {
    return res.status(400).json({ error: 'Tipo de empresa no válido' });
  }

  try {
    const row = await getDbRow(db, sql, params);
    if (row) {
      return res.status(200).json({ found: true, product: normalizeRowDates(row, ['fecha']) });
    } else {
      return res.status(200).json({ found: false });
    }
  } catch (err) {
    console.error('Error al chequear producto:', err.message);
    return res.status(500).json({ error: 'Error en base de datos' });
  }
});

// ---------- RELACIONES (lista) ----------
app.get('/api/relaciones', async (req, res) => {
  try {
    const db = req.ctx.db;
    const rows = await getDbRows(
      db,
      `SELECT r.*,
              r.created_at AS relation_created_at,
              lp.cod_externo, lp.nom_externo, 
              li.cod_interno, li.nom_interno
       FROM relacion_articulos r
       LEFT JOIN lista_precios lp ON r.id_lista_precios = lp.id_externo
       LEFT JOIN lista_interna li ON r.id_lista_interna = li.id_interno
       ORDER BY r.created_at DESC`,
      []
    );
    res.json(rows);
  } catch (err) {
    console.error('Error al obtener relaciones:', err);
    return res.status(500).json({ error: 'Error al obtener relaciones' });
  }
});

// ---------- RELACIONAR MANUAL ----------
app.post('/api/relacionar-manual', async (req, res) => {
  const db = req.ctx.db;
  const { id_lista_interna, ids_lista_precios, criterio } = req.body;

  if (!id_lista_interna || !Array.isArray(ids_lista_precios) || ids_lista_precios.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos' });
  }

  try {
    await runDb(db, 'BEGIN');
    for (const id of ids_lista_precios) {
      await runDb(
        db,
        `INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [id, id_lista_interna, criterio]
      );

      await runDb(
        db,
        `DELETE FROM articulos_no_relacionados WHERE id_lista_precios = $1`,
        [id]
      );
    }

    await runDb(
      db,
      `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = $1`,
      [id_lista_interna]
    );

    await runDb(db, 'COMMIT');
    res.status(200).json({ success: true });
  } catch (err) {
    await runDb(db, 'ROLLBACK').catch(() => {});
    console.error('Error al vincular productos:', err);
    return res.status(500).json({ error: 'Error al vincular productos' });
  }
});

// ---------- Alta producto (manual) ----------

// ---------- Alta producto (manual) ----------
app.post('/api/products', async (req, res) => {
  const db = req.ctx.db;
  const {
    productCode: rawProductCode,
    productName: rawProductName,
    finalPrice,
    companyType,
    company: rawCompany,
    date,
    linkAsEquivalent = null,
  } = req.body;

  const productCode = normalizeWhitespace(rawProductCode ?? '');
  const productName = normalizeWhitespace(rawProductName ?? '');
  const company = normalizeWhitespace(rawCompany ?? '');

  if (!productName || finalPrice == null || !companyType || !date) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const normalizedDate = ensureYMD(date);
  if (!normalizedDate) {
    return res.status(400).json({ error: 'Fecha inválida' });
  }

  const normalizedCode = normalizeCode(productCode);
  const normalizedNameKey = normalizeForKey(productName);
  const normalizedExactName = normalizeNameForExactMatch(productName);
  const nameLikePattern = buildNameLikePattern(productName);
  const normalizedCompany = company ? company.toLowerCase() : '';
  const hasCompany = Boolean(normalizedCompany);

  const pickBestNameMatch = (targetName, candidates, getName) => {
    let best = null;
    for (const candidate of candidates) {
      const candidateName = getName(candidate);
      if (!candidateName) continue;
      const similarity = computeNameSimilarity(targetName, candidateName);
      if (similarity >= 0.9 && (!best || similarity > best.similarity)) {
        best = { row: candidate, similarity };
      }
    }
    return best;
  };

  const findInternalAutoMatch = async () => {
    if (normalizedCode) {
      const match = await getDbRow(
        db,
        `SELECT * FROM lista_interna
         WHERE cod_interno IS NOT NULL
           AND LOWER(REGEXP_REPLACE(cod_interno, '[^a-z0-9]', '', 'g')) = $1
         ORDER BY id_interno ASC
         LIMIT 1`,
        [normalizedCode]
      );
      if (match) {
        return { row: match, criterion: 'codigo' };
      }
    }

    if (normalizedExactName) {
      const exactByName = await findInternalByExactName(db, normalizedExactName);
      if (exactByName) {
        return { row: exactByName, criterion: 'nombre_exact' };
      }
    }

    if (normalizedNameKey && nameLikePattern) {
      const candidates = await getDbRows(
        db,
        `SELECT * FROM lista_interna
         WHERE nom_interno IS NOT NULL
           AND LOWER(nom_interno) LIKE $1
         LIMIT 50`,
        [nameLikePattern]
      );
      const best = pickBestNameMatch(productName, candidates, (candidate) => candidate.nom_interno);
      if (best) {
        return { row: best.row, criterion: 'name' };
      }
    }

    return null;
  };

  const findExternalAutoMatch = async () => {
    const useCompanyFilter = hasCompany && companyType === 'Proveedor';
    const paramsByCode = [normalizedCode].filter(Boolean);
    if (normalizedCode && paramsByCode.length) {
      const sqlParts = [
        `SELECT * FROM lista_precios
         WHERE cod_externo IS NOT NULL
           AND LOWER(REGEXP_REPLACE(cod_externo, '[^a-z0-9]', '', 'g')) = $1`
      ];
      if (useCompanyFilter) {
        sqlParts.push('AND LOWER(TRIM(proveedor)) = $2');
        paramsByCode.push(normalizedCompany);
      }
      sqlParts.push('ORDER BY id_externo ASC LIMIT 1');
      const match = await getDbRow(db, sqlParts.join('\n'), paramsByCode);
      if (match) {
        return { row: match, criterion: 'codigo' };
      }
    }

    if (normalizedExactName) {
      const exactByName = await findExternalByExactName(db, normalizedExactName, useCompanyFilter ? normalizedCompany : null);
      if (exactByName) {
        return { row: exactByName, criterion: 'nombre_exact' };
      }
    }

    if (normalizedNameKey && nameLikePattern) {
      const params = [nameLikePattern];
      const clauses = [
        `SELECT * FROM lista_precios
         WHERE nom_externo IS NOT NULL
           AND LOWER(nom_externo) LIKE $1`
      ];
      if (useCompanyFilter) {
        clauses.push('AND LOWER(TRIM(proveedor)) = $2');
        params.push(normalizedCompany);
      }
      clauses.push('LIMIT 50');
      const candidates = await getDbRows(db, clauses.join('\n'), params);
      const best = pickBestNameMatch(productName, candidates, (candidate) => candidate.nom_externo);
      if (best) {
        return { row: best.row, criterion: 'name' };
      }
    }

    return null;
  };

  try {
    if (companyType === 'Proveedor') {
      const currentMonth = getCurrentYearMonth();

      const exact = await getDbRow(
        db,
        `SELECT * FROM lista_precios
         WHERE cod_externo IS NOT NULL
           AND LOWER(TRIM(cod_externo)) = LOWER($1)
           AND LOWER(TRIM(proveedor)) = LOWER($2)
           AND LOWER(TRIM(tipo_empresa)) = LOWER($3)
         LIMIT 1`,
        [productCode, company, companyType]
      );

      let existing = exact;
      if (!existing && normalizedExactName && normalizedCompany) {
        existing = await findExternalByExactName(db, normalizedExactName, normalizedCompany);
      }

      if (existing) {
        const storedDate = ensureYMD(existing.fecha);
        const storedMonth = ensureYearMonth(existing.mes_actualizacion || existing.fecha);
        const needsUpdate =
          normalizeWhitespace(existing.cod_externo || '') !== productCode ||
          normalizeWhitespace(existing.nom_externo || '') !== productName ||
          Number(existing.precio_final) !== Number(finalPrice) ||
          storedDate !== normalizedDate ||
          normalizeWhitespace(existing.proveedor || '') !== company ||
          normalizeWhitespace(existing.tipo_empresa || '') !== companyType ||
          storedMonth !== currentMonth;

        if (needsUpdate) {
          await runDb(
            db,
            `UPDATE lista_precios
             SET cod_externo = $1,
                 nom_externo = $2,
                 precio_final = $3,
                 tipo_empresa = $4,
                 fecha = $5,
                 proveedor = $6,
                 mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
             WHERE id_externo = $7`,
            [
              productCode || null,
              productName,
              finalPrice,
              companyType,
              normalizedDate,
              company,
              existing.id_externo,
            ]
          );
        }

        return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
      }

      let inserted;
      try {
        inserted = await getDbRow(
          db,
          `INSERT INTO lista_precios (cod_externo, nom_externo, precio_final, tipo_empresa, fecha, proveedor, mes_actualizacion)
           VALUES ($1, $2, $3, $4, $5, $6, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
           RETURNING id_externo`,
          [productCode || null, productName, finalPrice, companyType, normalizedDate, company]
        );
      } catch (err) {
        if (err?.code === '23505' && productCode) {
          const conflict = await getDbRow(
            db,
            `SELECT * FROM lista_precios
             WHERE cod_externo IS NOT NULL
               AND LOWER(TRIM(cod_externo)) = LOWER($1)
               AND LOWER(TRIM(proveedor)) = LOWER($2)
            LIMIT 1`,
            [productCode, company]
          );
          if (conflict) {
            await runDb(
              db,
              `UPDATE lista_precios
               SET nom_externo = $1,
                   precio_final = $2,
                   tipo_empresa = $3,
                   fecha = $4,
                   proveedor = $5,
                   mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
               WHERE id_externo = $6`,
              [productName, finalPrice, companyType, normalizedDate, company, conflict.id_externo]
            );
            return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
          }
        }
        throw err;
      }
      const newId = inserted?.id_externo;

      let internalMatch = null;
      if (newId) {
        internalMatch = await findInternalAutoMatch();
      }

      let relationResult = null;
      if (internalMatch?.row && linkAsEquivalent !== false) {
        relationResult = await createRelationAndClean(db, newId, internalMatch.row.id_interno, internalMatch.criterion);
        if (relationResult?.created) {
          return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
        }
      }

      const motivo = (() => {
        if (!internalMatch?.row) {
          return 'No se encontró coincidencia por código ni nombre';
        }
        if (relationResult?.reason === 'internal_already_related') {
          return 'Coincidencia automática omitida: el producto interno ya está relacionado';
        }
        if (relationResult?.reason === 'external_already_related') {
          return 'Coincidencia automática omitida: el producto del proveedor ya está relacionado';
        }
        return 'Usuario rechazó sugerencia de relación';
      })();

      await runDb(
        db,
        `INSERT INTO articulos_no_relacionados (id_lista_precios, motivo)
         VALUES ($1, $2)
         ON CONFLICT (id_lista_precios) DO NOTHING`,
        [newId, motivo]
      );

      return res.status(201).json({
        success: true,
        message: 'Producto creado - no relacionados',
        skippedRelationReason: relationResult?.reason ?? (internalMatch?.row ? 'user_declined' : 'no_match'),
      });
    }

    if (companyType === 'Gampack') {
      const currentMonth = getCurrentYearMonth();

      const exact = productCode
        ? await getDbRow(
            db,
            `SELECT * FROM lista_interna
             WHERE cod_interno IS NOT NULL
               AND LOWER(TRIM(cod_interno)) = LOWER($1)
             LIMIT 1`,
            [productCode]
          )
        : null;

      let existing = exact;
      if (!existing && normalizedExactName) {
        existing = await findInternalByExactName(db, normalizedExactName);
      }

      if (existing) {
        const storedDate = ensureYMD(existing.fecha);
        const storedMonth = ensureYearMonth(existing.mes_actualizacion || existing.fecha);
        const needsUpdate =
          normalizeWhitespace(existing.cod_interno || '') !== productCode ||
          normalizeWhitespace(existing.nom_interno || '') !== productName ||
          Number(existing.precio_final) !== Number(finalPrice) ||
          storedDate !== normalizedDate ||
          storedMonth !== currentMonth;
        if (needsUpdate) {
          await runDb(
            db,
            `UPDATE lista_interna
             SET cod_interno = $1,
                 nom_interno = $2,
                 precio_final = $3,
                 fecha = $4,
                 mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
             WHERE id_interno = $5`,
            [productCode || null, productName, finalPrice, normalizedDate, existing.id_interno]
          );
        }
        return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
      }

      let inserted;
      try {
        inserted = await getDbRow(
          db,
          `INSERT INTO lista_interna (cod_interno, nom_interno, precio_final, fecha, mes_actualizacion)
           VALUES ($1, $2, $3, $4, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
           RETURNING id_interno`,
          [productCode || null, productName, finalPrice, normalizedDate]
        );
      } catch (err) {
        if (err?.code === '23505' && productCode) {
          const conflict = await getDbRow(
            db,
            `SELECT * FROM lista_interna
             WHERE cod_interno IS NOT NULL
               AND LOWER(TRIM(cod_interno)) = LOWER($1)
            LIMIT 1`,
            [productCode]
          );
          if (conflict) {
            await runDb(
              db,
              `UPDATE lista_interna
               SET nom_interno = $1,
                   precio_final = $2,
                   fecha = $3,
                   mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
               WHERE id_interno = $4`,
              [productName, finalPrice, normalizedDate, conflict.id_interno]
            );
            return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
          }
        }
        throw err;
      }
      const newId = inserted?.id_interno;

      let externalMatch = null;
      if (newId) {
        externalMatch = await findExternalAutoMatch();
      }

      let relationResult = null;
      if (externalMatch?.row && linkAsEquivalent !== false) {
        relationResult = await createRelationAndClean(db, externalMatch.row.id_externo, newId, externalMatch.criterion);
        if (relationResult?.created) {
          return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
        }
      }

      const motivo = (() => {
        if (!externalMatch?.row) {
          return 'No se encontró coincidencia por código ni nombre';
        }
        if (relationResult?.reason === 'internal_already_related') {
          return 'Coincidencia automática omitida: el producto interno ya está relacionado';
        }
        if (relationResult?.reason === 'external_already_related') {
          return 'Coincidencia automática omitida: el producto del proveedor ya está relacionado';
        }
        return 'Usuario rechazó sugerencia de relación';
      })();

      await runDb(
        db,
        `INSERT INTO articulos_gampack_no_relacionados (id_lista_interna, motivo)
         VALUES ($1, $2)
         ON CONFLICT (id_lista_interna) DO NOTHING`,
        [newId, motivo]
      );

      return res.status(201).json({
        success: true,
        message: 'Producto creado - no relacionados',
        skippedRelationReason: relationResult?.reason ?? (externalMatch?.row ? 'user_declined' : 'no_match'),
      });
    }

    return res.status(400).json({ error: 'Tipo de empresa no válido' });
  } catch (error) {
    console.error('Alta producto error:', error);
    return res.status(500).json({ error: 'Error interno' });
  }
});

// ---------- BORRAR RELACIÓN + productos asociados ----------
app.delete('/api/relacion/:id', async (req, res) => {
  const db = req.ctx.db;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID inválido' });

  try {
    const rel = await getDbRow(
      db,
      `SELECT id_lista_precios, id_lista_interna
       FROM relacion_articulos
       WHERE id = $1`,
      [id]
    );

    if (!rel) return res.status(404).json({ error: 'Relación no encontrada' });

    await runDb(db, 'BEGIN');
    await runDb(db, `DELETE FROM relacion_articulos WHERE id = $1`, [id]);
    await runDb(db, `DELETE FROM lista_precios WHERE id_externo = $1`, [rel.id_lista_precios]);
    await runDb(db, `DELETE FROM lista_interna WHERE id_interno = $1`, [rel.id_lista_interna]);
    await runDb(db, 'COMMIT');

    return res.status(200).json({ success: true, message: 'Relación y productos eliminados correctamente' });
  } catch (err) {
    await runDb(db, 'ROLLBACK').catch(() => {});
    console.error('Error eliminando relación y productos:', err);
    return res.status(500).json({ error: 'Error en base de datos' });
  }
});

// ---------- COMPARACIONES DE PRECIOS ----------
app.get('/api/price-comparisons', async (req, res) => {
  const db = req.ctx.db;
  const search = (req.query.search || '').toString().toLowerCase();
  const dateFrom = (req.query.dateFrom || '').toString(); // YYYY-MM-DD
  const dateTo = (req.query.dateTo || '').toString();     // YYYY-MM-DD
  const familia = (req.query.familia || '').toString().toLowerCase();
  const onlyRelated = String(req.query.onlyRelated || '0') === '1';

  let dateMode = (req.query.dateMode || 'relation').toString(); // 'product' | 'relation'
  if (onlyRelated) dateMode = 'relation';

  const hasFrom = !!dateFrom;
  const hasTo = !!dateTo;
  const hasFamilia = !!familia;

  const like = `%${search}%`;
  const familiaLike = `%${familia}%`;

  // helpers que devuelven cláusulas con '?' para que prepareSql() las numere
  const applySearch = (cols) =>
    search ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';
  const applyFamilia = (cols) =>
    hasFamilia ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';

  const buildDateRange = (col) => {
    if (hasFrom && hasTo) return `${col} BETWEEN ? AND ?`;
    if (hasFrom) return `${col} >= ?`;
    if (hasTo) return `${col} <= ?`;
    return '';
  };

  const liDateRange = dateMode === 'product' ? buildDateRange('DATE(li.fecha)') : '';
  const lpDateRange = dateMode === 'product' ? buildDateRange('DATE(lp.fecha)') : '';
  const relDateRange = dateMode === 'relation' ? buildDateRange('DATE(ra.created_at)') : '';

  const wherePairs = [applySearch(['li.nom_interno', 'lp.nom_externo', 'lp.proveedor'])];
  const paramsPairs = search ? [like, like, like] : [];

  if (hasFamilia) {
    wherePairs.push(applyFamilia(['li.familia', 'lp.familia']));
    paramsPairs.push(familiaLike, familiaLike);
  }

  if (dateMode === 'product' && (hasFrom || hasTo)) {
    const dateConds = [];
    if (liDateRange) {
      dateConds.push(`(${liDateRange})`);
      if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
      else if (hasFrom) paramsPairs.push(dateFrom);
      else paramsPairs.push(dateTo);
    }
    if (lpDateRange) {
      dateConds.push(`(${lpDateRange})`);
      if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
      else if (hasFrom) paramsPairs.push(dateFrom);
      else paramsPairs.push(dateTo);
    }
    wherePairs.push('(' + dateConds.join(' OR ') + ')');
  }

  if (dateMode === 'relation' && (hasFrom || hasTo)) {
    if (relDateRange) {
      wherePairs.push(`${relDateRange}`);
      if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
      else if (hasFrom) paramsPairs.push(dateFrom);
      else paramsPairs.push(dateTo);
    }
  }

  const sqlPairs = `
    SELECT 
      li.nom_interno AS internalProduct,
      lp.nom_externo AS externalProduct,
      lp.proveedor   AS supplier,
      li.precio_final AS internalFinalPrice,
      lp.precio_final AS externalFinalPrice,
      li.fecha       AS internalDate,
      lp.fecha       AS externalDate,
      lp.tipo_empresa AS companyType,
      ra.criterio_relacion AS saleConditions,
      ra.created_at  AS relationDate,
      ${dateMode === 'relation'
        ? `DATE(ra.created_at)`
        : `COALESCE(DATE(li.fecha), DATE(lp.fecha))`} AS sortDate
    FROM relacion_articulos ra
    JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    WHERE ${wherePairs.join(' AND ')}
  `;

  const whereInternal = ['ra.id_lista_precios IS NULL', applySearch(['li.nom_interno'])];
  const paramsInternal = search ? [like] : [];
  if (hasFamilia) {
    whereInternal.push(applyFamilia(['li.familia']));
    paramsInternal.push(familiaLike);
  }
  if (dateMode === 'product') {
    const dr = buildDateRange('DATE(li.fecha)');
    if (dr) {
      whereInternal.push(dr);
      if (hasFrom && hasTo) paramsInternal.push(dateFrom, dateTo);
      else if (hasFrom) paramsInternal.push(dateFrom);
      else if (hasTo) paramsInternal.push(dateTo);
    }
  }

  const sqlInternalOnly = `
    SELECT
      li.nom_interno AS internalProduct,
      NULL AS externalProduct,
      NULL AS supplier,
      li.precio_final AS internalFinalPrice,
      NULL AS externalFinalPrice,
      li.fecha AS internalDate,
      NULL AS externalDate,
      'Gampack' AS companyType,
      NULL AS saleConditions,
      NULL AS relationDate,
      DATE(li.fecha) AS sortDate
    FROM lista_interna li
    LEFT JOIN relacion_articulos ra ON ra.id_lista_interna = li.id_interno
    WHERE ${whereInternal.join(' AND ')}
  `;

  const whereExternal = ['ra.id_lista_interna IS NULL', applySearch(['lp.nom_externo', 'lp.proveedor'])];
  const paramsExternal = search ? [like, like] : [];
  if (hasFamilia) {
    whereExternal.push(applyFamilia(['lp.familia']));
    paramsExternal.push(familiaLike);
  }
  if (dateMode === 'product') {
    const dr = buildDateRange('DATE(lp.fecha)');
    if (dr) {
      whereExternal.push(dr);
      if (hasFrom && hasTo) paramsExternal.push(dateFrom, dateTo);
      else if (hasFrom) paramsExternal.push(dateFrom);
      else if (hasTo) paramsExternal.push(dateTo);
    }
  }

  const sqlExternalOnly = `
    SELECT
      NULL AS internalProduct,
      lp.nom_externo AS externalProduct,
      lp.proveedor AS supplier,
      NULL AS internalFinalPrice,
      lp.precio_final AS externalFinalPrice,
      NULL AS internalDate,
      lp.fecha AS externalDate,
      lp.tipo_empresa AS companyType,
      NULL AS saleConditions,
      NULL AS relationDate,
      DATE(lp.fecha) AS sortDate
    FROM lista_precios lp
    LEFT JOIN relacion_articulos ra ON ra.id_lista_precios = lp.id_externo
    WHERE ${whereExternal.join(' AND ')}
  `;

  let sql, params;
  if (onlyRelated) {
    sql = `
      ${sqlPairs}
      ORDER BY sortDate DESC NULLS LAST
      LIMIT 1000
    `;
    params = [...paramsPairs];
  } else {
    sql = `
      ${sqlPairs}
      UNION ALL
      ${sqlInternalOnly}
      UNION ALL
      ${sqlExternalOnly}
      ORDER BY sortDate DESC NULLS LAST
      LIMIT 1000
    `;
    params = [...paramsPairs, ...paramsInternal, ...paramsExternal];
  }

  try {
    const rows = await getDbRows(db, sql, params);
    const results = rows.map(row => {
      const internal = row.internalfinalprice ?? row.internalfinalprice === 0 ? Number(row.internalfinalprice) : row.internalfinalprice;
      const external = row.externalfinalprice ?? row.externalfinalprice === 0 ? Number(row.externalfinalprice) : row.externalfinalprice;

      const priceDifference =
        external && external !== 0 && internal != null
          ? parseFloat((((internal - external) / external) * 100).toFixed(2))
          : null;

      return {
        internalProduct: row.internalproduct || null,
        externalProduct: row.externalproduct || null,
        supplier: row.supplier || null,
        internalFinalPrice: internal ?? null,
        externalFinalPrice: external ?? null,
        internalDate: ensureYMD(row.internaldate) || null,
        externalDate: ensureYMD(row.externaldate) || null,
        relationDate: ensureYMD(row.relationdate) || null,
        companyType: row.companytype === 'Gampack' ? 'supplier' : 'competitor',
        saleConditions: row.saleconditions || 'Desconocido',
        priceDifference,
      };
    });

    res.json(results);
  } catch (err) {
    console.error('Error al obtener comparaciones de precios:', err);
    return res.status(500).json({ error: 'Error al obtener comparaciones de precios' });
  }
});

// ---------- RELACIONADOS POR CÓDIGO ----------
app.get('/api/gampack/:codigo/relacionados', async (req, res) => {
  const db = req.ctx.db;
  const codInterno = req.params.codigo;

  const sql = `
    SELECT 
      lp.nom_externo AS name,
      lp.precio_final AS price,
      lp.proveedor AS supplier,
      lp.fecha AS externalDate,
      li.precio_final AS internalPrice
    FROM relacion_articulos ra
    JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    WHERE li.cod_interno = $1
  `;

  try {
    const rows = await getDbRows(db, sql, [codInterno]);
    const data = rows.map(row => ({
      name: row.name,
      price: row.price,
      supplier: row.supplier,
      externalDate: ensureYMD(row.externaldate),
      priceDifference: (row.price ?? 0) - (row.internalprice ?? 0),
      percentageDifference: row.internalprice
        ? (((row.price ?? 0) - row.internalprice) / row.internalprice * 100).toFixed(2)
        : '0.00'
    }));
    res.json(data);
  } catch (err) {
    console.error('Error al obtener productos relacionados:', err);
    return res.status(500).json({ error: 'Error al obtener productos relacionados' });
  }
});

// ---------- IMPORT XLSX (lista-precios / interna) ----------
app.post('/api/imports/lista-precios', upload.single('file'), (req, res) => {
  const db = req.ctx.db;

  (async () => {
    try {
      if (!req.file) return res.status(400).json({ error: 'Falta archivo (campo "file")' });

      const providerHint = (req.body.provider_hint || '').toString().trim();
      if (!providerHint) return res.status(400).json({ error: 'El campo proveedor es obligatorio' });

      const isGampack = providerHint.toLowerCase() === 'gampack';
      const sourceFilename = (req.body.source_filename || '').toString().trim();
      const headerRow1 = parseInt(req.body.header_row || '1', 10);
      const headerIndex0 = isNaN(headerRow1) ? 0 : Math.max(0, headerRow1 - 1);

      let mapping = {};
      if (req.body.mapping) {
        try { mapping = JSON.parse(req.body.mapping); } catch { mapping = {}; }
      }

      const wb = XLSX.read(req.file.buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });

      const headersRaw = (matrix[headerIndex0] || []).map(v => String(v ?? ''));
      const dataRows = matrix.slice(headerIndex0 + 1);

      const rows = dataRows.map(arr => {
        const obj = {};
        for (let i = 0; i < headersRaw.length; i++) {
          const k = String(headersRaw[i] ?? '');
          obj[k] = arr?.[i] ?? '';
        }
        return obj;
      });

      const normalizeLabel = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      const normLower = (v) => normalizeLabel(v).toLowerCase();

      const getCell = (row, key) => {
        if (!key) return '';
        if (key in row) return row[key];
        const nk = normLower(key);
        const realKey = Object.keys(row).find(k => normLower(k) === nk);
        return realKey ? row[realKey] : '';
      };

      const parseNumberARLocal = (value) => {
        if (value == null) return null;
        let s = String(value).trim();
        s = s.replace(/\./g, '').replace(',', '.').replace(/[$\sA-Za-z]/g, '');
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      };

      const run = (sql, params=[]) => runDb(db, sql, params);
      const get = (sql, params=[]) => getDbRow(db, sql, params);

      const colNom    = isGampack ? (mapping.nom_interno || mapping.nom_externo) : (mapping.nom_externo || mapping.nom_interno);
      const colCod    = isGampack ? (mapping.cod_interno || mapping.cod_externo) : (mapping.cod_externo || mapping.cod_interno);
      const colPrecio = mapping.precio_final;

      if (!colNom || !colPrecio) {
        return res.status(400).json({
          error: 'Falta asignar columnas obligatorias',
          detail: { required: isGampack ? ['nom_interno','precio_final'] : ['nom_externo','precio_final'], mapping }
        });
      }

      const today = new Date().toISOString().slice(0, 10);

      let inserted = 0;
      let updated = 0;
      let updatedPriceChanged = 0;
      let skipped = 0;
      let autoRelated = 0;

      const proveedorCanon = normalizeLabel(providerHint);
      const proveedorLower = normLower(providerHint);

      const getExistingInterno = async ({ codigo, nombre }) => {
        const nombreN = normalizeLabel(nombre);
        if (codigo) {
          const byCode = await get(
            `SELECT id_interno AS id, precio_final AS price
             FROM lista_interna
             WHERE TRIM(LOWER(cod_interno)) = TRIM(LOWER($1))
             LIMIT 1`,
            [codigo]
          );
          if (byCode) return byCode;
        }
        const byName = await get(
          `SELECT id_interno AS id, precio_final AS price
           FROM lista_interna
           WHERE TRIM(LOWER(nom_interno)) = TRIM(LOWER($1))
           LIMIT 1`,
          [nombreN]
        );
        return byName || null;
      };

      const getExistingExterno = async ({ proveedorLower, codigo, nombre }) => {
        const nombreN = normalizeLabel(nombre);
        if (codigo) {
          const byCode = await get(
            `SELECT id_externo AS id, precio_final AS price
             FROM lista_precios
             WHERE TRIM(LOWER(proveedor)) = $1
               AND TRIM(LOWER(cod_externo)) = TRIM(LOWER($2))
             LIMIT 1`,
            [proveedorLower, codigo]
          );
          if (byCode) return byCode;
        }
        const byName = await get(
          `SELECT id_externo AS id, precio_final AS price
           FROM lista_precios
           WHERE TRIM(LOWER(proveedor)) = $1
             AND TRIM(LOWER(nom_externo)) = TRIM(LOWER($2))
           LIMIT 1`,
          [proveedorLower, nombreN]
        );
        return byName || null;
      };

      const upsertListaInterna = async ({ nombre, codigo, price, today }) => {
        const nombreN = normalizeLabel(nombre);
        const codigoN = codigo ? normalizeLabel(codigo) : null;
        const existing = await getExistingInterno({ codigo: codigoN, nombre: nombreN });

        if (existing?.id) {
          await run(
            `UPDATE lista_interna
             SET nom_interno = $1, precio_final = $2, fecha = $3, mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
             WHERE id_interno = $4`,
            [nombreN, price, today, existing.id]
          );
          updated++;
          if (existing.price !== price) updatedPriceChanged++;
          return existing.id;
        } else {
          const ins = await get(
            `INSERT INTO lista_interna (nom_interno, cod_interno, precio_final, fecha, mes_actualizacion)
             VALUES ($1, $2, $3, $4, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
             RETURNING id_interno AS id`,
            [nombreN, codigoN, price, today]
          );
          inserted++;
          return ins.id;
        }
      };

      const upsertListaPrecios = async ({ nombre, codigo, price, proveedorCanon, proveedorLower, today }) => {
        const nombreN = normalizeLabel(nombre);
        const codigoN = codigo ? normalizeLabel(codigo) : null;
        const existing = await getExistingExterno({ proveedorLower, codigo: codigoN, nombre: nombreN });

        if (existing?.id) {
          await run(
            `UPDATE lista_precios
             SET nom_externo = $1, precio_final = $2, tipo_empresa = 'Proveedor', fecha = $3, mes_actualizacion = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
             WHERE id_externo = $4`,
            [nombreN, price, today, existing.id]
          );
          updated++;
          if (existing.price !== price) updatedPriceChanged++;
          return existing.id;
        } else {
          const ins = await get(
            `INSERT INTO lista_precios (nom_externo, cod_externo, precio_final, tipo_empresa, fecha, proveedor, mes_actualizacion)
             VALUES ($1, $2, $3, 'Proveedor', $4, $5, TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
             RETURNING id_externo AS id`,
            [nombreN, codigoN, price, today, proveedorCanon]
          );
          inserted++;
          return ins.id;
        }
      };

      await run('BEGIN');
      try {
        for (const r of rows) {
          const nombre = String(getCell(r, colNom) ?? '');
          const nombreN = normalizeLabel(nombre);
          const nombreExactKey = normalizeNameForExactMatch(nombreN);
          const codigoRaw = colCod ? String(getCell(r, colCod) ?? '') : '';
          const codigo = normalizeLabel(codigoRaw) || null;
          const precioRaw = getCell(r, colPrecio);
          const price = typeof precioRaw === 'number' ? precioRaw : parseNumberARLocal(precioRaw);

          if (!nombreN || price == null || !Number.isFinite(price)) {
            skipped++;
            continue;
          }

          if (isGampack) {
            const idInterno = await upsertListaInterna({ nombre: nombreN, codigo, price, today });
            if (idInterno) {
              let relationResult = null;
              if (nombreExactKey) {
                const externalMatch = await findExternalByExactName(db, nombreExactKey);
                if (externalMatch?.id_externo) {
                  relationResult = await createRelationAndClean(db, externalMatch.id_externo, idInterno, 'nombre_exact');
                  if (relationResult?.created) autoRelated++;
                }
              }

              if (!relationResult?.created) {
                await run(
                  `INSERT INTO articulos_gampack_no_relacionados (id_lista_interna, motivo)
                   VALUES ($1, $2)
                   ON CONFLICT (id_lista_interna) DO NOTHING`,
                  [idInterno, 'Importado vía carga masiva']
                );
              }
            }
          } else {
            const idExterno = await upsertListaPrecios({
              nombre: nombreN, codigo, price, proveedorCanon, proveedorLower, today
            });
            if (idExterno) {
              let relationResult = null;
              if (nombreExactKey) {
                const internalMatch = await findInternalByExactName(db, nombreExactKey);
                if (internalMatch?.id_interno) {
                  relationResult = await createRelationAndClean(db, idExterno, internalMatch.id_interno, 'nombre_exact');
                  if (relationResult?.created) autoRelated++;
                }
              }

              if (!relationResult?.created) {
                await run(
                  `INSERT INTO articulos_no_relacionados (id_lista_precios, motivo)
                   VALUES ($1, $2)
                   ON CONFLICT (id_lista_precios) DO NOTHING`,
                  [idExterno, 'Importado vía carga masiva']
                );
              }
            }
          }
        }

        await run('COMMIT');

        const message = `Importación finalizada: ${updated} modificados (${updatedPriceChanged} con cambio de precio) y ${inserted} nuevos.${skipped ? ` Omitidos: ${skipped}.` : ''}${autoRelated ? ` Vinculados automáticamente: ${autoRelated}.` : ''}`;

        return res.json({
          ok: true,
          isGampack,
          source: sourceFilename || req.file.originalname,
          header_row_used: headerRow1,
          counts: {
            inserted,
            updated,
            updated_price_changed: updatedPriceChanged,
            skipped,
            auto_related: autoRelated
          },
          processed: inserted + updated,
          saved_to: isGampack ? 'articulos_gampack_no_relacionados' : 'articulos_no_relacionados',
          message
        });
      } catch (e) {
        await run('ROLLBACK');
        console.error('Fallo importación:', e);
        return res.status(500).json({ error: 'Fallo importación', detail: e.message });
      }
    } catch (err) {
      console.error('Error en importación:', err);
      return res.status(500).json({ error: 'Error interno' });
    }
  })();
});

// ---------- LOGIN (setea cookie firmada con tenant) ----------
app.post('/api/login', async (req, res) => {
  const db = req.ctx.db; // usa la DB por default (ventas) solo para leer users
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  try {
    const row = await getDbRow(
      db,
      `SELECT * FROM users WHERE username = $1 AND password = $2`,
      [username, password]
    );

    if (!row) return res.status(401).json({ error: 'Credenciales inválidas' });

    const role = (row.role || '').toLowerCase();
    const tenant = role === 'compra' ? 'compra' : 'venta';

    res.cookie('tenant', tenant, {
      httpOnly: true,
      sameSite: 'none',
      secure: true,
      signed: true,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({
      success: true,
      username: row.username,
      role: row.role,
      tenant
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({ error: 'Error en base de datos' });
  }
});

// ---------- STATS ----------
app.get('/api/stats', async (req, res) => {
  const db = req.ctx.db;
  const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD

  try {
    const q = {
      internalCount: `SELECT COUNT(*)::int AS c FROM lista_interna`,
      externalCount: `SELECT COUNT(*)::int AS c FROM lista_precios`,
      activeSuppliers: `SELECT COUNT(DISTINCT proveedor)::int AS c FROM lista_precios`,
      suppliersWithNewPriceToday: `SELECT COUNT(DISTINCT proveedor)::int AS c FROM lista_precios WHERE fecha = $1`,
      pendingExternal: `SELECT COUNT(*)::int AS c FROM articulos_no_relacionados`,
      pendingInternal: `SELECT COUNT(*)::int AS c FROM articulos_gampack_no_relacionados`,
    };

    const [
      internalCountRow,
      externalCountRow,
      activeSuppliersRow,
      suppliersWithNewPriceTodayRow,
      pendingExternalRow,
      pendingInternalRow
    ] = await Promise.all([
      getDbRow(db, q.internalCount),
      getDbRow(db, q.externalCount),
      getDbRow(db, q.activeSuppliers),
      getDbRow(db, q.suppliersWithNewPriceToday, [today]),
      getDbRow(db, q.pendingExternal),
      getDbRow(db, q.pendingInternal),
    ]);

    const internalCount = internalCountRow?.c ?? 0;
    const externalCount = externalCountRow?.c ?? 0;
    const activeSuppliers = activeSuppliersRow?.c ?? 0;
    const suppliersWithNewPriceToday = suppliersWithNewPriceTodayRow?.c ?? 0;
    const pendingExternal = pendingExternalRow?.c ?? 0;
    const pendingInternal = pendingInternalRow?.c ?? 0;

    const totalProducts = internalCount + externalCount;
    const pendingLinks = pendingExternal + pendingInternal;

    res.json({
      totalProducts,
      internalCount,
      externalCount,
      activeSuppliers,
      suppliersWithNewPriceToday,
      pendingLinks,
    });
  } catch (e) {
    console.error('Error /api/stats:', e);
    res.status(500).json({ error: 'stats_failed' });
  }
});

// ---------- IMPORT FAMILIAS ----------
const norm = (s) => String(s ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

app.post('/api/imports/familias', upload.single('file'), async (req, res) => {
  const db = req.ctx.db;
  const run = (sql, params=[]) => runDb(db, sql, params);
  const get = (sql, params=[]) => getDbRow(db, sql, params);

  try {
    if (!req.file) return res.status(400).json({ error: 'Falta archivo (campo "file")' });

    const wb = XLSX.read(req.file.buffer);
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    let ok=0, missProd=0, missRubro=0;

    await run('BEGIN');

    for (const r of rows) {
      const codigo = norm(r['Código'] ?? r['codigo'] ?? r['CODIGO'] ?? '');
      const nombre = norm(r['Nombre'] ?? r['nombre'] ?? r['NOMBRE'] ?? '');
      const rubro  = norm(r['Rubro']  ?? r['rubro']  ?? r['RUBRO']  ?? '');

      if (!rubro) continue;

      let idInterno = null;
      if (codigo) {
        const rr = await get(
          `SELECT id_interno FROM lista_interna
           WHERE TRIM(LOWER(cod_interno)) = TRIM(LOWER($1)) LIMIT 1`,
          [codigo]
        );
        if (rr) idInterno = rr.id_interno;
      }
      if (!idInterno && nombre) {
        const rr = await get(
          `SELECT id_interno FROM lista_interna
           WHERE TRIM(LOWER(nom_interno)) = TRIM(LOWER($1)) LIMIT 1`,
          [nombre]
        );
        if (rr) idInterno = rr.id_interno;
      }
      if (!idInterno) { missProd++; continue; }

      const rub = await get(`SELECT id FROM rubros WHERE LOWER(nombre)=LOWER($1)`, [rubro]);
      const idRubro = rub?.id ?? null;
      if (!idRubro) { missRubro++; continue; }

      await run(
        `INSERT INTO producto_rubro(id_interno, id_rubro)
         VALUES($1,$2)
         ON CONFLICT(id_interno) DO UPDATE SET id_rubro=excluded.id_rubro`,
        [idInterno, idRubro]
      );
      ok++;
    }

    await run('COMMIT');

    res.json({
      ok: true,
      assigned: ok,
      missing_products: missProd,
      missing_rubros: missRubro,
      note: missRubro ? 'Hay rubros en Excel que no existen en taxonomy.json/BD. Agregalos y volvé a correr.' : 'Todo OK'
    });
  } catch (e) {
    await run('ROLLBACK').catch(()=>{});
    console.error('Import familias error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ---------- NO RELACIONADOS: delete single/bulk (EXTERNOS) ----------
app.delete('/api/no-relacionados/externos/:id', async (req, res) => {
  if (req.ctx?.tenant === 'compra') return res.status(404).json({ error: 'no_disponible_en_compras' });
  const db = req.ctx.db;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id_invalido' });

  try {
    await runDb(db, 'BEGIN');
    await runDb(db, `DELETE FROM articulos_no_relacionados WHERE id_lista_precios = $1`, [id]);
    const del = await runDb(db, `DELETE FROM lista_precios WHERE id_externo = $1`, [id]);
    await runDb(db, 'COMMIT');
    return res.json({ ok: true, deleted: del.rowCount ?? 1 });
  } catch (e) {
    await runDb(db, 'ROLLBACK').catch(()=>{});
    console.error('Delete externo no-relacionado error:', e);
    return res.status(500).json({ error: 'db_error' });
  }
});

app.post('/api/no-relacionados/externos/delete', async (req, res) => {
  if (req.ctx?.tenant === 'compra') return res.status(404).json({ error: 'no_disponible_en_compras' });
  const db = req.ctx.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids_requeridos' });

  const ph = ids.map((_, i) => `$${i+1}`).join(',');
  try {
    await runDb(db, 'BEGIN');
    await runDb(db, `DELETE FROM articulos_no_relacionados WHERE id_lista_precios IN (${ph})`, ids);
    const del = await runDb(db, `DELETE FROM lista_precios WHERE id_externo IN (${ph})`, ids);
    await runDb(db, 'COMMIT');
    return res.json({ ok: true, deleted: del.rowCount ?? 0 });
  } catch (e) {
    await runDb(db, 'ROLLBACK').catch(()=>{});
    console.error('Bulk delete externos error:', e);
    return res.status(500).json({ error: 'db_error' });
  }
});

// ---------- NO RELACIONADOS: delete single/bulk (INTERNOS) ----------
app.delete('/api/no-relacionados/internos/:id', async (req, res) => {
  const db = req.ctx.db;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id_invalido' });

  try {
    await runDb(db, 'BEGIN');
    await runDb(db, `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = $1`, [id]);
    const del = await runDb(db, `DELETE FROM lista_interna WHERE id_interno = $1`, [id]);
    await runDb(db, 'COMMIT');
    return res.json({ ok: true, deleted: del.rowCount ?? 1 });
  } catch (e) {
    await runDb(db, 'ROLLBACK').catch(()=>{});
    console.error('Delete interno no-relacionado error:', e);
    return res.status(500).json({ error: 'db_error' });
  }
});

app.post('/api/no-relacionados/internos/delete', async (req, res) => {
  const db = req.ctx.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids_requeridos' });

  const ph = ids.map((_, i) => `$${i+1}`).join(',');
  try {
    await runDb(db, 'BEGIN');
    await runDb(db, `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna IN (${ph})`, ids);
    const del = await runDb(db, `DELETE FROM lista_interna WHERE id_interno IN (${ph})`, ids);
    await runDb(db, 'COMMIT');
    return res.json({ ok: true, deleted: del.rowCount ?? 0 });
  } catch (e) {
    await runDb(db, 'ROLLBACK').catch(()=>{});
    console.error('Bulk delete internos error:', e);
    return res.status(500).json({ error: 'db_error' });
  }
});

// ---------- DEBUG: relaciones, schema y datos visibles ----------
app.get('/api/debug/relaciones', async (req, res) => {
  const db = req.ctx.db;
  const tenant = req.ctx?.tenant || '(sin tenant)';
  try {
    const sql = `
      SELECT 
        ra.id,
        ra.created_at,
        li.nom_interno AS producto_interno,
        lp.nom_externo AS producto_externo,
        lp.proveedor,
        li.precio_final AS precio_interno,
        lp.precio_final AS precio_externo
      FROM relacion_articulos ra
      LEFT JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
      LEFT JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
      ORDER BY ra.created_at DESC
      LIMIT 20
    `;
    const rows = await getDbRows(db, sql, []);
    res.json({ ok: true, tenant, total: rows.length, relaciones: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = app;
