import React, { useMemo, useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  MapPin, 
  ShieldCheck, 
  Globe, 
  Map, 
  SquareCheck, 
  Paperclip, 
  FileText, 
  Edit3, 
  Trash2, 
  Users, 
  User, 
  TrendingUp,
  Download,
  Wrench,
  Route,
  MessageSquare,
  AlertTriangle,
  Star,
  Gift,
  Lightbulb,
  Clock,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  X,
  Hotel,
  Utensils,
  DollarSign,
  Building2
} from 'lucide-react';
import { format, parseISO, isAfter, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './Cards';
import { cn } from '../lib/utils';
import { Trip, Vehicle, Employee, MaintenanceLog, TripObservation } from '../types';
import { toast } from 'sonner';
import { List } from 'react-window';
import { CharteredRoutes } from './CharteredRoutes';
import { db, cleanUndefined } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {},
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface TripsManagementProps {
  trips: Trip[];
  vehicles: Vehicle[];
  employees: Employee[];
  maintenance?: MaintenanceLog[];
  tripSearch: string;
  setTripSearch: (v: string) => void;
  tripStatusFilter: string;
  setTripStatusFilter: (v: string) => void;
  tripTypeFilter: string;
  setTripTypeFilter: (v: string) => void;
  tripDateStart: string;
  setTripDateStart: (v: string) => void;
  tripDateEnd: string;
  setTripDateEnd: (v: string) => void;
  onAddTrip: () => void;
  onAddCompletedTrip?: () => void;
  onEditTrip: (trip: Trip) => void;
  onDeleteTrip: (trip: Trip) => void;
  onViewOS: (trip: Trip) => void;
  onOpenAttachments: (trip: Trip) => void;
  onAddMaintenanceForVehicle?: (vehicleId: string) => void;
  isLoading?: boolean;

  // CharteredRoutes integrated props
  charteredRoutes: any[];
  currentUserRole?: string;
  currentUserEmail?: string;
}

export const TripsManagement: React.FC<TripsManagementProps> = React.memo(({
  trips,
  vehicles,
  employees,
  maintenance = [],
  tripSearch,
  setTripSearch,
  tripStatusFilter,
  setTripStatusFilter,
  tripTypeFilter,
  setTripTypeFilter,
  tripDateStart,
  setTripDateStart,
  tripDateEnd,
  setTripDateEnd,
  onAddTrip,
  onAddCompletedTrip,
  onEditTrip,
  onDeleteTrip,
  onViewOS,
  onOpenAttachments,
  onAddMaintenanceForVehicle,
  isLoading = false,

  charteredRoutes,
  currentUserRole,
  currentUserEmail
}) => {
  const [activeMainTab, setActiveMainTab] = useState<'trips' | 'charter' | 'history'>('trips');

  // New observation/experience states
  const [selectedTripForObs, setSelectedTripForObs] = useState<Trip | null>(null);
  const [isObsModalOpen, setIsObsModalOpen] = useState(false);
  const [obsType, setObsType] = useState<'complaint' | 'compliment' | 'lost_found' | 'improvement'>('improvement');
  const [obsAuthor, setObsAuthor] = useState('');
  const [obsText, setObsText] = useState('');
  const [isSubmittingObs, setIsSubmittingObs] = useState(false);

  // Trips with finalizada / completed status or whose date is in the past
  const historyTrips = useMemo(() => {
    return trips.filter(t => {
      const isCompleted = t.status === 'completed';
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const isPast = t.endDate ? new Date(t.endDate) < today : new Date(t.startDate) < today;
      
      const matchesSearch = !tripSearch || 
        t.title.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.origin.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.destination.toLowerCase().includes(tripSearch.toLowerCase());

      return (isCompleted || isPast) && t.status !== 'cancelled' && matchesSearch;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [trips, tripSearch]);

  const getTripDateStatus = (trip: Trip) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const start = new Date(trip.startDate);
    const startZero = new Date(trip.startDate);
    startZero.setHours(0, 0, 0, 0);

    const end = trip.endDate ? new Date(trip.endDate) : start;
    const endZero = trip.endDate ? new Date(trip.endDate) : startZero;
    endZero.setHours(23, 59, 59, 999);

    if (trip.status === 'cancelled') {
      return {
        label: 'Cancelada',
        colorClass: 'bg-red-950/40 text-red-400 border border-red-900/30',
        badge: 'Cancelada',
        icon: <AlertTriangle size={12} className="text-red-400" />
      };
    }

    if (trip.status === 'completed' || today.getTime() > endZero.getTime()) {
      return {
        label: 'Finalizado',
        colorClass: 'bg-zinc-800/60 text-zinc-400 border border-zinc-700/50',
        badge: '✓ Finalizado',
        icon: <CheckCircle size={12} className="text-zinc-400" />
      };
    }

    // Se é hoje ou se hoje está entre início e fim
    if (today.getTime() >= startZero.getTime() && today.getTime() <= endZero.getTime()) {
      return {
        label: 'Em rota',
        colorClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 animate-pulse',
        badge: '● Em Rota',
        icon: <Clock size={12} className="text-emerald-400 animate-spin" style={{ animationDuration: '4s' }} />
      };
    }

    // Se é futuro, calcula quantos dias faltam
    const diffTime = startZero.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return {
        label: `Faltam ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
        colorClass: 'bg-[#ff6b00]/10 text-[#ff6b00] border border-[#ff6b00]/20',
        badge: `⏱ Faltam ${diffDays} d`,
        icon: <Clock size={12} className="text-[#ff6b00]" />
      };
    }

    return {
      label: 'Agendada',
      colorClass: 'bg-zinc-800/80 text-zinc-300 border border-zinc-700',
      badge: 'Agendada',
      icon: <Clock size={12} className="text-zinc-400" />
    };
  };

  const handleOpenObservations = (trip: Trip) => {
    setSelectedTripForObs(trip);
    setObsType('improvement');
    setObsAuthor('');
    setObsText('');
    setIsObsModalOpen(true);
  };

  const handleQuickCompleteTrip = async (trip: Trip) => {
    try {
      const tripRef = doc(db, 'trips', trip.id);
      await updateDoc(tripRef, cleanUndefined({
        status: 'completed',
        updatedAt: new Date().toISOString()
      }));
      toast.success("Viagem Finalizada", {
        description: `A viagem "${trip.title}" foi arquivada e agora está disponível no histórico.`
      });
      handleOpenObservations({ ...trip, status: 'completed' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trips/${trip.id}`);
      toast.error("Erro ao finalizar viagem", { description: "Verifique as permissões de acesso ao banco de dados." });
    }
  };

  const handleAddObservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripForObs) return;
    if (!obsAuthor.trim() || !obsText.trim()) {
      toast.error("Por favor, preencha todos os campos.");
      return;
    }

    setIsSubmittingObs(true);
    try {
      const newObs: TripObservation = {
        id: Math.random().toString(36).substring(2, 9),
        type: obsType,
        text: obsText,
        author: obsAuthor,
        createdAt: new Date().toISOString()
      };

      const updatedObservations = [...(selectedTripForObs.observations || []), newObs];
      const tripRef = doc(db, 'trips', selectedTripForObs.id);
      
      await updateDoc(tripRef, cleanUndefined({
        observations: updatedObservations,
        updatedAt: new Date().toISOString()
      }));

      setSelectedTripForObs(prev => prev ? { ...prev, observations: updatedObservations } : null);
      setObsText('');
      setObsAuthor('');
      toast.success("Observação Registrada", {
        description: "A sua observação foi salva com sucesso no histórico da viagem."
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `trips/${selectedTripForObs.id}`);
      toast.error("Erro ao registrar observação");
    } finally {
      setIsSubmittingObs(false);
    }
  };

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const isCompleted = t.status === 'completed';
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      const isPast = t.endDate ? new Date(t.endDate) < today : new Date(t.startDate) < today;
      const isRealized = isCompleted || isPast;

      const matchesSearch = !tripSearch || 
        t.title.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.origin.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.destination.toLowerCase().includes(tripSearch.toLowerCase());
      
      const matchesStatus = tripStatusFilter === 'all' || t.status === tripStatusFilter;
      const matchesType = tripTypeFilter === 'all' || t.tripType === tripTypeFilter;
      
      let matchesDate = true;
      if (tripDateStart) {
        matchesDate = matchesDate && isAfter(parseISO(t.startDate), addDays(parseISO(tripDateStart), -1));
      }
      if (tripDateEnd) {
        matchesDate = matchesDate && isBefore(parseISO(t.startDate), addDays(parseISO(tripDateEnd), 1));
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesDate && !isRealized;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [trips, tripSearch, tripStatusFilter, tripTypeFilter, tripDateStart, tripDateEnd]);

  // Response and sizing calculations for react-window
  const [columns, setColumns] = useState(1);
  const [listHeight, setListHeight] = useState(600);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setColumns(3);
      } else if (window.innerWidth >= 768) {
        setColumns(2);
      } else {
        setColumns(1);
      }
      const calculated = window.innerHeight - 450;
      setListHeight(calculated > 300 ? calculated : 500);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const tripChunks = useMemo(() => {
    const chunks: Trip[][] = [];
    for (let i = 0; i < filteredTrips.length; i += columns) {
      chunks.push(filteredTrips.slice(i, i + columns));
    }
    return chunks;
  }, [filteredTrips, columns]);

  // Fast PDF summary generation for clean, corporate itinerary documentation
  const handleDownloadItinerarySummary = async (trip: Trip) => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      // Theme brand colours
      const primaryColor: [number, number, number] = [255, 107, 0]; // Brand Accent orange
      const darkColor: [number, number, number] = [39, 39, 42]; // Zinc 800
      
      // Header Section
      doc.setFillColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.rect(0, 0, 210, 40, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text("DM TURISMO", 15, 18);
      
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text("SÍNTESE DE ITINERÁRIO E ESCALA TÉCNICA", 15, 26);
      
      doc.setTextColor(161, 161, 170);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.text(`Código Único: ${trip.id.toUpperCase()}`, 15, 32);
      doc.text(`Emissão: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, 130, 32);

      // Section metadata Table
      const vehicle = vehicles.find(v => v.id === trip.vehicleId);
      const driver = employees.find(e => e.id === trip.driverId);
      const secondDriver = employees.find(e => e.id === trip.secondDriverId);

      autoTable(doc, {
        startY: 48,
        head: [['DURAÇÃO DA ESCALA', 'VEÍCULO PRINCIPAL', 'MOTORISTAS DE ESCALA']],
        body: [[
          `${format(new Date(trip.startDate), 'dd/MM/yyyy')} a ${format(new Date(trip.endDate), 'dd/MM/yyyy')}`,
          `${vehicle?.model.toUpperCase() || 'NÃO CONSETIDO'}\nPlaca: ${vehicle?.plate.toUpperCase() || 'S/ RECEITA'}`,
          `Titular: ${(driver?.name || trip.driverId || 'NÃO DEFINIDO').toUpperCase()}\n${secondDriver || trip.secondDriverId ? `Reserva: ${(secondDriver?.name || trip.secondDriverId || '').toUpperCase()}` : 'Sem Motorista Reserva'}`
        ]],
        theme: 'grid',
        headStyles: { fillColor: primaryColor, fontStyle: 'bold', fontSize: 9 },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] }
      });

      // Stops Section
      const stopsHeader = [['ORD', 'PONTO DE EMBARQUE / REFERÊNCIA', 'AGENDAMENTO']];
      const stopsRows = trip.stops.map((stop, index) => [
        (index + 1).toString().padStart(2, '0'),
        stop.location.toUpperCase(),
        stop.arrivalTime || '--:--'
      ]);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text("REGISTRO DE PARADAS E ESCALAS EFETUADAS", 15, (doc as any).lastAutoTable.finalY + 12);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 16,
        head: stopsHeader,
        body: stopsRows,
        theme: 'striped',
        headStyles: { fillColor: darkColor, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] }
      });

      // Passenger Section
      const passengerHeader = [['ORD', 'PASSAGEIRO CADASTRADO', 'DOCUMENTO RG']];
      const passengerRows = trip.passengers.map((p, idx) => [
        (idx + 1).toString().padStart(2, '0'),
        p.name.toUpperCase(),
        p.document || 'NÃO INFORMADO'
      ]);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(darkColor[0], darkColor[1], darkColor[2]);
      doc.text("RELAÇÃO DE PASSAGEIROS DA ESCALA", 15, (doc as any).lastAutoTable.finalY + 12);

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 16,
        head: passengerHeader,
        body: passengerRows,
        theme: 'striped',
        headStyles: { fillColor: darkColor, fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [50, 50, 50] }
      });

      // Footer signature
      const finalY = (doc as any).lastAutoTable.finalY;
      if (finalY < 240) {
        doc.line(15, 260, 195, 260);
        doc.setFontSize(7);
        doc.setTextColor(120, 120, 120);
        doc.text("Documento oficial emitido e validado eletronicamente no sistema integrado DM Turismo Pro.", 15, 265);
        doc.text("Página 01 / 01", 175, 265);
      }

      doc.save(`ITINERARIO_${trip.title.replace(/\s+/g, '_').toUpperCase()}.pdf`);
      toast.success("Itinerário sincronizado!", {
        description: "O documento PDF foi estruturado e baixado com sucesso."
      });
    } catch (err: any) {
      toast.error("Erro ao gerar itinerário PDF", { description: err.message });
    }
  };

  const itemSize = columns === 1 ? 550 : columns === 2 ? 540 : 560;

  const TripGridRow = ({ index, style }: { index: number; style: React.CSSProperties }) => {
    const chunk = tripChunks[index];
    if (!chunk) return null;
    return (
      <div style={style} className="flex gap-8 pr-2">
        {chunk.map(trip => {
          const vehicle = vehicles.find(v => v.id === trip.vehicleId);
          return (
            <Card 
              key={trip.id} 
              className={cn("flex-1 highway-card bg-zinc-900 border-zinc-800 p-6 space-y-4 hover:border-brand-accent/50 transition-all group flex flex-col justify-between", trip.status === 'active' && 'is-active')}
              style={{ height: 'calc(100% - 24px)' }}
            >
              <div className="space-y-4 flex-1 flex flex-col justify-start">
                <div className="flex justify-between items-start shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="px-3 py-1 bg-zinc-800 rounded-lg text-[10px] font-black uppercase text-zinc-400 group-hover:text-brand-accent transition-colors flex items-center gap-2">
                      {vehicle?.prefix && (
                        <span className="text-brand-accent bg-brand-accent/10 px-1 rounded border border-brand-accent/20">
                          {vehicle.prefix}
                        </span>
                      )}
                      {vehicle?.plate || 'S/ PLACA'}
                    </div>
                    <div className="p-1.5 bg-zinc-800 rounded-lg text-zinc-500">
                       {trip.tripType === 'mercosur' ? <ShieldCheck size={14} className="text-emerald-500" /> : 
                        trip.tripType === 'interstate' ? <Globe size={14} className="text-brand-accent" /> : 
                        <Map size={14} />}
                    </div>
                  </div>
                  {(() => {
                    const statusInfo = getTripDateStatus(trip);
                    return (
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg shrink-0 flex items-center gap-1.5 border",
                        statusInfo.colorClass
                      )}>
                        {statusInfo.icon}
                        {statusInfo.badge}
                      </span>
                    );
                  })()}
                </div>
                
                <div className="shrink-0">
                  {trip.client && (
                    <div className="text-[9px] text-brand-accent font-black uppercase tracking-widest mb-1 flex items-center gap-1">
                      <Building2 size={11} className="text-brand-accent/70" />
                      <span>{trip.client}</span>
                    </div>
                  )}
                  <h4 className="font-black text-white uppercase text-lg tracking-tight mb-1 line-clamp-1">{trip.title}</h4>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-bold uppercase truncate">
                    <MapPin size={12} className="text-brand-accent" />
                    {trip.origin} ➔ {trip.destination}
                  </div>
                </div>

                {/* Journey Progress Bar */}
                {(() => {
                  if (!trip.startDate) return null;
                  const start = new Date(trip.startDate).getTime();
                  const end = trip.endDate ? new Date(trip.endDate).getTime() : start;
                  const now = new Date().getTime();
                  
                  let percentage = 0;
                  let statusText = '';
                  
                  if (trip.status === 'completed') {
                    percentage = 100;
                    statusText = '100% CONCLUÍDO';
                  } else if (trip.status === 'cancelled') {
                    percentage = 0;
                    statusText = 'CANCELADA';
                  } else {
                    if (now <= start) {
                      percentage = 0;
                      const diffMs = start - now;
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffHours / 24);
                      if (diffDays > 0) {
                        statusText = `FALTA(M) ${diffDays} DIA(S) PARA INICIAR`;
                      } else if (diffHours > 0) {
                        statusText = `FALTA(M) ${diffHours} HORA(S) PARA INICIAR`;
                      } else {
                        statusText = 'INICIA EM BREVE';
                      }
                    } else if (now >= end) {
                      percentage = 100;
                      statusText = 'PERÍODO ENCERRADO';
                    } else {
                      const total = end - start;
                      if (total > 0) {
                        percentage = Math.round(((now - start) / total) * 100);
                      } else {
                        percentage = 100;
                      }
                      statusText = `${percentage}% EM ANDAMENTO`;
                    }
                  }

                  return (
                    <div className="space-y-2 shrink-0 py-1 bg-zinc-950/20 p-3 rounded-xl border border-zinc-900/40">
                      <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider">
                        <span className="text-zinc-500">Progresso da Viagem</span>
                        <span className={cn(
                          "font-black tracking-tight",
                          percentage === 100 ? "text-emerald-400" : "text-brand-accent"
                        )}>
                          {statusText}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-zinc-950 rounded-full overflow-hidden relative">
                        <div 
                          className={cn(
                            "h-full rounded-full transition-all duration-500 ease-out",
                            percentage === 100 ? "bg-emerald-500" : "bg-brand-accent"
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[8px] font-mono font-black text-zinc-600">
                        <span>{format(new Date(trip.startDate), 'dd/MM/yyyy HH:mm')}</span>
                        <span>{trip.endDate ? format(new Date(trip.endDate), 'dd/MM/yyyy HH:mm') : format(new Date(trip.startDate), 'dd/MM/yyyy HH:mm')}</span>
                      </div>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-2.5 shrink-0 py-2.5 px-3.5 bg-zinc-950/40 rounded-xl border border-zinc-850/60">
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Hotel size={13} className="text-zinc-500 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Hospedagem</span>
                      <span className="text-[9px] font-black text-white uppercase mt-0.5 truncate">{trip.accommodation || 'Por Conta'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-hidden">
                    <Utensils size={13} className="text-zinc-500 shrink-0" />
                    <div className="flex flex-col overflow-hidden">
                      <span className="text-[7.5px] text-zinc-500 font-bold uppercase tracking-widest leading-none">Alimentação</span>
                      <span className="text-[9px] font-black text-white uppercase mt-0.5 truncate">{trip.meals || 'Por Conta'}</span>
                    </div>
                  </div>
                  {trip.tripValue !== undefined && trip.tripValue !== null && (
                    <div className="col-span-2 pt-2 mt-1 border-t border-zinc-900/60 flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <DollarSign size={13} className="text-emerald-500 shrink-0" />
                        <span className="text-[7.5px] text-zinc-400 font-black uppercase tracking-widest">Valor da O.S.</span>
                      </div>
                      <span className="text-[11px] font-black text-brand-accent font-mono">
                        R$ {Number(trip.tripValue).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>

                <div className="py-3 px-4 bg-zinc-950/50 rounded-xl border border-zinc-800/50 flex items-center justify-between shrink-0">
                   <div className="flex items-center gap-2">
                      <SquareCheck size={14} className={cn(
                        trip.documentation.every(d => d.checked) ? "text-emerald-500" : "text-amber-500"
                      )} />
                      <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Documentação</span>
                   </div>
                   <span className="text-[9px] font-black text-white">
                      {trip.documentation.filter(d => d.checked).length} / {trip.documentation.length}
                   </span>
                </div>

                {trip.attachments && (trip.attachments as any[]).length > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenAttachments(trip);
                    }}
                    className="py-2 px-4 bg-emerald-500/10 rounded-xl border border-emerald-500/20 flex items-center justify-between hover:bg-emerald-500/20 transition-all cursor-pointer group w-full shrink-0"
                  >
                    <div className="flex items-center gap-2">
                      <Paperclip size={12} className="text-emerald-500 group-hover:scale-110 transition-transform" />
                      <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">Documentos Salvos</span>
                    </div>
                    <span className="text-[9px] font-black text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      {(trip.attachments as any[]).length}
                    </span>
                  </button>
                )}

                {trip.status === 'active' && onAddMaintenanceForVehicle && (
                  <div className="flex flex-col gap-2 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddMaintenanceForVehicle(trip.vehicleId);
                      }}
                      className="py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 border border-brand-accent/20 hover:border-brand-accent text-brand-accent hover:text-white font-black text-[9px] uppercase tracking-widest rounded-xl flex items-center justify-between transition-all cursor-pointer w-full group"
                    >
                      <div className="flex items-center gap-1.5">
                        <Wrench size={12} className="text-brand-accent group-hover:rotate-45 transition-all duration-300" />
                        <span>Atalho de Manutenção</span>
                      </div>
                      <Wrench size={12} className="text-brand-accent" />
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4 shrink-0">
                {/* Botões de Observações e Acompanhamento de Experiência */}
                {(() => {
                  const isPastOrFinished = trip.status === 'completed' || (new Date(trip.endDate || trip.startDate) < new Date());
                  return (
                    <div className="space-y-2">
                      {isPastOrFinished ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenObservations(trip);
                          }}
                          className="w-full py-2.5 px-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-brand-accent/50 rounded-xl flex items-center justify-between transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-2">
                            <MessageSquare size={13} className="text-brand-accent group-hover:scale-110 transition-transform" />
                            <span className="text-[9px] font-black text-zinc-300 uppercase tracking-widest font-sans">Observações & Experiência</span>
                          </div>
                          <span className="text-[9px] font-black text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded-lg">
                            {trip.observations?.length || 0}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuickCompleteTrip(trip);
                          }}
                          className="w-full py-2.5 px-4 bg-emerald-950/20 hover:bg-emerald-900/40 border border-emerald-900/30 hover:border-emerald-600 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer group"
                        >
                          <CheckCircle size={13} className="text-emerald-400 group-hover:scale-110 transition-transform" />
                          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest font-sans">Finalizar Viagem</span>
                        </button>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center gap-2">
                   <button
                    onClick={() => onViewOS(trip)}
                    className="flex-1 py-2.5 bg-zinc-800 rounded-xl text-[10px] font-black text-white uppercase tracking-widest hover:bg-zinc-700 transition-all flex items-center justify-center gap-2"
                    title="Ver Ordem de Serviço"
                   >
                    <FileText size={14} className="text-brand-accent" />
                    O.S.
                   </button>
                   <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadItinerarySummary(trip);
                    }}
                    className="w-12 h-10 bg-zinc-800 rounded-xl text-zinc-400 hover:text-brand-accent flex items-center justify-center transition-all"
                    title="Exportar Itinerário Simplificado PDF"
                   >
                    <Download size={16} />
                   </button>
                   <button
                    onClick={() => onEditTrip(trip)}
                    className="w-12 h-10 bg-zinc-800 rounded-xl text-zinc-400 hover:text-brand-accent flex items-center justify-center transition-all"
                    title="Editar Viagem"
                   >
                    <Edit3 size={16} />
                   </button>
                   <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteTrip(trip);
                    }}
                    className="w-12 h-10 bg-zinc-800 rounded-xl text-zinc-400 hover:text-rose-500 flex items-center justify-center transition-all"
                    title="Excluir Viagem"
                   >
                    <Trash2 size={16} />
                   </button>
                </div>

                <div className="pt-4 border-t border-zinc-800/50 flex flex-col gap-3">
                  <div className="flex justify-between items-center">
                    <div className="space-y-1">
                      <p className="text-[8px] text-zinc-600 font-black uppercase tracking-widest leading-none">Início</p>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase">{format(new Date(trip.startDate), "HH:mm '•' dd MMM", { locale: ptBR })}</p>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/50 rounded-lg text-zinc-400">
                       <Users size={14} />
                       <span className="text-[10px] font-black">{trip.passengerCount || 0}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                     <User size={12} className="text-zinc-500" />
                     <div className="flex flex-wrap gap-x-2">
                       <span className="text-[9px] font-black text-zinc-400 uppercase">
                         {(employees.find(e => e.id === trip.driverId)?.name || trip.driverId || 'S/M').split(' ')[0]}
                       </span>
                       {(trip.secondDriverId) && (
                         <span className="text-[9px] font-black text-brand-accent uppercase">
                           + {(employees.find(e => e.id === trip.secondDriverId)?.name || trip.secondDriverId || '').split(' ')[0]}
                         </span>
                       )}
                     </div>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
        {chunk.length < columns && 
          Array.from({ length: columns - chunk.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 invisible" />
          ))
        }
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* HEADER UNIFICADO COM ABAS PREMIUM */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent shadow">
            <Route size={24} />
          </div>
          <div>
            <span className="text-[8px] font-black tracking-widest text-[#ff6b00] uppercase font-sans">DM Viagens & Fretamento</span>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Tráfego de Operações</h1>
          </div>
        </div>

        <div className="flex bg-zinc-950 p-1 rounded-2xl border border-zinc-850 self-start md:self-auto">
          <button
            onClick={() => setActiveMainTab('trips')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeMainTab === 'trips'
                ? "bg-brand-accent text-zinc-950 font-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <Map size={13} /> Turismo & Viagens
          </button>
          <button
            onClick={() => setActiveMainTab('charter')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeMainTab === 'charter'
                ? "bg-brand-accent text-zinc-950 font-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <Route size={13} /> Gestão de Fretamentos
          </button>
          <button
            onClick={() => setActiveMainTab('history')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
              activeMainTab === 'history'
                ? "bg-brand-accent text-zinc-950 font-black shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            <Clock size={13} /> Histórico Realizadas
          </button>
        </div>
      </div>

      {activeMainTab === 'trips' && (
        <div className="space-y-8">
          {/* FILTER PANEL */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-accent/10 rounded-2xl flex items-center justify-center text-brand-accent border border-brand-accent/20">
                  <Plus size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Escalas de Viagem</h2>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">Criação, controle técnico, roteirização e emissão de listas oficiais de passageiros.</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 self-start lg:self-auto w-full sm:w-auto">
                <button
                  onClick={onAddTrip}
                  className="h-12 px-6 bg-brand-accent text-zinc-950 font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto cursor-pointer"
                >
                  <Plus size={16} />
                  <span>Adicionar Viagem</span>
                </button>

                {onAddCompletedTrip && (
                  <button
                    onClick={onAddCompletedTrip}
                    className="h-12 px-6 bg-[#001233] border border-zinc-800 hover:bg-[#001c4d] text-[#D4AF37] font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all w-full sm:w-auto cursor-pointer"
                  >
                    <CheckCircle size={16} />
                    <span>Lançar Viagem Realizada</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filters and Search Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="relative flex items-center">
                <Search className="absolute left-4.5 text-zinc-600" size={16} />
                <input 
                  type="text" 
                  placeholder="BUSCAR DESTINO, ORIGEM..."
                  className="w-full bg-zinc-950 border border-zinc-850 p-4.5 pl-12 text-[10px] font-black uppercase text-white placeholder:text-zinc-600 rounded-2xl outline-none focus:border-brand-accent transition-colors tracking-wider"
                  value={tripSearch}
                  onChange={e => setTripSearch(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] pl-1">Partida Início</label>
                  <input 
                    type="date"
                    className="w-full bg-zinc-950 border border-zinc-850 p-3 text-[10px] font-bold text-white rounded-xl outline-none focus:border-brand-accent transition-colors"
                    value={tripDateStart}
                    onChange={e => setTripDateStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] pl-1">Partida Fim</label>
                  <input 
                    type="date"
                    className="w-full bg-zinc-950 border border-zinc-850 p-3 text-[10px] font-bold text-white rounded-xl outline-none focus:border-brand-accent transition-colors"
                    value={tripDateEnd}
                    onChange={e => setTripDateEnd(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 justify-center pl-1">
                <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em]">Filtro de Status</span>
                <div className="flex gap-1.5">
                  {['all', 'scheduled', 'active', 'completed'].map(status => (
                    <button
                      key={status}
                      onClick={() => setTripStatusFilter(status)}
                      className={`flex-1 py-2.5 text-[8px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                        tripStatusFilter === status 
                          ? 'bg-brand-accent border-brand-accent text-zinc-950' 
                          : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {status === 'all' ? 'TUDO' : status === 'scheduled' ? 'AGENDADO' : status === 'active' ? 'EM CRSO' : 'FIM'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 justify-center pl-1">
                <span className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em]">Filtro Setor</span>
                <div className="flex gap-1.5">
                  {['all', 'state', 'interstate', 'mercosur'].map(type => (
                    <button
                      key={type}
                      onClick={() => setTripTypeFilter(type)}
                      className={`flex-1 py-2.5 text-[8px] font-black uppercase tracking-wider rounded-xl border transition-all cursor-pointer ${
                        tripTypeFilter === type 
                          ? 'bg-brand-accent border-brand-accent text-zinc-950' 
                          : 'bg-zinc-950 border-zinc-850 text-zinc-400 hover:text-white'
                      }`}
                    >
                      {type === 'all' ? 'TUDO' : type === 'state' ? 'ESTAD' : type === 'interstate' ? 'INTER' : 'MERC'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {(tripSearch || tripStatusFilter !== 'all' || tripTypeFilter !== 'all' || tripDateStart || tripDateEnd) && (
              <div className="flex justify-between items-center bg-zinc-950/40 p-4 border border-zinc-850/50 rounded-2xl">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-ping" />
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">
                    Filtros ativos encontraram {filteredTrips.length} de {trips.length} viagens registradas.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setTripStatusFilter('all');
                    setTripTypeFilter('all');
                    setTripDateStart('');
                    setTripDateEnd('');
                    setTripSearch('');
                  }}
                  className="text-[10px] font-black text-brand-accent uppercase tracking-widest hover:text-white transition-colors"
                >
                  Limpar Filtros
                </button>
              </div>
            )}
          </div>

          {/* TRIP CARDS LIST USING REACT-WINDOW */}
          {filteredTrips.length > 0 ? (
            <div className="w-full relative">
              <List
                rowCount={tripChunks.length}
                rowHeight={itemSize}
                style={{ height: listHeight, width: '100%' }}
                className="custom-scrollbar"
                rowProps={{}}
                rowComponent={TripGridRow as any}
              />
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
                <TrendingUp size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase mb-2">
                  {trips.length === 0 ? "Nenhuma viagem agendada" : "Nenhum resultado encontrado"}
                </h3>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-sm">
                  {trips.length === 0 
                    ? "Utilize o módulo de gestão para cadastrar novas rotas de fretamento ou viagens de turismo."
                    : "Tente ajustar os filtros acima para encontrar a viagem desejada."}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {activeMainTab === 'charter' && (
        <CharteredRoutes 
          vehicles={vehicles}
          employees={employees}
          routes={charteredRoutes}
          currentUserRole={currentUserRole}
          currentUserEmail={currentUserEmail}
        />
      )}

      {activeMainTab === 'history' && (
        <div className="space-y-8 animate-fade-in">
          {/* HISTORY MODULE */}
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl shadow-xl flex flex-col gap-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-brand-accent/10 rounded-2xl flex items-center justify-center text-brand-accent border border-brand-accent/20">
                  <Clock size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-white uppercase tracking-tighter">Histórico de Viagens Realizadas</h2>
                  <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-tight">
                    Lista de viagens concluídas ou com escala encerrada. Registre observações de bordo, feedbacks e achados e perdidos.
                  </p>
                </div>
              </div>

              {onAddCompletedTrip && (
                <button
                  onClick={onAddCompletedTrip}
                  className="h-12 px-6 bg-[#001233] border border-zinc-800 hover:bg-[#001c4d] text-[#D4AF37] font-black text-[10px] uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all self-start lg:self-auto cursor-pointer"
                >
                  <CheckCircle size={16} />
                  <span>Lançar Viagem Realizada</span>
                </button>
              )}
            </div>

            {/* Busca simples do histórico */}
            <div className="relative flex items-center max-w-md">
              <Search className="absolute left-4.5 text-zinc-600" size={16} />
              <input 
                type="text" 
                placeholder="BUSCAR NO HISTÓRICO POR DESTINO, ORIGEM..."
                className="w-full bg-zinc-950 border border-zinc-850 p-4.5 pl-12 text-[10px] font-black uppercase text-white placeholder:text-zinc-600 rounded-2xl outline-none focus:border-brand-accent transition-colors tracking-wider"
                value={tripSearch}
                onChange={e => setTripSearch(e.target.value)}
              />
            </div>
          </div>

          {historyTrips.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historyTrips.map(trip => {
                const vehicle = vehicles.find(v => v.id === trip.vehicleId);
                return (
                  <Card key={trip.id} className="bg-zinc-900 border-zinc-800 p-6 rounded-2xl space-y-4 hover:border-brand-accent/30 transition-all flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <span className="px-3 py-1 bg-zinc-800 rounded-lg text-[9px] font-black uppercase text-zinc-400 flex items-center gap-1.5">
                          {vehicle?.prefix && (
                            <span className="text-brand-accent bg-brand-accent/10 px-1 rounded border border-brand-accent/20">
                              F#{vehicle.prefix}
                            </span>
                          )}
                          {vehicle?.plate || 'S/ PLACA'}
                        </span>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-zinc-850 text-zinc-400 border border-zinc-700/40 flex items-center gap-1">
                          <CheckCircle size={12} className="text-emerald-500" />
                          CONCLUÍDO
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-white uppercase text-base tracking-tight line-clamp-1">{trip.title}</h4>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-bold uppercase">
                          <MapPin size={11} className="text-brand-accent" />
                          {trip.origin} ➔ {trip.destination}
                        </div>
                      </div>

                      <div className="text-[10px] text-zinc-400 bg-zinc-950/40 p-3 rounded-xl border border-zinc-850/30 flex justify-between">
                        <div>
                          <span className="block text-[8px] text-zinc-600 font-black uppercase tracking-widest leading-none">REALIZADA EM</span>
                          <span className="font-bold uppercase text-zinc-400">
                            {format(new Date(trip.startDate), "dd MMM yyyy", { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block text-[8px] text-zinc-600 font-black uppercase tracking-widest leading-none">PASSAGEIROS</span>
                          <span className="font-bold text-zinc-400">{trip.passengerCount || 0}</span>
                        </div>
                      </div>

                      {/* Caixa de resumo de observações */}
                      <div className="p-3 bg-zinc-950/50 rounded-xl border border-zinc-850/50 space-y-2">
                        <div className="flex justify-between items-center border-b border-zinc-850/40 pb-1.5">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">REGISTRO DE EXPERIÊNCIA</span>
                          <span className="text-[9px] font-black text-brand-accent bg-brand-accent/10 px-1.5 py-0.5 rounded-lg">
                            {trip.observations?.length || 0} obs
                          </span>
                        </div>
                        {trip.observations && trip.observations.length > 0 ? (
                          <div className="space-y-1.5 max-h-24 overflow-y-auto custom-scrollbar">
                            {trip.observations.map((obs) => (
                              <div key={obs.id} className="text-[9px] text-zinc-400 leading-tight">
                                <span className={cn(
                                  "font-black mr-1 uppercase",
                                  obs.type === 'complaint' ? "text-red-400" :
                                  obs.type === 'compliment' ? "text-emerald-400" :
                                  obs.type === 'lost_found' ? "text-[#ff6b00]" : "text-blue-400"
                                )}>
                                  [{obs.type === 'complaint' ? 'Reclamação' :
                                    obs.type === 'compliment' ? 'Elogio' :
                                    obs.type === 'lost_found' ? 'Achados' : 'Melhoria'}]:
                                </span>
                                <span className="italic">"{obs.text}"</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[9px] text-zinc-600 font-bold uppercase italic">Sem observações cadastradas.</p>
                        )}
                      </div>
                    </div>

                    <div className="pt-3 border-t border-zinc-800/40 flex gap-2">
                      <button
                        onClick={() => onViewOS(trip)}
                        className="flex-1 py-2 bg-zinc-850 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[9px] font-black text-zinc-350 uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                      >
                        <FileText size={12} /> O.S.
                      </button>
                      <button
                        onClick={() => handleOpenObservations(trip)}
                        className="flex-1 py-2 bg-[#ff6b00]/10 border border-[#ff6b00]/20 hover:bg-[#ff6b00]/20 rounded-xl text-[9px] font-black text-[#ff6b00] uppercase tracking-widest transition-all flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare size={12} /> OBSERVAR
                      </button>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-6 bg-zinc-900/30 border border-dashed border-zinc-800 rounded-3xl">
              <div className="w-20 h-20 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-700">
                <Clock size={40} />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase mb-2">Nenhum histórico disponível</h3>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest max-w-sm">
                  As viagens finalizadas aparecerão listadas aqui para criação de feedbacks e controle de qualidade.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL DE OBSERVAÇÕES E EXPERIÊNCIA DA VIAGEM */}
      {isObsModalOpen && selectedTripForObs && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-sm animate-fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col animate-scale-up">
            
            {/* Header */}
            <div className="p-6 border-b border-zinc-800 flex justify-between items-start shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#ff6b00]/10 rounded-2xl flex items-center justify-center text-[#ff6b00] border border-[#ff6b00]/20">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <span className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest font-sans">Controle de Qualidade</span>
                  {selectedTripForObs.client && (
                    <span className="block text-[10px] font-black text-brand-accent uppercase tracking-widest mt-0.5">
                      {selectedTripForObs.client}
                    </span>
                  )}
                  <h3 className="text-lg font-black text-white uppercase tracking-tight leading-tight">{selectedTripForObs.title}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">
                    {selectedTripForObs.origin} ➔ {selectedTripForObs.destination}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsObsModalOpen(false)}
                className="p-2 bg-zinc-950 hover:bg-zinc-800 border border-zinc-850 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 flex-1">
              
              {/* Trip summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-zinc-950 p-4 rounded-2xl border border-zinc-850/50">
                <div>
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Veículo</span>
                  <span className="text-xs font-black text-white uppercase">
                    {vehicles.find(v => v.id === selectedTripForObs.vehicleId)?.model.toUpperCase() || 'Não Definido'}
                  </span>
                </div>
                <div>
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Motorista</span>
                  <span className="text-xs font-black text-white uppercase">
                    {employees.find(e => e.id === selectedTripForObs.driverId)?.name.toUpperCase() || 'Não Definido'}
                  </span>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Data</span>
                  <span className="text-xs font-black text-white uppercase">
                    {format(new Date(selectedTripForObs.startDate), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                </div>
                
                {/* Accommodation */}
                <div>
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Hospedagem</span>
                  <span className="text-xs font-black text-zinc-300 uppercase">
                    {selectedTripForObs.accommodation || 'Por Conta'}
                  </span>
                </div>
                {/* Meals */}
                <div>
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Alimentação</span>
                  <span className="text-xs font-black text-zinc-300 uppercase">
                    {selectedTripForObs.meals || 'Por Conta'}
                  </span>
                </div>
                {/* Trip Value */}
                <div>
                  <span className="block text-[8px] text-zinc-650 font-black uppercase tracking-widest leading-none mb-1">Valor do Contrato</span>
                  <span className="text-xs font-black text-brand-accent font-mono">
                    {selectedTripForObs.tripValue !== undefined && selectedTripForObs.tripValue !== null 
                      ? `R$ ${Number(selectedTripForObs.tripValue).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` 
                      : 'Não Informado'}
                  </span>
                </div>
              </div>

              {/* Existing observations */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <span>Histórico de Experiências Registradas</span>
                  <span className="h-1.5 flex-1 bg-zinc-800 rounded-full" />
                </h4>

                {selectedTripForObs.observations && selectedTripForObs.observations.length > 0 ? (
                  <div className="space-y-3">
                    {selectedTripForObs.observations.map((obs) => {
                      const icons = {
                        complaint: <AlertTriangle size={14} className="text-red-400" />,
                        compliment: <Star size={14} className="text-emerald-400" />,
                        lost_found: <Gift size={14} className="text-[#ff6b00]" />,
                        improvement: <Lightbulb size={14} className="text-blue-400" />
                      };
                      const labels = {
                        complaint: 'Reclamação',
                        compliment: 'Elogio',
                        lost_found: 'Achados e Perdidos',
                        improvement: 'Sugestão de Melhoria'
                      };
                      const colors = {
                        complaint: 'bg-red-950/20 border-red-900/30 text-red-300',
                        compliment: 'bg-emerald-950/20 border-emerald-900/30 text-emerald-300',
                        lost_found: 'bg-[#ff6b00]/10 border-[#ff6b00]/20 text-[#ff6b00]',
                        improvement: 'bg-blue-950/20 border-blue-900/30 text-blue-300'
                      };

                      return (
                        <div key={obs.id} className="p-4 bg-zinc-950/30 border border-zinc-850/60 rounded-2xl flex flex-col gap-2">
                          <div className="flex justify-between items-center">
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-md flex items-center gap-1 border",
                              colors[obs.type]
                            )}>
                              {icons[obs.type]}
                              {labels[obs.type]}
                            </span>
                            <span className="text-[8px] text-zinc-650 font-bold uppercase">
                              {format(new Date(obs.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-xs text-zinc-300 leading-relaxed italic">"{obs.text}"</p>
                          <div className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider pl-1">
                            Registrado por: <span className="text-zinc-400">{obs.author}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 text-center bg-zinc-950/20 border border-dashed border-zinc-850 rounded-2xl">
                    <MessageSquare size={24} className="mx-auto text-zinc-700 mb-2" />
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      Nenhum relato ou observação cadastrada para esta viagem.
                    </p>
                  </div>
                )}
              </div>

              {/* Form to add observation */}
              <form onSubmit={handleAddObservation} className="space-y-4 border-t border-zinc-800 pt-6">
                <h4 className="text-xs font-black text-white uppercase tracking-widest">
                  Registrar Nova Observação ou Experiência
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] pl-1">
                      Tipo de Ocorrência
                    </label>
                    <select
                      value={obsType}
                      onChange={(e: any) => setObsType(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-850 p-3 text-[10px] font-black uppercase text-white rounded-xl outline-none focus:border-brand-accent transition-colors"
                    >
                      <option value="improvement">💡 Sugestão de Melhoria</option>
                      <option value="compliment">⭐️ Elogio</option>
                      <option value="complaint">⚠️ Reclamação</option>
                      <option value="lost_found">🎒 Achados e Perdidos</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] pl-1">
                      Nome do Autor / Relator
                    </label>
                    <input
                      type="text"
                      placeholder="EX: MOTORISTA, GESTOR, PASSAGEIRO..."
                      className="w-full bg-zinc-950 border border-zinc-850 p-3 text-[10px] font-black uppercase text-white placeholder:text-zinc-600 rounded-xl outline-none focus:border-brand-accent transition-colors tracking-wider"
                      value={obsAuthor}
                      onChange={e => setObsAuthor(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[8px] font-extrabold text-zinc-500 uppercase tracking-[0.2em] pl-1">
                    Descrição Detalhada do Relato
                  </label>
                  <textarea
                    placeholder="DIGITE AQUI DETALHES DE RECLAMAÇÕES, ELOGIOS, INTEMPÉRIES OU ACHADOS E PERDIDOS PARA SUGERIR MELHORIAS PARA AS PRÓXIMAS VIAGENS..."
                    className="w-full bg-zinc-950 border border-zinc-850 p-4 text-[10px] font-bold text-white placeholder:text-zinc-650 rounded-xl outline-none focus:border-brand-accent transition-colors h-24 resize-none leading-relaxed"
                    value={obsText}
                    onChange={e => setObsText(e.target.value)}
                    required
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsObsModalOpen(false)}
                    className="px-5 h-11 bg-zinc-800 hover:bg-zinc-750 text-zinc-350 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all cursor-pointer"
                  >
                    Voltar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingObs}
                    className="px-6 h-11 bg-brand-accent text-zinc-950 font-black text-[10px] uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                  >
                    {isSubmittingObs ? 'Salvando...' : 'Gravar Observação'}
                  </button>
                </div>
              </form>

            </div>
          </div>
        </div>
      )}
    </div>
  );
});
