import React from 'react';
import { differenceInDays, parseISO, format } from 'date-fns';
import { AlertTriangle, Calendar, ShieldCheck, Wrench, ChevronRight, Plus, Droplets } from 'lucide-react';
import { Vehicle } from '../types';
import { cn } from '../lib/utils';

interface FleetAlertsProps {
  vehicles: Vehicle[];
  onVehicleClick: (vehicle: Vehicle) => void;
  filter?: 'vencimentos' | 'maintenance';
}

export const FleetAlerts: React.FC<FleetAlertsProps> = ({ vehicles, onVehicleClick, filter }) => {
  const alerts = (vehicles || []).flatMap(v => {
    const items = [];
    const today = new Date();

    const isVencimentos = !filter || filter === 'vencimentos';
    const isMaintenance = !filter || filter === 'maintenance';

    // 1. Licenciamentos e Autorizações de Turismo
    if (isVencimentos) {
      const docChecks = [
        { key: 'licenseExpiration', label: 'Licenciamento (CRLV)', type: 'licensing' },
        { key: 'tourismLicenseExpiration', label: 'Cert. Turismo', type: 'licensing' },
        { key: 'cadasturExpiration', label: 'CADASTUR', type: 'licensing' },
        { key: 'anttExpiration', label: 'ANTT Interestadual', type: 'licensing' },
        { key: 'mercosulLicenseExpiration', label: 'Licença MERCOSUL', type: 'licensing' },
        { key: 'detroArtespExpiration', label: 'Estadual (DETRO/ARTESP)', type: 'licensing' },
        { key: 'municipalLicenseExpiration', label: 'Licença Municipal', type: 'licensing' },
        { key: 'tacografoExpiration', label: 'Cronotacógrafo', type: 'licensing' },
        { key: 'insuranceExpiration', label: 'Seguro APP', type: 'insurance' },
      ];

      docChecks.forEach(check => {
        const dateStr = (v as any)[check.key];
        if (dateStr) {
          const days = differenceInDays(parseISO(dateStr), today);
          if (days <= 30) {
            items.push({
              id: `${v.id}-${check.key}`,
              vehicle: v,
              type: check.type,
              label: check.label,
              date: dateStr,
              days,
              priority: days <= 7 ? 'high' : 'medium'
            });
          }
        }
      });
    }

    // 3. Manutenção Preventiva (KM)
    const savedMaintKm = typeof window !== 'undefined' ? localStorage.getItem('dm_alert_maint_km') : null;
    const alertMaintKmLimit = savedMaintKm ? parseInt(savedMaintKm, 10) : 3000;

    const savedOilKm = typeof window !== 'undefined' ? localStorage.getItem('dm_alert_oil_km') : null;
    const alertOilKmLimit = savedOilKm ? parseInt(savedOilKm, 10) : 2000;

    if (isMaintenance && v.nextMaintenanceKM) {
      const kmRemaining = v.nextMaintenanceKM - v.currentOdometer;
      if (kmRemaining <= alertMaintKmLimit) {
        items.push({
          id: `${v.id}-maint-km`,
          vehicle: v,
          type: 'maintenance',
          label: 'Manutenção Prev. (KM)',
          date: new Date().toISOString(), // Fallback
          days: Math.floor(kmRemaining / 100), // Usado para ordenação aproximada
          kmRemaining,
          priority: kmRemaining <= Math.ceil(alertMaintKmLimit / 2) ? 'high' : 'medium'
        });
      }
    }

    // 4. Troca de Óleo (KM)
    if (isMaintenance && v.nextOilChangeKM) {
      const kmRemaining = v.nextOilChangeKM - v.currentOdometer;
      if (kmRemaining <= alertOilKmLimit) {
        items.push({
          id: `${v.id}-oil`,
          vehicle: v,
          type: 'oil',
          label: 'Troca de Óleo',
          date: new Date().toISOString(),
          days: Math.floor(kmRemaining / 50), // Prioridade alta na ordenação
          kmRemaining,
          priority: kmRemaining <= Math.ceil(alertOilKmLimit / 2) ? 'high' : 'medium'
        });
      }
    }

    // 5. Rotas de Manutenção Preventiva Personalizadas por KM (Alerta de 80%)
    if (isMaintenance && v.preventiveKMConfig && Array.isArray(v.preventiveKMConfig)) {
      v.preventiveKMConfig.forEach((route) => {
        const interval = Number(route.kmInterval || 0);
        const lastKM = Number(route.lastKM || 0);
        const nextDueKM = Number(route.nextDueKM || (lastKM + interval));
        const currentOdometer = Number(v.currentOdometer || 0);

        const distanceTraveled = currentOdometer - lastKM;
        const pct = interval > 0 ? (distanceTraveled / interval) * 100 : 0;

        if (pct >= 80) {
          const kmRemaining = nextDueKM - currentOdometer;
          items.push({
            id: `${v.id}-route-${route.id}`,
            vehicle: v,
            type: 'route_preventive',
            label: route.routeName || 'Revisão Preventiva',
            date: new Date().toISOString(),
            days: Math.floor(kmRemaining / 100),
            kmRemaining,
            pct: Math.min(100, Math.round(pct)),
            priority: pct >= 100 ? 'high' : 'medium'
          });
        }
      });
    }

    return items;
  }).sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1) || a.days - b.days);

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black text-asphalt-700 uppercase tracking-[0.4em] flex items-center gap-3">
          <div className="p-1 bg-brand-accent/10 rounded-md">
            <AlertTriangle size={12} className="text-brand-accent animate-pulse" />
          </div>
          {filter === 'vencimentos' ? 'Alertas de Documentação' : filter === 'maintenance' ? 'Alertas de Manutenção' : 'Alertas de Manutenção & Vencimento'}
        </h2>
        <span className="text-[10px] font-black text-brand-accent shadow-[0_0_15px_rgba(251,191,36,0.3)] bg-brand-accent/10 px-3 py-1 rounded-full uppercase tracking-widest border border-brand-accent/20">
          {alerts.length} {alerts.length === 1 ? 'Alerta Ativo' : 'Alertas Ativos'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {alerts.slice(0, 8).map((alert) => (
          <div 
            key={alert.id}
            onClick={() => onVehicleClick(alert.vehicle)}
            className="group relative highway-card p-6 hover:border-brand-accent/40 transition-all cursor-pointer overflow-hidden"
          >
            {/* Ambient Backlight */}
            <div className={cn(
              "absolute -top-12 -right-12 w-24 h-24 rounded-full blur-[40px] opacity-10 transition-opacity group-hover:opacity-30",
              alert.priority === 'high' ? "bg-rose-500" : "bg-brand-accent"
            )} />

            <div className="flex items-start justify-between relative z-10">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-4">
                   <div className={cn(
                     "w-11 h-11 rounded-xl flex items-center justify-center border shadow-inner transition-all group-hover:scale-105",
                     alert.priority === 'high' 
                       ? "bg-rose-500/10 border-rose-500/20 text-rose-500" 
                       : "bg-brand-accent/10 border-brand-accent/20 text-brand-accent"
                   )}>
                     {alert.type === 'licensing' && <Calendar size={20} className="stroke-[2.5]" />}
                     {alert.type === 'insurance' && <ShieldCheck size={20} className="stroke-[2.5]" />}
                     {alert.type === 'maintenance' && <Wrench size={20} className="stroke-[2.5]" />}
                     {alert.type === 'oil' && <Droplets size={20} className="stroke-[2.5]" />}
                     {alert.type === 'route_preventive' && <Wrench size={20} className="stroke-[2.5] text-brand-accent animate-pulse" />}
                   </div>
                   <div>
                     <p className="text-[10px] font-black text-asphalt-700 uppercase tracking-widest leading-none">
                       {alert.label}
                     </p>
                     <p className="text-base font-black text-white uppercase tracking-tight mt-1.5 flex items-center gap-2">
                       {alert.vehicle.plate}
                       {alert.priority === 'high' && <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />}
                     </p>
                   </div>
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <p className={cn(
                    "text-[10px] font-black uppercase tracking-tighter flex items-center gap-1.5",
                    (alert.days !== undefined && alert.days <= 0) || (alert.kmRemaining !== undefined && alert.kmRemaining <= 100) || (alert.type === 'route_preventive' && alert.pct >= 100) ? "text-rose-500" : alert.priority === 'high' ? "text-rose-400" : "text-brand-accent"
                  )}>
                    {alert.type === 'route_preventive'
                      ? `${alert.pct}% LIMITE ALCANÇADO`
                      : alert.kmRemaining !== undefined 
                        ? `${alert.kmRemaining.toLocaleString()} KM RESTANTES`
                        : alert.days < 0 
                          ? "Prazo Vencido [" + Math.abs(alert.days) + "d]"
                          : alert.days === 0 
                            ? "Vencimento Hoje" 
                            : "Vence em " + alert.days + " dias"}
                  </p>
                  <div className="h-[2px] w-12 bg-asphalt-800 rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        alert.priority === 'high' ? "bg-rose-500" : "bg-brand-accent"
                      )}
                      style={{ 
                        width: alert.type === 'route_preventive'
                          ? `${alert.pct}%`
                          : alert.kmRemaining !== undefined 
                            ? `${Math.max(10, Math.min(100, (1 - alert.kmRemaining / (alert.type === 'oil' ? 1000 : 1500)) * 100))}%`
                            : `${Math.max(10, Math.min(100, (1 - alert.days / 30) * 100))}%` 
                      }}
                    />
                  </div>
                  <p className="text-[9px] font-bold text-asphalt-700 uppercase tracking-widest mt-1">
                    {alert.type === 'route_preventive'
                      ? `Faltam: ${alert.kmRemaining <= 0 ? 'CRÍTICO' : `${alert.kmRemaining.toLocaleString()} KM`} (${alert.vehicle.currentOdometer.toLocaleString()} / ${(alert.vehicle.currentOdometer + alert.kmRemaining).toLocaleString()} KM)`
                      : alert.kmRemaining !== undefined 
                        ? `Estimativa: ${alert.vehicle.currentOdometer + alert.kmRemaining} KM`
                        : `Vence em: ${format(parseISO(alert.date), 'dd/MM/yyyy')}`}
                  </p>
                </div>
              </div>

              <div className="p-2.5 bg-asphalt-950 rounded-xl text-asphalt-800 group-hover:text-brand-accent group-hover:bg-brand-accent/5 transition-all">
                <ChevronRight size={18} />
              </div>
            </div>
          </div>
        ))}
        {alerts.length > 8 && (
          <div className="flex flex-col items-center justify-center p-6 bg-asphalt-900/20 border border-dashed border-asphalt-800 rounded-2xl group hover:bg-asphalt-900/40 hover:border-asphalt-700 transition-all cursor-pointer">
            <p className="text-[9px] font-black text-asphalt-800 uppercase tracking-[0.3em] mb-3">Mais {alerts.length - 8} alertas</p>
            <div className="w-10 h-10 bg-asphalt-800 rounded-full flex items-center justify-center text-asphalt-700 group-hover:bg-asphalt-700 group-hover:text-asphalt-600 transition-all shadow-lg">
              <Plus size={20} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
