import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  FileText, 
  Download, 
  Phone, 
  Mail, 
  MapPin, 
  Briefcase, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle,
  FileDown,
  Info,
  Trash2,
  Paperclip,
  Pencil,
  Edit
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { doc, deleteDoc, addDoc, collection, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface ClientDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  client: {
    id: string;
    name: string;
    companyName?: string;
    document?: string;
    phone?: string;
    email?: string;
    address?: string;
    notes?: string;
    defaultTripValue?: number;
  };
  clientTrips: any[];
  employees: any[];
  vehicles: any[];
  onViewOS?: (trip: any) => void;
}

export const ClientDossierModal: React.FC<ClientDossierModalProps> = ({
  isOpen,
  onClose,
  client,
  clientTrips = [],
  employees = [],
  vehicles = [],
  onViewOS
}) => {
  const [isExporting, setIsExporting] = useState<'pdf' | 'txt' | null>(null);

  // States for client profile editing & deletion
  const [isEditingClient, setIsEditingClient] = useState(false);
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    companyName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    defaultTripValue: 0,
    notes: '',
    extraTripsNotes: '',
    extraWorksNotes: ''
  });

  useEffect(() => {
    if (client) {
      setClientForm({
        name: client.name || '',
        companyName: client.companyName || '',
        document: client.document || '',
        phone: client.phone || '',
        email: client.email || '',
        address: client.address || '',
        defaultTripValue: client.defaultTripValue || 0,
        notes: client.notes || '',
        extraTripsNotes: (client as any).extraTripsNotes || '',
        extraWorksNotes: (client as any).extraWorksNotes || ''
      });
    }
  }, [client]);

  const handleSaveClient = async () => {
    if (!clientForm.name.trim()) {
      toast.error("O nome fantasia do cliente é obrigatório.");
      return;
    }
    setIsSavingClient(true);
    const toastId = toast.loading("Salvando dados cadastrais do cliente...");
    try {
      await updateDoc(doc(db, 'charter_clients', client.id), {
        name: clientForm.name.toUpperCase(),
        companyName: clientForm.companyName.toUpperCase(),
        document: clientForm.document,
        phone: clientForm.phone,
        email: clientForm.email.toLowerCase(),
        address: clientForm.address.toUpperCase(),
        defaultTripValue: Number(clientForm.defaultTripValue) || 0,
        notes: clientForm.notes,
        extraTripsNotes: clientForm.extraTripsNotes,
        extraWorksNotes: clientForm.extraWorksNotes
      });
      setIsEditingClient(false);
      toast.success("Dados do cliente atualizados com sucesso!", { id: toastId });
    } catch (e) {
      console.error(e);
      toast.error("Erro ao atualizar dados do cliente.", { id: toastId });
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteClient = async () => {
    const isConfirmed = confirm(
      `ATENÇÃO CRÍTICA: Você tem certeza que deseja EXCLUIR PERMANENTEMENTE o cliente "${client.name}"?\n` +
      `Esta ação é irreversível e apagará o cadastro dele no banco de dados.`
    );
    if (!isConfirmed) return;

    const tripsChoice = confirm(
      `Deseja também apagar TODO O HISTÓRICO de faturamentos/viagens vinculados a este cliente?\n` +
      `Clique em OK para APAGAR TUDO ou em CANCELAR para manter as viagens preservadas para histórico financeiro geral.`
    );

    const toastId = toast.loading("Excluindo cliente do sistema...");
    try {
      if (tripsChoice) {
        for (const t of clientTrips) {
          const collectionName = t.sourceType === 'turismo' ? 'trips' : 'charter_client_trips';
          await deleteDoc(doc(db, collectionName, t.id));
        }
      }
      await deleteDoc(doc(db, 'charter_clients', client.id));
      toast.success("Cliente excluído com sucesso!", { id: toastId });
      onClose();
    } catch (e) {
      console.error(e);
      toast.error("Erro ao excluir cliente.", { id: toastId });
    }
  };

  // States for integrated financial closure
  const [closurePaymentStatus, setClosurePaymentStatus] = useState<'pending' | 'received'>('pending');
  const [closureDueDate, setClosureDueDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [closurePaymentMethod, setClosurePaymentMethod] = useState<string>('PIX');
  const [closureCategory, setClosureCategory] = useState<string>('Receita de Fretamento');
  const [closureNotes, setClosureNotes] = useState<string>('');
  const [isProcessingClosure, setIsProcessingClosure] = useState<boolean>(false);

  const handleClearHistory = async () => {
    const isConfirmed = confirm(`ATENÇÃO: Tem certeza absoluta que deseja APAGAR TODO O HISTÓRICO de lançamentos de viagens para o cliente "${client.name}"? Esta ação é irreversível.`);
    if (!isConfirmed) return;

    try {
      const tripsToDelete = clientTrips;
      if (tripsToDelete.length === 0) {
        toast.info("Não há viagens no histórico deste cliente para apagar.");
        return;
      }
      for (const t of tripsToDelete) {
        const collectionName = t.sourceType === 'turismo' ? 'trips' : 'charter_client_trips';
        await deleteDoc(doc(db, collectionName, t.id));
      }
      toast.success(`Histórico limpo! ${tripsToDelete.length} registros de viagens foram apagados.`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao apagar o histórico de viagens.");
    }
  };

  const handleDeleteTrip = async (tripId: string, sourceType?: string) => {
    const isConfirmed = confirm("Tem certeza que deseja apagar esta viagem do histórico?");
    if (!isConfirmed) return;

    try {
      const collectionName = sourceType === 'turismo' ? 'trips' : 'charter_client_trips';
      await deleteDoc(doc(db, collectionName, tripId));
      toast.success("Viagem removida do histórico com sucesso!");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao remover a viagem.");
    }
  };

  // States for individual trip editing
  const [editingTripId, setEditingTripId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editPaymentStatus, setEditPaymentStatus] = useState<string>('');
  const [isSavingTrip, setIsSavingTrip] = useState<boolean>(false);

  const startEditing = (trip: any) => {
    setEditingTripId(trip.id);
    let valToApply = 0;
    if (trip.sourceType === 'turismo') {
      valToApply = trip.value || 0;
    } else {
      const baseVal = trip.isExtra ? (trip.value || 0) : (client.defaultTripValue || trip.value || 0);
      const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
      valToApply = baseVal + extraVal;
    }
    setEditValue(String(valToApply));
    setEditDescription(trip.description || '');
    setEditNotes(trip.notes || '');
    setEditPaymentStatus(trip.paymentStatus || 'open');
  };

  const handleSaveTripEdit = async (trip: any) => {
    setIsSavingTrip(true);
    const valNum = parseFloat(editValue) || 0;
    const toastId = toast.loading("Salvando alterações...");
    try {
      if (trip.sourceType === 'turismo') {
        let originalPaymentStatus = 'A Receber';
        if (editPaymentStatus === 'received' || editPaymentStatus === 'Pago' || editPaymentStatus === 'Pago/Liquidado') originalPaymentStatus = 'Pago';
        else if (editPaymentStatus === 'billed' || editPaymentStatus === 'Faturado') originalPaymentStatus = 'Faturado';

        await updateDoc(doc(db, 'trips', trip.id), {
          tripValue: valNum,
          title: editDescription,
          notes: editNotes,
          paymentStatus: originalPaymentStatus
        });
      } else {
        let originalPaymentStatus = 'open';
        if (editPaymentStatus === 'received' || editPaymentStatus === 'Pago' || editPaymentStatus === 'Pago/Liquidado') originalPaymentStatus = 'received';
        else if (editPaymentStatus === 'billed' || editPaymentStatus === 'Faturado') originalPaymentStatus = 'billed';

        await updateDoc(doc(db, 'charter_client_trips', trip.id), {
          value: valNum,
          isExtra: true, // Force isExtra to always use customized value
          description: editDescription,
          notes: editNotes,
          paymentStatus: originalPaymentStatus
        });
      }
      toast.success("Viagem atualizada com sucesso!", { id: toastId });
      setEditingTripId(null);
    } catch (error) {
      console.error(error);
      toast.error("Erro ao salvar alterações.", { id: toastId });
    } finally {
      setIsSavingTrip(false);
    }
  };

  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);

  // Filter out any cancelled trips from active operational calculations if necessary
  const activeTrips = clientTrips.filter(t => t.status !== 'cancelled');

  useEffect(() => {
    if (isOpen) {
      setSelectedTripIds(activeTrips.map(t => t.id));
    }
  }, [isOpen, clientTrips]);

  if (!isOpen || !client) return null;

  const selectedTrips = activeTrips.filter(t => selectedTripIds.includes(t.id));
  
  // Total Billed based on selection
  const totalValue = selectedTrips.reduce((acc, t) => {
    if (t.sourceType === 'turismo') {
      return acc + (t.value || 0);
    }
    const baseVal = t.isExtra ? (t.value || 0) : (client.defaultTripValue || t.value || 0);
    const extraVal = (t.hasExtraService && t.extraServiceVal) ? t.extraServiceVal : 0;
    return acc + baseVal + extraVal;
  }, 0);
  
  // Received Value (paid / received) based on selection
  const receivedValue = selectedTrips
    .filter(t => t.paymentStatus === 'received' || t.paymentStatus === 'Pago' || t.status === 'completed' && t.paymentStatus === 'received')
    .reduce((acc, t) => {
      if (t.sourceType === 'turismo') {
        return acc + (t.value || 0);
      }
      const baseVal = t.isExtra ? (t.value || 0) : (client.defaultTripValue || t.value || 0);
      const extraVal = (t.hasExtraService && t.extraServiceVal) ? t.extraServiceVal : 0;
      return acc + baseVal + extraVal;
    }, 0);

  // Open / Unpaid / Billed Value based on selection
  const openValue = totalValue - receivedValue;

  const handleExecuteClosure = async () => {
    if (selectedTripIds.length === 0) {
      toast.warning("Selecione pelo menos uma viagem para efetuar o fechamento.");
      return;
    }

    const isConfirmed = confirm(`Deseja realmente efetuar o fechamento de ${selectedTrips.length} viagens selecionadas no valor total de R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}?`);
    if (!isConfirmed) return;

    setIsProcessingClosure(true);
    const toastId = toast.loading("Registrando fechamento no sistema financeiro...");

    try {
      // 1. Create financial transaction
      const transData = {
        description: `FECHAMENTO - ${client.name.toUpperCase()} (${selectedTrips.length} VIAGENS)`,
        supplier: client.name.toUpperCase(),
        category: closureCategory,
        refType: 'trip_closure',
        refId: client.id,
        type: 'receivable',
        status: closurePaymentStatus === 'received' ? 'paid' : 'pending',
        amount: totalValue,
        dueDate: closureDueDate,
        observations: `Fechamento de faturamento consolidado. Serviços cobrados:\n` + 
          selectedTrips.map((t, idx) => `- [${(t.sourceType || 'FRETAMENTO').toUpperCase()}] ${t.dateTime ? t.dateTime.split('T')[0] : 'S/D'} : ${t.description} (R$ ${(t.value + (t.extraValue || 0))})`).join('\n') +
          `\n\nForma de Pagamento: ${closurePaymentMethod} | Notas: ${closureNotes}`,
        createdAt: new Date().toISOString()
      };

      await addDoc(collection(db, 'financial_transactions'), transData);

      // 2. Update each selected trip
      for (const trip of selectedTrips) {
        if (trip.sourceType === 'turismo') {
          // General trip update
          const newPayStatus = closurePaymentStatus === 'received' ? 'Pago' : 'Faturado';
          await updateDoc(doc(db, 'trips', trip.id), {
            paymentStatus: newPayStatus
          });
        } else {
          // Fretamento trip update
          const newPayStatus = closurePaymentStatus === 'received' ? 'received' : 'billed';
          await updateDoc(doc(db, 'charter_client_trips', trip.id), {
            paymentStatus: newPayStatus
          });
        }
      }

      toast.success("Fechamento financeiro integrado concluído com sucesso e lançado nas receitas!", { id: toastId });
      setSelectedTripIds([]); // Clear selection
      setClosureNotes('');
    } catch (err) {
      console.error(err);
      toast.error("Erro ao processar fechamento financeiro.", { id: toastId });
    } finally {
      setIsProcessingClosure(false);
    }
  };

  const safeFormatDate = (dateStr: string) => {
    if (!dateStr) return 'N/D';
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy HH:mm');
    } catch (e) {
      try {
        return format(new Date(dateStr), 'dd/MM/yyyy HH:mm');
      } catch (err) {
        return dateStr;
      }
    }
  };

  const handleExportPDF = async () => {
    if (selectedTripIds.length === 0) {
      toast.warning('Selecione pelo menos um serviço para gerar o dossiê.');
      return;
    }
    setIsExporting('pdf');
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;

      const clientNameClean = (client.name || 'CLIENTE').toUpperCase();
      const filename = `dossie_financeiro_${clientNameClean.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.pdf`;

      // Royal Blue & Horizon Gold Theme Colors
      const primaryBlue: [number, number, number] = [0, 18, 51]; // #001233 Deep Royal Blue
      const secondaryGold: [number, number, number] = [212, 175, 55]; // #D4AF37 Gold Accent

      // Header block - Eco-Mode
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.line(14, 40, 196, 40);

      // Logo DM (Stylized Text Branding for Low Ink)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text('DM', 14, 18);
      
      doc.setFontSize(16);
      doc.text('TURISMO', 28, 18);

      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text('"Prazer em viajar bem"', 14, 23);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('DOSSIÊ EXECUTIVO & HISTÓRICO DE SERVIÇOS', 14, 29);

      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`EMITIDO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 14, 35);
      doc.text(`SISTEMA DE GESTÃO FINANCEIRA DM TURISMO`, 14, 39);

      // Section 1: Cadastro / Ficha
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text('1. DADOS DE CADASTRO (FICHA DO CLIENTE)', 14, 52);
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.line(14, 55, 196, 55);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);

      // Left Column
      doc.text('Nome Fantasia:', 14, 63);
      doc.text('Razão Social:', 14, 71);
      doc.text('CNPJ / CPF:', 14, 79);
      doc.text('Telefone / WhatsApp:', 14, 87);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(client.name?.toUpperCase() || 'NÃO ESPECIFICADO', 55, 63);
      doc.text(client.companyName?.toUpperCase() || 'NÃO ESPECIFICADO', 55, 71);
      doc.text(client.document || 'NÃO ESPECIFICADO', 55, 79);
      doc.text(client.phone || 'NÃO ESPECIFICADO', 55, 87);

      // Right Column
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text('E-mail Financeiro:', 110, 63);
      doc.text('Endereço Completo:', 110, 71);
      doc.text('Valor por Viagem (Tarifa):', 110, 79);
      doc.text('Observações:', 110, 87);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(15, 23, 42);
      doc.text(client.email || 'NÃO ESPECIFICADO', 152, 63);
      doc.text(client.address || 'NÃO ESPECIFICADO', 152, 71, { maxWidth: 44 });
      doc.text(`R$ ${(client.defaultTripValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 152, 79);
      doc.text(client.notes || 'SEM OBSERVAÇÕES ADICIONAIS', 152, 87, { maxWidth: 44 });

      // Section 2: Resumo Financeiro
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('2. APURAÇÃO DOS VALORES E BALANÇO DE CAIXA', 14, 105);
      doc.line(14, 108, 196, 108);

      // Cards
      doc.setFillColor(248, 250, 252);
      doc.rect(14, 114, 55, 20, 'F');
      doc.rect(74, 114, 55, 20, 'F');
      doc.rect(134, 114, 62, 20, 'F');

      doc.setDrawColor(secondaryGold[0], secondaryGold[1], secondaryGold[2]);
      doc.rect(14, 114, 55, 20, 'D');
      doc.rect(74, 114, 55, 20, 'D');
      doc.rect(134, 114, 62, 20, 'D');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL FATURADO', 18, 120);
      doc.text('TOTAL LIQUIDADO (PAGO)', 78, 120);
      doc.text('SALDO EM ABERTO', 138, 120);

      doc.setFontSize(10.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, 129);
      doc.setTextColor(34, 197, 94); // Green
      doc.text(`R$ ${receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 78, 129);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(`R$ ${openValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 138, 129);

      // Section 3: Tabela de Viagens
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(primaryBlue[0], primaryBlue[1], primaryBlue[2]);
      doc.text('3. DETALHAMENTO DE HISTÓRICO DE SERVIÇOS COBRADOS', 14, 144);
      doc.line(14, 147, 196, 147);

       const tableData = selectedTrips.map((trip, idx) => {
        const formattedDate = safeFormatDate(trip.dateTime);
        const driver = employees.find(e => e.id === trip.driverId)?.name?.split(' ')[0]?.toUpperCase() || 'NÃO ALOC';
        const vehicle = vehicles.find(v => v.id === trip.vehicleId)?.plate?.toUpperCase() || 'NÃO ALOC';
        
        let value = 0;
        if (trip.sourceType === 'turismo') {
          value = trip.value || 0;
        } else {
          const baseVal = trip.isExtra ? (trip.value || 0) : (client.defaultTripValue || trip.value || 0);
          const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
          value = baseVal + extraVal;
        }
        
        let desc = (trip.description || '').toUpperCase();
        if (trip.sourceType !== 'turismo' && trip.hasExtraService && trip.extraServiceDesc) {
          desc += ` (+ ${trip.extraServiceDesc.toUpperCase()})`;
        }
        
        let payStatus = 'ABERTO';
        if (trip.paymentStatus === 'received' || trip.paymentStatus === 'Pago') payStatus = 'RECEBIDO';
        else if (trip.paymentStatus === 'billed' || trip.paymentStatus === 'Faturado') payStatus = 'FATURADO';

        return [
          (idx + 1).toString().padStart(2, '0'),
          formattedDate,
          desc,
          driver,
          vehicle,
          `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          payStatus
        ];
      });

      autoTable(doc, {
        startY: 152,
        head: [['#', 'DATA/HORA', 'ROTA / DESCRIÇÃO DO SERVIÇO', 'MOT.', 'VEÍCULO', 'VALOR', 'SITUAÇÃO']],
        body: tableData,
        theme: 'grid',
        headStyles: {
          fillColor: primaryBlue,
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8
        },
        bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
        columnStyles: {
          0: { halign: 'center' },
          1: { halign: 'center' },
          2: { halign: 'left' },
          3: { halign: 'center' },
          4: { halign: 'center' },
          5: { halign: 'right', fontStyle: 'bold' },
          6: { halign: 'center', fontStyle: 'bold' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: 14, right: 14 }
      });

      doc.save(filename);
      toast.success('Dossiê consolidado em PDF exportado com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório em PDF.');
    } finally {
      setIsExporting(null);
    }
  };

  const handleExportTXT = () => {
    if (selectedTripIds.length === 0) {
      toast.warning('Selecione pelo menos um serviço para gerar o dossiê.');
      return;
    }
    setIsExporting('txt');
    try {
      const clientNameClean = (client.name || 'CLIENTE').toUpperCase();
      const filename = `dossie_financeiro_${clientNameClean.replace(/\s+/g, '_')}_${format(new Date(), 'yyyy_MM_dd')}.txt`;

      let text = '';
      text += `================================================================================\n`;
      text += `                           DM TURISMO - GESTAO PRO                              \n`;
      text += `                DOSSIÊ OPERACIONAL E FINANCEIRO DO CLIENTE                      \n`;
      text += `================================================================================\n\n`;

      text += `GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}\n`;
      text += `EMISSOR  : DM TURISMO TECNOLOGIA\n\n`;

      text += `1. FICHA CADASTRAL DO CLIENTE\n`;
      text += `--------------------------------------------------------------------------------\n`;
      text += `Nome Fantasia          : ${(client.name || 'NÃO ESPECIFICADO').toUpperCase()}\n`;
      text += `Razão Social           : ${(client.companyName || 'NÃO ESPECIFICADO').toUpperCase()}\n`;
      text += `CNPJ / CPF             : ${client.document || 'NÃO ESPECIFICADO'}\n`;
      text += `Telefone de Contato    : ${client.phone || 'NÃO ESPECIFICADO'}\n`;
      text += `E-mail Financeiro      : ${(client.email || 'NÃO ESPECIFICADO').toLowerCase()}\n`;
      text += `Endereço Cadastral     : ${(client.address || 'NÃO ESPECIFICADO').toUpperCase()}\n`;
      text += `Tarifa por Viagem      : R$ ${(client.defaultTripValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      text += `Notas / Observações    : ${(client.notes || 'NENHUMA OBSERVAÇÃO GRAVADA').toUpperCase()}\n\n`;

      text += `2. APURAÇÃO DE CRÉDITO E BALANÇO DE CAIXA\n`;
      text += `--------------------------------------------------------------------------------\n`;
      text += `Total de Viagens Ativas: ${selectedTrips.length} serviços realizados\n`;
      text += `Montante Faturado Total: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      text += `Valor Liquidado (Pago) : R$ ${receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      text += `Saldo Pendente / Aberto: R$ ${openValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;

      text += `3. HISTÓRICO DETALHADO DOS SERVIÇOS COBRADOS\n`;
      text += `--------------------------------------------------------------------------------\n`;
      text += `${'#'.padEnd(3)} ${'DATA/HORA'.padEnd(17)} ${'DESCRIÇÃO / ROTA REALIZADA'.padEnd(35)} ${'MOT.'.padEnd(10)} ${'VALOR'.padEnd(11)} ${'SITUAÇÃO'}\n`;
      text += `--------------------------------------------------------------------------------\n`;

      selectedTrips.forEach((trip, idx) => {
        const indexStr = (idx + 1).toString().padStart(2, '0');
        const formattedDate = safeFormatDate(trip.dateTime);
        
        let value = 0;
        if (trip.sourceType === 'turismo') {
          value = trip.value || 0;
        } else {
          const baseVal = trip.isExtra ? (trip.value || 0) : (client.defaultTripValue || trip.value || 0);
          const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
          value = baseVal + extraVal;
        }
        
        let descStr = (trip.description || '').toUpperCase();
        if (trip.sourceType !== 'turismo' && trip.hasExtraService && trip.extraServiceDesc) {
          descStr += ` (+ ${trip.extraServiceDesc.toUpperCase()})`;
        }
        descStr = descStr.substring(0, 33).padEnd(35);
        
        const driver = (employees.find(e => e.id === trip.driverId)?.name?.split(' ')[0] || 'N/ALOC').toUpperCase().substring(0, 9).padEnd(10);
        const valStr = `R$ ${value.toFixed(2)}`.padEnd(11);
        
        let payStatus = 'ABERTO';
        if (trip.paymentStatus === 'received' || trip.paymentStatus === 'Pago') payStatus = 'RECEBIDO';
        else if (trip.paymentStatus === 'billed' || trip.paymentStatus === 'Faturado') payStatus = 'FATURADO';

        text += `${indexStr.padEnd(3)} ${formattedDate.padEnd(17)} ${descStr} ${driver} ${valStr} ${payStatus}\n`;
      });

      text += `--------------------------------------------------------------------------------\n`;
      text += `Fim do relatório de faturamento do cliente. DM Turismo - Confiança e Pontualidade.\n`;
      text += `================================================================================\n`;

      // Download trigger
      const element = document.createElement('a');
      const file = new Blob([text], { type: 'text/plain;charset=utf-8' });
      element.href = URL.createObjectURL(file);
      element.download = filename;
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success('Dossiê consolidado em formato texto (.TXT) exportado!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao gerar relatório em TXT.');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-[#010618] border border-zinc-800 rounded-[32px] w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header Modal */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-[#001233]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4AF37]/10 border border-[#D4AF37]/20 flex items-center justify-center text-[#D4AF37]">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">Ficha & Dossiê de Fechamento</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                Módulo Financeiro Integrado DM Turismo
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-950/40 hover:bg-zinc-850/80 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Ficha Cadastral (2-column details card) */}
          <div className="bg-[#001233]/20 border border-zinc-800/80 p-5 rounded-[24px] space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
              <div className="flex items-center gap-2 text-[10px] font-black text-[#D4AF37] uppercase tracking-wider">
                <Info size={13} />
                {isEditingClient ? 'Ficha do Cliente (Modo de Edição)' : 'Ficha do Cliente Selecionado'}
              </div>
              {!isEditingClient && (
                <button
                  onClick={() => setIsEditingClient(true)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 hover:bg-[#D4AF37] hover:text-zinc-950 text-[#D4AF37] border border-zinc-800 hover:border-transparent rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  <Edit size={10} />
                  Editar Cadastro
                </button>
              )}
            </div>
            
            {isEditingClient ? (
              <div className="space-y-4 animate-in fade-in duration-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
                  {/* Nome Fantasia */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Nome Fantasia (Obrigatório)</label>
                    <input
                      type="text"
                      value={clientForm.name}
                      onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] uppercase transition-all"
                      placeholder="NOME FANTASIA"
                    />
                  </div>

                  {/* Razão Social */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Razão Social</label>
                    <input
                      type="text"
                      value={clientForm.companyName}
                      onChange={(e) => setClientForm({ ...clientForm, companyName: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] uppercase transition-all"
                      placeholder="RAZÃO SOCIAL"
                    />
                  </div>

                  {/* CPF / CNPJ */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">CPF / CNPJ</label>
                    <input
                      type="text"
                      value={clientForm.document}
                      onChange={(e) => setClientForm({ ...clientForm, document: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] font-mono transition-all"
                      placeholder="00.000.000/0001-00"
                    />
                  </div>

                  {/* Contato / Telefone */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Contato / Telefone</label>
                    <input
                      type="text"
                      value={clientForm.phone}
                      onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] font-mono transition-all"
                      placeholder="(00) 00000-0000"
                    />
                  </div>

                  {/* E-mail Financeiro */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">E-mail Financeiro</label>
                    <input
                      type="email"
                      value={clientForm.email}
                      onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="financeiro@empresa.com"
                    />
                  </div>

                  {/* Endereço Cadastral */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Endereço Cadastral</label>
                    <input
                      type="text"
                      value={clientForm.address}
                      onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] uppercase transition-all"
                      placeholder="Rua, Número, Bairro, Cidade - UF"
                    />
                  </div>

                  {/* Tarifa de Viagem Cadastrada */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Tarifa de Viagem Padrão (R$)</label>
                    <input
                      type="number"
                      value={clientForm.defaultTripValue || ''}
                      onChange={(e) => setClientForm({ ...clientForm, defaultTripValue: parseFloat(e.target.value) || 0 })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-bold text-white outline-none focus:border-[#D4AF37] font-mono transition-all"
                      placeholder="0.00"
                    />
                  </div>

                  {/* Notas de Negócio */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Notas de Negócio</label>
                    <input
                      type="text"
                      value={clientForm.notes}
                      onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                      className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10.5px] font-medium text-white outline-none focus:border-[#D4AF37] transition-all"
                      placeholder="Condições especiais, regras..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Observações Finais de Viagens Extra */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Notas p/ Viagens Extras (Fretamento)</label>
                    <textarea
                      value={clientForm.extraTripsNotes}
                      onChange={(e) => setClientForm({ ...clientForm, extraTripsNotes: e.target.value })}
                      className="w-full h-14 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-[10px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
                      placeholder="Ex: Todas as viagens extras de fim de semana possuem acréscimo de 50%..."
                    />
                  </div>

                  {/* Observações de Trabalhos Extra */}
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Notas p/ Outros Serviços Extra</label>
                    <textarea
                      value={clientForm.extraWorksNotes}
                      onChange={(e) => setClientForm({ ...clientForm, extraWorksNotes: e.target.value })}
                      className="w-full h-14 bg-zinc-950 border border-zinc-800 rounded-xl p-2.5 text-[10px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
                      placeholder="Ex: Serviços de apoio operacional cobrados por hora técnica..."
                    />
                  </div>
                </div>

                {/* Edit Controls */}
                <div className="flex items-center justify-between border-t border-zinc-800/60 pt-3">
                  <button
                    type="button"
                    onClick={handleDeleteClient}
                    className="flex items-center gap-1.5 px-3 py-2 bg-rose-500/10 hover:bg-rose-600 text-rose-500 hover:text-white border border-rose-500/20 hover:border-transparent rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    <Trash2 size={11} />
                    Excluir Cliente
                  </button>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingClient(false)}
                      className="px-3 py-2 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-850 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      disabled={isSavingClient}
                      onClick={handleSaveClient}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#D4AF37] hover:bg-[#Bfa030] text-zinc-950 font-black rounded-xl text-[9px] uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle size={11} className="stroke-[3]" />
                      {isSavingClient ? 'Salvando...' : 'Salvar Ficha'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Nome Fantasia</span>
                  <p className="text-xs font-black text-white uppercase mt-0.5">{client.name || 'Não Informado'}</p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Razão Social</span>
                  <p className="text-xs font-black text-zinc-300 uppercase mt-0.5">{client.companyName || 'Não Informado'}</p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">CPF / CNPJ</span>
                  <p className="text-xs font-bold text-zinc-350 font-mono mt-0.5">{client.document || 'Não Informado'}</p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Contato / Telefone</span>
                  <p className="text-xs font-bold text-zinc-350 font-mono mt-0.5 flex items-center gap-1.5 mt-0.5">
                    <Phone size={12} className="text-[#D4AF37]" /> {client.phone || 'Não Informado'}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">E-mail Financeiro</span>
                  <p className="text-xs font-bold text-zinc-350 font-mono mt-0.5 flex items-center gap-1.5 mt-0.5">
                    <Mail size={12} className="text-[#D4AF37]" /> {client.email || 'Não Informado'}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Endereço Cadastral</span>
                  <p className="text-xs font-medium text-zinc-400 mt-0.5 flex items-center gap-1.5 mt-0.5">
                    <MapPin size={12} className="text-[#D4AF37] shrink-0" /> {client.address || 'Não Informado'}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Tarifa de Viagem Cadastrada</span>
                  <p className="text-xs font-black text-emerald-400 mt-0.5">
                    R$ {(client.defaultTripValue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div>
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Notas de Negócio</span>
                  <p className="text-xs font-medium text-zinc-400 mt-0.5 italic">{client.notes || 'Sem observações'}</p>
                </div>

                {((client as any).extraTripsNotes || (client as any).extraWorksNotes) && (
                  <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-zinc-800/40 pt-3">
                    {/* Extra Trips Notes display */}
                    {(client as any).extraTripsNotes && (
                      <div>
                        <span className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest font-mono">Notas p/ Viagens Extras</span>
                        <p className="text-[10px] font-medium text-zinc-450 mt-0.5 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-850">{(client as any).extraTripsNotes}</p>
                      </div>
                    )}

                    {/* Extra Works Notes display */}
                    {(client as any).extraWorksNotes && (
                      <div>
                        <span className="text-[8px] font-black text-[#D4AF37] uppercase tracking-widest font-mono">Notas p/ Outros Serviços Extra</span>
                        <p className="text-[10px] font-medium text-zinc-450 mt-0.5 bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-850">{(client as any).extraWorksNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* KPI Mini-cards for financials */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] shrink-0">
                <Briefcase size={16} />
              </div>
              <div>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Viagens Ativas</span>
                <p className="text-lg font-black text-white mt-0.5 font-mono">{activeTrips.length}</p>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                <CheckCircle size={16} />
              </div>
              <div>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Valor Liquidado</span>
                <p className="text-lg font-black text-emerald-400 mt-0.5 font-mono">
                  R$ {receivedValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-800 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0">
                <Clock size={16} />
              </div>
              <div>
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Saldo em Aberto</span>
                <p className="text-lg font-black text-rose-400 mt-0.5 font-mono">
                  R$ {openValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>

          {/* History List Header */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider text-zinc-400">
              <span>Histórico de Serviços Cobrados ({activeTrips.length})</span>
              <div className="flex items-center gap-2">
                {activeTrips.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="text-[8px] font-black text-rose-500 hover:text-white bg-rose-950/20 hover:bg-rose-600 border border-rose-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                    title="Apagar todo o histórico de lançamentos deste cliente"
                  >
                    <Trash2 size={10} /> APAGAR HISTÓRICO
                  </button>
                )}
                <span className="text-zinc-600 font-mono">DM TURISMO REAL-TIME</span>
              </div>
            </div>

            {activeTrips.length === 0 ? (
              <div className="py-12 text-center bg-[#001233]/5 border border-dashed border-zinc-800 rounded-2xl">
                <p className="text-xs font-black text-zinc-500 uppercase tracking-widest">Nenhuma viagem registrada para cobrança</p>
              </div>
            ) : (
              <div className="border border-zinc-800/80 rounded-2xl overflow-hidden bg-zinc-950">
                <div className="overflow-x-auto max-h-[220px]">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#001233]/40 border-b border-zinc-800 text-[8px] font-black text-zinc-450 uppercase tracking-wider font-mono">
                        <th className="py-3 px-3 text-center w-10">
                          <input
                            type="checkbox"
                            className="rounded border-zinc-850 bg-zinc-900 text-[#D4AF37] focus:ring-0 cursor-pointer"
                            checked={selectedTripIds.length === activeTrips.length && activeTrips.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTripIds(activeTrips.map(t => t.id));
                              } else {
                                setSelectedTripIds([]);
                              }
                            }}
                          />
                        </th>
                        <th className="py-3 px-4 text-center">#</th>
                        <th className="py-3 px-4">Data/Hora</th>
                        <th className="py-3 px-4">Rota / Descrição</th>
                        <th className="py-3 px-4">Motorista</th>
                        <th className="py-3 px-4">Veículo</th>
                        <th className="py-3 px-4 text-right">Valor</th>
                        <th className="py-3 px-4 text-center">Situação</th>
                        <th className="py-3 px-4 text-center">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60 text-[10px]">
                      {activeTrips.map((trip, idx) => {
                        const tripDriver = employees.find(e => e.id === trip.driverId);
                        const tripVehicle = vehicles.find(v => v.id === trip.vehicleId);
                        
                        let valToApply = 0;
                        if (trip.sourceType === 'turismo') {
                          valToApply = trip.value || 0;
                        } else {
                          const baseVal = trip.isExtra ? (trip.value || 0) : (client.defaultTripValue || trip.value || 0);
                          const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
                          valToApply = baseVal + extraVal;
                        }
                        
                        let payStatusBadge = 'bg-zinc-850 text-zinc-500';
                        let payStatusText = 'ABERTO';
                        if (trip.paymentStatus === 'received' || trip.paymentStatus === 'Pago') {
                          payStatusBadge = 'bg-emerald-500/10 text-emerald-400';
                          payStatusText = 'RECEBIDO';
                        } else if (trip.paymentStatus === 'billed' || trip.paymentStatus === 'Faturado') {
                          payStatusBadge = 'bg-amber-500/10 text-amber-500';
                          payStatusText = 'FATURADO';
                        }

                        return (
                          <React.Fragment key={trip.id}>
                            <tr 
                              className={`hover:bg-[#001233]/15 transition-colors cursor-pointer ${
                                selectedTripIds.includes(trip.id) ? 'bg-[#001233]/5' : ''
                              }`}
                              onClick={() => {
                                if (selectedTripIds.includes(trip.id)) {
                                  setSelectedTripIds(selectedTripIds.filter(id => id !== trip.id));
                                } else {
                                  setSelectedTripIds([...selectedTripIds, trip.id]);
                                }
                              }}
                            >
                              <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  className="rounded border-zinc-850 bg-zinc-900 text-[#D4AF37] focus:ring-0 cursor-pointer"
                                  checked={selectedTripIds.includes(trip.id)}
                                  onChange={() => {
                                    if (selectedTripIds.includes(trip.id)) {
                                      setSelectedTripIds(selectedTripIds.filter(id => id !== trip.id));
                                    } else {
                                      setSelectedTripIds([...selectedTripIds, trip.id]);
                                    }
                                  }}
                                />
                              </td>
                              <td className="py-2 px-4 text-center text-zinc-500 font-mono font-bold">{(idx + 1).toString().padStart(2, '0')}</td>
                              <td className="py-2 px-4 text-zinc-400 font-mono">
                                {safeFormatDate(trip.dateTime)}
                              </td>
                              <td className="py-2 px-4 font-extrabold text-white uppercase truncate max-w-[180px]">
                                {trip.sourceType === 'turismo' && (
                                  <span className="inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider bg-indigo-500/10 text-indigo-400 mr-1.5 font-sans">
                                    TURISMO
                                  </span>
                                )}
                                {trip.description}
                                {trip.sourceType !== 'turismo' && trip.hasExtraService && (
                                  <span className="block text-[7px] font-black text-brand-accent mt-0.5 tracking-wider uppercase font-sans">
                                    + EXTRA: {trip.extraServiceDesc} (+R$ {trip.extraServiceVal})
                                  </span>
                                )}
                                {trip.notes && (
                                  <span className="block text-[8px] text-zinc-400 italic mt-1 font-medium font-sans">
                                    obs: {trip.notes}
                                  </span>
                                )}
                                {trip.sourceType === 'turismo' && onViewOS && (
                                  <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                                    <button
                                      onClick={() => onViewOS(trip)}
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 rounded-md text-[7.5px] font-black uppercase tracking-wider transition-all cursor-pointer font-sans"
                                      title="Ficha da O.S. (Anexo)"
                                    >
                                      <Paperclip size={8} className="text-amber-400" />
                                      <span>Anexo (Ficha OS)</span>
                                    </button>
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-4 text-zinc-400 font-mono uppercase">
                                {tripDriver ? tripDriver.name.split(' ')[0] : 'NÃO ALOC'}
                              </td>
                              <td className="py-2 px-4 text-zinc-400 font-mono uppercase">
                                {tripVehicle ? tripVehicle.plate : 'NÃO ALOC'}
                              </td>
                              <td className="py-2 px-4 text-right font-black text-emerald-400 font-mono">
                                R$ {valToApply.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-4 text-center font-mono">
                                <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${payStatusBadge}`}>
                                  {payStatusText}
                                </span>
                              </td>
                              <td className="py-2 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1.5">
                                  <button
                                    onClick={() => startEditing(trip)}
                                    className="text-amber-400 hover:text-zinc-950 bg-amber-500/10 hover:bg-amber-400 p-1.5 rounded-lg border border-amber-500/20 transition-all cursor-pointer inline-flex items-center justify-center"
                                    title="Editar valores / observações"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTrip(trip.id, trip.sourceType)}
                                    className="text-rose-500 hover:text-white bg-rose-950/20 hover:bg-rose-650 p-1.5 rounded-lg border border-rose-500/20 transition-all cursor-pointer inline-flex items-center justify-center"
                                    title="Excluir lançamento"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                            {editingTripId === trip.id && (
                              <tr className="bg-zinc-900/40 border-l-2 border-[#D4AF37] font-sans" onClick={(e) => e.stopPropagation()}>
                                <td colSpan={9} className="p-4 bg-zinc-950 border-x border-b border-zinc-800/80 rounded-b-xl">
                                  <div className="space-y-4">
                                    <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
                                      <span className="text-[9px] font-black uppercase tracking-wider text-[#D4AF37] flex items-center gap-1.5">
                                        <Pencil size={11} /> Editar Detalhes do Serviço
                                      </span>
                                      <span className="text-[8px] font-bold text-zinc-600 font-mono">
                                        ID: {trip.id} | {trip.sourceType === 'turismo' ? 'TURISMO' : 'FRETAMENTO'}
                                      </span>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                      {/* Valor */}
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Valor (R$)</label>
                                        <input
                                          type="number"
                                          value={editValue}
                                          onChange={(e) => setEditValue(e.target.value)}
                                          className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 text-[10px] font-bold text-white outline-none focus:border-[#D4AF37] transition-all font-mono"
                                          placeholder="0.00"
                                        />
                                      </div>

                                      {/* Descrição / Rota */}
                                      <div className="md:col-span-2 space-y-1">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Rota / Descrição</label>
                                        <input
                                          type="text"
                                          value={editDescription}
                                          onChange={(e) => setEditDescription(e.target.value)}
                                          className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 text-[10px] font-bold text-white uppercase outline-none focus:border-[#D4AF37] transition-all"
                                          placeholder="Descrição da rota"
                                        />
                                      </div>

                                      {/* Status de Pagamento */}
                                      <div className="space-y-1">
                                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Faturamento (Status)</label>
                                        <select
                                          value={editPaymentStatus}
                                          onChange={(e) => setEditPaymentStatus(e.target.value)}
                                          className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg px-2 text-[10px] font-bold text-white uppercase tracking-wider outline-none focus:border-[#D4AF37] transition-all cursor-pointer"
                                        >
                                          <option value="open">Aberto (A Receber)</option>
                                          <option value="billed">Faturado</option>
                                          <option value="received">Recebido (Pago)</option>
                                        </select>
                                      </div>
                                    </div>

                                    {/* Observações */}
                                    <div className="space-y-1">
                                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono block">Observações / Anotações</label>
                                      <textarea
                                        value={editNotes}
                                        onChange={(e) => setEditNotes(e.target.value)}
                                        className="w-full h-16 bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[10px] font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-[#D4AF37] transition-all resize-none"
                                        placeholder="Digite aqui observações adicionais para este faturamento..."
                                      />
                                    </div>

                                    {/* Ações */}
                                    <div className="flex justify-end gap-2 border-t border-zinc-900 pt-3">
                                      <button
                                        onClick={() => setEditingTripId(null)}
                                        className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-800 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                                      >
                                        Cancelar
                                      </button>
                                      <button
                                        onClick={() => handleSaveTripEdit(trip)}
                                        disabled={isSavingTrip}
                                        className="px-4 py-1.5 bg-[#D4AF37] hover:bg-[#Bfa030] text-zinc-950 font-black rounded-lg text-[9px] uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1 disabled:opacity-50"
                                      >
                                        {isSavingTrip ? 'Salvando...' : 'Salvar Alterações'}
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Seção de Fechamento Financeiro Integrado */}
            {selectedTripIds.length > 0 && (
              <div className="bg-[#001233]/40 border border-amber-500/30 p-5 rounded-[24px] space-y-4 animate-in fade-in duration-200">
                <div className="flex items-center gap-2 text-[10px] font-black text-[#D4AF37] uppercase tracking-wider border-b border-zinc-800 pb-2">
                  <DollarSign size={13} className="text-amber-400" />
                  Fechar Faturamento Integrado ({selectedTripIds.length} Viagens Selecionadas)
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                  {/* Valor Total */}
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-800 flex flex-col justify-center">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Total Selecionado</span>
                    <p className="text-lg font-black text-amber-400 font-mono mt-0.5">
                      R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  {/* Status do Pagamento */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Lançar Como</label>
                    <select
                      value={closurePaymentStatus}
                      onChange={(e) => setClosurePaymentStatus(e.target.value as any)}
                      className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10px] font-bold text-zinc-300 uppercase tracking-wider outline-none focus:border-amber-500 cursor-pointer transition-all"
                    >
                      <option value="pending">A Receber (Pendente)</option>
                      <option value="received">Recebido (Pago/Liquidado)</option>
                    </select>
                  </div>

                  {/* Data de Vencimento */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Vencimento</label>
                    <input
                      type="date"
                      value={closureDueDate}
                      onChange={(e) => setClosureDueDate(e.target.value)}
                      className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10px] font-bold text-zinc-300 outline-none focus:border-amber-500 cursor-pointer transition-all font-mono"
                    />
                  </div>

                  {/* Forma de Recebimento */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Meio de Recebimento</label>
                    <select
                      value={closurePaymentMethod}
                      onChange={(e) => setClosurePaymentMethod(e.target.value)}
                      className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10px] font-bold text-zinc-300 uppercase tracking-wider outline-none focus:border-amber-500 cursor-pointer transition-all"
                    >
                      <option value="PIX">PIX</option>
                      <option value="Boleto">Boleto</option>
                      <option value="Transferência">Transf. Bancária</option>
                      <option value="Cartão de Crédito">Cartão de Crédito</option>
                      <option value="Dinheiro">Dinheiro</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs items-end">
                  {/* Categoria Financeira */}
                  <div className="md:col-span-1 flex flex-col gap-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Categoria</label>
                    <select
                      value={closureCategory}
                      onChange={(e) => setClosureCategory(e.target.value)}
                      className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10px] font-bold text-zinc-300 uppercase tracking-wider outline-none focus:border-amber-500 cursor-pointer transition-all"
                    >
                      <option value="Receita de Fretamento">Receita de Fretamento</option>
                      <option value="Viagem / Frete">Viagem / Frete</option>
                      <option value="Receita de Turismo">Receita de Turismo</option>
                      <option value="Receita Geral">Receita Geral</option>
                    </select>
                  </div>

                  {/* Notas */}
                  <div className="md:col-span-2 flex flex-col gap-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest font-mono">Observações de Fechamento</label>
                    <input
                      type="text"
                      value={closureNotes}
                      onChange={(e) => setClosureNotes(e.target.value)}
                      placeholder="Ex: Ref. faturamento quinzenal de fretamentos"
                      className="w-full h-10 bg-zinc-950 border border-zinc-800 rounded-xl px-3 text-[10px] font-medium text-zinc-350 outline-none focus:border-amber-500 transition-all"
                    />
                  </div>

                  {/* Botão Executar Fechamento */}
                  <div className="md:col-span-1">
                    <button
                      disabled={isProcessingClosure}
                      onClick={handleExecuteClosure}
                      className="w-full h-10 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/10 active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle size={14} className="stroke-[3]" />
                      {isProcessingClosure ? 'PROCESSANDO...' : 'REGISTRAR FECHAMENTO'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer / Actions */}
        <div className="p-6 border-t border-zinc-800 bg-zinc-950/80 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest font-mono">
            DM TURISMO PRO • SISTEMA BLINDADO
          </span>
          <div className="flex gap-3 w-full sm:w-auto">
            <button
              disabled={!!isExporting}
              onClick={handleExportTXT}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-3 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer"
            >
              {isExporting === 'txt' ? (
                'GERANDO TXT...'
              ) : (
                <>
                  <FileDown size={14} className="stroke-[2.5]" />
                  Dossiê Texto (.TXT)
                </>
              )}
            </button>
            <button
              disabled={!!isExporting}
              onClick={handleExportPDF}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-b from-[#FCD34D] via-[#D4AF37] to-[#B5891B] text-zinc-950 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg shadow-[#D4AF37]/10"
            >
              {isExporting === 'pdf' ? (
                'GERANDO PDF...'
              ) : (
                <>
                  <FileDown size={14} className="stroke-[3]" />
                  Dossiê PDF (.PDF)
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
