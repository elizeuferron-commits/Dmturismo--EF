import React, { useMemo } from 'react';
import { Database, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';
import { motion } from 'motion/react';

interface DatabaseHealthMonitorProps {
  className?: string;
  variant?: 'compact' | 'full';
}

export const DatabaseHealthMonitor: React.FC<DatabaseHealthMonitorProps> = ({ className = '', variant = 'full' }) => {
  // Configurações do Banco de Dados extraídas do ambiente
  const databaseConfig = {
    projectId: "gen-lang-client-0708969846",
    databaseId: "ai-studio-dmturismo-98ffbc34-a1e2-4c6a-badf-f0aff2be91e8",
    vaultName: "DM_TURISMO_SAFE_VAULT",
    limitGB: 10,
    currentUsageGB: 0.85 // Valor simulado para demonstração da barra
  };

  const percentage = (databaseConfig.currentUsageGB / databaseConfig.limitGB) * 100;
  const isNearLimit = databaseConfig.limitGB - databaseConfig.currentUsageGB <= 1;

  if (variant === 'compact') {
    return (
      <div className={`flex items-center gap-3 bg-zinc-950/50 border border-zinc-800/50 rounded-xl px-4 py-2 ${className}`}>
        <div className="flex items-center gap-2">
          <Database size={14} className="text-brand-accent" />
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">
            {databaseConfig.vaultName}
          </span>
        </div>
        <div className="h-1.5 w-24 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            className={`h-full ${isNearLimit ? 'bg-rose-500' : 'bg-brand-accent'}`}
          />
        </div>
        <span className={`text-[10px] font-black tabular-nums ${isNearLimit ? 'text-rose-500' : 'text-zinc-300'}`}>
          {percentage.toFixed(1)}%
        </span>
      </div>
    );
  }

  return (
    <div className={`bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-5 space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-accent/10 border border-brand-accent/20 rounded-xl">
            <Database size={20} className="text-brand-accent" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-widest leading-none">
              Status do Cofre Digital
            </h4>
            <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1 tracking-wider">
              {databaseConfig.vaultName} • ID: {databaseConfig.databaseId.slice(0, 15)}...
            </p>
          </div>
        </div>
        
        {isNearLimit ? (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-500/10 border border-rose-500/30 rounded-lg animate-pulse">
            <AlertTriangle size={12} className="text-rose-500" />
            <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">
              ALERTA: LIMITE PRÓXIMO (-1GB)
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
            <ShieldCheck size={12} className="text-emerald-500" />
            <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">
              SISTEMA INTEGRO
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-end px-0.5">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
            Utilização de Dados
          </span>
          <span className="text-[11px] font-black text-white tabular-nums tracking-wider">
            {databaseConfig.currentUsageGB.toFixed(2)} GB / {databaseConfig.limitGB} GB
          </span>
        </div>
        
        <div className="h-3 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className={`h-full rounded-full relative group ${isNearLimit ? 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_12px_rgba(225,29,72,0.3)]' : 'bg-gradient-to-r from-brand-accent to-blue-400 shadow-[0_0_12px_rgba(10,132,255,0.2)]'}`}
          >
             <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>
        </div>
        
        <div className="flex justify-between items-center text-[8px] font-black text-zinc-600 uppercase tracking-[0.2em] pt-1">
          <span>{databaseConfig.projectId}</span>
          <span className="flex items-center gap-1">
            <Zap size={8} /> CLOUD FIRESTORE ENGINE
          </span>
        </div>
      </div>
    </div>
  );
};
