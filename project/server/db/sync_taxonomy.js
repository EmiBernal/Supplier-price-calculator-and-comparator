const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.resolve(__dirname, 'database.db');
const taxonomyPath = path.resolve(__dirname, 'taxonomy.json');
const db = new sqlite3.Database(dbPath);

const run = (sql, params=[]) => new Promise((res, rej)=>db.run(sql, params, function(e){ e?rej(e):res(this); }));
const get = (sql, params=[]) => new Promise((res, rej)=>db.get(sql, params, (e,row)=> e?rej(e):res(row)));

async function getOrCreateFamilia(nombre){
  const r = await get('SELECT id FROM familias WHERE LOWER(nombre)=LOWER(?)', [nombre]);
  if (r) return r.id;
  const ins = await run('INSERT INTO familias(nombre) VALUES (?)', [nombre]);
  return ins.lastID;
}
async function getOrCreateSubfamilia(nombre, familiaId){
  const r = await get('SELECT id FROM subfamilias WHERE LOWER(nombre)=LOWER(?) AND familia_id=?', [nombre, familiaId]);
  if (r) return r.id;
  const ins = await run('INSERT INTO subfamilias(nombre, familia_id) VALUES (?,?)', [nombre, familiaId]);
  return ins.lastID;
}
async function getOrCreateRubro(nombre, subfamiliaId){
  const r = await get('SELECT id FROM rubros WHERE LOWER(nombre)=LOWER(?)', [nombre]);
  if (r) return r.id;
  const ins = await run('INSERT INTO rubros(nombre, subfamilia_id) VALUES (?,?)', [nombre, subfamiliaId]);
  return ins.lastID;
}

(async () => {
  try {
    const raw = fs.readFileSync(taxonomyPath, 'utf8');
    const taxonomy = JSON.parse(raw);

    await run('BEGIN');

    for (const fam of Object.keys(taxonomy)) {
      const famId = await getOrCreateFamilia(fam);
      for (const sub of Object.keys(taxonomy[fam])) {
        const subId = await getOrCreateSubfamilia(sub, famId);
        for (const rubro of taxonomy[fam][sub]) {
          await getOrCreateRubro(rubro, subId);
        }
      }
    }

    await run('COMMIT');
    console.log('Taxonomía sincronizada ✔');
  } catch (e) {
    await run('ROLLBACK').catch(()=>{});
    console.error('Error:', e.message);
    process.exit(1);
  } finally {
    db.close();
  }
})();
