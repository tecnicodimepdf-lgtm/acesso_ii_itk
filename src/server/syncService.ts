import cron from 'node-cron';
import { db } from './db.js';
import { clientes_api } from './dmpClient.js';

let isSyncing = false;

// Helpers to read/write sync state
const getSyncStatus = () => db.prepare('SELECT * FROM controle_sincronizacao LIMIT 1').get() as any;
const updateSyncStatus = (pointer: number, status: string, msg?: string) => {
  db.prepare(`
    UPDATE controle_sincronizacao 
    SET ultimo_ponteiro = ?, status = ?, data_ultima_execucao = CURRENT_TIMESTAMP, logs = ?
  `).run(pointer, status, msg || null);
};

// Sincronização incremental
export async function runIncrementalSync() {
  if (isSyncing) return { status: 'already_syncing' };
  isSyncing = true;
  
  const status = getSyncStatus();
  let currentPointer = status?.ultimo_ponteiro || 0;
  
  updateSyncStatus(currentPointer, 'syncing', 'Iniciando sincronização...');

  try {
    // 1. Check if token and API exist in env
    const token = process.env.DMP_TOKEN || process.env.TOKEN;
    if (!token || token === 'your_access_token_here') {
      throw new Error("Token DMP não configurado em .env (TOKEN).");
    }

    // 2. Fetch incrementally (Using pointer)
    const records = await clientes_api.getAccessLogsByPointer(currentPointer);
    
    if (!records || !Array.isArray(records) || records.length === 0) {
      updateSyncStatus(currentPointer, 'idle', 'Nenhum novo registro encontrado.');
      isSyncing = false;
      return { status: 'success', syncedCount: 0 };
    }

    let syncedCount = 0;
    
    // Transactions for faster batch insert
    const insertLog = db.prepare(`
      INSERT OR IGNORE INTO registros_acesso (
        id_acesso, matricula, nome, data_hora, tipo_acesso, 
        status_validacao, equipamento, funcao_codigo, campo_adicional_01, cpf, documento, payload_bruto
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const insertPerson = db.prepare(`
      INSERT OR IGNORE INTO pessoas (
        matricula, nome, email, payload_bruto
      ) VALUES (?, ?, ?, ?)
    `);

    const updateLogName = db.prepare('UPDATE registros_acesso SET nome = ? WHERE matricula = ?');

    const getPersonFromDb = (reg: string) => db.prepare('SELECT * FROM pessoas WHERE matricula = ?').get(reg) as any;

    const processSync = db.transaction(async (logs: any[]) => {
      for (const log of logs) {
        if (!log.Id) continue;
        
        let personName = log.PersonName;
        const regNumber = log.PersonRegistrationNumber;
        
        // Enriquecimento de Pessoa se o nome estiver nulo
        if (regNumber) {
          let person = getPersonFromDb(regNumber);
          
          if (!person && !log.PersonName) { // Buscar na API da DMP se precisarmos do nome
            try {
              const apiPerson = await clientes_api.getPersonByRegistration(regNumber);
              if (apiPerson) {
                insertPerson.run(
                  apiPerson.RegistrationNumber || regNumber, 
                  apiPerson.Name || null, 
                  apiPerson.Email || null, 
                  JSON.stringify(apiPerson)
                );
                personName = apiPerson.Name || personName;
              }
            } catch (e) {
              console.error(`Falha ao buscar pessoa ${regNumber}: `, e);
            }
          } else if (person && !personName) {
            personName = person.nome;
          }
        }

        // Insert Access Log
        insertLog.run(
          log.Id,
          regNumber || null,
          personName || 'Desconhecido',
          log.AccessDateTime || null,
          log.AccessType || null,
          log.AccessValidationStatus || null,
          log.EquipmentNumber || null,
          log.FunctionNumber || null,
          log.Additionalfield01 || null,
          log.CpfUser || null,
          log.DocumentNumber || null,
          JSON.stringify(log)
        );

        if (log.Id > currentPointer) {
          currentPointer = log.Id;
        }
        syncedCount++;
      }
    });

    await processSync(records);
    
    updateSyncStatus(currentPointer, 'idle', `Sincronização concluída. ${syncedCount} registros adicionados.`);
    isSyncing = false;
    return { status: 'success', syncedCount };

  } catch (error: any) {
    console.error("Erro na sincronização:", error);
    updateSyncStatus(currentPointer, 'error', error?.message || 'Erro desconhecido');
    isSyncing = false;
    return { status: 'error', error: error?.message };
  }
}

// Scheduled to run every minute
export function startScheduler() {
  console.log("Iniciando scheduler de sincronização (executa a cada 1 min)...");
  cron.schedule('* * * * *', async () => {
    await runIncrementalSync();
  });
}
