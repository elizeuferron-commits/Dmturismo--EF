import React, { useState } from 'react';
import { 
  Bus, 
  Calendar, 
  Hash, 
  Save, 
  Loader2,
  Wrench,
  Briefcase,
  Paperclip,
  Image as ImageIcon,
  FileText as FileIcon,
  FileSpreadsheet as ExcelIcon,
  X,
  Trash2,
  Eye,
  Sparkles
} from 'lucide-react';
import { Input, Select, Button } from './UI';
import { cn } from '../lib/utils';
import { AttachmentViewer } from './AttachmentViewer';

/**
 * Versão atualizada do formulário de manutenção com suporte a anexos e checklist técnico.
 */
export const MaintenanceForm = ({ onSubmit, loading, vehicles, initialData, maintenanceHistory = [] }: any) => {
  const [attachments, setAttachments] = useState<{ name: string; url: string; type: 'image' | 'pdf' | 'word' | 'excel' }[]>(initialData?.attachments || []);
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [newAttachment, setNewAttachment] = useState({ name: '', type: 'image' as 'image' | 'pdf' | 'word' | 'excel', url: '' });
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialData?.vehicleId || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [maintType, setMaintType] = useState(initialData?.type || 'preventive');
  const [cost, setCost] = useState(initialData?.cost !== undefined ? String(initialData.cost) : '');
  const [isCostManuallyEdited, setIsCostManuallyEdited] = useState(initialData?.cost !== undefined);
  const [checklist, setChecklist] = useState(initialData?.checklist || {
    oilChanged: false,
    filtersChanged: false,
    frontPadsChanged: false,
    rearPadsChanged: false,
    frontDiscsChanged: false,
    rearDiscsChanged: false,
    airConditioning: false,
    tires: false,
    suspension: false,
    transmission: false,
    others: []
  });

  const selectedVehicle = vehicles?.find((v: any) => v.id === selectedVehicleId);

  // Suggest estimated cost based on historical maintenance of the same type for the selected vehicle
  const costSuggestion = React.useMemo(() => {
    if (!selectedVehicleId || !maintType || !maintenanceHistory || maintenanceHistory.length === 0) {
      return null;
    }

    const relevantLogs = maintenanceHistory.filter((log: any) => 
      log.vehicleId === selectedVehicleId && 
      log.type === maintType && 
      log.cost > 0
    );

    if (relevantLogs.length === 0) {
      return null;
    }

    const total = relevantLogs.reduce((sum: number, log: any) => sum + (log.cost || 0), 0);
    const average = total / relevantLogs.length;

    // Get the latest completed log of this type
    const sortedLogs = [...relevantLogs].sort((a: any, b: any) => {
      const dateA = new Date(a.completedAt || a.scheduledDate).getTime();
      const dateB = new Date(b.completedAt || b.scheduledDate).getTime();
      return dateB - dateA;
    });

    const latest = sortedLogs[0]?.cost || 0;

    return {
      average,
      latest,
      count: relevantLogs.length
    };
  }, [selectedVehicleId, maintType, maintenanceHistory]);

  // Handle automatic pre-fill suggestions if the user has not manually modified the cost field yet
  React.useEffect(() => {
    if (!initialData?.id && !isCostManuallyEdited && costSuggestion) {
      setCost(costSuggestion.average.toFixed(2));
    }
  }, [costSuggestion, isCostManuallyEdited, initialData]);

  const MAINTENANCE_ITEMS = {
    van: [
      { category: 'Motor e Filtros', items: ['Troca de Óleo 5W30', 'Filtro de Óleo', 'Filtro de Ar', 'Filtro de Combustível', 'Correia de Acessórios', 'Limpeza de Arrefecimento'] },
      { category: 'Freios', items: ['Pastilhas Dianteiras', 'Pastilhas Traseiras', 'Discos de Freio', 'Fluido de Freio DOT4', 'Freio de Mão'] },
      { category: 'Suspensão e Direção', items: ['Amortecedores Dianteiros', 'Amortecedores Traseiros', 'Bieletas', 'Pivôs e Terminais', 'Alinhamento e Balanceamento'] },
      { category: 'Específicos Van', items: ['Lubrificação Porta de Correr', 'Motor da Porta Elétrica', 'Estribo Retrátil', 'Higienização de Ar Condicionado (Teto)'] }
    ],
    bus: [
      { category: 'Motor e Transmissão', items: ['Troca de Óleo Motor', 'Filtro de Óleo Centrifugo', 'Filtro Racor', 'Óleo Diferencial', 'Óleo Câmbio', 'Embreagem / Servo'] },
      { category: 'Sistemas a Ar', items: ['Drenagem de Reservatórios', 'Válvula Secadora (APU)', 'Bolsas de Ar Suspensão', 'Compresso de Ar', 'Mangueiras Trançadas'] },
      { category: 'Freios', items: ['Lonas de Freio Dianteiras', 'Lonas de Freio Traseiras', 'Retífica de Tambores', 'Cuícas de Freio (Spring Brake)'] },
      { category: 'Conforto e Higiene', items: ['Bomba d\'Água Sanitário', 'Válvula de Descarga Banheiro', 'Frigobar / Cafeteira', 'Sistema de Som / TV', 'Filtros do Ar Condicionado Central'] },
      { category: 'Segurança', items: ['Aferição de Tacógrafo', 'Cintos de Segurança', 'Martelos de Emergência', 'Iluminação de Corredor'] }
    ]
  };

  const toggleChecklistItem = (key: string) => {
    setChecklist((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const addAttachment = () => {
    if (newAttachment.name && newAttachment.url) {
      setAttachments([...attachments, newAttachment]);
      setNewAttachment({ name: '', type: 'image', url: '' });
      setIsAddingAttachment(false);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      const isWord = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isExcel = file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'text/csv';
      
      let type: 'image' | 'pdf' | 'word' | 'excel' = 'image';
      if (isPdf) type = 'pdf';
      else if (isWord) type = 'word';
      else if (isExcel) type = 'excel';
      else if (isImage) type = 'image';
      else return;

      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAttachment({
          name: file.name,
          type,
          url: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const applyPlan = (plan: any) => {
    setDescription(plan.description);
    const newChecklist = { ...checklist };
    // Primary plan items
    plan.checklist.forEach((item: string) => {
      newChecklist[item] = true;
    });
    
    // Add vehicle specific items for Full review
    if (plan.id === 'full') {
       if (selectedVehicle?.type === 'bus') {
         newChecklist.bathroom = true;
         newChecklist.tachograph = true;
       } else if (selectedVehicle?.type === 'van') {
         newChecklist.slidingDoor = true;
       }
    }
    
    setChecklist(newChecklist);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const data = Object.fromEntries(formData.entries());
    onSubmit({
      ...data,
      cost: parseFloat(data.cost as string || '0'),
      odometer: parseInt(data.odometer as string || '0'),
      attachments,
      checklist
    });
  };

  return (
    <form onSubmit={handleFormSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-1">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Veículo</label>
          <div className="relative group">
            <Bus className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 transition-colors group-focus-within:text-brand-accent scale-90" size={18} />
            <select 
              name="vehicleId"
              required
              value={selectedVehicleId}
              onChange={(e) => setSelectedVehicleId(e.target.value)}
              className="w-full pl-12 pr-6 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl text-xs font-black text-white focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all appearance-none uppercase tracking-widest"
            >
              <option value="">Selecione um Veículo</option>
              {(vehicles || []).map((v: any) => (
                <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
              ))}
            </select>
          </div>
        </div>
        <Select 
          label="Tipo de Manutenção" 
          icon={Wrench} 
          name="type" 
          required
          value={maintType}
          onChange={(e: any) => setMaintType(e.target.value)}
          options={[
            { value: 'preventive', label: 'Preventiva' },
            { value: 'corrective', label: 'Corretiva' }
          ]}
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Planos Preventivos Rápidos</label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
             {[
               { id: 'oil_filters', label: 'Nível 1: Óleo + Filtros', description: 'Revisão Nível 01 - Troca de Óleo e Todos os Filtros', checklist: ['oilChanged', 'filtersChanged'] },
               { id: 'intermediate', label: 'Nível 2: Intermediária', description: 'Revisão Nível 02 - Óleo, Filtros, Freios e Suspensão', checklist: ['oilChanged', 'filtersChanged', 'frontPadsChanged', 'tires', 'suspension'] },
               { id: 'full', label: 'Nível 3: Geral', description: 'Revisão Nível 03 - Geral Completa (Mecânica, Elétrica e Fluidos)', checklist: ['oilChanged', 'filtersChanged', 'frontPadsChanged', 'rearPadsChanged', 'airConditioning', 'tires', 'suspension', 'transmission'] }
             ].map(plan => (
               <button
                 key={plan.id}
                 type="button"
                 onClick={() => applyPlan(plan)}
                 className="flex flex-col items-start gap-1 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-brand-accent transition-all text-left group"
               >
                 <span className="text-[10px] font-black text-white uppercase tracking-widest group-hover:text-brand-accent">{plan.label}</span>
                 <span className="text-[8px] font-medium text-zinc-500 uppercase leading-relaxed">{plan.description}</span>
               </button>
             ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Serviço Principal / Itens da OS</label>
              <Input 
                label="" 
                placeholder="Ex: Revisão Geral da Suspensão Dianteira"
                icon={Briefcase} 
                name="description" 
                required
                value={description}
                onChange={(e: any) => setDescription(e.target.value)}
              />
            </div>

            <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex items-center gap-2">
                  <Wrench size={12} className="text-brand-accent" />
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Lista Suspensa de Manutenções</span>
                </div>
                <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest bg-zinc-900 px-2 py-0.5 rounded">
                  {selectedVehicle?.type === 'bus' ? 'Ônibus' : 'Van'}
                </span>
              </div>

              <div className="space-y-2">
                <select 
                  onChange={(e) => {
                    const item = e.target.value;
                    if (item && !description.includes(item)) {
                      setDescription(prev => prev ? `${prev}, ${item}` : item);
                    }
                    e.target.value = ''; // Reset select
                  }}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-[10px] font-black text-zinc-400 focus:outline-none focus:border-brand-accent transition-all uppercase tracking-widest cursor-pointer"
                >
                  <option value="">Selecione itens para adicionar...</option>
                  {(selectedVehicle?.type === 'bus' ? MAINTENANCE_ITEMS.bus : MAINTENANCE_ITEMS.van).map(cat => (
                    <optgroup key={cat.category} label={cat.category} className="bg-zinc-950 text-zinc-500 font-bold">
                      {cat.items.map(item => (
                        <option key={item} value={item} className="bg-zinc-900 text-white py-2">
                          {item}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-tight italic">
                  * Você pode selecionar múltiplos itens; eles serão adicionados à descrição automaticamente.
                </p>
              </div>
              
              <div className="max-h-[160px] overflow-y-auto pr-2 space-y-4 custom-scrollbar mt-4 border-t border-zinc-800 pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={10} className="text-brand-accent" />
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Sugestões Rápidas (Atalhos)</span>
                </div>
                {(selectedVehicle?.type === 'bus' ? MAINTENANCE_ITEMS.bus : MAINTENANCE_ITEMS.van).map((cat) => (
                  <div key={cat.category} className="space-y-1.5">
                    <h5 className="text-[8px] font-black text-zinc-700 uppercase tracking-widest pl-1">{cat.category}</h5>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.items.map(item => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => {
                            if (!description.includes(item)) {
                              setDescription(prev => prev ? `${prev}, ${item}` : item);
                            }
                          }}
                          className="px-2.5 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-[8px] font-black uppercase text-zinc-400 hover:border-brand-accent hover:text-brand-accent transition-all shrink-0 active:scale-95"
                        >
                          {item}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <Input 
              label="Custo Total (R$)" 
              type="number" 
              step="0.01" 
              placeholder="1500.00" 
              icon={Hash} 
              name="cost" 
              value={cost} 
              onChange={(e: any) => {
                setCost(e.target.value);
                setIsCostManuallyEdited(true);
              }}
            />
            {costSuggestion && (
              <div className="p-3 bg-brand-accent/5 border border-brand-accent/20 rounded-2xl flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[8.5px] font-black text-brand-accent uppercase tracking-wider">
                  <Sparkles size={11} className="animate-pulse shrink-0" />
                  <span>Custo Sugerido ({costSuggestion.count} OS ant.)</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setCost(costSuggestion.average.toFixed(2));
                      setIsCostManuallyEdited(true);
                    }}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all whitespace-nowrap cursor-pointer",
                      parseFloat(cost || '0').toFixed(2) === costSuggestion.average.toFixed(2)
                        ? "bg-brand-accent/20 border-brand-accent text-brand-accent shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    Média: R$ {costSuggestion.average.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCost(costSuggestion.latest.toFixed(2));
                      setIsCostManuallyEdited(true);
                    }}
                    className={cn(
                      "px-2.5 py-1.5 rounded-lg border text-[8px] font-black uppercase transition-all whitespace-nowrap cursor-pointer",
                      parseFloat(cost || '0').toFixed(2) === costSuggestion.latest.toFixed(2)
                        ? "bg-brand-accent/20 border-brand-accent text-brand-accent shadow-sm"
                        : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                    )}
                  >
                    Última: R$ {costSuggestion.latest.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </button>
                </div>
              </div>
            )}
            
            <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl">
              <div className="flex items-center gap-2 mb-3">
                <Paperclip size={12} className="text-brand-accent" />
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Observações Rápidas</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {['Peças do Cliente', 'Garantia Oficina', 'Urgente', 'Aguardando Peça'].map(obs => (
                  <button
                    key={obs}
                    type="button"
                    onClick={() => {
                      if (!description.includes(obs)) {
                        setDescription(prev => prev ? `${prev} [${obs}]` : `[${obs}]`);
                      }
                    }}
                    className="p-2 bg-zinc-950 border border-zinc-800 rounded-lg text-[8px] font-black uppercase text-zinc-500 hover:text-brand-accent transition-all text-left"
                  >
                    {obs}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-4 bg-zinc-900/50 border border-zinc-800 rounded-2xl">
        <div className="md:col-span-3 border-b border-zinc-800 pb-2 mb-2 flex items-center gap-2">
          <Calendar size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Cronograma e Vencimentos</h3>
        </div>
        <Input label="Data Realizada" type="date" icon={Calendar} required name="completedAt" defaultValue={initialData?.completedAt || new Date().toISOString().split('T')[0]} />
        <Input label="Odômetro Atual (KM)" type="number" icon={Hash} required name="odometer" defaultValue={initialData?.odometer} />
        <div className="relative">
          <Input label="Próxima Prev. (KM)" type="number" icon={Hash} name="nextMaintenanceKM" defaultValue={initialData?.nextMaintenanceKM} />
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-accent rounded-full animate-pulse" title="Alerta automático baseado neste campo" />
        </div>
      </div>

      {/* Checklist Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Wrench size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Checklist de Intervenção</h3>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { id: 'oilChanged', label: 'Troca de Óleo' },
            { id: 'filtersChanged', label: 'Troca de Filtros' },
            { id: 'frontPadsChanged', label: 'Pastilha Dianteira' },
            { id: 'rearPadsChanged', label: 'Pastilha Traseira' },
            { id: 'frontDiscsChanged', label: 'Disco Dianteiro' },
            { id: 'rearDiscsChanged', label: 'Disco Traseira' },
            { id: 'airConditioning', label: 'Ar Condicionado' },
            { id: 'tires', label: 'Pneus / Rodas' },
            { id: 'suspension', label: 'Suspensão' },
            { id: 'transmission', label: 'Transmissão' },
          ].map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => toggleChecklistItem(item.id)}
              className={cn(
                "flex items-center gap-3 p-3 rounded-xl border text-[9px] font-black uppercase transition-all text-left",
                checklist[item.id] ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-zinc-900 border-zinc-800 text-zinc-500"
              )}
            >
              <div className={cn(
                "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                checklist[item.id] ? "bg-brand-accent border-brand-accent text-zinc-950" : "border-zinc-700"
              )}>
                {checklist[item.id] && <Save size={10} strokeWidth={4} />}
              </div>
              {item.label}
            </button>
          ))}

          {/* Vehicle specific items */}
          {selectedVehicle?.type === 'bus' && (
            <>
              {[
                { id: 'bathroom', label: 'Banheiro / Sanitário' },
                { id: 'minibar', label: 'Frigobar / Cafeteira' },
                { id: 'airSuspension', label: 'Suspensão a Ar' },
                { id: 'tachograph', label: 'Tacógrafo' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklistItem(item.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-[9px] font-black uppercase transition-all text-left",
                    checklist[item.id] ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                    checklist[item.id] ? "bg-brand-accent border-brand-accent text-zinc-950" : "border-zinc-700"
                  )}>
                    {checklist[item.id] && <Save size={10} strokeWidth={4} />}
                  </div>
                  {item.label}
                </button>
              ))}
            </>
          )}

          {selectedVehicle?.type === 'van' && (
            <>
              {[
                { id: 'slidingDoor', label: 'Porta de Correr' },
                { id: 'step', label: 'Estribo / Degrau' },
                { id: 'rearSeat', label: 'Bancos / Reclinação' }
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleChecklistItem(item.id)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-[9px] font-black uppercase transition-all text-left",
                    checklist[item.id] ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-zinc-900 border-zinc-800 text-zinc-500"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded-md border flex items-center justify-center shrink-0",
                    checklist[item.id] ? "bg-brand-accent border-brand-accent text-zinc-950" : "border-zinc-700"
                  )}>
                    {checklist[item.id] && <Save size={10} strokeWidth={4} />}
                  </div>
                  {item.label}
                </button>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Attachments Section */}
      <div className="space-y-4 pt-4 border-t border-zinc-800/50">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Anexos (NF, Fotos, Laudos)</h3>
        </div>

        <div className="space-y-4">
          {!isAddingAttachment ? (
            <button
              type="button"
              onClick={() => setIsAddingAttachment(true)}
              className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 font-black text-[10px] uppercase tracking-widest hover:border-brand-accent/50 hover:text-brand-accent transition-all flex items-center justify-center gap-2"
            >
              <ImageIcon size={16} />
              Anexar Documento ou Foto
            </button>
          ) : (
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Novo Anexo</span>
                <button type="button" onClick={() => setIsAddingAttachment(false)} className="text-zinc-500 hover:text-white">
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-4">
                 <div className="grid grid-cols-4 gap-2">
                    {[
                      { id: 'image', icon: ImageIcon, label: 'Imagem' },
                      { id: 'pdf', icon: FileIcon, label: 'PDF' },
                      { id: 'word', icon: FileIcon, label: 'DOC' },
                      { id: 'excel', icon: ExcelIcon, label: 'XLS' },
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewAttachment({ ...newAttachment, type: type.id as any })}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-lg border text-[8px] font-black uppercase transition-all",
                          newAttachment.type === type.id ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-zinc-900 border-zinc-800 text-zinc-600"
                        )}
                      >
                        <type.icon size={14} />
                        {type.label}
                      </button>
                    ))}
                 </div>
                 <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-xl text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                       {newAttachment.name || "Clique para Selecionar"}
                    </div>
                 </div>
                 {newAttachment.url && (
                    <button
                      type="button"
                      onClick={addAttachment}
                      className="w-full py-3 bg-brand-accent text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest"
                    >
                       Confirmar Anexo
                    </button>
                 )}
              </div>
            </div>
          )}

          {/* Integrated Preview */}
          {attachments.length > 0 && (
            <AttachmentViewer attachments={attachments} />
          )}
        </div>
      </div>

      <div className="pt-4">
        <Button loading={loading} className="w-full">
          <Save size={20} />
          {initialData?.id ? 'Atualizar Manutenção' : 'Registrar Manutenção'}
        </Button>
      </div>
    </form>
  );
};
