// server/index.js
const express = require('express');
const cors = require('cors');
const path = require('path');
const multerLib = require('multer');
const multer = multerLib.default || multerLib;
const XLSX = require('xlsx');
const cookieParser = require('cookie-parser');
const { tenantMiddleware } = require('./middleware/tenant');

const app = express();

// ===== Middlewares base =====
const allowedOrigins = [
  'http://localhost:5173',
  'https://calculadoradepreciosgampack.vercel.app'
];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ Bloqueado por CORS:', origin); 
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

// ===== Helpers DB promisificados por conexión =====
const runDb = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.run(sql, params, function (err) {
    if (err) reject(err); else resolve(this);
  }));

const getDbRow = (db, sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => {
    if (err) reject(err); else resolve(row);
  }));

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

function createNoRelacionadosHandler(tipo) {
  const isExternos = tipo === 'externos';

  return (req, res) => {
    if (req.ctx?.tenant === 'compra') {
      return res.status(404).json({ error: 'no_disponible_en_compras' });
    }

    const db = req.ctx.db;
    if (!db) {
      return res.status(500).json({ error: 'db_not_available' });
    }

    const searchRaw = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const hasSearch = searchRaw.length > 0;
    const searchTerm = hasSearch ? `%${searchRaw.toLowerCase()}%` : null;
    const onlyPending = parseOnlyPending(req.query.onlyPending);
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
          LOWER(lp.cod_externo) LIKE ? OR
          LOWER(lp.nom_externo) LIKE ? OR
          LOWER(lp.proveedor) LIKE ?
        )`);
        params.push(searchTerm, searchTerm, searchTerm);
      }

      const sql = `
        SELECT DISTINCT
          lp.id_externo AS id_externo,
          lp.cod_externo AS codigo,
          lp.nom_externo AS nombre,
          lp.proveedor AS proveedor,
          lp.precio_final AS precio_final,
          lp.fecha AS fecha,
          anr.motivo AS motivo,
          CASE WHEN anr.id_lista_precios IS NULL THEN 0 ELSE 1 END AS es_pendiente
        FROM lista_precios lp
        LEFT JOIN relacion_articulos ra ON ra.id_lista_precios = lp.id_externo
        LEFT JOIN articulos_no_relacionados anr ON anr.id_lista_precios = lp.id_externo
        ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
        ORDER BY es_pendiente DESC,
                 DATE(lp.fecha) DESC,
                 lp.id_externo DESC,
                 lp.nom_externo COLLATE NOCASE ASC
        LIMIT ? OFFSET ?
      `;

      params.push(limit, offset);

      return db.all(sql, params, (err, rows = []) => {
        if (err) {
          console.error('Error al obtener productos externos no relacionados:', err.message);
          return res.status(500).json({ error: 'Error al obtener productos externos no relacionados' });
        }

        const data = rows.map(row => {
          const codigo = row.codigo ?? null;
          const nombre = row.nombre ?? null;
          const proveedor = row.proveedor ?? null;
          const precioFinal = row.precio_final ?? null;
          const fecha = row.fecha ?? null;

          const item = {
            id_externo: row.id_externo,
            codigo,
            nombre,
            proveedor,
            precio_final: precioFinal,
            fecha,
            cod_externo: codigo,
            nom_externo: nombre,
            motivo: row.motivo ?? null,
            pendiente: row.es_pendiente === 1,
            id: row.id_externo,
            code: codigo,
            name: nombre,
            provider: proveedor,
            finalPrice: precioFinal,
            date: fecha,
          };

          return item;
        });

        return res.json(data);
      });
    }

    where.push('ra.id IS NULL');
    if (onlyPending) {
      where.push('agnr.id_lista_interna IS NOT NULL');
    }
    if (hasSearch) {
      where.push(`(
        LOWER(li.cod_interno) LIKE ? OR
        LOWER(li.nom_interno) LIKE ?
      )`);
      params.push(searchTerm, searchTerm);
    }

    const sql = `
      SELECT DISTINCT
        li.id_interno AS id_interno,
        li.cod_interno AS codigo,
        li.nom_interno AS nombre,
        li.precio_final AS precio_final,
        li.fecha AS fecha,
        agnr.motivo AS motivo,
        CASE WHEN agnr.id_lista_interna IS NULL THEN 0 ELSE 1 END AS es_pendiente
      FROM lista_interna li
      LEFT JOIN relacion_articulos ra ON ra.id_lista_interna = li.id_interno
      LEFT JOIN articulos_gampack_no_relacionados agnr ON agnr.id_lista_interna = li.id_interno
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY es_pendiente DESC,
               DATE(li.fecha) DESC,
               li.id_interno DESC,
               li.nom_interno COLLATE NOCASE ASC
      LIMIT ? OFFSET ?
    `;

    params.push(limit, offset);

    return db.all(sql, params, (err, rows = []) => {
      if (err) {
        console.error('Error al obtener productos internos no relacionados:', err.message);
        return res.status(500).json({ error: 'Error al obtener productos internos no relacionados' });
      }

      const data = rows.map(row => {
        const codigo = row.codigo ?? null;
        const nombre = row.nombre ?? null;
        const precioFinal = row.precio_final ?? null;
        const fecha = row.fecha ?? null;

        return {
          id_interno: row.id_interno,
          codigo,
          nombre,
          precio_final: precioFinal,
          fecha,
          cod_interno: codigo,
          nom_interno: nombre,
          motivo: row.motivo ?? null,
          pendiente: row.es_pendiente === 1,
          id: row.id_interno,
          code: codigo,
          name: nombre,
          provider: 'Gampack',
          finalPrice: precioFinal,
          date: fecha,
        };
      });

      return res.json(data);
    });
  };
}

// ============ Rutas ============

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', tenant: req.ctx?.tenant || null });
});

// ---------- EQUIVALENCIAS ----------
app.get('/api/equivalencias', (req, res) => {
  const db = req.ctx.db;
  const search = req.query.search;
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
      lp.fecha as fecha_externo,
      li.cod_interno,
      li.nom_interno,
      li.fecha as fecha_interno
    FROM relacion_articulos ra
    LEFT JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    LEFT JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
  `;

  if (search && typeof search === 'string' && search.trim() !== '') {
    const searchTerm = `%${search.trim()}%`;
    sql += `
      WHERE
        lp.cod_externo LIKE ? OR
        lp.nom_externo LIKE ? OR
        lp.proveedor LIKE ? OR
        li.cod_interno LIKE ? OR
        li.nom_interno LIKE ?
    `;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
  }

  sql += ' ORDER BY datetime(relation_created_at) DESC, datetime(lp.fecha) DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener equivalencias:', err.message);
      return res.status(500).json({ error: 'Error al obtener equivalencias' });
    }

    const result = rows.map(row => ({
      id: row.id,
      id_lista_precios: row.id_lista_precios,
      id_lista_interna: row.id_lista_interna,
      supplier: row.proveedor,
      externalCode: row.cod_externo,
      externalName: row.nom_externo,
      externalDate: row.fecha_externo,
      internalSupplier: 'Gampack',
      internalCode: row.cod_interno,
      internalName: row.nom_interno,
      internalDate: row.fecha_interno,
      relationDate: row.relation_created_at,
      matchingCriteria: row.criterio_relacion,
    }));

    res.json(result);
  });
});

// ---------- EDITAR RELACIÓN ----------
app.put('/api/relacion/:id', (req, res) => {
  const db = req.ctx.db;
  const relationId = Number(req.params.id);
  const { matchingCriteria, lista_precios, lista_interna } = req.body || {};

  if (!relationId) {
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

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');

    db.get(
      `SELECT id, id_lista_precios, id_lista_interna
         FROM relacion_articulos
        WHERE id = ?`,
      [relationId],
      (err, rel) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ success: false, message: 'Error leyendo relación' });
        }
        if (!rel) {
          db.run('ROLLBACK');
          return res.status(404).json({ success: false, message: 'Relación no encontrada' });
        }
        if (rel.id_lista_precios !== lp.id_externo || rel.id_lista_interna !== li.id_interno) {
          db.run('ROLLBACK');
          return res.status(400).json({ success: false, message: 'IDs no coinciden con la relación' });
        }

        db.run(
          `UPDATE lista_precios
              SET proveedor = COALESCE(?, proveedor),
                  cod_externo = ?,
                  nom_externo = COALESCE(?, nom_externo),
                  fecha = COALESCE(?, fecha)
            WHERE id_externo = ?`,
          [lp.proveedor, lp.cod_externo, lp.nom_externo, lp.fecha, lp.id_externo],
          function (err2) {
            if (err2) {
              db.run('ROLLBACK');
              return res.status(500).json({ success: false, message: 'Error actualizando lista_precios' });
            }

            db.run(
              `UPDATE lista_interna
                  SET cod_interno = ?,
                      nom_interno = COALESCE(?, nom_interno),
                      fecha = COALESCE(?, fecha)
                WHERE id_interno = ?`,
              [li.cod_interno, li.nom_interno, li.fecha, li.id_interno],
              function (err3) {
                if (err3) {
                  db.run('ROLLBACK');
                  return res.status(500).json({ success: false, message: 'Error actualizando lista_interna' });
                }

                const updateCriterio = (next) => {
                  if (criterio === null || criterio === undefined) return next();
                  db.run(
                    `UPDATE relacion_articulos
                        SET criterio_relacion = ?
                      WHERE id = ?`,
                    [criterio, relationId],
                    function (err4) {
                      if (err4) {
                        db.run('ROLLBACK');
                        return res.status(500).json({ success: false, message: 'Error actualizando criterio de relación' });
                      }
                      next();
                    }
                  );
                };

                updateCriterio(() => {
                  db.run('COMMIT', (err5) => {
                    if (err5) {
                      db.run('ROLLBACK');
                      return res.status(500).json({ success: false, message: 'Error al confirmar cambios' });
                    }
                    return res.json({ success: true });
                  });
                });
              }
            );
          }
        );
      }
    );
  });
});

// ---------- LOGOUT ----------
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('tenant', { httpOnly: true, sameSite: 'lax', signed: true });
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' }); // por compatibilidad
  return res.json({ ok: true });
});

// ---------- PROVEEDORES (resumen) ----------
app.get('/api/providers/summary', (req, res) => {
  const db = req.ctx.db;
  const sql = `
    SELECT proveedor AS proveedor, COUNT(*) AS products
    FROM lista_precios
    WHERE proveedor IS NOT NULL AND TRIM(proveedor) <> ''
    GROUP BY proveedor
    ORDER BY proveedor COLLATE NOCASE ASC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'db_error' });
    res.json(rows || []);
  });
});

// ---------- LISTA PRECIOS (externos) ----------
app.get('/api/lista_precios', (req, res) => {
  const db = req.ctx.db;
  const search = req.query.search || '';

  const sql = `
    SELECT * FROM lista_precios
    WHERE cod_externo LIKE ? OR nom_externo LIKE ?
    ORDER BY fecha DESC
  `;

  const params = [`%${search}%`, `%${search}%`];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener lista_precios:', err.message);
      return res.status(500).json({ error: 'Error al obtener datos' });
    }

    res.json(rows);
  });
});

// ---------- NO RELACIONADOS (externos / internos) ----------
const handleNoRelacionadosExternos = createNoRelacionadosHandler('externos');
const handleNoRelacionadosInternos = createNoRelacionadosHandler('internos');

app.get('/api/no-relacionados/externos', handleNoRelacionadosExternos);
app.get('/api/no-relacionados/proveedores', handleNoRelacionadosExternos);
app.get('/api/no-relacionados/internos', handleNoRelacionadosInternos);
app.get('/api/no-relacionados/gampack', handleNoRelacionadosInternos);

// ---------- CHECK PRODUCT ----------
app.post('/api/check-product', (req, res) => {
  const db = req.ctx.db;
  const { productCode, companyType } = req.body;

  if (!productCode || !companyType) {
    return res.status(400).json({ error: 'Faltan datos requeridos' });
  }

  let sql = '';
  let params = [];

  if (companyType === 'Proveedor') {
    sql = `SELECT * FROM lista_precios WHERE cod_externo = ?`;
    params = [productCode];
  } else if (companyType === 'Gampack') {
    sql = `SELECT * FROM lista_interna WHERE cod_interno = ?`;
    params = [productCode];
  } else {
    return res.status(400).json({ error: 'Tipo de empresa no válido' });
  }

  db.get(sql, params, (err, row) => {
    if (err) {
      console.error('Error al chequear producto:', err.message);
      return res.status(500).json({ error: 'Error en base de datos' });
    }

    if (row) {
      return res.status(200).json({ found: true, product: row });
    } else {
      return res.status(200).json({ found: false });
    }
  });
});

// ---------- RELACIONES (lista) ----------
app.get('/api/relaciones', (req, res) => {
  const db = req.ctx.db;
  const sql = `
    SELECT r.*, 
           r.created_at AS relation_created_at,
           lp.cod_externo, lp.nom_externo, 
           li.cod_interno, li.nom_interno
    FROM relacion_articulos r
    LEFT JOIN lista_precios lp ON r.id_lista_precios = lp.id_externo
    LEFT JOIN lista_interna li ON r.id_lista_interna = li.id_interno
    ORDER BY datetime(r.created_at) DESC
  `;
  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener relaciones:', err.message);
      return res.status(500).json({ error: 'Error al obtener relaciones' });
    }
    res.json(rows);
  });
});

// ---------- RELACIONAR MANUAL ----------
app.post('/api/relacionar-manual', (req, res) => {
  const db = req.ctx.db;
  const { id_lista_interna, ids_lista_precios, criterio } = req.body;

  if (!id_lista_interna || !Array.isArray(ids_lista_precios) || ids_lista_precios.length === 0) {
    return res.status(400).json({ error: 'Datos incompletos o inválidos' });
  }

  const placeholders = ids_lista_precios.map(() => '(?, ?, ?)').join(', ');
  const params = ids_lista_precios.flatMap(id => [id, id_lista_interna, criterio]);

  const sql = `
    INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
    VALUES ${placeholders}
  `;

  db.run(sql, params, function (err) {
    if (err) {
      console.error('Error al vincular productos:', err.message);
      return res.status(500).json({ error: 'Error al vincular productos' });
    }

    const deleteExternosSql = `
      DELETE FROM articulos_no_relacionados WHERE id_lista_precios IN (${ids_lista_precios.map(() => '?').join(',')})
    `;
    db.run(deleteExternosSql, ids_lista_precios, (delErr) => {
      if (delErr) {
        console.error('Error eliminando artículos no relacionados (externos):', delErr.message);
      }
    });

    const deleteInternoSql = `DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`;
    db.run(deleteInternoSql, [id_lista_interna], (delErr) => {
      if (delErr) {
        console.error('Error eliminando artículo no relacionado (interno):', delErr.message);
      }
    });

    res.status(200).json({ success: true });
  });
});

// ---------- Alta producto (manual) ----------
app.post('/api/products', (req, res) => {
  const db = req.ctx.db;
  const {
    productCode,
    productName,
    finalPrice,
    companyType,
    company,
    date,
    linkAsEquivalent = null,
  } = req.body;

  if (!productCode || !productName || finalPrice == null || !companyType || !date) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const createRelationAndClean = (idListaPrecios, idListaInterna) => {
    return new Promise((resolve, reject) => {
      const checkSQL = `SELECT 1 FROM relacion_articulos WHERE id_lista_precios = ? AND id_lista_interna = ?`;
      db.get(checkSQL, [idListaPrecios, idListaInterna], (err, row) => {
        if (err) return reject(err);
        if (row) return resolve();

        const insertRelSQL = `INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion) VALUES (?, ?, 'automatic')`;
        db.run(insertRelSQL, [idListaPrecios, idListaInterna], function (err2) {
          if (err2) return reject(err2);

          db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [idListaPrecios]);
          db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [idListaInterna]);
          resolve();
        });
      });
    });
  };

  if (companyType === 'Proveedor') {
    const selectExactSQL = `
      SELECT * FROM lista_precios 
      WHERE LOWER(cod_externo) = LOWER(?) AND LOWER(nom_externo) = LOWER(?) 
        AND proveedor = ? AND tipo_empresa = ?
    `;
    db.get(selectExactSQL, [productCode, productName, company, companyType], async (err, exactProduct) => {
      if (err) return res.status(500).json({ error: 'Error base de datos' });

      try {
        if (exactProduct) {
          const updates = [];
          const params = [];

          if (exactProduct.precio_final !== finalPrice) {
            updates.push('precio_final = ?');
            params.push(finalPrice);
          }

          if (updates.length > 0) {
            params.push(productCode, productName, company, companyType);
            const updateSQL = `
              UPDATE lista_precios 
              SET ${updates.join(', ')} 
              WHERE LOWER(cod_externo) = LOWER(?) AND LOWER(nom_externo) = LOWER(?) 
                AND proveedor = ? AND tipo_empresa = ?
            `;
            await new Promise((resolve, reject) => {
              db.run(updateSQL, params, (e) => (e ? reject(e) : resolve()));
            });
          }

          return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
        }

        const insertSQL = `
          INSERT INTO lista_precios 
          (cod_externo, nom_externo, precio_final, tipo_empresa, fecha, proveedor) 
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        db.run(insertSQL, [productCode, productName, finalPrice, companyType, date, company], function (e) {
          if (e) return res.status(500).json({ error: 'Error base de datos' });

          const newId = this.lastID;

          const selectGampackSQL = `
            SELECT * FROM lista_interna 
            WHERE LOWER(cod_interno) = LOWER(?) OR LOWER(nom_interno) = LOWER(?) 
            LIMIT 1
          `;
          db.get(selectGampackSQL, [productCode, productName], async (err2, gampackProd) => {
            if (err2) return res.status(500).json({ error: 'Error base de datos' });

            if (gampackProd && linkAsEquivalent !== false) {
              try {
                await createRelationAndClean(newId, gampackProd.id_interno);
                return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
              } catch (error) {
                return res.status(500).json({ error: 'Error creando relación' });
              }
            }

            const motivo = gampackProd ? 'Usuario rechazó sugerencia de relación' : 'No se encontró coincidencia por código ni nombre';
            db.run(`INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`, [newId, motivo], (err3) => {
              if (err3) return res.status(500).json({ error: 'Error base de datos' });
              return res.status(201).json({ success: true, message: 'Producto creado - no relacionados' });
            });
          });
        });
      } catch (error) {
        return res.status(500).json({ error: 'Error interno' });
      }
    });
  } else if (companyType === 'Gampack') {
    const selectExactSQL = `
      SELECT * FROM lista_interna 
      WHERE LOWER(cod_interno) = LOWER(?) AND LOWER(nom_interno) = LOWER(?)
    `;
    db.get(selectExactSQL, [productCode, productName], async (err, exactProduct) => {
      if (err) return res.status(500).json({ error: 'Error base de datos' });

      try {
        if (exactProduct) {
          if (exactProduct.precio_final !== finalPrice) {
            const updateSQL = `
              UPDATE lista_interna 
              SET precio_final = ? 
              WHERE LOWER(cod_interno) = LOWER(?) AND LOWER(nom_interno) = LOWER(?)
            `;
            await new Promise((resolve, reject) => {
              db.run(updateSQL, [finalPrice, productCode, productName], (e) => (e ? reject(e) : resolve()));
            });
          }

          return res.status(200).json({ success: true, updated: true, message: 'Producto actualizado' });
        }

        const insertSQL = `
          INSERT INTO lista_interna 
          (cod_interno, nom_interno, precio_final, fecha) 
          VALUES (?, ?, ?, ?)
        `;
        db.run(insertSQL, [productCode, productName, finalPrice, date], function (e) {
          if (e) return res.status(500).json({ error: 'Error base de datos' });

          const newId = this.lastID;

          const selectProveedorSQL = `
            SELECT * FROM lista_precios 
            WHERE LOWER(cod_externo) = LOWER(?) OR LOWER(nom_externo) = LOWER(?) 
            LIMIT 1
          `;
          db.get(selectProveedorSQL, [productCode, productName], async (err2, proveedorProd) => {
            if (err2) return res.status(500).json({ error: 'Error base de datos' });

            if (proveedorProd && linkAsEquivalent !== false) {
              try {
                await createRelationAndClean(proveedorProd.id_externo, newId);
                return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
              } catch (error) {
                return res.status(500).json({ error: 'Error creando relación' });
              }
            }

            const motivo = proveedorProd ? 'Usuario rechazó sugerencia de relación' : 'No se encontró coincidencia por código ni nombre';
            db.run(`INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo) VALUES (?, ?)`, [newId, motivo], (err3) => {
              if (err3) return res.status(500).json({ error: 'Error base de datos' });
              return res.status(201).json({ success: true, message: 'Producto creado - no relacionados' });
            });
          });
        });
      } catch (error) {
        return res.status(500).json({ error: 'Error interno' });
      }
    });
  } else {
    return res.status(400).json({ error: 'Tipo de empresa no válido' });
  }
});

// ---------- BORRAR RELACIÓN + productos asociados ----------
app.delete('/api/relacion/:id', (req, res) => {
  const db = req.ctx.db;
  const id = req.params.id;
  console.log('🟠 DELETE recibido para id:', id);

  if (isNaN(Number(id))) {
    console.log('🔴 ID inválido:', id);
    return res.status(400).json({ error: 'ID inválido' });
  }

  const sqlGetRelation = `
    SELECT id_lista_precios, id_lista_interna 
    FROM relacion_articulos 
    WHERE id = ?
  `;

  db.get(sqlGetRelation, [id], (err, row) => {
    if (err) {
      console.error('❌ Error al buscar relación:', err.message);
      return res.status(500).json({ error: 'Error en base de datos' });
    }

    if (!row) {
      console.log('⚠️ Relación no encontrada para id:', id);
      return res.status(404).json({ error: 'Relación no encontrada' });
    }

    console.log('🟢 Relación encontrada:', row);

    const { id_lista_precios, id_lista_interna } = row;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`DELETE FROM relacion_articulos WHERE id = ?`, [id], function (errDelRel) {
        if (errDelRel) {
          console.error('❌ Error eliminando relación:', errDelRel.message);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error eliminando relación' });
        }

        console.log(`✅ Relación con id=${id} eliminada, filas afectadas: ${this.changes}`);

        db.run(`DELETE FROM lista_precios WHERE id_externo = ?`, [id_lista_precios], function (errDelProv) {
          if (errDelProv) {
            console.error('❌ Error eliminando producto proveedor:', errDelProv.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error eliminando producto proveedor' });
          }

          console.log(`✅ Producto proveedor eliminado, filas afectadas: ${this.changes}`);

          db.run(`DELETE FROM lista_interna WHERE id_interno = ?`, [id_lista_interna], function (errDelInt) {
            if (errDelInt) {
              console.error('❌ Error eliminando producto interno:', errDelInt.message);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Error eliminando producto interno' });
            }

            console.log(`✅ Producto interno eliminado, filas afectadas: ${this.changes}`);

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('❌ Error haciendo commit:', commitErr.message);
                return res.status(500).json({ error: 'Error en la base de datos' });
              }

              console.log('🟢 Eliminación confirmada con COMMIT');
              res.status(200).json({ success: true, message: 'Relación y productos eliminados correctamente' });
            });
          });
        });
      });
    });
  });
});

// ---------- COMPARACIONES DE PRECIOS ----------
app.get('/api/price-comparisons', (req, res) => {
  const db = req.ctx.db;
  const search = (req.query.search || '').toString().toLowerCase();
  const dateFrom = (req.query.dateFrom || '').toString(); // YYYY-MM-DD
  const dateTo = (req.query.dateTo || '').toString();     // YYYY-MM-DD
  const familia = (req.query.familia || '').toString().toLowerCase();
  const onlyRelated = String(req.query.onlyRelated || '0') === '1';

  // ⬇️ CAMBIO CLAVE: por defecto usamos fecha de RELACIÓN,
  // y si onlyRelated=1, forzamos sí o sí fecha de RELACIÓN.
  let dateMode = (req.query.dateMode || 'relation').toString(); // 'product' | 'relation'
  if (onlyRelated) dateMode = 'relation';

  const hasFrom = !!dateFrom;
  const hasTo = !!dateTo;
  const hasFamilia = !!familia;

  const like = `%${search}%`;
  const familiaLike = `%${familia}%`;

  const applySearch = (cols) =>
    search ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';
  const applyFamilia = (cols) =>
    hasFamilia ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';

  // Usa DATE(...) para que SQLite compare solo fecha (no hora)
  const buildDateRange = (col /* ya con DATE(...) */) => {
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
    wherePairs.push(`${relDateRange}`);
    if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
    else if (hasFrom) paramsPairs.push(dateFrom);
    else paramsPairs.push(dateTo);
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

  // Internos solo (no relacionados)
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

  // Externos solo (no relacionados)
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
      ORDER BY DATE(sortDate) DESC
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
      ORDER BY DATE(sortDate) DESC
      LIMIT 1000
    `;
    params = [...paramsPairs, ...paramsInternal, ...paramsExternal];
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener comparaciones de precios:', err.message);
      return res.status(500).json({ error: 'Error al obtener comparaciones de precios' });
    }

    const results = rows.map(row => {
      const internal = row.internalFinalPrice ?? null;
      const external = row.externalFinalPrice ?? null;
      const priceDifference =
        external && external !== 0 && internal != null
          ? parseFloat((((internal - external) / external) * 100).toFixed(2))
          : null;

      return {
        internalProduct: row.internalProduct || null,
        externalProduct: row.externalProduct || null,
        supplier: row.supplier || null,
        internalFinalPrice: internal,
        externalFinalPrice: external,
        internalDate: row.internalDate || null,
        externalDate: row.externalDate || null,
        relationDate: row.relationDate || null,
        companyType: row.companyType === 'Gampack' ? 'supplier' : 'competitor',
        saleConditions: row.saleConditions || 'Desconocido',
        priceDifference,
      };
    });

    res.json(results);
  });
});

// ---------- RELACIONADOS POR CÓDIGO ----------
app.get('/api/gampack/:codigo/relacionados', (req, res) => {
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
    WHERE li.cod_interno = ?
  `;

  db.all(sql, [codInterno], (err, rows) => {
    if (err) {
      console.error('Error al obtener productos relacionados:', err.message);
      return res.status(500).json({ error: 'Error al obtener productos relacionados' });
    }

    const data = rows.map(row => ({
      name: row.name,
      price: row.price,
      supplier: row.supplier,
      externalDate: row.externalDate,
      priceDifference: row.price - row.internalPrice,
      percentageDifference: row.internalPrice !== 0
        ? ((row.price - row.internalPrice) / row.internalPrice * 100).toFixed(2)
        : 0
    }));

    res.json(data);
  });
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
      console.log('Headers (fila seleccionada):', headersRaw);

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

      const proveedorCanon = normalizeLabel(providerHint);
      const proveedorLower = normLower(providerHint);

      const getExistingInterno = async ({ codigo, nombre }) => {
        const nombreN = normalizeLabel(nombre);
        if (codigo) {
          const byCode = await get(
            `SELECT id_interno AS id, precio_final AS price
             FROM lista_interna
             WHERE TRIM(LOWER(cod_interno)) = TRIM(LOWER(?))
             LIMIT 1`,
            [codigo]
          );
          if (byCode) return byCode;
        }
        const byName = await get(
          `SELECT id_interno AS id, precio_final AS price
           FROM lista_interna
           WHERE TRIM(LOWER(nom_interno)) = TRIM(LOWER(?))
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
             WHERE TRIM(LOWER(proveedor)) = ?
               AND TRIM(LOWER(cod_externo)) = TRIM(LOWER(?))
             LIMIT 1`,
            [proveedorLower, codigo]
          );
          if (byCode) return byCode;
        }
        const byName = await get(
          `SELECT id_externo AS id, precio_final AS price
           FROM lista_precios
           WHERE TRIM(LOWER(proveedor)) = ?
             AND TRIM(LOWER(nom_externo)) = TRIM(LOWER(?))
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
             SET nom_interno = ?, precio_final = ?, fecha = ?
             WHERE id_interno = ?`,
            [nombreN, price, today, existing.id]
          );
          updated++;
          if (existing.price !== price) updatedPriceChanged++;
          return existing.id;
        } else {
          const ins = await run(
            `INSERT INTO lista_interna (nom_interno, cod_interno, precio_final, fecha)
             VALUES (?, ?, ?, ?)`,
            [nombreN, codigoN, price, today]
          );
          inserted++;
          return ins.lastID;
        }
      };

      const upsertListaPrecios = async ({ nombre, codigo, price, proveedorCanon, proveedorLower, today }) => {
        const nombreN = normalizeLabel(nombre);
        const codigoN = codigo ? normalizeLabel(codigo) : null;
        const existing = await getExistingExterno({ proveedorLower, codigo: codigoN, nombre: nombreN });

        if (existing?.id) {
          await run(
            `UPDATE lista_precios
             SET nom_externo = ?, precio_final = ?, tipo_empresa = 'Proveedor', fecha = ?
             WHERE id_externo = ?`,
            [nombreN, price, today, existing.id]
          );
          updated++;
          if (existing.price !== price) updatedPriceChanged++;
          return existing.id;
        } else {
          const ins = await run(
            `INSERT INTO lista_precios (nom_externo, cod_externo, precio_final, tipo_empresa, fecha, proveedor)
             VALUES (?, ?, ?, 'Proveedor', ?, ?)`,
            [nombreN, codigoN, price, today, proveedorCanon]
          );
          inserted++;
          return ins.lastID;
        }
      };

      await run('BEGIN TRANSACTION');
      try {
        for (const r of rows) {
          const nombre = String(getCell(r, colNom) ?? '');
          const nombreN = normalizeLabel(nombre);
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
              await run(
                `INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo)
                 VALUES (?, ?)`,
                [idInterno, 'Importado vía carga masiva']
              );
            }
          } else {
            const idExterno = await upsertListaPrecios({
              nombre: nombreN, codigo, price, proveedorCanon, proveedorLower, today
            });
            if (idExterno) {
              await run(
                `INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo)
                 VALUES (?, ?)`,
                [idExterno, 'Importado vía carga masiva']
              );
            }
          }
        }

        await run('COMMIT');

        const message = `Importación finalizada: ${updated} modificados (${updatedPriceChanged} con cambio de precio) y ${inserted} nuevos.${skipped ? ` Omitidos: ${skipped}.` : ''}`;

        return res.json({
          ok: true,
          isGampack,
          source: sourceFilename || req.file.originalname,
          header_row_used: headerRow1,
          counts: {
            inserted,
            updated,
            updated_price_changed: updatedPriceChanged,
            skipped
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
app.post('/api/login', (req, res) => {
  const db = req.ctx.db; // usa la DB por default (ventas) solo para leer users; si tenés tabla users separada, apuntá a donde corresponda
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' });
  }

  db.get(
    `SELECT * FROM users WHERE username = ? AND password = ?`,
    [username, password],
    (err, row) => {
      if (err) {
        console.error('Error en login:', err.message);
        return res.status(500).json({ error: 'Error en base de datos' });
      }
      if (!row) {
        return res.status(401).json({ error: 'Credenciales inválidas' });
      }

      // Derivar tenant desde el rol
      const role = (row.role || '').toLowerCase();
      const tenant = role === 'compra' ? 'compra' : 'venta';

      // Seteamos cookie firmada
      res.cookie('tenant', tenant, {
        httpOnly: true,
        sameSite: 'lax',
        signed: true,
        // maxAge: 7 días
        maxAge: 7 * 24 * 60 * 60 * 1000
      });

      return res.json({
        success: true,
        username: row.username,
        role: row.role,
        tenant
      });
    }
  );
});

// ---------- STATS ----------
app.get('/api/stats', (req, res) => {
  const db = req.ctx.db;
  const today = new Date().toISOString().slice(0,10); // YYYY-MM-DD

  const q = {
    internalCount: `SELECT COUNT(*) AS c FROM lista_interna`,
    externalCount: `SELECT COUNT(*) AS c FROM lista_precios`,
    activeSuppliers: `SELECT COUNT(DISTINCT proveedor) AS c FROM lista_precios`,
    suppliersWithNewPriceToday: `SELECT COUNT(DISTINCT proveedor) AS c FROM lista_precios WHERE fecha = ?`,
    pendingExternal: `SELECT COUNT(*) AS c FROM articulos_no_relacionados`,
    pendingInternal: `SELECT COUNT(*) AS c FROM articulos_gampack_no_relacionados`,
  };

  const runGet = (sql, params=[]) =>
    new Promise((resolve, reject) => {
      db.get(sql, params, (err, row) => err ? reject(err) : resolve(row?.c ?? 0));
    });

  (async () => {
    try {
      const [
        internalCount,
        externalCount,
        activeSuppliers,
        suppliersWithNewPriceToday,
        pendingExternal,
        pendingInternal,
      ] = await Promise.all([
        runGet(q.internalCount),
        runGet(q.externalCount),
        runGet(q.activeSuppliers),
        runGet(q.suppliersWithNewPriceToday, [today]),
        runGet(q.pendingExternal),
        runGet(q.pendingInternal),
      ]);

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
  })();
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
        const rr = await get(`SELECT id_interno FROM lista_interna WHERE TRIM(LOWER(cod_interno)) = TRIM(LOWER(?)) LIMIT 1`, [codigo]);
        if (rr) idInterno = rr.id_interno;
      }
      if (!idInterno && nombre) {
        const rr = await get(`SELECT id_interno FROM lista_interna WHERE TRIM(LOWER(nom_interno)) = TRIM(LOWER(?)) LIMIT 1`, [nombre]);
        if (rr) idInterno = rr.id_interno;
      }
      if (!idInterno) { missProd++; continue; }

      const rub = await get(`SELECT id FROM rubros WHERE LOWER(nombre)=LOWER(?)`, [rubro]);
      const idRubro = rub?.id ?? null;
      if (!idRubro) { missRubro++; continue; }

      await run(
        `INSERT INTO producto_rubro(id_interno, id_rubro)
         VALUES(?,?)
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
app.delete('/api/no-relacionados/externos/:id', (req, res) => {
  if (req.ctx?.tenant === 'compra') return res.status(404).json({ error: 'no_disponible_en_compras' });
  const db = req.ctx.db;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id_invalido' });

  db.serialize(() => {
    db.run('BEGIN');
    db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [id], (e1) => {
      if (e1) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
      db.run(`DELETE FROM lista_precios WHERE id_externo = ?`, [id], function (e2) {
        if (e2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
        db.run('COMMIT', (e3) => {
          if (e3) return res.status(500).json({ error: 'db_error' });
          return res.json({ ok: true, deleted: this?.changes ?? 1 });
        });
      });
    });
  });
});

app.post('/api/no-relacionados/externos/delete', (req, res) => {
  if (req.ctx?.tenant === 'compra') return res.status(404).json({ error: 'no_disponible_en_compras' });
  const db = req.ctx.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids_requeridos' });

  const placeholders = ids.map(() => '?').join(',');
  db.serialize(() => {
    db.run('BEGIN');
    db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios IN (${placeholders})`, ids, (e1) => {
      if (e1) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
      db.run(`DELETE FROM lista_precios WHERE id_externo IN (${placeholders})`, ids, function (e2) {
        if (e2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
        db.run('COMMIT', (e3) => {
          if (e3) return res.status(500).json({ error: 'db_error' });
          res.json({ ok: true, deleted: this?.changes ?? 0 });
        });
      });
    });
  });
});

// ---------- NO RELACIONADOS: delete single/bulk (INTERNOS) ----------
app.delete('/api/no-relacionados/internos/:id', (req, res) => {
  const db = req.ctx.db;
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'id_invalido' });

  db.serialize(() => {
    db.run('BEGIN');
    db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [id], (e1) => {
      if (e1) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
      db.run(`DELETE FROM lista_interna WHERE id_interno = ?`, [id], function (e2) {
        if (e2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
        db.run('COMMIT', (e3) => {
          if (e3) return res.status(500).json({ error: 'db_error' });
          return res.json({ ok: true, deleted: this?.changes ?? 1 });
        });
      });
    });
  });
});

app.post('/api/no-relacionados/internos/delete', (req, res) => {
  const db = req.ctx.db;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : [];
  if (ids.length === 0) return res.status(400).json({ error: 'ids_requeridos' });

  const placeholders = ids.map(() => '?').join(',');
  db.serialize(() => {
    db.run('BEGIN');
    db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna IN (${placeholders})`, ids, (e1) => {
      if (e1) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
      db.run(`DELETE FROM lista_interna WHERE id_interno IN (${placeholders})`, ids, function (e2) {
        if (e2) { db.run('ROLLBACK'); return res.status(500).json({ error: 'db_error' }); }
        db.run('COMMIT', (e3) => {
          if (e3) return res.status(500).json({ error: 'db_error' });
          res.json({ ok: true, deleted: this?.changes ?? 0 });
        });
      });
    });
  });
});


module.exports = app;
