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
      
      // Assuming 'Negado' or similar indicates denied status in AccessValidationStatus
      const deniedLogs = db.prepare('SELECT COUNT(*) as count FROM registros_acesso WHERE status_validacao LIKE "%Denied%" OR status_validacao LIKE "%Negado%" OR status_validacao LIKE "%DENIED%"').get() as {count: number};
      
      // Top 5 Equipments
      const topEquipment = db.prepare(`
        SELECT equipamento as equipment, COUNT(*) as value 
        FROM registros_acesso 
        WHERE equipamento IS NOT NULL 
        GROUP BY equipamento 
        ORDER BY value DESC LIMIT 5
      `).all();

      res.json({
        totalLogs: totalLogs.count,
        todayLogs: todayLogs.count,
        deniedLogs: deniedLogs.count,
        topEquipment
      });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Consultar Logs
  app.get('/api/logs', (req: Request, res: Response) => {
    try {
      const { page = 1, limit = 50, q = '', equipment = '', status = '', startDate = '', endDate = '' } = req.query;
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

  // Sync Control Routes
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

}
