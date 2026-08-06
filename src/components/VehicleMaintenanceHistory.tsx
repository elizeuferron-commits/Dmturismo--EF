import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Calendar, 
  DollarSign, 
  Building2, 
  Tag, 
  Trash2, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle, 
  Bus, 
  Clock, 
  Plus, 
  ChevronRight, 
  Loader2,
  FileText
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Vehicle, MaintenanceLog } from '../types';
import { Input, Select, Textarea, Button, ConfirmModal } from './UI';
import { cn } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

/**
 * Módulo de Prontuário de Manutenção de Veículos da Frota (Produção).
 * Fornece registro, digitalização assistida por IA, estatísticas e galeria do ativo.
 */
export const VehicleMaintenanceHistory = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string>('');
  const [loadingVehicles, setLoadingVehicles] = useState<boolean>(true);
  const [loadingLogs, setLoadingLogs] = useState<boolean>(true);
  
  // Form State
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [formLoading, setFormLoading] = useState<boolean>(false);
  const [completedAt, setCompletedAt] = useState<string>(new Date().toISOString().split('T')[0]);
  const [type, setType] = useState<'preventive' | 'corrective'>('preventive');
  const [provider, setProvider] = useState<string>('');
  const [partsReplaced, setPartsReplaced] = useState<string>('');
  const [cost, setCost] = useState<string>('');
  const [odometer, setOdometer] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  // Filter/Search State
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'preventive' | 'corrective'>('all');
  
  // Delete Dialog State
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; logId: string }>({
    isOpen: false,
    logId: ''
  });

  // AI Scanning & Uploading States
  const [scanning, setScanning] = useState<boolean>(false);
  const [scannedImage, setScannedImage] = useState<string>(''); // Base64 Data URL

  // Right Tab Toggle (Services List vs Asset Photos Gallery)
  const [rightTab, setRightTab] = useState<'services' | 'gallery'>('services');

  // Lightbox modal for full size view
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string; date: string } | null>(null);

  // File Upload and AI Scanning Handler
  const handleFileScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Convert file to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setScannedImage(dataUrl);
      setScanning(true);

      try {
        // Extract base64 block
        const base64Data = dataUrl.split(',')[1];
        const mimeType = file.type;

        // Call our server API endpoint
        const res = await fetch('/api/maintenance/scan-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64Data, mimeType })
        });

        if (!res.ok) {
          throw new Error("Falha ao escanear com a IA.");
        }

        const data = await res.json();
        
        // Distribute the extracted data into fields
        if (data.completedAt) setCompletedAt(data.completedAt);
        if (data.type) setType(data.type);
        if (data.provider) setProvider(data.provider);
        if (data.partsReplaced) setPartsReplaced(data.partsReplaced);
        if (data.cost) setCost(String(data.cost));
        if (data.odometer) setOdometer(String(data.odometer));
        if (data.description) setDescription(data.description);

        toast.success("Documento analisado com sucesso e dados preenchidos!");
      } catch (err) {
        console.error("AI scanning error:", err);
        toast.error("Ocorreu um erro ao processar o documento com IA.");
      } finally {
        setScanning(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Listen to Vehicles
  useEffect(() => {
    setLoadingVehicles(true);
    const unsub = dbCacheService.subscribeCollection('vehicles', (list) => {
      const sorted = (list as Vehicle[]).sort((a, b) => a.plate.localeCompare(b.plate));
      setVehicles(sorted);
      setLoadingVehicles(false);
      
      // Select first vehicle if none selected
      if (sorted.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(sorted[0].id);
      }
    });
    return unsub;
  }, []);

  // Listen to Maintenance Logs
  useEffect(() => {
    setLoadingLogs(true);
    const unsub = dbCacheService.subscribeCollection('maintenance_logs', (list) => {
      setMaintenanceLogs(list as MaintenanceLog[]);
      setLoadingLogs(false);
    });
    return unsub;
  }, []);

  // Selected Vehicle Object
  const selectedVehicle = useMemo(() => {
    return vehicles.find(v => v.id === selectedVehicleId);
  }, [vehicles, selectedVehicleId]);

  // Logs for Selected Vehicle
  const filteredLogs = useMemo(() => {
    if (!selectedVehicleId) return [];
    
    return maintenanceLogs
      .filter(log => log.vehicleId === selectedVehicleId)
      .filter(log => {
        // Search filter (description, supplier/provider, parts replaced)
        const matchesSearch = 
          (log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.provider || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
          (log.partsReplaced || '').toLowerCase().includes(searchTerm.toLowerCase());
          
        // Type filter
        const matchesType = 
          typeFilter === 'all' || 
          log.type === typeFilter;
          
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        const dateA = new Date(a.completedAt || a.scheduledDate || 0).getTime();
        const dateB = new Date(b.completedAt || b.scheduledDate || 0).getTime();
        return dateB - dateA; // Chronological descending
      });
  }, [maintenanceLogs, selectedVehicleId, searchTerm, typeFilter]);

  // Extract images from maintenance logs for Selected Vehicle Gallery
  const vehicleGallery = useMemo(() => {
    if (!selectedVehicleId) return [];
    
    const logs = maintenanceLogs.filter(log => log.vehicleId === selectedVehicleId);
    const images: { logId: string; date: string; provider: string; name: string; url: string }[] = [];
    
    logs.forEach(log => {
      if (log.attachments) {
        log.attachments.forEach(att => {
          if (att.type === 'image' || att.url?.startsWith('data:image/')) {
            images.push({
              logId: log.id || '',
              date: log.completedAt || log.scheduledDate || '',
              provider: log.provider || 'Manutenção',
              name: att.name || 'Comprovante',
              url: att.url
            });
          }
        });
      }
    });
    
    // Sort gallery images by date descending
    return images.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [maintenanceLogs, selectedVehicleId]);

  // Stats for Selected Vehicle
  const stats = useMemo(() => {
    const logs = maintenanceLogs.filter(log => log.vehicleId === selectedVehicleId);
    
    const totalSpent = logs.reduce((acc, log) => acc + (log.cost || 0), 0);
    const preventiveCount = logs.filter(log => log.type === 'preventive').length;
    const correctiveCount = logs.filter(log => log.type === 'corrective').length;
    
    // Find latest completed date
    const completedLogs = logs.filter(log => log.completedAt);
    let lastDate = 'Nenhuma registrada';
    if (completedLogs.length > 0) {
      const sorted = [...completedLogs].sort((a, b) => 
        new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime()
      );
      try {
        lastDate = format(parseISO(sorted[0].completedAt!), 'dd/MM/yyyy', { locale: ptBR });
      } catch {
        lastDate = sorted[0].completedAt!;
      }
    }

    return {
      totalSpent,
      preventiveCount,
      correctiveCount,
      totalCount: logs.length,
      lastDate
    };
  }, [maintenanceLogs, selectedVehicleId]);

  // Handle Form Submission
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVehicleId) {
      toast.error("Por favor, selecione um veículo.");
      return;
    }
    if (!provider.trim()) {
      toast.error("Por favor, informe a oficina ou fornecedor.");
      return;
    }
    if (!partsReplaced.trim()) {
      toast.error("Por favor, liste as peças substituídas.");
      return;
    }
    if (!cost || isNaN(Number(cost)) || Number(cost) < 0) {
      toast.error("Por favor, insira um custo válido.");
      return;
    }

    setFormLoading(true);
    const numericCost = Number(cost);
    const numericOdometer = odometer ? Number(odometer) : (selectedVehicle?.currentOdometer || 0);

    const payload: Partial<MaintenanceLog> = {
      vehicleId: selectedVehicleId,
      completedAt,
      scheduledDate: completedAt,
      type,
      provider: provider.trim(),
      partsReplaced: partsReplaced.trim(),
      cost: numericCost,
      odometer: numericOdometer,
      description: description.trim() || `Manutenção ${type === 'preventive' ? 'Preventiva' : 'Corretiva'} - ${provider.trim()}`,
      status: 'completed', // Saved directly as completed history record
      createdAt: new Date().toISOString()
    };

    if (scannedImage) {
      payload.attachments = [
        {
          name: `Comprovante_${completedAt}_${provider.trim().replace(/\s+/g, '_')}.png`,
          url: scannedImage,
          type: 'image'
        }
      ];
    }

    try {
      // Save directly to 'maintenance_logs'
      await addDoc(collection(db, 'maintenance_logs'), payload);
      
      // Update vehicle's odometer and last maintenance status if new odometer is larger
      const vehicleRef = doc(db, 'vehicles', selectedVehicleId);
      const updatePayload: any = {
        lastMaintenanceDate: completedAt,
        lastMaintenanceKM: numericOdometer,
        updatedAt: new Date().toISOString()
      };

      if (numericOdometer > (selectedVehicle?.currentOdometer || 0)) {
        updatePayload.currentOdometer = numericOdometer;
      }

      await updateDoc(vehicleRef, updatePayload);

      toast.success("Histórico de manutenção registrado com sucesso!");
      
      // Clear Form and close
      setProvider('');
      setPartsReplaced('');
      setCost('');
      setOdometer('');
      setDescription('');
      setScannedImage('');
      setIsFormOpen(false);
    } catch (err: any) {
      console.error("Error saving maintenance history:", err);
      toast.error("Erro ao registrar no banco de dados.");
      handleFirestoreError(err, OperationType.WRITE, 'maintenance_logs');
    } finally {
      setFormLoading(false);
    }
  };

  // Handle Delete Confirmation
  const handleDeleteLog = async () => {
    if (!deleteConfirm.logId) return;
    try {
      await dbCacheService.removeDocumentFromCollection('maintenance_logs', deleteConfirm.logId);
      await deleteDoc(doc(db, 'maintenance_logs', deleteConfirm.logId));
      toast.success("Manutenção excluída do histórico com sucesso!");
    } catch (err: any) {
      console.error("Error deleting log:", err);
      toast.error("Falha ao excluir registro do histórico.");
      handleFirestoreError(err, OperationType.DELETE, `maintenance_logs/${deleteConfirm.logId}`);
    } finally {
      setDeleteConfirm({ isOpen: false, logId: '' });
    }
  };

  return (
    <div className="space-y-8 p-1 sm:p-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/20 p-6 rounded-3xl border border-white/5 backdrop-blur-md">
        <div>
          <span className="text-[10px] font-black text-brand-accent uppercase tracking-[0.25em] block leading-none font-mono">
            Prontuário Digital
          </span>
          <h2 className="text-xl font-black text-white uppercase tracking-tight mt-2 flex items-center gap-3">
            <Wrench className="text-brand-accent stroke-[2.5] w-5 h-5" /> 
            Histórico Digital de Manutenções
          </h2>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-tight mt-1">
            Controle de serviços preventivos, corretivos, fornecedores e peças substituídas.
          </p>
        </div>
        
        {/* Vehicle Selection Dropdown */}
        <div className="w-full sm:w-72">
          {loadingVehicles ? (
            <div className="h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-xs text-zinc-500 animate-pulse">
              <Loader2 className="animate-spin mr-2" size={14} /> Carregando frota...
            </div>
          ) : (
            <div className="relative group">
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="w-full pl-6 pr-12 py-4 bg-zinc-950 border border-white/10 focus:border-brand-accent rounded-2xl font-black text-white outline-none transition-all appearance-none text-xs uppercase tracking-wider"
              >
                <option value="" disabled>SELECIONE UM VEÍCULO</option>
                {vehicles.map(v => (
                  <option key={v.id} value={v.id} className="bg-zinc-950 text-white">
                    {v.plate} - {v.model} ({v.type.toUpperCase()})
                  </option>
                ))}
              </select>
              <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                <ChevronRight className="rotate-90 stroke-[3]" size={14} />
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedVehicleId ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Stats & Form */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Vehicle Card Profile */}
            <div className="bg-zinc-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden backdrop-blur-md">
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-brand-accent/10 rounded-2xl text-brand-accent">
                  <Bus size={24} className="stroke-[2]" />
                </div>
                <div>
                  <h3 className="text-md font-black text-white uppercase tracking-tight">{selectedVehicle?.plate || '---'}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                    {selectedVehicle?.model || 'Não identificado'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-4 border-t border-white/5 pt-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Odômetro Atual</span>
                  <span className="text-white font-black font-mono">
                    {selectedVehicle?.currentOdometer?.toLocaleString() || 0} KM
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Capacidade</span>
                  <span className="text-white font-black font-mono">
                    {selectedVehicle?.capacity || 0} Passageiros
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-500 font-bold uppercase tracking-wider text-[9px]">Último Serviço</span>
                  <span className="text-brand-accent font-black">
                    {stats.lastDate}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Stats Panel */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-5 backdrop-blur-md text-center">
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Investimento Total</p>
                <p className="text-lg font-black text-white mt-2 font-mono tracking-tight text-emerald-500">
                  R$ {stats.totalSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-zinc-950/40 border border-white/5 rounded-2xl p-5 backdrop-blur-md text-center">
                <p className="text-[8px] font-black uppercase text-zinc-500 tracking-wider">Serviços Executados</p>
                <p className="text-lg font-black text-white mt-2 font-mono tracking-tight">
                  {stats.totalCount} <span className="text-[10px] text-zinc-500 font-bold">OS</span>
                </p>
              </div>
            </div>

            <div className="bg-zinc-950/20 border border-white/5 rounded-2xl p-4 flex justify-around text-center text-xs">
              <div>
                <p className="text-sky-400 font-black font-mono text-lg">{stats.preventiveCount}</p>
                <p className="text-[8px] font-bold uppercase text-zinc-500 tracking-wider mt-1">Preventivas</p>
              </div>
              <div className="w-[1px] bg-white/10" />
              <div>
                <p className="text-zinc-400 font-black font-mono text-lg">{stats.correctiveCount}</p>
                <p className="text-[8px] font-bold uppercase text-zinc-500 tracking-wider mt-1">Corretivas</p>
              </div>
            </div>

            {/* Registrar Manutenção Button & Form */}
            <div className="space-y-4">
              <button
                onClick={() => setIsFormOpen(!isFormOpen)}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border border-white/5 rounded-2xl font-black text-xs uppercase tracking-widest text-white transition-all flex items-center justify-center gap-3 shadow-xl cursor-pointer"
              >
                <Plus size={16} className={cn("transition-transform duration-300 stroke-[3]", isFormOpen && "rotate-45 text-brand-accent")} />
                {isFormOpen ? "Fechar Formulário" : "Registrar Manutenção"}
              </button>

              {isFormOpen && (
                <div className="bg-zinc-900/60 border border-white/10 rounded-[2rem] p-6 space-y-6 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-200">
                  <div className="border-b border-white/5 pb-3">
                    <h4 className="text-xs font-black text-white uppercase tracking-widest flex items-center gap-2">
                      <Sparkles size={14} className="text-brand-accent" /> Registrar Lançamento
                    </h4>
                  </div>
                  
                  <form onSubmit={handleSave} className="space-y-4 text-left">
                    {/* AI Scan Upload Area */}
                    <div className="border-2 border-dashed border-zinc-850 hover:border-brand-accent/40 rounded-2xl p-4 transition-all text-center relative group bg-zinc-950/40">
                      {scanning ? (
                        <div className="py-6 flex flex-col items-center justify-center space-y-3">
                          <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
                          <p className="text-[10px] font-black text-brand-accent uppercase tracking-widest animate-pulse">
                            IA Analisando Documento...
                          </p>
                          <p className="text-[8px] text-zinc-500 font-bold uppercase">
                            Lendo valores, fornecedor, peças e datas...
                          </p>
                        </div>
                      ) : scannedImage ? (
                        <div className="space-y-3">
                          <div className="relative w-full h-32 bg-zinc-950 rounded-xl overflow-hidden border border-white/5">
                            <img 
                              src={scannedImage} 
                              alt="Documento escaneado" 
                              className="w-full h-full object-contain"
                            />
                            <button
                              type="button"
                              onClick={() => setScannedImage('')}
                              className="absolute top-2 right-2 px-2 py-1 bg-rose-950/80 hover:bg-rose-900 border border-rose-500/30 rounded-lg text-rose-400 text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Remover
                            </button>
                          </div>
                          <p className="text-[9px] text-emerald-400 font-black uppercase tracking-wider flex items-center justify-center gap-1.5">
                            <CheckCircle2 size={12} /> Dados preenchidos por IA nos campos abaixo!
                          </p>
                        </div>
                      ) : (
                        <label className="cursor-pointer block py-4">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileScan}
                            className="hidden"
                          />
                          <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="w-10 h-10 bg-brand-accent/10 text-brand-accent rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform">
                              <Sparkles size={18} className="stroke-[2.5]" />
                            </div>
                            <div>
                              <span className="text-[10px] font-black text-white uppercase tracking-wider block">
                                Escanear Comprovante com IA
                              </span>
                              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wide block mt-1">
                                Tire foto ou selecione o comprovante
                              </span>
                            </div>
                          </div>
                        </label>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Data do Serviço" 
                        type="date" 
                        value={completedAt} 
                        onChange={(e: any) => setCompletedAt(e.target.value)} 
                        required 
                      />
                      <Select 
                        label="Tipo de Serviço" 
                        value={type} 
                        onChange={(e: any) => setType(e.target.value as any)} 
                        options={[
                          { value: 'preventive', label: 'PREVENTIVA' },
                          { value: 'corrective', label: 'CORRETIVA' }
                        ]}
                      />
                    </div>

                    <Input 
                      label="Fornecedor / Oficina" 
                      placeholder="Ex: Oficina Mecânica DM ou Auto Peças Silva" 
                      value={provider} 
                      onChange={(e: any) => setProvider(e.target.value)} 
                      icon={Building2}
                      required 
                    />

                    <Textarea 
                      label="Peças Substituídas" 
                      placeholder="Ex: Pastilhas de freio dianteiras, filtros de óleo e ar" 
                      value={partsReplaced} 
                      onChange={(e: any) => setPartsReplaced(e.target.value)} 
                      required 
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <Input 
                        label="Custo Total (R$)" 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={cost} 
                        onChange={(e: any) => setCost(e.target.value)} 
                        icon={DollarSign}
                        required 
                      />
                      <Input 
                        label="KM / Odômetro" 
                        type="number" 
                        placeholder={String(selectedVehicle?.currentOdometer || '')} 
                        value={odometer} 
                        onChange={(e: any) => setOdometer(e.target.value)} 
                        icon={Clock}
                      />
                    </div>

                    <Textarea 
                      label="Observações / Descrição" 
                      placeholder="Detalhes adicionais sobre a manutenção preventiva ou problemas identificados." 
                      value={description} 
                      onChange={(e: any) => setDescription(e.target.value)} 
                    />

                    <Button type="submit" loading={formLoading} className="w-full mt-2">
                      Gravar no Histórico
                    </Button>
                  </form>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: History List */}
          <div className="lg:col-span-8 flex flex-col space-y-4">
            
            {/* Tab switch */}
            <div className="flex bg-zinc-950/60 p-1 rounded-2xl border border-white/5 w-fit">
              <button
                type="button"
                onClick={() => setRightTab('services')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  rightTab === 'services' 
                    ? "bg-zinc-900 text-brand-accent border border-white/10 shadow-lg" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                <FileText size={12} />
                Serviços Executados ({filteredLogs.length})
              </button>
              <button
                type="button"
                onClick={() => setRightTab('gallery')}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2",
                  rightTab === 'gallery' 
                    ? "bg-zinc-900 text-brand-accent border border-white/10 shadow-lg" 
                    : "text-zinc-500 hover:text-white"
                )}
              >
                <Sparkles size={12} />
                Galeria do Ativo ({vehicleGallery.length})
              </button>
            </div>

            {rightTab === 'services' ? (
              <>
                {/* Search & Filters */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 border border-white/5 rounded-3xl p-5 backdrop-blur-md">
              
              {/* Search Bar */}
              <div className="relative w-full sm:flex-1 group">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-brand-accent transition-colors stroke-[2.5]" size={16} />
                <input
                  type="text"
                  placeholder="Pesquisar peças, oficina ou descrição..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-14 pr-6 py-4 bg-zinc-950 border border-white/5 focus:border-brand-accent rounded-2xl text-xs font-bold text-white placeholder:text-zinc-600 outline-none transition-all"
                />
              </div>

              {/* Type Filters */}
              <div className="flex gap-2 w-full sm:w-auto overflow-x-auto">
                {(['all', 'preventive', 'corrective'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTypeFilter(tab)}
                    className={cn(
                      "px-4 py-3 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                      typeFilter === tab 
                        ? "bg-brand-accent text-zinc-950 shadow-lg shadow-brand-accent/10" 
                        : "bg-zinc-900 text-zinc-500 hover:text-white"
                    )}
                  >
                    {tab === 'all' ? 'TUDO' : tab === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 bg-zinc-950/40 border border-white/5 rounded-[2rem] p-6 flex flex-col relative overflow-hidden backdrop-blur-md min-h-[500px]">
              {loadingLogs ? (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 py-20">
                  <Loader2 className="w-8 h-8 text-brand-accent animate-spin mb-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Sincronizando histórico...</span>
                </div>
              ) : filteredLogs.length > 0 ? (
                <div className="space-y-4 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar">
                  {filteredLogs.map((log) => {
                    let formattedDate = log.completedAt || log.scheduledDate;
                    try {
                      formattedDate = format(parseISO(formattedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
                    } catch {
                      // Fallback
                    }
                    
                    return (
                      <div 
                        key={log.id} 
                        className="bg-zinc-900/60 hover:bg-zinc-900 border border-white/5 hover:border-brand-accent/20 rounded-2xl p-5 sm:p-6 transition-all group flex flex-col md:flex-row md:items-start justify-between gap-6 relative overflow-hidden"
                      >
                        <div className="space-y-3 flex-1">
                          
                          {/* Date and Type Badge */}
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-[10px] font-black text-zinc-500 font-mono tracking-tight uppercase flex items-center gap-1.5">
                              <Calendar size={12} className="text-brand-accent" />
                              {formattedDate}
                            </span>
                            <span className={cn(
                              "text-[8px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-widest border",
                              log.type === 'preventive' 
                                ? "bg-sky-500/10 text-sky-400 border-sky-500/20" 
                                : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                            )}>
                              {log.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA'}
                            </span>
                            {log.odometer && (
                              <span className="text-[9px] font-bold text-zinc-600 font-mono bg-zinc-950/50 px-2 py-0.5 rounded-lg border border-white/5 uppercase">
                                {log.odometer.toLocaleString()} KM
                              </span>
                            )}
                          </div>

                          {/* Provider / Workshop */}
                          {log.provider && (
                            <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                              <Building2 size={13} className="text-brand-accent shrink-0" />
                              {log.provider}
                            </h4>
                          )}

                          {/* Parts replaced */}
                          {log.partsReplaced && (
                            <div className="p-3 bg-zinc-950/40 rounded-xl border border-white/5 space-y-1.5">
                              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Tag size={10} className="text-zinc-500" /> Peças Substituídas:
                              </p>
                              <p className="text-[11px] font-bold text-zinc-300 uppercase leading-relaxed font-mono">
                                {log.partsReplaced}
                              </p>
                            </div>
                          )}

                          {/* Details / Description */}
                          {log.description && (
                            <p className="text-[11px] text-zinc-500 font-medium italic">
                              "{log.description}"
                            </p>
                          )}
                        </div>

                        {/* Cost & Delete Action */}
                        <div className="flex md:flex-col justify-between items-end gap-4 shrink-0 border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                          
                          {/* Cost */}
                          <div className="text-left md:text-right">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Investimento</span>
                            <span className="text-md font-black text-emerald-400 font-mono tracking-tight block mt-1">
                              R$ {log.cost.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>

                          {/* Ver Comprovante if attachments exist */}
                          {log.attachments && log.attachments.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                const att = log.attachments.find((a: any) => a.type === 'image' || a.url?.startsWith('data:image/'));
                                if (att) {
                                  let dateStr = log.completedAt || log.scheduledDate;
                                  try {
                                    dateStr = format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
                                  } catch {
                                    // fallback
                                  }
                                  setLightboxImage({
                                    url: att.url,
                                    title: log.provider || 'Comprovante',
                                    date: dateStr
                                  });
                                }
                              }}
                              className="w-10 h-10 bg-brand-accent/10 hover:bg-brand-accent hover:text-zinc-950 text-brand-accent rounded-xl transition-all flex items-center justify-center border border-brand-accent/20 active:scale-90"
                              title="Ver Comprovante Escaneado"
                            >
                              <Sparkles size={14} className="stroke-[2.5]" />
                            </button>
                          )}

                          {/* Delete */}
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm({ isOpen: true, logId: log.id })}
                            className="w-10 h-10 bg-rose-500/10 hover:bg-rose-500 hover:text-white text-rose-500 rounded-xl transition-all flex items-center justify-center border border-rose-500/20 active:scale-90"
                            title="Excluir do Histórico"
                          >
                            <Trash2 size={14} className="stroke-[2.5]" />
                          </button>

                        </div>

                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-center py-24 space-y-4">
                  <div className="w-14 h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-500">
                    <FileText size={22} className="stroke-[1.5]" />
                  </div>
                  <div>
                    <h5 className="text-xs font-black text-white uppercase tracking-widest">Sem Histórico de Manutenção</h5>
                    <p className="text-[10px] text-zinc-500 font-medium uppercase mt-1">
                      Nenhum serviço foi registrado para este veículo ainda.
                    </p>
                  </div>
                </div>
              )}
                </div>
              </>
            ) : (
              /* Render the Gallery here! */
              <div className="flex-1 bg-zinc-950/40 border border-white/5 rounded-[2rem] p-6 flex flex-col relative overflow-hidden backdrop-blur-md min-h-[500px]">
                {vehicleGallery.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[750px] overflow-y-auto pr-2 custom-scrollbar animate-in fade-in duration-300">
                    {vehicleGallery.map((img, i) => (
                      <div 
                        key={`${img.logId}-${i}`}
                        onClick={() => {
                          let dateStr = img.date;
                          try {
                            dateStr = format(parseISO(dateStr), "dd/MM/yyyy", { locale: ptBR });
                          } catch {
                            // fallback
                          }
                          setLightboxImage({ url: img.url, title: img.provider, date: dateStr });
                        }}
                        className="group aspect-square bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden cursor-pointer relative hover:border-brand-accent/40 transition-all shadow-md animate-in zoom-in-95"
                      >
                        <img 
                          src={img.url} 
                          alt={img.name} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                        {/* Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-3">
                          <span className="text-[8px] font-black uppercase text-brand-accent tracking-widest">{img.date}</span>
                          <p className="text-[10px] font-bold uppercase text-white truncate mt-1">{img.provider}</p>
                        </div>
                        {/* Non-hover indicator */}
                        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[7px] font-black uppercase text-zinc-400 tracking-wider">
                          Ver Foto
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-zinc-600 text-center py-24 space-y-4">
                    <div className="w-14 h-14 bg-zinc-900 border border-white/5 rounded-2xl flex items-center justify-center text-zinc-500">
                      <Sparkles size={22} className="stroke-[1.5]" />
                    </div>
                    <div>
                      <h5 className="text-xs font-black text-white uppercase tracking-widest">Galeria de Fotos Vazia</h5>
                      <p className="text-[10px] text-zinc-500 font-medium uppercase mt-1">
                        Nenhuma foto de comprovante ou documento foi anexada ainda.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>
      ) : (
        <div className="bg-zinc-900/20 border border-white/5 rounded-[3rem] p-16 text-center flex flex-col items-center justify-center space-y-6">
          <div className="w-16 h-16 bg-zinc-900/60 border border-white/5 rounded-2xl flex items-center justify-center text-brand-accent">
            <Bus size={28} className="stroke-[1.5]" />
          </div>
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Selecione um Ativo</h4>
            <p className="text-[10px] text-zinc-500 font-bold uppercase mt-2 tracking-wide">
              Escolha um veículo na lista acima para carregar o prontuário de manutenção completo.
            </p>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false, logId: '' })}
        onConfirm={handleDeleteLog}
        title="Excluir Registro de Manutenção"
        message="Tem certeza que deseja remover permanentemente este serviço do histórico? Esta operação não pode ser desfeita."
        confirmLabel="Sim, Excluir do Histórico"
      />

      {/* Image Lightbox Modal */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200">
          {/* Close button */}
          <button
            type="button"
            onClick={() => setLightboxImage(null)}
            className="absolute top-6 right-6 p-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-full border border-white/10 transition-all active:scale-95 cursor-pointer z-50"
          >
            <Plus size={20} className="rotate-45 stroke-[2.5]" />
          </button>
          
          {/* Content */}
          <div className="max-w-4xl w-full flex flex-col items-center space-y-4 relative">
            <div className="w-full max-h-[75vh] overflow-hidden rounded-3xl border border-white/10 bg-zinc-950 flex items-center justify-center shadow-2xl">
              <img 
                src={lightboxImage.url} 
                alt={lightboxImage.title} 
                className="max-h-[75vh] max-w-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="text-center space-y-1">
              <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent font-mono">
                Documento Registrado em {lightboxImage.date}
              </span>
              <h4 className="text-sm font-black uppercase tracking-wide text-white">
                {lightboxImage.title}
              </h4>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
