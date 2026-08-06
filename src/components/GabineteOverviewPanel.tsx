import React, { useMemo } from 'react';
import { 
  Bus, 
  Users, 
  Fuel, 
  Wrench, 
  MapPin, 
  DollarSign, 
  Box, 
  Disc, 
  ArrowUpRight, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Activity,
  ChevronRight,
  TrendingUp,
  FileText
} from 'lucide-react';
import { cn } from '../lib/utils';

interface GabineteOverviewPanelProps {
  vehicles: any[];
  employees: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
  stockItems: any[];
  tireDossiers: any[];
  charterClientTrips: any[];
  onSelectFicha: (ficha: 'operational' | 'financial' | 'warehouse') => void;
}

export const GabineteOverviewPanel: React.FC<GabineteOverviewPanelProps> = ({
  vehicles = [],
  employees = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = [],
  stockItems = [],
  tireDossiers = [],
  charterClientTrips = [],
  onSelectFicha
}) => {

  // --- COMPUTE ADVANCED EXECUTIVE METRICS ---
  
  // 1. Vehicles Overview
  const vehicleStats = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter(v => v.status === 'available' || !v.status).length;
    const inMaint = vehicles.filter(v => v.status === 'maintenance').length;
    const inTrip = vehicles.filter(v => v.status === 'trip' || v.status === 'active').length;
    return { total, available, inMaint, inTrip };
  }, [vehicles]);

  // 2. Staff Overview
  const staffStats = useMemo(() => {
    const total = employees.length;
    const drivers = employees.filter(e => e.role === 'driver' || e.role?.toLowerCase().includes('motorista')).length;
    const admins = total - drivers;
    return { total, drivers, admins };
  }, [employees]);

  // 3. Fuel Overview
  const fuelStats = useMemo(() => {
    const totalLiters = fuelLogs.reduce((sum, f) => sum + Number(f.quantity || 0), 0);
    const totalCost = fuelLogs.reduce((sum, f) => sum + Number(f.cost || 0), 0);
    const avgPrice = totalLiters > 0 ? (totalCost / totalLiters) : 0;
    return { totalLiters, totalCost, avgPrice };
  }, [fuelLogs]);

  // 4. Maintenance Overview
  const maintenanceStats = useMemo(() => {
    const completed = maintenance.filter(m => m.status === 'completed').length;
    const pending = maintenance.filter(m => m.status === 'pending' || !m.status).length;
    const totalCost = maintenance.reduce((sum, m) => sum + Number(m.cost || 0), 0);
    return { total: maintenance.length, completed, pending, totalCost };
  }, [maintenance]);

  // 5. Trips Overview
  const tripsStats = useMemo(() => {
    const total = trips.length;
    const completed = trips.filter(t => t.status === 'completed').length;
    const active = trips.filter(t => t.status === 'active' || t.status === 'in_progress').length;
    const scheduled = trips.filter(t => t.status === 'scheduled' || !t.status).length;
    return { total, completed, active, scheduled };
  }, [trips]);

  // 6. Finance Overview
  const financeStats = useMemo(() => {
    const revenues = finance.filter(f => f.type === 'receivable' || f.type === 'income' || f.type === 'revenue')
                           .reduce((sum, f) => sum + Number(f.amount || 0), 0) + 
                     charterClientTrips.reduce((sum, c) => sum + Number(c.value || 0), 0);

    const expenses = finance.filter(f => f.type === 'payable' || f.type === 'expense' || f.type === 'cost')
                           .reduce((sum, f) => sum + Number(f.amount || 0), 0);

    const netBalance = revenues - expenses;
    return { revenues, expenses, netBalance };
  }, [finance, charterClientTrips]);

  // 7. Warehouse Stock Overview
  const stockStats = useMemo(() => {
    const totalItems = stockItems.length;
    const criticalItems = stockItems.filter(item => Number(item.quantity || 0) <= Number(item.minQuantity || 0));
    return { totalItems, criticalCount: criticalItems.length, criticalItems };
  }, [stockItems]);

  // 8. Tire Control Overview
  const tireStats = useMemo(() => {
    const totalTires = tireDossiers.length;
    const criticalTires = tireDossiers.filter(t => Number(t.grooveDepth || 0) <= 2.0);
    const regularTires = totalTires - criticalTires.length;
    return { totalTires, criticalCount: criticalTires.length, regularTires };
  }, [tireDossiers]);

  return (
    <div className="space-y-6 font-sans">
      
      {/* SECTION DESCRIPTION AND GOVERNANCE SUMMARY */}
      <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl relative overflow-hidden">
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-blue-600/5 to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
              <Activity className="text-blue-500 animate-pulse" size={16} /> Central de Controle Unificada
            </h3>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest font-semibold leading-relaxed">
              Resumo gerencial prático de todos os 8 módulos operacionais e de suporte da DM Turismo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-[9px] font-black uppercase tracking-wider text-zinc-400 rounded-xl">
              FROTA: {vehicleStats.total} VEÍCULOS
            </span>
            <span className="px-3 py-1.5 bg-zinc-950 border border-zinc-800 text-[9px] font-black uppercase tracking-wider text-emerald-400 rounded-xl">
              SALDO OPERACIONAL: R$ {financeStats.netBalance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>
      </div>

      {/* THE 8 CORE MODULES BENTO-GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">

        {/* 1. VEHICLES MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('operational')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-blue-500/55 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-vehicles"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Bus size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-blue-400 transition-colors">
                  Frota de Veículos
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-blue-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {vehicleStats.total} <span className="text-[10px] font-normal text-zinc-500">Cadastrados</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  {vehicleStats.available} Disponíveis para Escala
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest">
            <div>
              <p className="font-semibold text-zinc-600">Em Curso</p>
              <p className="font-bold text-white mt-0.5 font-mono">{vehicleStats.inTrip} vcs</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-600">Oficina</p>
              <p className="font-bold text-rose-400 mt-0.5 font-mono">{vehicleStats.inMaint} vcs</p>
            </div>
          </div>
        </div>

        {/* 2. STAFF / DRIVERS MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('operational')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-zinc-700 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-staff"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-300 flex items-center justify-center">
                  <Users size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-white transition-colors">
                  Recursos Humanos
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-white transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {staffStats.total} <span className="text-[10px] font-normal text-zinc-500">Colaboradores</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-550" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  {staffStats.drivers} Motoristas de Linha
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <div>
              <p className="font-semibold text-zinc-600">Administração</p>
              <p className="font-bold text-zinc-350 mt-0.5">{staffStats.admins} ativos</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-600">Escalados</p>
              <p className="font-bold text-blue-400 mt-0.5">{tripsStats.active} em curso</p>
            </div>
          </div>
        </div>

        {/* 3. FUEL LOGS MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('operational')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-indigo-550/50 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-fuel"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Fuel size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                  Abastecimentos
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-indigo-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {fuelStats.totalLiters.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} <span className="text-[10px] font-normal text-zinc-500">LITROS</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-450" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  Média: R$ {fuelStats.avgPrice.toFixed(2)} / Litro
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-1 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <div>
              <p className="font-semibold text-zinc-600">Investimento Total Diesel</p>
              <p className="font-bold text-white mt-0.5">R$ {fuelStats.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </div>
        </div>

        {/* 4. MAINTENANCE MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('operational')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-rose-500/50 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-maintenance"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center">
                  <Wrench size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-rose-400 transition-colors">
                  Manutenção de Frota
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-rose-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {maintenanceStats.total} <span className="text-[10px] font-normal text-zinc-500">Ordens</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[9px] font-mono text-rose-400 uppercase tracking-wider font-semibold">
                  {maintenanceStats.pending} Pendentes na Oficina
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <div>
              <p className="font-semibold text-zinc-600">Custos Oficina</p>
              <p className="font-bold text-white mt-0.5">R$ {maintenanceStats.totalCost.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-600">Concluídas</p>
              <p className="font-bold text-emerald-400 mt-0.5">{maintenanceStats.completed} ordens</p>
            </div>
          </div>
        </div>

        {/* 5. TRIPS / ESCALAS MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('operational')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/50 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-trips"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <MapPin size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                  Escala de Viagens
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {tripsStats.total} <span className="text-[10px] font-normal text-zinc-500">Escalas</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[9px] font-mono text-emerald-400 uppercase tracking-wider font-semibold">
                  {tripsStats.active} Viagens em Curso Ativas
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <div>
              <p className="font-semibold text-zinc-600">Finalizadas</p>
              <p className="font-bold text-zinc-350 mt-0.5">{tripsStats.completed} escalas</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-600">Programadas</p>
              <p className="font-bold text-blue-400 mt-0.5">{tripsStats.scheduled} futuras</p>
            </div>
          </div>
        </div>

        {/* 6. FINANCE / CASHFLOW MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('financial')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-emerald-500/55 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-finance"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <DollarSign size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-emerald-400 transition-colors">
                  Movimento Financeiro
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-emerald-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-emerald-400 uppercase tracking-tight font-mono">
                R$ {financeStats.netBalance.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider font-semibold">
                  DRE Líquido Consolidado
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 grid grid-cols-2 gap-2 text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <div>
              <p className="font-semibold text-zinc-600">Entradas (+)</p>
              <p className="font-bold text-emerald-400 mt-0.5">R$ {financeStats.revenues.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
            <div>
              <p className="font-semibold text-zinc-600">Saídas (-)</p>
              <p className="font-bold text-rose-500 mt-0.5">R$ {financeStats.expenses.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
            </div>
          </div>
        </div>

        {/* 7. WAREHOUSE STOCK MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('warehouse')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/55 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-stock"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Box size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-amber-400 transition-colors">
                  Almoxarifado Geral
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {stockStats.totalItems} <span className="text-[10px] font-normal text-zinc-500">Itens Ativos</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", stockStats.criticalCount > 0 ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                <span className={cn("text-[9px] font-mono uppercase tracking-wider font-semibold", stockStats.criticalCount > 0 ? "text-amber-400" : "text-zinc-400")}>
                  {stockStats.criticalCount} Peças Abaixo do Mínimo
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <span>Status Reposição</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black", stockStats.criticalCount > 0 ? "bg-amber-500/10 text-amber-450 border border-amber-500/25" : "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25")}>
              {stockStats.criticalCount > 0 ? "EXIGE ATENÇÃO" : "ESTÁVEL"}
            </span>
          </div>
        </div>

        {/* 8. TIRE CONTROL MODULE CARD */}
        <div 
          onClick={() => onSelectFicha('warehouse')}
          className="bg-zinc-900 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between hover:border-amber-500/55 transition-all duration-300 cursor-pointer group shadow-lg"
          id="overview-card-tires"
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Disc size={15} />
                </div>
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest group-hover:text-amber-400 transition-colors">
                  Controle de Pneus
                </span>
              </div>
              <ChevronRight size={14} className="text-zinc-600 group-hover:text-amber-400 transition-transform group-hover:translate-x-0.5 duration-200" />
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-black text-white uppercase tracking-tight font-mono">
                {tireStats.totalTires} <span className="text-[10px] font-normal text-zinc-500">Pneus Monitorados</span>
              </p>
              <div className="flex items-center gap-1.5">
                <span className={cn("w-2 h-2 rounded-full", tireStats.criticalCount > 0 ? "bg-rose-500 animate-pulse" : "bg-emerald-500")} />
                <span className={cn("text-[9px] font-mono uppercase tracking-wider font-semibold", tireStats.criticalCount > 0 ? "text-rose-450" : "text-zinc-400")}>
                  {tireStats.criticalCount} Sulco Crítico (≤ 2.0 mm)
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-850 mt-4 pt-3 flex items-center justify-between text-[9px] text-zinc-500 uppercase tracking-widest font-mono">
            <span>Rodagem Segura</span>
            <span className={cn("px-2 py-0.5 rounded-full text-[8px] font-black", tireStats.criticalCount > 0 ? "bg-rose-500/10 text-rose-400 border border-rose-500/25" : "bg-emerald-500/10 text-emerald-450 border border-emerald-500/25")}>
              {tireStats.criticalCount > 0 ? "RISCO CARECA" : "RODANDO NORMAL"}
            </span>
          </div>
        </div>

      </div>

      {/* QUICK SYSTEM ALERTS AND ALARM SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CRITICAL STOCK ALERTS */}
        <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-4">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <AlertTriangle className="text-amber-500" size={14} /> Reposição Urgente (Almoxarifado)
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {stockStats.criticalItems.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-[10px] uppercase tracking-wider font-mono">
                Nenhuma peça abaixo do nível mínimo!
              </div>
            ) : (
              stockStats.criticalItems.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs font-mono">
                  <div>
                    <p className="font-bold text-white uppercase">{item.name}</p>
                    <p className="text-[9px] text-zinc-500 uppercase mt-0.5">Cat: {item.category || 'Geral'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-rose-400">{item.quantity} {item.unit || 'un'}</p>
                    <p className="text-[8px] text-zinc-600 uppercase mt-0.5">Mín: {item.minQuantity} {item.unit || 'un'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* RECENT PENDING MAINTENANCE */}
        <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-4">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Clock className="text-rose-500 animate-pulse" size={14} /> Manutenções Pendentes na Oficina
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {maintenance.filter(m => m.status === 'pending' || !m.status).length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-[10px] uppercase tracking-wider font-mono">
                Nenhum veículo aguardando manutenção!
              </div>
            ) : (
              maintenance.filter(m => m.status === 'pending' || !m.status).slice(0, 5).map(m => {
                const vehicleObj = vehicles.find(v => v.id === m.vehicleId);
                return (
                  <div key={m.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs font-mono">
                    <div>
                      <p className="font-bold text-white uppercase">{vehicleObj?.plate?.toUpperCase() || m.vehicleId?.toUpperCase()}</p>
                      <p className="text-[9px] text-zinc-500 uppercase mt-0.5 truncate max-w-[150px]">{m.description || 'Manutenção Corretiva'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-rose-400">R$ {Number(m.cost || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                      <p className="text-[8px] text-zinc-600 uppercase mt-0.5">{m.scheduledDate ? m.scheduledDate.substring(8, 10) + '/' + m.scheduledDate.substring(5, 7) : 'Aguardando'}</p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* CHARTER & INCOME FORECAST */}
        <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-2xl space-y-4">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <TrendingUp className="text-emerald-500" size={14} /> Fretamentos Ativos & Clientes Corporativos
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {charterClientTrips.length === 0 ? (
              <div className="text-center py-8 text-zinc-600 text-[10px] uppercase tracking-wider font-mono">
                Sem faturamento de fretados ativos!
              </div>
            ) : (
              charterClientTrips.slice(0, 5).map(c => (
                <div key={c.id} className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-850 text-xs font-mono">
                  <div>
                    <p className="font-bold text-white uppercase">{c.client || 'Cliente Fretado'}</p>
                    <p className="text-[9px] text-zinc-500 uppercase mt-0.5 truncate max-w-[150px]">{c.route || 'Rota do Fretado'}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-emerald-400">R$ {Number(c.value || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                    <span className={cn("text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full", c.paymentStatus === 'received' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400")}>
                      {c.paymentStatus === 'received' ? 'PAGO' : 'FATURADO'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
