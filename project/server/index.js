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

// Ruta de salud
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// ... [otras rutas existentes sin cambios] ...

// Obtener todos los productos de lista_precios
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

// Vincular manualmente productos
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

    // eliminar de no relacionados
    db.run(`DELETE FROM articulos_no_relacionados WHERE id_lista_precios = ?`, [id_lista_precios]);
    db.run(`DELETE FROM articulos_gampack_no_relacionados WHERE id_lista_interna = ?`, [id_lista_interna]);

    res.json({ success: true });
  });
});

app.listen(PORT, () => {
  console.log(`Servidor backend corriendo en http://localhost:${PORT}`);
});
