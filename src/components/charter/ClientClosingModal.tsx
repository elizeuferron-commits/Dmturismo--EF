import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, Calendar, Sparkles, Printer, 
  Send, AlertCircle, CheckSquare, Square,
  Mail, MessageSquare, FileText, Eye, EyeOff
} from 'lucide-react';
import { Client, ClientTrip } from './CharterTypes';
import { safeFormatDate } from './CharterUtils';
import { cn } from '../../lib/utils';
import { ClientClosingGrid } from './ClientClosingGrid';
import { exportGridClosingPdf } from './ClientClosingPdf';

interface ClientClosingModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedClientDetail: Client;
  closingMonthYear: string;
  onUpdateMonthYear: (val: string) => void;
  filteredClosingTrips: ClientTrip[];
  selectedClosingTrips: Record<string, boolean>;
  onToggleTripSelected: (id: string) => void;
  onToggleSelectAll: () => void;
  employees: any[];
  vehicles: any[];
  onGeneratePDF: () => void;
  onWhatsAppSummary: () => void;
  onEmailSummary: () => void;
  onBulkUpdate: (option: 'billed' | 'received') => Promise<void>;
  closingPreviewData: {
    pdfUrl: string;
    trips: any[];
    client: any;
    fileName: string;
  } | null;
  onClearPreview: () => void;
  onPrintDossierContent: () => void;
  showValues?: boolean;
}

export const ClientClosingModal: React.FC<ClientClosingModalProps> = ({
  isOpen,
  onClose,
  selectedClientDetail,
  closingMonthYear,
  onUpdateMonthYear,
  filteredClosingTrips,
  selectedClosingTrips,
  onToggleTripSelected,
  onToggleSelectAll,
  employees,
  vehicles,
  onGeneratePDF,
  onWhatsAppSummary,
  onEmailSummary,
  onBulkUpdate,
  closingPreviewData,
  onClearPreview,
  onPrintDossierContent,
  showValues: initialShowValues = false
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedMedium, setSelectedMedium] = useState<'pdf' | 'whatsapp' | 'email'>('pdf');
  const [showValues, setShowValues] = useState(initialShowValues);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  if (!isOpen) return null;

  const handleBulkUpdateAction = async (status: 'billed' | 'received') => {
    setIsSubmitting(true);
    try {
      await onBulkUpdate(status);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isAllSelected = filteredClosingTrips.length > 0 && 
    filteredClosingTrips.every(t => selectedClosingTrips[t.id]);

  const totalCalculated = filteredClosingTrips
    .filter(t => selectedClosingTrips[t.id])
    .reduce((acc, t) => {
      const dailyRate = t.isExtra ? 0 : (selectedClientDetail.defaultTripValue || 0);
      const baseVal = dailyRate > 0 ? dailyRate : (t.value || 0);
      const extraVal = (t.hasExtraService && t.extraServiceVal) ? t.extraServiceVal : 0;
      return acc + baseVal + extraVal;
    }, 0);

  return (
    <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col my-8"
      >
        {/* Header Modal */}
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
              <Calendar size={20} />
            </div>
            <div>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Dossiê e Fechamento Mensal</h3>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">
                Cliente: {selectedClientDetail.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  viewMode === 'grid'
                    ? "bg-brand-accent text-zinc-950 font-sans shadow"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Matriz Tabela (Modelo Faturamento)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={cn(
                  "px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  viewMode === 'list'
                    ? "bg-brand-accent text-zinc-950 font-sans shadow"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                Lista de Viagens
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowValues(!showValues)}
              className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl text-[9px] font-black uppercase tracking-wider text-zinc-300 flex items-center gap-1.5 transition-all cursor-pointer"
            >
              {showValues ? <EyeOff size={12} className="text-amber-400" /> : <Eye size={12} className="text-zinc-400" />}
              {showValues ? "Ocultar Valores" : "Exibir Valores"}
            </button>
            <button 
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-white rounded-xl bg-zinc-950/40 hover:bg-zinc-850/80 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Section Split */}
        {viewMode === 'grid' ? (
          <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
            {/* Seletor de Competência */}
            <div className="flex justify-between items-center bg-zinc-950 p-4 border border-zinc-800 rounded-2xl">
              <div>
                <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block font-sans">
                  Competência Mensal para Faturamento
                </label>
                <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">
                  Gera a matriz diária por turno (Manhã/Tarde) com dias trabalhados e adicionais
                </p>
              </div>
              <input
                type="month"
                value={closingMonthYear}
                onChange={(e) => {
                  onClearPreview();
                  onUpdateMonthYear(e.target.value);
                }}
                className="bg-zinc-900 border border-zinc-700 rounded-xl py-2 px-3 text-white text-xs select-none outline-none focus:border-brand-accent font-mono font-bold"
              />
            </div>

            {/* Componente de Matriz do Fechamento no Modelo Unochapeco */}
            <ClientClosingGrid
              client={selectedClientDetail}
              closingMonthYear={closingMonthYear}
              trips={filteredClosingTrips}
              showValues={showValues}
              onGenerateGridPDF={(extras) => {
                exportGridClosingPdf(
                  selectedClientDetail,
                  closingMonthYear,
                  filteredClosingTrips,
                  extras,
                  (preview) => {
                    // Chamar a pré-visualização no modal
                    if (closingPreviewData !== undefined) {
                      // Trigger callback de visualização
                      onGeneratePDF();
                    }
                  }
                );
              }}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x lg:divide-zinc-800 max-h-[75vh] overflow-y-auto">
            {/* Form & Table Selection lists */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              <div className="space-y-4">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                  1. Seçâo de Competência Mensal
                </span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
                <div className="space-y-1.5 col-span-2">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">
                    Selecionar Mês/Ano de Exercício
                  </label>
                  <input
                    type="month"
                    value={closingMonthYear}
                    onChange={(e) => {
                      onClearPreview();
                      onUpdateMonthYear(e.target.value);
                    }}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs select-none outline-none focus:border-brand-accent"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                  2. Selecionar Viagens para Cobrança ({filteredClosingTrips.length})
                </span>
                {filteredClosingTrips.length > 0 && (
                  <button
                    onClick={onToggleSelectAll}
                    className="text-[9px] font-bold text-brand-accent bg-brand-accent/10 border border-brand-accent/25 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                  >
                    {isAllSelected ? "Desmarcar Todos" : "Marcar Todos"}
                  </button>
                )}
              </div>

              {filteredClosingTrips.length === 0 ? (
                <div className="bg-zinc-950/45 text-center py-8 rounded-3xl border border-dashed border-zinc-850 p-6">
                  <AlertCircle size={24} className="text-zinc-650 mx-auto mb-2" />
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                    Nenhuma viagem em aberto neste mês.
                  </p>
                  <p className="text-[9px] font-medium text-zinc-600 mt-1">
                    Selecione outra competência ou lance novos fretamentos.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {filteredClosingTrips.map((trip) => {
                    const isSelected = !!selectedClosingTrips[trip.id];
                    const tripDriver = employees.find(e => e.id === trip.driverId);
                    const tripVehicle = vehicles.find(v => v.id === trip.vehicleId);
                    const baseVal = trip.isExtra ? (trip.value || 0) : (selectedClientDetail.defaultTripValue || trip.value || 0);
                    const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
                    const valToApply = baseVal + extraVal;

                    return (
                      <div
                        key={trip.id}
                        onClick={() => onToggleTripSelected(trip.id)}
                        className={cn(
                          "p-3.5 border rounded-2xl transition-all cursor-pointer flex items-center justify-between group",
                          isSelected
                            ? "bg-brand-accent/5 border-brand-accent/40"
                            : "bg-zinc-950/40 border-zinc-850/60 hover:border-zinc-700/60"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <button 
                            type="button"
                            className="text-brand-accent"
                          >
                            {isSelected ? (
                              <CheckSquare size={16} className="fill-brand-accent/15" />
                            ) : (
                              <Square size={16} className="text-zinc-650 shrink-0" />
                            )}
                          </button>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <p className="text-[10px] font-extrabold text-white uppercase truncate max-w-[200px]">
                                {trip.description}
                              </p>
                              {trip.isExtra && (
                                <span className="px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-wider bg-[#ff6b00]/20 text-[#ff6b00] border border-[#ff6b00]/30 font-sans">
                                  EXTRA
                                </span>
                              )}
                              {trip.hasExtraService && (
                                <span className="px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-wider bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-sans">
                                  + ADICIONAL: {trip.extraServiceDesc?.toUpperCase()} ({showValues ? `+R$ ${trip.extraServiceVal}` : '+R$ ***'})
                                </span>
                              )}
                            </div>
                            <p className="text-[8px] font-bold text-zinc-500 uppercase mt-0.5">
                              {safeFormatDate(trip.dateTime, 'dd/MM, HH:mm')} 
                              {tripDriver ? ` • MOT: ${tripDriver.name.toUpperCase().split(' ')[0]}` : ''}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="text-[10px] font-black text-emerald-500">
                            {showValues ? `R$ ${valToApply.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••'}
                          </p>
                          <span className={cn(
                            "inline-block px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-wider border mt-1",
                            trip.paymentStatus === 'billed'
                              ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                              : "bg-zinc-900 text-zinc-500 border-zinc-800"
                          )}>
                            {trip.paymentStatus === 'billed' ? 'Faturado' : 'Aberto'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Rotas Fixas Cadastradas */}
            {selectedClientDetail.fixedRoutes && selectedClientDetail.fixedRoutes.length > 0 && (
              <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-[24px] space-y-3">
                <span className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest block font-sans">
                  Rotas Fixas Contratadas (Horários e Motoristas)
                </span>
                <div className="space-y-2">
                  {selectedClientDetail.fixedRoutes.map((route) => {
                    const routeDriver = employees.find(e => e.id === route.driverId);
                    const routeVehicle = vehicles.find(v => v.id === route.vehicleId);
                    const dayNamesMap: Record<number, string> = {
                      1: 'SEG',
                      2: 'TER',
                      3: 'QUA',
                      4: 'QUI',
                      5: 'SEX',
                      6: 'SÁB',
                      0: 'DOM'
                    };
                    const formattedDays = route.daysOfWeek && route.daysOfWeek.length > 0
                      ? route.daysOfWeek.map(d => dayNamesMap[d] || '').join(', ')
                      : null;

                    return (
                      <div key={route.id} className="flex justify-between items-center text-[10px] text-zinc-300 font-sans border-b border-zinc-900 pb-2 last:border-0 last:pb-0 last:mb-0">
                        <div>
                          <p className="font-extrabold text-white uppercase">{route.name}</p>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">
                            Horário: {route.schedule}
                          </p>
                          {formattedDays && (
                            <p className="text-[7px] text-[#ff6b00] font-black uppercase mt-0.5 tracking-wider">
                              DIAS: {formattedDays}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-400">
                            {routeDriver ? routeDriver.name.toUpperCase().split(' ')[0] : 'NÃO ALOCADO'}
                          </p>
                          {routeVehicle && (
                            <p className="text-[8px] text-zinc-500 font-bold mt-0.5">
                              Placa: {routeVehicle.plate.toUpperCase()}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Totalizers Widget Box */}
            <div className="p-4 bg-zinc-950 border border-zinc-850 rounded-[24px] space-y-3">
              <div className="flex justify-between items-center text-[10px] font-black text-zinc-500 uppercase tracking-wider">
                <span>Total de Viagens Faturadas</span>
                <span className="text-white">
                  {filteredClosingTrips.filter(t => selectedClosingTrips[t.id]).length} de {filteredClosingTrips.length}
                </span>
              </div>
              <div className="flex justify-between items-end pt-1 border-t border-zinc-850">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest pb-1">
                  Saldo Consolidado
                </span>
                <span className="text-2xl font-black text-emerald-500">
                  {showValues ? `R$ ${totalCalculated.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ ••••'}
                </span>
              </div>
            </div>

            {/* 3. Selecionar Meio de Fechamento */}
            {filteredClosingTrips.filter(t => selectedClosingTrips[t.id]).length > 0 && (
              <div className="space-y-4 pt-1">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                  3. Meio Selecionado para Fechamento
                </span>
                
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'pdf', label: 'PDF / IMPRESSÃO', desc: 'Dossiê documental PDF', icon: FileText, color: 'text-brand-accent bg-brand-accent/10 border-brand-accent/20' },
                    { id: 'whatsapp', label: 'WHATSAPP DIRECT', desc: 'Resumo estruturado no zap', icon: MessageSquare, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
                    { id: 'email', label: 'E-MAIL FINANCEIRO', desc: 'E-mail corporativo estruturado', icon: Mail, color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
                  ].map((medium) => {
                    const isChosen = selectedMedium === medium.id;
                    const IconComp = medium.icon;
                    return (
                      <button
                        key={medium.id}
                        type="button"
                        onClick={() => setSelectedMedium(medium.id as any)}
                        className={cn(
                          "p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 justify-between h-20",
                          isChosen
                            ? `${medium.color} ring-1 ring-offset-0 ring-current`
                            : "bg-zinc-950/40 border-zinc-850/60 hover:border-zinc-700/60 text-zinc-400"
                        )}
                      >
                        <div className="flex justify-between items-start w-full">
                          <IconComp size={14} className={isChosen ? '' : 'text-zinc-650'} />
                          {isChosen && <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                        </div>
                        <div>
                          <p className="text-[8px] font-black tracking-wider uppercase leading-none">{medium.label}</p>
                          <p className="text-[6px] font-semibold text-zinc-500 mt-1 line-clamp-1 leading-none">{medium.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons list */}
            {filteredClosingTrips.filter(t => selectedClosingTrips[t.id]).length > 0 && (
              <div className="pt-2">
                {selectedMedium === 'pdf' && (
                  <button
                    onClick={onGeneratePDF}
                    className="w-full py-3.5 bg-brand-accent hover:bg-white text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <Printer size={13} /> Gerar PDF Dossiê
                  </button>
                )}
                {selectedMedium === 'whatsapp' && (
                  <button
                    onClick={onWhatsAppSummary}
                    className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <MessageSquare size={13} /> Enviar p/ WhatsApp do Cliente
                  </button>
                )}
                {selectedMedium === 'email' && (
                  <button
                    onClick={onEmailSummary}
                    className="w-full py-3.5 bg-sky-600 hover:bg-sky-500 text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow"
                  >
                    <Mail size={13} /> Enviar p/ E-mail do Cliente
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Side: PDF Pre-visualization or printable Dossier preview */}
          <div className="p-6 bg-zinc-950/80 flex flex-col justify-between max-h-[75vh] overflow-y-auto">
            {closingPreviewData ? (
              <div className="flex flex-col h-full justify-between space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5 font-sans">
                    <Sparkles size={12} className="text-brand-accent font-sans" /> Dossiê Formatado para Impressão
                  </span>
                  <button 
                    onClick={onClearPreview}
                    className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-lg border border-rose-500/15 uppercase tracking-widest cursor-pointer"
                  >
                    Ocultar Ficha
                  </button>
                </div>

                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl overflow-hidden shadow-lg flex-1 min-h-[350px]">
                  <iframe 
                    title="Preview do faturamento pdf"
                    src={closingPreviewData.pdfUrl} 
                    className="w-full h-[380px] border-0 select-none pointer-events-auto"
                  />
                </div>

                {/* Confirm Batch Update States */}
                <div className="space-y-3 pt-3 border-t border-zinc-850">
                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">
                    Definir Lote em Cobrança como:
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleBulkUpdateAction('billed')}
                      className="py-3 bg-zinc-900 hover:bg-zinc-800 text-amber-500 font-extrabold border border-amber-900/15 rounded-xl text-[9px] uppercase tracking-wider cursor-pointer"
                    >
                      {isSubmitting ? "Gravando..." : "✓ Declarar FATURADO"}
                    </button>
                    <button
                      disabled={isSubmitting}
                      onClick={() => handleBulkUpdateAction('received')}
                      className="py-3 bg-emerald-950 text-white font-black hover:bg-emerald-900 border border-emerald-900/20 rounded-xl text-[9px] uppercase tracking-wider cursor-pointer"
                    >
                      {isSubmitting ? "Gravando..." : "$ Declarar RECEBIDO"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center h-full space-y-3 min-h-[350px]">
                <Calendar size={36} className="text-zinc-800 animate-pulse-slow" />
                <div>
                  <h4 className="text-xs font-black text-zinc-600 uppercase tracking-widest">Nenhum Dossiê Carregado</h4>
                  <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-wider mt-1 max-w-[240px]">
                    Marque as viagens desejadas e clique em "Gerar PDF Dossiê" para carregar a guia de acerto interativa.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
    </div>
  );
};
