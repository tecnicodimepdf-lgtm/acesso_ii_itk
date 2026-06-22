import Database from 'better-sqlite3';
import path from 'path';

// Define the database path (in the root directory)
const dbPath = path.resolve(process.cwd(), 'dmp_acessos.db');

export const db = new Database(dbPath, {
  // verbose: process.env.LOG_LEVEL === 'debug' ? console.log : undefined,
});

export function initDb() {
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS registros_acesso (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      id_acesso INTEGER UNIQUE,
      matricula TEXT,
      nome TEXT,
      data_hora DATETIME,
      tipo_acesso TEXT,
      status_validacao TEXT,
      equipamento TEXT,
      funcao_codigo TEXT,
      campo_adicional_01 TEXT,
      campo_adicional_02 TEXT,
      campo_adicional_03 TEXT,
      campo_adicional_04 TEXT,
      campo_adicional_05 TEXT,
      campo_adicional_06 TEXT,
      campo_adicional_07 TEXT,
      campo_adicional_08 TEXT,
      campo_adicional_09 TEXT,
      campo_adicional_10 TEXT,
      campo_adicional_11 TEXT,
      cpf TEXT,
      documento TEXT,
      payload_bruto TEXT
    );

    CREATE TABLE IF NOT EXISTS pessoas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matricula TEXT UNIQUE,
      nome TEXT,
      email TEXT,
      estrutura_organizacional TEXT,
      campos_extras TEXT,
      payload_bruto TEXT
    );

    CREATE TABLE IF NOT EXISTS controle_sincronizacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ultimo_ponteiro INTEGER DEFAULT 0,
      data_ultima_execucao DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'idle',
      logs TEXT
    );

    CREATE TABLE IF NOT EXISTS app_config (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );
  `);

  // Initialize sync_control row if it doesn't exist
  const row = db.prepare('SELECT id FROM controle_sincronizacao LIMIT 1').get();
  if (!row) {
    db.prepare("INSERT INTO controle_sincronizacao (ultimo_ponteiro, status) VALUES (0, 'idle')").run();
  }

  // Pre-seed default configuration keys
  db.prepare("INSERT OR IGNORE INTO app_config (chave, valor) VALUES ('POINTER_CNPJ', '')").run();
  db.prepare("INSERT OR IGNORE INTO app_config (chave, valor) VALUES ('LOGON_USERNAME', 'VOGA PARK')").run();
  db.prepare("INSERT OR IGNORE INTO app_config (chave, valor) VALUES ('LOGON_PASSWORD', 'Voga@123')").run();
}
