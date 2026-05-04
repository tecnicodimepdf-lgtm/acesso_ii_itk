/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { Activity, Users, Computer, Search, RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@radix-ui/react-tabs';

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  return (
    <div className="h-screen bg-[#E4E3E0] flex flex-col text-[#141414] font-sans overflow-hidden">
      <header className="h-[60px] border-b-2 border-[#141414] flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-[#141414] flex items-center justify-center text-[#E4E3E0] font-bold text-lg italic">D</div>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-tighter leading-none">DMP Access Integrator</h1>
            <span className="text-[10px] opacity-60 uppercase tracking-widest">Monitoramento centralizado de acessos</span>
          </div>
        </div>
        
        <div className="flex gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase opacity-50">App Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600"></span>
              <span className="mono text-sm">ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[220px] border-r border-[#141414] flex flex-col bg-[#DCDAD7] shrink-0">
          <nav className="mt-4">
            <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} index="01">DASHBOARD</TabButton>
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} index="02">ACESSOS</TabButton>
            <TabButton active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} index="03">SINCRONIZAÇÃO</TabButton>
          </nav>
        </aside>

        <main className="flex-1 flex flex-col overflow-auto p-0">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'logs' && <LogsView />}
          {activeTab === 'sync' && <SyncView />}
        </main>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children, index }: any) {
  return (
    <div
      onClick={onClick}
      className={cn("sidebar-link", active ? "active" : "")}
    >
      <span>{children}</span>
      {index && <span className="mono">{index}</span>}
    </div>
  );
}

function DashboardView() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    axios.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
  }, []);

  if (!stats) return <div className="p-12 text-center text-[10px] uppercase font-bold tracking-widest opacity-50">Carregando indicadores...</div>;

  return (
    <div className="flex flex-col h-full bg-[#E4E3E0]">
      <div className="grid grid-cols-1 md:grid-cols-3 border-b border-[#141414]">
        <StatCard title="Total Registros" value={stats.totalLogs} />
        <StatCard title="Acessos Hoje" value={stats.todayLogs} />
        <StatCard title="Acessos Negados" value={stats.deniedLogs} isDanger />
      </div>

      <div className="p-6">
        <div className="border border-[#141414] bg-[#DCDAD7] flex flex-col items-stretch max-w-3xl">
          <div className="px-4 py-3 border-b border-[#141414]">
            <h3 className="text-xs uppercase font-bold tracking-widest font-sans opacity-80 flex items-center gap-2">
              <Computer className="w-4 h-4 opacity-70" />
              Acessos por Equipamento (Top 5)
            </h3>
          </div>
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.topEquipment} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#141414" strokeOpacity={0.2} />
                <XAxis type="number" stroke="#141414" tick={{fill: '#141414', fontSize: 10, fontFamily: 'monospace'}} />
                <YAxis dataKey="equipment" type="category" width={150} tick={{fill: '#141414', fontSize: 10, fontFamily: 'monospace'}} />
                <Tooltip cursor={{fill: 'rgba(20,20,20,0.1)'}} contentStyle={{borderRadius: '0px', border: '1px solid #141414', backgroundColor: '#E4E3E0', color: '#141414'}} />
                <Bar dataKey="value" fill="#141414" barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, isDanger }: any) {
  return (
    <div className="p-4 border-r border-[#141414] last:border-r-0">
      <div className="text-[10px] uppercase opacity-50 italic col-header" style={{padding:0, border:0}}>{title}</div>
      <div className={cn("text-3xl font-bold tracking-tighter mono mt-1", isDanger ? "text-red-700" : "")}>{value?.toLocaleString()}</div>
    </div>
  );
}

function LogsView() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    let url = `/api/logs?page=${page}&q=${query}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;

    axios.get(url).then(res => {
      setLogs(res.data.data);
      setTotal(res.data.total);
      setLoading(false);
    }).catch(e => {
      console.error(e);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchLogs();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  const handleExportCSV = () => {
      const headers = ['ID', 'Data/Hora', 'Matricula', 'Nome', 'Equipamento', 'Status'];
      const csvContent = "data:text/csv;charset=utf-8," 
          + headers.join(",") + "\\n" 
          + logs.map(l => `${l.id_acesso},${l.data_hora},${l.matricula || '-'},${l.nome},${l.equipamento},${l.status_validacao}`).join("\n");
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "access_logs.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#E4E3E0]">
      {/* Filter Bar */}
      <div className="p-2 border-b border-[#141414] flex gap-2 items-center shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2 items-center flex-1">
          <input 
            type="text" 
            placeholder="Buscar por nome ou matrícula..." 
            className="bg-transparent border border-[#141414] px-3 py-1 text-xs mono w-64 focus:bg-white focus:outline-none placeholder-[#141414] placeholder-opacity-50"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <input 
            type="date" 
            className="bg-transparent border border-[#141414] px-3 py-1 text-xs mono focus:bg-white focus:outline-none placeholder-[#141414] placeholder-opacity-50"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-[10px] uppercase opacity-70 font-bold mono">ATÉ</span>
          <input 
            type="date" 
            className="bg-transparent border border-[#141414] px-3 py-1 text-xs mono focus:bg-white focus:outline-none placeholder-[#141414] placeholder-opacity-50"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
          <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-3 py-1 text-xs font-bold uppercase transition-opacity hover:opacity-90">Buscar</button>
        </form>
        
        <button 
          onClick={handleExportCSV}
          className="ml-auto bg-[#141414] text-[#E4E3E0] px-4 py-1 text-xs font-bold uppercase transition-opacity hover:opacity-90"
        >
          Exportar CSV
        </button>
      </div>

      {/* Data Grid Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[160px_180px_100px_minmax(180px,1fr)_120px] bg-[#DCDAD7]">
          <div className="col-header">Data/Hora</div>
          <div className="col-header">Nome</div>
          <div className="col-header">Matrícula</div>
          <div className="col-header">Equipamento</div>
          <div className="col-header">Status</div>
        </div>
        
        <div className="flex-1 overflow-auto overflow-y-scroll bg-[#E4E3E0]">
          {loading ? (
             <div className="p-4 text-center mono text-sm opacity-50">Carregando...</div>
          ) : logs.length === 0 ? (
             <div className="p-4 text-center mono text-sm opacity-50">Nenhum registro encontrado.</div>
          ) : (
            logs.map(log => {
              const isDenied = log.status_validacao?.toLowerCase().includes('denied') || log.status_validacao?.toLowerCase().includes('negado') || log.status_validacao?.toLowerCase().includes('denied');
              return (
                <div key={log.id} className={cn("grid grid-cols-[160px_180px_100px_minmax(180px,1fr)_120px] data-row text-sm", isDenied ? "bg-[#dcaeaf]" : "")}>
                  <div className="mono">
                    {log.data_hora ? format(new Date(log.data_hora), 'dd/MM/yyyy HH:mm:ss') : '-'}
                  </div>
                  <div className="font-bold text-xs uppercase truncate pr-2">{log.nome}</div>
                  <div className="mono text-xs">{log.matricula || '-'}</div>
                  <div className="text-xs truncate pr-2">{log.equipamento || '-'}</div>
                  <div>
                    <span className={cn(
                      "status-pill",
                      isDenied 
                        ? "border-red-900 text-red-900" 
                        : "border-green-800 text-green-800"
                    )}>
                      {log.status_validacao || 'Permitido'}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="h-[32px] shrink-0 bg-[#DCDAD7] border-t border-[#141414] px-4 flex items-center justify-between text-[10px] mono">
        <span className="opacity-60">
          MOSTRANDO ROWS {(page-1)*50 + (logs.length > 0 ? 1 : 0)} - {(page-1)*50 + logs.length} DE {total}
        </span>
        <div className="flex gap-2 font-bold">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(page-1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline"
          >
            [ANTERIOR]
          </button>
          <button 
            disabled={(page * 50) >= total}
            onClick={() => setPage(page+1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline"
          >
            [PRÓXIMA]
          </button>
        </div>
      </div>
    </div>
  );
}

function SyncView() {
  const [status, setStatus] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  const fetchStatus = () => {
    axios.get('/api/sync/status').then(res => setStatus(res.data)).catch(console.error);
  };

  useEffect(() => {
    fetchStatus();
    const int = setInterval(fetchStatus, 5000);
    return () => clearInterval(int);
  }, []);

  const triggerSync = async () => {
    if (syncing || status?.status === 'syncing') return;
    setSyncing(true);
    try {
      await axios.post('/api/sync/trigger');
      fetchStatus();
    } catch (e) {
      console.error(e);
      alert('Erro ao forçar sincronização.');
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="border border-[#141414] bg-[#DCDAD7]">
        <div className="border-b border-[#141414] p-4 bg-[#E4E3E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className={cn("w-5 h-5", (syncing || status?.status === 'syncing') && "animate-spin")} />
            <h2 className="text-sm font-bold uppercase tracking-widest">Sync Worker Engine</h2>
          </div>
          <span className="mono text-[10px] opacity-60 uppercase">Background Scheduler</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 mono text-xs">
            <div className="border-b border-black/10 pb-2">
              <span className="opacity-50 block mb-1">STATUS</span>
              <span className="font-bold flex items-center gap-2">
                {status?.status === 'syncing' && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>}
                {status?.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-600"></span>}
                {status?.status === 'idle' && <span className="w-2 h-2 rounded-full bg-green-600"></span>}
                {(status?.status || 'DESCONHECIDO').toUpperCase()}
              </span>
            </div>
            <div className="border-b border-black/10 pb-2">
              <span className="opacity-50 block mb-1">ÚLTIMO PONTEIRO</span>
              <span className="font-bold"># {status?.ultimo_ponteiro || 0}</span>
            </div>
            <div className="border-b border-black/10 pb-2 col-span-2">
              <span className="opacity-50 block mb-1">LÚLTIMA ATUALIZAÇÃO</span>
              <span className="font-bold">
                {status?.data_ultima_execucao ? format(new Date(status.data_ultima_execucao + 'Z'), 'yyyy-MM-dd HH:mm:ss') : 'NUNCA'}
              </span>
            </div>
          </div>
          
          <div className="border border-[#141414] bg-[#141414] text-[#E4E3E0] p-3 mono text-[10px] uppercase font-bold min-h-[60px] whitespace-pre-wrap">
            &gt; LOGS: {status?.logs || 'AGUARDANDO LOGS...'}
          </div>
          
          <button
            onClick={triggerSync}
            disabled={syncing || status?.status === 'syncing'}
            className="w-full bg-[#141414] hover:opacity-90 transition-opacity text-[#E4E3E0] font-bold uppercase tracking-widest text-xs py-3 border border-[#141414] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {syncing || status?.status === 'syncing' ? 'SINCRONIZANDO...' : 'FORÇAR SINCRONIZAÇÃO'}
          </button>
        </div>
      </div>
      
      <div className="border border-[#141414] bg-[#E4E3E0] p-4 text-xs mono leading-relaxed opacity-80 uppercase">
        ! NOTA: A sincronização consome endpoints incrementais (Pointer) da API DMP Access II. Edite as credenciais/URL no .env e reinicie o serviço. Os dados de pessoa são enriquecidos sob demanda.
      </div>
    </div>
  );
}

