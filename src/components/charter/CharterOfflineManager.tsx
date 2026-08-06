import React, { useState, useEffect } from 'react';
import { 
  Wifi, WifiOff, RefreshCw, Database, Trash2, 
  AlertCircle, CheckCircle2, ChevronRight, Route, Clock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { charterIndexedDBService, PendingRouteItem } from '../../services/charterIndexedDBService';
import { Button } from '../UI';
import { toast } from 'sonner';

export const CharterOfflineManager: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingRoutes, setPendingRoutes] = useState<PendingRouteItem[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load pending routes from IndexedDB
  const loadPending = async () => {
    try {
      const list = await charterIndexedDBService.getPendingRoutes();
      setPendingRoutes(list);
    } catch (e) {
      console.error('Erro ao listar rotas de fretamento offline:', e);
    }
  };

  useEffect(() => {
    loadPending();

    // Listen to network status
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Listen to offline routes queue changes
    const handleQueueChange = (e: Event) => {
      const customEvent = e as CustomEvent<PendingRouteItem[]>;
      setPendingRoutes(customEvent.detail || []);
    };
    window.addEventListener('offline-charter-routes-changed', handleQueueChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('offline-charter-routes-changed', handleQueueChange);
    };
  }, []);

  // Sync hander
  const handleSync = async () => {
    if (pendingRoutes.length === 0 || isSyncing) return;
    setIsSyncing(true);
    try {
      await charterIndexedDBService.syncOfflineRoutes();
    } catch (e) {
      console.error('Falha ao acionar sincronização offline:', e);
    } finally {
      setIsSyncing(false);
      loadPending();
    }
  };

  // Remove offline route from the queue
  const handleRemove = async (id: string, name: string) => {
    if (window.confirm(`Deseja mesmo remover a rota "${name}" agendada offline de forma definitiva?`)) {
      try {
        await charterIndexedDBService.deletePendingRoute(id);
        toast.success(`Rota "${name}" removida da fila offline.`);
        loadPending();
      } catch (e) {
        toast.error('Erro ao remover rota pendente.');
      }
    }
  };

  return (
    <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden">
      {/* Background glow effects strictly aligned with DM Turismo theme */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-[50px] pointer-events-none" />
      
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent shadow-lg shadow-brand-accent/5">
            <Database size={18} />
          </div>
          <div>
            <span className="text-[8px] font-black tracking-widest text-[#ff6b00] uppercase font-sans">Sincronização Offline</span>
            <h3 className="text-sm font-black text-white uppercase tracking-tight">Fila de Fretamento (IndexedDB)</h3>
          </div>
        </div>

        {/* Connectivity Status Pill */}
        <div className={`px-3 py-1.5 rounded-xl border flex items-center gap-2 text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
          isOnline 
            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' 
            : 'bg-rose-500/10 border-rose-500/20 text-rose-500 animate-pulse'
        }`}>
          {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
          {isOnline ? 'CONEXÃO ATIVA' : 'SINAL REMOTO OFF'}
        </div>
      </div>

      <p className="text-zinc-400 text-xs mb-4 leading-relaxed">
        Agende novos fretamentos normalmente mesmo sem sinal de dados. Todas as rotas cadastradas serão preservadas em seu ecossistema IndexedDB e sincronizadas de forma automática assim que a internet for restabelecida.
      </p>

      {/* Pending list */}
      <div className="space-y-3">
        {pendingRoutes.length === 0 ? (
          <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-6 text-center">
            <div className="mx-auto w-8 h-8 rounded-full bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-500 mb-2">
              <CheckCircle2 size={16} />
            </div>
            <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Banco de Dados Local Sincronizado</p>
            <p className="text-[9px] text-zinc-600 uppercase mt-1">Nenhuma rota de fretamento pendente na fila.</p>
          </div>
        ) : (
          <>
            <div className="max-h-56 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar">
              <AnimatePresence>
                {pendingRoutes.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="p-3.5 bg-zinc-950/80 border border-white/5 rounded-2xl flex items-center justify-between gap-4 shadow-lg hover:border-brand-accent/20 transition-all group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-brand-accent transition-colors">
                        <Route size={14} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-white truncate uppercase">{item.routeData.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] px-1.5 py-0.5 bg-zinc-900 border border-white/5 text-zinc-400 font-bold rounded uppercase">
                            Cliente: {item.routeData.client}
                          </span>
                          <span className="text-[8px] text-zinc-500 flex items-center gap-1">
                            <Clock size={10} />
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleRemove(item.id, item.routeData.name)}
                        className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-zinc-950 rounded-xl transition-all cursor-pointer border border-rose-500/20"
                        title="Descartar da fila"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Sync control button bar */}
            <div className="pt-3 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[9px] font-black uppercase tracking-widest text-[#ff6b00] flex items-center gap-1.5">
                <AlertCircle size={12} className="animate-pulse" />
                {pendingRoutes.length} {pendingRoutes.length === 1 ? 'rota pendente' : 'rotas pendentes'} de sincronização
              </span>

              {isOnline && (
                <button
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="w-full sm:w-auto h-11 px-5 bg-[#ff6b00] hover:bg-white text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#ff6b00]/10 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw size={12} className={isSyncing ? 'animate-spin' : ''} />
                  {isSyncing ? 'Transmitindo...' : 'Sincronizar Agora'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
