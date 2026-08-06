import React, { useState, useEffect, useMemo } from 'react';
import { collection, doc, onSnapshot, writeBatch, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { toast } from 'sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Plus, 
  Check, 
  X, 
  Bus, 
  DollarSign, 
  Calendar, 
  User, 
  Briefcase, 
  PlusCircle, 
  FileText, 
  FolderSync, 
  Info, 
  Eye, 
  EyeOff,
  ChevronDown,
  ChevronUp,
  LayoutDashboard,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles
} from 'lucide-react';

interface OwnersCockpitProps {
  trips: any[];
  charters: any[];
  maintenance: any[];
  finance: any[];
  vehicles?: any[];
  employees?: any[];
}

export const OwnersCockpit: React.FC<OwnersCockpitProps> = ({ 
  trips: fallbackTrips = [], 
  charters: fallbackCharters = [], 
  maintenance: fallbackMaintenance = [], 
  finance: fallbackFinance = [],
  vehicles: fallbackVehicles = [],
  employees: fallbackEmployees = []
}) => {
  // Real-time states to ensure perfect synchronization
  const [dbTrips, setDbTrips] = useState<any[]>([]);
  const [dbCharters, setDbCharters] = useState<any[]>([]);
  const [dbFinance, setDbFinance] = useState<any[]>([]);
  const [dbVehicles, setDbVehicles] = useState<any[]>([]);
  const [dbEmployees, setDbEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Form states - Quick Actions Desktop
  const [activeForm, setActiveForm] = useState<'none' | 'os_viagem' | 'venda_agencia' | 'caixa_rapido'>('none');
  
  // OS form states
  const [osTitle, setOsTitle] = useState('');
  const [osVehicleId, setOsVehicleId] = useState('');
  const [osDriverId, setOsDriverId] = useState('');
  const [osValue, setOsValue] = useState('');
  const [osOrigin, setOsOrigin] = useState('Garagem Central');
  const [osDestination, setOsDestination] = useState('');
  const [osStartDate, setOsStartDate] = useState(new Date().toISOString().slice(0, 16));

  // Agency Sale form states
  const [agencyClient, setAgencyClient] = useState('');
  const [agencySupplier, setAgencySupplier] = useState('');
  const [agencyDescription, setAgencyDescription] = useState('');
  const [agencyTotalVal, setAgencyTotalVal] = useState('');
  const [agencyCommission, setAgencyCommission] = useState('');
  const [agencyDueDate, setAgencyDueDate] = useState(new Date().toISOString().slice(0, 10));
  const [agencyPaid, setAgencyPaid] = useState<boolean>(false);

  // Cash rapid states
  const [cashType, setCashType] = useState<'receivable' | 'payable'>('receivable');
  const [cashCategory, setCashCategory] = useState('Outras Receitas');
  const [cashDesc, setCashDesc] = useState('');
  const [cashVal, setCashVal] = useState('');
  const [cashPaid, setCashPaid] = useState<boolean>(true);

  // UI state filters for reconciliation
  const [showPaidCharters, setShowPaidCharters] = useState(false);
  const [expandedClients, setExpandedClients] = useState<Record<string, boolean>>({});
  const [selectedTrips, setSelectedTrips] = useState<Record<string, boolean>>({});

  // Real-time synchronizer
  useEffect(() => {
    setLoading(true);
    
    const unsubTrips = dbCacheService.subscribeTrips((data) => {
      setDbTrips(data);
    });

    const unsubCharters = dbCacheService.subscribeCollection('charter_client_trips', (data) => {
      setDbCharters(data);
    });

    const unsubFinance = dbCacheService.subscribeCollection('financial_transactions', (data) => {
      setDbFinance(data);
    });

    const unsubVehicles = dbCacheService.subscribeVehicles((data) => {
      setDbVehicles(data);
    });

    const unsubEmployees = dbCacheService.subscribeEmployees((data) => {
      setDbEmployees(data);
    });

    setLoading(false);

    return () => {
      unsubTrips();
      unsubCharters();
      unsubFinance();
      unsubVehicles();
      unsubEmployees();
    };
  }, []);

  // Set lookup arrays fallback
  const trips = dbTrips.length ? dbTrips : fallbackTrips;
  const charters = dbCharters.length ? dbCharters : fallbackCharters;
  const finance = dbFinance.length ? dbFinance : fallbackFinance;
  const vehicles = dbVehicles.length ? dbVehicles : fallbackVehicles;
  const employees = dbEmployees.length ? dbEmployees : fallbackEmployees;

  // Driver employees lookup filter
  const drivers = useMemo(() => {
    return employees.filter(e => {
      const roleStr = (e.role || '').toLowerCase();
      return roleStr.includes('motorista') || roleStr.includes('driver') || roleStr.includes('piloto');
    });
  }, [employees]);

  // 1. Calculations: Tourism Operator vs. Tourism Agency
  const stats = useMemo(() => {
    // A) FLUXO GERAL DE CAIXA (REALIZADO E PREVISTO)
    // Entradas Realizadas (Recebidas)
    const totalReceived = finance
      .filter(f => f.type === 'receivable' && f.status === 'paid')
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);
      
    // Saídas Realizadas (Pagas)
    const totalPaid = finance
      .filter(f => f.type === 'payable' && f.status === 'paid')
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // Contas a Receber (Em Aberto/Faturado)
    const accountsReceivable = finance
      .filter(f => f.type === 'receivable' && f.status !== 'paid')
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // Contas a Pagar (Em Aberto)
    const accountsPayable = finance
      .filter(f => f.type === 'payable' && f.status !== 'paid')
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // B) AGÊNCIA DE TURISMO (Vendas, Pacotes, Comissões)
    // Vendas de agência: finance entries categorized under Agência
    const agencyTransactions = finance.filter(f => 
      (f.category || '').toLowerCase().includes('agência') || 
      (f.category || '').toLowerCase().includes('pacote') ||
      (f.category || '').toLowerCase().includes('comissão') ||
      (f.category || '').toLowerCase().includes('passagem')
    );

    const agencyTotalSales = agencyTransactions
      .filter(f => f.type === 'receivable')
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    // Commissions earned by the Agency
    const agencyCommissions = agencyTransactions
      .filter(f => f.type === 'receivable')
      .reduce((sum, f) => {
        // Safe check for inline commission tags or properties (or default 10%)
        const comm = f.observations?.includes('Comissão: R$')
          ? parseFloat(f.observations.split('Comissão: R$')[1])
          : (Number(f.amount || 0) * 0.12); // Default estimate commission rate (12%)
        return sum + (isNaN(comm) ? 0 : comm);
      }, 0);

    // C) OPERADORA DE FROTA (Turismo, Fretamento e Viagens)
    // Charter revenue (Total value)
    const operatorCharterRevenue = charters.reduce((sum, c) => sum + Number(c.value || 0), 0);
    const operatorTripsRevenue = trips.reduce((sum, t) => sum + Number(t.value || t.cost || 0), 0);
    const totalOperatorRevenue = operatorCharterRevenue + operatorTripsRevenue;

    // Fuel and Maintenance operational costs
    const fuelExpenses = finance
      .filter(f => f.type === 'payable' && (f.category || '').toLowerCase().includes('combustível'))
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const maintExpenses = finance
      .filter(f => f.type === 'payable' && (f.category || '').toLowerCase().includes('manutenção'))
      .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const totalFleetExpenses = fuelExpenses + maintExpenses;

    return {
      cashBalance: totalReceived - totalPaid,
      pendingInward: accountsReceivable,
      pendingOutward: accountsPayable,
      netResult: (totalReceived + accountsReceivable) - (totalPaid + accountsPayable),
      
      // Agency specs
      agencySales: agencyTotalSales,
      agencyCommissions: agencyCommissions,
      agencyCount: agencyTransactions.length,

      // Operator specs
      operatorRevenue: totalOperatorRevenue,
      operatorExpenses: totalFleetExpenses,
      operatorNet: totalOperatorRevenue - totalFleetExpenses
    };
  }, [finance, charters, trips]);

  // 2. Client-grouped Charter calculation and aggregation
  const clientGroupedCharters = useMemo(() => {
    const groups: Record<string, { 
      clientName: string; 
      clientId: string; 
      tripsArr: any[]; 
      totalOutstanding: number; 
      totalPaid: number;
    }> = {};

    charters.forEach(c => {
      const clientName = c.client || 'Cliente Particular / Avulso';
      const cId = c.clientId || 'particular';
      
      const val = Number(c.value || 0);
      const isPaid = (c.paymentStatus === 'Pago' || c.paymentStatus === 'paid' || c.status === 'paid');

      if (!groups[clientName]) {
        groups[clientName] = {
          clientName,
          clientId: cId,
          tripsArr: [],
          totalOutstanding: 0,
          totalPaid: 0
        };
      }

      groups[clientName].tripsArr.push(c);
      if (isPaid) {
        groups[clientName].totalPaid += val;
      } else {
        groups[clientName].totalOutstanding += val;
      }
    });

    return Object.values(groups).map(g => {
      // Sort client individual trips latest date first
      g.tripsArr.sort((a, b) => (b.dateTime || '').localeCompare(a.dateTime || ''));
      return g;
    }).sort((a, b) => b.totalOutstanding - a.totalOutstanding);
  }, [charters]);

  // Handle Select All/None for expansion collapse per client
  const toggleClientExpand = (clientName: string) => {
    setExpandedClients(prev => ({
      ...prev,
      [clientName]: !prev[clientName]
    }));
  };

  // Select / Unselect individual trip for batch action
  const toggleTripSelection = (tripId: string) => {
    setSelectedTrips(prev => ({
      ...prev,
      [tripId]: !prev[tripId]
    }));
  };

  // Toggle selection of all charter trips of a specific client
  const toggleClientSelection = (clientName: string, tripsList: any[]) => {
    const allSelected = tripsList.every(t => selectedTrips[t.id]);
    const nextState = !allSelected;
    
    setSelectedTrips(prev => {
      const updated = { ...prev };
      tripsList.forEach(t => {
        // only select if not paid or explicitly requested
        const isPaid = (t.paymentStatus === 'Pago' || t.paymentStatus === 'paid');
        if (!isPaid || showPaidCharters) {
          updated[t.id] = nextState;
        }
      });
      return updated;
    });
  };

  // Batch action: mark all selected trips as PAID
  const handleBatchMarkAsPaid = async (clientName: string, tripsList: any[]) => {
    const selectedIds = tripsList.filter(t => selectedTrips[t.id]).map(t => t.id);
    
    if (selectedIds.length === 0) {
      toast.error("Nenhuma viagem selecionada para quitação!");
      return;
    }

    const toastId = toast.loading(`Liquidadando ${selectedIds.length} fretamentos em lote...`);
    try {
      const batch = writeBatch(db);
      
      selectedIds.forEach(id => {
        const docRef = doc(db, 'charter_client_trips', id);
        batch.update(docRef, { 
          paymentStatus: 'Pago',
          status: 'completed'
        });
      });

      await batch.commit();
      toast.success(`Parabéns! ${selectedIds.length} fretamentos de ${clientName} marcados como PAGO.`, { id: toastId });
      
      // Clear selection
      setSelectedTrips(prev => {
        const clean = { ...prev };
        selectedIds.forEach(id => {
          delete clean[id];
        });
        return clean;
      });
    } catch (err) {
      console.error(err);
      toast.error("Ocorreu um erro ao atualizar os fretamentos.", { id: toastId });
    }
  };

  // 3. Form Submissions
  // A) Fast OS Submission
  const handleCreateOS = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!osTitle || !osDestination || !osValue) {
      toast.error("Informe título, destino e valor cobrado.");
      return;
    }

    const valNum = parseFloat(osValue);
    if (isNaN(valNum)) {
      toast.error("Valor inválido.");
      return;
    }

    const toastId = toast.loading("Registrando Ordem de Serviço de Viagem...");
    try {
      const randNum = Math.floor(1000 + Math.random() * 9000);
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, '0');
      const day = String(new Date().getDate()).padStart(2, '0');
      const osGeneratedCode = `OS-T-${year}${month}${day}-${randNum}`;

      const nowStr = new Date().toISOString();
      // Insert trip document
      await addDoc(collection(db, 'trips'), {
        osNumber: osGeneratedCode,
        title: osTitle,
        origin: osOrigin,
        destination: osDestination,
        vehicleId: osVehicleId,
        driverId: osDriverId,
        startDate: osStartDate,
        endDate: new Date(new Date(osStartDate).getTime() + 12*60*60*1000).toISOString().slice(0, 16), // default 12h later
        value: valNum,
        paymentStatus: 'A Receber',
        status: 'scheduled',
        passengerCount: 20, // default placeholder
        stops: [],
        documentation: [],
        attachments: [
          {
            name: "Ficha da O.S. (Sistema)",
            type: "pdf",
            url: "view-os"
          },
          {
            name: "Ficha de Serviço",
            type: "pdf",
            url: "view-os"
          }
        ],
        createdAt: nowStr,
        updatedAt: nowStr
      });

      await dbCacheService.touchTripsMetadata();

      // Automatically launch receivable transaction for owner control
      await addDoc(collection(db, 'financial_transactions'), {
        type: 'receivable',
        category: 'Operadora - Fretamento',
        description: `O.S. ${osGeneratedCode} - ${osTitle}`,
        amount: valNum,
        dueDate: osStartDate.substring(0, 10),
        status: 'pending',
        refType: 'trip',
        observations: `Gerado automaticamente via Gabinete de Gestão. O.S: ${osGeneratedCode}`,
        createdAt: new Date().toISOString()
      });

      toast.success(`Ordem de Serviço ${osGeneratedCode} gravada e integrada ao financeiro!`, { id: toastId });
      
      // Clean forms
      setOsTitle('');
      setOsValue('');
      setOsDestination('');
      setActiveForm('none');
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível criar a O.S.", { id: toastId });
    }
  };

  // B) Fast Agency Sale Submission
  const handleCreateAgencySale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agencyClient || !agencyDescription || !agencyTotalVal || !agencyCommission) {
      toast.error("Preencha cliente, descrição, total da venda e comissão prevista.");
      return;
    }

    const totalNum = parseFloat(agencyTotalVal);
    const commNum = parseFloat(agencyCommission);
    if (isNaN(totalNum) || isNaN(commNum)) {
      toast.error("Os valores informados devem ser numéricos.");
      return;
    }

    const toastId = toast.loading("Registrando venda na Agência de Turismo...");
    try {
      // Save agency transaction receivable
      await addDoc(collection(db, 'financial_transactions'), {
        type: 'receivable',
        category: 'Agência - Pacotes',
        description: `Agência: ${agencyClient} - ${agencyDescription}`,
        supplier: agencySupplier || 'Agência Própria',
        amount: totalNum,
        dueDate: agencyDueDate,
        status: agencyPaid ? 'paid' : 'pending',
        refType: 'other',
        observations: `Fornecedor: ${agencySupplier || 'Parceiro Agência'} • Comissão: R$ ${commNum.toFixed(2)}`,
        createdAt: new Date().toISOString()
      });

      toast.success("Venda de Pacote de Turismo/Passagem registrada no financeiro!", { id: toastId });
      
      // Clean
      setAgencyClient('');
      setAgencySupplier('');
      setAgencyDescription('');
      setAgencyTotalVal('');
      setAgencyCommission('');
      setActiveForm('none');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao registrar venda.", { id: toastId });
    }
  };

  // C) Fast Cash transaction
  const handleCreateCashFlow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cashDesc || !cashVal) {
      toast.error("Por favor indique a descrição e o valor do lançamento.");
      return;
    }

    const valNum = parseFloat(cashVal);
    if (isNaN(valNum)) {
      toast.error("Formato de valor incorreto.");
      return;
    }

    const toastId = toast.loading("Lançando transação financeira...");
    try {
      await addDoc(collection(db, 'financial_transactions'), {
        type: cashType,
        category: cashCategory,
        description: cashDesc,
        amount: valNum,
        dueDate: new Date().toISOString().slice(0, 10),
        paymentDate: cashPaid ? new Date().toISOString().slice(0, 10) : null,
        status: cashPaid ? 'paid' : 'pending',
        refType: 'other',
        createdAt: new Date().toISOString()
      });

      toast.success("Lançamento de fluxo de caixa efetuado com sucesso!", { id: toastId });
      setCashDesc('');
      setCashVal('');
      setActiveForm('none');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao efetuar lançamento.", { id: toastId });
    }
  };

  return (
    <div className="space-y-8">
      {/* 1. Header & General Stats Dashboard */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[10px] font-black tracking-widest uppercase text-zinc-500 flex items-center gap-2">
            <LayoutDashboard size={12} className="text-zinc-500" /> Painel Executivo do Dono
          </h2>
          {loading && <span className="text-[10px] uppercase font-black text-blue-500 animate-pulse">Sincronizado em Tempo Real</span>}
        </div>

        {/* Global Financial Flow Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Caixa Realizado */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative overflow-hidden group">
            <div className="absolute right-4 top-4 w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></div>
            <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500 mb-1">Caixa Disponível (Realizado)</p>
            <p className="text-2xl font-black text-white">
              R$ {stats.cashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 uppercase font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
              Soma total de recebimentos liquidados
            </div>
          </div>

          {/* Contas a Receber */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
            <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500 mb-1">Contas a Receber (Em Aberto)</p>
            <p className="text-2xl font-black text-blue-400">
              R$ {stats.pendingInward.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 uppercase font-bold">
              <ArrowUpRight size={12} className="text-blue-400" />
              Previsão de inflows de faturamento
            </div>
          </div>

          {/* Contas a Pagar */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
            <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500 mb-1">Contas a Pagar (Pendentes)</p>
            <p className="text-2xl font-black text-rose-400">
              R$ {stats.pendingOutward.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 uppercase font-bold">
              <ArrowDownRight size={12} className="text-rose-400" />
              Compromissos e custos previstos
            </div>
          </div>

          {/* Resultado Líquido Projetado */}
          <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
            <p className="text-[9px] uppercase tracking-widest font-black text-zinc-500 mb-1">Resultado Projetado (Mes)</p>
            <p className={`text-2xl font-black ${stats.netResult >= 0 ? 'text-white' : 'text-rose-500'}`}>
              R$ {stats.netResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-zinc-500 uppercase font-bold">
              <Target size={12} className={stats.netResult >= 0 ? "text-emerald-500" : "text-rose-500"} />
              Resultado operacional consolidado
            </div>
          </div>
        </div>
      </div>

      {/* 2. Double Business Overview: Agency vs Operator */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AGÊNCIA DE TURISMO */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Briefcase size={14} className="text-blue-400" /> Agência de Turismo DM
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Vendas, Vales, Reservas e Comissões</p>
            </div>
            <div className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2.0 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
              Revenue Center
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
              <p className="text-[9px] font-black text-zinc-650 uppercase tracking-widest">Faturamento Bruto</p>
              <p className="text-lg font-black text-white mt-1">R$ {stats.agencySales.toLocaleString('pt-BR')}</p>
              <span className="text-[9px] text-zinc-500 font-bold uppercase">{stats.agencyCount} Ordens de Vendas</span>
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
              <p className="text-[9px] font-black text-zinc-655 uppercase tracking-widest">Comissionamento Estimado</p>
              <p className="text-lg font-black text-emerald-400 mt-1">R$ {stats.agencyCommissions.toLocaleString('pt-BR')}</p>
              <span className="text-[9px] text-zinc-500 font-bold uppercase">Média de 12% por pacote</span>
            </div>
          </div>

          <div className="text-[10px] font-bold text-zinc-500 bg-zinc-950 p-3 rounded-xl border border-zinc-850 flex items-center gap-2 uppercase">
            <Info size={12} className="text-blue-400 flex-shrink-0" />
            Vendas corporativas e pacotes terrestres geram comissão líquida de faturamento direto no vencimento do parceiro.
          </div>
        </div>

        {/* OPERADORA / FROTA DE VEÍCULOS */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <Bus size={14} className="text-blue-400" /> Operadora de Frota / Transporte
              </h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">Fretados industriais, Viagens de Linhas e Custos de Garagem</p>
            </div>
            <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.0 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
              Operation Center
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
              <p className="text-[9px] font-black text-zinc-650 uppercase tracking-widest">Receitas de Transporte</p>
              <p className="text-lg font-black text-white mt-1">R$ {stats.operatorRevenue.toLocaleString('pt-BR')}</p>
              <span className="text-[9px] text-zinc-500 font-bold uppercase">{trips.length} linhas corporativas</span>
            </div>
            
            <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850">
              <p className="text-[9px] font-black text-zinc-655 uppercase tracking-widest">Gastos Operacionais (Frota)</p>
              <p className="text-lg font-black text-rose-400 mt-1">R$ {stats.operatorExpenses.toLocaleString('pt-BR')}</p>
              <span className="text-[9px] text-rose-500/80 font-bold uppercase">Manutenções e Insumos</span>
            </div>
          </div>

          <div className="text-[10px] font-bold text-zinc-400 bg-zinc-950 p-3 rounded-xl border border-zinc-850 flex items-center justify-between uppercase">
            <span>Margem da Operação de Transporte:</span>
            <strong className={`font-black ${stats.operatorNet >= 0 ? 'text-emerald-400' : 'text-rose-500'}`}>
              {stats.operatorRevenue > 0 ? ((stats.operatorNet / stats.operatorRevenue) * 100).toFixed(0) : 0}% Lucratividade
            </strong>
          </div>
        </div>
      </div>

      {/* 3. "Poucos Cliques" Quick Actions Launchpad */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div>
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Sparkles size={14} className="text-blue-400" /> Mesa de Ações Rápidas - 2 Cliques
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-semibold">Crie Ordens de Serviço operacionais ou insira fluxo de caixa de forma instantânea</p>
        </div>

        {/* Buttons to trigger subforms */}
        <div className="flex flex-wrap gap-2">
          <button 
            type="button"
            onClick={() => setActiveForm(activeForm === 'os_viagem' ? 'none' : 'os_viagem')}
            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 border ${
              activeForm === 'os_viagem' 
                ? 'bg-white text-zinc-950 border-white' 
                : 'bg-zinc-950 text-zinc-300 border-zinc-850 hover:bg-zinc-900'
            }`}
          >
            <Bus size={13} /> Gerar O.S. de Viagem / Fretado
          </button>

          <button 
            type="button"
            onClick={() => setActiveForm(activeForm === 'venda_agencia' ? 'none' : 'venda_agencia')}
            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 border ${
              activeForm === 'venda_agencia' 
                ? 'bg-white text-zinc-950 border-white' 
                : 'bg-zinc-950 text-zinc-300 border-zinc-850 hover:bg-zinc-900'
            }`}
          >
            <Briefcase size={13} /> Lançar Venda na Agência
          </button>

          <button 
            type="button"
            onClick={() => setActiveForm(activeForm === 'caixa_rapido' ? 'none' : 'caixa_rapido')}
            className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition flex items-center gap-2 border ${
              activeForm === 'caixa_rapido' 
                ? 'bg-white text-zinc-950 border-white' 
                : 'bg-zinc-950 text-zinc-300 border-zinc-850 hover:bg-zinc-900'
            }`}
          >
            <DollarSign size={13} /> Lançamento de Caixa Direto
          </button>
        </div>

        {/* Form 1: O.S. Viagem / Fretado */}
        {activeForm === 'os_viagem' && (
          <form onSubmit={handleCreateOS} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4 animate-fade-in">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Lançamento de Ordem de Serviço Operacional</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Cliente / Linha / Roteiro</label>
                <input 
                  type="text" 
                  placeholder="Ex: Prefeitura Municipal - Viagem Escolar"
                  required
                  value={osTitle}
                  onChange={e => setOsTitle(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Destino</label>
                <input 
                  type="text" 
                  placeholder="Ex: Curitiba PR"
                  required
                  value={osDestination}
                  onChange={e => setOsDestination(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Valor Cobrado (R$)</label>
                <input 
                  type="number" 
                  placeholder="3400.00"
                  required
                  value={osValue}
                  onChange={e => setOsValue(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Veículo Escalado</label>
                <select 
                  value={osVehicleId}
                  onChange={e => setOsVehicleId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white uppercase font-semibold"
                >
                  <option value="">Sem veículo escalado</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.plate}>{v.plate} - {v.brand} {v.model}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Motorista Principal</label>
                <select 
                  value={osDriverId}
                  onChange={e => setOsDriverId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-xs text-white"
                >
                  <option value="">Sem profissional de cabine</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Data e Hora de Saída</label>
                <input 
                  type="datetime-local"
                  required
                  value={osStartDate}
                  onChange={e => setOsStartDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setActiveForm('none')}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-zinc-100 hover:bg-white text-zinc-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Emitir OS e Lançar Financeiro
              </button>
            </div>
          </form>
        )}

        {/* Form 2: Venda na Agência */}
        {activeForm === 'venda_agencia' && (
          <form onSubmit={handleCreateAgencySale} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4 animate-fade-in">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Registro de Venda da Agência de Turismo</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Cliente / Contratante</label>
                <input 
                  type="text" 
                  placeholder="Nome do passageiro ou empresa"
                  required
                  value={agencyClient}
                  onChange={e => setAgencyClient(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Parceiro Fornecedor (Voucher)</label>
                <input 
                  type="text" 
                  placeholder="Ex: CVC, Latam, Booking.com"
                  value={agencySupplier}
                  onChange={e => setAgencySupplier(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Descrição do Pacote / Bilhete</label>
                <input 
                  type="text" 
                  placeholder="Ex: Pacote Gramado 4 dias + Translado"
                  required
                  value={agencyDescription}
                  onChange={e => setAgencyDescription(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Valor Total da Venda (R$)</label>
                <input 
                  type="number" 
                  placeholder="4500.00"
                  required
                  value={agencyTotalVal}
                  onChange={e => setAgencyTotalVal(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Comissão Prevista da Agência (R$)</label>
                <input 
                  type="number" 
                  placeholder="540.00 (12%)"
                  required
                  value={agencyCommission}
                  onChange={e => setAgencyCommission(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Data de Vencimento</label>
                <input 
                  type="date"
                  required
                  value={agencyDueDate}
                  onChange={e => setAgencyDueDate(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-3 flex items-center gap-2 py-1">
                <input 
                  type="checkbox"
                  id="agencyPaid"
                  checked={agencyPaid}
                  onChange={e => setAgencyPaid(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-800"
                />
                <label htmlFor="agencyPaid" className="text-[10px] font-black uppercase text-zinc-400 select-none">Registrar esta transação como já Quitada / Recebida</label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setActiveForm('none')}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-zinc-300"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-zinc-100 hover:bg-white text-zinc-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Gravar Registro de Venda
              </button>
            </div>
          </form>
        )}

        {/* Form 3: Caixa Direto */}
        {activeForm === 'caixa_rapido' && (
          <form onSubmit={handleCreateCashFlow} className="bg-zinc-950 border border-zinc-850 rounded-2xl p-6 space-y-4 animate-fade-in">
            <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Lançamento de Entrada ou Saída Financeira Direta</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Tipo de Fluxo</label>
                <div className="grid grid-cols-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                  <button 
                    type="button"
                    onClick={() => { setCashType('receivable'); setCashCategory('Consultoria'); }}
                    className={`text-[9px] font-black uppercase tracking-wide py-1.5 rounded-lg text-center ${cashType === 'receivable' ? 'bg-emerald-500 text-zinc-950' : 'text-zinc-500'}`}
                  >
                    Receita
                  </button>
                  <button 
                    type="button"
                    onClick={() => { setCashType('payable'); setCashCategory('Combustível'); }}
                    className={`text-[9px] font-black uppercase tracking-wide py-1.5 rounded-lg text-center ${cashType === 'payable' ? 'bg-rose-500 text-white' : 'text-zinc-500'}`}
                  >
                    Saída
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Categoria do Lançamento</label>
                {cashType === 'receivable' ? (
                  <select 
                    value={cashCategory}
                    onChange={e => setCashCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-xs text-white"
                  >
                    <option value="Contrato de Fretamento">Fretimentos Mensais</option>
                    <option value="Agência - Pacotes">Venda de Pacotes</option>
                    <option value="Agência - Passagens">Comissão Passagens / Vouchers</option>
                    <option value="Consultoria">Consultorias e Taxas</option>
                    <option value="Outras Receitas">Outras Receitas</option>
                  </select>
                ) : (
                  <select 
                    value={cashCategory}
                    onChange={e => setCashCategory(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-3 text-xs text-white"
                  >
                    <option value="Combustível">Combustível / Diesel</option>
                    <option value="Manutenção">Manutenção de Frota (Oficina)</option>
                    <option value="Peças / Acessórios">Comercial de Peças</option>
                    <option value="Salários / Comissões">Salários e Pró-Labore</option>
                    <option value="Administração / Escritório">Custos de Office</option>
                    <option value="Impostos / Seguros">Impostos e Seguros de Frota</option>
                    <option value="Outras Despesas">Outras Despesas</option>
                  </select>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Descrição</label>
                <input 
                  type="text" 
                  placeholder="Ex: Conta de Luz Garagem"
                  required
                  value={cashDesc}
                  onChange={e => setCashDesc(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Valor (R$)</label>
                <input 
                  type="number" 
                  placeholder="120.00"
                  required
                  value={cashVal}
                  onChange={e => setCashVal(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-white"
                />
              </div>

              <div className="md:col-span-2 lg:col-span-4 flex items-center gap-2 py-1">
                <input 
                  type="checkbox"
                  id="cashPaid"
                  checked={cashPaid}
                  onChange={e => setCashPaid(e.target.checked)}
                  className="w-4 h-4 rounded bg-zinc-900 border-zinc-800"
                />
                <label htmlFor="cashPaid" className="text-[10px] font-black uppercase text-zinc-400 select-none">Registrar esta transação como Liquidada / Paga (Diminuir/Agravamento direto do Caixa)</label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button 
                type="button" 
                onClick={() => setActiveForm('none')}
                className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-zinc-500"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                className="bg-zinc-100 hover:bg-white text-zinc-900 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider"
              >
                Aplicar Fluxo Financas
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 4. "Unificação de Fretamentos por Cliente" Reconciliation Center */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-[2rem] overflow-hidden">
        <div className="p-6 border-b border-zinc-850 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <FolderSync size={14} className="text-blue-400" /> Conciliação Unificada de Clientes Fretistas
            </h3>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-semibold">Consolidação de faturamento agrupado por contratante. Marque liquidações em lote</p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={() => setShowPaidCharters(!showPaidCharters)}
              className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition flex items-center gap-1.5 border ${
                showPaidCharters 
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                  : 'bg-zinc-950 text-zinc-500 border-zinc-850'
              }`}
            >
              {showPaidCharters ? <Eye size={12} /> : <EyeOff size={12} />}
              {showPaidCharters ? "Quitados Visíveis" : "Quitados Ocultados (Padrão)"}
            </button>
          </div>
        </div>

        {/* List of Grouped Clients */}
        <div className="divide-y divide-zinc-850">
          {clientGroupedCharters.length === 0 ? (
            <div className="p-16 text-center text-zinc-600">
              <ShieldAlert className="mx-auto w-10 h-10 text-zinc-700 mb-2 animate-pulse" />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Nenhum faturamento pendente</p>
              <p className="text-[10px] text-zinc-650 mt-1 uppercase font-bold">Todos os fretamentos estão liquidados ou sem dados e registros cadastrados no sistema.</p>
            </div>
          ) : (
            clientGroupedCharters.map(group => {
              // Filter visible trips based on showPaidCharters
              const visibleTrips = group.tripsArr.filter(t => {
                const isPaid = (t.paymentStatus === 'Pago' || t.paymentStatus === 'paid' || t.status === 'paid');
                return showPaidCharters || !isPaid;
              });

              // Skip rendering client group completely if there are no visible items and showPaidCharters is false
              if (visibleTrips.length === 0 && !showPaidCharters) return null;

              const isExpanded = expandedClients[group.clientName];
              
              // Count selected trips of this client
              const selectedCount = visibleTrips.filter(t => selectedTrips[t.id]).length;
              const hasSelection = selectedCount > 0;

              return (
                <div key={group.clientName} className="p-6 space-y-4">
                  {/* General Client Banner */}
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      {/* Checkbox trigger for all */}
                      <input 
                        type="checkbox"
                        checked={visibleTrips.length > 0 && visibleTrips.every(t => selectedTrips[t.id])}
                        onChange={() => toggleClientSelection(group.clientName, visibleTrips)}
                        disabled={visibleTrips.length === 0}
                        className="w-4.5 h-4.5 rounded bg-zinc-950 border-zinc-800 text-blue-500 mt-1 cursor-pointer focus:ring-0"
                      />

                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-black text-white uppercase tracking-tight">{group.clientName}</h4>
                          <span className="text-[9px] bg-zinc-950 border border-zinc-800 text-zinc-400 px-2.0 py-0.5 rounded-full font-bold uppercase">
                            {group.tripsArr.length} Viagens Registradas
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-1">
                          Consolidação financeira para o contratante fretista
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Outstanding total summary */}
                      <div className="text-left md:text-right">
                        <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Saldo Pendente de Recebimento</p>
                        <p className={`text-sm font-extrabold ${group.totalOutstanding > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>
                          R$ {group.totalOutstanding.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>

                      {/* Expand Button */}
                      <button 
                        type="button"
                        onClick={() => toggleClientExpand(group.clientName)}
                        className="p-2 border border-zinc-800 hover:border-zinc-700 rounded-xl hover:bg-zinc-950 text-zinc-400 hover:text-white transition"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {/* Expandable Trips Details list */}
                  {isExpanded && (
                    <div className="pl-6 border-l-2 border-zinc-800 space-y-3 animate-fade-in pt-2">
                      <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 rounded-xl border border-zinc-850">
                        <span className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">
                          Selecione as faturas operacionais para marcação ou conciliação em lote
                        </span>

                        {hasSelection && (
                          <button 
                            type="button"
                            onClick={() => handleBatchMarkAsPaid(group.clientName, visibleTrips)}
                            className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition flex items-center gap-1"
                          >
                            <Check size={10} /> Quitar Selecionadas ({selectedCount})
                          </button>
                        )}
                      </div>

                      <div className="divide-y divide-zinc-900 border border-zinc-900 rounded-xl overflow-hidden">
                        {visibleTrips.map(trip => {
                          const isPaid = (trip.paymentStatus === 'Pago' || trip.paymentStatus === 'paid' || trip.status === 'paid');
                          const isSelected = !!selectedTrips[trip.id];

                          return (
                            <div 
                              key={trip.id} 
                              className={`p-3 flex items-center justify-between text-xs font-mono transition-colors ${
                                isSelected ? 'bg-blue-500/5' : 'bg-zinc-950/40 hover:bg-zinc-900/40'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleTripSelection(trip.id)}
                                  disabled={isPaid}
                                  className="w-4 h-4 rounded bg-zinc-950 border-zinc-800 text-blue-500 disabled:opacity-50 cursor-pointer focus:ring-0"
                                />

                                <div className="space-y-0.5">
                                  <p className="text-[11px] font-bold text-white uppercase tracking-tight font-sans">
                                    {trip.origin} ➔ {trip.destination}
                                  </p>
                                  <p className="text-[9px] text-zinc-500 uppercase tracking-wildest font-sans font-black flex items-center gap-2">
                                    <Calendar size={10} /> {trip.dateTime ? trip.dateTime.replace('T', ' ') : 'Agendado'}
                                    {trip.vehicleId && <span>• Carro: <strong className="text-zinc-400">{trip.vehicleId}</strong></span>}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-4">
                                <span className="font-bold text-white pr-2">
                                  R$ {Number(trip.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </span>

                                <span className={`px-2 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${
                                  isPaid 
                                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                                    : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                                }`}>
                                  {isPaid ? 'Pago' : 'A Receber'}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
