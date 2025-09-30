const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render te da esta URL
  ssl: { rejectUnauthorized: false }          // obligatorio en Render
});

module.exports = pool;
