import { Express, Request, Response } from 'express';
import { db } from './db.js';
import { runIncrementalSync } from './syncService.js';

export function setupRoutes(app: Express) {
  
  // Dashboard Status
  app.get('/api/dashboard/stats', (req: Request, res: Response) => {
    try {
      const totalLogs = db.prepare('SELECT COUNT(*) as count FROM registros_acesso').get() as {count: number};
      
      const todayStart = new Date().toISOString().split('T')[0] + "T00:00:00.000Z";
      const todayLogs = db.prepare('SELECT COUNT(*) as count FROM registros_acesso WHERE data_hora >= ?').get(todayStart) as {count: number};
      
      const deniedLogs = db.prepare('SELECT COUNT(*) as count FROM registros_acesso WHERE status_validacao LIKE ? OR status_validacao LIKE ? OR status_validacao LIKE ?').get('%Denied%', '%Negado%', '%DENIED%') as {count: number};
      
      // Access Type proportions (Entrada vs Saída)
      const entradasCount = db.prepare("SELECT COUNT(*) as count FROM registros_acesso WHERE tipo_acesso = 'Entrada'").get() as {count: number};
      const saidasCount = db.prepare("SELECT COUNT(*) as count FROM registros_acesso WHERE tipo_acesso = 'Saída'").get() as {count: number};
      
      // Top 5 Equipments
      const topEquipment = db.prepare(`
        SELECT equipamento as equipment, COUNT(*) as value 
        FROM registros_acesso 
        WHERE equipamento IS NOT NULL AND equipamento != ''
        GROUP BY equipamento 
        ORDER BY value DESC LIMIT 5
      `).all();

      res.json({
        totalLogs: totalLogs.count,
        todayLogs: todayLogs.count,
        deniedLogs: deniedLogs.count,
        entradasCount: entradasCount.count,
        saidasCount: saidasCount.count,
        topEquipment
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Consultar Logs
  app.get('/api/logs', (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 50, q = '', equipment = '', status = '', tipo_acesso = '', startDate = '', endDate = '' } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      let queryStr = 'SELECT * FROM registros_acesso WHERE 1=1';
      const params: any[] = [];
      
      if (q) {
        queryStr += ' AND (nome LIKE ? OR matricula LIKE ?)';
        params.push(`%${q}%`, `%${q}%`);
      }
      if (equipment) {
        queryStr += ' AND equipamento = ?';
        params.push(equipment);
      }
      if (status) {
        queryStr += ' AND status_validacao = ?';
        params.push(status);
      }
      if (tipo_acesso) {
        queryStr += ' AND tipo_acesso = ?';
        params.push(tipo_acesso);
      }
      if (startDate) {
        queryStr += ' AND data_hora >= ?';
        params.push(`${startDate}T00:00:00.000Z`);
      }
      if (endDate) {
        queryStr += ' AND data_hora <= ?';
        params.push(`${endDate}T23:59:59.999Z`);
      }

      const totalRow = db.prepare(`SELECT COUNT(*) as count FROM (${queryStr})`).get(...params) as {count: number};
      
      queryStr += ' ORDER BY data_hora DESC LIMIT ? OFFSET ?';
      params.push(Number(limit), offset);

      const logs = db.prepare(queryStr).all(...params);
      
      res.json({
        data: logs,
        total: totalRow.count,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Consultar Pessoas Sincronizadas
  app.get('/api/people', (req: Request, res: Response) => {
    try {
      const { q = '', page = 1, limit = 50 } = req.query;
      const offset = (Number(page) - 1) * Number(limit);
      
      let queryStr = 'SELECT * FROM pessoas WHERE 1=1';
      const params: any[] = [];
      
      if (q) {
        queryStr += ' AND (nome LIKE ? OR matricula LIKE ? OR email LIKE ?)';
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      
      const totalRow = db.prepare(`SELECT COUNT(*) as count FROM (${queryStr})`).get(...params) as {count: number};
      
      queryStr += ' ORDER BY nome ASC LIMIT ? OFFSET ?';
      params.push(Number(limit), offset);
      
      const people = db.prepare(queryStr).all(...params);
      
      res.json({
        data: people,
        total: totalRow.count,
        page: Number(page),
        limit: Number(limit)
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Sync Control Routes
  app.get('/api/config', (req: Request, res: Response) => {
    try {
      const row = db.prepare("SELECT valor FROM app_config WHERE chave = 'POINTER_CNPJ'").get() as { valor: string } | undefined;
      const userRow = db.prepare("SELECT valor FROM app_config WHERE chave = 'LOGON_USERNAME'").get() as { valor: string } | undefined;
      const passRow = db.prepare("SELECT valor FROM app_config WHERE chave = 'LOGON_PASSWORD'").get() as { valor: string } | undefined;
      const rawToken = process.env.DMP_ACCESS_TOKEN || process.env.TOKEN || process.env.DMP_TOKEN || '';
      
      let jwtDetectedCnpj = '';
      try {
        if (rawToken) {
          const jwt = rawToken.replace(/^Bearer /i, '').trim();
          const parts = jwt.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
            jwtDetectedCnpj = payload?.nameid || '';
          }
        }
      } catch (_) {}

      res.json({
        pointerCnpj: row?.valor || '',
        envPointerCnpj: process.env.POINTER_CNPJ || '',
        jwtDetectedCnpj,
        logonUsername: userRow?.valor || 'VOGA PARK',
        logonPassword: passRow?.valor || 'Voga@123'
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/config', (req: Request, res: Response) => {
    try {
      const { pointerCnpj, logonUsername, logonPassword } = req.body;
      
      if (pointerCnpj !== undefined) {
        db.prepare("INSERT INTO app_config (chave, valor) VALUES ('POINTER_CNPJ', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(pointerCnpj.trim());
      }
      if (logonUsername !== undefined) {
        db.prepare("INSERT INTO app_config (chave, valor) VALUES ('LOGON_USERNAME', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(logonUsername.trim());
      }
      if (logonPassword !== undefined) {
        db.prepare("INSERT INTO app_config (chave, valor) VALUES ('LOGON_PASSWORD', ?) ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor").run(logonPassword.trim());
      }

      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get('/api/sync/status', (req: Request, res: Response) => {
    try {
      const status = db.prepare('SELECT * FROM controle_sincronizacao LIMIT 1').get();
      res.json(status);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post('/api/sync/trigger', async (req: Request, res: Response) => {
    const result = await runIncrementalSync();
    res.json(result);
  });

  // Seeding high-quality simulation data for offline/unconfigured sandbox demonstration
  app.post('/api/sync/demo', (req: Request, res: Response) => {
    try {
      // Clear tables to load a pristine setup
      db.prepare('DELETE FROM registros_acesso').run();
      db.prepare('DELETE FROM pessoas').run();

      const demoPeople = [
        { registration: "1001", name: "Thiago Silva", email: "thiago.silva@vogan.com.br", org: "1", cpf: "123.456.789-00", status: 10 },
        { registration: "1002", name: "Amanda Oliveira", email: "amanda.oliveira@vogan.com.br", org: "1", cpf: "234.567.890-11", status: 10 },
        { registration: "1003", name: "Roberto Santos", email: "roberto.santos@vogan.com.br", org: "2", cpf: "345.678.901-22", status: 10 },
        { registration: "1004", name: "Juliana Costa", email: "juliana.costa@vogan.com.br", org: "3", cpf: "456.789.012-33", status: 10 },
        { registration: "1005", name: "Carlos Souza", email: "carlos.souza@vogan.com.br", org: "5", cpf: "567.890.123-44", status: 10 },
        { registration: "1006", name: "Beatriz Lima", email: "beatriz.lima@vogan.com.br", org: "4", cpf: "678.901.234-55", status: 10 },
        { registration: "1007", name: "Marcelo Rocha", email: "marcelo.rocha@vogan.com.br", org: "2", cpf: "789.012.345-66", status: 10 },
        { registration: "1008", name: "Fernanda Araujo", email: "fernanda.araujo@vogan.com.br", org: "1", cpf: "890.123.456-77", status: 10 },
        { registration: "1009", name: "Bruno Mendes", email: "bruno.mendes@vogan.com.br", org: "3", cpf: "901.234.567-88", status: 10 },
        { registration: "1010", name: "Camila Fonseca", email: "camila.fonseca@vogan.com.br", org: "1", cpf: "012.345.678-99", status: 14 }
      ];

      const insertPerson = db.prepare(`
        INSERT INTO pessoas (
          matricula, nome, email, estrutura_organizacional, campos_extras, payload_bruto
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const p of demoPeople) {
        insertPerson.run(
          p.registration,
          p.name,
          p.email,
          p.org,
          JSON.stringify({ cpf: p.cpf }),
          JSON.stringify({ RegistrationNumber: p.registration, Name: p.name, Email: p.email, OrganizationalStructure: p.org, Cpf: p.cpf, PersonSituation: p.status, Inactive: p.status !== 10 })
        );
      }

      const eqList = ["Catraca Entrada Principal", "Catraca Bloco B", "Acesso Diretoria", "Acesso Garagem G1", "Refeitório"];
      const insertLog = db.prepare(`
        INSERT OR IGNORE INTO registros_acesso (
          id_acesso, matricula, nome, data_hora, tipo_acesso, 
          status_validacao, equipamento, funcao_codigo, campo_adicional_01, cpf, documento, payload_bruto
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let baseId = 20000;
      let generatedLogs = 0;

      // Stagger over the last 5 days
      for (let dayOffset = 4; dayOffset >= 0; dayOffset--) {
        const d = new Date();
        d.setDate(d.getDate() - dayOffset);
        const dateStr = d.toISOString().split('T')[0];

        for (const person of demoPeople) {
          if (person.registration === "1010") {
            // Simulated blocked entrances
            if (Math.random() > 0.4) {
              insertLog.run(
                ++baseId,
                person.registration,
                person.name,
                `${dateStr}T08:05:12.000Z`,
                "Entrada",
                "Negado (Bloqueado)",
                "Catraca Entrada Principal",
                "1",
                null, person.cpf, null, JSON.stringify(person)
              );
              generatedLogs++;
            }
            continue;
          }

          // Entrance
          if (Math.random() > 0.05) {
            insertLog.run(
              ++baseId,
              person.registration,
              person.name,
              `${dateStr}T08:${String(10 + Math.floor(Math.random() * 40)).padStart(2, '0')}:00.000Z`,
              "Entrada",
              "Permitido",
              eqList[Math.floor(Math.random() * 2)],
              "1",
              null, person.cpf, null, JSON.stringify(person)
            );
            generatedLogs++;
          }

          // Lunch break out
          if (Math.random() > 0.25) {
            insertLog.run(
              ++baseId,
              person.registration,
              person.name,
              `${dateStr}T12:${String(Math.floor(Math.random() * 20)).padStart(2, '0')}:00.000Z`,
              "Saída",
              "Permitido",
              eqList[Math.floor(Math.random() * 2)],
              "1",
              null, person.cpf, null, JSON.stringify(person)
            );
            generatedLogs++;

            // lunch refectory
            insertLog.run(
              ++baseId,
              person.registration,
              person.name,
              `${dateStr}T12:${String(30 + Math.floor(Math.random() * 20)).padStart(2, '0')}:00.000Z`,
              "Entrada",
              "Permitido",
              "Refeitório",
              "1",
              null, person.cpf, null, JSON.stringify(person)
            );
            generatedLogs++;

            // return from lunch
            insertLog.run(
              ++baseId,
              person.registration,
              person.name,
              `${dateStr}T13:${String(20 + Math.floor(Math.random() * 25)).padStart(2, '0')}:00.000Z`,
              "Entrada",
              "Permitido",
              eqList[Math.floor(Math.random() * 2)],
              "1",
              null, person.cpf, null, JSON.stringify(person)
            );
            generatedLogs++;
          }

          // Specific building access
          if (person.registration === "1005" || person.registration === "1006") {
            if (Math.random() > 0.3) {
              insertLog.run(
                ++baseId,
                person.registration,
                person.name,
                `${dateStr}T15:${String(Math.floor(Math.random() * 50)).padStart(2, '0')}:00.000Z`,
                "Entrada",
                "Permitido",
                "Acesso Diretoria",
                "1",
                null, person.cpf, null, JSON.stringify(person)
              );
              generatedLogs++;
            }
          }

          // Exit
          if (Math.random() > 0.05) {
            insertLog.run(
              ++baseId,
              person.registration,
              person.name,
              `${dateStr}T18:${String(Math.floor(Math.random() * 45)).padStart(2, '0')}:00.000Z`,
              "Saída",
              "Permitido",
              eqList[Math.floor(Math.random() * 2)],
              "1",
              null, person.cpf, null, JSON.stringify(person)
            );
            generatedLogs++;
          }
        }
      }

      // Update sync state to reflect demo data
      db.prepare(`
        UPDATE controle_sincronizacao 
        SET ultimo_ponteiro = ?, status = 'idle', data_ultima_execucao = CURRENT_TIMESTAMP, 
            logs = 'Ativado Modo de Demonstração (API Offline). Sincronizados com sucesso 10 colaboradores e ' || ? || ' acessos simulados.'
      `).run(baseId, generatedLogs);

      res.json({ status: 'success', generatedLogs });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

}
