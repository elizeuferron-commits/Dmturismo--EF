import React, { useState, useEffect } from 'react';
import { DollarSign, Calendar, Tag, FileText, Hash, Barcode, Scan, Building, Layers, Eye, Printer, Bus, Wrench, Package, MapPin, Users, User, CreditCard } from 'lucide-react';
import { Input, Select, Textarea } from './UI';
import { DocumentScanner } from './DocumentScanner';
import { BoletoModal } from './BoletoModal';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';

interface FinancialFormProps {
  type: 'payable' | 'receivable';
  onSubmit: (data: any) => void;
  isLoading?: boolean;
}

/**
 * Helper to add months to date string safely, keeping the closest calendar day.
 */
const addMonthsToDateStr = (dateStr: string, monthsToAdd: number): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return dateStr;
  const currentDay = date.getDate();
  date.setMonth(date.getMonth() + monthsToAdd);
  if (date.getDate() !== currentDay) {
    date.setDate(0); // Rollback to last day of previous month helper
  }
  return date.toISOString().split('T')[0];
};

/**
 * Helper to format barcode as Brazilian Banco Central standard (47 digits "linha digitável"):
 */
const formatBoletoBarcode = (value: string): string => {
  const nums = value.replace(/\D/g, '').slice(0, 47);
  
  const part1_1 = nums.slice(0, 5);
  const part1_2 = nums.slice(5, 10);
  const part2_1 = nums.slice(10, 15);
  const part2_2 = nums.slice(15, 21);
  const part3_1 = nums.slice(21, 26);
  const part3_2 = nums.slice(26, 32);
  const part4   = nums.slice(32, 33);
  const part5   = nums.slice(33, 47);

  let formatted = '';

  if (nums.length > 0) {
    formatted += part1_1;
  }
  if (nums.length > 5) {
    formatted += '.' + part1_2;
  }
  if (nums.length > 10) {
    formatted += ' ' + part2_1;
  }
  if (nums.length > 15) {
    formatted += '.' + part2_2;
  }
  if (nums.length > 21) {
    formatted += ' ' + part3_1;
  }
  if (nums.length > 26) {
    formatted += '.' + part3_2;
  }
  if (nums.length > 32) {
    formatted += ' ' + part4;
  }
  if (nums.length > 33) {
    formatted += ' ' + part5;
  }

  return formatted;
};

/**
 * FORMULÁRIO FINANCEIRO AVANÇADO (SOMBRA)
 * Suporta entrada/saída com foco em:
 * - Pacotes de Viagem (Entradas)
 * - Manutenção de Frota (Saídas)
 * - Estoque Industrial (Saídas)
 * Integrado com IA de leitura e scanner de documentos.
 */
export const FinancialForm: React.FC<FinancialFormProps> = ({ type, onSubmit, isLoading }) => {
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isBoletoOpen, setIsBoletoOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  
  // Estado para sub-tipo especializado
  // Para payable: 'general' | 'fleet_maintenance' | 'industrial_stock'
  // Para receivable: 'general' | 'travel_package'
  const [subType, setSubType] = useState<string>('general');

  // Estados para os campos controlados
  const [formData, setFormData] = useState({
    description: '',
    supplier: '',
    category: '',
    amount: '',
    dueDate: '',
    barcode: '',
    observations: '',
    
    // Campos de Pacote de Viagem (Entrada)
    packageName: '',
    destination: '',
    passengerCount: '',
    guideName: '',
    paymentMethod: 'pix',

    // Campos de Manutenção de Frota (Saída)
    vehicleId: '',
    maintenanceType: 'corrective',
    mechanicName: '',
    replacedParts: '',

    // Campos de Estoque Industrial (Saída)
    stockPartName: '',
    stockQuantity: '',
    stockUnitCost: '',
    stockLocation: ''
  });

  // Carregar veículos para o seletor da Frota de forma autônoma
  useEffect(() => {
    const unsubscribe = dbCacheService.subscribeCollection('vehicles', (list) => {
      // Sort by model or plate
      const sorted = [...list].sort((a, b) => (a.model || '').localeCompare(b.model || ''));
      setVehicles(sorted);
    });
    return () => unsubscribe();
  }, []);

  // Estados extras para o controle robusto de parcelas
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(3);
  const [showPreview, setShowPreview] = useState(true);
  
  const [installments, setInstallments] = useState<Array<{
    installmentNum: number;
    amount: string;
    dueDate: string;
  }>>([]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'barcode') {
      setFormData(prev => ({ ...prev, [name]: formatBoletoBarcode(value) }));
    } else {
      setFormData(prev => {
        const nextState = { ...prev, [name]: value };
        
        // Recalcular valor total se for estoque industrial
        if (subType === 'industrial_stock' && (name === 'stockQuantity' || name === 'stockUnitCost')) {
          const qty = parseFloat(nextState.stockQuantity || '0');
          const unitCost = parseFloat(nextState.stockUnitCost || '0');
          nextState.amount = (qty * unitCost).toFixed(2);
        }
        
        return nextState;
      });
    }
  };

  const handleInstallmentCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value || '1', 10);
    setInstallmentsCount(val);
  };

  // Gerar / recalcular as parcelas dinamicamente
  useEffect(() => {
    if (!isInstallment || !formData.amount) {
      setInstallments([]);
      return;
    }

    const count = Math.max(2, installmentsCount);
    const totalVal = parseFloat(formData.amount || '0');
    
    // Valor inicial dividido igualmente
    const baseInstallmentAmount = (totalVal / count).toFixed(2);
    
    // Distribuir dízimas com ajuste centesimal na última parcela
    const list = Array.from({ length: count }, (_, i) => {
      const instNum = i + 1;
      const computedDueDate = addMonthsToDateStr(formData.dueDate || new Date().toISOString().split('T')[0], i);
      
      let amt = baseInstallmentAmount;
      if (instNum === count) {
        const subTotalPrev = parseFloat(baseInstallmentAmount) * (count - 1);
        const difference = totalVal - subTotalPrev;
        amt = difference.toFixed(2);
      }

      return {
        installmentNum: instNum,
        amount: amt,
        dueDate: computedDueDate
      };
    });

    setInstallments(list);
  }, [isInstallment, formData.amount, formData.dueDate, installmentsCount, type]);

  const updateIndividualInstallmentAmount = (index: number, val: string) => {
    setInstallments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], amount: val };
      return updated;
    });
  };

  const updateIndividualInstallmentDueDate = (index: number, val: string) => {
    setInstallments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], dueDate: val };
      return updated;
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Enriquecer observações com metadados especializados
    let enrichedObservations = formData.observations;
    let categoryToUse = formData.category || (type === 'payable' ? 'Outros' : 'Outros');
    let descriptionToUse = formData.description;

    if (type === 'payable') {
      if (subType === 'fleet_maintenance') {
        const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
        const vehiclePlate = selectedVehicle ? selectedVehicle.plate : 'N/A';
        descriptionToUse = `MANUTENÇÃO DE FROTA - ${vehiclePlate.toUpperCase()}`;
        categoryToUse = 'Manutenção';
        enrichedObservations = `[VEÍCULO: ${vehiclePlate}] [TIPO: ${formData.maintenanceType.toUpperCase()}] [MECÂNICO: ${formData.mechanicName.toUpperCase()}] [PEÇAS: ${formData.replacedParts.toUpperCase()}] | ${enrichedObservations}`;
      } else if (subType === 'industrial_stock') {
        descriptionToUse = `ESTOQUE INDUSTRIAL - ${formData.stockPartName.toUpperCase()}`;
        categoryToUse = 'Peças / Estoque';
        enrichedObservations = `[MATERIAL: ${formData.stockPartName.toUpperCase()}] [QTD: ${formData.stockQuantity}] [CUSTO UNIT: R$ ${formData.stockUnitCost}] [SETOR: ${formData.stockLocation.toUpperCase()}] | ${enrichedObservations}`;
      }
    } else {
      if (subType === 'travel_package') {
        descriptionToUse = `PACOTE DE VIAGEM - ${formData.packageName.toUpperCase()}`;
        categoryToUse = 'Viagem / Frete';
        enrichedObservations = `[PACOTE: ${formData.packageName.toUpperCase()}] [DESTINO: ${formData.destination.toUpperCase()}] [PAX: ${formData.passengerCount}] [GUIA: ${formData.guideName.toUpperCase()}] [PAGAMENTO: ${formData.paymentMethod.toUpperCase()}] | ${enrichedObservations}`;
      }
    }

    const basePayload = {
      description: descriptionToUse.toUpperCase(),
      supplier: (formData.supplier || 'N/A').toUpperCase(),
      category: categoryToUse,
      refType: subType === 'fleet_maintenance' ? 'maintenance' : (subType === 'travel_package' ? 'trip' : 'other'),
      refId: subType === 'fleet_maintenance' ? formData.vehicleId : null,
      barcode: formData.barcode || '',
      observations: enrichedObservations,
      type,
      status: 'pending',
      
      // Armazenar campos originais para leitura fidedigna posterior
      specializedFields: {
        subType,
        packageName: formData.packageName,
        destination: formData.destination,
        passengerCount: formData.passengerCount ? parseInt(formData.passengerCount, 10) : 0,
        guideName: formData.guideName,
        paymentMethod: formData.paymentMethod,
        vehicleId: formData.vehicleId,
        maintenanceType: formData.maintenanceType,
        mechanicName: formData.mechanicName,
        replacedParts: formData.replacedParts,
        stockPartName: formData.stockPartName,
        stockQuantity: formData.stockQuantity ? parseFloat(formData.stockQuantity) : 0,
        stockUnitCost: formData.stockUnitCost ? parseFloat(formData.stockUnitCost) : 0,
        stockLocation: formData.stockLocation
      }
    };

    if (isInstallment && installments.length > 0) {
      const records = installments.map(inst => ({
        ...basePayload,
        description: `${basePayload.description} (${inst.installmentNum}/${installmentsCount})`,
        amount: parseFloat(inst.amount || '0'),
        dueDate: inst.dueDate,
        observations: `${basePayload.observations} | Parcela ${inst.installmentNum}/${installmentsCount}`
      }));
      onSubmit(records);
    } else {
      const data = {
        ...basePayload,
        amount: parseFloat(formData.amount || '0'),
        dueDate: formData.dueDate
      };
      onSubmit(data);
    }
  };

  const handleScanComplete = (scannedData: any) => {
    // Detectar dinamicamente o sub-tipo com base nas palavras chaves detectadas pela IA
    const descLower = (scannedData.description || '').toLowerCase();
    const obsLower = (scannedData.observations || '').toLowerCase();
    
    let detectedSubType = 'general';
    if (type === 'payable') {
      if (descLower.includes('manutenção') || descLower.includes('oficina') || descLower.includes('peças') || descLower.includes('mecânica') || scannedData.vehiclePlate) {
        detectedSubType = 'fleet_maintenance';
      } else if (descLower.includes('insumo') || descLower.includes('estoque') || descLower.includes('material') || descLower.includes('industrial')) {
        detectedSubType = 'industrial_stock';
      }
    } else {
      if (descLower.includes('pacote') || descLower.includes('turismo') || descLower.includes('excursão') || descLower.includes('viagem')) {
        detectedSubType = 'travel_package';
      }
    }

    setSubType(detectedSubType);

    // Cruzar dados escaneados pela IA nos campos especializados correspondentes
    setFormData(prev => {
      const next = {
        ...prev,
        description: scannedData.description || prev.description,
        supplier: scannedData.supplier || prev.supplier,
        amount: scannedData.amount?.toString() || prev.amount,
        dueDate: scannedData.dueDate || prev.dueDate,
        barcode: scannedData.barcode ? formatBoletoBarcode(scannedData.barcode) : prev.barcode,
        
        // Se a IA extraiu campos dedicados
        packageName: scannedData.packageName || prev.packageName || scannedData.description || '',
        destination: scannedData.destination || prev.destination || '',
        passengerCount: scannedData.passengerCount?.toString() || prev.passengerCount || '',
        guideName: scannedData.guideName || prev.guideName || '',
        
        // Se a IA extraiu manutenção
        mechanicName: scannedData.mechanicName || scannedData.supplier || prev.mechanicName,
        replacedParts: scannedData.replacedParts || prev.replacedParts,
        
        // Se a IA extraiu estoque
        stockPartName: scannedData.stockPartName || scannedData.description || prev.stockPartName,
        stockQuantity: scannedData.itemQuantity?.toString() || prev.stockQuantity || '1',
        stockUnitCost: scannedData.itemUnitCost?.toString() || scannedData.amount?.toString() || prev.stockUnitCost || ''
      };

      // Tentar associar veículo pela placa se retornado pela IA
      if (scannedData.vehiclePlate) {
        const plateClean = scannedData.vehiclePlate.replace(/\s|-/g, '').toUpperCase();
        const matchedVehicle = vehicles.find(v => v.plate.replace(/\s|-/g, '').toUpperCase() === plateClean);
        if (matchedVehicle) {
          next.vehicleId = matchedVehicle.id;
        }
      }

      // Recalcular valor de estoque se aplicável
      if (detectedSubType === 'industrial_stock') {
        const qty = parseFloat(next.stockQuantity || '0');
        const unitCost = parseFloat(next.stockUnitCost || '0');
        next.amount = (qty * unitCost).toFixed(2);
      }

      return next;
    });

    setIsScannerOpen(false);
  };

  const categories = type === 'payable' ? [
    { value: 'Manutenção', label: 'Manutenção' },
    { value: 'Combustível', label: 'Combustível' },
    { value: 'Peças / Estoque', label: 'Peças / Estoque' },
    { value: 'Salários / Encargos', label: 'Salários / Encargos' },
    { value: 'Impostos / Taxas', label: 'Impostos / Taxas' },
    { value: 'Seguro', label: 'Seguro' },
    { value: 'Administrativo', label: 'Administrativo' },
    { value: 'Outros', label: 'Outros' },
  ] : [
    { value: 'Viagem / Frete', label: 'Viagem / Frete' },
    { value: 'Serviço Agregado', label: 'Serviço Agregado' },
    { value: 'Reembolso', label: 'Reembolso' },
    { value: 'Venda de Ativos', label: 'Venda de Ativos' },
    { value: 'Outros', label: 'Outros' },
  ];

  const boletosData = installments.map(inst => ({
    description: formData.description || 'CONTRATO DE TURISMO',
    amount: parseFloat(inst.amount || '0'),
    dueDate: inst.dueDate,
    installmentNum: inst.installmentNum,
    totalInstallments: installmentsCount,
    supplier: formData.supplier || 'CLIENTE COBRADO'
  }));

  return (
    <div className="relative">
      <div className="mb-6 flex flex-col gap-4">
        {/* Scanner Inteligente de IA */}
        <button
          type="button"
          onClick={() => setIsScannerOpen(true)}
          className="w-full py-4 bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 rounded-2xl flex items-center justify-center gap-3 text-brand-accent font-black transition-all active:scale-[0.98] group shadow-md"
        >
          <Scan size={20} className="group-hover:scale-110 transition-transform stroke-[2.5]" />
          <span className="uppercase text-xs tracking-widest">Leitura por IA (Foto / Nota / Boleto)</span>
        </button>

        {/* Seleção do Sub-tipo Focado */}
        <div className="flex bg-zinc-950 p-1.5 rounded-2xl border border-zinc-800">
          <button
            type="button"
            onClick={() => { setSubType('general'); setFormData(prev => ({ ...prev, category: '' })); }}
            className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer ${
              subType === 'general' ? 'bg-brand-accent text-zinc-950 shadow-lg' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Lançamento Comum
          </button>
          
          {type === 'payable' ? (
            <>
              <button
                type="button"
                onClick={() => { setSubType('fleet_maintenance'); setFormData(prev => ({ ...prev, category: 'Manutenção' })); }}
                className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  subType === 'fleet_maintenance' ? 'bg-[#ff6b00] text-white shadow-lg animate-in fade-in duration-200' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Wrench size={12} />
                Manut. Frota
              </button>
              <button
                type="button"
                onClick={() => { setSubType('industrial_stock'); setFormData(prev => ({ ...prev, category: 'Peças / Estoque' })); }}
                className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  subType === 'industrial_stock' ? 'bg-[#ff6b00] text-white shadow-lg animate-in fade-in duration-200' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <Package size={12} />
                Estoque Ind.
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => { setSubType('travel_package'); setFormData(prev => ({ ...prev, category: 'Viagem / Frete' })); }}
              className={`flex-1 py-3 text-center text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                subType === 'travel_package' ? 'bg-emerald-500 text-zinc-950 shadow-lg animate-in fade-in duration-200' : 'text-zinc-400 hover:text-white'
              }`}
            >
              <Bus size={12} />
              Pacote Viagem
            </button>
          )}
        </div>
      </div>

      {isScannerOpen && (
        <DocumentScanner 
          onScanComplete={handleScanComplete} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* CAMPOS BASE COMUNS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {subType === 'general' && (
            <Input 
              id="fin-description"
              label="Descrição do Lançamento" 
              name="description" 
              value={formData.description}
              onChange={handleChange}
              placeholder={type === 'payable' ? "Ex: Conta de Energia" : "Ex: Recebimento Evento"} 
              required 
              icon={FileText} 
            />
          )}

          <Input 
            id="fin-supplier"
            label={type === 'payable' ? "Fornecedor / Emissor" : "Cliente / Pagador"} 
            name="supplier" 
            value={formData.supplier}
            onChange={handleChange}
            placeholder={type === 'payable' ? "Ex: Auto Posto BR" : "Ex: Maria de Souza"} 
            icon={Building} 
          />

          {subType === 'general' && (
            <Select 
              id="fin-category"
              label="Categoria Financeira" 
              name="category" 
              value={formData.category}
              onChange={handleChange}
              required 
              options={categories} 
              icon={Tag} 
            />
          )}

          <Input 
            id="fin-amount"
            label={subType === 'industrial_stock' ? "Valor Calculado/Total (R$)" : "Valor Total (R$)"} 
            name="amount" 
            type="number" 
            step="0.01" 
            value={formData.amount}
            onChange={handleChange}
            placeholder="0,00" 
            required 
            className={subType === 'industrial_stock' ? 'bg-zinc-900/50 font-mono text-brand-accent' : ''}
            icon={Hash} 
          />

          {!isInstallment && (
            <Input 
              id="fin-duedate"
              label="Data de Vencimento" 
              name="dueDate" 
              type="date" 
              value={formData.dueDate}
              onChange={handleChange}
              required 
              icon={Calendar} 
            />
          )}

          {type === 'payable' && !isInstallment && (
            <Input 
              id="fin-barcode"
              label="Código de Barras (Linha Digitável)" 
              name="barcode" 
              value={formData.barcode}
              onChange={handleChange}
              placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              maxLength={54}
              icon={Barcode} 
            />
          )}
        </div>

        {/* SEÇÃO FOCADA: PACOTE DE VIAGEM */}
        {type === 'receivable' && subType === 'travel_package' && (
          <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-3xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
              <Bus size={14} /> Detalhes do Pacote de Viagem
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                id="fin-packageName"
                label="Nome do Pacote" 
                name="packageName" 
                value={formData.packageName}
                onChange={handleChange}
                placeholder="Ex: Cabo Frio Julho/2026" 
                required 
                icon={FileText} 
              />
              <Input 
                id="fin-destination"
                label="Destino Turístico" 
                name="destination" 
                value={formData.destination}
                onChange={handleChange}
                placeholder="Ex: Cabo Frio - RJ" 
                required 
                icon={MapPin} 
              />
              <Input 
                id="fin-passengerCount"
                label="Quantidade de Passageiros" 
                name="passengerCount" 
                type="number"
                value={formData.passengerCount}
                onChange={handleChange}
                placeholder="Ex: 44" 
                icon={Users} 
              />
              <Input 
                id="fin-guideName"
                label="Guia de Turismo / Responsável" 
                name="guideName" 
                value={formData.guideName}
                onChange={handleChange}
                placeholder="Ex: Anderson Santos" 
                icon={User} 
              />
              <Select
                id="fin-paymentMethod"
                label="Forma de Recebimento"
                name="paymentMethod"
                value={formData.paymentMethod}
                onChange={handleChange}
                options={[
                  { value: 'pix', label: 'PIX Instantâneo' },
                  { value: 'boleto', label: 'Boleto Bancário' },
                  { value: 'credit_card', label: 'Cartão de Crédito' },
                  { value: 'cash', label: 'Dinheiro / Depósito' }
                ]}
                icon={CreditCard}
              />
            </div>
          </div>
        )}

        {/* SEÇÃO FOCADA: MANUTENÇÃO DE FROTA */}
        {type === 'payable' && subType === 'fleet_maintenance' && (
          <div className="bg-[#ff6b00]/5 border border-[#ff6b00]/10 rounded-3xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-black text-[#ff6b00] uppercase tracking-widest flex items-center gap-2">
              <Wrench size={14} /> Detalhes de Manutenção de Frota
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Select
                id="fin-vehicleId"
                label="Veículo da Frota"
                name="vehicleId"
                value={formData.vehicleId}
                onChange={handleChange}
                required
                options={[
                  { value: '', label: 'Selecione o Veículo...' },
                  ...vehicles.map(v => ({ value: v.id, label: `${v.model.toUpperCase()} (PLACA: ${v.plate})` }))
                ]}
                icon={Bus}
              />
              <Select
                id="fin-maintenanceType"
                label="Tipo de Serviço"
                name="maintenanceType"
                value={formData.maintenanceType}
                onChange={handleChange}
                options={[
                  { value: 'corrective', label: 'Corretiva Urgente' },
                  { value: 'preventive', label: 'Preventiva de Rotina' },
                  { value: 'tires', label: 'Rodagem / Pneus' },
                  { value: 'oil', label: 'Filtros / Lubrificação' }
                ]}
                icon={Wrench}
              />
              <Input 
                id="fin-mechanicName"
                label="Oficina / Mecânico Executor" 
                name="mechanicName" 
                value={formData.mechanicName}
                onChange={handleChange}
                placeholder="Ex: Mecânica Diesel Silva" 
                required 
                icon={Building} 
              />
              <Input 
                id="fin-replacedParts"
                label="Peças / Componentes Substituídos" 
                name="replacedParts" 
                value={formData.replacedParts}
                onChange={handleChange}
                placeholder="Ex: Lonas de freio traseiras e tambor" 
                icon={FileText} 
              />
            </div>
          </div>
        )}

        {/* SEÇÃO FOCADA: ESTOQUE INDUSTRIAL */}
        {type === 'payable' && subType === 'industrial_stock' && (
          <div className="bg-[#ff6b00]/5 border border-[#ff6b00]/10 rounded-3xl p-6 space-y-6 animate-in slide-in-from-top-4 duration-300">
            <h4 className="text-xs font-black text-[#ff6b00] uppercase tracking-widest flex items-center gap-2">
              <Package size={14} /> Cadastro de Compra de Estoque Industrial
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Input 
                id="fin-stockPartName"
                label="Material / Peça Adquirida" 
                name="stockPartName" 
                value={formData.stockPartName}
                onChange={handleChange}
                placeholder="Ex: Filtro de Combustível Ônibus G7" 
                required 
                icon={Package} 
              />
              <Input 
                id="fin-stockQuantity"
                label="Quantidade Adquirida" 
                name="stockQuantity" 
                type="number"
                step="1"
                value={formData.stockQuantity}
                onChange={handleChange}
                placeholder="Ex: 10" 
                required 
                icon={Hash} 
              />
              <Input 
                id="fin-stockUnitCost"
                label="Custo Unitário (R$)" 
                name="stockUnitCost" 
                type="number"
                step="0.01"
                value={formData.stockUnitCost}
                onChange={handleChange}
                placeholder="Ex: 85.00" 
                required 
                icon={DollarSign} 
              />
              <Input 
                id="fin-stockLocation"
                label="Prateleira / Localizador de Estoque" 
                name="stockLocation" 
                value={formData.stockLocation}
                onChange={handleChange}
                placeholder="Ex: Almoxarifado Central - Prateleira B" 
                icon={MapPin} 
              />
            </div>
          </div>
        )}

        {/* MÓDULO DE PARCELAMENTO */}
        <div className="bg-zinc-950/40 border border-zinc-800 rounded-3xl p-6 space-y-6 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent">
                <Layers size={18} />
              </div>
              <div>
                <h4 className="text-xs font-black text-white uppercase tracking-wider">Lançamento Parcelado</h4>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                  Dividir total em parcelas mensais recorrentes
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={isInstallment}
                onChange={(e) => setIsInstallment(e.target.checked)}
                className="sr-only peer" 
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-accent peer-checked:after:bg-zinc-950"></div>
            </label>
          </div>

          {isInstallment && (
            <div className="space-y-6 pt-3 border-t border-zinc-800/60">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input 
                  id="fin-installmentsCount"
                  label="Quantidade de Parcelas" 
                  name="installmentsCount"
                  type="number"
                  min="2"
                  max="72"
                  value={installmentsCount.toString()}
                  onChange={handleInstallmentCountChange}
                  required
                  icon={Layers}
                />

                <Input 
                  id="fin-firstDueDate"
                  label="Vencimento 1ª Parcela (Referência)" 
                  name="dueDate" 
                  type="date" 
                  value={formData.dueDate}
                  onChange={handleChange}
                  required 
                  icon={Calendar} 
                />
              </div>

              {formData.dueDate && formData.amount && showPreview && (
                <div className="space-y-4 animate-in slide-in-from-top-4 duration-300">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Cronograma de Parcelas</span>
                    
                    <div className="flex items-center gap-3">
                      {type === 'receivable' && (
                        <button
                          type="button"
                          onClick={() => setIsBoletoOpen(true)}
                          className="px-3 py-1 bg-brand-accent/25 hover:bg-brand-accent/35 text-brand-accent rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                        >
                          <Printer size={11} strokeWidth={2.5} />
                          Gerar Carnê
                        </button>
                      )}
                      <span className="text-[9px] font-bold text-brand-accent bg-brand-accent/5 px-2 py-0.5 rounded-md uppercase">
                        Soma: R$ {installments.reduce((sum, inst) => sum + parseFloat(inst.amount || '0'), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {installments.map((inst, index) => (
                      <div 
                        key={inst.installmentNum} 
                        className="bg-zinc-900 border border-zinc-850 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 bg-zinc-950 rounded-lg text-xs font-black text-brand-accent flex items-center justify-center border border-zinc-800">
                            {inst.installmentNum}x
                          </span>
                          <div>
                            <p className="text-[10px] font-black uppercase text-white tracking-widest">Parcela {inst.installmentNum} de {installmentsCount}</p>
                            <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-tight">
                              {type === 'payable' ? 'Conta a pagar' : 'Conta a receber'}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 items-center sm:w-2/3">
                          <div className="w-full">
                            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest pl-1">Valor Parcela (R$)</label>
                            <input 
                              type="number" 
                              step="0.01"
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs font-bold font-mono focus:outline-none focus:border-brand-accent/50"
                              value={inst.amount}
                              onChange={(e) => updateIndividualInstallmentAmount(index, e.target.value)}
                            />
                          </div>

                          <div className="w-full">
                            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest pl-1">Vencimento Parcela</label>
                            <input 
                              type="date" 
                              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-2 px-3 text-white text-xs font-bold focus:outline-none focus:border-brand-accent/50"
                              value={inst.dueDate}
                              onChange={(e) => updateIndividualInstallmentDueDate(index, e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <Textarea 
          id="fin-observations"
          label="Observações Adicionais" 
          name="observations" 
          value={formData.observations}
          onChange={handleChange}
          placeholder="Anote detalhes administrativos, links ou justificativas sobre o lançamento..." 
        />

        <button
          id="fin-submit-btn"
          type="submit"
          disabled={isLoading}
          className="w-full py-5 bg-brand-accent text-zinc-950 rounded-2xl font-black shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase tracking-widest text-xs cursor-pointer"
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <DollarSign size={18} strokeWidth={3} />
              {isInstallment ? `Confirmar Lançamentos (${installmentsCount} Parcelas)` : 'Confirmar Lançamento'}
            </>
          )}
        </button>
      </form>

      {/* Carnê de Boletos Modal */}
      {type === 'receivable' && (
        <BoletoModal 
          isOpen={isBoletoOpen} 
          onClose={() => setIsBoletoOpen(false)} 
          boletos={boletosData} 
          title={`CARNÊ DE COBRANÇA — ${formData.packageName.toUpperCase() || 'RECEBIMENTOS'}`}
        />
      )}
    </div>
  );
};
