import React, { useMemo, useState, useEffect, useRef } from 'react';
import { 
  FileText, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  RefreshCw, 
  Briefcase, 
  Bus, 
  Fuel, 
  Users, 
  DollarSign, 
  Wrench,
  Sparkles
} from 'lucide-react';
import { cn } from '../lib/utils';
import { format, parseISO, isBefore, addDays } from 'date-fns';
import { toast } from 'sonner';
import { collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';

interface IntelligenceDossierProps {
  vehicles: any[];
  employees: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
}

export const IntelligenceDossier: React.FC<IntelligenceDossierProps> = ({
  vehicles = [],
  employees = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = []
}) => {
  const [dossierType, setDossierType] = useState<'owner' | 'modules' | 'vehicle' | 'driver'>('owner');
  const [selectedCategory, setSelectedCategory] = useState<string>('finance');
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);
  const [aiDossierText, setAiDossierText] = useState<string>('');
  const [isGeneratingDossier, setIsGeneratingDossier] = useState<boolean>(false);
  const [dossierAlertLevel, setDossierAlertLevel] = useState<'green' | 'yellow' | 'red'>('green');
  
  // Cache to avoid duplicate requests
  const dossierCache = useRef<Record<string, string>>({});

  useEffect(() => {
    const unsubStock = dbCacheService.subscribeCollection('stock_items', (data) => {
      setStockItems(data);
    });

    const unsubJourneys = dbCacheService.subscribeCollection('journeys', (data) => {
      setJourneys(data);
    });

    return () => {
      unsubStock();
      unsubJourneys();
    };
  }, []);

  // Sync first items as default when types change
  useEffect(() => {
    if (dossierType === 'vehicle' && vehicles.length > 0 && !selectedVehicleId) {
      setSelectedVehicleId(vehicles[0].id);
    }
  }, [dossierType, vehicles, selectedVehicleId]);

  useEffect(() => {
    if (dossierType === 'driver' && employees.length > 0 && !selectedEmployeeId) {
      setSelectedEmployeeId(employees[0].id);
    }
  }, [dossierType, employees, selectedEmployeeId]);

  // Compute Owner stats exactly like GabineteView
  const ownerStats = useMemo(() => {
    const totalIncome = (finance || [])
      .filter(f => f.type === 'income')
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    const totalExpense = (finance || [])
      .filter(f => f.type === 'payable' || f.type === 'expense')
      .reduce((sum, f) => sum + (f.amount || 0), 0);
    const netProfit = totalIncome - totalExpense;
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0;

    const totalFuelLiters = (fuelLogs || []).reduce((sum, l) => sum + Number(l.quantity || 0), 0);
    const totalFuelCost = (fuelLogs || []).reduce((sum, l) => sum + Number(l.cost || 0), 0);
    const totalArlaQuantity = (fuelLogs || []).reduce((sum, l) => sum + Number(l.arlaQuantity || 0), 0);

    const totalVehicles = vehicles.length;
    const activeVehicles = vehicles.filter(v => v.status === 'available').length;
    const inMaintenanceVehicles = vehicles.filter(v => v.status === 'maintenance').length;
    const fleetAvailabilityRate = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 100;

    const totalMaintenanceCost = (maintenance || []).reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const countPreventive = (maintenance || []).filter(m => m.type === 'preventive').length;
    const countCorrective = (maintenance || []).filter(m => m.type === 'corrective').length;

    const licenseAlerts: any[] = [];
    const today = new Date();

    vehicles.forEach(v => {
      const docsToCheck = [
        { label: 'CRLV Anual', date: v.licenseExpiration },
        { label: 'Turismo', date: v.tourismLicenseExpiration },
        { label: 'ANTT Nacional', date: v.anttExpiration },
        { label: 'CADASTUR', date: v.cadasturExpiration },
        { label: 'DETRO/ARTESP', date: v.detroArtespExpiration },
        { label: 'Municipal', date: v.municipalLicenseExpiration },
        { label: 'Tacógrafo', date: v.tacografoExpiration },
        { label: 'Seguro Frota', date: v.insuranceExpiration }
      ];

      docsToCheck.forEach(doc => {
        if (doc.date) {
          try {
            const expDate = parseISO(doc.date);
            const diffTime = expDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays <= 30) {
              licenseAlerts.push({
                vehiclePlate: v.plate,
                label: doc.label,
                date: doc.date,
                status: diffDays < 0 ? 'expired' : 'warning',
                daysLeft: diffDays
              });
            }
          } catch (e) {
            console.error('Error parsing date', doc.date, e);
          }
        }
      });
    });

    licenseAlerts.sort((a, b) => a.daysLeft - b.daysLeft);
    const lowStockAlerts = stockItems.filter(item => (item.quantity || 0) <= (item.minQuantity || 0));

    return {
      totalIncome,
      totalExpense,
      netProfit,
      profitMargin,
      totalFuelLiters,
      totalFuelCost,
      totalArlaQuantity,
      totalVehicles,
      activeVehicles,
      inMaintenanceVehicles,
      fleetAvailabilityRate,
      totalMaintenanceCost,
      countPreventive,
      countCorrective,
      licenseAlerts,
      lowStockAlerts
    };
  }, [vehicles, finance, fuelLogs, maintenance, stockItems]);

  const filteredDataRows = useMemo(() => {
    if (selectedCategory === 'finance') {
      return finance;
    } else if (selectedCategory === 'fuel') {
      return fuelLogs;
    } else if (selectedCategory === 'maintenance') {
      return maintenance;
    }
    return [];
  }, [selectedCategory, finance, fuelLogs, maintenance]);

  const currentCategoryLabel = useMemo(() => {
    switch (selectedCategory) {
      case 'finance': return 'Fluxo de Caixa & Finanças';
      case 'fuel': return 'Abastecimentos & Consumo';
      case 'maintenance': return 'Oficina & Manutenção';
      default: return 'Geral';
    }
  }, [selectedCategory]);

  const selectedVehicleData = useMemo(() => {
    if (dossierType !== 'vehicle' || !selectedVehicleId) return null;
    const v = vehicles.find(veh => veh.id === selectedVehicleId);
    if (!v) return null;

    const logs = (fuelLogs || [])
      .filter(l => l.vehicleId === selectedVehicleId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const lastFuel = logs.length > 0 ? logs[logs.length - 1] : null;
    const totalSpentFuel = logs.reduce((sum, l) => sum + Number(l.cost || 0), 0);
    const totalLiters = logs.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
    const totalArla = logs.reduce((sum, l) => sum + Number(l.arlaQuantity || 0), 0);

    let averageKML = null;
    if (logs.length >= 2) {
      const startOdo = logs[0].odometer;
      const endOdo = logs[logs.length - 1].odometer;
      const totalKM = endOdo - startOdo;
      const litersMinusLast = logs.slice(0, logs.length - 1).reduce((sum, l) => sum + Number(l.quantity || 0), 0);
      if (totalKM > 0 && litersMinusLast > 0) {
        averageKML = totalKM / litersMinusLast;
      }
    }

    const vMaint = (maintenance || []).filter(m => m.vehicleId === selectedVehicleId);
    const totalSpentMaint = vMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    const vTrips = (trips || []).filter(t => t.vehicleId === selectedVehicleId);

    return {
      vehicle: v,
      logs,
      lastFuel,
      totalSpentFuel,
      totalLiters,
      totalArla,
      averageKML,
      vMaint,
      totalSpentMaint,
      vTrips
    };
  }, [dossierType, selectedVehicleId, vehicles, fuelLogs, maintenance, trips]);

  const selectedDriverData = useMemo(() => {
    if (dossierType !== 'driver' || !selectedEmployeeId) return null;
    const e = employees.find(emp => emp.id === selectedEmployeeId);
    if (!e) return null;

    const driverJourneys = (journeys || [])
      .filter(j => j.employeeId === selectedEmployeeId)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const driverTrips = (trips || []).filter(t => t.driverId === selectedEmployeeId);
    const driverFuel = (fuelLogs || []).filter(l => l.driverId === selectedEmployeeId);
    const totalFuelLiters = driverFuel.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
    const totalFuelCost = driverFuel.reduce((sum, l) => sum + Number(l.cost || 0), 0);

    return {
      employee: e,
      driverJourneys,
      driverTrips,
      driverFuel,
      totalFuelLiters,
      totalFuelCost
    };
  }, [dossierType, selectedEmployeeId, employees, journeys, trips, fuelLogs]);

  // Unique cache key for each specific dossier query
  const currentDossierKey = useMemo(() => {
    if (dossierType === 'owner') {
      return `owner-strategic-${ownerStats.totalIncome}-${ownerStats.totalExpense}-${ownerStats.netProfit}-${ownerStats.totalFuelLiters}`;
    } else if (dossierType === 'modules') {
      return `modules-category-${selectedCategory}-${filteredDataRows.length}`;
    } else if (dossierType === 'vehicle') {
      return `vehicle-${selectedVehicleId || 'all'}`;
    } else if (dossierType === 'driver') {
      return `driver-${selectedEmployeeId || 'all'}`;
    } else {
      return `general-dossier`;
    }
  }, [dossierType, selectedCategory, selectedVehicleId, selectedEmployeeId, filteredDataRows.length, ownerStats]);

  const dossierSystemInstruction = 
    `Você é a Inteligência Analítica da DM Turismo, um sistema de gestão de transporte rodoviário e turismo altamente sofisticado de classe executiva.
Sua tarefa é analisar os dados reais consolidados de um módulo, veículo ou motorista e elaborar um DOSSIÊ COMPLETO estruturado, crítico e pragmático em português do Brasil.

O dossiê deve ser perfeitamente estruturado e conter:
1. ### RESUMO EXECUTIVO (Um diagnóstico macro situacional de 3-4 frases, com um tom profissional, técnico e analítico)
2. ### DIAGNÓSTICO SITUACIONAL (Liste em bullets contendo métricas reais os pontos fortes e de atenção. Ex: "Ponto Crítico: Vencimento da ANTT iminente (red)" ou "Economia: Consumo médio de 3.2 KM/L bem avaliado (green)")
3. ### PLANO DE AÇÃO PROATIVO (3 recomendações técnicas diretas e viáveis para melhorar a eficiência da frota, otimizar custos de combustível, evitar multas por licenças expiradas ou regularizar jornadas)

Regras de formatação importantes:
- Use emojis moderadamente para destacar alertas (Ex: 🔴 para perigo/crítico, 🟡 para atenção/moderado, 🟢 para excelente/conforme).
- Use ### para os títulos principais.
- Use **texto em negrito** para dar destaque aos KPIs, placas, nomes ou alertas fiscais/financeiros.
- Mantenha um tom profissional, corporativo, voltado para diretores e gerentes de transportes. Evite floreios intelectuais inúteis.`;

  const generateDossierPrompt = () => {
    let context = "";
    if (dossierType === 'owner') {
      context = `Painel Estratégico do Proprietário - DM Turismo\n`;
      context += `Informações financeiras consolidadas globais:\n`;
      context += `- Receitas: R$ ${ownerStats.totalIncome.toLocaleString('pt-BR')}\n`;
      context += `- Despesas: R$ ${ownerStats.totalExpense.toLocaleString('pt-BR')}\n`;
      context += `- Lucro operacional líquido: R$ ${ownerStats.netProfit.toLocaleString('pt-BR')}\n`;
      context += `- Margem de Lucratividade: ${ownerStats.profitMargin.toFixed(1)}%\n`;
      context += `Ativos da Frota:\n`;
      context += `- Veículos cadastrados: ${ownerStats.totalVehicles}\n`;
      context += `- Veículos operacionais/disponíveis: ${ownerStats.activeVehicles}\n`;
      context += `- Veículos em manutenção: ${ownerStats.inMaintenanceVehicles}\n`;
      context += `- Taxa de disponibilidade de frota: ${ownerStats.fleetAvailabilityRate.toFixed(1)}%\n`;
      context += `Suprimentos & Oficina:\n`;
      context += `- Custo de Manutenção: R$ ${ownerStats.totalMaintenanceCost.toLocaleString('pt-BR')} (OS Preventivas: ${ownerStats.countPreventive}, OS Corretivas: ${ownerStats.countCorrective})\n`;
      context += `- Consumo de Insumos (Combustível): ${ownerStats.totalFuelLiters.toLocaleString('pt-BR')} Litros (Custo: R$ ${ownerStats.totalFuelCost.toLocaleString('pt-BR')})\n`;
      if (ownerStats.licenseAlerts.length > 0) {
        context += `Alertas Importantes de Vencimento de Documentos:\n`;
        ownerStats.licenseAlerts.slice(0, 5).forEach(alert => {
          context += `- Veículo Placa ${alert.vehiclePlate}: O documento ${alert.label} ${alert.status === 'expired' ? 'está EXPIRADO' : 'vence em ' + alert.daysLeft + ' dias'} (Data: ${alert.date})\n`;
        });
      }
      if (ownerStats.lowStockAlerts.length > 0) {
        context += `Alertas Importantes de Estoque (Ruptura):\n`;
        ownerStats.lowStockAlerts.slice(0, 5).forEach(item => {
          context += `- Item "${item.name}": Estoque atual (${item.quantity}) está abaixo do mínimo exigido (${item.minQuantity})\n`;
        });
      }
    } else if (dossierType === 'modules') {
      const rowCount = filteredDataRows.length;
      context = `Módulo de Relatório: ${currentCategoryLabel}\n`;
      context += `Total de Lançamentos capturados: ${rowCount} registros.\n`;
      
      if (selectedCategory === 'finance') {
        const inc = filteredDataRows.filter(f => f.type === 'income').reduce((s, x) => s + (x.amount || 0), 0);
        const pay = filteredDataRows.filter(f => f.type === 'payable' || f.type === 'expense').reduce((s, x) => s + (x.amount || 0), 0);
        context += `Informações financeiras consolidadas:\n`;
        context += `- Receitas: R$ ${inc.toLocaleString('pt-BR')}\n`;
        context += `- Despesas/Contas a Pagar: R$ ${pay.toLocaleString('pt-BR')}\n`;
        context += `- Saldo operacional líquido: R$ ${(inc - pay).toLocaleString('pt-BR')}\n`;
      } else if (selectedCategory === 'fuel') {
        const liters = filteredDataRows.reduce((s, x) => s + Number(x.quantity || 0), 0);
        const cost = filteredDataRows.reduce((s, x) => s + Number(x.cost || 0), 0);
        const arla = filteredDataRows.reduce((s, x) => s + Number(x.arlaQuantity || 0), 0);
        context += `Consumo de combustível e Arla 32 consolidado:\n`;
        context += `- Óleo Diesel/Gasolina consumido: ${liters.toLocaleString('pt-BR')} Litros\n`;
        context += `- Volume correspondente de Arla 32: ${arla.toLocaleString('pt-BR')} Litros\n`;
        context += `- Total faturado em postos: R$ ${cost.toLocaleString('pt-BR')}\n`;
      } else if (selectedCategory === 'maintenance') {
        const cost = filteredDataRows.reduce((sum, m) => sum + Number(m.cost || 0), 0);
        const countPreventive = filteredDataRows.filter(m => m.type === 'preventive').length;
        const countCorrective = filteredDataRows.filter(m => m.type === 'corrective').length;
        context += `Histórico de manutenção mecânica:\n`;
        context += `- Gasto total acumulado em oficina: R$ ${cost.toLocaleString('pt-BR')}\n`;
        context += `- Manutenções Preventivas registradas: ${countPreventive}\n`;
        context += `- Manutenções Corretivas urgentes registradas: ${countCorrective}\n`;
      }
    } else if (dossierType === 'vehicle' && selectedVehicleData) {
      const { vehicle, totalSpentFuel, totalLiters, totalArla, averageKML, vMaint, totalSpentMaint } = selectedVehicleData;
      context = `Veículo focado no dossiê:\n`;
      context += `- Placa de Licenciamento: ${vehicle.plate}\n`;
      context += `- Marca e Modelo: ${vehicle.brand} ${vehicle.model} (${vehicle.factoryYear || '---'})\n`;
      context += `- Porte e Lotação: ${vehicle.type || 'Ônibus'} - Capacidade autorizada de ${vehicle.capacity || '45'} passageiros\n`;
      context += `- Odômetro atual de frota: ${vehicle.currentOdometer?.toLocaleString('pt-BR')} KM\n`;
      context += `- Status operacional da placa: ${vehicle.status === 'available' ? 'Ativo na Linha' : 'Recolhido para oficina'}\n`;
      context += `Atividade e Consumo:\n`;
      context += `- Combustível acumulado: ${totalLiters.toFixed(1)} Litros (Total Gasto: R$ ${totalSpentFuel.toLocaleString('pt-BR')})\n`;
      context += `- Consumo médio de combustível estimado: ${averageKML ? `${averageKML.toFixed(2)} KM/L` : 'Sem dados suficientes para calcular Média'}\n`;
      context += `- Arla 32 acumulado: ${totalArla.toFixed(1)} Litros\n`;
      context += `Manutenção e Mecânica:\n`;
      context += `- Gasto Total acumulado na Oficina: R$ ${totalSpentMaint.toLocaleString('pt-BR')}\n`;
      context += `- Contagem de intervenções: ${vMaint.length} ordens de serviço (${vMaint.filter((m: any) => m.type === 'preventive').length} preventivas e ${vMaint.filter((m: any) => m.type === 'corrective').length} corretivas)\n`;
      context += `Validade de Documentos Relevantes:\n`;
      context += `- CRLV Anual: ${vehicle.licenseExpiration || 'Não cadastrado'}\n`;
      context += `- ANTT Nacional: ${vehicle.anttExpiration || 'Não cadastrado'}\n`;
      context += `- CADASTUR: ${vehicle.cadasturExpiration || 'Não cadastrado'}\n`;
      context += `- Seguro Responsabilidade Civil (Seguro Frota): ${vehicle.insuranceExpiration || 'Não cadastrado'}\n`;
    } else if (dossierType === 'driver' && selectedDriverData) {
      const { employee, driverJourneys, driverTrips, totalFuelLiters, totalFuelCost } = selectedDriverData;
      context = `Colaborador focado no dossiê:\n`;
      context += `- Nome do Funcionário: ${employee.name}\n`;
      context += `- Função/Cargo Técnico: ${employee.role}\n`;
      context += `- Categoria de CNH e Qualificação de Viagem: Classe ${employee.licenseCategory || 'Não informado'}\n`;
      context += `- Data de Vencimento da CNH: ${employee.licenseExpiration || 'Não cadastrado'}\n`;
      context += `Apontamentos de Jornada e Ponto:\n`;
      context += `- Registros de frequência recente armazenados: ${driverJourneys.length} batidas no ponto.\n`;
      context += `- Viagens e escalas realizadas ou ativas: ${driverTrips.length} roteiros de viagens.\n`;
      context += `Consumo de Combustível sob sua condução:\n`;
      context += `- Volume total abastecido pelo operador: ${totalFuelLiters.toFixed(1)} Litros (Custo correspondente: R$ ${totalFuelCost.toLocaleString('pt-BR')})\n`;
    }

    return context;
  };

  const getDetailedProgrammaticDossier = () => {
    let md = "";
    if (dossierType === 'owner') {
      md += `### ### RESUMO EXECUTIVO\n`;
      md += `Este é o **Dossiê Consolidador Estratégico** de alto desempenho para o proprietário da **DM Turismo**. Contempla a saúde agregada operacional e de capital do negócio.\n\n`;
      md += `### ### DIAGNÓSTICO SITUACIONAL\n`;
      
      const bal = ownerStats.netProfit;
      md += `- ${bal >= 0 ? '🟢' : '🔴'} **Rentabilidade**: Saldo do caixa consolidado está em R$ **${bal.toLocaleString('pt-BR')}** com margem de lucro de **${ownerStats.profitMargin.toFixed(1)}%**.\n`;
      
      const activeCount = ownerStats.activeVehicles;
      const totalCount = ownerStats.totalVehicles;
      const rate = ownerStats.fleetAvailabilityRate;
      md += `- ${rate >= 80 ? '🟢' : '🟡'} **Disponibilidade da Frota**: Atualmente, **${activeCount} de ${totalCount} veículos** estão prontos para escala comercial (${rate.toFixed(1)}% de aproveitamento operacional).\n`;
      
      if (ownerStats.licenseAlerts.length > 0) {
        md += `- 🔴 **Alertas de Licenças**: Há **${ownerStats.licenseAlerts.length} licenças de tráfego vencidas ou próximas de vencer** nos próximos 30 dias na frota de ônibus.\n`;
        setDossierAlertLevel('red');
      } else {
        md += `- 🟢 **Conformidade de Licenças**: Todas as licenças da frota encontram-se em situação regular e adimplente.\n`;
      }

      if (ownerStats.lowStockAlerts.length > 0) {
        md += `- 🟡 **Suprimentos**: Identificou-se **${ownerStats.lowStockAlerts.length} itens no almoxarifado abaixo do estoque crítico**. Risco indireto de paradas por escassez de suprimento.\n`;
        setDossierAlertLevel('yellow');
      } else {
        md += `- 🟢 **Suprimentos**: Estoque do almoxarifado totalmente regularizado e provisionado.\n`;
      }
      
      md += `\n### ### PLANO DE AÇÃO PROATIVO\n`;
      md += `- 1. **Mitigação de Multas e Apreensões**: Regularizar prioritariamente os documentos identificados como vencidos ou próximos à validade.\n`;
      md += `- 2. **Otimização Térmica de Frota**: Realizar auditoria nos abastecimentos onde a relação KM/L esteja abaixo de 3.0 para evitar desvios financeiros em diesel.\n`;
      md += `- 3. **Planejamento de Fornecedores**: Contatar fabricantes de suprimentos em ruptura técnica para reabastecer as de maior consumo (óleos, pastilhas e filtros).\n`;
    } else if (dossierType === 'modules') {
      md += `### ### RESUMO EXECUTIVO\n`;
      md += `Dossiê Analítico Gerencial consolidado para o módulo de **${currentCategoryLabel}** no período filtrado. Apura-se a consistência operacional das atividades e cruzamento de lançamentos sob os filtros ativos. O fluxo de informações indica estabilidade regular, com pontos de otimização mapeados abaixo.\n\n`;
      md += `### ### DIAGNÓSTICO SITUACIONAL\n`;
      md += `- 🟢 **Volume de Registros**: Total de **${filteredDataRows.length} lançamentos** computados com precisão no período de análise.\n`;
      
      if (selectedCategory === 'finance') {
        const inc = filteredDataRows.filter(f => f.type === 'income').reduce((s, x) => s + (x.amount || 0), 0);
        const pay = filteredDataRows.filter(f => f.type === 'payable' || f.type === 'expense').reduce((s, x) => s + (x.amount || 0), 0);
        const bal = inc - pay;
        md += `- ${bal >= 0 ? '🟢' : '🔴'} **Fluxo de Caixa**: Receitas totais alcançam R$ **${inc.toLocaleString('pt-BR')}** contra saídas consolidadas de R$ **${pay.toLocaleString('pt-BR')}** (Saldo Líquido: R$ **${bal.toLocaleString('pt-BR')}**).\n`;
        md += `- 🟡 **Alergias Fiscais**: Recomenda-se realizar conferência de vencimentos em aberto para evitar a incidência de juros de mora e encargos administrativos.\n`;
        setDossierAlertLevel(bal >= 0 ? 'yellow' : 'red');
      } else if (selectedCategory === 'fuel') {
        const liters = filteredDataRows.reduce((s, x) => s + Number(x.quantity || 0), 0);
        const cost = filteredDataRows.reduce((s, x) => s + Number(x.cost || 0), 0);
        md += `- 🟡 **Abastecimentos**: Volume sob análise totaliza **${liters.toLocaleString('pt-BR')} Litros** faturados (Aporte financeiro de R$ **${cost.toLocaleString('pt-BR')}** junto aos postos parceiros).\n`;
        md += `- 🟢 **Controle Químico**: Monitoramento de Arla 32 preservado para conformidade com normas do Proconve.\n`;
        setDossierAlertLevel('yellow');
      } else if (selectedCategory === 'maintenance') {
        const cost = filteredDataRows.reduce((sum, m) => sum + Number(m.cost || 0), 0);
        const countPreventive = filteredDataRows.filter(m => m.type === 'preventive').length;
        const countCorrective = filteredDataRows.filter(m => m.type === 'corrective').length;
        md += `- 🔴 **Manutenções Corretivas**: Foram identificadas **${countCorrective} paradas de emergência** em oficina. Cada corretiva reduz a taxa de disponibilidade da frota ativa.\n`;
        md += `- 🟢 **Investimento em Manutenção**: Aporte de R$ **${cost.toLocaleString('pt-BR')}** focado em restabelecimento mecânico e segurança viária.\n`;
        setDossierAlertLevel(countCorrective > 0 ? 'red' : 'green');
      } else {
        md += `- 🟢 **Monitoramento Geral**: Atividades operacionais e de fretamento fluindo de acordo com as diretrizes e escalas DM Turismo.\n`;
        setDossierAlertLevel('green');
      }
      md += `\n### ### PLANO DE AÇÃO PROATIVO\n`;
      md += `- 1. **Cruzamento Periódico de Dados**: Estabelecer reconciliação semanal sistemática entre as áreas financeira e de suprimentos.\n`;
      md += `- 2. **Maximização Preventiva**: Priorizar planos preventivos para mitigar paradas imprevistas que onerem em até 3x o custo operacional.\n`;
      md += `- 3. **Auditoria no Consumo**: Validar consumo médio por placa de forma a mitigar desvios térmicos ou operacionais.\n`;
    } else if (dossierType === 'vehicle' && selectedVehicleData) {
      const { vehicle, totalSpentFuel, totalLiters, totalArla, averageKML, vMaint, totalSpentMaint } = selectedVehicleData;
      md += `### ### RESUMO EXECUTIVO\n`;
      md += `Ficha técnica e Dossiê Consolidado de Frota para o veículo de placa **${vehicle.plate.toUpperCase()}** (${vehicle.brand} ${vehicle.model}). Apura-se a eficiência térmica de consumo na condução, a taxa de sinistralidade ou paradas de mecânica, e a adimplência legal junto aos órgãos reguladores (DETRO, ANTT, CADASTUR).\n\n`;
      
      md += `### ### DIAGNÓSTICO SITUACIONAL\n`;
      
      let expiredCount = 0;
      let nearExpiredCount = 0;
      const docsToCheck = [
        { label: 'CRLV Anual', date: vehicle.licenseExpiration },
        { label: 'ANTT Nacional', date: vehicle.anttExpiration },
        { label: 'CADASTUR', date: vehicle.cadasturExpiration },
        { label: 'Seguro Frota', date: vehicle.insuranceExpiration }
      ];
      docsToCheck.forEach(d => {
        if (d.date) {
          const exp = isBefore(parseISO(d.date), new Date());
          if (exp) expiredCount++;
          else if (isBefore(parseISO(d.date), addDays(new Date(), 30))) nearExpiredCount++;
        }
      });

      if (expiredCount > 0) {
        md += `- 🔴 **Conformidade Legal Crítica**: Existem **${expiredCount} licenças de tráfego vencidas** para este veículo. Operar comercialmente neste estado coloca a empresa sob risco grave de multas, apreensão e responsabilidade civil.\n`;
        setDossierAlertLevel('red');
      } else if (nearExpiredCount > 0) {
        md += `- 🟡 **Alergias Fiscais Próximas**: Existem licenças a expirar em menos de 30 dias. Providenciar renovações cartorárias e taxas para evitar suspensão de tráfego.\n`;
        setDossierAlertLevel('yellow');
      } else {
        md += `- 🟢 **Conformidade Documental**: Toda a documentação e autorizações federais/estaduais estão ativas e regulares neste escopo.\n`;
        setDossierAlertLevel('green');
      }

      md += `- 🟢 **Odômetro**: Acumulado de **${(vehicle.currentOdometer || 0).toLocaleString('pt-BR')} KM** rodados. Placa classificada como operacional com taxa de atividade ideal.\n`;

      if (averageKML) {
        if (averageKML < 2.5) {
          md += `- 🔴 **Taxa de Eficiência (Combustível)**: Consumo de **${averageKML.toFixed(2)} KM/L** está abaixo da média estipulada de 3.0 KM/L para ônibus rodoviários. Risco de prejuízo ou falha no sistema de injeção.\n`;
          setDossierAlertLevel('red');
        } else {
          md += `- 🟢 **Eficiência de Combustível**: Média de **${averageKML.toFixed(2)} KM/L** dentro das metas de condução ecológica estabelecidas pela gerência.\n`;
        }
      } else {
        md += `- 🟡 **Consumo Térmico**: Dados de abastecimento insuficientes no sistema de frota para apuração da média ponderada de KM/L.\n`;
      }

      md += `- 🟡 **Manutenção**: Histórico financeiro de oficina totaliza R$ **${totalSpentMaint.toLocaleString('pt-BR')}** divididos em **${vMaint.length} ordens de serviço**.\n`;

      md += `\n### ### PLANO DE AÇÃO PROATIVO\n`;
      if (expiredCount > 0) {
        md += `- 1. **Paralisar Operações Administrativamente**: Bloquear imediatamente a placa para escalas de viagens em rodovias até a liberação do licenciamento correspondente.\n`;
      } else {
        md += `- 1. **Rotinas Preventivas Programadas**: Agendar a próxima troca de fluidos e lubrificantes conforme manual do fabricante e KM acumulado.\n`;
      }
      md += `- 2. **Calibragem e Alinhamento Pneumático**: Realizar aferição de pressão de pneus e geometria de eixos para otimizar o consumo térmico de Diesel.\n`;
      md += `- 3. **Ronda de Manutenção**: Realizar inspeção preventiva do tacógrafo e lacres mecânicos regulamentados.\n`;
    } else if (dossierType === 'driver' && selectedDriverData) {
      const { employee, driverJourneys, driverTrips, totalFuelLiters } = selectedDriverData;
      md += `### ### RESUMO EXECUTIVO\n`;
      md += `Prontuário técnico, controle de ponto e Dossiê Individual do Colaborador **${employee.name.toUpperCase()}** no exercício de suas atribuições na DM Turismo. Avaliou-se detidamente seu alinhamento com a escala de horários, preenchimento correto de jornada de trabalho (ponto eletrônico) e responsabilidade no tráfego comercial.\n\n`;
      
      md += `### ### DIAGNÓSTICO SITUACIONAL\n`;
      
      let cnhAlert = false;
      if (employee.licenseExpiration) {
        const expired = isBefore(parseISO(employee.licenseExpiration), new Date());
        if (expired) {
          md += `- 🔴 **Status Legal da CNH**: Habilitação de Categoria **${employee.licenseCategory || 'D'}** com vencimento ultrapassado em **${format(parseISO(employee.licenseExpiration), 'dd/MM/yyyy')}**. O motorista está terminantemente proibido de assumir a direção técnica.\n`;
          cnhAlert = true;
          setDossierAlertLevel('red');
        } else if (isBefore(parseISO(employee.licenseExpiration), addDays(new Date(), 30))) {
          md += `- 🟡 **Vencimento Próximo de CNH**: Vence em menos de 30 dias (${format(parseISO(employee.licenseExpiration), 'dd/MM/yyyy')}). Agendar exame clínico pré-demissional ou de renovação com brevidade.\n`;
          cnhAlert = true;
          setDossierAlertLevel('yellow');
        } else {
          md += `- 🟢 **CNH Conforme**: Habilitação ativa Categoria **${employee.licenseCategory || 'D'}** regularizada e válida até ${format(parseISO(employee.licenseExpiration), 'dd/MM/yyyy')}.\n`;
        }
      } else {
        md += `- 🟡 **Ficha Cadastral**: Cadastro individual não possui a data de validade de habilitação. Risco operacional indireto.\n`;
        setDossierAlertLevel('yellow');
      }

      md += `- 🟢 **Jornada de Trabalho**: Foram apurados **${driverJourneys.length} registros de ponto** recentes, mantendo confiabilidade de controle de horas de descanso interjornada regulamentares.\n`;
      md += `- 🟢 **Rotas Efetuadas**: Registra **${driverTrips.length} escalas executadas** sob comando, mantendo regularidade de cumprimento de rotas comerciais.\n`;
      
      if (totalFuelLiters > 0) {
        md += `- 🟢 **Suprimento de Frota**: Realizou o abastecimento de **${totalFuelLiters.toFixed(1)} Litros** em postos de tráfego.\n`;
      }

      md += `\n### ### PLANO DE AÇÃO PROATIVO\n`;
      if (cnhAlert) {
        md += `- 1. **Encaminhamento Médico e Detran**: Providenciar imediatamente o reteste de vista e desimpedimento da renovação da CNH profissional.\n`;
      } else {
        md += `- 1. **Treinamento de Direção Defensiva**: Integrar o colaborador com o módulo semestral de condução segura e direção ecológica da DM Turismo.\n`;
      }
      md += `- 2. **Auditoria de Horários**: Certificar-se da observância rigorosa da lei do motorista profissional, com repouso mínimo obrigatório.\n`;
      md += `- 3. **Conferência Pré-Viagem**: Realizar check-list diário de freios, iluminação e pneus do veículo escalado antes do início de rotas de turismo.\n`;
    }
    return md;
  };

  const fetchDossierText = async (key: string) => {
    setIsGeneratingDossier(true);
    setAiDossierText('');
    
    const contextData = generateDossierPrompt();
    const promptMessage = `Elabore o dossiê executivo completo para o seguinte assunto com os dados consolidados:\n\n${contextData}`;
    
    try {
      let response;
      for (let i = 0; i < 3; i++) {
        try {
          response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: promptMessage,
              systemInstruction: dossierSystemInstruction
            })
          });
          if (response.ok) break;
          if (i === 2) throw new Error('Falha no serviço de IA após 3 tentativas');
          await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        } catch (e) {
          if (i === 2) throw e;
        }
      }

      if (!response || !response.ok) {
        throw new Error('Falha no serviço de IA');
      }

      const resData = await response.json();
      if (resData && resData.text) {
        const generatedText = resData.text;
        setAiDossierText(generatedText);
        dossierCache.current[key] = generatedText;
        
        if (generatedText.includes('🔴') || generatedText.toUpperCase().includes('CRÍTICO') || generatedText.toUpperCase().includes('EXPIRADO')) {
          setDossierAlertLevel('red');
        } else if (generatedText.includes('🟡') || generatedText.toUpperCase().includes('ATENÇÃO') || generatedText.toUpperCase().includes('REPOSIÇÃO')) {
          setDossierAlertLevel('yellow');
        } else {
          setDossierAlertLevel('green');
        }
      } else {
        throw new Error('Retorno vazio');
      }
    } catch (err) {
      console.error('Error generating AI dossier, compiling technical fallback...', err);
      toast.error('O serviço de IA está temporariamente indisponível. Gerando dossiê via fallback técnico.');
      const fallbackText = getDetailedProgrammaticDossier();
      setAiDossierText(fallbackText);
      dossierCache.current[key] = fallbackText;
    } finally {
      setIsGeneratingDossier(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      const key = currentDossierKey;
      if (dossierCache.current[key]) {
        setAiDossierText(dossierCache.current[key]);
        const txt = dossierCache.current[key];
        if (txt.includes('🔴') || txt.toUpperCase().includes('CRÍTICO')) {
          setDossierAlertLevel('red');
        } else if (txt.includes('🟡') || txt.toUpperCase().includes('ATENÇÃO')) {
          setDossierAlertLevel('yellow');
        } else {
          setDossierAlertLevel('green');
        }
      } else {
        fetchDossierText(key);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [currentDossierKey]);

  const renderDossierContent = () => {
    const lines = aiDossierText.split('\n');
    
    return (
      <div className="bg-zinc-950 border border-zinc-850 rounded-3xl p-6 relative overflow-hidden shadow-2xl transition-all duration-300">
        <div className={cn(
          "absolute inset-x-0 top-0 h-[3px]",
          dossierAlertLevel === 'red' ? "bg-rose-500 animate-pulse" :
          dossierAlertLevel === 'yellow' ? "bg-amber-500 animate-pulse" : "bg-emerald-500"
        )} />

        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-zinc-900 pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className={cn(
              "p-2.5 rounded-xl border",
              dossierAlertLevel === 'red' ? "bg-rose-500/10 border-rose-500/20 text-rose-500" :
              dossierAlertLevel === 'yellow' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
            )}>
              <Activity size={18} className="animate-pulse" />
            </div>
            <div>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Dossiê de Inteligência • DM Turismo</span>
              <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                📂 Dossiê Executivo de Alta Gestão
              </h2>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <span className={cn(
              "px-3 py-1.5 text-[8.5px] font-black uppercase tracking-widest rounded-xl border flex items-center gap-1.5",
              dossierAlertLevel === 'red' ? "bg-rose-800/10 border-rose-500/20 text-rose-500" :
              dossierAlertLevel === 'yellow' ? "bg-amber-800/10 border-amber-500/20 text-amber-500" : "bg-emerald-800/10 border-emerald-500/20 text-emerald-400"
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                dossierAlertLevel === 'red' ? "bg-rose-500 animate-ping" :
                dossierAlertLevel === 'yellow' ? "bg-amber-500 animate-ping" : "bg-emerald-500"
              )} />
              {dossierAlertLevel === 'red' ? 'ALERTA CRÍTICO' : dossierAlertLevel === 'yellow' ? 'RECOMENDAÇÃO ATIVA' : 'SITUAÇÃO CONFORME'}
            </span>
            <button
              onClick={() => fetchDossierText(currentDossierKey)}
              disabled={isGeneratingDossier}
              className="flex items-center gap-1 px-3 py-1.5 border border-zinc-850 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 hover:bg-zinc-850 rounded-xl text-[9px] font-black uppercase transition-all disabled:opacity-50 cursor-pointer"
            >
              🔄 Regenerar IA
            </button>
          </div>
        </div>

        {isGeneratingDossier ? (
          <div className="space-y-4 py-3">
            <div className="flex items-center gap-3 animate-pulse">
              <div className="h-4 bg-zinc-900 rounded-lg w-1/3"></div>
            </div>
            <div className="space-y-2.5">
              <div className="h-3 bg-zinc-900 rounded-lg w-full animate-pulse"></div>
              <div className="h-3 bg-zinc-900 rounded-lg w-5/6 animate-pulse"></div>
              <div className="h-3 bg-zinc-900 rounded-lg w-4/5 animate-pulse"></div>
            </div>
            <div className="h-32 bg-zinc-950 rounded-2xl border border-zinc-900 flex flex-col items-center justify-center p-6 text-center text-[9px] font-black text-zinc-500 uppercase tracking-widest gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-accent"></span>
              </span>
              Processando registros e gerando dossiê estratégico...
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-zinc-300 text-xs leading-relaxed max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
            {lines.map((line, idx) => {
              const trimmed = line.trim();
              if (!trimmed) return <div key={idx} className="h-2" />;

              if (trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('### ###')) {
                const cleanText = trimmed.replace(/^###\s*###\s*/, '').replace(/^###\s*/, '').replace(/^##\s*/, '').trim();
                return (
                  <h3 key={idx} className="text-[10px] font-black text-white uppercase tracking-wider block border-l-2 border-brand-accent/60 pl-2.5 mt-5 mb-2 font-mono">
                    {cleanText}
                  </h3>
                );
              }

              if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                let bulletContents = trimmed.substring(1).trim();
                const parts: React.ReactNode[] = [];
                let rest = bulletContents;
                let keyIdx = 0;
                while (rest.includes('**')) {
                  const firstIdx = rest.indexOf('**');
                  const secondIdx = rest.indexOf('**', firstIdx + 2);
                  if (secondIdx === -1) break;
                  
                  parts.push(rest.substring(0, firstIdx));
                  parts.push(
                    <strong key={keyIdx++} className="text-zinc-100 font-black">
                      {rest.substring(firstIdx + 2, secondIdx)}
                    </strong>
                  );
                  rest = rest.substring(secondIdx + 2);
                }
                parts.push(rest);

                return (
                  <div key={idx} className="flex items-start gap-2.5 pl-1 my-1">
                    <span className="text-brand-accent text-[8px] mt-1">▪</span>
                    <span className="text-zinc-300 text-[10.5px] font-medium leading-relaxed">{parts.length > 0 ? parts : bulletContents}</span>
                  </div>
                );
              }

              if (/^\d+\./.test(trimmed)) {
                const parts: React.ReactNode[] = [];
                let rest = trimmed;
                let keyIdx = 0;
                while (rest.includes('**')) {
                  const firstIdx = rest.indexOf('**');
                  const secondIdx = rest.indexOf('**', firstIdx + 2);
                  if (secondIdx === -1) break;
                  
                  parts.push(rest.substring(0, firstIdx));
                  parts.push(
                    <strong key={keyIdx++} className="text-brand-accent font-black">
                      {rest.substring(firstIdx + 2, secondIdx)}
                    </strong>
                  );
                  rest = rest.substring(secondIdx + 2);
                }
                parts.push(rest);

                return (
                  <div key={idx} className="bg-zinc-950 p-3.5 rounded-2xl border border-zinc-900 flex gap-3 text-[10.5px] hover:border-zinc-800 transition-colors my-2.5 font-bold text-zinc-300">
                    <span className="text-brand-accent text-[11px] font-black">⚡</span>
                    <div className="flex-1 leading-relaxed">{parts.length > 0 ? parts : trimmed}</div>
                  </div>
                );
              }

              return (
                <p key={idx} className="text-[10.5px] text-zinc-400 font-medium leading-relaxed">
                  {trimmed}
                </p>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="p-6 bg-zinc-900/60 border border-white/5 rounded-[2rem] space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[8px] font-mono font-bold text-brand-accent uppercase tracking-widest">Núcleo Criador • Alta Inteligência</span>
            <h2 className="text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
              <Sparkles size={18} className="text-brand-accent" />
              Dossiê de Inteligência Operacional
            </h2>
          </div>
          
          {/* Selector block for Dossier Types */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'owner', label: 'Estratégico Proprietário', icon: Briefcase },
              { id: 'modules', label: 'Módulos', icon: Activity },
              { id: 'vehicle', label: 'Veículo', icon: Bus },
              { id: 'driver', label: 'Motorista', icon: Users }
            ].map((t) => {
              const Icon = t.icon;
              const isActive = dossierType === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => setDossierType(t.id as any)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all",
                    isActive
                      ? "bg-zinc-805 text-brand-accent border border-brand-accent/20"
                      : "bg-zinc-950 text-zinc-500 hover:text-zinc-300 border border-white/5"
                  )}
                >
                  <Icon size={12} />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dynamic Context Parameters Selector depends on selected Dossier Type */}
        <div className="p-4 bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
          <div className="text-[10.5px] font-semibold text-zinc-400 uppercase tracking-wider">
            ⚙️ Parametrizar Escopo de Processamento técnico:
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {dossierType === 'modules' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase">Módulo:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] uppercase font-black tracking-wider rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent cursor-pointer"
                >
                  <option value="finance">💸 Financeiro</option>
                  <option value="fuel">⛽ Abastecimento</option>
                  <option value="maintenance">🔧 Oficina & Manutenções</option>
                </select>
              </div>
            )}

            {dossierType === 'vehicle' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase">Selecione o Veículo:</span>
                <select
                  value={selectedVehicleId}
                  onChange={(e) => setSelectedVehicleId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] uppercase font-black tracking-wider rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent max-w-xs cursor-pointer"
                >
                  {vehicles.length === 0 ? (
                    <option value="">Nenhum ônibus cadastrado</option>
                  ) : (
                    vehicles.map(v => (
                      <option key={v.id} value={v.id}>{v.plate.toUpperCase()} - {v.brand} {v.model}</option>
                    ))
                  )}
                </select>
              </div>
            )}

            {dossierType === 'driver' && (
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-black text-zinc-500 uppercase">Selecione o Motorista:</span>
                <select
                  value={selectedEmployeeId}
                  onChange={(e) => setSelectedEmployeeId(e.target.value)}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-[10px] uppercase font-black tracking-wider rounded-lg px-3 py-1.5 focus:outline-none focus:border-brand-accent max-w-xs cursor-pointer"
                >
                  {employees.length === 0 ? (
                    <option value="">Nenhum motorista cadastrado</option>
                  ) : (
                    employees.map(e => (
                      <option key={e.id} value={e.id}>{e.name.toUpperCase()} ({e.role})</option>
                    ))
                  )}
                </select>
              </div>
            )}

            <div className="text-[9.5px] font-bold text-zinc-500 uppercase bg-zinc-900/50 px-2 py-1 rounded-md border border-zinc-900">
              Registros Ativos: <span className="text-white font-mono">{
                dossierType === 'owner' ? vehicles.length + finance.length + fuelLogs.length + maintenance.length :
                dossierType === 'modules' ? filteredDataRows.length :
                dossierType === 'vehicle' ? (selectedVehicleData?.logs.length || 0) + (selectedVehicleData?.vMaint.length || 0) :
                (selectedDriverData?.driverJourneys.length || 0) + (selectedDriverData?.driverTrips.length || 0)
              }</span>
            </div>
          </div>
        </div>

        {/* Output Area for the Intelligence Dossier */}
        {renderDossierContent()}
      </div>
    </div>
  );
};
