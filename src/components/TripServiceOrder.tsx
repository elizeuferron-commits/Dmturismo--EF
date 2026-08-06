import React, { useEffect, useRef, useState } from 'react';
import { 
  Printer, 
  Bus, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Users, 
  FileText,
  ShieldCheck,
  Navigation,
  Check,
  FileDown,
  FileCode,
  Loader2,
  Info,
  Trash2,
  CornerDownRight,
  UserCheck2,
  FileCheck2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  CalendarDays,
  Coins,
  AlertCircle
} from 'lucide-react';
import { Trip, Vehicle, Employee, FinancialTransaction } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from './UI';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
const RouteMap = React.lazy(() => import('./RouteMap').then(m => ({ default: m.RouteMap })));
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';

interface TripServiceOrderProps {
  trip: Trip;
  vehicle?: Vehicle;
  driver?: Employee;
  secondDriver?: Employee;
  onDelete?: (trip: Trip) => void;
}

export const TripServiceOrder = ({ trip, vehicle, driver, secondDriver, onDelete }: TripServiceOrderProps) => {
  const [checkedPassengers, setCheckedPassengers] = useState<Record<number, boolean>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const orderRef = useRef<HTMLDivElement>(null);
  const [linkedTransactions, setLinkedTransactions] = useState<FinancialTransaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(true);

  useEffect(() => {
    if (!trip.id) return;
    setLoadingTx(true);
    
    // Real-time listener for financial transactions matching this trip ID via cache service
    const unsubscribe = dbCacheService.subscribeCollection('financial_transactions', (list) => {
      const fetched = list
        .filter(tx => tx.refId === trip.id)
        .map(tx => tx as FinancialTransaction);
      
      // Sort client-side to bypass composite index creation requirement on Firestore
      fetched.sort((a, b) => {
        const dateA = a.createdAt || '';
        const dateB = b.createdAt || '';
        return dateB.localeCompare(dateA);
      });
      
      setLinkedTransactions(fetched);
      setLoadingTx(false);
    });
    
    return () => unsubscribe();
  }, [trip.id]);

  const togglePassenger = (idx: number) => {
    setCheckedPassengers(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  const handlePrint = () => {
    window.print();
  };

  // High Fidelity Vector PDF Generator for DM Turismo Service Orders
  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const osNum = trip.osNumber || trip.id.slice(-6).toUpperCase();
      
      // 1. Corporate Branding Header Banner (Dark Zinc background)
      doc.setFillColor(24, 24, 27); // zinc-900 (#18181b)
      doc.rect(0, 0, 210, 42, 'F');
      
      // Royal Blue Accent Bar under header
      doc.setFillColor(26, 80, 241); // brand-accent (#1a50f1)
      doc.rect(0, 40, 210, 2, 'F');
      
      // Typographic Logo in the header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(26, 80, 241); // Royal blue brand-accent
      doc.text('DM TURISMO', 14, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(161, 161, 170); // zinc-400
      doc.text('TRANSPORTE E FRETAMENTO DE ALTO PADRÃO', 14, 24);
      doc.text('Garagem Operacional e Logística de Viagens', 14, 28);
      doc.text('SAC / Plantão: contato@dmturismo.com.br', 14, 32);
      
      // Right side: Document Meta
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(255, 255, 255);
      doc.text('ORDEM DE SERVIÇO', 196, 16, { align: 'right' });
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(26, 80, 241);
      doc.text(`NÚMERO DA O.S.: ${osNum}`, 196, 21, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(161, 161, 170);
      doc.text(`DATA EMISSÃO: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 196, 26, { align: 'right' });
      doc.text(`TIPO: ${trip.tripType === 'mercosur' ? 'VIAGEM MERCOSUL' : trip.tripType === 'interstate' ? 'INTERESTADUAL' : 'ESTADUAL'}`, 196, 30, { align: 'right' });
      doc.text(`STATUS: ${trip.status === 'active' ? 'EM EM ANDAMENTO' : 'PROGRAMADA'}`, 196, 34, { align: 'right' });
      
      // Reset Default Text Styles
      doc.setTextColor(24, 24, 27); // Dark gray
      
      // SECTION 1: INFORMAÇÕES DO ITINERÁRIO
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DADOS DE CADASTRO DA VIAGEM / ITINERÁRIO', 14, 52);
      
      const itinerarioDetails = [
        ['Título da Viagem / Serviço:', trip.title.toUpperCase(), 'Cliente / Fretante:', (trip.client || 'NÃO ESPECIFICADO').toUpperCase()],
        ['Local de Embarque (Origem):', trip.origin.toUpperCase(), 'Local de Desembarque (Destino):', trip.destination.toUpperCase()],
        ['Data & Horário de Partida:', format(new Date(trip.startDate), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR }), 'Status Oficial:', trip.status === 'active' ? 'EM CURSO / OPERANTE' : trip.status === 'completed' ? 'FINALIZADA' : 'ESCALADO / AGENDADO']
      ];
      
      autoTable(doc, {
        startY: 55,
        body: itinerarioDetails,
        theme: 'plain',
        bodyStyles: { fontSize: 8, textColor: [39, 39, 42], fontStyle: 'normal' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, textColor: [113, 113, 122] },
          1: { cellWidth: 65 },
          2: { fontStyle: 'bold', cellWidth: 40, textColor: [113, 113, 122] },
          3: { cellWidth: 55 }
        },
        margin: { left: 14, right: 14 }
      });
      
      let currentY = (doc as any).lastAutoTable.finalY + 8;
      
      // SECTION 2: DADOS DA ESCALA OPERACIONAL (VEÍCULO E MOTORISTAS)
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('2. ESCALA OPERACIONAL (FROTA & TRIPULAÇÃO)', 14, currentY);
      
      const frotaDetails = [
        ['Veículo Escalado:', vehicle ? `${vehicle.model.toUpperCase()} (PLACA: ${vehicle.plate.toUpperCase()})` : 'AGUARDANDO ESCALA', 'Capacidade Frota:', vehicle ? `${vehicle.capacity} LUGARES` : '-- PAS', 'Status Antt:', vehicle?.anttExpiration ? `EXPIRA EM ${format(new Date(vehicle.anttExpiration), 'dd/MM/yyyy')}` : 'REGULARIZADO'],
        ['Motorista Principal:', driver ? `${driver.name.toUpperCase()} (CPF: ${driver.cpf || '---'})` : (trip.driverId ? `${trip.driverId.toUpperCase()} (MANUAL)` : 'NÃO ESCALADO'), 'Contato Celular:', driver?.phone || '---'],
        ['Segundo Motorista (Revezamento):', secondDriver ? `${secondDriver.name.toUpperCase()} (CPF: ${secondDriver.cpf || '---'})` : (trip.secondDriverId ? `${trip.secondDriverId.toUpperCase()} (MANUAL)` : 'NÃO EXIGIDO NESTA ROTA'), 'Contato Celular:', secondDriver?.phone || '---']
      ];
      
      autoTable(doc, {
        startY: currentY + 3,
        body: frotaDetails,
        theme: 'plain',
        bodyStyles: { fontSize: 8, textColor: [39, 39, 42] },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 48, textColor: [113, 113, 122] },
          1: { cellWidth: 52 },
          2: { fontStyle: 'bold', cellWidth: 35, textColor: [113, 113, 122] },
          3: { cellWidth: 60 }
        },
        margin: { left: 14, right: 14 }
      });
      
      currentY = (doc as any).lastAutoTable.finalY + 8;
      
      // SECTION 3: ITINERÁRIO / CRONOGRAMA DE PARADAS (if present)
      if (trip.stops && trip.stops.length > 0) {
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('3. CRONOGRAMA DE PARADAS E PONTOS DE APOIO', 14, currentY);
        
        const stopRows = trip.stops.map((stop, index) => [
          String(index + 1).padStart(2, '0'),
          stop.location.toUpperCase(),
          stop.arrivalTime || '--:--',
          'PREVISTA'
        ]);
        
        autoTable(doc, {
          startY: currentY + 3,
          head: [['ORDEM', 'PONTO / LOCALIZAÇÃO', 'PREVISÃO DE CHEGADA', 'TIPO']],
          body: stopRows,
          theme: 'grid',
          headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 20, fontStyle: 'bold' },
            1: { halign: 'left' },
            2: { cellWidth: 40 },
            3: { cellWidth: 25 }
          },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          margin: { left: 14, right: 14 }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 8;
      }
      
      // SECTION 4: MANIFESTO OFICIAL DE PASSAGEIROS
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`4. MANIFESTO OFICIAL DE PASSAGEIROS EMBARCADOS (${trip.passengers?.length || 0} TOTAL)`, 14, currentY);
      
      if (trip.passengers && trip.passengers.length > 0) {
        const passengerRows = trip.passengers.map((p, idx) => [
          String(idx + 1).padStart(2, '0'),
          p.name.toUpperCase(),
          p.document || '---',
          checkedPassengers[idx] ? '[ X ] EMBARCADO' : '[   ] NÃO REPORTADO'
        ]);
        
        autoTable(doc, {
          startY: currentY + 3,
          head: [['SEQ', 'DADO COMPLETO DO PASSAGEIRO', 'DOCUMENTO DE IDENTIDADE (RG / CPF)', 'STATUS CONTROLE']],
          body: passengerRows,
          theme: 'grid',
          headStyles: { fillColor: [26, 80, 241], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'center', fontSize: 7.5 },
          bodyStyles: { fontSize: 7.5, halign: 'left' },
          columnStyles: {
            0: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
            1: { halign: 'left' },
            2: { cellWidth: 55, halign: 'center' },
            3: { cellWidth: 35, halign: 'center', fontStyle: 'bold' }
          },
          alternateRowStyles: { fillColor: [250, 250, 250] },
          margin: { left: 14, right: 14 }
        });
        
        currentY = (doc as any).lastAutoTable.finalY + 10;
      } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(113, 113, 122);
        doc.text('Manifesto de passageiros em branco.', 14, currentY + 4);
        currentY += 12;
      }
      
      // SECTION 5: OBSERVAÇÕES E NOTAS DE LOGÍSTICA
      if (trip.notes) {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }
        
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(24, 24, 27);
        doc.text('5. OBSERVAÇÕES ESPECIAIS', 14, currentY);
        
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(63, 63, 70);
        
        const splitNotes = doc.splitTextToSize(trip.notes.toUpperCase(), 182);
        doc.text(splitNotes, 14, currentY + 4);
        currentY += (splitNotes.length * 4) + 12;
      }
      
      // SIGNATURE LINES (Ensure it fits at footer level or on page addition)
      if (currentY > 230) {
        doc.addPage();
        currentY = 40;
      } else {
        currentY = Math.max(currentY, 230);
      }
      
      doc.setDrawColor(212, 212, 216); // zinc-300
      doc.line(14, currentY, 90, currentY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(113, 113, 122);
      doc.text('DECLARAÇÃO DE RECEBIMENTO DA GUIA E ESCALA', 14, currentY + 4);
      doc.text(driver ? driver.name.toUpperCase() : (trip.driverId ? trip.driverId.toUpperCase() : 'NOME DO MOTORISTA ESCALADO'), 14, currentY + 8);
      
      doc.line(120, currentY, 196, currentY);
      doc.text('GERENTE DE LOGÍSTICA / DIRETORIA OPERACIONAL', 120, currentY + 4);
      doc.text('AUTORIZADO POR: DEPARTAMENTO DE CONTROLE DM TURISMO', 120, currentY + 8);
      
      doc.save(`OS_DM_TURISMO_${osNum}.pdf`);
      toast.success('Guva de Ordem de Serviço exportada em PDF!');
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao construir o PDF.');
    } finally {
      setIsGenerating(false);
    }
  };

  const manifestCount = trip.passengers?.length || 0;
  const boardedCount = Object.values(checkedPassengers).filter(Boolean).length;
  const vehicleCapacity = vehicle?.capacity || 0;
  const occupancyPercentage = vehicleCapacity > 0 
    ? Math.min(Math.round((manifestCount / vehicleCapacity) * 100), 100) 
    : 0;
  const isOverCapacity = vehicleCapacity > 0 && manifestCount > vehicleCapacity;

  const allChecked = trip.passengers && trip.passengers.length > 0 && 
    trip.passengers.every((_, idx) => checkedPassengers[idx]);

  return (
    <div className="space-y-6">
      {/* Dynamic Actions Ribbon */}
      <div className="flex flex-col sm:flex-row flex-wrap items-center justify-between gap-4 no-print p-4 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-brand-accent">
            <Info size={18} />
          </div>
          <div>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">VISUALIZAÇÃO DA GUIA DE TRANSPORTE</p>
            <p className="text-xs font-black text-white uppercase tracking-tight">Papel Padrão A4 • Impressão Física e PDF Configurados</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {onDelete && (
            <Button 
              onClick={() => onDelete(trip)} 
              className="h-10 px-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white transition-all text-[10px] font-black uppercase tracking-wider"
            >
              <Trash2 size={14} className="mr-1.5" />
              EXCLUIR
            </Button>
          )}

          <Button 
            disabled={isGenerating}
            onClick={handleDownloadPDF} 
            className="h-10 px-4 rounded-xl bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-brand-accent hover:text-white transition-all text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="mr-1.5 animate-spin" />
                CONSTRUINDO...
              </>
            ) : (
              <>
                <FileCheck2 size={14} className="mr-1.5 text-brand-accent" />
                BAIXAR PDF
              </>
            )}
          </Button>

          <Button 
            onClick={handlePrint} 
            className="h-10 px-5 rounded-xl bg-brand-accent text-zinc-950 hover:bg-white border-brand-accent transition-all text-[10px] font-black uppercase tracking-wider"
          >
            <Printer size={14} className="mr-1.5" />
            IMPRIMIR
          </Button>
        </div>
      </div>

      {/* Visual Passenger Summary Widget */}
      <div className="no-print p-6 bg-zinc-900 border border-zinc-800 rounded-2xl shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-brand-accent shadow-inner">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-1">
                Controle de Ocupação & Capacidade
              </h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
                Verificação de passageiros escalonados contra a capacidade técnica do veículo
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {isOverCapacity ? (
              <span className="text-[8px] font-black px-2.5 py-1 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-lg uppercase animate-pulse flex items-center gap-1">
                <AlertCircle size={10} />
                Capacidade Excedida
              </span>
            ) : vehicleCapacity > 0 ? (
              <span className="text-[8px] font-black px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg uppercase flex items-center gap-1">
                <ShieldCheck size={10} />
                Limite Conforme
              </span>
            ) : (
              <span className="text-[8px] font-black px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded-lg uppercase">
                Aguardando Frota
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Col 1: Passageiros Confirmados en lista (Manifesto) */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl flex flex-col justify-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Manifesto do Fretamento</span>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-white tabular-nums">{manifestCount}</span>
              <span className="text-[10px] text-zinc-550 font-bold uppercase">PAX salvos</span>
            </div>
            <p className="text-[7.5px] text-zinc-600 font-black uppercase mt-1">Total listados na guia física</p>
          </div>

          {/* Col 2: Confirmados no Check-in (Embarcados) */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl flex flex-col justify-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Passageiros Confirmados (Check-in)</span>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-xl font-black tabular-nums transition-colors",
                boardedCount > 0 ? "text-emerald-400" : "text-zinc-400"
              )}>
                {boardedCount} / {manifestCount}
              </span>
              <span className="text-[10px] text-zinc-550 font-bold uppercase">embarcados</span>
            </div>
            <p className="text-[7.5px] text-zinc-600 font-black uppercase mt-1">
              {manifestCount > 0 ? `${Math.round((boardedCount / manifestCount) * 100)}% de presença confirmada` : "Nenhum passageiro na escala"}
            </p>
          </div>

          {/* Col 3: Capacidade total do Veículo */}
          <div className="p-4 bg-zinc-950/40 border border-zinc-850 rounded-xl flex flex-col justify-center">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1">Capacidade Total do Veículo</span>
            <div className="flex items-baseline gap-1">
              <span className={cn(
                "text-xl font-black tabular-nums",
                isOverCapacity ? "text-rose-500" : vehicleCapacity > 0 ? "text-brand-accent" : "text-zinc-500"
              )}>
                {vehicleCapacity > 0 ? vehicleCapacity : "---"}
              </span>
              <span className="text-[10px] text-zinc-550 font-bold uppercase">LUGARES</span>
            </div>
            <p className="text-[7.5px] text-zinc-600 font-black uppercase mt-1">
              {vehicle ? `${vehicle.model.toUpperCase()} (${vehicle.plate.toUpperCase()})` : "Sem escala de frota"}
            </p>
          </div>
        </div>

        {/* Custom Visual Progress Track */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider text-zinc-500">
            <span>Uso de Capacidade: {occupancyPercentage}%</span>
            <span>{manifestCount} PAX de {vehicleCapacity} total</span>
          </div>
          
          <div className="h-2.5 w-full bg-zinc-950 rounded-full overflow-hidden border border-zinc-850/80 p-[1px] relative">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isOverCapacity 
                  ? "bg-rose-500" 
                  : occupancyPercentage >= 90 
                    ? "bg-amber-500" 
                    : "bg-gradient-to-r from-orange-600 to-brand-accent"
              )}
              style={{ width: `${Math.min(occupancyPercentage, 100)}%` }}
            />
          </div>
          
          {isOverCapacity && (
            <p className="text-[8px] text-rose-500 font-black uppercase tracking-wider pt-0.5 flex items-center gap-1.5 animate-pulse">
              <AlertCircle size={10} />
              ATENÇÃO: O total de passageiros no manifesto ({manifestCount}) excede a capacidade física limitadora deste veículo ({vehicleCapacity} lugares). Favor reescalar a frota ou reduzir passageiros.
            </p>
          )}

          {!vehicle && (
            <p className="text-[8px] text-amber-500 font-extrabold uppercase tracking-wider pt-0.5 leading-relaxed">
              * Nenhum veículo foi escalado ainda para esta viagem. A capacidade total assumida é de 0 lugares. Vá em "Editar Viagem" para escalonar o ônibus correspondente.
            </p>
          )}
        </div>
      </div>

      {/* Dynamic Route Map Visualization Section */}
      <React.Suspense fallback={
        <div className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-zinc-500 my-4 shadow-xl space-y-3">
          <Loader2 className="animate-spin text-orange-500" size={24} />
          <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">Caregando Geovisualizador de Rota...</p>
        </div>
      }>
        <RouteMap origin={trip.origin} destination={trip.destination} />
      </React.Suspense>

      {/* Linked Financial Transactions List Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-xl no-print space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-500 shadow-inner">
              <Coins size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-widest leading-none mb-1">
                Lançamentos Financeiros Vinculados
              </h3>
              <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wide">
                Controle operacional de fluxo de caixa diretamente ligado a esta viagem
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 mt-2 sm:mt-0">
            <span className="text-[9px] font-black px-2.5 py-1 bg-zinc-800 text-zinc-400 rounded-lg uppercase">
              Registros: {loadingTx ? '...' : linkedTransactions.length}
            </span>
            {!loadingTx && linkedTransactions.length > 0 && (
              <span className="text-[9px] font-black px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg uppercase">
                Total Líquido: R$ {linkedTransactions.reduce((acc, t) => acc + (t.type === 'receivable' ? t.amount : -t.amount), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            )}
          </div>
        </div>

        {loadingTx ? (
          <div className="flex items-center justify-center py-8 text-zinc-500 gap-2">
            <Loader2 size={16} className="animate-spin text-orange-500" />
            <span className="text-[10px] font-black uppercase tracking-wider">
              Carregando fluxo contábil...
            </span>
          </div>
        ) : linkedTransactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center text-zinc-550 space-y-1.5">
            <Info size={24} className="text-zinc-700" />
            <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">
              Nenhuma movimentação financeira vinculada
            </p>
            <p className="text-[9px] text-zinc-500 font-bold uppercase max-w-sm">
              Transações geradas no faturamento do fretamento ou associadas pelo controle de caixa constarão aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[8px] font-black uppercase text-zinc-500 tracking-wide pb-2">
                  <th className="pb-3 px-2">Descrição / Detalhe</th>
                  <th className="pb-3 px-2">Categoria</th>
                  <th className="pb-3 px-2 text-center">Tipo</th>
                  <th className="pb-3 px-2">Vencimento</th>
                  <th className="pb-3 px-2 text-right">Valor</th>
                  <th className="pb-3 px-2 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/40">
                {linkedTransactions.map((tx) => (
                  <tr key={tx.id} className="text-[10px] font-bold text-zinc-300 hover:bg-zinc-850/20 transition-colors">
                    <td className="py-3 px-2">
                      <div>
                        <p className="font-black text-white uppercase">{tx.description}</p>
                        {tx.observations && (
                          <p className="text-[8px] text-zinc-500 mt-0.5 uppercase italic">{tx.observations}</p>
                        )}
                        {tx.refType && (
                          <span className="text-[7.5px] font-black px-1.5 py-0.5 bg-zinc-800 text-zinc-400 border border-zinc-750 rounded uppercase inline-block mt-1">
                            Ref: {tx.refType}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-2 uppercase text-[9px] text-zinc-400 font-extrabold">
                      {tx.category.replace('_', ' ')}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tx.type === 'receivable' ? (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg uppercase inline-flex items-center gap-1">
                          <TrendingUp size={10} />
                          Receita
                        </span>
                      ) : (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg uppercase inline-flex items-center gap-1">
                          <TrendingDown size={10} />
                          Despesa
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 font-mono text-zinc-400 text-[9px]">
                      {tx.dueDate ? format(new Date(tx.dueDate + 'T12:00:00'), 'dd/MM/yyyy') : '---'}
                    </td>
                    <td className={cn(
                      "py-3 px-2 text-right font-black tabular-nums text-[10.5px]",
                      tx.type === 'receivable' ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {tx.type === 'receivable' ? '+' : '-'} R$ {tx.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-2 text-center">
                      {tx.status === 'paid' ? (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-emerald-500 text-zinc-950 rounded-lg uppercase">
                          Liquidado
                        </span>
                      ) : tx.status === 'pending' ? (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg uppercase">
                          Pendente
                        </span>
                      ) : (
                        <span className="text-[8px] font-black px-2 py-0.5 bg-rose-500/15 border border-rose-500/25 text-rose-400 rounded-lg uppercase">
                          Atrasado
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Simulated A4 Print Preview Sheet Container */}
      <div className="w-full overflow-x-auto py-4 bg-zinc-950/40 rounded-3xl border border-zinc-800 flex justify-center shadow-inner select-none lg:p-8">
        <div 
          ref={orderRef} 
          className="print-preview-a4 bg-white text-zinc-900 rounded-none border border-zinc-300 shadow-[0_15px_60px_rgba(0,0,0,0.6)] font-sans w-[210mm] min-h-[297mm] p-12 pr-14 relative flex flex-col justify-between overflow-hidden"
          style={{ boxSizing: 'border-box' }}
        >
          {/* Top Thin Contrast Accent Layer */}
          <div className="absolute top-0 right-0 left-0 h-2 bg-zinc-900" />
          
          <div>
            {/* Sheet Typography Header Block */}
            <div className="grid grid-cols-2 gap-4 border-b-2 border-zinc-900/60 pb-8 mb-8 items-start">
               <div>
                 <div className="flex items-center gap-2.5 mb-2">
                   <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-brand-accent shadow-md">
                     <Bus size={22} className="text-orange-500" strokeWidth={2.5} />
                   </div>
                   <div>
                     <h1 className="text-xl font-extrabold uppercase tracking-tighter text-zinc-950 leading-none">DM TURISMO</h1>
                     <p className="text-[7px] text-zinc-500 font-extrabold tracking-widest uppercase">LOGÍSTICA INTEGRADA</p>
                   </div>
                 </div>
                 <p className="text-[7.5px] font-bold text-zinc-400 uppercase tracking-tight">PROP: GESTÃO DE FRETAMENTO E ROTAS DE VIAGEM</p>
                 <p className="text-[7.5px] font-black text-zinc-800 uppercase tracking-tight leading-normal">GARAGEM OPERACIONAL DM TURISMO • BRASIL / MERCOSUL</p>
               </div>
               
               <div className="text-right flex flex-col justify-between h-full">
                 <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest mb-1">GUIA DE ORDEM DE SERVIÇO</p>
                 <p className="text-2xl font-black text-zinc-950 tracking-tighter leading-none mb-1">
                   {trip.osNumber || `#${trip.id.slice(-6).toUpperCase()}`}
                 </p>
                 <span className="text-[7.5px] text-zinc-400 font-black uppercase">
                   EMISSÃO: {format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                 </span>
               </div>
            </div>

            {/* Core Voyage Content Grid */}
            <div className="space-y-8">
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 relative">
                <span className="absolute -top-2.5 left-4 bg-white px-3 py-0.5 border border-zinc-200 text-[8px] font-black text-zinc-500 rounded-full uppercase tracking-wider">
                  1. DADOS CADASTRAIS DA VIAGEM
                </span>
                
                <div>
                  <h2 className="text-xl font-extrabold uppercase tracking-tight text-zinc-900 mb-1">{trip.title}</h2>
                  <div className="flex items-center gap-1.5 text-[8.5px] text-zinc-500 font-extrabold uppercase">
                    <MapPin size={10} className="text-orange-500" />
                    <span>EMBARQUE: <strong className="text-zinc-800">{trip.origin}</strong></span>
                    <span className="text-zinc-400 mx-1">➔</span>
                    <span>DESEMBARQUE: <strong className="text-zinc-800">{trip.destination}</strong></span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-zinc-200/50">
                  <div>
                    <h5 className="text-[7px] text-zinc-400 font-black uppercase tracking-widest leading-none mb-1">Cliente / Fretante</h5>
                    <p className="text-[9px] font-black text-zinc-800 uppercase truncate" title={trip.client}>
                      {trip.client || 'NÃO ESPECIFICADO'}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-[7px] text-zinc-400 font-black uppercase tracking-widest leading-none mb-1">Percurso</h5>
                    <p className="text-[9px] font-black text-zinc-800 uppercase">
                      {trip.tripType === 'mercosur' ? 'Mercosul / Intl.' : trip.tripType === 'interstate' ? 'Interestadual' : 'Estadual'}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-[7px] text-zinc-400 font-black uppercase tracking-widest leading-none mb-1">Início Realizado/Escalado</h5>
                    <p className="text-[9px] font-black text-zinc-800 uppercase">
                      {format(new Date(trip.startDate), 'dd MMM yyyy • HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <h5 className="text-[7px] text-zinc-400 font-black uppercase tracking-widest leading-none mb-1">Status Oficial</h5>
                    <p className={cn(
                      "text-[9px] font-extrabold uppercase",
                      trip.status === 'active' ? 'text-emerald-600' : trip.status === 'completed' ? 'text-blue-600' : 'text-amber-600'
                    )}>
                      {trip.status === 'active' ? '● Em Curso' : trip.status === 'scheduled' ? 'Agendada' : 'Finalizada'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Vehicle Scale Grid */}
              <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 relative">
                <span className="absolute -top-2.5 left-4 bg-white px-3 py-0.5 border border-zinc-200 text-[8px] font-black text-zinc-500 rounded-full uppercase tracking-wider">
                  2. ESCALA OPERACIONAL DE EQUIPE E FROTA
                </span>
                
                <div className="grid grid-cols-2 gap-6">
                  {/* Left Column: Bus info */}
                  <div className="space-y-3.5">
                    <h4 className="text-[9px] font-black text-zinc-950 uppercase tracking-widest border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                      <Bus size={12} className="text-zinc-600" />
                      Especificações do Veículo
                    </h4>
                    <div>
                      <p className="text-[9px] font-black text-zinc-900 uppercase">
                        {vehicle ? `${vehicle.model} - ${vehicle.type.toUpperCase()}` : 'PREFEITO NÃO CONFIGURADO'}
                      </p>
                      <p className="text-[8px] text-zinc-500 font-medium">
                        PLACA: <strong className="text-zinc-800 font-black">{vehicle?.plate?.toUpperCase() || 'S/PLACA'}</strong> 
                        {vehicle?.factoryYear && <span className="ml-2">• ANO FABR: <strong className="text-zinc-800 font-black">{vehicle.factoryYear}</strong></span>}
                      </p>
                      <p className="text-[8.5px] text-zinc-500 font-medium mt-1">
                        Capacidade Escalada: <span className="text-zinc-800 font-extrabold">{vehicle?.capacity || '42'} Passageiros</span>
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Driver info */}
                  <div className="space-y-3.5">
                    <h4 className="text-[9px] font-black text-zinc-950 uppercase tracking-widest border-b border-zinc-200 pb-1 flex items-center gap-1.5">
                      <User size={12} className="text-zinc-600" />
                      Tripulantes Escalados
                    </h4>
                    <div className="space-y-2">
                      <div>
                        <p className="text-[9px] text-zinc-500 font-medium leading-none mb-0.5">Motorista Principal</p>
                        <p className="text-[9.5px] font-black text-zinc-900 uppercase leading-none">
                          {driver ? driver.name : (trip.driverId || 'SEM ESCALA PRINCIPAL')}
                        </p>
                        {driver?.cpf && <span className="text-[7.5px] text-zinc-500 font-bold block">CPF: {driver.cpf} • TEL: {driver.phone || '---'}</span>}
                      </div>

                      {(secondDriver || trip.secondDriverId) && (
                        <div>
                          <p className="text-[8px] text-zinc-400 font-medium leading-none mb-0.5 flex items-center gap-1">
                            <CornerDownRight size={8} /> No Revezamento (Auxiliar)
                          </p>
                          <p className="text-[9px] font-bold text-zinc-700 uppercase leading-none">
                            {secondDriver ? secondDriver.name : trip.secondDriverId}
                          </p>
                          {secondDriver?.cpf && <span className="text-[7px] text-zinc-400 block font-medium">CPF: {secondDriver.cpf || '---'}</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Stop itineraries if present */}
              {trip.stops && trip.stops.length > 0 && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-6 relative">
                  <span className="absolute -top-2.5 left-4 bg-white px-3 py-0.5 border border-zinc-200 text-[8px] font-black text-zinc-500 rounded-full uppercase tracking-wider">
                    3. ESCALA DE PARADAS E APOIADORES
                  </span>
                  
                  <div className="space-y-2">
                    {trip.stops.map((stop, sIdx) => (
                      <div key={sIdx} className="flex items-center justify-between text-[9px] font-bold text-zinc-800 border-b border-zinc-100 pb-1.5 last:border-none last:pb-0">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-zinc-900 text-brand-accent rounded-full text-[8px] font-black flex items-center justify-center">
                            {sIdx + 1}
                          </span>
                          <span className="uppercase">{stop.location}</span>
                        </div>
                        <span className="font-mono text-zinc-500">{stop.arrivalTime || '--:--'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manifesto Table with interactive check-in buttons in Preview mode */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-zinc-900 px-5 py-3.5 flex justify-between items-center">
                  <h3 className="text-[10px] font-black uppercase text-white tracking-widest flex items-center gap-2">
                    <Users size={14} className="text-orange-500" />
                    4. Manifesto de Passageiros ({trip.passengers?.length || 0})
                  </h3>
                  
                  <div className="no-print flex items-center gap-2">
                    <span className="text-[8px] font-black px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded uppercase">
                      {allChecked ? "PRONTO PARA EMBARQUE ✔" : "CHECK-IN ATIVO"}
                    </span>
                  </div>
                </div>
                
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-zinc-200 text-[8px] font-black uppercase text-zinc-500">
                      <th className="py-2.5 px-4 w-12 text-center">Nº</th>
                      <th className="py-2.5 px-2">NOME COMPLETO DO PASSAGEIRO</th>
                      <th className="py-2.5 px-2 w-44">DOCUMENTO (RG/CPF)</th>
                      <th className="py-2.5 px-4 w-32 text-center no-print">CONTROLE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trip.passengers && trip.passengers.length > 0 ? (
                      trip.passengers.map((p, idx) => (
                        <tr 
                          key={idx} 
                          onClick={() => togglePassenger(idx)}
                          className={cn(
                            "border-b border-zinc-100 text-[9.5px] cursor-pointer hover:bg-zinc-50/80 transition-colors last:border-none",
                            checkedPassengers[idx] && "bg-emerald-500/5 text-emerald-950 font-semibold"
                          )}
                        >
                          <td className="py-2 px-4 text-center font-extrabold text-zinc-400">{idx + 1}</td>
                          <td className="py-2 px-2 uppercase font-black">{p.name}</td>
                          <td className="py-2 px-2 font-mono text-zinc-600 font-semibold">{p.document || 'NÃO FORNECIDO'}</td>
                          <td className="py-2 px-4 text-center no-print">
                            <button 
                              type="button"
                              className={cn(
                                "mx-auto w-4.5 h-4.5 rounded flex items-center justify-center border transition-all",
                                checkedPassengers[idx] 
                                ? "bg-emerald-500 border-emerald-600 text-white" 
                                : "border-zinc-300 hover:border-zinc-500 bg-white"
                              )}
                            >
                              {checkedPassengers[idx] && <Check size={10} strokeWidth={3} />}
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                          Nenhum passageiro adicionado a esta lista de fretamento.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Notes block */}
              {trip.notes && (
                <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-4">
                  <h5 className="text-[8px] text-zinc-400 font-extrabold uppercase tracking-widest mb-1">Observações da Operação</h5>
                  <p className="text-[9px] text-zinc-700 italic uppercase leading-relaxed">{trip.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Compliance & Signatures Footer area */}
          <div className="pt-12 mt-8 border-t border-zinc-200">
             <div className="grid grid-cols-2 gap-10">
               <div>
                  <div className="w-48 border-b border-zinc-400 mx-auto mb-2" />
                  <p className="text-[7px] text-zinc-400 font-medium text-center uppercase leading-none">ASSINATURA DO MOTORISTA RESPONSÁVEL</p>
                  <p className="text-[8px] text-zinc-750 font-black text-center mt-1 uppercase">
                    {driver ? driver.name : (trip.driverId || 'DECLARAÇÃO DE RECEBIMENTO')}
                  </p>
               </div>
               <div>
                  <div className="w-48 border-b border-zinc-400 mx-auto mb-2" />
                  <p className="text-[7px] text-zinc-400 font-medium text-center uppercase leading-none">VISTO OPERACIONAL • GESTÃO DM TURISMO</p>
                  <p className="text-[8px] text-zinc-750 font-black text-center mt-1 uppercase">LOGÍSTICA DE ESCALAS</p>
               </div>
             </div>

             <div className="flex justify-between items-center mt-10 text-[6.5px] text-zinc-400 font-black uppercase tracking-wider">
               <span>Página 01 / 01</span>
               <span>Código Autenticidade: {trip.id.toUpperCase()}</span>
               <span>DM TURISMO LTDA • SISTEMA DE GESTÃO FLORESTAL</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
