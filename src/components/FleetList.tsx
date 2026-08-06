import React, { useState, memo, useMemo, useRef, useEffect } from 'react';
import { List } from 'react-window';
import { Bus, Plus, Search, Wrench, Droplets, AlertTriangle, Users, Camera, Calendar, Mic, MicOff, FileText } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'motion/react';
import { Card } from './Cards';
import { cn } from '../lib/utils';
import { Vehicle } from '../types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { toast } from 'sonner';

interface FleetListProps {
  vehicles: Vehicle[];
  onAddVehicle: () => void;
  onVehicleClick: (vehicle: Vehicle) => void;
  onOpenDossier: () => void;
  isLoading?: boolean;
}

const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 250, damping: 30 } }
};

const VehicleRow = memo(({ v, onVehicleClick, style }: { v: Vehicle; onVehicleClick: (v: Vehicle) => void; style?: React.CSSProperties }) => {
  const isOilChangeClose = v.nextOilChangeKM && (v.nextOilChangeKM - v.currentOdometer <= 1000);
  const kmToMaintenance = (v.nextMaintenanceKM && v.currentOdometer) ? (v.nextMaintenanceKM - v.currentOdometer) : null;
  const isMaintenanceClose = kmToMaintenance !== null && kmToMaintenance <= 2000 && kmToMaintenance >= 0;
  
  const daysToLicense = v.licenseExpiration ? differenceInDays(parseISO(v.licenseExpiration), new Date()) : null;
  const isLicenseClose = daysToLicense !== null && daysToLicense <= 30;
  
  const daysToTourism = v.tourismLicenseExpiration ? differenceInDays(parseISO(v.tourismLicenseExpiration), new Date()) : null;
  const isTourismClose = daysToTourism !== null && daysToTourism <= 30;

  return (
    <motion.div 
      variants={itemVariants}
      key={v.id}
      onClick={() => onVehicleClick(v)}
      style={style}
      className={cn(
        "grid grid-cols-1 md:grid-cols-4 p-8 items-center transition-all group cursor-pointer gap-6 md:gap-0 border-b border-zinc-800/20 hover:bg-zinc-800/30",
        style ? "absolute inset-x-0" : "relative",
        v.featured 
          ? "bg-yellow-500/5 border border-yellow-500/50 shadow-[inset_0_0_12px_rgba(234,179,8,0.06),0_0_20px_rgba(234,179,8,0.25)] animate-[pulse_3s_infinite] rounded-2xl mx-4 my-3 ring-1 ring-yellow-500/20" 
          : "hover:bg-zinc-800/30"
      )}
    >
      <div className="flex items-center gap-6">
        {v.photoUrl ? (
          <div className={cn(
            "w-20 h-14 rounded-xl overflow-hidden border shrink-0 shadow-lg",
            v.featured ? "border-yellow-500/50" : "border-zinc-800"
          )}>
            <img src={v.photoUrl} alt={v.plate} loading="lazy" decoding="async" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className={cn(
            "w-20 h-14 border rounded-xl flex items-center justify-center shrink-0",
            v.featured ? "bg-yellow-500/5 border-yellow-500/30" : "bg-zinc-900 border-zinc-850"
          )}>
            <Camera size={18} className={v.featured ? "text-yellow-500/60" : "text-zinc-700"} />
          </div>
        )}
        <div className={cn(
          "w-14 h-14 bg-zinc-800 rounded-xl flex items-center justify-center shadow-lg border transition-all shrink-0",
          v.featured 
            ? "border-yellow-500/70 shadow-yellow-950/20" 
            : (isOilChangeClose || isMaintenanceClose || isLicenseClose || isTourismClose) 
            ? "border-amber-500/50 shadow-amber-900/20" 
            : "border-zinc-700 group-hover:border-zinc-500"
        )}>
          {isMaintenanceClose ? (
            <Wrench className="text-amber-500 animate-pulse" size={24} />
          ) : isOilChangeClose ? (
            <Droplets className="text-amber-500 animate-pulse" size={24} />
          ) : (isLicenseClose || isTourismClose) ? (
            <AlertTriangle className="text-amber-500 animate-pulse" size={24} />
          ) : v.featured ? (
            <Wrench className="text-yellow-500 animate-pulse" size={24} />
          ) : (
            <Bus className="text-zinc-500 group-hover:text-brand-accent transition-colors" size={24} />
          )}
        </div>
        <div>
          <div className="font-black text-white tabular-nums text-lg uppercase tracking-tight leading-none flex items-center gap-2">
            {v.plate}
            {v.featured && (
              <span className="px-2 py-0.5 bg-yellow-500 text-zinc-950 text-[8px] font-black uppercase rounded tracking-wider animate-pulse shadow-[0_0_8px_rgba(234,179,8,0.4)]">
                Inspeção
              </span>
            )}
            {(isOilChangeClose || isMaintenanceClose || isLicenseClose || isTourismClose) && !v.featured && (
              <AlertTriangle size={14} className="text-amber-500" />
            )}
          </div>
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mt-2">
            {v.type === 'van' ? 'Transporte Van' : v.type === 'microbus' ? 'Executivo Micro-ônibus' : 'Executivo Ônibus'}
          </p>
        </div>
      </div>
      <div>
        <div className="font-black text-zinc-300 uppercase text-xs tracking-widest leading-none">{v.model}</div>
        <div className="flex flex-col gap-1 mt-2">
          <p className="text-[9px] text-zinc-600 font-black">FAB: {v.factoryYear}</p>
          {isOilChangeClose && (
            <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Troca de Óleo em {v.nextOilChangeKM! - v.currentOdometer} KM</p>
          )}
          {isMaintenanceClose && (
            <p className="text-[8px] font-black text-amber-500 uppercase tracking-tighter">Maint. Prev em {kmToMaintenance} KM</p>
          )}
          {isLicenseClose && (
            <p className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">
              {daysToLicense! <= 0 ? 'Licenciamento Vencido' : `Licenciamento em ${daysToLicense} dias`}
            </p>
          )}
          {isTourismClose && (
            <p className="text-[8px] font-black text-rose-500 uppercase tracking-tighter">
              {daysToTourism! <= 0 ? 'Cert. Turismo Vencido' : `Cert. Turismo em ${daysToTourism} dias`}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="p-2.5 bg-zinc-800 rounded-lg text-zinc-500"><Users size={18} /></div>
        <div>
          <span className="text-sm font-black text-zinc-100 leading-none block">{v.capacity} PAX</span>
          <span className="text-[9px] text-zinc-600 uppercase font-black tracking-widest mt-1 block">Lotação</span>
        </div>
      </div>
      <div className="text-right flex items-center justify-end">
        <span className={cn(
          "px-4.5 py-2 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] border flex items-center gap-2 transition-all duration-700 ease-in-out shadow-sm",
          v.status === 'available' 
            ? "bg-emerald-950/20 text-emerald-400 border-emerald-500/20 shadow-emerald-950/20" 
            : v.status === 'maintenance'
            ? "bg-amber-950/20 text-amber-500 border-amber-500/20 shadow-amber-950/20"
            : "bg-rose-950/20 text-rose-450 border-rose-500/20 shadow-rose-950/20"
        )}>
          <span className="relative flex h-2 w-2">
            <span className={cn(
              "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 transition-colors duration-700 ease-in-out",
              v.status === 'available' 
                ? "bg-emerald-400" 
                : v.status === 'maintenance'
                ? "bg-amber-500"
                : "bg-rose-400"
            )}></span>
            <span className={cn(
              "relative inline-flex rounded-full h-2 w-2 transition-colors duration-700 ease-in-out",
              v.status === 'available' 
                ? "bg-emerald-500" 
                : v.status === 'maintenance'
                ? "bg-amber-500"
                : "bg-rose-500"
            )}></span>
          </span>
          {v.status === 'available' 
            ? 'LIBERADO' 
            : v.status === 'maintenance' 
            ? 'EM MANUTENÇÃO' 
            : 'INATIVO'}
        </span>
      </div>
    </motion.div>
  );
});

VehicleRow.displayName = 'VehicleRow';

export const FleetList = memo(({ vehicles, onAddVehicle, onVehicleClick, onOpenDossier, isLoading }: FleetListProps) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'BUS' | 'MICROBUS' | 'VAN'>('ALL');
  const [isListening, setIsListening] = useState(false);

  const startVoiceSearch = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('O reconhecimento de voz não é suportado por este navegador.');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.interimResults = false;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        setIsListening(true);
        toast.info('🎙️ Ouvindo... Fale a placa ou o modelo do veículo', { id: 'voice-search-toast', duration: 5000 });
      };

      recognition.onerror = (event: any) => {
        console.error('Erro no reconhecimento de voz:', event);
        setIsListening(false);
        toast.dismiss('voice-search-toast');
        if (event.error === 'not-allowed') {
          toast.error('⚠️ Permissão de acesso ao microfone negada.');
        } else {
          toast.error('⚠️ Não entendi ou silêncio detectado. Tente falar novamente.');
        }
      };

      recognition.onend = () => {
        setIsListening(false);
        toast.dismiss('voice-search-toast');
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          let formattedText = transcript.trim().toUpperCase();
          // Remover hífens e espaços para ver se é placa
          const withoutSpaces = formattedText.replace(/[\s-]/g, '');
          const isPlatePattern = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/i.test(withoutSpaces) || /^[A-Z]{3}[0-9]{4}$/i.test(withoutSpaces);

          if (isPlatePattern) {
            setSearch(withoutSpaces);
            toast.success(`🔍 Buscando placa: ${withoutSpaces}`);
          } else {
            setSearch(formattedText);
            toast.success(`🔍 Buscando por: "${formattedText}"`);
          }
        }
      };

      recognition.start();
    } catch (err) {
      console.error(err);
      setIsListening(false);
      toast.error('Falha ao iniciar gravador.');
    }
  };

  const activeVehiclesOnly = useMemo(() => vehicles.filter(v => v.status !== 'sold'), [vehicles]);

  const filteredVehicles = activeVehiclesOnly.filter(v => {
    const matchesSearch = v.plate.toLowerCase().includes(search.toLowerCase()) || 
                          v.model.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || 
                            (selectedCategory === 'BUS' && v.type === 'bus') ||
                            (selectedCategory === 'MICROBUS' && v.type === 'microbus') ||
                            (selectedCategory === 'VAN' && v.type === 'van');
    return matchesSearch && matchesCategory;
  });

  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' ? window.innerWidth < 768 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const listItems = useMemo(() => {
    if (selectedCategory === 'ALL' && !search) {
      const items: Array<{
        type: 'header' | 'vehicle';
        key: string;
        title?: string;
        count?: number;
        vehicle?: Vehicle;
      }> = [];
      
      const buses = activeVehiclesOnly.filter(v => v.type === 'bus');
      if (buses.length > 0) {
        items.push({ type: 'header', key: 'header-bus', title: '🚌 Ônibus de Turismo Executive', count: buses.length });
        buses.forEach(v => items.push({ type: 'vehicle', key: v.id, vehicle: v }));
      }

      const microbuses = activeVehiclesOnly.filter(v => v.type === 'microbus');
      if (microbuses.length > 0) {
        items.push({ type: 'header', key: 'header-microbus', title: '🚐 Micro-ônibus de Frota Executive', count: microbuses.length });
        microbuses.forEach(v => items.push({ type: 'vehicle', key: v.id, vehicle: v }));
      }

      const vans = activeVehiclesOnly.filter(v => v.type === 'van');
      if (vans.length > 0) {
        items.push({ type: 'header', key: 'header-van', title: '🚐 Vans de Turismo / Executiva', count: vans.length });
        vans.forEach(v => items.push({ type: 'vehicle', key: v.id, vehicle: v }));
      }

      const others = activeVehiclesOnly.filter(v => v.type !== 'bus' && v.type !== 'microbus' && v.type !== 'van');
      if (others.length > 0) {
        items.push({ type: 'header', key: 'header-others', title: '🚚 Outros Veículos / Cavalos', count: others.length });
        others.forEach(v => items.push({ type: 'vehicle', key: v.id, vehicle: v }));
      }
      return items;
    } else {
      return filteredVehicles.map(v => ({ type: 'vehicle' as const, key: v.id, vehicle: v }));
    }
  }, [activeVehiclesOnly, filteredVehicles, selectedCategory, search]);

  const listRef = useRef<any>(null);

  const getItemSize = (index: number) => {
    const item = listItems[index];
    if (item.type === 'header') {
      return 56;
    }
    return isMobile ? 320 : 120;
  };

  const listHeight = Math.min(650, listItems.reduce((acc, _, idx) => acc + getItemSize(idx), 0) + 10);
  const hasItems = listItems.length > 0;

  const busCount = activeVehiclesOnly.filter(v => v.type === 'bus').length;
  const microbusCount = activeVehiclesOnly.filter(v => v.type === 'microbus').length;
  const vanCount = activeVehiclesOnly.filter(v => v.type === 'van').length;

  const renderSectionHeader = (title: string, count: number) => (
    <div className="bg-zinc-950/60 px-8 py-3.5 border-y border-zinc-800/40 flex items-center justify-between col-span-full">
      <span className="text-[10px] sm:text-xs font-black text-brand-accent uppercase tracking-widest flex items-center gap-2">
        {title}
      </span>
      <span className="text-[9px] bg-zinc-900 border border-zinc-800 text-zinc-500 px-3 py-1 rounded-full font-black">
        {count} {count === 1 ? 'ATIVO' : 'ATIVOS'}
      </span>
    </div>
  );

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex flex-col gap-3">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter">DM TURISMO</h1>
          <p className="text-zinc-500 font-medium tracking-tight">Gestão de cavalos, vans e ônibus executivos.</p>
        </div>
        <div className="flex gap-4 flex-wrap">
          <button 
            type="button"
            onClick={onOpenDossier}
            className="flex items-center gap-3 px-6 py-4.5 bg-zinc-900 border border-zinc-800 text-white rounded-2xl font-black shadow-2xl transition-all active:scale-95 hover:bg-zinc-850 hover:border-zinc-700 text-xs sm:text-sm cursor-pointer uppercase"
          >
            <FileText size={18} className="text-blue-500" />
            Dossiê Completo de Todos os Veículos
          </button>
          <button 
            type="button"
            onClick={onAddVehicle}
            className="flex items-center gap-4 px-8 py-4.5 bg-brand-accent text-zinc-950 rounded-2xl font-black shadow-2xl transition-all active:scale-95 group hover:scale-[1.02] text-xs sm:text-sm cursor-pointer"
          >
            <Plus size={18} className="stroke-[3]" />
            Novo Ativo
          </button>
        </div>
      </div>

      <Card className="p-0 border-zinc-800 bg-zinc-900/20 overflow-hidden">
        <div className="p-8 bg-zinc-900/50 border-b border-zinc-800 flex flex-col gap-6 items-stretch">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <div className="relative flex-1 w-full group">
              <Search className="absolute left-8 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-brand-accent transition-colors" size={24} />
              <input 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-20 pr-36 py-5 bg-zinc-950 border border-zinc-800 rounded-2xl focus:border-brand-accent outline-none transition-all placeholder:text-zinc-700 font-bold text-white shadow-inner font-sans" 
                placeholder="Buscar por placa ou modelo em tempo real..." 
              />
              <div className="absolute right-6 top-1/2 -translate-y-1/2 flex items-center gap-3">
                {search && (
                  <button 
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-zinc-500 hover:text-white font-black text-[10px] uppercase tracking-wider bg-zinc-900 border border-zinc-800/80 px-3 py-1.5 rounded-lg active:scale-95 transition-all text-xs cursor-pointer font-sans"
                  >
                    Limpar
                  </button>
                )}
                <button
                  type="button"
                  onClick={startVoiceSearch}
                  className={cn(
                    "p-2 rounded-xl transition-all active:scale-95 flex items-center justify-center cursor-pointer border",
                    isListening 
                      ? "bg-red-500/15 border-red-500/40 text-red-500 animate-pulse" 
                      : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700"
                  )}
                  title="Buscar por Voz"
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
            </div>
            {search && (
              <div className="text-right shrink-0">
                <span className="px-4 py-3 bg-brand-accent/10 text-brand-accent border border-brand-accent/20 rounded-xl text-[10px] font-black uppercase tracking-wider block">
                  {filteredVehicles.length} {filteredVehicles.length === 1 ? 'veículo localizado' : 'veículos localizados'}
                </span>
              </div>
            )}
          </div>

          {/* Seletor de Categorias de Veículos com Micro-interações */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {(['ALL', 'BUS', 'MICROBUS', 'VAN'] as const).map((cat) => {
              const isActive = selectedCategory === cat;
              const counts = {
                ALL: activeVehiclesOnly.length,
                BUS: busCount,
                MICROBUS: microbusCount,
                VAN: vanCount
              };
              const labels = {
                ALL: '🎛️ Visão Geral',
                BUS: '🚌 Ônibus',
                MICROBUS: '🚐 Micro-ônibus',
                VAN: '🚐 Vans'
              };
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "relative px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors duration-200 focus:outline-none flex items-center gap-2",
                    isActive ? "text-zinc-950 font-black" : "text-zinc-400 hover:text-white bg-zinc-950/40 border border-zinc-850"
                  )}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeFleetPill"
                      className="absolute inset-0 bg-brand-accent rounded-xl shadow-md -z-0"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-2 font-black">
                    {labels[cat]} 
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-extrabold font-mono",
                      isActive ? "bg-zinc-950/20 text-zinc-950" : "bg-zinc-900 text-zinc-500 border border-zinc-800"
                    )}>
                      {counts[cat]}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="divide-y divide-zinc-800">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div 
                key={`skeleton-vehicle-${idx}`}
                className="grid grid-cols-1 md:grid-cols-4 p-8 items-center relative gap-6 md:gap-0 border-b border-zinc-800/40 animate-pulse bg-zinc-900/5"
              >
                <div className="flex items-center gap-6">
                  <div className="w-20 h-14 bg-zinc-800/40 rounded-xl shrink-0" />
                  <div className="w-14 h-14 bg-zinc-800/45 rounded-xl shrink-0" />
                  <div className="space-y-2 shrink-0">
                    <div className="h-5 w-24 bg-zinc-800/40 rounded-lg" />
                    <div className="h-3 w-16 bg-zinc-800/45 rounded-lg mt-1" />
                  </div>
                </div>
                <div>
                  <div className="h-4 w-32 bg-zinc-800/40 rounded-lg" />
                  <div className="h-3 w-20 bg-zinc-800/45 rounded-lg mt-2" />
                </div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-zinc-800/40 rounded-lg shrink-0" />
                  <div className="space-y-1.5 shrink-0">
                    <div className="h-4 w-12 bg-zinc-800/40 rounded-lg" />
                    <div className="h-3 w-10 bg-zinc-800/45 rounded-lg" />
                  </div>
                </div>
                <div className="flex md:justify-end">
                  <div className="h-8 w-28 bg-zinc-800/30 border border-zinc-800/40 rounded-xl" />
                </div>
              </div>
            ))
          ) : (
            <AnimatePresence mode="wait">
              {hasItems ? (
                <div key={selectedCategory + '-' + search} className="w-full relative" style={{ height: `${listHeight}px` }}>
                  <List
                    listRef={listRef}
                    rowCount={listItems.length}
                    rowHeight={getItemSize}
                    style={{ height: listHeight, width: '100%' }}
                    className="scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent"
                    rowProps={{}}
                    rowComponent={({ index, style }) => {
                      const item = listItems[index];
                      if (item.type === 'header') {
                        return (
                          <div style={style}>
                            {renderSectionHeader(item.title!, item.count!)}
                          </div>
                        );
                      }
                      return (
                        <VehicleRow 
                          v={item.vehicle!} 
                          onVehicleClick={onVehicleClick} 
                          style={style} 
                        />
                      );
                    }}
                  />
                </div>
              ) : (
                <div className="p-20 text-center">
                  <Bus size={48} className="text-zinc-800 mx-auto mb-6" />
                  <p className="text-xs font-black text-zinc-800 uppercase tracking-[0.4em]">Nenhum ativo localizado</p>
                </div>
              )}
            </AnimatePresence>
          )}
        </div>
      </Card>
    </div>
  );
});

FleetList.displayName = 'FleetList';
