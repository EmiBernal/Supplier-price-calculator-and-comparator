const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

const dbPath = path.join(__dirname, 'db/database.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite en', dbPath);
  }
});

app.use((req, res, next) => {
  console.log(`Petición: ${req.method} ${req.url}`);
  next();
});


app.get('/api/equivalencias', (req, res) => {
  const sql = `
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

  db.all(sql, [], (err, rows) => {
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
  const { id_lista_interna, id_lista_precios, criterio } = req.body;

  const sql = `
    INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
    VALUES (?, ?, ?)
  `;

  db.run(sql, [id_lista_precios, id_lista_interna, criterio || 'manual'], function (err) {
    if (err) {
      console.error('Error al crear relación manual:', err.message);
      return res.status(500).json({ error: 'No se pudo crear la relación' });
    }

    // Eliminar de tablas de no relacionados
    db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [id_lista_precios]);
    db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [id_lista_interna]);

    res.json({ success: true });
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
    netPrice,
    finalPrice,
    companyType,
    company,
    date,
    linkAsEquivalent = null,
  } = req.body;

  if (!productCode || !productName || netPrice == null || finalPrice == null || !companyType || !date) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  const createRelationAndClean = (idListaPrecios, idListaInterna) => {
    return new Promise((resolve, reject) => {
      console.log('🧩 Verificando si ya existe la relación');
      console.log('ID lista precios:', idListaPrecios);
      console.log('ID lista interna:', idListaInterna);

      const checkSQL = `SELECT 1 FROM relacion_articulos WHERE id_lista_precios = ? AND id_lista_interna = ?`;
      db.get(checkSQL, [idListaPrecios, idListaInterna], (err, row) => {
        if (err) return reject(err);
        if (row) {
          console.log('⚠️ La relación ya existe, no se inserta');
          return resolve();
        }

        console.log('✅ Insertando nueva relación...');
        const insertRelSQL = `INSERT INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion) VALUES (?, ?, 'automatic')`;
        db.run(insertRelSQL, [idListaPrecios, idListaInterna], function (err2) {
          if (err2) {
            console.error('❌ Error insertando relación:', err2.message);
            return reject(err2);
          }

          db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [idListaPrecios]);
          db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [idListaInterna]);
          console.log('🧹 Relación insertada correctamente y no relacionados limpiados');
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

          if (exactProduct.precio_neto !== netPrice) {
            updates.push('precio_neto = ?');
            params.push(netPrice);
          }
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
          (cod_externo, nom_externo, precio_neto, precio_final, tipo_empresa, fecha, proveedor) 
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        db.run(insertSQL, [productCode, productName, netPrice, finalPrice, companyType, date, company], function (e) {
          if (e) return res.status(500).json({ error: 'Error base de datos' });

          const newId = this.lastID;
          console.log('✅ Producto insertado en lista_precios con ID:', newId);

          const selectGampackSQL = `
            SELECT * FROM lista_interna 
            WHERE LOWER(cod_interno) = LOWER(?) OR LOWER(nom_interno) = LOWER(?) 
            LIMIT 1
          `;
          db.get(selectGampackSQL, [productCode, productName], async (err2, gampackProd) => {
            if (err2) return res.status(500).json({ error: 'Error base de datos' });

            console.log('🔍 ¿Existe match en lista_interna?', !!gampackProd);
            console.log('📩 linkAsEquivalent recibido:', linkAsEquivalent);

            if (gampackProd) {
              if (linkAsEquivalent !== false) {
                try {
                  await createRelationAndClean(newId, gampackProd.id_interno);
                  return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
                } catch (error) {
                  return res.status(500).json({ error: 'Error creando relación' });
                }
              } else {
                const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`;
                db.run(insertNoRelacionadosSQL, [newId, 'Usuario rechazó sugerencia de relación'], (err3) => {
                  if (err3) return res.status(500).json({ error: 'Error base de datos' });
                  return res.status(201).json({ success: true, message: 'Producto creado sin relación' });
                });
              }
            } else {
              const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`;
              db.run(insertNoRelacionadosSQL, [newId, 'No se encontró coincidencia por código ni nombre'], (err3) => {
                if (err3) return res.status(500).json({ error: 'Error base de datos' });
                return res.status(201).json({ success: true, message: 'Producto creado y agregado a no relacionados' });
              });
            }
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
          const updates = [];
          const params = [];

          if (exactProduct.precio_neto !== netPrice) {
            updates.push('precio_neto = ?');
            params.push(netPrice);
          }
          if (exactProduct.precio_final !== finalPrice) {
            updates.push('precio_final = ?');
            params.push(finalPrice);
          }

          if (updates.length > 0) {
            params.push(productCode, productName);
            const updateSQL = `
              UPDATE lista_interna 
              SET ${updates.join(', ')} 
              WHERE LOWER(cod_interno) = LOWER(?) AND LOWER(nom_interno) = LOWER(?)
            `;
            await new Promise((resolve, reject) => {
              db.run(updateSQL, params, (e) => (e ? reject(e) : resolve()));
            });
          }
          return res.status(200).json({ success: true, updated: updates.length > 0, message: 'Producto actualizado' });
        }

        const insertSQL = `
          INSERT INTO lista_interna 
          (cod_interno, nom_interno, precio_neto, precio_final, fecha) 
          VALUES (?, ?, ?, ?, ?)
        `;
        db.run(insertSQL, [productCode, productName, netPrice, finalPrice, date], function (e) {
          if (e) return res.status(500).json({ error: 'Error base de datos' });

          const newId = this.lastID;
          console.log('✅ Producto insertado en lista_interna con ID:', newId);

          const selectProveedorSQL = `
            SELECT * FROM lista_precios 
            WHERE LOWER(cod_externo) = LOWER(?) OR LOWER(nom_externo) = LOWER(?) 
            LIMIT 1
          `;
          db.get(selectProveedorSQL, [productCode, productName], async (err2, proveedorProd) => {
            if (err2) return res.status(500).json({ error: 'Error base de datos' });

            console.log('🔍 ¿Existe match en lista_precios?', !!proveedorProd);
            console.log('📩 linkAsEquivalent recibido:', linkAsEquivalent);

            if (proveedorProd) {
              if (linkAsEquivalent !== false) {
                try {
                  await createRelationAndClean(proveedorProd.id_externo, newId);
                  return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
                } catch (error) {
                  return res.status(500).json({ error: 'Error creando relación' });
                }
              } else {
                const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo) VALUES (?, ?)`;
                db.run(insertNoRelacionadosSQL, [newId, 'Usuario rechazó sugerencia de relación'], (err3) => {
                  if (err3) return res.status(500).json({ error: 'Error base de datos' });
                  return res.status(201).json({ success: true, message: 'Producto creado sin relación' });
                });
              }
            } else {
              const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo) VALUES (?, ?)`;
              db.run(insertNoRelacionadosSQL, [newId, 'No se encontró coincidencia por código ni nombre'], (err3) => {
                if (err3) return res.status(500).json({ error: 'Error base de datos' });
                return res.status(201).json({ success: true, message: 'Producto creado y agregado a no relacionados' });
              });
            }
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
  console.log('DELETE recibido para id:', id);

  if (isNaN(Number(id))) {
    return res.status(400).json({ error: 'ID inválido' });
  }

  const sqlGetRelation = `
    SELECT id_lista_precios, id_lista_interna 
    FROM relacion_articulos 
    WHERE id = ?
  `;

  db.get(sqlGetRelation, [id], (err, row) => {
    if (err) {
      console.error('Error al buscar relación:', err.message);
      return res.status(500).json({ error: 'Error en base de datos' });
    }

    if (!row) {
      console.log('Relación no encontrada para id:', id);
      return res.status(404).json({ error: 'Relación no encontrada' });
    }

    console.log('Relación encontrada:', row);

    const { id_lista_precios, id_lista_interna } = row;

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run(`DELETE FROM relacion_articulos WHERE id = ?`, [id], function (errDelRel) {
        if (errDelRel) {
          console.error('Error eliminando relación:', errDelRel.message);
          db.run('ROLLBACK');
          return res.status(500).json({ error: 'Error eliminando relación' });
        }
        console.log(`Relación con id=${id} eliminada, filas afectadas: ${this.changes}`);

        db.run(`DELETE FROM lista_precios WHERE id_externo = ?`, [id_lista_precios], function (errDelProv) {
          if (errDelProv) {
            console.error('Error eliminando producto proveedor:', errDelProv.message);
            db.run('ROLLBACK');
            return res.status(500).json({ error: 'Error eliminando producto proveedor' });
          }
          console.log(`Producto proveedor eliminado, filas afectadas: ${this.changes}`);

          db.run(`DELETE FROM lista_interna WHERE id_interno = ?`, [id_lista_interna], function (errDelInt) {
            if (errDelInt) {
              console.error('Error eliminando producto interno:', errDelInt.message);
              db.run('ROLLBACK');
              return res.status(500).json({ error: 'Error eliminando producto interno' });
            }
            console.log(`Producto interno eliminado, filas afectadas: ${this.changes}`);

            db.run('COMMIT', (commitErr) => {
              if (commitErr) {
                console.error('Error haciendo commit:', commitErr.message);
                return res.status(500).json({ error: 'Error en la base de datos' });
              }

              res.status(200).json({ success: true, message: 'Relación y productos eliminados correctamente' });
            });
          });
        });
      });
    });
  });
});

app.get('/api/products/search', (req, res) => {
  const { by, q } = req.query;

  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Falta la query de búsqueda' });
  }

  const searchTerm = `%${q}%`;
  let sql = '';
  let params = [];

  if (by === 'productCode') {
    sql = `
      SELECT cod_externo AS productCode, nom_externo AS productName, proveedor AS company, precio_neto AS netPrice, precio_final AS finalPrice, fecha
      FROM lista_precios
      WHERE cod_externo LIKE ?

      UNION

      SELECT cod_interno AS productCode, nom_interno AS productName, 'Gampack' AS company, precio_neto AS netPrice, precio_final AS finalPrice, fecha
      FROM lista_interna
      WHERE cod_interno LIKE ?

      ORDER BY fecha DESC
    `;
    params = [searchTerm, searchTerm];

  } else if (by === 'productName') {
    sql = `
      SELECT cod_externo AS productCode, nom_externo AS productName, proveedor AS company, precio_neto AS netPrice, precio_final AS finalPrice, fecha
      FROM lista_precios
      WHERE nom_externo LIKE ?

      UNION

      SELECT cod_interno AS productCode, nom_interno AS productName, 'Gampack' AS company, precio_neto AS netPrice, precio_final AS finalPrice, fecha
      FROM lista_interna
      WHERE nom_interno LIKE ?

      ORDER BY fecha DESC
    `;
    params = [searchTerm, searchTerm];

  } else if (by === 'company') {
    sql = `
      SELECT cod_externo AS productCode, nom_externo AS productName, proveedor AS company, precio_neto AS netPrice, precio_final AS finalPrice, fecha
      FROM lista_precios
      WHERE proveedor LIKE ?
      ORDER BY fecha DESC
    `;
    params = [searchTerm];

  } else {
    return res.status(400).json({ error: 'Campo de búsqueda no válido' });
  }

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error en búsqueda:', err.message);
      return res.status(500).json({ error: 'Error al buscar productos' });
    }

    const result = rows.map(row => ({
      productCode: row.productCode,
      productName: row.productName,
      company: row.company,
      netPrice: row.netPrice,
      finalPrice: row.finalPrice,
    }));

    res.json({ products: result });
  });
});

app.delete('/api/no-relacionados/:tipo/:id', (req, res) => {
  let tipo = req.params.tipo.toLowerCase();
  const id = req.params.id;

  // Aceptar 'proveedor' o 'proveedores'
  if (tipo === 'proveedores') tipo = 'proveedor';
  if (tipo === 'gampacks') tipo = 'gampack';

  let tablePrincipal = '';
  let idFieldPrincipal = '';
  let tableNoRelacionado = '';
  let idFieldNoRelacionado = '';

  if (tipo === 'proveedor') {
    tablePrincipal = 'lista_precios';
    idFieldPrincipal = 'id_externo';
    tableNoRelacionado = 'articulos_no_relacionados';
    idFieldNoRelacionado = 'id_lista_precios';
  } else if (tipo === 'gampack') {
    tablePrincipal = 'lista_interna';
    idFieldPrincipal = 'id_interno';
    tableNoRelacionado = 'articulos_gampack_no_relacionados';
    idFieldNoRelacionado = 'id_lista_interna';
  } else {
    return res.status(400).json({ error: 'Tipo inválido. Debe ser "proveedor" o "gampack".' });
  }

  // Primero elimino de tabla principal
  const sqlDeletePrincipal = `DELETE FROM ${tablePrincipal} WHERE ${idFieldPrincipal} = ?`;

  db.run(sqlDeletePrincipal, [id], function (err) {
    if (err) {
      console.error('Error al eliminar de tabla principal:', err.message);
      return res.status(500).json({ error: 'Error al eliminar producto de tabla principal' });
    }

    if (this.changes === 0) {
      return res.status(404).json({ error: 'Producto no encontrado en tabla principal' });
    }

    // Si eliminó producto principal, elimino también de no relacionados
    const sqlDeleteNoRelacionado = `DELETE FROM ${tableNoRelacionado} WHERE ${idFieldNoRelacionado} = ?`;

    db.run(sqlDeleteNoRelacionado, [id], function (err2) {
      if (err2) {
        console.error('Error al eliminar de tabla no relacionados:', err2.message);
        // Aunque falla eliminar en no relacionados, ya eliminó producto principal, aviso pero 200
        return res.status(200).json({
          warning: 'Producto eliminado de tabla principal, pero error eliminando en no relacionados',
          errorNoRelacionados: err2.message,
        });
      }

      res.status(200).json({ success: true, message: 'Producto eliminado correctamente de ambas tablas' });
    });
  });
});

app.get('/api/price-comparisons', (req, res) => {
  const search = req.query.search || '';
  const searchLike = `%${search.toLowerCase()}%`;

  const sql = `
    SELECT 
      li.nom_interno AS internalProduct,
      lp.nom_externo AS externalProduct,
      lp.proveedor AS supplier,
      li.precio_neto AS internalNetPrice,
      lp.precio_neto AS externalNetPrice,
      li.precio_final AS internalFinalPrice,
      lp.precio_final AS externalFinalPrice,
      li.fecha AS internalDate,
      lp.fecha AS externalDate,
      lp.tipo_empresa AS companyType,
      ra.criterio_relacion AS saleConditions
    FROM relacion_articulos ra
    JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    WHERE LOWER(li.nom_interno) LIKE ? 
       OR LOWER(lp.nom_externo) LIKE ? 
       OR LOWER(lp.proveedor) LIKE ?
  `;

  db.all(sql, [searchLike, searchLike, searchLike], (err, rows) => {
    if (err) {
      console.error('Error al obtener comparaciones de precios:', err.message);
      return res.status(500).json({ error: 'Error al obtener comparaciones de precios' });
    }

    const results = rows.map(row => {
      const priceDifference = row.externalFinalPrice !== 0
        ? ((row.internalFinalPrice - row.externalFinalPrice) / row.externalFinalPrice) * 100
        : 0;

      return {
        internalProduct: row.internalProduct,
        externalProduct: row.externalProduct,
        supplier: row.supplier,
        internalNetPrice: row.internalNetPrice,
        externalNetPrice: row.externalNetPrice,
        internalFinalPrice: row.internalFinalPrice,
        externalFinalPrice: row.externalFinalPrice,
        internalDate: row.internalDate,
        externalDate: row.externalDate,
        companyType: row.companyType === 'Gampack' ? 'supplier' : 'competitor',
        saleConditions: row.saleConditions || 'Desconocido',
        priceDifference: parseFloat(priceDifference.toFixed(2)),
      };
    });

    res.json(results);
  });
});

console.log('Definiendo ruta /api/equivalencias');
app.get('/api/equivalencias-search', (req, res) => {
  console.log('Entré en la ruta /api/equivalencias', req.query.search);
  const { search = '' } = req.query;
  const searchTerm = `%${search}%`;

  const sql = `
    SELECT
      ra.id,
      lp.proveedor AS supplier,
      lp.cod_externo AS externalCode,
      lp.nom_externo AS externalName,
      lp.fecha AS externalDate,
      -- li.proveedor no existe en lista_interna, podemos poner NULL o un texto fijo
      NULL AS internalSupplier,
      li.cod_interno AS internalCode,
      li.nom_interno AS internalName,
      li.fecha AS internalDate,
      ra.criterio_relacion AS matchingCriteria
    FROM relacion_articulos ra
    LEFT JOIN lista_precios lp ON ra.id_lista_precios = lp.id_externo
    LEFT JOIN lista_interna li ON ra.id_lista_interna = li.id_interno
    WHERE
      lp.cod_externo LIKE ? OR
      lp.nom_externo LIKE ? OR
      li.cod_interno LIKE ? OR
      li.nom_interno LIKE ?
    ORDER BY ra.id DESC
  `;

  const params = [searchTerm, searchTerm, searchTerm, searchTerm];

  db.all(sql, params, (err, rows) => {
    if (err) {
      console.error('Error al buscar equivalencias:', err.message);
      return res.status(500).json({ error: 'Error en la búsqueda' });
    }

    res.json(rows);
  });
});

module.exports = app;

