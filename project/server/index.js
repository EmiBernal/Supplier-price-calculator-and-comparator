const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 4000;

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
    checkSQL = `SELECT * FROM lista_interna WHERE cod_interno = ? OR nom_interno = ? LIMIT 1`;
    params = [code, name];
    insertNoRelacionadoSQL = `INSERT INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`;
    insertNoRelacionadoParams = [productId, 'No se encontró coincidencia por código ni nombre'];
  } else if (tipo === 'Gampack') {
    checkSQL = `SELECT * FROM lista_precios WHERE cod_externo = ? OR nom_externo = ? LIMIT 1`;
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
  } = req.body;

  if (!productCode || !productName || netPrice == null || finalPrice == null || !companyType || !date) {
    return res.status(400).json({ error: 'Faltan campos obligatorios' });
  }

  // Función para crear relación y eliminar de no relacionados
  const createRelationAndClean = (idListaPrecios, idListaInterna) => {
    return new Promise((resolve, reject) => {
      const insertRelSQL = `
        INSERT OR IGNORE INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
        VALUES (?, ?, 'automatic')
      `;
      db.run(insertRelSQL, [idListaPrecios, idListaInterna], function (err) {
        if (err) return reject(err);

        // Eliminar de no relacionados
        db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [idListaPrecios]);
        db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [idListaInterna]);

        resolve();
      });
    });
  };

  if (companyType === 'Proveedor') {
    const selectExactSQL = `SELECT * FROM lista_precios WHERE cod_externo = ? AND nom_externo = ? AND proveedor = ? AND tipo_empresa = ?`;
    db.get(selectExactSQL, [productCode, productName, company, companyType], async (err, exactProduct) => {
      if (err) {
        console.error('Error buscando producto proveedor exacto:', err);
        return res.status(500).json({ error: 'Error base de datos' });
      }

      try {
        if (exactProduct) {
          // Actualizar precios que hayan cambiado
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
            const updateSQL = `UPDATE lista_precios SET ${updates.join(', ')} WHERE cod_externo = ? AND nom_externo = ? AND proveedor = ? AND tipo_empresa = ?`;
            await new Promise((resolve, reject) => {
              db.run(updateSQL, params, function (e) {
                if (e) reject(e);
                else resolve();
              });
            });
          }

          return res.status(200).json({ success: true, updated: updates.length > 0, message: 'Producto actualizado' });
        }

        // No existe exacto, insertar y buscar relación con Gampack
        const insertSQL = `INSERT INTO lista_precios (cod_externo, nom_externo, precio_neto, precio_final, tipo_empresa, fecha, proveedor) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(insertSQL, [productCode, productName, netPrice, finalPrice, companyType, date, company], function (e) {
          if (e) {
            console.error('Error insertando producto proveedor:', e);
            return res.status(500).json({ error: 'Error base de datos' });
          }

          const newId = this.lastID;

          // Buscar coincidencia en lista_interna para relacionar
          const selectGampackSQL = `SELECT * FROM lista_interna WHERE cod_interno = ? OR nom_interno = ?`;
          db.get(selectGampackSQL, [productCode, productName], (err2, gampackProd) => {
            if (err2) {
              console.error('Error buscando producto Gampack para relacionar:', err2);
              return res.status(500).json({ error: 'Error base de datos' });
            }

            if (gampackProd) {
              createRelationAndClean(newId, gampackProd.id_interno)
                .then(() => {
                  return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
                })
                .catch((err) => {
                  console.error('Error creando relación:', err);
                  return res.status(500).json({ error: 'Error creando relación' });
                });
            } else {
              // No hay relación, insertamos en articulos_no_relacionados
              const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_no_relacionados (id_lista_precios, motivo) VALUES (?, ?)`;
              db.run(insertNoRelacionadosSQL, [newId, 'No se encontró coincidencia por código ni nombre'], (err3) => {
                if (err3) {
                  console.error('Error insertando en articulos_no_relacionados:', err3);
                  return res.status(500).json({ error: 'Error base de datos' });
                }
                return res.status(201).json({ success: true, message: 'Producto creado y agregado a no relacionados' });
              });
            }
          });
        });
      } catch (error) {
        console.error('Error en proceso proveedor:', error);
        return res.status(500).json({ error: 'Error interno' });
      }
    });
  } else if (companyType === 'Gampack') {
    const selectExactSQL = `SELECT * FROM lista_interna WHERE cod_interno = ? AND nom_interno = ?`;
    db.get(selectExactSQL, [productCode, productName], async (err, exactProduct) => {
      if (err) {
        console.error('Error buscando producto Gampack exacto:', err);
        return res.status(500).json({ error: 'Error base de datos' });
      }

      try {
        if (exactProduct) {
          // Actualizar precios que hayan cambiado
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
            const updateSQL = `UPDATE lista_interna SET ${updates.join(', ')} WHERE cod_interno = ? AND nom_interno = ?`;
            await new Promise((resolve, reject) => {
              db.run(updateSQL, params, function (e) {
                if (e) reject(e);
                else resolve();
              });
            });
          }

          return res.status(200).json({ success: true, updated: updates.length > 0, message: 'Producto actualizado' });
        }

        // Insertar nuevo producto Gampack
        const insertSQL = `INSERT INTO lista_interna (cod_interno, nom_interno, precio_neto, precio_final, fecha) VALUES (?, ?, ?, ?, ?)`;
        db.run(insertSQL, [productCode, productName, netPrice, finalPrice, date], function (e) {
          if (e) {
            console.error('Error insertando producto Gampack:', e);
            return res.status(500).json({ error: 'Error base de datos' });
          }

          const newId = this.lastID;

          // Buscar producto proveedor para relacionar
          const selectProveedorSQL = `SELECT * FROM lista_precios WHERE cod_externo = ? OR nom_externo = ?`;
          db.get(selectProveedorSQL, [productCode, productName], (err2, proveedorProd) => {
            if (err2) {
              console.error('Error buscando producto proveedor para relacionar:', err2);
              return res.status(500).json({ error: 'Error base de datos' });
            }

            if (proveedorProd) {
              createRelationAndClean(proveedorProd.id_externo, newId)
                .then(() => {
                  return res.status(201).json({ success: true, message: 'Producto creado y relacionado' });
                })
                .catch((err) => {
                  console.error('Error creando relación:', err);
                  return res.status(500).json({ error: 'Error creando relación' });
                });
            } else {
              // No hay relación, insertamos en articulos_gampack_no_relacionados
              const insertNoRelacionadosSQL = `INSERT OR IGNORE INTO articulos_gampack_no_relacionados (id_lista_interna, motivo) VALUES (?, ?)`;
              db.run(insertNoRelacionadosSQL, [newId, 'No se encontró coincidencia por código ni nombre'], (err3) => {
                if (err3) {
                  console.error('Error insertando en articulos_gampack_no_relacionados:', err3);
                  return res.status(500).json({ error: 'Error base de datos' });
                }
                return res.status(201).json({ success: true, message: 'Producto creado y agregado a no relacionados' });
              });
            }
          });
        });
      } catch (error) {
        console.error('Error en proceso Gampack:', error);
        return res.status(500).json({ error: 'Error interno' });
      }
    });
  } else {
    return res.status(400).json({ error: 'Tipo de empresa no válido' });
  }
});


app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
