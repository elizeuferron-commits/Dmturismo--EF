import React, { useMemo, useState } from 'react';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend 
} from 'recharts';
import { DollarSign, Fuel, Wrench, Bus, TrendingUp, Calendar, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface GabineteOperationalIndicatorsProps {
  vehicles: any[];
  fuelLogs: any[];
  maintenance: any[];
  trips: any[];
  finance: any[];
  className?: string;
}

export const GabineteOperationalIndicators: React.FC<GabineteOperationalIndicatorsProps> = ({
  vehicles = [],
  fuelLogs = [],
  maintenance = [],
  trips = [],
  finance = [],
  className,
}) => {
  const [indicatorPeriod, setIndicatorPeriod] = useState<'mensal' | 'anual'>('mensal');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  // Unified Period filtering logic
  const filterByPeriod = useMemo(() => {
    return (item: any): boolean => {
      const dateStr = item.timestamp || item.completedAt || item.startDate || item.dueDate || item.date || item.createdAt || item.updatedAt;
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

  const fleetStatus = useMemo(() => {
    const total = vehicles.length;
    const available = vehicles.filter(v => v.status === 'available').length;
    const maintenanceCount = vehicles.filter(v => v.status === 'maintenance').length;
    const traveling = total - available - maintenanceCount;
    return [
      { name: 'Disponível', value: available },
      { name: 'Em Manutenção', value: maintenanceCount },
      { name: 'Em Viagem', value: traveling },
    ];
  }, [vehicles]);

  const periodExpenses = useMemo(() => {
    const filteredFuel = fuelLogs.filter(filterByPeriod);
    const filteredMaint = maintenance.filter(filterByPeriod);

    const fuelCost = filteredFuel.reduce((sum, l) => sum + Number(l.cost || 0), 0);
    const maintCost = filteredMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
      
    return [
      { name: 'Combustível', Valor: fuelCost },
      { name: 'Manutenção', Valor: maintCost },
    ];
  }, [fuelLogs, maintenance, filterByPeriod]);

  const costPerKmPerVehicle = useMemo(() => {
    const vCosts: Record<string, { cost: number; distance: number }> = {};
    
    maintenance.filter(filterByPeriod).forEach(m => {
        if (!vCosts[m.vehicleId]) vCosts[m.vehicleId] = { cost: 0, distance: 0 };
        vCosts[m.vehicleId].cost += Number(m.cost || 0);
    });
    fuelLogs.filter(filterByPeriod).forEach(f => {
        if (!vCosts[f.vehicleId]) vCosts[f.vehicleId] = { cost: 0, distance: 0 };
        vCosts[f.vehicleId].cost += Number(f.cost || 0);
    });
    trips.filter(filterByPeriod).forEach(t => {
        if (!vCosts[t.vehicleId]) vCosts[t.vehicleId] = { cost: 0, distance: 0 };
        vCosts[t.vehicleId].distance += Number(t.distance || 0);
    });
    
    return vehicles.map(v => {
        const stats = vCosts[v.id] || { cost: 0, distance: 0 };
        return {
            name: v.plate || v.id,
            costPerKm: stats.distance > 0 ? (stats.cost / stats.distance) : 0
        };
    }).filter(v => v.costPerKm > 0).slice(0, 5);
  }, [vehicles, maintenance, fuelLogs, trips, filterByPeriod]);

  const roiPerRoute = useMemo(() => {
    const routeStats: Record<string, { revenue: number; cost: number }> = {};
    const filteredFinance = finance.filter(filterByPeriod);
    const filteredTrips = trips.filter(filterByPeriod);

    filteredFinance.forEach(f => {
        if (f.tripId) {
            const trip = filteredTrips.find(t => t.id === f.tripId);
            if (trip && trip.routeId) {
                if (!routeStats[trip.routeId]) routeStats[trip.routeId] = { revenue: 0, cost: 0 };
                if (f.type === 'revenue' || f.type === 'receivable' || f.type === 'income') {
                  routeStats[trip.routeId].revenue += Number(f.amount || 0);
                } else if (f.type === 'expense' || f.type === 'payable' || f.type === 'cost') {
                  routeStats[trip.routeId].cost += Number(f.amount || 0);
                }
            }
        }
    });
    
    return Object.entries(routeStats).map(([routeId, stats]) => ({
        routeId,
        roi: stats.cost > 0 ? ((stats.revenue - stats.cost) / stats.cost) * 100 : 0
    })).slice(0, 5);
  }, [trips, finance, filterByPeriod]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Top filter header dedicated to DM Turismo Style */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900 border border-zinc-850 p-5 rounded-3xl">
        <div>
          <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="text-blue-500" size={16} /> Indicadores de Governança
          </h3>
          <p className="text-[10px] text-zinc-500 mt-0.5 uppercase tracking-widest font-semibold">
            Análise em tempo real focada na rentabilidade da DM Turismo
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-mono flex items-center gap-1.5">
            <Calendar size={12} /> Período dos Gráficos:
          </span>
          <div className="flex bg-zinc-950 p-1 rounded-xl border border-zinc-800 font-mono">
            <button 
              onClick={() => setIndicatorPeriod('mensal')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", 
                indicatorPeriod === 'mensal' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              MENSAL (MÊS ATUAL)
            </button>
            <button 
              onClick={() => setIndicatorPeriod('anual')}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all", 
                indicatorPeriod === 'anual' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'
              )}
            >
              ANUAL ({currentYear})
            </button>
          </div>
        </div>
      </div>

      {/* Indicadores */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-850">
          <span className="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2">
            <Bus size={12} /> Disponibilidade Frota
          </span>
          <p className="text-2xl font-black text-white mt-1">
            {vehicles.length > 0 ? ((vehicles.filter(v => v.status === 'available').length / vehicles.length) * 105).toFixed(0) : 0}% / disp.
          </p>
        </div>
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-850">
          <span className="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2">
            <Fuel size={12} /> Despesa Combustível ({indicatorPeriod === 'mensal' ? 'Mês' : 'Ano'})
          </span>
          <p className="text-2xl font-black text-blue-500 mt-1">
            R$ {periodExpenses[0].Valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-850">
          <span className="text-[10px] font-black text-zinc-500 uppercase flex items-center gap-2">
            <Wrench size={12} /> Despesa Oficina ({indicatorPeriod === 'mensal' ? 'Mês' : 'Ano'})
          </span>
          <p className="text-2xl font-black text-rose-500 mt-1">
            R$ {periodExpenses[1].Valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
           <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">Status Atual da Frota</h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={fleetStatus}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                  <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                  <YAxis stroke="#71717a" fontSize={10} />
                  <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
                  <Bar dataKey="value" radius={[5, 5, 0, 0]} fill="#3b82f6" />
                </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
           <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">
             Distribuição de Despesas ({indicatorPeriod === 'mensal' ? 'Este Mês' : 'Este Ano'})
           </h4>
           <div className="h-64">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={periodExpenses}>
                 <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                 <XAxis dataKey="name" stroke="#71717a" fontSize={10} />
                 <YAxis stroke="#71717a" fontSize={10} />
                 <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' }} />
                 <Bar dataKey="Valor" radius={[5, 5, 0, 0]} fill="#3b82f6" />
               </BarChart>
             </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* New Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
           <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">
             Custo Médio por KM ({indicatorPeriod === 'mensal' ? 'Este Mês' : 'Este Ano'})
           </h4>
           <div className="space-y-2">
             {costPerKmPerVehicle.length === 0 ? (
               <div className="p-8 text-center text-zinc-550 text-xs uppercase font-mono tracking-wider">
                 Sem dados de KM/custo para o período selecionado
               </div>
             ) : (
               costPerKmPerVehicle.map(v => (
                 <div key={v.name} className="flex justify-between text-xs font-mono text-zinc-400 bg-zinc-950 p-2 rounded">
                   <span>{v.name}</span>
                   <span className="font-bold text-white">R$ {v.costPerKm.toFixed(2)} / km</span>
                 </div>
               ))
             )}
           </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl">
           <h4 className="text-xs font-black text-white uppercase tracking-wider mb-4">
             Retorno Econômico ({indicatorPeriod === 'mensal' ? 'Este Mês' : 'Este Ano'})
           </h4>
           <div className="space-y-2">
             {roiPerRoute.length === 0 ? (
               <div className="p-8 text-center text-zinc-550 text-xs uppercase font-mono tracking-wider">
                 Nenhuma viagem vinculada a faturamento no período
               </div>
             ) : (
               roiPerRoute.map(r => (
                 <div key={r.routeId} className="flex justify-between text-xs font-mono text-zinc-400 bg-zinc-950 p-2 rounded">
                   <span>{r.routeId}</span>
                   <span className="font-bold text-emerald-500">{r.roi.toFixed(1)} %</span>
                 </div>
               ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
};
