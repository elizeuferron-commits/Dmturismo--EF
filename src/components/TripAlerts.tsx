import React, { useEffect, useState, useRef } from 'react';
import { differenceInMinutes, parseISO, isAfter } from 'date-fns';
import { toast } from 'sonner';
import { Bell, MapPin, Clock } from 'lucide-react';
import { Trip } from '../types';

interface TripAlertsProps {
  trips: Trip[];
}

/**
 * 🌑 COMPONENTE EM MODO SOMBRA
 * Monitora viagens agendadas e dispara notificações 1 hora antes do início.
 */
export const TripAlerts: React.FC<TripAlertsProps> = ({ trips }) => {
  const [notifiedTripIds, setNotifiedTripIds] = useState<Set<string>>(new Set());
  const checkInterval = useRef<NodeJS.Timeout | null>(null);

  const checkTrips = () => {
    const now = new Date();
    
    trips.forEach(trip => {
      if (trip.status !== 'scheduled') return;
      if (notifiedTripIds.has(trip.id)) return;

      try {
        const startDate = parseISO(trip.startDate);
        
        // Só alertar se a viagem ainda for acontecer
        if (isAfter(startDate, now)) {
          const diffMinutes = differenceInMinutes(startDate, now);
          
          // Alerta se faltar 60 minutos ou menos
          if (diffMinutes <= 60 && diffMinutes > 0) {
            toast.info(`Viagem Próxima: ${trip.title}`, {
              description: `Inicia em aproximadamente ${diffMinutes} minutos. Rota: ${trip.origin} ➔ ${trip.destination}`,
              icon: <Bell className="text-brand-accent" size={18} />,
              duration: 10000, // 10 segundos
              action: {
                label: 'Ver Detalhes',
                onClick: () => {
                   // Lógica para abrir a viagem poderia ser injetada via props
                   console.log('Ver detalhes da viagem:', trip.id);
                }
              }
            });

            setNotifiedTripIds(prev => new Set([...prev, trip.id]));
          }
        }
      } catch (error) {
        console.error('Erro ao processar data da viagem no TripAlerts:', error);
      }
    });
  };

  useEffect(() => {
    // Check immediately when trips data changes
    checkTrips();

    // Set up a recurring check every minute to handle time passing
    checkInterval.current = setInterval(checkTrips, 60000);

    return () => {
      if (checkInterval.current) {
        clearInterval(checkInterval.current);
      }
    };
  }, [trips, notifiedTripIds]);

  // Este componente não renderiza nada visualmente, apenas gerencia os toasts
  return null;
};
