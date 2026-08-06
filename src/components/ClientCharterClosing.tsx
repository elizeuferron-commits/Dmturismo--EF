import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Calendar, 
  FileText, 
  DollarSign, 
  CheckSquare, 
  Square, 
  ChevronRight, 
  TrendingUp, 
  ShieldCheck, 
  Clock, 
  ClipboardCheck, 
  Percent, 
  Plus, 
  Briefcase 
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { toast } from 'sonner';

// Utility helper to safely merge classes
const cn = (...classes: any[]) => classes.filter(Boolean).join(' ');

interface CharterClient {
  id: string;
  name: string;
  companyName?: string;
  document?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

interface ClientTrip {
  id: string;
  client: string;
  clientId?: string;
  dateTime?: string;
  description?: string;
  origin?: string;
  destination?: string;
  value?: number;
  driverId?: string;
  vehicleId?: string;
  status?: string; // e.g. 'pending', 'completed', 'cancelled'
  paymentStatus?: 'open' | 'billed' | 'received';
}

interface FleetRoute {
  id: string;
  name: string;
  client: string;
  type: 'factory' | 'school' | 'regular_random' | 'other';
  contractValue?: number;
  daysOfWeek?: number[];
  completedDates?: string[];
  customTrips?: Array<{
    id: string;
    dateTime?: string;
    description?: string;
    driverId?: string;
    vehicleId?: string;
    completed?: boolean;
  }>;
}

interface ClientCharterClosingProps {
  clients: CharterClient[];
  clientCharters: ClientTrip[];
  routes: FleetRoute[];
  employees: any[];
  vehicles: any[];
  isOwner: boolean;
  onClose?: () => void;
}

export const ClientCharterClosing: React.FC<ClientCharterClosingProps> = ({
  clients,
  clientCharters,
  routes,
  employees,
  vehicles,
  isOwner,
  onClose
}) => {
  // 1. Core Filter States
  const [selectedClientId, setSelectedClientId] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return format(d, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  // 2. Settlement Adjustments
  const [discount, setDiscount] = useState<number>(0);
  const [addition, setAddition] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('boleto');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 3. Selection lists for manual item exclusion
  const [selectedContracts, setSelectedContracts] = useState<Record<string, boolean>>({});
  const [selectedTrips, setSelectedTrips] = useState<Record<string, boolean>>({});

  // Get active selected client details
  const activeClient = useMemo(() => {
    if (selectedClientId === 'all') return null;
    return clients.find(c => c.id === selectedClientId) || {
      id: 'custom',
      name: selectedClientId,
      companyName: 'AVULSO NÃO CADASTRADO'
    } as CharterClient;
  }, [selectedClientId, clients]);

  // Combined client directory (registered clients + dynamic client names)
  const allAvailableClients = useMemo(() => {
    const mapped = clients.map(c => ({ id: c.id, name: c.name, isRegistered: true }));
    const registeredNames = new Set(clients.map(c => c.name.toLowerCase()));
    
    // Add dynamic ones from trips
    clientCharters.forEach(trip => {
      if (trip.client && !registeredNames.has(trip.client.toLowerCase())) {
        mapped.push({ id: trip.client, name: trip.client, isRegistered: false });
        registeredNames.add(trip.client.toLowerCase());
      }
    });

    return mapped.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, clientCharters]);

  // Initialize and filter calculations based on parameters
  const clientClosingItems = useMemo(() => {
    if (selectedClientId === 'all') {
      return {
        contracts: [],
        trips: [],
        totalRaw: 0
      };
    }

    const clientName = activeClient?.name || '';

    // A. Recurrent Fixed Routes Filtered
    const matchedRoutes = routes.filter(r => r.client?.toLowerCase() === clientName.toLowerCase());
    const calculatedContracts = matchedRoutes.map(route => {
      let tripsCount = 0;
      
      // Calculate active operations inside period
      if ((route.type === 'other' || route.type === 'regular_random') && route.customTrips) {
        route.customTrips.forEach(trip => {
          if (trip.dateTime && (!trip.completed || trip.completed)) {
            const tripDate = trip.dateTime.split('T')[0];
            if (tripDate >= startDate && tripDate <= endDate) {
              tripsCount++;
            }
          }
        });
      } else {
        const completedDatesInPeriod = (route.completedDates || []).filter(dateStr => {
          return dateStr >= startDate && dateStr <= endDate;
        });

        if (completedDatesInPeriod.length > 0) {
          tripsCount = completedDatesInPeriod.length;
        } else if (route.daysOfWeek && route.daysOfWeek.length > 0) {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const current = new Date(start);
          while (current <= end) {
            if (route.daysOfWeek.includes(current.getDay())) {
              tripsCount++;
            }
            current.setDate(current.getDate() + 1);
          }
        }
      }

      const activeValue = route.contractValue || 0;

      return {
        id: route.id,
        name: route.name.toUpperCase(),
        type: route.type,
        tripsCount,
        value: activeValue
      };
    });

    // B. Individual Dynamic Trips Filtered
    const matchedTrips = clientCharters.filter(t => {
      const matchClient = t.clientId === selectedClientId || t.client?.toLowerCase() === clientName.toLowerCase();
      const tripDate = t.dateTime ? t.dateTime.split('T')[0] : '';
      const matchPeriod = tripDate >= startDate && tripDate <= endDate;
      return matchClient && matchPeriod && t.status !== 'cancelled' && t.paymentStatus !== 'received';
    });

    const calculatedTrips = matchedTrips.map(t => {
      const driver = employees.find(e => e.id === t.driverId);
      const vehicle = vehicles.find(v => v.id === t.vehicleId);

      return {
        id: t.id,
        origin: t.origin || 'NÃO INFORMADA',
        destination: t.destination || 'NÃO INFORMADA',
        dateTime: t.dateTime || '',
        value: t.value || 0,
        driverName: driver ? driver.name.toUpperCase() : 'NÃO ALOCADO',
        vehiclePlate: vehicle ? `${vehicle.plate.toUpperCase()} (${vehicle.model})` : 'NÃO ALOCADO',
        description: t.description || ''
      };
    });

    return {
      contracts: calculatedContracts,
      trips: calculatedTrips
    };
  }, [selectedClientId, startDate, endDate, activeClient, routes, clientCharters, employees, vehicles]);

  // Set initial selections when items change
  React.useEffect(() => {
    const contractsMap: Record<string, boolean> = {};
    clientClosingItems.contracts.forEach(c => {
      contractsMap[c.id] = true;
    });
    setSelectedContracts(contractsMap);

    const tripsMap: Record<string, boolean> = {};
    clientClosingItems.trips.forEach(t => {
      tripsMap[t.id] = true;
    });
    setSelectedTrips(tripsMap);
  }, [clientClosingItems]);

  // Active Summation based on checkboxes checked
  const activeCalculations = useMemo(() => {
    let contractsValue = 0;
    let contractsCount = 0;
    let tripsValue = 0;
    let tripsCount = 0;

    clientClosingItems.contracts.forEach(c => {
      if (selectedContracts[c.id]) {
        contractsValue += c.value;
        contractsCount += c.tripsCount;
      }
    });

    clientClosingItems.trips.forEach(t => {
      if (selectedTrips[t.id]) {
        tripsValue += t.value;
        tripsCount += 1;
      }
    });

    const subtotal = contractsValue + tripsValue;
    const finalTotal = Math.max(0, subtotal - discount + addition);

    return {
      contractsValue,
      contractsCount,
      tripsValue,
      tripsCount,
      subtotal,
      finalTotal
    };
  }, [clientClosingItems, selectedContracts, selectedTrips, discount, addition]);

  const toggleSelectAllContracts = () => {
    const hasUnchecked = clientClosingItems.contracts.some(c => !selectedContracts[c.id]);
    const nextMap: Record<string, boolean> = {};
    clientClosingItems.contracts.forEach(c => {
      nextMap[c.id] = hasUnchecked;
    });
    setSelectedContracts(nextMap);
  };

  const toggleSelectAllTrips = () => {
    const hasUnchecked = clientClosingItems.trips.some(t => !selectedTrips[t.id]);
    const nextMap: Record<string, boolean> = {};
    clientClosingItems.trips.forEach(t => {
      nextMap[t.id] = hasUnchecked;
    });
    setSelectedTrips(nextMap);
  };

  // 4. Firestore Ledger Settlement Execution
  const handleExecuteSettlement = async () => {
    if (selectedClientId === 'all') {
      toast.error('Por favor, selecione um cliente para efetuar o fechamento.');
      return;
    }
    if (activeCalculations.finalTotal <= 0) {
      toast.error('O montante líquido ajustado deve ser maior que zero.');
      return;
    }

    setIsSaving(true);
    try {
      const clientName = activeClient?.name || 'Cliente';
      const formattedStart = format(new Date(startDate), 'dd/MM/yyyy');
      const formattedEnd = format(new Date(endDate), 'dd/MM/yyyy');
      
      const transactionDescription = `FECHAMENTO DE FRETAMENTO POR CLIENTE - ${clientName.toUpperCase()} (${formattedStart} A ${formattedEnd})`;
      
      // Save accounts receivable ledger transaction
      await addDoc(collection(db, 'financial_transactions'), {
        type: 'receivable',
        description: transactionDescription,
        category: 'recebimento_fretamento',
        amount: activeCalculations.finalTotal,
        dueDate: endDate,
        status: 'pending',
        provider: clientName.toUpperCase(),
        notes: `Fechamento Consolidado no período de ${formattedStart} a ${formattedEnd}. Subtotal: R$ ${activeCalculations.subtotal.toFixed(2)}, Descontos: R$ ${discount.toFixed(2)}, Acréscimos: R$ ${addition.toFixed(2)}, Condição: ${paymentMethod.toUpperCase()}`,
        createdAt: new Date().toISOString()
      });

      // Update active dynamic trips database status to billed or received
      let completedTripsCount = 0;
      for (const trip of clientClosingItems.trips) {
        if (selectedTrips[trip.id]) {
          await updateDoc(doc(db, 'charter_client_trips', trip.id), {
            paymentStatus: paymentMethod === 'dinheiro' ? 'received' : 'billed',
            updatedAt: serverTimestamp()
          });
          completedTripsCount++;
        }
      }

      toast.success(`Sucesso! Lançado R$ ${activeCalculations.finalTotal.toLocaleString('pt-BR')} no Contas a Receber. ${completedTripsCount} viagens consolidadas.`);
      
      // Reset filter and trigger close callback if present
      setSelectedClientId('all');
      setDiscount(0);
      setAddition(0);
      if (onClose) onClose();
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'financial_transactions/client_closing');
      toast.error(`Falha ao registrar transação: ${err.message || 'Erro de rede'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 5. PDF Invoice Generation Engine using jsPDF & autoTable
  const handleGenerateInvoicePDF = async () => {
    if (selectedClientId === 'all') {
      toast.error('Selecione um cliente para exportar o PDF.');
      return;
    }

    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    const clientName = (activeClient?.name || 'Cliente').toUpperCase();
    const formattedStart = format(new Date(startDate), 'dd/MM/yyyy');
    const formattedEnd = format(new Date(endDate), 'dd/MM/yyyy');

    // Clean Corporate Dark Slate Theme Header Bar
    doc.setFillColor(24, 24, 27); // Zinc-900 (#18181b)
    doc.rect(0, 0, 210, 45, 'F');

    // Corporate Typography
    doc.setTextColor(255, 107, 0); // brand-accent #ff6b00
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.text('DM TURISMO', 15, 20);

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.text('TECNOLOGIA, EFICIÊNCIA E SEGURANÇA EM TRANSPORTES', 15, 26);
    doc.text('DPT FINANCEIRO & FATURAMENTO OPERACIONAL', 15, 31);

    doc.setFontSize(10);
    doc.text(`EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 145, 18);
    doc.text(`REFERÊNCIA: ${formattedStart} A ${formattedEnd}`, 145, 24);

    // Client Corporate Profile
    doc.setTextColor(24, 24, 27);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('1. DADOS DO CLIENTE / CONTRATANTE', 15, 58);
    doc.setDrawColor(228, 228, 231);
    doc.line(15, 61, 195, 61);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.text('NOME / IDENTIFICADOR:', 15, 69);
    doc.setFont('helvetica', 'normal');
    doc.text(clientName, 55, 69);

    doc.setFont('helvetica', 'bold');
    doc.text('RAZÃO SOCIAL:', 15, 75);
    doc.setFont('helvetica', 'normal');
    doc.text((activeClient?.companyName || 'NÃO CONFIGURADO').toUpperCase(), 55, 75);

    doc.setFont('helvetica', 'bold');
    doc.text('DOC. FEDERAL (CNPJ/CPF):', 15, 81);
    doc.setFont('helvetica', 'normal');
    doc.text((activeClient?.document || 'NÃO CONFIGURADO'), 55, 81);

    doc.setFont('helvetica', 'bold');
    doc.text('WHATSAPP / TELEFONE:', 15, 87);
    doc.setFont('helvetica', 'normal');
    doc.text((activeClient?.phone || 'NÃO CONFIGURADO'), 55, 87);

    doc.setFont('helvetica', 'bold');
    doc.text('EMAIL FINANCEIRO:', 15, 93);
    doc.setFont('helvetica', 'normal');
    doc.text((activeClient?.email || 'NÃO CONFIGURADO').toLowerCase(), 55, 93);

    // Financial Overview Table
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('2. APURAÇÃO CONSOLIDADA DOS SERVIÇOS', 15, 108);
    doc.line(15, 111, 195, 111);

    const rows: any[] = [];
    
    // Add recurrent contracts
    clientClosingItems.contracts.forEach(c => {
      if (selectedContracts[c.id]) {
        rows.push([
          'CONTRATO RECORRENTE MENSAL',
          c.name,
          `${c.tripsCount} dias operados`,
          `R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);
      }
    });

    // Add individual dynamic trips
    clientClosingItems.trips.forEach(t => {
      if (selectedTrips[t.id]) {
        const tripDate = t.dateTime ? format(new Date(t.dateTime), 'dd/MM/yyyy HH:mm') : '';
        rows.push([
          `VIAGEM AVULSA - ${tripDate}`,
          `${t.origin} -> ${t.destination}`.toUpperCase(),
          `MOT: ${t.driverName}`,
          `R$ ${t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]);
      }
    });

    autoTable(doc, {
      startY: 115,
      head: [['CATEGORIA / DATA', 'DESCRIÇÃO COMPLETA DA ESCALA / ROTA', 'OPERADO POR', 'VALOR COBRADO']],
      body: rows,
      theme: 'grid',
      headStyles: {
        fillColor: [39, 39, 42],
        textColor: [255, 255, 255],
        fontSize: 8,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [24, 24, 27]
      },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 80 },
        2: { cellWidth: 35 },
        3: { cellWidth: 25, halign: 'right' }
      }
    });

    // Settlement Totals Summary Right Align
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    
    doc.setDrawColor(244, 244, 245);
    doc.setFillColor(244, 244, 245);
    doc.rect(120, finalY, 75, 40, 'F');
    doc.rect(120, finalY, 75, 40, 'D');

    doc.setFontSize(8.5);
    doc.setTextColor(82, 82, 91);
    doc.setFont('helvetica', 'bold');
    
    doc.text('SUBTOTAL BRUTO:', 125, finalY + 8);
    doc.text('DESCONTOS (R$):', 125, finalY + 16);
    doc.text('ACRÉSCIMOS / ADICIONAL:', 125, finalY + 24);
    
    doc.setTextColor(255, 107, 0); // Brand Orange Accent
    doc.text('VALOR LÍQUIDO FINAL:', 125, finalY + 33);

    doc.setTextColor(24, 24, 27);
    doc.setFont('helvetica', 'normal');
    doc.text(`R$ ${activeCalculations.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 8, { align: 'right' });
    doc.text(`R$ ${discount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 16, { align: 'right' });
    doc.text(`R$ ${addition.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 24, { align: 'right' });
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 80, 241); // Blue / Accent for Final Gold Value
    doc.text(`R$ ${activeCalculations.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 190, finalY + 33, { align: 'right' });

    // Payment condition and warnings
    doc.setTextColor(113, 113, 122);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'italic');
    doc.text(`Forma de Faturamento preferencial: ${paymentMethod.toUpperCase()}`, 15, finalY + 10);
    doc.text('Obrigado pela preferência e parceria com a DM Turismo.', 15, finalY + 15);
    doc.text('Para dúvidas contratuais, favor contatar dmturismofinanceiro@gmail.com.', 15, finalY + 20);

    // Double Signatories Lines
    const signatureY = finalY + 65;
    doc.setLineWidth(0.5);
    doc.setDrawColor(161, 161, 170);
    
    doc.line(20, signatureY, 90, signatureY);
    doc.line(110, signatureY, 180, signatureY);

    doc.setTextColor(24, 24, 27);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('REPRESENTANTE - DM TURISMO', 55, signatureY + 5, { align: 'center' });
    doc.text(clientName, 145, signatureY + 5, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.text('ADMINISTRAÇÃO FINANCEIRA', 55, signatureY + 9, { align: 'center' });
    doc.text('CONCORDÂNCIA E ASSINATURA', 145, signatureY + 9, { align: 'center' });

    doc.save(`FECHAMENTO_CLIENTE_${clientName.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast.success('Relatório de fechamento PDF gerado!');
  };

  return (
    <div className="space-y-6">
      {/* Parameters Panel */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
        <h3 className="text-xs font-black text-brand-accent uppercase tracking-widest flex items-center gap-1.5">
          <ClipboardCheck size={14} />
          Parâmetros do Fechamento por Cliente
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Selecionar Cliente</label>
            <select
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-brand-accent transition-colors"
            >
              <option value="all">SELECIONE O CLIENTE...</option>
              {allAvailableClients.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name.toUpperCase()} {c.isRegistered ? '(CADASTRADO)' : '(AVULSO)'}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Period (Início)</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-brand-accent transition-colors"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Period (Fim)</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs font-bold text-white outline-none focus:border-brand-accent transition-colors"
            />
          </div>
        </div>
      </div>

      {selectedClientId === 'all' ? (
        <div className="p-16 bg-zinc-900/30 border border-zinc-800/60 rounded-[32px] text-center space-y-3">
          <Building2 size={36} className="text-zinc-700 mx-auto" />
          <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Aguardando Seleção de Cliente</p>
          <p className="text-[9px] font-bold text-zinc-650 uppercase tracking-normal max-w-sm mx-auto">
            Por favor, selecione um dos clientes cadastrados ou parceiros de faturamento avulso para carregar as escalas no período.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          
          {/* Left Column: Registered Card Details + Checklists */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Client Card Profile */}
            {activeClient && clients.find(c => c.id === selectedClientId) && (
              <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-[32px] grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:border-r md:border-zinc-800 md:pr-4">
                  <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest">Informações Cadastrais</h4>
                  <p className="text-base font-black text-white uppercase">{activeClient.name}</p>
                  <p className="text-[10px] text-zinc-500 font-extrabold uppercase">{activeClient.companyName || 'Razão Social não inserida'}</p>
                  <p className="text-[9px] text-zinc-400 font-mono font-bold mt-2">CNPJ: {activeClient.document || 'N/C'}</p>
                </div>
                <div className="space-y-2 md:pl-2">
                  <div className="text-[9px] font-bold text-zinc-400 space-y-1 uppercase">
                    <p><span className="text-zinc-500">Telefone:</span> <span className="text-white font-mono font-bold">{activeClient.phone || 'N/C'}</span></p>
                    <p><span className="text-zinc-500">Email:</span> <span className="text-white font-mono font-bold">{activeClient.email || 'N/C'}</span></p>
                    <p className="leading-relaxed truncate" title={activeClient.address}><span className="text-zinc-500">Endereço:</span> <span className="text-white font-medium">{activeClient.address || 'N/C'}</span></p>
                  </div>
                </div>
              </div>
            )}

            {/* A. Section: Recurrent Monthly Route Contracts */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <Briefcase size={13} className="text-blue-500" />
                    Contratos de Rotas Recorrentes
                  </h4>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5">Mensalidades contratuais regulares no período</p>
                </div>
                {clientClosingItems.contracts.length > 0 && (
                  <button
                    onClick={toggleSelectAllContracts}
                    className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 text-[8px] font-black text-zinc-400 hover:text-white border border-zinc-850 rounded-lg uppercase tracking-wider"
                  >
                    Marcar / Desmarcar Tudo
                  </button>
                )}
              </div>

              {clientClosingItems.contracts.length === 0 ? (
                <div className="py-6 text-center text-[10px] font-bold text-zinc-650 uppercase">
                  Nenhum contrato fixo registrado para este cliente.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {clientClosingItems.contracts.map(c => {
                    const isChecked = !!selectedContracts[c.id];
                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedContracts(prev => ({ ...prev, [c.id]: !prev[c.id] }))}
                        className={cn(
                          "p-4 bg-zinc-950/50 border rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all hover:border-zinc-700 select-none",
                          isChecked ? "border-zinc-800/80" : "border-zinc-900 opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isChecked ? (
                            <CheckSquare size={16} className="text-brand-accent shrink-0" />
                          ) : (
                            <Square size={16} className="text-zinc-800 shrink-0" />
                          )}
                          <div>
                            <p className="text-xs font-black text-white uppercase">{c.name}</p>
                            <p className="text-[9px] font-extrabold text-zinc-500 uppercase mt-0.5">
                              Tipo: {c.type === 'factory' ? 'INDUSTRIAL' : c.type === 'school' ? 'ESCOLAR' : 'OUTRO'} | {c.tripsCount} dias estimados
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-black font-mono text-emerald-500">
                          {isOwner ? `R$ ${c.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••••'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* B. Section: Dynamic Individual Trips */}
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-800 pb-3">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                    <Clock size={13} className="text-emerald-500" />
                    Viagens Avulsas & Eventuais pendentes
                  </h4>
                  <p className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5">Lançamentos avulsos a receber no período</p>
                </div>
                {clientClosingItems.trips.length > 0 && (
                  <button
                    onClick={toggleSelectAllTrips}
                    className="px-2.5 py-1 bg-zinc-950 hover:bg-zinc-800 text-[8px] font-black text-zinc-400 hover:text-white border border-zinc-850 rounded-lg uppercase tracking-wider"
                  >
                    Marcar / Desmarcar Tudo
                  </button>
                )}
              </div>

              {clientClosingItems.trips.length === 0 ? (
                <div className="py-6 text-center text-[10px] font-bold text-zinc-650 uppercase">
                  Sem viagens avulsas adicionais pendentes no período selecionado.
                </div>
              ) : (
                <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
                  {clientClosingItems.trips.map(t => {
                    const isChecked = !!selectedTrips[t.id];
                    const tripDate = t.dateTime ? format(new Date(t.dateTime), 'dd/MM/yyyy HH:mm') : 'N/C';
                    return (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTrips(prev => ({ ...prev, [t.id]: !prev[t.id] }))}
                        className={cn(
                          "p-4 bg-zinc-950/50 border rounded-2xl flex items-center justify-between gap-4 cursor-pointer transition-all hover:border-zinc-700 select-none",
                          isChecked ? "border-zinc-800/80" : "border-zinc-900 opacity-50"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {isChecked ? (
                            <CheckSquare size={16} className="text-brand-accent shrink-0" />
                          ) : (
                            <Square size={16} className="text-zinc-800 shrink-0" />
                          )}
                          <div>
                            <p className="text-[10px] font-black text-brand-accent font-mono">{tripDate}</p>
                            <p className="text-xs font-black text-white uppercase mt-0.5">{t.origin} ➔ {t.destination}</p>
                            <p className="text-[8.5px] font-bold text-zinc-400 uppercase mt-1">
                              VEÍCULO: {t.vehiclePlate} | MOT: {t.driverName}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs font-black font-mono text-emerald-500 shrink-0">
                          {isOwner ? `R$ ${t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••••'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Settlement Receipt Summary & Direct Billing Ledger */}
          <div className="space-y-6">
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-[32px] space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-brand-accent" />
              
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-brand-accent" />
                  Resumo do Fechamento
                </h4>
                <p className="text-[8.5px] font-bold text-zinc-500 uppercase mt-0.5">Detalhamento dos totais computados no lote</p>
              </div>

              {/* Aggregation Stats */}
              <div className="space-y-4 bg-zinc-950 p-5 border border-zinc-850 rounded-2xl text-[10px] font-bold uppercase text-zinc-400">
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-brand-accent uppercase tracking-widest mb-1">Resumo de Serviços</p>
                  <div className="flex justify-between items-center">
                    <span>Dias em andamento:</span>
                    <span className="text-white font-mono font-black">{activeCalculations.contractsCount + activeCalculations.tripsCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Valor médio/viagem:</span>
                    <span className="text-white font-mono font-black">
                      {isOwner && (activeCalculations.contractsCount + activeCalculations.tripsCount) > 0 
                        ? `R$ ${(activeCalculations.subtotal / (activeCalculations.contractsCount + activeCalculations.tripsCount)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                        : 'R$ 0,00'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-zinc-900 my-2" />
                
                <div className="space-y-2">
                  <p className="text-[8px] font-black text-brand-accent uppercase tracking-widest mb-1">Resumo Financeiro</p>
                  <div className="flex justify-between items-center">
                    <span>Total Selecionado (Mês):</span>
                    <span className="text-emerald-500 font-mono font-black">
                      {isOwner ? `R$ ${activeCalculations.subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••••'}
                    </span>
                  </div>
                  {/* Total em aberto do cliente (pendente fora do período ou histórico não pago) */}
                  <div className="flex justify-between items-center">
                    <span>Total em Aberto (Histórico):</span>
                    <span className="text-rose-500 font-mono font-black">
                      {isOwner 
                        ? `R$ ${(clientCharters.filter(t => t.clientId === selectedClientId && t.paymentStatus === 'open').reduce((acc, t) => acc + (t.value || 0), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'R$ ••••••'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Adjustments Section */}
              {isOwner && (
                <div className="space-y-3.5 bg-zinc-950/60 p-4 border border-zinc-850/60 rounded-2xl">
                  <h5 className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    <Percent size={11} className="text-brand-accent" />
                    Ajustes de Cobrança (Faturamento)
                  </h5>
                  
                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Desconto (R$)</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        min="0"
                        value={discount === 0 ? '' : discount}
                        onChange={(e) => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full h-9 bg-zinc-950 border border-zinc-800 focus:border-brand-accent rounded-xl px-2.5 text-xs font-black text-rose-500 outline-none font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Acréscimo (R$)</label>
                      <input
                        type="number"
                        placeholder="0,00"
                        min="0"
                        value={addition === 0 ? '' : addition}
                        onChange={(e) => setAddition(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full h-9 bg-zinc-950 border border-zinc-800 focus:border-brand-accent rounded-xl px-2.5 text-xs font-black text-emerald-500 outline-none font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-wider">Forma / Condição de Faturamento</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 focus:border-brand-accent rounded-xl px-2 text-xs font-black text-white outline-none uppercase"
                    >
                      <option value="boleto">Boleto Bancário</option>
                      <option value="pix">Transferência Pix</option>
                      <option value="deposito">Depósito em Conta (TED/DOC)</option>
                      <option value="dinheiro">Liquidação em Espécime / Dinheiro</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Net Balance Section */}
              <div className="p-4 bg-zinc-950 border border-brand-accent/30 rounded-2xl flex justify-between items-center shadow-inner">
                <div>
                  <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-bold">Total Líquido Devido</p>
                  <p className="text-[7.5px] text-zinc-500 uppercase font-medium mt-0.5">Com descontos e adicionais aplicados</p>
                </div>
                <p className="text-xl font-black font-mono text-brand-accent">
                  {isOwner 
                    ? `R$ ${activeCalculations.finalTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                    : 'R$ ••••••'}
                </p>
              </div>

              {/* Actions Header block */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={handleGenerateInvoicePDF}
                  className="w-full h-11 bg-zinc-950 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <FileText size={14} className="text-brand-accent" />
                  Exportar Relatório PDF
                </button>

                {isOwner && (
                  <button
                    onClick={handleExecuteSettlement}
                    disabled={isSaving || activeCalculations.finalTotal <= 0}
                    className="w-full h-12 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                  >
                    <DollarSign size={14} />
                    {isSaving ? 'REGISTRANDO...' : 'EFETUAR MEU FECHAMENTO'}
                  </button>
                )}
              </div>

              {/* Protection Badge */}
              <div className="flex items-center justify-center gap-1.5 text-zinc-500 text-[8px] font-black uppercase tracking-widest border-t border-zinc-800 pt-3">
                <ShieldCheck size={11} className="text-emerald-500 animate-pulse" />
                <span>Módulo de Conciliação Segura • DM Turismo</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
};
