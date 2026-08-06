import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  Coffee, 
  LogOut, 
  Play, 
  History,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { Button } from './UI';
import { format, differenceInMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { toast } from 'sonner';

interface Journey {
  id?: string;
  employeeId: string;
  employeeName: string;
  date: string;
  startTime: string; // ISO string for firestore compatibility if not using timestamp
  endTime?: string;
  breaks: { start: string; end?: string }[];
  status: 'active' | 'on_break' | 'completed';
  totalMinutes?: number;
}

export const JourneyControl = ({ employee, journeys }: { employee: any, journeys: Journey[] }) => {
  const [loading, setLoading] = useState(false);

  const currentJourney = useMemo(() => {
    return journeys.find(j => j.employeeId === employee.uid && j.status !== 'completed');
  }, [journeys, employee.uid]);

  const recentJourneys = useMemo(() => {
    return journeys
      .filter(j => j.employeeId === employee.uid && j.status === 'completed')
      .slice(0, 10);
  }, [journeys, employee.uid]);

  const handleClockIn = async () => {
    setLoading(true);
    const now = new Date().toISOString();
    try {
      await addDoc(collection(db, 'journeys'), {
        employeeId: employee.uid,
        employeeName: employee.displayName || employee.name,
        date: format(new Date(), 'yyyy-MM-dd'),
        startTime: now,
        breaks: [],
        status: 'active',
        createdAt: serverTimestamp()
      });
      toast.success('Jornada iniciada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'journeys');
      toast.error('Erro ao iniciar jornada');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBreak = async () => {
    if (!currentJourney?.id) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      await updateDoc(doc(db, 'journeys', currentJourney.id), {
        status: 'on_break',
        breaks: [...(currentJourney.breaks || []), { start: now }]
      });
      toast.info('Intervalo iniciado');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'journeys');
    } finally {
      setLoading(false);
    }
  };

  const handleEndBreak = async () => {
    if (!currentJourney?.id) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      const updatedBreaks = [...(currentJourney.breaks || [])];
      const lastBreak = updatedBreaks[updatedBreaks.length - 1];
      if (lastBreak && !lastBreak.end) {
        lastBreak.end = now;
      }
      await updateDoc(doc(db, 'journeys', currentJourney.id), {
        status: 'active',
        breaks: updatedBreaks
      });
      toast.success('Retorno do intervalo');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'journeys');
    } finally {
      setLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentJourney?.id) return;
    setLoading(true);
    const now = new Date().toISOString();
    try {
      const minutes = differenceInMinutes(new Date(now), new Date(currentJourney.startTime));
      await updateDoc(doc(db, 'journeys', currentJourney.id), {
        status: 'completed',
        endTime: now,
        totalMinutes: minutes
      });
      toast.success('Jornada finalizada!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'journeys');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Stat Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-accent/10 rounded-xl text-brand-accent">
              <Clock size={20} />
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-white">Status da Jornada</span>
          </div>
          <p className="text-2xl font-black text-white">
            {currentJourney ? (currentJourney.status === 'on_break' ? 'EM INTERVALO' : 'EM SERVIÇO') : 'FORA DE SERVIÇO'}
          </p>
          {currentJourney && (
            <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">
              Início: {format(new Date(currentJourney.startTime), 'HH:mm')}
            </p>
          )}
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
              <Play size={20} />
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-white">Horas Hoje</span>
          </div>
          <p className="text-2xl font-black text-white">00:00</p>
          <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">Meta: 08:00 Diárias</p>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-brand-accent/10 rounded-xl text-brand-accent">
              <History size={20} />
            </div>
            <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest text-white">Restante</span>
          </div>
          <p className="text-2xl font-black text-brand-accent">08:00</p>
          <p className="text-[10px] font-bold text-zinc-500 uppercase mt-1">Até limite legal</p>
        </div>
      </div>

      {/* Main Controls */}
      <div className="p-8 bg-zinc-950 border border-zinc-800 rounded-[40px] relative overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-brand-accent" />
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 border-2 border-zinc-800 flex items-center justify-center overflow-hidden">
              {employee.photoUrl ? (
                <img src={employee.photoUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={32} className="text-zinc-700" />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-black text-white uppercase tracking-tight">{employee.name}</h2>
              <div className="flex items-center gap-2 text-zinc-500 mt-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                <span className="text-[10px] font-black uppercase tracking-widest">{employee.role}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {!currentJourney ? (
              <Button 
                onClick={handleClockIn} 
                loading={loading}
                className="px-10 py-6 h-auto bg-brand-accent text-zinc-950 hover:bg-brand-accent/90"
              >
                <div className="flex flex-col items-center">
                  <Play size={24} fill="currentColor" />
                  <span className="text-[10px] font-black uppercase tracking-widest mt-1">INICIAR JORNADA</span>
                </div>
              </Button>
            ) : (
              <>
                {currentJourney.status === 'active' ? (
                  <Button 
                    onClick={handleStartBreak} 
                    loading={loading}
                    className="px-10 py-6 h-auto bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700"
                  >
                    <div className="flex flex-col items-center">
                      <Coffee size={24} />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-1">PAUSA / REFEIÇÃO</span>
                    </div>
                  </Button>
                ) : (
                  <Button 
                    onClick={handleEndBreak} 
                    loading={loading}
                    className="px-10 py-6 h-auto bg-emerald-500 text-white hover:bg-emerald-600"
                  >
                    <div className="flex flex-col items-center">
                      <Play size={24} fill="currentColor" />
                      <span className="text-[10px] font-black uppercase tracking-widest mt-1">VOLTAR AO TRABALHO</span>
                    </div>
                  </Button>
                )}

                <Button 
                  onClick={handleClockOut} 
                  loading={loading}
                  className="px-10 py-6 h-auto bg-rose-500 text-white hover:bg-rose-600"
                >
                  <div className="flex flex-col items-center">
                    <LogOut size={24} />
                    <span className="text-[10px] font-black uppercase tracking-widest mt-1">FINALIZAR DIA</span>
                  </div>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Breakdowns & History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <History size={16} className="text-brand-accent" />
            Histórico Recente
          </h3>
          
          <div className="space-y-4">
            {recentJourneys.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-600">
                <Calendar size={40} strokeWidth={1} className="mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">Nenhuma jornada registrada</p>
              </div>
            ) : (
              recentJourneys.map((j, i) => (
                <div key={i} className="p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
                  <div>
                    <p className="text-xs font-black text-white">{format(new Date(j.date), 'dd/MM/yyyy')}</p>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase">
                      {format(new Date(j.startTime), 'HH:mm')} - {j.endTime ? format(new Date(j.endTime), 'HH:mm') : '--:--'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-black text-brand-accent">{Math.floor((j.totalMinutes || 0) / 60)}h {(j.totalMinutes || 0) % 60}m</p>
                    <div className="flex items-center gap-1 justify-end text-[8px] font-black text-emerald-500 uppercase tracking-widest">
                      <CheckCircle2 size={10} />
                      Validado
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl">
          <h3 className="text-xs font-black text-white uppercase tracking-widest mb-6 flex items-center gap-2">
            <AlertCircle size={16} className="text-brand-accent" />
            Regras de Jornada (Lei 13.103)
          </h3>
          
          <div className="space-y-4">
            <div className="p-4 bg-zinc-950/50 border border-zinc-800 border-l-4 border-l-brand-accent rounded-2xl">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Direção Contínua</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">Máximo de 5,5 horas ininterruptas. Descanso obrigatório de 30 min após este período.</p>
            </div>
            
            <div className="p-4 bg-zinc-950/50 border border-zinc-800 border-l-4 border-l-brand-accent rounded-2xl">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Repouso Diário</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">Mínimo de 11 horas de descanso entre duas jornadas de trabalho.</p>
            </div>

            <div className="p-4 bg-zinc-950/50 border border-zinc-800 border-l-4 border-l-brand-accent rounded-2xl">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1">Tempo de Espera</h4>
              <p className="text-[10px] text-zinc-500 leading-relaxed font-bold">Período que aguarda carga/descarga ou fiscalização não é computado na jornada.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
