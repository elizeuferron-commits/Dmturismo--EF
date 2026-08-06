import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Plus, Trash2, MapPin, 
  Map, Phone, Users, Clock, 
  Calendar, CheckCircle, HelpCircle, 
  Upload, Sparkles
} from 'lucide-react';
import { Input, Button, Select } from '../UI';
import { cn } from '../../lib/utils';
import { CharteredRoute, Passenger, CustomTrip } from './CharterTypes';

interface AddRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  employees: any[];
  clients: any[];
  onAddRoute: (routeData: any) => Promise<void>;
  defaultClientName?: string;
}

export const AddRouteModal: React.FC<AddRouteModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  employees,
  clients,
  onAddRoute,
  defaultClientName
}) => {
  const [form, setForm] = useState({
    name: '',
    client: defaultClientName || '',
    type: 'factory' as 'factory' | 'school' | 'other' | 'regular_random',
    daysOfWeek: [1, 2, 3, 4, 5],
    schedules: [{ departureTime: '08:00', returnTime: '17:00' }],
    locationUrl: '',
    fixedVehicleId: '',
    fixedDriverId: '',
    passengers: [] as Passenger[],
    contractValue: 0
  });

  const [rawPassengersText, setRawPassengersText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  if (!isOpen) return null;

  const handleToggleDay = (day: number) => {
    const current = form.daysOfWeek;
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day].sort((a, b) => a - b);
    setForm({ ...form, daysOfWeek: updated });
  };

  const handleAddPassenger = () => {
    setForm({
      ...form,
      passengers: [...form.passengers, { name: '', phone: '', boardingTime: '', locationUrl: '' }]
    });
  };

  const handleRemovePassenger = (idx: number) => {
    setForm({
      ...form,
      passengers: form.passengers.filter((_, i) => i !== idx)
    });
  };

  const handleUpdatePassenger = (idx: number, field: keyof Passenger, val: string) => {
    const updated = form.passengers.map((p, i) => {
      if (i === idx) {
        return { ...p, [field]: val };
      }
      return p;
    });
    setForm({ ...form, passengers: updated });
  };

  const handlePasteImport = () => {
    if (!rawPassengersText.trim()) return;
    const lines = rawPassengersText.split('\n');
    const newPsgs: Passenger[] = [];
    lines.forEach(line => {
      const parts = line.split(/[;\t,]/);
      if (parts[0] && parts[0].trim()) {
        newPsgs.push({
          name: parts[0].trim(),
          phone: parts[1] ? parts[1].trim() : '',
          boardingTime: parts[2] ? parts[2].trim() : '',
          locationUrl: parts[3] ? parts[3].trim() : ''
        });
      }
    });

    setForm({
      ...form,
      passengers: [...form.passengers, ...newPsgs]
    });
    setRawPassengersText('');
    setShowImportArea(false);
  };

  const handleSubmit = async () => {
    await onAddRoute(form);
  };

  return (
    <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
              <Plus size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight font-sans">Cadastrar Nova Rota Contínua</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 font-sans">Fretamento Recorrente Industrial ou Escolar</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-950/40 hover:bg-zinc-850/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Informações Primárias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Nome da Escala / Rota *</label>
              <Input 
                placeholder="Ex: Rota 05 - Turno Matutino" 
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Cliente / Empresa *</label>
              <Select 
                value={form.client}
                onChange={(e) => setForm({...form, client: e.target.value})}
                disabled={!!defaultClientName}
                options={[
                  { value: '', label: 'SELECIONAR CLIENTE' },
                  ...clients.map(c => ({ value: c.name, label: c.name.toUpperCase() }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Tipo de Serviço</label>
              <Select 
                value={form.type}
                onChange={(e) => setForm({...form, type: e.target.value as any})}
              >
                <option value="factory">Industrial / Fábrica</option>
                <option value="school">Escolar / Universitário</option>
                <option value="other">Outros / Eventos</option>
                <option value="regular_random">Cliente Regular (Viagens Avulsas)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Valor Mensal do Contrato</label>
              <Input 
                type="number"
                placeholder="R$ 0,00" 
                value={form.contractValue || ''}
                onChange={(e) => setForm({...form, contractValue: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          {/* Vínculo de frota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-brand-accent uppercase tracking-widest block ml-1 font-sans">Veículo Fixo Escalado</label>
              <Select 
                value={form.fixedVehicleId}
                onChange={(e) => setForm({...form, fixedVehicleId: e.target.value})}
                options={[
                  { value: '', label: 'NENHUM VEÍCULO FIXADO' },
                  ...vehicles.map(v => ({
                    value: v.id,
                    disabled: v.status === 'maintenance' || v.status === 'unavailable',
                    label: `${v.plate?.toUpperCase()} - ${v.model?.toUpperCase()} (${v.type?.toUpperCase() || 'VEÍCULO'})`
                  }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Motorista Responsável</label>
              <Select 
                value={form.fixedDriverId}
                onChange={(e) => setForm({...form, fixedDriverId: e.target.value})}
                options={[
                  { value: '', label: 'NENHUM MOTORISTA FIXADO' },
                  ...employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => ({
                    value: e.id,
                    label: `${e.name.toUpperCase()} (${e.role || 'EQUIPE'})`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Dias da Semana e Horários */}
          <div className="space-y-4">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Recorrência Operacional</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block">Schedules diários</label>
                <div className="flex gap-2">
                  <Input 
                    type="time" 
                    value={form.schedules[0]?.departureTime || '08:00'} 
                    onChange={(e) => setForm({
                      ...form, 
                      schedules: [{ departureTime: e.target.value, returnTime: form.schedules[0]?.returnTime || '17:00' }]
                    })}
                  />
                  <Input 
                    type="time" 
                    value={form.schedules[0]?.returnTime || '17:00'} 
                    onChange={(e) => setForm({
                      ...form, 
                      schedules: [{ departureTime: form.schedules[0]?.departureTime || '08:00', returnTime: e.target.value }]
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block">Dias da Semana</label>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const isActive = form.daysOfWeek.includes(d);
                    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleToggleDay(d)}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] transition-all cursor-pointer border",
                          isActive
                            ? "bg-brand-accent text-zinc-950 border-brand-accent"
                            : "bg-zinc-950 text-zinc-500 border-zinc-850"
                        )}
                      >
                        {dayLabels[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Relação de Passageiros */}
          <div className="space-y-4 border-t border-zinc-800 pt-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Módulo de Passageiros Cadastrados ({form.passengers.length})</span>
                <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-0.5 font-sans">Pontos de embarques vinculados ao GPS</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportArea(!showImportArea)}
                  className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-850 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 border border-zinc-850 cursor-pointer"
                >
                  <Upload size={12} /> Importação em Lote
                </button>
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="px-3.5 py-2 bg-brand-accent hover:bg-white text-zinc-950 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus size={12} /> Passageiro
                </button>
              </div>
            </div>

            {showImportArea && (
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-3">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Colar do Excel ou Bloco de Notas</span>
                <textarea
                  value={rawPassengersText}
                  onChange={(e) => setRawPassengersText(e.target.value)}
                  placeholder="Nome do Passageiro ; Celular ; Horário ; Link do Maps (Um por linha)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white h-24 outline-none focus:border-brand-accent font-sans"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowImportArea(false)}
                    className="px-3 py-1.5 bg-zinc-900 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                  >
                    Calcelar
                  </button>
                  <button
                    onClick={handlePasteImport}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                  >
                    Confirmar Processamento
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {form.passengers.length === 0 ? (
                <div className="p-6 text-center text-zinc-600 font-bold uppercase text-[9px] border border-dashed border-zinc-850 rounded-2xl bg-zinc-900/10">
                  Nenhum passageiro cadastrado nesta rota.
                </div>
              ) : (
                form.passengers.map((p, idx) => (
                  <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 relative group">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Nome do Passageiro</label>
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdatePassenger(idx, 'name', e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Telefone / Whats</label>
                      <input
                        type="text"
                        value={p.phone || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'phone', e.target.value)}
                        placeholder="Ex: 47999887766"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">⏱️ Embarque</label>
                      <input
                        type="text"
                        value={p.boardingTime || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'boardingTime', e.target.value)}
                        placeholder="Ex: 06:15"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">📍 Link GPS Google Maps</label>
                      <input
                        type="text"
                        value={p.locationUrl || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'locationUrl', e.target.value)}
                        placeholder="Colar link de endereço"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-center pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemovePassenger(idx)}
                        className="p-2 bg-zinc-900 hover:bg-rose-950/30 text-rose-500 border border-zinc-800 hover:border-rose-900/40 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
          <Button onClick={onClose} variant="secondary" className="px-6 rounded-2xl font-black">
            CANCELAR
          </Button>
          <Button onClick={handleSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl">
            SALVAR CONTRATO
          </Button>
        </div>
      </motion.div>
    </div>
  );
};

interface EditRouteModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  employees: any[];
  clients: any[];
  editingRoute: CharteredRoute | null;
  onUpdateRoute: (routeData: any) => Promise<void>;
}

export const EditRouteModal: React.FC<EditRouteModalProps> = ({
  isOpen,
  onClose,
  vehicles,
  employees,
  clients,
  editingRoute,
  onUpdateRoute
}) => {
  const [form, setForm] = useState<any>(null);
  const [rawPassengersText, setRawPassengersText] = useState('');
  const [showImportArea, setShowImportArea] = useState(false);

  // Sync state with editingRoute on open hook
  React.useEffect(() => {
    if (editingRoute) {
      setForm({
        ...editingRoute,
        passengers: editingRoute.passengers || [],
        daysOfWeek: editingRoute.daysOfWeek || [1, 2, 3, 4, 5],
        schedules: editingRoute.schedules?.length ? editingRoute.schedules : [{ departureTime: '08:00', returnTime: '17:00' }],
        customTrips: editingRoute.customTrips || []
      });
    }
  }, [editingRoute]);

  if (!isOpen || !form) return null;

  const handleToggleDay = (day: number) => {
    const current = form.daysOfWeek;
    const updated = current.includes(day)
      ? current.filter((d: number) => d !== day)
      : [...current, day].sort((a: number, b: number) => a - b);
    setForm({ ...form, daysOfWeek: updated });
  };

  const handleAddPassenger = () => {
    setForm({
      ...form,
      passengers: [...form.passengers, { name: '', phone: '', boardingTime: '', locationUrl: '' }]
    });
  };

  const handleRemovePassenger = (idx: number) => {
    setForm({
      ...form,
      passengers: form.passengers.filter((_: any, i: number) => i !== idx)
    });
  };

  const handleUpdatePassenger = (idx: number, field: keyof Passenger, val: string) => {
    const updated = form.passengers.map((p: any, i: number) => {
      if (i === idx) {
        return { ...p, [field]: val };
      }
      return p;
    });
    setForm({ ...form, passengers: updated });
  };

  const handlePasteImport = () => {
    if (!rawPassengersText.trim()) return;
    const lines = rawPassengersText.split('\n');
    const newPsgs: Passenger[] = [];
    lines.forEach(line => {
      const parts = line.split(/[;\t,]/);
      if (parts[0] && parts[0].trim()) {
        newPsgs.push({
          name: parts[0].trim(),
          phone: parts[1] ? parts[1].trim() : '',
          boardingTime: parts[2] ? parts[2].trim() : '',
          locationUrl: parts[3] ? parts[3].trim() : ''
        });
      }
    });

    setForm({
      ...form,
      passengers: [...form.passengers, ...newPsgs]
    });
    setRawPassengersText('');
    setShowImportArea(false);
  };

  const handleAddCustomTrip = () => {
    const nextIdx = (form.customTrips || []).length + 1;
    const newTrip: CustomTrip = {
      id: Math.random().toString(36).substring(2, 9),
      dateTime: new Date().toISOString().substring(0, 16),
      description: `Viagem Recorrente #${nextIdx}`,
      driverId: form.fixedDriverId || '',
      vehicleId: form.fixedVehicleId || '',
      completed: false
    };
    setForm({
      ...form,
      customTrips: [...(form.customTrips || []), newTrip]
    });
  };

  const handleRemoveCustomTrip = (idx: number) => {
    setForm({
      ...form,
      customTrips: (form.customTrips || []).filter((_: any, i: number) => i !== idx)
    });
  };

  const handleUpdateCustomTrip = (idx: number, field: keyof CustomTrip, val: any) => {
    const updated = (form.customTrips || []).map((t: any, i: number) => {
      if (i === idx) {
        return { ...t, [field]: val };
      }
      return t;
    });
    setForm({ ...form, customTrips: updated });
  };

  const handleAddMultipleCustomTrips = (count: number) => {
    const currentList = [...(form.customTrips || [])];
    for (let i = 0; i < count; i++) {
      currentList.push({
        id: Math.random().toString(36).substring(2, 9),
        dateTime: new Date().toISOString().substring(0, 16),
        description: `Serviço Extra Prontidão #${currentList.length + 1}`,
        driverId: form.fixedDriverId || '',
        vehicleId: form.fixedVehicleId || '',
        completed: false
      });
    }
    setForm({ ...form, customTrips: currentList });
  };

  const handleClearAllCustomTrips = () => {
    setForm({ ...form, customTrips: [] });
  };

  const handleSubmit = async () => {
    await onUpdateRoute(form);
  };

  return (
    <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
              <Users size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight font-sans font-sans">Editar Fretamento / Escala</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 font-sans">Alterar Contrato, Passageiros e Viagens Extras</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-950/40 hover:bg-zinc-850/80 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Informações Primárias */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans">Nome do Fretamento *</label>
              <Input 
                placeholder="Ex: Rota 05 - Turno Matutino" 
                value={form.name}
                onChange={(e) => setForm({...form, name: e.target.value})}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans font-sans">Cliente / Empresa *</label>
              <Select 
                value={form.client}
                onChange={(e) => setForm({...form, client: e.target.value})}
                options={[
                  { value: '', label: 'SELECIONAR CLIENTE' },
                  ...clients.map(c => ({ value: c.name, label: c.name.toUpperCase() }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans font-sans">Tipo de Serviço</label>
              <Select 
                value={form.type}
                onChange={(e) => setForm({...form, type: e.target.value as any})}
              >
                <option value="factory">Industrial / Fábrica</option>
                <option value="school">Escolar / Universitário</option>
                <option value="other">Outros / Eventos</option>
                <option value="regular_random">Cliente Regular (Viagens Avulsas)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans font-sans">Valor Mensal do Contrato</label>
              <Input 
                type="number"
                placeholder="R$ 0,00" 
                value={form.contractValue || ''}
                onChange={(e) => setForm({...form, contractValue: parseFloat(e.target.value) || 0})}
              />
            </div>
          </div>

          {/* Vínculo de frota */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-brand-accent uppercase tracking-widest block ml-1 font-sans font-sans font-sans">Veículo Fixo Escalado</label>
              <Select 
                value={form.fixedVehicleId}
                onChange={(e) => setForm({...form, fixedVehicleId: e.target.value})}
                options={[
                  { value: '', label: 'NENHUM VEÍCULO FIXADO' },
                  ...vehicles.map(v => ({
                    value: v.id,
                    disabled: v.status === 'maintenance' || v.status === 'unavailable',
                    label: `${v.plate?.toUpperCase()} - ${v.model?.toUpperCase()} (${v.type?.toUpperCase() || 'VEÍCULO'})`
                  }))
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans font-sans">Motorista Responsável</label>
              <Select 
                value={form.fixedDriverId}
                onChange={(e) => setForm({...form, fixedDriverId: e.target.value})}
                options={[
                  { value: '', label: 'NENHUM MOTORISTA FIXADO' },
                  ...employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => ({
                    value: e.id,
                    label: `${e.name.toUpperCase()} (${e.role || 'EQUIPE'})`
                  }))
                ]}
              />
            </div>
          </div>

          {/* Dias da Semana e Horários */}
          <div className="space-y-4">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans font-sans">Recorrência Operacional</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block">Schedules diários</label>
                <div className="flex gap-2">
                  <Input 
                    type="time" 
                    value={form.schedules[0]?.departureTime || '08:00'} 
                    onChange={(e) => setForm({
                      ...form, 
                      schedules: [{ departureTime: e.target.value, returnTime: form.schedules[0]?.returnTime || '17:00' }]
                    })}
                  />
                  <Input 
                    type="time" 
                    value={form.schedules[0]?.returnTime || '17:00'} 
                    onChange={(e) => setForm({
                      ...form, 
                      schedules: [{ departureTime: form.schedules[0]?.departureTime || '08:00', returnTime: e.target.value }]
                    })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest block">Dias da Semana</label>
                <div className="flex flex-wrap gap-1">
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const isActive = form.daysOfWeek.includes(d);
                    const dayLabels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => handleToggleDay(d)}
                        className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] transition-all cursor-pointer border",
                          isActive
                            ? "bg-brand-accent text-zinc-950 border-brand-accent"
                            : "bg-zinc-950 text-zinc-500 border-zinc-850"
                        )}
                      >
                        {dayLabels[d]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Viagens Programadas (Outros / Regular Random) */}
          {(form.type === 'other' || form.type === 'regular_random') && (
            <div className="space-y-4 border-t border-zinc-800 pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans font-sans">Viagens Avulsas & Serviços Extras ({form.customTrips?.length || 0})</span>
                  <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-0.5 font-sans font-sans">Vincular viagens individuais avulsas a esse contrato</p>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddMultipleCustomTrips(5)}
                    className="px-2.5 py-1.5 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 border border-zinc-850 text-[8px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                  >
                    + 5 Viagens
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAllCustomTrips}
                    className="px-2.5 py-1.5 bg-zinc-950 hover:bg-rose-950/20 text-rose-500 border border-zinc-850 text-[8px] font-black uppercase tracking-widest rounded-lg cursor-pointer animate-pulse"
                  >
                    Limpar Todos
                  </button>
                  <button
                    type="button"
                    onClick={handleAddCustomTrip}
                    className="px-3.5 py-1.5 bg-brand-accent hover:bg-white text-zinc-950 text-[8px] font-black uppercase tracking-widest rounded-lg cursor-pointer shadow flex items-center gap-1"
                  >
                    <Plus size={10} /> Nova Rota
                  </button>
                </div>
              </div>

              <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                {(form.customTrips || []).length === 0 ? (
                  <div className="p-5 text-center text-zinc-600 font-bold uppercase text-[9px] border border-dashed border-zinc-850 rounded-2xl bg-zinc-900/10">
                    Nenhuma viagem cadastrada. Clicando em "+ Nova Rota" você vincula saídas exclusivas.
                  </div>
                ) : (
                  form.customTrips.map((t: any, idx: number) => (
                    <div key={t.id || idx} className="p-3 bg-zinc-950/50 border border-zinc-850/60 rounded-xl grid grid-cols-1 md:grid-cols-12 gap-3">
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Descrição da Viagem</label>
                        <input
                          type="text"
                          value={t.description || ''}
                          onChange={(e) => handleUpdateCustomTrip(idx, 'description', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white outline-none font-sans"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Data & Hora</label>
                        <input
                          type="datetime-local"
                          value={t.dateTime || ''}
                          onChange={(e) => handleUpdateCustomTrip(idx, 'dateTime', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white outline-none font-sans"
                        />
                      </div>
                      <div className="md:col-span-3 space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest font-sans">Motorista</label>
                        <select
                          value={t.driverId || ''}
                          onChange={(e) => handleUpdateCustomTrip(idx, 'driverId', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white outline-none font-sans"
                        >
                          <option value="">A DEFINIR</option>
                          {employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => (
                            <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-2 space-y-1">
                        <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest font-sans">Veículo</label>
                        <select
                          value={t.vehicleId || ''}
                          onChange={(e) => handleUpdateCustomTrip(idx, 'vehicleId', e.target.value)}
                          className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1 px-2 text-xs text-white outline-none font-sans"
                        >
                          <option value="">A DEFINIR</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.plate.toUpperCase()}</option>
                          ))}
                        </select>
                      </div>
                      <div className="md:col-span-1 flex items-end justify-center pb-0.5">
                        <button
                          type="button"
                          onClick={() => handleRemoveCustomTrip(idx)}
                          className="p-1.5 bg-zinc-900 text-rose-500 hover:bg-rose-950/20 rounded-lg cursor-pointer"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Relação de Passageiros */}
          <div className="space-y-4 border-t border-zinc-800 pt-6">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Módulo de Passageiros Cadastrados ({form.passengers.length})</span>
                <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-0.5 font-sans font-sans">Pontos de embarques vinculados ao GPS</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowImportArea(!showImportArea)}
                  className="px-3.5 py-2 bg-zinc-950 hover:bg-zinc-850 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 border border-zinc-850 cursor-pointer"
                >
                  <Upload size={12} /> Importação em Lote
                </button>
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="px-3.5 py-2 bg-brand-accent hover:bg-white text-zinc-950 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Plus size={12} /> Passageiro
                </button>
              </div>
            </div>

            {showImportArea && (
              <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-3">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Colar do Excel ou Bloco de Notas</span>
                <textarea
                  value={rawPassengersText}
                  onChange={(e) => setRawPassengersText(e.target.value)}
                  placeholder="Nome do Passageiro ; Celular ; Horário ; Link do Maps (Um por linha)"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-xs text-white h-24 outline-none focus:border-brand-accent font-sans"
                />
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setShowImportArea(false)}
                    className="px-3 py-1.5 bg-zinc-900 text-zinc-400 text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                  >
                    Calcelar
                  </button>
                  <button
                    onClick={handlePasteImport}
                    className="px-4 py-1.5 bg-emerald-600 text-white text-[9px] font-black uppercase tracking-widest rounded-lg cursor-pointer"
                  >
                    Confirmar Processamento
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {form.passengers.length === 0 ? (
                <div className="p-6 text-center text-zinc-600 font-bold uppercase text-[9px] border border-dashed border-zinc-850 rounded-2xl bg-zinc-900/10">
                  Nenhum passageiro cadastrado nesta rota.
                </div>
              ) : (
                form.passengers.map((p: any, idx: number) => (
                  <div key={idx} className="p-3 bg-zinc-950/60 border border-zinc-850 rounded-2xl grid grid-cols-1 md:grid-cols-12 gap-3 relative group">
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Nome do Passageiro</label>
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdatePassenger(idx, 'name', e.target.value)}
                        placeholder="Ex: João da Silva"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Telefone / Whats</label>
                      <input
                        type="text"
                        value={p.phone || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'phone', e.target.value)}
                        placeholder="Ex: 47999887766"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">⏱️ Embarque</label>
                      <input
                        type="text"
                        value={p.boardingTime || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'boardingTime', e.target.value)}
                        placeholder="Ex: 06:15"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-2 space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest font-sans">📍 Link GPS Google Maps</label>
                      <input
                        type="text"
                        value={p.locationUrl || ''}
                        onChange={(e) => handleUpdatePassenger(idx, 'locationUrl', e.target.value)}
                        placeholder="Colar link de endereço"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg py-1.5 px-2.5 text-xs text-white outline-none focus:border-brand-accent font-sans"
                      />
                    </div>
                    <div className="md:col-span-1 flex items-end justify-center pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemovePassenger(idx)}
                        className="p-2 bg-zinc-900 hover:bg-rose-950/30 text-rose-500 border border-zinc-800 hover:border-rose-900/40 rounded-xl transition-all cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
          <Button onClick={onClose} variant="secondary" className="px-6 rounded-2xl font-black">
            CANCELAR
          </Button>
          <Button onClick={handleSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl">
            ATUALIZAR CONTRATO
          </Button>
        </div>
      </motion.div>
    </div>
  );
};
