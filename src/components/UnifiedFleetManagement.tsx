import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bus, 
  Calendar, 
  Wrench, 
  Plus, 
  AlertTriangle,
  TrendingUp,
  Droplets,
  Printer,
  Hash,
  CheckCircle,
  FileText,
  Paperclip,
  Zap,
  User,
  Users,
  Phone,
  MessageCircle,
  Star,
  Trash2,
  Edit,
  CheckSquare,
  Square,
  X,
  Download,
  FileDown,
  Eye,
  ChevronRight,
  Search,
  Volume2,
  VolumeX,
  Fuel,
  Disc,
  Sparkles,
  Bot,
  ClipboardCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FleetList } from './FleetList';
import { Vencimentos } from './Vencimentos';
import { FleetAlerts } from './FleetAlerts';
import { FinanceDocumentVencimentos } from './FinanceDocumentVencimentos';
import { VehicleMaintenanceHistory } from './VehicleMaintenanceHistory';
import { Card, StatCard } from './Cards';
import { cn } from '../lib/utils';
import { Vehicle, MaintenanceLog, Employee, Trip } from '../types';
import { format, parseISO, differenceInDays, isSameWeek, isSameMonth, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AttachmentViewer } from './AttachmentViewer';
import { GabineteDossierModal } from './GabineteDossierModal';
import { collection, addDoc, serverTimestamp, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanUndefined } from '../lib/firebase';
import { toast } from 'sonner';
import { dbCacheService } from '../services/dbCacheService';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from 'recharts';

export const safeGetLocalStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Failed to get item from localStorage:", error);
    return null;
  }
};

export const safeSetLocalStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("Failed to set item in localStorage:", error);
  }
};

interface UnifiedFleetManagementProps {
  vehicles: Vehicle[];
  maintenance: MaintenanceLog[];
  employees: Employee[];
  trips?: Trip[];
  finance?: any[];
  vehicleVencimentos: any[];
  driverVencimentos: Employee[];
  maintenanceData: any[];
  onAddVehicle: () => void;
  onVehicleClick: (vehicle: Vehicle) => void;
  onAddMaintenance: () => void;
  onPrintOS: (log: MaintenanceLog) => void;
  onPrintBatchOS?: (scope: 'week' | 'month') => void;
  onOpenMaintenanceAttachments?: (log: MaintenanceLog) => void;
  onDeleteMaintenance?: (id: string) => void;
  isLoading?: boolean;
  onAddEmployee?: (defaultData?: Partial<Employee>) => void;
  onEditEmployee?: (employee: Employee) => void;
  onDeleteEmployee?: (id: string, name: string) => Promise<void>;
  currentUserRole?: string;
  currentUserEmail?: string;
}

/**
 * 🌑 COMPONENTE EM MODO SOMBRA
 * Unificação das ferramentas de Frota, Vencimentos e Manutenção.
 */
export const FixedDriversList = ({ 
  employees,
  onEditEmployee,
  onDeleteEmployee
}: { 
  employees: Employee[],
  onEditEmployee?: (employee: Employee) => void,
  onDeleteEmployee?: (id: string, name: string) => Promise<void>
}) => {
  const fixedDrivers = employees.filter(e => e.role === 'Motorista');
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fixedDrivers.map(d => (
        <div key={d.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between gap-4">
           <div className="flex items-center gap-4">
             {d.photoUrl ? <img src={d.photoUrl} className="w-12 h-12 rounded-full object-cover" loading="lazy" decoding="async" /> : <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-500"><User /></div>}
             <div>
               <p className="text-sm font-black text-white uppercase">{d.name}</p>
               <p className="text-[10px] text-zinc-500 font-bold uppercase">{d.phone || 'SEM TELEFONE'}</p>
               <p className="text-[9px] text-zinc-400 font-bold uppercase">{d.licenseCategory ? `CNH: ${d.licenseCategory}` : 'CNH NÃO INF.'}</p>
             </div>
           </div>
           <div className="flex gap-2 shrink-0">
             <button 
               onClick={() => {
                 if (d.phone) {
                   const cleanPhone = d.phone.replace(/\D/g, '');
                   const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                   window.open(`https://wa.me/${formattedPhone}`, '_blank');
                 } else {
                   toast.error(`O motorista ${d.name} não possui telefone cadastrado!`);
                 }
               }} 
               className="bg-emerald-950/40 text-emerald-400 p-2 rounded-xl hover:bg-emerald-900/40 border border-emerald-900/30 transition-colors cursor-pointer flex items-center justify-center"
               title="Conversar no WhatsApp"
             >
               <MessageCircle size={14} />
             </button>
             {onEditEmployee && (
               <button 
                 onClick={() => onEditEmployee(d)} 
                 className="bg-zinc-800 text-white p-2 rounded-xl hover:bg-zinc-700 transition-colors cursor-pointer"
                 title="Editar Ficha"
               >
                 <Edit size={14} />
               </button>
             )}
             {onDeleteEmployee && (
               <button 
                 onClick={() => {
                   if (confirm(`Deseja realmente apagar a ficha do motorista ${d.name}?`)) {
                     onDeleteEmployee(d.id, d.name);
                   }
                 }} 
                 className="bg-red-900/20 text-red-500 p-2 rounded-xl hover:bg-red-900/40 transition-colors cursor-pointer"
                 title="Apagar Ficha"
               >
                 <Trash2 size={14} />
               </button>
             )}
           </div>
        </div>
      ))}
    </div>
  );
};

export const TiresStatusList = ({ 
  tireDossiers,
  vehicles
}: { 
  tireDossiers: any[], 
  vehicles: Vehicle[] 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'NOVO' | 'RODANDO' | 'RECAPAGEM' | 'SUCATA'>('ALL');
  const [editingTire, setEditingTire] = useState<any | null>(null);
  const [editDepth, setEditDepth] = useState<number>(0);
  const [editStatus, setEditStatus] = useState<string>('');

  const filteredTires = useMemo(() => {
    return tireDossiers.filter(t => {
      const matchesSearch = 
        (t.serialNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.brandOption || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.currentVehiclePlate || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = 
        statusFilter === 'ALL' || 
        (t.status || '').toUpperCase() === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [tireDossiers, searchTerm, statusFilter]);

  const handleUpdateTire = async (id: string) => {
    try {
      const tireRef = doc(db, 'tire_dossiers', id);
      await updateDoc(tireRef, cleanUndefined({
        grooveDepth: Number(editDepth),
        status: editStatus
      }));
      toast.success("Dados do pneu atualizados com sucesso!");
      setEditingTire(null);
    } catch (err: any) {
      handleFirestoreError(err, OperationType.UPDATE, `tire_dossiers/${id}`);
      toast.error("Erro ao atualizar o pneu: " + err.message);
    }
  };

  return (
    <div className="space-y-6">
       {/* Filters */}
       <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="relative w-full md:w-96">
             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-550">
                <Search size={16} />
             </div>
             <input
               type="text"
               placeholder="Buscar por Série/Fogo, Marca ou Placa..."
               className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2.5 pl-10 pr-4 text-xs font-bold text-white placeholder:text-zinc-650 outline-none focus:border-brand-accent/50"
               value={searchTerm}
               onChange={e => setSearchTerm(e.target.value)}
             />
          </div>

          <div className="flex flex-wrap gap-2 w-full md:w-auto">
             {(['ALL', 'NOVO', 'RODANDO', 'RECAPAGEM', 'SUCATA'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    statusFilter === status 
                      ? "bg-brand-accent text-zinc-950 font-black shadow-md" 
                      : "bg-zinc-900 text-zinc-500 hover:text-zinc-350 hover:bg-zinc-850"
                  )}
                >
                  {status === 'ALL' ? 'Todos' : status}
                </button>
             ))}
          </div>
       </div>

       {/* Tires list */}
       {filteredTires.length === 0 ? (
          <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-zinc-850 space-y-3">
             <Disc size={36} className="text-zinc-650 mx-auto" />
             <p className="text-xs font-black uppercase tracking-wider text-zinc-550">Nenhum pneu encontrado</p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {filteredTires.map(t => {
                const isCritical = (t.grooveDepth || 0) < 3.0;
                return (
                  <div key={t.id} className="bg-zinc-900/80 border border-zinc-850 hover:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
                     {/* Top Bar */}
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                           <Disc size={18} className={cn(
                             t.status?.toUpperCase() === 'SUCATA' ? 'text-red-500' :
                             t.status?.toUpperCase() === 'RECAPAGEM' ? 'text-amber-500' :
                             t.status?.toUpperCase() === 'NOVO' ? 'text-emerald-500' : 'text-brand-accent'
                           )} />
                           <span className="text-xs font-black text-white font-mono tracking-wider">
                             SÉRIE: {t.serialNumber || 'S/ NÚMERO'}
                           </span>
                        </div>
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                          t.status?.toUpperCase() === 'SUCATA' ? "bg-red-500/10 text-red-400 border border-red-500/20" :
                          t.status?.toUpperCase() === 'RECAPAGEM' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                          t.status?.toUpperCase() === 'NOVO' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
                          "bg-sky-500/10 text-sky-400 border border-sky-500/20"
                        )}>
                          {t.status || 'RODANDO'}
                        </span>
                     </div>

                     {/* Details info */}
                     <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-zinc-400 uppercase">
                        <div>
                           <p className="text-[8px] text-zinc-555 mb-0.5 leading-none">Marca</p>
                           <p className="text-zinc-200 font-extrabold">{t.brandOption || 'Pirelli'}</p>
                        </div>
                        <div>
                           <p className="text-[8px] text-zinc-555 mb-0.5 leading-none">Código DOT</p>
                           <p className="text-zinc-200 font-extrabold">{t.dotCode || 'N/D'}</p>
                        </div>
                        <div>
                           <p className="text-[8px] text-zinc-555 mb-0.5 leading-none">Veículo Alocado</p>
                           <p className="text-zinc-200 font-extrabold leading-tight">
                             {t.currentVehicleId === 'ESTOQUE' ? (
                               <span className="text-emerald-450 font-black">ALMOXARIFADO</span>
                             ) : (
                               t.currentVehiclePlate || 'S/ VEÍCULO'
                             )}
                           </p>
                        </div>
                        <div>
                           <p className="text-[8px] text-zinc-555 mb-0.5 leading-none">Posição de Rodagem</p>
                           <p className="text-zinc-200 font-extrabold">{t.wheelPosition || 'NÃO INSTALADO'}</p>
                        </div>
                     </div>

                     {/* Sulco progress bar */}
                     <div className="space-y-1.5 border-t border-zinc-850/50 pt-3">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                           <span className="text-zinc-555 tracking-widest">Sulco do Pneu</span>
                           <span className={cn(isCritical ? "text-red-400" : "text-zinc-300")}>
                             {t.grooveDepth || 0} mm
                           </span>
                        </div>
                        <div className="h-2 bg-zinc-950 rounded-full overflow-hidden">
                           <div 
                             className={cn(
                               "h-full rounded-full transition-all duration-500",
                               isCritical ? "bg-red-500 shadow-lg shadow-red-500/20" : "bg-emerald-500"
                             )}
                             style={{ width: `${Math.min(100, Math.max(0, ((t.grooveDepth || 0) / 16) * 100))}%` }}
                           />
                        </div>
                        {isCritical && (
                           <div className="flex items-center gap-1.5 text-red-500 font-mono text-[8px] font-black uppercase tracking-wider">
                              <AlertTriangle size={10} className="animate-bounce" />
                              <span>Sulco Crítico! Recomendado Trocar</span>
                           </div>
                        )}
                     </div>

                     {/* Edit Button */}
                     <div className="flex justify-end gap-2 border-t border-zinc-850/30 pt-3">
                        <button
                          onClick={() => {
                            setEditingTire(t);
                            setEditDepth(t.grooveDepth || 0);
                            setEditStatus(t.status || 'RODANDO');
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                        >
                          <Edit size={10} />
                          Atualizar Status / Sulco
                        </button>
                     </div>
                  </div>
                );
             })}
          </div>
       )}

       {/* Edit Modal */}
       {editingTire && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
             <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 w-full max-w-sm space-y-6">
                <div>
                   <h3 className="font-black text-white uppercase tracking-wider text-sm leading-none">Atualizar Pneu</h3>
                   <p className="text-[9px] text-zinc-500 uppercase font-bold mt-1">Série/Fogo: {editingTire.serialNumber}</p>
                </div>

                <div className="space-y-4">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Profundidade do Sulco (mm)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        value={editDepth} 
                        onChange={e => setEditDepth(Number(e.target.value))} 
                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white font-mono text-xs font-bold outline-none focus:border-brand-accent/50" 
                      />
                   </div>

                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block">Status do Pneu</label>
                      <select 
                        value={editStatus} 
                        onChange={e => setEditStatus(e.target.value)} 
                        className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white text-xs font-bold uppercase tracking-wider outline-none focus:border-brand-accent/50"
                      >
                         <option value="NOVO">NOVO</option>
                         <option value="RODANDO">RODANDO</option>
                         <option value="RECAPAGEM">RECAPAGEM</option>
                         <option value="SUCATA">SUCATA</option>
                      </select>
                   </div>
                </div>

                <div className="flex gap-2">
                   <button 
                     onClick={() => setEditingTire(null)} 
                     className="w-1/2 bg-zinc-800 text-zinc-400 hover:text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer transition-colors"
                   >
                     Cancelar
                   </button>
                   <button 
                     onClick={() => handleUpdateTire(editingTire.id)} 
                     className="w-1/2 bg-brand-accent text-zinc-950 hover:bg-white py-3 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer transition-colors"
                   >
                     Gravar
                   </button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
};

export const DiaristasManager = () => {
  const [diaristas, setDiaristas] = useState<any[]>(() => {
    const saved = safeGetLocalStorage('dm_turismo_diaristas');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [];
      }
    }
    return [];
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newDiarista, setNewDiarista] = useState({ name: '', phone: '', experience: 1 });
  const [showInviteModal, setShowInviteModal] = useState<any>(null);
  const [showBulkInviteModal, setShowBulkInviteModal] = useState(false);
  const [inviteDateTime, setInviteDateTime] = useState('');
  const [inviteDestination, setInviteDestination] = useState('');

  const handleAddDiarista = () => {
    let updated: any[] = [];
    if (editingId) {
      updated = diaristas.map(d => d.id === editingId ? { ...newDiarista, id: editingId } : d);
      setDiaristas(updated);
      setEditingId(null);
      toast.success('Diarista atualizado!');
    } else {
      updated = [...diaristas, { ...newDiarista, id: Date.now().toString() }];
      setDiaristas(updated);
      toast.success('Diarista cadastrado!');
    }
    safeSetLocalStorage('dm_turismo_diaristas', JSON.stringify(updated));
    setNewDiarista({ name: '', phone: '', experience: 1 });
    setShowForm(false);
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleDelete = (id: string) => {
    const updated = diaristas.filter(d => d.id !== id);
    setDiaristas(updated);
    safeSetLocalStorage('dm_turismo_diaristas', JSON.stringify(updated));
    setSelectedIds(prev => prev.filter(i => i !== id));
    toast.success('Diarista excluído!');
  };

  const handleEdit = (d: any) => {
    setEditingId(d.id);
    setNewDiarista({ name: d.name, phone: d.phone, experience: d.experience });
    setShowForm(true);
  };

  const handleSendInvite = () => {
      const driversToInvite = showBulkInviteModal
          ? diaristas.filter(d => selectedIds.includes(d.id))
          : [showInviteModal];

      driversToInvite.forEach(d => {
          const message = `Olá ${d.name}, você foi convidado para um trabalho.\nData/Hora: ${inviteDateTime}\nDestino: ${inviteDestination}`;
          const url = `https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
          window.open(url, '_blank');
      });
      toast.success('Convites abertos no WhatsApp!');
      setShowInviteModal(null);
      setShowBulkInviteModal(false);
      setInviteDateTime('');
      setInviteDestination('');
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
          <button onClick={() => { setShowForm(true); setEditingId(null); setNewDiarista({ name: '', phone: '', experience: 1 }); }} className="flex items-center gap-2 bg-brand-accent text-zinc-950 px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest">
            <Plus size={14} /> Cadastrar Diarista
          </button>
          {selectedIds.length > 0 && (
              <button onClick={() => setShowBulkInviteModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest">
                <Calendar size={14} /> Convidar Selecionados ({selectedIds.length})
              </button>
          )}
      </div>
      
      {showForm && (
        <div className="p-6 bg-zinc-900 rounded-2xl border border-zinc-800 space-y-4">
          <input placeholder="Nome" value={newDiarista.name} onChange={e => setNewDiarista({...newDiarista, name: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white" />
          <input placeholder="WhatsApp" value={newDiarista.phone} onChange={e => setNewDiarista({...newDiarista, phone: e.target.value})} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white" />
          <div className="flex gap-2 text-zinc-500">
             {[1,2,3,4,5].map(star => <Star key={star} onClick={() => setNewDiarista({...newDiarista, experience: star})} className={cn("cursor-pointer", newDiarista.experience >= star ? "text-brand-accent fill-brand-accent" : "")} />)}
          </div>
          <button onClick={handleAddDiarista} className="bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold">Salvar</button>
        </div>
      )}

      {diaristas.map(d => (
        <div key={d.id} className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-between">
           <div className="flex items-center gap-4">
               <button onClick={() => handleToggleSelect(d.id)} className="text-zinc-600">
                   {selectedIds.includes(d.id) ? <CheckSquare className="text-brand-accent" /> : <Square />}
               </button>
               <div>
                 <p className="font-black text-white">{d.name}</p>
                 <p className="text-[10px] text-zinc-500">{d.phone} | EXP: {d.experience} estrelas</p>
               </div>
           </div>
           <div className="flex gap-2">
               <button 
                 onClick={() => {
                   if (d.phone) {
                     const cleanPhone = d.phone.replace(/\D/g, '');
                     const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
                     window.open(`https://wa.me/${formattedPhone}`, '_blank');
                   } else {
                     toast.error(`O diarista ${d.name} não possui WhatsApp cadastrado!`);
                   }
                 }} 
                 className="bg-emerald-950/40 text-emerald-400 p-2 rounded-xl hover:bg-emerald-900/40 border border-emerald-900/30 transition-colors cursor-pointer flex items-center justify-center"
                 title="Conversar no WhatsApp"
               >
                 <MessageCircle size={14} />
               </button>
               <button onClick={() => handleEdit(d)} className="bg-zinc-800 text-white p-2 rounded-xl"><Edit size={14} /></button>
               <button onClick={() => handleDelete(d.id)} className="bg-red-900/20 text-red-500 p-2 rounded-xl"><Trash2 size={14} /></button>
               <button onClick={() => setShowInviteModal(d)} className="bg-zinc-800 text-brand-accent px-4 py-2 rounded-xl text-[10px] font-black uppercase">Convite</button>
           </div>
        </div>
      ))}
      
      {(showInviteModal || showBulkInviteModal) && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-zinc-900 p-8 rounded-3xl border border-zinc-800 w-full max-w-sm space-y-4">
            <h3 className="font-black text-white uppercase">
                {showBulkInviteModal ? `Convidar ${selectedIds.length} Diaristas` : `Convidar ${showInviteModal.name}`}
            </h3>
            <input type="datetime-local" value={inviteDateTime} onChange={e => setInviteDateTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white" />
            <input type="text" placeholder="Destino" value={inviteDestination} onChange={e => setInviteDestination(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 p-3 rounded-xl text-white" />
            <button onClick={handleSendInvite} className="w-full bg-brand-accent text-zinc-950 py-3 rounded-xl font-black uppercase">Enviar Convite</button>
            <button onClick={() => {setShowInviteModal(null); setShowBulkInviteModal(false);}} className="w-full bg-zinc-800 text-white py-3 rounded-xl font-black uppercase">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * 🌑 COMPONENTE EM MODO SOMBRA
 * Unificação das ferramentas de Frota, Vencimentos e Manutenção.
 */
export const UnifiedFleetManagement: React.FC<UnifiedFleetManagementProps> = React.memo(({
  vehicles,
  maintenance,
  employees,
  trips = [],
  finance = [],
  vehicleVencimentos,
  driverVencimentos,
  maintenanceData,
  onAddVehicle,
  onVehicleClick,
  onAddMaintenance,
  onPrintOS,
  onPrintBatchOS,
  onOpenMaintenanceAttachments,
  onDeleteMaintenance,
  isLoading,
  onAddEmployee,
  onEditEmployee,
  onDeleteEmployee,
  currentUserRole,
  currentUserEmail
}) => {
  const [activeTab, setActiveTab] = useState<'fleet' | 'alerts' | 'vencimentos' | 'maintenance' | 'drivers' | 'tires' | 'sold'>('fleet');
  
  const navigate = useNavigate();
  const isAdministrative = currentUserRole === 'Dono / Proprietário' || 
                          currentUserRole === 'Dono' || 
                          currentUserRole === 'Proprietário' || 
                          currentUserRole === 'Administrativo' || 
                          currentUserRole === 'Gestor de Frotas' ||
                          currentUserRole === 'Coordenador Logístico' ||
                          currentUserRole === 'admin' || 
                          currentUserRole === 'manager' ||
                          currentUserEmail === 'elizeuferron@gmail.com';
  const [tireDossiers, setTireDossiers] = useState<any[]>([]);
  const [fuelLogsLocal, setFuelLogsLocal] = useState<any[]>([]);

  useEffect(() => {
    const unsubTires = dbCacheService.subscribeCollection('tire_dossiers', (data) => {
      setTireDossiers(data);
    });

    const unsubFuel = dbCacheService.subscribeCollection('fuel_logs', (data) => {
      setFuelLogsLocal(data);
    });

    return () => {
      unsubTires();
      unsubFuel();
    };
  }, []);

  const widgetData = useMemo(() => {
    const activeVehicles = vehicles?.filter(v => (v.status as string) === 'ativo' || (v.status as string) === 'active' || (v.status as string) === 'working' || v.status === 'available' || v.status === 'trip')?.length || 0;
    const scheduledTrips = trips?.filter(t => t.status === 'scheduled' || (t.status as string) === 'running' || t.status === 'active')?.length || 0;
    const pendingMaintenance = maintenance?.filter(m => m.status === 'pending' || ( m.status as string) === 'in_progress')?.length || 0;
    const fuelCount = fuelLogsLocal?.length || 0;

    return [
      {
        id: 'fleet',
        title: 'Status da Frota',
        value: `${vehicles?.length || 0} Veículos`,
        trend: `${activeVehicles} ativos em frota`,
        icon: Bus,
        color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        glow: 'hover:border-emerald-500/30' ,
        onClickSection: 'fleet'
      },
      {
        id: 'trips',
        title: 'Viagens Efetuadas',
        value: `${trips?.length || 0} Viagens`,
        trend: `${scheduledTrips} ativas ou agendadas`,
        icon: TrendingUp,
        color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        glow: 'hover:border-orange-500/30',
        onClickSection: 'trips'
      },
      {
        id: 'os',
        title: 'Manutenções e O.S.',
        value: `${maintenance?.length || 0} Ordens`,
        trend: `${pendingMaintenance} pendentes de execução`,
        icon: Wrench,
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        glow: 'hover:border-amber-500/30',
        onClickSection: 'fleet'
      },
      {
        id: 'fuel',
        title: 'Abastecimentos',
        value: `${fuelCount} Registros`,
        trend: `Combustível acumulado na base`,
        icon: Fuel,
        color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        glow: 'hover:border-rose-500/30',
        onClickSection: 'fuel'
      },
      {
        id: 'tires',
        title: 'Status de Pneus',
        value: `${tireDossiers?.length || 0} Pneus`,
        trend: `N: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'NOVO').length || 0} | R: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'RODANDO').length || 0} | RC: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'RECAPAGEM').length || 0} | SC: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'SUCATA').length || 0}`,
        icon: Disc,
        color: 'bg-orange-500/10 text-brand-accent border-brand-accent/20',
        glow: 'hover:border-brand-accent/30',
        onClickSection: 'tires'
      }
    ];
  }, [vehicles, trips, maintenance, fuelLogsLocal, tireDossiers]);

  const [driverCategory, setDriverCategory] = useState<'fixo' | 'diarista'>('fixo');
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'dashboard' | 'prontuario'>('dashboard');
  const [isGenerating, setIsGenerating] = useState(false);

  // Estados adicionais para a aba Alertas
  const [alertsTabSearch, setAlertsTabSearch] = useState('');
  const [alertsTabFilter, setAlertsTabFilter] = useState<'all' | 'critical' | 'warning' | 'safe' | 'unplanned'>('all');

  // Estados para modais de "Ordens Pendentes" e "Alertas de Manutenção"
  const [isPendingOrdersModalOpen, setIsPendingOrdersModalOpen] = useState(false);
  const [isDossierOpen, setIsDossierOpen] = useState(false);
  const [isMaintAlertsModalOpen, setIsMaintAlertsModalOpen] = useState(false);
  const [pendingSearchTerm, setPendingSearchTerm] = useState('');
  const [alertsSearchTerm, setAlertsSearchTerm] = useState('');
  const [gestorPhone, setGestorPhone] = useState<string>(() => {
    return safeGetLocalStorage('dm_phone_gestor_frotas') || '';
  });

  const [alertOilKm, setAlertOilKm] = useState<number>(() => {
    const saved = safeGetLocalStorage('dm_alert_oil_km');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [alertMaintKm, setAlertMaintKm] = useState<number>(() => {
    const saved = safeGetLocalStorage('dm_alert_maint_km');
    return saved ? parseInt(saved, 10) : 1000;
  });
  const [alertMaintDays, setAlertMaintDays] = useState<number>(() => {
    const saved = safeGetLocalStorage('dm_alert_maint_days');
    return saved ? parseInt(saved, 10) : 30;
  });

  const [soundAlertsEnabled, setSoundAlertsEnabled] = useState<boolean>(() => {
    return safeGetLocalStorage('dm_sound_alerts_enabled') === 'true';
  });

  // Estados para o Assistente de Distribuição por IA
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [aiInputText, setAiInputText] = useState('');
  const [aiFileBase64, setAiFileBase64] = useState<string | null>(null);
  const [aiFileMimeType, setAiFileMimeType] = useState<string | null>(null);
  const [aiFileBlobUrl, setAiFileBlobUrl] = useState<string | null>(null);
  const [aiIsLoading, setAiIsLoading] = useState(false);
  const [aiResult, setAiResult] = useState<any | null>(null);
  const [aiVehicleId, setAiVehicleId] = useState<string>('');
  const [aiMaintenanceForm, setAiMaintenanceForm] = useState<any>({
    completedAt: format(new Date(), 'yyyy-MM-dd'),
    type: 'preventive',
    provider: '',
    partsReplaced: '',
    cost: '',
    odometer: '',
    description: ''
  });
  const [aiAlertForm, setAiAlertForm] = useState<any>({
    alertType: 'preventive_maintenance',
    targetValue: '',
    description: ''
  });

  // Estados para Edição de Alertas de Veículos
  const [editingAlertVehicle, setEditingAlertVehicle] = useState<Vehicle | null>(null);
  const [editAlertStatus, setEditAlertStatus] = useState<'available' | 'maintenance' | 'trip' | 'sold'>('available');
  const [editAlertNextMaintKM, setEditAlertNextMaintKM] = useState<number | ''>('');
  const [editAlertNextOilKM, setEditAlertNextOilKM] = useState<number | ''>('');
  const [editAlertCurrentOdometer, setEditAlertCurrentOdometer] = useState<number>(0);

  // Estados para Seleção e Impressão em Lote
  const [selectedAlertVehicleIds, setSelectedAlertVehicleIds] = useState<string[]>([]);

  const playAlertSound = React.useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioCtx.currentTime;
      
      const playFreq = (freq: number, start: number, duration: number, type: 'sine' | 'triangle' | 'square' = 'sine') => {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, start);
        gainNode.gain.setValueAtTime(0.12, start);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };

      // Play a triple alert beep/chime sequence (D5, A5, D6)
      playFreq(587.33, now, 0.12, 'triangle');
      playFreq(880, now + 0.10, 0.16, 'sine');
      playFreq(1174.66, now + 0.22, 0.35, 'sine');
    } catch (e) {
      console.warn("Audio Context blocked or not supported:", e);
    }
  }, []);

  React.useEffect(() => {
    if (activeTab === 'alerts' && soundAlertsEnabled) {
      const hasCriticalOrWarning = (vehicles || []).some(v => {
        if (!v.nextMaintenanceKM) return false;
        const kmRemaining = v.nextMaintenanceKM - v.currentOdometer;
        return kmRemaining <= alertMaintKm;
      });
      if (hasCriticalOrWarning) {
        const timeoutId = setTimeout(() => {
          playAlertSound();
        }, 300);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [activeTab, soundAlertsEnabled, vehicles, alertMaintKm, playAlertSound]);

  const handleAIFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      setAiIsLoading(true);
      try {
        const reader = new FileReader();
        reader.onload = (event) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            const MAX_SIZE = 1200;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
            setAiFileBase64(compressedBase64.split(',')[1]);
            setAiFileMimeType('image/jpeg');
            setAiFileBlobUrl(compressedBase64);
            setAiIsLoading(false);
          };
          img.src = event.target?.result as string;
        };
        reader.readAsDataURL(file);
      } catch (err) {
        console.error("Compression error:", err);
        setAiIsLoading(false);
      }
    } else {
      setAiFileMimeType(file.type);
      setAiFileBlobUrl(URL.createObjectURL(file));

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(',')[1];
        setAiFileBase64(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAIDistributionSubmit = async () => {
    if (!aiInputText && !aiFileBase64) {
      toast.error("Por favor, digite uma descrição ou anexe uma foto/documento.");
      return;
    }

    setAiIsLoading(true);
    setAiResult(null);

    try {
      const res = await fetch("/api/fleet/distribute-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          base64Data: aiFileBase64,
          mimeType: aiFileMimeType,
          textPrompt: aiInputText
        })
      });

      if (!res.ok) {
        throw new Error("Erro na resposta do servidor.");
      }

      const data = await res.json();
      setAiResult(data);

      // Auto-identificar o veículo na frota se houver correspondência
      let matchedVehicleId = "";
      if (data.vehicleIdentified && (data.vehicleIdentified.plate || data.vehicleIdentified.model)) {
        const plateToMatch = (data.vehicleIdentified.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
        const modelToMatch = (data.vehicleIdentified.model || "").toLowerCase();

        const matched = vehicles.find(v => {
          const vPlate = (v.plate || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
          const vModel = (v.model || "").toLowerCase();
          return (plateToMatch && vPlate.includes(plateToMatch)) || (modelToMatch && vModel.includes(modelToMatch));
        });

        if (matched) {
          matchedVehicleId = matched.id;
          setAiVehicleId(matched.id);
        }
      }

      // Preencher o formulário de manutenção
      if (data.maintenanceData) {
        setAiMaintenanceForm({
          completedAt: data.maintenanceData.completedAt || format(new Date(), 'yyyy-MM-dd'),
          type: data.maintenanceData.type || 'preventive',
          provider: data.maintenanceData.provider || '',
          partsReplaced: data.maintenanceData.partsReplaced || '',
          cost: data.maintenanceData.cost || '',
          odometer: data.maintenanceData.odometer || '',
          description: data.maintenanceData.description || ''
        });
      }

      // Preencher o formulário de alertas
      if (data.alertData) {
        setAiAlertForm({
          alertType: data.alertData.alertType || 'preventive_maintenance',
          targetValue: data.alertData.targetValue || '',
          description: data.alertData.description || ''
        });
      }

      toast.success("Análise de inteligência artificial concluída com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error("Ocorreu um erro ao processar com a IA: " + err.message);
    } finally {
      setAiIsLoading(false);
    }
  };

  const handleConfirmAIDistribution = async () => {
    if (!aiVehicleId) {
      toast.error("Selecione qual veículo da frota deve receber as informações.");
      return;
    }

    try {
      const vehicleRef = doc(db, 'vehicles', aiVehicleId);
      const matchedVeh = vehicles.find(v => v.id === aiVehicleId);

      if (aiResult.actionType === 'maintenance') {
        // Salvar em 'maintenance_logs'
        await addDoc(collection(db, 'maintenance_logs'), cleanUndefined({
          vehicleId: aiVehicleId,
          completedAt: aiMaintenanceForm.completedAt,
          type: aiMaintenanceForm.type,
          provider: aiMaintenanceForm.provider || 'S/D',
          partsReplaced: aiMaintenanceForm.partsReplaced || 'S/D',
          cost: Number(aiMaintenanceForm.cost) || 0,
          odometer: Number(aiMaintenanceForm.odometer) || (matchedVeh?.currentOdometer || 0),
          description: aiMaintenanceForm.description || 'Registro via IA',
          status: 'completed',
          createdAt: serverTimestamp()
        }));

        // Atualizar odômetro do veículo se for maior que o atual
        const newOdometer = Number(aiMaintenanceForm.odometer);
        const updates: any = {};
        if (newOdometer && (!matchedVeh || newOdometer > matchedVeh.currentOdometer)) {
          updates.currentOdometer = newOdometer;
        }

        // Se fomos de manutenção preventiva, vamos registrar o último KM de manutenção
        updates.lastMaintenanceKM = newOdometer || (matchedVeh?.currentOdometer || 0);
        updates.lastMaintenanceDate = aiMaintenanceForm.completedAt;

        if (Object.keys(updates).length > 0) {
          await updateDoc(vehicleRef, cleanUndefined(updates));
        }

        // Remover ordens de serviço pendentes ao registrar manutenção via IA
        const pendingOS = maintenance.filter(m => m.vehicleId === aiVehicleId && m.status === 'pending');
        for (const os of pendingOS) {
          await dbCacheService.removeDocumentFromCollection('maintenance_logs', os.id);
          await deleteDoc(doc(db, 'maintenance_logs', os.id));
        }

        toast.success("Manutenção cadastrada com sucesso e aplicada ao veículo!");

        // Se houver arquivo, salvar também no cofre de documentos (ficha do ativo)
        if (aiFileBase64) {
          await addDoc(collection(db, 'finance_documents'), cleanUndefined({
            name: `MANUTENÇÃO: ${aiMaintenanceForm.provider || 'Oficina'}`.toUpperCase(),
            category: 'veiculos',
            dueDate: aiMaintenanceForm.completedAt,
            warningThreshold: 30,
            vehicleId: aiVehicleId,
            vehiclePlate: matchedVeh?.plate || null,
            vehicleModel: matchedVeh?.model || null,
            pdfName: `IA_DOC_${format(new Date(), 'yyyyMMdd_HHmmss')}.JPG`,
            pdfSize: `${(aiFileBase64.length * 0.75 / 1024).toFixed(1)} KB`,
            pdfData: aiFileBlobUrl?.startsWith('data:') ? aiFileBlobUrl : `data:${aiFileMimeType};base64,${aiFileBase64}`,
            origin: 'fleet',
            createdAt: new Date().toISOString()
          }));
        }
      } else if (aiResult.actionType === 'alert') {
        // Atualizar alerta no veículo
        const updates: any = {};
        const val = aiAlertForm.targetValue;

        if (aiAlertForm.alertType === 'preventive_maintenance') {
          updates.nextMaintenanceKM = Number(val) || null;
        } else if (aiAlertForm.alertType === 'oil_change') {
          updates.nextOilChangeKM = Number(val) || null;
        } else if (aiAlertForm.alertType === 'document_expiration') {
          updates.nextPreventiveMaintenanceDate = val || null;
        }

        await updateDoc(vehicleRef, cleanUndefined(updates));

        // Remover ordens de serviço pendentes ao atualizar alertas/prazos via IA
        const pendingOS = maintenance.filter(m => m.vehicleId === aiVehicleId && m.status === 'pending');
        for (const os of pendingOS) {
          await dbCacheService.removeDocumentFromCollection('maintenance_logs', os.id);
          await deleteDoc(doc(db, 'maintenance_logs', os.id));
        }

        toast.success("Alerta/Agendamento atualizado com sucesso no veículo!");

        // Se houver arquivo, salvar também no cofre de documentos (ficha do ativo)
        if (aiFileBase64) {
          await addDoc(collection(db, 'finance_documents'), cleanUndefined({
            name: `ALERTA/VENCIMENTO: ${aiAlertForm.description || 'Documento'}`.toUpperCase(),
            category: 'veiculos',
            dueDate: aiAlertForm.targetValue?.includes('-') ? aiAlertForm.targetValue : format(new Date(), 'yyyy-MM-dd'),
            warningThreshold: 30,
            vehicleId: aiVehicleId,
            vehiclePlate: matchedVeh?.plate || null,
            vehicleModel: matchedVeh?.model || null,
            pdfName: `IA_ALERT_${format(new Date(), 'yyyyMMdd_HHmmss')}.JPG`,
            pdfSize: `${(aiFileBase64.length * 0.75 / 1024).toFixed(1)} KB`,
            pdfData: aiFileBlobUrl?.startsWith('data:') ? aiFileBlobUrl : `data:${aiFileMimeType};base64,${aiFileBase64}`,
            origin: 'fleet',
            createdAt: new Date().toISOString()
          }));
        }
      } else {
        toast.error("Nenhuma ação identificada pela IA.");
        return;
      }

      // Fechar modal e resetar
      setIsAIModalOpen(false);
      setAiInputText('');
      setAiFileBase64(null);
      setAiFileMimeType(null);
      setAiFileBlobUrl(null);
      setAiResult(null);
      setAiVehicleId('');
    } catch (error: any) {
      handleFirestoreError(error, OperationType.WRITE, `vehicles/${aiVehicleId}`);
      toast.error("Erro ao registrar informações no veículo: " + error.message);
    }
  };

  const handleEditAlertClick = (v: Vehicle) => {
    setEditingAlertVehicle(v);
    setEditAlertStatus(v.status || 'available');
    setEditAlertNextMaintKM(v.nextMaintenanceKM || '');
    setEditAlertNextOilKM(v.nextOilChangeKM || '');
    setEditAlertCurrentOdometer(v.currentOdometer || 0);
  };

  const handleSaveEditAlert = async () => {
    if (!editingAlertVehicle) return;

    try {
      const vehicleRef = doc(db, 'vehicles', editingAlertVehicle.id);
      await updateDoc(vehicleRef, cleanUndefined({
        status: editAlertStatus,
        nextMaintenanceKM: editAlertNextMaintKM === '' ? null : Number(editAlertNextMaintKM),
        nextOilChangeKM: editAlertNextOilKM === '' ? null : Number(editAlertNextOilKM),
        currentOdometer: Number(editAlertCurrentOdometer) || 0,
        updatedAt: new Date().toISOString()
      }));

      // Remover ordens de serviço pendentes ao atualizar o cronograma (indicando realização ou reagendamento fora do prazo crítico)
      const pendingOS = maintenance.filter(m => m.vehicleId === editingAlertVehicle.id && m.status === 'pending');
      for (const os of pendingOS) {
        await dbCacheService.removeDocumentFromCollection('maintenance_logs', os.id);
        await deleteDoc(doc(db, 'maintenance_logs', os.id));
      }

      toast.success("Alerta e status do veículo atualizados com sucesso!");
      setEditingAlertVehicle(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${editingAlertVehicle.id}`);
      toast.error("Erro ao atualizar alertas do veículo: " + error.message);
    }
  };

  const handleDeleteOS = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir esta Ordem de Serviço permanentemente?")) return;
    try {
      await dbCacheService.removeDocumentFromCollection('maintenance_logs', id);
      await deleteDoc(doc(db, 'maintenance_logs', id));
      if (onDeleteMaintenance) {
        onDeleteMaintenance(id);
      }
      toast.success("Ordem de Serviço excluída com sucesso!");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao excluir Ordem de Serviço.");
    }
  };

  const handleDeleteAlert = async (vehicleId: string) => {
    if (!window.confirm("Deseja realmente limpar/excluir todos os limites de alerta (preventiva por KM, óleo e prazo) deste veículo?")) {
      return;
    }

    try {
      const vehicleRef = doc(db, 'vehicles', vehicleId);
      await updateDoc(vehicleRef, cleanUndefined({
        nextMaintenanceKM: null,
        nextOilChangeKM: null,
        updatedAt: new Date().toISOString()
      }));

      toast.success("Limites de alerta removidos com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro ao excluir limites de alerta: " + error.message);
    }
  };

  const handlePrintSingleDossier = (v: Vehicle) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("O bloqueador de popups impediu a abertura do dossiê de impressão.");
      return;
    }

    const matchedMaint = maintenance.filter(m => m.vehicleId === v.id);
    const maintRows = matchedMaint.map(m => `
      <tr>
        <td>${m.completedAt ? format(parseISO(m.completedAt), 'dd/MM/yyyy') : 'S/D'}</td>
        <td>${m.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}</td>
        <td>${m.provider || 'S/D'}</td>
        <td>${m.partsReplaced || 'S/D'}</td>
        <td>${m.odometer ? m.odometer.toLocaleString() + ' KM' : 'S/D'}</td>
        <td>R$ ${(m.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('');

    const kmRemaining = v.nextMaintenanceKM ? v.nextMaintenanceKM - v.currentOdometer : null;
    const oilRemaining = v.nextOilChangeKM ? v.nextOilChangeKM - v.currentOdometer : null;

    printWindow.document.write(`
      <html>
        <head>
          <title>Dossiê Detalhado - Veículo ${v.plate}</title>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 40px; color: #111827; background-color: #fff; }
            h1 { font-size: 24px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.05em; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 20px; }
            h2 { font-size: 14px; text-transform: uppercase; font-weight: 900; color: #374151; margin-top: 30px; border-bottom: 1px solid #E5E7EB; padding-bottom: 6px; }
            .grid { display: grid; grid-template-cols: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .card { border: 1px solid #E5E7EB; border-radius: 12px; padding: 16px; background: #F9FAFB; }
            .card-title { font-size: 10px; font-weight: 900; text-transform: uppercase; color: #6B7280; letter-spacing: 0.1em; margin-bottom: 6px; }
            .card-value { font-size: 16px; font-weight: 900; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #E5E7EB; padding: 10px; text-align: left; font-size: 11px; }
            th { background-color: #F3F4F6; font-weight: 900; text-transform: uppercase; font-size: 10px; color: #374151; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; border: 1px solid; }
            .badge-red { background-color: #FEF2F2; color: #991B1B; border-color: #FCA5A5; }
            .badge-amber { background-color: #FFFBEB; color: #92400E; border-color: #FDE68A; }
            .badge-emerald { background-color: #ECFDF5; color: #065F46; border-color: #A7F3D0; }
            .badge-zinc { background-color: #F9FAFB; color: #374151; border-color: #D1D5DB; }
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 30px;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="display: flex; flex-direction: column;">
                <div style="display: flex; align-items: baseline; gap: 4px;">
                  <span style="font-size: 28px; font-weight: 900; color: #000; letter-spacing: -0.05em;">DM</span>
                  <span style="font-size: 18px; font-weight: 700; color: #000; letter-spacing: -0.02em;">TURISMO</span>
                </div>
                <span style="font-size: 8px; font-style: italic; color: #64748b; margin-top: -4px;">"Prazer em viajar bem"</span>
                <span style="font-size: 8px; font-weight: 900; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 2px;">Gestão de Frota • Dossiê do Ativo</span>
              </div>
            </div>
            <div style="text-align: right;">
              <h1 style="border-bottom: none; margin-bottom: 0; padding-bottom: 0; font-size: 20px; color: #0f172a;">Veículo: ${v.plate}</h1>
              <span class="badge badge-zinc" style="margin-top: 4px;">Status: ${v.status === 'available' ? 'Disponível' : v.status === 'maintenance' ? 'Em Manutenção' : 'Em Viagem'}</span>
            </div>
          </div>

          <div class="grid">
            <div class="card">
              <div class="card-title">Especificações do Veículo</div>
              <div style="font-size: 13px; font-weight: bold; margin-bottom: 4px;">Modelo: ${v.model}</div>
              <div style="font-size: 11px; color: #4B5563;">Tipo: ${v.type?.toUpperCase()} | Capacidade: ${v.capacity} Passg.</div>
              <div style="font-size: 11px; color: #4B5563; margin-top: 4px;">Ano Fab: ${v.factoryYear} | Odômetro: ${v.currentOdometer.toLocaleString()} KM</div>
            </div>

            <div class="card">
              <div class="card-title">Situação de Alertas</div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <span style="font-size: 12px; font-weight: bold;">Manutenção Preventiva:</span>
                <span class="badge ${kmRemaining === null ? 'badge-zinc' : kmRemaining <= 1000 ? 'badge-red' : kmRemaining <= alertMaintKm ? 'badge-amber' : 'badge-emerald'}">
                  ${kmRemaining === null ? 'Não definida' : kmRemaining <= 0 ? 'VENCIDA' : kmRemaining <= 1000 ? 'CRÍTICA' : kmRemaining <= alertMaintKm ? 'ATENÇÃO' : 'SEGURO'}
                </span>
              </div>
              <div style="font-size: 11px; color: #4B5563;">
                ${v.nextMaintenanceKM ? `Próxima Preventiva planejada para: <b>${v.nextMaintenanceKM.toLocaleString()} KM</b><br/>` : ''}
                ${kmRemaining !== null ? `Diferença atual: <b>${kmRemaining <= 0 ? 'Atrasada em ' + Math.abs(kmRemaining).toLocaleString() + ' KM' : 'Faltam ' + kmRemaining.toLocaleString() + ' KM'}</b><br/>` : ''}
                ${v.nextOilChangeKM ? `Próxima Troca de Óleo: <b>${v.nextOilChangeKM.toLocaleString()} KM</b> (Diferença: ${oilRemaining !== null ? oilRemaining.toLocaleString() + ' KM' : 'S/D'})` : ''}
              </div>
            </div>
          </div>

          <h2>Documentação e Legalização (Vencimentos)</h2>
          <table>
            <thead>
              <tr>
                <th>Documento</th>
                <th>Prazo de Vencimento</th>
                <th>Dias Restantes</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Licenciamento Anual</td>
                <td>${v.licenseExpiration ? format(parseISO(v.licenseExpiration), 'dd/MM/yyyy') : 'Não cadastrado'}</td>
                <td>${v.licenseExpiration ? differenceInDays(parseISO(v.licenseExpiration), new Date()) + ' dias' : 'S/D'}</td>
                <td>
                  <span class="badge ${v.licenseExpiration && differenceInDays(parseISO(v.licenseExpiration), new Date()) <= 0 ? 'badge-red' : 'badge-emerald'}">
                    ${v.licenseExpiration && differenceInDays(parseISO(v.licenseExpiration), new Date()) <= 0 ? 'Vencido' : 'Regular'}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Seguro Obrigatório</td>
                <td>${v.insuranceExpiration ? format(parseISO(v.insuranceExpiration), 'dd/MM/yyyy') : 'Não cadastrado'}</td>
                <td>${v.insuranceExpiration ? differenceInDays(parseISO(v.insuranceExpiration), new Date()) + ' dias' : 'S/D'}</td>
                <td>
                  <span class="badge ${v.insuranceExpiration && differenceInDays(parseISO(v.insuranceExpiration), new Date()) <= 0 ? 'badge-red' : 'badge-emerald'}">
                    ${v.insuranceExpiration && differenceInDays(parseISO(v.insuranceExpiration), new Date()) <= 0 ? 'Vencido' : 'Regular'}
                  </span>
                </td>
              </tr>
              ${v.cadasturExpiration ? `
              <tr>
                <td>CADASTUR</td>
                <td>${format(parseISO(v.cadasturExpiration), 'dd/MM/yyyy')}</td>
                <td>${differenceInDays(parseISO(v.cadasturExpiration), new Date())} dias</td>
                <td>
                  <span class="badge ${differenceInDays(parseISO(v.cadasturExpiration), new Date()) <= 0 ? 'badge-red' : 'badge-emerald'}">
                    ${differenceInDays(parseISO(v.cadasturExpiration), new Date()) <= 0 ? 'Vencido' : 'Regular'}
                  </span>
                </td>
              </tr>` : ''}
              ${v.tacografoExpiration ? `
              <tr>
                <td>Cronotacógrafo</td>
                <td>${format(parseISO(v.tacografoExpiration), 'dd/MM/yyyy')}</td>
                <td>${differenceInDays(parseISO(v.tacografoExpiration), new Date())} dias</td>
                <td>
                  <span class="badge ${differenceInDays(parseISO(v.tacografoExpiration), new Date()) <= 0 ? 'badge-red' : 'badge-emerald'}">
                    ${differenceInDays(parseISO(v.tacografoExpiration), new Date()) <= 0 ? 'Vencido' : 'Regular'}
                  </span>
                </td>
              </tr>` : ''}
            </tbody>
          </table>

          <h2>Histórico de Manutenções Registradas</h2>
          ${matchedMaint.length > 0 ? `
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Oficina / Fornecedor</th>
                  <th>Serviço / Peças</th>
                  <th>Odômetro</th>
                  <th>Custo Total</th>
                </tr>
              </thead>
              <tbody>
                ${maintRows}
              </tbody>
            </table>
          ` : `
            <div style="padding: 20px; text-align: center; border: 1px dashed #E5E7EB; border-radius: 8px; font-size: 12px; color: #6B7280; font-weight: bold; text-transform: uppercase;">
              Nenhuma manutenção cadastrada para este veículo.
            </div>
          `}

          <div class="footer">
            Relatório gerado automaticamente pelo Sistema DM Turismo em ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handlePrintVerificationChecklist = async (v: Vehicle) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const drawHeader = (docInstance: any) => {
        // DM Turismo Branding Header - Eco-Mode (Low Ink)
        docInstance.setDrawColor(0, 0, 0);
        docInstance.setLineWidth(0.5);
        docInstance.line(14, 34, 196, 34);
        
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(24);
        docInstance.setTextColor(0, 0, 0);
        docInstance.text('DM', 14, 20);
        
        docInstance.setFontSize(16);
        docInstance.text('TURISMO', 28, 20);
        
        docInstance.setFontSize(7);
        docInstance.setFont('helvetica', 'italic');
        docInstance.setTextColor(80, 80, 80);
        docInstance.text('"Prazer em viajar bem"', 14, 26);
        
        docInstance.setFontSize(8);
        docInstance.setTextColor(100, 100, 100);
        docInstance.setFont('helvetica', 'normal');
        docInstance.text('GESTÃO DE FROTA E CONTROLE TÉCNICO DE CAMPO', 14, 30);
        
        docInstance.setFontSize(10);
        docInstance.setTextColor(0, 0, 0);
        docInstance.setFont('helvetica', 'bold');
        docInstance.text('FICHA DE VERIFICAÇÃO', 196, 18, { align: 'right' });
        
        docInstance.setFontSize(8);
        docInstance.setTextColor(100, 100, 100);
        docInstance.setFont('helvetica', 'normal');
        docInstance.text(`ATIVO: ${v.plate.toUpperCase()}`, 196, 24, { align: 'right' });
        docInstance.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 196, 28, { align: 'right' });
        
        docInstance.setFillColor(150, 150, 150);
        docInstance.rect(14, 34, 182, 0.5, 'F');
      };

      drawHeader(doc);
      let startY = 42;

      // Section 1
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('1. DADOS DE CADASTRO E LEITURA DE CAMPO (PREENCHIMENTO MANUAL)', 14, startY);
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['ESPECIFICAÇÃO', 'CADASTRO NO SISTEMA', 'ATUALIZAÇÃO LIDO EM CAMPO']],
        body: [
          ['Veículo / Modelo', v.model || 'S/D', 'Ano: __________ Chassi: __________________'],
          ['Placa / Prefixo', `${v.plate} ${v.prefix ? '(' + v.prefix + ')' : ''}`, 'Capacidade Real: [     ] PAX'],
          ['Tipo do Ativo', v.type === 'bus' ? 'Ônibus' : v.type === 'microbus' ? 'Micro-ônibus' : v.type === 'van' ? 'Van' : String(v.type).toUpperCase(), 'Renavam: ___________________________'],
          ['Odômetro Atual', `${v.currentOdometer.toLocaleString('pt-BR')} KM`, 'KM Lido no Painel: ________________ KM'],
          ['Inspeção e Leitura', `Data: ${format(new Date(), 'dd/MM/yyyy')}`, 'Inspecionador: _____________________'],
          ['Nível Combustível', 'Checagem Visual', '[ ] Cheio [ ] 3/4 [ ] 1/2 [ ] 1/4 [ ] Reserva'],
          ['Arla 32 / Óleo', 'Reservatório', 'Arla: ______% | Próx. Troca Óleo: __________ KM'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      // Section 2
      if (startY > 240) { doc.addPage(); drawHeader(doc); startY = 42; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. CHECKLIST DE DOCUMENTAÇÃO E REGULAMENTAÇÃO OBRIGATÓRIA', 14, startY);
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['DOCUMENTO', 'VENCIMENTO SISTEMA', 'SITUAÇÃO VERIFICADA']],
        body: [
          ['CRLV / Licenciamento', v.licenseExpiration ? format(parseISO(v.licenseExpiration), 'dd/MM/yyyy') : 'S/D', '[ ] Em Dia [ ] Vencido (Novo: ___/___/___)'],
          ['Cronotacógrafo', v.tacografoExpiration ? format(parseISO(v.tacografoExpiration), 'dd/MM/yyyy') : 'S/D', '[ ] Aferido [ ] Vencido (Discos: [ ] S [ ] N)'],
          ['CADASTUR', v.cadasturExpiration ? format(parseISO(v.cadasturExpiration), 'dd/MM/yyyy') : 'S/D', '[ ] Ativo [ ] Vencido [ ] N/A'],
          ['ANTT / Órgãos', v.anttExpiration ? format(parseISO(v.anttExpiration), 'dd/MM/yyyy') : 'S/D', '[ ] Regular [ ] Pendente [ ] N/A'],
          ['Extintor Carga', 'Validade Carga', '[ ] Válido [ ] Vencido'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      // Section 3
      if (startY > 240) { doc.addPage(); drawHeader(doc); startY = 42; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('3. CHECKLIST DE CONSERVAÇÃO E SEGURANÇA OPERACIONAL', 14, startY);
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['ITEM TÉCNICO', 'STATUS ESPERADO', 'CONDIÇÃO DE CAMPO']],
        body: [
          ['Pneus Dianteiros', 'Bons / Calibrados', '[ ] Conforme [ ] Calibrar [ ] Trocar'],
          ['Pneus Traseiros', 'Bons / Calibrados', '[ ] Conforme [ ] Calibrar [ ] Recapar'],
          ['Estepe / Kit', 'Completo', '[ ] Presente [ ] Danificado [ ] Faltando'],
          ['Óleo / Arrefecimento', 'Nível OK', '[ ] Normal [ ] Completar Óleo [ ] Água'],
          ['Iluminação', 'Lâmpadas OK', '[ ] 100% OK [ ] Queimada'],
          ['Freios', 'Sem Vazamentos', '[ ] Normal [ ] Ruído / Baixa Pressão'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      // Section 4
      if (startY > 240) { doc.addPage(); drawHeader(doc); startY = 42; }
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('4. REGISTRO DE AVARIAS E OBSERVAÇÕES', 14, startY);
      startY += 4;
      doc.setDrawColor(0, 0, 0);
      doc.rect(14, startY, 182, 20, 'S');
      startY += 26;

      // Signatures
      if (startY > 260) { doc.addPage(); drawHeader(doc); startY = 42; }
      doc.setDrawColor(0, 0, 0);
      doc.line(20, startY + 10, 95, startY + 10);
      doc.line(115, startY + 10, 190, startY + 10);
      doc.setFontSize(8);
      doc.text('Assinatura Inspecionador', 57, startY + 14, { align: 'center' });
      doc.text('Assinatura Gestor', 152, startY + 14, { align: 'center' });

      doc.save(`Ficha_Verificacao_${v.plate.replace(/\s/g, '_')}.pdf`);
      toast.success('Ficha de Verificação gerada com sucesso em PDF!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar ficha em PDF.');
    }
  };

  const handlePrintBatchDossiers = () => {
    const idsToPrint = selectedAlertVehicleIds.length > 0 
      ? selectedAlertVehicleIds 
      : (vehicles || []).map(v => v.id);

    const vehiclesToPrint = vehicles.filter(v => idsToPrint.includes(v.id));

    if (vehiclesToPrint.length === 0) {
      toast.error("Nenhum veículo selecionado ou disponível para impressão.");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("O bloqueador de popups impediu a abertura do relatório.");
      return;
    }

    // Group vehicles by status
    const criticals: Vehicle[] = [];
    const warnings: Vehicle[] = [];
    const safes: Vehicle[] = [];
    const unplanneds: Vehicle[] = [];

    vehiclesToPrint.forEach(v => {
      const kmRemaining = v.nextMaintenanceKM ? v.nextMaintenanceKM - v.currentOdometer : null;
      if (kmRemaining === null) {
        unplanneds.push(v);
      } else if (kmRemaining <= 1000) {
        criticals.push(v);
      } else if (kmRemaining <= alertMaintKm) {
        warnings.push(v);
      } else {
        safes.push(v);
      }
    });

    const renderGroup = (title: string, groupList: Vehicle[], bgClass: string, textStyle: string) => {
      if (groupList.length === 0) return '';
      const rows = groupList.map(v => {
        const kmRemaining = v.nextMaintenanceKM ? v.nextMaintenanceKM - v.currentOdometer : null;
        const oilRemaining = v.nextOilChangeKM ? v.nextOilChangeKM - v.currentOdometer : null;
        return `
          <tr>
            <td style="font-weight: 900; font-size: 12px;">${v.plate}</td>
            <td>${v.model}</td>
            <td>${v.currentOdometer.toLocaleString()} KM</td>
            <td>${v.nextMaintenanceKM ? v.nextMaintenanceKM.toLocaleString() + ' KM' : 'N/D'}</td>
            <td style="font-weight: bold; ${kmRemaining !== null && kmRemaining <= 1000 ? 'color: #EF4444;' : kmRemaining !== null && kmRemaining <= alertMaintKm ? 'color: #D97706;' : 'color: #10B981;'}">
              ${kmRemaining === null ? 'Não definido' : kmRemaining <= 0 ? 'VENCIDO há ' + Math.abs(kmRemaining).toLocaleString() + ' KM' : 'Faltam ' + kmRemaining.toLocaleString() + ' KM'}
            </td>
            <td>${v.nextOilChangeKM ? v.nextOilChangeKM.toLocaleString() + ' KM' : 'N/D'}</td>
            <td>${v.status === 'available' ? 'Disponível' : v.status === 'maintenance' ? 'Manutenção' : 'Em Viagem'}</td>
          </tr>
        `;
      }).join('');

      return `
        <div style="margin-top: 30px; border: 1px solid #E5E7EB; border-radius: 12px; overflow: hidden;">
          <div style="background-color: ${bgClass}; padding: 12px 18px; color: #fff; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 0.1em; display: flex; justify-content: space-between;">
            <span>${title}</span>
            <span>${groupList.length} Veículo(s)</span>
          </div>
          <table style="margin-top: 0; border: none; width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #F9FAFB;">
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Placa</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Modelo</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Odômetro</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Próx. Preventiva</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Diferença</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Troca de Óleo</th>
                <th style="border: none; border-bottom: 1px solid #E5E7EB; padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      `;
    };

    printWindow.document.write(`
      <html>
        <head>
          <title>Dossiê Consolidado de Alertas - DM Turismo</title>
          <style>
            body { font-family: 'Inter', sans-serif; margin: 40px; color: #111827; background-color: #fff; }
            h1 { font-size: 22px; text-transform: uppercase; font-weight: 900; letter-spacing: -0.05em; border-bottom: 2px solid #111827; padding-bottom: 10px; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border-bottom: 1px solid #E5E7EB; padding: 10px; text-align: left; font-size: 11px; }
            th { font-weight: 900; text-transform: uppercase; font-size: 9px; color: #4B5563; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 6px; font-size: 9px; font-weight: 900; text-transform: uppercase; border: 1px solid; }
            .badge-zinc { background-color: #F9FAFB; color: #374151; border-color: #D1D5DB; }
            .footer { margin-top: 50px; text-align: center; font-size: 9px; color: #9CA3AF; text-transform: uppercase; font-weight: bold; }
          </style>
        </head>
        <body>
          <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 15px; border-b: 1px solid #E5E7EB; padding-bottom: 15px;">
            <div>
              <span style="font-size: 9px; font-weight: 900; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.25em; block">Relatório Consolidado</span>
              <h1>Dossiê de Alertas por Status</h1>
            </div>
            <div style="text-align: right; font-size: 10px; color: #6B7280; font-weight: bold;">
              Total Selecionado: ${vehiclesToPrint.length} Veículo(s)
            </div>
          </div>

          ${renderGroup('Crítico / Vencido (Faltam menos de 1.000 KM)', criticals, '#EF4444', 'text-red-500')}
          ${renderGroup('Atenção (Faltam menos de ' + alertMaintKm.toLocaleString() + ' KM)', warnings, '#D97706', 'text-yellow-600')}
          ${renderGroup('Seguro / Em Dia', safes, '#10B981', 'text-emerald-500')}
          ${renderGroup('Sem Planejamento de Preventiva por KM', unplanneds, '#6B7280', 'text-zinc-500')}

          <div class="footer">
            Relatório consolidado gerado automaticamente pelo Sistema DM Turismo em ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Memoized stats for dashboard metrics to speed up rendering
  const pendingOrdersCount = useMemo(() => {
    return maintenance.filter(m => m.status === 'pending').length;
  }, [maintenance]);

  const maintenanceAlertsCount = useMemo(() => {
    const today = new Date();
    return vehicles.filter(v => 
      (v.nextOilChangeKM && v.nextOilChangeKM - v.currentOdometer <= alertOilKm) || 
      (v.nextMaintenanceKM && v.nextMaintenanceKM - v.currentOdometer <= alertMaintKm) ||
      (v.nextPreventiveMaintenanceDate && differenceInDays(parseISO(v.nextPreventiveMaintenanceDate), today) <= alertMaintDays)
    ).length;
  }, [vehicles, alertOilKm, alertMaintKm, alertMaintDays]);

  const monthlyMaintenanceCost = useMemo(() => {
    const currentMonth = new Date().getMonth();
    return maintenance
      .filter(m => m.completedAt && parseISO(m.completedAt).getMonth() === currentMonth)
      .reduce((acc, m) => acc + m.cost, 0);
  }, [maintenance]);

  const fleetAvailability = useMemo(() => {
    if (vehicles.length === 0) return 0;
    const available = vehicles.filter(v => v.status === 'available').length;
    return Math.round((available / vehicles.length) * 100);
  }, [vehicles]);

  // Auxiliar download TXT
  const downloadTxtFile = (filename: string, content: string) => {
    const element = document.createElement("a");
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });
    element.href = URL.createObjectURL(file);
    element.download = filename;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleExportIndividualOS_TXT = (log: MaintenanceLog) => {
    const v = vehicles.find(veh => veh.id === log.vehicleId);
    const osNum = log.id?.substring(0, 8).toUpperCase() || 'NEW';
    
    let text = `==================================================\n`;
    text += `              DM TURISMO - GESTÃO DE FROTA        \n`;
    text += `             ORDEM DE SERVIÇO DE MANUTENÇÃO       \n`;
    text += `==================================================\n`;
    text += `O.S. NUM:    ${osNum}\n`;
    text += `VEÍCULO:     ${v?.plate || '---'} (${v?.model || ''})\n`;
    text += `ANO/MOD:     ${v?.factoryYear || '---'}\n`;
    text += `ODÔMETRO:    ${log.odometer?.toLocaleString() || '---'} KM\n`;
    text += `SITUAÇÃO:    ${log.status === 'pending' ? 'PENDENTE' : 'CONCLUÍDA'}\n`;
    text += `TIPO:        ${log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}\n`;
    text += `DATA REG:    ${log.completedAt ? format(parseISO(log.completedAt), 'dd/MM/yyyy') : format(parseISO(log.createdAt), 'dd/MM/yyyy')}\n`;
    text += `CUSTO REAL:  R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    text += `==================================================\n`;
    text += `DESCRITIVO DO SERVIÇO:\n`;
    text += `--------------------------------------------------\n`;
    text += `${log.description || 'Nenhum detalhe informado.'}\n`;
    text += `==================================================\n`;
    text += `            Gerado por DM Turismo Pro             \n`;
    text += `==================================================\n`;

    downloadTxtFile(`OS_${v?.plate || 'VEICULO'}_${osNum}.txt`, text);
    toast.success("O.S. Baixada em TXT!");
  };

  const handleAutoGenerateOS = async (scope: 'week' | 'month') => {
    setIsGenerating(true);
    const today = startOfToday();
    let createdCount = 0;
    const kmThreshold = 1000; // Alterado para 1000km fixo conforme solicitado

    try {
      for (const vehicle of vehicles) {
        const needsMaintenance = [];
        
        // Check by Date
        if (vehicle.nextPreventiveMaintenanceDate) {
          const mDate = parseISO(vehicle.nextPreventiveMaintenanceDate);
          const daysToVenc = differenceInDays(mDate, today);
          const isDateMatch = daysToVenc <= 30 && daysToVenc >= 0;

          if (isDateMatch) {
            needsMaintenance.push(`Preventiva Automática (< 30 dias) (Data: ${format(mDate, 'dd/MM/yyyy')})`);
          }
        }

        // Check by KM (Within requested threshold)
        if (vehicle.nextMaintenanceKM) {
          const kmDiff = vehicle.nextMaintenanceKM - vehicle.currentOdometer;
          if (kmDiff <= kmThreshold) {
            needsMaintenance.push(`Preventiva Automática (< ${kmThreshold}KM) (KM: ${vehicle.nextMaintenanceKM.toLocaleString()})`);
          }
        }

        if (vehicle.nextOilChangeKM) {
          const kmDiff = vehicle.nextOilChangeKM - vehicle.currentOdometer;
          const oilThreshold = 1000;
          if (kmDiff <= oilThreshold) {
            needsMaintenance.push(`Troca de Óleo Automática (< 1000KM) (KM: ${vehicle.nextOilChangeKM.toLocaleString()})`);
          }
        }

        // Only create if there's no PENDING maintenance for this vehicle already covering this
        const hasPending = maintenance.some(m => m.vehicleId === vehicle.id && m.status === 'pending');

        if (needsMaintenance.length > 0 && !hasPending) {
          await addDoc(collection(db, 'maintenance_logs'), {
            vehicleId: vehicle.id,
            description: needsMaintenance.join(' | '),
            type: 'preventive',
            status: 'pending',
            cost: 0,
            odometer: vehicle.currentOdometer,
            scheduledDate: vehicle.nextPreventiveMaintenanceDate || new Date().toISOString(),
            createdAt: new Date().toISOString()
          });
          createdCount++;
        }
      }

      if (createdCount > 0) {
        toast.success(`${createdCount} Ordens de Serviço geradas automaticamente para o período de ${scope === 'week' ? 'uma semana' : 'um mês'}!`);
      } else {
        toast.info('Nenhuma manutenção pendente identificada para as condições selecionadas.');
      }
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar ordens automáticas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const tabs = [
    { id: 'fleet', label: 'Frota', icon: Bus },
    { id: 'alerts', label: 'Alertas', icon: AlertTriangle },
    { id: 'vencimentos', label: 'Documentação', icon: Calendar },
    { id: 'maintenance', label: 'Manutenção', icon: Wrench },
    { id: 'drivers', label: 'Motoristas', icon: Users },
    { id: 'tires', label: 'Pneus', icon: Disc },
    { id: 'sold', label: 'Vendidos', icon: CheckCircle },
  ];

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Header Unificado */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-zinc-800 pb-8">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-zinc-900 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent animate-pulse">
               <Bot size={24} />
             </div>
             <div className="flex flex-col sm:flex-row sm:items-center gap-3">
               <h1 className="text-4xl font-black text-white uppercase tracking-tighter">Frota</h1>
               <button
                 onClick={() => setIsAIModalOpen(true)}
                 className="flex items-center gap-2 px-3 py-1.5 bg-brand-accent/10 border border-brand-accent/30 hover:border-brand-accent hover:bg-brand-accent/20 text-brand-accent rounded-full text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all animate-pulse"
               >
                 <Sparkles size={11} className="text-brand-accent" />
                 <span>Assistente IA</span>
               </button>
             </div>
          </div>
          <p className="text-zinc-500 font-medium tracking-tight">Controle centralizado de ativos, legalização e conservação técnica inteligente.</p>
        </div>

        <div className="flex flex-wrap items-center p-1.5 bg-zinc-950/80 backdrop-blur-md border border-zinc-850 rounded-2xl w-full md:w-auto gap-1">
          {tabs.map((tab) => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex-1 md:flex-initial flex items-center justify-center gap-2 px-3 sm:px-6 py-2.5 sm:py-3 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer",
                activeTab === tab.id
                  ? "bg-zinc-800 text-brand-accent shadow-lg border border-zinc-700/30 font-black" 
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/40"
              )}
            >
              <tab.icon size={13} />
              <span className="whitespace-nowrap">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* INDICADORES OPERACIONAIS COMPILADOS */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
          <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-[0.25em] font-mono">Indicadores Operacionais</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {widgetData.map((widget, index) => {
            const Icon = widget.icon;
            return (
              <motion.div
                key={widget.id}
                initial={{ opacity: 0, scale: 0.9, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
                whileHover={{ scale: 1.03, transition: { duration: 0.2 } }}
                id={`fleet-widget-${widget.id}`}
                onClick={() => {
                  if (widget.id === 'os') {
                    setIsPendingOrdersModalOpen(true);
                  } else if (widget.onClickSection === 'tires') {
                    setActiveTab('tires');
                  } else {
                    navigate(`/${widget.onClickSection}`);
                  }
                }}
                className="bg-zinc-900 border border-zinc-800 hover:border-brand-accent/50 p-5 rounded-2xl flex flex-col justify-between min-h-[140px] shadow-lg hover:shadow-xl hover:shadow-zinc-950/20 group transition-all duration-300 cursor-pointer relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-10 transition-opacity">
                  <Icon size={48} />
                </div>
                <div className="flex items-start justify-between relative z-10">
                  <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center border", widget.color)}>
                    <Icon size={18} />
                  </div>
                </div>
                
                <div className="mt-3 relative z-10">
                  <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1 group-hover:text-zinc-400 transition-colors">
                    {widget.title}
                  </p>
                  <p className="text-xl font-sans font-black text-white uppercase tracking-tight tabular-nums group-hover:text-brand-accent transition-colors duration-300">
                    {widget.value}
                  </p>
                  <p className="text-[8.5px] font-bold text-zinc-500 uppercase tracking-widest mt-1 truncate group-hover:text-zinc-400 transition-colors">
                    {widget.trend}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Conteúdo Dinâmico */}
      <div className="min-h-[600px]">
        {activeTab === 'fleet' && (
          <div className="animate-in fade-in slide-in-from-left-4 duration-500">
            <FleetList 
              vehicles={vehicles}
              onAddVehicle={onAddVehicle}
              onVehicleClick={onVehicleClick}
              onOpenDossier={() => setIsDossierOpen(true)}
              isLoading={isLoading}
            />
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-500">
            {/* Header / Configuração local */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-zinc-900/30 p-8 rounded-3xl border border-zinc-800/40">
              <div className="space-y-1.5">
                <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500 animate-ping"></span>
                  Configuração de Alertas de Manutenção
                </h3>
                <p className="text-[10px] text-zinc-500 font-bold uppercase">Configure o limite de quilometragem para os alertas preventivos.</p>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-2xl">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Limite Alerta (KM)</span>
                  <input 
                    type="number"
                    value={alertMaintKm}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                      setAlertMaintKm(val);
                      safeSetLocalStorage('dm_alert_maint_km', val.toString());
                    }}
                    className="w-20 bg-transparent text-right font-black text-white outline-none border-b border-zinc-700 focus:border-brand-accent select-all h-6.5 text-xs tabular-nums"
                  />
                </div>
                <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-2xl">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Troca de Óleo (KM)</span>
                  <input 
                    type="number"
                    value={alertOilKm}
                    onChange={(e) => {
                      const val = Math.max(1, parseInt(e.target.value, 10) || 0);
                      setAlertOilKm(val);
                      safeSetLocalStorage('dm_alert_oil_km', val.toString());
                    }}
                    className="w-20 bg-transparent text-right font-black text-white outline-none border-b border-zinc-700 focus:border-brand-accent select-all h-6.5 text-xs tabular-nums"
                  />
                </div>
                <div className="flex items-center gap-3 bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const nextValue = !soundAlertsEnabled;
                        setSoundAlertsEnabled(nextValue);
                        safeSetLocalStorage('dm_sound_alerts_enabled', nextValue.toString());
                        if (nextValue) {
                          playAlertSound();
                          toast.success('Notificação sonora ativada!');
                        } else {
                          toast.info('Notificação sonora desativada');
                        }
                      }}
                      className={cn(
                        "p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center",
                        soundAlertsEnabled 
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20" 
                          : "bg-zinc-900 border-zinc-850 text-zinc-500 hover:text-zinc-300"
                      )}
                      title={soundAlertsEnabled ? "Silenciar notificações" : "Ativar som de alertas"}
                    >
                      {soundAlertsEnabled ? <Volume2 size={13} className="animate-pulse" /> : <VolumeX size={13} />}
                    </button>
                    <div className="leading-none text-left">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-wider block">Aviso Sonoro</span>
                      <span className={cn(
                        "text-[8px] font-bold block mt-0.5 uppercase",
                        soundAlertsEnabled ? "text-amber-500" : "text-zinc-600"
                      )}>
                        {soundAlertsEnabled ? "Ativado" : "Desativado"}
                      </span>
                    </div>
                  </div>
                  {soundAlertsEnabled && (
                    <button
                      type="button"
                      onClick={playAlertSound}
                      className="text-[8px] font-black uppercase tracking-wider text-amber-500 hover:text-amber-400 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/20 active:scale-95 transition-all shrink-0"
                    >
                      Testar
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Stats Cards Row */}
            {(() => {
              const stats = (vehicles || []).reduce(
                (acc, v) => {
                  if (!v.nextMaintenanceKM) {
                    acc.unplanned++;
                    return acc;
                  }
                  const kmRemaining = v.nextMaintenanceKM - v.currentOdometer;
                  if (kmRemaining <= 1000) {
                    acc.critical++;
                  } else if (kmRemaining <= alertMaintKm) {
                    acc.warning++;
                  } else {
                    acc.safe++;
                  }
                  return acc;
                },
                { critical: 0, warning: 0, safe: 0, unplanned: 0 }
              );

              return (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                  <div 
                    onClick={() => setAlertsTabFilter(alertsTabFilter === 'critical' ? 'all' : 'critical')}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all active:scale-95",
                      alertsTabFilter === 'critical' 
                        ? "bg-red-500/10 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]" 
                        : "bg-zinc-900/40 border-zinc-800 hover:border-red-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Crítico (&lt; 1.000 KM)</span>
                      <AlertTriangle size={14} className={cn("text-red-500", stats.critical > 0 && "animate-pulse")} />
                    </div>
                    <p className="text-3xl font-black text-red-500 mt-2 tracking-tighter tabular-nums">{stats.critical}</p>
                  </div>

                  <div 
                    onClick={() => setAlertsTabFilter(alertsTabFilter === 'warning' ? 'all' : 'warning')}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all active:scale-95",
                      alertsTabFilter === 'warning' 
                        ? "bg-yellow-500/10 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]" 
                        : "bg-zinc-900/40 border-zinc-800 hover:border-yellow-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Atenção (&lt; {alertMaintKm.toLocaleString()} KM)</span>
                      <Wrench size={14} className="text-yellow-500" />
                    </div>
                    <p className="text-3xl font-black text-yellow-500 mt-2 tracking-tighter tabular-nums">{stats.warning}</p>
                  </div>

                  <div 
                    onClick={() => setAlertsTabFilter(alertsTabFilter === 'safe' ? 'all' : 'safe')}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all active:scale-95",
                      alertsTabFilter === 'safe' 
                        ? "bg-emerald-500/10 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.15)]" 
                        : "bg-zinc-900/40 border-zinc-800 hover:border-emerald-500/30"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Seguro (Controle OK)</span>
                      <CheckCircle size={14} className="text-emerald-500" />
                    </div>
                    <p className="text-3xl font-black text-emerald-500 mt-2 tracking-tighter tabular-nums">{stats.safe}</p>
                  </div>

                  <div 
                    onClick={() => setAlertsTabFilter(alertsTabFilter === 'unplanned' ? 'all' : 'unplanned')}
                    className={cn(
                      "p-6 rounded-2xl border cursor-pointer transition-all active:scale-95",
                      alertsTabFilter === 'unplanned' 
                        ? "bg-zinc-800 border-zinc-700 shadow-md" 
                        : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-750"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Sem Programação (KM)</span>
                      <Plus size={14} className="text-zinc-600" />
                    </div>
                    <p className="text-3xl font-black text-zinc-400 mt-2 tracking-tighter tabular-nums">{stats.unplanned}</p>
                  </div>
                </div>
              );
            })()}

            {/* Search and Filters panel */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-900/10 p-4 border border-zinc-800/30 rounded-2xl">
              <div className="relative w-full sm:flex-1">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" />
                <input 
                  type="text"
                  placeholder="Localizar pela placa ou modelo..."
                  value={alertsTabSearch}
                  onChange={(e) => setAlertsTabSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-850 pl-11 pr-4 py-3 rounded-xl text-xs font-bold text-white placeholder:text-zinc-700 outline-none focus:border-brand-accent transition-all"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0 self-stretch sm:self-auto justify-end">
                <button
                  onClick={() => setAlertsTabFilter('all')}
                  className={cn(
                    "px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                    alertsTabFilter === 'all' 
                      ? "bg-brand-accent text-zinc-950 font-black shadow-lg" 
                      : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  Ver Todos
                </button>
                {(alertsTabFilter !== 'all' || alertsTabSearch) && (
                  <button
                    onClick={() => { setAlertsTabFilter('all'); setAlertsTabSearch(''); }}
                    className="px-3 py-2.5 bg-zinc-950 border border-zinc-800/80 hover:bg-zinc-900 rounded-xl text-[9px] font-black text-zinc-400 uppercase tracking-wider transition-colors"
                  >
                    Resetar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* List / Grid of Alerts */}
            {(() => {
              const term = alertsTabSearch.toLowerCase().trim();

              const filteredList = (vehicles || []).filter(v => {
                // Apply Text Filter
                if (term) {
                  const matchesPlate = v.plate?.toLowerCase().includes(term);
                  const matchesModel = v.model?.toLowerCase().includes(term);
                  const matchesPrefix = v.prefix?.toLowerCase().includes(term);
                  if (!matchesPlate && !matchesModel && !matchesPrefix) return false;
                }

                // Apply Status Filter
                const kmRemaining = v.nextMaintenanceKM ? v.nextMaintenanceKM - v.currentOdometer : null;
                if (alertsTabFilter === 'critical') {
                  return kmRemaining !== null && kmRemaining <= 1000;
                }
                if (alertsTabFilter === 'warning') {
                  return kmRemaining !== null && kmRemaining > 1000 && kmRemaining <= alertMaintKm;
                }
                if (alertsTabFilter === 'safe') {
                  return kmRemaining !== null && kmRemaining > alertMaintKm;
                }
                if (alertsTabFilter === 'unplanned') {
                  return kmRemaining === null;
                }
                return true;
              })
              .sort((a, b) => {
                const aRemaining = a.nextMaintenanceKM !== undefined ? a.nextMaintenanceKM - a.currentOdometer : Infinity;
                const bRemaining = b.nextMaintenanceKM !== undefined ? b.nextMaintenanceKM - b.currentOdometer : Infinity;
                
                // Keep unplanned at the bottom, closest / overdue at the top
                return aRemaining - bRemaining;
              });

              if (filteredList.length === 0) {
                return (
                  <div className="p-16 border border-zinc-800/40 bg-zinc-900/10 rounded-3xl text-center space-y-3">
                    <AlertTriangle size={32} className="text-zinc-600 mx-auto" />
                    <p className="text-zinc-400 font-black text-xs uppercase tracking-widest">Nenhum veículo correspondente</p>
                    <p className="text-[10px] text-zinc-650 font-bold uppercase">Ajuste os filtros de busca ou defina prazos na aba Ativos.</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Batch print control row */}
                  <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-zinc-950/85 p-4 border border-zinc-800/50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Printer size={16} className="text-brand-accent animate-pulse" />
                      <div>
                        <p className="text-[10px] font-black uppercase text-white tracking-widest leading-none">Impressão por Status</p>
                        <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1">
                          {selectedAlertVehicleIds.length} de {filteredList.length} veículos selecionados
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setSelectedAlertVehicleIds(filteredList.map(v => v.id));
                          toast.success("Todos os veículos filtrados foram selecionados!");
                        }}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                      >
                        Selecionar Todos
                      </button>
                      <button
                        onClick={() => {
                          setSelectedAlertVehicleIds([]);
                        }}
                        className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider cursor-pointer transition-all"
                      >
                        Limpar Seleção
                      </button>
                      <button
                        onClick={handlePrintBatchDossiers}
                        className="px-4 py-1.5 bg-brand-accent text-zinc-950 hover:bg-brand-accent/90 rounded-lg text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 cursor-pointer transition-all shadow-md shadow-brand-accent/5"
                      >
                        <Printer size={12} />
                        Imprimir Dossiê Lote
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredList.map((v) => {
                      const kmRemaining = v.nextMaintenanceKM !== undefined ? v.nextMaintenanceKM - v.currentOdometer : null;
                      const oilRemaining = v.nextOilChangeKM !== undefined ? v.nextOilChangeKM - v.currentOdometer : null;
                      
                      let statusColor = 'zinc';
                      let statusLabel = 'Não agendado';
                      let pulsingStyle = '';
                      
                      if (kmRemaining !== null) {
                        if (kmRemaining <= 0) {
                          statusColor = 'red';
                          statusLabel = 'Vencido';
                          pulsingStyle = 'border-red-500/70 shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-[pulse_2s_infinite]';
                        } else if (kmRemaining <= 1000) {
                          statusColor = 'red';
                          statusLabel = 'Crítico';
                          pulsingStyle = 'border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.15)] animate-[pulse_2.5s_infinite]';
                        } else if (kmRemaining <= alertMaintKm) {
                          statusColor = 'amber';
                          statusLabel = 'Atenção';
                          pulsingStyle = 'border-yellow-500/50 shadow-[0_0_12px_rgba(234,179,8,0.15)] animate-[pulse_3s_infinite]';
                        } else {
                          statusColor = 'emerald';
                          statusLabel = 'Seguro';
                        }
                      }

                      // Progress calculations
                      const next = v.nextMaintenanceKM;
                      const prev = v.lastMaintenanceKM && v.lastMaintenanceKM < (next || 0) ? v.lastMaintenanceKM : Math.max(0, (next || 10000) - 10000);
                      const totalDist = next ? next - prev : 10000;
                      const completedDist = next ? Math.min(totalDist, Math.max(0, v.currentOdometer - prev)) : 0;
                      const consumedPct = totalDist > 0 ? (completedDist / totalDist) * 100 : 0;

                      return (
                        <div 
                          key={v.id}
                          onClick={() => onVehicleClick(v)}
                          className={cn(
                            "bg-zinc-900/40 rounded-2xl border p-6 flex flex-col justify-between hover:bg-zinc-900/75 transition-all cursor-pointer group relative overflow-hidden",
                            pulsingStyle ? pulsingStyle : "border-zinc-800/80 hover:border-zinc-700 hover:shadow-lg"
                          )}
                        >
                          {/* Status Glow effect */}
                          {kmRemaining !== null && kmRemaining <= alertMaintKm && (
                            <div className={cn(
                              "absolute -top-16 -right-16 w-32 h-32 rounded-full blur-3xl opacity-5 transition-opacity group-hover:opacity-10",
                              kmRemaining <= 1000 ? "bg-red-500" : "bg-yellow-500"
                            )} />
                          )}

                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {/* Checkbox para seleção em lote */}
                                <div 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedAlertVehicleIds(prev => 
                                      prev.includes(v.id) ? prev.filter(id => id !== v.id) : [...prev, v.id]
                                    );
                                  }}
                                  className="w-5 h-5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 rounded flex items-center justify-center shrink-0 cursor-pointer text-brand-accent transition-colors"
                                  title="Selecionar para dossiê consolidado"
                                >
                                  {selectedAlertVehicleIds.includes(v.id) && (
                                    <CheckSquare className="w-4 h-4 text-brand-accent" />
                                  )}
                                </div>

                                {v.photoUrl ? (
                                  <img src={v.photoUrl} alt={v.plate} loading="lazy" decoding="async" className="w-12 h-9 object-cover rounded-md border border-zinc-800 shrink-0" />
                                ) : (
                                  <div className="w-12 h-9 bg-zinc-950 border border-zinc-850 rounded-md flex items-center justify-center shrink-0">
                                    <Bus size={14} className="text-zinc-600" />
                                  </div>
                                )}
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h4 className="text-sm font-black text-white uppercase tracking-tight">{v.plate}</h4>
                                    {v.prefix && (
                                      <span className="text-[8px] font-black px-1.5 py-0.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent rounded uppercase">
                                        F#{v.prefix}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] text-zinc-500 font-bold uppercase truncate max-w-[120px]">{v.model}</p>
                                </div>
                              </div>

                              <span className={cn(
                                "px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider border",
                                statusColor === 'red' ? "bg-red-500/10 text-red-500 border-red-500/25 animate-pulse" :
                                statusColor === 'amber' ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/25" :
                                statusColor === 'emerald' ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/25" :
                                "bg-zinc-800 text-zinc-500 border-zinc-700"
                              )}>
                                {statusLabel}
                              </span>
                            </div>

                            <div className="space-y-3 pt-2">
                              {/* Linear percentage consumed */}
                              {v.nextMaintenanceKM ? (
                                <div className="space-y-1.5">
                                  <div className="flex justify-between text-[9px] font-black uppercase text-zinc-500 tracking-tight leading-none">
                                    <span>Limite Preventivo</span>
                                    <span className={statusColor === 'red' ? "text-red-400 font-extrabold" : statusColor === 'amber' ? "text-yellow-400" : "text-emerald-400"}>
                                      {consumedPct.toFixed(0)}% Consumido
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full bg-zinc-950 rounded-full border border-zinc-850 overflow-hidden p-[1px]">
                                    <div 
                                      style={{ width: `${consumedPct}%` }}
                                      className={cn(
                                        "h-full rounded-full transition-all duration-1000",
                                        statusColor === 'red' ? "bg-red-500" : statusColor === 'amber' ? "bg-yellow-500" : "bg-emerald-500"
                                      )}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="p-3 bg-zinc-950 border border-zinc-850/50 rounded-xl text-center">
                                  <span className="text-[9px] font-black text-zinc-650 uppercase tracking-widest">Sem agendamento por KM</span>
                                </div>
                              )}

                              {/* Main Numbers */}
                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <div className="bg-zinc-950/60 p-2.5 border border-zinc-900 rounded-xl text-center space-y-0.5">
                                  <span className="text-[8px] text-zinc-600 font-black uppercase tracking-wider block">Odômetro Atual</span>
                                  <span className="text-xs font-black text-white tabular-nums tracking-tighter block">{v.currentOdometer.toLocaleString()} KM</span>
                                </div>
                                <div className="bg-zinc-950/60 p-2.5 border border-zinc-900 rounded-xl text-center space-y-0.5">
                                  <span className="text-[8px] text-zinc-600 font-black uppercase tracking-wider block">Próxima Preventiva</span>
                                  <span className={cn(
                                    "text-xs font-black tabular-nums tracking-tighter block",
                                    v.nextMaintenanceKM ? "text-white" : "text-zinc-600"
                                  )}>
                                    {v.nextMaintenanceKM ? `${v.nextMaintenanceKM.toLocaleString()} KM` : 'N/D'}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Card bottom details */}
                          <div className="mt-4 pt-4 border-t border-zinc-800/50 flex items-center justify-between">
                            <div>
                              {kmRemaining !== null ? (
                                <div className="leading-none">
                                  <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block">Diferença</span>
                                  {kmRemaining <= 0 ? (
                                    <span className="text-[10px] font-black text-red-500 uppercase tracking-tight mt-0.5 block animate-bounce">
                                      Vencida há {Math.abs(kmRemaining).toLocaleString()} KM
                                    </span>
                                  ) : (
                                    <span className={cn(
                                      "text-xs font-black tabular-nums tracking-tighter mt-0.5 block",
                                      kmRemaining <= 1000 ? "text-red-400" : kmRemaining <= alertMaintKm ? "text-yellow-400" : "text-emerald-400"
                                    )}>
                                      Faltam {kmRemaining.toLocaleString()} KM
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onVehicleClick(v);
                                  }}
                                  className="text-[8px] font-black text-brand-accent hover:underline uppercase tracking-widest flex items-center gap-1.5"
                                >
                                  Cadastrar Limite <ChevronRight size={10} />
                                </button>
                              )}
                            </div>

                            {/* Secondary Quick Alers e.g. Oil change */}
                            {oilRemaining !== null && (
                              <div className="text-right">
                                <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 block">Troca de Óleo</span>
                                <span className={cn(
                                  "text-[10px] font-black tabular-nums tracking-tight mt-0.5 block",
                                  oilRemaining <= 0 ? "text-red-400 animate-pulse" : oilRemaining <= alertOilKm ? "text-yellow-400" : "text-zinc-400"
                                )}>
                                  {oilRemaining <= 0 ? "Excedida!" : `${oilRemaining.toLocaleString()} KM`}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Quick single-vehicle action bar */}
                          <div className="mt-4 pt-3 border-t border-zinc-800/40 flex items-center justify-between gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditAlertClick(v);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              title="Editar Alerta"
                            >
                              <Edit size={10} className="text-yellow-500" />
                              <span>Editar</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteAlert(v.id);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-red-400 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              title="Excluir Alerta"
                            >
                              <Trash2 size={10} className="text-red-500" />
                              <span>Excluir</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintSingleDossier(v);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-brand-accent rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              title="Imprimir Dossiê do Veículo"
                            >
                              <Printer size={10} className="text-brand-accent" />
                              <span>Dossiê</span>
                            </button>

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrintVerificationChecklist(v);
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 hover:border-zinc-700 text-zinc-400 hover:text-emerald-400 rounded-lg text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                              title="Imprimir Ficha de Verificação Manual do Veículo"
                            >
                              <ClipboardCheck size={10} className="text-emerald-500" />
                              <span>Ficha</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {activeTab === 'vencimentos' && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-500">
            <FinanceDocumentVencimentos 
              vehicles={vehicles}
              isFleetToolMode={true}
              hideHeader={true}
            />
          </div>
        )}

        {activeTab === 'drivers' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="flex gap-2">
                <button
                  onClick={() => setDriverCategory('fixo')}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    driverCategory === 'fixo' ? "bg-brand-accent text-zinc-950 shadow-lg" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  FIXOS
                </button>
                <button
                  onClick={() => setDriverCategory('diarista')}
                  className={cn(
                    "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all",
                    driverCategory === 'diarista' ? "bg-brand-accent text-zinc-950 shadow-lg" : "bg-zinc-900 text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  DIARISTAS
                </button>
             </div>
             {driverCategory === 'fixo' ? (
               <div className="space-y-4">
                 <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div>
                     <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Motoristas Fixos</h4>
                     <p className="text-[10px] font-bold text-zinc-550 uppercase">Gestão direta de funcionários contratados da frota.</p>
                   </div>
                   {onAddEmployee && (
                     <button
                       onClick={() => onAddEmployee({ role: 'Motorista' })}
                       className="flex items-center gap-2 px-4 py-2 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-brand-accent/5 self-start sm:self-auto"
                     >
                       <Plus size={12} />
                       Adicionar Motorista Fixo
                     </button>
                   )}
                 </div>
                 <FixedDriversList 
                   employees={employees} 
                   onEditEmployee={onEditEmployee} 
                   onDeleteEmployee={onDeleteEmployee} 
                 />
               </div>
             ) : (
               <DiaristasManager />
             )}
          </div>
        )}

        {activeTab === 'maintenance' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Sub-tabs switcher */}
            <div className="flex bg-zinc-950/60 p-1.5 rounded-2xl border border-zinc-850 w-fit gap-1.5">
              <button
                type="button"
                onClick={() => setMaintenanceSubTab('dashboard')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
                  maintenanceSubTab === 'dashboard' 
                    ? "bg-zinc-800 text-brand-accent border border-zinc-750 shadow-lg font-black" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <TrendingUp size={13} />
                Painel Geral (Oficina)
              </button>
              <button
                type="button"
                onClick={() => setMaintenanceSubTab('prontuario')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
                  maintenanceSubTab === 'prontuario' 
                    ? "bg-zinc-800 text-brand-accent border border-zinc-750 shadow-lg font-black" 
                    : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <Wrench size={13} />
                Prontuário Individual & Galeria
              </button>
            </div>

            {maintenanceSubTab === 'dashboard' ? (
              <div className="space-y-12 animate-in fade-in duration-300">
                <div className="flex justify-between items-center bg-zinc-900/30 p-6 rounded-3xl border border-zinc-800/50">
               <div className="flex items-center gap-4">
                 <div className="p-3 bg-brand-accent/10 rounded-xl text-brand-accent">
                   <TrendingUp size={20} />
                 </div>
                 <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-widest leading-none">Dashboard Oficina</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mt-2">Visão consolidada de produtividade e custos.</p>
                 </div>
               </div>
               <div className="flex flex-wrap gap-4">
                  <div className="relative group/print">
                    <button 
                      className="flex items-center gap-4 px-6 py-4 bg-zinc-800 text-zinc-400 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-zinc-700"
                      title="Imprimir Relatórios"
                    >
                      <Printer size={16} className="stroke-[3]" />
                      Imprimir
                    </button>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl invisible group-hover/print:visible opacity-0 group-hover/print:opacity-100 transition-all z-50 p-2">
                       <button 
                         onClick={() => onPrintBatchOS?.('week')}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-colors"
                       >
                         <Calendar size={14} className="text-emerald-500" />
                         OS da Semana
                       </button>
                       <button 
                         onClick={() => onPrintBatchOS?.('month')}
                         className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800 rounded-xl text-[10px] font-black text-white uppercase tracking-widest transition-colors"
                       >
                         <Zap size={14} className="text-brand-accent" />
                         OS do Mês
                       </button>
                    </div>
                  </div>

                  <button 
                    onClick={() => handleAutoGenerateOS('week')}
                    disabled={isGenerating}
                    className="flex items-center gap-4 px-6 py-4 bg-zinc-800 text-emerald-500 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-emerald-500/10 disabled:opacity-50"
                    title="Gera OS para manutenções da semana ou próximas de 1500km"
                  >
                    <Calendar size={16} className={cn("stroke-[3]", isGenerating && "animate-pulse")} />
                    O.S. Semana
                  </button>
                  <button 
                    onClick={() => handleAutoGenerateOS('month')}
                    disabled={isGenerating}
                    className="flex items-center gap-4 px-6 py-4 bg-zinc-800 text-brand-accent rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-brand-accent/10 disabled:opacity-50"
                    title="Gera OS para manutenções próximas de 1000km ou 30 dias"
                  >
                    <Zap size={16} className={cn("stroke-[3]", isGenerating && "animate-pulse")} />
                    O.S. Mês
                  </button>
                  <button 
                    onClick={onAddMaintenance}
                    className="flex items-center gap-4 px-8 py-4 bg-brand-accent text-zinc-950 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:scale-[1.02]"
                  >
                    <Plus size={16} className="stroke-[3]" />
                    Nova O.S.
                  </button>
               </div>
            </div>

            {/* Re-implementing the Maintenance Stats from App.tsx */}
            {isAdministrative && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard 
                  title="Ordens Pendentes" 
                  value={pendingOrdersCount} 
                  icon={Wrench}
                  color="amber"
                  onClick={() => setIsPendingOrdersModalOpen(true)}
                />
                <StatCard 
                  title="Alertas de Manutenção" 
                  value={maintenanceAlertsCount} 
                  icon={AlertTriangle}
                  color="rose"
                  onClick={() => setIsMaintAlertsModalOpen(true)}
                />
                <Card className="bg-zinc-900 border-zinc-800 p-8 flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase text-zinc-600 tracking-widest mb-1">Custo Oficina (Mês)</p>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                      R$ {monthlyMaintenanceCost.toLocaleString()}
                    </p>
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-zinc-500">
                      <Hash size={20} />
                    </div>
                  </div>
                </Card>
                <Card className="bg-zinc-950 border-emerald-500/20 p-8 flex flex-col justify-between">
                  <p className="text-[10px] font-black uppercase text-emerald-500/60 tracking-widest mb-1">Disponibilidade Frota</p>
                  <div className="flex items-end justify-between">
                    <p className="text-3xl font-black text-emerald-500 tabular-nums tracking-tighter">
                      {fleetAvailability}%
                    </p>
                    <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                      <Bus size={20} />
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* Alertas Proativos de Manutenção */}
            <div className="space-y-6">
              <FleetAlerts 
                vehicles={vehicles}
                onVehicleClick={onVehicleClick}
                filter="maintenance"
              />
            </div>

            {/* Maintenance Chart */}
            {isAdministrative && (
              <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl space-y-8">
                 <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em]">Comparativo Mensal</h3>
                    <div className="flex gap-6">
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-brand-accent"></div><span className="text-[9px] font-black text-zinc-600 uppercase">Preventiva</span></div>
                      <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-zinc-600"></div><span className="text-[9px] font-black text-zinc-600 uppercase">Corretiva</span></div>
                    </div>
                 </div>
                 <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={maintenanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="month" stroke="#4b5563" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#4b5563" fontSize={10} fontWeight="800" axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
                        <RechartsTooltip 
                          cursor={{ fill: 'rgba(26, 80, 241, 0.05)' }}
                          contentStyle={{ backgroundColor: '#09090b', border: '1px solid #1f2937', borderRadius: '16px', fontSize: '10px', color: '#fff', fontWeight: '900' }}
                          itemStyle={{ color: '#1a50f1' }}
                        />
                        <Bar dataKey="preventive" fill="#1a50f1" radius={[4, 4, 0, 0]} barSize={24} />
                        <Bar dataKey="corrective" fill="#3f3f46" radius={[4, 4, 0, 0]} barSize={24} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>
              </div>
            )}

            {/* Maintenance History Table */}
            <div className="space-y-6">
               <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
                  <h3 className="text-xs font-black text-zinc-400 uppercase tracking-[0.3em] flex items-center gap-2">
                    <FileText size={16} className="text-zinc-600" /> Histórico de O.S. (Últimos 30 dias)
                  </h3>
               </div>
               <div className="bg-zinc-900/30 rounded-[2rem] border border-zinc-900 overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="border-b border-zinc-900 bg-zinc-950/50">
                        <th className="p-6 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Data / Status</th>
                        <th className="p-6 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Veículo / KM</th>
                        <th className="p-6 text-[9px] font-black text-zinc-500 uppercase tracking-widest">Serviço Realizado</th>
                        <th className="p-6 text-[9px] font-black text-zinc-500 uppercase tracking-widest text-right">Custo / O.S.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900">
                      {maintenance
                        .sort((a, b) => new Date(b.completedAt || b.createdAt).getTime() - new Date(a.completedAt || a.createdAt).getTime())
                        .slice(0, 15)
                        .map(log => {
                          const vehicle = vehicles.find(v => v.id === log.vehicleId);
                          return (
                            <tr key={log.id} className="group hover:bg-zinc-900/60 transition-all">
                              <td className="p-6">
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-black text-zinc-100 tabular-nums">
                                    {log.completedAt ? format(parseISO(log.completedAt), 'dd/MM/yyyy') : format(parseISO(log.createdAt), 'dd/MM/yyyy')}
                                  </p>
                                  <span className={cn(
                                    "text-[7px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest w-fit border",
                                    log.status === 'pending' ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                  )}>
                                    {log.status === 'pending' ? 'EM ABERTO' : 'CONCLUÍDA'}
                                  </span>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="flex flex-col gap-2">
                                  <p className="text-xs font-black text-white uppercase group-hover:text-brand-accent transition-colors">{vehicle?.plate || '---'}</p>
                                  <p className="text-[10px] text-zinc-600 font-bold tabular-nums uppercase">{log.odometer?.toLocaleString() || '---'} KM</p>
                                </div>
                              </td>
                              <td className="p-6">
                                <div className="max-w-[250px]">
                                  <p className="text-xs font-black text-zinc-300 uppercase leading-tight mb-1 truncate">{log.description}</p>
                                  <p className="text-[9px] text-zinc-600 font-medium line-clamp-1 italic">{vehicle?.model || 'Desconhecido'}</p>
                                </div>
                              </td>
                              <td className="p-6 text-right">
                                <div className="flex items-center justify-end gap-3">
                                  <div className="text-right">
                                    <p className="text-sm font-black text-white tabular-nums tracking-tighter">R$ {log.cost.toLocaleString()}</p>
                                    <p className="text-[8px] text-zinc-600 font-black uppercase mt-1">Total Pago</p>
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5">
                                    {log.attachments && log.attachments.length > 0 && (
                                      <button 
                                        onClick={() => onOpenMaintenanceAttachments?.(log)}
                                        className="w-10 h-10 bg-emerald-500/10 hover:bg-emerald-500 hover:text-asphalt-950 text-emerald-500 rounded-xl transition-all flex items-center justify-center border border-emerald-500/20 relative group"
                                        title="Ver Anexos"
                                      >
                                        <Paperclip size={16} />
                                        <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-asphalt-950 text-[8px] font-black rounded-full flex items-center justify-center border-2 border-asphalt-900">
                                          {log.attachments.length}
                                        </span>
                                      </button>
                                    )}
                                    <button 
                                      onClick={() => onPrintOS(log)}
                                      className="w-10 h-10 bg-zinc-800 hover:bg-white hover:text-zinc-950 text-zinc-500 rounded-xl transition-all flex items-center justify-center border border-zinc-700"
                                      title="Imprimir O.S."
                                    >
                                      <Printer size={16} />
                                    </button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      {maintenance.length === 0 && (
                        <tr>
                          <td colSpan={4} className="p-20 text-center">
                            <Wrench size={40} className="text-zinc-800 mx-auto mb-6 opacity-20" />
                            <p className="text-xs font-black text-zinc-800 uppercase tracking-[0.4em]">Nenhum histórico disponível</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
               </div>
              </div>
            </div>
          ) : (
            <div className="animate-in fade-in duration-300">
              <VehicleMaintenanceHistory />
            </div>
          )}
        </div>
      )}

      {activeTab === 'tires' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
             <div>
               <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Status e Dossiê de Pneus</h4>
               <p className="text-[10px] font-bold text-zinc-550 uppercase">Monitoramento ativo de sulcos, marcas e alocação de pneus em tempo real.</p>
             </div>
           </div>
           <TiresStatusList tireDossiers={tireDossiers} vehicles={vehicles} />
        </div>
      )}

      {activeTab === 'sold' && (() => {
        const soldVehicles = (vehicles || []).filter(v => v.status === 'sold');
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
              <div>
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider">Histórico de Ativos Vendidos ({soldVehicles.length})</h4>
                <p className="text-[10px] font-bold text-zinc-500 uppercase">Registro e dossiê permanente de veículos que foram desmobilizados ou alienados pela frota.</p>
              </div>
            </div>

            {soldVehicles.length === 0 ? (
              <div className="p-12 text-center bg-zinc-900/50 rounded-3xl border border-zinc-850 space-y-3">
                <Bus size={36} className="text-zinc-600 mx-auto" />
                <p className="text-xs font-black uppercase tracking-wider text-zinc-500">Nenhum veículo vendido registrado no histórico</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {soldVehicles.map(v => (
                  <div key={v.id} className="bg-zinc-900/80 border border-zinc-850 hover:border-zinc-800 rounded-2xl p-5 flex flex-col justify-between space-y-4 shadow-lg hover:shadow-xl transition-all relative overflow-hidden group">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {v.photoUrl ? (
                          <img src={v.photoUrl} alt={v.plate} className="w-12 h-9 object-cover rounded-md border border-zinc-800 shrink-0" />
                        ) : (
                          <div className="w-12 h-9 bg-zinc-950 border border-zinc-850 rounded-md flex items-center justify-center shrink-0">
                            <Bus size={14} className="text-zinc-600" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{v.plate}</h4>
                            {v.prefix && (
                              <span className="text-[8px] font-black px-1.5 py-0.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent rounded uppercase">
                                F#{v.prefix}
                              </span>
                            )}
                          </div>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase truncate max-w-[120px]">{v.model}</p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/25 rounded-lg text-[8px] font-black uppercase tracking-wider">
                        Vendido
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[10px] font-bold text-zinc-400 uppercase">
                      <div>
                        <p className="text-[8px] text-zinc-500 mb-0.5 leading-none">Capacidade</p>
                        <p className="text-zinc-200 font-extrabold">{v.capacity || '--'} Pas.</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-zinc-500 mb-0.5 leading-none">Odômetro Final</p>
                        <p className="text-zinc-200 font-extrabold">{v.currentOdometer?.toLocaleString() || '0'} KM</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-zinc-500 mb-0.5 leading-none">Tipo</p>
                        <p className="text-zinc-200 font-extrabold truncate">{v.type === 'bus' ? 'ÔNIBUS' : v.type === 'microbus' ? 'MICRO' : 'VAN'}</p>
                      </div>
                      <div>
                        <p className="text-[8px] text-zinc-500 mb-0.5 leading-none">Ano Fab.</p>
                        <p className="text-zinc-200 font-extrabold">{v.factoryYear || '---'}</p>
                      </div>
                    </div>

                    <div className="flex justify-between items-center gap-2 border-t border-zinc-850/30 pt-3">
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm(`Deseja realmente reativar o veículo ${v.plate} na frota ativa?`)) {
                            try {
                              const { doc, updateDoc } = await import('firebase/firestore');
                              await updateDoc(doc(db, 'vehicles', v.id), cleanUndefined({
                                status: 'available',
                                updatedAt: new Date().toISOString()
                              }));
                              toast.success(`Veículo ${v.plate} reativado com sucesso!`);
                            } catch (err) {
                              toast.error('Erro ao reativar veículo.');
                            }
                          }
                        }}
                        className="px-3 py-2 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Reativar Ativo
                      </button>
                      <button
                        type="button"
                        onClick={() => onVehicleClick(v)}
                        className="px-3 py-2 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                      >
                        Ficha Técnica
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

        {/* Modal 1: Ordens de Serviço Pendentes */}
        <AnimatePresence>
          {isPendingOrdersModalOpen && (() => {
            const pendingOrders = maintenance.filter(m => m.status === 'pending');
            const filteredPendingOrders = pendingOrders.filter(m => {
              const v = vehicles.find(veh => veh.id === m.vehicleId);
              const search = pendingSearchTerm.toLowerCase();
              return (
                (v?.plate || '').toLowerCase().includes(search) ||
                (v?.model || '').toLowerCase().includes(search) ||
                (m.description || '').toLowerCase().includes(search)
              );
            });



            const handleExportAllPendingOS_TXT = () => {
              const textContent = formatPendingOS_TXT(filteredPendingOrders, vehicles);
              downloadTxtFile(`RELATORIO_OS_PENDENTES_${format(new Date(), 'yyyy-MM-dd')}.txt`, textContent);
              toast.success("Histórico de O.S. Pendentes baixado em TXT!");
            };

            const handleExportAllPendingOS_PDF = async () => {
              try {
                const jsPDF = (await import('jspdf')).default;
                const autoTable = (await import('jspdf-autotable')).default;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm');

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(22);
                pdf.setTextColor(255, 107, 0); // brand-accent
                pdf.text("DM TURISMO", 15, 20);

                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(120, 120, 120);
                pdf.text(`RELATÓRIO DE ORDENS DE SERVIÇO PENDENTES - GERAÇÃO EM ${todayStr}`, 15, 26);

                pdf.setDrawColor(240, 240, 240);
                pdf.line(15, 30, 195, 30);

                const tableBody = filteredPendingOrders.map(log => {
                  const vehicle = vehicles.find(v => v.id === log.vehicleId);
                  return [
                    log.id?.substring(0, 8).toUpperCase() || 'NEW',
                    vehicle ? `${vehicle.plate} (${vehicle.model})` : '---',
                    log.scheduledDate ? format(parseISO(log.scheduledDate), 'dd/MM/yyyy') : '---',
                    log.description || '---',
                    `R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                  ];
                });

                autoTable(pdf, {
                  startY: 35,
                  head: [['CÓDIGO', 'VEÍCULO', 'DATA PREVISTA', 'SERVIÇO / PROBLEMA', 'CUSTO EST.']],
                  body: tableBody,
                  theme: 'grid',
                  headStyles: { fillColor: [255, 107, 0], textColor: [15, 15, 15], fontStyle: 'bold' },
                  styles: { fontSize: 9 },
                  columnStyles: {
                    3: { cellWidth: 70 }
                  }
                });

                pdf.save(`RELATORIO_OS_PENDENTES_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
                toast.success("Relatório PDF de Ordens Pendentes exportado!");
              } catch (err) {
                console.error(err);
                toast.error("Erro ao gerar PDF.");
              }
            };

            const handlePrintAllOS = async () => {
              try {
                const jsPDF = (await import('jspdf')).default;
                const pdf = new jsPDF('p', 'mm', 'a4');
                
                filteredPendingOrders.forEach((log, index) => {
                  if (index > 0) pdf.addPage();
                  
                  const vehicle = vehicles.find(v => v.id === log.vehicleId);
                  const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm');
                  
                  // Header
                  pdf.setFont("helvetica", "bold");
                  pdf.setFontSize(22);
                  pdf.setTextColor(255, 107, 0); 
                  pdf.text("DM TURISMO", 15, 20);
                  
                  pdf.setFontSize(14);
                  pdf.setTextColor(0, 0, 0);
                  pdf.text("ORDEM DE SERVIÇO DE MANUTENÇÃO", 15, 30);
                  
                  pdf.setFontSize(10);
                  pdf.setFont("helvetica", "normal");
                  pdf.setTextColor(100, 100, 100);
                  pdf.text(`EMITIDO EM: ${todayStr}`, 15, 36);
                  pdf.text(`CÓDIGO O.S: ${log.id?.toUpperCase() || 'NOVA'}`, 150, 36);
                  
                  pdf.setDrawColor(200, 200, 200);
                  pdf.line(15, 40, 195, 40);
                  
                  // Vehicle Info
                  pdf.setFontSize(12);
                  pdf.setTextColor(0, 0, 0);
                  pdf.setFont("helvetica", "bold");
                  pdf.text("DADOS DO VEÍCULO", 15, 50);
                  
                  pdf.setFontSize(10);
                  pdf.setFont("helvetica", "normal");
                  pdf.text(`PLACA: ${vehicle?.plate || '---'}`, 15, 58);
                  pdf.text(`MODELO: ${vehicle?.model || '---'}`, 15, 64);
                  pdf.text(`PREFIXO: ${vehicle?.prefix || '---'}`, 15, 70);
                  pdf.text(`ODÔMETRO ATUAL: ${vehicle?.currentOdometer?.toLocaleString() || '---'} KM`, 15, 76);
                  
                  // Service Info
                  pdf.setFont("helvetica", "bold");
                  pdf.text("DESCRIÇÃO DO SERVIÇO / RECLAMAÇÃO", 15, 90);
                  pdf.setFont("helvetica", "normal");
                  pdf.setDrawColor(230, 230, 230);
                  pdf.rect(15, 94, 180, 40);
                  pdf.text(log.description || 'Nenhuma descrição informada.', 18, 100, { maxWidth: 174 });
                  
                  // Completion Fields (Requested by user)
                  pdf.setFont("helvetica", "bold");
                  pdf.text("CAMPOS DE EXECUÇÃO (PARA O MECÂNICO)", 15, 145);
                  
                  pdf.setFont("helvetica", "normal");
                  pdf.text("DATA DE REALIZAÇÃO: ____/____/202__", 15, 155);
                  pdf.text("KM REALIZADO: ____________________ KM", 15, 165);
                  pdf.text("QUEM REALIZOU O SERVIÇO: ________________________________________", 15, 175);
                  pdf.text("NOVA VALIDADE / PRÓXIMA MANUTENÇÃO: ______________________________", 15, 185);
                  
                  pdf.text("OBSERVAÇÕES ADICIONAIS:", 15, 200);
                  pdf.rect(15, 204, 180, 40);
                  
                  // Signatures
                  pdf.setFontSize(9);
                  pdf.line(20, 270, 90, 270);
                  pdf.text("ASSINATURA MECÂNICO", 55, 275, { align: 'center' });
                  
                  pdf.line(120, 270, 190, 270);
                  pdf.text("ASSINATURA GESTOR", 155, 275, { align: 'center' });
                });
                
                pdf.save(`TODAS_ORDENS_SERVICO_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
                toast.success("Todas as Ordens de Serviço foram geradas para impressão!");
              } catch (err) {
                console.error(err);
                toast.error("Erro ao gerar PDF das Ordens.");
              }
            };

            return (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-zinc-900 border border-brand-accent/20 w-full max-w-4xl h-[85vh] sm:h-[75vh] rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden text-left"
                >
                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setIsPendingOrdersModalOpen(false);
                      setPendingSearchTerm('');
                    }}
                    className="absolute top-6 right-6 p-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer z-10 animate-none border border-white/5"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Modal Header */}
                  <div className="p-6 sm:p-8 border-b border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center text-amber-500">
                        <Wrench className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">Gestão Operacional</span>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans">Ordens de Serviço Pendentes</h3>
                      </div>
                    </div>

                    {/* Search Bar / Action Controls */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <div className="flex-1 relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Buscar por placa, modelo ou serviço..."
                          value={pendingSearchTerm}
                          onChange={(e) => setPendingSearchTerm(e.target.value)}
                          className="w-full h-11 bg-zinc-950 border border-white/5 rounded-2xl pl-10 pr-4 text-xs font-semibold text-zinc-300 outline-none focus:border-brand-accent transition-colors placeholder-zinc-650"
                        />
                        {pendingSearchTerm && (
                          <button 
                            onClick={() => setPendingSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest cursor-pointer px-1"
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={handlePrintAllOS}
                          disabled={filteredPendingOrders.length === 0}
                          className="h-11 px-6 bg-brand-accent text-zinc-950 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none shadow-lg shadow-brand-accent/20"
                        >
                          <Printer className="w-4 h-4 stroke-[2.5]" />
                          Todas O.S
                        </button>
                        <button
                          onClick={handleExportAllPendingOS_PDF}
                          disabled={filteredPendingOrders.length === 0}
                          className="h-11 px-4 bg-zinc-950 border border-white/5 text-brand-accent rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-brand-accent/10 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <FileDown className="w-4 h-4 stroke-[2.5]" />
                          Lista PDF
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                    {filteredPendingOrders.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center text-zinc-500">
                          <Wrench className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-wider">Nenhum chamado pendente</p>
                          <p className="text-[10px] font-medium text-zinc-500">
                            {pendingSearchTerm 
                              ? `Nenhuma correspondência para "${pendingSearchTerm}"`
                              : 'Não existem ordens de manutenção marcadas como Em Aberto.'
                            }
                          </p>
                        </div>
                      </div>
                    ) : (
                      filteredPendingOrders.map((log) => {
                        const veh = vehicles.find(v => v.id === log.vehicleId);
                        return (
                          <div 
                            key={log.id}
                            className="p-5 bg-zinc-950/40 border border-white/5 hover:border-brand-accent/15 rounded-[1.8rem] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-2 flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                                <span className="text-[9px] font-black px-2 py-0.5 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full uppercase tracking-widest">
                                  {log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}
                                </span>
                                <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">{veh?.plate || '---'} • {veh?.model || 'Desconhecido'}</h4>
                              </div>
                              <p className="text-xs text-zinc-300 font-medium leading-relaxed italic pr-4">" {log.description} "</p>
                              <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-550 flex-wrap">
                                <span>Agendado para: <strong className="text-zinc-400 font-bold">{log.scheduledDate ? format(parseISO(log.scheduledDate), 'dd/MM/yyyy') : '---'}</strong></span>
                                <span>Odômetro: <strong className="text-zinc-400 font-bold">{log.odometer?.toLocaleString() || '---'} KM</strong></span>
                              </div>
                            </div>

                            {/* Controls per item */}
                            <div className="flex flex-col items-end gap-2 shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                              <span className="text-base font-black text-white font-mono tracking-tighter">R$ {log.cost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                              <div className="flex gap-2 mt-1">
                                <button
                                  onClick={() => handleDeleteOS(log.id)}
                                  className="h-9 w-9 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all flex items-center justify-center cursor-pointer"
                                  title="Excluir Ordem de Serviço"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleExportIndividualOS_TXT(log)}
                                  className="h-9 px-3 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer"
                                  title="Baixar Ordem de Serviço em TXT"
                                >
                                  <Download className="w-3 h-3" />
                                  TXT
                                </button>
                                <button
                                  onClick={() => {
                                    setIsPendingOrdersModalOpen(false);
                                    onPrintOS(log);
                                  }}
                                  className="h-9 px-4 bg-zinc-800 hover:bg-white hover:text-zinc-950 text-zinc-300 border border-white/5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  Imprimir
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 bg-zinc-950/45 border-t border-white/5 flex items-center justify-between shrink-0">
                    <span className="text-[9px] font-black text-zinc-555 uppercase tracking-widest font-mono">
                      DM Turismo • {filteredPendingOrders.length} ordens pendentes filtradas
                    </span>
                    <button
                      onClick={() => {
                        setIsPendingOrdersModalOpen(false);
                        setPendingSearchTerm('');
                      }}
                      className="h-10 px-5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer font-sans"
                    >
                      Fechar Painel
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>

        {/* Modal 2: Alertas de Manutenção */}
        <AnimatePresence>
          {isMaintAlertsModalOpen && (() => {
            const alertVehicles = vehicles.filter(v => 
              (v.nextOilChangeKM && v.nextOilChangeKM - v.currentOdometer <= alertOilKm) || 
              (v.nextMaintenanceKM && v.nextMaintenanceKM - v.currentOdometer <= alertMaintKm) ||
              (v.nextPreventiveMaintenanceDate && differenceInDays(parseISO(v.nextPreventiveMaintenanceDate), new Date()) <= alertMaintDays)
            );
            const filteredAlertVehicles = alertVehicles.filter(v => {
              const search = alertsSearchTerm.toLowerCase();
              return (
                (v.plate || '').toLowerCase().includes(search) ||
                (v.model || '').toLowerCase().includes(search) ||
                (v.model || '').toLowerCase().includes(search)
              );
            });

            const handleExportAllAlerts_TXT = () => {
              const textContent = formatAlerts_TXT(filteredAlertVehicles);
              downloadTxtFile(`RELATORIO_ALERTAS_FROTA_${format(new Date(), 'yyyy-MM-dd')}.txt`, textContent);
              toast.success("Histórico de Alertas de Frota baixado em TXT!");
            };

            const handleExportAllAlerts_PDF = async () => {
              try {
                const jsPDF = (await import('jspdf')).default;
                const autoTable = (await import('jspdf-autotable')).default;
                const pdf = new jsPDF('p', 'mm', 'a4');
                const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm');

                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(22);
                pdf.setTextColor(244, 63, 94); // Rose 500
                pdf.text("DM TURISMO", 15, 20);

                pdf.setFontSize(10);
                pdf.setFont("helvetica", "normal");
                pdf.setTextColor(120, 120, 120);
                pdf.text(`RELATÓRIO CRÍTICO DE ALERTAS DA FROTA - GERAÇÃO EM ${todayStr}`, 15, 26);

                pdf.setDrawColor(240, 240, 240);
                pdf.line(15, 30, 195, 30);

                const tableBody = filteredAlertVehicles.map(v => {
                  const alerts = [];
                  if (v.nextOilChangeKM) {
                    const diff = v.nextOilChangeKM - v.currentOdometer;
                    if (diff <= alertOilKm) alerts.push(`Óleo: prx. em ${v.nextOilChangeKM.toLocaleString()} KM (rest. ${diff.toLocaleString()} KM)`);
                  }
                  if (v.nextMaintenanceKM) {
                    const diff = v.nextMaintenanceKM - v.currentOdometer;
                    if (diff <= alertMaintKm) alerts.push(`Prev KM: prx. em ${v.nextMaintenanceKM.toLocaleString()} KM (rest. ${diff.toLocaleString()} KM)`);
                  }
                  if (v.nextPreventiveMaintenanceDate) {
                    const mDate = parseISO(v.nextPreventiveMaintenanceDate);
                    const days = differenceInDays(mDate, new Date());
                    if (days <= alertMaintDays) alerts.push(`Prev Tempo: ${format(mDate, 'dd/MM/yyyy')} (${days} dias rest.)`);
                  }
                  return [
                    v.plate || '---',
                    v.model || '',
                    `${v.currentOdometer?.toLocaleString() || '0'} KM`,
                    alerts.join('\n') || 'Nenhum alerta crítico'
                  ];
                });

                autoTable(pdf, {
                  startY: 35,
                  head: [['PLACA', 'VEÍCULO', 'ODÔMETRO', 'ALERTAS IDENTIFICADOS']],
                  body: tableBody,
                  theme: 'grid',
                  headStyles: { fillColor: [244, 63, 94], textColor: [255, 255, 255], fontStyle: 'bold' },
                  styles: { fontSize: 9 },
                  columnStyles: {
                    3: { cellWidth: 95 }
                  }
                });

                pdf.save(`RELATORIO_ALERTAS_FROTA_${format(new Date(), 'yyyy_MM_dd')}.pdf`);
                toast.success("Relatório PDF de Alertas de Frota exportado!");
              } catch (err) {
                console.error(err);
                toast.error("Erro ao gerar PDF.");
              }
            };

            return (
              <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 15 }}
                  className="bg-zinc-900 border border-rose-500/20 w-full max-w-4xl h-[85vh] sm:h-[75vh] rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden text-left"
                >
                  {/* Close button */}
                  <button 
                    onClick={() => {
                      setIsMaintAlertsModalOpen(false);
                      setAlertsSearchTerm('');
                    }}
                    className="absolute top-6 right-6 p-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer z-10 animate-none border border-white/5"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Modal Header */}
                  <div className="p-6 sm:p-8 border-b border-white/5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center text-rose-500">
                        <AlertTriangle className="w-6 h-6 animate-pulse" />
                      </div>
                      <div>
                        <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">Prevenção Crítica</span>
                        <h3 className="text-xl font-black text-white uppercase tracking-tight font-sans">Alertas Proativos de Manutenção</h3>
                      </div>
                    </div>

                    {/* Search / Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-2">
                      <div className="flex-1 relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <input
                          type="text"
                          placeholder="Buscar placa, marca ou modelo de veículo..."
                          value={alertsSearchTerm}
                          onChange={(e) => setAlertsSearchTerm(e.target.value)}
                          className="w-full h-11 bg-zinc-950 border border-white/5 rounded-2xl pl-10 pr-4 text-xs font-semibold text-zinc-300 outline-none focus:border-brand-accent transition-colors placeholder-zinc-650"
                        />
                        {alertsSearchTerm && (
                          <button 
                            onClick={() => setAlertsSearchTerm('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-widest cursor-pointer px-1"
                          >
                            Limpar
                          </button>
                        )}
                      </div>

                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={handleExportAllAlerts_PDF}
                          disabled={filteredAlertVehicles.length === 0}
                          className="h-11 px-4 bg-zinc-950 border border-white/5 text-rose-500 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-rose-500/10 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <FileDown className="w-4 h-4 stroke-[2.5]" />
                          Exportar PDF
                        </button>
                        <button
                          onClick={handleExportAllAlerts_TXT}
                          disabled={filteredAlertVehicles.length === 0}
                          className="h-11 px-4 bg-zinc-950 border border-white/5 text-zinc-400 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-white hover:text-zinc-950 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
                        >
                          <Download className="w-4 h-4" />
                          Exportar TXT
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Modal Content */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
                    {filteredAlertVehicles.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
                        <div className="w-12 h-12 bg-emerald-500/5 rounded-full flex items-center justify-center text-emerald-500">
                          <CheckCircle className="w-5 h-5 animate-bounce" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-black text-white uppercase tracking-wider">Nenhum Veículo com Alertas!</p>
                          <p className="text-[10px] font-medium text-zinc-500">Toda a frota ativa está em conformidade com as regras de revisão.</p>
                        </div>
                      </div>
                    ) : (
                      filteredAlertVehicles.map((v) => {
                        const hasOilAlert = v.nextOilChangeKM && v.nextOilChangeKM - v.currentOdometer <= alertOilKm;
                        const hasKmMaintAlert = v.nextMaintenanceKM && v.nextMaintenanceKM - v.currentOdometer <= alertMaintKm;
                        
                        let hasDateMaintAlert = false;
                        let daysToPreventive = 0;
                        if (v.nextPreventiveMaintenanceDate) {
                          const mDate = parseISO(v.nextPreventiveMaintenanceDate);
                          daysToPreventive = differenceInDays(mDate, new Date());
                          if (daysToPreventive <= alertMaintDays) {
                            hasDateMaintAlert = true;
                          }
                        }

                        return (
                          <div 
                            key={v.id}
                            className="p-5 bg-zinc-950/40 border border-white/5 hover:border-rose-500/15 rounded-[1.8rem] transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                          >
                            <div className="space-y-3 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                                <h4 className="text-sm font-black text-white uppercase tracking-tight">{v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate} • {v.model}</h4>
                                <span className="text-[8px] font-black px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded-full uppercase tracking-widest text-zinc-400">
                                  Km Atual: {v.currentOdometer?.toLocaleString() || '0'} KM
                                </span>
                              </div>

                              {/* Warning Details rows */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-1">
                                {hasOilAlert && (
                                  <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-center gap-3">
                                    <span className="text-base">🛢️</span>
                                    <div>
                                      <p className="text-[9px] font-black uppercase text-rose-500 tracking-wider">ÓLEO VENCENDO</p>
                                      <p className="text-[10px] font-semibold text-zinc-400">Prx: {v.nextOilChangeKM?.toLocaleString()} KM ({((v.nextOilChangeKM || 0) - v.currentOdometer).toLocaleString()} KM rest.)</p>
                                    </div>
                                  </div>
                                )}
                                {hasKmMaintAlert && (
                                  <div className="p-3 bg-rose-500/5 rounded-xl border border-rose-500/10 flex items-center gap-3">
                                    <span className="text-base">🔧</span>
                                    <div>
                                      <p className="text-[9px] font-black uppercase text-rose-500 tracking-wider">REVISÃO KM</p>
                                      <p className="text-[10px] font-semibold text-zinc-400">Prx: {v.nextMaintenanceKM?.toLocaleString()} KM ({((v.nextMaintenanceKM || 0) - v.currentOdometer).toLocaleString()} KM rest.)</p>
                                    </div>
                                  </div>
                                )}
                                {hasDateMaintAlert && (
                                  <div className="p-3 bg-amber-500/5 rounded-xl border border-amber-500/10 flex items-center gap-3">
                                    <span className="text-base">📅</span>
                                    <div>
                                      <p className="text-[9px] font-black uppercase text-amber-500 tracking-wider font-sans">REVISÃO DATA</p>
                                      <p className="text-[10px] font-semibold text-zinc-400">Prx: {v.nextPreventiveMaintenanceDate ? format(parseISO(v.nextPreventiveMaintenanceDate), 'dd/MM/yyyy') : '---'} ({daysToPreventive} dias rest.)</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Histórico Técnico e Ordens de Serviço */}
                              {(() => {
                                const vehicleLogs = maintenance.filter(m => m.vehicleId === v.id);
                                if (vehicleLogs.length === 0) return null;
                                return (
                                  <div className="mt-4 border-t border-white/5 pt-3 space-y-2">
                                    <div className="flex items-center gap-1.5 ml-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                      <span className="text-[9px] font-black tracking-wider text-zinc-500 uppercase font-sans">
                                        Ordens de Serviço Relacionadas ({vehicleLogs.length})
                                      </span>
                                    </div>
                                    <div className="max-h-[140px] overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                                      {vehicleLogs.map((log) => (
                                        <div 
                                          key={log.id} 
                                          className="p-3 bg-zinc-950/60 rounded-xl border border-zinc-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                                        >
                                          <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap text-[9px] font-mono">
                                              <span className={cn(
                                                "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                                                log.status === 'completed'
                                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                                  : "bg-amber-500/10 text-amber-500 border border-amber-500/20"
                                              )}>
                                                {log.status === 'completed' ? 'CONCLUÍDA' : 'PENDENTE'}
                                              </span>
                                              <span className="text-zinc-500">
                                                {log.createdAt ? format(parseISO(log.createdAt), 'dd/MM/yyyy') : '---'}
                                              </span>
                                              <span className="text-zinc-600 uppercase">• {log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}</span>
                                            </div>
                                            <p className="text-[11px] font-semibold text-zinc-300 leading-relaxed truncate max-w-sm">
                                              {log.description}
                                            </p>
                                          </div>
                                          <div className="flex gap-2 shrink-0">
                                            <button
                                              onClick={() => handleDeleteOS(log.id)}
                                              className="h-7 w-7 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-500 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                              title="Excluir Ordem de Serviço"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                            <button
                                              onClick={() => handleExportIndividualOS_TXT(log)}
                                              className="h-7 px-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 cursor-pointer"
                                              title="Baixar em TXT"
                                            >
                                              <Download className="w-2.5 h-2.5" />
                                              TXT
                                            </button>
                                            <button
                                              onClick={() => {
                                                setIsMaintAlertsModalOpen(false);
                                                onPrintOS(log);
                                              }}
                                              className="h-7 px-2.5 bg-brand-accent/20 hover:bg-brand-accent hover:text-zinc-950 hover:border-transparent text-brand-accent border border-brand-accent/30 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all flex items-center gap-1 cursor-pointer"
                                              title="Imprimir e-OS / PDF"
                                            >
                                              <Printer className="w-2.5 h-2.5" />
                                              Imprimir / PDF
                                            </button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })()}
                            </div>
                            
                            {/* Quick Interactive Options */}
                            <div className="flex flex-col items-stretch sm:items-end gap-2 shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
                              <button
                                onClick={() => {
                                  setIsMaintAlertsModalOpen(false);
                                  onVehicleClick(v);
                                }}
                                className="h-10 px-5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 hover:text-white text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                Ficha do Veículo
                              </button>
                              <button
                                onClick={() => {
                                  setIsMaintAlertsModalOpen(false);
                                  onAddMaintenance();
                                }}
                                className="h-10 px-5 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-md shadow-brand-accent/5 cursor-pointer"
                              >
                                <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                Abrir O.S.
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Modal Footer */}
                  <div className="p-6 bg-zinc-950/45 border-t border-white/5 flex items-center justify-between shrink-0">
                    <span className="text-[9px] font-black text-zinc-555 uppercase tracking-widest font-mono">
                      DM Turismo • {filteredAlertVehicles.length} veículos sinalizados
                    </span>
                    <button
                      onClick={() => {
                        setIsMaintAlertsModalOpen(false);
                        setAlertsSearchTerm('');
                      }}
                      className="h-10 px-5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer font-sans"
                    >
                      Fechar Painel
                    </button>
                  </div>
                </motion.div>
              </div>
            );
          })()}
        </AnimatePresence>
        {/* Modal Assistente IA de Distribuição */}
        <AnimatePresence>
          {isAIModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsAIModalOpen(false)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-zinc-900 border border-zinc-800/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/25 rounded-xl flex items-center justify-center text-brand-accent">
                      <Bot size={20} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none">Distribuidor Inteligente DM IA</h3>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Leitura cognitiva de fotos, comprovantes e ordens de serviço</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsAIModalOpen(false)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                  {!aiResult && !aiIsLoading ? (
                    <div className="space-y-6">
                      {/* Photo / File Dropzone */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Foto do Comprovante ou Nota Fiscal (Opcional)</label>
                        <div className="border border-dashed border-zinc-800 hover:border-brand-accent/50 bg-zinc-950/40 rounded-xl p-8 text-center transition-all relative overflow-hidden group">
                          {aiFileBlobUrl ? (
                            <div className="space-y-3">
                              <img src={aiFileBlobUrl} alt="Visualização" className="max-h-40 mx-auto rounded-lg border border-zinc-800 object-contain" />
                              <button
                                onClick={() => {
                                  setAiFileBase64(null);
                                  setAiFileMimeType(null);
                                  setAiFileBlobUrl(null);
                                }}
                                className="px-3 py-1 bg-red-500/10 border border-red-500/25 text-red-400 rounded-lg text-[9px] font-black uppercase hover:bg-red-500/20 transition-all cursor-pointer"
                              >
                                Remover Imagem
                              </button>
                            </div>
                          ) : (
                            <label className="flex flex-col items-center justify-center gap-2 cursor-pointer py-4">
                              <Paperclip size={24} className="text-zinc-600 group-hover:text-brand-accent transition-colors" />
                              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest block">Selecionar Foto ou Arquivo</span>
                              <span className="text-[9px] font-bold text-zinc-650 uppercase block">Arraste ou clique para carregar .PNG, .JPG ou .JPEG</span>
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleAIFileChange}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>

                      {/* Text prompt */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block">Comando de Texto ou Instrução</label>
                        <textarea
                          rows={4}
                          value={aiInputText}
                          onChange={(e) => setAiInputText(e.target.value)}
                          placeholder="Exemplo: 'Identifique os dados deste comprovante de troca de óleo para a placa ABC-1234, no valor de R$ 350,00 feito na Bosch, com odômetro de 85000 KM.'"
                          className="w-full bg-zinc-950 border border-zinc-850 p-4 rounded-xl text-xs font-bold text-white placeholder:text-zinc-700 outline-none focus:border-brand-accent resize-none"
                        />
                        <p className="text-[9px] font-bold text-zinc-650 uppercase">Você pode enviar apenas texto, apenas imagem, ou ambos combinados para processamento da inteligência artificial.</p>
                      </div>
                    </div>
                  ) : aiIsLoading ? (
                    <div className="py-16 text-center space-y-4">
                      <div className="relative w-16 h-16 mx-auto">
                        <div className="absolute inset-0 border-4 border-brand-accent/20 rounded-full" />
                        <div className="absolute inset-0 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
                        <Bot size={24} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-brand-accent animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-white tracking-widest animate-pulse">Processando com Inteligência Artificial...</p>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase">Mapeando entidades, placas, valores e odômetro</p>
                      </div>
                    </div>
                  ) : (
                    // Results Confirmation Screen
                    <div className="space-y-6">
                      <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl flex items-center gap-3">
                        <div className="w-8 h-8 bg-emerald-500/10 border border-emerald-500/25 rounded-lg flex items-center justify-center text-emerald-400">
                          <CheckCircle size={16} />
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-white tracking-widest leading-none">Análise Concluída com Sucesso!</p>
                          <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Confirme os dados extraídos abaixo antes de aplicar à frota</p>
                        </div>
                      </div>

                      {aiResult.actionType === 'maintenance' ? (
                        <div className="space-y-4 bg-zinc-950/40 p-5 border border-zinc-850 rounded-xl">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                            <span className="text-[10px] font-black uppercase text-brand-accent tracking-widest">Nova Manutenção Identificada</span>
                            <span className="px-2 py-0.5 bg-brand-accent/10 text-brand-accent text-[8px] font-black uppercase tracking-wider rounded-md">Manutenção</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-550 font-black uppercase tracking-wider block">Veículo Identificado</span>
                              <select
                                value={aiVehicleId}
                                onChange={(e) => setAiVehicleId(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              >
                                <option value="">Selecione...</option>
                                {vehicles.map(v => (
                                  <option key={v.id} value={v.id}>{v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate} - {v.model}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Data</span>
                              <input
                                type="date"
                                value={aiMaintenanceForm.completedAt}
                                onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, completedAt: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Tipo</span>
                              <select
                                value={aiMaintenanceForm.type}
                                onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, type: e.target.value as any }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              >
                                <option value="preventive">Preventiva</option>
                                <option value="corrective">Corretiva</option>
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Valor Total (R$)</span>
                              <input
                                type="number"
                                value={aiMaintenanceForm.cost}
                                onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, cost: Number(e.target.value) }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Odômetro (KM)</span>
                              <input
                                type="number"
                                value={aiMaintenanceForm.odometer}
                                onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, odometer: Number(e.target.value) }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              />
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Oficina / Fornecedor</span>
                              <input
                                type="text"
                                value={aiMaintenanceForm.provider || ''}
                                onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, provider: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 pt-2">
                            <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Peças Trocadas</span>
                            <input
                              type="text"
                              value={aiMaintenanceForm.partsReplaced || ''}
                              onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, partsReplaced: e.target.value }))}
                              className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Descrição Detalhada</span>
                            <textarea
                              rows={2}
                              value={aiMaintenanceForm.description || ''}
                              onChange={(e) => setAiMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
                              className="w-full bg-zinc-900 border border-zinc-800 p-3 rounded-lg text-xs font-bold text-white outline-none resize-none"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 bg-zinc-950/40 p-5 border border-zinc-850 rounded-xl">
                          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                            <span className="text-[10px] font-black uppercase text-yellow-500 tracking-widest">Alerta / Prazo Identificado</span>
                            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-500 text-[8px] font-black uppercase tracking-wider rounded-md">Alerta</span>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Veículo Identificado</span>
                              <select
                                value={aiVehicleId}
                                onChange={(e) => setAiVehicleId(e.target.value)}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              >
                                <option value="">Selecione...</option>
                                {vehicles.map(v => (
                                  <option key={v.id} value={v.id}>{v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate} - {v.model}</option>
                                ))}
                              </select>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">Tipo de Alerta</span>
                              <select
                                value={aiAlertForm.alertType}
                                onChange={(e) => setAiAlertForm(prev => ({ ...prev, alertType: e.target.value as any }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              >
                                <option value="preventive_maintenance">Manutenção Preventiva (KM)</option>
                                <option value="oil_change">Troca de Óleo (KM)</option>
                                <option value="document_expiration">Vencimento de Prazo (Data)</option>
                              </select>
                            </div>

                            <div className="col-span-2 space-y-1">
                              <span className="text-[8px] text-zinc-555 font-black uppercase tracking-wider block">
                                {aiAlertForm.alertType === 'document_expiration' ? 'Prazo Final (Data)' : 'Valor Limite do Alerta (KM)'}
                              </span>
                              <input
                                type={aiAlertForm.alertType === 'document_expiration' ? 'date' : 'number'}
                                value={aiAlertForm.targetValue}
                                onChange={(e) => setAiAlertForm(prev => ({ ...prev, targetValue: e.target.value }))}
                                className="w-full bg-zinc-900 border border-zinc-800 px-3 py-2 rounded-lg text-xs font-bold text-white outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-zinc-950/40 border-t border-zinc-800 flex items-center justify-between">
                  <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest font-mono">DM Inteligência Artificial</span>
                  <div className="flex gap-2">
                    {!aiResult ? (
                      <>
                        <button
                          onClick={() => setIsAIModalOpen(false)}
                          className="h-10 px-5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleAIDistributionSubmit}
                          disabled={aiIsLoading || (!aiInputText && !aiFileBase64)}
                          className="h-10 px-6 bg-brand-accent hover:bg-white disabled:bg-zinc-850 disabled:text-zinc-650 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-md shadow-brand-accent/5 flex items-center gap-1.5"
                        >
                          <Sparkles size={12} />
                          Analisar e Distribuir
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setAiResult(null)}
                          className="h-10 px-5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all"
                        >
                          Refazer Leitura
                        </button>
                        <button
                          onClick={handleConfirmAIDistribution}
                          disabled={!aiVehicleId}
                          className="h-10 px-6 bg-brand-accent hover:bg-white disabled:bg-zinc-850 disabled:text-zinc-650 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-md shadow-brand-accent/5 flex items-center gap-1.5"
                        >
                          <CheckCircle size={12} />
                          Confirmar e Gravar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Editar Alerta de Veículo */}
        <AnimatePresence>
          {editingAlertVehicle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setEditingAlertVehicle(null)}
                className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="relative bg-zinc-900 border border-zinc-800/80 rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-2xl"
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-yellow-500/10 border border-yellow-500/25 rounded-xl flex items-center justify-center text-yellow-500 font-black">
                      <Edit size={18} />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-wider leading-none">Ajustar Alertas e Limites</h3>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">Veículo: {editingAlertVehicle.plate} - {editingAlertVehicle.model}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingAlertVehicle(null)}
                    className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Modal Content */}
                <div className="p-6 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider block">Status Operacional do Ativo</label>
                    <select
                      value={editAlertStatus}
                      onChange={(e) => setEditAlertStatus(e.target.value as any)}
                      className="w-full bg-zinc-950 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-accent"
                    >
                      <option value="available">Disponível</option>
                      <option value="maintenance">Em Manutenção</option>
                      <option value="traveling">Em Viagem</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider block">Odômetro de Referência (KM)</label>
                      <input
                        type="number"
                        disabled
                        value={editingAlertVehicle.currentOdometer}
                        className="w-full bg-zinc-955 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-bold text-zinc-500 outline-none cursor-not-allowed"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider block">Próxima Preventiva (KM)</label>
                      <input
                        type="number"
                        value={editAlertNextMaintKM}
                        onChange={(e) => setEditAlertNextMaintKM(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ex: 95000"
                        className="w-full bg-zinc-955 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-accent"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase text-zinc-400 tracking-wider block">Próxima Troca de Óleo (KM)</label>
                      <input
                        type="number"
                        value={editAlertNextOilKM}
                        onChange={(e) => setEditAlertNextOilKM(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="Ex: 90000"
                        className="w-full bg-zinc-955 border border-zinc-850 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-brand-accent"
                      />
                    </div>
                  </div>
                </div>

                {/* Modal Footer */}
                <div className="p-6 bg-zinc-950/40 border-t border-zinc-800 flex items-center justify-end gap-2">
                  <button
                    onClick={() => setEditingAlertVehicle(null)}
                    className="h-10 px-5 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all"
                  >
                    Descartar
                  </button>
                  <button
                    onClick={handleSaveEditAlert}
                    className="h-10 px-6 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest cursor-pointer transition-all shadow-md shadow-brand-accent/5 flex items-center gap-1.5"
                  >
                    <CheckCircle size={12} />
                    Salvar Alterações
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal de Gestão de Frota (Dossier) */}
        <GabineteDossierModal
          isOpen={isDossierOpen}
          onClose={() => setIsDossierOpen(false)}
          vehicles={vehicles}
          employees={employees}
          fuelLogs={fuelLogsLocal}
          maintenance={maintenance}
          trips={trips}
          finance={finance}
        />
      </div>
    </div>
  );
});

const formatPendingOS_TXT = (pendingList: MaintenanceLog[], vehiclesList: Vehicle[]) => {
  let text = `==================================================\n`;
  text += `              DM TURISMO - GESTÃO DE FROTA        \n`;
  text += `       RELATÓRIO DE ORDENS DE SERVIÇO PENDENTES   \n`;
  text += `       Data de Geração: ${format(new Date(), 'dd/MM/yyyy HH:mm')}     \n`;
  text += `==================================================\n\n`;
  text += `Total de Ordens Pendentes: ${pendingList.length}\n\n`;

  pendingList.forEach((log, index) => {
    const vehicle = vehiclesList.find(v => v.id === log.vehicleId);
    text += `${index + 1}. DETALHES DA ORDEM DE SERVIÇO\n`;
    text += `--------------------------------------------------\n`;
    text += `O.S. ID:     ${log.id?.substring(0, 8).toUpperCase() || 'NEW'}\n`;
    text += `Placa:       ${vehicle?.plate || '---'}\n`;
    text += `Veículo:     ${vehicle?.model || 'Desconhecido'} (${vehicle?.factoryYear || '---'})\n`;
    text += `Data Prev:   ${log.scheduledDate ? format(parseISO(log.scheduledDate), 'dd/MM/yyyy') : '---'}\n`;
    text += `Tipo:        ${log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}\n`;
    text += `Odômetro:    ${log.odometer?.toLocaleString() || '---'} KM\n`;
    text += `Custo Est.:  R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
    text += `Descrição / Problema:\n`;
    text += `  ${log.description || 'Nenhuma descrição detalhada.'}\n`;
    text += `--------------------------------------------------\n\n`;
  });

  text += `==================================================\n`;
  text += `           Fim do Relatório • DM Turismo         \n`;
  text += `==================================================\n`;
  return text;
};

const formatAlerts_TXT = (alertVehicles: any[]) => {
  const savedOil = safeGetLocalStorage('dm_alert_oil_km');
  const alertOilKm = savedOil ? parseInt(savedOil, 10) : 2000;
  
  const savedMaintKm = safeGetLocalStorage('dm_alert_maint_km');
  const alertMaintKm = savedMaintKm ? parseInt(savedMaintKm, 10) : 3000;
  
  const savedMaintDays = safeGetLocalStorage('dm_alert_maint_days');
  const alertMaintDays = savedMaintDays ? parseInt(savedMaintDays, 10) : 30;

  let text = `==================================================\n`;
  text += `              DM TURISMO - GESTÃO DE FROTA        \n`;
  text += `        RELATÓRIO CRÍTICO DE ALERTAS DA FROTA     \n`;
  text += `       Data de Geração: ${format(new Date(), 'dd/MM/yyyy HH:mm')}     \n`;
  text += `==================================================\n\n`;
  text += `Veículos com Alertas Ativos: ${alertVehicles.length}\n\n`;

  alertVehicles.forEach((v, index) => {
    text += `${index + 1}. VEÍCULO: ${v.plate} - ${v.model} (${v.factoryYear || '---'})\n`;
    text += `--------------------------------------------------\n`;
    text += `Odômetro Atual: ${v.currentOdometer?.toLocaleString()} KM\n`;
    
    let hasAlerts = false;
    
    // Oil alert
    if (v.nextOilChangeKM) {
      const remainingOil = v.nextOilChangeKM - v.currentOdometer;
      if (remainingOil <= alertOilKm) {
        hasAlerts = true;
        text += `  [ALERTA] TROCA DE ÓLEO VENCENDO:\n`;
        text += `           Próxima troca em: ${v.nextOilChangeKM.toLocaleString()} KM\n`;
        text += `           KMs restantes:    ${remainingOil.toLocaleString()} KM\n`;
      }
    }
    
    // Preventive KM alert
    if (v.nextMaintenanceKM) {
      const remainingMaint = v.nextMaintenanceKM - v.currentOdometer;
      if (remainingMaint <= alertMaintKm) {
        hasAlerts = true;
        text += `  [ALERTA] MANUTENÇÃO PREVENTIVA KM:\n`;
        text += `           Próxima revisão em: ${v.nextMaintenanceKM.toLocaleString()} KM\n`;
        text += `           KMs restantes:      ${remainingMaint.toLocaleString()} KM\n`;
      }
    }

    // Preventive Date alert
    if (v.nextPreventiveMaintenanceDate) {
      const mDate = parseISO(v.nextPreventiveMaintenanceDate);
      const remainingDays = differenceInDays(mDate, new Date());
      if (remainingDays <= alertMaintDays) {
        hasAlerts = true;
        const statusText = remainingDays < 0 ? "VENCIDO" : "VENCENDO";
        text += `  [ALERTA] REVISÃO POR TEMPO (${statusText}):\n`;
        text += `           Data programada: ${format(mDate, 'dd/MM/yyyy')}\n`;
        text += `           Dias restantes:  ${remainingDays} dias\n`;
      }
    }

    if (!hasAlerts) {
      text += `  Nenhum alerta crítico ativo.\n`;
    }
    text += `--------------------------------------------------\n\n`;
  });

  text += `==================================================\n`;
  text += `           Fim do Relatório • DM Turismo         \n`;
  text += `==================================================\n`;
  return text;
};
