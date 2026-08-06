import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, ChevronLeft, ChevronRight, MapPin, 
  Phone, Send, Compass, Eye, EyeOff, 
  Maximize2, Minimize2, CheckCircle2 
} from 'lucide-react';
import { CharteredRoute, Passenger } from './CharterTypes';
import { getMapsDirUrl, getMapsEmbedUrl, extractCoordinates } from './CharterUtils';
import { cn } from '../../lib/utils';
import { toast } from 'sonner';

interface GpsAssistantProps {
  activeGpsRoute: CharteredRoute | null;
  activeGpsPassengerIndex: number;
  isGpsPanelOpen: boolean;
  isGpsMiniMenuOpen: boolean;
  isGpsBubbleOnlyMode: boolean;
  isBubbleMinimized: boolean;
  userCoords: { lat: number; lng: number } | null;
  onCloseGps: () => void;
  onNextPassenger: (shouldOpenExternal?: boolean) => void;
  onPrevPassenger: () => void;
  onSelectPassengerIndex: (index: number) => void;
  onToggleBubbleMode: (bubble: boolean) => void;
  onToggleMinimized: () => void;
}

export const GpsAssistant: React.FC<GpsAssistantProps> = ({
  activeGpsRoute,
  activeGpsPassengerIndex,
  isGpsPanelOpen,
  isGpsMiniMenuOpen,
  isGpsBubbleOnlyMode,
  isBubbleMinimized,
  userCoords,
  onCloseGps,
  onNextPassenger,
  onPrevPassenger,
  onSelectPassengerIndex,
  onToggleBubbleMode,
  onToggleMinimized
}) => {
  const [isMapEmbedVisible, setIsMapEmbedVisible] = useState(false);

  if (!isGpsPanelOpen || !activeGpsRoute) return null;

  const passengers = (activeGpsRoute.passengers || []).slice(0, 20);
  const totalPassengers = passengers.length;
  const currentPassenger: Passenger | undefined = passengers[activeGpsPassengerIndex];

  const handleSendWhatsAppAlert = () => {
    if (!currentPassenger || !currentPassenger.phone) {
      toast.error("Este passageiro não possui telefone cadastrado.");
      return;
    }
    const cleanPhone = currentPassenger.phone.replace(/\D/g, '');
    const message = encodeURIComponent(
      `Olá ${currentPassenger.name}, o seu transporte DM Turismo começou a rota e está a caminho da sua localização de embarque!`
    );
    window.open(`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${message}`, '_blank');
    toast.success("Alerta enviado ao WhatsApp!");
  };

  const handleOpenGpsNavigation = () => {
    if (!currentPassenger) return;
    const mapsUrl = getMapsDirUrl(
      currentPassenger.locationUrl,
      `${currentPassenger.name} ${activeGpsRoute.client}`,
      userCoords
    );
    window.open(mapsUrl, '_blank');
  };

  // Render the Floating Drag Bubble Mode
  if (isGpsBubbleOnlyMode) {
    return (
      <AnimatePresence>
        <motion.div
          drag
          dragMomentum={false}
          initial={{ opacity: 0, scale: 0.8, x: '80vw', y: '60vh' }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="fixed z-[9999] cursor-grab active:cursor-grabbing bg-zinc-950/90 hover:bg-zinc-900 border border-brand-accent/60 shadow-[0_10px_35px_rgba(255,107,0,0.25)] p-4 rounded-3xl w-72 touch-none select-none backdrop-blur-md"
        >
          {isBubbleMinimized ? (
            <div className="flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                <span className="text-[10px] font-black text-white uppercase tracking-wider">Atalho DM GPS</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={onToggleMinimized}
                  className="p-1 text-zinc-400 hover:text-white rounded"
                  title="Expandir"
                >
                  <Maximize2 size={12} />
                </button>
                <button 
                  onClick={onCloseGps}
                  className="p-1 text-zinc-400 hover:text-rose-500 rounded"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 pointer-events-auto">
              <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                <div className="flex flex-col">
                  <span className="text-[7px] font-black text-zinc-500 uppercase tracking-widest">Rota em Curso</span>
                  <span className="text-[10px] font-extrabold text-white uppercase truncate max-w-[140px]">
                    {activeGpsRoute.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => onToggleBubbleMode(false)}
                    className="p-1 bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-brand-accent rounded-lg"
                    title="Modo Tela Cheia"
                  >
                    <Minimize2 size={12} />
                  </button>
                  <button 
                    onClick={onToggleMinimized}
                    className="p-1 bg-zinc-900/60 border border-zinc-800 text-zinc-400 hover:text-white rounded-lg"
                    title="Minimizar"
                  >
                    <Maximize2 size={12} />
                  </button>
                  <button 
                    onClick={onCloseGps}
                    className="p-1 bg-zinc-900/60 border border-zinc-800 text-rose-500 hover:bg-rose-950/20 rounded-lg"
                    title="Encerrar Rota"
                  >
                    <X size={12} />
                  </button>
                </div>
              </div>

              {/* Passenger picked-up stats progress indicator */}
              <div className="space-y-1">
                <div className="flex justify-between text-[8px] font-black uppercase tracking-wider text-zinc-400">
                  <span>Embarques</span>
                  <span className="text-brand-accent">
                    {totalPassengers > 0 ? `${activeGpsPassengerIndex + 1} / ${totalPassengers}` : '0/0'}
                  </span>
                </div>
                <div className="w-full bg-zinc-900 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand-accent h-full transition-all duration-300" 
                    style={{ width: `${totalPassengers > 0 ? ((activeGpsPassengerIndex + 1) / totalPassengers) * 105 : 0}%` }}
                  />
                </div>
              </div>

              {currentPassenger ? (
                <div className="bg-zinc-900/50 p-2.5 rounded-2xl border border-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[7px] font-black text-brand-accent uppercase tracking-widest bg-brand-accent/10 px-1.5 py-0.5 rounded">
                      Próxima parada
                    </span>
                    {currentPassenger.boardingTime && (
                      <span className="text-[8px] font-mono font-bold text-zinc-400">
                        ⏱️ {currentPassenger.boardingTime}
                      </span>
                    )}
                  </div>
                  <h5 className="text-[11px] font-black text-white uppercase truncate">
                    {currentPassenger.name}
                  </h5>

                  <div className="flex gap-1.5">
                    <button
                      onClick={handleOpenGpsNavigation}
                      className="flex-1 py-1.5 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center justify-center gap-1"
                    >
                      <Compass size={11} /> Navegar
                    </button>
                    {currentPassenger.phone && (
                      <button
                        onClick={handleSendWhatsAppAlert}
                        className="p-1.5 bg-emerald-950/60 text-emerald-400 border border-emerald-900/30 hover:bg-emerald-900 hover:text-white rounded-xl"
                        title="Alertar WhatsApp"
                      >
                        <Send size={11} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center p-3 text-[10px] text-zinc-500 font-bold uppercase">
                  Fim do itinerário
                </div>
              )}

              <div className="flex gap-1.5 justify-between">
                <button
                  disabled={activeGpsPassengerIndex <= 0}
                  onClick={onPrevPassenger}
                  className="flex-1 py-1 bg-zinc-900/80 hover:bg-zinc-800 disabled:opacity-40 text-white rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer"
                >
                  <ChevronLeft size={10} /> Anterior
                </button>
                <button
                  onClick={() => onNextPassenger(true)}
                  className="flex-1 py-1 bg-brand-accent/20 hover:bg-brand-accent/30 text-brand-accent rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center justify-center gap-1 cursor-pointer"
                >
                  Confirmar <ChevronRight size={10} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Render Full Screen overlay view
  return (
    <div className="fixed inset-0 z-[9990] bg-zinc-950/95 flex flex-col justify-between p-6">
      {/* Top action header header */}
      <div className="flex items-center justify-between border-b border-zinc-900 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent animate-pulse-slow">
            <Compass size={22} />
          </div>
          <div>
            <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest animate-pulse flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> Rota ativa em andamento
            </span>
            <h3 className="text-xl font-black text-white uppercase tracking-tight">{activeGpsRoute.name}</h3>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => onToggleBubbleMode(true)}
            className="px-4 py-2 bg-zinc-900 text-[9px] font-black uppercase tracking-widest text-brand-accent border border-brand-accent/20 rounded-xl hover:bg-brand-accent hover:text-zinc-950 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Maximize2 size={12} /> Flutuar sobre GPS
          </button>
          
          <button 
            onClick={onCloseGps}
            className="p-3 bg-zinc-900 text-rose-500 hover:bg-rose-950/25 rounded-2xl transition-all"
            title="Encerrar Rota"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main split dashboard area */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 py-6 overflow-hidden">
        {/* Left Side: Stops & Checkpoints Column */}
        <div className="lg:col-span-5 flex flex-col h-full overflow-hidden max-h-[80vh]">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-3 font-sans">
            Itinerário e Passageiros ({totalPassengers})
          </span>
          <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 scrollbar-thin scrollbar-thumb-zinc-800 pr-1">
            {passengers.map((p, idx) => {
              const isCurrent = idx === activeGpsPassengerIndex;
              const isPassed = idx < activeGpsPassengerIndex;
              
              return (
                <button
                  key={idx}
                  onClick={() => onSelectPassengerIndex(idx)}
                  className={cn(
                    "w-full text-left p-4 rounded-3xl border transition-all flex items-center gap-4 cursor-pointer relative overflow-hidden group active:scale-[0.99]",
                    isCurrent 
                      ? "bg-brand-accent text-zinc-950 border-brand-accent shadow-[0_8px_30px_rgba(255,107,0,0.25)] font-black" 
                      : isPassed 
                        ? "bg-zinc-950/40 text-zinc-500 border-zinc-900 opacity-60" 
                        : "bg-zinc-900/60 text-zinc-300 border-zinc-850 hover:border-zinc-750"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 border",
                    isCurrent 
                      ? "bg-zinc-950 text-brand-accent border-zinc-950" 
                      : "bg-zinc-950 border-zinc-850"
                  )}>
                    {isPassed ? <CheckCircle2 size={14} className="text-emerald-500 animate-pulse" /> : idx + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h4 className="text-xs font-black uppercase truncate">{p.name}</h4>
                    <p className={cn(
                      "text-[9px] font-medium tracking-tight mt-0.5",
                      isCurrent ? "text-zinc-900" : "text-zinc-500"
                    )}>
                      {p.boardingTime ? `Embarque: ${p.boardingTime}` : 'Sem horário' } 
                      {p.phone ? ` • ${p.phone}` : ''}
                    </p>
                  </div>

                  {isCurrent && (
                    <span className="w-1.5 h-1.5 rounded-full bg-zinc-950 animate-ping absolute right-4 top-4" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Side: Active Parada Focus Panel */}
        <div className="lg:col-span-7 flex flex-col h-full bg-zinc-900/40 border border-zinc-900 rounded-[32px] p-6 relative overflow-hidden h-[73vh]">
          {currentPassenger ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-zinc-850 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 bg-brand-accent/20 text-brand-accent text-[9px] font-black uppercase tracking-wider rounded-lg border border-brand-accent/15">
                      Próximo Embarque Ativo
                    </span>
                  </div>
                  {currentPassenger.boardingTime && (
                    <span className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-widest">
                      Previsão: {currentPassenger.boardingTime}
                    </span>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">
                        Nome do Passageiro
                      </h4>
                      <h2 className="text-3xl font-black text-white uppercase tracking-tight mt-1">
                        {currentPassenger.name}
                      </h2>
                    </div>
                    {currentPassenger.phone && (
                      <a 
                        href={`tel:${currentPassenger.phone}`}
                        className="p-3 bg-zinc-900 hover:bg-emerald-900 text-emerald-500 hover:text-white rounded-2xl border border-zinc-850 transition-all cursor-pointer inline-flex items-center gap-1"
                        title="Fazer ligação de voz"
                      >
                        <Phone size={18} />
                      </a>
                    )}
                  </div>

                  {currentPassenger.locationUrl && (
                    <div className="bg-zinc-950 text-zinc-500 p-3 rounded-2xl border border-zinc-850 font-mono text-[9px] truncate">
                      📍 {currentPassenger.locationUrl}
                    </div>
                  )}

                  {/* Toggle Embedded Live Maps */}
                  {currentPassenger.locationUrl && (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                          Visualização de Satélite
                        </span>
                        <button
                          onClick={() => setIsMapEmbedVisible(!isMapEmbedVisible)}
                          className="text-[9px] font-black text-brand-accent uppercase tracking-widest flex items-center gap-1.5 focus:outline-none"
                        >
                          {isMapEmbedVisible ? (
                            <><EyeOff size={12} /> Ocultar Mapa</>
                          ) : (
                            <><Eye size={12} /> Exibir Mapa Integrado</>
                          )}
                        </button>
                      </div>

                      {isMapEmbedVisible && (
                        <div className="w-full h-44 rounded-2xl overflow-hidden border border-zinc-800">
                          <iframe
                            referrerPolicy="no-referrer"
                            src={getMapsEmbedUrl(currentPassenger.locationUrl, currentPassenger.name, userCoords)}
                            className="w-full h-full border-0"
                            allowFullScreen
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Footer for point */}
              <div className="space-y-4 pt-6 border-t border-zinc-900 mt-auto">
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleOpenGpsNavigation}
                    className="py-4 bg-brand-accent hover:bg-white text-zinc-950 font-black rounded-2xl text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg active:scale-95"
                  >
                    <Compass size={16} /> Abrir GPS (Waze/Maps)
                  </button>

                  <button
                    onClick={handleSendWhatsAppAlert}
                    className="py-4 bg-zinc-950 hover:bg-emerald-900 hover:text-white text-emerald-400 rounded-2xl text-[10px] uppercase tracking-widest font-black border border-emerald-900/30 flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                  >
                    <Send size={16} /> Enviar Mensagem do WhatsApp
                  </button>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <button
                    disabled={activeGpsPassengerIndex <= 0}
                    onClick={onPrevPassenger}
                    className="px-6 py-3 bg-zinc-950 hover:bg-zinc-900 disabled:opacity-40 rounded-xl text-[9px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={14} /> Voltar Parada Anterior
                  </button>

                  <button
                    onClick={() => onNextPassenger(false)}
                    className="px-8 py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-black rounded-xl text-[9px] uppercase tracking-widest flex items-center gap-2 shadow-lg cursor-pointer"
                  >
                    Confirmar e Seguir viagem <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
              <div className="w-16 h-16 bg-emerald-950 border border-emerald-905 flex items-center justify-center text-emerald-500 rounded-full">
                <CheckCircle2 size={32} className="animate-bounce" />
              </div>
              <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tight">Todas as Paradas Concluídas!</h3>
                <p className="text-xs text-zinc-500 font-bold uppercase tracking-wide mt-1">
                  Não existem mais passageiros para embarque nesta viagem.
                </p>
              </div>
              <button
                onClick={onCloseGps}
                className="px-6 py-3 bg-brand-accent text-zinc-950 font-black rounded-xl text-[9px] uppercase tracking-widest"
              >
                Concluir e Finalizar Escala
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
