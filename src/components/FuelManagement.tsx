import React, { useState } from 'react';
import { 
  Plus, 
  Package, 
  MapPin, 
  Fuel, 
  AlertTriangle,
  Printer,
  Calendar,
  X
} from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay, subMonths, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { motion } from 'motion/react';
import { Card } from './Cards';
import { cn } from '../lib/utils';
import { Vehicle, FuelTank, FuelLog, FuelEntry, Employee } from '../types';
import { Modal, Input, Button } from './UI';

interface FuelManagementProps {
  fuelTanks: FuelTank[];
  recentFuelLogs: FuelLog[];
  fuelEntries: FuelEntry[];
  vehicles: Vehicle[];
  employees: Employee[];
  onOpenTankModal: () => void;
  onOpenRefillModal: () => void;
  onOpenExternalFuelModal: () => void;
  onOpenFuelModal: () => void;
  onEditFuelLog: (log: FuelLog) => void;
  onDeleteFuelLog: (logId: string) => void;
}

export const FuelManagement: React.FC<FuelManagementProps> = ({
  fuelTanks,
  recentFuelLogs,
  fuelEntries,
  vehicles,
  employees,
  onOpenTankModal,
  onOpenRefillModal,
  onOpenExternalFuelModal,
  onOpenFuelModal,
  onEditFuelLog,
  onDeleteFuelLog
}) => {
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedLog, setSelectedLog] = useState<FuelLog | null>(null);

  // Gráfico de Consumo Mensal por Frota (Últimos 6 meses)
  const consumptionChartData = React.useMemo(() => {
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const date = subMonths(new Date(), i);
      return {
        key: format(date, 'yyyy-MM'),
        label: format(date, 'MMM/yy', { locale: ptBR }),
      };
    }).reverse();

    return last6Months.map(month => {
      let busLiters = 0;
      let vanLiters = 0;
      let totalLiters = 0;

      recentFuelLogs.forEach(log => {
        if (!log.timestamp) return;
        try {
          const logDate = parseISO(log.timestamp);
          const logMonthKey = format(logDate, 'yyyy-MM');

          if (logMonthKey === month.key) {
            const vehicle = vehicles.find(v => v.id === log.vehicleId);
            const qty = Number(log.quantity) || 0;
            
            if (vehicle?.type === 'bus') {
              busLiters += qty;
            } else if (vehicle?.type === 'van') {
              vanLiters += qty;
            } else {
              busLiters += qty;
            }
            totalLiters += qty;
          }
        } catch (e) {
          console.error('[Fuel Chart] Parse timestamp error: ', e);
        }
      });

      return {
        month: month.label.toUpperCase(),
        'Ônibus': Math.floor(busLiters),
        'Vans': Math.floor(vanLiters),
        'Total': Math.floor(totalLiters)
      };
    });
  }, [recentFuelLogs, vehicles]);

  const handleDownloadPDF = async () => {
    const jsPDF = (await import('jspdf')).default;
    const autoTable = (await import('jspdf-autotable')).default;
    const doc = new jsPDF();
    
    doc.setFillColor(135, 206, 235);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(22);
    doc.text("DM TURISMO", 14, 15);
    doc.setFontSize(10);
    doc.text("prazer em viajar bem", 14, 22);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.text("Relatório de Abastecimento", 14, 40);
    doc.setFontSize(10);
    doc.text(`Período: ${startDate} a ${endDate}`, 14, 46);
    
    const tableColumn = ["Data", "Placa", "Hodômetro", "Diesel (L)", "Arla (L)", "Motorista", "Bomba"];
    const tableRows: any[] = [];
    
    filteredLogs.forEach(log => {
      const v = vehicles.find(v => v.id === log.vehicleId);
      const d = employees?.find(e => e.id === log.driverId);
      tableRows.push([
          log.timestamp ? format(parseISO(log.timestamp), 'dd/MM HH:mm') : '---',
          v?.plate || '---',
          log.odometer?.toLocaleString() || '---',
          Math.floor(log.quantity || 0).toLocaleString('pt-BR'),
          Math.floor(log.arlaQuantity || 0).toLocaleString('pt-BR'),
          d?.name || '---',
          log.isExternal ? 'Externa' : 'Interna'
      ]);
    });
    
    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 55,
      styles: { fontSize: 8, textColor: [0, 0, 0] },
      headStyles: { fillColor: [135, 206, 235] },
      alternateRowStyles: { fillColor: [240, 240, 240] }
    });
    
    doc.save(`relatorio_abastecimento_${startDate}_${endDate}.pdf`);
    setIsPrintModalOpen(false);
  };

  const handlePrint = () => {
    window.print();
    setIsPrintModalOpen(false);
  };

  const filteredLogs = recentFuelLogs.filter(log => {
      if (!log.timestamp) return false;
      const logDate = startOfDay(parseISO(log.timestamp));
      return isWithinInterval(logDate, { 
          start: startOfDay(parseISO(startDate)), 
          end: endOfDay(parseISO(endDate)) 
      });
  });

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase leading-none">Gestão de Abastecimento</h1>
          <div className="text-zinc-500 font-black uppercase text-[10px] tracking-[0.3em] mt-3 flex items-center gap-2">
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse" />
            Bomba de Abastecimento Interna DM Turismo
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <button 
            onClick={onOpenTankModal}
            className="flex items-center gap-3 px-6 py-4 bg-zinc-900 text-zinc-400 rounded-xl font-bold border border-zinc-800 transition-all hover:bg-zinc-800 active:scale-95"
          >
            <Plus size={18} />
            Configurar Tanque
          </button>
          <button 
            onClick={onOpenRefillModal}
            className="flex items-center gap-3 px-6 py-4 bg-zinc-900 text-zinc-400 rounded-xl font-bold border border-zinc-800 transition-all hover:bg-zinc-800 active:scale-95"
          >
            <Package size={18} />
            Carga Refil (Tanque)
          </button>
          <button 
            onClick={onOpenExternalFuelModal}
            className="flex items-center gap-3 px-6 py-4 bg-rose-500/10 text-rose-500 rounded-xl font-bold border border-rose-500/20 transition-all hover:bg-rose-500/20 active:scale-95"
          >
            <MapPin size={18} />
            Abastecimento Externo
          </button>
          <button 
            onClick={onOpenFuelModal}
            className="flex items-center gap-4 px-10 py-5 bg-brand-accent text-zinc-950 rounded-2xl font-black shadow-2xl transition-all active:scale-95 group hover:scale-[1.02] border-2 border-white/10"
          >
            <Plus size={24} className="stroke-[3]" />
            Carregar Abastecimento (Veículo)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl group hover:border-brand-accent/50 transition-all shadow-lg">
           <div className="flex justify-between items-start mb-6">
             <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Estoque em Tanques</p>
           </div>
           <div className="space-y-4">
             <div className="flex items-end justify-between">
               <div>
                 <p className="text-3xl font-black text-white tabular-nums tracking-tighter leading-none">
                   {Math.floor(fuelTanks.filter(t => t.fuelType.toLowerCase().includes('s10') || t.fuelType.toLowerCase().includes('diesel')).reduce((acc, t) => acc + t.currentLevel, 0)).toLocaleString("pt-BR")} <span className="text-xs text-zinc-600 font-bold">L</span>
                 </p>
                 <p className="text-[9px] font-black text-zinc-500 uppercase mt-1 tracking-widest">Diesel S10</p>
               </div>
               <div className="text-right">
                 <p className="text-xl font-black text-brand-accent tabular-nums tracking-tighter leading-none">
                   {Math.floor(fuelTanks.filter(t => t.fuelType.toLowerCase().includes('arla')).reduce((acc, t) => acc + t.currentLevel, 0)).toLocaleString("pt-BR")} <span className="text-[10px] text-zinc-600">L</span>
                 </p>
                 <p className="text-[9px] font-black text-zinc-600 uppercase mt-1 tracking-widest leading-none">Arla 32</p>
               </div>
             </div>
           </div>
        </div>
        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-lg">
           <div className="flex justify-between items-start mb-6">
             <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none">Saídas (Mês Atual)</p>
           </div>
           <div className="flex items-end justify-between">
             <p className="text-4xl font-black text-white tabular-nums tracking-tighter leading-none">
               {Math.floor(recentFuelLogs.reduce((acc, l) => acc + l.quantity, 0)).toLocaleString("pt-BR")} <span className="text-sm text-zinc-600">L</span>
             </p>
             <div className="text-right">
                <p className="text-lg font-black text-brand-accent tabular-nums tracking-tighter leading-none">
                  {Math.floor(recentFuelLogs.reduce((acc, l) => acc + (l.arlaQuantity || 0), 0)).toLocaleString("pt-BR")}
                </p>
                <p className="text-[9px] font-black text-zinc-600 uppercase mt-1 tracking-widest leading-none">Arla 32</p>
             </div>
           </div>
        </div>
        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-lg">
           <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest leading-none mb-6">Economia Operacional</p>
           <div className="flex items-end justify-between">
             <p className="text-4xl font-black text-emerald-500 tabular-nums tracking-tighter leading-none">
               R$ {(recentFuelLogs.reduce((acc, l) => acc + (l.cost || 0), 0) * 0.15).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
             </p>
           </div>
        </div>
      </div>

      <Card id="fuel-consumption-evolution-chart" className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-lg space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <h3 className="font-black text-xs text-white uppercase tracking-widest">Evolução do Consumo Mensal por Frota</h3>
            <p className="text-[10px] font-black text-zinc-500 uppercase mt-1 tracking-wider leading-none">
              Consumo de Diesel S10 acumulado nos últimos 6 meses agrupado por tipo de frota (Ônibus e Vans)
            </p>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-brand-accent" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Ônibus</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-orange-500/80" />
              <span className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Vans</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-white/40" />
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">Total</span>
            </div>
          </div>
        </div>

        <div className="h-[280px] w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={consumptionChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#18181b" />
              <XAxis 
                dataKey="month" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }} 
                dy={10}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#52525b', fontSize: 10, fontWeight: 900 }}
                tickFormatter={(value) => `${value.toLocaleString('pt-BR')} L`}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: '#09090b', 
                  border: '1px solid #27272a', 
                  borderRadius: '12px',
                  fontSize: '10.5px',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                  color: '#fff'
                }}
                labelStyle={{ color: '#ff6b00', marginBottom: '4px' }}
                itemStyle={{ padding: '2px 0', color: '#a1a1aa' }}
                formatter={(value: any, name: any) => [`${Math.floor(value).toLocaleString('pt-BR')} Litros`, name]}
              />
              <Line 
                type="monotone" 
                dataKey="Ônibus" 
                stroke="#ff6b00" 
                strokeWidth={3} 
                dot={{ fill: '#ff6b00', r: 4 }} 
                activeDot={{ r: 6, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="Vans" 
                stroke="#f97316" 
                strokeWidth={2} 
                dot={{ fill: '#f97316', r: 3 }} 
                activeDot={{ r: 5, strokeWidth: 0 }}
              />
              <Line 
                type="monotone" 
                dataKey="Total" 
                stroke="#e4e4e7" 
                strokeWidth={1.5} 
                strokeDasharray="4 4"
                dot={{ fill: '#e4e4e7', r: 2 }} 
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {fuelTanks.map(tank => {
          const percentage = (tank.currentLevel / tank.capacity) * 100;
          const isLow = percentage < 20;

          return (
            <Card key={tank.id} className="relative group border-zinc-800 bg-zinc-900/40 hover:bg-zinc-900/60 transition-all p-8 flex flex-col justify-between min-h-[320px]">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <h3 className="font-black text-2xl text-white uppercase tracking-tighter">{tank.name}</h3>
                  <span className="inline-flex px-2 py-0.5 bg-zinc-800 rounded text-[9px] font-black text-zinc-500 uppercase tracking-widest">{tank.fuelType}</span>
                </div>
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-2xl border transition-all",
                  isLow ? "bg-rose-500/10 border-rose-500/20 text-rose-500" : "bg-zinc-950 border-zinc-800 text-brand-accent"
                )}>
                  <Fuel size={32} />
                </div>
              </div>

              <div className="space-y-6 mt-12">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">Volume Atual</p>
                    <p className={cn(
                      "font-black text-4xl tracking-tighter tabular-nums leading-none",
                      isLow ? "text-rose-500" : "text-white"
                    )}>
                      {Math.floor(tank.currentLevel).toLocaleString('pt-BR')}<span className="text-sm ml-1 text-zinc-500">L</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-2">Percentual</p>
                    <p className="font-black text-xl text-zinc-300 tabular-nums leading-none">{Math.round(percentage)}%</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="w-full h-4 bg-zinc-950 rounded-full overflow-hidden border border-zinc-800 p-0.5">
                    <motion.div 
                      className={cn(
                        "h-full rounded-full shadow-lg",
                        isLow ? "bg-rose-600 shadow-rose-900/40" : "bg-brand-accent shadow-brand-accent/20"
                      )}
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, ease: 'easeOut' }}
                    />
                  </div>
                  <div className="flex justify-between px-1">
                     <span className="text-[9px] font-black text-zinc-700 uppercase">Vazio</span>
                     <span className="text-[9px] font-black text-zinc-700 uppercase">Capacidade: {Math.floor(tank.capacity).toLocaleString()}L</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-zinc-800/50 mt-4">
                  {(() => {
                    const lastEntry = [...fuelEntries].filter(e => e.tankId === tank.id).sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
                    if (lastEntry) {
                      return (
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                            <Package size={16} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-tighter leading-none mb-1.5">Último Refil (Entrada)</p>
                            <p className="text-[11px] font-black text-emerald-500 tabular-nums uppercase">
                              +{Math.floor(Number(lastEntry.quantity)).toLocaleString('pt-BR')}L • {lastEntry.timestamp ? format(parseISO(lastEntry.timestamp), 'dd MMM', { locale: ptBR }) : '---'}
                            </p>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div className="flex items-center gap-4 opacity-30">
                        <div className="w-8 h-8 bg-zinc-800 rounded-lg flex items-center justify-center text-zinc-600">
                          <Package size={14} />
                        </div>
                        <p className="text-[9px] font-black text-zinc-600 uppercase tracking-tighter">Nenhuma carga vinculada</p>
                      </div>
                    );
                  })()}
                </div>
              </div>

                {isLow && (
                  <div className="mt-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-4 animate-pulse">
                    <AlertTriangle size={20} className="text-rose-500" />
                    <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">Atenção: Nível de Reserva Ativado</span>
                  </div>
                )}
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
               <Fuel size={16} className="text-brand-accent" />
               Abastecimentos (Saídas)
            </h2>
            <div className='flex gap-2 items-center'>
                <button
                    onClick={() => setIsPrintModalOpen(true)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold border border-zinc-700 hover:bg-zinc-700 transition-all"
                >
                    <Printer size={12} />
                    Imprimir
                </button>
                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{filteredLogs.length} Registros</span>
            </div>
          </div>
          <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                <thead className="bg-zinc-900 sticky top-0">
                  <tr>
                    <th className="p-4">Data</th>
                    <th className="p-4">Placa</th>
                    <th className="p-4">Hodômetro</th>
                    <th className="p-4">Diesel (L)</th>
                    <th className="p-4">Arla (L)</th>
                    <th className="p-4">Motorista</th>
                    <th className="p-4">Bomba</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {filteredLogs.map(log => {
                    const v = vehicles.find(v => v.id === log.vehicleId);
                    const d = employees?.find(e => e.id === log.driverId);
                    return (
                      <tr key={log.id} className="hover:bg-zinc-800/20 transition-colors cursor-pointer" onClick={() => setSelectedLog(log)}>
                        <td className="p-4">{log.timestamp ? format(parseISO(log.timestamp), 'dd/MM HH:mm', { locale: ptBR }) : '---'}</td>
                        <td className="p-4 text-white">{v?.plate || '---'}</td>
                        <td className="p-4 tabular-nums">{log.odometer?.toLocaleString() || '---'}</td>
                        <td className="p-4 tabular-nums">{Math.floor(log.quantity || 0).toLocaleString('pt-BR')}</td>
                        <td className="p-4 tabular-nums">{Math.floor(log.arlaQuantity || 0).toLocaleString('pt-BR')}</td>
                        <td className="p-4">{d?.name || '---'}</td>
                        <td className="p-4">{log.isExternal ? 'Externa' : 'Interna'}</td>
                      </tr>
                    );
                  })}
                  {filteredLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-zinc-700">Nenhum registro para o período</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <Modal isOpen={isPrintModalOpen} onClose={() => setIsPrintModalOpen(false)} title="Selecionar Período">
            <div className='space-y-4 p-4'>
                <Input label="Data Inicial" type="date" value={startDate} onChange={(e: any) => setStartDate(e.target.value)} />
                <Input label="Data Final" type="date" value={endDate} onChange={(e: any) => setEndDate(e.target.value)} />
                <Button onClick={handlePrint} className='w-full'>Imprimir Lista</Button>
                <Button onClick={handleDownloadPDF} className='w-full bg-zinc-800 text-white'>PDF</Button>
            </div>
        </Modal>

        <Modal isOpen={!!selectedLog} onClose={() => setSelectedLog(null)} title="Ações Abastecimento">
            <div className="space-y-4 p-4">
                <Button onClick={() => { selectedLog && onEditFuelLog(selectedLog); setSelectedLog(null); }} className="w-full">Editar</Button>
                <Button onClick={() => { selectedLog && onDeleteFuelLog(selectedLog.id); setSelectedLog(null); }} className="w-full bg-rose-600 text-white">Excluir</Button>
            </div>
        </Modal>

        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <h2 className="text-sm font-black text-white uppercase tracking-widest flex items-center gap-2">
               <Package size={16} className="text-emerald-500" />
               Cargas / Refis (Entradas)
            </h2>
            <span className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">{fuelEntries.length} Registros</span>
          </div>
          <div className="space-y-3">
            {fuelEntries.slice(0, 5).map(entry => {
              const tank = fuelTanks.find(t => t.id === entry.tankId);
              return (
                <div key={entry.id} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-2xl flex justify-between items-center hover:bg-zinc-900/60 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center font-black text-emerald-500 text-[9px] uppercase tracking-tighter text-center leading-[1] px-1 group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors">Refil <br/> Tanque</div>
                    <div>
                      <p className="text-xs font-black text-white uppercase">{tank?.name || '---'}</p>
                      <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">
                        {entry.timestamp ? format(parseISO(entry.timestamp), 'dd MMM | HH:mm', { locale: ptBR }) : '---'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-500 tabular-nums">+{Math.floor(entry.quantity)}L</p>
                    <p className="text-[9px] font-black text-zinc-600 uppercase mt-1 tracking-widest">Carga de Estoque</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
