
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Conexión a la base de datos SQLite
const dbPath = path.join(__dirname, 'database.db');
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

//Obtener datos de comparaciones de precios
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


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
