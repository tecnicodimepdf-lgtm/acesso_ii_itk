import cron from 'node-cron';
import { db } from './db.js';
import { clientes_api } from './dmpClient.js';

function formatCleanError(error: any): string {
  if (!error) return 'Erro desconhecido';
  
  if (error.isAxiosError || error.response || error.request) {
    const status = error.response?.status;
    const statusText = error.response?.statusText || '';
    const baseURL = error.config?.baseURL || '';
    const url = error.config?.url || '';
    const method = error.config?.method?.toUpperCase() || 'GET';
    
    let serverMessage = '';
    if (error.response?.data) {
      if (typeof error.response.data === 'string') {
        serverMessage = error.response.data;
      } else if (typeof error.response.data === 'object') {
        serverMessage = error.response.data.Message || error.response.data.message || error.response.data.error || JSON.stringify(error.response.data);
      }
    }
    
    const rootMsg = error.message || '';
    let formatted = `AxiosError: Request failed with status code ${status || 'Unknown'} for [${method}] ${baseURL}${url}`;
    if (statusText) formatted += ` (${statusText})`;
    
    if (serverMessage) {
      const trimmedServerMessage = serverMessage.toString().trim();
      formatted += `: ${trimmedServerMessage}`;
      
      // DIAGNÓSTICO INTELIGENTE DE C# DICTIONARY ERROR DA DIMEP:
      if (trimmedServerMessage.toLowerCase().includes("given key was not present in the dictionary")) {
        formatted += "\n[Aviso Clínico / Diagnóstico]: Este erro (KeyNotFoundException) ocorre tipicamente quando o Pointer ID (CNPJ do Cliente) não está cadastrado ou vinculado ao Token do integrador no portal da Dimep. Por favor, acrescente ou corrija a variável 'POINTER_CNPJ' em seu arquivo .env com o CNPJ do cliente cadastrado na Dimep.";
      }
    } else if (rootMsg) {
      formatted += `: ${rootMsg}`;
    }
    return formatted;
  }
  
  if (error instanceof Error) {
    return error.stack ? `${error.message}\nStack: ${error.stack}` : error.message;
  }
  
  return typeof error === 'object' ? JSON.stringify(error) : String(error);
}

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
    const token = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN;
    if (!token || token === 'your_access_token_here' || token === 'SEU_TOKEN_AQUI') {
      throw new Error("Token DMP não configurado em .env (DMP_ACCESS_TOKEN).");
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
      INSERT INTO pessoas (
        matricula, nome, email, estrutura_organizacional, campos_extras, payload_bruto
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(matricula) DO UPDATE SET
        nome = excluded.nome,
        email = excluded.email,
        estrutura_organizacional = excluded.estrutura_organizacional,
        payload_bruto = excluded.payload_bruto
    `);

    const getPersonFromDb = (reg: string) => db.prepare('SELECT * FROM pessoas WHERE matricula = ?').get(reg) as any;

    // Sincronizar pessoas BasicData em paralelo se possível para popular a base
    try {
      console.log("Sincronizando pessoas (BasicData)...");
      const apiPeople = await clientes_api.getBasicPersonsData();
      let peopleList: any[] = [];
      if (Array.isArray(apiPeople)) {
        peopleList = apiPeople;
      } else if (apiPeople && typeof apiPeople === 'object') {
        if (Array.isArray(apiPeople.Data)) peopleList = apiPeople.Data;
        else if (Array.isArray(apiPeople.Response)) peopleList = apiPeople.Response;
        else if (apiPeople.Id || apiPeople.RegistrationNumber) peopleList = [apiPeople];
      }
      
      if (peopleList.length > 0) {
        const processPeople = db.transaction((list: any[]) => {
          for (const p of list) {
            const reg = p.RegistrationNumber || p.Id;
            if (!reg) continue;
            insertPerson.run(
              String(reg),
              p.Name || 'Pessoa Sem Nome',
              p.Email || null,
              p.OrganizationalStructure ? String(p.OrganizationalStructure) : null,
              p.Cpf ? JSON.stringify({ cpf: p.Cpf, rg: p.RG }) : null,
              JSON.stringify(p)
            );
          }
        });
        processPeople(peopleList);
        console.log(`Sucesso: ${peopleList.length} pessoas carregadas na base local.`);
      }
    } catch (e) {
      console.error("Aviso: Falha ao carregar BasicData das pessoas:", formatCleanError(e));
    }

    const processSync = db.transaction((logs: any[]) => {
      for (const log of logs) {
        if (!log.Id) continue;
        
        let personName = log.PersonName;
        const regNumber = log.PersonRegistrationNumber;
        
        // Enriquecimento de Pessoa se o nome estiver nulo
        if (regNumber) {
          let person = getPersonFromDb(String(regNumber));
          if (person) {
            personName = person.nome;
          }
        }

        // Mapping AccessType to readable string
        const accessTypeVal = log.AccessType;
        let tipoMapped = 'Acesso';
        if (accessTypeVal === 0 || String(accessTypeVal) === '0' || String(accessTypeVal).toLowerCase() === 'entrada') {
          tipoMapped = 'Entrada';
        } else if (accessTypeVal === 1 || String(accessTypeVal) === '1' || String(accessTypeVal).toLowerCase() === 'saída' || String(accessTypeVal).toLowerCase() === 'saida') {
          tipoMapped = 'Saída';
        }

        // Mapping validation status dynamically
        const statusVal = log.AccessValidationStatus;
        const statusStr = String(log.AccessValidationStatus || log.status_validacao || '').toLowerCase();
        let statusMapped = 'Permitido';
        
        if (statusVal === 10 || statusStr.includes('liberado') || statusStr.includes('permitido')) {
          statusMapped = 'Permitido';
        } else if (statusVal === 11 || statusStr.includes('perfil')) {
          statusMapped = 'Negado (Sem Perfil)';
        } else if (statusVal === 12 || statusStr.includes('cadastrado')) {
          statusMapped = 'Negado (Não Cadastrado)';
        } else if (statusVal === 14 || statusStr.includes('bloqueado')) {
          statusMapped = 'Negado (Bloqueado)';
        } else if (statusVal === 15 || statusStr.includes('horario')) {
          statusMapped = 'Negado (Fora Horário)';
        } else if (log.status_validacao) {
          statusMapped = log.status_validacao;
        } else if (statusVal !== undefined && statusVal !== null && statusVal !== 10) {
          statusMapped = `Negado (Código ${statusVal})`;
        }

        // Insert Access Log
        insertLog.run(
          log.Id,
          regNumber ? String(regNumber) : null,
          personName || 'Desconhecido',
          log.AccessDateTime || null,
          tipoMapped,
          statusMapped,
          log.EquipmentNumber !== null && log.EquipmentNumber !== undefined ? String(log.EquipmentNumber) : null,
          log.FunctionNumber !== null && log.FunctionNumber !== undefined ? String(log.FunctionNumber) : null,
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
    const errorMsg = formatCleanError(error);
    console.error("Erro na sincronização:", errorMsg);
    
    updateSyncStatus(currentPointer, 'error', errorMsg);
    isSyncing = false;
    return { status: 'error', error: errorMsg };
  }
}

// Scheduled to run every minute
export function startScheduler() {
  console.log("Iniciando scheduler de sincronização (executa a cada 1 min)...");
  cron.schedule('* * * * *', async () => {
    await runIncrementalSync();
  });
}
