import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ComposedChart,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Fuel, 
  Wrench, 
  Disc, 
  Box, 
  BarChart3, 
  Activity,
  Calendar,
  Layers,
  ChevronDown,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

interface GabineteComparativeChartsProps {
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

type ChartCategory = 'financial-intelligence' | 'cashflow' | 'fuel-vs-cost' | 'vehicle-budget' | 'tire-wear' | 'stock-critical';

export const GabineteComparativeCharts: React.FC<GabineteComparativeChartsProps> = ({
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
  const [selectedCategory, setSelectedCategory] = useState<ChartCategory>('financial-intelligence');
  const [indicatorPeriod, setIndicatorPeriod] = useState<'mensal' | 'anual'>('anual');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Filter Helper
  const filterByPeriod = useMemo(() => {
    return (item: any): boolean => {
      const dateStr = item.timestamp || item.completedAt || item.startDate || item.dueDate || item.date || item.createdAt || item.dateTime;
      if (!dateStr) return true;
      try {
        const dateObj = new Date(dateStr.substring(0, 10));
        if (indicatorPeriod === 'mensal') {
          return dateObj.getMonth() === currentMonth && dateObj.getFullYear() === currentYear;
        } else {
          return dateObj.getFullYear() === currentYear;
        }
      } catch {
        return true;
      }
    };
  }, [indicatorPeriod, currentMonth, currentYear]);

  // ==========================================
  // COMPARISON 1: CASHFLOW (REVENUE VS EXPENSE)
  // ==========================================
  const cashFlowData = useMemo(() => {
    const monthlyStats: Record<string, { monthNum: number; Month: string; Receitas: number; Despesas: number }> = {};
    const monthsNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    
    // Seed current year months
    monthsNames.forEach((name, idx) => {
      monthlyStats[name] = { monthNum: idx, Month: name, Receitas: 0, Despesas: 0 };
    });

    // Feed general transactions
    finance.forEach(f => {
      const dateStr = f.dueDate || f.createdAt;
      if (!dateStr) return;
      try {
        const dateObj = new Date(dateStr.substring(0, 10));
        if (dateObj.getFullYear() === currentYear) {
          const monthName = monthsNames[dateObj.getMonth()];
          if (f.type === 'receivable' || f.type === 'income' || f.type === 'revenue') {
            monthlyStats[monthName].Receitas += Number(f.amount || 0);
          } else {
            monthlyStats[monthName].Despesas += Number(f.amount || 0);
          }
        }
      } catch {}
    });

    // Feed charter billings
    charterClientTrips.forEach(c => {
      const dateStr = c.dateTime;
      if (!dateStr) return;
      try {
        const dateObj = new Date(dateStr.substring(0, 10));
        if (dateObj.getFullYear() === currentYear) {
          const monthName = monthsNames[dateObj.getMonth()];
          monthlyStats[monthName].Receitas += Number(c.value || 0);
        }
      } catch {}
    });

    return Object.values(monthlyStats).sort((a, b) => a.monthNum - b.monthNum);
  }, [finance, charterClientTrips, currentYear]);

  // ==========================================
  // COMPARISON 2: FUEL VOLUME VS ACTUAL COST
  // ==========================================
  const fuelVolumeVsCostData = useMemo(() => {
    const monthsNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const stats: Record<string, { monthNum: number; Month: string; Litros: number; Custo: number }> = {};
    
    monthsNames.forEach((name, idx) => {
      stats[name] = { monthNum: idx, Month: name, Litros: 0, Custo: 0 };
    });

    fuelLogs.forEach(f => {
      if (!f.timestamp) return;
      try {
        const dateObj = new Date(f.timestamp.substring(0, 10));
        if (dateObj.getFullYear() === currentYear) {
          const mName = monthsNames[dateObj.getMonth()];
          stats[mName].Litros += Number(f.quantity || 0);
          stats[mName].Custo += Number(f.cost || 0);
        }
      } catch {}
    });

    return Object.values(stats).sort((a, b) => a.monthNum - b.monthNum);
  }, [fuelLogs, currentYear]);

  // ==========================================
  // COMPARISON 3: VEHICLE TOTAL EXPENDITURES (FUEL VS REPAIRS)
  // ==========================================
  const vehicleCostComparison = useMemo(() => {
    const statsMap: Record<string, { Combustivel: number; Oficina: number; plate: string }> = {};

    vehicles.forEach(v => {
      statsMap[v.id] = { Combustivel: 0, Oficina: 0, plate: v.plate || 'N/A' };
    });

    // Fuel expenses
    fuelLogs.filter(filterByPeriod).forEach(f => {
      if (statsMap[f.vehicleId]) {
        statsMap[f.vehicleId].Combustivel += Number(f.cost || 0);
      }
    });

    // Maintenance expenses
    maintenance.filter(filterByPeriod).forEach(m => {
      if (statsMap[m.vehicleId]) {
        statsMap[m.vehicleId].Oficina += Number(m.cost || 0);
      }
    });

    return Object.values(statsMap)
      .filter(item => item.Combustivel > 0 || item.Oficina > 0)
      .map(item => ({
        name: item.plate.toUpperCase(),
        Combustivel: item.Combustivel,
        Oficina: item.Oficina,
        Total: item.Combustivel + item.Oficina
      }))
      .sort((a, b) => b.Total - a.Total)
      .slice(0, 8); // Top 8 highest expenditures
  }, [vehicles, fuelLogs, maintenance, filterByPeriod]);

  // ==========================================
  // COMPARISON 4: TIRE WEAR AND TREAD DEPTH CHANNELS
  // ==========================================
  const tireWearGroups = useMemo(() => {
    let careca = 0; // <= 1.6mm
    let atencao = 0; // 1.7mm - 3.0mm
    let seguro = 0; // > 3.0mm

    tireDossiers.forEach(t => {
      const depth = Number(t.grooveDepth || 0);
      if (depth <= 1.6) careca++;
      else if (depth <= 3.0) atencao++;
      else seguro++;
    });

    return [
      { name: 'Sulco Crítico (≤ 1.6mm)', Pneus: careca, fill: '#ef4444' },
      { name: 'Atenção (1.7 - 3.0mm)', Pneus: atencao, fill: '#f59e0b' },
      { name: 'Seguro (> 3.0mm)', Pneus: seguro, fill: '#10b981' },
    ];
  }, [tireDossiers]);

  // ==========================================
  // COMPARISON 5: STOCK LEVELS (CURRENT VS MINIMUM QUANTITY)
  // ==========================================
  const stockLevelsComparison = useMemo(() => {
    return stockItems
      .map(item => ({
        name: item.name ? (item.name.length > 15 ? item.name.substring(0, 15) + '...' : item.name) : 'Sem Nome',
        Estoque: Number(item.quantity || 0),
        Minimo: Number(item.minQuantity || 0)
      }))
      .sort((a, b) => a.Estoque - b.Estoque)
      .slice(0, 10); // Show up to 10 products
  }, [stockItems]);

  // ==========================================
  // COMPARISON 6: COSTS BY CATEGORY (COMBUSTÍVEL, MANUTENÇÃO, PEÇAS)
  // ==========================================
  const costsByCategoryData = useMemo(() => {
    let combustivelTotal = 0;
    let manutencaoTotal = 0;
    let pecasTotal = 0;
    let outrosTotal = 0;

    finance.forEach(f => {
      if (f.type === 'payable' || f.type === 'expense') {
        const amount = Number(f.amount || 0);
        const cat = (f.category || '').toLowerCase();
        const desc = (f.description || '').toLowerCase();
        const refType = (f.refType || '').toLowerCase();

        if (cat.includes('combust') || refType === 'fuel' || desc.includes('abastecimento')) {
          combustivelTotal += amount;
        } else if (cat.includes('manuten') || cat.includes('oficina') || refType === 'maintenance' || desc.includes('manutenção') || desc.includes('reparo')) {
          manutencaoTotal += amount;
        } else if (cat.includes('peça') || cat.includes('peca') || cat.includes('estoque') || desc.includes('peça') || desc.includes('peca')) {
          pecasTotal += amount;
        } else {
          outrosTotal += amount;
        }
      }
    });

    const data = [
      { name: 'Combustível', value: combustivelTotal, fill: '#1d4ed8' }, // Deep Blue matching DM Turismo theme
      { name: 'Manutenção', value: manutencaoTotal, fill: '#b91c1c' }, // Deep Red
      { name: 'Peças / Estoque', value: pecasTotal, fill: '#f59e0b' }, // Amber
      { name: 'Outros Custos', value: outrosTotal, fill: '#52525b' } // Zinc
    ];

    return data.filter(d => d.value > 0);
  }, [finance]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* FILTER PANEL AND TABS */}
      <div className="bg-zinc-900 border border-zinc-850 p-5 rounded-3xl flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
            <BarChart3 className="text-blue-500" size={16} /> Painel de Análises Comparativas
          </h3>
          <p className="text-[10px] text-zinc-500 mt-1 uppercase tracking-wider font-semibold">
            Inspeção cruzada e cruzamentos de informações entre todas as ferramentas da DM Turismo
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Chart Period Selector */}
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-850 font-mono">
            <button 
              onClick={() => setIndicatorPeriod('mensal')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", 
                indicatorPeriod === 'mensal' ? 'bg-zinc-800 text-white' : 'text-zinc-505 hover:text-zinc-300'
              )}
            >
              Filtro Mensal
            </button>
            <button 
              onClick={() => setIndicatorPeriod('anual')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", 
                indicatorPeriod === 'anual' ? 'bg-zinc-800 text-white' : 'text-zinc-505 hover:text-zinc-300'
              )}
            >
              Filtro Anual
            </button>
          </div>
        </div>
      </div>

      {/* COMPARATIVE METRIC NAVIGATION TABS */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        <button
          onClick={() => setSelectedCategory('financial-intelligence')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'financial-intelligence' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-financial-intelligence"
        >
          <TrendingUp size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Faturamento & Custos</span>
        </button>

        <button
          onClick={() => setSelectedCategory('cashflow')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'cashflow' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-cashflow"
        >
          <DollarSign size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Fluxo de Caixa</span>
        </button>

        <button
          onClick={() => setSelectedCategory('fuel-vs-cost')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'fuel-vs-cost' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-fuel"
        >
          <Fuel size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Diesel Vol vs Custo</span>
        </button>

        <button
          onClick={() => setSelectedCategory('vehicle-budget')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'vehicle-budget' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-budget"
        >
          <Wrench size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Combustível vs Oficina</span>
        </button>

        <button
          onClick={() => setSelectedCategory('tire-wear')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'tire-wear' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-tires"
        >
          <Disc size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Desgaste Pneus</span>
        </button>

        <button
          onClick={() => setSelectedCategory('stock-critical')}
          className={cn(
            "p-3 rounded-xl border text-center transition-all flex flex-col items-center gap-1.5 cursor-pointer",
            selectedCategory === 'stock-critical' ? "bg-white border-white text-zinc-950 font-black shadow-lg" : "bg-zinc-900 border-zinc-850 text-zinc-400 hover:text-white"
          )}
          id="tab-comp-stock"
        >
          <Box size={14} />
          <span className="text-[9px] uppercase tracking-wider font-bold">Estoque vs Mínimo</span>
        </button>
      </div>

      {/* RENDER SELECTED COMPARATIVE CHART BOARD */}
      <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl space-y-6">
        
        {/* CHART META-EXPLANATION BANNER */}
        <div className="flex items-start gap-3 bg-zinc-950 p-4 rounded-2xl border border-zinc-850">
          <Info size={16} className="text-blue-450 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h5 className="text-[10px] font-black uppercase text-white tracking-wider">
              {selectedCategory === 'financial-intelligence' && "Análise Avançada de Faturamento & Distribuição de Custos por Categoria"}
              {selectedCategory === 'cashflow' && "DRE Comparativo Anual de Receitas vs Despesas"}
              {selectedCategory === 'fuel-vs-cost' && "Gráfico de Litros de Diesel Consumidos vs Custo Financeiro"}
              {selectedCategory === 'vehicle-budget' && "Comparativo de Custo Total de Despesas (Combustível vs Oficina) por Veículo"}
              {selectedCategory === 'tire-wear' && "Auditoria de Distribuição Física e Desgaste Técnico de Sulcos"}
              {selectedCategory === 'stock-critical' && "Diferença do Estoque Físico contra Limites Mínimos Recomendados"}
            </h5>
            <p className="text-[10px] text-zinc-400 leading-relaxed uppercase tracking-wide">
              {selectedCategory === 'financial-intelligence' && "Evolução do faturamento mensal consolidado em gráfico de linhas e distribuição de despesas por categoria de custo buscadas diretamente das transações financeiras."}
              {selectedCategory === 'cashflow' && "Acompanhe de forma visual as entradas líquidas contra despesas operacionais consolidadas. Ideal para auditar margens de lucro."}
              {selectedCategory === 'fuel-vs-cost' && "Monitora flutuações e picos de preços no preço do combustível, relacionando litros gastos à despesa orçamentária do período."}
              {selectedCategory === 'vehicle-budget' && "Identifica os veículos da frota que mais exigem custos mensais de abastecimento ou manutenção na oficina."}
              {selectedCategory === 'tire-wear' && "Classificação técnica de sulcos para substituição imediata, recapagem programada ou tráfego seguro nas rodovias."}
              {selectedCategory === 'stock-critical' && "Mostra se as peças de reposição rápidas no almoxarifado estão próximas do limite de ruptura física."}
            </p>
          </div>
        </div>

        {/* ACTIVE CHART CONTAINER */}
        <div className={cn(selectedCategory === 'financial-intelligence' ? "w-full" : "h-96 w-full")}>
          {selectedCategory === 'financial-intelligence' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Line Chart */}
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-850 flex flex-col">
                <h4 className="text-xs font-black uppercase text-white tracking-widest mb-4 flex items-center gap-2">
                  <TrendingUp size={14} className="text-emerald-500" /> Evolução do Faturamento Mensal
                </h4>
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                      <XAxis dataKey="Month" stroke="#71717a" fontSize={10} fontStyle="bold" />
                      <YAxis stroke="#71717a" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                        formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Faturamento']}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                      <Line type="monotone" dataKey="Receitas" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} name="Faturamento (R$)" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Pie Chart */}
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-850 flex flex-col">
                <h4 className="text-xs font-black uppercase text-white tracking-widest mb-4 flex items-center gap-2">
                  <Activity size={14} className="text-red-500" /> Distribuição de Custos por Categoria
                </h4>
                <div className="h-72 w-full flex flex-col sm:flex-row items-center justify-center gap-4">
                  <div className="h-full w-full sm:w-1/2 flex items-center justify-center">
                    {costsByCategoryData.length === 0 ? (
                      <div className="text-zinc-500 text-[10px] uppercase tracking-wider text-center py-8">Sem dados de custos</div>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={costsByCategoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {costsByCategoryData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.fill} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                            formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, 'Custo']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                  {/* Custom Legend */}
                  <div className="flex flex-col gap-2 w-full sm:w-1/2">
                    {costsByCategoryData.length === 0 ? (
                      <p className="text-zinc-500 text-[10px] uppercase tracking-wider text-center py-8">Nenhum custo registrado</p>
                    ) : (
                      costsByCategoryData.map((entry, index) => {
                        const totalValue = costsByCategoryData.reduce((acc, curr) => acc + curr.value, 0);
                        const percentage = totalValue > 0 ? ((entry.value / totalValue) * 100).toFixed(1) : '0.0';
                        return (
                          <div key={index} className="flex items-center justify-between text-[10px] uppercase font-mono tracking-wider text-zinc-300">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.fill }} />
                              <span>{entry.name}</span>
                            </div>
                            <div className="font-bold text-white flex flex-col items-end">
                              <span>R$ {Number(entry.value).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</span>
                              <span className="text-[8px] text-zinc-500">{percentage}%</span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {selectedCategory === 'cashflow' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                <XAxis dataKey="Month" stroke="#71717a" fontSize={10} fontStyle="bold" />
                <YAxis stroke="#71717a" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, '']}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} name="Receitas (+)" />
                <Bar dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} name="Despesas (-)" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {selectedCategory === 'fuel-vs-cost' && (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={fuelVolumeVsCostData} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                <XAxis dataKey="Month" stroke="#71717a" fontSize={10} fontStyle="bold" />
                <YAxis yAxisId="left" stroke="#6366f1" fontSize={10} name="Litros" />
                <YAxis yAxisId="right" orientation="right" stroke="#3b82f6" fontSize={10} name="Custo (R$)" />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  formatter={(val: any, name: any) => {
                    if (name === "Litros Consumidos") return [`${Number(val).toFixed(1)} Litros`, name];
                    return [`R$ ${Number(val).toLocaleString('pt-BR')}`, name];
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Area yAxisId="left" type="monotone" dataKey="Litros" fill="#4f46e5" stroke="#6366f1" fillOpacity={0.15} name="Litros Consumidos" />
                <Line yAxisId="right" type="monotone" dataKey="Custo" stroke="#3b82f6" strokeWidth={3} name="Custo Total (R$)" />
              </ComposedChart>
            </ResponsiveContainer>
          )}

          {selectedCategory === 'vehicle-budget' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vehicleCostComparison} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} fontStyle="bold" />
                <YAxis stroke="#71717a" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  formatter={(val: any) => [`R$ ${Number(val).toLocaleString('pt-BR')}`, '']}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar dataKey="Combustivel" fill="#3b82f6" stackId="a" radius={[0, 0, 0, 0]} name="Combustível (R$)" />
                <Bar dataKey="Oficina" fill="#ef4444" stackId="a" radius={[4, 4, 0, 0]} name="Manutenção Oficina (R$)" />
              </BarChart>
            </ResponsiveContainer>
          )}

          {selectedCategory === 'tire-wear' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tireWearGroups} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={10} fontStyle="bold" />
                <YAxis stroke="#71717a" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  formatter={(val: any) => [`${val} Pneus`, 'Quantidade']}
                />
                <Bar dataKey="Pneus" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}

          {selectedCategory === 'stock-critical' && (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stockLevelsComparison} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1c1917" />
                <XAxis dataKey="name" stroke="#71717a" fontSize={9} />
                <YAxis stroke="#71717a" fontSize={10} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                  formatter={(val: any) => [`${val} unidades`, '']}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '10px', textTransform: 'uppercase' }} />
                <Bar dataKey="Estoque" fill="#d97706" radius={[4, 4, 0, 0]} name="Estoque Físico Atual" />
                <Bar dataKey="Minimo" fill="#78716c" radius={[4, 4, 0, 0]} name="Limite Mínimo Recomendado" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

      </div>

    </div>
  );
};
