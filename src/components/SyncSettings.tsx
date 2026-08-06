import React, { useState, useEffect } from 'react';
import { Save, CloudUpload, Database, Bell, History, Fuel, Wallet, MapPin, CheckCircle2, Clock, ShieldCheck, FileSpreadsheet, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Modal } from './UI';
import { backupService } from '../services/backupService';
import { auth, db, cleanUndefined } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { requestNotificationPermission } from '../lib/notifications';
import { getCacheStats, clearCache } from '../services/mediaCacheService';
import { clearFullAppCache, dbCacheService } from '../services/dbCacheService';

export const SyncSettings = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [interval, setInterval] = useState(() => {
    return localStorage.getItem('sync_interval_ms') || '30000';
  });
  const [backupFrequency, setBackupFrequency] = useState<string>('diario');
  const [exportFrequency, setExportFrequency] = useState<string>('semanal');
  const [loadingFrequencies, setLoadingFrequencies] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [cacheStats, setCacheStats] = useState<{ count: number; sizeBytes: number }>({ count: 0, sizeBytes: 0 });
  const [clearingCache, setClearingCache] = useState(false);

  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
    } catch (err) {
      console.error('Erro ao ler estatísticas de cache de mídia:', err);
    }
  };

  const loadBackupSettings = async () => {
    setLoadingFrequencies(true);
    try {
      let bFreq = localStorage.getItem('backup_frequency') || 'diario';
      let eFreq = localStorage.getItem('export_frequency') || 'semanal';

      const cached = await dbCacheService.getDocumentFromCache('settings/backup_settings');
      if (cached) {
        if (cached.backupFrequency) bFreq = cached.backupFrequency;
        if (cached.exportFrequency) eFreq = cached.exportFrequency;
      } else {
        try {
          const snap = await getDoc(doc(db, 'settings', 'backup_settings'));
          if (snap.exists()) {
            const data = snap.data();
            if (data.backupFrequency) bFreq = data.backupFrequency;
            if (data.exportFrequency) eFreq = data.exportFrequency;
            await dbCacheService.saveDocumentToCache('settings/backup_settings', data);
          }
        } catch (err) {
          console.warn('Erro ao carregar configurações de backup do Firestore:', err);
        }
      }
      setBackupFrequency(bFreq);
      setExportFrequency(eFreq);
    } catch (err) {
      console.error('Erro ao carregar configurações de backup:', err);
    } finally {
      setLoadingFrequencies(false);
    }
  };

  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearCache();
      toast.success('Cache de imagens de mídia limpo com sucesso!');
      await loadCacheStats();
    } catch (err) {
      toast.error('Erro ao limpar cache de mídias.');
    } finally {
      setClearingCache(false);
    }
  };

  const handleFullCacheClear = async () => {
    if (!window.confirm('Deseja realmente apagar TODO o cache offline do aplicativo? O aplicativo será recarregado após a limpeza.')) {
      return;
    }
    setClearingCache(true);
    try {
      await clearFullAppCache();
      toast.success('Cache do aplicativo limpo com sucesso! Recarregando...');
      setTimeout(() => {
        window.location.reload();
      }, 800);
    } catch (err) {
      toast.error('Erro ao efetuar limpeza geral de cache.');
      setClearingCache(false);
    }
  };

  const formatCacheBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  useEffect(() => {
    if (isOpen) {
      loadCacheStats();
      loadBackupSettings();
    }
  }, [isOpen]);

  const [syncLogs, setSyncLogs] = useState<any[]>(() => {
    try {
      const data = localStorage.getItem('dm_offline_sync_log_history');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const handleLogChanged = (e: any) => {
      if (e.detail) {
        setSyncLogs(e.detail);
      } else {
        try {
          const data = localStorage.getItem('dm_offline_sync_log_history');
          setSyncLogs(data ? JSON.parse(data) : []);
        } catch {}
      }
    };
    window.addEventListener('offline-sync-log-changed', handleLogChanged);
    return () => {
      window.removeEventListener('offline-sync-log-changed', handleLogChanged);
    };
  }, []);

  const presets = [
    { label: '30s', value: '30000' },
    { label: '1 min', value: '60000' },
    { label: '5 min', value: '300000' },
    { label: '15 min', value: '900000' },
  ];

  const handleRequestPermission = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast.error('Você precisa estar autenticado para ativar notificações.');
      return;
    }
    setRequestingPermission(true);
    try {
      const token = await requestNotificationPermission(user.uid);
      if (token) {
        toast.success('Notificações Push ativadas com sucesso!', {
          description: 'Este dispositivo receberá os alertas de viagens e manutenções.',
          duration: 4000
        });
      } else {
        toast.error('Não foi possível obter o token de notificação de push.');
      }
    } catch (err) {
      toast.error('Erro ao ativar notificações push.');
    } finally {
      setRequestingPermission(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      localStorage.setItem('sync_interval_ms', interval);
      localStorage.setItem('backup_frequency', backupFrequency);
      localStorage.setItem('export_frequency', exportFrequency);

      const email = auth.currentUser?.email || 'elizeuferron@gmail.com';
      const settingsData = {
        backupFrequency,
        exportFrequency,
        updatedAt: new Date().toISOString(),
        updatedBy: email
      };

      await setDoc(doc(db, 'settings', 'backup_settings'), cleanUndefined(settingsData), { merge: true });
      await dbCacheService.saveDocumentToCache('settings/backup_settings', settingsData);

      toast.success('Configurações salvas com sucesso!');
      window.dispatchEvent(new CustomEvent('sync-settings-changed'));
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar configurações:', err);
      toast.error('Erro ao salvar no Firestore: ' + (err?.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleTestConfiguredBackup = async () => {
    setIsBackingUp(true);
    try {
      const email = auth.currentUser?.email || 'elizeuferron@gmail.com';
      const triggered = await backupService.checkAndTriggerConfiguredBackup(email, backupFrequency);
      if (triggered) {
        toast.success(`Rotina de Backup (${backupFrequency.toUpperCase()}) executada e enviada com sucesso!`);
      } else {
        toast.info(`Rotina de Backup (${backupFrequency.toUpperCase()}): Execução realizada ou mantida conforme período do agendamento.`);
      }
    } catch (err: any) {
      console.error('Erro ao disparar rotina de backup:', err);
      toast.error('Erro ao executar backup: ' + (err?.message || err));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleTestConfiguredExport = async () => {
    setIsBackingUp(true);
    try {
      const email = auth.currentUser?.email || 'elizeuferron@gmail.com';
      const triggered = await backupService.checkAndTriggerConfiguredExport(email, exportFrequency);
      if (triggered) {
        toast.success(`Rotina de Exportação CSV (${exportFrequency.toUpperCase()}) executada com sucesso!`);
      } else {
        toast.info(`Rotina de Exportação CSV (${exportFrequency.toUpperCase()}): Nenhuma exportação pendente no momento.`);
      }
    } catch (err: any) {
      console.error('Erro ao disparar exportação CSV:', err);
      toast.error('Erro ao executar exportação CSV: ' + (err?.message || err));
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleManualCloudBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await backupService.triggerCloudBackup();
      if (res.success) {
        toast.success('Backup em Nuvem iniciado com sucesso!', {
          description: `Destino: ${res.gcsPath || 'Google Cloud Storage'}`,
          duration: 5000
        });
      } else {
        toast.error('Ocorreu um erro ao disparar a Cloud Function.');
      }
    } catch (err: any) {
      console.warn('Erro ao disparar Cloud Function. Tentando backup de contingência local:', err);
      toast.warning('Atenção: A Cloud Function de backup em nuvem não respondeu. Realizando backup no Firestore...', { duration: 4000 });
      try {
        const id = await backupService.performFullBackup('elizeuferron@gmail.com');
        toast.success(`Backup local salvo no Firestore! ID: ${id.substring(0, 6)}`);
      } catch (backupErr) {
        toast.error('Erro ao persistir backup alternativo local.');
      }
    } finally {
      setIsBackingUp(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Configurações do Sistema">
      <div className="space-y-6 pt-4 text-white">
        {/* Intervalo de Sincronização */}
        <div className="space-y-3 bg-zinc-900/35 border border-zinc-900 rounded-2xl p-4">
          <label className="block text-xs font-black text-zinc-400 uppercase tracking-widest">
            Sincronização Offline (PWA)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presets.map((p) => (
              <button
                key={p.value}
                onClick={() => setInterval(p.value)}
                className={`py-2 text-xs font-bold rounded-lg border transition-all ${
                  interval === p.value
                    ? 'bg-brand-accent text-zinc-950 border-brand-accent'
                    : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="pt-2">
            <label className="block text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-1.5">
              Ou digite manualmente (ms)
            </label>
            <input
              type="number"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white text-xs font-bold focus:border-brand-accent outline-none"
            />
          </div>
        </div>

        {/* Notificações Push Section */}
        <div className="space-y-4 bg-zinc-900/35 border border-zinc-900 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 text-brand-accent">
            <Bell size={16} />
            <h4 className="text-xs font-black uppercase tracking-wider font-sans">Notificações Push</h4>
          </div>
          
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Ative as notificações push para receber alertas instantâneos de novas viagens agendadas e manutenções corretivas em tempo real directamente no seu dispositivo.
          </p>

          <button
            onClick={handleRequestPermission}
            disabled={requestingPermission}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-805 hover:border-brand-accent/30 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
          >
            <Bell size={14} className={requestingPermission ? "animate-bounce text-brand-accent" : "text-brand-accent"} />
            {requestingPermission ? "Ativando..." : "Ativar neste Dispositivo"}
          </button>
        </div>

        {/* Gestão do Proprietário: Agendamento de Backups do Firestore e Exportações CSV */}
        <div className="space-y-4 bg-zinc-950 border border-brand-accent/25 rounded-2xl p-4 shadow-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-brand-accent">
              <ShieldCheck size={18} />
              <h4 className="text-xs font-black uppercase tracking-wider font-sans text-white">
                Frequência de Backups e Exportações CSV
              </h4>
            </div>
            <span className="text-[8px] font-black bg-brand-accent/15 text-brand-accent border border-brand-accent/30 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Proprietário
            </span>
          </div>

          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Defina a periodicidade das rotinas automáticas gerenciadas pelo <span className="text-white">backupService</span> para geração e salvamento de backups do Firestore e arquivos CSV.
          </p>

          {/* Opções de Frequência de Backup do Firestore */}
          <div className="space-y-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-emerald-400 text-xs font-black uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <Database size={14} />
                <span>Backup do Firestore / Storage</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-400">{backupFrequency.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { id: 'diario', label: 'Diário' },
                { id: 'semanal', label: 'Semanal' },
                { id: 'mensal', label: 'Mensal' },
                { id: 'desativado', label: 'Desativado' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setBackupFrequency(opt.id)}
                  className={`py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                    backupFrequency === opt.id
                      ? 'bg-emerald-500 text-zinc-950 border-emerald-400 shadow-sm font-black'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Opções de Frequência de Exportação CSV */}
          <div className="space-y-2 bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between text-brand-accent text-xs font-black uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={14} />
                <span>Exportações CSV (Trips & Fuel Logs)</span>
              </div>
              <span className="text-[9px] font-mono text-zinc-400">{exportFrequency.toUpperCase()}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
              {[
                { id: 'semanal', label: 'Semanal (Sexta)' },
                { id: 'quinzenal', label: 'Quinzenal' },
                { id: 'mensal', label: 'Mensal' },
                { id: 'desativado', label: 'Desativado' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setExportFrequency(opt.id)}
                  className={`py-2 px-1 text-[10px] font-black uppercase tracking-wider rounded-lg border transition-all ${
                    exportFrequency === opt.id
                      ? 'bg-brand-accent text-zinc-950 border-brand-accent shadow-sm font-black'
                      : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Execução de Teste Manual usando backupService */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={handleTestConfiguredBackup}
              disabled={isBackingUp || loadingFrequencies}
              className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-emerald-500/30 text-emerald-400 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isBackingUp ? "animate-spin text-emerald-400" : ""} />
              {isBackingUp ? "Executando..." : "Testar Backup Agendado"}
            </button>

            <button
              type="button"
              onClick={handleTestConfiguredExport}
              disabled={isBackingUp || loadingFrequencies}
              className="flex items-center justify-center gap-2 py-2.5 bg-zinc-900 hover:bg-zinc-850 border border-brand-accent/30 text-brand-accent rounded-xl font-black uppercase tracking-widest text-[9px] transition-all active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={12} className={isBackingUp ? "animate-spin text-brand-accent" : ""} />
              {isBackingUp ? "Executando..." : "Testar Export CSV Agendado"}
            </button>
          </div>
        </div>

        {/* Firestore Backup Section (Manual trigger requesting on demand export to Storage) */}
        <div className="space-y-4 bg-brand-accent/5 border border-brand-accent/15 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 text-brand-accent">
            <Database size={16} />
            <h4 className="text-xs font-black uppercase tracking-wider">Exportar Firestore</h4>
          </div>
          
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Realiza uma exportação nativa instantânea de todos os documentos do Firestore para o bucket do Google Cloud Storage da DM Turismo.
          </p>

          <button
            onClick={handleManualCloudBackup}
            disabled={isBackingUp}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-brand-accent/30 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
          >
            <CloudUpload size={14} className={isBackingUp ? "animate-bounce text-brand-accent" : "text-brand-accent"} />
            {isBackingUp ? "Efetuando Backup..." : "Backup Agora (Storage)"}
          </button>
        </div>

        {/* Storage JSON/CSV Backup Section */}
        <div className="space-y-4 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 text-emerald-500">
            <Database size={16} />
            <h4 className="text-xs font-black uppercase tracking-wider">Backup de Dados (JSON / CSV)</h4>
          </div>
          
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Efetua backup dos dados essenciais (veículos, funcionários e logs de manutenção) diretamente no Firebase Storage nos formatos JSON e CSV para fins de auditoria e contingência.
          </p>

          <button
            onClick={async () => {
              setIsBackingUp(true);
              try {
                const email = auth.currentUser?.email || 'elizeuferron@gmail.com';
                const res = await backupService.performDataStorageBackup(email);
                if (res.success) {
                  toast.success('Backup JSON/CSV gerado e salvo no Firebase Storage com sucesso!', {
                    description: `Pasta: backups/${new Date().toISOString().split('T')[0]}/`,
                    duration: 5000
                  });
                }
              } catch (err) {
                toast.error('Erro ao realizar o backup de dados no Firebase Storage.');
                console.error(err);
              } finally {
                setIsBackingUp(false);
              }
            }}
            disabled={isBackingUp}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-emerald-500/30 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
          >
            <CloudUpload size={14} className={isBackingUp ? "animate-bounce text-emerald-400" : "text-emerald-400"} />
            {isBackingUp ? "Processando..." : "Backup JSON/CSV (Storage)"}
          </button>
        </div>

        {/* Friday CSV Export Section */}
        <div className="space-y-4 bg-brand-accent/5 border border-brand-accent/15 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 text-brand-accent">
            <Database size={16} />
            <h4 className="text-xs font-black uppercase tracking-wider">Exportação Automática de Sexta-feira (CSV)</h4>
          </div>
          
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Exporta as coleções de viagens (<span className="text-brand-accent">trips</span>) e abastecimentos (<span className="text-brand-accent">fuel_logs</span>) para arquivos CSV no Firebase Storage toda sexta-feira às 23:59. Os arquivos são organizados de forma estruturada por pastas de ano e mês.
          </p>

          <button
            onClick={async () => {
              setIsBackingUp(true);
              try {
                const email = auth.currentUser?.email || 'elizeuferron@gmail.com';
                const todayStr = new Date().toISOString().split('T')[0];
                const res = await backupService.performFridayExport(email, todayStr);
                if (res.success) {
                  const [year, month] = todayStr.split('-');
                  toast.success('Exportação de Sexta-feira (trips, fuel_logs) gerada e salva com sucesso!', {
                    description: `Pasta: exports/${year}/${month}/`,
                    duration: 5000
                  });
                }
              } catch (err) {
                toast.error('Erro ao realizar a exportação no Firebase Storage.');
                console.error(err);
              } finally {
                setIsBackingUp(false);
              }
            }}
            disabled={isBackingUp}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-brand-accent/30 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
          >
            <CloudUpload size={14} className={isBackingUp ? "animate-bounce text-brand-accent" : "text-brand-accent"} />
            {isBackingUp ? "Processando..." : "Exportar Agora (CSV)"}
          </button>
        </div>

        {/* Cache de Imagens do Media Hub */}
        <div className="space-y-4 bg-indigo-500/5 border border-indigo-500/15 rounded-2xl p-4">
          <div className="flex items-center gap-2.5 text-indigo-400">
            <Database size={16} />
            <h4 className="text-xs font-black uppercase tracking-wider font-sans">Cache de Imagens do Media Hub</h4>
          </div>
          
          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Armazena imagens visualizadas em cache no IndexedDB para economizar o consumo de dados móveis (3G/4G/5G) e acelerar o carregamento offline.
          </p>

          <div className="bg-zinc-950/40 border border-white/5 rounded-xl p-3 flex justify-between items-center text-[10px] font-black uppercase tracking-wider font-mono">
            <span className="text-zinc-400">STATUS DO CACHE:</span>
            <span className="text-indigo-400">{cacheStats.count} imagens ({formatCacheBytes(cacheStats.sizeBytes)})</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              onClick={handleClearCache}
              disabled={clearingCache || cacheStats.count === 0}
              className="w-full flex items-center justify-center gap-2 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-indigo-500/30 text-white rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 disabled:opacity-50 disabled:pointer-events-none active:scale-95"
            >
              <History size={14} className={clearingCache ? "animate-spin text-indigo-400" : "text-indigo-400"} />
              {clearingCache ? "Limpando..." : "Limpar Cache Mídias"}
            </button>

            <button
              onClick={handleFullCacheClear}
              disabled={clearingCache}
              className="w-full flex items-center justify-center gap-2 py-3 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-500/30 hover:border-rose-500/60 text-rose-300 rounded-xl font-black uppercase tracking-widest text-[9px] transition-all duration-300 active:scale-95 shadow-sm"
            >
              <Database size={14} className={clearingCache ? "animate-spin text-rose-400" : "text-rose-400"} />
              Limpar Cache Completo
            </button>
          </div>
        </div>

        {/* Histórico de Sincronizações (Recentes) */}
        <div className="space-y-4 bg-zinc-900/35 border border-zinc-900 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 text-brand-accent">
              <History size={16} />
              <h4 className="text-xs font-black uppercase tracking-wider font-sans">Histórico de Sincronizações</h4>
            </div>
            {syncLogs.length > 0 && (
              <span className="text-[9px] font-black bg-brand-accent/10 border border-brand-accent/20 text-brand-accent px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                {syncLogs.length} ITENS
              </span>
            )}
          </div>

          <p className="text-zinc-400 text-[10px] uppercase font-bold tracking-tight leading-relaxed">
            Mural de registro das últimas 20 ações enfileiradas offline que foram transmitidas e gravadas com sucesso no servidor.
          </p>

          <div className="max-h-60 overflow-y-auto pr-1 space-y-2.5 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
            {syncLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-zinc-950/20 rounded-xl border border-dashed border-zinc-800/60 p-4">
                <CheckCircle2 size={22} className="text-zinc-700 mb-2 animate-pulse" />
                <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block">Sem histórico recente</span>
                <span className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-1 block">Ações sincronizadas offline aparecerão listadas aqui</span>
              </div>
            ) : (
              syncLogs.map((log) => {
                const getLogMeta = (type: string) => {
                  switch (type) {
                    case 'fuel_log':
                      return {
                        icon: <Fuel size={13} className="text-emerald-500" />,
                        title: 'Combustível',
                        badgeStyle: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      };
                    case 'financial_transaction':
                      return {
                        icon: <Wallet size={13} className="text-amber-500" />,
                        title: 'Financeiro',
                        badgeStyle: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                      };
                    case 'charter_route':
                      return {
                        icon: <MapPin size={13} className="text-sky-500" />,
                        title: 'Rotas',
                        badgeStyle: 'bg-sky-500/10 text-sky-500 border-sky-500/20'
                      };
                    default:
                      return {
                        icon: <CheckCircle2 size={13} className="text-zinc-500" />,
                        title: 'Sistema',
                        badgeStyle: 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
                      };
                  }
                };

                const meta = getLogMeta(log.type);

                const formatTime = (isoString?: string) => {
                  if (!isoString) return '';
                  try {
                    const date = new Date(isoString);
                    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) + ' ' + date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
                  } catch (e) {
                    return '';
                  }
                };

                return (
                  <div key={log.id} className="p-3 bg-zinc-950/50 border border-white/5 hover:border-brand-accent/15 rounded-xl transition-all duration-200 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="p-1 bg-zinc-900 border border-white/5 rounded-lg">
                          {meta.icon}
                        </div>
                        <span className="text-[10px] font-black text-white uppercase tracking-wider">{meta.title}</span>
                      </div>
                      <span className={`text-[8px] font-black border px-2 py-0.5 rounded uppercase tracking-wider ${meta.badgeStyle}`}>
                        Sincronizado
                      </span>
                    </div>

                    <p className="text-[11px] font-bold text-zinc-300 tracking-tight leading-relaxed">
                      {log.summary}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pt-1.5 border-t border-white/5 text-[8px] font-black uppercase text-zinc-500 tracking-wider font-mono">
                      <span className="flex items-center gap-1">
                        <Clock size={9} className="text-zinc-650 shrink-0" />
                        Criação: {formatTime(log.queuedTimestamp)}
                      </span>
                      <span className="text-brand-accent/80">
                        Envio: {formatTime(log.syncedTimestamp)}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl font-black uppercase tracking-widest text-xs transition-all active:scale-95 duration-300"
        >
          <Save size={16} />
          Salvar Configurações
        </button>
      </div>
    </Modal>
  );
};
