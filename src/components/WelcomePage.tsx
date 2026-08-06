import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bus, Calendar, ChevronRight } from 'lucide-react';
import { motion } from 'motion/react';

export const WelcomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-white font-sans">
      <div className="absolute inset-0 map-pattern opacity-10 pointer-events-none" />
      
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900/70 border border-white/5 backdrop-blur-md rounded-[2.5rem] p-10 text-center shadow-2xl space-y-8"
      >
        <div className="mx-auto w-24 h-24 bg-brand-accent/10 rounded-3xl flex items-center justify-center text-brand-accent">
          <Bus size={48} />
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            DM <span className="text-brand-accent">Turismo</span>
          </h1>
          <p className="text-zinc-400 text-sm font-medium leading-relaxed italic">
            prazer em viajar bem
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard')}
          className="w-full h-16 bg-brand-accent text-zinc-950 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] hover:bg-white transition-all shadow-xl shadow-brand-accent/10 active:scale-95"
        >
          Portal de Frotas e Ativos <ChevronRight size={18} />
        </button>

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
          DM TURISMO PRO • SISTEMA INTEGRADO
        </p>
      </motion.div>
    </div>
  );
};
