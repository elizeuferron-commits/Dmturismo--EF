// DM Turismo Profitability Analysis Section (Shadow Component)
import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  DollarSign, 
  Fuel, 
  Wrench, 
  Sliders, 
  Bus, 
  Calculator, 
  Percent, 
  ChevronRight, 
  AlertTriangle,
  ArrowRight,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { Vehicle, FuelLog, MaintenanceLog } from '../types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip,
  BarChart,
  Bar,
  Cell
} from 'recharts';

interface ProfitabilityAnalysisProps {
  vehicles: Vehicle[];
  fuelLogs: FuelLog[];
  maintenance: MaintenanceLog[];
}

export const ProfitabilityAnalysis: React.FC<ProfitabilityAnalysisProps> = ({
  vehicles,
  fuelLogs: passedFuelLogs,
  maintenance: passedMaintenance
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'trips' | 'vehicles'>('overview');
  
  // Real Firestore States to get complete historical data
  const [clientTrips, setClientTrips] = useState<any[]>([]);
  const [dbFuelLogs, setDbFuelLogs] = useState<FuelLog[]>([]);
  const [dbMaintenanceLogs, setDbMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Expanded Trip detail modal state
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  // Custom user inputs for dynamic real-time estimation on selected trip
  const [customDistance, setCustomDistance] = useState<number>(300); // default in km
  const [customDriverCost, setCustomDriverCost] = useState<number>(200); // standard daily allowance/wage
  const [customOtherCost, setCustomOtherCost] = useState<number>(50); // Tolls, feed, etc.

  // 1. Subscribe to full historical data in background
  useEffect(() => {
    setIsLoading(true);
    
    // Subscribe to charter client trips
    const unsubTrips = dbCacheService.subscribeCollection('charter_client_trips', (list) => {
      // Sort by dateTime desc
      const sorted = [...list].sort((a, b) => {
        const da = a.dateTime ? new Date(a.dateTime).getTime() : 0;
        const db_ = b.dateTime ? new Date(b.dateTime).getTime() : 0;
        return db_ - da;
      });
      setClientTrips(sorted);
    });

    // Subscribe to ALL fuel logs to get precise vehicle fuel cost averages
    const unsubFuel = dbCacheService.subscribeCollection('fuel_logs', (list) => {
      setDbFuelLogs(list as FuelLog[]);
    });

    // Subscribe to ALL maintenance logs to get precise pro-rated wear estimates
    const unsubMaint = dbCacheService.subscribeCollection('maintenance_logs', (list) => {
      setDbMaintenanceLogs(list as MaintenanceLog[]);
    });

    return () => {
      unsubTrips();
      unsubFuel();
      unsubMaint();
    };
  }, []);

  useEffect(() => {
    if (clientTrips.length >= 0 && dbFuelLogs.length >= 0 && dbMaintenanceLogs.length >= 0) {
      setIsLoading(false);
    }
  }, [clientTrips, dbFuelLogs, dbMaintenanceLogs]);

  // Use DB fetched logs or fallback to component props
  const allFuelLogs = dbFuelLogs.length > 0 ? dbFuelLogs : passedFuelLogs;
  const allMaintLogs = dbMaintenanceLogs.length > 0 ? dbMaintenanceLogs : passedMaintenance;

  // 2. Unit economics formulas and constants per vehicle category (fallback constants)
  const VAN_SPECS = {
    avgFuelConsumptionKmL: 8.5, // 8.5 km/L
    stdFuelType: 'S10 Diesel',
    maintWearFactorPerKm: 0.25, // R$ 0.25 per km wear & tear prorate
    stdDriverDayRate: 150
  };

  const BUS_SPECS = {
    avgFuelConsumptionKmL: 3.5, // 3.5 km/L
    stdFuelType: 'S10 Diesel',
    maintWearFactorPerKm: 0.65, // R$ 0.65 per km wear & tear prorate
    stdDriverDayRate: 220
  };

  // Get active fuel price or calculate the historical average fuel price from logs
  const averageFuelPrice = useMemo(() => {
    const logsWithCost = allFuelLogs.filter(log => log.cost > 0 && log.quantity > 0);
    if (logsWithCost.length === 0) return 6.10; // default estimated price per liter of S10
    const totalCost = logsWithCost.reduce((sum, log) => sum + log.cost, 0);
    const totalQuantity = logsWithCost.reduce((sum, log) => sum + log.quantity, 0);
    return Math.max(4.50, Math.min(8.00, totalCost / totalQuantity));
  }, [allFuelLogs]);

  // 3. Compute Unit economic metrics for each vehicle
  const vehicleStats = useMemo(() => {
    return vehicles.map(vehicle => {
      // Get all fuel logs for this vehicle
      const vFuelLogs = allFuelLogs.filter(l => l.vehicleId === vehicle.id);
      const totalFuelCost = vFuelLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      const totalFuelLiters = vFuelLogs.reduce((sum, l) => sum + (l.quantity || 0), 0);
      
      // Calculate real odometer distance run inside records
      let calculatedKm = 0;
      if (vFuelLogs.length > 1) {
        const odometers = vFuelLogs.map(l => l.odometer || 0).filter(o => o > 0).sort((a, b) => a - b);
        if (odometers.length >= 2) {
          calculatedKm = odometers[odometers.length - 1] - odometers[0];
        }
      }
      // Or fallback to an estimated distance from maintenance frequency if needed, otherwise use a placeholder
      if (calculatedKm === 0) calculatedKm = vehicle.currentOdometer ? Math.min(10000, vehicle.currentOdometer * 0.1) : 2500;

      // Fuel cost per KM
      let fuelCostPerKm = vehicle.type === 'bus' ? (averageFuelPrice / BUS_SPECS.avgFuelConsumptionKmL) : (averageFuelPrice / VAN_SPECS.avgFuelConsumptionKmL);
      if (totalFuelCost > 0 && calculatedKm > 0) {
        const realConsumption = calculatedKm / totalFuelLiters;
        if (realConsumption > 1 && realConsumption < 15) {
          fuelCostPerKm = totalFuelCost / calculatedKm;
        }
      }

      // Get all completed maintenance logs and sum costs
      const vMaintLogs = allMaintLogs.filter(l => l.vehicleId === vehicle.id);
      const totalMaintCost = vMaintLogs.reduce((sum, l) => sum + (l.cost || 0), 0);
      
      // Maintenance cost per KM (real or prorated standard)
      const standardWear = vehicle.type === 'bus' ? BUS_SPECS.maintWearFactorPerKm : VAN_SPECS.maintWearFactorPerKm;
      const calculatedMaintPerKm = calculatedKm > 0 ? (totalMaintCost / calculatedKm) : standardWear;
      const maintCostPerKm = calculatedMaintPerKm > 0 ? Math.min(1.5, calculatedMaintPerKm) : standardWear;

      return {
        ...vehicle,
        totalFuelCost,
        totalMaintCost,
        distanceTrackedKm: calculatedKm,
        fuelCostPerKm,
        maintCostPerKm,
        totalCostPerKm: fuelCostPerKm + maintCostPerKm
      };
    });
  }, [vehicles, allFuelLogs, allMaintLogs, averageFuelPrice]);

  // Helper dictionary for vehicle lookups
  const vehicleStatsMap = useMemo(() => {
    const map: Record<string, typeof vehicleStats[0]> = {};
    vehicleStats.forEach(v => {
      map[v.id] = v;
    });
    return map;
  }, [vehicleStats]);

  // 4. Compute Profitability for each Fretamento (Charter Trip)
  const tripsProfitability = useMemo(() => {
    return clientTrips.map(trip => {
      const revenue = Number(trip.value || 0);
      const vehicleId = trip.vehicleId;
      const vStats = vehicleId ? vehicleStatsMap[vehicleId] : null;

      // Estimate distance for the trip based on trip type or fallback
      // In real life, it could be extracted/calculated, let's use a standard default or a guess based on name
      let estDistance = 180; // standard medium distance
      const tripLabel = String(trip.client || trip.route || '').toLowerCase();
      if (tripLabel.includes('escolar') || tripLabel.includes('diario') || tripLabel.includes('rota')) {
        estDistance = 80;
      } else if (tripLabel.includes('viagem') || tripLabel.includes('fretamento') || tripLabel.includes('turismo')) {
        estDistance = 350;
      } else if (trip.tripType === 'interstate') {
        estDistance = 800;
      } else if (trip.tripType === 'mercosur') {
        estDistance = 1500;
      }

      // Fuel cost calculation: prorate or specific log on that day
      let fuelCost = 0;
      let isFuelEstimated = true;

      // Check if there is a fuel log for this vehicle on the precise day/range of the trip
      if (vehicleId && trip.dateTime) {
        const tripDate = new Date(trip.dateTime);
        const nextDay = new Date(tripDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        // Check logs of same day
        const matchedLog = allFuelLogs.find(l => {
          if (l.vehicleId !== vehicleId) return false;
          const logDate = new Date(l.timestamp);
          return logDate.toDateString() === tripDate.toDateString();
        });

        if (matchedLog) {
          fuelCost = matchedLog.cost;
          isFuelEstimated = false;
        }
      }

      // Fallback to average/prorated fuel calculation
      if (fuelCost === 0) {
        const costPerKm = vStats ? vStats.fuelCostPerKm : (trip.vehicleType === 'bus' ? (averageFuelPrice / BUS_SPECS.avgFuelConsumptionKmL) : (averageFuelPrice / VAN_SPECS.avgFuelConsumptionKmL));
        fuelCost = costPerKm * estDistance;
      }

      // Maintenance cost calculation: prorate standard wear per km
      const maintCostPerKm = vStats ? vStats.maintCostPerKm : (trip.vehicleType === 'bus' ? BUS_SPECS.maintWearFactorPerKm : VAN_SPECS.maintWearFactorPerKm);
      const maintenanceOverhead = maintCostPerKm * estDistance;

      // Driver wage allocation estimation
      const driverDailyRate = vStats?.type === 'bus' ? BUS_SPECS.stdDriverDayRate : VAN_SPECS.stdDriverDayRate;
      
      const netProfit = revenue - fuelCost - maintenanceOverhead - driverDailyRate;
      const netMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

      return {
        ...trip,
        revenue,
        estimatedDistance: estDistance,
        fuelCost,
        isFuelEstimated,
        maintenanceCost: maintenanceOverhead,
        driverCost: driverDailyRate,
        netProfit,
        netMargin,
        vehiclePlate: vStats?.plate || 'Não alocado',
        vehicleModel: vStats?.model || 'Não alocado'
      };
    });
  }, [clientTrips, vehicleStatsMap, allFuelLogs, averageFuelPrice]);

  // Aggregate stats
  const totalRevenue = useMemo(() => clientTrips.reduce((sum, t) => sum + (Number(t.value) || 0), 0), [clientTrips]);
  
  const totalFuelCostHistorical = useMemo(() => allFuelLogs.reduce((sum, t) => sum + (Number(t.cost) || 0), 0), [allFuelLogs]);
  const totalMaintCostHistorical = useMemo(() => allMaintLogs.reduce((sum, t) => sum + (Number(t.cost) || 0), 0), [allMaintLogs]);

  // Pro-rated aggregates directly from computed trips to give dynamic insight of compiled trips
  const computedTotals = useMemo(() => {
    let rev = 0;
    let fuel = 0;
    let maint = 0;
    let driver = 0;

    tripsProfitability.forEach(t => {
      rev += t.revenue;
      fuel += t.fuelCost;
      maint += t.maintenanceCost;
      driver += t.driverCost;
    });

    const profit = rev - fuel - maint - driver;
    const margin = rev > 0 ? (profit / rev) * 100 : 0;

    return {
      revenue: rev,
      fuel,
      maint,
      driver,
      profit,
      margin
    };
  }, [tripsProfitability]);

  // Get selected trip object for expanded mathematical review
  const selectedTrip = useMemo(() => {
    if (!selectedTripId) return null;
    const trip = tripsProfitability.find(t => t.id === selectedTripId);
    if (!trip) return null;
    return trip;
  }, [selectedTripId, tripsProfitability]);

  // Sync custom inputs when switching selected trip
  useEffect(() => {
    if (selectedTrip) {
      setCustomDistance(selectedTrip.estimatedDistance);
      setCustomDriverCost(selectedTrip.driverCost);
      setCustomOtherCost(50); // reset miscellaneous fee
    }
  }, [selectedTripId]);

  // Recalculated outputs based on custom inputs in the expansion panel
  const recalculations = useMemo(() => {
    if (!selectedTrip) return null;
    
    // Find active vehicle to get custom KM rates
    const vehicleId = selectedTrip.vehicleId;
    const vStats = vehicleId ? vehicleStatsMap[vehicleId] : null;
    
    const fuelRate = vStats ? vStats.fuelCostPerKm : (selectedTrip.vehicleType === 'bus' ? (averageFuelPrice / BUS_SPECS.avgFuelConsumptionKmL) : (averageFuelPrice / VAN_SPECS.avgFuelConsumptionKmL));
    const maintRate = vStats ? vStats.maintCostPerKm : (selectedTrip.vehicleType === 'bus' ? BUS_SPECS.maintWearFactorPerKm : VAN_SPECS.maintWearFactorPerKm);
    
    const calculatedFuel = fuelRate * customDistance;
    const calculatedMaint = maintRate * customDistance;
    const totalOutflow = calculatedFuel + calculatedMaint + customDriverCost + customOtherCost;
    const netProfit = selectedTrip.revenue - totalOutflow;
    const netMargin = selectedTrip.revenue > 0 ? (netProfit / selectedTrip.revenue) * 100 : 0;

    return {
      fuelCost: calculatedFuel,
      maintenanceCost: calculatedMaint,
      driverCost: customDriverCost,
      otherCost: customOtherCost,
      totalOutflow,
      netProfit,
      netMargin
    };
  }, [selectedTrip, customDistance, customDriverCost, customOtherCost, vehicleStatsMap, averageFuelPrice]);

  // Data for chart
  const monthlyData = useMemo(() => {
    const monthlyMap: Record<string, { month: string, receita: number, custo: number, lucro: number }> = {};
    
    // Sort chronological first
    const chronoTrips = [...tripsProfitability].sort((a, b) => {
      const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
      const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
      return dateA - dateB;
    });

    chronoTrips.forEach(t => {
      if (!t.dateTime) return;
      const date = new Date(t.dateTime);
      const monthLabel = date.toLocaleString('pt-BR', { month: 'short' }).toUpperCase();
      
      const totalOutflow = t.fuelCost + t.maintenanceCost + t.driverCost;

      if (!monthlyMap[monthLabel]) {
        monthlyMap[monthLabel] = { month: monthLabel, receita: 0, custo: 0, lucro: 0 };
      }
      monthlyMap[monthLabel].receita += t.revenue;
      monthlyMap[monthLabel].custo += totalOutflow;
      monthlyMap[monthLabel].lucro += t.netProfit;
    });

    return Object.values(monthlyMap);
  }, [tripsProfitability]);

  if (isLoading) {
    return (
      <div className="bg-zinc-900/40 rounded-[3rem] border border-white/5 p-8 flex flex-col items-center justify-center min-h-[350px] backdrop-blur-md">
        <Calculator size={36} className="text-brand-accent animate-spin mb-4" />
        <span className="text-[10px] font-black uppercase text-zinc-500 tracking-[0.25em]">Compilando Dados Tarifários e Custos...</span>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900/40 rounded-[3rem] border border-white/5 p-8 md:p-10 backdrop-blur-md relative overflow-hidden space-y-8">
      
      {/* Decolador de Fundo */}
      <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
        <TrendingUp size={180} className="text-white rotate-12" />
      </div>

      {/* Header do Módulo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-accent/10 rounded-2xl border border-brand-accent/20 text-brand-accent">
            <Calculator size={20} />
          </div>
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider font-display">Análise de Rentabilidade</h3>
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">Visão unificada de lucratividade de fretamentos e economia da frota</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="bg-zinc-950 p-1 rounded-xl flex gap-1 border border-white/5 md:self-center">
          <button 
            onClick={() => { setActiveTab('overview'); setSelectedTripId(null); }}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'overview' ? 'bg-brand-accent text-zinc-950 shadow-lg shadow-brand-accent/10' : 'text-zinc-500 hover:text-white'}`}
          >
            Geral
          </button>
          <button 
            onClick={() => setActiveTab('trips')}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'trips' ? 'bg-brand-accent text-zinc-950 shadow-lg shadow-brand-accent/10' : 'text-zinc-500 hover:text-white'}`}
          >
            Por Fretamento
          </button>
          <button 
            onClick={() => { setActiveTab('vehicles'); setSelectedTripId(null); }}
            className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${activeTab === 'vehicles' ? 'bg-brand-accent text-zinc-950 shadow-lg shadow-brand-accent/10' : 'text-zinc-500 hover:text-white'}`}
          >
            Veículos
          </button>
        </div>
      </div>

      {/* Grid de Seções */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: VISÃO GERAL */}
        {activeTab === 'overview' && (
          <motion.div 
            key="overview"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-8"
          >
            {/* Stat Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Receitas */}
              <div className="bg-zinc-950/65 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.02] text-white flex items-center justify-right p-4 pointer-events-none group-hover:scale-110 transition-transform">
                  <DollarSign size={64} />
                </div>
                <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest border border-emerald-500/10">Faturamento</span>
                <p className="text-2xl font-black text-white mt-4 tracking-tighter">
                  R$ {computedTotals.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Soma de {clientTrips.length} fretamentos</span>
              </div>

              {/* Custos Operacionais (Combustível) */}
              <div className="bg-zinc-950/65 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.02] text-white flex items-center justify-right p-4 pointer-events-none group-hover:scale-110 transition-transform">
                  <Fuel size={64} />
                </div>
                <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest border border-amber-500/10">Combustível</span>
                <p className="text-2xl font-black text-white mt-4 tracking-tighter">
                  R$ {computedTotals.fuel.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Consumo real & estimado</span>
              </div>

              {/* Custos Reparos (Manutenção) */}
              <div className="bg-zinc-950/65 border border-white/5 rounded-2xl p-6 relative overflow-hidden group">
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.02] text-white flex items-center justify-right p-4 pointer-events-none group-hover:scale-110 transition-transform">
                  <Wrench size={64} />
                </div>
                <span className="text-[9px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full uppercase tracking-widest border border-rose-500/10">Manutenção</span>
                <p className="text-2xl font-black text-white mt-4 tracking-tighter">
                  R$ {computedTotals.maint.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Desgaste frotista pro-rata</span>
              </div>

              {/* Margem e Lucro Líquido */}
              <div className={`bg-gradient-to-br from-zinc-950 to-zinc-900 border ${computedTotals.profit > 0 ? 'border-brand-accent/20' : 'border-rose-500/20'} rounded-2xl p-6 relative overflow-hidden group`}>
                <div className="absolute right-0 top-0 bottom-0 w-1/3 opacity-[0.03] text-white flex items-center justify-right p-4 pointer-events-none group-hover:scale-110 transition-transform">
                  <Percent size={64} />
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[9px] font-black ${computedTotals.profit > 0 ? 'text-brand-accent bg-brand-accent/10 border-brand-accent/10' : 'text-rose-500 bg-rose-500/10 border-rose-500/10'} px-2 py-0.5 rounded-full uppercase tracking-widest border`}>Lucro Líquido</span>
                  <span className={`text-[9px] font-black text-white px-1.5 py-0.5 rounded-md`}>{computedTotals.margin.toFixed(1)}% margem</span>
                </div>
                <p className="text-2xl font-black text-white mt-4 tracking-tighter font-mono">
                  R$ {computedTotals.profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <span className="text-[7.5px] font-bold text-zinc-500 uppercase tracking-widest mt-1 block">Faturamento líquido estimado</span>
              </div>

            </div>

            {/* Chart Section */}
            {monthlyData.length > 0 ? (
              <div className="bg-zinc-950/65 border border-white/5 rounded-3xl p-6 space-y-4">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Histórico de Lucratividade Mensal</span>
                <div className="h-[230px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={monthlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#ff6b00" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} />
                      <XAxis dataKey="month" stroke="#71717a" fontSize={9} fontStyle="bold" tickLine={false} />
                      <YAxis stroke="#71717a" fontSize={9} fontStyle="bold" tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#09090b', borderColor: '#27272a', borderRadius: '12px' }}
                        labelStyle={{ color: '#a1a1aa', fontWeight: 'bold', fontSize: '9px' }}
                        itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="lucro" name="Lucro Líquido (R$)" stroke="#ff6b00" strokeWidth={3} fillOpacity={1} fill="url(#profitGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/30 border border-dashed border-zinc-850 p-12 rounded-[2rem] text-center">
                <AlertTriangle size={24} className="text-zinc-600 mx-auto mb-2 animate-pulse" />
                <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest">Sem lançamentos de viagem elegíveis para consolidação mensal.</span>
              </div>
            )}

            {/* Bottom Insight Notification */}
            <div className="bg-zinc-950/50 border border-white/5 p-5 rounded-2xl flex items-start gap-4">
              <div className="p-2 bg-brand-accent/15 rounded-xl text-brand-accent border border-brand-accent/10 mt-0.5">
                <Info size={14} />
              </div>
              <div className="space-y-1">
                <h5 className="text-[10px] font-black text-white uppercase tracking-wider">Como calculamos estes dados?</h5>
                <p className="text-[9.5px] leading-relaxed text-zinc-500 font-medium font-sans">
                  Nossos algoritmos buscam em tempo real por abastecimentos registrados na mesma data e veículo do seu fretamento comercial. Quando indisponíveis, cruzamos com dados unitários de economia do respectivo veículo (médias de combustível real e estimativas de desgaste mecânico por KM) multiplicados pelo trajeto previsto da rota para estabelecer lucros operacionais fidedignos.
                </p>
              </div>
            </div>

          </motion.div>
        )}

        {/* TAB 2: POR FRETAMENTO (LISTA E CALCULADORA INTERATIVA) */}
        {activeTab === 'trips' && (
          <motion.div 
            key="trips"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
          >
            {/* Lista de Fretamentos / Viagens */}
            <div className="lg:col-span-5 space-y-4">
              <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block font-sans">Fretamentos Cadastrados ({tripsProfitability.length})</span>
              
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {tripsProfitability.length > 0 ? (
                  tripsProfitability.map((trip) => {
                    const isSelected = selectedTripId === trip.id;
                    const margin = trip.netMargin;

                    return (
                      <div 
                        key={trip.id}
                        onClick={() => setSelectedTripId(trip.id)}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex flex-col gap-3 group select-none ${
                          isSelected 
                            ? 'bg-brand-accent/15 border-brand-accent/60 shadow-lg' 
                            : 'bg-zinc-950/40 border-white/5 hover:border-white/15 hover:bg-zinc-950/65'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <h4 className="font-black text-xs text-white uppercase truncate tracking-tight">{trip.client || 'Fretamento Avulso'}</h4>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded uppercase leading-none">{trip.vehiclePlate}</span>
                              <span className="text-[8px] font-bold text-zinc-550 uppercase">
                                {trip.dateTime ? format(new Date(trip.dateTime), "dd/MM/yyyy") : 'Data não informada'}
                              </span>
                            </div>
                          </div>

                          {/* Margem Badge */}
                          <div className="text-right">
                            <span className={`text-[8.5px] font-black px-2 py-1 rounded-full uppercase tracking-wider ${
                              margin > 40 
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-550/20' 
                                : margin > 15 
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-550/20' 
                                  : 'bg-rose-500/15 text-rose-400 border border-rose-550/20'
                            }`}>
                              {margin.toFixed(0)}% Margem
                            </span>
                          </div>
                        </div>

                        {/* Summary Data */}
                        <div className="flex items-center justify-between text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-t border-white/5 pt-2.5">
                          <span>Receita: <b className="text-white">R$ {trip.revenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</b></span>
                          <span className="flex items-center gap-1 group-hover:text-white transition-colors">
                            Ver Análise <ChevronRight size={10} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="bg-zinc-950/20 border border-dashed border-zinc-850 rounded-[2rem] p-8 text-center">
                    <AlertTriangle size={20} className="text-zinc-600 mx-auto mb-2 animate-pulse" />
                    <p className="text-[9px] text-zinc-550 font-black uppercase tracking-widest">Nenhum fretamento de cliente disponível para análise financeira.</p>
                  </div>
                )}
              </div>
            </div>

            {/* LADO DIREITO: EXPANSÃO COM CALCULADORA INTERATIVA */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                {selectedTrip ? (
                  <motion.div 
                    key={selectedTrip.id}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    className="bg-zinc-950/90 border border-white/5 rounded-3xl p-6 md:p-8 space-y-6 relative overflow-hidden"
                  >
                    
                    {/* Floating Header */}
                    <div className="space-y-1 border-b border-white/5 pb-4">
                      <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest">Painel de Simulação Inteligente</span>
                      <h4 className="font-black text-lg text-white uppercase tracking-tight leading-tight">{selectedTrip.client}</h4>
                      <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Veículo: {selectedTrip.vehicleModel} ({selectedTrip.vehiclePlate})</p>
                    </div>

                    {/* Interactive Sliders Column */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/40 p-5 rounded-2xl border border-white/5">
                      
                      {/* Distance Slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                          <label className="flex items-center gap-1"><Sliders size={10} /> Distância Rota (km)</label>
                          <span className="text-white text-xs font-mono font-black">{customDistance} km</span>
                        </div>
                        <input 
                          type="range"
                          min={20}
                          max={2000}
                          step={10}
                          value={customDistance}
                          onChange={(e) => setCustomDistance(parseInt(e.target.value) || 20)}
                          className="w-full accent-brand-accent cursor-pointer bg-zinc-800 h-1 rounded-lg outline-none"
                        />
                        <span className="text-[7.5px] text-zinc-600 font-bold uppercase tracking-wider block">Estipule para recalcular combustível & fretes</span>
                      </div>

                      {/* Driver cost Slider */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                          <label className="flex items-center gap-1"><Calculator size={10} /> Diária Motorista (R$)</label>
                          <span className="text-white text-xs font-mono font-black">R$ {customDriverCost}</span>
                        </div>
                        <input 
                          type="range"
                          min={100}
                          max={1000}
                          step={20}
                          value={customDriverCost}
                          onChange={(e) => setCustomDriverCost(parseInt(e.target.value) || 100)}
                          className="w-full accent-brand-accent cursor-pointer bg-zinc-800 h-1 rounded-lg outline-none"
                        />
                        <span className="text-[7.5px] text-zinc-600 font-bold uppercase tracking-wider block">Wages e diárias alocadas neste fretamento</span>
                      </div>

                    </div>

                    {/* Calculation breakdown */}
                    <div className="space-y-4">
                      <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Detalhamento Financeiro Simplificado</span>
                      
                      <div className="space-y-3 font-sans">
                        
                        {/* Receita */}
                        <div className="flex justify-between items-center text-xs pb-2 border-b border-dashed border-zinc-850">
                          <span className="font-bold text-zinc-450 uppercase text-[9.5px]">Receita Contábil Recebida</span>
                          <span className="font-black text-emerald-500">+ R$ {selectedTrip.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Combustível */}
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-zinc-450 uppercase text-[9.5px]">Combustível Estimado</span>
                            <span className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1.5 py-0.2 rounded-md uppercase tracking-wider leading-none">Estimate</span>
                          </div>
                          <span className="font-black text-rose-500/90">- R$ {recalculations?.fuelCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Manutenção pro-rata */}
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-450 uppercase text-[9.5px]">Desgaste Técnico do Veículo (Pro-rata)</span>
                          <span className="font-black text-rose-500/90">- R$ {recalculations?.maintenanceCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Diária Motorista */}
                        <div className="flex justify-between items-center text-xs pb-3 border-b border-zinc-850">
                          <span className="font-bold text-zinc-450 uppercase text-[9.5px]">Custo Operacional de Diária do Motorista</span>
                          <span className="font-black text-rose-500/90">- R$ {recalculations?.driverCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </div>

                        {/* Lucro de Saída */}
                        <div className="flex justify-between items-center bg-zinc-900 border border-white/5 p-4 rounded-xl mt-2">
                          <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1">Lucro Líquido Simulador</p>
                            <span className={`text-[9px] font-black px-2 py-0.5 rounded uppercase leading-none font-sans ${recalculations && recalculations.netMargin > 30 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>{recalculations?.netMargin.toFixed(1)}% margem líquida</span>
                          </div>
                          <span className={`text-xl font-black font-mono tracking-tighter ${recalculations && recalculations.netProfit > 0 ? 'text-brand-accent' : 'text-rose-500'}`}>
                            R$ {recalculations?.netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </div>

                      </div>
                    </div>

                  </motion.div>
                ) : (
                  <div className="bg-zinc-950/20 border border-dashed border-zinc-850 rounded-[2.5rem] h-[350px] flex flex-col items-center justify-center text-center p-8">
                    <Calculator size={36} className="text-zinc-700 mb-3 animate-pulse" />
                    <h5 className="font-black text-sm text-zinc-400 uppercase tracking-wider mb-1">Cálculo de Viagem Isolado</h5>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest max-w-[280px] leading-relaxed">
                      Selecione qualquer fretamento na listagem lateral para ativar o simulador de rentabilidade, onde você poderá arrastar controles de autonomia para recalcular lucros!
                    </p>
                  </div>
                )}
              </AnimatePresence>
            </div>

          </motion.div>
        )}

        {/* TAB 3: VEÍCULOS (ECONOMIA DE UNIDADE / UNIT ECONOMICS) */}
        {activeTab === 'vehicles' && (
          <motion.div 
            key="vehicles"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            <span className="text-[10px] font-black text-zinc-550 uppercase tracking-widest block font-sans">Economia de Unidade da Frota (Gastos por KM)</span>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {vehicleStats.map((vehicle) => {
                const totalFuel = vehicle.totalFuelCost;
                const totalMaint = vehicle.totalMaintCost;
                const costPerKm = vehicle.totalCostPerKm;

                return (
                  <div key={vehicle.id} className="bg-zinc-950/65 border border-white/5 rounded-3xl p-6 flex flex-col justify-between hover:border-brand-accent/25 transition-all group duration-300">
                    
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{vehicle.model}</span>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-base text-white uppercase tracking-tight">{vehicle.plate}</h4>
                          <span className={`text-[8.5px] font-black px-1.5 py-0.5 rounded uppercase leading-none ${vehicle.type === 'bus' ? 'bg-purple-550/15 text-purple-400' : 'bg-blue-550/15 text-blue-400'}`}>{vehicle.type === 'bus' ? 'Ônibus' : 'Van'}</span>
                        </div>
                      </div>

                      {/* Cost per KM Indicator right */}
                      <div className="text-right">
                        <p className="text-[8.5px] font-black text-zinc-550 uppercase tracking-wider mb-0.5">Custo Médio / km</p>
                        <span className="text-lg font-black text-brand-accent font-mono">
                          R$ {costPerKm.toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Cost breakdown */}
                    <div className="grid grid-cols-3 gap-4 border-b border-white/5 pb-4 mb-4 font-sans text-xs">
                      
                      {/* Fuel costs */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest block">Total Diesel</span>
                        <p className="font-extrabold text-white text-[11px]">R$ {totalFuel.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        <span className="text-[7.5px] text-zinc-550 font-bold block">R$ {vehicle.fuelCostPerKm.toFixed(2)}/km</span>
                      </div>

                      {/* Maintenance expenses */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest block">Total Manut.</span>
                        <p className="font-extrabold text-white text-[11px]">R$ {totalMaint.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}</p>
                        <span className="text-[7.5px] text-zinc-550 font-bold block">R$ {vehicle.maintCostPerKm.toFixed(2)}/km</span>
                      </div>

                      {/* Tracked KM */}
                      <div className="space-y-1">
                        <span className="text-[8.5px] font-black text-zinc-500 uppercase tracking-widest block">Métricas KM</span>
                        <p className="font-extrabold text-white text-[11px]">{vehicle.distanceTrackedKm.toLocaleString('pt-BR')} km</p>
                        <span className="text-[7.5px] text-amber-500 font-bold block flex items-center gap-1">Histórico <TrendingUp size={8} /></span>
                      </div>

                    </div>

                    {/* Profit efficiency bar */}
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        <span>Eficiência de Custos</span>
                        <span className="text-white">{costPerKm < 1.2 ? 'Excelente' : costPerKm < 2.2 ? 'Adequado' : 'Alto Risco'}</span>
                      </div>
                      
                      {/* Custom indicator bar */}
                      <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden flex">
                        <div 
                          className={`h-full rounded-full ${costPerKm < 1.2 ? 'bg-emerald-500' : costPerKm < 2.2 ? 'bg-amber-500' : 'bg-rose-500'}`}
                          style={{ width: `${Math.max(10, Math.min(100, (100 - (costPerKm / 3.5) * 100)))}%` }}
                        />
                      </div>
                    </div>

                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

    </div>
  );
};
