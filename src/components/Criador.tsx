import React, { useState } from 'react';
import { Bot as BotIcon, Sparkles, Lightbulb, FileText, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { AIConsultant } from './AIConsultant';
import { CreationTool } from './CreationTool';
import { OptimizationSuggestions } from './OptimizationSuggestions';
import { IntelligenceDossier } from './IntelligenceDossier';
import { ShadowLogVisualizer } from './ShadowLogVisualizer';

interface CriadorProps {
  user?: any;
  vehicles: any[];
  employees: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
  isShadowSplitOpen?: boolean;
  setIsShadowSplitOpen?: (open: boolean) => void;
}

export default function Criador({ 
  user,
  vehicles = [],
  employees = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = [],
  isShadowSplitOpen = false,
  setIsShadowSplitOpen
}: CriadorProps) {
  const [activeTab, setActiveTab] = useState<'consultor' | 'criacao' | 'sugestoes' | 'dossie' | 'sombra'>('sugestoes');

  const tabs = [
    { id: 'sugestoes', label: 'Otimização & Sugestões', icon: Lightbulb, desc: 'Otimização de cada ferramenta do aplicativo' },
    { id: 'dossie', label: 'Dossiê de Inteligência', icon: FileText, desc: 'Relatório avançado de diagnóstico situacional' },
    { id: 'consultor', label: 'Consultor IA', icon: BotIcon, desc: 'Assistente inteligente e análises preditivas' },
    { id: 'criacao', label: 'Criação', icon: Sparkles, desc: 'Gerenciador de sandbox e shadow modules' },
    { id: 'sombra', label: 'Status Sombra (Live)', icon: Eye, desc: 'Visualização interativa do progresso e log sombra' }
  ] as const;


  return (
    <div className="space-y-8">
      {/* Header unificado */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic">
            Núcleo <span className="text-brand-accent">Criador</span>
          </h1>
          <p className="text-zinc-500 font-medium tracking-tight">
            Painel de ferramentas avançadas: inteligência artificial e desenvolvimento modular.
          </p>
        </div>

        {/* Botão de Preview Sombra integrado no Criador */}
        {setIsShadowSplitOpen && (
          <button 
            onClick={() => setIsShadowSplitOpen(!isShadowSplitOpen)}
            className={cn(
              "px-5 py-3 relative rounded-xl transition-all active:scale-95 shadow-xl cursor-pointer flex items-center gap-2.5 group border self-start md:self-auto",
              isShadowSplitOpen
                ? "bg-amber-500 text-zinc-950 border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.35)]"
                : "bg-zinc-900 text-amber-400 border-amber-500/20 hover:bg-zinc-800 hover:border-amber-500/30"
            )}
            title="Abrir Simulador de Recursos Sombra"
            id="sombra-preview-toggle-button"
          >
            <Eye size={16} className={cn("transition-all duration-300", isShadowSplitOpen ? "scale-110 rotate-12" : "group-hover:scale-110 group-hover:rotate-12")} />
            <span className="text-[10px] font-black uppercase tracking-widest">Preview Sombra</span>
            <span className={cn(
              "w-1.5 h-1.5 rounded-full shrink-0",
              isShadowSplitOpen ? "bg-black animate-pulse" : "bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.9)]"
            )} />
          </button>
        )}
      </div>

      {/* Seletor de Abas Estilizado no Padrão DM Turismo (rounded-2xl) */}
      <div className="flex flex-wrap gap-3 p-2 bg-zinc-950/80 border border-white/5 rounded-2xl w-fit">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2.5 px-6 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
                isActive
                  ? "bg-zinc-800 text-brand-accent shadow-lg border border-zinc-700/50"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
              )}
            >
              <Icon size={14} className={isActive ? "text-brand-accent" : "text-zinc-600"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Renderização de abas com transição suave */}
      <div className="min-h-[500px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'sugestoes' && (
              <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl">
                <OptimizationSuggestions />
              </div>
            )}
            {activeTab === 'dossie' && (
              <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl">
                <IntelligenceDossier 
                  vehicles={vehicles}
                  employees={employees}
                  fuelLogs={fuelLogs}
                  maintenance={maintenance}
                  trips={trips}
                  finance={finance}
                />
              </div>
            )}
            {activeTab === 'consultor' && (
              <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl">
                <AIConsultant />
              </div>
            )}
            {activeTab === 'criacao' && (
              <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl">
                <CreationTool user={user} />
              </div>
            )}
            {activeTab === 'sombra' && (
              <div className="bg-zinc-900/40 rounded-[2.5rem] border border-white/5 p-6 backdrop-blur-md shadow-2xl">
                <ShadowLogVisualizer />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
