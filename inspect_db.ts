import Database from 'better-sqlite3';

function inspect() {
  const db = new Database('dmp_acessos.db');
  console.log("=== INSPECTING SQLite DATABASE ===");
  
  // 1. Sync control
  try {
    const syncRows = db.prepare('SELECT * FROM controle_sincronizacao').all();
    console.log('\ncontrole_sincronizacao:', syncRows);
  } catch (err: any) {
    console.error('Error reading controle_sincronizacao:', err.message);
  }

  // 2. Registros de acesso count
  try {
    const logStats = db.prepare('SELECT COUNT(*) as count, MIN(id_acesso) as min_id, MAX(id_acesso) as max_id FROM registros_acesso').get() as any;
    console.log(`\nregistros_acesso count: ${logStats.count}, min ID: ${logStats.min_id}, max ID: ${logStats.max_id}`);
    
    const logs = db.prepare('SELECT id, id_acesso, matricula, nome, data_hora, tipo_acesso, status_validacao FROM registros_acesso LIMIT 3').all();
    console.log('registros_acesso sample:', logs);
  } catch (err: any) {
    console.error('Error reading registros_acesso:', err.message);
  }

  // 3. Pessoas count
  try {
    const peopleStats = db.prepare('SELECT COUNT(*) as count FROM pessoas').get() as any;
    console.log(`\npessoas count: ${peopleStats.count}`);
    
    const people = db.prepare('SELECT id, matricula, nome, email FROM pessoas LIMIT 3').all();
    console.log('pessoas sample:', people);
  } catch (err: any) {
    console.error('Error reading pessoas:', err.message);
  }

  db.close();
}

inspect();
