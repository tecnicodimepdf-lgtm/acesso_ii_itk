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
          <div className="w-8 h-8 bg-[#141414] flex items-center justify-center text-[#E4E3E0] font-bold text-lg italic animate-pulse">D</div>
          <div>
            <h1 className="text-lg font-bold uppercase tracking-tighter leading-none">DMP Access Integrator</h1>
            <span className="text-[10px] opacity-60 uppercase tracking-widest">Monitoramento centralizado de acessos</span>
          </div>
        </div>
        
        <div className="flex gap-8">
          <div className="text-right">
            <div className="text-[10px] uppercase opacity-50">App Status</div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-600 animate-pulse"></span>
              <span className="mono text-sm font-bold">ONLINE</span>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-[220px] border-r border-[#141414] flex flex-col bg-[#DCDAD7] shrink-0">
          <nav className="mt-4 flex-1">
            <TabButton active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} index="01">DASHBOARD</TabButton>
            <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} index="02">ACESSOS</TabButton>
            <TabButton active={activeTab === 'sync'} onClick={() => setActiveTab('sync')} index="03">SINCRONIZAÇÃO</TabButton>
            <TabButton active={activeTab === 'people'} onClick={() => setActiveTab('people')} index="04">COLABORADORES</TabButton>
          </nav>
          
          <div className="p-4 border-t border-[#141414] bg-[#DCDAD7] flex flex-col gap-1 shrink-0">
            <span className="text-[9px] uppercase opacity-50 font-bold tracking-wider flex items-center gap-1">
              <Clock className="w-3 h-3" /> HORÁRIO LOCAL
            </span>
            <SidebarClock />
          </div>
        </aside>

        <main className="flex-1 flex flex-col overflow-auto p-0 bg-[#E4E3E0]">
          {activeTab === 'dashboard' && <DashboardView />}
          {activeTab === 'logs' && <LogsView />}
          {activeTab === 'sync' && <SyncView />}
          {activeTab === 'people' && <PeopleView />}
        </main>
      </div>
    </div>
  );
}

function SidebarClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="mono font-bold text-xs tracking-wider">
      {format(time, 'dd/MM/yyyy HH:mm:ss')}
    </span>
  );
}

function TabButton({ active, onClick, children, index }: any) {
  return (
    <div
      onClick={onClick}
      className={cn("sidebar-link", active ? "active" : "")}
    >
      <span>{children}</span>
      {index && <span className="mono text-[10px]">{index}</span>}
    </div>
  );
}

function DashboardView() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    axios.get('/api/dashboard/stats').then(res => setStats(res.data)).catch(console.error);
  }, []);

  if (!stats) return <div className="p-12 text-center text-[10px] uppercase font-bold tracking-widest opacity-50">Carregando indicadores...</div>;

  const successRate = stats.totalLogs > 0
    ? (((stats.totalLogs - stats.deniedLogs) / stats.totalLogs) * 100).toFixed(1) + '%'
    : '100%';

  return (
    <div className="flex flex-col h-full bg-[#E4E3E0] overflow-y-auto">
      <div className="grid grid-cols-2 md:grid-cols-5 border-b border-[#141414] bg-[#DCDAD7]/30">
        <StatCard title="Total Registros" value={stats.totalLogs} />
        <StatCard title="Acessos Hoje" value={stats.todayLogs} />
        <StatCard title="Entradas" value={stats.entradasCount} />
        <StatCard title="Saídas" value={stats.saidasCount} />
        <StatCard title="Taxa Sucesso" value={successRate} isPercent />
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart Card */}
        <div className="border border-[#141414] bg-[#DCDAD7] flex flex-col items-stretch">
          <div className="px-4 py-3 border-b border-[#141414] bg-[#E4E3E0] flex justify-between items-center">
            <h3 className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <Computer className="w-4 h-4" />
              Acessos por Equipamento (Top 5)
            </h3>
            <span className="mono text-[9px] opacity-60">REGISTROS</span>
          </div>
          <div className="h-72 p-4">
            {stats.topEquipment && stats.topEquipment.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.topEquipment} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#141414" strokeOpacity={0.15} />
                  <XAxis type="number" stroke="#141414" tick={{fill: '#141414', fontSize: 10, fontFamily: 'monospace'}} />
                  <YAxis dataKey="equipment" type="category" width={120} tick={{fill: '#141414', fontSize: 10, fontFamily: 'monospace'}} />
                  <Tooltip cursor={{fill: 'rgba(20,20,20,0.05)'}} contentStyle={{borderRadius: '0px', border: '1px solid #141414', backgroundColor: '#E4E3E0', color: '#141414', fontFamily: 'monospace', fontSize: 11}} />
                  <Bar dataKey="value" fill="#141414" barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs mono opacity-50">Não há dados suficientes.</div>
            )}
          </div>
        </div>

        {/* Access type proportion */}
        <div className="border border-[#141414] bg-[#DCDAD7] flex flex-col items-stretch">
          <div className="px-4 py-3 border-b border-[#141414] bg-[#E4E3E0] flex justify-between items-center">
            <h3 className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Distribuição de Fluxo
            </h3>
            <span className="mono text-[9px] opacity-60">PROPORÇÃO</span>
          </div>
          
          <div className="p-6 space-y-6 flex-1 flex flex-col justify-center">
            <ProgressBar label="Entradas" value={stats.entradasCount} total={stats.totalLogs} colorClass="bg-[#141414]" />
            <ProgressBar label="Saídas" value={stats.saidasCount} total={stats.totalLogs} colorClass="bg-gray-500" />
            <ProgressBar label="Acessos Negados" value={stats.deniedLogs} total={stats.totalLogs} colorClass="bg-red-700" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, value, total, colorClass }: any) {
  const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs mono">
        <span className="font-bold uppercase tracking-wide">{label}</span>
        <span className="opacity-80 font-bold">{value?.toLocaleString()} ({percentage}%)</span>
      </div>
      <div className="h-5 bg-[#E4E3E0] border border-[#141414] p-[1.5px] overflow-hidden relative">
        <div 
          className={cn("h-full transition-all duration-700", colorClass)}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
}

function StatCard({ title, value, isPercent }: any) {
  return (
    <div className="p-4 border-r border-[#141414] last:border-r-0 bg-white/10">
      <div className="text-[10px] uppercase opacity-60 font-bold tracking-wider mb-1">{title}</div>
      <div className="text-2xl font-bold tracking-tighter mono">
        {isPercent ? value : value?.toLocaleString()}
      </div>
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
  const [accessType, setAccessType] = useState('');
  const [equipmentFilter, setEquipmentFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchLogs = () => {
    setLoading(true);
    let url = `/api/logs?page=${page}&limit=50&q=${query}`;
    if (startDate) url += `&startDate=${startDate}`;
    if (endDate) url += `&endDate=${endDate}`;
    if (accessType) url += `&tipo_acesso=${accessType}`;
    if (equipmentFilter) url += `&equipment=${encodeURIComponent(equipmentFilter)}`;
    if (statusFilter) url += `&status=${encodeURIComponent(statusFilter)}`;

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
      const headers = ['ID', 'Data/Hora', 'Matricula', 'Nome', 'Tipo', 'Equipamento', 'Status'];
      const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
          + headers.join(",") + "\n" 
          + logs.map(l => `${l.id_acesso},${l.data_hora},${l.matricula || '-'},${l.nome},${l.tipo_acesso || '-'},${l.equipamento || '-'},${l.status_validacao}`).join("\n");
      
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
      <div className="p-3 border-b border-[#141414] bg-[#DCDAD7]/30 flex flex-wrap gap-3 items-center shrink-0">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-2 items-center flex-1">
          <input 
            type="text" 
            placeholder="Nome ou matrícula..." 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono w-44 focus:bg-white focus:outline-none placeholder-[#141414]/50"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <input 
            type="date" 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono focus:bg-white focus:outline-none"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
          <span className="text-[9px] uppercase font-bold mono">ATÉ</span>
          <input 
            type="date" 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono focus:bg-white focus:outline-none"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
          <select 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono focus:bg-white focus:outline-none"
            value={accessType}
            onChange={e => setAccessType(e.target.value)}
          >
            <option value="">TODOS FLUXOS</option>
            <option value="Entrada">ENTRADAS</option>
            <option value="Saída">SAÍDAS</option>
          </select>
          <input 
            type="text" 
            placeholder="Equipamento..." 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono w-32 focus:bg-white focus:outline-none placeholder-[#141414]/50"
            value={equipmentFilter}
            onChange={e => setEquipmentFilter(e.target.value)}
          />
          <select 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono focus:bg-white focus:outline-none"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">TODOS STATUS</option>
            <option value="Permitido">PERMITIDO</option>
            <option value="Negado">NEGADO / OUTROS</option>
          </select>
          <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-4 py-1.5 text-xs font-bold uppercase transition-opacity hover:opacity-90 cursor-pointer">Filtrar</button>
        </form>
        
        <button 
          onClick={handleExportCSV}
          className="bg-[#141414] text-[#E4E3E0] px-4 py-1.5 text-xs font-bold uppercase transition-opacity hover:opacity-90 cursor-pointer text-right"
        >
          Exportar CSV
        </button>
      </div>

      {/* Data Grid Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[160px_180px_100px_100px_minmax(180px,1fr)_150px] bg-[#DCDAD7] border-b border-[#141414]">
          <div className="col-header">Data/Hora</div>
          <div className="col-header">Nome</div>
          <div className="col-header">Matrícula</div>
          <div className="col-header">Fluxo</div>
          <div className="col-header">Equipamento</div>
          <div className="col-header">Status</div>
        </div>
        
        <div className="flex-1 overflow-auto bg-[#E4E3E0]">
          {loading ? (
             <div className="p-12 text-center mono text-sm opacity-50 uppercase tracking-widest">Carregando acessos...</div>
          ) : logs.length === 0 ? (
             <div className="p-12 text-center mono text-sm opacity-50 uppercase tracking-widest">Nenhum registro encontrado.</div>
          ) : (
            logs.map(log => {
              const isDenied = log.status_validacao?.toLowerCase().includes('negado') || log.status_validacao?.toLowerCase().includes('denied');
              return (
                <div key={log.id} className={cn("grid grid-cols-[160px_180px_100px_100px_minmax(180px,1fr)_150px] data-row text-sm", isDenied ? "bg-red-950/10 border-red-950/20 text-red-950" : "")}>
                  <div className="mono">
                    {log.data_hora ? format(parseISO(log.data_hora), 'dd/MM/yyyy HH:mm:ss') : '-'}
                  </div>
                  <div className="font-bold text-xs uppercase truncate pr-2">{log.nome}</div>
                  <div className="mono text-xs font-semibold">{log.matricula || '-'}</div>
                  <div className="mono text-xs font-bold uppercase opacity-80">{log.tipo_acesso || '-'}</div>
                  <div className="text-xs truncate pr-2 opacity-90">{log.equipamento || '-'}</div>
                  <div>
                    <span className={cn(
                      "status-pill inline-block text-[9px] font-extrabold tracking-wider",
                      isDenied 
                        ? "border-red-800 text-red-800" 
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

      <div className="h-[32px] shrink-0 bg-[#DCDAD7] border-t border-[#141414] px-4 flex items-center justify-between text-[10px] mono font-bold">
        <span className="opacity-60">
          MOSTRANDO ROWS {(page-1)*50 + (logs.length > 0 ? 1 : 0)} - {(page-1)*50 + logs.length} DE {total}
        </span>
        <div className="flex gap-2">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(page-1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline cursor-pointer"
          >
            [ANTERIOR]
          </button>
          <button 
            disabled={(page * 50) >= total}
            onClick={() => setPage(page+1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline cursor-pointer"
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
  const [seeding, setSeeding] = useState(false);
  const [pointerCnpj, setPointerCnpj] = useState('');
  const [logonUsername, setLogonUsername] = useState('');
  const [logonPassword, setLogonPassword] = useState('');
  const [envCnpj, setEnvCnpj] = useState('');
  const [jwtCnpj, setJwtCnpj] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchStatus = () => {
    axios.get('/api/sync/status').then(res => setStatus(res.data)).catch(console.error);
  };

  const fetchConfig = () => {
    axios.get('/api/config').then(res => {
      setPointerCnpj(res.data.pointerCnpj);
      setEnvCnpj(res.data.envPointerCnpj);
      setJwtCnpj(res.data.jwtDetectedCnpj);
      setLogonUsername(res.data.logonUsername);
      setLogonPassword(res.data.logonPassword);
    }).catch(console.error);
  };

  useEffect(() => {
    fetchStatus();
    fetchConfig();
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

  const triggerDemoSync = async () => {
    if (seeding) return;
    setSeeding(true);
    try {
      await axios.post('/api/sync/demo');
      fetchStatus();
      fetchConfig();
    } catch (e) {
      console.error(e);
      alert('Erro ao ativar modo de demonstração.');
    } finally {
      setSeeding(false);
    }
  };

  const saveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    try {
      await axios.post('/api/config', { 
        pointerCnpj,
        logonUsername,
        logonPassword
      });
      fetchConfig();
      alert('Configurações salvas com sucesso!');
    } catch (e) {
      console.error(e);
      alert('Erro ao salvar configurações.');
    } finally {
      setSavingConfig(false);
    }
  };

  const isDimepDictionaryError = status?.status === 'error' && (status?.logs || '').includes('dictionary');

  return (
    <div className="p-6 max-w-3xl space-y-6">
      <div className="border border-[#141414] bg-[#DCDAD7]">
        <div className="border-b border-[#141414] p-4 bg-[#E4E3E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <RefreshCw className={cn("w-5 h-5", (syncing || status?.status === 'syncing') && "animate-spin")} />
            <h2 className="text-sm font-bold uppercase tracking-widest">Sincronizador Background</h2>
          </div>
          <span className="mono text-[10px] opacity-60 uppercase">Scheduler Ativo</span>
        </div>

        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4 mono text-xs">
            <div className="border-b border-[#141414]/10 pb-2">
              <span className="opacity-50 block mb-1">STATUS ATUAL</span>
              <span className="font-bold flex items-center gap-2">
                {status?.status === 'syncing' && <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>}
                {status?.status === 'error' && <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>}
                {status?.status === 'idle' && <span className="w-2 h-2 rounded-full bg-green-600"></span>}
                {(status?.status || 'DESCONHECIDO').toUpperCase()}
              </span>
            </div>
            <div className="border-b border-[#141414]/10 pb-2">
              <span className="opacity-50 block mb-1">ÚLTIMO REGISTRO (PONTEIRO)</span>
              <span className="font-bold"># {status?.ultimo_ponteiro || 0}</span>
            </div>
            <div className="border-b border-[#141414]/10 pb-2 col-span-2">
              <span className="opacity-50 block mb-1">ÚLTIMA SINC</span>
              <span className="font-bold">
                {status?.data_ultima_execucao ? format(parseISO(status.data_ultima_execucao + 'Z'), 'yyyy-MM-dd HH:mm:ss') : 'NUNCA'}
              </span>
            </div>
          </div>
          
          <div className="border border-[#141414] bg-[#141414] text-[#E4E3E0] p-4 mono text-[10px] uppercase font-bold min-h-[60px] whitespace-pre-wrap leading-relaxed">
            &gt; LOGS: {status?.logs || 'AGUARDANDO ATUALIZAÇÕES...'}
          </div>

          {isDimepDictionaryError && (
            <div className="p-3 border-2 border-amber-500 bg-amber-50 text-amber-950 rounded-none text-xs space-y-2">
              <div className="font-black uppercase tracking-wide flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                Diagnóstico de Conexão DIMEP (Erro 500)
              </div>
              <p className="leading-relaxed">
                Detector: O servidor cloud da DIMEP recusou a solicitação informando <strong>"The given key was not present in the dictionary"</strong>.
                Isso ocorre porque a chave ou o token fornecido em <code className="mono bg-amber-200 px-1 py-0.5 font-bold">.env</code> pertence à integradora,
                mas a DIMEP ainda não mapeou/ativou essa permissão para o cliente ou banco de dados de destino em seus servidores centrais de roteamento do módulo ITK.
              </p>
              <p className="font-semibold">
                Dica: Entre em contato com o suporte da DIMEP para concluir o credenciamento de sua chave. Enquanto isso, você pode usar nosso ambiente de simulação abaixo!
              </p>
            </div>
          )}
          
          <div className="flex gap-2.5">
            <button
              onClick={triggerSync}
              disabled={syncing || status?.status === 'syncing' || seeding}
              className="flex-1 bg-[#141414] hover:opacity-90 transition-opacity text-[#E4E3E0] font-bold uppercase tracking-wider text-xs py-3 border border-[#141414] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {syncing || status?.status === 'syncing' ? 'AGUARDE, SINCRONIZANDO...' : 'FORÇAR ATUALIZAÇÃO MANUAL'}
            </button>

            <button
              onClick={triggerDemoSync}
              disabled={syncing || status?.status === 'syncing' || seeding}
              className="flex-1 bg-green-800 border border-green-800 text-[#E4E3E0] hover:bg-green-700 transition-colors font-bold uppercase tracking-wider text-xs py-3 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {seeding ? 'CARREGANDO AMBIENTE...' : 'ATIVAR SIMULAÇÃO LOCAL'}
            </button>
          </div>
        </div>
      </div>
      
      {/* Configuration Card */}
      <div className="border border-[#141414] bg-[#DCDAD7]">
        <div className="border-b border-[#141414] p-4 bg-[#E4E3E0] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Computer className="w-5 h-5 animate-pulse text-amber-800" />
            <h2 className="text-sm font-bold uppercase tracking-widest text-[#141414]">Credenciais & CNPJ do Cliente (Pointer ID)</h2>
          </div>
          <span className="mono text-[10px] opacity-60 uppercase">Configuração</span>
        </div>

        <form onSubmit={saveConfig} className="p-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] mono font-bold uppercase block opacity-70">USUÁRIO DE ACESSO (LOGON)</label>
              <input
                type="text"
                value={logonUsername}
                onChange={e => setLogonUsername(e.target.value)}
                placeholder="Ex: VOGA PARK"
                className="w-full bg-transparent border border-[#141414] px-3 py-2 text-xs mono font-bold focus:bg-white focus:outline-none placeholder-[#141414]/30"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] mono font-bold uppercase block opacity-70">SENHA DE ACESSO (LOGON)</label>
              <input
                type="password"
                value={logonPassword}
                onChange={e => setLogonPassword(e.target.value)}
                placeholder="Ex: Voga@123"
                className="w-full bg-transparent border border-[#141414] px-3 py-2 text-xs mono font-bold focus:bg-white focus:outline-none placeholder-[#141414]/30"
              />
            </div>
          </div>

          <div className="space-y-1 pt-1">
            <label className="text-[10px] mono font-bold uppercase block opacity-70">CNPJ DO CLIENTE (POINTER ID)</label>
            <div className="flex gap-2.5">
              <input
                type="text"
                value={pointerCnpj}
                onChange={e => setPointerCnpj(e.target.value)}
                placeholder="Ex: 32757781000150"
                className="flex-1 bg-transparent border border-[#141414] px-3 py-2.5 text-xs mono font-bold focus:bg-white focus:outline-none placeholder-[#141414]/30"
              />
              <button
                type="submit"
                disabled={savingConfig}
                className="bg-[#141414] hover:opacity-90 transition-opacity text-[#E4E3E0] font-bold uppercase tracking-wider text-xs px-6 py-2.5 border border-[#141414] disabled:opacity-50 cursor-pointer"
              >
                {savingConfig ? 'SALVANDO...' : 'SALVAR'}
              </button>
            </div>
          </div>

          <div className="border-t border-[#141414]/20 pt-4 space-y-2">
            <p className="text-xs leading-relaxed text-[#141414]/90 uppercase font-medium">
              Nota: A nova arquitetura utiliza o token NAK (integrador) para obter chaves Bearer dinâmicas válidas por 30 minutos em cada ciclo de sincronização.
            </p>
            
            <div className="grid grid-cols-2 gap-4 text-[10px] mono opacity-80 uppercase font-bold">
              <div>
                <span className="block opacity-60">CNPJ DETECTADO NO TOKEN NAK:</span>
                <span className="text-xs">{jwtCnpj ? jwtCnpj : 'NENHUM DETECTADO'}</span>
              </div>
              <div>
                <span className="block opacity-60">CNPJ PADRÃO EM .ENV:</span>
                <span className="text-xs">{envCnpj ? envCnpj : 'NENHUM CONFIGURADO'}</span>
              </div>
            </div>
          </div>
        </form>
      </div>

      <div className="border border-[#141414] bg-[#E4E3E0] p-4 text-xs mono leading-relaxed opacity-80 uppercase">
        * Nota de Engenharia: A base sincroniza de forma incremental por meio do ID (Ponteiro) fornecido. Os dados de colaboradores são atualizados em lote para mapeamento em tempo real nos logs. Recomenda-se configurar e validar as variáveis em .env.
      </div>
    </div>
  );
}

function PeopleView() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');

  const fetchPeople = () => {
    setLoading(true);
    axios.get(`/api/people?page=${page}&limit=50&q=${query}`)
      .then(res => {
        setPeople(res.data.data);
        setTotal(res.data.total);
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchPeople();
  }, [page]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchPeople();
  };

  return (
    <div className="flex-1 overflow-hidden flex flex-col bg-[#E4E3E0]">
      {/* Search Bar */}
      <div className="p-3 border-b border-[#141414] bg-[#DCDAD7]/30 flex gap-2 items-center shrink-0">
        <form onSubmit={handleSearch} className="flex gap-2 items-center flex-1">
          <input 
            type="text" 
            placeholder="Buscar por nome, matrícula ou e-mail..." 
            className="bg-transparent border border-[#141414] px-3 py-1.5 text-xs mono w-96 focus:bg-white focus:outline-none placeholder-[#141414]/50"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button type="submit" className="bg-[#141414] text-[#E4E3E0] px-4 py-1.5 text-xs font-bold uppercase transition-opacity hover:opacity-90 cursor-pointer">Filtrar</button>
        </form>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="grid grid-cols-[140px_240px_minmax(180px,1fr)_180px_120px] bg-[#DCDAD7] border-b border-[#141414]">
          <div className="col-header">Matrícula</div>
          <div className="col-header">Nome</div>
          <div className="col-header">E-mail</div>
          <div className="col-header">Estrutura Org.</div>
          <div className="col-header">Situação</div>
        </div>

        <div className="flex-1 overflow-auto bg-[#E4E3E0]">
          {loading ? (
            <div className="p-12 text-center mono text-sm opacity-50 uppercase tracking-widest">Carregando colaboradores...</div>
          ) : people.length === 0 ? (
            <div className="p-12 text-center mono text-sm opacity-50 uppercase tracking-widest">Nenhum colaborador sincronizado.</div>
          ) : (
            people.map(p => {
              let payloadJson: any = {};
              try {
                if (p.payload_bruto) payloadJson = JSON.parse(p.payload_bruto);
              } catch (err) {}

              const situationCode = payloadJson.PersonSituation !== undefined ? payloadJson.PersonSituation : 10;
              const isInactive = payloadJson.Inactive || situationCode !== 10;
              const situationLabel = isInactive ? 'Inativo' : 'Ativo';

              return (
                <div key={p.id} className="grid grid-cols-[140px_240px_minmax(180px,1fr)_180px_120px] data-row text-sm">
                  <div className="mono font-bold">{p.matricula}</div>
                  <div className="font-bold text-xs uppercase truncate pr-2">{p.nome}</div>
                  <div className="mono text-xs text-black/70 truncate pr-2">{p.email || '-'}</div>
                  <div className="text-xs truncate opacity-85">
                    {p.estrutura_organizacional ? `Unidade ${p.estrutura_organizacional}` : 'Estrutura Padrão'}
                  </div>
                  <div>
                    <span className={cn(
                      "status-pill inline-block text-[9px] font-extrabold tracking-wider",
                      isInactive
                        ? "border-red-800 text-red-800" 
                        : "border-green-800 text-green-800"
                    )}>
                      {situationLabel}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Footer Pager */}
      <div className="h-[32px] shrink-0 bg-[#DCDAD7] border-t border-[#141414] px-4 flex items-center justify-between text-[10px] mono font-bold">
        <span className="opacity-60">
          MOSTRANDO ROWS {(page-1)*50 + (people.length > 0 ? 1 : 0)} - {(page-1)*50 + people.length} DE {total}
        </span>
        <div className="flex gap-2">
          <button 
            disabled={page === 1} 
            onClick={() => setPage(page-1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline cursor-pointer"
          >
            [ANTERIOR]
          </button>
          <button 
            disabled={(page * 50) >= total}
            onClick={() => setPage(page+1)}
            className="hover:underline disabled:opacity-30 disabled:no-underline cursor-pointer"
          >
            [PRÓXIMA]
          </button>
        </div>
      </div>
    </div>
  );
}

