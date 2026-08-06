import React, { useState } from 'react';
import { format, parseISO, isSameMonth, isSameYear, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { 
  FileText, 
  X, 
  Calendar, 
  Printer, 
  Download, 
  Activity, 
  DollarSign, 
  Box, 
  Loader2,
  ChevronRight,
  Sparkles,
  Sliders
} from 'lucide-react';

interface GabineteCorporateDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  employees: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
  stockItems: any[];
  tireDossiers: any[];
  charterClientTrips: any[];
}

export const GabineteCorporateDossierModal: React.FC<GabineteCorporateDossierModalProps> = ({
  isOpen,
  onClose,
  vehicles = [],
  employees = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = [],
  stockItems = [],
  tireDossiers = [],
  charterClientTrips = []
}) => {
  const [periodType, setPeriodType] = useState<'monthly' | 'annual'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => format(new Date(), 'yyyy-MM'));
  const [selectedYear, setSelectedYear] = useState<string>(() => format(new Date(), 'yyyy'));
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  // Filter data helper
  const getFilteredData = () => {
    let filteredTrips = [...trips];
    let filteredMaint = [...maintenance];
    let filteredFuel = [...fuelLogs];
    let filteredFinance = [...finance];
    let filteredCharters = [...charterClientTrips];

    if (periodType === 'monthly') {
      const targetMonthDate = parseISO(`${selectedMonth}-01`);
      
      filteredTrips = trips.filter(t => {
        const dateStr = t.startDate || t.endDate;
        if (!dateStr) return false;
        const d = parseISO(dateStr.substring(0, 10));
        return d.getFullYear() === targetMonthDate.getFullYear() && d.getMonth() === targetMonthDate.getMonth();
      });

      filteredMaint = maintenance.filter(m => {
        const dateStr = m.scheduledDate || m.completedAt;
        if (!dateStr) return false;
        const d = parseISO(dateStr.substring(0, 10));
        return d.getFullYear() === targetMonthDate.getFullYear() && d.getMonth() === targetMonthDate.getMonth();
      });

      filteredFuel = fuelLogs.filter(f => {
        const dateStr = f.timestamp;
        if (!dateStr) return false;
        const d = parseISO(dateStr.substring(0, 10));
        return d.getFullYear() === targetMonthDate.getFullYear() && d.getMonth() === targetMonthDate.getMonth();
      });

      filteredFinance = finance.filter(f => {
        const dateStr = f.dueDate || f.createdAt;
        if (!dateStr) return false;
        const d = parseISO(dateStr.substring(0, 10));
        return d.getFullYear() === targetMonthDate.getFullYear() && d.getMonth() === targetMonthDate.getMonth();
      });

      filteredCharters = charterClientTrips.filter(c => {
        const dateStr = c.dateTime;
        if (!dateStr) return false;
        const d = parseISO(dateStr.substring(0, 10));
        return d.getFullYear() === targetMonthDate.getFullYear() && d.getMonth() === targetMonthDate.getMonth();
      });
    } else {
      const yearNum = parseInt(selectedYear, 10);

      filteredTrips = trips.filter(t => {
        const dateStr = t.startDate || t.endDate;
        if (!dateStr) return false;
        return parseISO(dateStr.substring(0, 10)).getFullYear() === yearNum;
      });

      filteredMaint = maintenance.filter(m => {
        const dateStr = m.scheduledDate || m.completedAt;
        if (!dateStr) return false;
        return parseISO(dateStr.substring(0, 10)).getFullYear() === yearNum;
      });

      filteredFuel = fuelLogs.filter(f => {
        const dateStr = f.timestamp;
        if (!dateStr) return false;
        return parseISO(dateStr.substring(0, 10)).getFullYear() === yearNum;
      });

      filteredFinance = finance.filter(f => {
        const dateStr = f.dueDate || f.createdAt;
        if (!dateStr) return false;
        return parseISO(dateStr.substring(0, 10)).getFullYear() === yearNum;
      });

      filteredCharters = charterClientTrips.filter(c => {
        const dateStr = c.dateTime;
        if (!dateStr) return false;
        return parseISO(dateStr.substring(0, 10)).getFullYear() === yearNum;
      });
    }

    return {
      trips: filteredTrips,
      maintenance: filteredMaint,
      fuelLogs: filteredFuel,
      finance: filteredFinance,
      charters: filteredCharters
    };
  };

  const handleExportCorporateDossier = async (autoPrint = false) => {
    setIsGenerating(true);
    const toastId = toast.loading("Sincronizando dados e compilando o Dossiê Corporativo...");
    
    try {
      // Dynamic import to keep main bundle light
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const { trips: fTrips, maintenance: fMaint, fuelLogs: fFuel, finance: fFinance, charters: fCharters } = getFilteredData();

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
      const periodLabel = periodType === 'monthly' 
        ? format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR }).toUpperCase()
        : `ANO DE ${selectedYear}`;

      // ==========================================
      // PAGE 1: CAPA DO DOSSIÊ CORPORATIVO - ECO-MODE
      // ==========================================
      
      // Removed full background fill, using clean lines and logo
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(10, 10, 190, 277, 'S'); // Outer border frame

      // Logo DM (Stylized Text Branding for Low Ink)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(48);
      doc.setTextColor(0, 0, 0);
      doc.text("DM", 25, 60);
      
      doc.setFontSize(28);
      doc.text("TURISMO", 45, 60);

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139);
      doc.text('"Prazer em viajar bem"', 25, 68);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(100, 116, 139);
      doc.text("SISTEMA INTEGRADO DE ALTA GOVERNANÇA", 25, 75);

      // Horizontal Divider Line
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(1.5);
      doc.line(25, 85, 185, 85);

      // Report Main Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(0, 0, 0);
      doc.text("DOSSIÊ CORPORATIVO CONSOLIDADO", 25, 110);

      doc.setFontSize(13);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(`PERÍODO DE REFERÊNCIA: ${periodLabel}`, 25, 120);

      // Executive Summary Text
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10.5);
      const summaryText = `Este documento unifica e consolida os principais indicadores de desempenho da DM Turismo para o período selecionado. O relatório abrange a performance operacional da frota, faturamento e custos das escalas de viagens, despesas com manutenção, consumo volumétrico de diesel, demonstrativo financeiro consolidado de receitas e despesas líquidas, além da situação física do almoxarifado de autopeças e controle preventivo de pneus. Documento gerado com caráter oficial para suporte na tomada de decisões estratégicas da Diretoria Executiva.`;
      const splitSummary = doc.splitTextToSize(summaryText, 160);
      doc.text(splitSummary, 25, 140);

      // KPI box highlights on cover - Grayscale
      const boxY = 200;
      doc.setFillColor(248, 250, 252); // Very light gray
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.roundedRect(25, boxY, 160, 48, 4, 4, 'FD');

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text("SÍNTESE DOS INDICADORES COLETADOS", 35, boxY + 10);

      // Quick figures
      const totalRevenue = fFinance.reduce((sum, f) => sum + (f.type === 'receivable' || f.type === 'income' ? Number(f.amount || 0) : 0), 0) +
                           fCharters.reduce((sum, c) => sum + Number(c.value || 0), 0);
      const totalExpense = fFinance.reduce((sum, f) => sum + (f.type === 'payable' || f.type === 'expense' ? Number(f.amount || 0) : 0), 0);
      const netProfit = totalRevenue - totalExpense;

      doc.setFontSize(8.5);
      doc.setTextColor(100, 116, 139);
      doc.text("VIAGENS REALIZADAS", 35, boxY + 22);
      doc.text("FATURAMENTO BRUTO", 85, boxY + 22);
      doc.text("SALDO LÍQUIDO PERÍODO", 135, boxY + 22);

      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`${fTrips.length} Escalas`, 35, boxY + 30);
      doc.text(`R$ ${totalRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 85, boxY + 30);
      doc.text(`R$ ${netProfit.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`, 135, boxY + 30);

      // Metadata footer
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Compilado em: ${todayStr}`, 25, 275);
      doc.text("DM Turismo Ltda | Gabinete de Gestão Executiva Pro", 25, 280);

      // ==========================================
      // PAGE 2: INDICADORES OPERACIONAIS E FROTA
      // ==========================================
      doc.addPage();
      
      // Page Header Banner
      doc.setFillColor(15, 23, 42); // Navy Blue
      doc.rect(0, 0, 210, 25, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DM TURISMO - DOSSIÊ CORPORATIVO CONSOLIDADO", 14, 11);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`MÓDULO I: PERFORMANCE OPERACIONAL DA FROTA | REFERÊNCIA: ${periodLabel}`, 14, 18);

      let currentY = 38;

      // Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("1. RESUMO DE VIAGENS E ATIVIDADE LOGÍSTICA", 14, currentY);
      currentY += 6;

      // Summary of fleet size & driver active
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`Frota total cadastrada: ${vehicles.length} veículos. Total de colaboradores operacionais ativos: ${employees.length}.`, 14, currentY);
      currentY += 10;

      // Table of trips performed in period
      const tripsCols = ["OS / Código", "Cliente / Itinerário", "Data / Hora", "Motorista", "Veículo", "Status", "Valor (R$)"];
      const tripsRows = fTrips.map(t => {
        const driverName = employees.find(e => e.id === t.driverId)?.name || t.driverName || 'N/A';
        const vehiclePlate = vehicles.find(v => v.id === t.vehicleId)?.plate || t.vehicleId || 'N/A';
        return [
          t.osNumber || 'OS----',
          `${t.title || 'Viagem'}\n${t.origin || 'N/A'} ➔ ${t.destination || 'N/A'}`,
          t.startDate ? `${t.startDate.substring(8, 10)}/${t.startDate.substring(5, 7)} ${t.startDate.substring(11, 16)}` : '---',
          driverName,
          vehiclePlate.toUpperCase(),
          t.status === 'completed' ? 'Finalizada' : t.status === 'active' ? 'Em Curso' : 'Agendada',
          Number(t.value || t.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [tripsCols],
        body: tripsRows.slice(0, 15), // Limiting to top 15 on this page to ensure elegant spacing
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        columnStyles: {
          1: { cellWidth: 50 },
          3: { cellWidth: 25 },
        },
        margin: { left: 14, right: 14 }
      });

      // Show notice if truncated
      if (tripsRows.length > 15) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`* Foram omitidos ${tripsRows.length - 15} registros adicionais de viagens do relatório impresso para formatação ideal de página.`, 14, (doc as any).lastAutoTable.finalY + 6);
      }

      currentY = (doc as any).lastAutoTable.finalY + (tripsRows.length > 15 ? 12 : 8);

      // Section 1.2 Maintenance in Period
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("2. MANUTENÇÕES DE FROTA (O.S. LANÇADAS)", 14, currentY);
      currentY += 6;

      const maintCols = ["Veículo", "Descrição do Serviço", "Tipo", "Data", "Status", "Custo Total (R$)"];
      const maintRows = fMaint.map(m => {
        const plate = vehicles.find(v => v.id === m.vehicleId)?.plate || 'N/A';
        const dateStr = m.scheduledDate || m.completedAt || '';
        const formattedDate = dateStr ? `${dateStr.substring(8, 10)}/${dateStr.substring(5, 7)}/${dateStr.substring(0, 4)}` : '---';
        return [
          plate.toUpperCase(),
          m.description || 'Manutenção Corretiva/Preventiva',
          m.type === 'preventive' ? 'Preventiva' : 'Corretiva',
          formattedDate,
          m.status === 'completed' ? 'Concluída' : 'Pendente',
          Number(m.cost || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [maintCols],
        body: maintRows.slice(0, 8),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      const totalMaintCost = fMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`INVESTIMENTO TOTAL EM MANUTENÇÃO NO PERÍODO: R$ ${totalMaintCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 14, (doc as any).lastAutoTable.finalY + 6);

      // ==========================================
      // PAGE 3: ABASTECIMENTOS E CONSUMO DIESEL
      // ==========================================
      doc.addPage();
      
      // Page Header Banner
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DM TURISMO - DOSSIÊ CORPORATIVO CONSOLIDADO", 14, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`MÓDULO II: CONSUMO DE COMBUSTÍVEL E EFICIÊNCIA ENERGÉTICA | REFERÊNCIA: ${periodLabel}`, 14, 18);

      currentY = 38;

      // Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("1. DEMONSTRATIVO DE REABASTECIMENTO E MÉDIAS DE CONSUMO", 14, currentY);
      currentY += 6;

      // Analytical fueling calculations
      const vehicleStatsMap: Record<string, { liters: number, cost: number, count: number, plate: string, model: string }> = {};
      
      fFuel.forEach(f => {
        const vehicle = vehicles.find(v => v.id === f.vehicleId);
        if (!vehicle) return;
        const plate = vehicle.plate || 'N/A';
        const model = `${vehicle.brand} ${vehicle.model}`;

        if (!vehicleStatsMap[vehicle.id]) {
          vehicleStatsMap[vehicle.id] = { liters: 0, cost: 0, count: 0, plate, model };
        }
        vehicleStatsMap[vehicle.id].liters += Number(f.quantity || 0);
        vehicleStatsMap[vehicle.id].cost += Number(f.cost || 0);
        vehicleStatsMap[vehicle.id].count += 1;
      });

      const fuelCols = ["Veículo", "Modelo", "Nº Reabastecimentos", "Liters Consumidos", "Custo Total (R$)", "Média Estimada (KM/L)"];
      const fuelRows = Object.values(vehicleStatsMap).map(s => {
        // Find average consumption if vehicle has trips
        const vFuel = fFuel.filter(f => f.vehicleId === s.plate || vehicles.find(v => v.plate === s.plate)?.id === f.vehicleId);
        const lastOdom = vFuel.length > 0 ? Math.max(...vFuel.map(f => Number(f.odometer || 0))) : 0;
        const firstOdom = vFuel.length > 0 ? Math.min(...vFuel.map(f => Number(f.odometer || 0))) : 0;
        const deltaKm = lastOdom - firstOdom;
        const avg = deltaKm > 0 && s.liters > 0 ? (deltaKm / s.liters) : 0;

        return [
          s.plate.toUpperCase(),
          s.model,
          s.count.toString(),
          `${s.liters.toFixed(1)} L`,
          Number(s.cost).toLocaleString('pt-BR', { minimumFractionDigits: 2 }),
          avg > 0 ? `${avg.toFixed(2)} KM/L` : '---'
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [fuelCols],
        body: fuelRows.length > 0 ? fuelRows : [["---", "Sem abastecimentos no período", "---", "---", "---", "---"]],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        margin: { left: 14, right: 14 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 8;

      const totalLiters = fFuel.reduce((sum, f) => sum + Number(f.quantity || 0), 0);
      const totalFuelCost = fFuel.reduce((sum, f) => sum + Number(f.cost || 0), 0);

      doc.setFillColor(245, 247, 250);
      doc.rect(14, currentY, 182, 22, 'F');
      doc.setDrawColor(220, 225, 230);
      doc.rect(14, currentY, 182, 22, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("VOLUME TOTAL DE ENTRADA (LITROS DIESEL)", 18, currentY + 7);
      doc.text("CUSTO CONSOLIDADO DO COMBUSTÍVEL", 110, currentY + 7);

      doc.setFontSize(10.5);
      doc.setTextColor(255, 107, 0); // DM Orange
      doc.text(`${totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Litros`, 18, currentY + 15);
      doc.text(`R$ ${totalFuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 110, currentY + 15);

      // ==========================================
      // PAGE 4: DEMONSTRATIVO FINANCEIRO CONSOLIDADO
      // ==========================================
      doc.addPage();
      
      // Page Header Banner
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DM TURISMO - DOSSIÊ CORPORATIVO CONSOLIDADO", 14, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`MÓDULO III: RESULTADO CONTÁBIL E FLUXO DE CAIXA DE GOVERNANÇA | REFERÊNCIA: ${periodLabel}`, 14, 18);

      currentY = 38;

      // Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("1. DEMONSTRATIVO FINANCEIRO CONSOLIDADO (DRE SIMPLIFICADO)", 14, currentY);
      currentY += 6;

      // Transactions layout
      const finCols = ["Vencimento", "Tipo de Lançamento", "Categoria", "Descrição", "Situação", "Valor (R$)"];
      
      // Mix general transaction ledger and charter billing for completeness
      const finRows: any[] = [];
      fFinance.forEach(f => {
        finRows.push([
          f.dueDate || f.createdAt || '---',
          f.type === 'receivable' || f.type === 'income' ? 'RECEITA (+)' : 'DESPESA (-)',
          f.category || 'Geral',
          f.description || 'Transação financeira',
          f.status === 'paid' ? 'Liquidado' : 'Em Aberto',
          Number(f.amount || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ]);
      });

      fCharters.forEach(c => {
        finRows.push([
          c.dateTime?.substring(0, 10) || '---',
          'RECEITA (FRETADO)',
          'Fretamento Mensal',
          `Cliente Fretado: ${c.client || 'Avulso'}`,
          c.paymentStatus === 'received' ? 'Pago' : 'Faturado',
          Number(c.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        ]);
      });

      // Sort rows cronologically
      finRows.sort((a, b) => b[0].localeCompare(a[0]));

      autoTable(doc, {
        startY: currentY,
        head: [finCols],
        body: finRows.slice(0, 18),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 7.5, cellPadding: 2 },
        margin: { left: 14, right: 14 }
      });

      if (finRows.length > 18) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        doc.text(`* Foram omitidos ${finRows.length - 18} registros financeiros adicionais deste relatório por limite de página.`, 14, (doc as any).lastAutoTable.finalY + 6);
      }

      currentY = (doc as any).lastAutoTable.finalY + (finRows.length > 18 ? 12 : 8);

      // Financial Synthesis Cards
      doc.setFillColor(245, 247, 250);
      doc.rect(14, currentY, 182, 32, 'F');
      doc.setDrawColor(220, 225, 230);
      doc.rect(14, currentY, 182, 32, 'S');

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("TOTAL RECEITAS", 18, currentY + 8);
      doc.text("TOTAL DESPESAS", 78, currentY + 8);
      doc.text("SALDO EXECUTIVO LÍQUIDO", 138, currentY + 8);

      doc.setFontSize(11);
      doc.setTextColor(16, 185, 129); // Green
      doc.text(`+ R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 18, currentY + 18);
      doc.setTextColor(239, 68, 68); // Red
      doc.text(`- R$ ${totalExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 78, currentY + 18);
      
      doc.setFontSize(12);
      doc.setTextColor(netProfit >= 0 ? 16 : 239, netProfit >= 0 ? 185 : 68, netProfit >= 0 ? 129 : 68);
      doc.text(`R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 138, currentY + 18);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Situação do Resultado: ${netProfit >= 0 ? 'SUPERÁVIT OPERACIONAL FINANCEIRO' : 'DÉFICIT CONSOLIDADO'}`, 138, currentY + 26);

      // ==========================================
      // PAGE 5: ALMOXARIFADO E PNEUS
      // ==========================================
      doc.addPage();
      
      // Page Header Banner
      doc.setFillColor(15, 23, 42); 
      doc.rect(0, 0, 210, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("DM TURISMO - DOSSIÊ CORPORATIVO CONSOLIDADO", 14, 11);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(200, 200, 200);
      doc.text(`MÓDULO IV: DISPONIBILIDADE DO ALMOXARIFADO E AUDITORIA DE PNEUS | REFERÊNCIA: ${periodLabel}`, 14, 18);

      currentY = 38;

      // Section Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("1. ALERTA DE CRITICIDADE DE ESTOQUE (MATERIAIS E AUTOPEÇAS)", 14, currentY);
      currentY += 6;

      const lowStockList = stockItems.filter(s => Number(s.quantity || 0) <= Number(s.minQuantity || 0));

      const stockCols = ["Código / Peça", "Categoria", "Estoque Atual", "Nível Mínimo", "Status de Reposição"];
      const stockRows = stockItems.map(s => {
        const isLow = Number(s.quantity || 0) <= Number(s.minQuantity || 0);
        return [
          s.name || 'Sem nome',
          s.category || 'Geral',
          `${s.quantity || 0} ${s.unit || 'un'}`,
          `${s.minQuantity || 0} ${s.unit || 'un'}`,
          isLow ? 'REPOR URGENTE' : 'ESTÁVEL'
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [stockCols],
        body: stockRows.slice(0, 12),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        margin: { left: 14, right: 14 }
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`Total de Itens Monitorados: ${stockItems.length} | Itens com Estoque Crítico: ${lowStockList.length} unidades.`, 14, (doc as any).lastAutoTable.finalY + 6);

      currentY = (doc as any).lastAutoTable.finalY + 12;

      // Section 4.2 Pneus da Frota
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("2. CONTROLE TÉCNICO E AUDITORIA DE SULCOS EM PNEUS", 14, currentY);
      currentY += 6;

      const tireCols = ["Nº Fogo / Serial", "Marca / Modelo", "Veículo Alocado", "Prof. Sulco (mm)", "Estado Físico", "Recomendação"];
      const tireRows = tireDossiers.map(td => {
        const vPlate = vehicles.find(v => v.id === td.vehicleId)?.plate || 'Almoxarifado';
        const depth = Number(td.grooveDepth || 0);
        let rec = 'RODANDO NORMAL';
        if (depth <= 2 && depth > 1.6) rec = 'RECAPAR BREVE';
        else if (depth <= 1.6) rec = 'SUBSTITUIÇÃO IMEDIATA';

        return [
          td.serialNumber || 'Sem Serial',
          td.brandOption || 'Geral',
          vPlate.toUpperCase(),
          `${depth.toFixed(1)} mm`,
          td.status || 'RODANDO',
          rec
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [tireCols],
        body: tireRows.slice(0, 10),
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8 },
        styles: { fontSize: 8, cellPadding: 2.5 },
        margin: { left: 14, right: 14 }
      });

      // Footer signature space on last page
      currentY = (doc as any).lastAutoTable.finalY + 15;
      
      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.5);
      doc.line(40, currentY + 15, 100, currentY + 15);
      doc.line(110, currentY + 15, 170, currentY + 15);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 100, 100);
      doc.text("Responsável Técnico / Frota", 50, currentY + 20);
      doc.text("Diretoria Executiva / DM Turismo", 120, currentY + 20);

      // Finish PDF compilation
      if (autoPrint) {
        doc.autoPrint();
        window.open(doc.output('bloburl'), '_blank');
        toast.success("Documento enviado para a fila de impressão local!", { id: toastId });
      } else {
        doc.save(`DM_Turismo_Dossie_Corporativo_${periodType === 'monthly' ? selectedMonth : selectedYear}.pdf`);
        toast.success("Dossiê Corporativo compilado e exportado com sucesso!", { id: toastId });
      }
    } catch (e: any) {
      console.error("Erro ao gerar PDF do Dossiê Corporativo:", e);
      toast.error("Falha ao gerar o PDF. Verifique se o módulo jsPDF foi carregado corretamente.", { id: toastId });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans animate-fade-in" id="corporate-dossier-modal">
      <div className="bg-zinc-900 border border-zinc-850 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl relative">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-white p-1 hover:bg-zinc-800 rounded-lg transition-all"
          id="close-dossier-modal-btn"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-zinc-850 pb-4">
          <div className="w-10 h-10 bg-blue-600/10 text-blue-500 rounded-xl flex items-center justify-center border border-blue-500/15">
            <Sliders size={20} />
          </div>
          <div>
            <h4 className="text-sm font-black uppercase text-white tracking-widest">
              Dossiê Corporativo Consolidado
            </h4>
            <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-wider font-semibold">
              Tomada de Decisão Executiva Integrada - DM Turismo
            </p>
          </div>
        </div>

        {/* Form Body */}
        <div className="space-y-4">
          
          {/* Section description */}
          <p className="text-xs text-zinc-400 leading-relaxed">
            Consolide todos os principais indicadores de desempenho operacional da frota, faturamento de fretamento, contas a pagar e receber do financeiro, além de controle técnico do almoxarifado em um único documento analítico.
          </p>

          {/* Period Mode Selector */}
          <div>
            <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block mb-2">
              Tipo de Filtro de Período
            </label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-950 p-1 rounded-xl border border-zinc-850">
              <button
                type="button"
                onClick={() => setPeriodType('monthly')}
                className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${periodType === 'monthly' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                id="period-type-monthly-btn"
              >
                Mensal (Mês Completo)
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('annual')}
                className={`py-2 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${periodType === 'annual' ? 'bg-zinc-900 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                id="period-type-annual-btn"
              >
                Anual (Ano Inteiro)
              </button>
            </div>
          </div>

          {/* Selective Date input field */}
          <div className="bg-zinc-950 p-4 rounded-2xl border border-zinc-850 space-y-3">
            <div className="flex items-center gap-2 text-zinc-300">
              <Calendar size={14} className="text-blue-500" />
              <span className="text-xs font-bold uppercase tracking-wider">Período de Exportação</span>
            </div>

            {periodType === 'monthly' ? (
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block mb-1">Escolher Mês e Ano</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 font-mono"
                  id="selected-month-input"
                />
              </div>
            ) : (
              <div>
                <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider block mb-1">Escolher Ano</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-blue-500 font-mono"
                  id="selected-year-select"
                >
                  <option value="2026">2026</option>
                  <option value="2025">2025</option>
                  <option value="2024">2024</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 border-t border-zinc-850 pt-4 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-400 rounded-xl transition-all"
            id="cancel-dossier-btn"
          >
            Cancelar
          </button>

          {/* Print Button */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleExportCorporateDossier(true)}
            className="px-4 py-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
            id="print-dossier-btn"
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} className="text-zinc-400" />}
            Imprimir Relatório
          </button>

          {/* Export / Download Button */}
          <button
            type="button"
            disabled={isGenerating}
            onClick={() => handleExportCorporateDossier(false)}
            className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-[10px] font-black uppercase tracking-wider rounded-xl shadow-lg active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            id="export-dossier-btn"
          >
            {isGenerating ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
            Exportar PDF
          </button>
        </div>

      </div>
    </div>
  );
};
