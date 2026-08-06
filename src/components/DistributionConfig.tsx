import React from 'react';
import { Smartphone, Zap, Shield, CheckCircle, Package, Globe, ExternalLink, Settings, Terminal } from 'lucide-react';
import { Card } from './Cards';
import { Button } from './UI';
import { toast } from 'sonner';

export const DistributionConfig = ({ appUrl }: { appUrl: string }) => {
  const configData = {
    version: "1.1.0-Production",
    packageName: "com.dmfrotas.industrial",
    engine: "PWA TWA (Trusted Web Activity)",
    lastSync: new Date().toLocaleDateString('pt-BR'),
    status: "Ready for Export"
  };

  const handleExportAPK = () => {
    const builderUrl = `https://www.pwabuilder.com/report?url=${encodeURIComponent(appUrl)}`;
    window.open(builderUrl, '_blank');
    toast.info("Iniciando Exportação APK", {
      description: "Use o PWABuilder para converter o manifesto atual em um binário de produção."
    });
  };

  return (
    <Card className="border-brand-accent/20 bg-zinc-950/40 p-8 overflow-hidden relative">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <Terminal size={150} />
      </div>

      <div className="flex flex-col lg:flex-row gap-10">
        <div className="flex-1 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/5 border border-zinc-800 rounded-xl flex items-center justify-center">
               <Smartphone className="text-brand-accent" size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tighter">Engenharia de Executável</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Sincronização PWA / Android / iOS</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Status do Manifest</span>
              <div className="flex items-center gap-2">
                <CheckCircle size={14} className="text-emerald-500" />
                <span className="text-xs font-bold text-white uppercase">Validado (v2)</span>
              </div>
            </div>
            <div className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest block mb-1">Service Worker</span>
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-brand-accent" />
                <span className="text-xs font-bold text-white uppercase">Live / Offline</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
             <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">ID do Pacote</span>
                <span className="text-xs font-mono text-brand-accent">{configData.packageName}</span>
             </div>
             <div className="flex justify-between items-center py-2 border-b border-zinc-900">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Build Target</span>
                <span className="text-xs font-bold text-white uppercase">{configData.engine}</span>
             </div>
             <div className="flex justify-between items-center py-2">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">App URL (Source)</span>
                <span className="text-[10px] font-bold text-zinc-400 truncate max-w-[200px]">{appUrl}</span>
             </div>
          </div>
        </div>

        <div className="lg:w-72 flex flex-col gap-3 justify-center">
          <Button onClick={handleExportAPK} className="h-14 w-full shadow-[0_0_20px_rgba(255,107,0,0.2)]">
            <Package size={20} />
            GERAR APK / BUNDLE
          </Button>
          <p className="text-[9px] text-zinc-500 font-bold uppercase text-center leading-relaxed px-4">
            Este comando prepara o manifesto técnico e abre o motor de exportação industrial para a Play Store.
          </p>
          <div className="mt-4 pt-4 border-t border-zinc-900 flex justify-center gap-6">
             <div className="text-center group cursor-help">
                <Globe size={18} className="text-zinc-700 group-hover:text-brand-accent transition-colors mx-auto mb-1" />
                <span className="text-[7px] font-black text-zinc-600 uppercase block">Desktop</span>
             </div>
             <div className="text-center group cursor-help">
                <Smartphone size={18} className="text-brand-accent mx-auto mb-1" />
                <span className="text-[7px] font-black text-white uppercase block">Native</span>
             </div>
             <div className="text-center group cursor-help">
                <Shield size={18} className="text-zinc-700 group-hover:text-emerald-500 transition-colors mx-auto mb-1" />
                <span className="text-[7px] font-black text-zinc-600 uppercase block">SSL/TWA</span>
             </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
