import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { toast } from 'sonner';
import { 
  DollarSign, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Filter, 
  Bus, 
  Wrench, 
  Clock, 
  Edit2, 
  Check, 
  X, 
  Calendar, 
  User, 
  FileText 
} from 'lucide-react';

// Unified item type definition
interface UnifiedItem {
  id: string;
  type: 'viagem' | 'fretamento' | 'manutenção';
  title: string;
  subtitle: string;
  date: string;
  value: number;
  paymentStatus: 'A Receber' | 'Faturado' | 'Pago';
  status: string;
  driverName?: string;
  vehiclePlate?: string;
  raw: any; // original document data
}

export const UnifiedOperationsManager: React.FC = () => {
  const [trips, setTrips] = useState<any[]>([]);
  const [charters, setCharters] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'viagem' | 'fretamento' | 'manutenção'>('all');
  const [filterPayment, setFilterPayment] = useState<'all' | 'A Receber' | 'Faturado' | 'Pago' | 'Arquivados'>('A Receber');

  // Editing states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');

  // 1. Subscribe to all 3 collections in real-time
  useEffect(() => {
    setLoading(true);
    
    const unsubTrips = dbCacheService.subscribeTrips((data) => {
      setTrips(data);
    });

    const unsubCharter = dbCacheService.subscribeCollection('charter_client_trips', (data) => {
      setCharters(data);
    });

    const unsubMaint = dbCacheService.subscribeCollection('maintenance_logs', (data) => {
      setMaintenance(data);
    });

    const unsubVehicles = dbCacheService.subscribeVehicles((data) => {
      setVehicles(data);
    });

    // Unsubscribe on unmount
    return () => {
      unsubTrips();
      unsubCharter();
      unsubMaint();
      unsubVehicles();
    };
  }, []);

  // Update loading state once subscribers yield databases
  useEffect(() => {
    if (trips.length || charters.length || maintenance.length) {
      setLoading(false);
    }
  }, [trips, charters, maintenance]);

  // 2. Unify data to a single streamlined type
  const unifiedData = useMemo(() => {
    const list: UnifiedItem[] = [];

    // Map trips (Viagens)
    trips.forEach(t => {
      const v = vehicles.find(vh => vh.id === t.vehicleId || vh.plate === t.vehicleId);
      list.push({
        id: t.id,
        type: 'viagem',
        title: t.title || t.destination || 'Viagem Programada',
        subtitle: `Linha / Roteiro • ${t.tripType || 'Estadual'}`,
        date: t.startDate || t.date || '---',
        value: Number(t.value || t.cost || 0),
        paymentStatus: (t.paymentStatus as any) || 'A Receber',
        status: t.status || 'scheduled',
        vehiclePlate: v?.plate || t.vehicleId || '---',
        driverName: t.driverId || '---',
        raw: { ...t, vehiclePrefix: v?.prefix }
      });
    });

    // Map charter client trips (Fretamentos) - AGROUPADOS POR CLIENTE
    charters.forEach(c => {
      const v = vehicles.find(vh => vh.id === c.vehicleId || vh.plate === c.vehicleId);
      list.push({
        id: c.id,
        type: 'fretamento',
        title: c.client || 'Cliente Fretamento',
        subtitle: `${c.origin || 'Origem'} ➔ ${c.destination || 'Destino'}`,
        date: c.dateTime || '---',
        value: Number(c.value || 0),
        paymentStatus: (c.paymentStatus as any) || 'A Receber',
        status: c.status || 'scheduled',
        vehiclePlate: v?.plate || c.vehicleId || '---',
        driverName: c.driverId || '---',
        raw: { ...c, vehiclePrefix: v?.prefix }
      });
    });

    // Map maintenance logs (Manutenções)
    maintenance.forEach(m => {
      const v = vehicles.find(vh => vh.id === m.vehicleId || vh.plate === m.vehicleId);
      list.push({
        id: m.id,
        type: 'manutenção',
        title: m.description || 'Manutenção Corretiva/Preventiva',
        subtitle: `${m.type === 'preventive' ? 'Preventiva' : 'Corretiva'} • OS: ${m.osNumber || '---'}`,
        date: m.scheduledDate || m.completedAt || '---',
        value: Number(m.cost || 0),
        paymentStatus: (m.paymentStatus as any) || 'A Receber',
        status: m.status || 'scheduled',
        vehiclePlate: v?.plate || m.vehicleId || '---',
        driverName: m.driverId || 'Mecânica / Oficina',
        raw: { ...m, vehiclePrefix: v?.prefix }
      });
    });

    // Sort by latest date or placement ID
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [trips, charters, maintenance]);

  // 3. Filter and Search
  const filteredData = useMemo(() => {
    return unifiedData.filter(item => {
      // Search text match
      const query = searchTerm.toLowerCase();
      const matchesSearch = 
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        (item.vehiclePlate && item.vehiclePlate.toLowerCase().includes(query)) ||
        (item.driverName && item.driverName.toLowerCase().includes(query));

      // Type match
      const matchesType = filterType === 'all' || item.type === filterType;

      // Payment Status match / Default Hiding 'Pago'
      let matchesPayment = false;
      if (filterPayment === 'all') matchesPayment = true;
      else if (filterPayment === 'Arquivados') matchesPayment = item.paymentStatus === 'Pago';
      else if (filterPayment === 'A Receber') matchesPayment = item.paymentStatus === 'A Receber';
      else if (filterPayment === 'Faturado') matchesPayment = item.paymentStatus === 'Faturado';
      else if (filterPayment === 'Pago') matchesPayment = item.paymentStatus === 'Pago';
      else matchesPayment = item.paymentStatus === filterPayment;

      // Default hidden rule
      if (filterPayment === 'A Receber' && item.paymentStatus === 'Pago') return false; // Hiding PAGO from non-archived views

      return matchesSearch && matchesType && matchesPayment;
    });
  }, [unifiedData, searchTerm, filterType, filterPayment]);

  // 4. Update status of payment
  const handleUpdatePaymentStatus = async (id: string, type: 'viagem' | 'fretamento' | 'manutenção', newStatus: 'A Receber' | 'Faturado' | 'Pago') => {
    const toastId = toast.loading('Salvando status de pagamento...');
    try {
      let collectionName = '';
      if (type === 'viagem') collectionName = 'trips';
      else if (type === 'fretamento') collectionName = 'charter_client_trips';
      else collectionName = 'maintenance_logs';

      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, { paymentStatus: newStatus });
      if (collectionName === 'trips') {
        await dbCacheService.touchTripsMetadata();
      }
      toast.success(`Status da operação alterado para: ${newStatus}`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Erro de permissão ou conexão ao atualizar status de pagamento.', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, `${type}/${id}`);
    }
  };

  // 5. Update Status of Operation
  const handleUpdateOperationStatus = async (id: string, type: 'viagem' | 'fretamento' | 'manutenção', newStatus: string) => {
    const toastId = toast.loading('Atualizando status operational...');
    try {
      let collectionName = '';
      if (type === 'viagem') collectionName = 'trips';
      else if (type === 'fretamento') collectionName = 'charter_client_trips';
      else collectionName = 'maintenance_logs';

      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, { status: newStatus });
      if (collectionName === 'trips') {
        await dbCacheService.touchTripsMetadata();
      }
      toast.success(`Status operacional alterado com sucesso!`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Não foi possível alterar o status operacional.', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, `${type}/${id}`);
    }
  };

  // 6. Save Inline Value / Cost
  const handleSaveValue = async (id: string, type: 'viagem' | 'fretamento' | 'manutenção') => {
    const newValueNum = parseFloat(editingValue.replace(/[^\d.-]/g, ''));
    if (isNaN(newValueNum)) {
      toast.error('Por favor, informe um valor numérico válido.');
      return;
    }

    const toastId = toast.loading('Atualizando valor...');
    try {
      let collectionName = '';
      let updatePayload: any = {};

      if (type === 'viagem') {
        collectionName = 'trips';
        updatePayload = { value: newValueNum };
      } else if (type === 'fretamento') {
        collectionName = 'charter_client_trips';
        updatePayload = { value: newValueNum };
      } else {
        collectionName = 'maintenance_logs';
        updatePayload = { cost: newValueNum };
      }

      const docRef = doc(db, collectionName, id);
      await updateDoc(docRef, updatePayload);
      if (collectionName === 'trips') {
        await dbCacheService.touchTripsMetadata();
      }
      toast.success('Valor financeiro atualizado com sucesso!', { id: toastId });
      setEditingId(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar o valor financeiro.', { id: toastId });
      handleFirestoreError(error, OperationType.WRITE, `${type}/${id}`);
    }
  };

  const handleStartEdit = (item: UnifiedItem) => {
    setEditingId(item.id);
    setEditingValue(item.value.toString());
  };

  return (
    <div className="space-y-6">
      {/* Top filter section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
          <div>
            <h2 className="text-base font-black text-white uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-5 h-5 text-zinc-400" /> Conciliação e Ajustes Financeiros
            </h2>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
              Gerencie valores e status de faturamento de Viagens, Fretamentos e Manutenções
            </p>
          </div>

          <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-850">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Painel Integrado Real-time</span>
          </div>
        </div>

        {/* Search Bar and Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text" 
              placeholder="Buscar por placas, motorista ou cliente..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-950 border border-zinc-850 rounded-2xl text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700 transition"
            />
          </div>

          {/* Type Filter */}
          <div className="flex bg-zinc-950 rounded-2xl border border-zinc-850 p-1">
            <button 
              onClick={() => setFilterType('all')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterType === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFilterType('viagem')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterType === 'viagem' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              Viagens
            </button>
            <button 
              onClick={() => setFilterType('fretamento')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterType === 'fretamento' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              Fretados
            </button>
            <button 
              onClick={() => setFilterType('manutenção')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterType === 'manutenção' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              Oficina
            </button>
          </div>

          {/* Payment Status Filter */}
          <div className="flex bg-zinc-950 rounded-2xl border border-zinc-850 p-1">
            <button 
              onClick={() => setFilterPayment('all')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5  rounded-xl transition ${filterPayment === 'all' ? 'bg-zinc-800 text-white' : 'text-zinc-500'}`}
            >
              Geral
            </button>
            <button 
              onClick={() => setFilterPayment('A Receber')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterPayment === 'A Receber' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'text-zinc-500'}`}
            >
              Receber
            </button>
            <button 
              onClick={() => setFilterPayment('Faturado')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterPayment === 'Faturado' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'text-zinc-500'}`}
            >
              Faturado
            </button>
            <button 
              onClick={() => setFilterPayment('Arquivados')}
              className={`flex-1 text-[10px] uppercase tracking-widest font-black py-1.5 rounded-xl transition ${filterPayment === 'Arquivados' ? 'bg-zinc-700 text-white' : 'text-zinc-500'}`}
            >
              Arquiv
            </button>
          </div>
        </div>
      </div>

      {/* Main List Container */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden shadow-2xl">
        <div className="px-6 py-4 bg-zinc-900/50 border-b border-zinc-850 flex items-center justify-between">
          <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">
            Mostrando {filteredData.length} de {unifiedData.length} transações comerciais
          </span>
          {loading && (
            <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest animate-pulse flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-zinc-500 rounded-full"></span> Sincronizando...
            </span>
          )}
        </div>

        <div className="divide-y divide-zinc-850">
          {filteredData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
              <Filter className="w-10 h-10 text-zinc-700 animate-pulse" />
              <div>
                <p className="text-zinc-500 text-xs font-black uppercase tracking-widest">Nenhuma Operação Disponível</p>
                <p className="text-zinc-600 text-[10px] mt-1 font-medium">Experimente alterar os termos de busca ou filtros de status</p>
              </div>
            </div>
          ) : (
            filteredData.map((item) => {
              const isEditing = editingId === item.id;
              
              return (
                <div key={item.id} className="p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6 hover:bg-zinc-900/40 transition">
                  {/* Left Column: Details & Brand Tags */}
                  <div className="flex items-start gap-4 flex-1">
                    {/* Badge Icon by Type */}
                    <div className={`p-3 rounded-2xl flex-shrink-0 border ${
                      item.type === 'viagem' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      item.type === 'fretamento' ? 'bg-purple-500/10 border-purple-500/20 text-purple-400' :
                      'bg-orange-500/10 border-orange-500/20 text-orange-400'
                    }`}>
                      {item.type === 'viagem' && <Bus className="w-5 h-5" />}
                      {item.type === 'fretamento' && <Calendar className="w-5 h-5" />}
                      {item.type === 'manutenção' && <Wrench className="w-5 h-5" />}
                    </div>

                    {/* Meta descriptions */}
                    <div className="space-y-1.5 max-w-md">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-[9px] font-black tracking-widest uppercase px-2.0 py-0.5 rounded-full border ${
                          item.type === 'viagem' ? 'text-blue-400 border-blue-500/20 bg-blue-500/5' :
                          item.type === 'fretamento' ? 'text-purple-400 border-purple-500/20 bg-purple-500/5' :
                          'text-orange-400 border-orange-500/20 bg-orange-500/5'
                        }`}>
                          {item.type}
                        </span>
                        
                        <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-zinc-600" /> {item.date}
                        </span>
                      </div>

                      <h4 className="text-sm font-black text-white uppercase tracking-tight">{item.title}</h4>
                      <p className="text-[11px] text-zinc-500 font-medium">{item.subtitle}</p>

                      {/* Fleet details */}
                      <div className="flex items-center gap-4 text-[10px] text-zinc-600 uppercase font-black tracking-wider pt-1">
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          Prefixo: <strong className="text-zinc-400">{item.raw.vehiclePrefix || '---'}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 whitespace-nowrap">
                          Placa: <strong className="text-zinc-400">{item.vehiclePlate}</strong>
                        </span>
                        <span className="flex items-center gap-1.5 truncate">
                          Motorista: <strong className="text-zinc-400 truncate">{item.driverName}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Column: Inline-Editable Value */}
                  <div className="flex items-center gap-4 min-w-[160px] justify-start lg:justify-end">
                    {isEditing ? (
                      <div className="flex items-center gap-1 bg-zinc-950 p-1 border border-zinc-800 rounded-xl">
                        <span className="text-xs text-zinc-500 pl-2 font-black">R$</span>
                        <input 
                          type="text" 
                          value={editingValue} 
                          onChange={(e) => setEditingValue(e.target.value)}
                          className="w-20 bg-transparent text-xs font-black text-white text-right pr-2 focus:outline-none"
                          placeholder="0.00"
                          autoFocus
                        />
                        <button 
                          onClick={() => handleSaveValue(item.id, item.type)}
                          className="p-1 text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => setEditingId(null)}
                          className="p-1 text-rose-500 hover:bg-rose-500/10 rounded-lg transition"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 group">
                        <div className="text-right">
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Valor Acordado</p>
                          <p className="text-sm font-extrabold text-white">
                            R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <button 
                          onClick={() => handleStartEdit(item)}
                          className="p-1.5 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-white bg-zinc-950/60 transition-all border border-zinc-850 rounded-lg"
                          title="Alterar valor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Payment Status Buttons */}
                  <div className="flex flex-col gap-2 min-w-[210px]">
                    <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest text-left lg:text-right">
                      Status de Faturamento
                    </span>

                    <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-2xl items-center gap-1 w-full justify-between">
                      <button 
                        onClick={() => handleUpdatePaymentStatus(item.id, item.type, 'A Receber')}
                        className={`text-[9px] uppercase tracking-wider font-extrabold py-1.5 px-3 rounded-xl transition-all flex-1 text-center ${
                          item.paymentStatus === 'A Receber' 
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 font-black' 
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        Receber
                      </button>
                      
                      <button 
                        onClick={() => handleUpdatePaymentStatus(item.id, item.type, 'Faturado')}
                        className={`text-[9px] uppercase tracking-wider font-extrabold py-1.5 px-3 rounded-xl transition-all flex-1 text-center ${
                          item.paymentStatus === 'Faturado' 
                            ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 font-black' 
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        Faturado
                      </button>

                      <button 
                        onClick={() => handleUpdatePaymentStatus(item.id, item.type, 'Pago')}
                        className={`text-[9px] uppercase tracking-wider font-extrabold py-1.5 px-3 rounded-xl transition-all flex-1 text-center ${
                          item.paymentStatus === 'Pago' 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black' 
                            : 'text-zinc-600 hover:text-zinc-400'
                        }`}
                      >
                        Pago
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
