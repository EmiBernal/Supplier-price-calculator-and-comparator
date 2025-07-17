
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
  //Lee el termino de busqueda desde la URL
  const search = req.query.search || '';
  const sql = `
  SELECT 
    lp.cod_externo AS codigoExterno,
    lp.nom_externo AS nombreExterno,
    li.nom_interno AS productoInterno,
    lp.precio_final AS precioFinal,
    lp.tipo_empresa AS tipoEmpresa,
    rel.criterio_relacion AS criterioRelacion,
    ROUND(((lp.precio_final - li.precio_final) / li.precio_final) * 100, 2) AS diferenciaPrecio
  FROM
    lista_precios lp
  JOIN
    relacion_articulos rel ON lp.id_externo = rel.id_lista_precios
  JOIN
    lista_interna li ON li.id_interno = rel.id_lista_interna              
  WHERE 
    lp.nom_externo LIKE ? OR li.nom_interno LIKE ?
  `;

  const likeSearch = `%${search}%`;

  db.all(sql, [likeSearch, likeSearch], (err, rows) => {
    //Si hay error
    if(err) {
      console.error('Error al obtener comparaciones:', err.message);
      return res.status(500).json({ error: 'Error interno del servidor'});
    }
    //Si no hay error
    const resultados = rows.map(row => ({
      internalProduct : row.productoInterno,
      supplier: row.nombreExterno,
      finalPrice: row.precioFinal,
      companyType: row.tipoEmpresa,
      saleConditions: row.criterioRelacion,
      priceDifference: row.diferenciaPrecio
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
