import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  FileText, 
  MapPin, 
  Printer, 
  ChevronDown, 
  ChevronUp, 
  Paperclip, 
  StickyNote,
  Clock,
  Trash2
} from 'lucide-react';
import { Trip } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { AttachmentViewer } from './AttachmentViewer';

interface ServiceOrderListItemProps {
  trip: Trip;
  onSelect: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
}

/**
 * Versão atualizada do item de lista de OS com o novo AttachmentViewer.
 */
export const ServiceOrderListItem: React.FC<ServiceOrderListItemProps> = ({ trip, onSelect, onDelete }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={cn(
        "group bg-asphalt-900 border transition-all duration-500 rounded-3xl overflow-hidden shadow-2xl",
        isExpanded ? "border-brand-accent ring-1 ring-brand-accent/20" : "border-asphalt-800 hover:border-asphalt-700"
      )}
    >
      {/* Header / Basic Info */}
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-black text-white uppercase text-base tracking-tighter leading-none group-hover:text-brand-accent transition-colors">
              {trip.title}
            </h3>
            <p className="text-[10px] font-black text-asphalt-700 uppercase tracking-widest">
              {trip.osNumber ? trip.osNumber : trip.id.substring(0, 8).toUpperCase()} • {trip.tripType === 'state' ? 'ESTADUAL' : trip.tripType === 'interstate' ? 'INTERESTADUAL' : 'MERCOSUL'}
            </p>
          </div>
          <div className={cn(
            "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
            trip.status === 'scheduled' ? "bg-blue-500/10 text-blue-500 border border-blue-500/20" :
            trip.status === 'active' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse" :
            trip.status === 'completed' ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
            "bg-zinc-500/10 text-zinc-500 border border-zinc-500/20"
          )}>
            {trip.status === 'scheduled' ? 'Agendada' : trip.status === 'active' ? 'Em Curso' : trip.status === 'completed' ? 'Finalizada' : 'Cancelada'}
          </div>
        </div>

        <div className="flex items-center gap-4 py-4 px-4 bg-asphalt-950/50 rounded-2xl border border-asphalt-800/50">
          <div className="flex flex-col items-center gap-1">
            <MapPin size={14} className="text-brand-accent" />
            <div className="w-[1px] h-4 bg-asphalt-800" />
            <MapPin size={14} className="text-asphalt-700" />
          </div>
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            <div>
              <p className="text-[8px] font-black text-asphalt-700 uppercase tracking-tighter">Origem</p>
              <p className="text-[10px] font-black text-white uppercase truncate tracking-tight">{trip.origin}</p>
            </div>
            <div>
              <p className="text-[8px] font-black text-asphalt-700 uppercase tracking-tighter">Destino</p>
              <p className="text-[10px] font-black text-white uppercase truncate tracking-tight">{trip.destination}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 bg-asphalt-950/30 rounded-xl border border-asphalt-800/50">
             <p className="text-[8px] font-black text-asphalt-700 uppercase mb-1">Partida</p>
             <p className="text-[10px] font-black text-white uppercase tracking-tight">
               {format(parseISO(trip.startDate), 'dd/MM/yy', { locale: ptBR })}
             </p>
          </div>
          <div className="p-3 bg-asphalt-950/30 rounded-xl border border-asphalt-800/50">
             <p className="text-[8px] font-black text-asphalt-700 uppercase mb-1">Passageiros</p>
             <p className="text-[10px] font-black text-white uppercase tracking-tight">{trip.passengerCount || trip.passengers.length || 0} PAX</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => onSelect(trip)}
            className="flex-1 py-4 bg-brand-accent text-asphalt-950 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3"
          >
            <Printer size={16} strokeWidth={3} />
            Gerar OS
          </button>
          <button 
            onClick={() => onDelete(trip)}
            className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl transition-all active:scale-95"
            title="Excluir OS de Viagem"
          >
            <Trash2 size={20} />
          </button>
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className={cn(
              "p-4 rounded-2xl border transition-all active:scale-95",
              isExpanded 
                ? "bg-brand-accent/10 border-brand-accent/30 text-brand-accent" 
                : "bg-asphalt-800 border-asphalt-700 text-asphalt-400 hover:bg-asphalt-700"
            )}
          >
            {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="border-t border-asphalt-800"
          >
            <div className="p-6 bg-asphalt-950/50 space-y-8">
              {/* Stops */}
              {trip.stops && trip.stops.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-asphalt-500 uppercase tracking-widest flex items-center gap-2">
                    <MapPin size={12} /> Paradas Intermediárias
                  </h4>
                  <div className="space-y-3 pl-2">
                    {trip.stops.map((stop, idx) => (
                      <div key={idx} className="flex items-center gap-4 group/stop">
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-2 h-2 rounded-full bg-brand-accent/50" />
                          {idx !== trip.stops.length - 1 && <div className="w-[1px] h-6 bg-asphalt-800" />}
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-asphalt-900/50 p-3 rounded-xl border border-asphalt-800/50">
                          <span className="text-[10px] font-bold text-white uppercase tracking-tight">{stop.location}</span>
                          <div className="flex items-center gap-2 text-asphalt-700">
                             <Clock size={10} />
                             <span className="text-[9px] font-black">{stop.arrivalTime}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              {trip.notes && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-asphalt-500 uppercase tracking-widest flex items-center gap-2">
                    <StickyNote size={12} /> Observações Internas
                  </h4>
                  <div className="bg-asphalt-900 border border-asphalt-800/50 p-4 rounded-2xl relative overflow-hidden">
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-brand-accent/30" />
                    <p className="text-asphalt-400 text-[11px] leading-relaxed italic font-medium">
                      "{trip.notes}"
                    </p>
                  </div>
                </div>
              )}

              {/* Attachments with the new shadow component */}
              {trip.attachments && trip.attachments.length > 0 && (
                <AttachmentViewer attachments={trip.attachments} />
              )}

              {(!trip.stops || trip.stops.length === 0) && !trip.notes && (!trip.attachments || trip.attachments.length === 0) && (
                <div className="py-4 text-center">
                  <p className="text-[9px] font-black text-asphalt-800 uppercase tracking-[0.2em]">Sem informações adicionais</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
