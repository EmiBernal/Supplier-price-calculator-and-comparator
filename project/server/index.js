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
      externalDate: row.fecha_externo, // fecha del producto externo
      internalSupplier: 'Gampack',
      internalCode: row.cod_interno,
      internalName: row.nom_interno,
      internalDate: row.fecha_interno, // fecha del producto interno
      relationDate: row.relation_created_at, // <-- NUEVO: fecha de la relación
      matchingCriteria: row.criterio_relacion,
    }));

    res.json(result);
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// === EDITAR RELACIÓN + DATOS ASOCIADOS ===
function toYMD(s) {
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

app.put('/api/relacion/:id', (req, res) => {
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
        // Coherencia: mantenemos el pareo fijo
        if (rel.id_lista_precios !== lp.id_externo || rel.id_lista_interna !== li.id_interno) {
          db.run('ROLLBACK');
          return res.status(400).json({ success: false, message: 'IDs no coinciden con la relación' });
        }

        // UPDATE lista_precios
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

            // UPDATE lista_interna
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

app.get('/api/providers/summary', (req, res) => {
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
  const onlyRelated = String(req.query.onlyRelated || '0') === '1';
  const dateMode = (req.query.dateMode || 'product').toString(); // 'product' | 'relation'

  const hasFrom = !!dateFrom;
  const hasTo = !!dateTo;
  const hasFamilia = !!familia;

  const like = `%${search}%`;
  const familiaLike = `%${familia}%`;

  const applySearch = (cols) =>
    search ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';
  const applyFamilia = (cols) =>
    hasFamilia ? '(' + cols.map(c => `LOWER(${c}) LIKE ?`).join(' OR ') + ')' : '1=1';

  // helpers de rango según columna
  const buildDateRange = (col) => {
    if (hasFrom && hasTo) return `${col} BETWEEN ? AND ?`;
    if (hasFrom) return `${col} >= ?`;
    if (hasTo) return `${col} <= ?`;
    return '';
  };

  // columnas de fecha según modo
  const liDateRange = dateMode === 'product' ? buildDateRange('li.fecha') : '';
  const lpDateRange = dateMode === 'product' ? buildDateRange('lp.fecha') : '';
  const relDateRange = dateMode === 'relation' ? buildDateRange("DATE(ra.created_at)") : '';

  // ---------- SELECT: Pares relacionados ----------
  const wherePairs = [applySearch(['li.nom_interno', 'lp.nom_externo', 'lp.proveedor'])];
  const paramsPairs = search ? [like, like, like] : [];

  if (hasFamilia) {
    // si no tenés columnas 'familia', podés quitar esto o ajustarlo
    wherePairs.push(applyFamilia(['li.familia', 'lp.familia']));
    paramsPairs.push(familiaLike, familiaLike);
  }

  if (dateMode === 'product' && (hasFrom || hasTo)) {
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
        ? `ra.created_at`
        : `COALESCE(li.fecha, lp.fecha)`} AS sortDate
    FROM relacion_articulos ra
    JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    WHERE ${wherePairs.join(' AND ')}
  `;

  // ---------- SELECT: Internos sin pareja ----------
  const whereInternal = ['ra.id_lista_precios IS NULL', applySearch(['li.nom_interno'])];
  const paramsInternal = search ? [like] : [];
  if (hasFamilia) {
    whereInternal.push(applyFamilia(['li.familia']));
    paramsInternal.push(familiaLike);
  }
  if (dateMode === 'product') {
    const dr = buildDateRange('li.fecha');
    if (dr) {
      whereInternal.push(`li.fecha IS NOT NULL AND ${dr}`);
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
      li.fecha AS sortDate
    FROM lista_interna li
    LEFT JOIN relacion_articulos ra ON ra.id_lista_interna = li.id_interno
    WHERE ${whereInternal.join(' AND ')}
  `;

  // ---------- SELECT: Proveedores sin pareja ----------
  const whereExternal = ['ra.id_lista_interna IS NULL', applySearch(['lp.nom_externo', 'lp.proveedor'])];
  const paramsExternal = search ? [like, like] : [];
  if (hasFamilia) {
    whereExternal.push(applyFamilia(['lp.familia']));
    paramsExternal.push(familiaLike);
  }
  if (dateMode === 'product') {
    const dr = buildDateRange('lp.fecha');
    if (dr) {
      whereExternal.push(`lp.fecha IS NOT NULL AND ${dr}`);
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
      lp.fecha AS sortDate
    FROM lista_precios lp
    LEFT JOIN relacion_articulos ra ON ra.id_lista_precios = lp.id_externo
    WHERE ${whereExternal.join(' AND ')}
  `;

  // ---------- Construcción final ----------
  let sql, params;
  if (onlyRelated) {
    sql = `
      ${sqlPairs}
      ORDER BY datetime(sortDate) DESC
      LIMIT 1000
    `;
    params = [...paramsPairs];
  } else {
    // Nota: cuando dateMode = 'relation', los "sin pareja" no aplican (no hay relación),
    // así que solo tendrán filtro por fecha si dateMode='product'.
    sql = `
      ${sqlPairs}
      UNION ALL
      ${sqlInternalOnly}
      UNION ALL
      ${sqlExternalOnly}
      ORDER BY datetime(sortDate) DESC
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
        relationDate: row.relationDate || null,  // <-- NUEVO, útil para UI
        companyType: row.companyType === 'Gampack' ? 'supplier' : 'competitor',
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

      // --- XLSX ---
      const wb = XLSX.read(req.file.buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];

      // Leemos hoja completa como matriz
      const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: '' });
      const headersRaw = (matrix[headerIndex0] || []).map(v => String(v ?? ''));
      const dataRows = matrix.slice(headerIndex0 + 1);
      console.log('Headers (fila seleccionada):', headersRaw);

      // Matriz -> objetos (keys = encabezados crudos)
      const rows = dataRows.map(arr => {
        const obj = {};
        for (let i = 0; i < headersRaw.length; i++) {
          const k = String(headersRaw[i] ?? '');
          obj[k] = arr?.[i] ?? '';
        }
        return obj;
      });

      // --- Helpers comunes ---
      const normalizeLabel = (v) => String(v ?? '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();
      const normLower = (v) => normalizeLabel(v).toLowerCase();

      const getCell = (row, key) => {
        if (!key) return '';
        if (key in row) return row[key];
        const nk = normLower(key);
        const realKey = Object.keys(row).find(k => normLower(k) === nk);
        return realKey ? row[realKey] : '';
      };

      const parseNumberAR = (value) => {
        if (value == null) return null;
        let s = String(value).trim();
        // elimina miles ".", cambia coma decimal por ".", quita $ y letras
        s = s.replace(/\./g, '').replace(',', '.').replace(/[$\sA-Za-z]/g, '');
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

      // Columnas mapeadas (precio y nombre obligatorios; código opcional)
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

      // Contadores
      let inserted = 0;
      let updated = 0;
      let updatedPriceChanged = 0;
      let skipped = 0;

      // Normalización proveedor (externos)
      const proveedorCanon = normalizeLabel(providerHint);  // se guarda así
      const proveedorLower = normLower(providerHint);       // se compara así

      // --------- RESOLVER EXISTENTES (devuelve id + precio actual) ---------
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

      // --------- UPSERTS ---------
      const upsertListaInterna = async ({ nombre, codigo, price, today }) => {
        const nombreN = normalizeLabel(nombre);
        const codigoN = codigo ? normalizeLabel(codigo) : null;
        const existing = await getExistingInterno({ codigo: codigoN, nombre: nombreN });

        if (existing?.id) {
          // update
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
          // insert
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
          // update
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
          // insert
          const ins = await run(
            `INSERT INTO lista_precios (nom_externo, cod_externo, precio_final, tipo_empresa, fecha, proveedor)
             VALUES (?, ?, ?, 'Proveedor', ?, ?)`,
            [nombreN, codigoN, price, today, proveedorCanon]
          );
          inserted++;
          return ins.lastID;
        }
      };

      // ---------- LOOP PRINCIPAL ----------
      await run('BEGIN TRANSACTION');
      try {
        for (const r of rows) {
          const nombre = String(getCell(r, colNom) ?? '');
          const nombreN = normalizeLabel(nombre);
          const codigoRaw = colCod ? String(getCell(r, colCod) ?? '') : '';
          const codigo = normalizeLabel(codigoRaw) || null;
          const precioRaw = getCell(r, colPrecio);
          const price = typeof precioRaw === 'number' ? precioRaw : parseNumberAR(precioRaw);

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
          processed: inserted + updated, // 👈 agregado para compatibilidad
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

app.get('/api/stats', (req, res) => {
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

module.exports = app;
