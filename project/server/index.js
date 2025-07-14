// server/index.js
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

// Endpoint que lista todos los precios
app.get('/api/lista_precios', (req, res) => {
  db.all('SELECT * FROM lista_precios', [], (err, rows) => {
    if (err) {
      console.error(err.message);
      return res.status(500).json({ error: 'Error al obtener lista_precios' });
    }
    res.json(rows);
  });
});

// Endpoint para comparaciones (price-comparisons) filtradas
app.get('/api/price-comparisons', (req, res) => {
  const searchTerm = (req.query.search || '').toLowerCase();
  const likeTerm = `%${searchTerm}%`;

  const sql = `
    SELECT 
      nom_externo AS externalName,
      cod_externo AS externalCode,
      nom_interno AS internalName,
      cod_interno AS internalCode,
      tipo_empresa AS supplier,
      fecha AS date
    FROM relacion_articulos ra
    JOIN lista_precios lp ON lp.id_externo = ra.id_lista_precios
    JOIN lista_interna li ON li.id_interno = ra.id_lista_interna
    WHERE LOWER(lp.nom_externo) LIKE ?
      OR LOWER(li.nom_interno) LIKE ?
      OR LOWER(lp.cod_externo) LIKE ?
      OR LOWER(li.cod_interno) LIKE ?
  `;

  db.all(sql, [likeTerm, likeTerm, likeTerm, likeTerm], (err, rows) => {
    if (err) {
      console.error('Error al consultar price-comparisons:', err.message);
      return res.status(500).json({ error: 'Error al obtener comparaciones' });
    }
    res.json(rows);
  });
});

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});
