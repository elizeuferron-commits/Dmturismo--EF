import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Route, Users, Calendar, Clock, Search, MapPin, 
  Plus, Building2, Trash2, Edit, CheckCircle2, 
  X, AlertCircle, Smartphone, CheckSquare, FileText, 
  DollarSign, ChevronLeft, ChevronRight, Receipt, Send, 
  Printer, ArrowRight, ArrowLeft, SkipForward, Play, Square, RefreshCw, Compass, Sparkles, Zap,
  Eye, EyeOff
} from 'lucide-react';
import { Button, Input, Select, ConfirmModal } from './UI';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

// Types & Helpers from charter subsystem
import { Passenger, CustomTrip, CharteredRoute, Client, ClientTrip } from './charter/CharterTypes';
import { 
  parseSafeDate, safeFormatDate, getMapsDirUrl, 
  getMapsEmbedUrl, exportRouteToGpx, exportRouteToPdf, 
  exportRouteToOfflineHtml, exportClosingPdf, exportClientDossierPdf,
  exportClientPeriodDossierPdf
} from './charter/CharterUtils';

// Modular Components
import { CharteredRoutesMultiTrip, DailyTripItem } from './CharteredRoutesMultiTrip';
import { GpsAssistant } from './charter/GpsAssistant';
import { ClientClosingModal } from './charter/ClientClosingModal';
import { AddRouteModal, EditRouteModal } from './charter/RouteForms';
import { charterIndexedDBService } from '../services/charterIndexedDBService';
import { CharterOfflineManager } from './charter/CharterOfflineManager';

export const CharteredRoutes: React.FC<{
  vehicles: any[];
  employees: any[];
  routes: CharteredRoute[];
  currentUserRole?: string;
  currentUserEmail?: string;
}> = ({ 
  vehicles, 
  employees, 
  routes, 
  currentUserRole,
  currentUserEmail
}) => {
  const [activeTab, setActiveTab] = useState<'routes' | 'client_charters'>('client_charters');
  
  // Security Role Checks
  const hasClientCharterAccess = useMemo(() => {
    const role = currentUserRole;
    return role === 'Dono / Proprietário' || 
           role === 'Dono' || 
           role === 'Proprietário' || 
           role === 'Gestor de Frotas' || 
           role === 'Coordenador Logístico' || 
           role === 'Administrativo' ||
           role === 'admin';
  }, [currentUserRole]);

  const isOwner = 
    currentUserRole === 'Dono / Proprietário' || 
    currentUserRole === 'Dono' || 
    currentUserRole === 'Proprietário' ||
    currentUserRole === 'Gestor de Frotas' ||
    currentUserRole === 'Coordenador Logístico' ||
    currentUserRole === 'Administrativo' ||
    currentUserEmail === 'elizeuferron@gmail.com';

  const canEditValues = useMemo(() => {
    return isOwner || currentUserRole === 'admin';
  }, [isOwner, currentUserRole]);

  // Main UI Modals State
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingRoute, setEditingRoute] = useState<CharteredRoute | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Quick Quick-Add Form State
  const [quickRoute, setQuickRoute] = useState({
    name: '',
    client: '',
    type: 'factory' as 'factory' | 'school' | 'other' | 'regular_random',
    daysOfWeek: [1, 2, 3, 4, 5],
    departureTime: '08:00',
    returnTime: '17:00',
    fixedVehicleId: '',
    fixedDriverId: '',
  });

  // GPS navigation & Progressive Tracking States
  const [activeGpsRoute, setActiveGpsRoute] = useState<CharteredRoute | null>(null);
  const [activeGpsPassengerIndex, setActiveGpsPassengerIndex] = useState<number>(0);
  const [isGpsPanelOpen, setIsGpsPanelOpen] = useState<boolean>(false);
  const [isGpsMiniMenuOpen, setIsGpsMiniMenuOpen] = useState<boolean>(true);
  const [isFloatingNavDismissed, setIsFloatingNavDismissed] = useState(false);
  const [isGpsBubbleOnlyMode, setIsGpsBubbleOnlyMode] = useState<boolean>(false);
  const [isBubbleMinimized, setIsBubbleMinimized] = useState<boolean>(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Read driver position
  useEffect(() => {
    let watchId: number | null = null;
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Navegação DM: Erro de GPS inicial:", error);
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.warn("Navegação DM: Erro de GPS contínuo:", error);
        },
        { enableHighAccuracy: true }
      );
    }

    return () => {
      if (watchId !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  // Client Charters collections state
  const [clientCharters, setClientCharters] = useState<ClientTrip[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [showClientAddForm, setShowClientAddForm] = useState(false);
  const [showClientEditForm, setShowClientEditForm] = useState(false);
  const [isQuickMode, setIsQuickMode] = useState(false);
  const [editingClientCharter, setEditingClientCharter] = useState<ClientTrip | null>(null);
  
  // Client Management modals
  const [showRegisterClientForm, setShowRegisterClientForm] = useState(false);
  const [showEditClientForm, setShowEditClientForm] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientDetail, setSelectedClientDetail] = useState<Client | null>(null);
  const [clientSubTab, setClientSubTab] = useState<'trips' | 'clients'>('trips');
  const [clientDetailTab, setClientDetailTab] = useState<'billing_frequency' | 'routes' | 'fixed_routes_contract'>('billing_frequency');
  const [currentCalendarDate, setCurrentCalendarDate] = useState(new Date());
  
  const [periodStartDate, setPeriodStartDate] = useState('');
  const [periodEndDate, setPeriodEndDate] = useState('');

  // Auto-initialize period query ranges to the current month's limits
  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const formatDateInput = (date: Date) => {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    };
    
    setPeriodStartDate(formatDateInput(firstDay));
    setPeriodEndDate(formatDateInput(lastDay));
  }, []);
  
  // State for adding a new Fixed Route to a Client's contract
  const [newFixedRouteName, setNewFixedRouteName] = useState('');
  const [newFixedRouteSchedule, setNewFixedRouteSchedule] = useState('');
  const [newFixedRouteDriverId, setNewFixedRouteDriverId] = useState('');
  const [newFixedRouteVehicleId, setNewFixedRouteVehicleId] = useState('');
  const [newFixedRouteDays, setNewFixedRouteDays] = useState<number[]>([]);

  const location = useLocation();
  const navigate = useNavigate();

  // Handle route deep-linking to Client Details tab page
  useEffect(() => {
    if (location.state && (location.state as any).selectClientId && clients.length > 0) {
      const targetClientId = (location.state as any).selectClientId;
      const foundClient = clients.find(c => c.id === targetClientId);
      if (foundClient) {
        setActiveTab('client_charters');
        setClientSubTab('clients');
        setSelectedClientDetail(foundClient);
        toast.info(`Ficha do cliente ${foundClient.name.toUpperCase()} aberta.`);
      }
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, clients, navigate, location.pathname]);

  const currentClient = useMemo(() => {
    if (!selectedClientDetail) return null;
    return clients.find(c => c.id === selectedClientDetail.id) || selectedClientDetail;
  }, [clients, selectedClientDetail]);

  useEffect(() => {
    if (selectedClientDetail) {
      setCurrentCalendarDate(new Date());
    }
  }, [selectedClientDetail]);

  const calendarGridDays = useMemo(() => {
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [currentCalendarDate]);

  // Dossier monthly closing states
  const [showClientValues, setShowClientValues] = useState<boolean>(false);
  const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
  const [closingMonthYear, setClosingMonthYear] = useState(() => format(new Date(), 'yyyy-MM'));
  const [selectedClosingTrips, setSelectedClosingTrips] = useState<Record<string, boolean>>({});
  const [closingPreviewData, setClosingPreviewData] = useState<{
    pdfUrl: string;
    trips: any[];
    client: any;
    fileName: string;
  } | null>(null);

  // New Client Trip state
  const [newClientCharter, setNewClientCharter] = useState({
    client: '',
    clientId: '',
    description: '',
    dateTime: '',
    origin: '',
    destination: '',
    value: 0,
    driverId: '',
    vehicleId: '',
    status: 'pending' as 'pending' | 'completed' | 'cancelled',
    paymentStatus: 'open' as 'open' | 'billed' | 'received',
    passengerCount: 0,
    isExtra: false,
    hasExtraService: false,
    extraServiceDesc: '',
    extraServiceVal: 0
  });

  const [isMultiTripEnabled, setIsMultiTripEnabled] = useState(false);
  const [dailyTrips, setDailyTrips] = useState<DailyTripItem[]>([
    { id: '1', time: '07:00', label: 'Saída 1 (Manhã)', value: 0 },
    { id: '2', time: '17:00', label: 'Saída 2 (Tarde)', value: 0 }
  ]);

  // Client list search, pagination and date range states
  const [clientStartDate, setClientStartDate] = useState<string>(() => {
    const d = new Date();
    return format(new Date(d.getFullYear(), d.getMonth(), 1), 'yyyy-MM-dd');
  });
  const [clientEndDate, setClientEndDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const [newClient, setNewClient] = useState({
    name: '',
    companyName: '',
    document: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    defaultTripValue: 0,
    extraTripsNotes: '',
    extraWorksNotes: ''
  });

  // Batch trip launching selection
  const [selectedLaunchDays, setSelectedLaunchDays] = useState<string[]>([]);
  const [launchCalendarDate, setLaunchCalendarDate] = useState(new Date());
  const [launchTime, setLaunchTime] = useState('08:00');

  const launchCalendarGridDays = useMemo(() => {
    const year = launchCalendarDate.getFullYear();
    const month = launchCalendarDate.getMonth();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(new Date(year, month, d));
    }
    return days;
  }, [launchCalendarDate]);

  // Firestore DB snapshot listeners
  useEffect(() => {
    const unsubscribe = dbCacheService.subscribeCollection('charter_client_trips', (list) => {
      setClientCharters(list as ClientTrip[]);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = dbCacheService.subscribeCollection('charter_clients', (list) => {
      setClients(list as Client[]);
    });
    return () => unsubscribe();
  }, []);

  // Sync route passenger navigation indices with storage
  const [navIndexes, setNavIndexes] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('active_route_nav_')) {
          const routeId = key.replace('active_route_nav_', '');
          const val = parseInt(localStorage.getItem(key) || '0', 10);
          initial[routeId] = val;
        }
      }
    } catch (e) {
      console.error(e);
    }
    return initial;
  });

  // Main list filters and stats memoizations
  const clientTripsForSelectedClient = useMemo(() => {
    if (!selectedClientDetail) return [];
    const nameLower = selectedClientDetail.name?.toLowerCase();
    const clientId = selectedClientDetail.id;
    return clientCharters.filter(t => 
      t.clientId === clientId || t.client?.toLowerCase() === nameLower
    );
  }, [selectedClientDetail, clientCharters]);

  const periodTrips = useMemo(() => {
    if (!selectedClientDetail || !periodStartDate || !periodEndDate) return [];
    
    const start = new Date(periodStartDate + 'T00:00:00');
    const end = new Date(periodEndDate + 'T23:59:59');
    
    return clientTripsForSelectedClient.filter(trip => {
      const tripDate = new Date(trip.dateTime);
      return tripDate >= start && tripDate <= end;
    });
  }, [selectedClientDetail, clientTripsForSelectedClient, periodStartDate, periodEndDate]);

  const periodTripsStats = useMemo(() => {
    let totalValue = 0;
    periodTrips.forEach(trip => {
      const baseVal = trip.isExtra ? (trip.value || 0) : (selectedClientDetail?.defaultTripValue || trip.value || 0);
      const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
      totalValue += (baseVal + extraVal);
    });
    return {
      count: periodTrips.length,
      totalValue
    };
  }, [periodTrips, selectedClientDetail]);

  const currentClientOpenTrips = useMemo(() => {
    return clientTripsForSelectedClient.filter(t => 
      t.status !== 'cancelled' && t.paymentStatus !== 'received'
    );
  }, [clientTripsForSelectedClient]);

  const filteredClosingTrips = useMemo(() => {
    return currentClientOpenTrips.filter(t => t.dateTime?.startsWith(closingMonthYear));
  }, [currentClientOpenTrips, closingMonthYear]);

  const filteredPeriodCharters = useMemo(() => {
    return clientCharters.filter(c => {
      const d = c.dateTime ? c.dateTime.split('T')[0] : '';
      return (!clientStartDate || d >= clientStartDate) && (!clientEndDate || d <= clientEndDate);
    });
  }, [clientCharters, clientStartDate, clientEndDate]);

  const periodStats = useMemo(() => {
    let estimatedRevenue = 0;
    let totalReceived = 0;
    let openBalance = 0;
    let activeRoutesCount = 0;

    filteredPeriodCharters.forEach(c => {
      if (c.status !== 'cancelled') {
        const val = c.value || 0;
        estimatedRevenue += val;
        activeRoutesCount++;
        if (c.paymentStatus === 'received') {
          totalReceived += val;
        } else {
          openBalance += val;
        }
      }
    });

    return {
      totalCount: filteredPeriodCharters.length,
      activeRoutesCount,
      estimatedRevenue,
      totalReceived,
      openBalance
    };
  }, [filteredPeriodCharters]);

  const listedPeriodCharters = useMemo(() => {
    const activeTrips = filteredPeriodCharters.filter(t => t.paymentStatus !== 'received');
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeTrips;
    return activeTrips.filter(c => 
      c.client?.toLowerCase().includes(q) ||
      c.origin?.toLowerCase().includes(q) ||
      c.destination?.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q)
    );
  }, [filteredPeriodCharters, searchQuery]);

  const filteredClients = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return clients;
    return clients.filter(client => 
      client.name?.toLowerCase().includes(q) ||
      client.companyName?.toLowerCase().includes(q) ||
      client.document?.toLowerCase().includes(q)
    );
  }, [clients, searchQuery]);

  const tripCountsByClient = useMemo(() => {
    const counts: Record<string, number> = {};
    clients.forEach(c => { counts[c.id] = 0; });
    clientCharters.forEach(t => {
      if (t.clientId && counts[t.clientId] !== undefined) {
        counts[t.clientId]++;
      } else if (t.client) {
        const lowerName = t.client.toLowerCase();
        const found = clients.find(c => c.name?.toLowerCase() === lowerName);
        if (found) counts[found.id] = (counts[found.id] || 0) + 1;
      }
    });
    return counts;
  }, [clients, clientCharters]);

  const routeExecutionData = useMemo(() => {
    if (!selectedClientDetail || !selectedClientDetail.fixedRoutes || selectedClientDetail.fixedRoutes.length === 0) {
      return [];
    }
    const targetYearMonth = format(currentCalendarDate, 'yyyy-MM');
    const tripsInMonth = clientTripsForSelectedClient.filter(t => 
      t.dateTime && t.dateTime.startsWith(targetYearMonth)
    );
    return selectedClientDetail.fixedRoutes.map(route => {
      const defaultDriver = employees.find(e => e.id === route.driverId);
      const defaultDriverName = defaultDriver ? defaultDriver.name.toUpperCase().split(' ')[0] : 'NÃO DEFINIDO';
      const matchingTrips = tripsInMonth.filter(t => 
        t.description?.toUpperCase() === route.name?.toUpperCase()
      );
      const actualDriverCounts: Record<string, number> = {};
      matchingTrips.forEach(t => {
        const drv = employees.find(e => e.id === t.driverId);
        const drvName = drv ? drv.name.toUpperCase() : 'NÃO DEFINIDO';
        actualDriverCounts[drvName] = (actualDriverCounts[drvName] || 0) + 1;
      });
      const driverBreakdown = Object.entries(actualDriverCounts)
        .map(([name, count]) => `${name} (${count}x)`)
        .join(', ');
      return {
        name: route.name.toUpperCase(),
        frequency: matchingTrips.length,
        defaultDriver: defaultDriverName,
        driverBreakdown: driverBreakdown || 'Nenhuma viagem realizada',
      };
    });
  }, [selectedClientDetail, clientTripsForSelectedClient, currentCalendarDate, employees]);

  // Handle active running route toggles
  const handleToggleRunRoute = async (route: CharteredRoute) => {
    const isStarting = route.runState !== 'running';
    try {
      await updateDoc(doc(db, 'chartered_routes', route.id), {
        runState: isStarting ? 'running' : 'idle',
        runStartedAt: isStarting ? new Date().toISOString() : null
      });
      
      if (isStarting) {
        setIsFloatingNavDismissed(false);
        toast.info(`Fretamento ${route.name.toUpperCase()} iniciado!`);
        
        setNavIndexes(prev => {
          const updated = { ...prev, [route.id]: 0 };
          localStorage.setItem('active_route_nav_' + route.id, '0');
          return updated;
        });

        setActiveGpsRoute(route);
        setActiveGpsPassengerIndex(0);
        setIsGpsPanelOpen(true);
        setIsGpsBubbleOnlyMode(true);
        setIsBubbleMinimized(false);

        // Auto opening route navigation GPS map external link
        const navPassengers = (route.passengers || []).slice(0, 20);
        const first = navPassengers[0];
        const destUrl = getMapsDirUrl(
          first ? first.locationUrl : route.locationUrl,
          first ? `${first.name} ${route.client}` : `${route.name} ${route.client}`,
          userCoords
        );
        window.open(destUrl, '_blank');
      } else {
        toast.success(`Fretamento ${route.name.toUpperCase()} concluído.`);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chartered_routes');
    }
  };

  const handleNextPassenger = (shouldOpenExternal: boolean = true) => {
    if (!activeGpsRoute) return;
    const maxIdx = Math.min(Math.max((activeGpsRoute.passengers || []).length, 0), 20);
    
    if (activeGpsPassengerIndex + 1 < maxIdx) {
      const nextIdx = activeGpsPassengerIndex + 1;
      setActiveGpsPassengerIndex(nextIdx);
      
      setNavIndexes(prev => {
        const updated = { ...prev, [activeGpsRoute.id]: nextIdx };
        localStorage.setItem('active_route_nav_' + activeGpsRoute.id, String(nextIdx));
        return updated;
      });

      if (shouldOpenExternal) {
        const nextPassenger = (activeGpsRoute.passengers || [])[nextIdx];
        if (nextPassenger) {
          const nextUrl = getMapsDirUrl(
            nextPassenger.locationUrl,
            `${nextPassenger.name} ${activeGpsRoute.client}`,
            userCoords
          );
          window.open(nextUrl, '_blank');
        }
      }
    } else {
      toast.success("🏁 Itinerário de passageiros concluído!");
      setActiveGpsRoute(null);
      setIsGpsPanelOpen(false);
    }
  };

  const handlePrevPassenger = () => {
    if (!activeGpsRoute || activeGpsPassengerIndex <= 0) return;
    const prevIdx = activeGpsPassengerIndex - 1;
    setActiveGpsPassengerIndex(prevIdx);
    setNavIndexes(prev => {
      const updated = { ...prev, [activeGpsRoute.id]: prevIdx };
      localStorage.setItem('active_route_nav_' + activeGpsRoute.id, String(prevIdx));
      return updated;
    });
  };

  const handleSelectPassengerIndex = (idx: number) => {
    if (!activeGpsRoute) return;
    setActiveGpsPassengerIndex(idx);
    setNavIndexes(prev => {
      const updated = { ...prev, [activeGpsRoute.id]: idx };
      localStorage.setItem('active_route_nav_' + activeGpsRoute.id, String(idx));
      return updated;
    });
  };

  // Toggle checklist of completed dates for continuous routines
  const handleToggleRouteDateCompleted = async (routeId: string, dateStr: string) => {
    try {
      const route = routes.find(r => r.id === routeId);
      if (!route) return;
      
      const completedDates = route.completedDates || [];
      const updated = completedDates.includes(dateStr)
        ? completedDates.filter(d => d !== dateStr)
        : [...completedDates, dateStr];

      await updateDoc(doc(db, 'chartered_routes', routeId), {
        completedDates: updated
      });
      toast.success(completedDates.includes(dateStr) ? "Presença desmarcada!" : "Viagem agendada da data registrada como REALIZADA!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'chartered_routes');
    }
  };

  // Create & Edit DB operations wrappers for split forms
  const handleCreateRouteSubmit = async (routeData: any) => {
    try {
      if (!navigator.onLine) {
        await charterIndexedDBService.saveOfflineRoute({
          ...routeData,
          status: 'active',
          runState: 'idle' as 'running' | 'idle'
        } as any);
        setShowAddForm(false);
        toast.warning("Sem conexão de rede. Fretamento agendado localmente (IndexedDB) e será sincronizado quando o sinal de internet retornar!", {
          duration: 6000
        });
        return;
      }
      await addDoc(collection(db, 'chartered_routes'), {
        ...routeData,
        createdAt: serverTimestamp(),
        status: 'active',
        runState: 'idle'
      });
      setShowAddForm(false);
      toast.success("Rota cadastrada com sucesso!");
    } catch (e: any) {
      if (!navigator.onLine || e.message?.toLowerCase().includes('offline') || e.message?.toLowerCase().includes('network')) {
        try {
          await charterIndexedDBService.saveOfflineRoute({
            ...routeData,
            status: 'active',
            runState: 'idle' as 'running' | 'idle'
          } as any);
          setShowAddForm(false);
          toast.warning("Falha temporária de escrita. Fretamento agendado localmente (IndexedDB) e será sincronizado em breve!", {
            duration: 6000
          });
          return;
        } catch (localErr) {
          console.error("Erro no IndexedDB fallback:", localErr);
        }
      }
      handleFirestoreError(e, OperationType.WRITE, 'chartered_routes');
    }
  };

  const handleUpdateRouteSubmit = async (routeData: any) => {
    try {
      const { id, ...saveData } = routeData;
      await updateDoc(doc(db, 'chartered_routes', id), {
        ...saveData,
        updatedAt: serverTimestamp()
      });
      setShowEditForm(false);
      setEditingRoute(null);
      toast.success("Fretamento atualizado!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'chartered_routes');
    }
  };

  const handleLaunchQuickRouteSubmit = async () => {
    if (!quickRoute.name || !quickRoute.client) {
      toast.error('Preencha os campos obrigatórios (Nome e Cliente).');
      return;
    }
    const routeData: Omit<CharteredRoute, 'id'> = {
      name: quickRoute.name,
      client: quickRoute.client,
      type: quickRoute.type as any,
      daysOfWeek: quickRoute.daysOfWeek,
      schedules: [{ departureTime: quickRoute.departureTime, returnTime: quickRoute.returnTime }],
      fixedVehicleId: quickRoute.fixedVehicleId,
      fixedDriverId: quickRoute.fixedDriverId,
      passengerCount: 0,
      status: 'active',
      runState: 'idle',
      passengers: []
    };

    try {
      if (!navigator.onLine) {
        await charterIndexedDBService.saveOfflineRoute(routeData);
        setQuickRoute({
          name: '',
          client: '',
          type: 'factory',
          daysOfWeek: [1, 2, 3, 4, 5],
          departureTime: '08:00',
          returnTime: '17:00',
          fixedVehicleId: '',
          fixedDriverId: ''
        });
        toast.warning("Sem conexão. Rota rápida agendada localmente (IndexedDB) e será sincronizada quando o sinal retornar!", {
          duration: 6000
        });
        return;
      }
      await addDoc(collection(db, 'chartered_routes'), {
        ...routeData,
        createdAt: serverTimestamp()
      });
      setQuickRoute({
        name: '',
        client: '',
        type: 'factory',
        daysOfWeek: [1, 2, 3, 4, 5],
        departureTime: '08:00',
        returnTime: '17:00',
        fixedVehicleId: '',
        fixedDriverId: ''
      });
      toast.success("Rota rápida vinculada!");
    } catch (e: any) {
      if (!navigator.onLine || e.message?.toLowerCase().includes('offline') || e.message?.toLowerCase().includes('network')) {
        try {
          await charterIndexedDBService.saveOfflineRoute(routeData);
          setQuickRoute({
            name: '',
            client: '',
            type: 'factory',
            daysOfWeek: [1, 2, 3, 4, 5],
            departureTime: '08:00',
            returnTime: '17:00',
            fixedVehicleId: '',
            fixedDriverId: ''
          });
          toast.warning("Escrita local realizada por perda de conexão com o servidor. A rota será sincronizada automaticamente!", {
            duration: 6000
          });
          return;
        } catch (localErr) {
          console.error("Erro no IndexedDB fallback rápido:", localErr);
        }
      }
      handleFirestoreError(e, OperationType.WRITE, 'chartered_routes');
    }
  };

  // Client database write operations
  const handleAddClientSubmit = async () => {
    if (!newClient.name) {
      toast.error("Insira o nome fantasia do cliente.");
      return;
    }
    try {
      await addDoc(collection(db, 'charter_clients'), {
        ...newClient,
        createdAt: serverTimestamp()
      });
      setShowRegisterClientForm(false);
      setNewClient({
        name: '',
        companyName: '',
        document: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        defaultTripValue: 0,
        extraTripsNotes: '',
        extraWorksNotes: ''
      });
      toast.success("Cliente cadastrado no banco de dados!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  const handleUpdateClientSubmit = async () => {
    if (!editingClient || !editingClient.name) return;
    try {
      await updateDoc(doc(db, 'charter_clients', editingClient.id), {
        name: editingClient.name,
        companyName: editingClient.companyName || '',
        document: editingClient.document || '',
        phone: editingClient.phone || '',
        email: editingClient.email || '',
        address: editingClient.address || '',
        notes: editingClient.notes || '',
        defaultTripValue: editingClient.defaultTripValue || 0,
        extraTripsNotes: editingClient.extraTripsNotes || '',
        extraWorksNotes: editingClient.extraWorksNotes || '',
        updatedAt: serverTimestamp()
      });
      setShowEditClientForm(false);
      setEditingClient(null);
      toast.success("Ficha do cliente de cobrança atualizada!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  const handleDeleteClient = async (id: string, name: string) => {
    if (!confirm(`Excluir permanentemente o cadastro de ${name.toUpperCase()}?`)) return;
    try {
      await deleteDoc(doc(db, 'charter_clients', id));
      toast.success("Cliente excluído.");
      setSelectedClientDetail(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  // Toggle calendar worked day for client monthly invoicing calculation
  const handleToggleClientWorkedDay = async (clientId: string, dateStr: string) => {
    const clientItem = clients.find(c => c.id === clientId);
    if (!clientItem) return;
    
    try {
      const workedDays = clientItem.workedDays || [];
      const isAdding = !workedDays.includes(dateStr);
      const updated = isAdding
        ? [...workedDays, dateStr]
        : workedDays.filter(d => d !== dateStr);

      await updateDoc(doc(db, 'charter_clients', clientId), {
        workedDays: updated
      });

      // Update selected detail in-state immediately so the view stays perfectly in sync
      setSelectedClientDetail(prev => prev ? { ...prev, workedDays: updated } : null);

      if (isAdding) {
        // Automatic pre-filling based on configured Fixed Routes
        const fixedRoutes = clientItem.fixedRoutes || [];
        if (fixedRoutes.length > 0) {
          const dateParts = dateStr.split('-');
          const year = parseInt(dateParts[0], 10);
          const month = parseInt(dateParts[1], 10) - 1;
          const day = parseInt(dateParts[2], 10);
          const parsedDate = new Date(year, month, day);
          const dayOfWeekValue = parsedDate.getDay();

          let createdCount = 0;
          for (const route of fixedRoutes) {
            const matchesDay = route.daysOfWeek?.includes(dayOfWeekValue);
            if (matchesDay) {
              // Parse departure time from schedule e.g., "06:15 - 15:30"
              const routeTime = route.schedule ? route.schedule.split('-')[0].trim() : '08:00';
              const validTimePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
              const timePart = validTimePattern.test(routeTime) ? routeTime : '08:00';
              const dateTimeStr = `${dateStr}T${timePart}`;

              // Check if already exists to prevent duplicate
              const alreadyExists = clientCharters.some(
                trip => trip.clientId === clientId && trip.dateTime === dateTimeStr && trip.description === route.name.toUpperCase()
              );

              if (!alreadyExists) {
                await addDoc(collection(db, 'charter_client_trips'), {
                  client: clientItem.name,
                  clientId: clientId,
                  description: route.name.toUpperCase(),
                  dateTime: dateTimeStr,
                  origin: "GARAGEM",
                  destination: "VINCULADO",
                  value: clientItem.defaultTripValue || 0,
                  driverId: route.driverId,
                  vehicleId: route.vehicleId || '',
                  status: 'pending',
                  paymentStatus: 'open',
                  passengerCount: 0,
                  createdAt: serverTimestamp()
                });
                createdCount++;
              }
            }
          }
          if (createdCount > 0) {
            toast.success(`${createdCount} viagem(ns) automática(s) preenchida(s) para este dia!`);
          } else {
            // Lançar uma viagem manual padrão caso não haja rota fixa coincidente
            await addDoc(collection(db, 'charter_client_trips'), {
              client: clientItem.name,
              clientId: clientId,
              description: "FRETAMENTO PROGRAMADO",
              dateTime: `${dateStr}T08:00`,
              origin: "GARAGEM",
              destination: "VINCULADO",
              value: clientItem.defaultTripValue || 0,
              status: 'pending',
              paymentStatus: 'open',
              passengerCount: 0,
              createdAt: serverTimestamp()
            });
            toast.success("Viagem manual registrada para este dia!");
          }
        } else {
          // Sem rotas fixas cadastradas, lança uma viagem padrão
          await addDoc(collection(db, 'charter_client_trips'), {
            client: clientItem.name,
            clientId: clientId,
            description: "FRETAMENTO PROGRAMADO",
            dateTime: `${dateStr}T08:00`,
            origin: "GARAGEM",
            destination: "VINCULADO",
            value: clientItem.defaultTripValue || 0,
            status: 'pending',
            paymentStatus: 'open',
            passengerCount: 0,
            createdAt: serverTimestamp()
          });
          toast.success("Viagem manual registrada para este dia!");
        }
      } else {
        // We are toggling OFF. Let's automatically clean up matching trips to keep things synchronized!
        const tripsToDelete = clientCharters.filter(
          trip => trip.clientId === clientId && trip.dateTime.startsWith(dateStr)
        );
        let deletedCount = 0;
        for (const trip of tripsToDelete) {
          await deleteDoc(doc(db, 'charter_client_trips', trip.id));
          deletedCount++;
        }
        if (deletedCount > 0) {
          toast.info(`Removido e limpo ${deletedCount} viagem(ns) deste dia.`);
        } else {
          toast.info("Dia de presença limpo!");
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  const handleAutoFillMonthWithFixedRoutes = async (clientId: string) => {
    const clientItem = clients.find(c => c.id === clientId);
    if (!clientItem) return;
    const fixedRoutes = clientItem.fixedRoutes || [];
    if (fixedRoutes.length === 0) {
      toast.error("Nenhuma rota fixa cadastrada no contrato deste cliente.");
      return;
    }

    if (!confirm(`Preencher automaticamente todas as viagens deste mês (${format(currentCalendarDate, 'MMMM yyyy')}) baseando-se nas rotas fixas cadastradas?`)) {
      return;
    }

    try {
      // Get first day and last day of current calendar date month
      const startDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth(), 1);
      const endDay = new Date(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth() + 1, 0);

      const workedDays = clientItem.workedDays ? [...clientItem.workedDays] : [];
      let updatedWorkedDays = [...workedDays];
      let tripsCreated = 0;

      for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
        const dateStr = format(d, 'yyyy-MM-dd');
        const dayOfWeekValue = d.getDay();

        // Check matching fixed routes for this day of week
        const matchingRoutes = fixedRoutes.filter(route => route.daysOfWeek?.includes(dayOfWeekValue));
        if (matchingRoutes.length > 0) {
          // Add to workedDays if not present
          if (!updatedWorkedDays.includes(dateStr)) {
            updatedWorkedDays.push(dateStr);
          }

          for (const route of matchingRoutes) {
            const routeTime = route.schedule ? route.schedule.split('-')[0].trim() : '08:00';
            const validTimePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            const timePart = validTimePattern.test(routeTime) ? routeTime : '08:00';
            const dateTimeStr = `${dateStr}T${timePart}`;

            // Check if already exists
            const alreadyExists = clientCharters.some(
              trip => trip.clientId === clientId && trip.dateTime === dateTimeStr && trip.description === route.name.toUpperCase()
            );

            if (!alreadyExists) {
              await addDoc(collection(db, 'charter_client_trips'), {
                client: clientItem.name,
                clientId: clientId,
                description: route.name.toUpperCase(),
                dateTime: dateTimeStr,
                origin: "GARAGEM",
                destination: "VINCULADO",
                value: clientItem.defaultTripValue || 0,
                driverId: route.driverId,
                vehicleId: route.vehicleId || '',
                status: 'pending',
                paymentStatus: 'open',
                passengerCount: 0,
                createdAt: serverTimestamp()
              });
              tripsCreated++;
            }
          }
        }
      }

      // Save updated worked days
      await updateDoc(doc(db, 'charter_clients', clientId), {
        workedDays: updatedWorkedDays
      });
      setSelectedClientDetail({
        ...clientItem,
        workedDays: updatedWorkedDays
      });

      if (tripsCreated > 0) {
        toast.success(`Mesclado com sucesso! ${tripsCreated} novas viagens automáticas geradas.`);
      } else {
        toast.info("Nenhuma nova viagem pendente para este mês.");
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  const handleAddFixedRoute = async (clientId: string, newRoute: { name: string; schedule: string; driverId: string; vehicleId?: string; daysOfWeek?: number[] }) => {
    const clientItem = clients.find(c => c.id === clientId);
    if (!clientItem) return;
    const currentFixed = clientItem.fixedRoutes || [];
    const updatedRoutes = [
      ...currentFixed,
      {
        id: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9),
        ...newRoute
      }
    ];
    try {
      await updateDoc(doc(db, 'charter_clients', clientId), {
        fixedRoutes: updatedRoutes
      });
      setSelectedClientDetail({
        ...clientItem,
        fixedRoutes: updatedRoutes
      });
      toast.success("Rota fixa adicionada ao contrato do cliente!");
      setNewFixedRouteName('');
      setNewFixedRouteSchedule('');
      setNewFixedRouteDriverId('');
      setNewFixedRouteVehicleId('');
      setNewFixedRouteDays([]);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  const handleRemoveFixedRoute = async (clientId: string, routeId: string) => {
    const clientItem = clients.find(c => c.id === clientId);
    if (!clientItem) return;
    const currentFixed = clientItem.fixedRoutes || [];
    const updatedRoutes = currentFixed.filter(r => r.id !== routeId);
    try {
      await updateDoc(doc(db, 'charter_clients', clientId), {
        fixedRoutes: updatedRoutes
      });
      setSelectedClientDetail({
        ...clientItem,
        fixedRoutes: updatedRoutes
      });
      toast.success("Rota fixa removida.");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_clients');
    }
  };

  // Launch a new custom Client Trip
  const handleAddNewClientTripSubmit = async () => {
    if (!newClientCharter.client) {
      toast.error("Vincule um cliente à operação.");
      return;
    }
    try {
      const parentClient = clients.find(c => c.id === newClientCharter.clientId);
      const feeVal = newClientCharter.isExtra 
        ? (newClientCharter.value || 0)
        : (parentClient?.defaultTripValue || newClientCharter.value || 0);

      const descriptionVal = isQuickMode && !newClientCharter.description 
        ? "FRETAMENTO RÁPIDO" 
        : newClientCharter.description;

      const originVal = isQuickMode && !newClientCharter.origin 
        ? "A definir" 
        : newClientCharter.origin;

      const destinationVal = isQuickMode && !newClientCharter.destination 
        ? "A definir" 
        : newClientCharter.destination;

      if (isMultiTripEnabled && dailyTrips.length > 0) {
        let createdCount = 0;
        const targetDates = selectedLaunchDays.length > 0
          ? selectedLaunchDays
          : [newClientCharter.dateTime ? newClientCharter.dateTime.split('T')[0] : format(new Date(), 'yyyy-MM-dd')];

        for (const dateStr of targetDates) {
          for (const trip of dailyTrips) {
            const dtStr = `${dateStr}T${trip.time || '12:00'}`;
            const tripVal = trip.value !== undefined && trip.value !== null ? Number(trip.value) : feeVal;
            const tripDesc = descriptionVal ? `${descriptionVal} (${trip.label})` : trip.label;

            await addDoc(collection(db, 'charter_client_trips'), {
              ...newClientCharter,
              description: tripDesc,
              origin: originVal,
              destination: destinationVal,
              value: tripVal,
              dateTime: dtStr,
              createdAt: serverTimestamp()
            });
            createdCount++;
          }
        }
        setSelectedLaunchDays([]);
        toast.success(`${createdCount} viagens salvas com sucesso!`);
      } else if (selectedLaunchDays.length > 0) {
        // In case we did batch dates selections in calendar grid
        for (const date of selectedLaunchDays) {
          const dtStr = `${date}T${launchTime || '12:00'}`;
          await addDoc(collection(db, 'charter_client_trips'), {
            ...newClientCharter,
            description: descriptionVal,
            origin: originVal,
            destination: destinationVal,
            value: feeVal,
            dateTime: dtStr,
            createdAt: serverTimestamp()
          });
        }
        setSelectedLaunchDays([]);
        toast.success(`Mais ${selectedLaunchDays.length} viagens lançadas em lote!`);
      } else {
        const finalDateTime = newClientCharter.dateTime || format(new Date(), "yyyy-MM-dd'T'HH:mm");
        await addDoc(collection(db, 'charter_client_trips'), {
          ...newClientCharter,
          description: descriptionVal,
          origin: originVal,
          destination: destinationVal,
          value: feeVal,
          dateTime: finalDateTime,
          createdAt: serverTimestamp()
        });
        toast.success("Fretamento avulso registrado!");
      }
      setShowClientAddForm(false);
      setIsQuickMode(false);
      setIsMultiTripEnabled(false);
      setDailyTrips([
        { id: '1', time: '07:00', label: 'Saída 1 (Manhã)', value: 0 },
        { id: '2', time: '17:00', label: 'Saída 2 (Tarde)', value: 0 }
      ]);
      setNewClientCharter({
        client: '',
        clientId: '',
        description: '',
        dateTime: '',
        origin: '',
        destination: '',
        value: 0,
        driverId: '',
        vehicleId: '',
        status: 'pending',
        paymentStatus: 'open',
        passengerCount: 0,
        isExtra: false,
        hasExtraService: false,
        extraServiceDesc: '',
        extraServiceVal: 0
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleUpdateClientTripSubmit = async () => {
    if (!editingClientCharter) return;
    try {
      const { id, ...data } = editingClientCharter;
      await updateDoc(doc(db, 'charter_client_trips', id), {
        ...data,
        updatedAt: serverTimestamp()
      });
      setShowClientEditForm(false);
      setEditingClientCharter(null);
      toast.success("Serviço de fretamento do cliente atualizado!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleDeleteClientTrip = async (id: string) => {
    if (!confirm("Excluir definitivamente este registro de viagem?")) return;
    try {
      await deleteDoc(doc(db, 'charter_client_trips', id));
      toast.success("Viagem removida do dossiê.");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleMarkTripAsPaid = async (id: string) => {
    try {
      await updateDoc(doc(db, 'charter_client_trips', id), {
        paymentStatus: 'received',
        updatedAt: serverTimestamp()
      });
      toast.success("Viagem marcada como PAGA!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleMarkTripAsBilled = async (id: string) => {
    try {
      await updateDoc(doc(db, 'charter_client_trips', id), {
        paymentStatus: 'billed',
        updatedAt: serverTimestamp()
      });
      toast.success("Viagem marcada como FATURADA!");
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleClearClientTripHistory = async (clientId: string, clientName: string) => {
    if (!clientId) return;
    const isConfirmed = confirm(`ATENÇÃO: Tem certeza absoluta que deseja APAGAR TODO O HISTÓRICO de lançamentos de viagens para o cliente "${clientName}"? Esta ação é irreversível.`);
    if (!isConfirmed) return;
    
    try {
      const nameLower = clientName.toLowerCase();
      const tripsToDelete = clientCharters.filter(t => t.clientId === clientId || t.client?.toLowerCase() === nameLower);
      
      if (tripsToDelete.length === 0) {
        toast.info("Não há viagens no histórico deste cliente para apagar.");
        return;
      }
      
      for (const t of tripsToDelete) {
        await deleteDoc(doc(db, 'charter_client_trips', t.id));
      }
      toast.success(`Histórico limpo! ${tripsToDelete.length} registros de viagens foram apagados.`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  // Closing Dossier Modal Operations wrappers
  const handleBulkUpdateClosingTrips = async (option: 'billed' | 'received') => {
    const isSuccess = confirm(`Tem certeza que deseja declarar as viagens marcadas como ${option.toUpperCase()}?`);
    if (!isSuccess) return;

    try {
      const tIds = Object.keys(selectedClosingTrips).filter(id => selectedClosingTrips[id]);
      for (const id of tIds) {
        await updateDoc(doc(db, 'charter_client_trips', id), {
          paymentStatus: option,
          updatedAt: serverTimestamp()
        });
      }
      setIsClosingModalOpen(false);
      setClosingPreviewData(null);
      toast.success(`${tIds.length} viagens faturadas e atualizadas com sucesso!`);
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, 'charter_client_trips');
    }
  };

  const handleSendWhatsAppClosingSummary = () => {
    if (!selectedClientDetail) return;
    const clientPhone = selectedClientDetail.phone ? selectedClientDetail.phone.replace(/\D/g, '') : '';
    const openTrips = filteredClosingTrips.filter(t => selectedClosingTrips[t.id]);
    
    let total = 0;
    let message = `*DM TURISMO - FECHAMENTO OPERACIONAL*\n\n`;
    message += `Prezado financeiro *${selectedClientDetail.name.toUpperCase()}*,\n`;
    message += `Seguem as ordens de saídas e fretamentos organizados para fins de conferência nesta competência:\n\n`;
    
    openTrips.forEach((trip, index) => {
      const baseVal = trip.isExtra ? (trip.value || 0) : (selectedClientDetail.defaultTripValue || trip.value || 0);
      const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
      const dailyRate = baseVal + extraVal;
      total += dailyRate;
      message += `*${(index + 1).toString().padStart(2, '0')}.* ${safeFormatDate(trip.dateTime, 'dd/MM/yyyy HH:mm')} - R$ ${dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      message += `Route: ${trip.description.toUpperCase()}${trip.hasExtraService ? ` (+ EXTRA: ${trip.extraServiceDesc?.toUpperCase()} - R$ ${trip.extraServiceVal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}\n`;
      message += `📍 ${trip.origin || ''} -> ${trip.destination || ''}\n\n`;
    });
    
    message += `------------------------------------\n`;
    message += `*TOTAL DE SERVIÇOS:* ${openTrips.length} viagem(ns)\n`;
    message += `*VALOR CONSOLIDADO:* R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    message += `Ficamos no aguardo da aprovação para faturamento/liquidação. Obrigado pela parceria! DM Turismo.`;
    
    window.open(`https://api.whatsapp.com/send?phone=55${clientPhone}&text=${encodeURIComponent(message)}`, '_blank');
    toast.success('Rascunho de fechamento preparado e enviado para o WhatsApp.');
  };

  const handleSendEmailClosingSummary = () => {
    if (!selectedClientDetail) return;
    const clientEmail = selectedClientDetail.email || '';
    const openTrips = filteredClosingTrips.filter(t => selectedClosingTrips[t.id]);
    
    let total = 0;
    let subject = `DM TURISMO - FECHAMENTO OPERACIONAL - ${selectedClientDetail.name.toUpperCase()}`;
    let body = `Prezado departamento financeiro da ${selectedClientDetail.name.toUpperCase()},\n\n`;
    body += `Esperamos que este e-mail o encontre bem.\n\n`;
    body += `Apresentamos o relatório de fechamento das viagens e fretamentos realizados na competência selecionada:\n\n`;
    
    openTrips.forEach((trip, index) => {
      const baseVal = trip.isExtra ? (trip.value || 0) : (selectedClientDetail.defaultTripValue || trip.value || 0);
      const extraVal = (trip.hasExtraService && trip.extraServiceVal) ? trip.extraServiceVal : 0;
      const dailyRate = baseVal + extraVal;
      total += dailyRate;
      body += `${index + 1}. ${safeFormatDate(trip.dateTime, 'dd/MM/yyyy HH:mm')} - R$ ${dailyRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n`;
      body += `   Itinerário: ${trip.description.toUpperCase()}${trip.hasExtraService ? ` (+ EXTRA: ${trip.extraServiceDesc?.toUpperCase()} - R$ ${trip.extraServiceVal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : ''}\n`;
      body += `   Trajeto: ${trip.origin || ''} -> ${trip.destination || ''}\n\n`;
    });
    
    body += `------------------------------------\n`;
    body += `TOTAL DE SERVIÇOS: ${openTrips.length} viagem(ns)\n`;
    body += `VALOR CONSOLIDADO: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n\n`;
    body += `O arquivo PDF detalhado contendo as especificações operacionais de cada trecho foi anexado ao nosso faturamento.\n`;
    body += `Solicitamos a validação dos lançamentos para darmos prosseguimento à emissão da Nota Fiscal e Boleto Bancário.\n\n`;
    body += `Qualquer dúvida ou ajuste, estamos à inteira disposição.\n\n`;
    body += `Atenciosamente,\n`;
    body += `Financeiro - DM Turismo Pro\n`;
    
    window.open(`mailto:${clientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
    toast.success('Rascunho de e-mail financeiro preparado para envio!');
  };

  // Confirm Modal state wrapper
  const [deleteConfirm, setDeleteConfirm] = useState<{ 
    isOpen: boolean; 
    onConfirm: () => void; 
    title: string; 
    message: string;
  }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });

  const handleDeleteRoutePrompt = (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Excluir Fretamento',
      message: `Tem certeza que deseja excluir permanentemente a rota "${name}"? Esta ação não pode ser desfeita.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'chartered_routes', id));
          toast.success('Rota de fretamento excluída.');
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'chartered_routes');
        }
        setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleDaySelectionInLaunch = (dateStr: string) => {
    setSelectedLaunchDays(prev => 
      prev.includes(dateStr) ? prev.filter(d => d !== dateStr) : [...prev, dateStr]
    );
  };

  const handleToggleAllDaysInMonthInLaunch = () => {
    const year = launchCalendarDate.getFullYear();
    const month = launchCalendarDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const allDays: string[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      allDays.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    }

    if (selectedLaunchDays.length === allDays.length) {
      setSelectedLaunchDays([]);
    } else {
      setSelectedLaunchDays(allDays);
    }
  };

  // Continuous routes filtering query
  const listedRoutes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return routes;
    return routes.filter(r => 
      r.name?.toLowerCase().includes(q) ||
      r.client?.toLowerCase().includes(q)
    );
  }, [routes, searchQuery]);

  return (
    <div className="p-1 md:p-6 space-y-6">
      {/* Action Assist Widget Overlay GPS */}
      <AnimatePresence>
        {isGpsPanelOpen && activeGpsRoute && (
          <GpsAssistant
            activeGpsRoute={activeGpsRoute}
            activeGpsPassengerIndex={activeGpsPassengerIndex}
            isGpsPanelOpen={isGpsPanelOpen}
            isGpsMiniMenuOpen={isGpsMiniMenuOpen}
            isGpsBubbleOnlyMode={isGpsBubbleOnlyMode}
            isBubbleMinimized={isBubbleMinimized}
            userCoords={userCoords}
            onCloseGps={() => {
              if (activeGpsRoute) {
                updateDoc(doc(db, 'chartered_routes', activeGpsRoute.id), { runState: 'idle' }).catch(console.error);
              }
              setActiveGpsRoute(null);
              setIsGpsPanelOpen(false);
            }}
            onNextPassenger={handleNextPassenger}
            onPrevPassenger={handlePrevPassenger}
            onSelectPassengerIndex={handleSelectPassengerIndex}
            onToggleBubbleMode={setIsGpsBubbleOnlyMode}
            onToggleMinimized={() => setIsBubbleMinimized(!isBubbleMinimized)}
          />
        )}
      </AnimatePresence>

      {/* Main Top Header and Selector Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-zinc-950 p-6 border border-zinc-900 rounded-[32px] shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent shadow">
            <Route size={24} />
          </div>
          <div>
            <span className="text-[8px] font-black tracking-widest text-[#ff6b00] uppercase font-sans">DM Fretamento</span>
            <h1 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight">Gestão de Fretamentos</h1>
          </div>
        </div>

        {hasClientCharterAccess && (
          <div className="flex gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setShowClientAddForm(true)}
              className="py-2.5 px-5 bg-brand-accent hover:bg-white text-zinc-950 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow transition-all"
            >
              <Plus size={14} /> Lançar Viagem
            </button>
          </div>
        )}
      </div>

      {/* Tab Contents Orchestrator */}
      <AnimatePresence mode="wait">
        {activeTab === 'routes' ? (
          <motion.div
            key="routes-tab"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Left Main list panel card */}
            <div className="lg:col-span-8 space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">
                  Escalas e Itinerários Recorrentes ({listedRoutes.length})
                </span>
                
                <div className="relative w-full md:w-72">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Pesquisar rota ou cliente..."
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-brand-accent"
                  />
                </div>
              </div>

              {listedRoutes.length === 0 ? (
                <div className="bg-zinc-950 p-12 text-center rounded-[32px] border border-dashed border-zinc-900 text-zinc-500 font-bold uppercase text-[10px] space-y-2">
                  <AlertCircle size={32} className="text-zinc-800 mx-auto" />
                  <p>Nenhuma rota encontrada.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {listedRoutes.map((route) => {
                    const matchedDriver = employees.find(e => e.id === route.fixedDriverId);
                    const matchedVehicle = vehicles.find(v => v.id === route.fixedVehicleId);
                    const runIdx = navIndexes[route.id] || 0;
                    const totPsgs = (route.passengers || []).length;
                    
                    return (
                      <div
                        key={route.id}
                        className={cn(
                          "bg-zinc-950 p-5 rounded-[28px] border transition-all hover:border-zinc-800 relative group overflow-hidden shadow-sm",
                          route.runState === 'running' 
                            ? "border-rose-500/40 shadow-[0_4px_25px_rgba(239,68,68,0.1)]" 
                            : "border-zinc-900"
                        )}
                      >
                        {/* Interactive glow border and LED indicator */}
                        {route.runState === 'running' && (
                          <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 animate-pulse" />
                        )}

                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                          <div className="flex items-start gap-3.5">
                            <div className={cn(
                              "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                              route.runState === 'running'
                                ? "bg-rose-950/45 text-rose-500 border-rose-500/25 animate-pulse"
                                : "bg-zinc-900 text-zinc-500 border-zinc-850"
                            )}>
                              {route.runState === 'running' ? <Compass size={20} className="animate-spin-slow" /> : <Route size={20} />}
                            </div>

                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">{route.client}</span>
                                <span className="text-zinc-800">•</span>
                                <span className={cn(
                                  "text-[7px] font-black uppercase px-2 py-0.5 rounded border tracking-wider",
                                  route.type === 'factory' 
                                    ? "bg-amber-500/5 text-amber-500 border-amber-500/10" 
                                    : "bg-indigo-500/5 text-indigo-500 border-indigo-500/10"
                                )}>
                                  {route.type === 'factory' ? 'Fábrica' : route.type === 'school' ? 'Escolar' : 'Avulso/Outro'}
                                </span>
                              </div>
                              <h3 className="text-sm font-black text-white uppercase tracking-tight mt-1 truncate max-w-[200px] md:max-w-none">
                                {route.name}
                              </h3>
                              <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-widest mt-1">
                                {matchedDriver ? `Mot. Fixo: ${matchedDriver.name.toUpperCase().split(' ')[0]}` : 'Nenhum motorista fixado'} 
                                {matchedVehicle ? ` • Placa: ${matchedVehicle.plate.toUpperCase()}` : ''}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t border-zinc-900 md:border-0 pt-3 md:pt-0">
                            {/* Run route control handler */}
                            <button
                              onClick={() => handleToggleRunRoute(route)}
                              className={cn(
                                "px-3.5 py-2.0 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all active:scale-95",
                                route.runState === 'running'
                                  ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/10"
                                  : "bg-zinc-900 text-[#ff6b00] border border-zinc-850 hover:bg-brand-accent hover:text-zinc-950 hover:border-brand-accent font-sans"
                              )}
                            >
                              {route.runState === 'running' ? (
                                <><span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" /> Monitorar Rota</>
                              ) : (
                                <><Play size={9} /> Iniciar Rota GPS</>
                              )}
                            </button>

                            {/* Options popup bar or details drawer */}
                            <button
                              onClick={() => exportRouteToOfflineHtml(route)}
                              className="p-2 bg-zinc-900 hover:bg-zinc-850 text-emerald-500 rounded-xl border border-zinc-850 cursor-pointer"
                              title="Exportar HTML Navegador Offline"
                            >
                              <Smartphone size={14} />
                            </button>
                            <button
                              onClick={() => exportRouteToGpx(route)}
                              className="p-2 bg-zinc-900 hover:bg-zinc-850 text-indigo-400 rounded-xl border border-zinc-850 cursor-pointer"
                              title="Exportar Itinerário GPX (Offilne Maps)"
                            >
                              <MapPin size={14} />
                            </button>
                            <button
                              onClick={() => exportRouteToPdf(route)}
                              className="p-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 rounded-xl border border-zinc-850 cursor-pointer"
                              title="Gerar PDF Imprimir"
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => {
                                setEditingRoute(route);
                                setShowEditForm(true);
                              }}
                              className="p-2 bg-zinc-900 hover:bg-zinc-850 text-amber-500 rounded-xl border border-zinc-850 cursor-pointer"
                              title="Editar Fretamento"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteRoutePrompt(route.id, route.name)}
                              className="p-2 bg-zinc-900 hover:bg-rose-950/20 text-rose-500 rounded-xl border border-zinc-850 cursor-pointer"
                              title="Excluir"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Collapsing schedules details strip block */}
                        {route.schedules && route.schedules.length > 0 && route.daysOfWeek && (
                          <div className="mt-4 pt-3.5 border-t border-zinc-900 flex justify-between items-center text-[8px] font-bold text-zinc-650 uppercase tracking-widest flex-wrap gap-2">
                            <div className="flex items-center gap-1 text-zinc-500">
                              <Clock size={11} className="text-zinc-700" />
                              <span>Horários: {route.schedules.map(sc => `${sc.departureTime} -> ${sc.returnTime}`).join(' | ')}</span>
                            </div>
                            <div className="flex gap-0.5">
                              {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dayChar, i) => {
                                const isAct = route.daysOfWeek.includes(i);
                                return (
                                  <span
                                    key={i}
                                    className={cn(
                                      "w-4 h-4 rounded-md flex items-center justify-center text-[7px] font-black border",
                                      isAct 
                                        ? "bg-[#ff6b00]/10 text-[#ff6b00] border-[#ff6b00]/20 font-sans" 
                                        : "bg-zinc-900/40 text-zinc-700 border-zinc-900/40"
                                    )}
                                  >
                                    {dayChar}
                                  </span>
                                );
                              })}
                            </div>
                            <div className="flex items-center gap-1.5 text-zinc-500">
                              <Users size={11} className="text-zinc-700" />
                              <span>Passageiros: <span className="font-extrabold text-white">{totPsgs} cadastrados</span></span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Quick Add Panel Card */}
            <div className="lg:col-span-4">
              <div className="bg-zinc-950 p-6 border border-zinc-900 rounded-[32px] space-y-4 shadow-sm sticky top-6">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-tight">Vincular Atribuição Rápida</h3>
                  <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-0.5">Adicionar um fretamento industrial imediato para a escala</p>
                </div>

                <div className="space-y-3 pt-2">
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nome da Escala</label>
                    <input
                      type="text"
                      placeholder="Ex: Turno Noturno 22h"
                      value={quickRoute.name}
                      onChange={(e) => setQuickRoute({...quickRoute, name: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Cliente / Empresa</label>
                    <Select
                      value={quickRoute.client}
                      onChange={(e) => setQuickRoute({...quickRoute, client: e.target.value})}
                      options={[
                        { value: '', label: 'SELECIONAR CLIENTE' },
                        ...clients.map(c => ({ value: c.name, label: c.name.toUpperCase() }))
                      ]}
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Saída</label>
                      <input
                        type="time"
                        value={quickRoute.departureTime}
                        onChange={(e) => setQuickRoute({...quickRoute, departureTime: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Retorno</label>
                      <input
                        type="time"
                        value={quickRoute.returnTime}
                        onChange={(e) => setQuickRoute({...quickRoute, returnTime: e.target.value})}
                        className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1">Selecionar frota fixa</label>
                    <select
                      value={quickRoute.fixedVehicleId}
                      onChange={(e) => setQuickRoute({...quickRoute, fixedVehicleId: e.target.value})}
                      className="w-full bg-zinc-900 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                    >
                      <option value="">A DEFINIR DO PÁTIO</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.prefix ? `[FROTA #${v.prefix}] ${v.plate.toUpperCase()}` : v.plate.toUpperCase()} - {v.model?.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Motorista</label>
                    <select
                      value={quickRoute.fixedDriverId}
                      onChange={(e) => setQuickRoute({...quickRoute, fixedDriverId: e.target.value})}
                      className="w-full bg-zinc-900 border border-[#27272a] rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                    >
                      <option value="">A DEFINIR DA ESCALA</option>
                      {employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => (
                        <option key={e.id} value={e.id}>{e.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleLaunchQuickRouteSubmit}
                    className="w-full py-2.5 bg-[#ff6b00]/10 hover:bg-[#ff6b00] text-[#ff6b00] hover:text-zinc-950 font-black border border-[#ff6b00]/25 rounded-2xl text-[10px] uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Vincular Rápido
                  </button>
                </div>
              </div>

              {/* Offline Route Manager Subpanel */}
              <div className="mt-6">
                <CharterOfflineManager />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <motion.div
        key="client-charters-tab"
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        className="space-y-6"
      >
            {/* Period metrics / statistics widgets panel */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Total Viagens Realizadas</span>
                <h4 className="text-2xl font-black text-white mt-1">{periodStats.totalCount}</h4>
                <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-1">Nesta competência</p>
              </div>
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-[#ff6b00]">Clientes Ativos</span>
                <h4 className="text-2xl font-black text-[#ff6b00] mt-1">{clients.length}</h4>
                <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-wider mt-1">Fretamentos contratados</p>
              </div>
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-emerald-500">Rotas Recorrentes</span>
                <h4 className="text-2xl font-black text-emerald-500 mt-1">{routes.length}</h4>
                <p className="text-[8px] font-bold text-emerald-700 uppercase tracking-wider mt-1">Escalas de linha contínua</p>
              </div>
              <div className="bg-zinc-950 p-5 rounded-3xl border border-zinc-900">
                <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest text-amber-500">Viagens Extras</span>
                <h4 className="text-2xl font-black text-amber-500 mt-1">{clientCharters.filter(t => t.isExtra && t.status !== 'cancelled').length}</h4>
                <p className="text-[8px] font-bold text-amber-700 uppercase tracking-wider mt-1">Viagens avulsas no mês</p>
              </div>
            </div>

            {/* Split layout: Selector List and details card view */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column Selector */}
              <div className="lg:col-span-4 space-y-4">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={selectedClientDetail === null ? "Buscar viagens/rotas..." : "Buscar nos clientes..."}
                    className="w-full bg-zinc-950 border border-zinc-900 rounded-2xl py-2 pl-9 pr-4 text-xs text-white outline-none focus:border-brand-accent placeholder-zinc-650"
                  />
                </div>

                <div className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-900 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                      Clientes ({clients.length})
                    </span>
                    <button
                      onClick={() => setShowRegisterClientForm(true)}
                      className="p-1.5 bg-brand-accent/10 hover:bg-brand-accent text-brand-accent hover:text-zinc-950 rounded-lg transition-all cursor-pointer"
                      title="Novo Cliente"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {filteredClients.map(cl => {
                      const isActive = selectedClientDetail?.id === cl.id;
                      const count = tripCountsByClient[cl.id] || 0;
                      return (
                        <div
                          key={cl.id}
                          className={cn(
                            "p-3 border rounded-2xl transition-all flex items-center justify-between group",
                            isActive 
                              ? "bg-brand-accent/5 border-brand-accent/40" 
                              : "bg-zinc-900/30 border-zinc-900/60 hover:border-zinc-800"
                          )}
                        >
                          <div 
                            onClick={() => setSelectedClientDetail(cl)}
                            className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                          >
                            <div className="w-7 h-7 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-500 shrink-0">
                              <Building2 size={14} />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-[11px] font-black text-white uppercase truncate group-hover:text-brand-accent transition-colors">
                                {cl.name}
                              </h4>
                              <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 truncate">
                                CNPJ: {cl.document || 'NÃO LANÇADO'}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[7px] font-black uppercase text-zinc-400 bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded">
                              {count} saídas
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClient(cl.id, cl.name);
                              }}
                              className="p-1.5 bg-zinc-950 hover:bg-rose-950/20 text-rose-500 border border-zinc-850 rounded-lg opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                              title="Excluir Cliente"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-zinc-950 p-5 rounded-[28px] border border-zinc-900 space-y-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Período de Escala</span>
                    {selectedClientDetail && (
                      <button
                        onClick={() => setSelectedClientDetail(null)}
                        className="text-[8px] font-black text-[#ff6b00] hover:text-white uppercase tracking-widest cursor-pointer"
                      >
                        Ver Geral
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-zinc-500 uppercase block">Início</label>
                      <input
                        type="date"
                        value={clientStartDate}
                        onChange={(e) => setClientStartDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[10px] text-white outline-none focus:border-brand-accent cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[7px] font-black text-zinc-500 uppercase block">Fim</label>
                      <input
                        type="date"
                        value={clientEndDate}
                        onChange={(e) => setClientEndDate(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2 text-[10px] text-white outline-none focus:border-brand-accent cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column details layout */}
              <div className="lg:col-span-8 flex flex-col h-full space-y-6">
                {selectedClientDetail === null ? (
                  <>
                    {/* Fichas dos Clientes (Dossiês Cadastrados) */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-[32px] p-6 space-y-4 shadow-sm">
                      <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
                        <div>
                          <span className="text-[10px] font-black text-white uppercase tracking-widest font-sans">
                            Fichas e Dossiês dos Clientes ({filteredClients.length})
                          </span>
                          <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                            Visualização contínua das fichas operacionais e anotações extras
                          </p>
                        </div>
                      </div>

                      {filteredClients.length === 0 ? (
                        <div className="bg-zinc-900/10 text-center py-10 rounded-2xl border border-dashed border-zinc-850 flex flex-col items-center justify-center space-y-2 text-zinc-500">
                          <Building2 size={24} className="text-zinc-800" />
                          <p className="text-[9px] font-black uppercase tracking-wider">Nenhum cliente cadastrado.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredClients.map((client) => {
                            const fixedRoutesCount = client.fixedRoutes?.length || 0;
                            const workedDaysCount = client.workedDays?.length || 0;
                            const clientTrips = clientCharters.filter(t => t.clientId === client.id && t.status !== 'cancelled');

                            return (
                              <div 
                                key={client.id}
                                className="bg-zinc-900/30 border border-zinc-900 hover:border-zinc-800 rounded-2xl p-4 flex flex-col justify-between transition-all group shadow-sm"
                              >
                                <div className="space-y-3">
                                  {/* Header card details */}
                                  <div className="flex justify-between items-start gap-2">
                                    <div className="truncate">
                                      <h4 className="text-[11px] font-black text-white uppercase tracking-tight group-hover:text-brand-accent transition-colors truncate">
                                        {client.name}
                                      </h4>
                                      <p className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest truncate">
                                        {client.companyName || 'Razão Social não informada'}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Contacts small badges */}
                                  <div className="grid grid-cols-2 gap-1.5 text-[7px] font-mono text-zinc-400 uppercase bg-zinc-950/40 p-2 rounded-xl border border-zinc-900">
                                    <div className="truncate">
                                      <span className="text-zinc-650 block text-[6px]">DOC/CNPJ</span>
                                      <span className="font-bold text-zinc-300 truncate block">{client.document || '---'}</span>
                                    </div>
                                    <div className="truncate">
                                      <span className="text-zinc-650 block text-[6px]">TELEFONE</span>
                                      <span className="font-bold text-zinc-300 truncate block">{client.phone || '---'}</span>
                                    </div>
                                  </div>

                                  {/* Contract stats and schedules */}
                                  <div className="grid grid-cols-2 gap-2 text-[7px] font-black uppercase tracking-wider">
                                    <div className="bg-zinc-950/20 p-2 border border-zinc-900 rounded-xl">
                                      <span className="text-zinc-500 block text-[6px]">ROTAS FIXAS</span>
                                      <span className="text-white font-mono font-extrabold block mt-0.5">{fixedRoutesCount} Rotas</span>
                                    </div>
                                    <div className="bg-zinc-950/20 p-2 border border-zinc-900 rounded-xl">
                                      <span className="text-zinc-500 block text-[6px]">PRESENÇA MÊS</span>
                                      <span className="text-white font-mono font-extrabold block mt-0.5">{workedDaysCount} Dias</span>
                                    </div>
                                  </div>

                                  {/* Anotações Extras de Viagens e Trabalhos */}
                                  <div className="space-y-2 pt-2 border-t border-zinc-900/65 font-sans">
                                    <div className="space-y-0.5">
                                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                                        Anotações de Viagens Extras (além das rotas fixas)
                                      </label>
                                      <textarea
                                        className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-lg p-2 text-[9px] text-zinc-300 placeholder-zinc-700 outline-none resize-none h-11 transition-all font-sans leading-relaxed"
                                        placeholder="Digite observações de viagens adicionais..."
                                        value={client.extraTripsNotes || ''}
                                        onChange={async (e) => {
                                          const text = e.target.value;
                                          setClients(prev => prev.map(c => c.id === client.id ? { ...c, extraTripsNotes: text } : c));
                                          try {
                                            await updateDoc(doc(db, 'charter_clients', client.id), {
                                              extraTripsNotes: text
                                            });
                                          } catch (err) {
                                            console.error("Erro ao salvar:", err);
                                          }
                                        }}
                                      />
                                    </div>

                                    <div className="space-y-0.5">
                                      <label className="text-[7px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                                        Anotações de Trabalhos Extras / Observações
                                      </label>
                                      <textarea
                                        className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-lg p-2 text-[9px] text-zinc-300 placeholder-zinc-700 outline-none resize-none h-11 transition-all font-sans leading-relaxed"
                                        placeholder="Digite outros trabalhos e particularidades..."
                                        value={client.extraWorksNotes || ''}
                                        onChange={async (e) => {
                                          const text = e.target.value;
                                          setClients(prev => prev.map(c => c.id === client.id ? { ...c, extraWorksNotes: text } : c));
                                          try {
                                            await updateDoc(doc(db, 'charter_clients', client.id), {
                                              extraWorksNotes: text
                                            });
                                          } catch (err) {
                                            console.error("Erro ao salvar:", err);
                                          }
                                        }}
                                      />
                                    </div>
                                  </div>
                                </div>

                                {/* Actions row */}
                                <div className="grid grid-cols-2 gap-2 mt-3.5 pt-2.5 border-t border-zinc-900/60 font-sans">
                                  <button
                                    onClick={() => setSelectedClientDetail(client)}
                                    className="py-1.5 bg-[#ff6b00] hover:bg-white text-zinc-950 text-[8px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <Building2 size={10} /> Abrir Dossiê
                                  </button>
                                  <button
                                    onClick={() => {
                                      setNewClientCharter({
                                        client: client.name,
                                        clientId: client.id,
                                        description: '',
                                        dateTime: '',
                                        origin: '',
                                        destination: '',
                                        value: client.defaultTripValue || 0,
                                        driverId: '',
                                        vehicleId: '',
                                        status: 'pending',
                                        paymentStatus: 'open',
                                        passengerCount: 0,
                                        isExtra: true,
                                        hasExtraService: false,
                                        extraServiceDesc: '',
                                        extraServiceVal: 0
                                      });
                                      setShowClientAddForm(true);
                                    }}
                                    className="py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-810 text-zinc-400 hover:text-white text-[8px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1"
                                  >
                                    <Plus size={10} /> Viagem Extra
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Histórico Geral de Fretamentos Avulsos */}
                    <div className="bg-zinc-950 border border-zinc-900 rounded-[32px] p-6 space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-zinc-900">
                        <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest font-sans">
                          Histórico Geral de Fretamentos Avulsos ({listedPeriodCharters.length})
                        </span>
                      </div>

                      <div className="overflow-x-auto min-h-[300px]">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-zinc-900 text-zinc-500 uppercase text-[8px] font-black tracking-widest">
                              <th className="py-3 px-3">Data / Hora</th>
                              <th className="py-3 px-3">Cliente</th>
                              <th className="py-3 px-3">Serviço/Itinerário</th>
                              <th className="py-3 px-3 text-center">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-900/60 font-sans">
                            {listedPeriodCharters.map((t) => {
                              return (
                                <tr key={t.id} className="hover:bg-zinc-900/20 font-sans text-white">
                                  <td className="py-3 px-3 whitespace-nowrap align-middle">
                                    {safeFormatDate(t.dateTime, 'dd/MM, HH:mm')}
                                  </td>
                                  <td className="py-3 px-3 align-middle font-extrabold uppercase">
                                    {t.client}
                                  </td>
                                  <td className="py-3 px-3 align-middle uppercase truncate max-w-[150px]">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="truncate">{t.description}</span>
                                      {t.isExtra && (
                                        <span className="px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-wider bg-[#ff6b00]/20 text-[#ff6b00] border border-[#ff6b00]/30 font-sans shrink-0">
                                          EXTRA
                                        </span>
                                      )}
                                      {t.hasExtraService && (
                                        <span className="px-1.5 py-0.5 rounded text-[6px] font-black uppercase tracking-wider bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-sans shrink-0">
                                          + {t.extraServiceDesc?.toUpperCase()}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-3 px-3 text-center align-middle whitespace-nowrap">
                                    <div className="flex gap-1.5 justify-center">
                                      <button
                                        onClick={() => {
                                          setEditingClientCharter(t);
                                          setShowClientEditForm(true);
                                        }}
                                        className="p-1 bg-zinc-900 hover:bg-zinc-850 text-amber-500 border border-zinc-850 rounded-lg cursor-pointer"
                                        title="Editar"
                                      >
                                        <Edit size={12} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteClientTrip(t.id)}
                                        className="p-1 bg-zinc-900 hover:bg-rose-950/20 text-rose-500 border border-zinc-850 rounded-lg cursor-pointer"
                                        title="Excluir"
                                      >
                                        <Trash2 size={12} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex-1">
                    <div className="bg-zinc-950 border border-zinc-900 rounded-[32px] p-6 space-y-6">
                        {(() => {
                          const clientRoutes = routes.filter(r => r.client?.toLowerCase() === selectedClientDetail.name?.toLowerCase());
                          const isOperationalOnly = !hasClientCharterAccess;
                          const currentDetailTab = isOperationalOnly ? 'routes' : clientDetailTab;
                          return (
                            <>
                              {/* Dynamic Active Client Detail View panel */}
                              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-zinc-900">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                                    <Building2 size={20} />
                                  </div>
                                  <div>
                                    <h3 className="text-base font-black text-white uppercase tracking-tight">
                                      {selectedClientDetail.name}
                                    </h3>
                                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                                      {selectedClientDetail.companyName || 'Razão social não formulada'}
                                    </p>
                                  </div>
                                </div>

                                <div className="flex gap-2.5 flex-wrap">
                                  <button
                                    onClick={() => {
                                      setNewClientCharter({
                                        client: selectedClientDetail.name,
                                        clientId: selectedClientDetail.id,
                                        description: '',
                                        dateTime: '',
                                        origin: '',
                                        destination: '',
                                        value: selectedClientDetail.defaultTripValue || 0,
                                        driverId: '',
                                        vehicleId: '',
                                        status: 'pending',
                                        paymentStatus: 'open',
                                        passengerCount: 0,
                                        isExtra: true,
                                        hasExtraService: false,
                                        extraServiceDesc: '',
                                        extraServiceVal: 0
                                      });
                                      setShowClientAddForm(true);
                                    }}
                                    className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-[#ff6b00] border border-zinc-850 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-1.5"
                                  >
                                    <Sparkles size={11} className="text-[#ff6b00]" /> Viagem Extra
                                  </button>
                                  <button
                                    onClick={() => setShowClientValues(!showClientValues)}
                                    className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 border border-zinc-850 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer flex items-center gap-1.5 transition-all"
                                    title={showClientValues ? "Ocultar Valores Financeiros" : "Exibir Valores Financeiros"}
                                  >
                                    {showClientValues ? (
                                      <>
                                        <EyeOff size={11} className="text-amber-400" /> Ocultar Valores
                                      </>
                                    ) : (
                                      <>
                                        <Eye size={11} className="text-zinc-400" /> Exibir Valores
                                      </>
                                    )}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingClient(selectedClientDetail);
                                      setShowEditClientForm(true);
                                    }}
                                    className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-850 text-amber-500 border border-zinc-850 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer"
                                  >
                                    Editar Cadastro
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClient(selectedClientDetail.id, selectedClientDetail.name)}
                                    className="px-3 py-2 bg-zinc-900 hover:bg-rose-950/20 text-rose-500 border border-zinc-810 rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer"
                                  >
                                    Remover
                                  </button>
                                </div>
                              </div>

                              {/* Seletor de Abas Internas da Ficha do Cliente */}
                              {hasClientCharterAccess && (
                                <div className="flex border-b border-zinc-900 pb-1 gap-4">
                                  <button
                                    onClick={() => setClientDetailTab('billing_frequency')}
                                    className={cn(
                                      "pb-2 px-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 relative",
                                      currentDetailTab === 'billing_frequency'
                                        ? "border-brand-accent text-brand-accent font-black"
                                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    )}
                                  >
                                    Frequência e Acertos
                                  </button>
                                  <button
                                    onClick={() => setClientDetailTab('routes')}
                                    className={cn(
                                      "pb-2 px-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 relative",
                                      currentDetailTab === 'routes'
                                        ? "border-brand-accent text-brand-accent font-black"
                                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    )}
                                  >
                                    Rotas Contínuas (Recorrentes)
                                  </button>
                                  <button
                                    onClick={() => setClientDetailTab('fixed_routes_contract')}
                                    className={cn(
                                      "pb-2 px-1 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border-b-2 relative",
                                      currentDetailTab === 'fixed_routes_contract'
                                        ? "border-brand-accent text-brand-accent font-black"
                                        : "border-transparent text-zinc-500 hover:text-zinc-300"
                                    )}
                                  >
                                    Configurar Rotas Fixas
                                  </button>
                                </div>
                              )}

                              {currentDetailTab === 'billing_frequency' && (
                                <>
                                  {/* Calendar Presence Registry details */}
                                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          <div className="space-y-4">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                              Worked Presence Calendar (Frequência Mensal)
                            </span>
                            
                            <div className="flex justify-between items-center bg-zinc-900 p-3.5 border border-zinc-850 rounded-2xl">
                              <button 
                                onClick={() => {
                                  const d = new Date(currentCalendarDate);
                                  d.setMonth(d.getMonth() - 1);
                                  setCurrentCalendarDate(d);
                                }}
                                className="p-1 text-zinc-400 hover:text-white"
                              >
                                <ChevronLeft size={16} />
                              </button>
                              <span className="text-[10px] font-black uppercase tracking-wider text-white">
                                {format(currentCalendarDate, 'MMMM yyyy')}
                              </span>
                              <button 
                                onClick={() => {
                                  const d = new Date(currentCalendarDate);
                                  d.setMonth(d.getMonth() + 1);
                                  setCurrentCalendarDate(d);
                                }}
                                className="p-1 text-zinc-400 hover:text-white"
                              >
                                <ChevronRight size={16} />
                              </button>
                            </div>

                            {selectedClientDetail.fixedRoutes && selectedClientDetail.fixedRoutes.length > 0 && (
                              <button
                                onClick={() => handleAutoFillMonthWithFixedRoutes(selectedClientDetail.id)}
                                className="w-full py-2.5 px-4 bg-brand-accent/10 border border-brand-accent/20 hover:bg-brand-accent hover:text-zinc-950 text-brand-accent rounded-xl text-[9px] font-black uppercase tracking-widest cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow"
                              >
                                <Sparkles size={11} /> Preencher Mês por Rotas Fixas
                              </button>
                            )}

                            {/* Calendar Grid rendering */}
                            <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-zinc-500">
                              {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(w => (
                                <div key={w} className="py-1 uppercase text-[8px]">{w}</div>
                              ))}
                              {calendarGridDays.map((day, idx) => {
                                if (!day) return <div key={idx} />;
                                const dateStr = format(day, 'yyyy-MM-dd');
                                const isWorked = selectedClientDetail.workedDays?.includes(dateStr);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => handleToggleClientWorkedDay(selectedClientDetail.id, dateStr)}
                                    className={cn(
                                      "py-2 rounded-lg font-black text-[10px] transition-colors border cursor-pointer",
                                      isWorked 
                                        ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" 
                                        : "bg-zinc-950 border-zinc-900 text-zinc-400 hover:border-zinc-700"
                                    )}
                                  >
                                    {day.getDate()}
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Stat blocks for specific client profile */}
                          <div className="space-y-6">
                            <div className="bg-zinc-900/60 border border-zinc-900 rounded-[28px] p-5 space-y-4 flex flex-col justify-between">
                              <div>
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                                  Detalhes de Acertos
                                </span>
                                <div className="space-y-3.5 mt-3">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-zinc-400">Total de Viagens registradas</span>
                                    <span className="font-extrabold text-white">{clientTripsForSelectedClient.length} serviços</span>
                                  </div>

                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-zinc-400">Dossiês em Aberto</span>
                                    <span className="font-extrabold text-amber-500">
                                      {currentClientOpenTrips.length} viagens pendentes
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => exportClientDossierPdf(selectedClientDetail, clientTripsForSelectedClient, employees, vehicles)}
                                className="w-full py-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              >
                                <FileText size={13} /> Dossiê Operacional Completo
                              </button>
                            </div>

                            {/* Consulta por Período & Dossiê Customizado */}
                            <div className="bg-zinc-900/60 border border-zinc-900 rounded-[28px] p-5 space-y-4">
                              <div>
                                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                                  Consulta de Serviços por Período
                                </span>
                                <p className="text-[8px] text-zinc-400 mt-1 uppercase tracking-wider">
                                  Selecione as datas para apurar as rotas realizadas e gerar o dossiê detalhado
                                </p>
                                
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                  <div>
                                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-wider block mb-1 font-sans">
                                      Data Inicial
                                    </label>
                                    <input 
                                      type="date"
                                      value={periodStartDate}
                                      onChange={(e) => setPeriodStartDate(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-xl text-[10px] p-2.5 font-sans focus:outline-none focus:border-brand-accent transition-colors"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-wider block mb-1 font-sans">
                                      Data Final
                                    </label>
                                    <input 
                                      type="date"
                                      value={periodEndDate}
                                      onChange={(e) => setPeriodEndDate(e.target.value)}
                                      className="w-full bg-zinc-950 border border-zinc-850 text-white rounded-xl text-[10px] p-2.5 font-sans focus:outline-none focus:border-brand-accent transition-colors"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-3.5 mt-5 pt-4 border-t border-zinc-850/50">
                                  <div className="flex justify-between items-center text-xs">
                                    <span className="font-bold text-zinc-400">Serviços no período</span>
                                    <span className="font-extrabold text-white">
                                      {periodTripsStats.count} {periodTripsStats.count === 1 ? 'rota realizada' : 'rotas realizadas'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                onClick={() => exportClientPeriodDossierPdf(selectedClientDetail, periodTrips, periodStartDate, periodEndDate, employees, vehicles)}
                                disabled={periodTrips.length === 0}
                                className={cn(
                                  "w-full py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-1.5",
                                  periodTrips.length > 0
                                    ? "bg-brand-accent hover:bg-white text-zinc-950 shadow-md font-bold"
                                    : "bg-zinc-850 text-zinc-600 border border-zinc-900 cursor-not-allowed font-medium"
                                )}
                              >
                                <FileText size={13} /> Gerar Dossiê do Período
                              </button>
                            </div>
                          </div>
                        </div>

                         {/* Histórico Completo de Viagens para o Cliente */}
                        <div className="pt-6 border-t border-zinc-900 space-y-4">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Histórico de Fretamentos Avulsos</h4>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">Todas as viagens lançadas para este cliente (Aberto, Faturado, Pago)</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[8px] font-black text-zinc-400 bg-zinc-900 border border-zinc-850 px-2.5 py-1 rounded-xl">
                                {clientTripsForSelectedClient.length} no total
                              </span>
                              <button
                                onClick={() => {
                                  setNewClientCharter({
                                    client: selectedClientDetail.name,
                                    clientId: selectedClientDetail.id,
                                    description: '',
                                    dateTime: '',
                                    origin: '',
                                    destination: '',
                                    value: selectedClientDetail.defaultTripValue || 0,
                                    driverId: '',
                                    vehicleId: '',
                                    status: 'pending',
                                    paymentStatus: 'open',
                                    passengerCount: 0,
                                    isExtra: true,
                                    hasExtraService: false,
                                    extraServiceDesc: '',
                                    extraServiceVal: 0
                                  });
                                  setShowClientAddForm(true);
                                }}
                                className="text-[8px] font-black text-[#ff6b00] hover:text-white bg-[#ff6b00]/10 hover:bg-[#ff6b00] border border-[#ff6b00]/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer font-sans"
                              >
                                <Plus size={10} /> VIAGEM EXTRA
                              </button>
                              {clientTripsForSelectedClient.length > 0 && (
                                <button
                                  onClick={() => handleClearClientTripHistory(selectedClientDetail.id, selectedClientDetail.name)}
                                  className="text-[8px] font-black text-rose-500 hover:text-white bg-rose-950/20 hover:bg-rose-600 border border-rose-500/30 px-2.5 py-1 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                                  title="Apagar todo o histórico de lançamentos deste cliente"
                                >
                                  <Trash2 size={10} /> APAGAR HISTÓRICO
                                </button>
                              )}
                            </div>
                          </div>

                          {clientTripsForSelectedClient.length === 0 ? (
                            <div className="bg-zinc-950/45 text-center py-6 rounded-2xl border border-dashed border-zinc-850">
                              <p className="text-[9px] font-black text-zinc-500 uppercase tracking-wider">Nenhuma viagem registrada para este cliente.</p>
                            </div>
                          ) : (
                            <div className="overflow-x-auto max-h-[250px] overflow-y-auto pr-1">
                              <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                  <tr className="border-b border-zinc-900 text-zinc-500 uppercase text-[7px] font-black tracking-widest">
                                    <th className="py-2 px-3">Data / Hora</th>
                                    <th className="py-2 px-3">Serviço/Itinerário</th>
                                    <th className="py-2 px-3 text-center">Ações</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-900/40">
                                  {[...clientTripsForSelectedClient]
                                    .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime())
                                    .map((trip) => {
                                      return (
                                        <tr key={trip.id} className="hover:bg-zinc-900/10 text-white font-sans text-[10px]">
                                          <td className="py-2 px-3 whitespace-nowrap text-zinc-400">
                                            {safeFormatDate(trip.dateTime, 'dd/MM/yyyy, HH:mm')}
                                          </td>
                                          <td className="py-2 px-3 align-middle font-semibold max-w-[150px] truncate">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              <span className="uppercase">{trip.description}</span>
                                              {trip.isExtra && (
                                                <span className="px-1.5 py-0.5 rounded text-[5px] font-black uppercase tracking-wider bg-[#ff6b00]/20 text-[#ff6b00] border border-[#ff6b00]/30 font-sans">
                                                  EXTRA
                                                </span>
                                              )}
                                              {trip.hasExtraService && (
                                                <span className="px-1.5 py-0.5 rounded text-[5px] font-black uppercase tracking-wider bg-brand-accent/20 text-brand-accent border border-brand-accent/30 font-sans">
                                                  + {trip.extraServiceDesc?.toUpperCase()}
                                                </span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="py-2 px-3 text-center">
                                            <div className="flex gap-1 justify-center">
                                              <button
                                                onClick={() => {
                                                  setEditingClientCharter(trip);
                                                  setShowClientEditForm(true);
                                                }}
                                                className="p-1 bg-zinc-900 hover:bg-zinc-800 text-amber-500 border border-zinc-850 rounded-lg cursor-pointer"
                                                title="Editar Viagem"
                                              >
                                                <Edit size={10} />
                                              </button>
                                              <button
                                                onClick={() => handleDeleteClientTrip(trip.id)}
                                                className="p-1 bg-zinc-900 hover:bg-rose-950/20 text-rose-500 border border-zinc-850 rounded-lg cursor-pointer animate-none"
                                                title="Excluir"
                                              >
                                                <Trash2 size={10} />
                                              </button>
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </>)}

                      {/* Conteúdo de Rotas Contínuas do Cliente */}
                      {currentDetailTab === 'routes' && (
                        <div className="space-y-6 pt-2">
                          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-zinc-900">
                            <div>
                              <h4 className="text-xs font-black text-white uppercase tracking-wider">Rotas Contínuas do Cliente</h4>
                              <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5">Escalas de Fretamento Recorrentes e Itinerários cadastrados</p>
                            </div>
                            
                            {hasClientCharterAccess && (
                              <button
                                onClick={() => setShowAddForm(true)}
                                className="py-2 px-4 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-2 cursor-pointer shadow transition-all active:scale-95 shrink-0"
                              >
                                <Plus size={12} /> Cadastrar Rota
                              </button>
                            )}
                          </div>

                          {clientRoutes.length === 0 ? (
                            <div className="bg-zinc-950/45 text-center py-10 rounded-2xl border border-dashed border-zinc-850 flex flex-col items-center justify-center space-y-2 text-zinc-500">
                              <Route size={24} className="text-zinc-800" />
                              <p className="text-[9px] font-black uppercase tracking-wider">Nenhuma rota contínua cadastrada para este cliente.</p>
                              {hasClientCharterAccess && (
                                <button
                                  onClick={() => setShowAddForm(true)}
                                  className="mt-1 text-[8px] font-black text-[#ff6b00] hover:text-white uppercase tracking-widest underline cursor-pointer"
                                >
                                  Cadastrar Primeira Rota
                                </button>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
                              {clientRoutes.map((route) => {
                                const matchedDriver = employees.find(e => e.id === route.fixedDriverId);
                                const matchedVehicle = vehicles.find(v => v.id === route.fixedVehicleId);
                                const totPsgs = (route.passengers || []).length;

                                return (
                                  <div
                                    key={route.id}
                                    className={cn(
                                      "bg-zinc-900/40 p-5 rounded-[24px] border transition-all hover:border-zinc-800 relative group overflow-hidden shadow-sm",
                                      route.runState === 'running' 
                                        ? "border-rose-500/40 shadow-[0_4px_25px_rgba(239,68,68,0.1)]" 
                                        : "border-zinc-900"
                                    )}
                                  >
                                    {route.runState === 'running' && (
                                      <span className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-pink-600 to-amber-500 animate-pulse" />
                                    )}

                                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                      <div className="flex items-start gap-3.5">
                                        <div className={cn(
                                          "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                                          route.runState === 'running'
                                            ? "bg-rose-950/45 text-rose-500 border-rose-500/25 animate-pulse"
                                            : "bg-zinc-950 text-zinc-500 border-zinc-850"
                                        )}>
                                          {route.runState === 'running' ? <Compass size={18} className="animate-spin-slow" /> : <Route size={18} />}
                                        </div>

                                        <div>
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">{route.client}</span>
                                            <span className="text-zinc-800">•</span>
                                            <span className={cn(
                                              "text-[7px] font-black uppercase px-2 py-0.5 rounded border tracking-wider",
                                              route.type === 'factory' 
                                                ? "bg-amber-500/5 text-amber-500 border-amber-500/10" 
                                                : "bg-indigo-500/5 text-indigo-500 border-indigo-500/10"
                                            )}>
                                              {route.type === 'factory' ? 'Fábrica' : route.type === 'school' ? 'Escolar' : 'Avulso/Outro'}
                                            </span>
                                          </div>
                                          <h3 className="text-xs font-black text-white uppercase tracking-tight mt-1 truncate">
                                            {route.name}
                                          </h3>
                                          <p className="text-[8px] font-bold text-zinc-650 uppercase tracking-widest mt-1">
                                            {matchedDriver ? `Mot. Fixo: ${matchedDriver.name.toUpperCase().split(' ')[0]}` : 'Nenhum motorista fixado'} 
                                            {matchedVehicle ? ` • Placa: ${matchedVehicle.plate.toUpperCase()}` : ''}
                                          </p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-1.5 w-full md:w-auto justify-end border-t border-zinc-900/60 md:border-0 pt-3 md:pt-0">
                                        <button
                                          onClick={() => handleToggleRunRoute(route)}
                                          className={cn(
                                            "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest flex items-center gap-1 cursor-pointer transition-all active:scale-95",
                                            route.runState === 'running'
                                              ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-900/10"
                                              : "bg-zinc-900 text-[#ff6b00] border border-zinc-850 hover:bg-brand-accent hover:text-zinc-950 hover:border-brand-accent font-sans"
                                          )}
                                        >
                                          {route.runState === 'running' ? (
                                            <><span className="w-1.5 h-1.5 rounded-full bg-white animate-ping shrink-0" /> Monitorar</>
                                          ) : (
                                            <><Play size={8} /> Iniciar GPS</>
                                          )}
                                        </button>

                                        <button
                                          onClick={() => exportRouteToOfflineHtml(route)}
                                          className="p-1.5 bg-zinc-950 hover:bg-zinc-900 text-emerald-500 rounded-lg border border-zinc-850 cursor-pointer"
                                          title="Exportar HTML Navegador Offline"
                                        >
                                          <Smartphone size={12} />
                                        </button>
                                        <button
                                          onClick={() => exportRouteToGpx(route)}
                                          className="p-1.5 bg-zinc-950 hover:bg-zinc-900 text-indigo-400 rounded-lg border border-zinc-850 cursor-pointer"
                                          title="Exportar Itinerário GPX (Offilne Maps)"
                                        >
                                          <MapPin size={12} />
                                        </button>
                                        <button
                                          onClick={() => exportRouteToPdf(route)}
                                          className="p-1.5 bg-zinc-950 hover:bg-zinc-900 text-zinc-400 rounded-lg border border-zinc-850 cursor-pointer"
                                          title="Gerar PDF Imprimir"
                                        >
                                          <Printer size={12} />
                                        </button>
                                        
                                        {hasClientCharterAccess && (
                                          <>
                                            <button
                                              onClick={() => {
                                                setEditingRoute(route);
                                                setShowEditForm(true);
                                              }}
                                              className="p-1.5 bg-zinc-950 hover:bg-zinc-900 text-amber-500 rounded-lg border border-zinc-850 cursor-pointer"
                                              title="Editar Fretamento"
                                            >
                                              <Edit size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteRoutePrompt(route.id, route.name)}
                                              className="p-1.5 bg-zinc-950 hover:bg-rose-950/20 text-rose-500 rounded-lg border border-zinc-850 cursor-pointer"
                                              title="Excluir"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    {route.schedules && route.schedules.length > 0 && route.daysOfWeek && (
                                      <div className="mt-3.5 pt-3 border-t border-zinc-900/60 flex justify-between items-center text-[8px] font-bold text-zinc-650 uppercase tracking-widest flex-wrap gap-2">
                                        <div className="flex items-center gap-1 text-zinc-500">
                                          <Clock size={10} className="text-zinc-700" />
                                          <span>Horários: {route.schedules.map(sc => `${sc.departureTime} -> ${sc.returnTime}`).join(' | ')}</span>
                                        </div>
                                        <div className="flex gap-0.5">
                                          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dayChar, i) => {
                                            const isAct = route.daysOfWeek.includes(i);
                                            return (
                                              <span
                                                key={i}
                                                className={cn(
                                                  "w-3.5 h-3.5 rounded-md flex items-center justify-center text-[7px] font-black border",
                                                  isAct 
                                                    ? "bg-[#ff6b00]/10 text-[#ff6b00] border-[#ff6b00]/20 font-sans" 
                                                    : "bg-zinc-950 text-zinc-800 border-zinc-900/60"
                                                )}
                                              >
                                                {dayChar}
                                              </span>
                                            );
                                          })}
                                        </div>
                                        <div className="flex items-center gap-1 text-zinc-500">
                                          <Users size={10} className="text-zinc-700" />
                                          <span>Passageiros: <span className="font-extrabold text-white">{totPsgs}</span></span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}

                      {currentDetailTab === 'fixed_routes_contract' && (
                        <div className="space-y-6 pt-2">
                          <div className="pb-3 border-b border-zinc-900">
                            <h4 className="text-xs font-black text-white uppercase tracking-wider">Configuração de Rotas Fixas do Contrato</h4>
                            <p className="text-[8px] text-zinc-500 uppercase tracking-widest mt-0.5 font-sans">Vincule horários e motoristas pré-definidos para faturamentos consolidados</p>
                          </div>

                          {/* Recharts Route Frequency Bar Chart */}
                          {selectedClientDetail.fixedRoutes && selectedClientDetail.fixedRoutes.length > 0 && (
                            <div className="bg-zinc-900/20 p-5 rounded-[24px] border border-zinc-900 space-y-4 animate-fade-in">
                              <div className="flex justify-between items-center pb-2 border-b border-zinc-900/60">
                                <div>
                                  <span className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest block font-sans">
                                    Frequência de Execução de Rotas
                                  </span>
                                  <p className="text-[7px] text-zinc-500 uppercase tracking-widest font-sans font-bold mt-0.5">
                                    Controle mensal de execuções para evitar gargalos de escala
                                  </p>
                                </div>
                                <span className="text-[7px] font-black uppercase text-zinc-400 bg-zinc-950 border border-zinc-850 px-1.5 py-0.5 rounded shrink-0">
                                  COMPETÊNCIA: {format(currentCalendarDate, 'MM/yyyy')}
                                </span>
                              </div>

                              <div className="w-full">
                                <ResponsiveContainer width="100%" height={220}>
                                  <BarChart data={routeExecutionData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" opacity={0.3} vertical={false} />
                                    <XAxis 
                                      dataKey="name" 
                                      stroke="#71717a" 
                                      fontSize={8} 
                                      tickLine={false} 
                                      axisLine={false}
                                      tickFormatter={(value) => value.length > 12 ? `${value.slice(0, 10)}...` : value}
                                    />
                                    <YAxis 
                                      stroke="#71717a" 
                                      fontSize={8} 
                                      tickLine={false} 
                                      axisLine={false}
                                      allowDecimals={false}
                                    />
                                    <Tooltip 
                                      content={({ active, payload }) => {
                                        if (active && payload && payload.length) {
                                          const data = payload[0].payload;
                                          return (
                                            <div className="bg-zinc-950 border border-zinc-850 p-3 rounded-xl shadow-lg space-y-1 text-[9px] uppercase font-bold tracking-widest text-zinc-400">
                                              <p className="font-extrabold text-white">{data.name}</p>
                                              <p>Frequência: <span className="text-[#ff6b00] font-black">{data.frequency}x</span></p>
                                              <p>Motorista Padrão: <span className="text-white font-extrabold">{data.defaultDriver}</span></p>
                                              <p className="text-[7px] text-zinc-500 normal-case font-medium leading-normal">Escalas: {data.driverBreakdown}</p>
                                            </div>
                                          );
                                        }
                                        return null;
                                      }} 
                                      cursor={{ fill: 'rgba(255, 107, 0, 0.04)' }} 
                                    />
                                    <Bar 
                                      dataKey="frequency" 
                                      fill="#ff6b00" 
                                      radius={[6, 6, 0, 0]} 
                                      barSize={32}
                                    />
                                  </BarChart>
                                </ResponsiveContainer>
                              </div>

                              {/* Allocation insight details */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                <div className="bg-zinc-950/40 p-4 rounded-[20px] border border-zinc-900/60 space-y-2">
                                  <div className="flex items-center gap-2 text-[#ff6b00] text-[8px] font-black uppercase tracking-wider">
                                    <AlertCircle size={12} />
                                    <span>Prevenção de Gargalos</span>
                                  </div>
                                  <p className="text-[9px] text-zinc-400 font-bold uppercase leading-relaxed font-sans">
                                    Analise se a frequência de viagens na rota condiz com o contratado e se há sobrecarga ou trocas excessivas do motorista titular.
                                  </p>
                                </div>
                                <div className="bg-zinc-950/40 p-4 rounded-[20px] border border-zinc-900/60 space-y-2">
                                  <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block font-sans">Estatísticas Operacionais</span>
                                  <div className="space-y-1.5">
                                    {routeExecutionData.map((data, idx) => (
                                      <div key={idx} className="flex justify-between items-center text-[8px] font-bold uppercase tracking-wide">
                                        <span className="text-zinc-400 truncate max-w-[130px]">{data.name}</span>
                                        <span className="text-white shrink-0 font-extrabold font-mono">
                                          {data.frequency}X (Padrão: {data.defaultDriver})
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Form to Add New Fixed Route */}
                          {hasClientCharterAccess && (
                            <div className="bg-zinc-900/40 p-5 rounded-[24px] border border-zinc-900 space-y-4">
                              <span className="text-[9px] font-black text-[#ff6b00] uppercase tracking-widest block font-sans">
                                Cadastrar Nova Rota Fixa
                              </span>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Nome da Rota</label>
                                  <input
                                    type="text"
                                    value={newFixedRouteName}
                                    onChange={(e) => setNewFixedRouteName(e.target.value)}
                                    placeholder="EX: ROTA INTENORTE VESPERTINO"
                                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-brand-accent rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-700 outline-none uppercase font-bold transition-all"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Horário Pré-definido</label>
                                  <input
                                    type="text"
                                    value={newFixedRouteSchedule}
                                    onChange={(e) => setNewFixedRouteSchedule(e.target.value)}
                                    placeholder="EX: 06:15 - 15:30"
                                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-brand-accent rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-700 outline-none uppercase font-bold transition-all"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Motorista Pré-definido</label>
                                  <select
                                    value={newFixedRouteDriverId}
                                    onChange={(e) => setNewFixedRouteDriverId(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-brand-accent rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all uppercase font-bold cursor-pointer"
                                  >
                                    <option value="" className="text-zinc-500">SELECIONE UM MOTORISTA</option>
                                    {employees.filter(emp => emp.role?.toLowerCase().includes('motorista') || emp.role?.toLowerCase().includes('driver')).map((emp) => (
                                      <option key={emp.id} value={emp.id}>{emp.name.toUpperCase()}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1.5">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Veículo Opcional</label>
                                  <select
                                    value={newFixedRouteVehicleId}
                                    onChange={(e) => setNewFixedRouteVehicleId(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-850 focus:border-brand-accent rounded-xl px-3.5 py-2.5 text-xs text-white outline-none transition-all uppercase font-bold cursor-pointer"
                                  >
                                    <option value="" className="text-zinc-500">SELECIONE UM VEÍCULO (OPCIONAL)</option>
                                    {vehicles.map((veh) => (
                                      <option key={veh.id} value={veh.id}>{veh.prefix ? `[FROTA #${veh.prefix}] ${veh.plate.toUpperCase()}` : veh.plate.toUpperCase()} - {veh.model.toUpperCase()}</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-1.5 md:col-span-2">
                                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Dias da Semana</label>
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {[
                                      { value: 1, label: 'Seg' },
                                      { value: 2, label: 'Ter' },
                                      { value: 3, label: 'Qua' },
                                      { value: 4, label: 'Qui' },
                                      { value: 5, label: 'Sex' },
                                      { value: 6, label: 'Sáb' },
                                      { value: 0, label: 'Dom' }
                                    ].map((day) => {
                                      const isSelected = newFixedRouteDays.includes(day.value);
                                      return (
                                        <button
                                          key={day.value}
                                          type="button"
                                          onClick={() => {
                                            setNewFixedRouteDays(prev => 
                                              prev.includes(day.value)
                                                ? prev.filter(d => d !== day.value)
                                                : [...prev, day.value]
                                            );
                                          }}
                                          className={cn(
                                            "py-2 px-3.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border",
                                            isSelected
                                              ? "bg-[#ff6b00] border-[#ff6b00] text-white shadow-sm font-extrabold"
                                              : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700"
                                          )}
                                        >
                                          {day.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                              <div className="flex justify-end pt-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!newFixedRouteName || !newFixedRouteSchedule || !newFixedRouteDriverId) {
                                      toast.error("Por favor, preencha nome da rota, horário e motorista.");
                                      return;
                                    }
                                    if (newFixedRouteDays.length === 0) {
                                      toast.error("Por favor, selecione pelo menos um dia da semana.");
                                      return;
                                    }
                                    handleAddFixedRoute(selectedClientDetail.id, {
                                      name: newFixedRouteName,
                                      schedule: newFixedRouteSchedule,
                                      driverId: newFixedRouteDriverId,
                                      vehicleId: newFixedRouteVehicleId || undefined,
                                      daysOfWeek: newFixedRouteDays
                                    });
                                  }}
                                  className="py-2.5 px-5 bg-brand-accent hover:bg-white text-zinc-950 font-black text-[9px] uppercase tracking-wider rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow active:scale-95"
                                >
                                  <Plus size={12} /> Adicionar Rota Fixa
                                </button>
                              </div>
                            </div>
                          )}

                          {/* List of Registered Fixed Routes */}
                          <div className="space-y-3">
                            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                              Rotas Contratadas Cadastradas ({selectedClientDetail.fixedRoutes?.length || 0})
                            </span>

                            {!selectedClientDetail.fixedRoutes || selectedClientDetail.fixedRoutes.length === 0 ? (
                              <div className="bg-zinc-950/45 text-center py-10 rounded-2xl border border-dashed border-zinc-850 flex flex-col items-center justify-center space-y-2 text-zinc-500">
                                <Route size={24} className="text-zinc-800" />
                                <p className="text-[9px] font-black uppercase tracking-wider">Nenhuma rota fixa vinculada a este contrato.</p>
                                <p className="text-[8px] text-zinc-650 font-bold uppercase">Preencha o formulário acima para configurar horários e motoristas.</p>
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {selectedClientDetail.fixedRoutes.map((route) => {
                                  const routeDriver = employees.find(e => e.id === route.driverId);
                                  const routeVehicle = vehicles.find(v => v.id === route.vehicleId);
                                  return (
                                    <div key={route.id} className="bg-zinc-900/40 border border-zinc-900 rounded-[24px] p-4 flex flex-col justify-between hover:border-zinc-800 transition-all">
                                      <div className="flex justify-between items-start gap-4">
                                        <div className="space-y-1">
                                          <h5 className="text-[10px] font-black text-white uppercase tracking-wider">{route.name}</h5>
                                          <div className="flex items-center gap-1.5 text-[8px] font-bold text-[#ff6b00] uppercase tracking-widest">
                                            <Clock size={10} /> {route.schedule}
                                          </div>
                                          {route.daysOfWeek && route.daysOfWeek.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1.5">
                                              {[
                                                { val: 1, label: 'S' },
                                                { val: 2, label: 'T' },
                                                { val: 3, label: 'Q' },
                                                { val: 4, label: 'Q' },
                                                { val: 5, label: 'S' },
                                                { val: 6, label: 'S' },
                                                { val: 0, label: 'D' }
                                              ].map((d, i) => {
                                                const active = route.daysOfWeek?.includes(d.val);
                                                return (
                                                  <span
                                                    key={i}
                                                    className={cn(
                                                      "w-4 h-4 rounded-md flex items-center justify-center text-[7px] font-black border",
                                                      active
                                                        ? "bg-[#ff6b00]/10 text-[#ff6b00] border-[#ff6b00]/20 font-sans"
                                                        : "bg-zinc-950 text-zinc-700 border-zinc-900/30"
                                                    )}
                                                    title={d.label}
                                                  >
                                                    {d.label}
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          )}
                                        </div>
                                        {hasClientCharterAccess && (
                                          <button
                                            onClick={() => handleRemoveFixedRoute(selectedClientDetail.id, route.id)}
                                            className="p-1.5 bg-zinc-950 hover:bg-rose-950/20 text-rose-500 rounded-lg border border-zinc-850 cursor-pointer transition-all"
                                            title="Excluir"
                                          >
                                            <Trash2 size={12} />
                                          </button>
                                        )}
                                      </div>
                                      <div className="mt-4 pt-3 border-t border-zinc-900/60 flex justify-between items-center text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                                        <div>
                                          <p className="text-[7px] text-zinc-600">MOTORISTA FIXO</p>
                                          <p className="font-extrabold text-white mt-0.5">{routeDriver ? routeDriver.name.toUpperCase() : 'NÃO DEFINIDO'}</p>
                                        </div>
                                        <div className="text-right">
                                          <p className="text-[7px] text-zinc-600">VEÍCULO FIXO</p>
                                          <p className="font-extrabold text-white mt-0.5">{routeVehicle ? `${routeVehicle.prefix ? `[FROTA #${routeVehicle.prefix}] ` : ''}${routeVehicle.plate.toUpperCase()} (${routeVehicle.model.toUpperCase()})` : 'NÃO DEFINIDO'}</p>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          )}
              </div>
            </div>
          </motion.div>

      {/* Global Form Modals - Continuous Routes */}
      <AnimatePresence>
        {showAddForm && (
          <AddRouteModal
            isOpen={showAddForm}
            onClose={() => setShowAddForm(false)}
            vehicles={vehicles}
            employees={employees}
            clients={clients}
            onAddRoute={handleCreateRouteSubmit}
          />
        )}

        {showEditForm && editingRoute && (
          <EditRouteModal
            isOpen={showEditForm}
            onClose={() => {
              setShowEditForm(false);
              setEditingRoute(null);
            }}
            vehicles={vehicles}
            employees={employees}
            clients={clients}
            editingRoute={editingRoute}
            onUpdateRoute={handleUpdateRouteSubmit}
          />
        )}
      </AnimatePresence>

      {/* Client Closing Dossier Invoicing modal */}
      <AnimatePresence>
        {isClosingModalOpen && selectedClientDetail && (
          <ClientClosingModal
            isOpen={isClosingModalOpen}
            showValues={showClientValues}
            onClose={() => {
              setIsClosingModalOpen(false);
              setClosingPreviewData(null);
            }}
            selectedClientDetail={selectedClientDetail}
            closingMonthYear={closingMonthYear}
            onUpdateMonthYear={setClosingMonthYear}
            filteredClosingTrips={filteredClosingTrips}
            selectedClosingTrips={selectedClosingTrips}
            onToggleTripSelected={(id) => {
              setSelectedClosingTrips(prev => ({
                ...prev,
                [id]: !prev[id]
              }));
            }}
            onToggleSelectAll={() => {
              const allSelected = filteredClosingTrips.every(t => selectedClosingTrips[t.id]);
              const next: Record<string, boolean> = {};
              filteredClosingTrips.forEach(t => {
                next[t.id] = !allSelected;
              });
              setSelectedClosingTrips(next);
            }}
            employees={employees}
            vehicles={vehicles}
            onGeneratePDF={async () => {
              const activeToClose = filteredClosingTrips.filter(t => selectedClosingTrips[t.id]);
              try {
                const openToClose = activeToClose.filter(t => t.paymentStatus === 'open');
                if (openToClose.length > 0) {
                  for (const t of openToClose) {
                    await updateDoc(doc(db, 'charter_client_trips', t.id), {
                      paymentStatus: 'billed',
                      updatedAt: serverTimestamp()
                    });
                  }
                  toast.success(`${openToClose.length} viagem(ns) marcada(s) como faturada(s) (aguardando pagamento)!`);
                }
              } catch (error) {
                console.error("Erro ao atualizar status das viagens:", error);
                toast.error("Erro ao atualizar status para faturado.");
              }
              exportClosingPdf(selectedClientDetail, activeToClose, employees, vehicles, setClosingPreviewData);
            }}
            onWhatsAppSummary={handleSendWhatsAppClosingSummary}
            onEmailSummary={handleSendEmailClosingSummary}
            onBulkUpdate={handleBulkUpdateClosingTrips}
            closingPreviewData={closingPreviewData}
            onClearPreview={() => setClosingPreviewData(null)}
            onPrintDossierContent={() => window.print()}
          />
        )}
      </AnimatePresence>

      {/* Register Client Profile modal */}
      <AnimatePresence>
        {showRegisterClientForm && (
          <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-805 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Cadastrar Cliente Fretamento</h3>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Criar novo contrato recorrente para acertos de caixa</p>
                  </div>
                </div>
                <button onClick={() => setShowRegisterClientForm(false)} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Nome Fantasia (Apelido Rota) *</label>
                  <Input 
                    placeholder="Ex: Aurora Filial Norte" 
                    value={newClient.name}
                    onChange={(e) => setNewClient({...newClient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Razão Social Completa</label>
                  <Input 
                    placeholder="Ex: Aurora Alimentos S/A" 
                    value={newClient.companyName}
                    onChange={(e) => setNewClient({...newClient, companyName: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Documento (CNPJ / CPF)</label>
                  <Input 
                    placeholder="Ex: 00.111.222/0001-33" 
                    value={newClient.document}
                    onChange={(e) => setNewClient({...newClient, document: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Valor Padrão da Viagem</label>
                    <Input 
                      type="number"
                      placeholder="R$ 150,00" 
                      value={newClient.defaultTripValue || ''}
                      onChange={(e) => setNewClient({...newClient, defaultTripValue: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Contato Responsável</label>
                    <Input 
                      placeholder="Ex: 4799887766" 
                      value={newClient.phone}
                      onChange={(e) => setNewClient({...newClient, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans">E-mail Financeiro</label>
                  <Input 
                    placeholder="Ex: financeiro@aurora.com.br" 
                    value={newClient.email}
                    onChange={(e) => setNewClient({...newClient, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans">Endereço de Cobrança</label>
                  <Input 
                    placeholder="Ex: Rua das Flores, 120" 
                    value={newClient.address}
                    onChange={(e) => setNewClient({...newClient, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Viagens Extras (Anotação)</label>
                    <textarea
                      placeholder="Anotações sobre viagens extras..."
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                      value={newClient.extraTripsNotes}
                      onChange={(e) => setNewClient({...newClient, extraTripsNotes: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Trabalhos Extras (Anotação)</label>
                    <textarea
                      placeholder="Anotações sobre outros trabalhos..."
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                      value={newClient.extraWorksNotes}
                      onChange={(e) => setNewClient({...newClient, extraWorksNotes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20">
                <Button onClick={() => setShowRegisterClientForm(false)} variant="secondary" className="px-6 rounded-2xl font-black">
                  CANCELAR
                </Button>
                <Button onClick={handleAddClientSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl">
                  CADASTRAR CLIENTE
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {showEditClientForm && editingClient && (
          <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-805 rounded-[32px] w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight font-sans">Editar Ficha do Cliente</h3>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 font-sans">Salvar alterações de contabilidade de cobrança</p>
                  </div>
                </div>
                <button onClick={() => { setShowEditClientForm(false); setEditingClient(null); }} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Nome Fantasia (Apelido Rota) *</label>
                  <Input 
                    placeholder="Ex: Aurora Filial Norte" 
                    value={editingClient.name}
                    onChange={(e) => setEditingClient({...editingClient, name: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Razão Social Completa</label>
                  <Input 
                    placeholder="Ex: Aurora Alimentos S/A" 
                    value={editingClient.companyName}
                    onChange={(e) => setEditingClient({...editingClient, companyName: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Documento (CNPJ / CPF)</label>
                  <Input 
                    placeholder="Ex: 00.111.222/0001-33" 
                    value={editingClient.document}
                    onChange={(e) => setEditingClient({...editingClient, document: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans font-sans">Valor Padrão da Viagem</label>
                    <Input 
                      type="number"
                      placeholder="R$ 150,00" 
                      value={editingClient.defaultTripValue || ''}
                      onChange={(e) => setEditingClient({...editingClient, defaultTripValue: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Contato Responsável</label>
                    <Input 
                      placeholder="Ex: 4799887766" 
                      value={editingClient.phone}
                      onChange={(e) => setEditingClient({...editingClient, phone: e.target.value})}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">E-mail Financeiro</label>
                  <Input 
                    placeholder="Ex: financeiro@aurora.com.br" 
                    value={editingClient.email || ''}
                    onChange={(e) => setEditingClient({...editingClient, email: e.target.value})}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans">Endereço de Cobrança</label>
                  <Input 
                    placeholder="Ex: Rua das Flores, 120" 
                    value={editingClient.address || ''}
                    onChange={(e) => setEditingClient({...editingClient, address: e.target.value})}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Viagens Extras (Anotação)</label>
                    <textarea
                      placeholder="Anotações sobre viagens extras..."
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                      value={editingClient.extraTripsNotes || ''}
                      onChange={(e) => setEditingClient({...editingClient, extraTripsNotes: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Trabalhos Extras (Anotação)</label>
                    <textarea
                      placeholder="Anotações sobre outros trabalhos..."
                      className="w-full bg-zinc-950 border border-zinc-850 hover:border-zinc-800 focus:border-brand-accent rounded-xl p-2.5 text-[10px] text-zinc-200 outline-none resize-none h-14 transition-all"
                      value={editingClient.extraWorksNotes || ''}
                      onChange={(e) => setEditingClient({...editingClient, extraWorksNotes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20 font-sans">
                <Button onClick={() => { setShowEditClientForm(false); setEditingClient(null); }} variant="secondary" className="px-6 rounded-2xl font-black font-sans">
                  CANCELAR
                </Button>
                <Button onClick={handleUpdateClientSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl font-sans">
                  SALVAR ALTERAÇÕES
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lançar Viagem Avulsa (Novo Fretamento por Cliente) */}
      <AnimatePresence>
        {showClientAddForm && (
          <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight">Lançar Viagem/Fretamento Avulso</h3>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5">Criar novos serviços ou saídas exclusivas agendadas</p>
                  </div>
                </div>
                <button onClick={() => { setShowClientAddForm(false); setSelectedLaunchDays([]); }} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Banner de Modo de Preenchimento */}
                <div className="flex items-center justify-between bg-zinc-950 p-4 border border-zinc-850 rounded-[20px] transition-all">
                  <div className="flex items-center gap-2.5">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center transition-all",
                      isQuickMode ? "bg-[#ff6b00]/15 text-[#ff6b00]" : "bg-zinc-900 text-zinc-500"
                    )}>
                      <Zap size={16} className={isQuickMode ? "animate-pulse" : ""} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black text-white uppercase tracking-wider block font-sans">Modo de Preenchimento Rápido</span>
                      <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">
                        {isQuickMode 
                          ? "Ativo: preencha apenas cliente e data. Rota/detalhes salvos como 'A definir'." 
                          : "Inativo: preencha todos os campos detalhadamente."}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQuickMode(!isQuickMode)}
                    className={cn(
                      "py-1.5 px-3 border rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer",
                      isQuickMode
                        ? "bg-[#ff6b00]/15 border-[#ff6b00]/40 text-[#ff6b00] font-sans font-extrabold"
                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 font-sans"
                    )}
                  >
                    {isQuickMode ? "Modo Rápido ON" : "Ativar Modo Rápido"}
                  </button>
                </div>

                <div className={cn("grid gap-4", isQuickMode ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2")}>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans">Selecionar Cliente Contrato *</label>
                    <select
                      value={newClientCharter.clientId}
                      onChange={(e) => {
                        const cl = clients.find(c => c.id === e.target.value);
                        setNewClientCharter({
                          ...newClientCharter,
                          clientId: e.target.value,
                          client: cl ? cl.name : '',
                          value: cl?.defaultTripValue || 0
                        });
                      }}
                      className="w-full bg-zinc-900 border border-zinc-805 rounded-xl py-2 px-3 text-xs text-white outline-none focus:border-brand-accent"
                    >
                      <option value="">SELECIONE DO BANCO DE CLIENTES</option>
                      {clients.map(c => (
                        <option key={c.id} value={c.id}>{c.name.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>

                  {!isQuickMode && (
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Descrição / Finalidade do Serviço *</label>
                      <Input
                        placeholder="Ex: Transporte Viagem de Campo Noturna"
                        value={newClientCharter.description}
                        onChange={(e) => setNewClientCharter({...newClientCharter, description: e.target.value})}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl">
                  {/* Calendar multi launch dates selection */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-[8px] font-black uppercase text-zinc-500 tracking-wider">
                      <span>Dias para lançamento em lote</span>
                      {selectedLaunchDays.length > 0 && (
                        <span className="text-brand-accent font-sans">{selectedLaunchDays.length} selecionados</span>
                      )}
                    </div>
                    
                    <div className="flex justify-between items-center bg-zinc-900 p-2 border border-zinc-850 rounded-xl mb-1">
                      <button 
                        type="button"
                        onClick={() => {
                          const d = new Date(launchCalendarDate);
                          d.setMonth(d.getMonth() - 1);
                          setLaunchCalendarDate(d);
                        }}
                        className="text-zinc-500 hover:text-white"
                      >
                        <ChevronLeft size={12} />
                      </button>
                      <span className="text-[9px] font-black uppercase text-white tracking-widest">
                        {format(launchCalendarDate, 'MMMM yyyy')}
                      </span>
                      <button 
                        type="button"
                        onClick={() => {
                          const d = new Date(launchCalendarDate);
                          d.setMonth(d.getMonth() + 1);
                          setLaunchCalendarDate(d);
                        }}
                        className="text-zinc-500 hover:text-white"
                      >
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div className="grid grid-cols-7 gap-0.5 text-center text-[7px] font-black uppercase text-zinc-650">
                      {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((w, idx) => <span key={idx}>{w}</span>)}
                      {launchCalendarGridDays.map((day, idx) => {
                        if (!day) return <span key={idx} />;
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const isSel = selectedLaunchDays.includes(dateStr);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleToggleDaySelectionInLaunch(dateStr)}
                            className={cn(
                              "py-1 text-[8px] font-black rounded-md border cursor-pointer",
                              isSel 
                                ? "bg-emerald-600 border-emerald-500 text-white font-sans" 
                                : "bg-zinc-950 border-zinc-900 text-zinc-500"
                            )}
                          >
                            {day.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Horário de Saída (Lote)</label>
                      <Input
                        type="time"
                        value={launchTime}
                        onChange={(e) => setLaunchTime(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Data / Hora de Embarque Geral *</label>
                      <Input 
                        type="datetime-local" 
                        value={newClientCharter.dateTime}
                        onChange={(e) => setNewClientCharter({...newClientCharter, dateTime: e.target.value})}
                        disabled={selectedLaunchDays.length > 0}
                      />
                    </div>
                  </div>
                </div>

                {!isQuickMode ? (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Origem / Garagem</label>
                        <Input 
                          placeholder="Ex: Rio do Sul, Centro" 
                          value={newClientCharter.origin}
                          onChange={(e) => setNewClientCharter({...newClientCharter, origin: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Destino Final</label>
                        <Input 
                          placeholder="Ex: Blumenau, Term. Central" 
                          value={newClientCharter.destination}
                          onChange={(e) => setNewClientCharter({...newClientCharter, destination: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans">Preço do Serviço (R$)</label>
                        <Input 
                          type="number"
                          placeholder="Ex: R$ 350.00" 
                          value={newClientCharter.value || ''}
                          onChange={(e) => setNewClientCharter({...newClientCharter, value: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Qtd. Passageiros</label>
                        <Input 
                          type="number"
                          placeholder="Ex: 15" 
                          value={newClientCharter.passengerCount || ''}
                          onChange={(e) => setNewClientCharter({...newClientCharter, passengerCount: parseInt(e.target.value) || 0})}
                        />
                      </div>
                      <div className="space-y-1.5 flex flex-col justify-end">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans mb-1">Configuração Especial</label>
                        <button
                          type="button"
                          onClick={() => setNewClientCharter({...newClientCharter, isExtra: !newClientCharter.isExtra})}
                          className={cn(
                            "w-full py-2 px-3 border rounded-xl text-[10px] font-bold uppercase transition-all flex items-center justify-center gap-1.5 cursor-pointer h-[38px]",
                            newClientCharter.isExtra
                              ? "bg-[#ff6b00]/10 border-[#ff6b00] text-[#ff6b00] shadow-sm font-sans"
                              : "bg-zinc-950 border-zinc-850 text-zinc-400 hover:border-zinc-700 font-sans"
                          )}
                        >
                          <Sparkles size={11} className={newClientCharter.isExtra ? "text-[#ff6b00]" : "text-zinc-500"} />
                          {newClientCharter.isExtra ? "Viagem Extra Ativa" : "Viagem Extra?"}
                        </button>
                      </div>
                    </div>

                    {/* Opção de Serviço Extra opcional */}
                    <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles size={14} className={newClientCharter.hasExtraService ? "text-brand-accent animate-pulse" : "text-zinc-500"} />
                          <div>
                            <span className="text-[10px] font-black text-white uppercase tracking-wider block font-sans">Opção de Serviço Extra</span>
                            <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">Descrever serviço adicional e o valor cobrado</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewClientCharter({
                            ...newClientCharter,
                            hasExtraService: !newClientCharter.hasExtraService
                          })}
                          className={cn(
                            "py-1.5 px-3 border rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer",
                            newClientCharter.hasExtraService
                              ? "bg-brand-accent/15 border-brand-accent/40 text-brand-accent font-sans"
                              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 font-sans"
                          )}
                        >
                          {newClientCharter.hasExtraService ? "Desativar Serviço Extra" : "Ativar Serviço Extra"}
                        </button>
                      </div>

                      {newClientCharter.hasExtraService && (
                        <motion.div 
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-900/60 font-sans"
                        >
                          <div className="space-y-1.5 md:col-span-2">
                            <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block ml-1 font-sans">Descrição do Serviço Extra *</label>
                            <Input 
                              placeholder="Ex: Serviço de bordo / Pedágio / Hospedagem motorista" 
                              value={newClientCharter.extraServiceDesc || ''}
                              onChange={(e) => setNewClientCharter({...newClientCharter, extraServiceDesc: e.target.value})}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans">Valor Cobrado (R$)*</label>
                            <Input 
                              type="number"
                              placeholder="Ex: R$ 150.00" 
                              value={newClientCharter.extraServiceVal || ''}
                              onChange={(e) => setNewClientCharter({...newClientCharter, extraServiceVal: parseFloat(e.target.value) || 0})}
                            />
                          </div>
                        </motion.div>
                      )}
                    </div>

                    {/* Múltiplas Viagens no Mesmo Dia */}
                    <CharteredRoutesMultiTrip
                      isMultiTripEnabled={isMultiTripEnabled}
                      onToggleMultiTrip={setIsMultiTripEnabled}
                      dailyTrips={dailyTrips}
                      onChangeDailyTrips={setDailyTrips}
                      defaultTripValue={
                        clients.find(c => c.id === newClientCharter.clientId)?.defaultTripValue || newClientCharter.value || 0
                      }
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Motorista Responsável</label>
                        <Select 
                          value={newClientCharter.driverId}
                          onChange={(e) => setNewClientCharter({...newClientCharter, driverId: e.target.value})}
                          options={[
                            { value: '', label: 'NENHUM ALOCADO' },
                            ...employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => ({
                              value: e.id,
                              label: e.name.toUpperCase()
                            }))
                          ]}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans block">Placa do Veículo</label>
                        <Select 
                          value={newClientCharter.vehicleId}
                          onChange={(e) => setNewClientCharter({...newClientCharter, vehicleId: e.target.value})}
                          options={[
                            { value: '', label: 'NENHUM ALOCADO' },
                            ...vehicles.map(v => ({
                              value: v.id,
                              disabled: v.status === 'maintenance' || v.status === 'unavailable',
                              label: `${v.prefix ? `[FROTA #${v.prefix}] ${v.plate?.toUpperCase()}` : v.plate?.toUpperCase()} - ${v.model?.toUpperCase()}`
                            }))
                          ]}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="bg-zinc-950/40 border border-dashed border-zinc-850 rounded-2xl p-5 text-center text-zinc-500 text-[9px] uppercase font-bold tracking-wider space-y-1.5">
                    <p className="text-brand-accent flex items-center justify-center gap-1">⚡ MODO DE PREENCHIMENTO RÁPIDO ATIVADO</p>
                    <p className="text-zinc-500 font-medium normal-case font-sans max-w-md mx-auto leading-relaxed">
                      Os detalhes operacionais (descrição, preço, origem, destino, motorista e veículo) serão salvos com os valores padrões do contrato ou como "A definir". Você poderá detalhar e editar todas as informações desta rota posteriormente quando desejar.
                    </p>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20 font-sans">
                <Button onClick={() => { setShowClientAddForm(false); setSelectedLaunchDays([]); }} variant="secondary" className="px-6 rounded-2xl font-black font-sans">
                  CANCELAR
                </Button>
                <Button onClick={handleAddNewClientTripSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl font-sans">
                  LANÇAR VIAGEM
                </Button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Editar Fretamento Faturavel do Cliente */}
        {showClientEditForm && editingClientCharter && (
          <div className="fixed inset-0 z-[9950] overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-zinc-900 border border-zinc-800 rounded-[32px] w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col font-sans"
            >
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/40 font-mono">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-brand-accent/20 flex items-center justify-center text-brand-accent">
                    <Receipt size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase tracking-tight font-sans font-sans">Editar Fretamento Financeiro</h3>
                    <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider mt-0.5 font-sans font-sans">Atualizar detalhes contábeis do serviço do cliente</p>
                  </div>
                </div>
                <button onClick={() => { setShowClientEditForm(false); setEditingClientCharter(null); }} className="text-zinc-500 hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-sans">Cliente Fretamento Contrato</label>
                    <input
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-850 rounded-xl py-2 px-3 text-xs text-zinc-500 uppercase font-bold outline-none cursor-not-allowed"
                      value={editingClientCharter.client}
                      disabled
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Descrição do Serviço *</label>
                    <Input
                      placeholder="Ex: Transporte Viagem de Campo Noturna"
                      value={editingClientCharter.description}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, description: e.target.value})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Data / Hora de Embarque *</label>
                    <Input 
                      type="datetime-local" 
                      value={editingClientCharter.dateTime}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, dateTime: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans">Preço do Serviço (R$)</label>
                    <Input 
                      type="number"
                      placeholder="Ex: R$ 350.00" 
                      value={editingClientCharter.value || ''}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, value: parseFloat(e.target.value) || 0})}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Origem / Garagem</label>
                    <Input 
                      placeholder="Ex: Rio do Sul, Centro" 
                      value={editingClientCharter.origin}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, origin: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans block">Destino Final</label>
                    <Input 
                      placeholder="Ex: Blumenau, Term. Central" 
                      value={editingClientCharter.destination}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, destination: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans block">Qtd. Passageiros</label>
                    <Input 
                      type="number"
                      placeholder="Ex: 15" 
                      value={editingClientCharter.passengerCount || ''}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, passengerCount: parseInt(e.target.value) || 0})}
                    />
                  </div>
                </div>

                {/* Opção de Serviço Extra opcional (Edição) */}
                <div className="bg-zinc-950 p-4 border border-zinc-850 rounded-2xl space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles size={14} className={editingClientCharter.hasExtraService ? "text-brand-accent animate-pulse" : "text-zinc-500"} />
                      <div>
                        <span className="text-[10px] font-black text-white uppercase tracking-wider block font-sans">Opção de Serviço Extra</span>
                        <span className="text-[7px] font-bold text-zinc-500 uppercase tracking-widest block font-sans">Descrever serviço adicional e o valor cobrado</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditingClientCharter({
                        ...editingClientCharter,
                        hasExtraService: !editingClientCharter.hasExtraService
                      })}
                      className={cn(
                        "py-1.5 px-3 border rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer",
                        editingClientCharter.hasExtraService
                          ? "bg-brand-accent/15 border-brand-accent/40 text-brand-accent font-sans"
                          : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 font-sans"
                      )}
                    >
                      {editingClientCharter.hasExtraService ? "Desativar Serviço Extra" : "Ativar Serviço Extra"}
                    </button>
                  </div>

                  {editingClientCharter.hasExtraService && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-zinc-900/60 font-sans"
                    >
                      <div className="space-y-1.5 md:col-span-2">
                        <label className="text-[8px] font-black text-zinc-400 uppercase tracking-widest block ml-1 font-sans">Descrição do Serviço Extra *</label>
                        <Input 
                          placeholder="Ex: Serviço de bordo / Pedágio / Hospedagem motorista" 
                          value={editingClientCharter.extraServiceDesc || ''}
                          onChange={(e) => setEditingClientCharter({...editingClientCharter, extraServiceDesc: e.target.value})}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[8px] font-black text-[#ff6b00] uppercase tracking-widest block ml-1 font-sans">Valor Cobrado (R$)*</label>
                        <Input 
                          type="number"
                          placeholder="Ex: R$ 150.00" 
                          value={editingClientCharter.extraServiceVal || ''}
                          onChange={(e) => setEditingClientCharter({...editingClientCharter, extraServiceVal: parseFloat(e.target.value) || 0})}
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans">Motorista Responsável</label>
                    <Select 
                      value={editingClientCharter.driverId}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, driverId: e.target.value})}
                      options={[
                        { value: '', label: 'NENHUM ALOCADO' },
                        ...employees.filter(e => e.role === 'Motorista' || e.role === 'admin' || e.role === 'Operacional').map(e => ({
                          value: e.id,
                          label: e.name.toUpperCase()
                        }))
                      ]}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans block">Placa do Veículo</label>
                    <Select 
                      value={editingClientCharter.vehicleId}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, vehicleId: e.target.value})}
                      options={[
                        { value: '', label: 'NENHUM ALOCADO' },
                        ...vehicles.map(v => ({
                          value: v.id,
                          disabled: v.status === 'maintenance' || v.status === 'unavailable',
                          label: `${v.prefix ? `[FROTA #${v.prefix}] ${v.plate?.toUpperCase()}` : v.plate?.toUpperCase()} - ${v.model?.toUpperCase()}`
                        }))
                      ]}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 bg-zinc-950 p-4 border border-zinc-850 rounded-2xl mt-2 font-mono">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Situação Operacional</label>
                    <Select
                      value={editingClientCharter.status}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, status: e.target.value as any})}
                    >
                      <option value="pending">PENDENTE / PROGRAMADO</option>
                      <option value="completed">REALIZADO / EXECUTADO</option>
                      <option value="cancelled">CANCELADO (NÃO COBRAR)</option>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Financeiro Cobrança</label>
                    <Select
                      value={editingClientCharter.paymentStatus}
                      onChange={(e) => setEditingClientCharter({...editingClientCharter, paymentStatus: e.target.value as any})}
                    >
                      <option value="open">EM ABERTO</option>
                      <option value="billed">FATURADO (DOSSIÊ)</option>
                      <option value="received">LIQUIDADO / PAGO</option>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-zinc-800 flex justify-end gap-3 bg-zinc-950/20 font-sans">
                <Button onClick={() => { setShowClientEditForm(false); setEditingClientCharter(null); }} variant="secondary" className="px-6 rounded-2xl font-black font-sans">
                  CANCELAR
                </Button>
                <Button onClick={handleUpdateClientTripSubmit} className="bg-brand-accent text-zinc-950 px-8 font-black rounded-2xl font-sans">
                  SALVAR ALTERAÇÕES
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirm Modal Excluir */}
      <AnimatePresence>
        {deleteConfirm.isOpen && (
          <ConfirmModal
            isOpen={deleteConfirm.isOpen}
            onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
            onConfirm={deleteConfirm.onConfirm}
            title={deleteConfirm.title}
            message={deleteConfirm.message}
            confirmVariant="danger"
            confirmLabel="EXCLUIR REGISTRO"
          />
        )}
      </AnimatePresence>
    </div>
  );
};
