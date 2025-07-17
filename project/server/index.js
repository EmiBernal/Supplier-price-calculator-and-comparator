const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Conexión a la base de datos SQLite
const dbPath = path.join(__dirname, 'db/database.db');
const db = new sqlite3.Database(dbPath, err => {
  if (err) {
    console.error('Error al conectar con SQLite:', err.message);
  } else {
    console.log('Conectado a la base de datos SQLite en', dbPath);
  }
});

// Ruta de prueba
app.get('/', (req, res) => {
  res.send('¡El backend está funcionando!');
});

// Obtener datos de comparaciones de precios
app.get('/api/price-comparisons', (req, res) => {
  const search = req.query.search || '';
  const likeSearch = `%${search}%`;

  const sql = `
  SELECT
    li.nom_interno AS internalProduct,
    lp.nom_externo AS externalProduct,
    lp.tipo_empresa AS companyType,
    lp.cod_externo AS externalCode,
    lp.precio_neto AS externalNetPrice,
    lp.precio_final AS externalFinalPrice,
    li.precio_neto AS internalNetPrice,
    li.precio_final AS internalFinalPrice,
    ROUND(((lp.precio_final - li.precio_final) / li.precio_final) * 100, 2) AS priceDifference,
    lp.fecha AS externalDate,
    li.fecha AS internalDate,
    lp.nom_externo AS supplier,
    rel.criterio_relacion AS saleConditions
  FROM 
    relacion_articulos rel
  JOIN 
    lista_precios lp ON rel.id_lista_precios = lp.id_externo
  JOIN 
    lista_interna li ON rel.id_lista_interna = li.id_interno
  WHERE 
    li.nom_interno LIKE ? OR lp.nom_externo LIKE ?
  `;

  db.all(sql, [likeSearch, likeSearch], (err, rows) => {
    if (err) {
      console.error('Error al obtener comparaciones:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
    
    const resultados = rows.map(row => ({
      internalProduct: row.internalProduct,
      externalProduct: row.externalProduct,
      supplier: row.supplier,
      internalNetPrice: row.internalNetPrice,
      externalNetPrice: row.externalNetPrice,
      internalFinalPrice: row.internalFinalPrice,
      externalFinalPrice: row.externalFinalPrice,
      priceDifference: row.priceDifference,
      internalDate: row.internalDate,
      externalDate: row.externalDate,
      companyType: row.companyType,
      saleConditions: row.saleConditions
    }));
    
    res.json(resultados);
  });
});

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Verificar si el producto ya existe por código o nombre
app.post('/api/check-product', (req, res) => {
  const { productCode, productName, companyType } = req.body;

  if (!productCode && !productName) {
    return res.status(400).json({ error: 'Se requiere el código o nombre del producto' });
  }

  const queries = [];
  const params = [];

  if (companyType === 'Gampack') {
    queries.push(`(cod_interno = ? OR nom_interno = ?)`);
    params.push(productCode, productName);
  } else {
    queries.push(`(cod_externo = ? OR nom_externo = ?)`);
    params.push(productCode, productName);
  }

  const table = companyType === 'Gampack' ? 'lista_interna' : 'lista_precios';

  const sql = `
    SELECT * FROM ${table}
    WHERE ${queries.join(' OR ')}
    LIMIT 1
  `;

  db.get(sql, params, (err, row) => {
    if (err) {
      console.error('Error al verificar producto:', err.message);
      return res.status(500).json({ error: 'Error al buscar el producto' });
    }

    if (row) {
      return res.json({ found: true, product: row });
    } else {
      return res.json({ found: false });
    }
  });
});

// Guardar o actualizar producto y manejar relaciones o no relacionados
app.post('/api/products', (req, res) => {
  const {
    company,
    productCode,
    productName,
    netPrice,
    finalPrice,
    companyType,
    date,
    updateExisting
  } = req.body;

  const isGampack = companyType === 'Gampack';
  const table = isGampack ? 'lista_interna' : 'lista_precios';

  const campos = {
    lista_precios: ['nom_externo', 'cod_externo', 'precio_neto', 'precio_final', 'tipo_empresa', 'fecha'],
    lista_interna: ['nom_interno', 'cod_interno', 'precio_neto', 'precio_final', 'fecha']
  };

  const insertSQL = `INSERT INTO ${table} (${campos[table].join(',')}) VALUES (${campos[table].map(() => '?').join(',')})`;

  const insertValues = isGampack
    ? [productName, productCode, netPrice, finalPrice, date]
    : [productName, productCode, netPrice, finalPrice, companyType, date];

  const updateSQL = isGampack
    ? `UPDATE lista_interna SET precio_neto = ?, precio_final = ?, fecha = ? WHERE cod_interno = ? OR nom_interno = ?`
    : `UPDATE lista_precios SET precio_neto = ?, precio_final = ?, fecha = ? WHERE cod_externo = ? OR nom_externo = ?`;

  const checkExistSQL = isGampack
    ? `SELECT id_interno AS id FROM lista_interna WHERE cod_interno = ? OR nom_interno = ?`
    : `SELECT id_externo AS id FROM lista_precios WHERE cod_externo = ? OR nom_externo = ?`;

  db.get(checkExistSQL, [productCode, productName], (err, existingRow) => {
    if (err) return res.status(500).json({ error: 'Error al verificar existencia' });

    const proceed = (productId) => {
      // Solo si es externo, intentamos relacionar
      if (!isGampack) {
        db.get(
          `SELECT id_interno, nom_interno, cod_interno FROM lista_interna WHERE cod_interno = ? OR nom_interno = ?`,
          [productCode, productName],
          (err, internalMatch) => {
            if (err) return res.status(500).json({ error: 'Error buscando coincidencias' });

            if (internalMatch) {
              // Relacionar productos
              const criterio =
                internalMatch.cod_interno === productCode ? 'codigo' : 'nombre';

              db.run(
                `INSERT OR IGNORE INTO relacion_articulos (id_lista_precios, id_lista_interna, criterio_relacion)
                 VALUES (?, ?, ?)`,
                [productId, internalMatch.id_interno, criterio],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: 'Error al guardar la relación' });
                  }

                  return res.json({
                    success: true,
                    updated: updateExisting,
                    related: true,
                    relationCriteria: criterio,
                  });
                }
              );
            } else {
              // Insertar en artículos no relacionados
              db.run(
                `INSERT INTO articulos_no_relacionados (id_lista_precios, motivo)
                 VALUES (?, ?)`,
                [productId, 'No se encontró coincidencia por nombre ni código'],
                (err) => {
                  if (err) {
                    return res.status(500).json({ error: 'Error al insertar en no relacionados' });
                  }

                  return res.json({
                    success: true,
                    updated: updateExisting,
                    related: false,
                    savedInNoRelacionados: true,
                  });
                }
              );
            }
          }
        );
      } else {
        // Si es Gampack, no se relaciona
        return res.json({ success: true, updated: updateExisting });
      }
    };

    if (existingRow && updateExisting) {
      // Actualizar
      db.run(updateSQL, [netPrice, finalPrice, date, productCode, productName], function (err) {
        if (err) return res.status(500).json({ error: 'Error actualizando' });
        proceed(existingRow.id);
      });
    } else {
      // Insertar
      db.run(insertSQL, insertValues, function (err) {
        if (err) return res.status(500).json({ error: 'Error insertando' });
        proceed(this.lastID);
      });
    }
  });
});

// Agregar a articulos_no_relacionados directamente
app.post('/api/unmatched-product', (req, res) => {
  const { productCode, productName, company, date } = req.body;

  const sql = `INSERT INTO articulos_no_relacionados (cod_externo, nom_externo, proveedor, fecha) VALUES (?, ?, ?, ?)`;

  db.run(sql, [productCode, productName, company, date], function (err) {
    if (err) return res.status(500).json({ error: 'Error al insertar en no relacionados' });
    return res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
