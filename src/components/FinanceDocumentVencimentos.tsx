import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Calendar, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  UploadCloud, 
  Download, 
  Search, 
  Plus, 
  ChevronRight, 
  ChevronLeft,
  Info, 
  FileCheck2, 
  Bus,
  X,
  FileSpreadsheet,
  ShieldCheck,
  Folder,
  Eye,
  AlertTriangle,
  Sparkles,
  Printer,
  ChevronDown,
  LayoutGrid,
  List,
  Camera,
  Image as ImageIcon,
  Video,
  ArrowRightLeft
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, addDoc, deleteDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, cleanUndefined } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { Vehicle } from '../types';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { format, parseISO, differenceInDays, isBefore, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DocumentVencimento {
  id: string;
  name: string;
  category: 'veiculos' | 'alvaras' | 'seguros' | 'fiscais_contratos' | 'outros';
  dueDate: string; // YYYY-MM-DD
  warningThreshold: number; // in days
  vehicleId?: string;
  vehiclePlate?: string;
  vehicleModel?: string;
  pdfName: string;
  pdfSize: string;
  pdfData: string; // base64 string
  createdAt: any;
  origin?: 'finance' | 'fleet' | 'vehicle_detail';
  status?: 'expired' | 'warning' | 'regular';
  daysRemaining?: number;
}

interface FinanceDocumentVencimentosProps {
  vehicles: Vehicle[];
  user?: any;
  fixedVehicleId?: string;
  hideHeader?: boolean;
  isFleetToolMode?: boolean;
}

export const FinanceDocumentVencimentos = ({ vehicles, user, fixedVehicleId, hideHeader, isFleetToolMode }: FinanceDocumentVencimentosProps) => {
  const [documents, setDocuments] = useState<DocumentVencimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [fleetSelectedVehicleId, setFleetSelectedVehicleId] = useState<string | null>(null);
  const [selectedPlateFolder, setSelectedPlateFolder] = useState<string | null>(null);
  
  // Se estivermos no modo cofre, usamos ou o fixedVehicleId ou o selecionado na lista da frota
  const effectiveVehicleId = fixedVehicleId || fleetSelectedVehicleId;
  const isVaultMode = !!effectiveVehicleId;

  // Placa do veículo em foco para o isolamento estrito da galeria e cofre
  const activePlate = useMemo(() => {
    if (fixedVehicleId) {
      const v = vehicles.find(veh => veh.id === fixedVehicleId);
      return v ? v.plate : null;
    }
    if (fleetSelectedVehicleId) {
      const v = vehicles.find(veh => veh.id === fleetSelectedVehicleId);
      return v ? v.plate : null;
    }
    return selectedPlateFolder;
  }, [fixedVehicleId, fleetSelectedVehicleId, selectedPlateFolder, vehicles]);
  
  // Determinar a origem atual para isolamento
  const currentOrigin = useMemo(() => {
    if (fixedVehicleId) return 'vehicle_detail';
    if (isFleetToolMode) return 'fleet';
    return 'finance';
  }, [fixedVehicleId, isFleetToolMode]);
  
  // Filtros e buscas
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | DocumentVencimento['category']>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'regular' | 'warning' | 'expired'>('all');
  
  // Modais
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<DocumentVencimento | null>(null);
  const [documentToDelete, setDocumentToDelete] = useState<DocumentVencimento | null>(null);

  // Estados do Formulário
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState<DocumentVencimento['category']>('veiculos');
  const [formDueDate, setFormDueDate] = useState('');
  const [formThreshold, setFormThreshold] = useState(30);
  const [formVehicleId, setFormVehicleId] = useState(effectiveVehicleId || '');
  const [extractedVehicleUpdates, setExtractedVehicleUpdates] = useState<Partial<Vehicle>>({});
  const [pdfName, setPdfName] = useState('');
  const [pdfSize, setPdfSize] = useState('');
  const [pdfData, setPdfData] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isExtractingWithAi, setIsExtractingWithAi] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isVaultMode ? 'grid' : 'grid');
  const [vaultCategory, setVaultCategory] = useState<'all' | 'legal' | 'maintenance' | 'insurance'>('all');

  // Câmera ao Vivo e Referências de Arquivo
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Helper para verificar se um documento é imagem
  const isImageDocument = (docItem?: Partial<DocumentVencimento> | null) => {
    if (!docItem) return false;
    if (docItem.pdfData?.startsWith('data:image/')) return true;
    if (docItem.pdfName && /\.(jpg|jpeg|png|webp|heic)$/i.test(docItem.pdfName)) return true;
    return false;
  };

  // Helper para comprimir fotos tiradas na câmera ou arquivos de imagem
  const compressImageFile = (file: File): Promise<{ base64: string; mimeType: string }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const MAX_DIM = 1200;
          let width = img.width;
          let height = img.height;

          if (width > MAX_DIM || height > MAX_DIM) {
            if (width > height) {
              height = Math.round((height * MAX_DIM) / width);
              width = MAX_DIM;
            } else {
              width = Math.round((width * MAX_DIM) / height);
              height = MAX_DIM;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
          }
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          resolve({ base64: compressedBase64, mimeType: 'image/jpeg' });
        };
        img.onerror = (err) => reject(err);
        img.src = e.target?.result as string;
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Funções para controle da Câmera ao Vivo
  const startCamera = async () => {
    setIsLiveCameraOpen(true);
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error("Erro ao iniciar câmera:", err);
      setCameraError('Não foi possível acessar a câmera do dispositivo. Verifique as permissões de vídeo.');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsLiveCameraOpen(false);
    setCameraError(null);
  };

  const captureCameraPhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const photoBase64 = canvas.toDataURL('image/jpeg', 0.7);
      const photoName = `FOTO_DOCUMENTO_${format(new Date(), 'yyyyMMdd_HHmmss')}.JPG`;
      const photoSize = `${(photoBase64.length * 0.75 / 1024).toFixed(1)} KB`;
      
      setPdfData(photoBase64);
      setPdfName(photoName);
      setPdfSize(photoSize);
      stopCamera();
      toast.success('Foto do documento capturada!');
      
      handleExtractData(photoBase64, 'image/jpeg');
    }
  };

  // Sincronizar formVehicleId se effectiveVehicleId mudar
  useEffect(() => {
    if (effectiveVehicleId) {
      setFormVehicleId(effectiveVehicleId);
    }
  }, [effectiveVehicleId]);

  // Carregar documentos do Firestore via cache service
  useEffect(() => {
    const unsubscribe = dbCacheService.subscribeCollection('finance_documents', (list) => {
      // Sort client-side by dueDate
      const sorted = [...list].sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || '')) as DocumentVencimento[];
      setDocuments(sorted);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Extrair dados do PDF ou Imagem com Inteligência Artificial (Gemini)
  const handleExtractData = async (base64Str: string, customMimeType?: string) => {
    if (!base64Str) return;
    setIsExtractingWithAi(true);
    const toastId = toast.loading('Inteligência Artificial lendo e extraindo dados do documento...');
    try {
      let mimeType = customMimeType || 'application/pdf';
      let cleanBase64 = base64Str;

      if (base64Str.startsWith('data:')) {
        const parts = base64Str.split(';');
        mimeType = parts[0].replace('data:', '');
        cleanBase64 = base64Str.split(',')[1] || base64Str;
      } else if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      
      // Se for categoria de veículos ou estivermos no cofre de um veículo, usamos a rota especializada
      const isVehicleDoc = formCategory === 'veiculos' || !!effectiveVehicleId;
      const apiRoute = isVehicleDoc ? '/api/vehicle/scan-document' : '/api/finance/scan-document';
      
      // Buscar placa do veículo atual para ajudar na regra do Detran SC
      let currentPlate = '';
      if (effectiveVehicleId) {
        currentPlate = vehicles.find(v => v.id === effectiveVehicleId)?.plate || '';
      }

      const response = await fetch(apiRoute, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          base64Data: cleanBase64,
          mimeType: mimeType,
          plate: currentPlate
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao processar documento.');
      }

      const extractedData = await response.json();
      const fieldsUpdated: string[] = [];
      const vehicleUpdates: Partial<Vehicle> = {};

      // Mapeamento flexível dependendo da rota usada
      const name = extractedData.documentName || extractedData.description || extractedData.packageName;
      const dueDate = extractedData.validityDate || extractedData.dueDate;

      if (name) {
        setFormName(name.toUpperCase());
        fieldsUpdated.push('Título');
      }

      if (dueDate) {
        setFormDueDate(dueDate);
        fieldsUpdated.push('Vencimento');
        
        // Se houver mapeamento de campo do veículo, preparar update
        if (extractedData.targetVehicleField) {
          const field = extractedData.targetVehicleField as keyof Vehicle;
          (vehicleUpdates as any)[field] = dueDate;
          fieldsUpdated.push(`Campo: ${extractedData.targetVehicleField}`);
        }
      }

      // Extrair Renavam e Chassi se disponíveis
      if (extractedData.extractedRenavam) {
        vehicleUpdates.renavam = extractedData.extractedRenavam;
        fieldsUpdated.push('Renavam');
      }
      if (extractedData.extractedChassi) {
        vehicleUpdates.chassi = extractedData.extractedChassi;
        fieldsUpdated.push('Chassi');
      }

      setExtractedVehicleUpdates(vehicleUpdates);

      // Tentar associar veículo se houver placa identificada e não estivermos já num veículo fixo
      if (extractedData.vehiclePlate || extractedData.extractedPlate) {
        const plateToMatch = extractedData.vehiclePlate || extractedData.extractedPlate;
        const cleanPlate = plateToMatch.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        
        const matchedVehicle = vehicles.find(v => {
          const vPlate = v.plate.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
          return vPlate.includes(cleanPlate) || cleanPlate.includes(vPlate);
        });
        
        if (matchedVehicle && !effectiveVehicleId) {
          setFormVehicleId(matchedVehicle.id);
          setFormCategory('veiculos');
          fieldsUpdated.push('Veículo Vinculado');
        }
      }

      // Deduzir categoria com base em palavras-chave se não for veículo
      if (!extractedData.vehiclePlate && !extractedData.extractedPlate) {
        const descText = ((extractedData.description || '') + ' ' + (extractedData.packageName || '')).toLowerCase();
        if (descText.includes('seguro') || descText.includes('apólice') || descText.includes('sinistro') || descText.includes('porto') || descText.includes('azul')) {
          setFormCategory('seguros');
          fieldsUpdated.push('Categoria (Seguros)');
        } else if (descText.includes('alvará') || descText.includes('licença') || descText.includes('sanitária') || descText.includes('prefeitura') || descText.includes('alvara') || descText.includes('licenca')) {
          setFormCategory('alvaras');
          fieldsUpdated.push('Categoria (Alvarás)');
        } else if (descText.includes('contrato') || descText.includes('prestação') || descText.includes('fiscal') || descText.includes('imposto') || descText.includes('das') || descText.includes('simples') || descText.includes('nota fiscal')) {
          setFormCategory('fiscais_contratos');
          fieldsUpdated.push('Categoria (Fiscais/Contratos)');
        }
      }

      if (fieldsUpdated.length > 0) {
        toast.success(`Leitura Concluída! Campos atualizados: ${fieldsUpdated.join(', ')}`, { id: toastId });
      } else {
        toast.info('IA analisou o documento, mas nenhum campo pôde ser preenchido automaticamente.', { id: toastId });
      }
    } catch (err: any) {
      console.error('Erro de extração com IA:', err);
      toast.error(`Falha ao ler o documento com IA: ${err.message || 'Erro inesperado'}`, { id: toastId });
    } finally {
      setIsExtractingWithAi(false);
    }
  };

  // Handler de upload de PDF ou Foto com conversão para Base64 e validação de tamanho
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|heic)$/i.test(file.name);

    if (!isPdf && !isImage) {
      toast.error('Por favor, selecione apenas arquivos PDF ou Imagens (JPG, PNG, WEBP).');
      return;
    }

    setIsUploading(true);

    try {
      if (isImage) {
        const compressed = await compressImageFile(file);
        setPdfData(compressed.base64);
        setPdfName(file.name || `FOTO_DOCUMENTO_${format(new Date(), 'ddMMyyyy_HHmm')}.JPG`);
        setPdfSize(`${(compressed.base64.length * 0.75 / 1024).toFixed(1)} KB`);
        setIsUploading(false);
        toast.success('Foto do documento anexada!');
        
        await handleExtractData(compressed.base64, compressed.mimeType);
      } else {
        if (file.size > 1200 * 1024) {
          toast.error('O arquivo PDF excede o limite de 1.2 MB.');
          setIsUploading(false);
          return;
        }
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64String = event.target?.result as string;
          setPdfData(base64String);
          setPdfName(file.name);
          setPdfSize(`${(file.size / 1024).toFixed(1)} KB`);
          setIsUploading(false);
          toast.success('Arquivo PDF anexado com sucesso!');
          
          await handleExtractData(base64String, 'application/pdf');
        };
        reader.onerror = () => {
          toast.error('Erro ao ler o arquivo PDF.');
          setIsUploading(false);
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      console.error('Erro ao ler arquivo:', err);
      toast.error('Erro ao processar o arquivo anexado.');
      setIsUploading(false);
    }
  };

  // Limpar formulário manualmente
  const handleClearForm = () => {
    setFormName('');
    setFormCategory('veiculos');
    setFormDueDate('');
    setFormThreshold(30);
    setFormVehicleId(effectiveVehicleId || '');
    setExtractedVehicleUpdates({});
    setPdfName('');
    setPdfSize('');
    setPdfData('');
    toast.success('Campos do formulário limpos!');
  };

  // Enviar novo documento ao Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      toast.error('Por favor, preencha o título do documento.');
      return;
    }
    if (!formDueDate) {
      toast.error('Por favor, defina a data de vencimento.');
      return;
    }
    if (!pdfData) {
      toast.error('Por favor, anexe o arquivo PDF do documento.');
      return;
    }

    try {
      let vehiclePlate = '';
      let vehicleModel = '';
      if (formVehicleId) {
        const related = vehicles.find(v => v.id === formVehicleId);
        if (related) {
          vehiclePlate = related.plate;
          vehicleModel = related.model;

          // SE HOUVER UPDATES DA IA, ATUALIZAR O VEÍCULO TAMBÉM
          if (Object.keys(extractedVehicleUpdates).length > 0) {
            await updateDoc(doc(db, 'vehicles', formVehicleId), {
              ...extractedVehicleUpdates,
              updatedAt: new Date().toISOString()
            });
            console.log("[AI Distribution] Vehicle fields updated:", extractedVehicleUpdates);
          }
        }
      }

      const docPayload = cleanUndefined({
        name: formName.trim(),
        category: formCategory,
        dueDate: formDueDate,
        warningThreshold: Number(formThreshold),
        vehicleId: formVehicleId || null,
        vehiclePlate: vehiclePlate || null,
        vehicleModel: vehicleModel || null,
        pdfName,
        pdfSize,
        pdfData,
        origin: currentOrigin,
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'finance_documents'), docPayload);
      toast.success('Documento registrado com sucesso!');
      
      // Fechar modal sem limpar os campos para manter as informações salvas para fácil reuso
      setIsNewModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'finance_documents');
    }
  };

  // Excluir documento do Firestore com segurança (evitando window.confirm)
  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;
    const docId = documentToDelete.id;
    try {
      await deleteDoc(doc(db, 'finance_documents', docId));
      toast.success('Documento removido com sucesso!');
      if (selectedDocument?.id === docId) {
        setSelectedDocument(null);
      }
      setDocumentToDelete(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'finance_documents');
    }
  };

  // Lógica para processar status e dias restantes de cada documento
  const processedDocuments = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let baseList = documents;
    
    // Aplicar isolamento estrito por origem
    baseList = baseList.filter(d => {
      // Quando na ferramenta Frotas (isFleetToolMode) ou detalhe do veículo
      if (isFleetToolMode || currentOrigin === 'fleet' || currentOrigin === 'vehicle_detail') {
        // Mostrar apenas o que for de frotas, detalhe de veículo, ou tiver veículo vinculado
        return d.origin === 'fleet' || d.origin === 'vehicle_detail' || !!d.vehicleId;
      }
      
      // Se não for ferramenta de Frotas ou Veículo, é a Central Financeira/Arquivo
      if (currentOrigin === 'finance') {
        return d.origin === 'finance' || !d.origin;
      }

      if (d.origin) return d.origin === currentOrigin;
      return false;
    });

    // Se estivermos no modo Frota ou detalhe de veículo, agregar fotos e PDFs salvos nas fichas dos veículos (gallery / photos / attachments)
    const assetGalleryDocs: DocumentVencimento[] = [];
    if (isFleetToolMode || currentOrigin === 'fleet' || currentOrigin === 'vehicle_detail') {
      const targetVehicles = effectiveVehicleId 
        ? vehicles.filter(v => v.id === effectiveVehicleId)
        : vehicles;

      targetVehicles.forEach(v => {
        const photosList = (v as any).gallery || (v as any).photos || (v as any).attachments || [];
        photosList.forEach((photo: any, idx: number) => {
          const photoUrl = photo.url || photo.data || photo.src || photo.pdfData;
          if (!photoUrl) return;

          const photoId = photo.id || `veh_asset_doc_${v.id}_${idx}`;
          // Evitar duplicados se já estiver no baseList
          const exists = baseList.some(d => d.id === photoId || (d.pdfData === photoUrl && d.vehicleId === v.id));
          if (!exists) {
            assetGalleryDocs.push({
              id: photoId,
              name: (photo.caption || photo.name || photo.title || `FOTO FICHA ATIVO ${v.plate}`).toUpperCase(),
              category: 'veiculos',
              dueDate: photo.createdAt ? String(photo.createdAt).substring(0, 10) : (v.updatedAt ? String(v.updatedAt).substring(0, 10) : format(new Date(), 'yyyy-MM-dd')),
              warningThreshold: 30,
              vehicleId: v.id,
              vehiclePlate: v.plate,
              vehicleModel: v.model,
              pdfName: photo.caption || photo.name || `foto_${v.plate}_${idx + 1}.jpg`,
              pdfSize: photo.size || 'Foto / Anexo de Ativo',
              pdfData: photoUrl,
              origin: 'vehicle_detail',
              createdAt: photo.createdAt || new Date().toISOString()
            });
          }
        });
      });
    }

    baseList = [...baseList, ...assetGalleryDocs];

    if (effectiveVehicleId) {
      baseList = baseList.filter(d => d.vehicleId === effectiveVehicleId);
    }

    const mapped = baseList.map(doc => {
      const expiryDate = parseISO(doc.dueDate);
      expiryDate.setHours(0, 0, 0, 0);
      
      const daysRemaining = differenceInDays(expiryDate, today);
      
      let status: 'expired' | 'warning' | 'regular' = 'regular';
      if (daysRemaining < 0) {
        status = 'expired';
      } else if (daysRemaining <= doc.warningThreshold) {
        status = 'warning';
      }

      return {
        ...doc,
        daysRemaining,
        status
      };
    });

    // Ordenar por vencimento: o próximo a vencer por primeiro (daysRemaining >= 0, ordem crescente), e consequentemente os já vencidos (daysRemaining < 0)
    return mapped.sort((a, b) => {
      const isExpiredA = a.daysRemaining < 0;
      const isExpiredB = b.daysRemaining < 0;

      // Se ambos não estão vencidos
      if (!isExpiredA && !isExpiredB) {
        return a.daysRemaining - b.daysRemaining; // Menor tempo restante primeiro
      }

      // Se ambos estão vencidos
      if (isExpiredA && isExpiredB) {
        return b.daysRemaining - a.daysRemaining; // Mais recentemente vencido primeiro (ex: -1 antes de -10)
      }

      // Se um está vencido e o outro não, o não vencido (ativo/alerta) vem primeiro
      return isExpiredA ? 1 : -1;
    });
  }, [documents]);

  // Contadores de KPIs
  const kpis = useMemo(() => {
    const expired = processedDocuments.filter(d => d.status === 'expired').length;
    const warning = processedDocuments.filter(d => d.status === 'warning').length;
    const regular = processedDocuments.filter(d => d.status === 'regular').length;
    
    return {
      total: processedDocuments.length,
      expired,
      warning,
      regular
    };
  }, [processedDocuments]);

  // Agrupamento e contagem de documentos e fotos por pasta de placa
  const vehicleFoldersSummary = useMemo(() => {
    return vehicles.map(v => {
      const docsForThisPlate = processedDocuments.filter(d => 
        d.vehicleId === v.id || 
        (d.vehiclePlate && d.vehiclePlate.trim().toUpperCase() === v.plate.trim().toUpperCase())
      );
      const expiredCount = docsForThisPlate.filter(d => d.status === 'expired').length;
      const warningCount = docsForThisPlate.filter(d => d.status === 'warning').length;

      return {
        vehicle: v,
        id: v.id,
        plate: v.plate,
        model: v.model,
        totalDocs: docsForThisPlate.length,
        expiredCount,
        warningCount,
        regularCount: docsForThisPlate.length - expiredCount - warningCount
      };
    });
  }, [vehicles, processedDocuments]);

  // Aplicar filtros e busca com separação estrita por placa
  const filteredDocuments = useMemo(() => {
    return processedDocuments.filter(doc => {
      // Isolar estritamente por placa quando uma pasta de placa ou veículo específico estiver ativo
      if (activePlate) {
        const targetVehicle = vehicles.find(v => v.plate.trim().toUpperCase() === activePlate.trim().toUpperCase() || v.id === activePlate);
        const matchesPlate = (doc.vehiclePlate && doc.vehiclePlate.trim().toUpperCase() === activePlate.trim().toUpperCase()) ||
                             (targetVehicle && doc.vehicleId === targetVehicle.id);
        if (!matchesPlate) return false;
      }

      const matchesSearch = doc.name.toLowerCase().includes(search.toLowerCase()) || 
                            (doc.vehiclePlate && doc.vehiclePlate.toLowerCase().includes(search.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || doc.category === selectedCategory;
      const matchesStatus = selectedStatus === 'all' || doc.status === selectedStatus;

      // Se estiver no modo Vault ou pasta de placa, aplicar filtro de categoria técnica
      if ((isVaultMode || activePlate) && vaultCategory !== 'all') {
        if (vaultCategory === 'legal' && doc.category !== 'veiculos') return false;
        if (vaultCategory === 'insurance' && doc.category !== 'seguros') return false;
        if (vaultCategory === 'maintenance' && doc.category !== 'outros') return false;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [processedDocuments, search, selectedCategory, selectedStatus, fixedVehicleId, vaultCategory, activePlate, isVaultMode, vehicles]);

  // Obter ícone correspondente à categoria
  const getCategoryIcon = (category: DocumentVencimento['category']) => {
    switch (category) {
      case 'veiculos':
        return <Bus className="text-blue-400" size={18} />;
      case 'alvaras':
        return <FileCheck2 className="text-amber-400" size={18} />;
      case 'seguros':
        return <ShieldCheck className="text-emerald-400" size={18} />;
      case 'fiscais_contratos':
        return <FileSpreadsheet className="text-purple-400" size={18} />;
      case 'outros':
      default:
        return <Folder className="text-zinc-400" size={18} />;
    }
  };

  const getCategoryLabel = (category: DocumentVencimento['category']) => {
    switch (category) {
      case 'veiculos': return isFleetToolMode ? 'Licenciamento / CRLV' : 'Veículos / Frota';
      case 'alvaras': return 'Alvarás & Licenças';
      case 'seguros': return isFleetToolMode ? 'Seguros & Apólices' : 'Seguros';
      case 'fiscais_contratos': return 'Fiscais & Contratos';
      case 'outros': return isFleetToolMode ? 'Vistorias & Laudos' : 'Outros';
    }
  };

  // Forçar o download do arquivo (PDF ou Imagem)
  const downloadPdf = (docItem: DocumentVencimento) => {
    try {
      const link = document.createElement('a');
      link.href = docItem.pdfData;
      link.download = docItem.pdfName || `${docItem.name}.${isImageDocument(docItem) ? 'jpg' : 'pdf'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Download do documento iniciado!');
    } catch (e) {
      toast.error('Erro ao baixar o arquivo.');
    }
  };

  // Imprimir PDF ou Imagem
  const printPdf = (docItem: DocumentVencimento) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Erro ao abrir janela de impressão. Verifique se o bloqueador de popups está ativo.');
      return;
    }
    
    const isImage = isImageDocument(docItem);

    if (isImage) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir: ${docItem.name}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #fff; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; }
              @media print {
                img { max-width: 100%; max-height: 100%; }
              }
            </style>
          </head>
          <body>
            <img src="${docItem.pdfData}" alt="${docItem.name}" />
            <script>
              setTimeout(() => {
                window.print();
              }, 500);
            </script>
          </body>
        </html>
      `);
    } else {
      printWindow.document.write(`
        <html>
          <head>
            <title>Imprimir: ${docItem.name}</title>
            <style>
              body { margin: 0; display: flex; justify-content: center; background: #f0f0f0; }
              embed { width: 100%; height: 100vh; }
              @media print {
                embed { width: 100%; height: 100%; }
              }
            </style>
          </head>
          <body>
            <embed src="${docItem.pdfData}" type="application/pdf" />
            <script>
              setTimeout(() => {
                window.print();
              }, 1000);
            </script>
          </body>
        </html>
      `);
    }
    printWindow.document.close();
    toast.info('Preparando impressão...');
  };

  if (isFleetToolMode && !effectiveVehicleId) {
    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
            <ShieldCheck className="text-brand-accent" size={28} />
            Documentação da Frota
          </h2>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">
            Selecione um veículo para acessar o cofre digital de documentos técnicos e licenciamentos.
          </p>
        </div>

        {/* Busca de Veículo */}
        <div className="relative max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600" size={18} />
          <input
            type="text"
            placeholder="BUSCAR PELA PLACA OU MODELO..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-zinc-950 border border-zinc-900 rounded-2xl text-xs font-black uppercase text-white placeholder-zinc-700 focus:outline-none focus:border-brand-accent transition-all shadow-xl"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {vehicleFoldersSummary.filter(folder => 
            folder.plate.toLowerCase().includes(search.toLowerCase()) || 
            folder.model.toLowerCase().includes(search.toLowerCase())
          ).map(folder => (
            <motion.div
              key={folder.id}
              whileHover={{ scale: 1.02, translateY: -4 }}
              onClick={() => setFleetSelectedVehicleId(folder.id)}
              className="bg-zinc-900/40 border border-zinc-800 p-6 rounded-[2rem] hover:border-brand-accent/50 hover:bg-zinc-900/60 transition-all cursor-pointer group shadow-lg flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 bg-zinc-950 rounded-2xl border border-zinc-850 flex items-center justify-center text-brand-accent group-hover:scale-110 transition-transform">
                      <Bus size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white tracking-tighter uppercase leading-tight">{folder.plate}</h3>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">{folder.model}</p>
                    </div>
                  </div>

                  <span className={cn(
                    "text-[8px] font-black uppercase px-2.5 py-1 rounded-full border whitespace-nowrap",
                    folder.expiredCount > 0 ? "bg-red-500/10 text-red-500 border-red-500/20" :
                    folder.warningCount > 0 ? "bg-amber-500/10 text-amber-500 border-amber-500/20" :
                    "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                  )}>
                    {folder.expiredCount > 0 ? `${folder.expiredCount} Venc.` : folder.warningCount > 0 ? `${folder.warningCount} Alerta` : 'Em Dia'}
                  </span>
                </div>

                <div className="mt-4 px-3 py-2 bg-zinc-950/80 rounded-xl border border-zinc-850 flex items-center justify-between text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                  <span className="flex items-center gap-1.5">
                    <Folder size={12} className="text-brand-accent" />
                    Documentos e Fotos:
                  </span>
                  <span className="text-white font-black">{folder.totalDocs} item(ns)</span>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t border-zinc-850 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-brand-accent animate-pulse" />
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Abrir Pasta da Placa</span>
                </div>
                <ChevronRight size={16} className="text-zinc-600 group-hover:text-brand-accent transition-colors" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    );
  }

  if (isVaultMode) {
    const activeVehicle = vehicles.find(v => v.id === effectiveVehicleId);

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-500">
        {/* Vault Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 bg-zinc-950 p-8 rounded-[2.5rem] border border-zinc-900 shadow-2xl relative overflow-hidden">
          {/* Decoração de fundo */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-accent/5 blur-[100px] rounded-full -mr-32 -mt-32" />
          
          <div className="flex items-center gap-6 relative z-10">
            {isFleetToolMode && !fixedVehicleId && (
              <button 
                onClick={() => setFleetSelectedVehicleId(null)}
                className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl border border-zinc-850 transition-all cursor-pointer shadow-lg"
              >
                <X size={20} />
              </button>
            )}
            <div className="p-4 bg-brand-accent/10 rounded-[1.5rem] border border-brand-accent/20">
              <Folder className="text-brand-accent" size={28} />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black uppercase tracking-tighter text-white">
                  Cofre Digital: {activeVehicle?.plate}
                </h2>
                <span className="px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[9px] font-black text-zinc-500 uppercase tracking-widest">
                  {activeVehicle?.model}
                </span>
              </div>
              <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mt-1.5 flex items-center gap-2">
                <ShieldCheck size={12} className="text-emerald-500" />
                Repositório auditável de documentos e licenciamentos técnicos.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 relative z-10">
            <div className="flex bg-zinc-900 p-1 rounded-xl border border-zinc-800 shadow-inner">
               <button 
                 onClick={() => setViewMode('grid')}
                 className={cn("p-2.5 rounded-lg transition-all", viewMode === 'grid' ? "bg-zinc-800 text-brand-accent shadow-lg" : "text-zinc-600 hover:text-zinc-400")}
               >
                 <LayoutGrid size={16} />
               </button>
               <button 
                 onClick={() => setViewMode('list')}
                 className={cn("p-2.5 rounded-lg transition-all", viewMode === 'list' ? "bg-zinc-800 text-brand-accent shadow-lg" : "text-zinc-600 hover:text-zinc-400")}
               >
                 <List size={16} />
               </button>
            </div>
            <button
              onClick={() => setIsNewModalOpen(true)}
              className="px-8 py-3.5 bg-brand-accent hover:bg-white text-zinc-950 text-[10px] font-black uppercase tracking-widest rounded-2xl transition-all flex items-center gap-2 cursor-pointer shadow-xl shadow-brand-accent/20 active:scale-95"
            >
              <UploadCloud size={18} />
              Arquivar Documento
            </button>
          </div>
        </div>

        {/* Categories Tab Bar */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 scrollbar-hide">
          {(['all', 'legal', 'insurance', 'maintenance'] as const).map(cat => (
            <button 
              key={cat}
              onClick={() => setVaultCategory(cat)}
              className={cn(
                "px-7 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap border shadow-md",
                vaultCategory === cat 
                  ? "bg-white text-zinc-950 border-white font-black" 
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-300"
              )}
            >
              {cat === 'all' ? `Todos (${filteredDocuments.length})` : 
               cat === 'legal' ? 'Licenciamento & CRLV' :
               cat === 'insurance' ? 'Seguros & Apólices' :
               'Vistorias & Laudos'}
            </button>
          ))}
        </div>

        {/* Vault Content Grid */}
        {filteredDocuments.length === 0 ? (
          <div className="py-24 bg-zinc-950/50 border-2 border-dashed border-zinc-900 rounded-3xl flex flex-col items-center justify-center text-center px-6">
            <div className="p-6 bg-zinc-900 rounded-3xl mb-6 border border-zinc-800">
              <FileText className="text-zinc-600" size={48} />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Cofre Vazio</h3>
            <p className="text-zinc-500 text-xs mt-2 max-w-md uppercase tracking-wider leading-relaxed">
              Você ainda não anexou nenhum documento PDF para este ativo. Clique no botão acima para escanear ou carregar o CRLV, Seguro ou Laudos Técnicos.
            </p>
          </div>
        ) : (
          <div className={cn(
            "grid gap-6",
            viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
          )}>
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((docItem) => {
                const isExpired = docItem.status === 'expired';
                const isWarning = docItem.status === 'warning';

                if (viewMode === 'list') {
                  return (
                    <motion.div
                      key={docItem.id}
                      layout
                      className="bg-zinc-950 p-4 rounded-2xl border border-zinc-900 flex items-center justify-between group hover:border-zinc-700 transition-all shadow-lg"
                    >
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className={cn(
                          "p-3 rounded-xl border",
                          isExpired ? "bg-red-500/10 border-red-500/20 text-red-500" : 
                          isWarning ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : 
                          "bg-zinc-900 border-zinc-800 text-zinc-400"
                        )}>
                          <FileText size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-black text-white uppercase truncate tracking-wider">{docItem.name}</h4>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                              <Calendar size={10} />
                              Vence: {format(parseISO(docItem.dueDate), 'dd MMM yyyy', { locale: ptBR })}
                            </span>
                            <span className={cn(
                              "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                              isExpired ? "bg-red-500/10 text-red-500" : isWarning ? "bg-amber-500/10 text-amber-500" : "bg-emerald-500/10 text-emerald-500"
                            )}>
                              {docItem.status === 'expired' ? 'Expirado' : docItem.status === 'warning' ? 'Alerta' : 'Vigente'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setSelectedDocument(docItem)}
                          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-brand-accent rounded-xl border border-zinc-800 transition-all cursor-pointer"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => printPdf(docItem)}
                          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all cursor-pointer"
                        >
                          <Printer size={16} />
                        </button>
                        <button 
                          onClick={() => downloadPdf(docItem)}
                          className="p-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all cursor-pointer"
                        >
                          <Download size={16} />
                        </button>
                        <button 
                          onClick={() => setDocumentToDelete(docItem)}
                          className="p-2.5 bg-zinc-900 hover:bg-red-950/30 text-zinc-600 hover:text-red-500 rounded-xl border border-zinc-800 hover:border-red-500/30 transition-all cursor-pointer"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  );
                }

                return (
                  <motion.div
                    key={docItem.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={cn(
                      "bg-zinc-950 rounded-3xl border p-6 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-2xl group relative overflow-hidden",
                      isExpired ? "border-red-500/20 shadow-red-950/10" : 
                      isWarning ? "border-amber-500/20 shadow-amber-950/10" : 
                      "border-zinc-900 shadow-black/40"
                    )}
                  >
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div className={cn(
                          "p-4 rounded-2xl border",
                          isExpired ? "bg-red-500/10 border-red-500/20 text-red-500" : 
                          isWarning ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : 
                          "bg-zinc-900 border-zinc-800 text-zinc-400"
                        )}>
                          <FileText size={24} />
                        </div>
                        <div className="text-right">
                          <p className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border inline-block",
                            isExpired ? "bg-red-500/10 border-red-500/20 text-red-500" : 
                            isWarning ? "bg-amber-500/10 border-amber-500/20 text-amber-500" : 
                            "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                          )}>
                            {docItem.status === 'expired' ? 'Expirado' : docItem.status === 'warning' ? 'Alerta' : 'Regular'}
                          </p>
                          <p className="text-[8px] font-black text-zinc-600 uppercase mt-2 tracking-widest">
                            ID: {docItem.id.slice(-6)}
                          </p>
                        </div>
                      </div>

                      {isImageDocument(docItem) && docItem.pdfData && (
                        <div 
                          onClick={() => setSelectedDocument(docItem)}
                          className="h-32 w-full rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-800 relative group/thumb cursor-pointer shadow-inner"
                        >
                          <img 
                            src={docItem.pdfData} 
                            alt={docItem.name} 
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          />
                          <div className="absolute inset-0 bg-black/30 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                            <span className="px-2.5 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[8px] font-black text-white uppercase tracking-wider opacity-0 group-hover/thumb:opacity-100 transition-opacity">
                              Ampliar Foto / Anexo
                            </span>
                          </div>
                        </div>
                      )}

                      <div>
                        <h4 className="text-sm font-black text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight leading-tight">
                          {docItem.name}
                        </h4>
                        <p className="text-[9px] font-black text-zinc-500 uppercase mt-1 tracking-widest">
                          {getCategoryLabel(docItem.category)}
                        </p>
                      </div>

                      <div className="bg-zinc-900/60 p-4 rounded-2xl space-y-3 border border-white/5">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar size={12} className="text-[#ff6b00]" />
                            Vencimento
                          </span>
                          <span className="text-[10px] font-black text-zinc-200">
                            {format(parseISO(docItem.dueDate), 'dd/MM/yyyy')}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Info size={12} className="text-blue-500" />
                            Prazo Restante
                          </span>
                          <span className={cn(
                            "text-[10px] font-black",
                            isExpired ? "text-red-500" : isWarning ? "text-amber-500" : "text-emerald-500"
                          )}>
                            {docItem.daysRemaining < 0 ? `${Math.abs(docItem.daysRemaining)}d em atraso` : `${docItem.daysRemaining} dias`}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-6">
                      <button
                        onClick={() => setSelectedDocument(docItem)}
                        className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-zinc-800 flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                      >
                        <Eye size={14} className="text-brand-accent" />
                        Visualizar
                      </button>
                      <button
                        onClick={() => printPdf(docItem)}
                        className="py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-zinc-800 flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-95"
                      >
                        <Printer size={14} className="text-blue-400" />
                        Imprimir
                      </button>
                    </div>

                    {/* Quick action bar on hover */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all flex gap-1">
                       <button onClick={() => downloadPdf(docItem)} className="p-2 bg-zinc-900/80 backdrop-blur-md rounded-lg text-zinc-400 hover:text-white border border-white/5 transition-all cursor-pointer">
                         <Download size={14} />
                       </button>
                       <button onClick={() => setDocumentToDelete(docItem)} className="p-2 bg-zinc-900/80 backdrop-blur-md rounded-lg text-zinc-500 hover:text-red-500 border border-white/5 transition-all cursor-pointer">
                         <Trash2 size={14} />
                       </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {renderModals()}
      </div>
    );
  }

  // Helper para renderizar os modais (extraído para evitar duplicação no return customizado)
  function renderModals() {
    return (
      <>
        {/* MODAL: REGISTRAR NOVO DOCUMENTO */}
        <AnimatePresence>
          {isNewModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-lg p-8 max-h-[90vh] overflow-y-auto shadow-2xl relative"
              >
                <button
                  onClick={() => setIsNewModalOpen(false)}
                  className="absolute top-6 right-6 text-zinc-400 hover:text-white cursor-pointer p-2 hover:bg-zinc-900 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>

                <div className="flex items-center gap-3 border-b border-zinc-900 pb-6 mb-8">
                  <div className="p-3 bg-[#ff6b00]/10 rounded-2xl border border-[#ff6b00]/20">
                    <FileText className="text-[#ff6b00]" size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black uppercase text-white tracking-tighter">Lançar Novo Documento</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">Armazenamento em Nuvem & Auditoria</p>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Título do Documento */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Título do Documento *</label>
                    <input
                      type="text"
                      required
                      placeholder="EX: SEGURO OBRIGATÓRIO DPVAT 2026"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xs text-white placeholder-zinc-600 uppercase focus:outline-none focus:border-[#ff6b00] transition-all shadow-inner"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Categoria *</label>
                      <select
                        value={formCategory}
                        onChange={(e) => setFormCategory(e.target.value as any)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-all cursor-pointer shadow-inner appearance-none"
                      >
                        <option value="veiculos">LICENCIAMENTO / CRLV</option>
                        {!isFleetToolMode && <option value="alvaras">ALVARÁS & LICENÇAS</option>}
                        <option value="seguros">SEGUROS & APÓLICES</option>
                        {!isFleetToolMode && <option value="fiscais_contratos">FISCAIS & CONTRATOS</option>}
                        <option value="outros">{isFleetToolMode ? 'VISTORIAS & LAUDOS' : 'OUTROS DOCUMENTOS'}</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Data de Vencimento *</label>
                      <input
                        type="date"
                        required
                        value={formDueDate}
                        onChange={(e) => setFormDueDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-all shadow-inner"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Avisar com (Dias) *</label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={formThreshold}
                        onChange={(e) => setFormThreshold(Math.max(1, Number(e.target.value)))}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Vínculo Ativo</label>
                      <select
                        value={formVehicleId}
                        onChange={(e) => setFormVehicleId(e.target.value)}
                        disabled={!!fixedVehicleId}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-[#ff6b00] transition-all disabled:opacity-50 appearance-none shadow-inner"
                      >
                        {!fixedVehicleId && <option value="">NENHUM VÍNCULO</option>}
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.plate.toUpperCase()} - {v.model.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-widest ml-1">Anexo do Documento (PDF ou Foto) *</label>

                    {/* Botões de Escolha do Arquivo ou Foto */}
                    {!pdfData && !isUploading && !isExtractingWithAi && (
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="py-3 px-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 border border-zinc-800 hover:border-zinc-700 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                        >
                          <UploadCloud size={16} className="text-brand-accent" />
                          Escolher Arquivo
                        </button>

                        <button
                          type="button"
                          onClick={startCamera}
                          className="py-3 px-4 bg-brand-accent/10 hover:bg-brand-accent/20 text-brand-accent border border-brand-accent/30 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
                        >
                          <Camera size={16} />
                          Tirar Foto com IA
                        </button>
                      </div>
                    )}

                    <input 
                      type="file" 
                      accept="application/pdf,image/*" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                    />

                    <div className={cn(
                      "border-2 border-dashed rounded-3xl p-8 text-center flex flex-col items-center justify-center transition-all relative overflow-hidden",
                      pdfData ? "border-emerald-500 bg-emerald-500/5" : "border-zinc-800 hover:border-brand-accent hover:bg-zinc-900/50"
                    )}>
                      {!pdfData && (
                        <input 
                          type="file" 
                          accept="application/pdf,image/*" 
                          onChange={handleFileChange} 
                          className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                      )}
                      
                      {isUploading ? (
                        <div className="animate-pulse flex flex-col items-center">
                          <div className="w-8 h-8 border-4 border-zinc-800 border-t-zinc-400 rounded-full animate-spin mb-3"></div>
                          <p className="text-[10px] font-black uppercase text-zinc-500">Processando foto/documento...</p>
                        </div>
                      ) : isExtractingWithAi ? (
                        <div className="flex flex-col items-center">
                          <Sparkles className="text-amber-500 animate-bounce mb-3" size={32} />
                          <p className="text-[10px] font-black uppercase text-amber-500 animate-pulse tracking-widest">IA LENDO E EXTRAINDO DADOS DO DOCUMENTO...</p>
                        </div>
                      ) : pdfData ? (
                        <div className="flex flex-col items-center">
                          {isImageDocument({ pdfData, pdfName }) ? (
                            <div className="relative mb-3 group">
                              <img src={pdfData} className="w-24 h-24 object-cover rounded-2xl border-2 border-emerald-500/50 shadow-xl" alt="Preview da Foto" />
                              <div className="absolute inset-0 bg-black/40 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye size={20} className="text-white" />
                              </div>
                            </div>
                          ) : (
                            <FileText className="text-emerald-500 mb-3" size={32} />
                          )}
                          <p className="text-[10px] font-black text-white uppercase max-w-[200px] truncate">{pdfName}</p>
                          <p className="text-[9px] font-bold text-zinc-500 uppercase mt-1 mb-4">{pdfSize}</p>
                          <div className="flex gap-2 relative z-10">
                            <button type="button" onClick={() => setPdfData('')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-[9px] font-black uppercase border border-zinc-800 transition-all cursor-pointer">Substituir</button>
                            <button type="button" onClick={() => handleExtractData(pdfData, pdfData.startsWith('data:image/') ? 'image/jpeg' : 'application/pdf')} className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-[9px] font-black uppercase border border-amber-500/30 text-amber-500 flex items-center gap-1 transition-all cursor-pointer"><Sparkles size={10} /> Reanalisar com IA</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center group">
                          <div className="flex items-center gap-3 mb-3 text-zinc-600 group-hover:text-brand-accent transition-colors">
                            <UploadCloud size={28} />
                            <Camera size={28} />
                          </div>
                          <p className="text-[10px] font-black uppercase text-zinc-300">Arraste, selecione arquivo ou tire uma foto</p>
                          <p className="text-[9px] font-bold text-zinc-600 uppercase mt-1">Formatos aceitos: PDF, JPG, PNG, WEBP (Comprimido via IA)</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-4 pt-6">
                    <button type="button" onClick={() => setIsNewModalOpen(false)} className="flex-1 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-zinc-800 transition-all cursor-pointer">Cancelar</button>
                    <button type="submit" className="flex-[2] py-4 bg-[#ff6b00] hover:bg-[#e05e00] text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-orange-500/20 transition-all cursor-pointer active:scale-95">Salvar no Cofre</button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: FICHA DO DOCUMENTO */}
        <AnimatePresence>
          {selectedDocument && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-5xl h-[90vh] flex flex-col shadow-2xl relative overflow-hidden"
              >
                <div className="p-6 border-b border-zinc-900 flex items-center justify-between bg-zinc-900/20">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-zinc-900 rounded-2xl border border-zinc-800 text-brand-accent">
                      <FileText size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black uppercase text-white tracking-tighter leading-none">{selectedDocument.name}</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1.5 flex items-center gap-2">
                        {getCategoryLabel(selectedDocument.category)} • Expira em {format(parseISO(selectedDocument.dueDate), 'dd/MM/yyyy')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => printPdf(selectedDocument)} className="px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-800 transition-all flex items-center gap-2 cursor-pointer">
                      <Printer size={16} className="text-blue-400" /> Imprimir
                    </button>
                    <button onClick={() => downloadPdf(selectedDocument)} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all cursor-pointer">
                      <Download size={18} />
                    </button>
                    <button onClick={() => setSelectedDocument(null)} className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl border border-zinc-800 transition-all cursor-pointer">
                      <X size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-zinc-900/20">
                  {/* Detalhes do Documento (Painel Lateral) */}
                  <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-zinc-900 p-6 space-y-6 overflow-y-auto bg-zinc-950/50">
                    <div className="space-y-4">
                      <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest border-b border-white/5 pb-2">Informações do Arquivo</h4>
                      
                      <div className="space-y-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Calendar size={12} className="text-zinc-500" /> Vencimento
                          </span>
                          <span className={cn(
                            "text-xs font-black uppercase",
                            selectedDocument.status === 'expired' ? "text-red-500" : 
                            selectedDocument.status === 'warning' ? "text-amber-500" : "text-emerald-500"
                          )}>
                            {format(parseISO(selectedDocument.dueDate), 'dd/MM/yyyy')}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <ShieldCheck size={12} className="text-zinc-500" /> Categoria
                          </span>
                          <span className="text-xs font-black text-white uppercase">
                            {getCategoryLabel(selectedDocument.category)}
                          </span>
                        </div>

                        {selectedDocument.vehicleId && (
                          <div className="flex flex-col gap-1">
                            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                              <Bus size={12} className="text-zinc-500" /> Ativo Vinculado
                            </span>
                            <div className="p-2.5 bg-zinc-900 rounded-xl border border-white/5">
                              <span className="text-[10px] font-black text-white uppercase block">{selectedDocument.vehiclePlate}</span>
                              <span className="text-[8px] font-bold text-zinc-500 uppercase block">{selectedDocument.vehicleModel}</span>
                            </div>
                          </div>
                        )}

                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <Folder size={12} className="text-zinc-500" /> Nome Original
                          </span>
                          <span className="text-[9px] font-mono text-zinc-400 break-all leading-tight">
                            {selectedDocument.pdfName}
                          </span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                            <FileCheck2 size={12} className="text-zinc-500" /> Tamanho
                          </span>
                          <span className="text-[10px] font-black text-zinc-300 uppercase">
                            {selectedDocument.pdfSize}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest pb-2 border-b border-white/5">Ações Rápidas</h4>
                      <div className="grid grid-cols-1 gap-2">
                        <button 
                          onClick={() => printPdf(selectedDocument)}
                          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-white text-[9px] font-black uppercase tracking-widest rounded-xl border border-zinc-800 transition-all flex items-center justify-center gap-2"
                        >
                          <Printer size={14} /> Imprimir Cópia
                        </button>
                        <button 
                          onClick={() => downloadPdf(selectedDocument)}
                          className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-[9px] font-black uppercase tracking-widest rounded-xl border border-zinc-800 transition-all flex items-center justify-center gap-2"
                        >
                          <Download size={14} /> Baixar PDF
                        </button>
                        <button 
                          onClick={() => setDocumentToDelete(selectedDocument)}
                          className="w-full py-3 bg-red-950/20 hover:bg-red-900/30 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2"
                        >
                          <Trash2 size={14} /> Excluir Arquivo
                        </button>
                      </div>
                    </div>

                    <div className="p-4 bg-zinc-900/30 rounded-2xl border border-white/5 flex items-start gap-3">
                      <AlertCircle size={16} className="text-brand-accent shrink-0 mt-0.5" />
                      <p className="text-[9px] text-zinc-500 font-bold uppercase leading-relaxed tracking-wider">
                        Documento armazenado em cofre digital auditável. Toda visualização e impressão é registrada no log de segurança.
                      </p>
                    </div>
                  </div>

                  {/* Visualizador de PDF ou Imagem */}
                  <div className="flex-1 bg-zinc-900/60 relative flex items-center justify-center p-4 overflow-auto">
                    {isImageDocument(selectedDocument) ? (
                      <img 
                        src={selectedDocument.pdfData} 
                        className="max-h-full max-w-full object-contain rounded-2xl shadow-2xl border border-white/10" 
                        alt={selectedDocument.name} 
                      />
                    ) : (
                      <iframe 
                        src={selectedDocument.pdfData} 
                        className="w-full h-full border-none bg-white/5" 
                        title="Leitor PDF" 
                      />
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: CÂMERA AO VIVO DE DOCUMENTOS */}
        <AnimatePresence>
          {isLiveCameraOpen && (
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-lg p-6 flex flex-col shadow-2xl relative overflow-hidden"
              >
                <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Camera className="text-brand-accent" size={20} />
                    <h3 className="text-xs font-black uppercase tracking-wider text-white">Fotografar Documento com IA</h3>
                  </div>
                  <button onClick={stopCamera} className="text-zinc-500 hover:text-white p-2 rounded-xl transition-all cursor-pointer">
                    <X size={18} />
                  </button>
                </div>

                {cameraError ? (
                  <div className="p-8 text-center space-y-4">
                    <AlertCircle className="mx-auto text-red-500" size={40} />
                    <p className="text-xs font-bold text-zinc-400 uppercase leading-relaxed">{cameraError}</p>
                    <button
                      onClick={() => {
                        stopCamera();
                        fileInputRef.current?.click();
                      }}
                      className="px-6 py-3 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl text-[10px] font-black uppercase border border-zinc-800 cursor-pointer"
                    >
                      Usar Seletor de Arquivos
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative aspect-[4/3] bg-black rounded-2xl overflow-hidden border border-zinc-800 flex items-center justify-center">
                      <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                      <div className="absolute inset-6 border-2 border-dashed border-brand-accent/50 rounded-2xl pointer-events-none flex items-center justify-center">
                        <p className="text-[9px] font-black text-white/70 uppercase tracking-widest bg-black/60 px-3 py-1 rounded-full backdrop-blur-sm">
                          Centralize o documento na moldura
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-2">
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-5 py-3 bg-zinc-900 text-zinc-400 hover:text-white rounded-2xl text-[10px] font-black uppercase border border-zinc-800 cursor-pointer"
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        onClick={captureCameraPhoto}
                        className="flex-1 py-3 bg-brand-accent hover:bg-white text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-xl shadow-brand-accent/20 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                      >
                        <Camera size={16} /> Capturar & Ler com IA
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MODAL: CONFIRMAR EXCLUSÃO */}
        <AnimatePresence>
          {documentToDelete && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-zinc-950 border border-zinc-900 rounded-3xl w-full max-w-sm p-8 text-center shadow-2xl"
              >
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                  <Trash2 size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Remover do Cofre?</h3>
                <p className="text-zinc-500 text-xs mt-3 uppercase tracking-widest leading-relaxed">
                  Esta ação é irreversível. O arquivo e os dados de vencimento serão apagados permanentemente.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-8">
                  <button onClick={() => setDocumentToDelete(null)} className="py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-black uppercase tracking-widest rounded-2xl border border-zinc-800 transition-all cursor-pointer">Abortar</button>
                  <button onClick={handleConfirmDelete} className="py-4 bg-red-600 hover:bg-red-500 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-red-500/20 transition-all cursor-pointer active:scale-95">Confirmar</button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </>
    );
  }

  // Retorno padrão para visão geral do Financeiro (mantendo original com pequenos polimentos se necessário)
  return (
    <div id="vencimentos-container" className="space-y-6">
      
      {/* Header e Botão Novo Documento */}
      {!hideHeader && (
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950 p-6 rounded-2xl border border-zinc-900">
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white flex items-center gap-2">
              <FileText className="text-[#ff6b00]" size={22} />
              Pasta de Documentos & Controle de Vencimentos
            </h2>
            <p className="text-zinc-500 text-xs mt-1 uppercase tracking-wider">
              Arquivamento seguro de documentos corporativos, controle de alertas de vencimento e auditoria de arquivos PDF.
            </p>
          </div>
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-5 py-2.5 bg-[#ff6b00] hover:bg-[#e05e00] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/10"
          >
            <Plus size={16} />
            Novo Documento
          </button>
        </div>
      )}

      {hideHeader && (
        <div className="flex justify-end">
          <button
            onClick={() => setIsNewModalOpen(true)}
            className="px-5 py-2.5 bg-[#ff6b00] hover:bg-[#e05e00] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow-lg shadow-orange-500/10"
          >
            <Plus size={16} />
            Anexar Novo Documento ao Ativo
          </button>
        </div>
      )}

      {/* Grid de KPIs Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KPI Total */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Total de Documentos</p>
            <h3 className="text-2xl font-black text-white mt-1">{kpis.total}</h3>
          </div>
          <div className="p-3 bg-zinc-800/40 rounded-xl text-zinc-400">
            <FileText size={20} />
          </div>
        </div>

        {/* KPI Vencidos */}
        <div className={cn(
          "border p-5 rounded-2xl flex items-center justify-between transition-all",
          kpis.expired > 0 
            ? "bg-red-950/20 border-red-500/20 text-red-500" 
            : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
        )}>
          <div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Vencidos (Crítico)</p>
            <h3 className={cn("text-2xl font-black mt-1", kpis.expired > 0 ? "text-red-500" : "text-white")}>
              {kpis.expired}
            </h3>
          </div>
          <div className={cn("p-3 rounded-xl", kpis.expired > 0 ? "bg-red-500/10 text-red-500" : "bg-zinc-800/40")}>
            <AlertCircle size={20} />
          </div>
        </div>

        {/* KPI Alerta */}
        <div className={cn(
          "border p-5 rounded-2xl flex items-center justify-between transition-all",
          kpis.warning > 0 
            ? "bg-amber-950/20 border-amber-500/20 text-amber-500" 
            : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
        )}>
          <div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Vencendo nos Próximos Dias</p>
            <h3 className={cn("text-2xl font-black mt-1", kpis.warning > 0 ? "text-amber-500" : "text-white")}>
              {kpis.warning}
            </h3>
          </div>
          <div className={cn("p-3 rounded-xl", kpis.warning > 0 ? "bg-amber-500/10 text-amber-500" : "bg-zinc-800/40")}>
            <AlertTriangle size={20} />
          </div>
        </div>

        {/* KPI Em Dia */}
        <div className="bg-zinc-900/40 border border-zinc-800 p-5 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-zinc-500 text-[10px] font-black uppercase tracking-wider">Documentos Em Dia</p>
            <h3 className="text-2xl font-black text-white mt-1">{kpis.regular}</h3>
          </div>
          <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl">
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      {/* Painel Principal de Filtros e Listagem */}
      <div className="bg-zinc-900/20 border border-zinc-900 rounded-2xl p-6 space-y-6">
        
        {/* Banner de Pasta de Placa Ativa */}
        {activePlate && (
          <div className="bg-brand-accent/10 border border-brand-accent/30 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-brand-accent/20 rounded-xl text-brand-accent">
                <Folder size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    PASTA DO VEÍCULO: {activePlate}
                  </h3>
                  <span className="px-2.5 py-0.5 bg-brand-accent text-zinc-950 font-black text-[9px] rounded-md uppercase">
                    {vehicles.find(v => v.plate.trim().toUpperCase() === activePlate.trim().toUpperCase())?.model || 'Ativo DM Turismo'}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest mt-1">
                  Exibindo exclusivamente os {filteredDocuments.length} documentos e fotos vinculados a esta placa.
                </p>
              </div>
            </div>

            <button
              onClick={() => setSelectedPlateFolder(null)}
              className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-zinc-800 transition-all cursor-pointer flex items-center gap-2"
            >
              <ChevronLeft size={14} />
              Ver Todas as Pastas de Placas
            </button>
          </div>
        )}

        {/* Grid de Pastas por Placa de Veículo (Exibido se categoria Veículos selecionada e nenhuma placa específica aberta) */}
        {selectedCategory === 'veiculos' && !activePlate && (
          <div className="bg-zinc-950 p-5 rounded-2xl border border-zinc-855 space-y-4 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Folder className="text-brand-accent" size={16} />
                  Pastas de Documentos e Fotos por Placa ({vehicleFoldersSummary.length})
                </h3>
                <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">
                  Clique na pasta da placa desejada para visualizar e gerenciar exclusivamente seus arquivos e fotos de vistoria.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {vehicleFoldersSummary.map(folder => (
                <button
                  key={folder.plate}
                  onClick={() => setSelectedPlateFolder(folder.plate)}
                  className="bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800 hover:border-brand-accent p-3.5 rounded-xl text-left transition-all group flex flex-col justify-between h-24 cursor-pointer relative overflow-hidden shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <span className="p-1.5 bg-zinc-950 rounded-lg text-brand-accent group-hover:scale-110 transition-transform">
                      <Bus size={14} />
                    </span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full",
                      folder.expiredCount > 0 ? "bg-red-500/10 text-red-500 border border-red-500/20" :
                      folder.warningCount > 0 ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" :
                      "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    )}>
                      {folder.expiredCount > 0 ? `${folder.expiredCount} Venc.` : folder.warningCount > 0 ? `${folder.warningCount} Alerta` : 'Em Dia'}
                    </span>
                  </div>

                  <div>
                    <h4 className="text-xs font-black text-white group-hover:text-brand-accent uppercase tracking-wider">
                      {folder.plate}
                    </h4>
                    <p className="text-[8px] text-zinc-500 uppercase tracking-widest truncate mt-0.5">
                      {folder.totalDocs} doc(s) • {folder.model}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Barra de Filtros */}
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
          
          {/* Busca */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
            <input
              type="text"
              placeholder="BUSCAR DOCUMENTO PELO TÍTULO OU PLACA..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 bg-zinc-950 border border-zinc-855 rounded-xl text-xs uppercase text-white placeholder-zinc-500 focus:outline-none focus:border-[#ff6b00]"
            />
          </div>

          {/* Categoria */}
          <div className="flex flex-wrap gap-2">
            {(['all', 'veiculos', 'alvaras', 'seguros', 'fiscais_contratos', 'outros'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border cursor-pointer",
                  selectedCategory === cat
                    ? "bg-[#ff6b00] border-[#ff6b00] text-white"
                    : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white"
                )}
              >
                {cat === 'all' ? 'TODOS' : getCategoryLabel(cat)}
              </button>
            ))}
          </div>

          {/* Status */}
          <div className="flex gap-2">
            {(['all', 'expired', 'warning', 'regular'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={cn(
                  "px-3 py-2 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all border cursor-pointer",
                  selectedStatus === st
                    ? "bg-zinc-100 border-zinc-100 text-zinc-950 font-black"
                    : "bg-zinc-950 border-zinc-900 text-zinc-500 hover:text-zinc-300"
                )}
              >
                {st === 'all' ? 'STATUS: TODOS' : st === 'expired' ? '🔴 VENCIDOS' : st === 'warning' ? '🟡 ALERTA' : '🟢 EM DIA'}
              </button>
            ))}
          </div>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <div className="w-8 h-8 border-4 border-zinc-800 border-t-[#ff6b00] rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-500 uppercase tracking-widest animate-pulse">Carregando documentos da nuvem...</p>
          </div>
        ) : filteredDocuments.length === 0 ? (
          /* Empty State */
          <div className="py-20 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center px-4">
            <FileText className="text-zinc-600 mb-4" size={44} />
            <p className="text-sm text-zinc-300 font-bold uppercase tracking-wider">Nenhum documento encontrado</p>
            <p className="text-xs text-zinc-500 mt-1 max-w-sm uppercase tracking-wider">
              Nenhum documento coincide com os filtros aplicados ou ainda não há registros nesta categoria.
            </p>
          </div>
        ) : (
          /* Lista de Documentos em Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence mode="popLayout">
              {filteredDocuments.map((docItem) => {
                const isExpired = docItem.status === 'expired';
                const isWarning = docItem.status === 'warning';

                return (
                  <motion.div
                    key={docItem.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      "bg-zinc-950 rounded-2xl border p-5 flex flex-col justify-between hover:border-zinc-700 transition-all shadow-md group relative overflow-hidden",
                      isExpired ? "border-red-500/20 hover:border-red-500/40 shadow-red-950/5" : 
                      isWarning ? "border-amber-500/20 hover:border-amber-500/40 shadow-amber-950/5" : 
                      "border-zinc-900"
                    )}
                  >
                    {/* Efeito luminoso de status */}
                    <div className={cn(
                      "absolute top-0 right-0 w-24 h-24 -mr-12 -mt-12 rounded-full blur-2xl opacity-10 pointer-events-none",
                      isExpired ? "bg-red-500" : isWarning ? "bg-amber-500" : "bg-emerald-500"
                    )} />

                    {/* Header do Card */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="p-2.5 bg-zinc-900/60 rounded-xl border border-zinc-850">
                          {getCategoryIcon(docItem.category)}
                        </span>
                        
                        {/* Status Badge */}
                        <span className={cn(
                          "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg border",
                          isExpired 
                            ? "bg-red-500/10 border-red-500/30 text-red-500" 
                            : isWarning 
                            ? "bg-amber-500/10 border-amber-500/30 text-amber-500" 
                            : "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        )}>
                          {isExpired ? 'Vencido' : isWarning ? 'Vencendo em breve' : 'Em Dia'}
                        </span>
                      </div>

                      {/* Título e Detalhes */}
                      <div>
                        <h4 className="text-sm font-black text-white group-hover:text-[#ff6b00] transition-colors line-clamp-1 uppercase">
                          {docItem.name}
                        </h4>
                        <p className="text-[10px] text-zinc-500 uppercase mt-0.5 font-bold">
                          {getCategoryLabel(docItem.category)}
                        </p>
                      </div>

                      {/* Veículo Vinculado (Se Houver) */}
                      {docItem.vehicleId && (
                        <div className="flex items-center gap-2 bg-zinc-900/40 p-2.5 rounded-xl border border-zinc-850">
                          <Bus size={14} className="text-zinc-500" />
                          <div className="text-[9px] uppercase tracking-wider font-bold">
                            <span className="text-zinc-400">Veículo:</span>{' '}
                            <span className="text-white font-black">{docItem.vehiclePlate}</span>{' '}
                            <span className="text-zinc-500">({docItem.vehicleModel})</span>
                          </div>
                        </div>
                      )}

                      {/* Linha do Vencimento */}
                      <div className="flex items-center gap-2 text-zinc-400 text-xs py-1">
                        <Calendar size={14} className="text-zinc-500" />
                        <div className="text-[10px] uppercase font-bold tracking-wider">
                          Vence em:{' '}
                          <span className="text-zinc-200 font-black">
                            {format(parseISO(docItem.dueDate), 'dd/MM/yyyy')}
                          </span>
                        </div>
                      </div>

                      {/* Countdown de Dias */}
                      <div className={cn(
                        "text-[10px] uppercase font-black tracking-wider p-2.5 rounded-xl border",
                        isExpired 
                          ? "bg-red-500/5 border-red-500/10 text-red-500" 
                          : isWarning 
                          ? "bg-amber-500/5 border-amber-500/10 text-amber-500" 
                          : "bg-emerald-500/5 border-emerald-500/10 text-emerald-500"
                      )}>
                        {isExpired 
                          ? `⚠️ DOCUMENTO EXPIRADO HÁ ${Math.abs(docItem.daysRemaining)} DIAS` 
                          : isWarning 
                          ? `⏱️ ATENÇÃO: VENCE EM ${docItem.daysRemaining} DIAS` 
                          : `✓ OK: RESTAM ${docItem.daysRemaining} DIAS`
                        }
                      </div>
                    </div>

                    {/* Rodapé do Card com Ações */}
                    <div className="flex gap-2 mt-5 border-t border-zinc-900 pt-4">
                      
                      {/* Abrir Ficha do Documento */}
                      <button
                        onClick={() => setSelectedDocument(docItem)}
                        className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 border border-zinc-800 cursor-pointer"
                      >
                        <Eye size={13} className="text-[#ff6b00]" />
                        Ver Ficha
                      </button>


                      {/* Baixar PDF Direto */}
                      <button
                        onClick={() => downloadPdf(docItem)}
                        title="Baixar PDF original"
                        className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                      >
                        <Download size={13} />
                      </button>

                      {/* Remover Documento */}
                      <button
                        onClick={() => setDocumentToDelete(docItem)}
                        title="Excluir Documento"
                        className="p-2 bg-zinc-900 hover:bg-red-950/30 border border-zinc-800 hover:border-red-500/30 text-zinc-500 hover:text-red-500 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Re-use Modais do componente principal */}
      {renderModals()}
    </div>
  );
};
