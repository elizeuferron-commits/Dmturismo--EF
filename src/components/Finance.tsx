import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  DollarSign, 
  ArrowUpCircle, 
  ArrowDownCircle, 
  Wallet, 
  Calendar, 
  Search, 
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  Trash2,
  Bell,
  CalendarDays,
  Target,
  Printer,
  Bus,
  Wrench,
  Package,
  Info,
  ChevronRight,
  Sparkles,
  Users,
  FileDown,
  RefreshCw,
  X,
  FileText,
  Edit2,
  Paperclip,
  Plus,
  Building2
} from 'lucide-react';
import { offlineQueue } from '../services/offlineQueue';

const StaffManagement = lazy(() => import('./StaffManagement').then(m => ({ default: m.StaffManagement })));
const BoletoModal = lazy(() => import('./BoletoModal').then(m => ({ default: m.BoletoModal })));
const TransactionDetailModal = lazy(() => import('./TransactionDetailModal').then(m => ({ default: m.TransactionDetailModal })));
const ClientDossierModal = lazy(() => import('./ClientDossierModal').then(m => ({ default: m.ClientDossierModal })));
const FinanceDocumentVencimentos = lazy(() => import('./FinanceDocumentVencimentos').then(m => ({ default: m.FinanceDocumentVencimentos })));
import { 
  format, 
  parseISO, 
  isAfter, 
  isBefore, 
  isSameMonth, 
  subMonths, 
  eachMonthOfInterval, 
  addDays, 
  startOfDay, 
  endOfDay,
  endOfMonth
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FinancialTransaction, Vehicle, FuelLog, MaintenanceLog, Trip } from '../types';
import { Card } from './Cards';
import { cn } from '../lib/utils';
import { ConfirmModal } from './UI';
import { doc, deleteDoc, collection, query, orderBy, onSnapshot, updateDoc, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanUndefined } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { toast } from 'sonner';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  LineChart,
  Line
} from 'recharts';

const ProfitabilityAnalysis = lazy(() => import('./ProfitabilityAnalysis').then(m => ({ default: m.ProfitabilityAnalysis })));

interface FinanceProps {
  transactions: FinancialTransaction[];
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  maintenance: MaintenanceLog[];
  trips?: Trip[];
  onAddTransaction: (type: 'payable' | 'receivable') => void;
  onUpdateStatus: (id: string, status: 'paid' | 'pending') => void;
  employees?: any[];
  onExportStaffToExcel?: () => void;
  onAddEmployee?: () => void;
  onEditEmployee?: (employee: any) => void;
  onDeleteEmployee?: (id: string, name: string) => void;
  onUpdateEmployeePhoto?: (id: string, photoUrl: string) => Promise<void>;
  user?: any;
  onEditTrip?: (trip: any) => void;
  onDeleteTrip?: (trip: any) => void;
  onViewOS?: (trip: any) => void;
}

/**
 * RECRIAÇÃO DO MÓDULO FINANCEIRO (SOMBRA - SHADOW MODE)
 * Módulo completo com aba de Lembretes Dedicados, filtros por Pacotes de Viagem, 
 * Manutenção de Frota e Estoque Industrial, painel de KPIs e gráficos de fluxo.
 */
export const Finance = React.memo(({ 
  transactions, 
  vehicles, 
  fuelLogs, 
  maintenance, 
  trips = [],
  onAddTransaction, 
  onUpdateStatus,
  employees = [],
  onExportStaffToExcel = () => {},
  onAddEmployee = () => {},
  onEditEmployee = () => {},
  onDeleteEmployee = () => {},
  onUpdateEmployeePhoto,
  user,
  onEditTrip,
  onDeleteTrip,
  onViewOS
}: FinanceProps) => {
  const navigate = useNavigate();
  const [offlineTransactions, setOfflineTransactions] = useState<any[]>(() => {
    return offlineQueue.getQueue()
      .filter((item: any) => item.type === 'financial_transaction')
      .map((item: any) => ({
        ...item.payload,
        id: item.id,
        isPendingSync: true,
        syncStatus: item.status,
        errorMessage: item.errorMessage
      }));
  });

  useEffect(() => {
    const handleQueueChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      const queue = customEvent.detail || offlineQueue.getQueue();
      const txs = queue
        .filter((item: any) => item.type === 'financial_transaction')
        .map((item: any) => ({
          ...item.payload,
          id: item.id,
          isPendingSync: true,
          syncStatus: item.status,
          errorMessage: item.errorMessage
        }));
      setOfflineTransactions(txs);
    };

    window.addEventListener('offline-queue-changed', handleQueueChange);
    return () => {
      window.removeEventListener('offline-queue-changed', handleQueueChange);
    };
  }, []);

  const [clientCharters, setClientCharters] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');
  const [activeTab, setActiveTab] = useState<'overview' | 'reminders' | 'transactions' | 'billing' | 'staff' | 'document_vencimentos' | 'trip_history'>('overview');
  
  // Estados para transações
  const [viewTab, setViewTab] = useState<'active' | 'liquidated'>('active');
  const [filterType, setFilterType] = useState<'all' | 'payable' | 'receivable'>('all');
  const [filterSpecialized, setFilterSpecialized] = useState<'all' | 'travel_package' | 'fleet_maintenance' | 'industrial_stock'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Exclusão e Modais
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string}>({ isOpen: false, id: '' });
  const [selectedBoleto, setSelectedBoleto] = useState<any | null>(null);
  const [selectedTransactionForEdit, setSelectedTransactionForEdit] = useState<FinancialTransaction | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);
  const [selectedDossierClient, setSelectedDossierClient] = useState<any | null>(null);
  const [selectedCardHistory, setSelectedCardHistory] = useState<'received_entries' | 'future_entries' | 'expenses_month' | 'pending_payable' | null>(null);
  const [selectedHistoryItemIds, setSelectedHistoryItemIds] = useState<string[]>([]);
  const [selectedClientTripForEdit, setSelectedClientTripForEdit] = useState<any | null>(null);

  // Estados e funções para cadastrar novo cliente diretamente no Financeiro
  const [showRegisterClientForm, setShowRegisterClientForm] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    companyName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    defaultTripValue: 0,
    extraTripsNotes: '',
    extraWorksNotes: ''
  });

  const handleAddClientSubmit = async () => {
    if (!newClient.name) {
      toast.error("Insira o nome fantasia do cliente.");
      return;
    }
    const toastId = toast.loading("Cadastrando cliente...");
    try {
      await addDoc(collection(db, 'charter_clients'), cleanUndefined({
        ...newClient,
        createdAt: new Date().toISOString()
      }));
      setShowRegisterClientForm(false);
      setNewClient({
        name: '',
        companyName: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        defaultTripValue: 0,
        extraTripsNotes: '',
        extraWorksNotes: ''
      });
      toast.success("Cliente cadastrado no banco de dados!", { id: toastId });
    } catch (e) {
      toast.error("Erro ao cadastrar cliente.", { id: toastId });
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  // Estados para Histórico de Viagens
  const [tripSearchTerm, setTripSearchTerm] = useState('');
  const [tripPaymentFilter, setTripPaymentFilter] = useState<'all' | 'A Receber' | 'Faturado' | 'Pago'>('all');

  const filteredTrips = useMemo(() => {
    const list = trips.filter(t => {
      const matchesSearch = !tripSearchTerm || 
        t.title?.toLowerCase().includes(tripSearchTerm.toLowerCase()) || 
        t.client?.toLowerCase().includes(tripSearchTerm.toLowerCase()) ||
        t.osNumber?.toLowerCase().includes(tripSearchTerm.toLowerCase());
      
      const statusVal = t.paymentStatus || 'A Receber';
      const matchesPayment = tripPaymentFilter === 'all' || statusVal === tripPaymentFilter;
      
      return matchesSearch && matchesPayment;
    });

    const getStatusOrder = (status: string) => {
      const s = (status || '').toLowerCase().trim();
      if (s === 'scheduled' || s === 'agendado') return 1;
      if (s === 'active' || s === 'em curso' || s === 'em_andamento') return 2;
      if (s === 'completed' || s === 'fim' || s === 'concluido' || s === 'finalizado') return 3;
      if (s === 'cancelled' || s === 'cancelado') return 4;
      return 99;
    };

    return [...list].sort((a, b) => {
      const orderA = getStatusOrder(a.status || 'scheduled');
      const orderB = getStatusOrder(b.status || 'scheduled');
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      // Secondary sort: start date descending (most recent first within same status)
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  }, [trips, tripSearchTerm, tripPaymentFilter]);

  const tripsPendingAmount = useMemo(() => {
    return trips
      .filter(t => !t.paymentStatus || t.paymentStatus === 'A Receber')
      .reduce((acc, t) => acc + (t.tripValue || 0), 0);
  }, [trips]);

  const tripsBilledAmount = useMemo(() => {
    return trips
      .filter(t => t.paymentStatus === 'Faturado')
      .reduce((acc, t) => acc + (t.tripValue || 0), 0);
  }, [trips]);

  const tripsPaidAmount = useMemo(() => {
    return trips
      .filter(t => t.paymentStatus === 'Pago')
      .reduce((acc, t) => acc + (t.tripValue || 0), 0);
  }, [trips]);

  const handleUpdateTripPaymentStatus = async (tripId: string, newStatus: 'A Receber' | 'Faturado' | 'Pago') => {
    const toastId = toast.loading('Salvando status de faturamento da viagem...');
    try {
      // 1. Update Trip
      await updateDoc(doc(db, 'trips', tripId), cleanUndefined({ paymentStatus: newStatus }));
      
      // 2. Update corresponding financial transaction
      const txQuery = query(
        collection(db, 'financial_transactions'),
        where('refId', '==', tripId),
        where('refType', '==', 'trip')
      );
      const txSnap = await getDocs(txQuery);
      if (!txSnap.empty) {
        for (const txDoc of txSnap.docs) {
          await updateDoc(doc(db, 'financial_transactions', txDoc.id), cleanUndefined({
            status: newStatus === 'Pago' ? 'paid' : 'pending',
            paymentDate: newStatus === 'Pago' ? new Date().toISOString().split('T')[0] : null
          }));
        }
      } else {
        // If no financial transaction exists, create it in real-time to allow proper financial management
        const tripDoc = trips.find(t => t.id === tripId);
        if (tripDoc) {
          const nowStr = new Date().toISOString();
          const transactionData = {
            type: 'receivable' as const,
            category: 'Viagem',
            description: `RECEITA DE VIAGEM - ${tripDoc.title} (OS: ${tripDoc.osNumber || '---'})`,
            supplier: tripDoc.client || 'Avulso',
            amount: Number(tripDoc.tripValue) || 0,
            dueDate: tripDoc.startDate ? tripDoc.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
            status: (newStatus === 'Pago' ? 'paid' : 'pending') as 'paid' | 'pending',
            paymentDate: newStatus === 'Pago' ? new Date().toISOString().split('T')[0] : null,
            refId: tripId,
            refType: 'trip' as const,
            createdAt: nowStr,
            updatedAt: nowStr
          };
          await addDoc(collection(db, 'financial_transactions'), cleanUndefined(transactionData));
        }
      }
      toast.success(`Status da viagem alterado para: ${newStatus}`, { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Erro ao atualizar faturamento da viagem.', { id: toastId });
    }
  };

  const allTransactions = useMemo(() => {
    return [...offlineTransactions, ...transactions];
  }, [offlineTransactions, transactions]);

  const selectedDossierClientTrips = useMemo(() => {
    if (!selectedDossierClient) return [];
    
    // 1. Fretamento client trips
    const fTrips = clientCharters
      .filter(trip => 
        trip.clientId === selectedDossierClient.id || 
        trip.client?.toLowerCase() === selectedDossierClient.name?.toLowerCase()
      )
      .map(trip => ({
        ...trip,
        sourceType: 'fretamento',
        dateTime: trip.dateTime || trip.createdAt || '',
        description: trip.description || `Fretamento: ${trip.origin || ''} -> ${trip.destination || ''}`,
        value: trip.isExtra ? (trip.value || 0) : (selectedDossierClient.defaultTripValue || trip.value || 0),
        extraValue: (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : '',
        extraDesc: (trip.hasExtraService && trip.extraServiceDesc) ? trip.extraServiceDesc : '',
        paymentStatus: trip.paymentStatus || 'open',
        notes: (trip as any).notes || ''
      }));

    // 2. Turismo general trips
    const tTrips = (trips || [])
      .filter(trip => 
        trip.client?.toLowerCase() === selectedDossierClient.name?.toLowerCase()
      )
      .map(trip => {
        let pStatus = 'open';
        if (trip.paymentStatus === 'Pago') pStatus = 'received';
        else if (trip.paymentStatus === 'Faturado') pStatus = 'billed';
        else if (trip.paymentStatus === 'A Receber') pStatus = 'open';

        return {
          id: trip.id,
          sourceType: 'turismo',
          dateTime: trip.startDate ? `${trip.startDate}T00:00:00` : '',
          description: trip.title || `Turismo: ${trip.origin || ''} -> ${trip.destination || ''}`,
          driverId: (trip as any).driverId || '',
          vehicleId: (trip as any).vehicleId || '',
          value: trip.tripValue || 0,
          extraValue: 0,
          extraDesc: '',
          paymentStatus: pStatus,
          notes: trip.notes || ''
        };
      });

    return [...fTrips, ...tTrips].sort((a, b) => b.dateTime.localeCompare(a.dateTime));
  }, [selectedDossierClient, clientCharters, trips]);

  useEffect(() => {
    const unsubTrips = dbCacheService.subscribeCollection('charter_client_trips', (list) => {
      setClientCharters(list);
    });
    
    const unsubClients = dbCacheService.subscribeCollection('charter_clients', (list) => {
      setClients(list);
    });
    
    return () => {
      unsubTrips();
      unsubClients();
    };
  }, []);

  const clientSummaries = useMemo(() => {
    const registeredSummaries = clients.map(client => {
      const clientTrips = clientCharters.filter(trip => 
        trip.clientId === client.id || 
        trip.client?.toLowerCase() === client.name?.toLowerCase()
      );

      const turismoTrips = (trips || []).filter(trip =>
        trip.client?.toLowerCase() === client.name?.toLowerCase()
      );

      const clientTx = allTransactions.filter(t => 
        t.type === 'receivable' && (
          t.supplier?.toLowerCase() === client.name?.toLowerCase() ||
          (t as any).provider?.toLowerCase() === client.name?.toLowerCase() ||
          t.description?.toLowerCase().includes(`- ${client.name.toLowerCase()}`) ||
          t.description?.toLowerCase().includes(`fretamento por cliente - ${client.name.toLowerCase()}`)
        )
      );

      const totalTrips = clientTrips.length + turismoTrips.length;
      const totalBilled = clientTx.reduce((sum, t) => sum + t.amount, 0);

      const pendingTx = clientTx.filter(t => t.status !== 'paid');
      const sortedPending = [...pendingTx].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const nextExpectedDate = sortedPending.length > 0 
        ? format(parseISO(sortedPending[0].dueDate), 'dd/MM/yyyy') 
        : 'LIQUIDADO';

      return {
        id: client.id,
        name: client.name,
        companyName: client.companyName || '',
        totalTrips,
        totalBilled,
        nextExpectedDate,
        isRegistered: true
      };
    });

    const registeredNames = new Set(clients.map(c => c.name.toLowerCase()));
    const unregisteredClients: { [key: string]: { name: string, tripsCount: number, txs: any[] } } = {};

    clientCharters.forEach(trip => {
      if (trip.client) {
        const nameLower = trip.client.toLowerCase();
        if (!registeredNames.has(nameLower)) {
          if (!unregisteredClients[nameLower]) {
            unregisteredClients[nameLower] = { name: trip.client, tripsCount: 0, txs: [] };
          }
          unregisteredClients[nameLower].tripsCount += 1;
        }
      }
    });

    (trips || []).forEach(trip => {
      if (trip.client) {
        const nameLower = trip.client.toLowerCase();
        if (!registeredNames.has(nameLower)) {
          if (!unregisteredClients[nameLower]) {
            unregisteredClients[nameLower] = { name: trip.client, tripsCount: 0, txs: [] };
          }
          unregisteredClients[nameLower].tripsCount += 1;
        }
      }
    });

    allTransactions.forEach(t => {
      if (t.type === 'receivable') {
        const clientNameRaw = t.supplier || (t as any).provider;
        let clientName = clientNameRaw;
        
        if (!clientName && t.description) {
          const match = t.description.match(/FECHAMENTO DE FRETAMENTO POR CLIENTE - ([^(]+)/i);
          if (match && match[1]) {
            clientName = match[1].trim();
          }
        }

        if (clientName) {
          const nameLower = clientName.toLowerCase();
          if (!registeredNames.has(nameLower)) {
            if (!unregisteredClients[nameLower]) {
              unregisteredClients[nameLower] = { name: clientName, tripsCount: 0, txs: [] };
            }
            unregisteredClients[nameLower].txs.push(t);
          }
        }
      }
    });

    const unregisteredSummaries = Object.values(unregisteredClients).map(item => {
      const totalTrips = item.tripsCount;
      const clientTx = allTransactions.filter(t => 
        t.type === 'receivable' && (
          t.supplier?.toLowerCase() === item.name.toLowerCase() ||
          (t as any).provider?.toLowerCase() === item.name.toLowerCase() ||
          t.description?.toLowerCase().includes(`- ${item.name.toLowerCase()}`)
        )
      );

      const totalBilled = clientTx.reduce((sum, t) => sum + t.amount, 0);
      const pendingTx = clientTx.filter(t => t.status !== 'paid');
      const sortedPending = [...pendingTx].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      const nextExpectedDate = sortedPending.length > 0 
        ? format(parseISO(sortedPending[0].dueDate), 'dd/MM/yyyy') 
        : 'LIQUIDADO';

      return {
        id: `unreg-${item.name}`,
        name: item.name.toUpperCase(),
        companyName: 'AVULSO / NÃO SINC.',
        totalTrips,
        totalBilled,
        nextExpectedDate,
        isRegistered: false
      };
    });

    return [...registeredSummaries, ...unregisteredSummaries];
  }, [clients, clientCharters, allTransactions, trips]);

  const now = useMemo(() => startOfDay(new Date()), []);
  const next15Days = useMemo(() => addDays(now, 15), [now]);

  // Controles de Vencimentos & Lembretes
  const overdueBills = useMemo(() => {
    return allTransactions.filter(t => 
      t.status !== 'paid' && 
      isBefore(parseISO(t.dueDate), now)
    );
  }, [allTransactions, now]);

  const billsDueNext15Days = useMemo(() => {
    return allTransactions.filter(t => 
      t.status !== 'paid' && 
      isAfter(parseISO(t.dueDate), now) && 
      isBefore(parseISO(t.dueDate), next15Days)
    );
  }, [allTransactions, now, next15Days]);

  const billsDueThisMonth = useMemo(() => {
    return allTransactions.filter(t => 
      t.status !== 'paid' && 
      isSameMonth(parseISO(t.dueDate), now)
    );
  }, [allTransactions, now]);

  const getDaysDifference = (dateStr: string) => {
    const dDate = startOfDay(parseISO(dateStr));
    const diffTime = dDate.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const handleExportRemindersPDF = async (type: 'overdue' | 'next15' | 'thisMonth') => {
    let bills: FinancialTransaction[] = [];
    let title = '';
    let filename = '';
    
    if (type === 'overdue') {
      bills = overdueBills;
      title = 'LEMBRETE FINANCEIRO: TITULOS EM ATRASO';
      filename = 'lembrete_titulos_atrasados.pdf';
    } else if (type === 'next15') {
      bills = billsDueNext15Days;
      title = 'LEMBRETE FINANCEIRO: VENCIMENTOS PROXIMOS 15 DIAS';
      filename = 'lembrete_proximos_15_dias.pdf';
    } else {
      bills = billsDueThisMonth;
      title = 'LEMBRETE FINANCEIRO: CONTAS DO MES ATUAL';
      filename = 'lembrete_contas_este_mes.pdf';
    }

    if (bills.length === 0) {
      toast.info('NÃO HÁ LANÇAMENTOS DE LEMBRETES PARA EXPORTAR PARA ESTA CATEGORIA.');
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;
      
      // Header estilo DM Turismo (#1a50f1 ou RGB 26, 80, 241)
      doc.setFillColor(24, 24, 27); // Zinc-900 / Fundo
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(26, 80, 241); // brand-accent
      doc.text('DM TURISMO', 14, 18);
      
      doc.setFontSize(10);
      doc.setTextColor(161, 161, 170); // zinc-400
      doc.text('SISTEMA INTEGRADO DE GESTÃO FINANCEIRA E LEMBRETES', 14, 25);
      doc.text(`EMITIDO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 32);

      doc.setDrawColor(26, 80, 241);
      doc.setLineWidth(1.5);
      doc.line(0, 40, 210, 40);

      doc.setFontSize(13);
      doc.setTextColor(24, 24, 27);
      doc.text(title, 14, 52);

      const totalAmount = bills.reduce((sum, b) => sum + b.amount, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(82, 82, 91);
      
      doc.text(`Total de títulos listados: `, 14, 62);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(24, 24, 27);
      doc.text(`${bills.length} títulos`, 54, 62);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(82, 82, 91);
      doc.text(`Soma total pendente: `, 100, 62);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.text(`R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 136, 62);

      const tableData = bills.map(b => {
        const formattedDueDate = format(parseISO(b.dueDate), 'dd/MM/yyyy');
        const diffDays = getDaysDifference(b.dueDate);
        let statusText = '';
        if (diffDays < 0) {
          statusText = `${Math.abs(diffDays)} dia(s) atrasado`;
        } else if (diffDays === 0) {
          statusText = 'Vence hoje';
        } else {
          statusText = `Vence em ${diffDays} dia(s)`;
        }

        return [
          formattedDueDate,
          (b.description || '').toUpperCase(),
          (b.supplier || 'N/A').toUpperCase(),
          (b.category || '').toUpperCase(),
          statusText.toUpperCase(),
          `R$ ${b.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: 70,
        head: [['VENCIMENTO', 'DESCRIÇÃO', 'CLIENTE/FORNECEDOR', 'CATEGORIA', 'SITUAÇÃO', 'VALOR']],
        body: tableData,
        theme: 'grid',
        headStyles: { 
          fillColor: [24, 24, 27], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          halign: 'center',
          fontSize: 8
        },
        bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'left' },
          4: { halign: 'center', fontStyle: 'bold' },
          5: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        margin: { left: 14, right: 14 }
      });

      doc.save(filename);
      toast.success(`Relatório PDF gerado com sucesso: "${filename}"`);
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      toast.error('Erro ao gerar o PDF de lembretes.');
    }
  };

  const currentMonthTransactions = useMemo(() => {
    return allTransactions.filter(t => isSameMonth(parseISO(t.dueDate), now));
  }, [allTransactions, now]);

  const cardHistoryItems = useMemo(() => {
    if (!selectedCardHistory) return [];

    switch (selectedCardHistory) {
      case 'received_entries': {
        const normalReceivables = currentMonthTransactions
          .filter(t => t.type === 'receivable')
          .map(t => ({
            id: t.id,
            originType: 'transaction' as const,
            date: t.dueDate,
            description: t.description,
            party: t.supplier || (t as any).provider || 'Vários',
            value: t.amount,
            status: t.status === 'paid' ? 'paid' : 'pending',
            category: t.category || 'Receita Geral',
            raw: t
          }));

        const receivedTrips = clientCharters
          .filter(c => c.status !== 'cancelled' && c.paymentStatus === 'received')
          .map(c => {
            const clientObj = clients.find(cl => cl.id === c.clientId || cl.name?.toLowerCase() === c.client?.toLowerCase());
            const baseVal = c.isExtra ? (c.value || 0) : ((clientObj?.defaultTripValue) || c.value || 0);
            const extraVal = (c.hasExtraService && c.extraServiceVal) ? c.extraServiceVal : 0;
            const finalVal = baseVal + extraVal;
            
            return {
              id: c.id,
              originType: 'charter' as const,
              date: c.dateTime,
              description: c.description || 'Fretamento Contratado',
              party: c.client || 'Cliente Fretamento',
              value: finalVal,
              status: 'paid',
              category: c.isExtra ? 'Viagem Extra' : 'Fretamento Mensal',
              raw: c
            };
          });

        return [...normalReceivables, ...receivedTrips].sort((a, b) => b.date.localeCompare(a.date));
      }

      case 'future_entries': {
        const futureTrips = clientCharters
          .filter(c => c.status !== 'cancelled' && (c.paymentStatus === 'open' || c.paymentStatus === 'billed'))
          .map(c => {
            const clientObj = clients.find(cl => cl.id === c.clientId || cl.name?.toLowerCase() === c.client?.toLowerCase());
            const baseVal = c.isExtra ? (c.value || 0) : ((clientObj?.defaultTripValue) || c.value || 0);
            const extraVal = (c.hasExtraService && c.extraServiceVal) ? c.extraServiceVal : 0;
            const finalVal = baseVal + extraVal;

            return {
              id: c.id,
              originType: 'charter' as const,
              date: c.dateTime,
              description: c.description || 'Fretamento Contratado',
              party: c.client || 'Cliente Fretamento',
              value: finalVal,
              status: c.paymentStatus === 'billed' ? 'billed' : 'pending',
              category: c.isExtra ? 'Viagem Extra' : 'Fretamento Mensal',
              raw: c
            };
          });

        return futureTrips.sort((a, b) => b.date.localeCompare(a.date));
      }

      case 'expenses_month': {
        return currentMonthTransactions
          .filter(t => t.type === 'payable')
          .map(t => ({
            id: t.id,
            originType: 'transaction' as const,
            date: t.dueDate,
            description: t.description,
            party: t.supplier || (t as any).provider || 'Fornecedor',
            value: t.amount,
            status: t.status === 'paid' ? 'paid' : 'pending',
            category: t.category || 'Despesa Geral',
            raw: t
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }

      case 'pending_payable': {
        return currentMonthTransactions
          .filter(t => t.type === 'payable' && t.status !== 'paid')
          .map(t => ({
            id: t.id,
            originType: 'transaction' as const,
            date: t.dueDate,
            description: t.description,
            party: t.supplier || (t as any).provider || 'Fornecedor',
            value: t.amount,
            status: 'pending',
            category: t.category || 'Despesa Geral',
            raw: t
          }))
          .sort((a, b) => b.date.localeCompare(a.date));
      }

      default:
        return [];
    }
  }, [selectedCardHistory, currentMonthTransactions, clientCharters, clients]);

  useEffect(() => {
    if (selectedCardHistory) {
      setSelectedHistoryItemIds(cardHistoryItems.map(item => item.id));
    } else {
      setSelectedHistoryItemIds([]);
    }
  }, [selectedCardHistory, cardHistoryItems]);

  const handleExportMonthlyReportPDF = async () => {
    if (currentMonthTransactions.length === 0) {
      toast.warning('NÃO EXISTEM LANÇAMENTOS FINANCEIROS REGISTRADOS PARA O MÊS ATUAL.');
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;

      const monthName = format(now, 'MMMM / yyyy', { locale: ptBR }).toUpperCase();
      const filename = `relatorio_mensal_${format(now, 'MM_yyyy')}.pdf`;

      // Header style: Deep Azul del Rey base [0, 18, 51]
      doc.setFillColor(0, 18, 51); // Deep Midnight Royal Blue
      doc.rect(0, 0, 210, 42, 'F');

      // Decorative Gold border line [212, 175, 55] (Horizon Gold #D4AF37)
      doc.setFillColor(212, 175, 55); 
      doc.rect(0, 42, 210, 2, 'F');

      // Header Text (White + Gold)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(255, 255, 255); // White
      doc.text('DM TURISMO', 14, 18);

      // Gold Subtext
      doc.setFontSize(10);
      doc.setTextColor(212, 175, 55); // Gold
      doc.text('RELATÓRIO FINANCEIRO CONSOLIDADO DO MÊS', 14, 26);

      // System details
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.setFont('helvetica', 'normal');
      doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 33);
      doc.text(`MÊS DE REFERÊNCIA: ${monthName}`, 14, 38);

      // Section Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(0, 18, 51);
      doc.text(`DEMONSTRATIVO DE FLUXO DE CAIXA - ${monthName}`, 14, 56);

      // Consolidated Totals calculations
      const totalReceivableCurrent = currentMonthTransactions
        .filter(t => t.type === 'receivable')
        .reduce((acc, t) => acc + t.amount, 0);

      const totalPayableCurrent = currentMonthTransactions
        .filter(t => t.type === 'payable')
        .reduce((acc, t) => acc + t.amount, 0);

      const netBalanceCurrent = totalReceivableCurrent - totalPayableCurrent;

      const paidTransactions = currentMonthTransactions
        .filter(t => t.status === 'paid')
        .reduce((acc, t) => acc + t.amount, 0);

      const pendingTransactions = currentMonthTransactions
        .filter(t => t.status !== 'paid')
        .reduce((acc, t) => acc + t.amount, 0);

      // Draw Key KPI Cards (Tables styled box) using jsPDF draw calls
      doc.setFillColor(248, 250, 252); // Soft light blue-grey background
      doc.rect(14, 63, 182, 24, 'F');
      doc.setDrawColor(212, 175, 55); // Gold border
      doc.setLineWidth(0.5);
      doc.rect(14, 63, 182, 24, 'D');

      // Content inside the consolidated card
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139); // Slate text color
      doc.text('TOTAL RECEITAS (ENTRADAS)', 18, 71);
      doc.text('TOTAL DESPESAS (SAÍDAS)', 76, 71);
      doc.text('SALDO LÍQUIDO CONSOLIDADO', 134, 71);

      // Values inside card
      doc.setFontSize(12);
      doc.setTextColor(34, 197, 94); // Green
      doc.text(`R$ ${totalReceivableCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 80);

      doc.setTextColor(239, 68, 68); // Red
      doc.text(`R$ ${totalPayableCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 76, 80);

      if (netBalanceCurrent >= 0) {
        doc.setTextColor(34, 197, 94); // Green positive balance
      } else {
        doc.setTextColor(239, 68, 68); // Red negative balance
      }
      doc.text(`R$ ${netBalanceCurrent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 134, 80);

      // Additional breakdown
      doc.setFontSize(8.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Total Liquidado (Pago): R$ ${paidTransactions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 93);
      doc.text(`Total Pendente: R$ ${pendingTransactions.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 100, 93);
      doc.text(`Transações Registradas: ${currentMonthTransactions.length}`, 164, 93);

      // Let's build table data
      const tableData = currentMonthTransactions.map(t => {
        const dateFormatted = format(parseISO(t.dueDate), 'dd/MM/yyyy');
        const typeText = t.type === 'receivable' ? 'ENTRADA' : 'SAÍDA';
        const statusText = t.status === 'paid' ? 'LIQUIDADO' : 'PENDENTE';
        return [
          dateFormatted,
          (t.description || '').toUpperCase(),
          (t.supplier || 'N/A').toUpperCase(),
          (t.category || '').toUpperCase(),
          typeText,
          statusText,
          `R$ ${t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: 98,
        head: [['VENCIMENTO', 'DESCRIÇÃO', 'CLIENTE/FORNECEDOR', 'CATEGORIA', 'TIPO', 'SITUAÇÃO', 'VALOR']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: [0, 18, 51], // Royal Blue Dark
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
        columnStyles: {
          0: { halign: 'center', fontStyle: 'bold' },
          1: { halign: 'left' },
          2: { halign: 'left' },
          3: { halign: 'left' },
          4: { halign: 'center', fontStyle: 'bold' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      doc.save(filename);
      toast.success(`Relatório consolidado gerado com sucesso: "${filename}"`);
    } catch (error) {
      console.error('Erro ao exportar relatório mensal:', error);
      toast.error('Erro ao gerar relatório mensal em PDF.');
    }
  };

  const lastMonths = useMemo(() => {
    return eachMonthOfInterval({
      start: subMonths(now, 5),
      end: now
    });
  }, [now]);

  const chartData = useMemo(() => {
    return lastMonths.map(month => {
      const monthTransactions = allTransactions.filter(t => isSameMonth(parseISO(t.dueDate), month));
      const income = monthTransactions
        .filter(t => t.type === 'receivable')
        .reduce((acc, t) => acc + t.amount, 0);
      const expenses = monthTransactions
        .filter(t => t.type === 'payable')
        .reduce((acc, t) => acc + t.amount, 0);
      
      return {
        name: format(month, 'MMM', { locale: ptBR }).toUpperCase(),
        receita: income,
        despesa: expenses
      };
    });
  }, [lastMonths, allTransactions]);

  const totalReceivable = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'receivable')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [currentMonthTransactions]);

  const totalPayable = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'payable')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [currentMonthTransactions]);

  const pendingPayable = useMemo(() => {
    return currentMonthTransactions
      .filter(t => t.type === 'payable' && t.status !== 'paid')
      .reduce((acc, t) => acc + t.amount, 0);
  }, [currentMonthTransactions]);

  const openCharterBalance = useMemo(() => {
    return clientCharters
      .filter(c => c.status !== 'cancelled' && c.paymentStatus === 'open')
      .reduce((acc, c) => {
        const clientObj = clients.find(cl => cl.id === c.clientId || cl.name?.toLowerCase() === c.client?.toLowerCase());
        const baseVal = c.isExtra ? (c.value || 0) : ((clientObj?.defaultTripValue) || c.value || 0);
        const extraVal = (c.hasExtraService && c.extraServiceVal) ? c.extraServiceVal : 0;
        return acc + (baseVal + extraVal);
      }, 0);
  }, [clientCharters, clients]);

  const billedCharterBalance = useMemo(() => {
    return clientCharters
      .filter(c => c.status !== 'cancelled' && c.paymentStatus === 'billed')
      .reduce((acc, c) => {
        const clientObj = clients.find(cl => cl.id === c.clientId || cl.name?.toLowerCase() === c.client?.toLowerCase());
        const baseVal = c.isExtra ? (c.value || 0) : ((clientObj?.defaultTripValue) || c.value || 0);
        const extraVal = (c.hasExtraService && c.extraServiceVal) ? c.extraServiceVal : 0;
        return acc + (baseVal + extraVal);
      }, 0);
  }, [clientCharters, clients]);

  const futureReceipts = useMemo(() => {
    return openCharterBalance + billedCharterBalance;
  }, [openCharterBalance, billedCharterBalance]);

  const receivedChartersTotal = useMemo(() => {
    return clientCharters
      .filter(c => c.status !== 'cancelled' && c.paymentStatus === 'received')
      .reduce((acc, c) => {
        const clientObj = clients.find(cl => cl.id === c.clientId || cl.name?.toLowerCase() === c.client?.toLowerCase());
        const baseVal = c.isExtra ? (c.value || 0) : ((clientObj?.defaultTripValue) || c.value || 0);
        const extraVal = (c.hasExtraService && c.extraServiceVal) ? c.extraServiceVal : 0;
        return acc + (baseVal + extraVal);
      }, 0);
  }, [clientCharters, clients]);

  // Transações filtradas com suporte aos novos focos
  const filteredTransactions = useMemo(() => {
    return allTransactions.filter(t => {
      const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           (t.supplier?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                           t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (t.observations?.toLowerCase() || '').includes(searchTerm.toLowerCase());
                           
      // Filtrar por sub-tipo especializado
      let matchesSpecialized = true;
      if (filterSpecialized !== 'all') {
        const specializedType = (t as any).specializedFields?.subType || '';
        matchesSpecialized = specializedType === filterSpecialized;
      }

      if (activeTab === 'transactions') {
        const matchesStatusTab = viewTab === 'active' ? t.status !== 'paid' : t.status === 'paid';
        const matchesType = filterType === 'all' || t.type === filterType;
        return matchesSearch && matchesType && matchesStatusTab && matchesSpecialized;
      } else if (activeTab === 'reminders') {
        // Na aba de lembretes mostramos apenas pendentes
        return t.status !== 'paid' && matchesSearch && matchesSpecialized;
      }
      return matchesSearch && matchesSpecialized;
    });
  }, [allTransactions, searchTerm, activeTab, viewTab, filterType, filterSpecialized, now]);

  const processDelete = async () => {
    try {
      if (deleteConfirm.id.includes('_') && !deleteConfirm.id.startsWith('unreg-')) {
        // If it contains '_' and is not an unregistered summary, it's a local offline ID from offlineQueue
        offlineQueue.removeItem(deleteConfirm.id);
        toast.success('Lançamento removido dos envios pendentes com sucesso!');
      } else {
        await deleteDoc(doc(db, 'financial_transactions', deleteConfirm.id));
        toast.success('Lançamento removido definitivamente!');
      }
    } catch (error) {
      toast.error('Erro ao excluir transação.');
    } finally {
      setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleDeleteCharterTrip = async (id: string) => {
    const isConfirmed = window.confirm("Tem certeza de que deseja apagar este fretamento/serviço realizado? Esta ação removerá o registro permanentemente das contabilidades.");
    if (!isConfirmed) return;
    try {
      await deleteDoc(doc(db, 'charter_client_trips', id));
      toast.success("Serviço de fretamento excluído com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir o serviço de fretamento.");
    }
  };

  const getSpecializedBadge = (t: any) => {
    const sub = t.specializedFields?.subType || '';
    if (sub === 'travel_package') {
      return (
        <span className="flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono uppercase">
          <Bus size={10} /> Pacote
        </span>
      );
    }
    if (sub === 'fleet_maintenance') {
      return (
        <span className="flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-md bg-[#ff6b00]/10 text-[#ff6b00] border border-[#ff6b00]/20 font-mono uppercase">
          <Wrench size={10} /> Frota
        </span>
      );
    }
    if (sub === 'industrial_stock') {
      return (
        <span className="flex items-center gap-1 text-[8px] font-black px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono uppercase">
          <Package size={10} /> Estoque
        </span>
      );
    }
    return null;
  };

  const generateHistoryReportPdf = async () => {
    const itemsToExport = cardHistoryItems.filter(item => selectedHistoryItemIds.includes(item.id));
    if (itemsToExport.length === 0) {
      toast.warning('Nenhum item selecionado neste histórico para gerar dossiê.');
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;

      const titleMap = {
        'received_entries': 'DOSSIÊ DE HISTÓRICO: RESUMO DE ENTRADAS',
        'future_entries': 'DOSSIÊ DE HISTÓRICO: FUTURAS ENTRADAS',
        'expenses_month': 'DOSSIÊ DE HISTÓRICO: DESPESAS (MÊS)',
        'pending_payable': 'DOSSIÊ DE HISTÓRICO: A PAGAR (PENDENTES)'
      };

      const title = titleMap[selectedCardHistory || 'received_entries'] || 'DOSSIÊ DE HISTÓRICO FINANCEIRO';
      const dateStr = format(new Date(), 'dd/MM/yyyy HH:mm');

      // Cabeçalho Premium
      doc.setFillColor(15, 23, 42); // Navy / Asphalt escuro
      doc.rect(0, 0, 210, 40, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('DM TURISMO - GESTÃO CONTÁBIL', 14, 18);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(title, 14, 25);
      doc.text(`Gerado em: ${dateStr}`, 14, 32);

      // Linha de Divisão Dourada/Destaque
      doc.setFillColor(212, 175, 55); // Dourado
      doc.rect(0, 40, 210, 2, 'F');

      // Informações gerais
      doc.setFontSize(9);
      doc.setTextColor(75, 85, 99);
      doc.text('Este dossiê contábil reúne todos os lançamentos ativos listados na categoria selecionada para fins de auditoria interna.', 14, 52);

      // Tabela de Itens
      const tableRows = itemsToExport.map((item, idx) => {
        let fmtDate = item.date;
        try {
          fmtDate = item.date.includes('T')
            ? format(new Date(item.date), 'dd/MM/yyyy HH:mm')
            : format(parseISO(item.date), 'dd/MM/yyyy');
        } catch (e) {}

        const statusMap = {
          'paid': 'PAGO',
          'pending': 'EM ABERTO',
          'billed': 'FATURADO'
        };

        return [
          String(idx + 1).padStart(2, '0'),
          fmtDate,
          item.description.toUpperCase(),
          item.party.toUpperCase(),
          item.category.toUpperCase(),
          statusMap[item.status as keyof typeof statusMap] || 'PENDENTE',
          `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(doc, {
        startY: 60,
        head: [['#', 'Data', 'Descrição / Serviço', 'Parceiro / Cliente', 'Categoria', 'Status', 'Valor']],
        body: tableRows,
        theme: 'striped',
        styles: {
          fontSize: 8,
          font: 'helvetica',
          cellPadding: 3
        },
        headStyles: {
          fillColor: [15, 23, 42],
          textColor: [255, 255, 255],
          fontStyle: 'bold'
        },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'left' },
          5: { halign: 'center', fontStyle: 'bold' },
          6: { halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      // Rodapé com Totais
      const totalAmount = itemsToExport.reduce((acc, i) => acc + i.value, 0);
      const finalY = (doc as any).lastAutoTable.finalY + 15;

      doc.setFillColor(241, 245, 249);
      doc.rect(14, finalY, 182, 18, 'F');

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('DEMONSTRATIVO CONSOLIDADO DO HISTÓRICO', 18, finalY + 7);

      doc.setFontSize(11);
      doc.setTextColor(220, 38, 38);
      doc.text(`VALOR TOTAL ACUMULADO: R$ ${totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, finalY + 13);

      doc.save(`dossie_financeiro_${selectedCardHistory}.pdf`);
      toast.success('Dossiê do histórico gerado em PDF com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF do histórico.');
    }
  };

  const generateIndividualItemPdf = async (item: any) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const doc = new jsPDF() as any;

      let fmtDate = item.date;
      try {
        fmtDate = item.date.includes('T')
          ? format(new Date(item.date), 'dd/MM/yyyy HH:mm')
          : format(parseISO(item.date), 'dd/MM/yyyy');
      } catch (e) {}

      // Cabeçalho do Dossiê Individual
      doc.setFillColor(15, 23, 42); // Navy / Asphalt
      doc.rect(0, 0, 210, 45, 'F');

      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('DM TURISMO - DOSSIÊ FINANCEIRO INDIVIDUAL', 14, 20);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(156, 163, 175);
      doc.text(`Identificador de Origem: ${item.originType.toUpperCase()}-${item.id}`, 14, 28);
      doc.text(`Data de Emissão do Documento: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 14, 34);

      // Linha dourada
      doc.setFillColor(212, 175, 55);
      doc.rect(0, 45, 210, 2, 'F');

      // Detalhes em Grid
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text('DETALHAMENTO TÉCNICO E CONTÁBIL', 14, 60);

      doc.setDrawColor(226, 232, 240);
      doc.line(14, 63, 196, 63);

      const fields = [
        { label: 'SERVIÇO / DESCRIÇÃO:', val: item.description.toUpperCase() },
        { label: 'PARCEIRO / CLIENTE:', val: item.party.toUpperCase() },
        { label: 'VALOR DO REGISTRO:', val: `R$ ${item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` },
        { label: 'DATA DO REGISTRO:', val: fmtDate },
        { label: 'CATEGORIA CONTÁBIL:', val: item.category.toUpperCase() },
        { label: 'SITUAÇÃO DO LANÇAMENTO:', val: item.status === 'paid' ? 'PAGO / LIQUIDADO' : (item.status === 'billed' ? 'FATURADO' : 'EM ABERTO / PENDENTE') },
        { label: 'MÓDULO DE ORIGEM:', val: item.originType === 'transaction' ? 'FINANCEIRO CENTRAL' : 'FRETAMENTO DE CLIENTES' }
      ];

      let currentY = 73;
      fields.forEach(f => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text(f.label, 14, currentY);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(f.val, 70, currentY);

        doc.setDrawColor(241, 245, 249);
        doc.line(14, currentY + 3, 196, currentY + 3);
        currentY += 11;
      });

      // Se houver observações ou dados adicionais do registro bruto
      if (item.raw?.observations) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text('OBSERVAÇÕES ADICIONAIS:', 14, currentY + 5);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(item.raw.observations.toUpperCase(), 14, currentY + 12, { maxWidth: 180 });
      } else if (item.raw?.origin || item.raw?.destination) {
        // Para fretamentos, rota / passageiros
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(75, 85, 99);
        doc.text('ROTA / LOGÍSTICA DO TRANSPORTE:', 14, currentY + 5);

        const routeStr = `ORIGEM: ${item.raw.origin || 'NÃO ESPECIFICADA'}  |  DESTINO: ${item.raw.destination || 'NÃO ESPECIFICADO'}`;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(15, 23, 42);
        doc.text(routeStr.toUpperCase(), 14, currentY + 12);
        
        if (item.raw.passengerCount) {
          doc.text(`QUANTIDADE DE PASSAGEIROS: ${item.raw.passengerCount}`, 14, currentY + 18);
        }
      }

      // Selo de autenticidade no rodapé
      const pageHeight = doc.internal.pageSize.height;
      doc.setFillColor(248, 250, 252);
      doc.rect(14, pageHeight - 35, 182, 20, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('DOCUMENTO INTEGRANTE DO SISTEMA DE CONTROLE PARALELO DE FLUXO DE CAIXA', 18, pageHeight - 27);
      doc.text('DM TURISMO - GESTÃO PATRIMONIAL E CONTABILIDADE INTERNA', 18, pageHeight - 22);

      doc.save(`dossie_individual_${item.id}.pdf`);
      toast.success('Dossiê do lançamento gerado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF individual.');
    }
  };

  return (
    <div className="space-y-12">
      {/* Header */}
      <div className="flex flex-col gap-8 border-b border-zinc-800 pb-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
              Financeiro 
              <span className="text-xs bg-brand-accent/15 text-brand-accent px-3 py-1 rounded-full tracking-widest font-mono font-black">
                RECONSTRUTOR PRO
              </span>
            </h1>
            <p className="text-zinc-500 font-medium tracking-tight">Gestão focada em pacotes de viagens, manutenções, estoque industrial e alertas inteligentes.</p>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <button 
              onClick={handleExportMonthlyReportPDF}
              className="flex items-center gap-4 px-8 py-4 btn-3d-gold rounded-2xl font-black text-xs tracking-widest cursor-pointer shadow-xl transition-all hover:scale-[1.02] active:translate-y-[4px]"
            >
              <FileDown size={20} className="stroke-[3]" />
              Exportar Relatório Mensal
            </button>
            <button 
              onClick={() => onAddTransaction('payable')}
              className="flex items-center gap-4 px-8 py-4 bg-rose-500/10 text-rose-500 border border-rose-500/20 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-rose-500 hover:text-white cursor-pointer"
            >
              <ArrowDownCircle size={20} className="stroke-[3]" />
              Nova Despesa
            </button>
            <button 
              onClick={() => onAddTransaction('receivable')}
              className="flex items-center gap-4 px-8 py-4 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-2xl font-black shadow-xl transition-all active:scale-95 hover:bg-emerald-500 hover:text-white cursor-pointer"
            >
              <ArrowUpCircle size={20} className="stroke-[3]" />
              Nova Receita
            </button>
          </div>
        </div>

        {/* Abas Superiores de Controle */}
        <div className="flex flex-wrap gap-2 border-b border-zinc-900 pb-px">
          <button
            onClick={() => setActiveTab('overview')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'overview' ? "border-brand-accent text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <TrendingUp size={16} />
            Visão Geral
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'reminders' ? "border-[#ff6b00] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Bell size={16} />
            Central de Lembretes ({overdueBills.length + billsDueNext15Days.length})
          </button>
          <button
            onClick={() => setActiveTab('transactions')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'transactions' ? "border-brand-accent text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <DollarSign size={16} />
            Lançamentos Gerais
          </button>
          <button
            onClick={() => setActiveTab('billing')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'billing' ? "border-emerald-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Users size={16} />
            Fechamento por Cliente
          </button>
          <button
            onClick={() => setActiveTab('trip_history')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'trip_history' ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Bus size={16} />
            Histórico de Viagens
          </button>
          <button
            onClick={() => setActiveTab('staff')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'staff' ? "border-[#ff6b00] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Users size={16} />
            Gestão de Equipe
          </button>
          <button
            onClick={() => setActiveTab('document_vencimentos')}
            className={cn(
              "px-6 py-3.5 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 cursor-pointer",
              activeTab === 'document_vencimentos' ? "border-[#ff6b00] text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <FileText size={16} />
            Vencimento de Documentos
          </button>
        </div>
      </div>

      {/* ABA: VISÃO GERAL */}
      {activeTab === 'overview' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 xl:grid-cols-5 gap-6">
            <Card 
              className="bg-zinc-900 border-zinc-800 hover:border-emerald-500/40 p-6 flex flex-col justify-between cursor-pointer transition-all select-none active:scale-[0.98] group"
              onClick={() => setSelectedCardHistory('received_entries')}
            >
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 group-hover:text-emerald-400 transition-colors">Resumo de Entradas</p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-2xl font-black text-white tabular-nums tracking-tighter">
                    R$ {(totalReceivable + receivedChartersTotal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 group-hover:bg-emerald-500/20 transition-colors">
                    <ArrowUpCircle size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-850 space-y-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                <div className="flex justify-between">
                  <span>Receitas Gerais:</span>
                  <span className="text-zinc-300">R$ {totalReceivable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Fretamentos Pagos:</span>
                  <span className="text-emerald-500">R$ {receivedChartersTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card>

            <Card 
              className="bg-zinc-900 border-zinc-800 hover:border-amber-500/40 p-6 flex flex-col justify-between cursor-pointer transition-all select-none active:scale-[0.98] group"
              onClick={() => setSelectedCardHistory('future_entries')}
            >
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 group-hover:text-amber-400 transition-colors">Futuras Entradas</p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-2xl font-black text-amber-500 tabular-nums tracking-tighter">
                    R$ {futureReceipts.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                    <Clock size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-850 space-y-1 text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                <div className="flex justify-between">
                  <span>Em Aberto:</span>
                  <span className="text-zinc-300">R$ {openCharterBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>Faturados:</span>
                  <span className="text-amber-500">R$ {billedCharterBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </Card>

            <Card 
              className="bg-zinc-900 border-zinc-800 hover:border-rose-500/40 p-6 flex flex-col justify-between cursor-pointer transition-all select-none active:scale-[0.98] group"
              onClick={() => setSelectedCardHistory('expenses_month')}
            >
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 group-hover:text-rose-400 transition-colors">Despesa (Mês)</p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-2xl font-black text-white tabular-nums tracking-tighter">
                    R$ {totalPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-10 h-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 group-hover:bg-rose-500/20 transition-colors">
                    <ArrowDownCircle size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-850 text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                Total de saídas registradas
              </div>
            </Card>

            <Card 
              className="bg-zinc-900 border-zinc-800 hover:border-amber-500/40 p-6 flex flex-col justify-between cursor-pointer transition-all select-none active:scale-[0.98] group"
              onClick={() => setSelectedCardHistory('pending_payable')}
            >
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1 group-hover:text-amber-400 transition-colors">A Pagar (Pendente)</p>
                <div className="flex items-end justify-between mt-2">
                  <p className="text-2xl font-black text-amber-500 tabular-nums tracking-tighter">
                    R$ {pendingPayable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 group-hover:bg-amber-500/20 transition-colors">
                    <Clock size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-850 text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                Despesas em aberto este mês
              </div>
            </Card>

            <Card className="bg-zinc-900 border-zinc-800 p-6 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-black uppercase text-zinc-500 tracking-widest mb-1">Saldo Previsto</p>
                <div className="flex items-end justify-between mt-2">
                  <p className={cn(
                    "text-2xl font-black tabular-nums tracking-tighter",
                    (totalReceivable + receivedChartersTotal + futureReceipts - totalPayable) >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}>
                    R$ {(totalReceivable + receivedChartersTotal + futureReceipts - totalPayable).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    (totalReceivable + receivedChartersTotal + futureReceipts - totalPayable) >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                  )}>
                    <Wallet size={20} />
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-850 text-[9px] font-bold text-zinc-500 uppercase tracking-wider font-mono">
                Saldo realizado + previsto
              </div>
            </Card>
          </div>

          {/* Gráfico Mensal */}
          <Card className="bg-zinc-900 border-zinc-800 p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center text-brand-accent">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Fluxo de Caixa Mensal</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Comparativo de receitas e despesas (Últimos 6 meses)</p>
                </div>
              </div>
              
              <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-xl border border-zinc-800 w-fit self-end sm:self-auto">
                <button
                  onClick={() => setChartType('bar')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    chartType === 'bar' ? "bg-[#ff6b00] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-350"
                  )}
                >
                  Barras
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                    chartType === 'line' ? "bg-[#ff6b00] text-white shadow-lg" : "text-zinc-500 hover:text-zinc-350"
                  )}
                >
                  Linhas
                </button>
              </div>
            </div>

            <div className="h-[300px] w-full font-mono">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#18181b" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                    <Bar dataKey="receita" name="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={32} />
                    <Bar dataKey="despesa" name="Despesas" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={32} />
                  </BarChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#18181b" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }} tickFormatter={(value) => `R$${(value / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={{ backgroundColor: '#09090b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold', textTransform: 'uppercase' }} />
                    <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ paddingBottom: '20px', fontSize: '10px', fontWeight: 'black', textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                    <Line type="monotone" dataKey="receita" name="Receitas" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                    <Line type="monotone" dataKey="despesa" name="Despesas" stroke="#f43f5e" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </Card>

          <Suspense fallback={
            <div className="animate-pulse bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 flex flex-col justify-center items-center min-h-[300px]">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-brand-accent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Gerando painel de análise de rentabilidade...
              </p>
            </div>
          }>
            <ProfitabilityAnalysis vehicles={vehicles} fuelLogs={fuelLogs} maintenance={maintenance} />
          </Suspense>
        </div>
      )}

      {/* ABA: CENTRAL DE LEMBRETES & VENCIMENTOS */}
      {activeTab === 'reminders' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          {/* Bento-Grid de Lembretes */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card 
              onClick={() => handleExportRemindersPDF('overdue')}
              className="bg-zinc-900 border-zinc-800 hover:border-rose-500/40 hover:bg-zinc-850 cursor-pointer p-6 relative overflow-hidden group transition-all active:scale-[0.98] shadow-lg"
            >
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase text-rose-500 tracking-widest mb-1">Contas Atrasadas</p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                    {overdueBills.length} <span className="text-sm text-zinc-600 font-bold ml-1 uppercase">Títulos</span>
                  </p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-2">Valor: R$ {overdueBills.reduce((acc, b) => acc + b.amount, 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[8px] text-rose-500/80 font-black uppercase tracking-wider group-hover:text-rose-400 mt-3 flex items-center gap-1">
                    <Printer size={10} /> Gerar PDF Resumo
                  </p>
                </div>
                <div className="w-12 h-12 bg-rose-500/10 rounded-2xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                  <AlertCircle size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 left-0 h-1 bg-rose-500/20" />
            </Card>
     
            <Card 
              onClick={() => handleExportRemindersPDF('next15')}
              className="bg-zinc-900 border-zinc-800 hover:border-amber-500/40 hover:bg-zinc-850 cursor-pointer p-6 relative overflow-hidden group transition-all active:scale-[0.98] shadow-lg"
            >
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Próximos 15 Dias</p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                    {billsDueNext15Days.length} <span className="text-sm text-zinc-600 font-bold ml-1 uppercase">Títulos</span>
                  </p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-2">Valor: R$ {billsDueNext15Days.reduce((acc, b) => acc + b.amount, 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[8px] text-amber-500/80 font-black uppercase tracking-wider group-hover:text-amber-400 mt-3 flex items-center gap-1">
                    <Printer size={10} /> Gerar PDF Resumo
                  </p>
                </div>
                <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                  <CalendarDays size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 left-0 h-1 bg-amber-500/20" />
            </Card>
     
            <Card 
              onClick={() => handleExportRemindersPDF('thisMonth')}
              className="bg-zinc-900 border-zinc-800 hover:border-blue-500/40 hover:bg-zinc-850 cursor-pointer p-6 relative overflow-hidden group transition-all active:scale-[0.98] shadow-lg"
            >
              <div className="flex items-start justify-between relative z-10">
                <div>
                  <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Vencimento no Mês</p>
                  <p className="text-3xl font-black text-white tabular-nums tracking-tighter">
                    {billsDueThisMonth.length} <span className="text-sm text-zinc-600 font-bold ml-1 uppercase">Títulos</span>
                  </p>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-2">Valor: R$ {billsDueThisMonth.reduce((acc, b) => acc + b.amount, 0).toLocaleString('pt-BR')}</p>
                  <p className="text-[8px] text-blue-500/80 font-black uppercase tracking-wider group-hover:text-blue-400 mt-3 flex items-center gap-1">
                    <Printer size={10} /> Gerar PDF Resumo
                  </p>
                </div>
                <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                  <Target size={24} />
                </div>
              </div>
              <div className="absolute bottom-0 right-0 left-0 h-1 bg-blue-500/20" />
            </Card>
          </div>

          {/* Listagem de Lembretes Ativos */}
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-400">Cronograma Detalhado de Cobranças</h3>
              <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setFilterSpecialized('all')}
                  className={cn("px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", filterSpecialized === 'all' ? "bg-zinc-800 text-white" : "text-zinc-500")}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterSpecialized('travel_package')}
                  className={cn("px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", filterSpecialized === 'travel_package' ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500")}
                >
                  Pacotes
                </button>
                <button
                  onClick={() => setFilterSpecialized('fleet_maintenance')}
                  className={cn("px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", filterSpecialized === 'fleet_maintenance' ? "bg-[#ff6b00]/20 text-[#ff6b00]" : "text-zinc-500")}
                >
                  Manutenção
                </button>
                <button
                  onClick={() => setFilterSpecialized('industrial_stock')}
                  className={cn("px-4 py-1.5 text-[9px] font-black uppercase rounded-lg transition-all", filterSpecialized === 'industrial_stock' ? "bg-blue-500/20 text-blue-400" : "text-zinc-500")}
                >
                  Estoque
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredTransactions.map(transaction => {
                const diffDays = getDaysDifference(transaction.dueDate);
                const isOverdue = diffDays < 0;
                
                return (
                  <div 
                    key={transaction.id}
                    className={cn(
                      "p-6 rounded-3xl border transition-all flex flex-col justify-between gap-6 hover:-translate-y-0.5",
                      isOverdue 
                        ? "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/40" 
                        : diffDays === 0 
                          ? "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40"
                          : "bg-zinc-900/30 border-zinc-800/80 hover:border-zinc-700"
                    )}
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight line-clamp-1">{transaction.description}</p>
                          <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1">{transaction.supplier || 'N/A'}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          {getSpecializedBadge(transaction)}
                          <span className={cn(
                            "text-[8px] font-black px-2 py-0.5 rounded-full font-mono",
                            isOverdue ? "bg-rose-500/10 text-rose-500 border border-rose-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"
                          )}>
                            {isOverdue ? 'EXPIRADO' : `EM ${diffDays} DIA(S)`}
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-between items-center bg-zinc-950/40 p-4 rounded-2xl border border-zinc-900/60">
                        <div>
                          <p className="text-[8px] font-black uppercase text-zinc-600 tracking-wider">Valor do Título</p>
                          <p className={cn(
                            "text-lg font-black tracking-tighter tabular-nums",
                            transaction.type === 'payable' ? "text-rose-400" : "text-emerald-400"
                          )}>
                            R$ {transaction.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black uppercase text-zinc-600 tracking-wider font-mono">Vencimento</p>
                          <p className="text-xs font-black text-white font-mono mt-0.5">
                            {format(parseISO(transaction.dueDate), 'dd/MM/yyyy')}
                          </p>
                        </div>
                      </div>

                      {transaction.observations && (
                        <p className="text-[9px] text-zinc-400 font-medium italic uppercase tracking-wider pl-3 border-l border-zinc-800">
                          {transaction.observations}
                        </p>
                      )}
                    </div>

                    <div className="flex gap-3 pt-3 border-t border-zinc-900/60">
                      <button
                        onClick={() => onUpdateStatus(transaction.id, 'paid')}
                        className="flex-1 py-3 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 size={12} />
                        Liquidar
                      </button>
                      
                      {transaction.type === 'receivable' && (
                        <button
                          onClick={() => {
                            setSelectedBoleto({
                              description: transaction.description,
                              amount: transaction.amount,
                              dueDate: transaction.dueDate,
                              supplier: transaction.supplier || 'CLIENTE'
                            });
                          }}
                          className="px-4 py-3 bg-zinc-850 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center cursor-pointer"
                        >
                          <Printer size={12} />
                        </button>
                      )}
                      
                      <button
                        onClick={() => {
                          toast.success('Cobrança de lembrete enviada via WhatsApp administrativo!');
                        }}
                        className="px-4 py-3 bg-brand-accent/10 hover:bg-brand-accent hover:text-zinc-950 text-brand-accent rounded-xl text-[10px] font-black uppercase transition-all flex items-center justify-center cursor-pointer"
                        title="Enviar Cobrança de Alerta"
                      >
                        <Sparkles size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTransactions.length === 0 && (
                <div className="col-span-full py-16 text-center bg-zinc-950/20 border border-dashed border-zinc-800/40 rounded-[2rem]">
                  <DollarSign size={32} className="text-zinc-800 mx-auto mb-4" />
                  <p className="text-xs font-black text-zinc-700 uppercase tracking-[0.3em]">Nenhum lembrete correspondente encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ABA: LANÇAMENTOS GERAIS */}
      {activeTab === 'transactions' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          {/* Abas Secundárias: Em Aberto vs Liquidadas */}
          <div className="flex flex-col sm:flex-row border-b border-zinc-900 pb-px gap-1 sm:gap-0 overflow-x-auto select-none">
            <button
              onClick={() => {
                setViewTab('active');
                setFilterType('all');
              }}
              className={cn(
                "flex-1 sm:flex-initial px-8 py-4 font-black text-[10px] uppercase tracking-[0.15em] border-b-2 transition-all flex items-center justify-center sm:justify-start gap-2 whitespace-nowrap cursor-pointer",
                viewTab === 'active' ? "border-brand-accent text-white bg-zinc-900/15" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <Clock size={13} className={viewTab === 'active' ? "text-brand-accent" : ""} />
              <span>Em Aberto ({allTransactions.filter(t => t.status !== 'paid').length})</span>
            </button>
            
            <button
              onClick={() => {
                setViewTab('liquidated');
                setFilterType('all');
              }}
              className={cn(
                "flex-1 sm:flex-initial px-8 py-4 font-black text-[10px] uppercase tracking-[0.15em] border-b-2 transition-all flex items-center justify-center sm:justify-start gap-2 whitespace-nowrap cursor-pointer",
                viewTab === 'liquidated' ? "border-emerald-500 text-white bg-zinc-900/15" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              <CheckCircle2 size={13} className={viewTab === 'liquidated' ? "text-emerald-500" : ""} />
              <span>Liquidadas ({allTransactions.filter(t => t.status === 'paid').length})</span>
            </button>
          </div>

          {/* Filtros e Barra de Pesquisa */}
          <div className="flex flex-col lg:flex-row gap-6 justify-between items-stretch lg:items-center">
            {/* Campo de Pesquisa */}
            <div className="relative flex-1">
              <span className="absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-600">
                <Search size={18} />
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="PROCURAR POR DESCRIÇÃO, CLIENTE, FORNECEDOR OU CATEGORIA..."
                className="w-full bg-zinc-950 border border-zinc-800/80 rounded-2xl py-4.5 pl-12 pr-4 text-xs font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-brand-accent/50 transition-all uppercase tracking-wider"
              />
            </div>

            {/* Filtros rápidos por Tipo */}
            <div className="flex flex-wrap gap-3 items-center">
              <span className="text-[9px] font-black uppercase text-zinc-650 tracking-widest hidden lg:inline">Filtro Rápido:</span>
              
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800">
                <button
                  onClick={() => setFilterType('all')}
                  className={cn(
                    "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                    filterType === 'all' ? "bg-zinc-850 text-white" : "text-zinc-500 hover:text-zinc-350"
                  )}
                >
                  Todos
                </button>
                <button
                  onClick={() => setFilterType('receivable')}
                  className={cn(
                    "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                    filterType === 'receivable' ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-350"
                  )}
                >
                  Receitas
                </button>
                <button
                  onClick={() => setFilterType('payable')}
                  className={cn(
                    "px-4 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all cursor-pointer",
                    filterType === 'payable' ? "bg-rose-500/20 text-rose-400" : "text-zinc-500 hover:text-zinc-350"
                  )}
                >
                  Despesas
                </button>
              </div>

              {/* Filtro Especializado */}
              <select
                value={filterSpecialized}
                onChange={(e) => setFilterSpecialized(e.target.value as any)}
                className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-[9px] font-black uppercase tracking-wider text-zinc-400 focus:outline-none cursor-pointer h-[38px]"
              >
                <option value="all">Foco Especializado: Todos</option>
                <option value="travel_package">Apenas Pacotes de Viagem</option>
                <option value="fleet_maintenance">Apenas Manutenção de Frota</option>
                <option value="industrial_stock">Apenas Estoque Industrial</option>
              </select>
            </div>
          </div>

          {/* Grid de Transações Gerais */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredTransactions.map(t => {
              const formattedDueDate = format(parseISO(t.dueDate), 'dd/MM/yyyy');
              const isOverdue = t.status !== 'paid' && isBefore(parseISO(t.dueDate), now);
              const isPending = !!(t as any).isPendingSync;

              return (
                <div
                  key={t.id}
                  onClick={() => {
                    if (isPending) {
                      toast.info('Este lançamento está pendente de sincronização com o servidor e não pode ser editado no momento.');
                      return;
                    }
                    setSelectedTransactionForEdit(t);
                  }}
                  className={cn(
                    "bg-zinc-900 hover:bg-zinc-850 border border-zinc-800/80 hover:border-zinc-700/80 p-6 rounded-3xl transition-all flex flex-col justify-between gap-5 relative group cursor-pointer shadow-lg",
                    isOverdue && "border-rose-500/25 bg-rose-500/5 hover:border-rose-500/40",
                    isPending && "border-amber-500/15 bg-amber-500/[0.01]"
                  )}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="w-2/3">
                        <h4 className="text-xs font-black text-white uppercase tracking-tight line-clamp-1 group-hover:text-brand-accent transition-colors">
                          {t.description}
                        </h4>
                        <p className="text-[10px] text-zinc-500 font-bold uppercase mt-1 tracking-wider">
                          {t.supplier || 'N/A'}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        <span className={cn(
                          "text-[8px] font-black px-2 py-0.5 rounded-md tracking-wider font-mono uppercase",
                          t.type === 'receivable' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        )}>
                          {t.type === 'receivable' ? 'Receita' : 'Despesa'}
                        </span>
                        {isPending && (
                          <span className="text-[8px] font-black px-2 py-0.5 rounded-md tracking-wider font-mono uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                            <RefreshCw size={9} className="animate-spin" />
                            Pendente
                          </span>
                        )}
                        {getSpecializedBadge(t)}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-zinc-950/40 p-4 rounded-2xl border border-zinc-900/60 font-mono">
                      <div>
                        <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Valor</span>
                        <p className={cn(
                          "text-lg font-black tracking-tighter tabular-nums mt-0.5",
                          t.type === 'receivable' ? "text-emerald-400" : "text-rose-450"
                        )}>
                          R$ {t.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest">Vencimento</span>
                        <p className={cn(
                          "text-xs font-black mt-0.5",
                          isOverdue ? "text-rose-400" : "text-white"
                        )}>
                          {formattedDueDate}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-3 border-t border-zinc-900/65">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">
                      {t.category.toUpperCase()}
                    </span>

                    <div className="flex items-center gap-2">
                      {t.status !== 'paid' ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isPending) {
                              toast.info('Aguarde a sincronização para liquidar este lançamento.');
                              return;
                            }
                            onUpdateStatus(t.id, 'paid');
                          }}
                          className={cn(
                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                            isPending 
                              ? "bg-zinc-800 text-zinc-500 border border-zinc-700/50 cursor-not-allowed" 
                              : "bg-emerald-500/15 hover:bg-emerald-500 hover:text-zinc-950 text-emerald-400"
                          )}
                          disabled={isPending}
                        >
                          <CheckCircle2 size={11} />
                          {isPending ? 'Aguardando Sinc.' : 'Liquidar'}
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-400 uppercase bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-mono">
                          <CheckCircle2 size={11} /> PAGO
                        </span>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConfirm({ isOpen: true, id: t.id });
                        }}
                        className="p-2 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all cursor-pointer"
                        title="Remover Registro"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="col-span-full py-20 text-center bg-zinc-950/25 border border-dashed border-zinc-850/80 rounded-[2.5rem]">
                <Clock size={36} className="text-zinc-800 mx-auto mb-4" />
                <p className="text-xs font-black text-zinc-700 uppercase tracking-[0.3em]">
                  Nenhum lançamento correspondente encontrado
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ABA: FECHAMENTO POR CLIENTE */}
      {activeTab === 'billing' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Balanço de Fretamentos e Viagens</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Visão unificada de faturamento por cliente cadastrado e avulso</p>
            </div>
            <button
              onClick={() => setShowRegisterClientForm(true)}
              className="py-2.5 px-4 bg-brand-accent hover:bg-white text-zinc-950 border border-transparent rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all shadow-sm"
            >
              <Plus size={14} className="text-zinc-950" /> Novo Cliente
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {clientSummaries.map(client => (
              <div
                key={client.id}
                onClick={() => {
                  if (!client.isRegistered) {
                    setSelectedDossierClient({ id: client.id, name: client.name, defaultTripValue: 0 });
                  } else {
                    const fullClient = clients.find(c => c.id === client.id);
                    setSelectedDossierClient(fullClient || { id: client.id, name: client.name, defaultTripValue: 0 });
                  }
                  setIsDossierModalOpen(true);
                }}
                className="bg-zinc-900 border border-zinc-800/80 hover:border-brand-accent/50 p-6 rounded-3xl flex flex-col justify-between gap-6 cursor-pointer hover:shadow-lg active:scale-[0.99] select-none transition-all group"
              >
                <div>
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight line-clamp-1 group-hover:text-brand-accent transition-colors">{client.name}</h4>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5 tracking-wider font-mono">
                        {client.companyName || 'DADOS INDISPONÍVEIS'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="opacity-0 group-hover:opacity-100 text-[8px] text-brand-accent font-black uppercase tracking-wider transition-opacity duration-200">
                        Abrir Ficha
                      </span>
                      <span className={cn(
                        "text-[8px] font-black px-2 py-0.5 rounded-md font-mono",
                        client.isRegistered ? "bg-brand-accent/10 text-brand-accent" : "bg-zinc-800 text-zinc-500"
                      )}>
                        {client.isRegistered ? 'SINCRONIZADO' : 'AVULSO'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="bg-zinc-950/40 p-3.5 rounded-2xl border border-zinc-900/60">
                      <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest font-mono">Total de Viagens</span>
                      <p className="text-xl font-black text-white tabular-nums tracking-tighter mt-1">
                        {client.totalTrips} <span className="text-[9px] text-zinc-600 font-bold uppercase font-sans">trips</span>
                      </p>
                    </div>
                    <div className="bg-zinc-950/40 p-3.5 rounded-2xl border border-zinc-900/60">
                      <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest font-mono">Valor Faturado</span>
                      <p className="text-lg font-black text-emerald-400 tabular-nums tracking-tighter mt-1.5">
                        R$ {client.totalBilled.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-zinc-900/60">
                  <div>
                    <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest font-mono">Prox. Esperado</span>
                    <p className="text-[10px] font-black text-white font-mono uppercase mt-0.5">
                      {client.nextExpectedDate}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation(); // Avoid double triggering parent onClick
                      if (!client.isRegistered) {
                        setSelectedDossierClient({ id: client.id, name: client.name, defaultTripValue: 0 });
                      } else {
                        const fullClient = clients.find(c => c.id === client.id);
                        setSelectedDossierClient(fullClient || { id: client.id, name: client.name, defaultTripValue: 0 });
                      }
                      setIsDossierModalOpen(true);
                    }}
                    className="px-4 py-2.5 bg-gradient-to-b from-[#FCD34D] to-[#D4AF37] border-t border-white/20 hover:from-white hover:to-zinc-200 text-zinc-950 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-[0_2.5px_0_#856404] active:translate-y-[2.5px] active:shadow-none cursor-pointer"
                  >
                    Dossiê de Fechamento
                    <ChevronRight size={12} className="stroke-[3.5]" />
                  </button>
                </div>
              </div>
            ))}

            {clientSummaries.length === 0 && (
              <div className="col-span-full py-16 text-center bg-zinc-950/20 border border-dashed border-zinc-850 rounded-[2rem]">
                <Users size={32} className="text-zinc-800 mx-auto mb-4" />
                <p className="text-xs font-black text-zinc-700 uppercase tracking-[0.3em]">Nenhum faturamento por cliente consolidado</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'trip_history' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Histórico Geral de Viagens</h3>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Controle financeiro de faturamento e recebíveis de turismo agendados</p>
            </div>
          </div>

          {/* Cards Bento de Rentabilidade/Faturamento de Viagens */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-3xl">
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Total de Operações</span>
              <p className="text-2xl font-black text-white tabular-nums tracking-tighter mt-1">
                {trips.length} <span className="text-[10px] text-zinc-600 font-bold uppercase">Escalas</span>
              </p>
            </div>
            
            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-3xl border-l-4 border-l-amber-500">
              <span className="text-[8px] font-black text-amber-500 uppercase tracking-widest font-mono">A Receber (Aberto)</span>
              <p className="text-2xl font-black text-white tabular-nums tracking-tighter mt-1">
                R$ {tripsPendingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-3xl border-l-4 border-l-blue-500">
              <span className="text-[8px] font-black text-blue-400 uppercase tracking-widest font-mono">Faturado</span>
              <p className="text-2xl font-black text-white tabular-nums tracking-tighter mt-1">
                R$ {tripsBilledAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-zinc-900 border border-zinc-800/80 p-5 rounded-3xl border-l-4 border-l-emerald-500">
              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest font-mono">Recebido (Pago)</span>
              <p className="text-2xl font-black text-white tabular-nums tracking-tighter mt-1">
                R$ {tripsPaidAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Filtros de Pesquisa */}
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-zinc-900/40 border border-zinc-900 p-4 rounded-3xl">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input
                type="text"
                placeholder="BUSCAR POR OS, CLIENTE OU TÍTULO DA VIAGEM..."
                value={tripSearchTerm}
                onChange={(e) => setTripSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-850 rounded-2xl py-2 px-10 text-xs text-white uppercase font-bold placeholder-zinc-650 outline-none focus:border-zinc-700"
              />
              {tripSearchTerm && (
                <button 
                  onClick={() => setTripSearchTerm('')} 
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <span className="text-[8px] font-black text-zinc-550 uppercase tracking-widest font-mono whitespace-nowrap">Filtrar Pagamento:</span>
              <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-2xl items-center gap-1 w-full md:w-auto">
                {(['all', 'A Receber', 'Faturado', 'Pago'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setTripPaymentFilter(f)}
                    className={cn(
                      "text-[9px] uppercase tracking-wider font-extrabold py-1.5 px-3 rounded-xl transition-all cursor-pointer",
                      tripPaymentFilter === f 
                        ? 'bg-zinc-800 text-white font-black' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    )}
                  >
                    {f === 'all' ? 'Todos' : f}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Listagem de Viagens */}
          {filteredTrips.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-zinc-900 rounded-[2.5rem]">
              <Bus size={40} className="text-zinc-800 mx-auto mb-4" />
              <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Nenhuma viagem encontrada neste histórico</p>
            </div>
          ) : (
            <div className="border border-zinc-900 bg-zinc-900/10 rounded-[2rem] overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-950/60 border-b border-zinc-900 text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                    <th className="py-4 px-6 w-24 text-center">OS</th>
                    <th className="py-4 px-4 w-32">Data de Partida</th>
                    <th className="py-4 px-4">Operação / Rota</th>
                    <th className="py-4 px-4">Cliente de Turismo</th>
                    <th className="py-4 px-4 text-right w-36">Valor Faturado</th>
                    <th className="py-4 px-4 text-center w-36">Status Operacional</th>
                    <th className="py-4 px-6 text-center w-64">Controle Financeiro (Status)</th>
                    {(onEditTrip || onDeleteTrip) && <th className="py-4 px-4 text-center w-28">Ações</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/40 text-xs">
                  {filteredTrips.map((trip) => {
                    let formattedDate = '';
                    try {
                      formattedDate = trip.startDate.includes('T') 
                        ? format(new Date(trip.startDate), 'dd/MM/yyyy HH:mm') 
                        : format(parseISO(trip.startDate), 'dd/MM/yyyy');
                    } catch (e) {
                      formattedDate = trip.startDate;
                    }

                    const payStatus = trip.paymentStatus || 'A Receber';

                    return (
                      <tr 
                        key={trip.id} 
                        className={cn(
                          "hover:bg-zinc-900/30 transition-colors group",
                          onEditTrip && "cursor-pointer"
                        )}
                        onClick={() => onEditTrip && onEditTrip(trip)}
                      >
                        <td className="py-4 px-6 text-center font-mono font-black text-zinc-400">
                          {trip.osNumber || '---'}
                        </td>
                        <td className="py-4 px-4 text-zinc-400 font-bold font-mono">
                          {formattedDate}
                        </td>
                        <td className="py-4 px-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-white uppercase tracking-tight line-clamp-1 group-hover:text-amber-500 transition-colors">
                              {trip.title}
                            </span>
                            <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider font-mono mt-0.5">
                              {trip.origin} → {trip.destination}
                            </span>
                            {trip.status === 'completed' && onViewOS && (
                              <div className="mt-1.5 flex" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={() => onViewOS(trip)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-md text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                  title="Ficha da O.S. (Anexo)"
                                >
                                  <Paperclip size={10} className="text-amber-400" />
                                  <span>Ficha de Viagem (OS)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4 font-semibold text-zinc-300 uppercase">
                          {trip.client || 'Avulso'}
                        </td>
                        <td className="py-4 px-4 text-right font-black text-white tabular-nums">
                          R$ {(trip.tripValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className={cn(
                            "inline-flex px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-lg font-mono border",
                            trip.status === 'completed' && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            trip.status === 'active' && "bg-blue-500/10 text-blue-400 border-blue-500/20",
                            trip.status === 'scheduled' && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                            trip.status === 'cancelled' && "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          )}>
                            {trip.status === 'completed' && 'Concluído'}
                            {trip.status === 'active' && 'Em Rota'}
                            {trip.status === 'scheduled' && 'Agendado'}
                            {trip.status === 'cancelled' && 'Cancelado'}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex bg-zinc-950 border border-zinc-850 p-1 rounded-2xl items-center gap-1 w-full justify-between">
                            <button 
                              onClick={() => handleUpdateTripPaymentStatus(trip.id, 'A Receber')}
                              className={`text-[8px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-xl transition-all flex-1 text-center cursor-pointer ${
                                payStatus === 'A Receber' 
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20 font-black' 
                                  : 'text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              Receber
                            </button>
                            
                            <button 
                              onClick={() => handleUpdateTripPaymentStatus(trip.id, 'Faturado')}
                              className={`text-[8px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-xl transition-all flex-1 text-center cursor-pointer ${
                                payStatus === 'Faturado' 
                                  ? 'bg-blue-500/15 text-blue-400 border border-blue-500/20 font-black' 
                                  : 'text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              Faturado
                            </button>

                            <button 
                              onClick={() => handleUpdateTripPaymentStatus(trip.id, 'Pago')}
                              className={`text-[8px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-xl transition-all flex-1 text-center cursor-pointer ${
                                payStatus === 'Pago' 
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-black' 
                                  : 'text-zinc-600 hover:text-zinc-400'
                              }`}
                            >
                              Pago
                            </button>
                          </div>
                        </td>
                        {(onEditTrip || onDeleteTrip) && (
                          <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5">
                              {onEditTrip && (
                                <button
                                  onClick={() => onEditTrip(trip)}
                                  className="p-2 bg-zinc-955 hover:bg-zinc-800 text-amber-500 border border-zinc-900 hover:border-zinc-700 rounded-xl transition-all cursor-pointer"
                                  title="Editar Viagem"
                                >
                                  <Edit2 size={12} />
                                </button>
                              )}
                              {onDeleteTrip && (
                                <button
                                  onClick={() => onDeleteTrip(trip)}
                                  className="p-2 bg-zinc-955 hover:bg-rose-950/40 hover:text-rose-400 text-zinc-500 border border-zinc-900 hover:border-rose-900/30 rounded-xl transition-all cursor-pointer"
                                  title="Excluir Viagem"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'staff' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <Suspense fallback={
            <div className="animate-pulse bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 flex flex-col justify-center items-center min-h-[400px]">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-brand-accent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Carregando gerenciamento de colaboradores...
              </p>
            </div>
          }>
            <StaffManagement
              employees={employees}
              onExportToExcel={onExportStaffToExcel}
              onAddEmployee={onAddEmployee}
              onEditEmployee={onEditEmployee}
              onDeleteEmployee={onDeleteEmployee}
              onUpdateEmployeePhoto={onUpdateEmployeePhoto}
              user={user}
            />
          </Suspense>
        </div>
      )}

      {activeTab === 'document_vencimentos' && (
        <div className="space-y-10 animate-in fade-in duration-300">
          <Suspense fallback={
            <div className="animate-pulse bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 flex flex-col justify-center items-center min-h-[400px]">
              <div className="w-10 h-10 border-4 border-zinc-800 border-t-brand-accent rounded-full animate-spin mb-4" />
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                Gerando painel de vencimentos e documentos...
              </p>
            </div>
          }>
            <FinanceDocumentVencimentos
              vehicles={vehicles}
              user={user}
            />
          </Suspense>
        </div>
      )}

      {/* MODAIS E CONFIRMAÇÕES */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        title="Deseja mesmo remover?"
        message="A exclusão deste lançamento financeiro é definitiva. Os cálculos de fluxo de caixa serão recalculados imediatamente no banco de dados."
        onConfirm={processDelete}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Cadastrar Novo Cliente */}
      {showRegisterClientForm && (
        <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">Cadastrar Cliente Fretamento</h3>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Criar novo contrato recorrente para acertos de caixa</p>
                </div>
              </div>
              <button onClick={() => setShowRegisterClientForm(false)} className="text-zinc-500 hover:text-white cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nome Fantasia (Apelido Rota) *</label>
                <input 
                  type="text"
                  placeholder="Ex: Aurora Filial Norte" 
                  value={newClient.name}
                  onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Razão Social Completa</label>
                <input 
                  type="text"
                  placeholder="Ex: Aurora Alimentos S/A" 
                  value={newClient.companyName}
                  onChange={(e) => setNewClient({...newClient, companyName: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Documento (CNPJ / CPF)</label>
                <input 
                  type="text"
                  placeholder="Ex: 00.111.222/0001-33" 
                  value={newClient.document}
                  onChange={(e) => setNewClient({...newClient, document: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Valor Padrão da Viagem</label>
                  <input 
                    type="number"
                    placeholder="R$ 150,00" 
                    value={newClient.defaultTripValue || ''}
                    onChange={(e) => setNewClient({...newClient, defaultTripValue: parseFloat(e.target.value) || 0})}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Contato Responsável</label>
                  <input 
                    type="text"
                    placeholder="Ex: 4799887766" 
                    value={newClient.phone}
                    onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">E-mail Financeiro</label>
                <input 
                  type="email"
                  placeholder="Ex: financeiro@aurora.com.br" 
                  value={newClient.email}
                  onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Endereço de Cobrança</label>
                <input 
                  type="text"
                  placeholder="Ex: Rua das Flores, 120" 
                  value={newClient.address}
                  onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-brand-accent"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Viagens Extras (Anotação)</label>
                  <textarea
                    placeholder="Anotações sobre viagens extras..."
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                    value={newClient.extraTripsNotes}
                    onChange={(e) => setNewClient({...newClient, extraTripsNotes: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Trabalhos Extras (Anotação)</label>
                  <textarea
                    placeholder="Anotações sobre outros trabalhos..."
                    className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                    value={newClient.extraWorksNotes}
                    onChange={(e) => setNewClient({...newClient, extraWorksNotes: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
              <button 
                onClick={() => setShowRegisterClientForm(false)} 
                className="py-2 px-6 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                CANCELAR
              </button>
              <button 
                onClick={handleAddClientSubmit} 
                className="py-2.5 px-8 bg-brand-accent hover:bg-white text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow"
              >
                CADASTRAR CLIENTE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visualizar Boleto individual */}
      {selectedBoleto && (
        <Suspense fallback={null}>
          <BoletoModal 
            isOpen={!!selectedBoleto} 
            onClose={() => setSelectedBoleto(null)} 
            boletos={[selectedBoleto]} 
            title="VISUALIZAÇÃO DE BOLETO BANCÁRIO"
          />
        </Suspense>
      )}

      {/* Visualizar detalhes do lançamento / edição rápida */}
      {selectedTransactionForEdit && (
        <Suspense fallback={null}>
          <TransactionDetailModal
            isOpen={!!selectedTransactionForEdit}
            onClose={() => setSelectedTransactionForEdit(null)}
            transaction={selectedTransactionForEdit}
            user={user}
          />
        </Suspense>
      )}

      {/* Dossiê de Fechamento do Cliente */}
      {isDossierModalOpen && selectedDossierClient && (
        <Suspense fallback={null}>
          <ClientDossierModal
            isOpen={isDossierModalOpen}
            onClose={() => {
              setIsDossierModalOpen(false);
              setSelectedDossierClient(null);
            }}
            client={selectedDossierClient}
            clientTrips={selectedDossierClientTrips}
            employees={employees}
            vehicles={vehicles}
            onViewOS={onViewOS}
          />
        </Suspense>
      )}

      {/* Modal de Histórico de Fichas Financeiras */}
      {selectedCardHistory && (
        <div className="fixed inset-0 z-[9900] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="bg-zinc-950 border border-zinc-900 rounded-[2.5rem] w-full max-w-5xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-950/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  selectedCardHistory.includes('entries') ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'
                }`}>
                  {selectedCardHistory.includes('entries') ? <ArrowUpCircle size={24} /> : <ArrowDownCircle size={24} />}
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">
                    {selectedCardHistory === 'received_entries' && 'Histórico: Resumo de Entradas'}
                    {selectedCardHistory === 'future_entries' && 'Histórico: Futuras Entradas'}
                    {selectedCardHistory === 'expenses_month' && 'Histórico: Despesas (Mês)'}
                    {selectedCardHistory === 'pending_payable' && 'Histórico: A Pagar (Pendentes)'}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                    {selectedCardHistory === 'received_entries' && 'Todas as receitas e fretamentos recebidos e liquidados no sistema'}
                    {selectedCardHistory === 'future_entries' && 'Lançamentos futuros e fretamentos em aberto ou faturados'}
                    {selectedCardHistory === 'expenses_month' && 'Demonstrativo completo de saídas registradas para este mês'}
                    {selectedCardHistory === 'pending_payable' && 'Contas de saída pendentes de pagamento para este mês'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={generateHistoryReportPdf}
                  className="px-4 py-2 bg-gradient-to-b from-[#FCD34D] to-[#D4AF37] hover:from-white hover:to-zinc-200 text-zinc-950 text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow flex items-center gap-2 cursor-pointer"
                >
                  <FileDown size={14} className="stroke-[3]" />
                  Gerar Dossiê do Histórico
                </button>
                <button
                  onClick={() => setSelectedCardHistory(null)}
                  className="p-3 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-800 transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              {cardHistoryItems.length === 0 ? (
                <div className="py-20 text-center border border-dashed border-zinc-900 rounded-3xl">
                  <Clock size={40} className="text-zinc-700 mx-auto mb-4" />
                  <p className="text-xs font-black text-zinc-600 uppercase tracking-widest">Nenhum registro encontrado neste histórico</p>
                </div>
              ) : (
                <div className="border border-zinc-900 bg-zinc-900/10 rounded-[2rem] overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-950/60 border-b border-zinc-900 text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono">
                        <th className="py-4 px-4 text-center w-12">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-850 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer"
                            checked={selectedHistoryItemIds.length === cardHistoryItems.length && cardHistoryItems.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedHistoryItemIds(cardHistoryItems.map(item => item.id));
                              } else {
                                setSelectedHistoryItemIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-4 px-4 text-center w-12">#</th>
                        <th className="py-4 px-4 w-32">Data</th>
                        <th className="py-4 px-4">Descrição / Serviço</th>
                        <th className="py-4 px-4">Parceiro / Cliente</th>
                        <th className="py-4 px-4 text-right">Valor</th>
                        <th className="py-4 px-4 text-center w-32">Status</th>
                        <th className="py-4 px-6 text-center w-36">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-900/40 text-xs">
                      {cardHistoryItems.map((item, index) => {
                        let formattedDate = '';
                        try {
                          formattedDate = item.date.includes('T') 
                            ? format(new Date(item.date), 'dd/MM/yyyy HH:mm') 
                            : format(parseISO(item.date), 'dd/MM/yyyy');
                        } catch (e) {
                          formattedDate = item.date;
                        }

                        return (
                          <tr 
                            key={item.id}
                            className={`hover:bg-zinc-900/30 transition-colors group cursor-pointer ${
                              selectedHistoryItemIds.includes(item.id) ? 'bg-zinc-900/20' : ''
                            }`}
                            onClick={() => {
                              if (selectedHistoryItemIds.includes(item.id)) {
                                setSelectedHistoryItemIds(selectedHistoryItemIds.filter(id => id !== item.id));
                              } else {
                                setSelectedHistoryItemIds([...selectedHistoryItemIds, item.id]);
                              }
                            }}
                          >
                            <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                className="rounded border-zinc-850 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer"
                                checked={selectedHistoryItemIds.includes(item.id)}
                                onChange={() => {
                                  if (selectedHistoryItemIds.includes(item.id)) {
                                    setSelectedHistoryItemIds(selectedHistoryItemIds.filter(id => id !== item.id));
                                  } else {
                                    setSelectedHistoryItemIds([...selectedHistoryItemIds, item.id]);
                                  }
                                }}
                              />
                            </td>
                            <td className="py-4 px-4 text-center text-zinc-600 font-mono font-bold">
                              {(index + 1).toString().padStart(2, '0')}
                            </td>
                            <td className="py-4 px-4 text-zinc-400 font-bold font-mono">
                              {formattedDate}
                            </td>
                            <td className="py-4 px-4">
                              <div className="flex flex-col">
                                <span className="font-bold text-white uppercase tracking-tight line-clamp-1 group-hover:text-amber-500 transition-colors">
                                  {item.description}
                                </span>
                                <span className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-wider font-mono mt-0.5">
                                  {item.category}
                                </span>
                              </div>
                            </td>
                            <td className="py-4 px-4 font-semibold text-zinc-300 uppercase">
                              {item.party}
                            </td>
                            <td className="py-4 px-4 text-right font-black text-white tabular-nums">
                              R$ {item.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-4 px-4 text-center">
                              <span className={cn(
                                "inline-flex px-2 py-1 text-[8px] font-black uppercase tracking-wider rounded-lg font-mono",
                                item.status === 'paid' && "bg-emerald-500/10 text-emerald-500",
                                item.status === 'pending' && "bg-amber-500/10 text-amber-500",
                                item.status === 'billed' && "bg-blue-500/10 text-blue-500"
                              )}>
                                {item.status === 'paid' && 'PAGO'}
                                {item.status === 'pending' && 'EM ABERTO'}
                                {item.status === 'billed' && 'FATURADO'}
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => {
                                    if (item.originType === 'transaction') {
                                      setSelectedTransactionForEdit(item.raw);
                                    } else {
                                      setSelectedClientTripForEdit(item.raw);
                                    }
                                  }}
                                  title="Editar Registro"
                                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-all cursor-pointer"
                                >
                                  <FileText size={12} />
                                </button>
                                <button
                                  onClick={() => generateIndividualItemPdf(item)}
                                  title="Gerar Dossiê do Item"
                                  className="p-2 bg-gradient-to-b from-[#FCD34D] to-[#D4AF37] hover:from-white hover:to-zinc-200 text-zinc-950 rounded-lg transition-all cursor-pointer"
                                >
                                  <Printer size={12} className="stroke-[3.5]" />
                                </button>
                                {item.originType === 'charter' && (
                                  <button
                                    onClick={() => handleDeleteCharterTrip(item.id)}
                                    title="Excluir Serviço Realizado"
                                    className="p-2 bg-rose-950/20 hover:bg-rose-650 text-rose-500 hover:text-white rounded-lg border border-rose-500/20 transition-all cursor-pointer inline-flex items-center justify-center"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-zinc-900 bg-zinc-950/60 flex justify-between items-center font-mono text-[10px] text-zinc-500 uppercase font-black">
              <span>Filtro selecionado: {selectedCardHistory} ({selectedHistoryItemIds.length} de {cardHistoryItems.length} selecionados)</span>
              <span>Montante Selecionado: R$ {cardHistoryItems.filter(item => selectedHistoryItemIds.includes(item.id)).reduce((s, i) => s + i.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Editar Fretamento Faturavel do Cliente */}
      {selectedClientTripForEdit && (
        <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-850 flex justify-between items-center bg-zinc-950/40 font-mono">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500">
                  <FileDown size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight font-sans">Editar Fretamento</h3>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 font-sans">Atualizar detalhes contábeis do serviço do cliente</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedClientTripForEdit(null)} 
                className="text-zinc-500 hover:text-white p-1.5 hover:bg-zinc-850 rounded-xl transition-all cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 flex-1 text-left">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Cliente Fretamento</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-zinc-500 uppercase font-bold outline-none cursor-not-allowed"
                    value={selectedClientTripForEdit.client || ''}
                    disabled
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Descrição do Serviço *</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700"
                    placeholder="Ex: Transporte Viagem de Campo Noturna"
                    value={selectedClientTripForEdit.description || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, description: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Data / Hora de Embarque *</label>
                  <input
                    type="datetime-local"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700"
                    value={selectedClientTripForEdit.dateTime || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, dateTime: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-amber-500 uppercase tracking-widest block ml-1">Preço do Serviço (R$)</label>
                  <input
                    type="number"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700 font-mono"
                    placeholder="Ex: 350.00" 
                    value={selectedClientTripForEdit.value || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, value: parseFloat(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Faturamento / Situação</label>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700 cursor-pointer"
                    value={selectedClientTripForEdit.paymentStatus || 'open'}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, paymentStatus: e.target.value})}
                  >
                    <option value="open">Aberto (Não Recebido)</option>
                    <option value="billed">Faturado (Enviado Financeiro)</option>
                    <option value="received">Recebido (Pago)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Status da Viagem</label>
                  <select
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700 cursor-pointer"
                    value={selectedClientTripForEdit.status || 'active'}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, status: e.target.value})}
                  >
                    <option value="active">Ativo (Confirmado)</option>
                    <option value="cancelled">Cancelado</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Origem / Garagem</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700"
                    placeholder="Ex: Rio do Sul, Centro" 
                    value={selectedClientTripForEdit.origin || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, origin: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Destino Final</label>
                  <input
                    type="text"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700"
                    placeholder="Ex: Blumenau, Term. Central" 
                    value={selectedClientTripForEdit.destination || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, destination: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Passageiros</label>
                  <input
                    type="number"
                    className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2.5 px-3 text-xs text-white uppercase font-bold outline-none focus:border-zinc-700 font-mono"
                    placeholder="Ex: 15" 
                    value={selectedClientTripForEdit.passengerCount || ''}
                    onChange={(e) => setSelectedClientTripForEdit({...selectedClientTripForEdit, passengerCount: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>
            </div>

            <div className="p-6 bg-zinc-950 border-t border-zinc-850 flex justify-between items-center rounded-b-[32px]">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm("Tem certeza de que deseja apagar este fretamento/serviço realizado? Esta ação removerá o registro permanentemente das contabilidades.")) {
                    try {
                      await deleteDoc(doc(db, 'charter_client_trips', selectedClientTripForEdit.id));
                      toast.success("Serviço de fretamento excluído com sucesso!");
                      setSelectedClientTripForEdit(null);
                    } catch (err) {
                      console.error(err);
                      toast.error("Erro ao excluir o serviço de fretamento.");
                    }
                  }
                }}
                className="px-5 py-2.5 bg-rose-950/40 hover:bg-rose-600 border border-rose-500/20 text-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
              >
                Excluir Serviço
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedClientTripForEdit(null)}
                  className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                  try {
                    await updateDoc(doc(db, 'charter_client_trips', selectedClientTripForEdit.id), cleanUndefined({
                      description: selectedClientTripForEdit.description || '',
                      dateTime: selectedClientTripForEdit.dateTime || '',
                      value: parseFloat(selectedClientTripForEdit.value) || 0,
                      paymentStatus: selectedClientTripForEdit.paymentStatus || 'open',
                      status: selectedClientTripForEdit.status || 'active',
                      origin: selectedClientTripForEdit.origin || '',
                      destination: selectedClientTripForEdit.destination || '',
                      passengerCount: parseInt(selectedClientTripForEdit.passengerCount) || 0,
                      updatedAt: new Date().toISOString()
                    }));
                    toast.success('Fretamento atualizado com sucesso!');
                    setSelectedClientTripForEdit(null);
                  } catch (err) {
                    console.error(err);
                    toast.error('Erro ao atualizar fretamento.');
                  }
                }}
                className="px-5 py-2.5 bg-white hover:bg-zinc-200 text-zinc-950 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer"
              >
                Salvar Alterações
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
