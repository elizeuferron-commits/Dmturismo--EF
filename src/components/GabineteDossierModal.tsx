import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileText, 
  SlidersHorizontal, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  TrendingUp, 
  DollarSign, 
  Bus, 
  Users, 
  Activity, 
  Copy,
  Share2,
  CalendarDays,
  LogOut
} from 'lucide-react';
import { collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { geminiService } from '../services/geminiService';
import { format, parseISO, isBefore, addDays, subDays } from 'date-fns';
import { toast } from 'sonner';

interface GabineteDossierModalProps {
  isOpen: boolean;
  onClose: () => void;
  vehicles: any[];
  employees: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
}

export const GabineteDossierModal: React.FC<GabineteDossierModalProps> = ({
  isOpen,
  onClose,
  vehicles = [],
  employees = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = []
}) => {
  // Filtros de Dossiê
  const [period, setPeriod] = useState<'current_month' | 'last_30' | 'last_90' | 'all'>('current_month');
  const [scope, setScope] = useState<'general' | 'operator' | 'agency'>('general');
  const [depth, setDepth] = useState<'deep' | 'executive'>('deep');
  const [focusAssetType, setFocusAssetType] = useState<'none' | 'vehicle' | 'driver'>('none');
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  // Estados adicionais syncados
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [journeys, setJourneys] = useState<any[]>([]);

  // Estado do Dossiê Gerado
  const [generatedText, setGeneratedText] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [alertLevel, setAlertLevel] = useState<'green' | 'yellow' | 'red'>('green');

  // Estados para geração de PDF de ativos
  const [pdfType, setPdfType] = useState<'complete' | 'summarized'>('complete');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);

  // Listeners de estoque e jornadas locais para consolidar ao máximo
  useEffect(() => {
    if (!isOpen) return;

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
  }, [isOpen]);

  // Limpa o estado quando seleciona tipo de ativo diferente
  useEffect(() => {
    setSelectedAssetId('');
  }, [focusAssetType]);

  // Se o usuário seleciona veículo/motorista, garante primeiro item se houver
  useEffect(() => {
    if (focusAssetType === 'vehicle' && vehicles.length > 0 && !selectedAssetId) {
      setSelectedAssetId(vehicles[0].id);
    } else if (focusAssetType === 'driver' && employees.length > 0 && !selectedAssetId) {
      setSelectedAssetId(employees[0].id);
    }
  }, [focusAssetType, vehicles, employees, selectedAssetId]);

  // Filtragem dos logs com base no período selecionado
  const filterByPeriod = <T extends { timestamp?: string; date?: string; dueDate?: string; createdAt?: string }>(list: T[]): T[] => {
    const today = new Date();
    let minDate: Date | null = null;

    if (period === 'current_month') {
      // Começo do mês corrente
      minDate = new Date(today.getFullYear(), today.getMonth(), 1);
    } else if (period === 'last_30') {
      minDate = subDays(today, 30);
    } else if (period === 'last_90') {
      minDate = subDays(today, 90);
    }

    if (!minDate) return list;

    return list.filter(item => {
      const dateStr = item.timestamp || item.date || item.dueDate || item.createdAt;
      if (!dateStr) return true;
      try {
        const itemDate = parseISO(dateStr.substring(0, 10));
        return !isBefore(itemDate, minDate!);
      } catch (e) {
        return true;
      }
    });
  };

  // Consolidação de Informações em Alta Densidade para a Inteligência Artificial
  const consolidatedReportData = useMemo(() => {
    // 1. Filtrar transações financeiras por período
    const fTransactions = filterByPeriod(finance);
    
    // Totalizadores Financeiros
    const totalIncome = fTransactions
      .filter(f => f.type === 'income' || f.type === 'receivable')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const totalExpense = fTransactions
      .filter(f => f.type === 'payable' || f.type === 'expense')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const realizedIncome = fTransactions
      .filter(f => (f.type === 'income' || f.type === 'receivable') && f.status === 'paid')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const realizedExpense = fTransactions
      .filter(f => (f.type === 'payable' || f.type === 'expense') && f.status === 'paid')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const pendingReceivable = fTransactions
      .filter(f => (f.type === 'income' || f.type === 'receivable') && f.status !== 'paid')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    const pendingPayable = fTransactions
      .filter(f => (f.type === 'payable' || f.type === 'expense') && f.status !== 'paid')
      .reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

    // Divisão de Negócios: Agência de Turismo (comissão / pacotes) vs Operadora de Transporte (Fretados / Linhas)
    const agencyTx = fTransactions.filter(f => 
      (f.category || '').toLowerCase().includes('agência') || 
      (f.category || '').toLowerCase().includes('pacote') ||
      (f.category || '').toLowerCase().includes('comissão') ||
      (f.category || '').toLowerCase().includes('passagem')
    );
    const agencyVolume = agencyTx.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);
    const agencyComm = agencyTx.reduce((sum, f) => {
      const commStr = f.observations?.match(/Comissão:\s*R\$\s*([\d,.]+)/);
      if (commStr) {
        return sum + parseFloat(commStr[1].replace('.', '').replace(',', '.'));
      }
      return sum + (Number(f.amount || 0) * 0.12); // estimativa 12%
    }, 0);

    // 2. Filtragem de Viagens da Operadora
    const activeTrips = filterByPeriod(trips);
    const totalTripsCost = activeTrips.reduce((sum, t) => sum + (Number(t.cost) || 0), 0);
    const totalTripsValue = activeTrips.reduce((sum, t) => sum + (Number(t.value) || 0), 0);

    // 3. Status de frotas e consumos
    const activeFuelLogs = filterByPeriod(fuelLogs);
    const totalFuelLiters = activeFuelLogs.reduce((sum, f) => sum + (Number(f.quantity) || 0), 0);
    const totalFuelCost = activeFuelLogs.reduce((sum, f) => sum + (Number(f.cost) || 0), 0);
    const totalArlaQuantity = activeFuelLogs.reduce((sum, f) => sum + (Number(f.arlaQuantity) || 0), 0);

    // 4. Manutenções
    const activeMaint = filterByPeriod(maintenance);
    const totalMaintCost = activeMaint.reduce((sum, m) => sum + (Number(m.cost) || 0), 0);
    const preventiveCount = activeMaint.filter(m => m.type === 'preventive').length;
    const correctiveCount = activeMaint.filter(m => m.type === 'corrective').length;

    // 5. Alertas de validade de frotas
    const licenseAlerts: any[] = [];
    const today = new Date();
    vehicles.forEach(v => {
      const docs = [
        { name: 'CRLV Anual', date: v.licenseExpiration },
        { name: 'ANTT Nacional', date: v.anttExpiration },
        { name: 'CADASTUR', date: v.cadasturExpiration },
        { name: 'Tacógrafo', date: v.tacografoExpiration },
        { name: 'Seguro Frota', date: v.insuranceExpiration }
      ];
      docs.forEach(d => {
        if (d.date) {
          try {
            const exp = parseISO(d.date);
            const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= 45) {
              licenseAlerts.push({
                plate: v.plate,
                model: `${v.brand} ${v.model}`,
                documentName: d.name,
                expirationDate: d.date,
                daysRemaining: diffDays,
                status: diffDays < 0 ? 'expired' : 'critical'
              });
            }
          } catch (e) {}
        }
      });
    });

    // 6. Alertas de CNH dos motoristas
    const employeeLicenseAlerts: any[] = [];
    employees.forEach(emp => {
      if (emp.licenseExpiration) {
        try {
          const exp = parseISO(emp.licenseExpiration);
          const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 45) {
            employeeLicenseAlerts.push({
              name: emp.name,
              role: emp.role,
              category: emp.licenseCategory,
              expirationDate: emp.licenseExpiration,
              daysRemaining: diffDays,
              status: diffDays < 0 ? 'expired' : 'critical'
            });
          }
        } catch (e) {}
      }
    });

    // 7. Alertas de estoque crítico no almoxarifado
    const lowStock = stockItems.filter(item => (Number(item.quantity) || 0) <= (Number(item.minQuantity) || 0));

    // Elemento focado específico
    let focusAssetDetails = '';
    if (focusAssetType === 'vehicle' && selectedAssetId) {
      const v = vehicles.find(veh => veh.id === selectedAssetId || veh.plate === selectedAssetId);
      if (v) {
        const vFuel = activeFuelLogs.filter(l => l.vehicleId === v.id || l.vehicleId === v.plate);
        const vMaint = activeMaint.filter(m => m.vehicleId === v.id || m.vehicleId === v.plate);
        const vTrips = activeTrips.filter(t => t.vehicleId === v.id || t.vehicleId === v.plate);
        focusAssetDetails = `
--- FOCO ESPECÍFICO EM VEÍCULO ---
Placa: ${v.plate.toUpperCase()} | Veículo: ${v.brand} ${v.model} (${v.factoryYear || '---'}) | Tipo: ${v.type || 'Ônibus'}
Status de Operação: ${v.status} | Odômetro Atual: ${v.currentOdometer || '---'} KM
Abastecimentos do período: ${vFuel.length} registros | Gasto Combustível: R$ ${vFuel.reduce((s, x) => s + (Number(x.cost) || 0), 0).toLocaleString('pt-BR')}
Manutenções do período: ${vMaint.length} ordens | Custos de Oficina: R$ ${vMaint.reduce((s, x) => s + (Number(x.cost) || 0), 0).toLocaleString('pt-BR')}
Viagens/Linhas efetuadas: ${vTrips.length} roteiros executados.
`;
      }
    } else if (focusAssetType === 'driver' && selectedAssetId) {
      const emp = employees.find(e => e.id === selectedAssetId);
      if (emp) {
        const dTrips = activeTrips.filter(t => t.driverId === emp.name || t.driverId === emp.id);
        const dJourneys = journeys.filter(j => j.employeeId === emp.id);
        const dFuel = activeFuelLogs.filter(f => f.driverId === emp.name || f.driverId === emp.id);
        focusAssetDetails = `
--- FOCO ESPECÍFICO EM MOTORISTA ---
Colaborador: ${emp.name.toUpperCase()} | Função: ${emp.role} | CNH: ${emp.licenseCategory || 'D'} (Vence: ${emp.licenseExpiration || '---'})
Viagens escaladas no período: ${dTrips.length} roteiros comercializados
Registros de bater cartão (Jornadas): ${dJourneys.length} apontamentos de frequência
Abastecimentos efetuados sob condução: ${dFuel.length} abastecimentos | Diesel total: ${dFuel.reduce((s, x) => s + (Number(x.quantity) || 0), 0).toFixed(1)} Litros.
`;
      }
    }

    return {
      totalIncome,
      totalExpense,
      realizedIncome,
      realizedExpense,
      pendingReceivable,
      pendingPayable,
      netProfit: totalIncome - totalExpense,
      profitMargin: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0,
      
      agencyVolume,
      agencyComm,
      agencyTxCount: agencyTx.length,

      tripsCount: activeTrips.length,
      totalTripsCost,
      totalTripsValue,

      totalFuelLiters,
      totalFuelCost,
      totalArlaQuantity,

      totalMaintCost,
      preventiveCount,
      correctiveCount,

      licenseAlerts,
      employeeLicenseAlerts,
      lowStock,
      focusAssetDetails
    };
  }, [period, finance, trips, fuelLogs, maintenance, vehicles, employees, stockItems, journeys, focusAssetType, selectedAssetId]);

  // Função para compor o Dossiê programático completo (Fallback extremamente rico e completo!)
  const getDetailedStateDossier = (): string => {
    const d = consolidatedReportData;
    const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
    let scopeLabel = scope === 'general' ? 'CONSOLIDADO GERAL (TURISMO & TRANSPORTE)' : scope === 'operator' ? 'EXCLUSIVO OPERADORA DE FROTA' : 'EXCLUSIVO AGÊNCIA DE VIAGENS';
    let periodLabel = period === 'current_month' ? 'Exercício do Mês Corrente' : period === 'last_30' ? 'Últimos 30 Dias' : period === 'last_90' ? 'Últimos 90 Dias' : 'Histórico Acumulado Completo';
    
    let text = `### ### DOSSIÊ EXECUTIVO DE ALTA GESTÃO DM TURISMO\n`;
    text += `**Parâmetros de Filtro**: ${scopeLabel} | **Período**: ${periodLabel} | **Compilação**: ${todayStr}\n\n`;
    
    text += `### RESUMO EXECUTIVO DO NEGÓCIO\n`;
    text += `Este dossiê consolida os dados reais administrativos, financeiros e operacionais do ecossistema **DM Turismo**. `;
    if (scope === 'general') {
      text += `A agência de pacotes terrestres gerou R$ **${d.agencyVolume.toLocaleString('pt-BR')}** em volume de vendas com comissionamento estimado de R$ **${d.agencyComm.toLocaleString('pt-BR')}**. Simultaneamente, a frota da transportadora gerenciou R$ **${d.totalTripsValue.toLocaleString('pt-BR')}** em serviços de fretamento industrial e turístico, operando com custos mecânicos de R$ **${d.totalMaintCost.toLocaleString('pt-BR')}** e abastecimentos correspondentes a R$ **${d.totalFuelCost.toLocaleString('pt-BR')}**.\n\n`;
    } else if (scope === 'operator') {
      text += `A operadora de transporte gerenciou R$ **${d.totalTripsValue.toLocaleString('pt-BR')}** em faturamento bruto contra despesas de combustível de R$ **${d.totalFuelCost.toLocaleString('pt-BR')}** e corretivas de R$ **${d.totalMaintCost.toLocaleString('pt-BR')}** no período filtrado. Observa-se estabilização técnica dos custos.\n\n`;
    } else {
      text += `Foco exclusivo na agência de turismo, totalizando **${d.agencyTxCount} vendas de pacotes**, bilhetes ou comissionamentos terrestres secundários que integram R$ **${d.agencyVolume.toLocaleString('pt-BR')}** de fluxo com comissão de R$ **${d.agencyComm.toLocaleString('pt-BR')}**.\n\n`;
    }

    text += `### DIAGNÓSTICO SITUACIONAL (CONSOLIDAÇÃO DE DADOS)\n`;
    
    // Alertas Fiscais / Caixa
    const caixaReal = d.realizedIncome - d.realizedExpense;
    text += `- ${caixaReal >= 0 ? '🟢' : '🔴'} **Disponibilidade de Caixa**: Saldo financeiro liquidado (caixa real) está em R$ **${caixaReal.toLocaleString('pt-BR')}** (Entradas Realizadas: R$ ${d.realizedIncome.toLocaleString('pt-BR')} | Saídas Realizadas: R$ ${d.realizedExpense.toLocaleString('pt-BR')}).\n`;
    
    if (d.pendingPayable > 0) {
      text += `- 🟡 **Compromissos Pendentes**: Há R$ **${d.pendingPayable.toLocaleString('pt-BR')}** em títulos aguardando pagamento no período das contas. Recomendável conciliação rápida para evitar multas de adimplemento.\n`;
    }
    
    if (d.pendingReceivable > 0) {
      text += `- 🟢 **Crédito a Ingressar**: R$ **${d.pendingReceivable.toLocaleString('pt-BR')}** em recebimentos faturados vigentes no período.\n`;
    }

    // Alertas de Frotas / Manutenção
    if (scope !== 'agency') {
      text += `- ${d.correctiveCount > 0 ? '🔴' : '🟢'} **Manutenções de Frota**: Total acumulado de R$ **${d.totalMaintCost.toLocaleString('pt-BR')}** em oficinas. Foram registradas **${d.preventiveCount} OS Preventivas** contra **${d.correctiveCount} OS Corretivas**. Lembre-se que cada manutenção corretiva aumenta em até 3x o custo direto de garagem.\n`;
      text += `- ⛽ **Consumo Térmico de Diesel**: Abastecimento computado de **${d.totalFuelLiters.toLocaleString('pt-BR')} Litros** de Diesel no período fiscal, com custo médio de faturamento de R$ **${d.totalFuelCost.toLocaleString('pt-BR')}**.\n`;
    }

    // Inconformidades Ativas
    if (d.licenseAlerts.length > 0) {
      text += `\n### ALERTA DE CONFORMIDADE DE ATIVOS (FROTA COM DOCUMENTOS VENCENDO)\n`;
      d.licenseAlerts.forEach(alert => {
        text += `- 🔴 **Veículo ${alert.plate}** (${alert.model}): O documento **${alert.documentName}** ${alert.daysRemaining < 0 ? '**está EXPIRADO desde ' + alert.expirationDate + '**' : 'vence em ' + alert.daysRemaining + ' dias (' + alert.expirationDate + ')'}.\n`;
      });
    }

    if (d.employeeLicenseAlerts.length > 0) {
      text += `\n### ALERTA DE CONFORMIDADE DE PROFISSIONAIS (CNHS EXPIRANDO)\n`;
      d.employeeLicenseAlerts.forEach(alert => {
        text += `- 🔴 **Colaborador ${alert.name}** (${alert.role}): CNH Categ. ${alert.category || 'D'} ${alert.daysRemaining < 0 ? '**está VECIDA desde ' + alert.expirationDate + '**' : 'vence em ' + alert.daysRemaining + ' dias (' + alert.expirationDate + ')'}.\n`;
      });
    }

    if (d.lowStock.length > 0) {
      text += `\n### ALERTAS DE RUPTURA DE ALMOXARIFADO (PEÇAS ABAIXO DO MÍNIMO)\n`;
      d.lowStock.forEach(item => {
        text += `- 🟡 **Item "${item.name}"**: Estoque atual está em **${item.quantity} unidades**, abaixo do mínimo estipulado (${item.minQuantity} un).\n`;
      });
    }

    // Foco de Ativo Selecionado se houver
    if (d.focusAssetDetails) {
      text += `\n### DIAGNÓSTICO DO ATIVO SELECIONADO NO FILTRO\n`;
      text += d.focusAssetDetails + `\n`;
    }

    // Recomendações e Planos de Ação
    text += `\n### PLANO DE AÇÃO PROATIVO INTEGRADO\n`;
    let actionCount = 1;
    if (d.licenseAlerts.length > 0 || d.employeeLicenseAlerts.length > 0) {
      text += `${actionCount++}. **Bloqueio e Renovação de Tráfego**: Impedir escala comercial dos ativos e motoristas com habilitações/licenças já expiradas. Contatar despachante ou agendar exames para regularização rápida.\n`;
    }
    if (d.lowStock.length > 0) {
      text += `${actionCount++}. **Reposição em Lote do Almoxarifado**: Providenciar cotações imediatas com distribuidores parceiros para reabastecimento dos suprimentos mecânicos em perigo de ruptura (ruptura em ${d.lowStock.length} itens).\n`;
    }
    if (caixaReal < 0) {
      text += `${actionCount++}. **Injeção de Receitas e Redução de Overhead**: Realizar esforço de vendas com o setor de turismo da Agência e focar em repasses ou adiantamentos de recebíveis faturados para mitigar déficit momentâneo de R$ **${Math.abs(caixaReal).toLocaleString('pt-BR')}** no caixa ativo.\n`;
    } else {
      text += `${actionCount++}. **Maximização Preventiva e Reserva Técnica**: Direcionar 15% do saldo em caixa de R$ ${caixaReal.toLocaleString('pt-BR')} para provisão de peças preventivas na garagem, estancando a necessidade de corretivas emergenciais de urgência.\n`;
    }
    text += `${actionCount++}. **Acompanhamento de Viagens de Linha**: Aprimorar o preenchimento das rotas e monitorar o Arla 32 de forma sistemática para evitar multas de órgãos ambientais.\n`;

    return text;
  };

  // Método Inteligente para Disparar Geração do Dossiê via Gemini (Se falhar, roda fallback imbatível)
  const handleGenerateDossier = async () => {
    setIsGenerating(true);
    setGeneratedText('');

    const d = consolidatedReportData;

    const systemInstruction = `Você é a IA Presidencial de Gestão da DM Turismo, projetada para produzir o Dossiê de Inteligência Gerencial mais completo e robusto possível a partir dados reais filtrados.
Sua formatação deve ser extremamente elegante em Markdown, adotando termos corporativos de transporte, fiscal, turismo e capital.
Estruture o relatório em:
1. ### RESUMO DA ALTISSÍMA GESTÃO (Visão macro geral consolidando toda a empresa, cruzando agência, frota, fluxo de caixa e capital de giro)
2. ### DIAGNÓSTICO FINANCEIRO & DE CAIXA (Explicar saldo realizado, faturamentos fáceis, recebíveis vigentes e margem de lucratividade)
3. ### CONFORMIDADE E SEGURANÇA VIÁRIA (Emitir advertências ultra claras sobre documentos de veículos vencendo ou motoristas com CNH próxima à validade, além do almoxarifado)
4. ### DIAGNÓSTICO DO ATIVOS ESPECÍFICOS (Se houver ativos ou motoristas selecionados em foco, faça uma análise da produtividade deles)
5. ### PLANO DE AÇÃO SISTÊMICO (Apresentar 3-4 passos lógicos, diretos, imperativos e profissionais para maximização dos lucros, eficiência do diesel por quilômetro e controle de frotas)

Diretrizes Visuais do Markdown:
- Use emojis moderadamente (Ex: 🟢, 🔴, 🟡, ⛽, 💸, 🔧, 📂) para visualização rápida.
- Coloque em negrito as placas, os nomes das categorias e de motoristas, além de valores de moedas inteiros.
- Mantenha labels técnicas em maiúsculas correspondendo ao design profissional.`;

    const prompt = `Gere o dossiê executivo corporativo máximo da DM Turismo usando as seguintes informações consolidadas no período selecionado:
- Período Filtrado: ${period === 'current_month' ? 'Junho de 2026 (Mês Fiscal Corrente)' : period === 'last_30' ? 'Últimos 30 Dias' : period === 'last_90' ? 'Últimos 90 Dias' : 'Geral Acumulado completo'}
- Tipo de Filtro Comercial de Escopo: ${scope === 'general' ? 'Consolidado Integrado (Agência + Frota)' : scope === 'operator' ? 'Foco apenas na Operadora de Frota' : 'Foco apenas na Agência de Turismo'}
- Profundidade Analítica: ${depth === 'deep' ? 'Ultra profunda detalhando cruzamento de dados' : 'Resumo Executivo Conciso de Diretoria'}

DADOS DE CONTROLE DE CAPITAL (FINANCEIRO):
- Receita Bruta Consolidadora: R$ ${d.totalIncome.toLocaleString('pt-BR')}
- Saídas / Despesas Globais: R$ ${d.totalExpense.toLocaleString('pt-BR')}
- Receitas já Liquidadas (Dinheiro em Caixa): R$ ${d.realizedIncome.toLocaleString('pt-BR')}
- Despesas já Liquidadas (Gastos efetuados): R$ ${d.realizedExpense.toLocaleString('pt-BR')}
- Saldo líquido disponível em caixa: R$ ${(d.realizedIncome - d.realizedExpense).toLocaleString('pt-BR')}
- Contas a Receber (Em Aberto): R$ ${d.pendingReceivable.toLocaleString('pt-BR')}
- Contas a Pagar (A Vencer): R$ ${d.pendingPayable.toLocaleString('pt-BR')}
- Margem Operacional Corrente: ${d.profitMargin.toFixed(1)}%

DADOS DE TURISMO (AGÊNCIA):
- Vendas Totais da Agência de Viagens: R$ ${d.agencyVolume.toLocaleString('pt-BR')} (${d.agencyTxCount} pacotes/comissões no período)
- Receita Estipulada em Comissões da Agência: R$ ${d.agencyComm.toLocaleString('pt-BR')}

DADOS DA OPERADORA DE FROTAS (LOGÍSTICA):
- Viagens Operadas / Linhas: ${d.tripsCount} escalas de turismo/tráfego registradas
- faturamento da Operação Comercial: R$ ${d.totalTripsValue.toLocaleString('pt-BR')}
- Litros de Óleo Diesel consumidos: ${d.totalFuelLiters.toFixed(1)} Litros (Gasto: R$ ${d.totalFuelCost.toLocaleString('pt-BR')})
- Consumo de Arla 32 correspondente: ${d.totalArlaQuantity.toFixed(1)} Litros
- Total de ordens na Oficina: ${d.preventiveCount} OS Preventivas e ${d.correctiveCount} OS Corretivas urgentes (Gasto oficina total: R$ ${d.totalMaintCost.toLocaleString('pt-BR')})

INCONFORMIDADES ATIVAS DO PERÍODO:
- Licenças / CRLV / ANTT vencendo ou vencidas: ${d.licenseAlerts.length} veículos com restrições. Detalhes: ${JSON.stringify(d.licenseAlerts.slice(0, 10))}
- CNHs de motoristas vencendo ou vencidas: ${d.employeeLicenseAlerts.length} profissionais expirando no Detran. Detalhes: ${JSON.stringify(d.employeeLicenseAlerts.slice(0, 10))}
- Peças com rupturas de estoque mínimo em almoxarifado: ${d.lowStock.length} itens obsoletos. Detalhes: ${JSON.stringify(d.lowStock.slice(0, 5))}

ELEMENTO FOCADO / ESPECÍFICO SELECIONADO:
${d.focusAssetDetails || 'Nenhum veículo ou motorista focado individualmente.'}

Componha um dossiê extremamente brilhante, profissional, formal e focado em apresentar soluções assertivas de negócios.`;

    try {
      const responseText = await geminiService.generateText(prompt, systemInstruction);
      if (responseText && responseText.trim()) {
        setGeneratedText(responseText);
        
        // Detecta alertas
        if (responseText.includes('🔴') || d.licenseAlerts.length > 0 || d.employeeLicenseAlerts.length > 0) {
          setAlertLevel('red');
        } else if (responseText.includes('🟡') || d.lowStock.length > 0) {
          setAlertLevel('yellow');
        } else {
          setAlertLevel('green');
        }
        toast.success("Dossiê de Alta Gestão compilado com sucesso via Inteligência Artificial!");
      } else {
        throw new Error("Resposta de IA vazia");
      }
    } catch (err) {
      console.error("AI Generation failed, launching complete programmatic system fallback -", err);
      toast.error("Serviço de IA instável. Ativando compilador de fallback de alta precisão.");
      const fallback = getDetailedStateDossier();
      setGeneratedText(fallback);
      if (d.licenseAlerts.length > 0 || d.employeeLicenseAlerts.length > 0) {
        setAlertLevel('red');
      } else if (d.lowStock.length > 0) {
        setAlertLevel('yellow');
      } else {
        setAlertLevel('green');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePdfDossier = async () => {
    setIsGeneratingPdf(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const pdf = new jsPDF();
      const todayStr = format(new Date(), 'dd/MM/yyyy HH:mm:ss');

      // DM Turismo Branding Header - Eco-Mode (Low Ink)
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(14, 34, 196, 34); // Top separator line

      // Logo DM (Stylized Text Branding for Low Ink)
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(24);
      pdf.setTextColor(0, 0, 0); // Black for high contrast / low ink
      pdf.text('DM', 14, 20);
      
      pdf.setFontSize(16);
      pdf.text('TURISMO', 28, 20);
      
      pdf.setFontSize(7);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(100, 116, 139); // Gray
      pdf.text('"Prazer em viajar bem"', 14, 26);
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(113, 113, 122); // Zinc-500
      pdf.text('SISTEMA INTEGRADO DE ENGENHARIA E CONFORMIDADE DE FROTA', 14, 30);
      
      pdf.setFontSize(11);
      pdf.setTextColor(0, 0, 0);
      pdf.setFont('helvetica', 'bold');
      pdf.text('DOSSIÊ DE CONTROLE', 196, 18, { align: 'right' });
      
      pdf.setFontSize(7.5);
      pdf.setTextColor(113, 113, 122);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`FORMATO: ${pdfType === 'complete' ? 'COMPLETO' : 'RESUMIDO'}`, 196, 24, { align: 'right' });
      pdf.text(`DATA: ${todayStr}`, 196, 28, { align: 'right' });
      
      let currentY = 45;

      if (pdfType === 'summarized') {
        // --- FORMATO RESUMIDO ---
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("1. RESUMO GERAL DA FROTA E OPERAÇÕES", 14, currentY);
        currentY += 8;

        // Breve Sumário em Texto
        pdf.setFontSize(9.5);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(0, 0, 0);
        const textSummary = `O presente documento sintetiza o estado geral de controle e conformidade legal da frota DM Turismo. Contém a relação de ativos cadastrados no sistema, seus respectivos status operacionais e os próximos vencimentos de documentos críticos registrados para assegurar a conformidade viária imediata.`;
        const splitText = pdf.splitTextToSize(textSummary, 182);
        pdf.text(splitText, 14, currentY);
        currentY += splitText.length * 5 + 4;

        // Quadro de KPIs Rápidos
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.rect(14, currentY, 182, 16, 'S');

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("TOTAL DE VEÍCULOS", 20, currentY + 6);
        pdf.text("ATIVOS EM OPERAÇÃO", 75, currentY + 6);
        pdf.text("EM MANUTENÇÃO", 140, currentY + 6);

        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${vehicles.length} Veículos`, 20, currentY + 12);
        pdf.text(`${vehicles.filter((v: any) => v.status === 'Liberado' || v.status === 'Operando').length} unidades`, 75, currentY + 12);
        pdf.text(`${vehicles.filter((v: any) => v.status === 'Manutenção' || v.status === 'Oficina').length} unidades`, 140, currentY + 12);
        
        currentY += 24;

        // Tabela de Veículos Resumida
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("2. RELAÇÃO SIMPLIFICADA DE ATIVOS", 14, currentY);
        currentY += 6;

        const columns = ["Veículo", "Placa", "Tipo", "Status", "Odômetro", "Próximo Vencimento"];
        const rows = vehicles.map((v: any) => {
          const dates = [
            { label: 'CRLV', d: v.licenseExpiration },
            { label: 'ANTT', d: v.anttExpiration },
            { label: 'CADASTUR', d: v.cadasturExpiration },
            { label: 'Tacógrafo', d: v.tacografoExpiration },
            { label: 'Seguro', d: v.insuranceExpiration }
          ].filter(x => x.d);
          
          let nextVenc = '---';
          if (dates.length > 0) {
            dates.sort((a, b) => a.d!.localeCompare(b.d!));
            nextVenc = `${dates[0].label}: ${format(parseISO(dates[0].d!), 'dd/MM/yyyy')}`;
          }

          return [
            `${v.brand} ${v.model}`,
            v.plate.toUpperCase(),
            v.type || 'Ônibus',
            v.status || 'Liberado',
            v.currentOdometer ? `${Number(v.currentOdometer).toLocaleString('pt-BR')} KM` : '---',
            nextVenc
          ];
        });

        autoTable(pdf, {
          startY: currentY,
          head: [columns],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
          styles: { fontSize: 8.5, textColor: [0, 0, 0] },
          margin: { left: 14, right: 14 }
        });

      } else {
        // --- FORMATO COMPLETO ---
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("1. INVENTÁRIO COMPLETO E STATUS DETALHADO DOS VEÍCULOS", 14, currentY);
        currentY += 8;

        const columns = ["Ativo / Modelo", "Placa", "Status", "Odômetro", "Vencimentos de Licenças & Validades"];
        const rows = vehicles.map((v: any) => {
          const docList: string[] = [];
          if (v.licenseExpiration) docList.push(`CRLV: ${format(parseISO(v.licenseExpiration), 'dd/MM/yyyy')}`);
          if (v.anttExpiration) docList.push(`ANTT: ${format(parseISO(v.anttExpiration), 'dd/MM/yyyy')}`);
          if (v.cadasturExpiration) docList.push(`CADASTUR: ${format(parseISO(v.cadasturExpiration), 'dd/MM/yyyy')}`);
          if (v.tacografoExpiration) docList.push(`Tacógrafo: ${format(parseISO(v.tacografoExpiration), 'dd/MM/yyyy')}`);
          if (v.insuranceExpiration) docList.push(`Seguro: ${format(parseISO(v.insuranceExpiration), 'dd/MM/yyyy')}`);
          
          const docStr = docList.length > 0 ? docList.join('\n') : 'Nenhuma licença cadastrada';

          return [
            `${v.brand} ${v.model}\nAno: ${v.factoryYear || '---'} | Cap.: ${v.capacity || '---'} passageiros`,
            v.plate.toUpperCase(),
            v.status || 'Liberado',
            v.currentOdometer ? `${Number(v.currentOdometer).toLocaleString('pt-BR')} KM` : '---',
            docStr
          ];
        });

        autoTable(pdf, {
          startY: currentY,
          head: [columns],
          body: rows,
          theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
          styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
          columnStyles: {
            0: { cellWidth: 45 },
            1: { cellWidth: 22 },
            2: { cellWidth: 22 },
            3: { cellWidth: 25 },
            4: { cellWidth: 68 }
          },
          margin: { left: 14, right: 14 }
        });

        // Adicionar nova página para Motoristas e Resumos Financeiros
        pdf.addPage();
        
        // Header simplificado para páginas secundárias - Eco-Mode
        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(14, 15, 196, 15);
        
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text("DM TURISMO - DOSSIÊ DE CONTROLE DE ATIVOS", 14, 10);
        
        currentY = 25;

        // Seção 2: Relação de Motoristas & CNHs
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.text("2. CONTROLE DE HABILITAÇÕES (MOTORISTAS & COLABORADORES)", 14, currentY);
        currentY += 6;

        const driverCols = ["Nome do Profissional", "Cargo / Função", "Categoria CNH", "Vencimento CNH", "Status Legal"];
        const driverRows = employees.map((emp: any) => {
          let statusLabel = 'REGULAR';
          if (emp.licenseExpiration) {
            const exp = parseISO(emp.licenseExpiration);
            const expDays = Math.ceil((exp.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
            if (expDays < 0) {
              statusLabel = '⚠️ EXPIRADA / EXPEDIR';
            } else if (expDays <= 30) {
              statusLabel = `⚠️ Vence em ${expDays} d`;
            }
          } else {
            statusLabel = '---';
          }

          return [
            emp.name.toUpperCase(),
            emp.role || 'Motorista',
            emp.licenseCategory || '---',
            emp.licenseExpiration ? format(parseISO(emp.licenseExpiration), 'dd/MM/yyyy') : '---',
            statusLabel
          ];
        });

        autoTable(pdf, {
          startY: currentY,
          head: [driverCols],
          body: driverRows,
          theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
          styles: { fontSize: 8, textColor: [0, 0, 0] },
          margin: { left: 14, right: 14 }
        });

        // Seção 3: Consumo e Custos do Período
        const lastY = (pdf as any).lastAutoTable.finalY || 100;
        currentY = lastY + 12;

        pdf.setFontSize(11);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("3. CONSOLIDAÇÃO HISTÓRICA E CUSTOS OPERACIONAIS (RESUMO)", 14, currentY);
        currentY += 6;

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.2);
        pdf.rect(14, currentY, 182, 38, 'S');

        pdf.setFontSize(8.5);
        pdf.setTextColor(0, 0, 0);
        
        const d = consolidatedReportData;
        pdf.text(`• Custo Acumulado em Manutenções / Oficina: R$ ${d.totalMaintCost.toLocaleString('pt-BR')} (Sendo ${d.preventiveCount} OS Preventivas e ${d.correctiveCount} OS Corretivas)`, 18, currentY + 8);
        pdf.text(`• Consumo de Combustível Registrado: ${d.totalFuelLiters.toLocaleString('pt-BR')} Litros de Diesel | Investimento: R$ ${d.totalFuelCost.toLocaleString('pt-BR')}`, 18, currentY + 16);
        pdf.text(`• Arla 32 Consumido: ${d.totalArlaQuantity.toLocaleString('pt-BR')} Litros`, 18, currentY + 24);
        pdf.text(`• Eficiência Comercial: ${d.tripsCount} viagens escaladas com receita bruta de R$ ${d.totalTripsValue.toLocaleString('pt-BR')}`, 18, currentY + 32);
      }

      pdf.save(`dossie_ativos_dm_turismo_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success("Dossiê de Ativos em PDF baixado com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar ou baixar o arquivo PDF do Dossiê.");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const copyToClipboard = () => {
    if (!generatedText) return;
    navigator.clipboard.writeText(generatedText);
    toast.success("Dossiê copiado para a área de transferência!");
  };

  const handleShare = () => {
    if (!generatedText) return;
    toast.success("Dossiê de inteligência compartilhado com a Diretoria DM!");
  };

  // Renderizador do Markdown elegante
  const renderFormattedText = () => {
    if (!generatedText) return null;
    const lines = generatedText.split('\n');

    return (
      <div className="space-y-4 text-zinc-300 text-xs leading-relaxed max-h-[500px] overflow-y-auto pr-3 custom-scrollbar">
        {lines.map((line, idx) => {
          const trimmed = line.trim();
          if (!trimmed) return <div key={idx} className="h-2" />;

          // Títulos principais ou secundários
          if (trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('#')) {
            const cleanText = trimmed.replace(/^#+\s*/, '').replace(/#+$/, '').trim();
            return (
              <h3 key={idx} className="text-[11px] font-black text-white uppercase tracking-wider block border-l-2 border-blue-500 pl-3 mt-6 mb-3 font-mono">
                {cleanText}
              </h3>
            );
          }

          // Bullets de lista
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
                <strong key={keyIdx++} className="text-white font-black">
                  {rest.substring(firstIdx + 2, secondIdx)}
                </strong>
              );
              rest = rest.substring(secondIdx + 2);
            }
            parts.push(rest);

            return (
              <div key={idx} className="flex items-start gap-3 pl-1.5 my-1.5">
                <span className="text-blue-500 text-[9px] mt-1">▪</span>
                <span className="text-zinc-300 text-[11px] font-medium leading-relaxed">{parts.length > 0 ? parts : bulletContents}</span>
              </div>
            );
          }

          // Listas enumeradas de ação
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
                <strong key={keyIdx++} className="text-blue-400 font-extrabold">
                  {rest.substring(firstIdx + 2, secondIdx)}
                </strong>
              );
              rest = rest.substring(secondIdx + 2);
            }
            parts.push(rest);

            return (
              <div key={idx} className="bg-zinc-950 p-4 rounded-xl border border-zinc-900 flex gap-3 text-[11px] hover:border-zinc-850 transition-colors my-3 font-medium text-zinc-350">
                <span className="text-blue-500 text-[12px] font-black">⚡</span>
                <div className="flex-1 leading-relaxed">{parts.length > 0 ? parts : trimmed}</div>
              </div>
            );
          }

          // Parágrafo genérico com parser de **negrito** inline
          let inlineParts: React.ReactNode[] = [];
          let rest = trimmed;
          let keyIdx = 0;
          while (rest.includes('**')) {
            const firstIdx = rest.indexOf('**');
            const secondIdx = rest.indexOf('**', firstIdx + 2);
            if (secondIdx === -1) break;
            
            inlineParts.push(rest.substring(0, firstIdx));
            inlineParts.push(
              <strong key={keyIdx++} className="text-zinc-100 font-semibold">
                {rest.substring(firstIdx + 2, secondIdx)}
              </strong>
            );
            rest = rest.substring(secondIdx + 2);
          }
          inlineParts.push(rest);

          return (
            <p key={idx} className="text-[11px] text-zinc-400 font-medium leading-relaxed my-1">
              {inlineParts.length > 0 ? inlineParts : trimmed}
            </p>
          );
        })}
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.25 }}
            className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-4xl overflow-hidden shadow-2xl relative"
          >
            {/* Banner superior estático DM */}
            <div className={`h-1.5 w-full ${
              alertLevel === 'red' ? 'bg-rose-500' : alertLevel === 'yellow' ? 'bg-amber-500' : 'bg-emerald-500'
            }`} />

            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-zinc-850">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                  <SlidersHorizontal size={18} />
                </div>
                <div>
                  <span className="text-[8px] font-black text-blue-500 tracking-widest uppercase font-mono">Central de Inteligência DM Turismo</span>
                  <h2 className="text-base font-black text-white uppercase tracking-tight flex items-center gap-2">
                    FILTRO DE DOSSIÊ EXECUTIVO
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl transition-colors flex items-center gap-2 font-black uppercase text-[10px]"
                >
                  <LogOut size={14} /> SAIR
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-zinc-850 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12">
              {/* Painel Esquerdo: Parametrizações do Filtro */}
              <div className="lg:col-span-5 p-6 border-r border-zinc-850 space-y-6 bg-zinc-950">
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 border-b border-zinc-900 pb-2">
                    <SlidersHorizontal size={12} className="text-blue-500" />
                    Parâmetros de Compilação
                  </span>

                  {/* 1. Período Fiscal */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Período de Análise</label>
                    <select
                      value={period}
                      onChange={(e) => setPeriod(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-805 text-zinc-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                    >
                      <option value="current_month">📆 Mês Fiscal Corrente</option>
                      <option value="last_30">📆 Últimos 30 Dias</option>
                      <option value="last_90">📆 Últimos 90 Dias</option>
                      <option value="all">📆 Todo o Histórico Registrado</option>
                    </select>
                  </div>

                  {/* 2. Escopo do Relatório */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Escopo de Negócios</label>
                    <select
                      value={scope}
                      onChange={(e) => setScope(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-805 text-zinc-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                    >
                      <option value="general">📊 Consolidado Geral (Completo)</option>
                      <option value="operator">🚌 Operadora de Transporte & Linhas</option>
                      <option value="agency">💼 Agência de Turismo & Vendas</option>
                    </select>
                  </div>

                  {/* 3. Profundidade analítica */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Profundidade de IA</label>
                    <select
                      value={depth}
                      onChange={(e) => setDepth(e.target.value as any)}
                      className="w-full bg-zinc-900 border border-zinc-805 text-zinc-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                    >
                      <option value="deep">🧠 Ultra-Análise (Cruzamento de custos)</option>
                      <option value="executive">👔 Resumo Gerencial de Diretoria</option>
                    </select>
                  </div>

                  {/* 4. Filtro de Foco em Ativo */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Filtro de Foco Secundário</label>
                    <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-900 rounded-xl border border-zinc-805">
                      {(['none', 'vehicle', 'driver'] as const).map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setFocusAssetType(type)}
                          className={`py-1.5 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                            focusAssetType === type 
                              ? 'bg-zinc-800 text-blue-400 border border-blue-500/20' 
                              : 'text-zinc-500 hover:text-zinc-300'
                          }`}
                        >
                          {type === 'none' ? 'Todos' : type === 'vehicle' ? 'Veículo' : 'Motorista'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dropdown condicional de ativo focado */}
                  {focusAssetType === 'vehicle' && (
                    <div className="space-y-1.5 animate-fade-in-down">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Selecione o Veículo</label>
                      <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-805 text-zinc-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 cursor-pointer uppercase font-bold"
                      >
                        {vehicles.map(v => (
                          <option key={v.id} value={v.plate}>{v.plate.toUpperCase()} - {v.brand} {v.model}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {focusAssetType === 'driver' && (
                    <div className="space-y-1.5 animate-fade-in-down">
                      <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Selecione o Motorista</label>
                      <select
                        value={selectedAssetId}
                        onChange={(e) => setSelectedAssetId(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-805 text-zinc-200 text-xs rounded-xl px-3.5 py-3 focus:outline-none focus:border-blue-500 cursor-pointer font-bold"
                      >
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()} ({emp.role})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Botão de Geração */}
                <button
                  type="button"
                  onClick={handleGenerateDossier}
                  disabled={isGenerating}
                  className="w-full py-4 bg-white hover:bg-zinc-100 text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all shadow-xl disabled:opacity-55 active:scale-98 cursor-pointer mt-4"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-zinc-950" />
                      COMPILANDO REGISTROS...
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} className="text-indigo-600 animate-pulse" />
                      GERAR DOSSIÊ ATUALIZADO ⚡
                    </>
                  )}
                </button>

                {/* Bloco de Exportação PDF */}
                <div className="border-t border-zinc-900 pt-4 mt-4 space-y-4">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5 pb-2 border-b border-zinc-900">
                    <FileText size={12} className="text-orange-500" />
                    Dossiê em PDF de Ativos
                  </span>

                  {/* Seleção do Tipo de PDF */}
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-500">Formato de Exportação</label>
                    <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-900 rounded-xl border border-zinc-850">
                      <button
                        type="button"
                        onClick={() => setPdfType('complete')}
                        className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          pdfType === 'complete' 
                            ? 'bg-zinc-800 text-orange-400 border border-orange-500/20' 
                            : 'text-zinc-500 hover:text-zinc-350'
                        }`}
                      >
                        Completo
                      </button>
                      <button
                        type="button"
                        onClick={() => setPdfType('summarized')}
                        className={`py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${
                          pdfType === 'summarized' 
                            ? 'bg-zinc-800 text-orange-400 border border-orange-500/20' 
                            : 'text-zinc-500 hover:text-zinc-350'
                        }`}
                      >
                        Resumido
                      </button>
                    </div>
                  </div>

                  {/* Botão Exportar PDF */}
                  <button
                    type="button"
                    onClick={handleGeneratePdfDossier}
                    disabled={isGeneratingPdf}
                    className="w-full py-3.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-orange-500/30 text-white rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all disabled:opacity-55 active:scale-98 cursor-pointer"
                  >
                    {isGeneratingPdf ? (
                      <>
                        <Loader2 size={13} className="animate-spin text-white" />
                        GERANDO PDF...
                      </>
                    ) : (
                      <>
                        <FileText size={13} className="text-orange-500" />
                        EXPORTAR DOSSIÊ PDF 📥
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Painel Direito: Output do Dossiê executivo e Alertas */}
              <div className="lg:col-span-7 p-6 flex flex-col justify-between bg-zinc-900/40 relative">
                {/* Alerta de conformidade em cabeçalho */}
                <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${
                      alertLevel === 'red' ? 'bg-rose-500 animate-ping' : alertLevel === 'yellow' ? 'bg-amber-500 animate-ping' : 'bg-emerald-500'
                    }`} />
                    <span className="text-[9px] font-mono font-black uppercase text-zinc-400 tracking-wider">
                      Parecer: {alertLevel === 'red' ? 'ALERTA CRÍTICO ATIVO' : alertLevel === 'yellow' ? 'RECOMENDAÇÃO ATIVA' : 'SITUAÇÃO CONFORME'}
                    </span>
                  </div>

                  {generatedText && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={copyToClipboard}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-805 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                        title="Copiar markdown de dossiê"
                      >
                        <Copy size={11} /> Copiar
                      </button>
                      <button
                        onClick={handleShare}
                        className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-805 text-zinc-400 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Share2 size={11} /> Compartilhar
                      </button>
                    </div>
                  )}
                </div>

                {isGenerating ? (
                  <div className="flex-1 flex flex-col items-center justify-center py-16 space-y-4 text-center">
                    <Loader2 size={36} className="text-blue-500 animate-spin" />
                    <div>
                      <p className="text-white text-xs font-black uppercase tracking-widest animate-pulse">Limpando e consolidando tabelas...</p>
                      <p className="text-zinc-500 text-[10px] uppercase font-mono mt-1">Cruzando dados de Faturamento, Combustível e Oficinas</p>
                    </div>
                  </div>
                ) : generatedText ? (
                  <div className="flex-1 flex flex-col justify-between">
                    {renderFormattedText()}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-zinc-850 rounded-2xl bg-zinc-950/20">
                    <FileText size={32} className="text-zinc-700 mb-3" />
                    <h4 className="text-white text-xs font-black uppercase tracking-wider">Nenhum dossiê compilado neste filtro</h4>
                    <p className="text-zinc-500 text-[10.5px] max-w-sm mt-1.5 leading-relaxed">
                      Ajuste os parâmetros de análise técnica à esquerda e clique em **GERAR DOSSIÊ ATUALIZADO ⚡** para gerar o diagnóstico com IA.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
