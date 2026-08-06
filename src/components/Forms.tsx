import React, { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { PhotoGallery } from './PhotoGallery';
import { 
  Bus, 
  Calendar, 
  Hash, 
  Save, 
  Loader2,
  Users,
  Fuel,
  Phone,
  Briefcase,
  MapPin,
  Wrench,
  DollarSign,
  Share2,
  Camera,
  X,
  Lock,
  Clock,
  FileSpreadsheet,
  Globe,
  Upload,
  Plus,
  Trash2,
  Sparkles,
  Bot,
  FileText,
  Package
} from 'lucide-react';
import { Input, Select, Button } from './UI';
import { cn } from '../lib/utils';
import { WorkSchedule } from '../types';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, doc, runTransaction, orderBy, limit } from 'firebase/firestore';

export const VehicleForm = ({ onSubmit, initialData, isGabinete }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
  <form onSubmit={handleSubmit} className="space-y-4">
    <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2">
        <Bus size={14} className="text-brand-accent" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Informações Básicas do Ativo</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Input label="Placa" placeholder="ABC-1234" icon={Hash} required name="plate" defaultValue={initialData?.plate} />
        <div>
          <Input 
            label="Número de Frota (Prefixo)" 
            placeholder="Ex: 1001" 
            icon={Hash} 
            name="prefix" 
            defaultValue={initialData?.prefix} 
          />
        </div>
        <Select 
          label="Tipo de Veículo" 
          icon={Bus} 
          name="type"
          defaultValue={initialData?.type || 'bus'}
          options={[
            { value: 'bus', label: 'Ônibus (Turismo / Fretamento)' },
            { value: 'microbus', label: 'Micro-ônibus (Executivo)' },
            { value: 'van', label: 'Van (Executiva / Passageiros)' },
            { value: 'car', label: 'Carro (Passeio / Apoio)' },
            { value: 'motorcycle', label: 'Moto (Operacional / Apoio)' }
          ]} 
        />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Input label="Modelo/Marca" placeholder="Ex: Mercedes-Benz Paradiso 1200" icon={Bus} required name="model" defaultValue={initialData?.model} />
        <Input label="Ano de Fabricação" placeholder="2023" icon={Calendar} required name="factoryYear" defaultValue={initialData?.factoryYear} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Input label="Número de Passageiros (Capacidade PAX)" type="number" placeholder="46" icon={Users} required name="capacity" defaultValue={initialData?.capacity} />
        <Input label="Odômetro / KM Atual" type="number" placeholder="50.000" icon={Hash} required name="currentOdometer" defaultValue={initialData?.currentOdometer} />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <Input label="RENAVAM" placeholder="12345678901" icon={Hash} name="renavam" defaultValue={initialData?.renavam} />
        <Input label="Chassi" placeholder="9BM384232..." icon={Hash} name="chassi" defaultValue={initialData?.chassi} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Motorista Responsável (Nome)" placeholder="Ex: João Silva" icon={Users} name="responsibleDriverName" defaultValue={initialData?.responsibleDriverName} />
      </div>
    </div>

    {/* VENCIMENTOS DETRAN */}
    <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2">
        <FileSpreadsheet size={14} className="text-brand-accent" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Vencimentos DETRAN</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input label="Seguro Obrigatório (SPVAT / DPVAT)" type="date" icon={Calendar} name="spvatExpiration" defaultValue={initialData?.spvatExpiration} />
        <Input label="Licenciamento (CRLV)" type="date" icon={Calendar} required name="licenseExpiration" defaultValue={initialData?.licenseExpiration} />
        <Input label="Alvará / Licença Municipal" type="date" icon={Calendar} name="municipalLicenseExpiration" defaultValue={initialData?.municipalLicenseExpiration} />
      </div>
    </div>

    {/* VENCIMENTOS DOCUMENTOS */}
    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 border-b border-emerald-500/10 pb-2 mb-2">
        <Globe size={14} className="text-emerald-500" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Vencimentos Documentos & Órgãos Reguladores</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Input label="CADASTUR (Nacional)" type="date" icon={Calendar} name="cadasturExpiration" defaultValue={initialData?.cadasturExpiration} />
        <Input label="ANTT (Interestadual)" type="date" icon={Calendar} name="anttExpiration" defaultValue={initialData?.anttExpiration} />
        <Input label="Licença MERCOSUL (Internacional)" type="date" icon={Calendar} name="mercosulLicenseExpiration" defaultValue={initialData?.mercosulLicenseExpiration} />
        <Input label="SIE / DETRO / ARTESP (Estadual)" type="date" icon={Calendar} name="sieExpiration" defaultValue={initialData?.sieExpiration || initialData?.detroArtespExpiration} />
        <Input label="Cronotacógrafo (INMETRO)" type="date" icon={Calendar} name="tacografoExpiration" defaultValue={initialData?.tacografoExpiration} />
        <Input label="Seguro Pessoas (Seguro APP Passageiros)" type="date" icon={Calendar} required name="insuranceExpiration" defaultValue={initialData?.insuranceExpiration} />
      </div>
    </div>
    
    {/* VENCIMENTOS MANUTENÇÃO */}
    <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-4">
      <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2">
        <Wrench size={14} className="text-amber-500" />
        <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Vencimentos de Manutenção</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Próxima Troca de Óleo / Filtros (KM)" type="number" placeholder="60.000" icon={Hash} name="nextOilChangeKM" defaultValue={initialData?.nextOilChangeKM} />
        <Input label="Próximo Rodízio de Pneus (KM)" type="number" placeholder="80.000" icon={Hash} name="nextTireRotationKM" defaultValue={initialData?.nextTireRotationKM} />
      </div>
      <div className="pt-3 border-t border-zinc-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-center justify-center text-yellow-500 shrink-0">
            <Wrench size={16} />
          </div>
          <div>
            <span className="text-xs font-black text-white block uppercase tracking-tight">Sinalizar Prioridade de Inspeção (Destaque)</span>
            <span className="text-[9px] text-zinc-500 font-bold block uppercase mt-0.5">Ativa borda dourada pulsante no veículo</span>
          </div>
        </div>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input 
            type="checkbox" 
            name="featured"
            defaultChecked={initialData?.featured}
            value="on"
            className="sr-only peer" 
          />
          <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500 peer-checked:after:bg-zinc-950"></div>
        </label>
      </div>
    </div>
    
    {initialData?.id && (
      <div className="pt-6 border-t border-white/5">
        <PhotoGallery collectionName="vehicles" documentId={initialData.id} />
      </div>
    )}
    
    <div className="pt-4">
      <Button loading={loading}>
        <Save size={20} />
        {initialData ? 'Atualizar Ativo' : 'Registrar Veículo'}
      </Button>
    </div>
  </form>
  )
};

export const FuelForm = ({ onSubmit, vehicles, tanks, employees, isExternal = false, initialVehicleId }: any) => {
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [scanMode, setScanMode] = useState<'single' | 'batch'>('single');
  const [batchEntries, setBatchEntries] = useState<any[]>([]);

  const [selectedVehicleId, setSelectedVehicleId] = useState(initialVehicleId || '');
  const [typedOdometer, setTypedOdometer] = useState<string>('');

  React.useEffect(() => {
    if (initialVehicleId) {
      setSelectedVehicleId(initialVehicleId);
    }
  }, [initialVehicleId]);

  const saveBatchFuelEntry = async (entry: any) => {
    const {
      vehicleId,
      driverId,
      fuelTankId,
      arlaTankId,
      isExternal: isEntryExternal,
      location,
      quantity,
      arlaQuantity,
      odometer,
      cost,
      timestamp,
      pricePerLiter
    } = entry;

    let finalCost = Number(cost || 0);
    if (finalCost === 0) {
      if (isEntryExternal && pricePerLiter > 0 && quantity > 0) {
        finalCost = Number((pricePerLiter * quantity).toFixed(2));
      } else if (quantity > 0) {
        finalCost = Number((quantity * 5.90).toFixed(2));
      }
    }

    await runTransaction(db, async (transaction) => {
      // 1. Get vehicle reference
      const vehicleRef = doc(db, 'vehicles', vehicleId);
      const vehicleSnapshot = await transaction.get(vehicleRef);
      if (!vehicleSnapshot.exists()) throw new Error(`Veículo não encontrado para o ID: ${vehicleId}`);
      const vehicle = vehicleSnapshot.data();

      // 2. Get tank reference (only if internal AND quantity > 0)
      let tankSnapshot = null;
      let tankRef = null;
      if (!isEntryExternal && quantity > 0 && fuelTankId) {
        tankRef = doc(db, 'fuel_tanks', fuelTankId);
        tankSnapshot = await transaction.get(tankRef);
        if (!tankSnapshot.exists()) throw new Error(`Tanque não encontrado para o ID: ${fuelTankId}`);
        const tank = tankSnapshot.data();

        if (tank.currentLevel < quantity) {
          throw new Error(`Saldo insuficiente no tanque ${tank.name} (${tank.currentLevel}L disponível, necessita de ${quantity}L)`);
        }
      }

      // 2.1 Arla Tank
      let arlaTankSnapshot = null;
      let arlaTankRef = null;
      if (!isEntryExternal && (arlaQuantity || 0) > 0 && arlaTankId) {
        arlaTankRef = doc(db, 'fuel_tanks', arlaTankId);
        arlaTankSnapshot = await transaction.get(arlaTankRef);
        if (!arlaTankSnapshot.exists()) throw new Error(`Tanque Arla não encontrado para o ID: ${arlaTankId}`);
        const tank = arlaTankSnapshot.data();

        if (tank.currentLevel < arlaQuantity) {
          throw new Error(`Saldo insuficiente no tanque Arla ${tank.name} (${tank.currentLevel}L disponível, necessita de ${arlaQuantity}L)`);
        }
      }

      // 3. Register Fuel Log
      const logRef = doc(collection(db, 'fuel_logs'));
      transaction.set(logRef, {
        vehicleId,
        driverId,
        fuelTankId: isEntryExternal ? '' : (fuelTankId || ''),
        isExternal: isEntryExternal || false,
        location: location || (isEntryExternal ? '' : 'Interno'),
        quantity: Math.floor(Number(quantity || 0)),
        arlaQuantity: Math.floor(Number(arlaQuantity || 0)),
        arlaTankId: isEntryExternal ? '' : (arlaTankId || ''),
        odometer: Number(odometer || 0),
        cost: finalCost,
        timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString()
      });

      // 4. Update Tank Level (only if internal and quantity > 0)
      if (!isEntryExternal && quantity > 0 && tankSnapshot && tankRef) {
        const tank = tankSnapshot.data();
        transaction.update(tankRef, {
          currentLevel: Math.floor(tank.currentLevel - quantity),
          updatedAt: new Date().toISOString()
        });
      }

      // 4.1 Update Arla Tank Level
      if (!isEntryExternal && (arlaQuantity || 0) > 0 && arlaTankSnapshot && arlaTankRef) {
        const tank = arlaTankSnapshot.data();
        transaction.update(arlaTankRef, {
          currentLevel: Math.floor(tank.currentLevel - arlaQuantity),
          updatedAt: new Date().toISOString()
        });
      }

      // 5. Update Vehicle Odometer (ONLY IF HIGHER)
      const vehicleUpdates: any = {
         lastFuel: {
           timestamp: timestamp ? new Date(timestamp).toISOString() : new Date().toISOString(),
           quantity: Math.floor(Number(quantity || 0)),
           cost: finalCost
         },
         updatedAt: new Date().toISOString()
      };
      
      if (odometer > (vehicle.currentOdometer || 0)) {
         vehicleUpdates.currentOdometer = odometer;
      }
      transaction.update(vehicleRef, vehicleUpdates);

      // 6. Generate corresponding paid Financial Transaction (Despesa / Conta a pagar)
      const finRef = doc(collection(db, 'financial_transactions'));
      const vehiclePlate = vehicle.plate || 'S/D';
      transaction.set(finRef, {
        type: 'payable',
        category: 'Combustível',
        description: `Abastecimento - Placa ${vehiclePlate} (${quantity}L Diesel${arlaQuantity ? ` / ${arlaQuantity}L Arla` : ''} ${isEntryExternal ? 'Externo' : 'Interno'})`,
        amount: finalCost,
        dueDate: (timestamp || new Date().toISOString()).slice(0, 10),
        paymentDate: (timestamp || new Date().toISOString()).slice(0, 10),
        status: 'paid',
        refId: logRef.id,
        refType: 'fuel',
        observations: location || (isEntryExternal ? 'Abastecimento Externo' : 'Abastecimento Interno'),
        createdAt: new Date().toISOString()
      });
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };

  const handleScanClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const toastId = toast.loading(scanMode === 'batch' ? "Analisando ficha de abastecimento em lote com IA..." : "Analisando cupom/recibo com IA...");

    try {
      // 1. Convert to Base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const base64String = reader.result?.toString().split(',')[1];
          if (base64String) resolve(base64String);
          else reject(new Error("Erro ao codificar imagem"));
        };
        reader.onerror = (err) => reject(err);
      });
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      if (scanMode === 'batch') {
        const response = await fetch("/api/fuel/scan-batch-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data,
            mimeType: file.type
          })
        });

        if (!response.ok) {
          throw new Error("Erro na análise em lote do servidor");
        }

        const result = await response.json();
        
        if (result && result.entries && Array.isArray(result.entries)) {
          const parsedEntries = await Promise.all(result.entries.map(async (entry: any) => {
            // Find matching vehicle
            let matchedVehicleId = 'outros';
            if (entry.placa) {
              const cleanedPlaca = entry.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              const matched = (vehicles || []).find((v: any) => {
                const vCleaned = v.plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
                return vCleaned.includes(cleanedPlaca) || cleanedPlaca.includes(vCleaned);
              });
              if (matched) matchedVehicleId = matched.id;
            }

            // Persistence logic for "-"
            let finalOdometer = entry.odometro;
            let finalQuantity = entry.volumeDiesel;
            let finalArlaQuantity = entry.volumeArla;
            let finalDriverId = '';
            
            // If any critical field is "-" or missing, we check for the last known log
            if (matchedVehicleId !== 'outros' && (finalOdometer === '-' || finalQuantity === '-' || finalArlaQuantity === '-' || !entry.motorista)) {
              const lastLogQuery = query(
                collection(db, 'fuel_logs'),
                where('vehicleId', '==', matchedVehicleId),
                orderBy('timestamp', 'desc'),
                limit(1)
              );
              const lastLogSnap = await getDocs(lastLogQuery);
              if (!lastLogSnap.empty) {
                const lastLog = lastLogSnap.docs[0].data();
                if (finalOdometer === '-') finalOdometer = lastLog.odometer;
                if (finalQuantity === '-') finalQuantity = lastLog.quantity;
                if (finalArlaQuantity === '-') finalArlaQuantity = lastLog.arlaQuantity || 0;
                if (!entry.motorista) finalDriverId = lastLog.driverId;
              }
            }

            // Find matching driver if not found by persistence
            if (!finalDriverId) {
              if (entry.motorista) {
                const cleanedDriver = entry.motorista.toLowerCase();
                const matched = (employees || []).find((e: any) => {
                  const eName = e.name.toLowerCase();
                  return eName.includes(cleanedDriver) || cleanedDriver.includes(eName);
                });
                if (matched) finalDriverId = matched.id;
              } else if (employees && employees.length > 0) {
                finalDriverId = employees[0].id;
              }
            }

            // Default Tanks
            let defaultTankId = '';
            const dieselTanks = (tanks || []).filter((t: any) => t.fuelType?.toLowerCase().includes('diesel') || t.name?.toLowerCase().includes('diesel') || t.fuelType === 'S10' || t.fuelType === 'S500');
            if (dieselTanks.length > 0) {
              defaultTankId = dieselTanks[0].id;
            } else if (tanks && tanks.length > 0) {
              defaultTankId = tanks[0].id;
            }

            let defaultArlaTankId = '';
            const arlaTanks = (tanks || []).filter((t: any) => t.fuelType === 'Arla 32' || t.name.toLowerCase().includes('arla'));
            if (arlaTanks.length > 0) {
              defaultArlaTankId = arlaTanks[0].id;
            }

            return {
              id: Math.random().toString(36).substring(2, 9),
              vehicleId: matchedVehicleId,
              driverId: finalDriverId,
              quantity: Math.floor(Number(finalQuantity || 0)),
              arlaQuantity: Math.floor(Number(finalArlaQuantity || 0)),
              odometer: Number(finalOdometer || 0),
              cost: Number(entry.custo || 0),
              pricePerLiter: 5.90,
              fuelTankId: defaultTankId,
              arlaTankId: defaultArlaTankId,
              isExternal: false,
              location: entry.observacao || 'Interno',
              timestamp: new Date().toISOString().slice(0, 16)
            };
          }));

          setBatchEntries((prev: any[]) => [...prev, ...parsedEntries]);
          toast.success(`Ficha processada! Encontrados ${parsedEntries.length} lançamentos.`, { id: toastId });
        } else {
          toast.success("Ficha processada, mas nenhum lançamento estruturado foi detectado.", { id: toastId });
        }
      } else {
        // Single scan logic
        const response = await fetch("/api/fuel/scan-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64Data,
            mimeType: file.type
          })
        });

        if (!response.ok) {
          throw new Error("Erro na análise do servidor");
        }

        const result = await response.json();
        const form = formRef.current;
        if (form && result) {
          let filledFields: string[] = [];

          if (result.odometro) {
            const odoInput = form.querySelector('input[name="odometer"]') as HTMLInputElement;
            if (odoInput) {
              odoInput.value = String(result.odometro);
              setTypedOdometer(String(result.odometro));
              filledFields.push("Odômetro");
            }
          }

          if (result.volume) {
            if (result.combustivel === 'arla') {
              const arlaQtyInput = form.querySelector('input[name="arlaQuantity"]') as HTMLInputElement;
              if (arlaQtyInput) {
                arlaQtyInput.value = String(Math.floor(Number(result.volume || 0)));
                filledFields.push("Qtd Arla");
              }
              const arlaTankSelect = form.querySelector('select[name="arlaTankId"]') as HTMLSelectElement;
              if (arlaTankSelect && tanks) {
                const defaultArlaTank = tanks.find((t: any) => t.fuelType === 'Arla 32' || t.name.toLowerCase().includes('arla'));
                if (defaultArlaTank) {
                  arlaTankSelect.value = defaultArlaTank.id;
                  filledFields.push("Tanque Arla");
                }
              }
            } else {
              const qtyInput = form.querySelector('input[name="quantity"]') as HTMLInputElement;
              if (qtyInput) {
                qtyInput.value = String(Math.floor(Number(result.volume || 0)));
                filledFields.push("Litragem");
              }
            }
          }

          if (result.placa) {
            const cleanedPlaca = result.placa.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
            const matchedVehicle = (vehicles || []).find((v: any) => {
              const vCleaned = v.plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
              return vCleaned.includes(cleanedPlaca) || cleanedPlaca.includes(vCleaned);
            });
            const vehicleSelect = form.querySelector('select[name="vehicleId"]') as HTMLSelectElement;
            if (vehicleSelect) {
              if (matchedVehicle) {
                vehicleSelect.value = matchedVehicle.id;
                setSelectedVehicleId(matchedVehicle.id);
                filledFields.push(`Veículo (${matchedVehicle.plate})`);
              } else {
                vehicleSelect.value = 'outros';
                setSelectedVehicleId('outros');
                filledFields.push("Veículo OUTROS");
              }
            }
          }

          if (result.motorista) {
            const cleanedDriver = result.motorista.toLowerCase();
            const matchedDriver = (employees || []).find((e: any) => {
              const eName = e.name.toLowerCase();
              return eName.includes(cleanedDriver) || cleanedDriver.includes(eName);
            });
            const driverSelect = form.querySelector('select[name="driverId"]') as HTMLSelectElement;
            if (driverSelect && matchedDriver) {
              driverSelect.value = matchedDriver.id;
              filledFields.push(`Motorista (${matchedDriver.name})`);
            }
          }

          if (result.observacao && isExternal) {
            const locInput = form.querySelector('input[name="location"]') as HTMLInputElement;
            if (locInput) {
              locInput.value = result.observacao;
              filledFields.push("Localização");
            }
          }

          let obs = '';
          if (result.observacao) obs += result.observacao;
          if (result.custo) obs += `${obs ? ' | ' : ''}Custo: R$ ${result.custo}`;
          if (obs) {
            const obsInput = form.querySelector('input[name="observacao"]') as HTMLInputElement;
            if (obsInput) {
              obsInput.value = obs;
              filledFields.push("Observação");
            }
          }

          if (filledFields.length > 0) {
            toast.success(`Leitura concluída! Preenchidos: ${filledFields.join(", ")}`, { id: toastId });
          } else {
            toast.success("Comprovante processado! Nenhum dado correspondente encontrado.", { id: toastId });
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Falha ao analisar o comprovante: " + (err.message || "Erro desconhecido"), { id: toastId });
    } finally {
      setIsScanning(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800 w-full max-w-sm">
        <button
          type="button"
          onClick={() => setScanMode('single')}
          className={cn(
            "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
            scanMode === 'single' ? "bg-white text-zinc-950 shadow-md" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Cupom Único
        </button>
        <button
          type="button"
          onClick={() => setScanMode('batch')}
          className={cn(
            "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
            scanMode === 'batch' ? "bg-white text-zinc-950 shadow-md" : "text-zinc-500 hover:text-zinc-300"
          )}
        >
          Ficha em Lote
        </button>
      </div>

      <div className="p-4 bg-zinc-950/40 border border-zinc-800 rounded-3xl relative overflow-hidden group">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl text-brand-accent">
              <Camera size={20} className={cn(isScanning && "animate-pulse")} />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider leading-none">
                {scanMode === 'batch' ? 'Escanear Ficha em Lote com IA' : 'Preenchimento com IA'}
              </h4>
              <p className="text-[10px] text-zinc-400 mt-1 leading-none font-medium">
                {scanMode === 'batch' ? 'Envie a foto da ficha com múltiplos abastecimentos' : 'Tire foto ou anexe o cupom do abastecimento'}
              </p>
            </div>
          </div>
          
          <button
            type="button"
            disabled={isScanning}
            onClick={handleScanClick}
            className={cn(
              "px-5 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-2 border transition-all active:scale-95 disabled:opacity-50 cursor-pointer",
              isScanning 
                ? "bg-zinc-900 text-zinc-400 border-zinc-800" 
                : "bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border-brand-accent/20"
            )}
          >
            {isScanning ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                Lendo...
              </>
            ) : (
              <>
                <Upload size={12} />
                Selecionar Imagem
              </>
            )}
          </button>
        </div>
        <input 
          type="file" 
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/*"
          capture="environment"
          className="hidden" 
        />
      </div>

      {scanMode === 'single' ? (
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Input label="Data e Hora" type="datetime-local" icon={Clock} required name="timestamp" defaultValue={new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
            <Select 
              label="Veículo" 
              icon={Bus} 
              name="vehicleId" 
              required
              value={selectedVehicleId}
              onChange={(e: any) => setSelectedVehicleId(e.target.value)}
              options={[
                ...(vehicles || [])
                  .sort((a, b) => a.plate.localeCompare(b.plate))
                  .map((v: any) => ({ value: v.id, label: v.prefix ? `[FROTA #${v.prefix}] ${v.plate} - ${v.model}` : `${v.plate} - ${v.model}` })),
                { value: 'outros', label: 'OUTROS' }
              ]}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
              <Input 
                label="Odômetro Atual" 
                type="number" 
                placeholder="50.000" 
                icon={Hash} 
                required 
                name="odometer" 
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === '.' || e.key === ',') e.preventDefault();
                }}
                onChange={(e: any) => {
                  let val = e.target.value;
                  if (val.includes('.') || val.includes(',')) {
                    val = String(Math.floor(Number(val)));
                  }
                  const cleaned = val.replace(/[^0-9]/g, '');
                  setTypedOdometer(cleaned);
                }}
                value={typedOdometer}
              />
              {(() => {
                const selectedVehicle = (vehicles || []).find((v: any) => v.id === selectedVehicleId);
                if (!selectedVehicle || selectedVehicleId === 'outros') return null;
                const vehicleOdometer = selectedVehicle.currentOdometer || 0;
                const odoNumber = Number(typedOdometer);
                const odometerDiff = odoNumber ? odoNumber - vehicleOdometer : 0;
                
                return (
                  <div className="mt-2 p-3 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold">
                      <span className="text-zinc-400 uppercase tracking-wider font-mono">Km Atual:</span>
                      <span className="text-brand-accent font-black tracking-tight">{vehicleOdometer.toLocaleString('pt-BR')} KM</span>
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="space-y-1">
              <Input 
                label="Quantidade Diesel (Litros)" 
                type="number" 
                step="1" 
                placeholder="100" 
                icon={Hash} 
                name="quantity" 
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === '.' || e.key === ',') e.preventDefault();
                }}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  if (e.target.value.includes('.') || e.target.value.includes(',')) {
                    e.target.value = String(Math.floor(Number(e.target.value)));
                  }
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Select 
              label="Motorista" 
              icon={Users} 
              name="driverId" 
              required
              options={(employees || []).map((e: any) => ({ value: e.id, label: e.name }))}
            />
            {isExternal ? (
              <div className="space-y-4">
                <Input label="Localização / Posto" placeholder="Ex: Posto Graal KM 120" icon={MapPin} required name="location" />
                <Input label="Valor do Litro (R$)" type="number" step="0.01" placeholder="5.50" icon={DollarSign} required name="pricePerLiter" />
              </div>
            ) : (
              <Select 
                label="Tanque Diesel" 
                icon={Hash} 
                name="fuelTankId" 
                required
                options={(tanks || []).filter((t: any) => t.fuelType?.toLowerCase().includes('diesel') || t.fuelType === 'S10' || t.fuelType === 'S500').map((t: any) => ({ value: t.id, label: `${t.name} (${Math.floor(t.currentLevel)}L)` }))}
              />
            )}
          </div>

          {!isExternal && (
            <div className="pt-4 border-t border-zinc-800/50">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-brand-accent rounded-full" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Opcional: Arla 32</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Select 
                  label="Tanque Arla" 
                  icon={Hash} 
                  name="arlaTankId" 
                  options={[
                    { value: '', label: 'Não utilizar Arla' },
                    ... (tanks || []).filter((t: any) => t.fuelType === 'Arla 32' || t.name.toLowerCase().includes('arla')).map((t: any) => ({ value: t.id, label: `${t.name} (${Math.floor(t.currentLevel)}L)` }))
                  ]}
                />
                <Input 
                  label="Quantidade Arla (Litros)" 
                  type="number" 
                  step="1" 
                  placeholder="5" 
                  icon={Hash} 
                  name="arlaQuantity" 
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === '.' || e.key === ',') e.preventDefault();
                  }}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    if (e.target.value.includes('.') || e.target.value.includes(',')) {
                      e.target.value = String(Math.floor(Number(e.target.value)));
                    }
                  }}
                />
              </div>
            </div>
          )}

          <div className="pt-4">
            <Button loading={loading}>
              <Save size={20} />
              {isExternal ? 'Registrar Abastecimento Externo' : 'SALVAR'}
            </Button>
          </div>
          {isExternal && <input type="hidden" name="isExternal" value="true" />}
        </form>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-zinc-400">
              Registros da Ficha ({batchEntries.length})
            </h3>
            <button
              type="button"
              onClick={() => {
                let defaultTankId = '';
                const dieselTanks = (tanks || []).filter((t: any) => t.fuelType?.toLowerCase().includes('diesel') || t.name?.toLowerCase().includes('diesel') || t.fuelType === 'S10' || t.fuelType === 'S500');
                if (dieselTanks.length > 0) {
                  defaultTankId = dieselTanks[0].id;
                } else if (tanks && tanks.length > 0) {
                  defaultTankId = tanks[0].id;
                }
                
                let defaultArlaTankId = '';
                const arlaTanks = (tanks || []).filter((t: any) => t.fuelType === 'Arla 32' || t.name.toLowerCase().includes('arla'));
                if (arlaTanks.length > 0) {
                  defaultArlaTankId = arlaTanks[0].id;
                }

                setBatchEntries(prev => [
                  ...prev,
                  {
                    id: Math.random().toString(36).substring(2, 9),
                    vehicleId: vehicles && vehicles.length > 0 ? vehicles[0].id : '',
                    driverId: employees && employees.length > 0 ? employees[0].id : '',
                    quantity: 0,
                    arlaQuantity: 0,
                    odometer: 0,
                    cost: 0,
                    pricePerLiter: 5.90,
                    fuelTankId: defaultTankId,
                    arlaTankId: defaultArlaTankId,
                    isExternal: false,
                    location: 'Interno',
                    timestamp: new Date().toISOString().slice(0, 16)
                  }
                ]);
              }}
              className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all active:scale-95 animate-fade-in"
            >
              <Plus size={10} /> Adicionar Linha
            </button>
          </div>

          {batchEntries.length === 0 ? (
            <div className="p-8 border border-dashed border-zinc-800 rounded-2xl text-center">
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-black">Nenhum lançamento extraído</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {batchEntries.map((entry, index) => (
                <div key={entry.id} className="p-4 bg-zinc-900/30 border border-zinc-800/80 rounded-2xl relative space-y-4 group">
                  <button
                    type="button"
                    onClick={() => setBatchEntries(prev => prev.filter(e => e.id !== entry.id))}
                    className="absolute top-3 right-3 text-zinc-600 hover:text-rose-500 transition-colors"
                  >
                    <X size={14} />
                  </button>

                  <div className="text-[9px] font-black text-brand-accent uppercase tracking-widest">
                    Lançamento #{index + 1}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">VEÍCULO</label>
                      <select
                        value={entry.vehicleId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, vehicleId: val } : item));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {(vehicles || [])
                          .sort((a: any, b: any) => a.plate.localeCompare(b.plate))
                          .map((v: any) => (
                            <option key={v.id} value={v.id}>{v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate} - {v.model}</option>
                          ))}
                        <option value="outros">OUTROS</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">MOTORISTA</label>
                      <select
                        value={entry.driverId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, driverId: val } : item));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      >
                        <option value="">Selecione...</option>
                        {(employees || []).map((emp: any) => (
                          <option key={emp.id} value={emp.id}>{emp.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">TIPO DE BOMBA</label>
                      <select
                        value={entry.isExternal ? 'externa' : 'interna'}
                        onChange={(e) => {
                          const val = e.target.value === 'externa';
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, isExternal: val, location: val ? '' : 'Interno' } : item));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      >
                        <option value="interna">Interna (Tanque Próprio)</option>
                        <option value="externa">Externa (Posto de Rua)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">LITROS DIESEL</label>
                      <input
                        type="number"
                        step="1"
                        value={entry.quantity || ''}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === '.' || e.key === ',') e.preventDefault();
                        }}
                        onChange={(e) => {
                          const val = Math.floor(Number(e.target.value));
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, quantity: val } : item));
                        }}
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">LITROS ARLA 32</label>
                      <input
                        type="number"
                        step="1"
                        value={entry.arlaQuantity || ''}
                        onKeyDown={(e: React.KeyboardEvent) => {
                          if (e.key === '.' || e.key === ',') e.preventDefault();
                        }}
                        onChange={(e) => {
                          const val = Math.floor(Number(e.target.value));
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, arlaQuantity: val } : item));
                        }}
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">HODÔMETRO</label>
                      <input
                        type="number"
                        value={entry.odometer || ''}
                        onChange={(e) => {
                          const val = Math.floor(Number(e.target.value.replace(/[^0-9]/g, '')));
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, odometer: val } : item));
                        }}
                        placeholder="0"
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">CUSTO TOTAL (R$)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={entry.cost || ''}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, cost: val } : item));
                        }}
                        placeholder="0,00"
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">DATA/HORA</label>
                      <input
                        type="datetime-local"
                        value={entry.timestamp}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, timestamp: val } : item));
                        }}
                        className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                      />
                    </div>
                    {entry.isExternal ? (
                      <div>
                        <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">LOCALIZAÇÃO / POSTO</label>
                        <input
                          type="text"
                          value={entry.location}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, location: val } : item));
                          }}
                          placeholder="Nome do Posto"
                          className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">TANQUE DIESEL</label>
                          <select
                            value={entry.fuelTankId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, fuelTankId: val } : item));
                            }}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                          >
                            {(tanks || []).filter((t: any) => t.fuelType?.toLowerCase().includes('diesel') || t.fuelType === 'S10' || t.fuelType === 'S500').map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name} ({Math.floor(t.currentLevel)}L)</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[8px] font-black text-zinc-500 uppercase tracking-widest mb-1 font-mono">TANQUE ARLA</label>
                          <select
                            value={entry.arlaTankId}
                            onChange={(e) => {
                              const val = e.target.value;
                              setBatchEntries(prev => prev.map(item => item.id === entry.id ? { ...item, arlaTankId: val } : item));
                            }}
                            className="w-full bg-zinc-950 border border-zinc-850 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wider text-zinc-150 focus:border-white focus:outline-none"
                          >
                            <option value="">Não utilizar Arla</option>
                            {(tanks || []).filter((t: any) => t.fuelType === 'Arla 32' || t.name.toLowerCase().includes('arla')).map((t: any) => (
                              <option key={t.id} value={t.id}>{t.name} ({Math.floor(t.currentLevel)}L)</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="pt-6 border-t border-zinc-800 flex justify-end gap-4">
             <button
              type="button"
              onClick={() => setBatchEntries([])}
              className="px-6 py-3 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:text-rose-500 transition-all active:scale-95"
            >
              Limpar Tudo
            </button>
            <Button
              loading={loading}
              onClick={async () => {
                if (batchEntries.length === 0) return;
                setLoading(true);
                const toastId = toast.loading(`Persistindo ${batchEntries.length} lançamentos...`);
                try {
                  for (const entry of batchEntries) {
                    if (!entry.vehicleId || entry.vehicleId === 'outros') continue;
                    await saveBatchFuelEntry(entry);
                  }
                  toast.success("Lançamentos persistidos com sucesso!", { id: toastId });
                  setBatchEntries([]);
                  onSubmit(); // This will close the modal in the parent
                } catch (err: any) {
                  console.error(err);
                  toast.error("Erro ao persistir: " + err.message, { id: toastId });
                } finally {
                  setLoading(false);
                }
              }}
              className="px-10"
            >
              <Save size={16} /> Finalizar Lote
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const TankForm = ({ onSubmit, initialData }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input label="Nome do Tanque" placeholder="Tanque Principal Diesel" icon={Fuel} required name="name" defaultValue={initialData?.name} />
      <div className="grid grid-cols-2 gap-4">
        <Select 
          label="Tipo de Combustível" 
          icon={Fuel} 
          name="fuelType" 
          defaultValue={initialData?.fuelType || 'Diesel S10'}
          options={[
            { value: 'Diesel S10', label: 'Diesel S10' },
            { value: 'Diesel S500', label: 'Diesel S500' },
            { value: 'Arla 32', label: 'Arla 32' },
            { value: 'Gasolina Comum', label: 'Gasolina Comum' }
          ]} 
        />
        <Input label="Capacidade Total (Litros)" type="number" placeholder="5.000" icon={Hash} required name="capacity" defaultValue={initialData?.capacity} />
      </div>
      <Input label="Nível Atual (Litros)" type="number" placeholder="2.500" icon={Hash} required name="currentLevel" defaultValue={initialData?.currentLevel} />
      <div className="pt-4">
        <Button loading={loading}>
          <Save size={20} />
          {initialData ? 'Atualizar Tanque' : 'Cadastrar Tanque'}
        </Button>
      </div>
    </form>
  );
};

export const TankRefillForm = ({ onSubmit, tanks }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select 
        label="Tanque de Destino" 
        icon={Fuel} 
        name="tankId" 
        required
        options={(tanks || []).map((t: any) => ({ value: t.id, label: `${t.name} (${t.currentLevel}L / ${t.capacity}L)` }))} 
      />
      <div className="grid grid-cols-2 gap-4">
        <Input 
          label="Quantidade Recebida (Litros)" 
          type="number" 
          placeholder="1.000" 
          icon={Plus} 
          required 
          name="quantity" 
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === '.' || e.key === ',') e.preventDefault();
          }}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            if (e.target.value.includes('.') || e.target.value.includes(',')) {
              e.target.value = String(Math.floor(Number(e.target.value)));
            }
          }}
        />
        <Input label="Valor Total Pago (R$)" type="number" step="0.01" placeholder="5.500,00" icon={DollarSign} required name="cost" />
      </div>
      <Input label="Fornecedor / Transportadora" placeholder="Ex: Ipiranga / BR" icon={Briefcase} name="supplier" />
      <div className="pt-4">
        <Button loading={loading}>
          <Package size={20} />
          Confirmar Recebimento de Carga
        </Button>
      </div>
    </form>
  );
};

export const EmployeeForm = ({ onSubmit, initialData }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2">
          <Users size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Informações Pessoais</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Nome Completo" placeholder="Ex: João da Silva" icon={Users} required name="name" defaultValue={initialData?.name} />
          <Input label="CPF" placeholder="000.000.000-00" icon={Hash} required name="cpf" defaultValue={initialData?.cpf} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Telefone / WhatsApp" placeholder="(00) 00000-0000" icon={Phone} name="phone" defaultValue={initialData?.phone} />
          <Input label="E-mail" type="email" placeholder="joao@dmturismo.com.br" icon={Globe} name="email" defaultValue={initialData?.email} />
        </div>
      </div>

      <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-800 pb-2 mb-2">
          <Briefcase size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Contratação e Cargo</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Select 
            label="Cargo / Função" 
            icon={Briefcase} 
            name="role"
            defaultValue={initialData?.role || 'driver'}
            options={[
              { value: 'driver', label: 'Motorista' },
              { value: 'mechanic', label: 'Mecânico' },
              { value: 'admin', label: 'Administrativo' },
              { value: 'manager', label: 'Gerente de Frota' },
              { value: 'other', label: 'Outros' }
            ]} 
          />
          <Input label="Data de Admissão" type="date" icon={Calendar} name="admissionDate" defaultValue={initialData?.admissionDate} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Salário Base (R$)" type="number" step="0.01" placeholder="3.500,00" icon={DollarSign} name="salary" defaultValue={initialData?.salary} />
          <Input label="Status" icon={Users} name="status" defaultValue={initialData?.status || 'Ativo'} />
        </div>
      </div>

      <div className="p-4 bg-brand-accent/5 border border-brand-accent/10 rounded-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-brand-accent/10 pb-2 mb-2">
          <FileText size={14} className="text-brand-accent" />
          <h3 className="text-[10px] font-black text-white uppercase tracking-widest">Habilitação (CNH)</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Input label="Número da CNH" placeholder="00000000000" icon={Hash} name="cnhNumber" defaultValue={initialData?.cnhNumber} />
          <Select 
            label="Categoria" 
            icon={Hash} 
            name="cnhCategory"
            defaultValue={initialData?.cnhCategory || 'D'}
            options={[
              { value: 'A', label: 'A' },
              { value: 'B', label: 'B' },
              { value: 'C', label: 'C' },
              { value: 'D', label: 'D' },
              { value: 'E', label: 'E' },
              { value: 'AD', label: 'AD' },
              { value: 'AE', label: 'AE' }
            ]} 
          />
          <Input label="Vencimento CNH" type="date" icon={Calendar} name="cnhExpiration" defaultValue={initialData?.cnhExpiration} />
        </div>
      </div>

      <div className="pt-4">
        <Button loading={loading}>
          <Save size={20} />
          {initialData ? 'Atualizar Colaborador' : 'Registrar Colaborador'}
        </Button>
      </div>
    </form>
  );
};

export const MaintenanceForm = ({ onSubmit, vehicles, employees, initialData }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select 
          label="Veículo" 
          icon={Bus} 
          name="vehicleId" 
          required
          defaultValue={initialData?.vehicleId}
          options={(vehicles || []).map((v: any) => ({ value: v.id, label: v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate }))} 
        />
        <Input label="Data da Manutenção" type="date" icon={Calendar} required name="date" defaultValue={initialData?.date || new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select 
          label="Tipo de Manutenção" 
          icon={Wrench} 
          name="type"
          defaultValue={initialData?.type || 'preventiva'}
          options={[
            { value: 'preventiva', label: 'Preventiva' },
            { value: 'corretiva', label: 'Corretiva' },
            { value: 'preditiva', label: 'Preditiva' }
          ]} 
        />
        <Input label="Odômetro na Manutenção" type="number" placeholder="50.000" icon={Hash} required name="odometer" defaultValue={initialData?.odometer} />
      </div>
      <Input label="Descrição do Serviço" placeholder="Troca de óleo, filtros e pastilhas de freio" icon={Wrench} required name="description" defaultValue={initialData?.description} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Custo Total (R$)" type="number" step="0.01" placeholder="1.200,00" icon={DollarSign} required name="cost" defaultValue={initialData?.cost} />
        <Select 
          label="Mecânico / Responsável" 
          icon={Users} 
          name="responsibleId"
          defaultValue={initialData?.responsibleId}
          options={(employees || []).map((e: any) => ({ value: e.id, label: e.name }))} 
        />
      </div>
      <div className="pt-4">
        <Button loading={loading}>
          <Save size={20} />
          {initialData ? 'Atualizar Registro' : 'Registrar Manutenção'}
        </Button>
      </div>
    </form>
  );
};

export const FinancialForm = ({ onSubmit, vehicles, initialData }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select 
          label="Tipo de Transação" 
          icon={DollarSign} 
          name="type"
          defaultValue={initialData?.type || 'payable'}
          options={[
            { value: 'payable', label: 'Contas a Pagar (Despesa)' },
            { value: 'receivable', label: 'Contas a Receber (Receita)' }
          ]} 
        />
        <Select 
          label="Categoria" 
          icon={Briefcase} 
          name="category"
          defaultValue={initialData?.category || 'Outros'}
          options={[
            { value: 'Combustível', label: 'Combustível' },
            { value: 'Manutenção', label: 'Manutenção' },
            { value: 'Peças', label: 'Peças' },
            { value: 'Salários', label: 'Salários' },
            { value: 'Seguros', label: 'Seguros' },
            { value: 'Impostos', label: 'Impostos' },
            { value: 'Viagens', label: 'Viagens / Fretamento' },
            { value: 'Outros', label: 'Outros' }
          ]} 
        />
      </div>
      <Input label="Descrição" placeholder="Pagamento de seguro frota" icon={FileText} required name="description" defaultValue={initialData?.description} />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Valor (R$)" type="number" step="0.01" placeholder="2.500,00" icon={DollarSign} required name="amount" defaultValue={initialData?.amount} />
        <Input label="Data de Vencimento" type="date" icon={Calendar} required name="dueDate" defaultValue={initialData?.dueDate || new Date().toISOString().slice(0, 10)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Select 
          label="Status" 
          icon={Clock} 
          name="status"
          defaultValue={initialData?.status || 'pending'}
          options={[
            { value: 'pending', label: 'Pendente' },
            { value: 'paid', label: 'Pago / Recebido' },
            { value: 'cancelled', label: 'Cancelado' }
          ]} 
        />
        <Select 
          label="Vincular a Veículo (Opcional)" 
          icon={Bus} 
          name="refId"
          defaultValue={initialData?.refId}
          options={[
            { value: '', label: 'Nenhum' },
            ...(vehicles || []).map((v: any) => ({ value: v.id, label: v.prefix ? `[FROTA #${v.prefix}] ${v.plate}` : v.plate }))
          ]} 
        />
      </div>
      <div className="pt-4">
        <Button loading={loading}>
          <Save size={20} />
          {initialData ? 'Atualizar Transação' : 'Registrar Transação'}
        </Button>
      </div>
    </form>
  );
};

export const WorkScheduleForm = ({ onSubmit, employees, initialData }: any) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    setLoading(true);
    await onSubmit(e);
    setLoading(false);
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select 
        label="Colaborador" 
        icon={Users} 
        name="employeeId" 
        required
        defaultValue={initialData?.employeeId}
        options={(employees || []).map((e: any) => ({ value: e.id, label: e.name }))} 
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Data" type="date" icon={Calendar} required name="date" defaultValue={initialData?.date || new Date().toISOString().slice(0, 10)} />
        <Select 
          label="Tipo de Escala" 
          icon={Clock} 
          name="type"
          defaultValue={initialData?.type || 'trabalho'}
          options={[
            { value: 'trabalho', label: 'Trabalho (Plantão)' },
            { value: 'folga', label: 'Folga' },
            { value: 'ferias', label: 'Férias' },
            { value: 'afastamento', label: 'Afastamento' }
          ]} 
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Input label="Início" type="time" icon={Clock} name="startTime" defaultValue={initialData?.startTime} />
        <Input label="Fim" type="time" icon={Clock} name="endTime" defaultValue={initialData?.endTime} />
      </div>
      <Input label="Observações / Linha" placeholder="Escala de viagem para RJ" icon={MapPin} name="notes" defaultValue={initialData?.notes} />
      <div className="pt-4">
        <Button loading={loading}>
          <Save size={20} />
          {initialData ? 'Atualizar Escala' : 'Registrar Escala'}
        </Button>
      </div>
    </form>
  );
};
