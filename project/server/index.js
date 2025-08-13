const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const multerLib = require('multer');
const multer = multerLib.default || multerLib;
const XLSX = require('xlsx');

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

const upload = multer({
  limits: { fileSize: 25 * 1024 * 1024}
});

const dbPath = path.join(__dirname, 'db/database.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) console.error('Error al conectar con SQLite:', err.message);
  else console.log('Conectado a la base de datos SQLite en', dbPath);
});

// === Helpers ===
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

/* ======== Rutas ======== */

app.get('/api/equivalencias', (req, res) => {
  const search = req.query.search;
  const params = [];

  let sql = `
    SELECT 
      ra.id,
      ra.id_lista_precios,
      ra.id_lista_interna,
      ra.criterio_relacion,
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

  sql += ' ORDER BY lp.fecha DESC';

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error al obtener equivalencias:', err.message);
      return res.status(500).json({ error: 'Error al obtener equivalencias' });
    }

    const result = rows.map(row => ({
      id: row.id,
      supplier: row.proveedor,
      externalCode: row.cod_externo,
      externalName: row.nom_externo,
      externalDate: row.fecha_externo,
      internalSupplier: 'Gampack',
      internalCode: row.cod_interno,
      internalName: row.nom_interno,
      internalDate: row.fecha_interno,
      matchingCriteria: row.criterio_relacion,
    }));

    res.json(result);
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/api/lista_precios', (req, res) => {
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

app.get('/api/no-relacionados/proveedores', (req, res) => {
  const sql = `
    SELECT lp.*, anr.motivo 
    FROM articulos_no_relacionados anr
    JOIN lista_precios lp ON anr.id_lista_precios = lp.id_externo
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener productos externos no relacionados:', err.message);
      return res.status(500).json({ error: 'Error al obtener productos externos no relacionados' });
    }
    res.json(rows);
  });
});

app.get('/api/no-relacionados/gampack', (req, res) => {
  const sql = `
    SELECT li.*, agnr.motivo 
    FROM articulos_gampack_no_relacionados agnr
    JOIN lista_interna li ON agnr.id_lista_interna = li.id_interno
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener productos internos no relacionados:', err.message);
      return res.status(500).json({ error: 'Error al obtener productos internos no relacionados' });
    }
    res.json(rows);
  });
});

app.post('/api/check-product', (req, res) => {
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

app.get('/api/relaciones', (req, res) => {
  const sql = `
    SELECT r.*, 
           lp.cod_externo, lp.nom_externo, 
           li.cod_interno, li.nom_interno
    FROM relacion_articulos r
    LEFT JOIN lista_precios lp ON r.id_lista_precios = lp.id_externo
    LEFT JOIN lista_interna li ON r.id_lista_interna = li.id_interno
    ORDER BY r.id DESC
  `;

  db.all(sql, [], (err, rows) => {
    if (err) {
      console.error('Error al obtener relaciones:', err.message);
      return res.status(500).json({ error: 'Error al obtener relaciones' });
    }
    res.json(rows);
  });
});

app.post('/api/relacionar-manual', (req, res) => {
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

function checkEquivalenceAndInsertNoRelacionado(productId, code, name, tipo, callback) {
  let checkSQL = '';
  let params = [];
  let insertNoRelacionadoSQL = '';
  let insertNoRelacionadoParams = [];

  if (tipo === 'Proveedor') {
    checkSQL = `SELECT * FROM lista_interna WHERE LOWER(cod_interno) = LOWER(?) OR LOWER(nom_interno) = LOWER(?) LIMIT 1`;
    params = [code, name];
    insertNoRelacionadoSQL = `INSERT INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`;
    insertNoRelacionadoParams = [productId, 'No se encontró coincidencia por código ni nombre'];
  } else if (tipo === 'Gampack') {
    checkSQL = `SELECT * FROM lista_precios WHERE LOWER(cod_externo) = LOWER(?) OR LOWER(nom_externo) = LOWER(?) LIMIT 1`;
    params = [code, name];
    insertNoRelacionadoSQL = `INSERT INTO articulos_gampack_no_relacionados (id_lista_interna, motivo) VALUES (?, ?)`;
    insertNoRelacionadoParams = [productId, 'No se encontró coincidencia por código ni nombre'];
  } else {
    callback(new Error('Tipo inválido para equivalencia'));
    return;
  }

  db.get(checkSQL, params, (err, row) => {
    if (err) {
      console.error('Error chequeando equivalencia:', err.message);
      callback(err);
      return;
    }

    if (!row) {
      db.run(insertNoRelacionadoSQL, insertNoRelacionadoParams, function (err) {
        if (err) {
          console.error('Error insertando en no relacionados:', err.message);
          callback(err);
          return;
        }
        console.log('Producto agregado a no relacionados');
        callback(null);
      });
    } else {
      callback(null);
    }
  });
}

app.post('/api/products', (req, res) => {
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

          return res.status(200).json({ success: true, updated: updates.length > 0, message: 'Producto actualizado' });
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
              return res.status(201).json({ success: true, message: 'Producto creado' });
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

          return res.status(200).json({ success: true, message: 'Producto actualizado' });
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
              return res.status(201).json({ success: true, message: 'Producto creado' });
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

app.delete('/api/relacion/:id', (req, res) => {
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

app.get('/api/price-comparisons', (req, res) => {
  const search = (req.query.search || '').toString().toLowerCase();
  const dateFrom = (req.query.dateFrom || '').toString(); // YYYY-MM-DD
  const dateTo = (req.query.dateTo || '').toString();     // YYYY-MM-DD
  const familia = (req.query.familia || '').toString().toLowerCase();

  const hasFrom = !!dateFrom;
  const hasTo = !!dateTo;
  const hasFamilia = !!familia;

  const like = `%${search}%`;
  const familiaLike = `%${familia}%`;

  // Helpers
  const buildDateRange = (col) => {
    if (hasFrom && hasTo) return `${col} BETWEEN ? AND ?`;
    if (hasFrom) return `${col} >= ?`;
    if (hasTo) return `${col} <= ?`;
    return '';
  };
  const applySearch = (cols) =>
    search ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';
  const applyFamilia = (cols) =>
    hasFamilia ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';

  const liDateRange = buildDateRange('li.fecha');
  const lpDateRange = buildDateRange('lp.fecha');

  // ---------- SELECT 1: Pares relacionados (al menos una fecha en rango) ----------
  const wherePairs = [applySearch(['li.nom_interno', 'lp.nom_externo', 'lp.proveedor'])];
  const paramsPairs = search ? [like, like, like] : [];

  if (hasFamilia) {
    wherePairs.push(applyFamilia(['li.familia', 'lp.familia']));
    paramsPairs.push(familiaLike, familiaLike);
  }

  if (hasFrom || hasTo) {
    const dateConds = [];
    if (liDateRange) {
      dateConds.push(`(li.fecha IS NOT NULL AND ${liDateRange})`);
      if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
      else if (hasFrom) paramsPairs.push(dateFrom);
      else paramsPairs.push(dateTo);
    }
    if (lpDateRange) {
      dateConds.push(`(lp.fecha IS NOT NULL AND ${lpDateRange})`);
      if (hasFrom && hasTo) paramsPairs.push(dateFrom, dateTo);
      else if (hasFrom) paramsPairs.push(dateFrom);
      else paramsPairs.push(dateTo);
    }
    wherePairs.push('(' + dateConds.join(' OR ') + ')');
  }

  const sqlPairs = `
    SELECT 
      li.nom_interno AS internalProduct,
      lp.nom_externo AS externalProduct,
      lp.proveedor AS supplier,
      li.precio_final AS internalFinalPrice,
      lp.precio_final AS externalFinalPrice,
      li.fecha AS internalDate,
      lp.fecha AS externalDate,
      lp.tipo_empresa AS companyType,
      ra.criterio_relacion AS saleConditions,
      COALESCE(li.fecha, lp.fecha) AS sortDate
    FROM relacion_articulos ra
    JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    WHERE ${wherePairs.join(' AND ')}
  `;

  // ---------- SELECT 2: Internos sin pareja ----------
  const whereInternal = ['ra.id_lista_precios IS NULL', applySearch(['li.nom_interno'])];
  const paramsInternal = search ? [like] : [];

  if (hasFamilia) {
    whereInternal.push(applyFamilia(['li.familia']));
    paramsInternal.push(familiaLike);
  }
  if (liDateRange) {
    whereInternal.push(`li.fecha IS NOT NULL AND ${liDateRange}`);
    if (hasFrom && hasTo) paramsInternal.push(dateFrom, dateTo);
    else if (hasFrom) paramsInternal.push(dateFrom);
    else if (hasTo) paramsInternal.push(dateTo);
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
      li.fecha AS sortDate
    FROM lista_interna li
    LEFT JOIN relacion_articulos ra ON ra.id_lista_interna = li.id_interno
    WHERE ${whereInternal.join(' AND ')}
  `;

  // ---------- SELECT 3: Proveedores sin pareja ----------
  const whereExternal = ['ra.id_lista_interna IS NULL', applySearch(['lp.nom_externo', 'lp.proveedor'])];
  const paramsExternal = search ? [like, like] : [];

  if (hasFamilia) {
    whereExternal.push(applyFamilia(['lp.familia']));
    paramsExternal.push(familiaLike);
  }
  if (lpDateRange) {
    whereExternal.push(`lp.fecha IS NOT NULL AND ${lpDateRange}`);
    if (hasFrom && hasTo) paramsExternal.push(dateFrom, dateTo);
    else if (hasFrom) paramsExternal.push(dateFrom);
    else if (hasTo) paramsExternal.push(dateTo);
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
      lp.fecha AS sortDate
    FROM lista_precios lp
    LEFT JOIN relacion_articulos ra ON ra.id_lista_precios = lp.id_externo
    WHERE ${whereExternal.join(' AND ')}
  `;

  // ---------- UNION + ORDER ----------
  const sql = `
    ${sqlPairs}
    UNION ALL
    ${sqlInternalOnly}
    UNION ALL
    ${sqlExternalOnly}
    ORDER BY sortDate DESC
    LIMIT 1000
  `;

  const params = [...paramsPairs, ...paramsInternal, ...paramsExternal];

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
        companyType: row.companyType === 'Gampack' ? 'supplier' : 'competitor', // conserva tu lógica
        saleConditions: row.saleConditions || 'Desconocido',
        priceDifference,
      };
    });

    res.json(results);
  });
});

app.get('/api/gampack/:codigo/relacionados', (req, res) => {
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

app.post('/api/imports/lista-precios', upload.single('file'), (req, res) => {
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

      // Leemos TODA la hoja como matriz
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
      const headersRaw = (matrix[headerIndex0] || []).map(v => String(v ?? ''));
      const dataRows = matrix.slice(headerIndex0 + 1);
      console.log('Headers (fila seleccionada):', headersRaw);

      // Convertimos matriz -> objetos con claves = headers crudos
      const rows = dataRows.map(arr => {
        const obj = {};
        for (let i = 0; i < headersRaw.length; i++) {
          const k = String(headersRaw[i] ?? '');
          obj[k] = arr?.[i] ?? '';
        }
        return obj;
      });

      // Helpers
      const normalizeLabel = (v) => String(v ?? '').trim().replace(/\r?\n/g,' ').replace(/\s+/g,' ');
      const norm = (v) => normalizeLabel(v).toLowerCase();
      const getCell = (row, key) => {
        if (!key) return '';
        if (key in row) return row[key];
        const nk = norm(key);
        const realKey = Object.keys(row).find(k => norm(k) === nk);
        return realKey ? row[realKey] : '';
      };
      const parseNumberAR = (value) => {
        if (value == null) return null;
        let s = String(value).trim();
        s = s.replace(/\./g, '').replace(',', '.');
        s = s.replace(/[$\sA-Za-z]/g, '');
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
      };
      const run = (sql, params=[]) =>
        new Promise((resolve, reject) => db.run(sql, params, function (err) {
          if (err) reject(err); else resolve(this);
        }));
      const get = (sql, params=[]) =>
        new Promise((resolve, reject) => db.get(sql, params, function (err, row) {
          if (err) reject(err); else resolve(row);
        }));

      // Columnas (nombre+precio obligatorias; código opcional)
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
      let processed = 0;

      // Upserts que DEVUELVEN id para insertar en *_no_relacionados
      const upsertListaInterna = async (nombre, codigo, price) => {
        if (codigo) {
          const upd = await run(
            `UPDATE lista_interna
             SET nom_interno = ?, precio_final = ?, fecha = ?
             WHERE LOWER(cod_interno) = LOWER(?)`,
            [nombre, price, today, codigo]
          );
          if (!upd.changes) {
            const ins = await run(
              `INSERT INTO lista_interna (nom_interno, cod_interno, precio_final, fecha)
               VALUES (?, ?, ?, ?)`,
              [nombre, codigo, price, today]
            );
            return ins.lastID;
          } else {
            const row = await get(
              `SELECT id_interno FROM lista_interna WHERE LOWER(cod_interno) = LOWER(?) LIMIT 1`,
              [codigo]
            );
            return row?.id_interno ?? null;
          }
        } else {
          const upd = await run(
            `UPDATE lista_interna
             SET nom_interno = ?, precio_final = ?, fecha = ?
             WHERE LOWER(nom_interno) = LOWER(?)`,
            [nombre, price, today, nombre]
          );
          if (!upd.changes) {
            const ins = await run(
              `INSERT INTO lista_interna (nom_interno, cod_interno, precio_final, fecha)
               VALUES (?, NULL, ?, ?)`,
              [nombre, price, today]
            );
            return ins.lastID;
          } else {
            const row = await get(
              `SELECT id_interno FROM lista_interna WHERE LOWER(nom_interno) = LOWER(?) LIMIT 1`,
              [nombre]
            );
            return row?.id_interno ?? null;
          }
        }
      };

      const upsertListaPrecios = async (nombre, codigo, price, proveedor) => {
        if (codigo) {
          const upd = await run(
            `UPDATE lista_precios
             SET nom_externo = ?, precio_final = ?, tipo_empresa = 'Proveedor', fecha = ?
             WHERE proveedor = ? AND LOWER(cod_externo) = LOWER(?)`,
            [nombre, price, today, proveedor, codigo]
          );
          if (!upd.changes) {
            const ins = await run(
              `INSERT INTO lista_precios
               (nom_externo, cod_externo, precio_final, tipo_empresa, fecha, proveedor)
               VALUES (?, ?, ?, 'Proveedor', ?, ?)`,
              [nombre, codigo, price, today, proveedor]
            );
            return ins.lastID;
          } else {
            const row = await get(
              `SELECT id_externo FROM lista_precios WHERE proveedor = ? AND LOWER(cod_externo) = LOWER(?) LIMIT 1`,
              [proveedor, codigo]
            );
            return row?.id_externo ?? null;
          }
        } else {
          const upd = await run(
            `UPDATE lista_precios
             SET nom_externo = ?, precio_final = ?, tipo_empresa = 'Proveedor', fecha = ?
             WHERE proveedor = ? AND LOWER(nom_externo) = LOWER(?)`,
            [nombre, price, today, proveedor, nombre]
          );
          if (!upd.changes) {
            const ins = await run(
              `INSERT INTO lista_precios
               (nom_externo, cod_externo, precio_final, tipo_empresa, fecha, proveedor)
               VALUES (?, NULL, ?, 'Proveedor', ?, ?)`,
              [nombre, price, today, proveedor]
            );
            return ins.lastID;
          } else {
            const row = await get(
              `SELECT id_externo FROM lista_precios WHERE proveedor = ? AND LOWER(nom_externo) = LOWER(?) LIMIT 1`,
              [proveedor, nombre]
            );
            return row?.id_externo ?? null;
          }
        }
      };

      await run('BEGIN TRANSACTION');

      try {
        for (const r of rows) {
          const nombre = String(getCell(r, colNom) ?? '').trim();
          const codigoRaw = colCod ? String(getCell(r, colCod) ?? '').trim() : '';
          const codigo = codigoRaw || null;
          const precioRaw = getCell(r, colPrecio);
          const price = typeof precioRaw === 'number' ? precioRaw : parseNumberAR(precioRaw);

          if (!nombre || price == null || !Number.isFinite(price)) {
            continue; // sin nombre o sin precio => skip
          }

          if (isGampack) {
            const idInterno = await upsertListaInterna(nombre, codigo, price);
            if (idInterno) {
              await run(
                `INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo)
                 VALUES (?, ?)`,
                [idInterno, 'Importado vía carga masiva']
              );
              processed++;
            }
          } else {
            const idExterno = await upsertListaPrecios(nombre, codigo, price, providerHint);
            if (idExterno) {
              await run(
                `INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo)
                 VALUES (?, ?)`,
                [idExterno, 'Importado vía carga masiva']
              );
              processed++;
            }
          }
        }

        await run('COMMIT');
        return res.json({
          ok: true,
          processed,
          source: sourceFilename || req.file.originalname,
          header_row_used: headerRow1,
          saved_to: isGampack ? 'articulos_gampack_no_relacionados' : 'articulos_no_relacionados'
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

module.exports = app;
