import fs from "fs";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runSchema() {
  try {
    console.log("🧩 Ejecutando schema.sql...");
    const sql = fs.readFileSync("./schema.sql", "utf8");
    await pool.query(sql);
    console.log("✅ Esquema creado correctamente en la base de datos");
  } catch (err) {
    console.error("❌ Error al ejecutar schema.sql:", err);
  } finally {
    await pool.end();   //Cambios
  }
}

runSchema();