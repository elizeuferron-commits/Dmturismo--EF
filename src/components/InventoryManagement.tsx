import React, { useState, useEffect, useMemo } from 'react';
import { 
  Package, 
  Plus, 
  Search, 
  ArrowUpRight, 
  ArrowDownLeft, 
  AlertTriangle, 
  User, 
  Calendar, 
  History, 
  Trash2, 
  PlusCircle, 
  Check, 
  TrendingUp, 
  FileText,
  FileSpreadsheet,
  Layers,
  ChevronRight,
  Sparkles,
  ClipboardCheck,
  Building,
  Wrench,
  Brush,
  PenTool,
  ShoppingBag,
  Disc
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  runTransaction, 
  query, 
  orderBy, 
  limit 
} from 'firebase/firestore';
import { db, cleanUndefined } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { Input, Select, Textarea, Button, Modal, ConfirmModal } from './UI';
import { StockItem } from '../types';

interface InventoryManagementProps {
  userRole?: string;
}

export const InventoryManagement: React.FC<InventoryManagementProps> = ({ userRole }) => {
  // Real-time stock items and transaction logs
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [tireAlerts, setTireAlerts] = useState<any[]>([]);
  const [tireDossiers, setTireDossiers] = useState<any[]>([]);

  // Modals / states for tyre management
  const [isAlertsHubOpen, setIsAlertsHubOpen] = useState<boolean>(false);
  const [selectedTireForDossier, setSelectedTireForDossier] = useState<StockItem | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState<boolean>(false);

  // Tire alert creation form state
  const [newAlertItemId, setNewAlertItemId] = useState<string>('');
  const [newAlertType, setNewAlertType] = useState<string>('Nível Crítico');
  const [newAlertThreshold, setNewAlertThreshold] = useState<string>('');
  const [newAlertNotes, setNewAlertNotes] = useState<string>('');
  const [loadingTireAlert, setLoadingTireAlert] = useState<boolean>(false);

  // Tire dossier creation form state
  const [dossierSerial, setDossierSerial] = useState<string>('');
  const [dossierBrand, setDossierBrand] = useState<string>('MICHELIN');
  const [dossierDot, setDossierDot] = useState<string>('');
  const [dossierDepth, setDossierDepth] = useState<number>(10);
  const [dossierVehicleId, setDossierVehicleId] = useState<string>('');
  const [dossierPosition, setDossierPosition] = useState<string>('DIANTEIRO ESQUERDO');
  const [dossierOdometer, setDossierOdometer] = useState<number>(0);
  const [dossierStatus, setDossierStatus] = useState<string>('NOVO');
  const [dossierAuditor, setDossierAuditor] = useState<string>('');
  const [dossierNotes, setDossierNotes] = useState<string>('');
  const [loadingDossier, setLoadingDossier] = useState<boolean>(false);

  // UI state
  const [inventoryFilter, setInventoryFilter] = useState<string>('TUDO');
  const [selectedTireTab, setSelectedTireTab] = useState<'TODOS' | 'ÔNIBUS' | 'MICRO-ÔNIBUS' | 'VAN' | 'OUTROS'>('TODOS');
  const [searchTerm, setSearchTerm] = useState<string>('');
  
  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState<boolean>(false);
  const [isTxModalOpen, setIsTxModalOpen] = useState<boolean>(false);
  const [isDeleteTxConfirmOpen, setIsDeleteTxConfirmOpen] = useState<boolean>(false);
  const [selectedTxId, setSelectedTxId] = useState<string>('');
  const [activeHistoryType, setActiveHistoryType] = useState<'TOTAL' | 'CRITICAL' | 'PEÇAS' | 'PNEUS' | 'LIMPEZA' | 'ESCRITÓRIO' | null>(null);
  
  // Auto Purchase Order State
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState<boolean>(false);
  const [purchaseItems, setPurchaseItems] = useState<any[]>([]);
  const [purchaseEmployeeId, setPurchaseEmployeeId] = useState<string>('');
  const [loadingPurchase, setLoadingPurchase] = useState<boolean>(false);

  // Loading states
  const [loadingItem, setLoadingItem] = useState<boolean>(false);
  const [loadingTx, setLoadingTx] = useState<boolean>(false);

  // Selected item for quick Transaction
  const [selectedItemForTx, setSelectedItemForTx] = useState<StockItem | null>(null);

  // Form states - New Item
  const [newFieldName, setNewFieldName] = useState<string>('');
  const [newFieldCategory, setNewFieldCategory] = useState<string>('PEÇAS');
  const [newFieldVehicleType, setNewFieldVehicleType] = useState<'ÔNIBUS' | 'MICRO-ÔNIBUS' | 'VAN' | 'OUTROS'>('ÔNIBUS');
  const [newFieldQuantity, setNewFieldQuantity] = useState<number>(0);
  const [newFieldUnit, setNewFieldUnit] = useState<string>('UN');
  const [newFieldMinQuantity, setNewFieldMinQuantity] = useState<number>(5);

  // Form states - Transaction
  const [txItemId, setTxItemId] = useState<string>('');
  const [txType, setTxType] = useState<string>('ENTRADA');
  const [txQuantity, setTxQuantity] = useState<number>(1);
  const [txEmployeeId, setTxEmployeeId] = useState<string>('');
  const [txJustification, setTxJustification] = useState<string>('');

  // Sincronizações de dados em tempo real
  useEffect(() => {
    const unsubStock = dbCacheService.subscribeCollection('stock_items', (data) => {
      setStockItems(data);
    });

    const unsubTransactions = dbCacheService.subscribeCollection('stock_transactions', (data) => {
      setTransactions(data);
    });

    const unsubEmployees = dbCacheService.subscribeCollection('employees', (data) => {
      setEmployees(data);
    });

    const unsubVehicles = dbCacheService.subscribeCollection('vehicles', (data) => {
      setVehicles(data);
    });

    const unsubTireAlerts = dbCacheService.subscribeCollection('tire_alerts', (data) => {
      setTireAlerts(data);
    });

    const unsubTireDossiers = dbCacheService.subscribeCollection('tire_dossiers', (data) => {
      setTireDossiers(data);
    });

    return () => {
      unsubStock();
      unsubTransactions();
      unsubEmployees();
      unsubVehicles();
      unsubTireAlerts();
      unsubTireDossiers();
    };
  }, []);

  // Update item selection form trigger
  useEffect(() => {
    if (selectedItemForTx) {
      setTxItemId(selectedItemForTx.id);
    } else if (stockItems.length > 0 && !txItemId) {
      setTxItemId(stockItems[0].id);
    }
  }, [selectedItemForTx, stockItems]);

  const canManage = useMemo(() => {
    const role = String(userRole || '').toLowerCase();
    return ['admin', 'manager', 'dono / proprietário', 'gestor de frotas', 'coordenador logístico', 'administrativo'].includes(role);
  }, [userRole]);

  // Handle addition of a brand new Stock Item
  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFieldName.trim()) {
      toast.error("O nome do item é obrigatório.");
      return;
    }
    
    setLoadingItem(true);
    try {
      const itemData: any = {
        name: newFieldName.trim(),
        category: newFieldCategory.toUpperCase(),
        quantity: Number(newFieldQuantity) || 0,
        unit: newFieldUnit.trim().toUpperCase(),
        minQuantity: Number(newFieldMinQuantity) || 0
      };

      if (newFieldCategory.toUpperCase() === 'PNEUS') {
        itemData.vehicleType = newFieldVehicleType;
      }

      await addDoc(collection(db, 'stock_items'), cleanUndefined(itemData));
      
      // Auto register an initial input transaction helper log if quantity is positive
      if (itemData.quantity > 0) {
        await addDoc(collection(db, 'stock_transactions'), cleanUndefined({
          itemId: '', // special status
          itemName: itemData.name,
          category: itemData.category,
          type: 'ENTRADA',
          quantity: itemData.quantity,
          unit: itemData.unit,
          employeeId: 'SISTEMA',
          employeeName: 'SALDO INICIAL',
          justification: 'LANÇAMENTO DA COMPRA / CADASTRO INICIAL DO ATIVO NO ESTOQUE',
          timestamp: new Date().toISOString()
        }));
      }

      toast.success("Item de Almoxarifado cadastrado!");
      
      // Reset
      setNewFieldName('');
      setNewFieldQuantity(0);
      setNewFieldUnit('UN');
      setNewFieldMinQuantity(5);
      setIsItemModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao cadastrar: " + (err.message || err));
    } finally {
      setLoadingItem(false);
    }
  };

  // Handle tire alert creation
  const handleCreateTireAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlertItemId) {
      toast.error("Por favor, selecione um pneu de referência.");
      return;
    }
    if (!newAlertThreshold.trim()) {
      toast.error("O valor de limite / aviso é obrigatório.");
      return;
    }

    setLoadingTireAlert(true);
    try {
      const selectedItem = stockItems.find(i => i.id === newAlertItemId);
      await addDoc(collection(db, 'tire_alerts'), cleanUndefined({
        itemId: newAlertItemId,
        itemName: selectedItem?.name || 'PNEU',
        alertType: newAlertType,
        thresholdValue: newAlertThreshold.trim(),
        status: 'ATIVO',
        notes: newAlertNotes.trim(),
        createdAt: new Date().toISOString()
      }));

      toast.success("Alerta de pneu configurado!");
      setNewAlertThreshold('');
      setNewAlertNotes('');
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar alerta: " + (err.message || err));
    } finally {
      setLoadingTireAlert(false);
    }
  };

  // Toggle Tire Alert status (mark as resolved / active)
  const handleToggleTireAlert = async (alertId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'ATIVO' ? 'RESOLVIDO' : 'ATIVO';
      await updateDoc(doc(db, 'tire_alerts', alertId), cleanUndefined({
        status: newStatus
      }));
      toast.success(newStatus === 'RESOLVIDO' ? "Alerta marcado como RESOLVIDO!" : "Alerta reativado!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao alterar alerta: " + (err.message || err));
    }
  };

  // Delete/Remove Tire Alert
  const handleDeleteTireAlert = async (alertId: string) => {
    try {
      await deleteDoc(doc(db, 'tire_alerts', alertId));
      toast.success("Alerta de pneu removido.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao deletar alerta: " + (err.message || err));
    }
  };

  // Handle tire dossier inspection register
  const handleCreateDossier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTireForDossier) return;
    if (!dossierSerial.trim()) {
      toast.error("O número de série (Fogo/Série) é obrigatório.");
      return;
    }

    setLoadingDossier(true);
    try {
      const selectedVehicle = vehicles.find(v => v.id === dossierVehicleId);
      await addDoc(collection(db, 'tire_dossiers'), cleanUndefined({
        itemId: selectedTireForDossier.id,
        serialNumber: dossierSerial.trim().toUpperCase(),
        brandOption: dossierBrand,
        dotCode: dossierDot.trim().toUpperCase() || 'N/D',
        grooveDepth: Number(dossierDepth) || 0,
        currentVehicleId: dossierVehicleId || 'ESTOQUE',
        currentVehiclePlate: selectedVehicle?.plate || 'DISPONÍVEL NO ALMOXARIFADO',
        wheelPosition: dossierPosition,
        currentOdometer: Number(dossierOdometer) || 0,
        status: dossierStatus,
        auditorName: dossierAuditor.trim() || 'INSPETOR DM TURISMO',
        notes: dossierNotes.trim(),
        updatedAt: new Date().toISOString()
      }));

      toast.success(`Dossiê do pneu série ${dossierSerial.toUpperCase()} criado!`);
      // Reset form
      setDossierSerial('');
      setDossierDot('');
      setDossierDepth(10);
      setDossierVehicleId('');
      setDossierOdometer(0);
      setDossierNotes('');
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar dossiê: " + (err.message || err));
    } finally {
      setLoadingDossier(false);
    }
  };

  // Delete single dossier record
  const handleDeleteDossier = async (dossierId: string) => {
    try {
      await deleteDoc(doc(db, 'tire_dossiers', dossierId));
      toast.success("Registro de dossiê removido.");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao remover registro: " + (err.message || err));
    }
  };

  // Delete Item from Inventory
  const handleDeleteItem = async (itemId: string, itemName: string) => {
    if (!window.confirm(`Tem certeza que deseja excluir o item ${itemName}? Esta ação é irreversível.`)) return;
    try {
      await deleteDoc(doc(db, 'stock_items', itemId));
      toast.success(`Item ${itemName} removido com sucesso.`);
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao deletar item: " + (err.message || err));
    }
  };

  // Safe Transaction submission using runTransaction to prevent racing states in quantity calculation
  const handleLaunchTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txItemId) {
      toast.error("Selecione um item do inventário.");
      return;
    }
    if (txQuantity <= 0) {
      toast.error("Insira uma quantidade superior a zero.");
      return;
    }

    const employeeSelected = employees.find(emp => emp.id === txEmployeeId);
    const employeeName = employeeSelected?.name || 'OUTRO OPERADOR / OFICINA';

    setLoadingTx(true);
    try {
      const stockItemRef = doc(db, 'stock_items', txItemId);
      
      const success = await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(stockItemRef);
        if (!itemDoc.exists()) {
          throw new Error("O item de almoxarifado não existe.");
        }

        const currentQty = itemDoc.data().quantity || 0;
        const itemName = itemDoc.data().name || 'Sem Nome';
        const itemCategory = itemDoc.data().category || 'GERAL';
        const itemUnit = itemDoc.data().unit || 'UN';

        let newQty = currentQty;
        if (txType === 'ENTRADA') {
          newQty = currentQty + Number(txQuantity);
        } else {
          // Saída
          if (currentQty < txQuantity) {
            throw new Error(`Estoque insuficiente! Saldo atual de ${currentQty} ${itemUnit}.`);
          }
          newQty = currentQty - Number(txQuantity);
        }

        // Apply Stock Item write
        transaction.update(stockItemRef, { quantity: newQty });

        // Apply Transaction record write
        const txRef = doc(collection(db, 'stock_transactions'));
        transaction.set(txRef, cleanUndefined({
          itemId: txItemId,
          itemName,
          category: itemCategory,
          type: txType,
          quantity: Number(txQuantity),
          unit: itemUnit,
          employeeId: txEmployeeId || 'oficina',
          employeeName,
          justification: txJustification.trim().toUpperCase() || 'MOVIMENTAÇÃO DE ESTOQUE',
          timestamp: new Date().toISOString()
        }));

        return { itemName, newQty, itemUnit };
      });

      toast.success(`${txType} registrada: ${success.itemName} agora possui saldo de ${success.newQty} ${success.itemUnit}`);
      
      // Cleanup
      setTxQuantity(1);
      setTxJustification('');
      setTxEmployeeId('');
      setSelectedItemForTx(null);
      setIsTxModalOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao efetuar movimentação.");
    } finally {
      setLoadingTx(false);
    }
  };

  // Safe delete of mistake transactions
  const handleDeleteTransaction = async () => {
    if (!selectedTxId) return;
    try {
      const txSelected = transactions.find(t => t.id === selectedTxId);
      if (!txSelected) return;

      const itemId = txSelected.itemId;
      const tQty = txSelected.quantity || 0;
      const tType = txSelected.type;

      if (itemId) {
        // Reverse inventory modification if item still exists
        const stockRef = doc(db, 'stock_items', itemId);
        await runTransaction(db, async (transaction) => {
          const itemDoc = await transaction.get(stockRef);
          if (itemDoc.exists()) {
            const currentQty = itemDoc.data().quantity || 0;
            // if we deleted a Saída, we add the qty back. If we deleted an Entrada, we subtract.
            let newQty = currentQty;
            if (tType === 'SAÍDA') {
              newQty = currentQty + tQty;
            } else {
              newQty = Math.max(0, currentQty - tQty);
            }
            transaction.update(stockRef, { quantity: newQty });
          }
        });
      }

      await deleteDoc(doc(db, 'stock_transactions', selectedTxId));
      toast.success("Sincronização: Lançamento removido e saldo estornado.");
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao estornar movimentação: " + (err.message || err));
    } finally {
      setSelectedTxId('');
    }
  };

  // Filtered List computations
  const filteredItems = useMemo(() => {
    return stockItems
      .filter(item => {
        const matchesCategory = inventoryFilter === 'TUDO' || item.category === inventoryFilter;
        const matchesSearch = !searchTerm || 
          item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.category.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesCategory && matchesSearch;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [stockItems, inventoryFilter, searchTerm]);

  // Dynamic Classification of tires by vehicle types with fallback
  const tiresByVehicleType = useMemo(() => {
    const tires = stockItems.filter(item => {
      const isTire = item.category === 'PNEUS';
      const matchesSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
      return isTire && matchesSearch;
    });
    return {
      ONIBUS: tires.filter(t => t.vehicleType === 'ÔNIBUS' || (!t.vehicleType && t.name.toLowerCase().includes('ônibus') && !t.name.toLowerCase().includes('micro'))),
      MICRO_ONIBUS: tires.filter(t => t.vehicleType === 'MICRO-ÔNIBUS' || (!t.vehicleType && t.name.toLowerCase().includes('micro'))),
      VAN: tires.filter(t => t.vehicleType === 'VAN' || (!t.vehicleType && t.name.toLowerCase().includes('van'))),
      OUTROS: tires.filter(t => t.vehicleType === 'OUTROS' || (!t.vehicleType && !t.name.toLowerCase().includes('van') && !t.name.toLowerCase().includes('ônibus') && !t.name.toLowerCase().includes('micro')))
    };
  }, [stockItems, searchTerm]);

  // High-fidelity stats calculation for informative cards of tires
  const tireStatsByVehicleType = useMemo(() => {
    const calc = (list: StockItem[]) => {
      const totalTypes = list.length;
      const totalQuantity = list.reduce((acc, item) => acc + (item.quantity || 0), 0);
      const criticalCount = list.filter(item => (item.quantity || 0) < (item.minQuantity || 0)).length;
      return { totalTypes, totalQuantity, criticalCount };
    };
    return {
      ONIBUS: calc(tiresByVehicleType.ONIBUS),
      MICRO_ONIBUS: calc(tiresByVehicleType.MICRO_ONIBUS),
      VAN: calc(tiresByVehicleType.VAN),
      OUTROS: calc(tiresByVehicleType.OUTROS)
    };
  }, [tiresByVehicleType]);

  // Modal filtered items matching the active KPI history selection
  const modalFilteredItems = useMemo(() => {
    if (!activeHistoryType) return [];
    if (activeHistoryType === 'TOTAL') return stockItems;
    if (activeHistoryType === 'CRITICAL') return stockItems.filter(i => (i.quantity || 0) < (i.minQuantity || 0));
    return stockItems.filter(i => i.category === activeHistoryType);
  }, [stockItems, activeHistoryType]);

  // Exporter of stock balance matching selected KPI Card
  const handleExportStockToPDF = async (type: 'TOTAL' | 'CRITICAL' | 'PEÇAS' | 'PNEUS' | 'LIMPEZA' | 'ESCRITÓRIO') => {
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;
      
      let itemsToPrint: StockItem[] = [];
      let subtitle = '';
      if (type === 'TOTAL') {
        itemsToPrint = stockItems;
        subtitle = 'RELAÇÃO COMPLETA DE SALDOS E ITENS';
      } else if (type === 'CRITICAL') {
        itemsToPrint = stockItems.filter(i => (i.quantity || 0) < (i.minQuantity || 0));
        subtitle = 'ALERTAS DE REPOSIÇÃO - ESTOQUES CRÍTICOS';
      } else if (type === 'PEÇAS') {
        itemsToPrint = stockItems.filter(i => i.category === 'PEÇAS');
        subtitle = 'CONTROLE DE ESTOQUE - SEÇÃO PEÇAS & MANUTENÇÃO';
      } else if (type === 'PNEUS') {
        itemsToPrint = stockItems.filter(i => i.category === 'PNEUS');
        subtitle = 'CONTROLE DE ESTOQUE - SEÇÃO DE PNEUS DA FROTA';
      } else if (type === 'LIMPEZA') {
        itemsToPrint = stockItems.filter(i => i.category === 'LIMPEZA');
        subtitle = 'CONTROLE DE ESTOQUE - SEÇÃO PRODUTOS DE LIMPEZA';
      } else if (type === 'ESCRITÓRIO') {
        itemsToPrint = stockItems.filter(i => i.category === 'ESCRITÓRIO');
        subtitle = 'CONTROLE DE ESTOQUE - SEÇÃO ESCRITÓRIO & SUPRIMENTOS';
      }

      // Draw top header using same pattern as ReportsView
      doc.setFillColor(24, 24, 27);
      doc.rect(14, 14, 182, 30, 'F');
      
      doc.setDrawColor(26, 80, 241);
      doc.setLineWidth(0.5);
      doc.rect(14, 14, 182, 30, 'D');
      doc.line(74, 14, 74, 44);
      doc.line(144, 14, 144, 44);

      // logo
      doc.setFillColor(26, 80, 241);
      doc.rect(18, 20, 10, 4, 'F');
      doc.rect(18, 26, 14, 4, 'F');
      doc.rect(18, 32, 7, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('DM TURISMO', 36, 26);
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text('INTELIGÊNCIA & OPERAÇÕES', 36, 31);

      // detail box
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.setFontSize(8);
      doc.text('ALMOXARIFADO CENTRAL', 78, 21);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text(subtitle, 78, 28);
      doc.setFontSize(6.5);
      doc.setTextColor(200, 200, 200);
      doc.text(`Filtro: ${type} | Total: ${itemsToPrint.length} itens`, 78, 37);

      // dates box
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.setFontSize(7.5);
      doc.text('CONTROLE DE ESTOQUES', 148, 21);
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`Emitido: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 148, 27);
      doc.text(`${itemsToPrint.length} Registros Ativos`, 148, 32);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(34, 197, 94);
      doc.text('✔ CERTIFICADO DM PRO', 148, 39);

      let curY = 56;
      
      const heads = [['Item / Material', 'Seção / Categoria', 'Estoque Corrente', 'Mínimo Recomendável', 'Situação']];
      const rows = itemsToPrint.map((item) => {
        const isBelowMin = (item.quantity || 0) < (item.minQuantity || 0);
        return [
          item.name.toUpperCase(),
          item.category.toUpperCase(),
          `${item.quantity || 0} ${item.unit || 'UN'}`,
          `${item.minQuantity || 0} ${item.unit || 'UN'}`,
          isBelowMin ? 'REPOSIÇÃO URGENTE' : 'DISPONÍVEL / REGULAR'
        ];
      });

      autoTable(doc, {
        startY: curY,
        head: heads,
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });

      doc.save(`CONTROLE_ESTOQUE_EF_${type}_${format(new Date(), 'yyyyMMdd')}.pdf`);
      toast.success('Relatório de estoque exportado com sucesso em PDF!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao emitir arquivo PDF: ' + (err.message || err));
    }
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalItems = stockItems.length;
    const criticalCount = stockItems.filter(i => (i.quantity || 0) < (i.minQuantity || 0)).length;
    
    // Categorized quantities
    const pecasCount = stockItems.filter(i => i.category === 'PEÇAS').length;
    const pneusCount = stockItems.filter(i => i.category === 'PNEUS').length;
    const limpezaCount = stockItems.filter(i => i.category === 'LIMPEZA').length;
    const escritorioCount = stockItems.filter(i => i.category === 'ESCRITÓRIO').length;

    return { totalItems, criticalCount, pecasCount, pneusCount, limpezaCount, escritorioCount };
  }, [stockItems]);

  const selectOptionsItems = useMemo(() => {
    return stockItems
      .map(item => ({
        value: item.id,
        label: `${item.name.toUpperCase()} (${item.quantity} ${item.unit} | ${item.category})`
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [stockItems]);

  const selectOptionsEmployees = useMemo(() => {
    const sorted = [...employees].sort((a, b) => a.name.localeCompare(b.name));
    return [
      { value: '', label: 'SELECIONE O COLABORADOR / RESPONSÁVEL' },
      ...sorted.map(e => ({
        value: e.id,
        label: `${e.name.toUpperCase()} (${e.role.toUpperCase()})`
      }))
    ];
  }, [employees]);

  // Open Purchase Order Generator with smart initialization
  const handleOpenPurchaseOrderGenerator = () => {
    const criticalItems = stockItems.filter(item => (item.quantity || 0) < (item.minQuantity || 0));
    
    const itemsData = criticalItems.map(item => {
      // Restore stocks to 2x minQuantity to provide functional margin, minus current level
      const suggestedQty = Math.max(1, (item.minQuantity * 2) - (item.quantity || 0));
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        currentQty: item.quantity || 0,
        minQuantity: item.minQuantity || 0,
        unit: item.unit,
        orderQty: suggestedQty,
        selected: true,
        supplier: ''
      };
    });

    setPurchaseItems(itemsData);
    setPurchaseEmployeeId('');
    setIsPurchaseModalOpen(true);
  };

  // Export Purchase Order PDF Sheet
  const handleExportPurchaseOrderPDF = async () => {
    const itemsToPrint = purchaseItems.filter(i => i.selected);
    if (itemsToPrint.length === 0) {
      toast.error("Selecione pelo menos um item para imprimir na ordem de compra.");
      return;
    }

    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;
      const doc = new jsPDF() as any;
      const subtitle = 'ORDEM DE COMPRA E REPOSIÇÃO COLETIVA';
      const orderNo = `OC-${format(new Date(), 'yyyyMMdd')}-${String(Math.floor(1000 + Math.random() * 9000))}`;

      // Draw top header
      doc.setFillColor(24, 24, 27);
      doc.rect(14, 14, 182, 30, 'F');
      
      doc.setDrawColor(26, 80, 241);
      doc.setLineWidth(0.5);
      doc.rect(14, 14, 182, 30, 'D');
      doc.line(74, 14, 74, 44);
      doc.line(144, 14, 144, 44);

      // logo
      doc.setFillColor(26, 80, 241);
      doc.rect(18, 20, 10, 4, 'F');
      doc.rect(18, 26, 14, 4, 'F');
      doc.rect(18, 32, 7, 4, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(255, 255, 255);
      doc.text('DM TURISMO', 36, 26);
      doc.setFontSize(6);
      doc.setTextColor(150, 150, 150);
      doc.text('INTELIGÊNCIA & OPERAÇÕES', 36, 31);

      // detail box
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.setFontSize(8);
      doc.text('SUPRIMENTOS & COMPRAS', 78, 21);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(8.5);
      doc.text(subtitle, 78, 28);
      doc.setFontSize(6.5);
      doc.setTextColor(200, 200, 200);
      doc.text(`Identificador: ${orderNo}`, 78, 37);

      // dates box
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.setFontSize(7.5);
      doc.text('PEDIDO DE REPOSIÇÃO', 148, 21);
      doc.setTextColor(200, 200, 200);
      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.text(`Emitido: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, 148, 27);
      doc.text(`${itemsToPrint.length} Itens Sob Demanda`, 148, 32);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(26, 80, 241);
      doc.text('AUTO-REPOSIÇÃO SISTÊMICA', 148, 39);

      let curY = 56;

      const heads = [['Item / Material', 'Seção / Categoria', 'Estoque Atual', 'Mínimo', 'Quant. Pedida', 'Fornecedor Recomendado']];
      const rows = itemsToPrint.map((item) => [
        item.name.toUpperCase(),
        item.category.toUpperCase(),
        `${item.currentQty} ${item.unit || 'UN'}`,
        `${item.minQuantity} ${item.unit || 'UN'}`,
        `${item.orderQty} ${item.unit || 'UN'}`,
        item.supplier ? item.supplier.toUpperCase() : 'NÃO ESPECIFICADO'
      ]);

      autoTable(doc, {
        startY: curY,
        head: heads,
        body: rows,
        theme: 'grid',
        headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 8 },
        bodyStyles: { fontSize: 7.5, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [245, 245, 245] }
      });

      // Sign-off line
      const finalY = (doc as any).lastAutoTable.finalY + 30;
      doc.line(14, finalY, 90, finalY);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text('SOLICITANTE - ALMOXARIFADO DM TURISMO', 14, finalY + 5);

      doc.line(110, finalY, 190, finalY);
      doc.text('DIRETORIA / AUTORIZAÇÃO DE COMPRA (ASSINATURA)', 110, finalY + 5);

      doc.save(`${orderNo}.pdf`);
      toast.success('Documento de Ordem de Compra exportado em PDF!');
    } catch (err: any) {
      console.error(err);
      toast.error('Erro ao emitir PDF de Compra: ' + (err.message || err));
    }
  };

  // Launch entries in bulk to satisfy purchase orders in database
  const handleLaunchPurchaseOrders = async () => {
    const itemsToOrder = purchaseItems.filter(i => i.selected);
    if (itemsToOrder.length === 0) {
      toast.error("Selecione pelo menos um item para processar.");
      return;
    }
    
    setLoadingPurchase(true);
    try {
      const employeeSelected = employees.find(emp => emp.id === purchaseEmployeeId);
      const employeeName = employeeSelected?.name || 'SISTEMA DE COMPRAS DM TURISMO';

      // Executa de forma transacional para cada item
      for (const item of itemsToOrder) {
        const stockItemRef = doc(db, 'stock_items', item.id);
        await runTransaction(db, async (transaction) => {
          const itemDoc = await transaction.get(stockItemRef);
          if (!itemDoc.exists()) return;
          
          const currentQty = itemDoc.data().quantity || 0;
          const newQty = currentQty + Number(item.orderQty);
          
          transaction.update(stockItemRef, { quantity: newQty });
          
          const txRef = doc(collection(db, 'stock_transactions'));
          transaction.set(txRef, {
            itemId: item.id,
            itemName: item.name,
            category: item.category,
            type: 'ENTRADA',
            quantity: Number(item.orderQty),
            unit: item.unit,
            employeeId: purchaseEmployeeId || 'SISTEMA',
            employeeName,
            justification: `ORDEM DE COMPRA AUTOMÁTICA - REPOSIÇÃO (FORN: ${item.supplier || 'N/D'})`.toUpperCase(),
            timestamp: new Date().toISOString()
          });
        });
      }
      
      toast.success("Reposição registrada! O estoque foi devidamente abastecido.");
      setIsPurchaseModalOpen(false);
    } catch (err: any) {
      console.error("Erro reposição por ordem de compra:", err);
      toast.error("Falha ao lançar compras no banco: " + (err.message || err));
    } finally {
      setLoadingPurchase(false);
    }
  };

  // Helper to render high-fidelity tyre cards in the exclusive split screen
  const renderTireCard = (item: StockItem) => {
    const isBelowMin = (item.quantity || 0) < (item.minQuantity || 0);
    const itemTransactions = transactions
      .filter(t => t.itemId === item.id)
      .slice(0, 3); // Last 3 movements

    return (
      <div 
        key={item.id} 
        className={cn(
          "stock-item-row group relative p-4 bg-zinc-950/45 hover:bg-zinc-950 hover:shadow-xl border rounded-2xl transition-all flex flex-col justify-between space-y-3",
          isBelowMin ? "is-below-min border-rose-950/65 bg-rose-950/[0.02]" : "border-zinc-850 hover:border-zinc-700"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="font-extrabold text-white uppercase text-[11px] leading-tight tracking-tight">{item.name}</h4>
            <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[7px] font-black tracking-widest bg-zinc-900 border border-zinc-800 text-zinc-400">
              {item.unit}
            </span>
          </div>

          <div className="text-right shrink-0">
            <p className="font-black text-white text-lg leading-none">{item.quantity}</p>
            <span className="text-[7.5px] text-zinc-500 font-bold mt-1 block uppercase">QTD</span>
          </div>
        </div>

        {/* Histórico Recente */}
        {itemTransactions.length > 0 && (
          <div className="pt-2 border-t border-zinc-900 space-y-1">
            <p className="text-[7px] text-zinc-600 font-black uppercase">Últimas Movimentações:</p>
            {itemTransactions.map((tx: any) => (
              <div key={tx.id} className="flex justify-between items-center text-[7px] text-zinc-400">
                <span className="truncate max-w-[60%]">{tx.type} ({tx.quantity})</span>
                <span>{tx.timestamp ? format(parseISO(tx.timestamp), 'dd/MM HH:mm') : '-'}</span>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2.5 border-t border-zinc-900 flex items-center justify-between text-[8px] text-zinc-500 font-extrabold">
          <span>MIN: {item.minQuantity}</span>
          {isBelowMin ? (
            <span className="flex items-center gap-0.5 text-rose-500 font-black tracking-wider text-[7.5px] uppercase">
              • REPOSIÇÃO
            </span>
          ) : (
            <span className="flex items-center gap-0.5 text-emerald-500 font-black tracking-wider text-[7.5px] uppercase">
              • EM DIA
            </span>
          )}
        </div>

        <div className="pt-2 border-t border-zinc-900/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedTireForDossier(item);
              setIsDossierModalOpen(true);
            }}
            className="w-full text-center py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-[8px] font-black tracking-widest text-zinc-300 uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 shadow-sm"
          >
            <FileText size={10} className="text-brand-accent scale-110" />
            Dossiê Técnico ({tireDossiers.filter((d: any) => d.itemId === item.id).length})
          </button>
        </div>

        {/* Operational Hover Actions */}
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 bg-zinc-950/90 p-1 rounded-lg">
          <button 
            type="button"
            onClick={() => {
              setTxType('ENTRADA');
              setSelectedItemForTx(item);
              setIsTxModalOpen(true);
            }}
            title="Entrada / Abastecer" 
            className="p-1 px-2 bg-emerald-950 border border-emerald-900 rounded text-emerald-400 hover:bg-emerald-900 hover:text-white transition-all cursor-pointer text-[9px] font-bold"
          >
            +
          </button>
          <button 
            type="button"
            onClick={() => {
              setTxType('SAÍDA');
              setSelectedItemForTx(item);
              setIsTxModalOpen(true);
            }}
            title="Saída / Retirar" 
            className="p-1 px-2 bg-rose-950 border border-rose-900 rounded text-rose-450 hover:bg-rose-900 hover:text-white transition-all cursor-pointer text-[9px] font-bold"
          >
            -
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="InventoryManagement space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* HEADER DM TURISMO */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <Package size={32} className="text-brand-accent animate-pulse" />
            Almoxarifado DM Turismo
          </h1>
          <p className="text-zinc-500 font-semibold uppercase text-xs tracking-wider">
            Gestão Real de Peças Técnicas, Pneus, Materiais de Limpeza e Materiais de Escritório.
          </p>
        </div>
        
        {/* ACTION TRIGGER BUTTONS */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleOpenPurchaseOrderGenerator}
            className="flex items-center gap-2 px-5 py-3.5 bg-zinc-950 border border-zinc-850 hover:border-zinc-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest cursor-pointer hover:bg-zinc-900 active:scale-95 transition-all"
            title="Sugerir e gerar compras automáticas para itens em nível crítico"
          >
            <ShoppingBag size={14} className="text-brand-accent scale-110" />
            Ordens de Compra
          </button>

          <button
            onClick={() => {
              setTxType('ENTRADA');
              setSelectedItemForTx(null);
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-100 rounded-xl font-bold uppercase text-[10px] tracking-widest cursor-pointer hover:bg-zinc-950 active:scale-95 transition-all"
          >
            <ArrowUpRight size={14} className="text-emerald-500" />
            Lançar Entrada
          </button>
          
          <button
            onClick={() => {
              setTxType('SAÍDA');
              setSelectedItemForTx(null);
              setIsTxModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-3.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-100 rounded-xl font-bold uppercase text-[10px] tracking-widest cursor-pointer hover:bg-zinc-950 active:scale-95 transition-all"
          >
            <ArrowDownLeft size={14} className="text-rose-500" />
            Lançar Retirada
          </button>

          <button
            onClick={() => setIsItemModalOpen(true)}
            className="flex items-center gap-2 px-5 py-3.5 bg-brand-accent text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer active:scale-95 transition-all"
          >
            <Plus size={15} />
            Novo Item
          </button>
        </div>
      </div>

      {/* OVERVIEW PANEL STATS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Total Items */}
        <div 
          onClick={() => setActiveHistoryType('TOTAL')}
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:border-zinc-650 hover:bg-zinc-850/80 active:scale-98 transition-all duration-300"
          title="Ver todos os itens em estoque"
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Total Almoxarifado</span>
            <Layers size={14} className="text-zinc-600" />
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-black text-white">{kpis.totalItems}</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Materiais Cadastrados</p>
          </div>
        </div>

        {/* Level alerts */}
        <div 
          onClick={() => setActiveHistoryType('CRITICAL')}
          className={cn(
            "border p-5 rounded-2xl flex flex-col justify-between cursor-pointer active:scale-98 transition-all duration-300",
            kpis.criticalCount > 0 
              ? "bg-rose-950/20 border-rose-900/60 hover:bg-rose-950/40 hover:border-rose-700 animate-pulse-soft" 
              : "bg-zinc-900 border-zinc-800 hover:border-rose-900 hover:bg-zinc-850/80"
          )}
          title="Ver alerts de reposição"
        >
          <div className="flex items-center justify-between">
            <span className={cn("text-[8px] font-black uppercase tracking-widest", kpis.criticalCount > 0 ? "text-rose-455" : "text-zinc-500")}>Nível Crítico (Reposição)</span>
            <AlertTriangle size={14} className={kpis.criticalCount > 0 ? "text-rose-500" : "text-zinc-600"} />
          </div>
          <div className="mt-4">
            <h3 className={cn("text-3xl font-black", kpis.criticalCount > 0 ? "text-rose-500" : "text-white")}>{kpis.criticalCount}</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Abaixo do Recomendado</p>
          </div>
        </div>

        {/* Parts Count */}
        <div 
          onClick={() => setActiveHistoryType('PEÇAS')}
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:border-blue-800 hover:bg-zinc-850/80 active:scale-98 transition-all duration-300"
          title="Ver estoque de peças de mecânica"
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-blue-450 uppercase tracking-widest">Seção Peças</span>
            <Wrench size={14} className="text-blue-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{kpis.pecasCount} Itens</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Mecânica & Reparos</p>
          </div>
        </div>

        {/* Pneus Count */}
        <div 
          onClick={() => setActiveHistoryType('PNEUS')}
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:border-brand-accent hover:bg-zinc-850/80 active:scale-98 transition-all duration-300"
          title="Ver estoque de pneus da frota"
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest">Seção Pneus</span>
            <Disc size={14} className="text-brand-accent animate-pulse" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{kpis.pneusCount} Itens</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Controle de Rodagem</p>
          </div>
        </div>

        {/* Cleaning Count */}
        <div 
          onClick={() => setActiveHistoryType('LIMPEZA')}
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:border-emerald-800 hover:bg-zinc-850/80 active:scale-98 transition-all duration-300"
          title="Ver estoque de produtos de limpeza"
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-emerald-450 uppercase tracking-widest">Seção Limpeza</span>
            <Brush size={14} className="text-emerald-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{kpis.limpezaCount} Itens</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Higiene & Conservação</p>
          </div>
        </div>

        {/* Office count */}
        <div 
          onClick={() => setActiveHistoryType('ESCRITÓRIO')}
          className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl flex flex-col justify-between cursor-pointer hover:border-purple-855 hover:bg-zinc-850/80 active:scale-98 transition-all duration-300"
          title="Ver estoque de materiais de escritório"
        >
          <div className="flex items-center justify-between">
            <span className="text-[8px] font-black text-purple-450 uppercase tracking-widest">Seção Escritório</span>
            <PenTool size={14} className="text-purple-500" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{kpis.escritorioCount} Itens</h3>
            <p className="text-[9px] text-zinc-400 font-extrabold uppercase mt-1">Suprimentos Gerais</p>
          </div>
        </div>
      </div>

      {/* FILTER BUTTONS & QUICK SEARCH */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          {/* Tabs Filter */}
          <div className="flex flex-wrap bg-zinc-950 border border-zinc-800 p-1 rounded-2xl w-fit">
            {['TUDO', 'PEÇAS', 'PNEUS', 'LIMPEZA', 'ESCRITÓRIO'].map((cat) => (
              <button
                key={cat}
                onClick={() => setInventoryFilter(cat)}
                className={cn(
                  "px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer",
                  inventoryFilter === cat
                    ? "bg-brand-accent text-zinc-950 shadow"
                    : "text-zinc-500 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Search */}
          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" size={15} />
            <input 
              type="text" 
              placeholder="Buscar item do almoxarifado..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-950 border border-zinc-850 focus:border-brand-accent rounded-xl text-xs font-semibold text-white outline-none transition-all placeholder:text-zinc-650"
            />
          </div>
        </div>

        {/* COMPACT PRODUCT INVENTORY GRID OR TYRE SPLIT SCREEN */}
        {inventoryFilter === 'PNEUS' ? (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* CENTRAL DE ALERTAS DE PNEUS - REAL-TIME NOTIFICATIONS */}
            <div className="p-5 bg-zinc-950 border border-zinc-850 rounded-2xl space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-brand-accent/10 border border-brand-accent/20 rounded-xl">
                    <AlertTriangle className="text-brand-accent animate-pulse" size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-white uppercase tracking-tight">Painel de Alertas de Rodagem</h4>
                    <p className="text-zinc-500 text-[9px] font-bold uppercase mt-0.5">
                      Controle ativo de calibração, vulcanização, sulcos e reteste de carcaças
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Pre-fill active tire options
                      const firstPneu = stockItems.find(i => i.category === 'PNEUS');
                      if (firstPneu) setNewAlertItemId(firstPneu.id);
                      setIsAlertsHubOpen(true);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 border border-zinc-800 hover:border-zinc-750 text-white rounded-xl font-black uppercase text-[9px] tracking-widest cursor-pointer hover:bg-zinc-850 transition-all shadow"
                  >
                    <PlusCircle size={12} className="text-brand-accent" />
                    Gerenciar Alertas ({tireAlerts.filter(a => a.status === 'ATIVO').length})
                  </button>
                </div>
              </div>

              {/* LIST OF ACTIVE ALERTS */}
              {tireAlerts.filter(a => a.status === 'ATIVO').length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {tireAlerts.filter(a => a.status === 'ATIVO').slice(0, 4).map((alert: any) => (
                    <div 
                      key={alert.id} 
                      className="flex items-center justify-between p-3 bg-rose-950/15 border border-rose-900/40 rounded-xl"
                    >
                      <div className="space-y-1 max-w-[70%]">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping animate-pulse-soft" />
                          <p className="text-[10px] font-extrabold text-white uppercase truncate">{alert.itemName}</p>
                        </div>
                        <p className="text-[8px] text-zinc-400 font-bold uppercase">
                          Motivo: <strong className="text-brand-accent">{alert.alertType}</strong> • Limite: <span className="font-mono text-zinc-300">{alert.thresholdValue}</span>
                        </p>
                        {alert.notes && (
                          <p className="text-[8px] text-zinc-500 italic truncate font-bold uppercase mt-0.5">Obs: "{alert.notes}"</p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleTireAlert(alert.id, 'ATIVO')}
                        className="px-2.5 py-1 bg-rose-950 hover:bg-emerald-950 border border-rose-900 hover:border-emerald-900 text-rose-455 hover:text-emerald-400 font-black text-[7.5px] uppercase rounded-lg transition-all cursor-pointer"
                      >
                        ✓ Resolver
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-zinc-900/30 border border-zinc-850 rounded-xl text-center">
                  <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                    ✓ Nenhum alerta de pneu crítico emitido na ferramenta. Todos os ativos encontram-se monitorados.
                  </p>
                </div>
              )}
            </div>

            {/* CARDS INFORMATIVOS DE PNEUS (INFORMATIVE CARDS) - Interactive & Highly Polished */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              
              {/* Card Ônibus */}
              <div 
                onClick={() => setSelectedTireTab(selectedTireTab === 'ÔNIBUS' ? 'TODOS' : 'ÔNIBUS')}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-350 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm",
                  selectedTireTab === 'ÔNIBUS' 
                    ? "bg-zinc-950 border-brand-accent ring-1 ring-brand-accent/40" 
                    : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950/65"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚌</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Ônibus</span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                    {tireStatsByVehicleType.ONIBUS.totalTypes} {tireStatsByVehicleType.ONIBUS.totalTypes === 1 ? 'modelo' : 'modelos'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estoque Total</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {tireStatsByVehicleType.ONIBUS.totalQuantity} <span className="text-xs text-zinc-500 font-extrabold uppercase">Uni</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-905 flex items-center justify-between">
                  {tireStatsByVehicleType.ONIBUS.criticalCount > 0 ? (
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      ⚠️ {tireStatsByVehicleType.ONIBUS.criticalCount} EM REPOSIÇÃO
                    </span>
                  ) : (
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                      ✓ ESTOQUE SEGURO
                    </span>
                  )}
                </div>
              </div>

              {/* Card Micro-ônibus */}
              <div 
                onClick={() => setSelectedTireTab(selectedTireTab === 'MICRO-ÔNIBUS' ? 'TODOS' : 'MICRO-ÔNIBUS')}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-350 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm",
                  selectedTireTab === 'MICRO-ÔNIBUS' 
                    ? "bg-zinc-950 border-brand-accent ring-1 ring-brand-accent/40" 
                    : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950/65"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚐</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Micro-ônibus</span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                    {tireStatsByVehicleType.MICRO_ONIBUS.totalTypes} {tireStatsByVehicleType.MICRO_ONIBUS.totalTypes === 1 ? 'modelo' : 'modelos'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estoque Total</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {tireStatsByVehicleType.MICRO_ONIBUS.totalQuantity} <span className="text-xs text-zinc-500 font-extrabold uppercase">Uni</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-905 flex items-center justify-between">
                  {tireStatsByVehicleType.MICRO_ONIBUS.criticalCount > 0 ? (
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      ⚠️ {tireStatsByVehicleType.MICRO_ONIBUS.criticalCount} EM REPOSIÇÃO
                    </span>
                  ) : (
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                      ✓ ESTOQUE SEGURO
                    </span>
                  )}
                </div>
              </div>

              {/* Card Van */}
              <div 
                onClick={() => setSelectedTireTab(selectedTireTab === 'VAN' ? 'TODOS' : 'VAN')}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-350 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm",
                  selectedTireTab === 'VAN' 
                    ? "bg-zinc-950 border-brand-accent ring-1 ring-brand-accent/40" 
                    : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950/65"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚗</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Van</span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                    {tireStatsByVehicleType.VAN.totalTypes} {tireStatsByVehicleType.VAN.totalTypes === 1 ? 'modelo' : 'modelos'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estoque Total</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {tireStatsByVehicleType.VAN.totalQuantity} <span className="text-xs text-zinc-500 font-extrabold uppercase">Uni</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-905 flex items-center justify-between">
                  {tireStatsByVehicleType.VAN.criticalCount > 0 ? (
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      ⚠️ {tireStatsByVehicleType.VAN.criticalCount} EM REPOSIÇÃO
                    </span>
                  ) : (
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                      ✓ ESTOQUE SEGURO
                    </span>
                  )}
                </div>
              </div>

              {/* Card Outros */}
              <div 
                onClick={() => setSelectedTireTab(selectedTireTab === 'OUTROS' ? 'TODOS' : 'OUTROS')}
                className={cn(
                  "p-5 rounded-2xl border transition-all duration-350 cursor-pointer flex flex-col justify-between space-y-4 shadow-sm",
                  selectedTireTab === 'OUTROS' 
                    ? "bg-zinc-950 border-brand-accent ring-1 ring-brand-accent/40" 
                    : "bg-zinc-950/40 border-zinc-900 hover:border-zinc-800 hover:bg-zinc-950/65"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">⚙️</span>
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Outros</span>
                  </div>
                  <span className="text-[9px] bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded-full text-zinc-400 font-bold">
                    {tireStatsByVehicleType.OUTROS.totalTypes} {tireStatsByVehicleType.OUTROS.totalTypes === 1 ? 'modelo' : 'modelos'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Estoque Total</div>
                  <div className="text-2xl font-black text-white mt-1">
                    {tireStatsByVehicleType.OUTROS.totalQuantity} <span className="text-xs text-zinc-500 font-extrabold uppercase">Uni</span>
                  </div>
                </div>
                <div className="pt-2 border-t border-zinc-905 flex items-center justify-between">
                  {tireStatsByVehicleType.OUTROS.criticalCount > 0 ? (
                    <span className="text-[8px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1">
                      ⚠️ {tireStatsByVehicleType.OUTROS.criticalCount} EM REPOSIÇÃO
                    </span>
                  ) : (
                    <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1">
                      ✓ ESTOQUE SEGURO
                    </span>
                  )}
                </div>
              </div>

            </div>

            {/* SELETOR DE ABAS DEDICADO DE VEÍCULOS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl">
              <div className="flex flex-wrap bg-zinc-900 p-0.5 rounded-xl border border-zinc-800 relative">
                {(['TODOS', 'ÔNIBUS', 'MICRO-ÔNIBUS', 'VAN', 'OUTROS'] as const).map((tireTab) => {
                  const isActive = selectedTireTab === tireTab;
                  return (
                    <button
                      key={tireTab}
                      onClick={() => setSelectedTireTab(tireTab)}
                      className={cn(
                        "relative px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest cursor-pointer transition-colors duration-200 focus:outline-none",
                        isActive ? "text-zinc-950 font-black z-10" : "text-zinc-450 hover:text-white"
                      )}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="activeTirePill"
                          className="absolute inset-0 bg-brand-accent rounded-lg shadow-md -z-0"
                          transition={{ type: "spring", stiffness: 380, damping: 30 }}
                        />
                      )}
                      <span className="relative z-10">
                        {tireTab === 'TODOS' ? '🎛️ Visão Geral' : tireTab}
                      </span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[9px] text-zinc-500 font-black uppercase tracking-wider">
                Visualizando: <strong className="text-brand-accent">{selectedTireTab === 'TODOS' ? 'FROTA COMPLETA (4 COLUNAS)' : selectedTireTab}</strong>
              </p>
            </div>

            {/* MAIN PNEUS LIST VIEW GRID OR SPLIT-SCREEN */}
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedTireTab}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {selectedTireTab === 'TODOS' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {/* Ônibus */}
                <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <h3 className="font-black text-xs text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">🚌</span> Ônibus
                      </h3>
                      <span className="text-[10px] bg-zinc-905 text-zinc-400 border border-zinc-850 px-2.5 py-0.5 rounded-full font-black">
                        {tiresByVehicleType.ONIBUS.length}
                      </span>
                    </div>
                    <div className="space-y-4 mt-4">
                      {tiresByVehicleType.ONIBUS.length > 0 ? (
                        tiresByVehicleType.ONIBUS.map(renderTireCard)
                      ) : (
                        <div className="py-20 text-center text-zinc-700 uppercase text-[9px] font-black tracking-wider">Nenhum Pneu</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Micro-ônibus */}
                <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <h3 className="font-black text-xs text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">🚐</span> Micro-ônibus
                      </h3>
                      <span className="text-[10px] bg-zinc-905 text-zinc-400 border border-zinc-850 px-2.5 py-0.5 rounded-full font-black">
                        {tiresByVehicleType.MICRO_ONIBUS.length}
                      </span>
                    </div>
                    <div className="space-y-4 mt-4">
                      {tiresByVehicleType.MICRO_ONIBUS.length > 0 ? (
                        tiresByVehicleType.MICRO_ONIBUS.map(renderTireCard)
                      ) : (
                        <div className="py-20 text-center text-zinc-700 uppercase text-[9px] font-black tracking-wider">Nenhum Pneu</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Van */}
                <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <h3 className="font-black text-xs text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">🚗</span> Van
                      </h3>
                      <span className="text-[10px] bg-zinc-905 text-zinc-400 border border-zinc-850 px-2.5 py-0.5 rounded-full font-black">
                        {tiresByVehicleType.VAN.length}
                      </span>
                    </div>
                    <div className="space-y-4 mt-4">
                      {tiresByVehicleType.VAN.length > 0 ? (
                        tiresByVehicleType.VAN.map(renderTireCard)
                      ) : (
                        <div className="py-20 text-center text-zinc-700 uppercase text-[9px] font-black tracking-wider">Nenhum Pneu</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Outros */}
                <div className="bg-zinc-950/30 border border-zinc-850 p-5 rounded-2xl flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-3">
                      <h3 className="font-black text-xs text-zinc-100 uppercase tracking-widest flex items-center gap-2">
                        <span className="text-sm">⚙️</span> Outros
                      </h3>
                      <span className="text-[10px] bg-zinc-905 text-zinc-400 border border-zinc-850 px-2.5 py-0.5 rounded-full font-black">
                        {tiresByVehicleType.OUTROS.length}
                      </span>
                    </div>
                    <div className="space-y-4 mt-4">
                      {tiresByVehicleType.OUTROS.length > 0 ? (
                        tiresByVehicleType.OUTROS.map(renderTireCard)
                      ) : (
                        <div className="py-20 text-center text-zinc-700 uppercase text-[9px] font-black tracking-wider">Nenhum Pneu</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-950/20 border border-zinc-900 p-6 rounded-3xl animate-in fade-in duration-300">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                  {selectedTireTab === 'ÔNIBUS' && (
                    tiresByVehicleType.ONIBUS.length > 0 ? (
                      tiresByVehicleType.ONIBUS.map(renderTireCard)
                    ) : (
                      <div className="col-span-full py-16 text-center text-zinc-600 uppercase text-[10px] font-extrabold tracking-widest">Nenhum Pneu cadastrado para Ônibus</div>
                    )
                  )}
                  {selectedTireTab === 'MICRO-ÔNIBUS' && (
                    tiresByVehicleType.MICRO_ONIBUS.length > 0 ? (
                      tiresByVehicleType.MICRO_ONIBUS.map(renderTireCard)
                    ) : (
                      <div className="col-span-full py-16 text-center text-zinc-600 uppercase text-[10px] font-extrabold tracking-widest">Nenhum Pneu cadastrado para Micro-ônibus</div>
                    )
                  )}
                  {selectedTireTab === 'VAN' && (
                    tiresByVehicleType.VAN.length > 0 ? (
                      tiresByVehicleType.VAN.map(renderTireCard)
                    ) : (
                      <div className="col-span-full py-16 text-center text-zinc-600 uppercase text-[10px] font-extrabold tracking-widest">Nenhum Pneu cadastrado para Van</div>
                    )
                  )}
                  {selectedTireTab === 'OUTROS' && (
                    tiresByVehicleType.OUTROS.length > 0 ? (
                      tiresByVehicleType.OUTROS.map(renderTireCard)
                    ) : (
                      <div className="col-span-full py-16 text-center text-zinc-600 uppercase text-[10px] font-extrabold tracking-widest">Nenhum Pneu cadastrado para esta categoria</div>
                    )
                  )}
                </div>
              </div>
            )}
              </motion.div>
            </AnimatePresence>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredItems.length > 0 ? (
              filteredItems.map((item) => {
                const isBelowMin = (item.quantity || 0) < (item.minQuantity || 0);
                return (
                  <div 
                    key={item.id} 
                    className={cn(
                      "stock-item-row group relative p-5 bg-zinc-950/40 hover:bg-zinc-950 hover:shadow-xl border rounded-2xl transition-all flex flex-col justify-between",
                      isBelowMin ? "is-below-min border-rose-950/60 bg-rose-950/[0.02]" : "border-zinc-850 hover:border-zinc-750"
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-center gap-4">
                        {/* Visual Category Icon container */}
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center border",
                          item.category === 'PEÇAS' ? "bg-blue-950/20 border-blue-900/40 text-blue-500" :
                          item.category === 'LIMPEZA' ? "bg-emerald-950/20 border-emerald-900/40 text-emerald-500" :
                          "bg-purple-950/20 border-purple-900/40 text-purple-500"
                        )}>
                          {item.category === 'PEÇAS' ? <Wrench size={18} /> : 
                           item.category === 'LIMPEZA' ? <Brush size={18} /> : 
                           <PenTool size={18} />}
                        </div>
                        
                        <div>
                          <h4 className="font-extrabold text-white uppercase text-xs tracking-tight">{item.name}</h4>
                          <span className={cn(
                            "inline-block px-2 py-0.5 rounded text-[7px] font-black tracking-widest mt-1 uppercase",
                            item.category === 'PEÇAS' ? "bg-blue-950/50 text-blue-400 border border-blue-900/40" :
                            item.category === 'LIMPEZA' ? "bg-emerald-950/50 text-emerald-400 border border-emerald-900/40" :
                            "bg-purple-950/50 text-purple-400 border border-purple-900/40"
                          )}>
                            {item.category}
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-extrabold text-white text-xl leading-none">{item.quantity}</p>
                        <span className="text-[8px] text-zinc-500 font-black mt-1 block uppercase">{item.unit}</span>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-zinc-900/80 flex items-center justify-between">
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        Mín. Recomendável: <strong className="text-zinc-300">{item.minQuantity} {item.unit}</strong>
                      </span>

                      {isBelowMin ? (
                        <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-rose-950/40 text-rose-500 border border-rose-900/40 text-[7px] font-black tracking-widest uppercase">
                          <AlertTriangle size={8} className="animate-pulse-soft text-rose-500 shrink-0" /> REPOSIÇÃO
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-950/30 text-emerald-500 border border-emerald-900/40 text-[7px] font-black tracking-widest uppercase">
                          <Check size={8} /> DISPONÍVEL
                        </span>
                      )}
                    </div>

                    {/* Operational Hover Actions */}
                    <div className="absolute right-3 top-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button 
                        onClick={() => handleDeleteItem(item.id, item.name)}
                        title="Excluir item"
                        className="p-1.5 bg-zinc-950/80 border border-zinc-800 rounded-lg text-rose-500 hover:bg-rose-900 hover:text-white transition-all cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                      <button 
                        onClick={() => {
                          setTxType('ENTRADA');
                          setSelectedItemForTx(item);
                          setIsTxModalOpen(true);
                        }}
                        title="Entrada" 
                        className="p-1.5 bg-emerald-950/80 border border-emerald-900 rounded-lg text-emerald-400 hover:bg-emerald-900 hover:text-white transition-all cursor-pointer"
                      >
                        <ArrowUpRight size={12} />
                      </button>
                      <button 
                        onClick={() => {
                          setTxType('SAÍDA');
                          setSelectedItemForTx(item);
                          setIsTxModalOpen(true);
                        }}
                        title="Uso / Retirada" 
                        className="p-1.5 bg-rose-950/80 border border-rose-900 rounded-lg text-rose-450 hover:bg-rose-900 hover:text-white transition-all cursor-pointer"
                      >
                        <ArrowDownLeft size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-full py-16 text-center">
                <Package size={40} className="text-zinc-700 mx-auto mb-4" />
                <p className="text-zinc-500 text-xs font-extrabold uppercase tracking-widest">Nenhum item localizado no almoxarifado</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* LAUNCHED STOCK TRANSACTIONS ACTIVITY HISTORY LOG */}
      <div className="p-6 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-3">
          <History className="text-brand-accent" size={16} />
          <h3 className="text-xs font-black text-white uppercase tracking-widest">Últimos Lançamentos - Entrada e Saída de Materiais</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-850 text-zinc-500 text-[8px] font-black uppercase tracking-widest bg-zinc-950/50 rounded-xl">
                <th className="py-4 px-4 rounded-l-xl">Data / Hora</th>
                <th className="py-4 px-4">Item de Estoque</th>
                <th className="py-4 px-4">Movimentação</th>
                <th className="py-4 px-4">Quantidade</th>
                <th className="py-4 px-4">Responsável / Colaborador</th>
                <th className="py-4 px-4">Motivo / Justificativa</th>
                {canManage && <th className="py-4 px-4 text-right rounded-r-xl">Ações</th>}
              </tr>
            </thead>
            <tbody>
              {transactions.length > 0 ? (
                transactions.map((tx) => {
                  const isInput = tx.type === 'ENTRADA';
                  return (
                    <tr key={tx.id} className="border-b border-zinc-900 hover:bg-zinc-900/30 text-xs transition-colors">
                      <td className="py-4 px-4 text-zinc-500 font-bold tabular-nums">
                        {tx.timestamp ? format(parseISO(tx.timestamp), 'dd/MM/yyyy HH:mm') : '---'}
                      </td>
                      <td className="py-4 px-4 font-extrabold text-white uppercase">
                        {tx.itemName?.toUpperCase() || 'EXCLUÍDO'}
                        <span className="block text-[8px] text-zinc-500 uppercase tracking-tight">{tx.category}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[8px] font-black tracking-widest uppercase border",
                          isInput 
                            ? "bg-emerald-950/60 text-emerald-405 border-emerald-900/40" 
                            : "bg-rose-950/60 text-rose-450 border-rose-900/40"
                        )}>
                          {isInput ? <ArrowUpRight size={10} /> : <ArrowDownLeft size={10} />}
                          {tx.type}
                        </span>
                      </td>
                      <td className="py-4 px-4 font-extrabold text-white tabular-nums">
                        {tx.quantity} {tx.unit}
                      </td>
                      <td className="py-4 px-4 text-zinc-300 font-semibold uppercase">
                        {tx.employeeName?.toUpperCase() || 'N/A'}
                      </td>
                      <td className="py-4 px-4 max-w-xs truncate text-zinc-400 font-medium" title={tx.justification}>
                        {tx.justification || 'EXERCÍCIO DE ROTINA INTERNA'}
                      </td>
                      {canManage && (
                        <td className="py-4 px-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedTxId(tx.id);
                              setIsDeleteTxConfirmOpen(true);
                            }}
                            className="p-2 hover:bg-rose-950/50 border border-transparent hover:border-rose-900 text-zinc-400 hover:text-rose-500 rounded-lg transition-all cursor-pointer inline-flex items-center"
                            title="Estornar registro"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                    Sem movimentações recentes cadastradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NEW ITEM CADASTRO */}
      <Modal 
        isOpen={isItemModalOpen} 
        onClose={() => setIsItemModalOpen(false)} 
        title="Cadastrar Material de Almoxarifado"
      >
        <form onSubmit={handleCreateItem} className="space-y-6">
          <p className="text-[10px] uppercase font-black text-zinc-500 tracking-wider">
            Lançamento de Produto no Almoxarifado Central.
          </p>

          <Input 
            label="Nome do Item / Material" 
            placeholder="Ex: AMORTECEDOR TRASEIRO DE ÔNIBUS MERCEDES"
            required
            value={newFieldName}
            onChange={(e: any) => setNewFieldName(e.target.value)}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select 
              label="Categoria / Seção"
              value={newFieldCategory}
              onChange={(e: any) => setNewFieldCategory(e.target.value)}
              options={[
                { value: 'PEÇAS', label: '🛠 PEÇAS & MANUTENÇÃO' },
                { value: 'PNEUS', label: '🛞 PNEUS' },
                { value: 'LIMPEZA', label: '🧹 PRODUTOS DE LIMPEZA' },
                { value: 'ESCRITÓRIO', label: '📁 ESCRITÓRIO & SUPRIMENTOS' }
              ]}
            />

            <Input 
              label="Unidade de Medida"
              placeholder="Ex: UN, L, CX, PAR, JG"
              required
              value={newFieldUnit}
              onChange={(e: any) => setNewFieldUnit(e.target.value)}
            />
          </div>

          {newFieldCategory === 'PNEUS' && (
            <Select 
              label="Tipo de Veículo (Para Separação das Colunas)"
              value={newFieldVehicleType}
              onChange={(e: any) => setNewFieldVehicleType(e.target.value as any)}
              options={[
                { value: 'ÔNIBUS', label: '🚌 ÔNIBUS' },
                { value: 'MICRO-ÔNIBUS', label: '🚐 MICRO-ÔNIBUS' },
                { value: 'VAN', label: '🚗 VAN' },
                { value: 'OUTROS', label: '⚙️ OUTROS' }
              ]}
            />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              type="number"
              label="Quantidade Inicial em Estoque"
              required
              min="0"
              value={newFieldQuantity}
              onChange={(e: any) => setNewFieldQuantity(Number(e.target.value))}
            />

            <Input 
              type="number"
              label="Aviso Limite Mínimo (Alerta)"
              required
              min="0"
              value={newFieldMinQuantity}
              onChange={(e: any) => setNewFieldMinQuantity(Number(e.target.value))}
            />
          </div>

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" type="button" onClick={() => setIsItemModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={loadingItem}>Salvar Item</Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: TRANSACTION ENTRADA / SAÍDA */}
      <Modal 
        isOpen={isTxModalOpen} 
        onClose={() => setIsTxModalOpen(false)} 
        title={selectedItemForTx ? `Lançar ${txType} - ${selectedItemForTx.name.toUpperCase()}` : `Lançar ${txType} de Almoxarifado`}
      >
        <form onSubmit={handleLaunchTransaction} className="space-y-6">
          <p className="text-[10px] uppercase font-black text-zinc-500 tracking-wider">
            Atualização em tempo real do nível de mercadorias.
          </p>

          <div className="grid grid-cols-1 gap-6">
            <Select 
              label="Tipo de Procedimento"
              value={txType}
              onChange={(e: any) => setTxType(e.target.value)}
              options={[
                { value: 'ENTRADA', label: '📈 ENTRADA - ABASTECIMENTO / COMPRA' },
                { value: 'SAÍDA', label: '📉 SAÍDA - RETIRADA / USO OPERACIONAL' }
              ]}
            />

            {/* If item not preselected, allow choosing from list */}
            {!selectedItemForTx && (
              <Select 
                label="Selecione o Item do Almoxarifado"
                value={txItemId}
                onChange={(e: any) => setTxItemId(e.target.value)}
                options={selectOptionsItems}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input 
              type="number"
              label="Quantidade do Movimento"
              required
              min="1"
              value={txQuantity}
              onChange={(e: any) => setTxQuantity(Number(e.target.value))}
            />

            <Select 
              label="Colaborador Solicitante/Responsável"
              value={txEmployeeId}
              onChange={(e: any) => setTxEmployeeId(e.target.value)}
              options={selectOptionsEmployees}
            />
          </div>

          <Textarea 
            label="Finalidade / Justificativa detalhada"
            placeholder="Ex: Troca de pastilhas de freios do ônibus de turismo placa GWI-8890, ou Material para limpeza geral da portaria/garagem."
            required
            value={txJustification}
            onChange={(e: any) => setTxJustification(e.target.value)}
          />

          <div className="flex gap-4 pt-4">
            <Button variant="secondary" type="button" onClick={() => setIsTxModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={loadingTx}>Efetuar Lançamento</Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRMATION FOR TX REVERSAL */}
      <ConfirmModal 
        isOpen={isDeleteTxConfirmOpen}
        onClose={() => setIsDeleteTxConfirmOpen(false)}
        onConfirm={handleDeleteTransaction}
        title="Estornar Registro de Almoxarifado?"
        message="Tem certeza que dejesa estornar essa movimentação? O saldo do produto correspondente será recalculado e estornado automaticamente no banco de dados."
      />

      {/* MODAL: HISTÓRICO / CONTROLE DE ESTOQUE COMPLETO */}
      <Modal
        isOpen={activeHistoryType !== null}
        onClose={() => setActiveHistoryType(null)}
        title={
          activeHistoryType === 'TOTAL' ? "Histórico de Todos os Itens do Almoxarifado" :
          activeHistoryType === 'CRITICAL' ? "Histórico de Itens em Nível Crítico (Abaixo do Mínimo)" :
          activeHistoryType === 'PEÇAS' ? "Histórico de Peças e Itens de Manutenção" :
          activeHistoryType === 'LIMPEZA' ? "Listagem de Todos os Itens de Limpeza" :
          activeHistoryType === 'ESCRITÓRIO' ? "Histórico de Itens de Escritório e Suprimentos" :
          "Controle de Almoxarifado"
        }
      >
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950 p-4 rounded-xl border border-zinc-850">
            <div className="space-y-1">
              <p className="text-xs text-zinc-400 font-medium">
                Você está visualizando o controle e histórico do estoque selecionado no momento.
              </p>
              <p className="text-[10px] text-zinc-500 font-black uppercase">
                Total localizado: <span className="text-brand-accent">{modalFilteredItems.length}</span> registros ativos
              </p>
            </div>
            
            <button
              type="button"
              onClick={() => {
                if (activeHistoryType) {
                  handleExportStockToPDF(activeHistoryType);
                }
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-brand-accent hover:bg-orange-600 text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest cursor-pointer active:scale-95 transition-all w-full sm:w-auto justify-center shadow-lg"
            >
              <FileText size={14} />
              Gerar PDF
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto border border-zinc-850 rounded-xl bg-zinc-950/40">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-500/20 text-zinc-500 text-[8px] font-black uppercase tracking-widest bg-zinc-950/80 sticky top-0 backdrop-blur-sm">
                  <th className="py-3 px-4">Item / Material</th>
                  <th className="py-3 px-4">Seção</th>
                  <th className="py-3 px-4">Quantidade</th>
                  <th className="py-3 px-4">Mínimo</th>
                  <th className="py-3 px-4 text-right">Situação</th>
                </tr>
              </thead>
              <tbody>
                {modalFilteredItems.length > 0 ? (
                  modalFilteredItems.map((item) => {
                    const isBelowMin = (item.quantity || 0) < (item.minQuantity || 0);
                    return (
                      <tr 
                        key={item.id} 
                        className={cn(
                          "stock-item-row border-b border-zinc-900/50 hover:bg-zinc-900/40 text-xs transition-colors",
                          isBelowMin && "is-below-min"
                        )}
                      >
                        <td className="py-3 px-4 font-extrabold text-white uppercase">{item.name}</td>
                        <td className="py-3 px-4 text-zinc-400 font-semibold uppercase">{item.category}</td>
                        <td className="py-3 px-4 font-black text-white tabular-nums">
                          {item.quantity} <span className="text-[9px] text-zinc-500">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-zinc-400 font-bold tabular-nums">
                          {item.minQuantity} <span className="text-[9px] text-zinc-500">{item.unit}</span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {isBelowMin ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-rose-950/40 text-rose-500 border border-rose-900/40 text-[7px] font-black tracking-widest uppercase">
                              <AlertTriangle size={8} className="animate-pulse-soft text-rose-500 shrink-0" /> ABAIXO DO MÍNIMO
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-emerald-950/30 text-emerald-500 border border-emerald-900/40 text-[7px] font-black tracking-widest uppercase">
                              <Check size={8} /> REGULAR / OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-zinc-500 font-semibold uppercase text-[10px] tracking-wider">
                      Nenhum item localizado para este filtro de controle de estoque.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-850">
            <Button variant="secondary" onClick={() => setActiveHistoryType(null)}>Fechar</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL: DIRECT AUTO PURCHASE ORDER ENGINE (ORDEM DE COMPRA E REPOSIÇÃO COLETIVA) */}
      <Modal
        isOpen={isPurchaseModalOpen}
        onClose={() => setIsPurchaseModalOpen(false)}
        title="Gerar Ordens de Compra - Reposição Automática"
      >
        <div className="space-y-6">
          <div className="space-y-1">
            <p className="text-[10px] uppercase font-black text-lime-505 tracking-wider flex items-center gap-1.5">
              <Sparkles size={11} className="text-lime-500" /> Análise de estoque crítico ativa
            </p>
            <p className="text-xs text-zinc-400">
              O assistente DM detectou todos os itens com estoque abaixo do mínimo e calculou as quantidades recomendadas de compra para reabastecimento de segurança.
            </p>
          </div>

          {purchaseItems.length === 0 ? (
            <div className="py-14 text-center bg-zinc-950/80 p-8 rounded-[2rem] border border-zinc-850">
              <div className="w-14 h-14 bg-emerald-950/30 border border-emerald-900/40 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-500">
                <Check size={28} className="animate-bounce" />
              </div>
              <p className="text-white text-xs font-black uppercase tracking-widest">Estoque de Excelente Saúde!</p>
              <p className="text-zinc-500 text-[9px] uppercase font-bold mt-2 leading-relaxed">Nenhum item do almoxarifado está em nível crítico de reposição no momento.</p>
            </div>
          ) : (
            <>
              {/* Responsive purchase items list */}
              <div className="max-h-[45vh] overflow-y-auto space-y-4 pr-1 scrollbar-thin">
                {purchaseItems.map((item, index) => (
                  <div 
                    key={item.id} 
                    className={cn(
                      "p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-950/60",
                      item.selected ? "border-brand-accent/40 bg-zinc-950/90 shadow-lg shadow-brand-accent/5" : "border-zinc-850 opacity-40 hover:opacity-60"
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div className="pt-1 select-none">
                        <input 
                          type="checkbox"
                          id={`chk-${item.id}`}
                          checked={item.selected}
                          onChange={() => {
                            const updated = [...purchaseItems];
                            updated[index].selected = !updated[index].selected;
                            setPurchaseItems(updated);
                          }}
                          className="accent-brand-accent w-4 h-4 rounded border-zinc-800 cursor-pointer"
                        />
                      </div>
                      <label htmlFor={`chk-${item.id}`} className="cursor-pointer block">
                        <h4 className="font-extrabold text-white uppercase text-xs leading-tight">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          <span className={cn(
                            "inline-block px-1.5 py-0.5 rounded text-[6px] font-black tracking-widest uppercase border",
                            item.category === 'PEÇAS' ? "bg-blue-950/50 text-blue-400 border-blue-900/40" :
                            item.category === 'LIMPEZA' ? "bg-emerald-950/50 text-emerald-400 border-emerald-900/40" :
                            "bg-purple-950/50 text-purple-400 border-purple-900/40"
                          )}>
                            {item.category}
                          </span>
                          <span className="text-[8px] text-zinc-500 font-extrabold uppercase">
                            Atual: <strong className="text-rose-500">{item.currentQty} {item.unit}</strong> | Limiar Recomendado: <strong className="text-zinc-400">{item.minQuantity} {item.unit}</strong>
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 border-t border-zinc-900 md:border-t-0 pt-3 md:pt-0">
                      {/* Order Quantity control */}
                      <div className="space-y-1">
                        <label className="text-[7px] text-zinc-500 font-black uppercase block tracking-wider">Quant. Comprar</label>
                        <div className="flex items-center bg-zinc-900 border border-zinc-800 focus-within:border-brand-accent/50 rounded-xl overflow-hidden w-28">
                          <input 
                            type="number"
                            min="1"
                            value={item.orderQty}
                            onChange={(e) => {
                              const updated = [...purchaseItems];
                              updated[index].orderQty = Math.max(1, Number(e.target.value));
                              setPurchaseItems(updated);
                            }}
                            className="bg-transparent text-white font-bold text-xs pl-3 py-2 w-full outline-none text-center"
                          />
                          <span className="text-[9px] font-black text-zinc-500 pr-3 uppercase">{item.unit}</span>
                        </div>
                      </div>

                      {/* Supplier/Fornecedor field */}
                      <div className="space-y-1">
                        <label className="text-[7px] text-zinc-500 font-black uppercase block tracking-wider">Distribuidor / Fornecedor</label>
                        <input 
                          type="text"
                          placeholder="Recomendado / Digite..."
                          value={item.supplier}
                          onChange={(e) => {
                            const updated = [...purchaseItems];
                            updated[index].supplier = e.target.value;
                            setPurchaseItems(updated);
                          }}
                          className="bg-zinc-900 border border-zinc-800 focus:border-brand-accent/50 rounded-xl text-white font-semibold text-xs px-3 py-2 outline-none w-36 uppercase placeholder:text-zinc-700"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Responsible selector */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-zinc-850">
                <Select 
                  label="Colaborador que Autoriza"
                  value={purchaseEmployeeId}
                  onChange={(e: any) => setPurchaseEmployeeId(e.target.value)}
                  options={selectOptionsEmployees}
                />
                
                <div className="flex flex-col justify-end">
                  <p className="text-[9px] text-zinc-500 font-semibold uppercase leading-normal">
                    💡 **Reposição Automática**: Quando concluída e abastecida, o assistente lança automaticamente as entradas (compras) de todos os itens selecionados, gerando registro correspondente para fins de auditoria interna.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4 border-t border-zinc-850 no-print">
                <Button 
                  variant="secondary" 
                  type="button" 
                  onClick={() => setIsPurchaseModalOpen(false)}
                >
                  Cancelar
                </Button>

                <button
                  type="button"
                  onClick={handleExportPurchaseOrderPDF}
                  className="px-5 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md animate-duration-300"
                >
                  <FileText size={14} className="text-brand-accent" />
                  Gerar PDF da Compra
                </button>

                <Button 
                  type="button"
                  loading={loadingPurchase}
                  onClick={handleLaunchPurchaseOrders}
                  className="bg-brand-accent text-zinc-950 font-black tracking-widest rounded-xl hover:bg-white active:scale-95 text-xs transition-all flex items-center justify-center gap-2"
                >
                  Confirmar & Lançar Entradas
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};
