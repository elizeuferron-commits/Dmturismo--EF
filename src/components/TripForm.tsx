import React, { useState, useEffect } from 'react';
import { PhotoGallery } from './PhotoGallery';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Bus, 
  User,
  Hash,
  Info,
  Clock,
  Navigation,
  SquareCheck,
  Globe,
  Map,
  ShieldCheck,
  Plus,
  Trash2,
  ListChecks,
  Edit2,
  Check,
  CheckCircle,
  Paperclip,
  Image as ImageIcon,
  FileText as FileIcon,
  FileSpreadsheet as ExcelIcon,
  X,
  FileText,
  ClipboardPaste,
  Download,
  Copy,
  Sparkles,
  Loader2,
  Eye,
  Compass,
  Hotel,
  Utensils,
  DollarSign,
  Building2,
  CreditCard,
  Layers
} from 'lucide-react';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Button, ConfirmModal } from './UI';
import { Vehicle, Employee, Trip, Passenger } from '../types';
import { cn, getApiUrl } from '../lib/utils';
import { toast } from 'sonner';
import { APIProvider, useMapsLibrary } from '@vis.gl/react-google-maps';

const API_KEY =
  process.env.GOOGLE_MAPS_PLATFORM_KEY ||
  (import.meta as any).env?.VITE_GOOGLE_MAPS_PLATFORM_KEY ||
  (globalThis as any).GOOGLE_MAPS_PLATFORM_KEY ||
  '';

const hasValidKey = Boolean(API_KEY) && API_KEY !== 'YOUR_API_KEY' && API_KEY !== '';

interface CalculatorProps {
  origin: string;
  destination: string;
  stops: { location: string; arrivalTime: string }[];
  onApplyNotes?: (routeInfo: string) => void;
}

function GeographicRouteCalculatorInner({ origin, destination, stops, onApplyNotes }: CalculatorProps) {
  const routesLib = useMapsLibrary('routes');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    distanceText: string;
    durationText: string;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!routesLib || !origin.trim() || !destination.trim()) {
      setResult(null);
      setErrorMsg(null);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);
      setErrorMsg(null);

      const waypoints = (stops || []).map(s => ({
        location: s.location,
        stopover: true
      }));

      routesLib.Route.computeRoutes({
        origin: origin,
        destination: destination,
        intermediates: waypoints,
        travelMode: 'DRIVING',
        fields: ['distanceMeters', 'durationMillis'],
      })
        .then(({ routes }) => {
          setLoading(false);
          if (routes?.[0]) {
            const route = routes[0];
            const distanceKm = route.distanceMeters / 1000;
            const distanceText = `${distanceKm.toFixed(1)} KM`;

            const totalMinutes = Math.round(route.durationMillis / 60000);
            const hrs = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            const durationText = hrs > 0 
              ? `${hrs}h ${mins}min`
              : `${mins}min`;

            setResult({
              distanceText,
              durationText
            });
          } else {
            setErrorMsg('Não foi possível traçar rota para este itinerário.');
          }
        })
        .catch(err => {
          setLoading(false);
          console.error('Erro de roteamento Google Maps:', err);
          if (err.message?.includes('ApiNotActivatedMapError')) {
            setErrorMsg('API "Maps JavaScript API" não está ativada no seu console.');
          } else {
            setErrorMsg('Localidade não identificada ou sem resposta da API.');
          }
        });
    }, 1000);

    return () => clearTimeout(timer);
  }, [routesLib, origin, destination, stops]);

  if (!origin.trim() || !destination.trim()) {
    return (
      <div className="bg-zinc-950/20 border border-zinc-800/40 rounded-2xl p-4 text-center">
        <p className="text-[10px] text-zinc-650 font-black uppercase tracking-wider">
          Insira origem e destino para calcular rota dinâmica e real por satélite
        </p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-950/40 border border-zinc-800 rounded-2xl p-4.5 space-y-3 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand-accent/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
          <Navigation size={12} className="text-brand-accent animate-pulse" />
          Métrica Geográfica Real (Google Maps)
        </span>
        {loading && (
          <span className="text-[8px] text-brand-accent font-black uppercase tracking-widest flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" />
            Consolidando...
          </span>
        )}
      </div>

      {loading && !result ? (
        <div className="py-2 flex items-center justify-center gap-2 text-zinc-550">
          <Loader2 size={14} className="animate-spin text-brand-accent" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Consultando coordenadas e distâncias reais...</span>
        </div>
      ) : errorMsg ? (
        <div className="p-3 bg-rose-500/5 border border-rose-500/15 rounded-xl flex items-center gap-2.5">
          <span className="text-[9px] text-rose-450 font-bold uppercase">
            ⚠️ {errorMsg}
          </span>
        </div>
      ) : result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850/60 flex flex-col justify-between">
              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Distância Oficial</span>
              <span className="text-sm font-black text-brand-accent tabular-nums mt-1">
                {result.distanceText}
              </span>
            </div>
            <div className="bg-zinc-900/60 p-3 rounded-xl border border-zinc-850/60 flex flex-col justify-between">
              <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wider">Tempo Estimado de Trajeto</span>
              <span className="text-sm font-black text-white tabular-nums mt-1">
                {result.durationText}
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={() => {
                const info = `🗺️ Viagem calculada via Google Maps:\nDistância Real: ${result.distanceText}\nTempo Estimado: ${result.durationText}${stops.length > 0 ? `\nParadas Intermediárias: ${stops.length} ponto(s)` : ''}\n`;
                if (onApplyNotes) {
                  onApplyNotes(info);
                }
              }}
              className="text-[9px] font-black bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent/20 text-brand-accent px-3 py-1.5 rounded-lg uppercase tracking-wider transition-all flex items-center gap-1.5 focus:outline-none"
            >
              <Compass size={12} />
              Gravar em Observações
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-2 text-zinc-650 text-[9px] font-bold uppercase">
          Aguardando alteração nos endereços...
        </div>
      )}
    </div>
  );
}

export function GeographicRouteCalculator(props: CalculatorProps) {
  if (!hasValidKey) {
    return (
      <div className="bg-zinc-950/30 border border-zinc-850/50 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
        <Navigation size={20} className="text-zinc-650 mb-1.5" />
        <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
          Cálculos do Google Maps inativos
        </span>
        <p className="text-[8px] text-zinc-600 font-bold uppercase max-w-[280px] mt-1 leading-normal">
          Defina GOOGLE_MAPS_PLATFORM_KEY nos Secrets e ative a "Maps JavaScript API" e "Routes API" no Google Cloud para calcular distâncias exatas.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={API_KEY} version="weekly" language="pt-BR">
      <GeographicRouteCalculatorInner {...props} />
    </APIProvider>
  );
}

interface TripFormProps {
  vehicles: Vehicle[];
  employees: Employee[];
  trips?: Trip[];
  initialData?: Trip | null;
  initialAttachments?: { name: string; url: string; type: 'image' | 'pdf' | 'word' | 'excel' }[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  onDelete?: () => void;
  loading?: boolean;
}

const DOCUMENTATION_TEMPLATES = {
  state: [
    "CRLV Digital",
    "CNH do Motorista (EAR)",
    "Lista de Passageiros",
    "Autorização de Viagem (Órgão Estadual)"
  ],
  interstate: [
    "CRLV Digital",
    "CNH do Motorista (EAR)",
    "Lista de Passageiros (ANTT)",
    "Autorização de Viagem ANTT",
    "Seguro de Responsabilidade Civil (APP)"
  ],
  mercosur: [
    "CRLV Digital",
    "CNH Internacional",
    "Passaportes / RG Válidos",
    "Carta Azul (Seguro Mercosul)",
    "Lista de Passageiros Internacional",
    "Autorização Especial de Fronteira"
  ]
};

const getFrequentRoutes = (tripsList: Trip[]) => {
  if (!tripsList || tripsList.length === 0) return [];

  const routeGroups: { [key: string]: { 
    origin: string; 
    destination: string; 
    count: number; 
    titles: { [title: string]: number };
    tripTypes: { [type: string]: number };
    stopsList: Array<{ stops: Trip['stops']; count: number }>;
  } } = {};

  tripsList.forEach(trip => {
    const origin = (trip.origin || '').trim();
    const destination = (trip.destination || '').trim();
    if (!origin || !destination) return;

    const key = `${origin.toUpperCase().replace(/\s+/g, ' ')}➔${destination.toUpperCase().replace(/\s+/g, ' ')}`;
    if (!routeGroups[key]) {
      routeGroups[key] = {
        origin: origin,
        destination: destination,
        count: 0,
        titles: {},
        tripTypes: {},
        stopsList: []
      };
    }

    const group = routeGroups[key];
    group.count += 1;

    const tripTitle = (trip.title || '').trim();
    if (tripTitle) {
      group.titles[tripTitle] = (group.titles[tripTitle] || 0) + 1;
    }

    const tripType = trip.tripType || 'state';
    group.tripTypes[tripType] = (group.tripTypes[tripType] || 0) + 1;

    const stopsJson = JSON.stringify(trip.stops || []);
    let stopsEntry = group.stopsList.find(s => JSON.stringify(s.stops) === stopsJson);
    if (!stopsEntry) {
      stopsEntry = { stops: trip.stops || [], count: 0 };
      group.stopsList.push(stopsEntry);
    }
    stopsEntry.count += 1;
  });

  const suggestions = Object.values(routeGroups)
    .map(g => {
      const bestTitle = Object.entries(g.titles).sort((a, b) => b[1] - a[1])[0]?.[0] || `${g.origin.toUpperCase()} X ${g.destination.toUpperCase()}`;
      const bestType = Object.entries(g.tripTypes).sort((a, b) => b[1] - a[1])[0]?.[0] as 'state' | 'interstate' | 'mercosur' || 'state';
      const bestStops = g.stopsList.sort((a, b) => b.count - a.count)[0]?.stops || [];

      return {
        origin: g.origin,
        destination: g.destination,
        count: g.count,
        title: bestTitle,
        tripType: bestType,
        stops: bestStops
      };
    })
    .sort((a, b) => b.count - a.count);

  return suggestions.slice(0, 5);
};

export const TripForm = ({ vehicles, employees, trips = [], initialData, initialAttachments, onSubmit, onCancel, onDelete, loading }: TripFormProps) => {
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    vehicleId: initialData?.vehicleId || '',
    driverId: initialData?.driverId || '',
    secondDriverId: initialData?.secondDriverId || '',
    origin: initialData?.origin || '',
    destination: initialData?.destination || '',
    stops: initialData?.stops || [] as Trip['stops'],
    tripType: initialData?.tripType || 'state' as Trip['tripType'],
    startDate: initialData?.startDate || new Date().toISOString().slice(0, 16),
    endDate: initialData?.endDate || '',
    passengers: initialData?.passengers || [] as Passenger[],
    passengerCount: initialData?.passengerCount || 0,
    documentation: initialData?.documentation || [] as { label: string; checked: boolean }[],
    attachments: (initialData?.attachments || initialAttachments || []) as { name: string; url: string; type: 'image' | 'pdf' | 'word' | 'excel' }[],
    notes: initialData?.notes || '',
    status: initialData?.status || 'scheduled' as const,
    osNumber: initialData?.osNumber || `OS-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${String(new Date().getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`,
    accommodation: initialData?.accommodation || 'Por Conta',
    meals: initialData?.meals || 'Por Conta',
    tripValue: initialData?.tripValue !== undefined ? String(initialData.tripValue) : '',
    client: initialData?.client || '',
    paymentStatus: initialData?.paymentStatus || 'A Receber'
  });

  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [isCustomClient, setIsCustomClient] = useState(false);
  const [customClientName, setCustomClientName] = useState('');

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const q = query(collection(db, 'charter_clients'), orderBy('name', 'asc'));
        const snapshot = await getDocs(q);
        const list = snapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || ''
        }));
        setClients(list);

        if (initialData?.client) {
          const exists = list.some(c => c.name.toLowerCase() === initialData.client?.toLowerCase());
          if (!exists && initialData.client.trim() !== '') {
            setIsCustomClient(true);
            setCustomClientName(initialData.client);
          }
        }
      } catch (error) {
        console.warn('Erro ao carregar clientes no agendamento de viagens:', error);
      }
    };
    fetchClients();
  }, [initialData]);

  const [isManualDriver, setIsManualDriver] = useState(() => {
    if (!initialData?.driverId) return false;
    return !(employees || []).some(e => e.id === initialData.driverId);
  });
  const [isManualSecondDriver, setIsManualSecondDriver] = useState(() => {
    if (!initialData?.secondDriverId) return false;
    return !(employees || []).some(e => e.id === initialData.secondDriverId);
  });

  const [newPassenger, setNewPassenger] = useState<Passenger>({ name: '', document: '' });
  const [newStop, setNewStop] = useState({ location: '', arrivalTime: '' });
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [newAttachment, setNewAttachment] = useState({ name: '', type: 'image' as 'image' | 'pdf' | 'word' | 'excel', url: '' });
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [smartText, setSmartText] = useState('');
  const [isSmartProcessing, setIsSmartProcessing] = useState(false);
  const [processingAttachmentIndex, setProcessingAttachmentIndex] = useState<number | null>(null);
  const [editingPassengerIndex, setEditingPassengerIndex] = useState<number | null>(null);
  const [editPassengerData, setEditPassengerData] = useState<Passenger>({ name: '', document: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; onConfirm: () => void; title: string; message: string }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });

  const [showSuggestions, setShowSuggestions] = useState(false);
  const suggestedRoutes = React.useMemo(() => {
    return getFrequentRoutes(trips);
  }, [trips]);

  const handleSmartExtractFromAttachment = async (attachment: { name: string, url: string, type: string }, index: number) => {
    setProcessingAttachmentIndex(index);
    try {
      // Extract base64 and mimeType
      const [header, base64Data] = attachment.url.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const response = await fetch(getApiUrl("/api/extract-passengers"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data, mimeType }),
      });

      if (!response.ok) {
        throw new Error("Failed to extract passengers");
      }

      const extractedData = await response.json();

      if (extractedData && Array.isArray(extractedData)) {
        const newPassengers = extractedData.map((p: any) => ({
          name: String(p.name || '').toUpperCase(),
          document: String(p.document || 'S/D').toUpperCase()
        }));

        setFormData(prev => ({
          ...prev,
          passengers: [...prev.passengers, ...newPassengers],
          passengerCount: prev.passengers.length + newPassengers.length
        }));

        toast.success(`${newPassengers.length} passageiros extraídos do arquivo!`);
      }
    } catch (error) {
      console.error("AI Attachment Extraction Error:", error);
      toast.error("Erro ao processar arquivo com IA. Verifique se o formato é suportado.");
    } finally {
      setProcessingAttachmentIndex(null);
    }
  };

  useEffect(() => {
    if (!initialData || !initialData.id) {
      const template = DOCUMENTATION_TEMPLATES[formData.tripType] || [];
      setFormData(prev => ({
        ...prev,
        documentation: template.map(label => ({ label, checked: false }))
      }));
    }
  }, [formData.tripType, initialData]);

  const toggleDoc = (index: number) => {
    const newDoc = [...formData.documentation];
    newDoc[index].checked = !newDoc[index].checked;
    setFormData({ ...formData, documentation: newDoc });
  };

  const addPassenger = () => {
    if (newPassenger.name) {
      setFormData({
        ...formData,
        passengers: [...formData.passengers, newPassenger],
        passengerCount: formData.passengers.length + 1
      });
      setNewPassenger({ name: '', document: '' });
    }
  };

  const startEditingPassenger = (index: number) => {
    setEditingPassengerIndex(index);
    setEditPassengerData(formData.passengers[index]);
  };

  const saveEditedPassenger = () => {
    if (editingPassengerIndex !== null && editPassengerData.name) {
      const updatedPassengers = [...formData.passengers];
      updatedPassengers[editingPassengerIndex] = editPassengerData;
      setFormData({
        ...formData,
        passengers: updatedPassengers
      });
      setEditingPassengerIndex(null);
    }
  };

  const handlePassengerImport = () => {
    if (!importText.trim()) return;

    const lines = importText.split('\n');
    const importedPassengers: Passenger[] = [];

    lines.forEach(line => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      // Match CPF or RG-like patterns
      const cpfMatch = trimmedLine.match(/(\d{3}[\s.-]?\d{3}[\s.-]?\d{3}[\s.-]?\d{2})|(\d{11})/);
      const cpf = cpfMatch ? cpfMatch[0] : '';
      
      let name = trimmedLine.replace(cpf, '').trim();
      name = name.replace(/^[-:.\s]+|[-:.\s]+$/g, '').trim();

      if (name) {
        importedPassengers.push({ 
          name: name.toUpperCase(), 
          document: cpf.replace(/[\s.-]/g, '') || 'S/D' 
        });
      }
    });

    if (importedPassengers.length > 0) {
      setFormData(prev => ({
        ...prev,
        passengers: [...prev.passengers, ...importedPassengers],
        passengerCount: prev.passengers.length + importedPassengers.length
      }));
      setImportText('');
      setIsImporting(false);
    }
  };

  const exportPassengers = () => {
    if (formData.passengers.length === 0) return;

    const headers = ['Nome', 'Documento'];
    const csvContent = [
      headers.join(';'),
      ...formData.passengers.map(p => `${p.name};${p.document}`)
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `LISTA_${formData.title.toUpperCase() || 'PASSAGEIROS'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const removePassenger = (index: number) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remover Passageiro',
      message: `Deseja remover ${formData.passengers[index].name} desta viagem?`,
      onConfirm: () => {
        const updatedPassengers = formData.passengers.filter((_, i) => i !== index);
        setFormData({ 
          ...formData, 
          passengers: updatedPassengers,
          passengerCount: updatedPassengers.length 
        });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addStop = () => {
    if (newStop.location && newStop.arrivalTime) {
      setFormData({
        ...formData,
        stops: [...formData.stops, newStop]
      });
      setNewStop({ location: '', arrivalTime: '' });
    }
  };

  const removeStop = (index: number) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remover Parada',
      message: `Deseja remover a parada em ${formData.stops[index].location}?`,
      onConfirm: () => {
        setFormData({
          ...formData,
          stops: formData.stops.filter((_, i) => i !== index)
        });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const addAttachment = () => {
    if (newAttachment.name && newAttachment.url) {
      setFormData({
        ...formData,
        attachments: [...(formData.attachments || []), newAttachment]
      });
      setNewAttachment({ name: '', type: 'image', url: '' });
      setIsAddingAttachment(false);
    }
  };

  const removeAttachment = (index: number) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Remover Anexo',
      message: `Deseja excluir permanentemente o anexo "${formData.attachments[index].name}"?`,
      onConfirm: () => {
        setFormData({
          ...formData,
          attachments: (formData.attachments || []).filter((_, i) => i !== index)
        });
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isPdf = file.type === 'application/pdf';
      const isImage = file.type.startsWith('image/');
      const isWord = file.type === 'application/msword' || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const isExcel = file.type === 'application/vnd.ms-excel' || file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || file.type === 'text/csv';
      
      let type: 'image' | 'pdf' | 'word' | 'excel' = 'image';
      if (isPdf) type = 'pdf';
      else if (isWord) type = 'word';
      else if (isExcel) type = 'excel';
      else if (isImage) type = 'image';
      else return; // Unsupported type

      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAttachment({
          name: file.name,
          type,
          url: reader.result as string
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSmartFill = async () => {
    if (!smartText.trim()) {
      toast.error("Por favor, cole o texto da viagem primeiro.");
      return;
    }

    setIsSmartProcessing(true);
    try {
      const response = await fetch(getApiUrl("/api/smart-fill"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: smartText }),
      });

      if (!response.ok) {
        throw new Error("Failed to smart fill");
      }

      const result = await response.json();
      
      setFormData(prev => ({
        ...prev,
        title: result.title || prev.title,
        origin: result.origin || prev.origin,
        destination: result.destination || prev.destination,
        startDate: result.startDate ? result.startDate.slice(0, 16) : prev.startDate,
        endDate: result.endDate ? result.endDate.slice(0, 16) : prev.endDate,
        tripType: result.tripType || prev.tripType,
        notes: result.notes || prev.notes,
        passengers: result.passengers ? [...prev.passengers, ...result.passengers] : prev.passengers,
        passengerCount: (prev.passengers.length) + (result.passengers?.length || 0)
      }));

      toast.success("Informações extraídas com sucesso!");
      setSmartText('');
    } catch (error) {
      console.error("AI Smart Fill Error:", error);
      toast.error("Erro ao processar texto com IA.");
    } finally {
      setIsSmartProcessing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      tripValue: formData.tripValue ? Number(formData.tripValue) : undefined
    });
  };

  return (
    <div className="space-y-8 max-h-[80vh] overflow-y-auto px-1">
      {/* AI Smart Fill Section */}
      <div className="bg-gradient-to-br from-brand-accent/10 to-zinc-900 border border-brand-accent/20 rounded-3xl p-6 space-y-4 relative overflow-hidden group">
        <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <Sparkles size={120} />
        </div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 bg-brand-accent rounded-xl flex items-center justify-center text-zinc-950 shadow-lg">
            <Sparkles size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-tighter">Preenchimento Inteligente (IA)</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mt-0.5">Cole os detalhes da viagem ou roteiro para preencher os campos automaticamente</p>
          </div>
        </div>

        <div className="relative z-10 space-y-3">
          <textarea
            className="w-full h-32 bg-zinc-950/50 border border-zinc-800 rounded-2xl p-4 text-xs font-medium text-white placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all resize-none"
            placeholder="COLE AQUI: ROTEIRO, DATA, LISTA DE PASSAGEIROS, ETC..."
            value={smartText}
            onChange={(e) => setSmartText(e.target.value)}
          />
          <button
            type="button"
            disabled={isSmartProcessing || !smartText.trim()}
            onClick={handleSmartFill}
            className="w-full py-4 bg-brand-accent text-zinc-950 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:bg-white transition-all shadow-xl active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSmartProcessing ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                ANALISANDO DADOS...
              </>
            ) : (
              <>
                <Sparkles size={16} />
                EXTRAIR DADOS COM IA
              </>
            )}
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Seletor de Tipo de Lançamento (Redesenhado) */}
        <div className="bg-zinc-950 border border-zinc-900 p-6 rounded-[2rem] space-y-4 shadow-xl shadow-black/30">
          <div className="flex items-center gap-2.5">
            <Layers size={18} className="text-brand-accent" />
            <h4 className="text-[10px] font-black text-white uppercase tracking-wider">Tipo de Lançamento da Operação</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, status: 'scheduled' }))}
              className={cn(
                "py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 border.5 transition-all cursor-pointer select-none",
                formData.status !== 'completed'
                  ? "bg-brand-accent/15 text-brand-accent border-brand-accent/40 shadow-lg shadow-brand-accent/5 font-extrabold"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-850 hover:text-zinc-400"
              )}
            >
              <Calendar size={14} />
              Agendar Viagem (Programada)
            </button>
            <button
              type="button"
              onClick={() => {
                let nextEndDate = formData.endDate;
                if (!formData.endDate) {
                  const startD = new Date(formData.startDate);
                  startD.setHours(startD.getHours() + 3);
                  try {
                    nextEndDate = startD.toISOString().slice(0, 16);
                  } catch (e) {}
                }
                setFormData(prev => ({ ...prev, status: 'completed', endDate: nextEndDate }));
              }}
              className={cn(
                "py-4 px-6 rounded-2xl font-black text-[10px] uppercase tracking-[0.15em] flex items-center justify-center gap-2 border.5 transition-all cursor-pointer select-none",
                formData.status === 'completed'
                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40 shadow-lg shadow-emerald-500/5 font-extrabold"
                  : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:bg-zinc-850 hover:text-zinc-400"
              )}
            >
              <CheckCircle size={14} />
              Viagem Realizada (Histórico)
            </button>
          </div>
          <div className="p-4 bg-[#001233]/10 border border-[#001233]/30 rounded-2xl flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent shrink-0 mt-0.5">
              <ShieldCheck size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-wider">
                Ordem de Serviço (O.S.) Sincronizada
              </p>
              <p className="text-[8.5px] text-zinc-400 font-bold uppercase tracking-wide leading-relaxed mt-1">
                {formData.status === 'completed' 
                  ? "Esta viagem será salva como REALIZADA. O sistema criará a O.S. de Viagem correspondente e gerará as transações financeiras de receitas e fechamentos automaticamente."
                  : "Esta viagem será agendada como PROGRAMADA. O sistema gerará o número de O.S. e as fichas de serviço operacionais em tempo real para controle e emissão imediata."
                }
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* OS Number & Basic Info */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Número da O.S.</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-brand-accent transition-colors">
              <Hash size={18} />
            </div>
            <input
              type="text"
              placeholder="EX: OS-2024001"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all uppercase"
              value={formData.osNumber}
              onChange={e => setFormData({ ...formData, osNumber: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Título da Viagem / Operação</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-brand-accent transition-colors">
              <Navigation size={18} />
            </div>
            <input
              required
              type="text"
              placeholder="EX: TURISMO RIO X BUZIOS"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all uppercase"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>
        </div>

        {/* Cliente Selection */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Cliente / Fretante</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-brand-accent transition-colors">
              <Building2 size={18} />
            </div>
            <select
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 appearance-none transition-all uppercase cursor-pointer"
              value={isCustomClient ? '__custom__' : (formData.client || '')}
              onChange={e => {
                const val = e.target.value;
                if (val === '__custom__') {
                  setIsCustomClient(true);
                  setFormData(prev => ({ ...prev, client: customClientName }));
                } else {
                  setIsCustomClient(false);
                  setFormData(prev => ({ ...prev, client: val }));
                }
              }}
            >
              <option value="">SELECIONE UM CLIENTE</option>
              {clients.map(c => (
                <option key={c.id} value={c.name}>{c.name.toUpperCase()}</option>
              ))}
              <option value="__custom__">OUTROS (ESPECIFICAR)</option>
            </select>
          </div>

          {isCustomClient && (
            <div className="relative group mt-3 animate-fade-in">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500 group-focus-within:text-brand-accent transition-colors">
                <Building2 size={18} />
              </div>
              <input
                type="text"
                placeholder="DIGITE O NOME DO CLIENTE OUTROS"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 focus:ring-1 focus:ring-brand-accent/20 transition-all uppercase"
                value={customClientName}
                onChange={e => {
                  const val = e.target.value;
                  setCustomClientName(val);
                  setFormData(prev => ({ ...prev, client: val }));
                }}
              />
            </div>
          )}
        </div>

        {/* Trip Type Selection */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Modalidade da Viagem</label>
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'state', label: 'Estadual', icon: Map },
              { id: 'interstate', label: 'Interestadual', icon: Globe },
              { id: 'mercosur', label: 'Mercosul', icon: ShieldCheck }
            ].map(type => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData({ ...formData, tripType: type.id as any })}
                className={cn(
                  "p-4 rounded-xl border flex flex-col items-center gap-2 transition-all",
                  formData.tripType === type.id 
                    ? "bg-brand-accent/10 border-brand-accent text-brand-accent" 
                    : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                )}
              >
                <type.icon size={20} />
                <span className="text-[10px] font-black uppercase tracking-widest">{type.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Route Suggestions Trigger & Box */}
        <div className="md:col-span-2 space-y-4 border-t border-zinc-850 pt-4">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <Compass size={14} className="text-brand-accent animate-pulse" />
              Sugerir Roteiros Inteligentes
            </label>
            <button
              type="button"
              onClick={() => setShowSuggestions(!showSuggestions)}
              className={cn(
                "flex items-center gap-2 px-3.5 py-2 rounded-xl transition-all text-[10px] font-black uppercase tracking-wider border",
                showSuggestions 
                  ? "bg-brand-accent/20 border-brand-accent text-brand-accent shadow-lg"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-white"
              )}
            >
              <Compass size={14} className={cn("transition-transform duration-500", showSuggestions && "rotate-180")} />
              {showSuggestions ? "Ocultar Sugestões" : "Sugestão de Rota"}
            </button>
          </div>

          {showSuggestions && (
            <div className="bg-zinc-950/65 border border-zinc-800/80 rounded-3xl p-5.5 space-y-4 animate-fadeIn shadow-2xl backdrop-blur-md">
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-900">
                <p className="text-[9px] text-zinc-500 font-black uppercase tracking-widest">
                  Análise inteligente de {trips.length} viagens registradas no histórico
                </p>
                <div className="flex items-center gap-1.5 bg-zinc-900/80 rounded-lg py-0.5 px-2 border border-zinc-800/85">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse"></span>
                  <span className="text-[8px] text-zinc-400 font-bold uppercase tracking-widest">Padrões DM Turismo</span>
                </div>
              </div>

              {suggestedRoutes.length === 0 ? (
                <div className="text-center py-7 text-zinc-600 font-bold uppercase tracking-wider text-[10px] bg-zinc-900/10 rounded-2xl border border-dashed border-zinc-850">
                  Nenhuma viagem registrada no histórico para gerar sugestões.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5">
                  {suggestedRoutes.map((route, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFormData(prev => ({
                          ...prev,
                          origin: route.origin,
                          destination: route.destination,
                          title: route.title,
                          tripType: route.tripType,
                          stops: route.stops
                        }));
                        toast.success(`Rota auto-preenchida para ${route.destination}!`);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left p-4 bg-zinc-905/50 border border-zinc-800/65 hover:border-brand-accent/40 hover:bg-zinc-900 rounded-2xl transition-all duration-300 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 group hover:shadow-lg hover:shadow-brand-accent/5 hover:-translate-y-0.5 active:scale-99 shadow-sm"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-xs font-black text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight">
                            {route.origin}
                          </span>
                          <span className="text-brand-accent/80 text-xs font-black animate-pulse">➔</span>
                          <span className="text-xs font-black text-white group-hover:text-brand-accent transition-colors uppercase tracking-tight">
                            {route.destination}
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-wider">
                          Título: <span className="text-zinc-300 font-black">{route.title}</span>
                        </p>
                        {route.stops && route.stops.length > 0 && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="px-2 py-0.5 bg-zinc-950 text-zinc-400 text-[8px] font-black uppercase tracking-widest rounded-md border border-zinc-850">
                              {route.stops.length} parada(s)
                            </span>
                            <span className="text-[8px] text-zinc-500 font-bold uppercase tracking-wide truncate max-w-[250px]">
                              ({route.stops.map(s => s.location).join(', ')})
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2.5 self-start sm:self-center">
                        <span className="px-2.5 py-1 bg-brand-accent/10 border border-brand-accent/25 text-brand-accent text-[9px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                          {route.count}x usada
                        </span>
                        <span className="px-2.5 py-1 bg-zinc-850 border border-zinc-750 text-zinc-400 text-[8px] font-black uppercase tracking-widest rounded-lg shadow-sm">
                          {route.tripType === 'state' ? 'Estadual' : route.tripType === 'interstate' ? 'Interestadual' : 'Mercosul'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Origin & Destination */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-emerald-500">Origem</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <MapPin size={18} />
            </div>
            <input
              type="text"
              placeholder="SAÍDA"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
              value={formData.origin}
              onChange={e => setFormData({ ...formData, origin: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-rose-500">Destino</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <MapPin size={18} />
            </div>
            <input
              type="text"
              placeholder="CHEGADA"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
              value={formData.destination}
              onChange={e => setFormData({ ...formData, destination: e.target.value })}
            />
          </div>
        </div>

        {/* Stops (Intermediate) */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Clock size={14} className="text-brand-accent" />
            Paradas Intermediárias (Opcional)
          </label>
          <div className="p-4 bg-zinc-950/30 rounded-2xl border border-zinc-800 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="LOCAL DA PARADA"
                className="bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white uppercase font-bold"
                value={newStop.location}
                onChange={e => setNewStop({ ...newStop, location: e.target.value })}
              />
              <div className="flex gap-2">
                <input
                  type="datetime-local"
                  className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-3 px-4 text-xs text-white font-bold"
                  value={newStop.arrivalTime}
                  onChange={e => setNewStop({ ...newStop, arrivalTime: e.target.value })}
                />
                <button
                  type="button"
                  onClick={addStop}
                  className="w-10 h-10 bg-zinc-800 text-brand-accent rounded-xl flex items-center justify-center hover:bg-zinc-700 transition-all"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>

            {formData.stops.length > 0 && (
              <div className="space-y-2">
                {formData.stops.map((stop, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-black text-zinc-500">
                        {idx + 1}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white uppercase">{stop.location}</p>
                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">Previsão: {stop.arrivalTime.replace('T', ' ')}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeStop(idx)}
                      className="text-zinc-700 hover:text-rose-500 p-2"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Geographic Route Calculator */}
        <div className="md:col-span-2">
          <GeographicRouteCalculator
            origin={formData.origin}
            destination={formData.destination}
            stops={formData.stops}
            onApplyNotes={(routeInfo) => {
              setFormData(prev => ({
                ...prev,
                notes: prev.notes ? `${prev.notes}\n\n${routeInfo}` : routeInfo
              }));
              toast.success('Informações de trajeto adicionadas às notas da viagem!');
            }}
          />
        </div>

        {/* Schedule */}
        <div className="space-y-4 font-sans">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Partida</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Calendar size={18} />
            </div>
            <input
              type="datetime-local"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 transition-all"
              value={formData.startDate}
              onChange={e => setFormData({ ...formData, startDate: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Retorno Programado</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Clock size={18} />
            </div>
            <input
              type="datetime-local"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 transition-all"
              value={formData.endDate}
              onChange={e => setFormData({ ...formData, endDate: e.target.value })}
            />
          </div>
        </div>

        {/* Documentation Checklist */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <SquareCheck size={14} className="text-brand-accent" />
            Checklist de Documentação
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800">
            {formData.documentation.map((doc, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => toggleDoc(idx)}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                  doc.checked ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-900/50 text-zinc-500"
                )}
              >
                <div className={cn(
                  "w-5 h-5 rounded-md border flex items-center justify-center transition-all",
                  doc.checked ? "bg-emerald-500 border-emerald-500 text-zinc-950" : "border-zinc-700 text-transparent"
                )}>
                  <SquareCheck size={14} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-tight">{doc.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Attachments Section */}
        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
            <Paperclip size={14} className="text-brand-accent" />
            Anexos e Documentos Digitalizados (Fotos/PDF)
          </label>
          <div className="p-4 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-4">
            {!isAddingAttachment ? (
              <button
                type="button"
                onClick={() => setIsAddingAttachment(true)}
                className="w-full py-4 border-2 border-dashed border-zinc-800 rounded-2xl text-zinc-600 font-black text-[10px] uppercase tracking-widest hover:border-brand-accent/50 hover:text-brand-accent transition-all flex items-center justify-center gap-2"
              >
                <Plus size={16} />
                Adicionar Foto ou PDF de Documento
              </button>
            ) : (
              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-4">
                <div className="flex justify-between items-center mb-2">
                  <h5 className="text-[10px] font-black text-white uppercase tracking-widest">Novo Anexo</h5>
                  <button type="button" onClick={() => setIsAddingAttachment(false)} className="text-zinc-500 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Tipo de Arquivo</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewAttachment({ ...newAttachment, type: 'image' })}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                          newAttachment.type === 'image' ? "bg-brand-accent/10 border-brand-accent text-brand-accent" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                        )}
                      >
                        <ImageIcon size={14} /> Foto
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAttachment({ ...newAttachment, type: 'pdf' })}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                          newAttachment.type === 'pdf' ? "bg-rose-500/10 border-rose-500 text-rose-500" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                        )}
                      >
                        <FileIcon size={14} /> PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAttachment({ ...newAttachment, type: 'word' })}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                          newAttachment.type === 'word' ? "bg-blue-500/10 border-blue-500 text-blue-500" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                        )}
                      >
                        <FileIcon size={14} /> Word
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewAttachment({ ...newAttachment, type: 'excel' })}
                        className={cn(
                          "py-2 px-3 rounded-lg border text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2",
                          newAttachment.type === 'excel' ? "bg-emerald-500/10 border-emerald-500 text-emerald-500" : "bg-zinc-950 border-zinc-800 text-zinc-600"
                        )}
                      >
                        <ExcelIcon size={14} /> Excel
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Upload Local</label>
                    <div className="relative">
                      <input
                        type="file"
                        accept={
                          newAttachment.type === 'pdf' ? 'application/pdf' : 
                          newAttachment.type === 'word' ? '.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document' :
                          newAttachment.type === 'excel' ? '.xls,.xlsx,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv' :
                          'image/*'
                        }
                        onChange={handleFileChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="bg-zinc-950 border border-zinc-800 rounded-lg py-2 px-4 text-[10px] font-bold text-zinc-400 text-center overflow-hidden whitespace-nowrap text-ellipsis">
                        {newAttachment.name || "Selecionar Arquivo"}
                      </div>
                    </div>
                  </div>
                </div>
                {newAttachment.url && (
                  <button
                    type="button"
                    onClick={addAttachment}
                    className="w-full py-3 bg-brand-accent text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all"
                  >
                    Confirmar Anexo
                  </button>
                )}
              </div>
            )}

            {formData.attachments && (formData.attachments as any[]).length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(formData.attachments as any[]).map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-xl border border-zinc-800 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        file.type === 'pdf' ? "bg-rose-500/10 text-rose-500" : 
                        file.type === 'word' ? "bg-blue-500/10 text-blue-500" :
                        file.type === 'excel' ? "bg-emerald-500/10 text-emerald-500" :
                        "bg-amber-500/10 text-amber-500"
                      )}>
                        {file.type === 'word' || file.type === 'pdf' ? <FileIcon size={16} /> : 
                         file.type === 'excel' ? <ExcelIcon size={16} /> : 
                         <ImageIcon size={16} />}
                      </div>
                      <div className="overflow-hidden">
                        <p className="text-[10px] font-black text-white uppercase truncate">{file.name}</p>
                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{file.type}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {(file.type === 'image' || file.type === 'pdf') && (
                        <button
                          type="button"
                          onClick={() => handleSmartExtractFromAttachment(file, idx)}
                          disabled={processingAttachmentIndex === idx}
                          className="p-2 text-zinc-500 hover:text-brand-accent transition-all relative group/ia"
                          title="Extrair passageiros com IA"
                        >
                          {processingAttachmentIndex === idx ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <Sparkles size={14} className="group-hover/ia:animate-pulse" />
                          )}
                        </button>
                      )}
                      <a
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-zinc-500 hover:text-white transition-all"
                        title="Visualizar Arquivo"
                      >
                        <Eye size={14} />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeAttachment(idx)}
                        className="text-zinc-700 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Passengers List */}
        <div className="md:col-span-2 space-y-4">
          <div className="flex justify-between items-end pr-1">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
              <ListChecks size={14} className="text-brand-accent" />
              Lista de Passageiros
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsImporting(!isImporting)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-lg text-[8px] font-black uppercase transition-all tracking-widest",
                  isImporting ? "bg-brand-accent text-zinc-950" : "bg-zinc-900 text-zinc-500 hover:text-white"
                )}
                title="Colar Lista"
              >
                <ClipboardPaste size={12} />
                Importar
              </button>
              <button
                type="button"
                onClick={exportPassengers}
                disabled={formData.passengers.length === 0}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 text-zinc-500 hover:text-white disabled:opacity-30 rounded-lg text-[8px] font-black uppercase transition-all tracking-widest"
                title="Exportar Lista"
              >
                <Download size={12} />
                Exportar
              </button>
            </div>
          </div>

          <div className="p-6 bg-zinc-950/50 rounded-2xl border border-zinc-800 space-y-6">
            {isImporting ? (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="bg-zinc-900 p-4 rounded-xl border border-brand-accent/30 space-y-3">
                  <p className="text-[8px] font-black text-brand-accent uppercase tracking-widest leading-relaxed">
                    Cole o texto abaixo (ex: Nome 123.456.789-00). <br/>
                    Cada passageiro em uma nova linha.
                  </p>
                  <textarea
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-[10px] text-zinc-300 font-mono focus:outline-none focus:border-brand-accent transition-all resize-none"
                    placeholder="JOÃO SILVA 123.456.789-00&#10;MARIA OLIVEIRA RG 1234567"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handlePassengerImport}
                      className="flex-1 py-3 bg-brand-accent text-zinc-950 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white transition-all shadow-lg"
                    >
                      Processar Texto
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsImporting(false)}
                      className="px-6 py-3 bg-zinc-800 text-zinc-500 rounded-xl font-black text-[10px] uppercase tracking-widest hover:text-white transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="NOME COMPLETO"
                  className="bg-zinc-900 border border-zinc-800 rounded-xl py-4 px-4 text-xs text-white font-bold uppercase focus:border-brand-accent/50 outline-none transition-all"
                  value={newPassenger.name}
                  onChange={e => setNewPassenger({ ...newPassenger, name: e.target.value })}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="RG / CPF (OPCIONAL)"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl py-4 px-4 text-xs text-white font-bold uppercase focus:border-brand-accent/50 outline-none transition-all"
                    value={newPassenger.document}
                    onChange={e => setNewPassenger({ ...newPassenger, document: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={addPassenger}
                    className="w-14 h-14 bg-brand-accent text-zinc-950 rounded-xl flex items-center justify-center hover:bg-white transition-all shadow-lg active:scale-95"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
            )}

            {formData.passengers.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                {formData.passengers.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-zinc-900 rounded-xl border border-zinc-800/50 group">
                    {editingPassengerIndex === idx ? (
                      <div className="flex-1 flex gap-2 mr-2">
                        <input
                          type="text"
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-3 text-[10px] text-white font-bold uppercase"
                          value={editPassengerData.name}
                          onChange={e => setEditPassengerData({ ...editPassengerData, name: e.target.value })}
                          autoFocus
                        />
                        <input
                          type="text"
                          className="w-24 bg-zinc-950 border border-zinc-800 rounded-lg py-1 px-3 text-[10px] text-white font-bold uppercase"
                          value={editPassengerData.document}
                          onChange={e => setEditPassengerData({ ...editPassengerData, document: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-black text-white uppercase truncate">{p.name}</p>
                        <p className="text-[8px] font-bold text-zinc-600 uppercase tracking-widest">{p.document}</p>
                      </div>
                    )}
                    <div className="flex items-center gap-1 shrink-0">
                      {editingPassengerIndex === idx ? (
                        <button
                          type="button"
                          onClick={saveEditedPassenger}
                          className="text-emerald-500 hover:text-emerald-400 p-2"
                        >
                          <Check size={14} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditingPassenger(idx)}
                          className="text-zinc-700 hover:text-brand-accent transition-colors p-2"
                        >
                          <Edit2 size={14} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removePassenger(idx)}
                        className="text-zinc-700 hover:text-rose-500 transition-colors p-2"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <div className="text-[10px] font-black text-zinc-700 uppercase tracking-widest text-center border-t border-zinc-900 pt-4">
              Total: {formData.passengerCount} Passageiros
            </div>
          </div>
        </div>

        {/* Resources */}
        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Veículo Escalado</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Bus size={18} />
            </div>
            <select
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase"
              value={formData.vehicleId}
              onChange={e => setFormData({ ...formData, vehicleId: e.target.value })}
            >
              <option value="">SELECIONE UM VEÍCULO</option>
              {(vehicles || []).map(v => (
                <option key={v.id} value={v.id}>{v.plate} - {v.model}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Motorista Principal</label>
            <button
              type="button"
              onClick={() => {
                setIsManualDriver(!isManualDriver);
                setFormData(prev => ({ ...prev, driverId: '' }));
              }}
              className="text-[9px] font-black text-brand-accent hover:underline uppercase tracking-wider cursor-pointer"
            >
              {isManualDriver ? 'Selecionar da Lista' : 'Digitar Manualmente'}
            </button>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <User size={18} />
            </div>
            {isManualDriver ? (
              <input
                type="text"
                placeholder="NOME DO MOTORISTA PRINCIPAL"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
                value={formData.driverId}
                onChange={e => setFormData({ ...formData, driverId: e.target.value.toUpperCase() })}
              />
            ) : (
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase cursor-pointer"
                value={formData.driverId}
                onChange={e => setFormData({ ...formData, driverId: e.target.value })}
              >
                <option value="">SELECIONE O MOTORISTA</option>
                {(employees || []).filter(e => e.role === 'Motorista').map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1 text-zinc-400 italic">Motorista Auxiliar (Opcional)</label>
            <button
              type="button"
              onClick={() => {
                setIsManualSecondDriver(!isManualSecondDriver);
                setFormData(prev => ({ ...prev, secondDriverId: '' }));
              }}
              className="text-[9px] font-black text-brand-accent hover:underline uppercase tracking-wider cursor-pointer"
            >
              {isManualSecondDriver ? 'Selecionar da Lista' : 'Digitar Manualmente'}
            </button>
          </div>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <User size={18} />
            </div>
            {isManualSecondDriver ? (
              <input
                type="text"
                placeholder="NOME DO MOTORISTA AUXILIAR"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
                value={formData.secondDriverId}
                onChange={e => setFormData({ ...formData, secondDriverId: e.target.value.toUpperCase() })}
              />
            ) : (
              <select
                className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase cursor-pointer"
                value={formData.secondDriverId}
                onChange={e => setFormData({ ...formData, secondDriverId: e.target.value })}
              >
                <option value="">NENHUM MOTORISTA AUXILIAR</option>
                {(employees || []).filter(e => e.role === 'Motorista' && e.id !== formData.driverId).map(e => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Hospedagem</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Hotel size={18} />
            </div>
            <select
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase cursor-pointer"
              value={formData.accommodation}
              onChange={e => setFormData({ ...formData, accommodation: e.target.value })}
            >
              <option value="Por Conta">POR CONTA</option>
              <option value="DM">DM</option>
              <option value="AM">AM</option>
              <option value="Cliente">CLIENTE</option>
              <option value="Terceiros">TERCEIROS</option>
            </select>
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Alimentação</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <Utensils size={18} />
            </div>
            <select
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase cursor-pointer"
              value={formData.meals}
              onChange={e => setFormData({ ...formData, meals: e.target.value })}
            >
              <option value="Por Conta">POR CONTA</option>
              <option value="DM">DM</option>
              <option value="AM">AM</option>
              <option value="Cliente">CLIENTE</option>
              <option value="Terceiros">TERCEIROS</option>
            </select>
          </div>
        </div>

        <div className="md:col-span-1 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Valor da Viagem (O.S.)</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <DollarSign size={18} />
            </div>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="R$ 0,00"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
              value={formData.tripValue}
              onChange={e => setFormData({ ...formData, tripValue: e.target.value })}
            />
          </div>
        </div>

        <div className="md:col-span-1 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Status de Pagamento (Financeiro)</label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-zinc-500">
              <CreditCard size={18} />
            </div>
            <select
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold focus:outline-none focus:border-brand-accent/50 appearance-none transition-all uppercase cursor-pointer"
              value={formData.paymentStatus}
              onChange={e => setFormData({ ...formData, paymentStatus: e.target.value })}
            >
              <option value="A Receber">A RECEBER</option>
              <option value="Faturado">FATURADO</option>
              <option value="Pago">PAGO</option>
            </select>
          </div>
        </div>

        <div className="md:col-span-2 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Observações da Operação</label>
          <div className="relative group">
            <div className="absolute top-4 left-4 pointer-events-none text-zinc-500">
              <Info size={18} />
            </div>
            <textarea
              rows={3}
              placeholder="NOTAS DE VIAGEM, PEDÁGIOS, PARADAS..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-4 pl-12 pr-4 text-white font-bold placeholder:text-zinc-700 focus:outline-none focus:border-brand-accent/50 transition-all uppercase"
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </div>
      </div>

      {initialData?.id && (
        <div className="pt-6 mt-6 border-t border-white/5">
          <PhotoGallery collectionName="trips" documentId={initialData.id} />
        </div>
      )}

      <div className="flex gap-4 pt-4 sticky bottom-0 bg-zinc-950 py-4 border-t border-zinc-900 z-10">
        {onDelete && (
          <Button
            type="button"
            onClick={() => onDelete()}
            className="w-14 h-14 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white transition-all shadow-lg"
            title="Excluir Viagem"
          >
            <Trash2 size={20} />
          </Button>
        )}
        <Button
          type="button"
          onClick={onCancel}
          className="flex-1 h-14 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 group"
        >
          CANCELAR
        </Button>
        <Button
          type="submit"
          loading={loading}
          className="flex-[2] h-14 shadow-[0_0_20px_rgba(255,107,0,0.2)]"
        >
          SALVAR
        </Button>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
      />
    </form>
  </div>
);
};
