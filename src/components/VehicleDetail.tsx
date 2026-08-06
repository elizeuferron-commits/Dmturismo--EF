import React, { useState, useEffect, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bus, 
  Wrench, 
  Fuel, 
  Calendar, 
  Users, 
  Hash, 
  Edit3,
  Clock,
  Navigation,
  BarChart3,
  DollarSign,
  ClipboardCheck,
  CheckCircle2,
  AlertCircle,
  Printer,
  Share2,
  Trash2,
  Camera,
  Plus,
  LayoutDashboard,
  MapPin,
  TrendingUp,
  FileSpreadsheet,
  Globe,
  X,
  Map as MapIcon,
  FileText
} from 'lucide-react';
import { Vehicle, MaintenanceLog, FuelLog, Checklist, Employee, OperationType, Trip, VehiclePreventiveKMRoute } from '../types';
import { format, parseISO, startOfMonth, differenceInDays, isBefore, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { Modal, ConfirmModal } from './UI';
import { ChecklistForm } from './ChecklistDrawer';
import { MaintenanceForm } from './MaintenanceForm';
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc, updateDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { toast } from 'sonner';
import { getAuth } from 'firebase/auth';
import { auditService } from '../services/auditService';
import { FinanceDocumentVencimentos } from './FinanceDocumentVencimentos';
import { PhotoGallery } from './PhotoGallery';

const getWarrantyStatus = (vehicle: Vehicle) => {
  const currentYear = new Date().getFullYear();
  const factoryYearNum = parseInt(vehicle.factoryYear);
  
  if (isNaN(factoryYearNum)) {
    return {
      status: 'NÃO IDENTIFICADO',
      details: 'Ano de fabricação do veículo inválido ou não cadastrado.',
      color: [161, 161, 170] as [number, number, number] // zinc-400
    };
  }
  
  const age = currentYear - factoryYearNum;
  const warrantyYears = 3;
  
  if (age <= warrantyYears) {
    return {
      status: 'SOB GARANTIA DE FÁBRICA',
      details: `Ativo com ${age} ano(s) de uso. Cobertura original de fábrica ativa (término estimado).`,
      color: [16, 185, 129] as [number, number, number] // emerald-500
    };
  } else if (age <= 5) {
    return {
      status: 'GARANTIA EXPIRADA (CONTROLE PREVENTIVO)',
      details: `Ativo com ${age} anos de uso. Fora do período original. Manutenção preventiva recomendada.`,
      color: [245, 158, 11] as [number, number, number] // amber-500
    };
  } else {
    return {
      status: 'GARANTIA EXPIRADA',
      details: `Ativo com ${age} anos de uso extenso. Exige verificações sistemáticas de segurança estrutural.`,
      color: [239, 68, 68] as [number, number, number] // red-500
    };
  }
};
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
  Legend,
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area
} from 'recharts';

interface VehicleDetailProps {
  vehicle: Vehicle;
  vehicles?: Vehicle[];
  maintenanceHistory: MaintenanceLog[];
  fuelHistory: FuelLog[];
  employees: Employee[];
  trips?: Trip[];
  onEdit: () => void;
  onAddMaintenance?: () => void;
  onEditMaintenance?: (log: MaintenanceLog) => void;
  onDeleteMaintenance?: (id: string) => void;
  onPrintOS: (log: MaintenanceLog) => void;
  onDelete?: () => void;
  onSold?: () => void;
  onSaveMaintenance?: (data: any) => Promise<void>;
  isSavingMaintenance?: boolean;
  onAddTrip?: (vehicleId: string) => void;
  onAddFuel?: (vehicleId: string) => void;
}

export const VehicleDetail = memo(({ 
  vehicle, 
  vehicles = [], 
  maintenanceHistory, 
  fuelHistory, 
  employees, 
  trips = [], 
  onEdit, 
  onAddMaintenance, 
  onEditMaintenance, 
  onDeleteMaintenance, 
  onPrintOS, 
  onDelete,
  onSold,
  onSaveMaintenance,
  isSavingMaintenance,
  onAddTrip,
  onAddFuel
}: VehicleDetailProps) => {
  const [activeOverlayTab, setActiveOverlayTab] = useState<'overview' | 'maintenance' | 'checklists' | 'charts' | 'documents' | 'photos' | null>(null);
  const [innerMaintenanceForm, setInnerMaintenanceForm] = useState<{ isOpen: boolean; initialData: any } | null>(null);
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [isChecklistModalOpen, setIsChecklistModalOpen] = useState(false);
  const [isSubmiting, setIsSubmiting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, type: 'vehicle' | 'fuel' | 'maintenance' | 'checklist'}>({
    isOpen: false,
    id: '',
    type: 'fuel'
  });
  const [soldConfirmOpen, setSoldConfirmOpen] = useState(false);
  const [isMarkingAsSold, setIsMarkingAsSold] = useState(false);
  
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editNextOilKM, setEditNextOilKM] = useState<string>('');
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // States for KM-based preventive maintenance routes
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [newRouteTemplate, setNewRouteTemplate] = useState('custom');
  const [newRouteName, setNewRouteName] = useState('');
  const [newRouteInterval, setNewRouteInterval] = useState('');
  const [newRouteLastKM, setNewRouteLastKM] = useState(String(vehicle.currentOdometer || 0));
  const [isSavingRoute, setIsSavingRoute] = useState(false);

  // Synchronize new route starting KM when vehicle updates
  useEffect(() => {
    if (!isAddingRoute) {
      setNewRouteLastKM(String(vehicle.currentOdometer || 0));
    }
  }, [vehicle.currentOdometer, isAddingRoute]);

  const handleAddRoute = async () => {
    const finalTemplateName = newRouteTemplate !== 'custom' ? newRouteTemplate : newRouteName;
    if (!finalTemplateName || finalTemplateName.trim() === '') {
      toast.error('Informe o nome da rota de manutenção.');
      return;
    }
    const intervalNum = Number(newRouteInterval);
    if (!intervalNum || intervalNum <= 0) {
      toast.error('Informe um intervalo em KM válido (maior que zero).');
      return;
    }
    const lastKMNum = Number(newRouteLastKM || 0);

    try {
      setIsSavingRoute(true);
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      
      const newRoute: VehiclePreventiveKMRoute = {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11),
        routeName: finalTemplateName.trim(),
        kmInterval: intervalNum,
        lastKM: lastKMNum,
        nextDueKM: lastKMNum + intervalNum
      };

      const currentRoutes = vehicle.preventiveKMConfig || [];
      const updatedRoutes = [...currentRoutes, newRoute];

      await updateDoc(vehicleRef, {
        preventiveKMConfig: updatedRoutes
      });

      // Audit logs
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        await addDoc(collection(db, 'shadow_logs'), {
          timestamp: new Date().toISOString(),
          actor: user?.email || 'sistema',
          action: 'Configuração de Rota de Manutenção Preventiva (KM)',
          details: `Adicionou a rota preventiva "${newRoute.routeName}" (A cada ${newRoute.kmInterval.toLocaleString()} KM) para o veículo de placa ${vehicle.plate}.`,
          type: 'INFO'
        });
      } catch (logErr) {
        console.error('Erro ao registrar shadow log:', logErr);
      }

      toast.success('Nova rota preventiva configurada com sucesso!');
      setIsAddingRoute(false);
      setNewRouteName('');
      setNewRouteTemplate('custom');
      setNewRouteInterval('');
      setNewRouteLastKM(String(vehicle.currentOdometer || 0));
    } catch (error) {
      console.error('Erro ao configurar nova rota:', error);
      toast.error('Erro ao configurar nova rota.');
    } finally {
      setIsSavingRoute(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      const currentRoutes = vehicle.preventiveKMConfig || [];
      const updatedRoutes = currentRoutes.filter(r => r.id !== routeId);

      await updateDoc(vehicleRef, {
        preventiveKMConfig: updatedRoutes
      });

      // Audit logs
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        await addDoc(collection(db, 'shadow_logs'), {
          timestamp: new Date().toISOString(),
          actor: user?.email || 'sistema',
          action: 'Remoção de Rota de Manutenção Preventiva (KM)',
          details: `Removeu uma rota de manutenção preventiva do veículo ${vehicle.plate}.`,
          type: 'INFO'
        });
      } catch (logErr) {
        console.error('Erro ao registrar shadow log:', logErr);
      }

      toast.success('Rota de manutenção removida com sucesso.');
    } catch (error) {
      console.error('Erro ao remover rota:', error);
      toast.error('Erro ao remover rota.');
    }
  };

  const handleResetRoute = async (routeId: string) => {
    try {
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      const currentRoutes = vehicle.preventiveKMConfig || [];
      const currentOdo = vehicle.currentOdometer || 0;

      const updatedRoutes = currentRoutes.map(r => {
        if (r.id === routeId) {
          return {
            ...r,
            lastKM: currentOdo,
            nextDueKM: currentOdo + r.kmInterval
          };
        }
        return r;
      });

      await updateDoc(vehicleRef, {
        preventiveKMConfig: updatedRoutes
      });

      // Register shadow log
      try {
        const auth = getAuth();
        const user = auth.currentUser;
        await addDoc(collection(db, 'shadow_logs'), {
          timestamp: new Date().toISOString(),
          actor: user?.email || 'sistema',
          action: 'Execução de Rota Preventiva (KM)',
          details: `Reiniciou e marcou como realizada uma rota preventiva no veículo ${vehicle.plate}.`,
          type: 'INFO'
        });
      } catch (logErr) {
        console.error('Erro ao registrar shadow log:', logErr);
      }

      toast.success('Rota reiniciada! Progresso redefinido para 0%.');
    } catch (error) {
      console.error('Erro ao reiniciar rota:', error);
      toast.error('Erro ao reiniciar rota.');
    }
  };

  useEffect(() => {
    setEditNextOilKM(vehicle.nextOilChangeKM ? String(vehicle.nextOilChangeKM) : '');
  }, [vehicle]);

  const handleSaveSchedule = async () => {
    try {
      setIsSavingSchedule(true);
      const vehicleRef = doc(db, 'vehicles', vehicle.id);
      
      const parsedKM = editNextOilKM === '' ? null : Number(editNextOilKM);

      await updateDoc(vehicleRef, {
        nextOilChangeKM: parsedKM
      });

      // Remover ordens de serviço pendentes ao atualizar o cronograma
      const pendingOS = maintenanceHistory.filter(m => m.vehicleId === vehicle.id && m.status === 'pending');
      for (const os of pendingOS) {
        await dbCacheService.removeDocumentFromCollection('maintenance_logs', os.id);
        await deleteDoc(doc(db, 'maintenance_logs', os.id));
      }

      try {
        const auth = getAuth();
        const user = auth.currentUser;
        await auditService.log(
          user?.uid || 'system',
          user?.email || 'system',
          'UPDATE',
          'VEHICLE',
          vehicle.id,
          `Atualizou cronograma de manutenção do veículo ${vehicle.plate}. Próximo Óleo: ${parsedKM ? parsedKM + ' KM' : 'N/D'}`
        );
      } catch (auditErr) {
        console.error('Erro ao registrar auditoria de cronograma:', auditErr);
      }

      toast.success('Cronograma e vencimentos salvos com sucesso!');
      setIsEditingSchedule(false);
    } catch (err) {
      console.error('Erro ao salvar cronograma do veículo:', err);
      toast.error('Erro ao salvar cronograma do veículo.');
    } finally {
      setIsSavingSchedule(false);
    }
  };

  useEffect(() => {
    const unsubscribe = dbCacheService.subscribeCollection('checklists', (data: Checklist[]) => {
      const filtered = data.filter(c => c.vehicleId === vehicle.id);
      // Sort by date desc just in case cache ordering is different or items added
      filtered.sort((a, b) => {
        const dateA = a.date || '';
        const dateB = b.date || '';
        return dateB.localeCompare(dateA);
      });
      setChecklists(filtered);
    });

    return () => unsubscribe();
  }, [vehicle.id]);

  const processDelete = async () => {
    const { id, type } = deleteConfirm;
    try {
      if (type === 'vehicle') {
        onDelete?.();
      } else if (type === 'fuel') {
        await deleteDoc(doc(db, 'fuel_logs', id));
        toast.success('Abastecimento removido.');
      } else if (type === 'maintenance') {
        await dbCacheService.removeDocumentFromCollection('maintenance_logs', id);
        if (onDeleteMaintenance) {
          onDeleteMaintenance(id);
        } else {
          await deleteDoc(doc(db, 'maintenance_logs', id));
        }
        toast.success('Manutenção removida.');
      } else if (type === 'checklist') {
        await deleteDoc(doc(db, 'checklists', id));
        toast.success('Checklist removido.');
      }
    } catch (error) {
      toast.error('Erro ao excluir item.');
    } finally {
      setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
    }
  };

  const processMarkAsSold = async () => {
    setIsMarkingAsSold(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      await updateDoc(doc(db, 'vehicles', vehicle.id), {
        status: 'sold',
        updatedAt: new Date().toISOString()
      });
      await auditService.log(
        user?.uid || 'system',
        user?.email || 'system',
        'UPDATE',
        'VEHICLE',
        vehicle.id,
        `Veículo ${vehicle.plate} marcado como vendido`
      );
      toast.success(`Veículo ${vehicle.plate} marcado como vendido!`);
      setSoldConfirmOpen(false);
      onSold?.();
    } catch (error) {
      console.error("Erro ao marcar veículo como vendido:", error);
      toast.error('Erro ao marcar veículo como vendido.');
    } finally {
      setIsMarkingAsSold(false);
    }
  };

  const handleDeleteChecklist = (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: 'checklist' });
  };

  const handleChecklistSubmit = async (data: any) => {
    setIsSubmiting(true);
    try {
      await addDoc(collection(db, 'checklists'), {
        ...data,
        vehicleId: vehicle.id
      });
      toast.success('Checklist realizado com sucesso!');
      setIsChecklistModalOpen(false);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar checklist.');
    } finally {
      setIsSubmiting(false);
    }
  };

  const handleUpdatePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Imagem muito grande. Limite 2MB.');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          await updateDoc(doc(db, 'vehicles', vehicle.id), {
            photoUrl: reader.result as string,
            updatedAt: new Date().toISOString()
          });
          toast.success('Foto do veículo updated!');
        } catch (error) {
          toast.error('Erro ao salvar foto.');
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: `Veículo DM Turismo: ${vehicle.plate}`,
      text: `Veículo: ${vehicle.plate}\nModelo: ${vehicle.model}\nKM: ${vehicle.currentOdometer.toLocaleString()}\nStatus: ${vehicle.status === 'available' ? 'Operacional' : 'Em Manutenção'}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if (err instanceof Error && err.name !== 'AbortError') {
          console.error('Erro ao compartilhar:', err);
          toast.error('Erro ao compartilhar veículo.');
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.text}\nLink: ${shareData.url}`);
        toast.success('Detalhes copiados para a área de transferência!');
      } catch (err) {
        toast.error('Erro ao copiar dados do veículo.');
      }
    }
  };

  const vehicleMaintenance = maintenanceHistory
    .filter(m => m.vehicleId === vehicle.id)
    .sort((a, b) => {
      // Pending always first
      if (a.status === 'pending' && b.status !== 'pending') return -1;
      if (a.status !== 'pending' && b.status === 'pending') return 1;

      // If both are pending, sort ascending by scheduledDate (closest upcoming first)
      if (a.status === 'pending' && b.status === 'pending') {
        return new Date(a.scheduledDate).getTime() - new Date(b.scheduledDate).getTime();
      }

      // If both are completed, sort descending by completedAt or scheduledDate (most recent first)
      const dateA = a.completedAt || a.scheduledDate;
      const dateB = b.completedAt || b.scheduledDate;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });

  const vehicleFuel = fuelHistory
    .filter(f => f.vehicleId === vehicle.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const odometerData = useMemo(() => {
    const chronologicalFuel = [...vehicleFuel].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const list = chronologicalFuel.map((f, index) => {
      const prev = index > 0 ? chronologicalFuel[index - 1] : null;
      const kmTraveled = (prev && f.odometer > prev.odometer) ? f.odometer - prev.odometer : null;
      const dateStr = f.timestamp ? format(parseISO(f.timestamp), 'dd/MM/yy', { locale: ptBR }) : '---';
      return {
        ...f,
        date: dateStr,
        kmTraveled,
        prevOdometer: prev?.odometer || 0,
      };
    });

    const validRuns = list.filter(item => item.kmTraveled !== null && item.kmTraveled > 0);
    const avgKmBetween = validRuns.length > 0 
      ? Math.round(validRuns.reduce((sum, item) => sum + (item.kmTraveled || 0), 0) / validRuns.length) 
      : 0;

    const maxKmBetween = validRuns.length > 0
      ? Math.max(...validRuns.map(item => item.kmTraveled || 0))
      : 0;

    return {
      history: list,
      validRuns,
      average: avgKmBetween,
      max: maxKmBetween,
      totalKmFromRefuel: validRuns.reduce((sum, item) => sum + (item.kmTraveled || 0), 0),
    };
  }, [vehicleFuel]);

  const handleDownloadTechnicalMaintenanceReport = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      
      // Fetch financial transactions to look for fines linked to this vehicle
      let vehicleFines: any[] = [];
      try {
        const allFinance = await dbCacheService.getCollectionFromCache('financial_transactions');
        
        if (allFinance && allFinance.length > 0) {
          vehicleFines = allFinance.filter(tx => {
            const isFine = tx.category?.toLowerCase().includes('multa') || 
                           tx.description?.toLowerCase().includes('multa');
                           
            const isLinkedToVehicle = tx.refId === vehicle.id || 
                                      tx.description?.toLowerCase().includes(vehicle.plate.toLowerCase().replace(/\s/g, '')) ||
                                      tx.description?.toLowerCase().includes(vehicle.plate.toLowerCase());
                                      
            return isFine && isLinkedToVehicle;
          });
        }
      } catch (err) {
        console.warn('Erro ao carregar multas do cache:', err);
      }

      // Find recurrent scaled drivers from trips
      const driverIds = new Set<string>();
      trips.forEach(t => {
        if (t.vehicleId === vehicle.id && t.status !== 'cancelled') {
          if (t.driverId) driverIds.add(t.driverId);
          if (t.secondDriverId) driverIds.add(t.secondDriverId);
        }
      });
      const vehicleDrivers = employees.filter(emp => driverIds.has(emp.id));

      // DM Turismo Branding Header - Eco-Mode (Low Ink)
      // Removed solid dark background, using clean lines and logo
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(14, 34, 196, 34); // Top separator line

      // Logo DM (Stylized Text Branding for Low Ink)
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0); // Black for high contrast / low ink
      doc.text('DM', 14, 20);
      
      doc.setFontSize(16);
      doc.text('TURISMO', 28, 20);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139); // Gray
      doc.text('"Prazer em viajar bem"', 14, 26);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(113, 113, 122); // Zinc-500
      doc.text('SISTEMA INTEGRADO DE ENGENHARIA E CONFORMIDADE DE FROTA', 14, 30);
      
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('DOSSIÊ COMPLETO', 196, 18, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(113, 113, 122);
      doc.setFont('helvetica', 'normal');
      doc.text(`ATIVO: ${vehicle.plate.toUpperCase()}`, 196, 24, { align: 'right' });
      doc.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 196, 28, { align: 'right' });
      
      // Reset text color to default
      doc.setTextColor(0, 0, 0);
      
      // 1. Dados do Veículo
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('1. DADOS CADASTRAIS DO VEÍCULO', 14, 48);
      
      const vehicleDetails = [
        ['Modelo / Veículo:', vehicle.model.toUpperCase(), 'Placa:', vehicle.plate.toUpperCase()],
        ['Tipo de Ativo:', vehicle.type === 'bus' ? 'ÔNIBUS' : vehicle.type === 'microbus' ? 'MICRO-ÔNIBUS' : 'VAN', 'Capacidade:', `${vehicle.capacity || '--'} PASSAGEIROS`],
        ['Odômetro Atual:', `${vehicle.currentOdometer?.toLocaleString('pt-BR') || '0'} KM`, 'Ano Fabricação:', vehicle.factoryYear || 'NÃO CONFIGURADO'],
        ['Status Operacional:', vehicle.status === 'available' ? 'DISPONÍVEL' : vehicle.status === 'maintenance' ? 'EM MANUTENÇÃO' : vehicle.status === 'trip' ? 'EM VIAGEM' : 'VENDIDO', 'Garantia:', getWarrantyStatus(vehicle).status]
      ];
      
      autoTable(doc, {
        startY: 52,
        body: vehicleDetails,
        theme: 'plain',
        bodyStyles: { fontSize: 8.5, textColor: [0, 0, 0], fontStyle: 'normal' },
        columnStyles: {
          0: { fontStyle: 'bold', cellWidth: 35, textColor: [71, 85, 105] },
          1: { cellWidth: 65 },
          2: { fontStyle: 'bold', cellWidth: 30, textColor: [71, 85, 105] },
          3: { cellWidth: 50 }
        },
        margin: { left: 14, right: 14 }
      });
      
      let nextY = (doc as any).lastAutoTable.finalY + 8;
      
      // 2. Documentação Obrigatória
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('2. CONTROLE DE DOCUMENTAÇÃO OBRIGATÓRIA (LICENCIAMENTO / REGULADORES)', 14, nextY);
      
      const today = new Date();
      
      const getDocStatus = (expDateStr: string | undefined | null) => {
        if (!expDateStr) return { dateStr: 'NÃO CADASTRE', status: 'N/A', color: [113, 113, 122] as [number, number, number] };
        try {
          const expDate = parseISO(expDateStr);
          const diff = differenceInDays(expDate, today);
          const formattedDate = format(expDate, 'dd/MM/yyyy');
          if (diff < 0) {
            return { dateStr: formattedDate, status: `VENCIDO (${Math.abs(diff)} dias)`, color: [239, 68, 68] as [number, number, number] }; // Red
          } else if (diff <= 30) {
            return { dateStr: formattedDate, status: `ALERTA (${diff} dias)`, color: [245, 158, 11] as [number, number, number] }; // Amber/Orange
          } else {
            return { dateStr: formattedDate, status: `VÁLIDO (${diff} dias)`, color: [16, 185, 129] as [number, number, number] }; // Green
          }
        } catch {
          return { dateStr: 'INVÁLIDA', status: 'ERRO', color: [239, 68, 68] as [number, number, number] };
        }
      };

      const docRows = [
        ['Licenciamento Anual (CRLV)', getDocStatus(vehicle.licenseExpiration)],
        ['Autorização de Turismo (CADASTUR)', getDocStatus(vehicle.tourismLicenseExpiration)],
        ['Registro Cadastur Geral', getDocStatus(vehicle.cadasturExpiration)],
        ['Registro Geral ANTT', getDocStatus(vehicle.anttExpiration)],
        ['Registro DETRO / ARTESP', getDocStatus(vehicle.detroArtespExpiration)],
        ['Alvará de Circulação Municipal', getDocStatus(vehicle.municipalLicenseExpiration)],
        ['Aferição de Cronotacógrafo', getDocStatus(vehicle.tacografoExpiration)],
        ['Seguro Obrigatório / RC', getDocStatus(vehicle.insuranceExpiration)]
      ];

      autoTable(doc, {
        startY: nextY + 3,
        head: [['Documento Obrigatório', 'Data Vencimento', 'Status / Dias Restantes', 'Classificação']],
        body: docRows.map(row => {
          const statusObj = row[1] as any;
          return [row[0], statusObj.dateStr, statusObj.status, statusObj.status.startsWith('VÁLIDO') ? 'CONFORME' : statusObj.status.startsWith('VENCIDO') ? 'IRREGULAR' : 'ATENÇÃO'];
        }),
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center' },
        columnStyles: {
          0: { halign: 'left', fontStyle: 'bold', cellWidth: 70 },
          1: { cellWidth: 35 },
          2: { cellWidth: 50 },
          3: { cellWidth: 27, fontStyle: 'bold' }
        },
        didParseCell: (data) => {
          if (data.row.index >= 0 && data.column.index === 2) {
            const statusObj = docRows[data.row.index][1] as any;
            data.cell.styles.textColor = statusObj.color;
            data.cell.styles.fontStyle = 'bold';
          }
          if (data.row.index >= 0 && data.column.index === 3) {
            const val = data.cell.text[0];
            if (val === 'CONFORME') data.cell.styles.textColor = [16, 185, 129];
            if (val === 'IRREGULAR') data.cell.styles.textColor = [239, 68, 68];
            if (val === 'ATENÇÃO') data.cell.styles.textColor = [245, 158, 11];
          }
        },
        margin: { left: 14, right: 14 }
      });
      
      nextY = (doc as any).lastAutoTable.finalY + 8;

      // 3. Condutores Escalados (CNH)
      if (nextY > 230) {
        doc.addPage();
        nextY = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. CONDUTORES ESCALADOS & EXIGÊNCIAS LEGAIS (CNH)', 14, nextY);
      
      if (vehicleDrivers.length > 0) {
        const driverRows = vehicleDrivers.map(drv => {
          const cnhStatus = getDocStatus(drv.licenseExpiration);
          return [
            drv.name.toUpperCase(),
            drv.cpf || '---',
            drv.licenseNumber || '---',
            drv.licenseCategory || '---',
            cnhStatus.dateStr,
            cnhStatus.status
          ];
        });
        
        autoTable(doc, {
          startY: nextY + 3,
          head: [['Nome do Motorista', 'CPF', 'Nº Registro CNH', 'Cat.', 'Venc. CNH', 'Status CNH']],
          body: driverRows,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { halign: 'left', fontStyle: 'bold', cellWidth: 55 },
            1: { cellWidth: 25 },
            2: { cellWidth: 30 },
            3: { cellWidth: 12 },
            4: { cellWidth: 25 },
            5: { cellWidth: 35, fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.row.index >= 0 && data.column.index === 5) {
              const statusText = driverRows[data.row.index][5];
              if (statusText.startsWith('VENCIDO')) {
                data.cell.styles.textColor = [239, 68, 68];
              } else if (statusText.startsWith('ALERTA')) {
                data.cell.styles.textColor = [245, 158, 11];
              } else {
                data.cell.styles.textColor = [16, 185, 129];
              }
            }
          },
          margin: { left: 14, right: 14 }
        });
        
        nextY = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(113, 113, 122);
        doc.text('Nenhum condutor associado a viagens escaladas com este veículo.', 14, nextY + 4);
        nextY += 12;
      }

      // 4. Abastecimentos
      if (nextY > 170) {
        doc.addPage();
        nextY = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('4. HISTÓRICO RECENTE DE ABASTECIMENTOS', 14, nextY);
      
      if (vehicleFuel.length > 0) {
        const last10Fuel = vehicleFuel.slice(0, 10);
        const fuelRows = last10Fuel.map((f, idx) => {
          const dateStr = f.timestamp ? format(parseISO(f.timestamp), 'dd/MM/yyyy') : '---';
          const prev = idx < vehicleFuel.length - 1 ? vehicleFuel[idx + 1] : null;
          const kmDiff = (prev && f.odometer > prev.odometer) ? f.odometer - prev.odometer : null;
          const consumption = (kmDiff && f.quantity > 0) ? `${(kmDiff / f.quantity).toFixed(2)} km/L` : '---';
          
          return [
            dateStr,
            `${f.odometer.toLocaleString('pt-BR')} KM`,
            kmDiff ? `${kmDiff.toLocaleString('pt-BR')} KM` : '---',
            `${f.quantity.toLocaleString('pt-BR')} L`,
            `R$ ${f.cost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '---'}`,
            consumption,
            f.arlaQuantity ? `${f.arlaQuantity.toLocaleString('pt-BR')} L` : 'N/A'
          ];
        });
        
        autoTable(doc, {
          startY: nextY + 3,
          head: [['Data', 'Odômetro', 'Dist. Percorrida', 'Litros', 'Valor Total', 'Média Consumo', 'Arla 32']],
          body: fuelRows,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 25 },
            1: { cellWidth: 25 },
            2: { cellWidth: 28 },
            3: { cellWidth: 22 },
            4: { cellWidth: 30, halign: 'right' },
            5: { cellWidth: 28, fontStyle: 'bold' },
            6: { cellWidth: 24 }
          },
          margin: { left: 14, right: 14 }
        });
        
        nextY = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(113, 113, 122);
        doc.text('Nenhum registro de abastecimento para este veículo.', 14, nextY + 4);
        nextY += 12;
      }

      // 5. Manutenções
      if (nextY > 170) {
        doc.addPage();
        nextY = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('5. HISTÓRICO INTEGRADO DE MANUTENÇÃO (ÚLTIMAS 15 O.S.)', 14, nextY);
      
      if (vehicleMaintenance.length > 0) {
        const last15Maint = vehicleMaintenance.slice(0, 15);
        const maintRows = last15Maint.map((m, idx) => {
          const dateStr = m.completedAt 
            ? format(parseISO(m.completedAt), 'dd/MM/yyyy') 
            : format(parseISO(m.scheduledDate), 'dd/MM/yyyy');
          
          return [
            String(idx + 1).padStart(2, '0'),
            m.description.toUpperCase(),
            m.type === 'preventive' ? 'PREVENTIVA' : 'CORRETIVA',
            m.status === 'completed' ? 'CONCLUÍDA' : 'PENDENTE',
            dateStr,
            m.odometer ? `${m.odometer.toLocaleString('pt-BR')} KM` : '---',
            `R$ ${m.cost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
          ];
        });
        
        autoTable(doc, {
          startY: nextY + 3,
          head: [['OS', 'Descrição dos Serviços', 'Tipo', 'Situação', 'Data', 'Quilometragem', 'Custo']],
          body: maintRows,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 10, fontStyle: 'bold' },
            1: { halign: 'left', cellWidth: 65 },
            2: { cellWidth: 24, fontStyle: 'bold' },
            3: { cellWidth: 22 },
            4: { cellWidth: 20 },
            5: { cellWidth: 24 },
            6: { cellWidth: 23, halign: 'right', fontStyle: 'bold' }
          },
          margin: { left: 14, right: 14 }
        });
        
        nextY = (doc as any).lastAutoTable.finalY + 8;
      } else {
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(113, 113, 122);
        doc.text('Nenhum registro de manutenção para este veículo.', 14, nextY + 4);
        nextY += 12;
      }

      // 6. Multas e Infrações
      if (nextY > 180) {
        doc.addPage();
        nextY = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('6. MULTAS E INFRAÇÕES DE TRÂNSITO REGISTRADAS', 14, nextY);
      
      if (vehicleFines.length > 0) {
        const fineRows = vehicleFines.map((f, idx) => {
          const dateStr = f.dueDate ? format(parseISO(f.dueDate), 'dd/MM/yyyy') : '---';
          return [
            String(idx + 1).padStart(2, '0'),
            f.description.toUpperCase(),
            f.supplier ? f.supplier.toUpperCase() : 'ÓRGÃO TRÂNSITO / DER / PRF',
            dateStr,
            f.status === 'paid' ? 'PAGO' : f.status === 'overdue' ? 'VENCIDO' : 'ABERTO',
            `R$ ${f.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}`
          ];
        });
        
        autoTable(doc, {
          startY: nextY + 3,
          head: [['Item', 'Descrição / Local / Enquadramento', 'Órgão Autuador', 'Vencimento', 'Situação', 'Valor']],
          body: fineRows,
          theme: 'grid',
          headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, halign: 'center' },
          bodyStyles: { fontSize: 7.5, halign: 'center' },
          columnStyles: {
            0: { cellWidth: 10, fontStyle: 'bold' },
            1: { halign: 'left', cellWidth: 65 },
            2: { halign: 'left', cellWidth: 35 },
            3: { cellWidth: 23 },
            4: { cellWidth: 23, fontStyle: 'bold' },
            5: { cellWidth: 26, halign: 'right', fontStyle: 'bold' }
          },
          didParseCell: (data) => {
            if (data.row.index >= 0 && data.column.index === 4) {
              const statusText = fineRows[data.row.index][4];
              if (statusText === 'PAGO') {
                data.cell.styles.textColor = [16, 185, 129];
              } else {
                data.cell.styles.textColor = [239, 68, 68];
              }
            }
          },
          margin: { left: 14, right: 14 }
        });
        
        nextY = (doc as any).lastAutoTable.finalY + 12;
      } else {
        doc.setFillColor(248, 250, 252);
        doc.rect(14, nextY + 3, 182, 14, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(14, nextY + 3, 182, 14, 'S');
        
        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(16, 185, 129); // Green success
        doc.text('SITUAÇÃO REGULAR: Nenhuma multa de trânsito ativa ou pendente de pagamento nos cadastros.', 20, nextY + 11);
        nextY += 25;
      }
      
      // Signatures
      if (nextY > 230) {
        doc.addPage();
        nextY = 40;
      } else {
        nextY = Math.max(nextY, 230);
      }
      
      doc.line(14, nextY, 90, nextY);
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(113, 113, 122);
      doc.text('RESPONSÁVEL OPERACIONAL / GESTÃO DE FROTA', 14, nextY + 4);
      doc.text('DM TURISMO - GESTÃO OPERACIONAL', 14, nextY + 8);
      
      doc.line(120, nextY, 196, nextY);
      doc.text('CONTROLE DE QUALIDADE & CONFORMIDADE LEGAL', 120, nextY + 4);
      doc.text('RELAÇÃO DE AUDITORIA MECÂNICA E LEGAL INTEGRADA', 120, nextY + 8);
      
      doc.save(`Dossie_Completo_Veiculo_${vehicle.plate.replace(/\s/g, '_')}.pdf`);
      toast.success('Dossiê Completo do Veículo exportado com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Erro ao gerar dossiê técnico completo em PDF.');
    }
  };

  const handleGenerateVehiclePDF = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      // DM Turismo Branding Header
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(14, 34, 196, 34);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text('DM', 14, 20);
      
      doc.setFontSize(16);
      doc.text('TURISMO', 28, 20);
      
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(80, 80, 80);
      doc.text('"Prazer em viajar bem"', 14, 26);
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text('GESTÃO DE FROTA E CONTROLE TÉCNICO', 14, 30);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.setFont('helvetica', 'bold');
      doc.text('FICHA TÉCNICA DO ATIVO', 196, 18, { align: 'right' });
      
      doc.setFontSize(8);
      doc.setTextColor(100, 100, 100);
      doc.setFont('helvetica', 'normal');
      doc.text(`ATIVO: ${vehicle.plate.toUpperCase()}`, 196, 24, { align: 'right' });
      doc.text(`DATA: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 196, 28, { align: 'right' });

      let startY = 42;

      // 1. Dados Principais
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('1. DADOS TÉCNICOS E CADASTRAIS', 14, startY);
      
      autoTable(doc, {
        startY: startY + 3,
        head: [['Especificação', 'Informação do Sistema']],
        body: [
          ['Placa do Veículo', vehicle.plate],
          ['Prefixo', vehicle.prefix || 'Não informado'],
          ['Marca / Modelo', vehicle.model || 'Não informado'],
          ['Tipo', vehicle.type === 'bus' ? 'ÔNIBUS' : vehicle.type === 'microbus' ? 'MICRO-ÔNIBUS' : vehicle.type === 'van' ? 'VAN' : String(vehicle.type).toUpperCase()],
          ['Ano Fabricação', vehicle.factoryYear || 'Não informado'],
          ['KM Atual (Odômetro)', `${vehicle.currentOdometer.toLocaleString('pt-BR')} KM`],
          ['RENAVAM', vehicle.renavam || 'Não informado'],
          ['Número do Chassi', vehicle.chassi || 'Não informado'],
          ['Capacidade de Passageiros', `${vehicle.capacity || 'S/D'} PAX`],
          ['Status Operacional', vehicle.status === 'available' ? 'LIBERADO' : vehicle.status === 'maintenance' ? 'EM MANUTENÇÃO' : 'INATIVO'],
        ],
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } },
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // 2. Vencimentos e Documentação
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('2. VENCIMENTOS E DOCUMENTAÇÃO LEGAL', 14, startY);

      const docRows = [
        ['Licenciamento (CRLV)', vehicle.licenseExpiration ? format(parseISO(vehicle.licenseExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
        ['Seguro Obrigatório (SPVAT)', vehicle.spvatExpiration ? format(parseISO(vehicle.spvatExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
        ['Seguro APP / Responsabilidade Civil', vehicle.insuranceExpiration ? format(parseISO(vehicle.insuranceExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
        ['Cronotacógrafo (Aferição)', vehicle.tacografoExpiration ? format(parseISO(vehicle.tacografoExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
        ['CADASTUR / Órgão Federal', vehicle.cadasturExpiration ? format(parseISO(vehicle.cadasturExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
        ['ANTT / DER / ARTESP', vehicle.anttExpiration ? format(parseISO(vehicle.anttExpiration), 'dd/MM/yyyy') : 'Não cadastrado'],
      ];

      autoTable(doc, {
        startY: startY + 3,
        head: [['Documento / Licença', 'Data de Vencimento']],
        body: docRows,
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 10;

      // 3. Manutenção Preventiva
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(15, 23, 42);
      doc.text('3. PRÓXIMAS MANUTENÇÕES PROGRAMADAS', 14, startY);

      autoTable(doc, {
        startY: startY + 3,
        head: [['Serviço Programado', 'Previsão (KM / Data)']],
        body: [
          ['Troca de Óleo do Motor', vehicle.nextOilChangeKM ? `${vehicle.nextOilChangeKM.toLocaleString('pt-BR')} KM` : 'Não definida'],
          ['Manutenção Preventiva Geral', vehicle.nextMaintenanceKM ? `${vehicle.nextMaintenanceKM.toLocaleString('pt-BR')} KM` : 'Não definida por KM'],
        ],
        theme: 'grid',
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: 'bold' },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } },
        margin: { left: 14, right: 14 }
      });

      doc.save(`Ficha_Tecnica_Veiculo_${vehicle.plate.replace(/\s/g, '_')}.pdf`);
      toast.success('Ficha Técnica gerada com sucesso em PDF!');

    } catch (err) {
      console.error('Erro ao gerar Ficha Técnica:', err);
      toast.error('Erro ao gerar Ficha Técnica em PDF.');
    }
  };

  const handleDownloadVerificationChecklist = async () => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

      const drawHeader = (docInstance: any) => {
        // DM Turismo Branding Header - Eco-Mode (Low Ink)
        docInstance.setDrawColor(0, 0, 0);
        docInstance.setLineWidth(0.5);
        docInstance.line(14, 34, 196, 34); // Line instead of rect fill
        
        // Logo DM (Stylized Text Branding for Low Ink)
        docInstance.setFont('helvetica', 'bold');
        docInstance.setFontSize(24);
        docInstance.setTextColor(0, 0, 0);
        docInstance.text('DM', 14, 20);
        
        docInstance.setFontSize(16);
        docInstance.text('TURISMO', 28, 20);
        
        docInstance.setFontSize(7);
        docInstance.setFont('helvetica', 'italic');
        docInstance.setTextColor(80, 80, 80);
        docInstance.text('"Prazer em viajar bem"', 14, 26);
        
        docInstance.setFontSize(8);
        docInstance.setTextColor(100, 100, 100);
        docInstance.setFont('helvetica', 'normal');
        docInstance.text('GESTÃO DE FROTA E CONTROLE TÉCNICO DE CAMPO', 14, 30);
        
        docInstance.setFontSize(10);
        docInstance.setTextColor(0, 0, 0);
        docInstance.setFont('helvetica', 'bold');
        docInstance.text('FICHA DE VERIFICAÇÃO', 196, 18, { align: 'right' });
        
        docInstance.setFontSize(8);
        docInstance.setTextColor(100, 100, 100);
        docInstance.setFont('helvetica', 'normal');
        docInstance.text(`ATIVO: ${vehicle.plate.toUpperCase()}`, 196, 24, { align: 'right' });
        docInstance.text(`GERADO EM: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 196, 28, { align: 'right' });
        
        // Gray thin separator under header
        docInstance.setFillColor(150, 150, 150);
        docInstance.rect(14, 34, 182, 0.5, 'F');
      };

      // Initial Header
      drawHeader(doc);

      let startY = 42;

      // 1. Dados de Cadastro
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('1. DADOS DE CADASTRO E LEITURA DE CAMPO (PREENCHIMENTO MANUAL)', 14, startY);
      
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['ESPECIFICAÇÃO NO SISTEMA', 'DADO ATUAL', 'CAMPO PARA ATUALIZAÇÃO / LEITURA DE CAMPO']],
        body: [
          ['Veículo / Modelo', vehicle.model || 'S/D', 'Modelo Atualizado: _________________________________'],
          ['Placa / Prefixo', `${vehicle.plate} ${vehicle.prefix ? '(' + vehicle.prefix + ')' : ''}`, 'Ano / Chassi: ______________________________________'],
          ['Tipo de Veículo', vehicle.type === 'bus' ? 'ÔNIBUS' : vehicle.type === 'microbus' ? 'MICRO-ÔNIBUS' : vehicle.type === 'van' ? 'VAN' : String(vehicle.type).toUpperCase(), 'Capacidade Real: [     ] PAX'],
          ['Odômetro no Sistema', `${vehicle.currentOdometer.toLocaleString('pt-BR')} KM`, 'ODÔMETRO LIDO NO PAINEL: ____________________ KM'],
          ['Data da Inspeção', format(new Date(), 'dd/MM/yyyy'), 'DATA REAL DA INSPEÇÃO: _____ / _____ / _________'],
          ['Responsável / Inspecionador', 'A Preencher', 'NOME COMPLETO: __________________________________'],
          ['Nível de Combustível', 'Medição Visual', '[  ] Cheio   [  ] 3/4   [  ] 1/2   [  ] 1/4   [  ] Reserva'],
          ['Nível Arla 32 (se houver)', 'Medição Visual', 'NÍVEL ARLA 32: _______ %   [  ] Completar'],
          ['Próxima Troca de Óleo', vehicle.nextOilChangeKM ? `${vehicle.nextOilChangeKM.toLocaleString('pt-BR')} KM` : 'Não definida', 'INDICADA NA ETIQUETA: ______________________ KM'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      // 2. Checklist de Documentação
      if (startY > 240) {
        doc.addPage();
        drawHeader(doc);
        startY = 42;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('2. CHECKLIST DE REGULAMENTAÇÃO, DOCUMENTOS E ACESSÓRIOS', 14, startY);
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['DOCUMENTO / REGULAMENTAÇÃO', 'STATUS SISTEMA', 'AVALIAÇÃO DE CAMPO / NOVO VENCIMENTO']],
        body: [
          ['CRLV / Licenciamento', vehicle.licenseExpiration ? format(parseISO(vehicle.licenseExpiration), 'dd/MM/yyyy') : 'Não informado', '[  ] OK   [  ] Vencido   (Novo Vencimento: ____/____/____)'],
          ['Cronotacógrafo (Aferição)', vehicle.tacografoExpiration ? format(parseISO(vehicle.tacografoExpiration), 'dd/MM/yyyy') : 'Não informado', '[  ] OK   [  ] Vencido   (Discos Reservas: [  ] Sim [  ] Não)'],
          ['CADASTUR / Órgão Regulador', vehicle.cadasturExpiration ? format(parseISO(vehicle.cadasturExpiration), 'dd/MM/yyyy') : 'Não informado', '[  ] OK   [  ] Vencido   [  ] N/A'],
          ['ANTT / DER / ARTESP', vehicle.anttExpiration ? format(parseISO(vehicle.anttExpiration), 'dd/MM/yyyy') : 'Não informado', '[  ] OK   [  ] Vencido   [  ] N/A'],
          ['Extintor de Incêndio', 'Validade Carga', '[  ] Válido   [  ] Vencido / Sem Carga'],
          ['Cartão Abastecimento / Tag Pedágio', 'Acessórios Cabine', '[  ] Presentes na Cabine   [  ] Faltando'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      if (startY > 230) {
        doc.addPage();
        drawHeader(doc);
        startY = 42;
      }

      // 3. Inspeção Técnica
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('3. INSPEÇÃO TÉCNICA E SEGURANÇA OPERACIONAL (VERIFICAÇÃO FÍSICA)', 14, startY);
      startY += 4;

      autoTable(doc, {
        startY: startY,
        head: [['SISTEMA / COMPONENTE', 'SITUAÇÃO ESPERADA', 'CONDIÇÃO CONSTATADA EM CAMPO']],
        body: [
          ['Pneus Dianteiros (Calibragem/Sulco)', 'Bons / Alinhados', '[  ] Conforme   [  ] Calibrar   [  ] Trocar / Alinhar'],
          ['Pneus Traseiros / Tração', 'Bons / Calibrados', '[  ] Conforme   [  ] Calibrar   [  ] Recapar / Trocar'],
          ['Estepe / Kit de Emergência', 'Completo e Calibrado', '[  ] Presente   [  ] Murcho/Danificado   [  ] Ausente'],
          ['Nível Óleo Motor & Arrefecimento', 'Entre Mín e Máx', '[  ] Normal   [  ] Completar Óleo   [  ] Completar Água'],
          ['Iluminação (Faróis, Setas, Freio)', '100% Funcionais', '[  ] 100% OK   [  ] Lâmpada Queimada'],
          ['Sistema de Freios (Pressão/Ar)', 'Sem Vazamentos', '[  ] Normal   [  ] Pressão Baixa / Ruído ao Frear'],
          ['Ar Condicionado e Ventilação', 'Gelando / Limpo', '[  ] Funcionando   [  ] Defeito Gelamento / Sujo'],
          ['Cintos de Segurança e Assentos', 'Íntegros e Fixos', '[  ] Todos OK   [  ] Cinto Trava / Banco Solto'],
        ],
        styles: { fontSize: 8, cellPadding: 2.5, textColor: [0, 0, 0] },
        headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
        theme: 'grid',
        margin: { left: 14, right: 14 }
      });

      startY = (doc as any).lastAutoTable.finalY + 8;

      if (startY > 240) {
        doc.addPage();
        drawHeader(doc);
        startY = 42;
      }

      // 4. Observações e Avarias
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('4. REGISTRO DE AVARIAS, OBSERVAÇÕES E SERVIÇOS PENDENTES', 14, startY);
      startY += 4;

      doc.setDrawColor(0, 0, 0);
      doc.setFillColor(255, 255, 255);
      doc.rect(14, startY, 182, 22, 'S');
      
      doc.setDrawColor(200, 200, 200);
      doc.line(16, startY + 7, 192, startY + 7);
      doc.line(16, startY + 14, 192, startY + 14);

      startY += 28;

      if (startY > 260) {
        doc.addPage();
        drawHeader(doc);
        startY = 42;
      }

      // 5. Assinaturas
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('DECLARAÇÃO DE VISTORIA:', 14, startY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.text('Atesto que as informações acima correspondem à condição real do veículo no momento da inspeção.', 14, startY + 4);

      startY += 16;

      doc.setDrawColor(0, 0, 0);
      doc.line(20, startY, 95, startY);
      doc.line(115, startY, 190, startY);

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('ASSINATURA DO INSPECIONADOR / MOTORISTA', 57, startY + 4, { align: 'center' });
      doc.text('ASSINATURA DO GESTOR DE FROTA', 152, startY + 4, { align: 'center' });

      doc.save(`Ficha_Verificacao_${vehicle.plate.replace(/\s/g, '_')}.pdf`);
      toast.success('Ficha de Verificação gerada com sucesso em PDF!');

    } catch (err) {
      console.error('Erro ao gerar Ficha de Verificação:', err);
      toast.error('Erro ao gerar Ficha de Verificação em PDF.');
    }
  };

  // Alerts logic
  const alerts = useMemo(() => {
    const list = [];
    const today = new Date();
    const KM_THRESHOLD = 500;
    const DAYS_THRESHOLD = 30;

    // Docs
    const docItems = [
      { id: 'license', label: 'Licenciamento (CRLV)', date: vehicle.licenseExpiration },
      { id: 'insurance', label: 'Seguro APP', date: vehicle.insuranceExpiration },
      { id: 'tacografo', label: 'Cronotacógrafo', date: vehicle.tacografoExpiration },
      { id: 'municipal', label: 'Licença Municipal', date: vehicle.municipalLicenseExpiration },
      { id: 'cadastur', label: 'CADASTUR', date: vehicle.cadasturExpiration },
      { id: 'antt', label: 'ANTT', date: vehicle.anttExpiration },
      { id: 'detroArtesp', label: 'Estado (DETRO/ARTESP)', date: vehicle.detroArtespExpiration },
    ];

    docItems.forEach(doc => {
      if (!doc.date) return;
      const expDate = parseISO(doc.date);
      const daysLeft = differenceInDays(expDate, today);
      
      if (daysLeft <= 0) {
        list.push({ type: 'critical', message: `${doc.label} VENCIDO`, sub: `Venceu em ${format(expDate, 'dd/MM/yyyy')}` });
      } else if (daysLeft <= DAYS_THRESHOLD) {
        list.push({ type: 'warning', message: `${doc.label} PRÓXIMO DO VENCIMENTO`, sub: `Vence em ${daysLeft} dias (${format(expDate, 'dd/MM/yyyy')})` });
      }
    });

    // Maintenance by KM
    if (vehicle.nextOilChangeKM) {
      const kmRemaining = vehicle.nextOilChangeKM - vehicle.currentOdometer;
      if (kmRemaining <= 0) {
        list.push({ type: 'critical', message: 'TROCA DE ÓLEO VENCIDA', sub: `Atraso de ${Math.abs(kmRemaining)} KM` });
      } else if (kmRemaining <= KM_THRESHOLD) {
        list.push({ type: 'warning', message: 'TROCA DE ÓLEO PRÓXIMA', sub: `Faltam ${kmRemaining} KM` });
      }
    }

    return list;
  }, [vehicle]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Filtro Principal de Funções (Trazer Para Cima) */}
      <div className="flex flex-col gap-2 bg-gradient-to-r from-zinc-900 via-zinc-950 to-zinc-900 border border-zinc-800 p-4 rounded-3xl [content-visibility:auto]">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-1.5 h-1.5 rounded-full bg-brand-accent shadow-[0_0_8px_rgba(255,107,0,0.5)] animate-pulse" />
          <span className="text-[10px] font-black tracking-[0.2em] uppercase text-zinc-400">Atalhos de Operações do Ativo</span>
        </div>
        <div className="flex flex-wrap items-center p-1 bg-zinc-950/80 border border-zinc-850 rounded-2xl w-full gap-1 select-none">
          <button 
            type="button"
            onClick={() => setActiveOverlayTab('overview')}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all hover:bg-zinc-900/50 hover:text-white text-zinc-400 shrink-0 cursor-pointer border border-transparent hover:border-zinc-800"
          >
            <LayoutDashboard size={14} className="text-brand-accent" />
            <span>Visão Geral</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveOverlayTab('checklists')}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all hover:bg-zinc-900/50 hover:text-white text-zinc-400 cursor-pointer border border-transparent hover:border-zinc-800"
          >
            <ClipboardCheck size={14} className="text-emerald-500" />
            <span>Checklist</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveOverlayTab('maintenance')}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all hover:bg-zinc-900/50 hover:text-white text-zinc-400 cursor-pointer border border-transparent hover:border-zinc-800"
          >
            <Wrench size={14} className="text-amber-500" />
            <span>Manutenção</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveOverlayTab('charts')}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all hover:bg-zinc-900/50 hover:text-white text-zinc-400 cursor-pointer border border-transparent hover:border-zinc-800"
          >
            <BarChart3 size={14} className="text-blue-500" />
            <span>Desempenho</span>
          </button>
          <button 
            type="button"
            onClick={() => setActiveOverlayTab('photos')}
            className="flex-1 min-w-[130px] flex items-center justify-center gap-3 px-5 py-4 rounded-xl text-[10.5px] font-black uppercase tracking-widest transition-all hover:bg-zinc-900/50 hover:text-white text-zinc-400 cursor-pointer border border-transparent hover:border-zinc-800"
          >
            <Camera size={14} className="text-purple-500" />
            <span>Fotos</span>
          </button>
        </div>
      </div>

      {/* Alerts Section */}
      {alerts.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-[0.2em] flex items-center gap-2">
            <AlertCircle size={14} />
            Alertas de Segurança e Vencimentos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((alert, i) => (
              <div key={i} className={cn(
                "p-4 rounded-2xl border flex items-center gap-4 transition-all hover:scale-[1.01]",
                alert.type === 'critical' 
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-500" 
                  : "bg-amber-500/10 border-amber-500/30 text-amber-500"
              )}>
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  alert.type === 'critical' ? "bg-rose-500 text-white" : "bg-amber-500 text-zinc-950"
                )}>
                  <AlertCircle size={20} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-tight">{alert.message}</p>
                  <p className="text-[10px] font-bold opacity-70 uppercase mt-0.5">{alert.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6 items-start justify-between">
        <div className="flex items-center gap-6">
          <label className={cn(
            "w-20 h-20 bg-zinc-800 rounded-3xl flex items-center justify-center border shadow-2xl relative overflow-hidden group cursor-pointer transition-all",
            vehicle.featured 
              ? "border-yellow-500/80 shadow-[0_0_20px_rgba(234,179,8,0.4)] animate-[pulse_2s_infinite]" 
              : "border-zinc-700 hover:border-zinc-500"
          )}>
            {vehicle.photoUrl ? (
              <img src={vehicle.photoUrl} alt={vehicle.plate} className="w-full h-full object-cover group-hover:scale-110 transition-transform" />
            ) : (
              <Bus className={cn("group-hover:scale-110 transition-transform", vehicle.featured ? "text-yellow-500" : "text-brand-accent")} size={36} />
            )}
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Camera size={20} className="text-white" />
            </div>
            <input type="file" className="hidden" accept="image/*" onChange={handleUpdatePhoto} />
          </label>
          <div>
            <h2 className="text-4xl font-black text-white uppercase tracking-tighter tabular-nums flex flex-wrap items-center gap-3">
              {vehicle.plate}
              {vehicle.prefix && (
                <span className="px-3 py-1 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-sm font-black uppercase rounded-xl tracking-wider">
                  Frota #{vehicle.prefix}
                </span>
              )}
              {vehicle.featured && (
                <span className="px-3 py-1 bg-yellow-500 text-zinc-950 text-[9px] font-black uppercase rounded-lg tracking-wider animate-pulse shadow-[0_0_12px_rgba(234,179,8,0.5)]">
                  Prioridade de Inspeção
                </span>
              )}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className={cn(
                "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border flex items-center gap-2 transition-all duration-700 ease-in-out shadow-sm",
                vehicle.status === 'available' 
                  ? "bg-emerald-950/20 text-emerald-450 border-emerald-500/20 shadow-emerald-950/20" 
                  : vehicle.status === 'maintenance'
                  ? "bg-amber-950/20 text-amber-500 border-amber-500/20 shadow-amber-950/20"
                  : "bg-rose-950/20 text-rose-450 border-rose-500/20 shadow-rose-950/20"
              )}>
                <span className="relative flex h-2 w-2">
                  <span className={cn(
                    "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 transition-colors duration-700 ease-in-out",
                    vehicle.status === 'available' 
                      ? "bg-emerald-400" 
                      : vehicle.status === 'maintenance'
                      ? "bg-amber-500"
                      : "bg-rose-400"
                  )}></span>
                  <span className={cn(
                    "relative inline-flex rounded-full h-2 w-2 transition-colors duration-700 ease-in-out",
                    vehicle.status === 'available' 
                      ? "bg-emerald-500" 
                      : vehicle.status === 'maintenance'
                      ? "bg-amber-500"
                      : "bg-rose-500"
                  )}></span>
                </span>
                {vehicle.status === 'available' 
                  ? 'Liberado' 
                  : vehicle.status === 'maintenance' 
                  ? 'Em Manutenção' 
                  : 'Inativo'}
              </span>
              <span className="text-xs font-black text-zinc-500 uppercase tracking-widest">{vehicle.model}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button 
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-zinc-700 hover:border-zinc-500 cursor-pointer"
          >
            <Share2 size={14} />
            Compartilhar
          </button>
          <button 
            type="button"
            onClick={onEdit}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-zinc-700 hover:border-zinc-500 cursor-pointer"
            id="btn-edit-asset"
          >
            <Edit3 size={14} />
            Editar Ativo
          </button>
          <button 
            type="button"
            onClick={handleDownloadTechnicalMaintenanceReport}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600 text-blue-450 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-blue-500/20 shadow-xl cursor-pointer"
            id="btn-dossier-download"
            title="Baixar dossiê técnico de oficina completo em PDF"
          >
            <FileText size={14} />
            Dossiê Completo
          </button>
          <button 
            type="button"
            onClick={handleDownloadVerificationChecklist}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-emerald-500/20 shadow-xl cursor-pointer"
            id="btn-verification-checklist"
            title="Imprimir / Baixar Ficha de Verificação e Checklist Manual em PDF"
          >
            <ClipboardCheck size={14} />
            Ficha de Verificação
          </button>
          <button 
            type="button"
            onClick={handleGenerateVehiclePDF}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-zinc-700 hover:border-zinc-500 cursor-pointer shadow-lg"
            id="btn-generate-vehicle-pdf"
            title="Gerar PDF da Ficha Técnica do Ativo"
          >
            <Printer size={14} className="text-zinc-400" />
            Gerar PDF da Ficha
          </button>
          <button 
            type="button"
            onClick={() => setSoldConfirmOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-amber-500/30 shadow-xl cursor-pointer"
            id="btn-mark-sold"
          >
            <DollarSign size={14} />
            Vendido
          </button>
          {onDelete && (
            <button 
              type="button"
              onClick={() => onDelete?.()}
              className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-rose-500/30 shadow-xl cursor-pointer"
              id="btn-delete-asset"
            >
              <Trash2 size={14} />
              Excluir Ativo
            </button>
          )}
        </div>
      </div>

      {/* DETALHES DO ATIVO - Informações Técnicas e Cadastrais */}
      <div className="p-6 bg-zinc-950 border border-zinc-800 rounded-3xl space-y-4">
        <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
          <Bus size={18} className="text-brand-accent" />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Detalhes do Ativo</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="p-3 bg-zinc-900 border border-brand-accent/20 rounded-2xl">
            <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest">Número de Frota</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.prefix ? `Frota #${vehicle.prefix}` : 'Não Informado'}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Tipo do Veículo</p>
            <p className="text-xs font-black text-white uppercase mt-1">
              {vehicle.type === 'bus' ? 'Ônibus' : vehicle.type === 'microbus' ? 'Micro-ônibus' : vehicle.type === 'van' ? 'Van' : vehicle.type === 'car' ? 'Carro' : vehicle.type === 'motorcycle' ? 'Moto' : String(vehicle.type).toUpperCase()}
            </p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">KM Atual</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.currentOdometer.toLocaleString()} KM</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Placa</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.plate}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Modelo / Marca</p>
            <p className="text-xs font-black text-white mt-1 truncate">{vehicle.model}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Ano de Fabricação</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.factoryYear}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">RENAVAM</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.renavam || 'Não Informado'}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Chassi</p>
            <p className="text-xs font-black text-white tabular-nums mt-1 truncate">{vehicle.chassi || 'Não Informado'}</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Nº de Passageiros</p>
            <p className="text-xs font-black text-white tabular-nums mt-1">{vehicle.capacity} PAX</p>
          </div>
          <div className="p-3 bg-zinc-900 border border-zinc-800/80 rounded-2xl col-span-2 sm:col-span-1 lg:col-span-2">
            <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Motorista Responsável</p>
            <p className="text-xs font-black text-white uppercase mt-1 truncate">
              {vehicle.responsibleDriverName || (employees.find(e => e.id === vehicle.responsibleDriverId)?.name) || 'Não Atribuído'}
            </p>
          </div>
        </div>
      </div>

      {/* VENCIMENTOS: DOCUMENTOS, DETRAN E MANUTENÇÃO */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DOCUMENTOS & VENCIMENTOS LEGAIS (UNIFICADO) */}
        <div className="p-6 bg-emerald-950/20 border border-emerald-900/40 rounded-3xl space-y-4">
          <div className="flex items-center justify-between border-b border-emerald-900/40 pb-3">
            <div className="flex items-center gap-3">
              <Globe size={18} className="text-emerald-500" />
              <h3 className="text-xs font-black text-white uppercase tracking-widest">Documentos & Vencimentos Legais</h3>
            </div>
            <button
               onClick={() => setActiveOverlayTab('documents')}
               className="px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-400 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-all border border-emerald-500/20 cursor-pointer"
            >
               Gerenciar
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-2.5">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Documentação DETRAN / CRLV</p>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Licenciamento (CRLV)</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.licenseExpiration ? format(parseISO(vehicle.licenseExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Seguro (SPVAT / DPVAT)</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.spvatExpiration ? format(parseISO(vehicle.spvatExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Alvará Municipal</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.municipalLicenseExpiration ? format(parseISO(vehicle.municipalLicenseExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Tacógrafo</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.tacografoExpiration ? format(parseISO(vehicle.tacografoExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <p className="text-[8px] font-black text-zinc-500 uppercase tracking-widest ml-1">Órgãos Reguladores & APP</p>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">CADASTUR</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.cadasturExpiration ? format(parseISO(vehicle.cadasturExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">ANTT</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.anttExpiration ? format(parseISO(vehicle.anttExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Licença MERCOSUL</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.mercosulLicenseExpiration ? format(parseISO(vehicle.mercosulLicenseExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">SIE (Estadual)</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {(vehicle.sieExpiration || vehicle.detroArtespExpiration) ? format(parseISO(vehicle.sieExpiration || vehicle.detroArtespExpiration!), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-zinc-950/80 p-2.5 rounded-xl border border-emerald-900/10">
                <span className="text-[9px] font-black text-zinc-400 uppercase">Seguro Pessoas (APP)</span>
                <span className="text-xs font-black text-white tabular-nums">
                  {vehicle.insuranceExpiration ? format(parseISO(vehicle.insuranceExpiration), 'dd/MM/yyyy') : '---'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* VENCIMENTO DE MANUTENÇÃO */}
        <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
            <Wrench size={18} className="text-amber-500" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Vencimento de Manutenção</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/60">
              <span className="text-[9px] font-black text-zinc-400 uppercase">Próxima Troca de Óleo e Filtros</span>
              <span className="text-xs font-black text-white tabular-nums">
                {vehicle.nextOilChangeKM ? `${vehicle.nextOilChangeKM.toLocaleString()} KM` : '---'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/60">
              <span className="text-[9px] font-black text-zinc-400 uppercase">Rodízio de Pneus</span>
              <span className="text-xs font-black text-white tabular-nums">
                {vehicle.nextTireRotationKM ? `${vehicle.nextTireRotationKM.toLocaleString()} KM` : '---'}
              </span>
            </div>
            <div className="flex justify-between items-center bg-zinc-950 p-3 rounded-xl border border-zinc-800/60">
              <span className="text-[9px] font-black text-zinc-400 uppercase">Próxima Revisão Preventiva (KM)</span>
              <span className="text-xs font-black text-white tabular-nums">
                {vehicle.nextMaintenanceKM ? `${vehicle.nextMaintenanceKM.toLocaleString()} KM` : '---'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* HISTÓRICO DE MANUTENÇÃO */}
      <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Histórico de Manutenção</h3>
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">Registros de intervenções preventivas e corretivas</p>
          </div>
          <div className="flex items-center gap-3">
            {onAddMaintenance && (
              <button 
                type="button"
                onClick={() => onAddMaintenance()}
                className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-amber-500/20 cursor-pointer"
              >
                <Wrench size={14} />
                Nova Manutenção
              </button>
            )}
            <Wrench className="text-amber-500/30" size={32} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data / Status</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Serviço / Descrição</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Tipo</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">KM</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Custo (R$)</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {vehicleMaintenance.length > 0 ? vehicleMaintenance.map(m => (
                <tr key={m.id} className="group hover:bg-zinc-800/30 transition-colors">
                  <td className="py-4">
                    <span className="text-[10px] font-black text-zinc-400 tabular-nums block">
                      {m.completedAt ? format(parseISO(m.completedAt), 'dd/MM/yyyy') : format(parseISO(m.scheduledDate), 'dd/MM/yyyy')}
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-widest",
                      m.status === 'completed' ? "text-emerald-400" : "text-amber-400"
                    )}>
                      {m.status === 'completed' ? 'Concluída' : 'Pendente'}
                    </span>
                  </td>
                  <td className="py-4">
                    <span className="text-[11px] font-black text-white uppercase block">{m.description}</span>
                    {(m as any).notes && <span className="text-[9px] text-zinc-500 block truncate max-w-xs">{(m as any).notes}</span>}
                  </td>
                  <td className="py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border inline-block",
                      m.type === 'preventive' 
                        ? "bg-emerald-950/30 text-emerald-400 border-emerald-800/40" 
                        : "bg-rose-950/30 text-rose-400 border-rose-800/40"
                    )}>
                      {m.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                    </span>
                  </td>
                  <td className="py-4 text-[10px] font-black text-zinc-300 tabular-nums text-right">
                    {m.odometer ? `${m.odometer.toLocaleString()} KM` : '---'}
                  </td>
                  <td className="py-4 text-[10px] font-black text-white tabular-nums text-right">
                    R$ {(m.cost || 0).toLocaleString()}
                  </td>
                  <td className="py-4 text-right">
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, id: m.id, type: 'maintenance' })}
                      className="p-2 text-zinc-600 hover:text-rose-500 transition-colors cursor-pointer"
                      title="Excluir Ordem de Manutenção"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                    Nenhuma manutenção registrada para este veículo
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* HISTÓRICO DE ABASTECIMENTO */}
      <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Histórico de Abastecimento</h3>
            <p className="text-[10px] text-zinc-400 font-black uppercase tracking-widest mt-1">Detalhamento de consumo e custos por viagem</p>
          </div>
          <div className="flex items-center gap-3">
            {onAddFuel && (
              <button 
                type="button"
                onClick={() => onAddFuel(vehicle.id)}
                className="flex items-center gap-2 px-4 py-2 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-brand-accent/20 cursor-pointer"
              >
                <Fuel size={14} />
                Novo Abastecimento
              </button>
            )}
            <Fuel className="text-brand-accent/30" size={32} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Data / Hora</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest">Motorista</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Qtd. (L)</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Custo (R$)</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Odômetro (KM)</th>
                <th className="pb-4 text-[10px] font-black text-zinc-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50">
              {vehicleFuel.length > 0 ? vehicleFuel.map(f => (
                <tr key={f.id} className="group hover:bg-zinc-800/30 transition-colors">
                  <td className="py-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black text-zinc-400 tabular-nums">
                        {format(parseISO(f.timestamp), 'dd/MM/yyyy HH:mm')}
                      </span>
                      {f.isExternal && (
                        <span className="text-[8px] font-black text-rose-400 uppercase tracking-tighter mt-0.5">
                          Externo: {f.location}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-4 text-[10px] font-black text-white uppercase">
                    {employees.find(e => e.id === f.driverId)?.name || '---'}
                  </td>
                  <td className="py-4 text-[10px] font-black text-brand-accent tabular-nums text-right">
                    {f.quantity.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                  </td>
                  <td className="py-4 text-[10px] font-black text-white tabular-nums text-right">
                    R$ {f.cost.toLocaleString()}
                  </td>
                  <td className="py-4 text-[10px] font-black text-zinc-300 tabular-nums text-right">
                    {f.odometer.toLocaleString()} KM
                  </td>
                  <td className="py-4 pl-4 text-right">
                    <button 
                      onClick={() => setDeleteConfirm({ isOpen: true, id: f.id, type: 'fuel' })}
                      className="p-2 text-zinc-700 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                      title="Excluir Abastecimento"
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                    Nenhum abastecimento registrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Overlay Modals for Active Functions */}
      <AnimatePresence>
        {activeOverlayTab && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-sm" id="overlay-portal-container">
            {/* Backdrop Click Closes Modal */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setActiveOverlayTab(null)}
              className="absolute inset-0 cursor-pointer"
            />

            {/* Modal Body */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-4xl max-h-[85vh] bg-zinc-950 border border-zinc-800/80 rounded-3xl flex flex-col overflow-hidden shadow-2xl z-10"
              id="overlay-modal-body"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-850 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  {activeOverlayTab === 'overview' && <LayoutDashboard className="text-brand-accent text-orange-500" size={18} />}
                  {activeOverlayTab === 'checklists' && <ClipboardCheck className="text-emerald-500" size={18} />}
                  {activeOverlayTab === 'maintenance' && <Wrench className="text-amber-500" size={18} />}
                  {activeOverlayTab === 'charts' && <BarChart3 className="text-blue-500" size={18} />}
                  {activeOverlayTab === 'documents' && <FileText className="text-[#ff6b00]" size={18} />}
                  {activeOverlayTab === 'photos' && <Camera className="text-purple-500" size={18} />}
                  
                  <div>
                    <h3 className="text-base font-black text-white uppercase tracking-wider">
                      {activeOverlayTab === 'overview' && 'Visão Geral do Ativo'}
                      {activeOverlayTab === 'checklists' && 'Checklist & Vistorias'}
                      {activeOverlayTab === 'maintenance' && 'Histórico de Manutenções'}
                      {activeOverlayTab === 'charts' && 'Desempenho & Estatísticas'}
                      {activeOverlayTab === 'documents' && 'Documentação do Ativo'}
                      {activeOverlayTab === 'photos' && 'Galeria de Fotos'}
                    </h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                      {vehicle.prefix ? `[FROTA #${vehicle.prefix}] ${vehicle.plate}` : vehicle.plate} • {activeOverlayTab === 'overview' && 'Acompanhamento proativo de prazos e métricas'}
                      {activeOverlayTab === 'checklists' && 'Consulta e realização de listas de conformidade'}
                      {activeOverlayTab === 'maintenance' && 'Consulta e controle de ordens de serviço e intervenções'}
                      {activeOverlayTab === 'charts' && 'Consumo e eficiência operacional do diesel'}
                      {activeOverlayTab === 'documents' && 'Gestão de arquivos, CRLV, ANTT e seguros vinculados'}
                      {activeOverlayTab === 'photos' && 'Arquivo visual de vistorias, documentos e ocorrências'}
                    </p>
                  </div>
                </div>

                {/* Header Switcher + Close Button */}
                <div className="flex items-center gap-3">
                  {/* Embedded Small Selector */}
                  <div className="hidden sm:flex items-center p-1 bg-zinc-900 border border-zinc-800 rounded-xl gap-1">
                    <button 
                      onClick={() => setActiveOverlayTab('overview')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'overview' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Visão
                    </button>
                    <button 
                      onClick={() => setActiveOverlayTab('checklists')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'checklists' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Checklist
                    </button>
                    <button 
                      onClick={() => setActiveOverlayTab('maintenance')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'maintenance' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Manutenção
                    </button>
                    <button 
                      onClick={() => setActiveOverlayTab('charts')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'charts' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Desempenho
                    </button>
                    <button 
                      onClick={() => setActiveOverlayTab('documents')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'documents' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Documentos
                    </button>
                    <button 
                      onClick={() => setActiveOverlayTab('photos')}
                      className={cn(
                        "px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer",
                        activeOverlayTab === 'photos' ? "bg-zinc-800 text-brand-accent" : "text-zinc-500 hover:text-zinc-300"
                      )}
                    >
                      Fotos
                    </button>
                  </div>

                  <button 
                    onClick={() => setActiveOverlayTab(null)}
                    className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 cursor-pointer"
                    title="Fechar Painel"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Modal Content Scroll Area */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6">
                {activeOverlayTab === 'documents' && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <FinanceDocumentVencimentos 
                      vehicles={vehicles || [vehicle]} 
                      fixedVehicleId={vehicle.id}
                      hideHeader={true}
                    />
                  </div>
                )}

                {activeOverlayTab === 'photos' && (
                  <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                    <PhotoGallery 
                      collectionName="vehicles" 
                      documentId={vehicle.id} 
                      vehiclePlate={vehicle.plate}
                    />
                  </div>
                )}
                
                {activeOverlayTab === 'overview' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-top-4 duration-500">
                     {/* Resumo de Manutenção Proativa */}
                     <div className="space-y-6">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                            <Wrench size={14} className="text-brand-accent" />
                            Próximas Intervenções
                          </h3>
                          <button 
                            onClick={() => {
                              setIsEditingSchedule(!isEditingSchedule);
                              setEditNextOilKM(vehicle.nextOilChangeKM ? String(vehicle.nextOilChangeKM) : '');
                            }}
                            className="text-[9px] font-black uppercase text-brand-accent hover:text-brand-accent/80 tracking-widest transition-all cursor-pointer bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded-xl flex items-center gap-1"
                          >
                            <Edit3 size={11} />
                            {isEditingSchedule ? 'Cancelar' : 'Editar Cronograma'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                           <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-2xl relative overflow-hidden group">
                              <div className="flex justify-between items-start relative z-10">
                                 <div className="w-full">
                                    <p className="text-[10px] font-black text-zinc-550 uppercase tracking-widest mb-1.5">Troca de Óleo</p>
                                    {isEditingSchedule ? (
                                      <div className="mt-2 flex gap-2 items-center">
                                        <input 
                                          type="number" 
                                          value={editNextOilKM} 
                                          onChange={(e) => setEditNextOilKM(e.target.value)}
                                          placeholder="Ex: 60000" 
                                          className="bg-zinc-950 text-white font-mono text-sm px-3 py-2 rounded-xl border border-zinc-800 focus:outline-none focus:border-brand-accent w-full"
                                        />
                                        <span className="text-[10px] font-black text-zinc-550 uppercase">KM</span>
                                      </div>
                                    ) : (
                                      <p className="text-2xl font-black text-white tabular-nums">
                                        {vehicle.nextOilChangeKM ? `${vehicle.nextOilChangeKM.toLocaleString()} KM` : '---'}
                                      </p>
                                    )}
                                 </div>
                                 {!isEditingSchedule && vehicle.nextOilChangeKM && (
                                   <div className="text-right">
                                      <p className={cn(
                                        "text-sm font-black italic",
                                        (vehicle.nextOilChangeKM - vehicle.currentOdometer) <= 1000 ? "text-rose-500" : "text-emerald-500"
                                      )}>
                                        {vehicle.nextOilChangeKM - vehicle.currentOdometer <= 0 
                                          ? `ATRASADO: ${Math.abs(vehicle.nextOilChangeKM - vehicle.currentOdometer).toLocaleString()} KM`
                                          : `FALTAM: ${(vehicle.nextOilChangeKM - vehicle.currentOdometer).toLocaleString()} KM`}
                                      </p>
                                   </div>
                                 )}
                              </div>
                              {!isEditingSchedule && (
                                <div className="mt-4 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                   <div 
                                     className={cn("h-full transition-all duration-1000", (vehicle.nextOilChangeKM && vehicle.nextOilChangeKM - vehicle.currentOdometer <= 1000) ? "bg-rose-500" : "bg-emerald-500")}
                                     style={{ width: vehicle.nextOilChangeKM ? `${Math.max(5, Math.min(100, (1 - (vehicle.nextOilChangeKM - vehicle.currentOdometer) / 10000) * 100))}%` : '0%' }}
                                   />
                                </div>
                              )}
                           </div>

                           <div className="p-6 bg-zinc-900 border border-zinc-850 rounded-2xl relative overflow-hidden group">
                              <div className="flex justify-between items-start relative z-10">
                                 <div className="w-full">
                                    <p className="text-[10px] font-black text-zinc-550 uppercase tracking-widest mb-1.5">Preventiva por Limite de KM</p>
                                    <p className="text-2xl font-black text-white">
                                      {vehicle.nextMaintenanceKM ? `${vehicle.nextMaintenanceKM.toLocaleString('pt-BR')} KM` : '---'}
                                    </p>
                                 </div>
                                 {vehicle.nextMaintenanceKM && vehicle.currentOdometer && (
                                   <div className="text-right">
                                      <p className={cn(
                                        "text-sm font-black italic",
                                        (vehicle.nextMaintenanceKM - vehicle.currentOdometer) <= 1000 ? "text-rose-500" : "text-emerald-500"
                                      )}>
                                        {(vehicle.nextMaintenanceKM - vehicle.currentOdometer) < 0 
                                          ? 'KM ULTRAPASSADO'
                                          : `FALTAM ${(vehicle.nextMaintenanceKM - vehicle.currentOdometer).toLocaleString('pt-BR')} KM`}
                                      </p>
                                   </div>
                                 )}
                              </div>
                           </div>

                           {isEditingSchedule && (
                             <motion.div 
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               className="pt-2"
                             >
                               <button
                                 onClick={handleSaveSchedule}
                                 disabled={isSavingSchedule}
                                 className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-zinc-800 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-brand-accent/30 shadow-lg cursor-pointer"
                               >
                                 {isSavingSchedule ? 'Salvando...' : 'Salvar Cronograma'}
                               </button>
                             </motion.div>
                           )}
                        </div>
                     </div>

                         {/* Rotas de Manutenção Preventiva (KM) */}
                         <div className="bg-zinc-900 border border-zinc-850 p-6 rounded-3xl space-y-6">
                            <div className="flex items-center justify-between">
                               <div className="flex items-center gap-3">
                                  <div className="p-2 bg-brand-accent/10 rounded-xl text-brand-accent">
                                     <Wrench size={16} />
                                  </div>
                                  <div>
                                     <h3 className="text-xs font-black text-white uppercase tracking-widest">Rotas Preventivas por KM</h3>
                                     <p className="text-[9px] text-zinc-500 uppercase font-bold tracking-tight">Alertas automáticos ao atingir 80% do limite</p>
                                  </div>
                               </div>
                               <button
                                 type="button"
                                 onClick={() => setIsAddingRoute(!isAddingRoute)}
                                 className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-brand-accent rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer"
                               >
                                  {isAddingRoute ? <X size={11} /> : <Plus size={11} />}
                                  {isAddingRoute ? 'Cancelar' : 'Nova Rota'}
                               </button>
                            </div>

                            {/* Form to add new KM Route */}
                            {isAddingRoute && (
                               <div className="p-5 bg-zinc-950 border border-zinc-800 rounded-2xl space-y-4 animate-in fade-in slide-in-from-top-4 duration-300">
                                  <p className="text-[9px] font-black uppercase text-zinc-550 tracking-widest">Nova Configuração de Rota</p>
                                  
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                     <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Tipo/Modelo da Rota</label>
                                        <select
                                          value={newRouteTemplate}
                                          onChange={(e) => {
                                            setNewRouteTemplate(e.target.value);
                                            if (e.target.value === 'Troca de Óleo e Filtro') setNewRouteInterval('10000');
                                            else if (e.target.value === 'Alinhamento e Balanceamento') setNewRouteInterval('10000');
                                            else if (e.target.value === 'Revisão do Sistema de Freios') setNewRouteInterval('20000');
                                            else if (e.target.value === 'Revisão Geral da Suspensão') setNewRouteInterval('40000');
                                            else if (e.target.value === 'Substituição Filtros Combustível/Ar') setNewRouteInterval('15000');
                                            else if (e.target.value === 'Troca de Correias e Tensores') setNewRouteInterval('50000');
                                            else {
                                              setNewRouteInterval('');
                                              setNewRouteName('');
                                            }
                                          }}
                                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-brand-accent"
                                        >
                                           <option value="custom">⚙️ Rota Personalizada...</option>
                                           <option value="Troca de Óleo e Filtro">🛢️ Troca de Óleo e Filtro (10k KM)</option>
                                           <option value="Alinhamento e Balanceamento">⚖️ Alinhamento e Balanceamento (10k KM)</option>
                                           <option value="Revisão do Sistema de Freios">🛑 Revisão de Freios (20k KM)</option>
                                           <option value="Substituição Filtros Combustível/Ar">💨 Filtros Combustível/Ar (15k KM)</option>
                                           <option value="Revisão Geral da Suspensão">⚙️ Revisão da Suspensão (40k KM)</option>
                                           <option value="Troca de Correias e Tensores">⛓️ Correias e Tensores (50k KM)</option>
                                        </select>
                                     </div>

                                     {newRouteTemplate === 'custom' && (
                                        <div className="space-y-1.5">
                                           <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Nome da Rota</label>
                                           <input
                                             type="text"
                                             value={newRouteName}
                                             onChange={(e) => setNewRouteName(e.target.value)}
                                             placeholder="Ex: Troca da Caixa de Marcha"
                                             className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-medium text-white focus:outline-none focus:border-brand-accent"
                                           />
                                        </div>
                                     )}

                                     <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Intervalo (KM)</label>
                                        <input
                                          type="number"
                                          value={newRouteInterval}
                                          onChange={(e) => setNewRouteInterval(e.target.value)}
                                          placeholder="Ex: 15000"
                                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-accent"
                                        />
                                     </div>

                                     <div className="space-y-1.5">
                                        <label className="text-[9px] font-black uppercase text-zinc-500 tracking-wider">Última Realizada (KM)</label>
                                        <input
                                          type="number"
                                          value={newRouteLastKM}
                                          onChange={(e) => setNewRouteLastKM(e.target.value)}
                                          placeholder="Ex: 55000"
                                          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-accent"
                                        />
                                     </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={handleAddRoute}
                                    disabled={isSavingRoute}
                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-zinc-800 text-zinc-950 font-black uppercase text-[10px] tracking-widest rounded-xl transition-all shadow-md cursor-pointer mt-2"
                                  >
                                     {isSavingRoute ? 'Configurando...' : 'Salvar e Ativar Rota'}
                                  </button>
                               </div>
                            )}

                            {/* Active Routes List */}
                            <div className="space-y-4">
                               {!vehicle.preventiveKMConfig || vehicle.preventiveKMConfig.length === 0 ? (
                                  <div className="p-8 text-center bg-zinc-950/40 border border-dashed border-zinc-850 rounded-2xl">
                                     <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">Nenhuma rota de manutenção KM configurada neste veículo.</p>
                                     <p className="text-[9px] text-zinc-700 uppercase mt-1">Crie uma nova rota acima para começar a monitorar em tempo real.</p>
                                  </div>
                               ) : (
                                  vehicle.preventiveKMConfig.map((route) => {
                                     const distanceRun = (vehicle.currentOdometer || 0) - (route.lastKM || 0);
                                     const pct = Math.min(100, Math.round(route.kmInterval > 0 ? (distanceRun / route.kmInterval) * 100 : 0));
                                     const kmRemaining = (route.nextDueKM || 0) - (vehicle.currentOdometer || 0);
                                     
                                     const isCritical = pct >= 100;
                                     const isAlert80 = pct >= 80 && pct < 100;

                                     return (
                                        <div key={route.id} className="p-5 bg-zinc-950 border border-zinc-850 hover:border-zinc-800 rounded-2xl relative overflow-hidden group/route transition-all">
                                           <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                                              <div>
                                                 <div className="flex items-center gap-2">
                                                    <p className="text-xs font-black text-white uppercase tracking-tight">{route.routeName}</p>
                                                    {isCritical ? (
                                                       <span className="text-[8px] font-black text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded-full border border-rose-500/20 uppercase animate-pulse">Crítico (100%+)</span>
                                                    ) : isAlert80 ? (
                                                       <span className="text-[8px] font-black text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full border border-brand-accent/20 uppercase animate-pulse">Alerta (80%+)</span>
                                                    ) : (
                                                       <span className="text-[8px] font-black text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/10 uppercase">Monitorando</span>
                                                    )}
                                                 </div>
                                                 <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest mt-1">
                                                    Intervalo: a cada {route.kmInterval.toLocaleString()} KM • Última: {route.lastKM.toLocaleString()} KM • Limite: {route.nextDueKM.toLocaleString()} KM
                                                 </p>
                                              </div>

                                              <div className="flex items-center gap-3 self-end sm:self-center">
                                                 <button
                                                   type="button"
                                                   onClick={() => handleResetRoute(route.id)}
                                                   className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-emerald-500 hover:text-emerald-400 rounded-xl text-[9px] font-black uppercase tracking-widest transition-colors flex items-center gap-1 border border-zinc-850 hover:border-zinc-800 cursor-pointer"
                                                   title="Marcar como realizada e zerar progresso"
                                                 >
                                                    <CheckCircle2 size={11} />
                                                    Zerar Rota
                                                 </button>
                                                 <button
                                                   type="button"
                                                   onClick={() => {
                                                     if(confirm(`Excluir a rota "${route.routeName}"?`)) {
                                                       handleDeleteRoute(route.id);
                                                     }
                                                   }}
                                                   className="p-1.5 bg-zinc-900 hover:bg-rose-500/10 text-zinc-650 hover:text-rose-500 rounded-lg transition-colors cursor-pointer border border-zinc-850 hover:border-rose-500/10"
                                                   title="Remover Rota"
                                                 >
                                                    <Trash2 size={12} />
                                                 </button>
                                              </div>
                                           </div>

                                           {/* Progress Bar */}
                                           <div className="mt-4">
                                              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tight text-zinc-500 mb-1.5">
                                                 <span>{distanceRun.toLocaleString()} KM rodados</span>
                                                 <span className={cn(
                                                   isCritical ? "text-rose-500" : isAlert80 ? "text-brand-accent" : "text-emerald-500"
                                                 )}>{pct}% atingido</span>
                                              </div>
                                              <div className="h-2 bg-zinc-900 border border-zinc-850 rounded-full overflow-hidden">
                                                 <div 
                                                   className={cn(
                                                     "h-full rounded-full transition-all duration-1000",
                                                     isCritical ? "bg-rose-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]" : isAlert80 ? "bg-brand-accent shadow-[0_0_10px_rgba(251,191,36,0.5)]" : "bg-emerald-500"
                                                   )}
                                                   style={{ width: `${pct}%` }}
                                                 />
                                              </div>
                                              {kmRemaining > 0 ? (
                                                 <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1.5">Faltam {kmRemaining.toLocaleString()} KM para a próxima revisão</p>
                                              ) : (
                                                 <p className="text-[9px] font-bold text-rose-500 uppercase mt-1.5">Atrasada por {Math.abs(kmRemaining).toLocaleString()} KM! Realizar revisão imediatamente!</p>
                                              )}
                                           </div>
                                        </div>
                                     );
                                  })
                               )}
                            </div>
                         </div>

                     {/* Viagens Recentes/Ativas */}
                     <div className="space-y-4 pt-4">
                       <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-3">
                         <TrendingUp size={14} className="text-emerald-500" />
                         Atividade Recente
                       </h3>
                       <div className="space-y-2">
                          {trips.filter(t => t.vehicleId === vehicle.id).slice(0, 3).map(trip => (
                            <div key={trip.id} className="p-4 bg-zinc-800/40 rounded-xl border border-zinc-800 flex justify-between items-center group hover:bg-zinc-800 transition-all">
                               <div className="flex items-center gap-4">
                                  <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center",
                                    trip.status === 'active' ? "bg-emerald-500/20 text-emerald-500" : "bg-zinc-800 text-zinc-400"
                                  )}>
                                     <MapPin size={18} />
                                  </div>
                                  <div>
                                     <p className="text-xs font-black text-white uppercase">{trip.title}</p>
                                     <p className="text-[10px] text-zinc-550 font-bold uppercase mt-0.5">{trip.origin} - {trip.destination}</p>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <span className={cn(
                                    "px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-wider border",
                                    trip.status === 'active' 
                                      ? "bg-emerald-950/40 text-emerald-500 border-emerald-900/40" 
                                      : "bg-zinc-950 text-zinc-500 border-zinc-900"
                                  )}>
                                    {trip.status === 'active' ? 'Em Rota' : 'Programada'}
                                  </span>
                               </div>
                            </div>
                          ))}
                          {trips.filter(t => t.vehicleId === vehicle.id).length === 0 && (
                            <div className="p-12 text-center text-[10px] font-black text-zinc-650 uppercase tracking-widest bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-900">
                               Nenhuma viagem recente
                            </div>
                          )}
                       </div>
                     </div>
                  </div>
                )}

                {activeOverlayTab === 'maintenance' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Histórico Técnico de Revisões</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Garantia, ordens de serviço abertas e prontuário histórico</p>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={handleDownloadTechnicalMaintenanceReport}
                          className="flex items-center gap-2 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-750 text-zinc-300 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-zinc-700/60 hover:border-zinc-500 cursor-pointer"
                        >
                          <Printer size={14} />
                          Ficha Técnica PDF
                        </button>
                        {(onAddMaintenance || onSaveMaintenance) && (
                          <button 
                            onClick={() => {
                              if (onSaveMaintenance) {
                                setInnerMaintenanceForm({
                                  isOpen: true,
                                  initialData: { vehicleId: vehicle.id, odometer: vehicle.currentOdometer }
                                });
                              } else {
                                onAddMaintenance?.();
                              }
                            }}
                            className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-brand-accent/30 shadow-lg shadow-brand-accent/10 cursor-pointer"
                          >
                            <Wrench size={14} />
                            Registrar Manutenção
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      {vehicleMaintenance.length > 0 ? vehicleMaintenance.map(log => {
                        const warranty = getWarrantyStatus(vehicle);
                        
                        return (
                          <div key={log.id} className="p-6 bg-zinc-900 hover:bg-zinc-900/80 border border-zinc-800 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-all group relative overflow-hidden">
                            <div className="flex items-start gap-4 shrink-0">
                              <div className={cn(
                                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                                log.type === 'preventive' 
                                  ? "bg-emerald-950/30 text-emerald-500 border-emerald-900/40" 
                                  : "bg-rose-955 text-rose-500 border-rose-900/40"
                              )}>
                                <Wrench size={20} />
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="text-xs font-black text-white uppercase tracking-tight">{log.description}</h4>
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border",
                                    log.type === 'preventive' 
                                      ? "bg-emerald-950/30 text-emerald-500 border-emerald-900/20" 
                                      : "bg-rose-950/30 text-rose-500 border-rose-900/20"
                                  )}>
                                    {log.type === 'preventive' ? 'Preventiva' : 'Corretiva'}
                                  </span>
                                  {log.status === 'pending' && (
                                    <span className="px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-wider border bg-amber-950/30 text-amber-500 border-amber-900/20">
                                      Pendente Os
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-y-1 gap-x-4 mt-1">
                                  <p className="text-[10px] text-zinc-505 font-bold uppercase tracking-wider flex items-center gap-1.5">
                                    <Calendar size={12} />
                                    {log.completedAt 
                                      ? `Concluído em: ${format(parseISO(log.completedAt), 'dd/MM/yyyy')}`
                                      : `Agendado: ${format(parseISO(log.scheduledDate), 'dd/MM/yyyy')}`}
                                  </p>
                                  {log.odometer && (
                                    <p className="text-[10px] text-zinc-505 font-bold uppercase tracking-wider flex items-center gap-1.5 border-l border-zinc-800 pr-0 pl-4 tabular-nums">
                                      <Navigation size={12} />
                                      {log.odometer.toLocaleString()} KM
                                    </p>
                                  )}
                                  <p className="text-[10px] text-zinc-505 font-bold uppercase tracking-wider flex items-center gap-1.5 border-l border-zinc-800 pr-0 pl-4">
                                    <Users size={12} />
                                    Mecânico: {((log as any).mechanicId && employees.find(e => e.id === (log as any).mechanicId)?.name) || 'TERCEIRIZADO / OFICINA'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 self-end sm:self-center">
                              <div className="text-right">
                                <p className="text-[9px] font-black text-zinc-550 uppercase tracking-widest">Valor do Reparo</p>
                                <p className="text-sm font-black text-emerald-400 tabular-nums">
                                  R$ {log.cost?.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) || '0,00'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 pr-1 border-l border-zinc-800 pl-3">
                                <button 
                                  onClick={() => onPrintOS?.(log)}
                                  className="p-2 text-zinc-505 hover:text-zinc-200 hover:bg-zinc-800 transition-all rounded-lg border border-transparent hover:border-zinc-700 cursor-pointer"
                                  title="Imprimir O.S. Oficial"
                                >
                                  <Printer size={14} />
                                </button>
                                {(onEditMaintenance || onSaveMaintenance) && (
                                  <button 
                                    onClick={() => {
                                      if (onSaveMaintenance) {
                                        setInnerMaintenanceForm({
                                          isOpen: true,
                                          initialData: log
                                        });
                                      } else {
                                        onEditMaintenance?.(log);
                                      }
                                    }}
                                    className="p-2 text-zinc-505 hover:text-brand-accent hover:bg-zinc-800 transition-all rounded-lg border border-transparent hover:border-zinc-705 cursor-pointer"
                                    title="Editar Registro"
                                  >
                                    <Edit3 size={14} />
                                  </button>
                                )}
                                <button 
                                  onClick={() => setDeleteConfirm({ isOpen: true, id: log.id, type: 'maintenance' })}
                                  className="p-2 text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all rounded-lg border border-transparent hover:border-rose-500/20 cursor-pointer"
                                  title="Excluir O.S."
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }) : (
                        <div className="p-16 text-center bg-zinc-950 rounded-3xl border border-dashed border-zinc-850">
                          <p className="text-[10px] font-black text-zinc-655 uppercase tracking-widest">Nenhum histórico mecânico cadastrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeOverlayTab === 'checklists' && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-widest">Registros de Vistorias</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Inspeções de rotina, segurança e controle de pertences realizados por motoristas</p>
                      </div>
                      <button 
                        onClick={() => setIsChecklistModalOpen(true)}
                        className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all border border-brand-accent/30 shadow-lg cursor-pointer"
                      >
                        <Plus size={14} />
                        Realizar Nova Vistoria
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {checklists.length > 0 ? checklists.map(c => (
                        <div key={c.id} className="p-5 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-between gap-4 group hover:bg-zinc-900/80 transition-colors">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <ClipboardCheck className="text-brand-accent" size={15} />
                                <span className="text-[10px] font-black text-zinc-400 tabular-nums">
                                  {format(parseISO(c.date), 'dd/MM/yyyy HH:mm')}
                                </span>
                              </div>
                              <p className="text-xs font-black text-white uppercase mt-2">
                                Inspecionado por: {c.responsible || 'Motorista'}
                              </p>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              {c.items?.some(item => item.status === 'issue') ? (
                                <div className="w-6 h-6 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 border border-rose-500/30" title="Possui Pendências">
                                  <AlertCircle size={12} />
                                </div>
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 border border-emerald-500/30" title="Tudo OK">
                                  <CheckCircle2 size={12} />
                                </div>
                              )}
                              
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteConfirm({ isOpen: true, id: c.id, type: 'checklist' });
                                }}
                                className="p-2 text-zinc-650 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                                title="Excluir Checklist"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="col-span-full p-16 text-center bg-zinc-950 rounded-3xl border border-dashed border-zinc-800">
                          <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">Nenhuma vistoria realizada neste veículo</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeOverlayTab === 'charts' && (
                  <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Consumo Mensal de Diesel</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Análise de volume por período</p>
                      </div>
                    </div>
                    
                    <div className="h-64 bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={
                            // Group fuel by month
                            Object.values(vehicleFuel.reduce((acc: any, log) => {
                              if (!log.timestamp) return acc;
                              const month = format(parseISO(log.timestamp), 'MMM', { locale: ptBR });
                              if (!acc[month]) acc[month] = { name: month, volume: 0 };
                              acc[month].volume += log.quantity;
                              return acc;
                            }, {}))
                          }>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                          <XAxis dataKey="name" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                          <Tooltip 
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px' }}
                          />
                          <Bar dataKey="volume" fill="#ff6b00" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Relação Litros x Odômetro</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">Análise de volume por quilometragem</p>
                      </div>
                    </div>

                    <div className="h-64 bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                          <XAxis 
                            type="number" 
                            dataKey="odometer" 
                            name="Odômetro" 
                            unit="km" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tick={{ fill: '#71717a' }} 
                            domain={['auto', 'auto']}
                          />
                          <YAxis 
                            type="number" 
                            dataKey="quantity" 
                            name="Quantidade" 
                            unit="L" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={false} 
                            tick={{ fill: '#71717a' }} 
                          />
                          <Tooltip 
                            cursor={{ strokeDasharray: '3 3' }}
                            contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px' }}
                          />
                          <Scatter name="Abastecimentos" data={vehicleFuel.map(f => ({ ...f, quantity: f.quantity, odometer: f.odometer }))} fill="#ff6b00" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-2 gap-4 col-span-full">
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Total Abastecido</p>
                        <p className="text-xl font-black text-white tabular-nums">
                          {vehicleFuel.reduce((acc, f) => acc + f.quantity, 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} <span className="text-xs text-zinc-500">L</span>
                        </p>
                      </div>
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Média de Abastecimento</p>
                        <p className="text-xl font-black text-white tabular-nums">
                          {vehicleFuel.length > 0 
                            ? Math.round(vehicleFuel.reduce((acc, f) => acc + f.quantity, 0) / vehicleFuel.length) 
                            : 0} <span className="text-xs text-zinc-500">L</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-zinc-800/80">
                      <div>
                        <h3 className="text-xs font-black text-zinc-500 uppercase tracking-[0.2em]">Histórico de Variação de Odômetro</h3>
                        <p className="text-[10px] text-zinc-600 font-bold uppercase mt-1">KM percorrido entre abastecimentos sucessivos</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {/* Stats Column 1 */}
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Média de KM entre Abastecimentos</p>
                        <p className="text-xl font-black text-brand-accent tabular-nums flex items-baseline gap-1">
                          {odometerData.average > 0 ? (
                            <>
                              {odometerData.average.toLocaleString('pt-BR')} <span className="text-xs text-zinc-500">km</span>
                            </>
                          ) : '---'}
                        </p>
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Reflete a autonomia real atual do veículo</span>
                      </div>
                      
                      {/* Stats Column 2 */}
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Maior Intervalo Registrado</p>
                        <p className="text-xl font-black text-white tabular-nums flex items-baseline gap-1">
                          {odometerData.max > 0 ? (
                            <>
                              {odometerData.max.toLocaleString('pt-BR')} <span className="text-xs text-zinc-500">km</span>
                            </>
                          ) : '---'}
                        </p>
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Distância máxima percorrida com um tanque</span>
                      </div>

                      {/* Stats Column 3 */}
                      <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-2xl flex flex-col justify-center">
                        <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest mb-1">Último Odômetro na Bomba</p>
                        <p className="text-xl font-black text-white tabular-nums flex items-baseline gap-1">
                          {vehicleFuel.length > 0 ? (
                            <>
                              {vehicleFuel[0].odometer.toLocaleString('pt-BR')} <span className="text-xs text-zinc-500">km</span>
                            </>
                          ) : '---'}
                        </p>
                        <span className="text-[8px] text-zinc-600 font-bold uppercase tracking-wider mt-1">Diferença de {(vehicle.currentOdometer - (vehicleFuel[0]?.odometer || 0)).toLocaleString('pt-BR')} km para o painel</span>
                      </div>
                    </div>

                    {odometerData.validRuns.length > 0 ? (
                      <div className="h-64 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative">
                        <div className="absolute right-6 top-6 flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-brand-accent ring-4 ring-brand-accent/25 animate-pulse" />
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Traçado de Consumo (km)</span>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={odometerData.validRuns}>
                            <defs>
                              <linearGradient id="colorKm" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ff6b00" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#ff6b00" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#27272a" />
                            <XAxis dataKey="date" fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} />
                            <YAxis fontSize={10} tickLine={false} axisLine={false} tick={{ fill: '#71717a' }} unit=" km" />
                            <Tooltip 
                              contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '12px', fontSize: '10px' }}
                              labelClassName="text-white font-black"
                            />
                            <Area type="monotone" dataKey="kmTraveled" name="KM entre Reabastecimentos" stroke="#ff6b00" fillOpacity={1} fill="url(#colorKm)" strokeWidth={2.5} />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    ) : (
                      <div className="p-8 bg-zinc-950 border border-zinc-850 rounded-2xl border-dashed text-center">
                        <AlertCircle className="mx-auto text-zinc-600 mb-2" size={20} />
                        <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Dados de Abastecimentos Insuficientes</p>
                        <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Registre pelo menos dois abastecimentos com odometrias crescentes para traçar a variação de Km.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <Modal 
        isOpen={isChecklistModalOpen} 
        onClose={() => setIsChecklistModalOpen(false)}
        title="Checklist Operacional"
      >
        <ChecklistForm 
          onSubmit={handleChecklistSubmit}
          loading={isSubmiting}
        />
      </Modal>

      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
        onConfirm={processDelete}
        title="Confirmar Exclusão"
        message="Tem certeza que deseja excluir este item definitivamente? Esta ação não pode ser revertida."
      />

      <ConfirmModal 
        isOpen={soldConfirmOpen}
        onClose={() => setSoldConfirmOpen(false)}
        onConfirm={processMarkAsSold}
        title="Confirmar Venda do Veículo"
        message={`Tem certeza que deseja marcar o veículo ${vehicle.plate} como VENDIDO? Ele será removido da lista de ativos operacionais.`}
      />

      <AnimatePresence>
        {innerMaintenanceForm?.isOpen && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/90 backdrop-blur-md" id="nested-maintenance-portal">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setInnerMaintenanceForm(null)}
              className="absolute inset-0 cursor-pointer"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', duration: 0.4 }}
              className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-zinc-800/80 rounded-[2rem] flex flex-col overflow-hidden shadow-2xl z-10"
              id="nested-maintenance-body"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-zinc-850 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 border border-amber-500/25">
                    <Wrench size={18} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">
                      {innerMaintenanceForm.initialData?.id ? 'Editar Ordem de Serviço' : 'Registrar Nova Ordem de Serviço'}
                    </h3>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                      DM Turismo • Terminal Mecânico Proativo
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setInnerMaintenanceForm(null)}
                  className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all border border-zinc-800 hover:border-zinc-700 cursor-pointer"
                  title="Fechar"
                >
                  <X size={15} />
                </button>
              </div>

              {/* Form Content */}
              <div className="flex-1 overflow-y-auto p-6 sm:p-8">
                <MaintenanceForm 
                  onSubmit={async (data: any) => {
                    if (onSaveMaintenance) {
                      await onSaveMaintenance(data);
                      setInnerMaintenanceForm(null);
                    }
                  }}
                  loading={isSavingMaintenance}
                  vehicles={vehicles.length > 0 ? vehicles : [vehicle]}
                  initialData={innerMaintenanceForm.initialData}
                  maintenanceHistory={maintenanceHistory}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
});
