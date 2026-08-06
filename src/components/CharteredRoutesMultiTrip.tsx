import React from 'react';
import { Plus, Trash2, Layers } from 'lucide-react';
import { Input } from './UI';

export interface DailyTripItem {
  id: string;
  time: string;
  label: string;
  value: number;
}

interface CharteredRoutesMultiTripProps {
  isMultiTripEnabled: boolean;
  onToggleMultiTrip: (enabled: boolean) => void;
  dailyTrips: DailyTripItem[];
  onChangeDailyTrips: (trips: DailyTripItem[]) => void;
  defaultTripValue: number;
}

export const CharteredRoutesMultiTrip: React.FC<CharteredRoutesMultiTripProps> = ({
  isMultiTripEnabled,
  onToggleMultiTrip,
  dailyTrips,
  onChangeDailyTrips,
  defaultTripValue
}) => {
  const handleAddTrip = () => {
    const newTrip: DailyTripItem = {
      id: Math.random().toString(36).substring(2, 9),
      time: '12:00',
      label: `Viagem ${dailyTrips.length + 1}`,
      value: defaultTripValue || 0
    };
    onChangeDailyTrips([...dailyTrips, newTrip]);
  };

  const handleRemoveTrip = (id: string) => {
    if (dailyTrips.length <= 1) return;
    onChangeDailyTrips(dailyTrips.filter(t => t.id !== id));
  };

  const handleUpdateTrip = (id: string, field: keyof DailyTripItem, val: any) => {
    onChangeDailyTrips(
      dailyTrips.map(t => (t.id === id ? { ...t, [field]: val } : t))
    );
  };

  return (
    <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-2xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-brand-accent/15 text-brand-accent flex items-center justify-center">
            <Layers size={16} />
          </div>
          <div>
            <span className="text-[10px] font-black text-white uppercase tracking-wider block font-sans">
              Múltiplas Viagens no Mesmo Dia
            </span>
            <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">
              Lançar 2 ou mais saídas/horários diários com valores individuais por viagem
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextState = !isMultiTripEnabled;
            onToggleMultiTrip(nextState);
            if (nextState && dailyTrips.length === 0) {
              onChangeDailyTrips([
                { id: '1', time: '07:00', label: 'Saída 1 (Manhã)', value: defaultTripValue || 0 },
                { id: '2', time: '17:00', label: 'Saída 2 (Tarde)', value: defaultTripValue || 0 }
              ]);
            }
          }}
          className={`py-1.5 px-3 border rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
            isMultiTripEnabled
              ? 'bg-brand-accent/20 border-brand-accent text-brand-accent font-sans'
              : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 font-sans'
          }`}
        >
          {isMultiTripEnabled ? 'Ativo (2+ Viagens)' : 'Ativar 2+ Viagens/Dia'}
        </button>
      </div>

      {isMultiTripEnabled && (
        <div className="space-y-3 pt-2 border-t border-zinc-900">
          <div className="flex items-center justify-between text-[8px] font-black uppercase text-zinc-400 tracking-wider">
            <span>Lista de Viagens/Saídas Diárias ({dailyTrips.length})</span>
            <span className="text-emerald-400 font-mono">
              Total do Dia: R$ {dailyTrips.reduce((acc, t) => acc + (Number(t.value) || 0), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {dailyTrips.map((trip, idx) => (
              <div key={trip.id} className="grid grid-cols-12 gap-2 bg-zinc-900/80 p-2.5 border border-zinc-800/80 rounded-xl items-center">
                <div className="col-span-1 text-center">
                  <span className="text-[9px] font-black text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded font-mono">
                    #{idx + 1}
                  </span>
                </div>

                <div className="col-span-3 space-y-1">
                  <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block">Horário</label>
                  <input
                    type="time"
                    value={trip.time}
                    onChange={(e) => handleUpdateTrip(trip.id, 'time', e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-2 text-[10px] text-white font-mono outline-none focus:border-brand-accent"
                  />
                </div>

                <div className="col-span-4 space-y-1">
                  <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block">Turno / Identificador</label>
                  <Input
                    placeholder="Ex: Turno 1 / Ida"
                    value={trip.label}
                    onChange={(e) => handleUpdateTrip(trip.id, 'label', e.target.value)}
                    className="py-1 px-2 text-[10px]"
                  />
                </div>

                <div className="col-span-3 space-y-1">
                  <label className="text-[7px] font-black text-emerald-400 uppercase tracking-widest block">Valor (R$)</label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={trip.value || ''}
                    onChange={(e) => handleUpdateTrip(trip.id, 'value', parseFloat(e.target.value) || 0)}
                    className="py-1 px-2 text-[10px] font-mono text-emerald-400 font-black"
                  />
                </div>

                <div className="col-span-1 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemoveTrip(trip.id)}
                    disabled={dailyTrips.length <= 1}
                    className="p-1.5 text-zinc-500 hover:text-red-400 disabled:opacity-30 disabled:hover:text-zinc-500 rounded-lg transition-colors cursor-pointer"
                    title="Remover saída"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={handleAddTrip}
            className="w-full py-2 border border-dashed border-zinc-800 hover:border-brand-accent/50 text-zinc-400 hover:text-brand-accent bg-zinc-900/40 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={12} />
            Adicionar Outra Viagem/Saída para este Dia
          </button>
        </div>
      )}
    </div>
  );
};
