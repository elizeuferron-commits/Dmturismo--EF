import React, { useState } from 'react';
import { ClipboardCheck, User, Gauge, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react';
import { Button, Input } from './UI';
import { CHECKLIST_ITEMS } from '../constants';
import { ChecklistItem } from '../types';
import { cn } from '../lib/utils';

interface ChecklistFormProps {
  onSubmit: (data: any) => void;
  loading?: boolean;
}

export const ChecklistForm = ({ onSubmit, loading }: ChecklistFormProps) => {
  const [items, setItems] = useState<ChecklistItem[]>(
    CHECKLIST_ITEMS.map((label, index) => ({
      id: index.toString(),
      label,
      status: 'ok'
    }))
  );

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    onSubmit({
      responsible: formData.get('responsible'),
      odometer: Number(formData.get('odometer')),
      observations: formData.get('observations'),
      items,
      date: new Date().toISOString()
    });
  };

  const updateItemStatus = (id: string, status: 'ok' | 'issue' | 'n/a') => {
    setItems(current => 
      current.map(item => item.id === id ? { ...item, status } : item)
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="grid grid-cols-2 gap-6">
        <Input 
          label="Responsável (RICARDO...)" 
          icon={User} 
          name="responsible" 
          required 
          placeholder="Nome do inspetor"
        />
        <Input 
          label="Odômetro Atual" 
          icon={Gauge} 
          name="odometer" 
          type="number" 
          required 
          placeholder="KM atual"
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Itens de Verificação</h3>
          <div className="flex gap-4">
            <span className="text-[8px] font-black text-zinc-600 uppercase">OK</span>
            <span className="text-[8px] font-black text-zinc-600 uppercase">AVARIA</span>
            <span className="text-[8px] font-black text-zinc-600 uppercase">N/A</span>
          </div>
        </div>

        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl divide-y divide-zinc-800/50 overflow-hidden">
          {items.map((item) => (
            <div key={item.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
              <span className="text-[10px] font-black text-zinc-300 uppercase leading-relaxed max-w-[70%]">
                {item.label}
              </span>
              
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateItemStatus(item.id, 'ok')}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    item.status === 'ok' ? "bg-green-500/20 text-green-500 border border-green-500/30" : "bg-zinc-900 text-zinc-700 border border-zinc-800 hover:text-zinc-500"
                  )}
                >
                  <CheckCircle2 size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateItemStatus(item.id, 'issue')}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    item.status === 'issue' ? "bg-rose-500/20 text-rose-500 border border-rose-500/30" : "bg-zinc-900 text-zinc-700 border border-zinc-800 hover:text-zinc-500"
                  )}
                >
                  <AlertCircle size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => updateItemStatus(item.id, 'n/a')}
                  className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                    item.status === 'n/a' ? "bg-zinc-800 text-zinc-400 border border-zinc-700" : "bg-zinc-900 text-zinc-700 border border-zinc-800 hover:text-zinc-500"
                  )}
                >
                  <HelpCircle size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest px-2">Observações Adicionais</label>
        <textarea
          name="observations"
          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-xs text-white placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-brand-accent/50 min-h-[100px]"
          placeholder="Ex: Pneu traseiro direito precisará de troca em breve..."
        />
      </div>

      <div className="pt-4">
        <Button loading={loading}>
          Salvar Checklist Completo
        </Button>
      </div>
    </form>
  );
};
