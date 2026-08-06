import React from 'react';
import { Card } from './Cards';
import { AlertTriangle, Calendar } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '../lib/utils';
import { Vehicle, Employee } from '../types';

interface VencimentosProps {
  vehicleVencimentos: any[];
  driverVencimentos: Employee[];
}

export const Vencimentos = React.memo(({ vehicleVencimentos, driverVencimentos }: VencimentosProps) => {
  const [filterDays, setFilterDays] = React.useState<'all' | 7 | 15 | 30>('all');

  const filteredVehicleVencimentos = React.useMemo(() => {
    const list = vehicleVencimentos || [];
    if (filterDays === 'all') return list;
    return list.filter(item => {
      if (!item.date) return false;
      const days = differenceInDays(parseISO(item.date), new Date());
      return days <= filterDays;
    });
  }, [vehicleVencimentos, filterDays]);

  const filteredDriverVencimentos = React.useMemo(() => {
    const list = driverVencimentos || [];
    if (filterDays === 'all') return list;
    return list.filter(e => {
      if (!e.licenseExpiration) return false;
      const days = differenceInDays(parseISO(e.licenseExpiration), new Date());
      return days <= filterDays;
    });
  }, [driverVencimentos, filterDays]);

  return (
    <div className="space-y-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Vencimentos & Documentação</h1>
          <p className="text-zinc-350 font-medium tracking-tight">Monitoramento crítico de licenças, seguros e documentação de turismo.</p>
        </div>
        
        {/* Quick Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-zinc-900/40 p-1.5 rounded-2xl border border-zinc-900 self-stretch md:self-auto justify-center">
          <button
            onClick={() => setFilterDays('all')}
            className={cn(
              "px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-200 cursor-pointer active:scale-95",
              filterDays === 'all'
                ? "bg-brand-accent text-zinc-950 font-black shadow-lg shadow-brand-accent/10"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900/30"
            )}
          >
            Todos
          </button>
          <button
            onClick={() => setFilterDays(7)}
            className={cn(
              "px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-200 cursor-pointer active:scale-95",
              filterDays === 7
                ? "bg-brand-accent text-zinc-950 font-black shadow-lg shadow-brand-accent/10"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900/30"
            )}
          >
            7 Dias
          </button>
          <button
            onClick={() => setFilterDays(15)}
            className={cn(
              "px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-200 cursor-pointer active:scale-95",
              filterDays === 15
                ? "bg-brand-accent text-zinc-950 font-black shadow-lg shadow-brand-accent/10"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900/30"
            )}
          >
            15 Dias
          </button>
          <button
            onClick={() => setFilterDays(30)}
            className={cn(
              "px-4 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all duration-200 cursor-pointer active:scale-95",
              filterDays === 30
                ? "bg-brand-accent text-zinc-950 font-black shadow-lg shadow-brand-accent/10"
                : "text-zinc-400 hover:text-white hover:bg-zinc-900/30"
            )}
          >
            30 Dias
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <Card className="border-zinc-800 bg-rose-950/10">
          <h3 className="text-sm font-black uppercase text-rose-500 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-xl shadow-lg flex items-center justify-center border border-zinc-800 text-rose-500">
              <AlertTriangle size={20} />
            </div> 
            Licenciamento & Turismo (Próximos)
          </h3>
          <div className="space-y-4">
            {filteredVehicleVencimentos.length === 0 ? (
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest text-center py-10">
                Nenhum veículo com vencimento neste período.
              </p>
            ) : (
              filteredVehicleVencimentos.map(item => {
                const days = differenceInDays(parseISO(item.date!), new Date());
                const isExpiringSoon = days <= 15;
                const isExpired = days < 0;
                
                return (
                  <div key={item.id} className={cn(
                    "flex items-center justify-between p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 shadow-xl hover:bg-zinc-800 transition-all cursor-pointer group relative overflow-hidden",
                    isExpiringSoon && "border-amber-500/50 bg-amber-500/5",
                    isExpired && "border-rose-500/50 bg-rose-500/5"
                  )}>
                    {isExpiringSoon && (
                      <div className="absolute top-0 right-0 p-1">
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-0.5 rounded-bl-lg",
                          isExpired ? "bg-rose-500" : "bg-amber-500"
                        )}>
                          <AlertTriangle size={10} className="text-zinc-950" />
                          <span className="text-[8px] font-black text-zinc-950 uppercase">
                            {isExpired ? "Documento Vencido" : "Próximo do Vencimento"}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center font-black text-[10px] border border-zinc-800 transition-colors",
                        isExpired ? "text-rose-500 border-rose-500/30" : isExpiringSoon ? "text-amber-500 border-amber-500/30" : "text-rose-500 group-hover:border-rose-900/50"
                      )}>{item.icon}</div>
                      <div>
                        <div className="font-black text-white tracking-tight text-lg leading-none uppercase">{item.plate}</div>
                        <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">
                          {item.label}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-xs font-black tabular-nums",
                        isExpired ? "text-rose-500" : isExpiringSoon ? "text-amber-500" : "text-rose-500"
                      )}>
                        {format(parseISO(item.date!), 'dd/MM/yyyy')}
                      </div>
                      {isExpired ? (
                        <p className="text-[9px] font-black text-rose-500 uppercase mt-1">Vencido há {Math.abs(days)} dias</p>
                      ) : isExpiringSoon ? (
                        <p className="text-[9px] font-black text-amber-500/70 uppercase mt-1">Vence em {days} dias</p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
        
        <Card className="border-zinc-800 bg-amber-950/10">
          <h3 className="text-sm font-black uppercase text-amber-500 mb-8 flex items-center gap-4">
            <div className="w-12 h-12 bg-zinc-900 rounded-xl shadow-lg flex items-center justify-center border border-zinc-800 text-amber-500">
              <Calendar size={20} />
            </div> 
            Vencimento CNH Motoristas
          </h3>
          <div className="space-y-4">
            {filteredDriverVencimentos.length === 0 ? (
              <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest text-center py-10">
                Nenhum motorista com vencimento de CNH neste período.
              </p>
            ) : (
              filteredDriverVencimentos.map(e => {
                const days = differenceInDays(parseISO(e.licenseExpiration!), new Date());
                const isExpiringSoon = days <= 15;
                const isExpired = days < 0;

                return (
                  <div key={e.id} className={cn(
                    "flex items-center justify-between p-6 bg-zinc-900/50 rounded-2xl border border-zinc-800 shadow-xl hover:bg-zinc-800 transition-all cursor-pointer group relative overflow-hidden",
                    isExpiringSoon && "border-amber-500/50 bg-amber-500/5",
                    isExpired && "border-rose-500/50 bg-rose-500/5"
                  )}>
                    {isExpiringSoon && (
                      <div className="absolute top-0 right-0 p-1">
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 py-0.5 rounded-bl-lg",
                          isExpired ? "bg-rose-500" : "bg-amber-500"
                        )}>
                          <AlertTriangle size={10} className="text-zinc-950" />
                          <span className="text-[8px] font-black text-zinc-950 uppercase">
                            {isExpired ? "CNH Vencida" : "Próximo do Vencimento"}
                          </span>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 bg-zinc-950 rounded-xl flex items-center justify-center font-black text-[10px] border border-zinc-800 transition-colors",
                        isExpired ? "text-rose-500 border-rose-500/30" : "text-amber-500 group-hover:border-amber-900/50"
                      )}>CNH</div>
                      <div>
                        <div className="font-black text-white tracking-tight text-lg leading-none uppercase">{e.name}</div>
                        <div className="text-[9px] font-black text-zinc-400 uppercase tracking-widest mt-1">{e.role}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={cn(
                        "text-xs font-black tabular-nums",
                        isExpired ? "text-rose-500" : "text-amber-500"
                      )}>
                        {format(parseISO(e.licenseExpiration!), 'dd/MM/yyyy')}
                      </div>
                      {isExpired ? (
                        <p className="text-[9px] font-black text-rose-500 uppercase mt-1">Vencido há {Math.abs(days)} dias</p>
                      ) : isExpiringSoon ? (
                        <p className="text-[9px] font-black text-amber-500/70 uppercase mt-1">Vence em {days} dias</p>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
});
