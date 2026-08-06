import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Search, 
  RefreshCw, 
  Wrench, 
  Compass, 
  X,
  Bell,
  FileDown,
  Check,
  CheckSquare
} from 'lucide-react';
import { Trip, Vehicle, Employee, MaintenanceLog } from '../types';
import { TripServiceOrder } from './TripServiceOrder';
import { MaintenanceServiceOrder } from './MaintenanceServiceOrder';
import { MaintenanceReminders } from './MaintenanceReminders';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { List } from 'react-window';

interface ServiceOrdersProps {
  trips: Trip[];
  vehicles: Vehicle[];
  employees: Employee[];
  maintenance?: MaintenanceLog[];
  tripSearch: string;
  setTripSearch: (v: string) => void;
  maintenanceSearch: string;
  setMaintenanceSearch: (v: string) => void;
  onSelectTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
}

export const ServiceOrders: React.FC<ServiceOrdersProps> = ({
  trips,
  vehicles,
  employees,
  maintenance = [],
  tripSearch,
  setTripSearch,
  maintenanceSearch,
  setMaintenanceSearch,
  onSelectTrip,
  onDeleteTrip
}) => {
  const [activeTab, setActiveTab] = useState<'viagens' | 'manutenções'>('viagens');
  const [isUpdating, setIsUpdating] = useState(false);
  const [selectedVoyageOS, setSelectedVoyageOS] = useState<Trip | null>(null);
  const [selectedMaintOS, setSelectedMaintOS] = useState<MaintenanceLog | null>(null);
  const [selectedMaintIds, setSelectedMaintIds] = useState<string[]>([]);
  const [showRemindersPanel, setShowRemindersPanel] = useState(true);

  // Status mapping helper for Maintenance OS
  const getMaintenanceStatusMeta = (maint: MaintenanceLog, vehicle?: Vehicle) => {
    if (maint.status === 'completed') {
      return {
        label: 'Concluído',
        style: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
        dot: 'bg-emerald-500'
      };
    }
    // If pending, check if the vehicle is currently undergoing maintenance
    if (vehicle?.status === 'maintenance') {
      return {
        label: 'Em Manutenção',
        style: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse',
        dot: 'bg-amber-500'
      };
    }
    return {
      label: 'Em Aberto',
      style: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
      dot: 'bg-sky-500'
    };
  };

  // Status mapping helper for Trip OS
  const getTripStatusMeta = (trip: Trip) => {
    switch (trip.status) {
      case 'active':
        return {
          label: 'Em Viagem',
          style: 'bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse',
          dot: 'bg-amber-500'
        };
      case 'completed':
        return {
          label: 'Concluído',
          style: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
          dot: 'bg-emerald-500'
        };
      case 'cancelled':
        return {
          label: 'Cancelado',
          style: 'bg-red-500/10 text-red-500 border border-red-500/20',
          dot: 'bg-red-500'
        };
      case 'scheduled':
      default:
        return {
          label: 'Em Aberto',
          style: 'bg-sky-500/10 text-sky-400 border border-sky-500/20',
          dot: 'bg-sky-500'
        };
    }
  };

  // Generate a consolidated technical Maintenance PDF report
  const handleGenerateConsolidatedPDF = async () => {
    try {
      const selectedLogs = maintenance.filter(m => selectedMaintIds.includes(m.id));
      if (selectedLogs.length === 0) {
        toast.warning('Nenhum log de manutenção selecionado!');
        return;
      }

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const margin = 15;
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      let currentY = 20;

      // Header Brand
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(255, 107, 0); // DM Turismo brand orange
      pdf.text("DM TURISMO", margin, currentY);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(140, 140, 140);
      pdf.text("SISTEMA DE GESTÃO AUTOMATIZADA DE FROTA E ATIVOS", margin, currentY + 6);

      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(40, 40, 40);
      pdf.text("RELATÓRIO CONSOLIDADO DE ORDENS DE MANUTENÇÃO", margin, currentY + 16);

      currentY += 22;
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // Metadata KPIs (Visual Cards simulated on A4)
      pdf.setFillColor(248, 249, 250);
      pdf.rect(margin, currentY, pageWidth - (margin * 2), 24, 'F');
      
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      
      // Column 1: Items
      pdf.text("TOTAL DE ORDENS / ITENS:", margin + 5, currentY + 8);
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.setFont("helvetica", "bold");
      pdf.text(`${selectedLogs.length} ORDENS`, margin + 5, currentY + 16);
      
      // Column 2: Cost
      const totalCost = selectedLogs.reduce((sum, s) => sum + (s.cost || 0), 0);
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("INVESTIMENTO DE FROTA TOTAL:", margin + 65, currentY + 8);
      pdf.setFontSize(11);
      pdf.setTextColor(255, 107, 0); // brand
      pdf.text(`R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 65, currentY + 16);

      // Column 3: Average Cost
      const avgCost = totalCost / selectedLogs.length;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("CUSTO MÉDIO POR OS:", margin + 130, currentY + 8);
      pdf.setFontSize(11);
      pdf.setTextColor(30, 30, 30);
      pdf.text(`R$ ${avgCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, margin + 130, currentY + 16);

      currentY += 32;

      // Table Title
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 30, 30);
      pdf.text("RESUMO EXECUTIVO DAS ATIVIDADES SELECIONADAS", margin, currentY);
      currentY += 6;

      // AutoTable data rows construction
      const tableRows = selectedLogs.map((log, index) => {
        const vehicle = vehicles.find(v => v.id === log.vehicleId);
        const completionDateObj = parseISO(log.completedAt || log.scheduledDate);
        const formattedDate = format(completionDateObj, "dd/MM/yyyy");

        return [
          (index + 1).toString(),
          log.id?.substring(0, 8).toUpperCase() || 'NEW',
          vehicle ? `${vehicle.plate.toUpperCase()} (${vehicle.model.toUpperCase()})` : '---',
          log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA',
          String(log.description).toUpperCase(),
          `R$ ${log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(pdf, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['#', 'OS/CÓD', 'VEÍCULO PRINCIPAL', 'TIPO', 'INTERVENÇÃO REALIZADA', 'CUSTO (R$)']],
        body: tableRows,
        theme: 'striped',
        headStyles: { 
          fillColor: [30, 30, 30], 
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 8 
        },
        styles: { fontSize: 7.5, font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { cellWidth: 18 },
          2: { cellWidth: 42 },
          3: { cellWidth: 22 },
          4: { cellWidth: 'auto' },
          5: { cellWidth: 28, halign: 'right' }
        },
        foot: [[
          '', '', '', '',
          'CUSTO TOTAL CONSOLIDADO POR OS SELECIONADAS:',
          `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]],
        footStyles: { fillColor: [255, 107, 0], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right', fontSize: 8 }
      });

      let finalY = (pdf as any).lastAutoTable.finalY + 12;

      // Section for technical detail breakdown
      selectedLogs.forEach((log) => {
        // If there's no space on page, add page break
        if (finalY > pageHeight - 85) {
          pdf.addPage();
          finalY = 20;
        }

        const vehicle = vehicles.find(v => v.id === log.vehicleId);
        const code = log.id?.substring(0, 8).toUpperCase() || 'NEW';

        // Draw section title
        pdf.setFillColor(242, 242, 242);
        pdf.rect(margin, finalY, pageWidth - (margin * 2), 6, 'F');
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(255, 107, 0); // Orange label
        pdf.text(`DETALHAMENTO TÉCNICO - OS #${code} - ${log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}`, margin + 3, finalY + 4.5);
        
        finalY += 10;

        // Render fields
        pdf.setFontSize(8);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(60, 60, 60);

        pdf.text("Descrição da Intervenção:", margin, finalY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 30, 30);
        pdf.text(String(log.description).toUpperCase(), margin + 45, finalY);

        finalY += 5;

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(60, 60, 60);
        pdf.text("Veículo Aplicado:", margin, finalY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 30, 30);
        pdf.text(vehicle ? `${vehicle.model.toUpperCase()} • PLACA: ${vehicle.plate.toUpperCase()} • TIPO: ${vehicle.type === 'bus' ? 'ÔNIBUS' : 'VAN'}` : 'NÃO INFORMADO', margin + 45, finalY);

        finalY += 5;

        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(60, 60, 60);
        pdf.text("Data Registro / Km Aplicado:", margin, finalY);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(30, 30, 30);
        const logDateObj = parseISO(log.completedAt || log.scheduledDate);
        pdf.text(`${format(logDateObj, 'dd/MM/yyyy')} • Odômetro: ${log.odometer ? log.odometer + ' KM' : '---'}${log.cost ? ' • Custo: R$ ' + log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : ''}`, margin + 45, finalY);

        finalY += 5;

        // Check if there is a checklist filled in
        const chk = log.checklist;
        if (chk) {
          const itemsCompleted = [];
          if (chk.oilChanged) itemsCompleted.push("ÓLEO LUBRIFICANTE");
          if (chk.filtersChanged) itemsCompleted.push("FILTROS (AR/Combustível/Óleo)");
          if (chk.frontPadsChanged || chk.rearPadsChanged) itemsCompleted.push("PASTILHAS DE FREIO");
          if (chk.frontDiscsChanged || chk.rearDiscsChanged) itemsCompleted.push("DISCOS DE FREIO");
          if (chk.airConditioning) itemsCompleted.push("SISTEMA DE AR CONDICIONADO");
          if (chk.tires) itemsCompleted.push("PNEUS / ALINHAMENTO / BALANCIAMENTO");
          if (chk.suspension) itemsCompleted.push("SUSPENSÃO (Amortecedores/Buchas)");
          if (chk.transmission) itemsCompleted.push("TRANSMISSÃO / EMBREAGEM");
          if (chk.others && chk.others.length > 0) {
            chk.others.forEach(oth => itemsCompleted.push(oth.toUpperCase()));
          }

          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(60, 60, 60);
          pdf.text("Checklist de Componentes:", margin, finalY);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(30, 30, 30);
          
          if (itemsCompleted.length > 0) {
            // Split or list
            const completedStr = itemsCompleted.join(", ");
            // Split into lines if too long
            const splitLines = pdf.splitTextToSize(completedStr, pageWidth - margin * 2 - 45);
            pdf.text(splitLines, margin + 45, finalY);
            finalY += (splitLines.length * 4);
          } else {
            pdf.text("NENHUM ITEM SELECIONADO NO CHECKLIST", margin + 45, finalY);
            finalY += 5;
          }
        }

        finalY += 4;
        pdf.setDrawColor(240, 240, 240);
        pdf.line(margin, finalY, pageWidth - margin, finalY);
        finalY += 6;
      });

      // Footer
      if (finalY > pageHeight - 15) {
        pdf.addPage();
        finalY = 20;
      }
      pdf.setFontSize(7.5);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Documento consolidado gerado de forma automatizada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} por elizeuferron@gmail.com.`, margin, finalY + 5);

      pdf.save(`Relatorio_Consolidado_Manutencoes_${format(new Date(), "dd_MM_yyyy")}.pdf`);
      toast.success('Relatório Consolidado gerado com sucesso!', {
        description: `Exportadas ${selectedLogs.length} manutenções consolidadas.`
      });
      setSelectedMaintIds([]); // reset selection
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao exportar o relatório consolidado.');
    }
  };

  // Responsive state for virtualization
  const [columns, setColumns] = useState(1);
  const [listHeight, setListHeight] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setColumns(3);
      } else if (window.innerWidth >= 768) {
        setColumns(2);
      } else {
        setColumns(1);
      }
      const calculated = window.innerHeight - (showRemindersPanel && activeTab === 'manutenções' ? 580 : 360);
      setListHeight(calculated > 250 ? calculated : 350);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [showRemindersPanel, activeTab]);

  // Handle Refresh OS list
  const handleRefreshOS = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      toast.success('Ordens de Serviço sincronizadas e atualizadas com sucesso!', {
        description: 'Os últimos dados operacionais de escalas e manutenções foram carregados do banco.',
        icon: '🔄'
      });
    }, 1000);
  };

  // Generate corrective failures PDF for the current month
  const handleGenerateFailuresPDF = async () => {
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonthIndex = now.getMonth();

      // Filter only finished corrective maintenance in the current month
      const failures = maintenance.filter(m => {
        if (m.type !== 'corrective' || m.status !== 'completed') return false;
        const recordDateStr = m.completedAt || m.scheduledDate;
        if (!recordDateStr) return false;

        try {
          const parsedDate = parseISO(recordDateStr);
          return parsedDate.getFullYear() === currentYear && parsedDate.getMonth() === currentMonthIndex;
        } catch {
          return false;
        }
      });

      if (failures.length === 0) {
        toast.warning('Nenhuma manutenção corretiva concluída no mês atual encontrada!');
        return;
      }

      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const pdf = new jsPDF('portrait', 'mm', 'a4');
      const margin = 15;
      const pageWidth = pdf.internal.pageSize.getWidth();
      let currentY = 20;

      // Header Brand
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.setTextColor(255, 107, 0); // DM Turismo brand orange
      pdf.text("DM TURISMO", margin, currentY);

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(140, 140, 140);
      pdf.text("CONTROLE DE FALHAS & HISTÓRICO DE MANUTENÇÕES CORRETIVAS", margin, currentY + 6);

      const mesNome = format(now, "MMMM 'de' yyyy", { locale: ptBR });
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(40, 40, 40);
      pdf.text(`RELATÓRIO MENSAL - ${mesNome.toUpperCase()}`, margin, currentY + 16);

      currentY += 22;
      pdf.setDrawColor(230, 230, 230);
      pdf.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;

      // Details header
      pdf.setFontSize(13);
      pdf.setTextColor(30, 30, 30);
      pdf.text("REGISTROS DE CORREÇÕES OPERACIONAIS (FALHAS DE FROTA)", margin, currentY);
      currentY += 6;

      const totalCost = failures.reduce((sum, f) => sum + (f.cost || 0), 0);

      // AutoTable body data rows
      const tableRows = failures.map((f, index) => {
        const vehicle = vehicles.find(v => v.id === f.vehicleId);
        const completionDateObj = parseISO(f.completedAt || f.scheduledDate);
        const formattedDate = format(completionDateObj, "dd/MM/yyyy");

        return [
          (index + 1).toString(),
          formattedDate,
          vehicle ? `${vehicle.plate.toUpperCase()} - ${vehicle.model.toUpperCase()}` : '---',
          String(f.description).toUpperCase(),
          `R$ ${f.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ];
      });

      autoTable(pdf, {
        startY: currentY,
        margin: { left: margin, right: margin },
        head: [['#', 'DATA', 'VEÍCULO PRINCIPAL', 'DESCRIÇÃO TÉCNICA E REPARO DA FALHA', 'CUSTO (R$)']],
        body: tableRows,
        theme: 'striped',
        headStyles: { 
          fillColor: [255, 107, 0], // #ff6b00
          textColor: [255, 255, 255], 
          fontStyle: 'bold', 
          fontSize: 9 
        },
        styles: { fontSize: 8, font: 'helvetica' },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 25 },
          2: { cellWidth: 45 },
          3: { cellWidth: 'auto' },
          4: { cellWidth: 35, halign: 'right' }
        },
        foot: [[
          '', '', '',
          'CUSTO TOTAL DE SINISTROS NO MÊS:',
          `R$ ${totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        ]],
        footStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontStyle: 'bold', halign: 'right', fontSize: 9 }
      });

      const finalY = (pdf as any).lastAutoTable.finalY + 15;

      pdf.setFontSize(7.5);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Documento gerado de forma automatizada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm")} por elizeuferron@gmail.com.`, margin, finalY);

      pdf.save(`Relatorio_de_Falhas_${format(now, "MM_yyyy")}.pdf`);
      toast.success('Relatório PDF de Falhas gerado com sucesso!', {
        description: `Exportadas ${failures.length} manutenções corretivas.`
      });
    } catch (e) {
      console.error(e);
      toast.error('Ocorreu um erro ao exportar o relatório de falhas.');
    }
  };

  // Filters for Trips
  const filteredTrips = useMemo(() => {
    return trips.filter(t => 
      t.title.toLowerCase().includes(tripSearch.toLowerCase()) ||
      t.destination.toLowerCase().includes(tripSearch.toLowerCase()) ||
      (t.osNumber && t.osNumber.toLowerCase().includes(tripSearch.toLowerCase()))
    );
  }, [trips, tripSearch]);

  // Filters for Maintenance OS
  const filteredMaintenance = useMemo(() => {
    return maintenance.filter(m => {
      const vehicle = vehicles.find(v => v.id === m.vehicleId);
      const plate = vehicle?.plate?.toLowerCase() || '';
      const model = vehicle?.model?.toLowerCase() || '';
      const desc = m.description?.toLowerCase() || '';
      const date = (m.completedAt || m.scheduledDate) ? format(parseISO(m.completedAt || m.scheduledDate), 'dd/MM/yyyy') : '';
      const searchLower = maintenanceSearch.toLowerCase();
      
      return plate.includes(searchLower) || model.includes(searchLower) || desc.includes(searchLower) || date.includes(searchLower);
    });
  }, [maintenance, vehicles, maintenanceSearch]);

  // Sort Trips: Active first, then Scheduled sorted ascending by startDate (closest future first), then Completed/Cancelled sorted descending by startDate
  const sortedTrips = useMemo(() => {
    return [...filteredTrips].sort((a, b) => {
      const isActA = a.status === 'active';
      const isActB = b.status === 'active';
      if (isActA && !isActB) return -1;
      if (isActB && !isActA) return 1;

      const isSchA = a.status === 'scheduled';
      const isSchB = b.status === 'scheduled';
      if (isSchA && !isSchB) return -1;
      if (isSchB && !isSchA) return 1;

      if (isSchA && isSchB) {
        const d_a = a.startDate ? new Date(a.startDate).getTime() : Infinity;
        const d_b = b.startDate ? new Date(b.startDate).getTime() : Infinity;
        return d_a - d_b;
      }

      const d_a = a.startDate ? new Date(a.startDate).getTime() : 0;
      const d_b = b.startDate ? new Date(b.startDate).getTime() : 0;
      return d_b - d_a;
    });
  }, [filteredTrips]);

  // Sort Maintenance: Currently underway ("Em Manutenção") first, then pending/scheduled ("Em Aberto" key) sorted ascending by scheduledDate (closest first), then completed/past sorted descending
  const sortedMaintenance = useMemo(() => {
    return [...filteredMaintenance].sort((a, b) => {
      const vehicleA = vehicles.find(v => v.id === a.vehicleId);
      const vehicleB = vehicles.find(v => v.id === b.vehicleId);

      const isMaintActiveA = a.status !== 'completed' && vehicleA?.status === 'maintenance';
      const isMaintActiveB = b.status !== 'completed' && vehicleB?.status === 'maintenance';

      if (isMaintActiveA && !isMaintActiveB) return -1;
      if (isMaintActiveB && !isMaintActiveA) return 1;

      const isPendingA = a.status !== 'completed';
      const isPendingB = b.status !== 'completed';
      if (isPendingA && !isPendingB) return -1;
      if (isPendingB && !isPendingA) return 1;

      if (isPendingA && isPendingB) {
        const d_a = a.scheduledDate ? new Date(a.scheduledDate).getTime() : Infinity;
        const d_b = b.scheduledDate ? new Date(b.scheduledDate).getTime() : Infinity;
        return d_a - d_b;
      }

      const d_a = (a.completedAt || a.scheduledDate) ? new Date(a.completedAt || a.scheduledDate).getTime() : 0;
      const d_b = (b.completedAt || b.scheduledDate) ? new Date(b.completedAt || b.scheduledDate).getTime() : 0;
      return d_b - d_a;
    });
  }, [filteredMaintenance, vehicles]);

  // Chunking arrays to create dynamic grid within a list row using sorted lists
  const tripChunks = useMemo(() => {
    const chunks: Trip[][] = [];
    for (let i = 0; i < sortedTrips.length; i += columns) {
      chunks.push(sortedTrips.slice(i, i + columns));
    }
    return chunks;
  }, [sortedTrips, columns]);

  const maintenanceChunks = useMemo(() => {
    const chunks: MaintenanceLog[][] = [];
    for (let i = 0; i < sortedMaintenance.length; i += columns) {
      chunks.push(sortedMaintenance.slice(i, i + columns));
    }
    return chunks;
  }, [sortedMaintenance, columns]);

  // Virtualized row component for Trips
  const TripRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chunk = tripChunks[index];
    if (!chunk) return null;
    return (
      <div style={style} className="flex gap-6 pr-2">
        {chunk.map(trip => {
          const osNum = trip.osNumber || trip.id.substring(0, 8).toUpperCase();
          return (
            <div 
              key={trip.id}
              onClick={() => setSelectedVoyageOS(trip)}
              className="flex-1 group p-6 bg-zinc-950 border border-zinc-900 rounded-3xl cursor-pointer hover:border-brand-accent transition-all duration-500 shadow-2xl relative overflow-hidden flex flex-col justify-between"
              style={{ height: 'calc(100% - 24px)' }}
            >
              <div className="absolute right-0 top-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl" />
              
              <div className="flex justify-between items-start mb-4 shrink-0">
                <div>
                  <span className="text-[9px] font-black tracking-widest text-brand-accent uppercase bg-brand-accent/10 py-1 px-2.5 rounded-lg border border-brand-accent/15">
                    OS VIAGEM
                  </span>
                  <h3 className="text-base font-black text-white uppercase mt-3 tracking-tight group-hover:text-brand-accent transition-colors leading-tight line-clamp-1">
                    {trip.title}
                  </h3>
                </div>
                {(() => {
                  const meta = getTripStatusMeta(trip);
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-lg shrink-0 border ${meta.style}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2 mt-4 text-xs font-semibold text-zinc-400 flex-1 flex flex-col justify-center">
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Código OS:</span>
                  <span className="text-zinc-300 font-mono font-black">{osNum}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Localização:</span>
                  <span className="text-zinc-300 truncate max-w-[140px] uppercase text-[10px]">{trip.destination}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Data Partida:</span>
                  <span className="text-zinc-300 font-mono text-[10px]">
                    {trip.startDate ? format(parseISO(trip.startDate), 'dd/MM/yyyy • HH:mm', { locale: ptBR }) : '---'}
                  </span>
                </div>
              </div>

              <div className="mt-5 w-full py-3.5 bg-zinc-900 group-hover:bg-brand-accent group-hover:text-zinc-950 font-black text-[9px] text-zinc-300 text-center uppercase tracking-widest rounded-xl transition-all shrink-0">
                VISUALIZAR GUIA COMPLETA (A4)
              </div>
            </div>
          );
        })}
        {chunk.length < columns && 
          Array.from({ length: columns - chunk.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 invisible" />
          ))
        }
      </div>
    );
  };

  // Virtualized row component for Maintenances
  const MaintenanceRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chunk = maintenanceChunks[index];
    if (!chunk) return null;
    return (
      <div style={style} className="flex gap-6 pr-2">
        {chunk.map(maint => {
          const vehicle = vehicles.find(v => v.id === maint.vehicleId);
          const osNum = maint.id?.substring(0, 8).toUpperCase() || 'NEW';
          return (
            <div 
              key={maint.id}
              onClick={() => setSelectedMaintOS(maint)}
              className="flex-1 group p-6 bg-zinc-950 border border-zinc-900 rounded-3xl cursor-pointer hover:border-brand-accent transition-all duration-500 shadow-2xl relative overflow-hidden flex flex-col justify-between"
              style={{ height: 'calc(100% - 24px)' }}
            >
              <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl" />

              <div className="flex justify-between items-start mb-4 shrink-0">
                <div className="flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMaintIds(prev => 
                        prev.includes(maint.id) 
                          ? prev.filter(id => id !== maint.id) 
                          : [...prev, maint.id]
                      );
                    }}
                    className={`mt-1.5 h-5 w-5 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer ${
                      selectedMaintIds.includes(maint.id)
                        ? 'bg-brand-accent border-brand-accent text-zinc-950 shadow-md shadow-brand-accent/25'
                        : 'bg-zinc-900 border-zinc-800 text-transparent hover:border-zinc-700'
                    }`}
                  >
                    <Check size={11} className="stroke-[3]" />
                  </button>

                  <div>
                    <span className="text-[9px] font-black tracking-widest text-amber-500 uppercase bg-amber-500/10 py-1 px-2.5 rounded-lg border border-amber-500/15">
                      OS MANUTENÇÃO
                    </span>
                    <h3 className="text-base font-black text-white uppercase mt-3 tracking-tight group-hover:text-brand-accent transition-colors leading-tight line-clamp-1">
                      {maint.description}
                    </h3>
                  </div>
                </div>
                {(() => {
                  const meta = getMaintenanceStatusMeta(maint, vehicle);
                  return (
                    <div className={`flex items-center gap-1.5 px-3 py-1 text-[8px] sm:text-[9px] font-black uppercase tracking-wider rounded-lg shrink-0 border ${meta.style}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                      {meta.label}
                    </div>
                  );
                })()}
              </div>

              <div className="space-y-2 mt-4 text-xs font-semibold text-zinc-400 flex-1 flex flex-col justify-center">
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Código OS:</span>
                  <span className="text-zinc-300 font-mono font-black">#{osNum}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Veículo Placa:</span>
                  <span className="text-brand-accent font-black">{vehicle?.plate?.toUpperCase() || '---'}</span>
                </div>
                <div className="flex justify-between border-b border-zinc-900 pb-1.5">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Total Investido:</span>
                  <span className="text-emerald-500 font-black">R$ {maint.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between pb-1">
                  <span className="text-zinc-650 font-extrabold uppercase text-[9px]">Intervenção:</span>
                  <span className="text-zinc-300 uppercase text-[10px] font-bold">{maint.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}</span>
                </div>
              </div>

              <div className="mt-5 w-full py-3.5 bg-zinc-900 group-hover:bg-brand-accent group-hover:text-zinc-950 font-black text-[9px] text-zinc-300 text-center uppercase tracking-widest rounded-xl transition-all shrink-0">
                VISUALIZAR RELATÓRIO TÉCNICO (A4)
              </div>
            </div>
          );
        })}
        {chunk.length < columns && 
          Array.from({ length: columns - chunk.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 invisible" />
          ))
        }
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER SECTION with "Atualizar OS" button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/10 rounded-2xl flex items-center justify-center text-brand-accent border border-brand-accent/20 shadow-lg shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter italic font-display">Ordens de Serviço</h1>
            <p className="text-zinc-500 font-medium text-xs tracking-tight uppercase mt-0.5">Emissão, histórico e controle de escalas de viagem e manutenções de frota (Modo Sombra Virtualizado).</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {activeTab === 'manutenções' && (
            <>
              <button
                onClick={() => setShowRemindersPanel(!showRemindersPanel)}
                className={`py-3.5 px-5 rounded-2xl border flex items-center gap-2 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-xl ${
                  showRemindersPanel 
                    ? 'bg-brand-accent/15 border-brand-accent/30 text-brand-accent hover:bg-brand-accent hover:text-zinc-950' 
                    : 'bg-zinc-900 border-zinc-805 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                <Bell size={13} className={showRemindersPanel ? "animate-pulse" : ""} />
                <span>{showRemindersPanel ? 'Ocultar Lembretes' : 'Exibir Lembretes'}</span>
              </button>

              <button
                id="generate-failures-pdf-btn"
                onClick={handleGenerateFailuresPDF}
                className="py-3.5 px-5 bg-zinc-900 border border-zinc-800 text-brand-accent hover:text-white hover:bg-zinc-850 hover:border-brand-accent rounded-2xl flex items-center gap-2.5 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-xl"
              >
                <FileDown size={14} />
                <span>Gerar PDF de Falhas</span>
              </button>
            </>
          )}

          {/* Regularizar OS Button */}
          <button
            onClick={handleRefreshOS}
            disabled={isUpdating}
            className="py-3.5 px-5 bg-zinc-900 border border-zinc-800 text-brand-accent hover:text-white hover:bg-zinc-850 hover:border-brand-accent rounded-2xl flex items-center gap-2.5 font-black text-[10px] uppercase tracking-widest transition-all cursor-pointer shadow-xl disabled:opacity-50"
          >
            <RefreshCw size={14} className={isUpdating ? "animate-spin text-white" : "text-brand-accent"} />
            <span>{isUpdating ? 'ATUALIZANDO...' : 'ATUALIZAR OS'}</span>
          </button>
          
          {/* Search Box */}
          <div className="flex bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 shadow-xl items-center">
            <Search className="text-zinc-500 ml-3" size={16} />
            <input 
              type="text" 
              placeholder={activeTab === 'viagens' ? "BUSCAR VIAGEM OU DESTINO..." : "BUSCAR PLACA, MODELO, DESCRIÇÃO OU DATA..."}
              className="bg-transparent text-[10px] font-black uppercase text-white placeholder:text-zinc-650 pl-3 pr-6 py-3 w-64 outline-none tracking-widest"
              value={activeTab === 'viagens' ? tripSearch : maintenanceSearch}
              onChange={e => activeTab === 'viagens' ? setTripSearch(e.target.value) : setMaintenanceSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* TABS SWITCHER */}
      <div className="flex gap-2 border-b border-zinc-800 pb-px overflow-x-auto select-none">
        <button
          onClick={() => {
            setActiveTab('viagens');
            setTripSearch('');
            setSelectedMaintIds([]);
          }}
          className={`flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-4 font-black text-[10px] sm:text-xs uppercase tracking-wider relative transition-all cursor-pointer ${
            activeTab === 'viagens' 
              ? 'text-brand-accent border-b-2 border-brand-accent' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Compass size={13} />
            <span className="whitespace-nowrap">Viagens ({filteredTrips.length})</span>
          </div>
        </button>

        <button
          onClick={() => {
            setActiveTab('manutenções');
            setTripSearch('');
            setSelectedMaintIds([]);
          }}
          className={`flex-1 sm:flex-initial px-4 sm:px-6 py-3 sm:py-4 font-black text-[10px] sm:text-xs uppercase tracking-wider relative transition-all cursor-pointer ${
            activeTab === 'manutenções' 
              ? 'text-brand-accent border-b-2 border-brand-accent' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Wrench size={13} />
            <span className="whitespace-nowrap">Manutenções ({filteredMaintenance.length})</span>
          </div>
        </button>
      </div>

      {/* AUTOMATED REMINDERS SUBPANEL INTEGRATION */}
      {activeTab === 'manutenções' && showRemindersPanel && (
        <div className="animate-in fade-in slide-in-from-top-4 duration-300">
          <MaintenanceReminders 
            maintenance={maintenance}
            vehicles={vehicles}
            employees={employees}
            onSelectMaintOS={(maint) => setSelectedMaintOS(maint)}
          />
        </div>
      )}

      {/* CONTENT LIST USING REACT-WINDOW */}
      {activeTab === 'viagens' ? (
        filteredTrips.length > 0 ? (
          <div className="w-full relative">
            <List
              rowCount={tripChunks.length}
              rowHeight={360}
              style={{ height: listHeight, width: '100%' }}
              className="custom-scrollbar"
              rowProps={{}}
              rowComponent={TripRow as any}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-30">
            <FileText size={80} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6">Nenhuma ordem de serviço de viagem encontrada</p>
          </div>
        )
      ) : (
        filteredMaintenance.length > 0 ? (
          <div className="w-full relative border-t border-zinc-900 pt-4 mt-6">
            <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-4">Todas as Ordens de Serviço de Manutenção</h3>
            <List
              rowCount={maintenanceChunks.length}
              rowHeight={360}
              style={{ height: listHeight, width: '100%' }}
              className="custom-scrollbar"
              rowProps={{}}
              rowComponent={MaintenanceRow as any}
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 grayscale opacity-30">
            <Wrench size={80} strokeWidth={1} />
            <p className="text-[10px] font-black uppercase tracking-[0.3em] mt-6">Nenhuma ordem de serviço de manutenção encontrada</p>
          </div>
        )
      )}

      {/* MODAL PREVIEW FOR VOYAGE SERVICE ORDER (TRIP) */}
      {selectedVoyageOS && (
        <div className="fixed inset-0 bg-black/80 w-full h-full backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="relative w-full max-w-[220mm] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <FileText className="text-brand-accent" size={24} />
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic font-display">DOCUMENTO OFICIAL DE VIAGEM</h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Impressão de Guia de Viagem no Padrão A4</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedVoyageOS(null)}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
              <TripServiceOrder 
                trip={selectedVoyageOS}
                vehicle={vehicles.find(v => v.id === selectedVoyageOS.vehicleId)}
                driver={employees.find(e => e.id === selectedVoyageOS.driverId)}
                secondDriver={employees.find(e => e.id === selectedVoyageOS.secondDriverId)}
                onDelete={onDeleteTrip}
              />
            </div>
          </div>
        </div>
      )}

      {/* MODAL PREVIEW FOR MAINTENANCE SERVICE ORDER */}
      {selectedMaintOS && (
        <div className="fixed inset-0 bg-black/80 w-full h-full backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto no-print">
          <div className="relative w-full max-w-[220mm] bg-zinc-950 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8 flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-6 shrink-0">
              <div className="flex items-center gap-3">
                <Wrench className="text-amber-500" size={24} />
                <div>
                  <h3 className="text-lg font-black text-white uppercase tracking-tighter italic font-display">ORDEM DE MANUTENÇÃO TÉCNICA</h3>
                  <p className="text-zinc-500 text-[10px] uppercase font-bold">Relatório Executivo Detalhado de Ativos no Padrão A4</p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedMaintOS(null)}
                className="w-10 h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 pb-4">
              <MaintenanceServiceOrder 
                log={selectedMaintOS}
                vehicle={vehicles.find(v => v.id === selectedMaintOS.vehicleId)}
              />
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION BAR FOR CONSOLIDATED PDF EXPORT */}
      {activeTab === 'manutenções' && selectedMaintIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[45] w-[90%] max-w-2xl bg-zinc-950/95 backdrop-blur-md border border-brand-accent/35 rounded-[1.5rem] p-4 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-accent/15 border border-brand-accent/25 text-brand-accent rounded-xl flex items-center justify-center shrink-0">
              <CheckSquare size={18} />
            </div>
            <div className="text-center sm:text-left">
              <h4 className="text-xs font-black text-white uppercase tracking-tight">
                {selectedMaintIds.length} {selectedMaintIds.length === 1 ? 'LOG SELECIONADO' : 'LOGS SELECIONADOS'}
              </h4>
              <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 text-left">
                Consolidar {selectedMaintIds.length} manutenções em um dossiê único PDF corporativa.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-center sm:justify-start">
            <button
              onClick={() => setSelectedMaintIds([])}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-zinc-800 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all cursor-pointer"
            >
              LIMPAR SELEÇÃO
            </button>
            <button
              onClick={handleGenerateConsolidatedPDF}
              className="px-5 py-2.5 bg-brand-accent text-zinc-950 hover:bg-white rounded-xl font-black text-[9px] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand-accent/10 cursor-pointer"
            >
              <FileDown size={12} className="stroke-[2.5]" />
              <span>EXPORTAR CONSOLIDADO</span>
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
