import React, { useState, useEffect, useMemo } from 'react';
import { 
  Bell, BellRing, AlertTriangle, Calendar, Clock, 
  Wrench, ShieldCheck, ChevronRight, Search, Sliders, Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInDays, parseISO, format, isToday, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MaintenanceLog, Vehicle, Employee } from '../types';
import { toast } from 'sonner';

interface MaintenanceRemindersProps {
  maintenance: MaintenanceLog[];
  vehicles: Vehicle[];
  employees: Employee[];
  onSelectMaintOS?: (log: MaintenanceLog) => void;
}

export const MaintenanceReminders: React.FC<MaintenanceRemindersProps> = ({
  maintenance = [],
  vehicles = [],
  employees = [],
  onSelectMaintOS
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'overdue' | 'today' | 'upcoming'>('all');
  
  // Customizable threshold: how many days ahead counts as "close to expiration"
  const [thresholdDays, setThresholdDays] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dm_maint_reminder_threshold');
      return saved ? parseInt(saved, 10) : 7;
    }
    return 7;
  });

  // Sound configuration: play a high-fidelity chime when entering if there are critical items
  const [isSoundEnabled, setIsSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dm_maint_reminder_sound');
      return saved ? saved === 'true' : true;
    }
    return true;
  });

  // Persist threshold configuration
  const handleThresholdChange = (days: number) => {
    setThresholdDays(days);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dm_maint_reminder_threshold', days.toString());
    }
    toast.info(`Limite de alerta ajustado: Lembretes ativos para OS que vencem em até ${days} dias.`);
  };

  // Persist sound preference
  const toggleSound = () => {
    const newValue = !isSoundEnabled;
    setIsSoundEnabled(newValue);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dm_maint_reminder_sound', newValue.toString());
    }
    toast.success(newValue ? 'Sons de notificação ativados!' : 'Sons de notificação desativados.');
  };

  // Synthesis acoustic chime engine
  const playCriticalChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const playNote = (freq: number, startTime: number, duration: number, type: 'sine' | 'triangle') => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.frequency.setValueAtTime(freq, startTime);
        osc.type = type;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(type === 'sine' ? 0.15 : 0.08, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = ctx.currentTime;
      // 3-note harmonic melodic sequence for DM Turismo premium look-and-feel
      playNote(440, now, 0.4, 'sine');        // A4
      playNote(554.37, now + 0.15, 0.4, 'sine'); // C#5
      playNote(659.25, now + 0.3, 0.6, 'triangle'); // E5
      
    } catch (e) {
      console.warn('Som bloqueado pelo navegador ou de contexto inativo:', e);
    }
  };

  // Filter out completed and keep only pending O.S. for reminder scanning
  const pendingOSList = useMemo(() => {
    return maintenance.filter(m => m.status === 'pending');
  }, [maintenance]);

  // Map reminders data structure with calculated metrics
  const reminders = useMemo(() => {
    const todayStr = format(new Date(), 'yyyy-MM-DD');
    const today = new Date();
    today.setHours(0,0,0,0);

    return pendingOSList.map(maint => {
      const vehicle = vehicles.find(v => v.id === maint.vehicleId);
      const scheduled = maint.scheduledDate ? parseISO(maint.scheduledDate) : new Date();
      scheduled.setHours(0,0,0,0);
      
      const daysDiff = differenceInDays(scheduled, today);
      
      let urgency: 'expired' | 'today' | 'upcoming' | 'planned' = 'planned';
      let priority: 'critical' | 'high' | 'medium' | 'low' = 'low';

      if (daysDiff < 0) {
        urgency = 'expired';
        priority = 'critical';
      } else if (daysDiff === 0) {
        urgency = 'today';
        priority = 'high';
      } else if (daysDiff <= thresholdDays) {
        urgency = 'upcoming';
        priority = 'medium';
      }

      return {
        id: maint.id,
        rawLog: maint,
        vehicle,
        description: maint.description,
        type: maint.type,
        scheduledDate: maint.scheduledDate,
        daysDiff,
        urgency,
        priority
      };
    }).sort((a, b) => a.daysDiff - b.daysDiff);
  }, [pendingOSList, vehicles, thresholdDays]);

  // Aggregate states
  const stats = useMemo(() => {
    const expiredCount = reminders.filter(r => r.urgency === 'expired').length;
    const todayCount = reminders.filter(r => r.urgency === 'today').length;
    const upcomingCount = reminders.filter(r => r.urgency === 'upcoming').length;
    
    return {
      expired: expiredCount,
      today: todayCount,
      upcoming: upcomingCount,
      totalPending: reminders.length
    };
  }, [reminders]);

  // Filter list based on search and selected filter tab
  const filteredReminders = useMemo(() => {
    return reminders.filter(r => {
      // 1. Filter by active selected tab
      if (activeFilter === 'overdue' && r.urgency !== 'expired') return false;
      if (activeFilter === 'today' && r.urgency !== 'today') return false;
      if (activeFilter === 'upcoming' && r.urgency !== 'upcoming') return false;

      // 2. Filter by search text
      const search = searchTerm.toLowerCase();
      const plate = r.vehicle?.plate?.toLowerCase() || '';
      const model = r.vehicle?.model?.toLowerCase() || '';
      const desc = r.description?.toLowerCase() || '';
      
      return plate.includes(search) || model.includes(search) || desc.includes(search);
    });
  }, [reminders, activeFilter, searchTerm]);

  // Play alarm chime and show notifications on mount if overdue logs exist
  useEffect(() => {
    if (stats.expired > 0) {
      // Show summary notifications toast
      toast.error(`ATENÇÃO DE FROTA: Existem ${stats.expired} ordens de serviço vencidas!`, {
        description: 'É necessário regularizar as manutenções de segurança pendentes de forma prioritária.',
        duration: 8000,
        icon: '⚠️'
      });

      if (isSoundEnabled) {
        // Debounce slightly to bypass immediate render blockages
        const timer = setTimeout(() => {
          playCriticalChime();
        }, 500);
        return () => clearTimeout(timer);
      }
    } else if (stats.today > 0) {
      toast.warning(`ORDENS DE HOJE: Você tem ${stats.today} manutenções agendadas para hoje.`, {
        description: 'Atente-se cronologicamente com os motoristas das OS em aberto hoje.',
        duration: 6000
      });
    }
  }, [stats.expired, stats.today]);

  return (
    <div className="bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* Glow highlight reflecting premium tone */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-brand-accent/5 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800/40 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent relative shadow-lg shadow-brand-accent/5">
            {stats.expired > 0 ? (
              <>
                <BellRing size={20} className="animate-bounce" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 rounded-full border border-zinc-950 animate-ping" />
              </>
            ) : (
              <Bell size={20} />
            )}
          </div>
          <div>
            <span className="text-[8px] font-black tracking-widest text-brand-accent uppercase font-sans">RECURSO DE SEGURANÇA</span>
            <h2 className="text-base font-black text-white uppercase tracking-tight">Vencimentos de Ordens de Serviço (OS)</h2>
          </div>
        </div>

        {/* Configuration widgets bar */}
        <div className="flex items-center gap-3.5 flex-wrap">
          {/* Sound toggle switch */}
          <button
            onClick={toggleSound}
            className={`p-2.5 rounded-xl border text-[9px] font-black uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer ${
              isSoundEnabled 
                ? 'bg-zinc-950 text-brand-accent border-brand-accent/20' 
                : 'bg-zinc-950 text-zinc-500 border-zinc-850'
            }`}
            title="Toggle alerts audio"
          >
            <Clock size={11} className={isSoundEnabled ? "animate-pulse" : ""} />
            <span>Chime {isSoundEnabled ? 'ATIVO' : 'MUTADO'}</span>
          </button>

          {/* Test synth button */}
          <button
            onClick={playCriticalChime}
            className="p-2.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl border border-zinc-850 text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 transition-all cursor-pointer"
            title="Test audio synthesis system"
          >
            <Play size={10} />
            <span>Testar Chime</span>
          </button>
        </div>
      </div>

      {/* INTERVAL DURATION SLIDER CONFIGURATION PANEL */}
      <div className="p-4 bg-zinc-950/60 border border-white/5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Sliders className="text-zinc-500 shrink-0" size={18} />
          <div>
            <h4 className="text-xs font-black text-zinc-300 uppercase">Definição do Intervalo de Alerta</h4>
            <p className="text-[10px] text-zinc-500 uppercase mt-0.5 font-medium">Quantos dias até o agendamento gerará o aviso para a frota?</p>
          </div>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <input 
            type="range" 
            min="3" 
            max="30" 
            step="1"
            value={thresholdDays} 
            onChange={(e) => handleThresholdChange(parseInt(e.target.value, 10))}
            className="w-40 accent-brand-accent cursor-pointer"
          />
          <div className="w-14 text-center font-mono font-black text-[#ff6b00] text-xs bg-[#ff6b00]/10 border border-[#ff6b00]/20 px-2 py-1 rounded-lg">
            {thresholdDays}D
          </div>
        </div>
      </div>

      {/* CORE STATS HIGHLIGHTING CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total stats */}
        <div 
          onClick={() => setActiveFilter('all')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 ${
            activeFilter === 'all' 
              ? 'bg-zinc-950 border-brand-accent/40 shadow-lg shadow-brand-accent/5' 
              : 'bg-zinc-950/40 border-white/5 hover:border-zinc-800'
          }`}
        >
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Abertas Totais</span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-white">{stats.totalPending}</span>
            <span className="text-[10px] text-zinc-600 font-extrabold uppercase font-mono">Ordens</span>
          </div>
        </div>

        {/* Expired count */}
        <div 
          onClick={() => setActiveFilter('overdue')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 relative overflow-hidden ${
            activeFilter === 'overdue' 
              ? 'bg-rose-950/50 border-rose-500/50 shadow-lg shadow-rose-950/20' 
              : 'bg-zinc-950/40 border-white/5 hover:border-zinc-800'
          }`}
        >
          {stats.expired > 0 && (
            <div className="absolute right-0 top-0 w-12 h-12 bg-rose-500/5 rounded-full blur-xl animate-pulse" />
          )}
          <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
            <AlertTriangle size={11} className={stats.expired > 0 ? "animate-bounce" : ""} />
            Atrasadas / Expiradas
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black ${stats.expired > 0 ? 'text-rose-500' : 'text-zinc-600'}`}>{stats.expired}</span>
            <span className="text-[10px] text-zinc-600 font-extrabold uppercase font-mono">Críticas</span>
          </div>
        </div>

        {/* Today count */}
        <div 
          onClick={() => setActiveFilter('today')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 ${
            activeFilter === 'today' 
              ? 'bg-amber-950/50 border-amber-500/50 shadow-lg shadow-amber-950/20' 
              : 'bg-zinc-950/40 border-white/5 hover:border-zinc-800'
          }`}
        >
          <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
            <Clock size={11} />
            Agendadas Hoje
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black ${stats.today > 0 ? 'text-amber-500' : 'text-zinc-600'}`}>{stats.today}</span>
            <span className="text-[10px] text-zinc-600 font-extrabold uppercase font-mono">Hoje</span>
          </div>
        </div>

        {/* Near expiration count */}
        <div 
          onClick={() => setActiveFilter('upcoming')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between h-24 ${
            activeFilter === 'upcoming' 
              ? 'bg-sky-950/50 border-sky-500/50 shadow-lg' 
              : 'bg-zinc-950/40 border-white/5 hover:border-zinc-800'
          }`}
        >
          <span className="text-[9px] font-black text-sky-400 uppercase tracking-widest flex items-center gap-1.5">
            <Calendar size={11} />
            Eminentes ({thresholdDays}d)
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-black ${stats.upcoming > 0 ? 'text-sky-400' : 'text-zinc-600'}`}>{stats.upcoming}</span>
            <span className="text-[10px] text-zinc-600 font-extrabold uppercase font-mono">Próximas</span>
          </div>
        </div>
      </div>

      {/* FILTER SEARCH BOX UNIT */}
      <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-850 shadow-xl items-center mb-1">
        <Search className="text-zinc-500 ml-4 shrink-0" size={16} />
        <input 
          type="text" 
          placeholder="Filtrar por placa do veículo, modelo ou descrição do serviço..."
          className="bg-transparent text-xs font-black uppercase text-white placeholder:text-zinc-600 pl-3.5 pr-6 py-2.5 w-full outline-none tracking-widest font-sans"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
      </div>

      {/* REMINDERS LIST */}
      <div className="space-y-3.5">
        {filteredReminders.length === 0 ? (
          <div className="bg-zinc-950/30 border border-white/5 rounded-[2rem] py-12 text-center">
            <ShieldCheck size={40} className="text-zinc-700 mx-auto stroke-[1.25]" />
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-zinc-500 mt-4">Nenhum lembrete correspondente localizado</p>
            <p className="text-[9px] text-zinc-600 font-semibold uppercase mt-1.5">A manutenção da sua frota está em dia com os filtros estipulados.</p>
          </div>
        ) : (
          <div className="max-h-[350px] overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
            <AnimatePresence>
              {filteredReminders.map((rem) => (
                <motion.div
                  key={rem.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 bg-zinc-950 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-brand-accent/30 transition-all shadow-md group relative overflow-hidden`}
                >
                  {/* Color stripe highlighting based on severity */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
                    rem.urgency === 'expired' ? 'bg-rose-500' :
                    rem.urgency === 'today' ? 'bg-amber-500' :
                    rem.urgency === 'upcoming' ? 'bg-sky-500' : 'bg-zinc-800'
                  }`} />

                  {/* Left Column: Title, vehicle and info */}
                  <div className="pl-2.5 flex items-start gap-3.5 min-w-0 flex-1">
                    <div className="w-9 h-9 bg-zinc-900 border border-white/5 rounded-xl flex items-center justify-center text-zinc-400 group-hover:text-brand-accent shrink-0 transition-colors">
                      <Wrench size={15} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Vehicle Placa Badge */}
                        <span className="text-[10px] font-black tracking-wider text-white px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded uppercase">
                          {rem.vehicle?.plate?.toUpperCase() || 'SEM PLACA'}
                        </span>
                        
                        {/* Vehicle Model */}
                        <span className="text-[10px] font-bold text-zinc-500 truncate max-w-[150px] uppercase">
                          {rem.vehicle?.model || 'Desconhecido'}
                        </span>

                        {/* OS Type */}
                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase font-mono border ${
                          rem.type === 'preventive' 
                            ? 'bg-sky-500/10 text-sky-400 border-sky-500/15' 
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/15'
                        }`}>
                          {rem.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}
                        </span>
                      </div>

                      <h4 className="text-xs font-black text-white mt-1.5 uppercase truncate tracking-wide">
                        {rem.description || 'ORDEM DE SERVIÇO DE MANUTENÇÃO'}
                      </h4>
                    </div>
                  </div>

                  {/* Right Column: Time/Date countdown badge & interactive actions */}
                  <div className="flex items-center justify-between md:justify-end gap-4 border-t md:border-t-0 border-zinc-900 pt-3 md:pt-0 shrink-0">
                    <div className="text-left md:text-right">
                      {/* Formatted scheduled date */}
                      <div className="text-[10px] text-zinc-500 uppercase font-bold flex items-center gap-1 md:justify-end">
                        <Calendar size={11} />
                        <span>Agendado para:</span>
                        <strong className="text-zinc-300 font-mono">
                          {rem.scheduledDate ? format(parseISO(rem.scheduledDate), 'dd/MM/yyyy') : '---'}
                        </strong>
                      </div>

                      {/* Countdown description */}
                      <span className={`text-[10px] font-black uppercase mt-1 inline-block ${
                        rem.urgency === 'expired' ? 'text-rose-500 animate-pulse' :
                        rem.urgency === 'today' ? 'text-amber-500' :
                        rem.urgency === 'upcoming' ? 'text-sky-400' : 'text-zinc-500'
                      }`}>
                        {rem.daysDiff < 0 ? `ATRASADO OPERACIONAL HÁ ${Math.abs(rem.daysDiff)} ${Math.abs(rem.daysDiff) === 1 ? 'DIA' : 'DIAS'}` :
                         rem.daysDiff === 0 ? 'EXPIRA HOJE NO CRONOGRAMA' :
                         `VENCE EM ${rem.daysDiff} ${rem.daysDiff === 1 ? 'DIA' : 'DIAS'}`}
                      </span>
                    </div>

                    {/* Interactive Click Trigger to open dossier */}
                    {onSelectMaintOS && (
                      <button
                        onClick={() => onSelectMaintOS(rem.rawLog)}
                        className="py-2.5 px-3.5 bg-zinc-900 border border-zinc-800 text-brand-accent hover:text-zinc-950 hover:bg-brand-accent rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer hover:scale-105 active:scale-95"
                      >
                        <span>ABRIR OS</span>
                        <ChevronRight size={11} />
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
};
