import React, { useMemo } from 'react';
import { cn } from '../lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export const DriverPerformanceReport = ({ trips, fuelLogs, employees }: { trips: any[], fuelLogs: any[], employees: any[] }) => {
    const performanceData = useMemo(() => {
        const stats: Record<string, { id: string; name: string; tripsCount: number; totalLiters: number; totalCost: number; }> = {};

        // Initialize for drivers
        employees.forEach(emp => {
            if (emp.role === 'Motorista') {
                stats[emp.id] = { id: emp.id, name: emp.name, tripsCount: 0, totalLiters: 0, totalCost: 0 };
            }
        });

        // Tally trips
        trips.forEach(t => {
           if (stats[t.driverId]) {
                stats[t.driverId].tripsCount++;
           }
        });

        // Tally fuel
        fuelLogs.forEach(f => {
           if (stats[f.driverId]) {
                stats[f.driverId].totalLiters += Number(f.quantity || 0);
                stats[f.driverId].totalCost += Number(f.cost || 0);
           }
        });

        return Object.values(stats).filter(s => s.tripsCount > 0 || s.totalLiters > 0);
    }, [trips, fuelLogs, employees]);

    return (
        <div className="space-y-6">
            <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
              <h3 className="text-xs font-black text-white uppercase tracking-wider">Desempenho por Motorista (Consumo e Atividade)</h3>
              <div className="h-96 w-full">
                 <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                        <XAxis dataKey="name" stroke="#71717a" fontSize={8} />
                        <YAxis stroke="#71717a" fontSize={8} />
                        <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a' }} />
                        <Legend />
                        <Bar dataKey="tripsCount" fill="#8b5cf6" name="Número de Viagens" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="totalLiters" fill="#3b82f6" name="Consumo Litros (L)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="overflow-x-auto mt-6">
                 <table className="w-full text-left text-[10px] border-collapse text-white">
                    <thead>
                        <tr className="border-b border-zinc-800 text-zinc-500 font-extrabold uppercase">
                            <th className="p-3">Motorista</th>
                            <th className="p-3">Total Viagens</th>
                            <th className="p-3">Consumo Total</th>
                            <th className="p-3">Custo Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                        {performanceData.map(stat => (
                            <tr key={stat.id} className="hover:bg-zinc-950/20">
                                <td className="p-3 font-bold">{stat.name}</td>
                                <td className="p-3 font-bold">{stat.tripsCount}</td>
                                <td className="p-3 font-bold">{stat.totalLiters.toFixed(1)} L</td>
                                <td className="p-3 font-bold">R$ {stat.totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            </tr>
                        ))}
                    </tbody>
                 </table>
              </div>
            </div>
        </div>
    );
};
