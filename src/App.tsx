import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { 
  Bus, 
  Fuel, 
  Wrench, 
  Bell, 
  Plus, 
  Search,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  LayoutDashboard,
  Calendar,
  Users,
  DollarSign,
  Package,
  Share2,
  MessageCircle,
  Eye,
  MapPin,
  Cake,
  Printer,
  Droplets,
  CheckCircle,
  Hash,
  Route as RouteIcon,
  FileText,
  FileSpreadsheet,
  ClipboardList,
  Trash2,
  User,
  Smartphone,
  X,
  Sparkles,
  Bot as BotIcon,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Globe,
  Map,
  SquareCheck,
  Clock,
  Paperclip,
  Edit3,
  ArrowLeft,
  Image as ImageIcon,
  Video,
  Lock,
  GraduationCap,
  Briefcase
} from 'lucide-react';
import { generateAPKDigital, shareAppDirectly } from './services/apkService';
import { geminiService } from './services/geminiService';
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
  orderBy,
  limit,
  addDoc,
  deleteDoc,
  where,
  getDocs,
  updateDoc
} from 'firebase/firestore';
import { format, isAfter, isBefore, parseISO, addDays, differenceInDays, subMonths, isSameMonth, startOfMonth, isSameWeek, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Toaster, toast } from 'sonner';


import { auth, db, handleFirestoreError, OperationType, cleanUndefined } from './lib/firebase';
import { requestNotificationPermission, setupForegroundNotificationListener } from './lib/notifications';
import { offlineQueue } from './services/offlineQueue';
import { setRolePermissions } from './lib/permissions';
import { cn } from './lib/utils';
import { SplashScreen } from './components/SplashScreen';
import { OfflineSync } from './components/OfflineSync';
import { GabineteView } from './components/GabineteView';
import { SyncSettings } from './components/SyncSettings';
import { TripAlerts } from './components/TripAlerts';
import { 
  Vehicle, 
  Employee, 
  FuelTank, 
  FuelLog, 
  MaintenanceLog, 
  StockItem, 
  UserProfile,
  UserRole,
  FuelEntry,
  FinancialTransaction,
  Trip
} from './types';

// Extend Window interface for PWA prompt
declare global {
  interface WindowEventMap {
    beforeinstallprompt: any;
  }
}


import { Login } from './components/Login';
import { UserManagement } from './components/UserManagement';
import { AlertsHubModal } from './components/AlertsHubModal';
import { AttachmentViewer } from './components/AttachmentViewer';

import { Sidebar } from './components/Sidebar';
import { Card, StatCard } from './components/Cards';
import { Modal, ConfirmModal } from './components/UI';
import { PageTransition } from './components/PageTransition';
import { ShadowLogVisualizer } from './components/ShadowLogVisualizer';
import { hasPermission } from './lib/permissions';
import { ProtectedRoute } from './components/ProtectedRoute';

import { ServiceOrderListItem } from './components/ServiceOrderListItem';
import { auditService } from './services/auditService';
import { backupService } from './services/backupService';
import { dbCacheService } from './services/dbCacheService';

// Helper para importação dinâmica de componentes com auto-recuperação sem recarregar a página
function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<any>,
  memberKey?: string
) {
  return lazy(async () => {
    try {
      const module = await componentImport();
      if (memberKey) {
        return { default: module[memberKey] || module.default };
      }
      return module.default ? module : { default: module };
    } catch (error) {
      console.warn('[DM LazyLoader] Falha ao carregar módulo dinâmico, tentando novamente sem recarregar:', error);
      try {
        // Segunda tentativa com pequeno atraso para mitigar oscilação de rede
        await new Promise(resolve => setTimeout(resolve, 300));
        const module = await componentImport();
        if (memberKey) {
          return { default: module[memberKey] || module.default };
        }
        return module.default ? module : { default: module };
      } catch (retryErr) {
        console.error('[DM LazyLoader] Não foi possível carregar o módulo:', retryErr);
        return {
          default: (() => (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-zinc-900 border border-zinc-800 rounded-2xl m-4 space-y-3 text-white">
              <Loader2 className="animate-spin text-brand-accent" size={28} />
              <p className="text-xs uppercase tracking-wider font-black">Módulo Indisponível</p>
              <p className="text-[10px] text-zinc-400">Por favor, selecione outra aba ou tente novamente.</p>
            </div>
          )) as unknown as T
        };
      }
    }
  });
}

// Lazy loading of heavy components to optimize initial application bundle size and startup speed
const VehicleForm = lazyWithRetry(() => import('./components/Forms'), 'VehicleForm');
const FuelForm = lazyWithRetry(() => import('./components/Forms'), 'FuelForm');
const TankForm = lazyWithRetry(() => import('./components/Forms'), 'TankForm');
const TankRefillForm = lazyWithRetry(() => import('./components/Forms'), 'TankRefillForm');
const EmployeeForm = lazyWithRetry(() => import('./components/Forms'), 'EmployeeForm');

const MaintenanceForm = lazyWithRetry(() => import('./components/MaintenanceForm'), 'MaintenanceForm');
const FinancialForm = lazyWithRetry(() => import('./components/FinancialForm'), 'FinancialForm');
const VehicleDetail = lazyWithRetry(() => import('./components/VehicleDetail'), 'VehicleDetail');
const TripServiceOrder = lazyWithRetry(() => import('./components/TripServiceOrder'), 'TripServiceOrder');
const MaintenanceServiceOrder = lazyWithRetry(() => import('./components/MaintenanceServiceOrder'), 'MaintenanceServiceOrder');

const FormLoader = (
  <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400 space-y-3">
    <Loader2 className="animate-spin text-brand-accent" size={28} />
    <p className="text-[10px] uppercase tracking-widest font-black text-zinc-500">Carregando Formulário...</p>
  </div>
);

// Lazy loading of heavy panes to drastically reduce bundle size and speed up initialization
const Dashboard = lazyWithRetry(() => import('./components/Dashboard'), 'Dashboard');
const Finance = lazyWithRetry(() => import('./components/Finance'), 'Finance');
const CharteredRoutes = lazyWithRetry(() => import('./components/CharteredRoutes'), 'CharteredRoutes');
const StaffManagement = lazyWithRetry(() => import('./components/StaffManagement'), 'StaffManagement');
const TripsManagement = lazyWithRetry(() => import('./components/TripsManagement'), 'TripsManagement');
const ServiceOrders = lazyWithRetry(() => import('./components/ServiceOrders'), 'ServiceOrders');
const FuelManagement = lazyWithRetry(() => import('./components/FuelManagement'), 'FuelManagement');
const InventoryManagement = lazyWithRetry(() => import('./components/InventoryManagement'), 'InventoryManagement');
const Criador = lazyWithRetry(() => import('./components/Criador'));
const MediaHub = lazyWithRetry(() => import('./components/MediaHub'), 'MediaHub');
const UnifiedFleetManagement = lazyWithRetry(() => import('./components/UnifiedFleetManagement'), 'UnifiedFleetManagement');
const WelcomePage = lazyWithRetry(() => import('./components/WelcomePage'), 'WelcomePage');
const TripForm = lazyWithRetry(() => import('./components/TripForm'), 'TripForm');
const ChamadoProprietario = lazyWithRetry(() => import('./components/ChamadoProprietario'), 'ChamadoProprietario');


// Role permissions mapping
const ROLE_PERMISSIONS: Record<string, { label: string, icon: string }[]> = {
  'Dono / Proprietário': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
    { label: 'Frota', icon: 'Bus' },
    { label: 'Almoxarifado', icon: 'Package' },
    { label: 'Financeiro', icon: 'DollarSign' },
    { label: 'Usuários', icon: 'Users' },
    { label: 'Criação', icon: 'PlusCircle' },
    { label: 'Media Hub', icon: 'Video' },
  ],
  'Gestor de Frotas': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
    { label: 'Frota', icon: 'Bus' },
    { label: 'Almoxarifado', icon: 'Package' },
    { label: 'Criação', icon: 'PlusCircle' },
    { label: 'Media Hub', icon: 'Video' },
  ],
  'Coordenador Logístico': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
    { label: 'Frota', icon: 'Bus' },
    { label: 'Almoxarifado', icon: 'Package' },
  ],
  'Administrativo': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
    { label: 'Financeiro', icon: 'DollarSign' },
  ],
  'Motorista': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
  ],
  'Limpeza / Conservação': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
    { label: 'Almoxarifado', icon: 'Package' },
  ],
  'Visitante': [
    { label: 'Dashboard', icon: 'LayoutDashboard' },
    { label: 'Trabalhos', icon: 'Route' },
  ],
};

const CURRENT_APP_VERSION = '0.3.6';

// Helper to perform JSON.stringify and localStorage.setItem asynchronously.
// This prevents blocking the single main JavaScript thread on heavy state updates,
// leading to much smoother page transitions, typing, and faster UI rendering.
const saveToLocalStorageAsync = (key: string, data: any) => {
  setTimeout(() => {
    try {
      localStorage.setItem(key, typeof data === 'string' ? data : JSON.stringify(data));
    } catch (e) {
      console.warn(`[Async Storage] Error writing ${key} to localStorage:`, e);
    }
  }, 0);
};

export default function App() {
  useEffect(() => {
    const lastSeenVersion = localStorage.getItem('dmturismo_app_version');
    if (lastSeenVersion !== CURRENT_APP_VERSION) {
      localStorage.setItem('dmturismo_app_version', CURRENT_APP_VERSION);
    }
  }, []);

  const navigate = useNavigate();
  const location = useLocation();

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOfflineProlonged, setIsOfflineProlonged] = useState(false);
  const [animateBell, setAnimateBell] = useState(false);
  const [shouldVibrateBell, setShouldVibrateBell] = useState(false);

  const prevOnline = React.useRef(isOnline);

  useEffect(() => {
    if (!prevOnline.current && isOnline) {
      setAnimateBell(true);
      const timer = setTimeout(() => {
        setAnimateBell(false);
      }, 1200);
      return () => clearTimeout(timer);
    }
    prevOnline.current = isOnline;
  }, [isOnline]);

  useEffect(() => {
    let syncTimer: NodeJS.Timeout | null = null;

    const handleOnline = () => {
      setIsOnline(true);
      setIsSyncing(true);
      setIsOfflineProlonged(false);
      syncTimer = setTimeout(() => {
        setIsSyncing(false);
      }, 5000); // 5 seconds of smooth syncing transition
    };

    const handleOffline = () => {
      setIsOnline(false);
      setIsSyncing(false);
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const handleFirestoreSync = (e: any) => {
      console.log(`[Real-time Sync] Mudança detectada na coleção: ${e.detail?.collection || e.detail?.document}`);
      
      // Flash the bell icon to show data was received
      setAnimateBell(true);
      setShouldVibrateBell(true);
      
      // Brief syncing state for visual feedback in the header
      setIsSyncing(true);
      
      setTimeout(() => {
        setAnimateBell(false);
        setShouldVibrateBell(false);
        setIsSyncing(false);
      }, 1500);
    };

    window.addEventListener('dmturismo_firestore_sync', handleFirestoreSync);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('dmturismo_firestore_sync', handleFirestoreSync);
      if (syncTimer) {
        clearTimeout(syncTimer);
      }
    };
  }, []);

  // Monitoramento do estado offline prolongado (> 30 segundos)
  useEffect(() => {
    let offlineTimeout: NodeJS.Timeout | null = null;

    if (!isOnline) {
      offlineTimeout = setTimeout(() => {
        setIsOfflineProlonged(true);
        toast.error(
          "Você está offline há mais de 30 segundos. Por favor, verifique sua conexão de rede local para restabelecer a sincronização com o Firestore.",
          {
            duration: 8000,
            id: 'offline-danger-alert'
          }
        );
      }, 30000); // 30 segundos de tolerância
    } else {
      setIsOfflineProlonged(false);
    }

    return () => {
      if (offlineTimeout) {
        clearTimeout(offlineTimeout);
      }
    };
  }, [isOnline]);


  const [user, setUser] = useState<FirebaseUser | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dmturismo_cached_user');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  const [profile, setProfile] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dmturismo_cached_profile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });

  // Manter perfil em cache atualizado no local storage
  useEffect(() => {
    if (profile) {
      saveToLocalStorageAsync('dmturismo_cached_profile', profile);
    } else {
      localStorage.removeItem('dmturismo_cached_profile');
    }
  }, [profile]);
  const [employeeContext, setEmployeeContext] = useState<Employee | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dmturismo_employee_context');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error("Erro ao carregar contexto de funcionário do localStorage:", e);
          return null;
        }
      }
    }
    return null;
  });

  const [employees, setEmployees] = useState<Employee[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_employees');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [financeDocs, setFinanceDocs] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_finance_docs');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const effectiveProfile = useMemo<UserProfile | null>(() => {
    if (profile) {
      const matchedEmployee = employees.find(e => e.email?.trim().toLowerCase() === profile.email?.trim().toLowerCase());
      if (matchedEmployee) {
        return {
          ...profile,
          role: matchedEmployee.role as any,
          permissions: matchedEmployee.permissions || []
        };
      }
      return profile;
    }
    if (employeeContext) {
      return {
        uid: employeeContext.id,
        email: employeeContext.email || `${employeeContext.phone || employeeContext.id}@dmturismo.app`,
        displayName: employeeContext.name,
        role: employeeContext.role as any,
        permissions: employeeContext.permissions || []
      };
    }
    return null;
  }, [profile, employeeContext, employees]);

  const [loading, setLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('dmturismo_cached_user');
      const savedProfile = localStorage.getItem('dmturismo_cached_profile');
      const savedEmployee = localStorage.getItem('dmturismo_employee_context');
      if ((savedUser && savedProfile) || savedEmployee) {
        return false;
      }
    }
    return true;
  });
  const [selectedTripForAttachments, setSelectedTripForAttachments] = useState<Trip | null>(null);
  const [selectedMaintenanceForAttachments, setSelectedMaintenanceForAttachments] = useState<MaintenanceLog | null>(null);
  const [isAttachmentsModalOpen, setIsAttachmentsModalOpen] = useState(false);
  const [isMaintenanceAttachmentsModalOpen, setIsMaintenanceAttachmentsModalOpen] = useState(false);
  const [isProcessingModalAttachment, setIsProcessingModalAttachment] = useState<string | null>(null);
  
  // Sync activeSection with URL path
  const activeSection = useMemo(() => {
    const path = location.pathname.split('/')[1] || 'dashboard';
    return path;
  }, [location.pathname]);

  const [navStack, setNavStack] = useState<string[]>(['dashboard']);

  const handleNavigate = useCallback((sectionId: string) => {
    navigate(`/${sectionId}`);
    setNavStack(stack => {
      if (stack[stack.length - 1] === sectionId) return stack;
      return [...stack, sectionId].slice(-10);
    });
  }, [navigate]);

  const handleBack = useCallback(() => {
    if (navStack.length > 1) {
      navigate(-1);
      setNavStack(stack => {
        const newStack = [...stack];
        newStack.pop();
        return newStack;
      });
    }
  }, [navigate, navStack.length]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobileMode, setIsMobileMode] = useState(false);
  const [isShadowSplitOpen, setIsShadowSplitOpen] = useState(false);

  // Params / direct approval handling state
  const [pendingApprovalUser, setPendingApprovalUser] = useState<UserProfile | null>(null);

  const [approving, setApproving] = useState(false);
  const [approvalRole, setApprovalRole] = useState<UserProfile['role']>('Motorista');
  const [selectedPendingDesiredRole, setSelectedPendingDesiredRole] = useState<UserProfile['role']>('Motorista');

  // Sincronizar employeeContext com localStorage
  useEffect(() => {
    if (employeeContext) {
      saveToLocalStorageAsync('dmturismo_employee_context', employeeContext);
    } else {
      localStorage.removeItem('dmturismo_employee_context');
    }
  }, [employeeContext]);

  // Atualizar o employeeContext em tempo real caso ocorra alguma mudança no painel administrativo
  useEffect(() => {
    if (employeeContext && employees.length > 0) {
      const latest = employees.find(e => e.id === employeeContext.id);
      if (latest && JSON.stringify(latest) !== JSON.stringify(employeeContext)) {
        setEmployeeContext(latest);
      }
    }
  }, [employees, employeeContext]);

  useEffect(() => {
    const isOwner = 
      effectiveProfile?.role === 'Dono / Proprietário' || 
      effectiveProfile?.role === 'Gestor de Frotas' || 
      effectiveProfile?.role === 'Coordenador Logístico' ||
      effectiveProfile?.role === 'Administrativo' ||
      effectiveProfile?.email === 'elizeuferron@gmail.com';
    if (!isOwner) return;

    const params = new URLSearchParams(window.location.search);
    const approveEmailParam = params.get('approveEmail');
    if (!approveEmailParam) return;

    const fetchPendingUser = async () => {
      try {
        const q = query(collection(db, 'users'), where('email', '==', approveEmailParam.trim().toLowerCase()));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          const docSnap = querySnapshot.docs[0];
          const userData = { uid: docSnap.id, ...docSnap.data() } as UserProfile;
          if (userData.role === 'Pendente de Liberação' || userData.role === 'Aguardando Liberação' || userData.role === 'Visitante') {
            const autoParam = params.get('auto');
            const roleParam = params.get('role') as UserProfile['role'];
            const targetRole: UserProfile['role'] = roleParam || userData.requestedRole || 'Motorista';

            if (autoParam === 'true') {
              await updateDoc(doc(db, 'users', userData.uid), cleanUndefined({
                role: targetRole
              }));
              toast.success(`Acesso de ${userData.displayName || userData.email} liberado automaticamente como ${targetRole}!`);
              const url = new URL(window.location.href);
              url.searchParams.delete('approveEmail');
              url.searchParams.delete('auto');
              url.searchParams.delete('role');
              window.history.replaceState({}, document.title, url.pathname + url.search);
            } else {
              setPendingApprovalUser(userData);
              setApprovalRole(targetRole);
            }
          } else {
            toast.info(`O colaborador com e-mail ${approveEmailParam} já está liberado como ${userData.role}.`);
            const url = new URL(window.location.href);
            url.searchParams.delete('approveEmail');
            url.searchParams.delete('auto');
            url.searchParams.delete('role');
            window.history.replaceState({}, document.title, url.pathname + url.search);
          }
        } else {
          toast.error(`Nenhum cadastro encontrado para o e-mail: ${approveEmailParam}`);
          const url = new URL(window.location.href);
          url.searchParams.delete('approveEmail');
          url.searchParams.delete('auto');
          url.searchParams.delete('role');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }
      } catch (err) {
        console.error("Erro ao carregar usuário pendente:", err);
      }
    };

    fetchPendingUser();
  }, [effectiveProfile]);

  const handleConfirmApproval = async () => {
    if (!pendingApprovalUser) return;
    setApproving(true);
    try {
      await updateDoc(doc(db, 'users', pendingApprovalUser.uid), cleanUndefined({
        role: approvalRole
      }));
      toast.success(`Acesso de ${pendingApprovalUser.displayName} liberado com sucesso como ${approvalRole}!`);
      
      const url = new URL(window.location.href);
      url.searchParams.delete('approveEmail');
      window.history.replaceState({}, document.title, url.pathname + url.search);
      
      // Redirect to staff list and filter by approved user
      navigate(`/staff?approvedEmail=${encodeURIComponent(pendingApprovalUser.email)}`);
      
      setPendingApprovalUser(null);
    } catch (err) {
      console.error("Erro ao aprovar usuário:", err);
      toast.error("Erro ao aprovar e-mail.");
    } finally {
      setApproving(false);
    }
  };

  const handleDismissApproval = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('approveEmail');
    window.history.replaceState({}, document.title, url.pathname + url.search);
    setPendingApprovalUser(null);
  };

  // Real-time notification and quick approval states for Elizeu Ferron
  const [realtimeAllUsers, setRealtimeAllUsers] = useState<UserProfile[]>([]);
  const [dismissedPendingUsers, setDismissedPendingUsers] = useState<string[]>([]);
  const [realtimeApprovalRole, setRealtimeApprovalRole] = useState<UserProfile['role']>('Motorista');
  const [realtimeApprovingUid, setRealtimeApprovingUid] = useState<string | null>(null);
  const [isPermissionRequestsOpen, setIsPermissionRequestsOpen] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'pendentes' | 'historico'>('pendentes');
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [expandedRealtimeUid, setExpandedRealtimeUid] = useState<string | null>(null);

  // Auto-set the role being approved based on the user's requestedRole
  useEffect(() => {
    if (pendingApprovalUser) {
      setApprovalRole(pendingApprovalUser.requestedRole || 'Motorista');
    }
  }, [pendingApprovalUser]);

  // User Presence Tracking (Auto-updates 'lastActive' timestamp in users collection)
  useEffect(() => {
    if (!user || !effectiveProfile || effectiveProfile.role === 'Pendente de Liberação' || effectiveProfile.role === 'Aguardando Liberação') return;
    
    const updatePresence = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), cleanUndefined({
          lastActive: new Date().toISOString()
        }));
      } catch (err: any) {
        const errMsg = err?.message || '';
        if (errMsg.includes('Quota') || errMsg.includes('resource-exhausted')) {
          // Silent on quota to avoid flooding console during outage
          return;
        }
        console.error("Erro ao atualizar presença:", err);
      }
    };

    updatePresence();
    
    // Set periodic update every 60 seconds
    const interval = setInterval(updatePresence, 60000);
    
    // Update when returning to the tab
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        updatePresence();
      }
    };
    
    window.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [user, effectiveProfile?.role]);

  // Auto-Update Sync: checks remote version vs CURRENT_APP_VERSION
  useEffect(() => {
    if (!db || !user) return;
    
    const unsubVersion = dbCacheService.subscribeDocument('settings/app_version', async (data) => {
      if (!data) return;
      
      const dbVersion = data.version;
      const isOwner = 
        effectiveProfile?.role === 'Dono / Proprietário' || 
        effectiveProfile?.role === 'Gestor de Frotas' || 
        effectiveProfile?.role === 'Coordenador Logístico' ||
        effectiveProfile?.role === 'Administrativo' ||
        effectiveProfile?.email === 'elizeuferron@gmail.com';
      
      if (dbVersion && dbVersion !== CURRENT_APP_VERSION) {
        const isElizeu = isOwner;
        const dbParts = dbVersion.split('.').map(Number);
        const localParts = CURRENT_APP_VERSION.split('.').map(Number);
        
        let localIsNewer = false;
        for (let i = 0; i < 3; i++) {
          if ((localParts[i] || 0) > (dbParts[i] || 0)) {
            localIsNewer = true;
            break;
          } else if ((localParts[i] || 0) < (dbParts[i] || 0)) {
            break;
          }
        }
        
        if (isElizeu && localIsNewer) {
          try {
            await setDoc(doc(db, 'settings', 'app_version'), cleanUndefined({
              version: CURRENT_APP_VERSION,
              updatedAt: serverTimestamp(),
              updatedBy: effectiveProfile?.email || 'elizeuferron@gmail.com'
            }), { merge: true });
            toast.success(`🚀 Versão do sistema atualizada para v${CURRENT_APP_VERSION}!`);
          } catch (err) {
            console.error("Erro ao atualizar versão no banco:", err);
          }
        } else if (!localIsNewer) {
          console.log(`[Version Control] Nova versão disponível no banco: ${dbVersion}`);
        }
      }
    });
    
    return () => unsubVersion();
  }, [user, effectiveProfile]);

  useEffect(() => {
    if (!user || !effectiveProfile || effectiveProfile.role === 'Pendente de Liberação' || effectiveProfile.role === 'Aguardando Liberação') {
      setRealtimeAllUsers([]);
      return;
    }

    const unsubscribeUsers = dbCacheService.subscribeUsers((allUsersList) => {
      setRealtimeAllUsers(allUsersList);
    });

    return () => unsubscribeUsers();
  }, [user, effectiveProfile]);

  useEffect(() => {
    const handleOpenChangelog = () => {
      setIsChangelogOpen(true);
    };
    window.addEventListener('open-changelog', handleOpenChangelog);
    return () => window.removeEventListener('open-changelog', handleOpenChangelog);
  }, []);

  const realtimePendingUsers = useMemo(() => {
    return realtimeAllUsers.filter(u => u.role === 'Pendente de Liberação' || u.role === 'Aguardando Liberação');
  }, [realtimeAllUsers]);

  const activePendingRealtimeUsers = useMemo(() => {
    return realtimePendingUsers.filter(u => !dismissedPendingUsers.includes(u.uid));
  }, [realtimePendingUsers, dismissedPendingUsers]);

  useEffect(() => {
    if (activePendingRealtimeUsers && activePendingRealtimeUsers.length > 0) {
      const topUser = activePendingRealtimeUsers[0];
      setRealtimeApprovalRole(topUser.requestedRole || 'Motorista');
    }
  }, [activePendingRealtimeUsers]);

  const filteredModalUsers = useMemo(() => {
    const usersInTab = realtimeAllUsers.filter(u => {
      const isPendingStatus = u.role === 'Pendente de Liberação' || u.role === 'Aguardando Liberação';
      if (activeModalTab === 'pendentes') {
        return isPendingStatus;
      } else {
        return !isPendingStatus;
      }
    });

    if (!modalSearchTerm.trim()) return usersInTab;
    const term = modalSearchTerm.toLowerCase();
    return usersInTab.filter(u => 
      (u.displayName || '').toLowerCase().includes(term) || 
      (u.email || '').toLowerCase().includes(term)
    );
  }, [realtimeAllUsers, activeModalTab, modalSearchTerm]);

  const handleRealtimeApprove = async (targetUser: UserProfile, approve: boolean, customRole?: UserProfile['role']) => {
    setRealtimeApprovingUid(targetUser.uid);
    try {
      if (approve) {
        const assignedRole = customRole || realtimeApprovalRole;
        await updateDoc(doc(db, 'users', targetUser.uid), cleanUndefined({
          role: assignedRole
        }));
        toast.success(`Acesso de ${targetUser.displayName} liberado como ${assignedRole}!`);
        
        // Redirect to staff list and filter by approved user
        navigate(`/staff?approvedEmail=${encodeURIComponent(targetUser.email)}`);
      } else {
        // Rejeitar: configurar como Visitante para que não exiba mais
        await updateDoc(doc(db, 'users', targetUser.uid), cleanUndefined({
          role: 'Visitante'
        }));
        toast.info(`Acesso de ${targetUser.displayName} definido como Visitante (Acesso Restrito).`);
      }
      setDismissedPendingUsers(prev => [...prev, targetUser.uid]);
    } catch (err) {
      console.error("Erro na ação em tempo real:", err);
      toast.error("Ocorreu um erro ao processar a ação.");
    } finally {
      setRealtimeApprovingUid(null);
    }
  };

  const handleUpdateUserRoleDirectly = async (targetUser: UserProfile, newRole: UserProfile['role']) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), cleanUndefined({
        role: newRole
      }));
      toast.success(`Nível de acesso alterado para ${newRole}!`);
    } catch (err) {
      console.error("Erro ao atualizar nível de acesso:", err);
      toast.error("Erro ao salvar nova função.");
    }
  };

  const handleDismissRealtimeUser = (uid: string) => {
    setDismissedPendingUsers(prev => [...prev, uid]);
  };

  useEffect(() => {
    const handleResize = () => {
      // Ajusta automaticamente o layout conforme o tamanho da tela (aparelho ou computador)
      // Se a tela for muito larga (> 1280px), desativa o modo celular simulado automaticamente.
      if (window.innerWidth >= 1280) {
        setIsMobileMode(false);
      } else {
        setIsMobileMode(window.innerWidth < 1024);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Section labels updated to match the new 7-module permission layout
  const sections = useMemo(() => {
    const base = [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'trips', label: 'Trabalhos', icon: TrendingUp },
      { id: 'fleet', label: 'Frota', icon: Bus },
      { id: 'finance', label: 'Financeiros', icon: DollarSign },
      { id: 'fuel', label: 'Abastecimento', icon: Fuel },
      { id: 'inventory', label: 'Almoxarifado', icon: Package },
      { id: 'gabinete', label: 'Gabinete', icon: Briefcase },
      { id: 'media-hub', label: 'Media Hub', icon: Video },
      { id: 'criador', label: 'Criador', icon: Sparkles },
    ];

    return base.filter(s => hasPermission(effectiveProfile?.role, s.id, effectiveProfile?.email, effectiveProfile?.permissions, effectiveProfile?.displayName));
  }, [effectiveProfile]);
  
  // Modais
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [isExternalFuelModalOpen, setIsExternalFuelModalOpen] = useState(false);
  const [prefilledVehicleIdForFuel, setPrefilledVehicleIdForFuel] = useState<string | null>(null);
  const [isTankModalOpen, setIsTankModalOpen] = useState(false);
  const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [maintenanceInitialData, setMaintenanceInitialData] = useState<any>(null);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isMaintenanceRelatorioOpen, setIsMaintenanceRelatorioOpen] = useState(false);
  const [isFinancialModalOpen, setIsFinancialModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [isOSModalOpen, setIsOSModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; onConfirm: () => void; title: string; message: string }>({
    isOpen: false,
    onConfirm: () => {},
    title: '',
    message: ''
  });
  const [confirmSaveVehicleData, setConfirmSaveVehicleData] = useState<any>(null);
  const [confirmSaveEmployeeData, setConfirmSaveEmployeeData] = useState<any>(null);
  const [selectedMaintenance, setSelectedMaintenance] = useState<MaintenanceLog | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [financialType, setFinancialType] = useState<'payable' | 'receivable'>('payable');
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [formLoading, setFormLoading] = useState(false);
  const [isChangelogOpen, setIsChangelogOpen] = useState(() => {
    try {
      return localStorage.getItem('dmturismo_changelog_seen_v3') !== 'true';
    } catch {
      return true;
    }
  });

  // Data States
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_vehicles');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [fuelTanks, setFuelTanks] = useState<FuelTank[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_fuel_tanks');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [recentFuelLogs, setRecentFuelLogs] = useState<FuelLog[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_fuel_logs');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [fuelEntries, setFuelEntries] = useState<FuelEntry[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_fuel_entries');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [maintenance, setMaintenance] = useState<MaintenanceLog[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_maintenance');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_transactions');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [stock, setStock] = useState<StockItem[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_stock');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [trips, setTrips] = useState<Trip[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_trips');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const [vehiclesLoading, setVehiclesLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_vehicles');
        return saved ? false : true;
      } catch {
        return true;
      }
    }
    return true;
  });
  const [tripsLoading, setTripsLoading] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_trips');
        return saved ? false : true;
      } catch {
        return true;
      }
    }
    return true;
  });
  const [charteredRoutes, setCharteredRoutes] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('dmturismo_cached_chartered_routes');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  // Live-derived states to ensure perfect real-time synchronization between database updates and active modals
  const liveSelectedVehicle = useMemo(() => {
    if (!selectedVehicle) return null;
    return vehicles.find(v => v.id === selectedVehicle.id) || selectedVehicle;
  }, [selectedVehicle, vehicles]);

  const liveSelectedTrip = useMemo(() => {
    if (!selectedTrip) return null;
    return trips.find(t => t.id === selectedTrip.id) || selectedTrip;
  }, [selectedTrip, trips]);

  const liveSelectedEmployee = useMemo(() => {
    if (!selectedEmployee) return null;
    return employees.find(e => e.id === selectedEmployee.id) || selectedEmployee;
  }, [selectedEmployee, employees]);

  const liveSelectedMaintenance = useMemo(() => {
    if (!selectedMaintenance) return null;
    return maintenance.find(m => m.id === selectedMaintenance.id) || selectedMaintenance;
  }, [selectedMaintenance, maintenance]);

  const liveSelectedTripForAttachments = useMemo(() => {
    if (!selectedTripForAttachments) return null;
    return trips.find(t => t.id === selectedTripForAttachments.id) || selectedTripForAttachments;
  }, [selectedTripForAttachments, trips]);

  const liveSelectedMaintenanceForAttachments = useMemo(() => {
    if (!selectedMaintenanceForAttachments) return null;
    return maintenance.find(m => m.id === selectedMaintenanceForAttachments.id) || selectedMaintenanceForAttachments;
  }, [selectedMaintenanceForAttachments, maintenance]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('');
  const [tripStatusFilter, setTripStatusFilter] = useState<string>('all');
  const [tripTypeFilter, setTripTypeFilter] = useState<string>('all');
  const [tripDateStart, setTripDateStart] = useState<string>('');
  const [tripDateEnd, setTripDateEnd] = useState<string>('');
  const [tripSearch, setTripSearch] = useState('');
  const [maintenanceSearch, setMaintenanceSearch] = useState('');
  const [sharedAttachments, setSharedAttachments] = useState<{name: string, url: string, type: 'image' | 'pdf' | 'word' | 'excel'}[]>([]);

  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const checkStandalone = () => {
      const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
    };

    checkStandalone();
  }, []);

  // Load critical cache from IndexedDB right on start, reinforcing instantaneous load speed and bypassing any potential localStorage size limitations
  useEffect(() => {
    const loadIndexedDBCache = async () => {
      try {
        const cachedVehicles = await dbCacheService.getVehicles();
        if (cachedVehicles && cachedVehicles.length > 0) {
          setVehicles(cachedVehicles);
          setVehiclesLoading(false);
        }
        
        const cachedEmployees = await dbCacheService.getEmployees();
        if (cachedEmployees && cachedEmployees.length > 0) {
          setEmployees(cachedEmployees);
        }

        const cachedTrips = await dbCacheService.getTrips();
        if (cachedTrips && cachedTrips.length > 0) {
          setTrips(cachedTrips);
          setTripsLoading(false);
        }
        console.log('[IndexedDB Cache] Loaded vehicles, employees, and trips successfully.');
      } catch (err) {
        console.error('[IndexedDB Cache] Failed to load local cache:', err);
      }
    };
    loadIndexedDBCache();
  }, []);

  // Pre-fetch critical lazy loaded modules after 2 seconds when app is settled, ensuring instantaneous modal loads with zero freeze or delay
  useEffect(() => {
    const prefetchTimer = setTimeout(() => {
      if (typeof window !== 'undefined') {
        const prefetchModules = [
          () => import('./components/Forms'),
          () => import('./components/MaintenanceForm'),
          () => import('./components/FinancialForm'),
          () => import('./components/VehicleDetail'),
          () => import('./components/TripServiceOrder'),
          () => import('./components/MaintenanceServiceOrder'),
          () => import('./components/TripForm')
        ];
        // Execute sequentially to avoid blocking the network thread
        prefetchModules.reduce((promise, nextImport) => {
          return promise.then(() => new Promise<void>((resolve) => {
            setTimeout(() => {
              nextImport()
                .then(() => resolve())
                .catch(() => resolve());
            }, 300);
          }));
        }, Promise.resolve());
      }
    }, 2000);
    return () => clearTimeout(prefetchTimer);
  }, []);

  // Trigger automatic backup check and CSV Export based on user settings
  useEffect(() => {
    if (loading) return;

    const triggerDailyBackupAndFridayExport = async () => {
      try {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          console.warn('[Automatic Backups] O dispositivo está offline. Ignorando tarefas automatizadas.');
          return;
        }

        const email = auth.currentUser?.email;
        if (!email) return;

        // Only trigger daily storage backup check if the user is elizeuferron@gmail.com or has an administrative/proprietor role
        const isEligible = email === 'elizeuferron@gmail.com' || 
                           effectiveProfile?.role === 'Dono / Proprietário' || 
                           effectiveProfile?.role === 'Gestor de Frotas' ||
                           effectiveProfile?.role === 'Administrativo';
        if (!isEligible) return;

        // Load configured frequencies using dbCacheService for quota resilience
        let backupFreq = 'diario';
        let exportFreq = 'semanal';
        
        try {
          const settings = await dbCacheService.getDocumentFromCache('settings/backup_settings');
          if (settings) {
            backupFreq = settings.backupFrequency || 'diario';
            exportFreq = settings.exportFrequency || 'semanal';
          } else {
            // If not in cache, we might want to subscribe to it for next time
            // but for this one-shot task, we'll try a one-time fetch if quota allows
            try {
              const snap = await getDoc(doc(db, 'settings', 'backup_settings'));
              if (snap.exists()) {
                const s = snap.data();
                backupFreq = s.backupFrequency || 'diario';
                exportFreq = s.exportFrequency || 'semanal';
                // Also save to cache for future usage
                await dbCacheService.saveDocumentToCache('settings/backup_settings', s);
              }
            } catch (e) {
              console.warn('[Automatic Backups] Could not fetch settings from Firestore, using defaults.', e);
            }
          }
        } catch (err) {
          console.warn('[Automatic Backups] Error accessing cache for settings:', err);
        }

        const triggered = await backupService.checkAndTriggerConfiguredBackup(email, backupFreq);
        if (triggered) {
          console.log(`[Storage Backup] Automatic backup (${backupFreq}) completed successfully.`);
        }

        const triggeredFriday = await backupService.checkAndTriggerConfiguredExport(email, exportFreq);
        if (triggeredFriday) {
          console.log(`[Friday Export] Automatic CSV/PDF export (${exportFreq}) completed successfully.`);
        }
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (errMsg.toLowerCase().includes('offline') || 
            errMsg.toLowerCase().includes('failed to get document') || 
            errMsg.toLowerCase().includes('unreachable') || 
            errMsg.toLowerCase().includes('unavailable')) {
          console.warn('[Automatic Backups] Dispositivo ou Firestore está offline:', errMsg);
        } else if (errMsg.toLowerCase().includes('quota') || errMsg.toLowerCase().includes('resource-exhausted')) {
          console.warn('[Automatic Backups] Quota excedida ao executar tarefas automatizadas. Operando em modo cache.');
        } else {
          console.error('[Automatic Backups] Failed to run automated task:', err);
        }
      }
    };
    
    const timer = setTimeout(triggerDailyBackupAndFridayExport, 5000);
    return () => clearTimeout(timer);
  }, [loading, effectiveProfile]);

  const prevDataRef = React.useRef<{
    vehicles: Record<string, string>;
    maintenance: Record<string, string>;
    trips: Record<string, string>;
    pendingUsersCount: number;
  }>({
    vehicles: {},
    maintenance: {},
    trips: {},
    pendingUsersCount: 0,
  });

  useEffect(() => {
    const currentVehicles: Record<string, string> = {};
    if (vehicles && vehicles.length > 0) {
      vehicles.forEach(v => {
        if (v && v.id) currentVehicles[v.id] = v.status || '';
      });
    }

    const currentMaint: Record<string, string> = {};
    if (maintenance && maintenance.length > 0) {
      maintenance.forEach(m => {
        if (m && m.id) currentMaint[m.id] = m.status || '';
      });
    }

    const currentTrips: Record<string, string> = {};
    if (trips && trips.length > 0) {
      trips.forEach(t => {
        if (t && t.id) currentTrips[t.id] = t.status || '';
      });
    }

    const currentPendingUsersCount = activePendingRealtimeUsers ? activePendingRealtimeUsers.length : 0;

    const isBaselineEstablished = Object.keys(prevDataRef.current.vehicles).length > 0 ||
                                  Object.keys(prevDataRef.current.maintenance).length > 0 ||
                                  Object.keys(prevDataRef.current.trips).length > 0;

    if (isBaselineEstablished) {
      let criticalChangeDetected = false;

      // 1. Check if any vehicle changed status to a critical state ('maintenance', etc.) or changed in general
      for (const [id, status] of Object.entries(currentVehicles)) {
        const prevStatus = prevDataRef.current.vehicles[id];
        if (prevStatus !== undefined && prevStatus !== status) {
          if (status === 'maintenance' || prevStatus === 'maintenance') {
            criticalChangeDetected = true;
          }
        }
      }

      // 2. Check if a maintenance log status changed to pending
      for (const [id, status] of Object.entries(currentMaint)) {
        const prevStatus = prevDataRef.current.maintenance[id];
        if (prevStatus !== undefined && prevStatus !== status) {
          if (status === 'pending' || prevStatus === 'pending') {
            criticalChangeDetected = true;
          }
        }
      }

      // 3. Check if trip status changed
      for (const [id, status] of Object.entries(currentTrips)) {
        const prevStatus = prevDataRef.current.trips[id];
        if (prevStatus !== undefined && prevStatus !== status) {
          criticalChangeDetected = true;
        }
      }

      // 4. Check if pending requests count increased
      if (currentPendingUsersCount > prevDataRef.current.pendingUsersCount) {
        criticalChangeDetected = true;
      }

      if (criticalChangeDetected) {
        setShouldVibrateBell(true);
        const timer = setTimeout(() => {
          setShouldVibrateBell(false);
        }, 3000);
        return () => clearTimeout(timer);
      }
    }

    // Update baseline reference
    if ((vehicles && vehicles.length > 0) || (maintenance && maintenance.length > 0) || (trips && trips.length > 0) || currentPendingUsersCount > 0) {
      prevDataRef.current = {
        vehicles: currentVehicles,
        maintenance: currentMaint,
        trips: currentTrips,
        pendingUsersCount: currentPendingUsersCount,
      };
    }
  }, [vehicles, maintenance, trips, activePendingRealtimeUsers]);

  const handleShareAppLink = () => {
    const appUrl = window.location.origin;
    const shareData = {
      title: 'DM Turismo - Inteligência Operacional',
      text: 'Acesse o sistema de gestão de ativos e operações da DM Turismo:',
      url: appUrl,
    };

    if (navigator.share) {
      navigator.share(shareData).catch(console.error);
    } else {
      navigator.clipboard.writeText(appUrl);
      toast.success("Link do sistema copiado!");
    }
  };

  const handleShareStaffAccess = (employee: Employee) => {
    const appUrl = window.location.origin;
    const shareUrl = `${appUrl}/?emp=${employee.id}`;
    const message = `🏢 *DM TURISMO - ACESSO LIBERADO* 🏢%0A%0AOlá *${employee.name.toUpperCase()}*! 👋%0A%0ASeu terminal de logística e viagens foi liberado. Acesse pelo link abaixo:%0A%0A🔗 *LINK:*%0A${shareUrl}%0A%0A_DM TURISMO - prazer em viajar bem_`;
    const cleanPhone = (employee.phone || '').replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank');
  };

  const handleExportStaffToExcel = async () => {
    try {
      const XLSX = await import('xlsx');
      const data = employees.map(e => ({
        ID: e.id,
        Nome: e.name,
        Cargo: e.role,
        CPF: e.cpf || 'N/A',
        Nascimento: e.birthDate ? format(parseISO(e.birthDate), 'dd/MM/yyyy') : 'N/A',
        Admissão: e.admissionDate ? format(parseISO(e.admissionDate), 'dd/MM/yyyy') : 'N/A',
        Telefone: e.phone || 'N/A',
        Email: e.email || 'N/A',
        'Vencimento CNH': e.licenseExpiration ? format(parseISO(e.licenseExpiration), 'dd/MM/yyyy') : 'N/A'
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Equipe DM Turismo");
      XLSX.writeFile(wb, `Equipe_DM_Turismo_${format(new Date(), 'dd_MM_yyyy')}.xlsx`);
      toast.success("Equipe exportada com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar Excel:", error);
      toast.error("Erro ao gerar arquivo Excel.");
    }
  };

  const handleExportEmployeeToExcel = async (employee: Employee) => {
    try {
      const XLSX = await import('xlsx');
      const data = [{
        'Aba Aplicativo': 'DM TURISMO PRO',
        'Ficha do Colaborador': employee.name,
        '-------------------': '-------------------',
        'ID': employee.id,
        'Nome Completo': employee.name,
        'Cargo/Função': employee.role,
        'CPF': employee.cpf || 'N/A',
        'RG': employee.rg || 'N/A',
        'Data de Nascimento': employee.birthDate ? format(parseISO(employee.birthDate), 'dd/MM/yyyy') : 'N/A',
        'Data de Admissão': employee.admissionDate ? format(parseISO(employee.admissionDate), 'dd/MM/yyyy') : 'N/A',
        'Telefone Contato': employee.phone || 'N/A',
        'E-mail': employee.email || 'N/A',
        'Vencimento CNH': employee.licenseExpiration ? format(parseISO(employee.licenseExpiration), 'dd/MM/yyyy') : 'N/A',
        'Categoria CNH': employee.licenseCategory || 'N/A',
        'Status do Perfil': employee.status === 'active' ? 'Ativo' : 'Inativo',
        'Exportado em': format(new Date(), 'dd/MM/yyyy HH:mm')
      }];

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Ficha Colaborador");
      
      // Auto-size columns
      const maxWidths = Object.keys(data[0]).map(key => Math.max(key.length, String(data[0][key as keyof typeof data[0]]).length) + 2);
      ws['!cols'] = maxWidths.map(w => ({ wch: w }));

      XLSX.writeFile(wb, `Ficha_${employee.name.replace(/\s+/g, '_')}.xlsx`);
      toast.success(`Ficha de ${employee.name} exportada!`);
    } catch (error) {
      console.error("Erro ao exportar ficha:", error);
      toast.error("Erro ao gerar ficha Excel.");
    }
  };

  const handleExportEmployeeAPK = (employee: Employee) => {
    const appUrl = window.location.origin;
    const shareUrl = `${appUrl}/?emp=${employee.id}`;
    generateAPKDigital(shareUrl, employee.name);
  };

  const handleExportAPKDigital = () => {
    generateAPKDigital();
  };

  const handleGenerateDossier = async (type: 'completo' | 'simplificado') => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default;

      const doc = new jsPDF() as any;
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      let currentY = 15;

      const drawHeader = (title: string, sub: string) => {
        // Eco-Mode: Clean grayscale header without solid fills
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(14, currentY + 28, pageWidth - 14, currentY + 28);

        // Logo DM (Stylized Text Branding for Low Ink)
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.setTextColor(0, 0, 0);
        doc.text('DM', 14, currentY + 12);
        
        doc.setFontSize(14);
        doc.text('TURISMO', 26, currentY + 12);
        
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(80, 80, 80);
        doc.text('"Prazer em viajar bem"', 14, currentY + 18);

        doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.text(title, 20, currentY + 26, { align: 'left' });

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 113, 122);
        doc.text(sub, 20, currentY + 31);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(7.5);
        doc.text(`Emitido em: ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')}`, pageWidth - 14, currentY + 10, { align: 'right' });
        doc.text(`Responsável: ${effectiveProfile?.displayName || 'Sistema'}`, pageWidth - 14, currentY + 15, { align: 'right' });
        doc.text(`Perfil: ${effectiveProfile?.role || 'Operador'}`, pageWidth - 14, currentY + 20, { align: 'right' });

        currentY += 42;
      };

      const drawSectionTitle = (title: string) => {
        if (currentY > pageHeight - 35) {
          doc.addPage();
          currentY = 15;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);
        doc.text(title, 14, currentY);
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.3);
        doc.line(14, currentY + 2, pageWidth - 14, currentY + 2);
        currentY += 10;
      };

      if (type === 'simplificado') {
        drawHeader(
          'DM TURISMO - DOSSIE SIMPLIFICADO',
          'RESUMO OPERACIONAL EXECUTIVO CONSOLIDADO'
        );

        const activeVehicles = vehicles.filter(v => v.status === 'available').length;
        const totalVehicles = vehicles.length;
        const activeEmployees = employees.filter(e => e.status === 'active').length;
        const pendingMaint = maintenance.filter(m => m.status === 'pending').length;
        const totalTrips = trips.length;

        const revenue = transactions
          .filter(t => t.type === 'receivable' && t.status === 'paid')
          .reduce((sum, t) => sum + (t.amount || 0), 0);
        const outstandingPayables = transactions
          .filter(t => t.type === 'payable' && t.status === 'pending')
          .reduce((sum, t) => sum + (t.amount || 0), 0);

        drawSectionTitle('1. RESUMO GERAL DE CONVENIENCIA OPERACIONAL (KPIs)');
        
        const kpisData = [
          ['Metrica Logistica', 'Valor Registrado', 'Metrica Financeira', 'Saldo / Previsao'],
          ['Frota Ativa / Cadastrada', `${activeVehicles} / ${totalVehicles} Veiculos`, 'Faturamento Pago', `R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Equipe Ativa / Total', `${activeEmployees} / ${employees.length} Colaboradores`, 'Contas a Pagar Pendentes', `R$ ${outstandingPayables.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Viagens Registradas', `${totalTrips} Rotas`, 'Ordens de Servicos Pendentes', `${pendingMaint} Manutencoes`],
        ];

        autoTable(doc, {
          startY: currentY,
          head: [kpisData[0]],
          body: kpisData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [241, 245, 249], textColor: [0, 0, 0], fontSize: 8.5, fontStyle: 'bold', lineWidth: 0.1, lineColor: [0, 0, 0] },
          styles: { fontSize: 8, cellPadding: 3, textColor: [0, 0, 0] },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        drawSectionTitle('2. SEGURANÇA E PONTOS DE ATENÇÃO IMEDIATOS (ALERTAS)');
        
        const alertsList: string[] = [];
        const expiringLicenses = employees.filter(e => {
          if (!e.licenseExpiration) return false;
          try {
            const days = differenceInDays(parseISO(e.licenseExpiration), new Date());
            return days <= 30;
          } catch {
            return false;
          }
        });
        if (expiringLicenses.length > 0) {
          alertsList.push(`- Ha ${expiringLicenses.length} colaborador(es) com CNH vencendo nos proximos 30 dias.`);
        }

        const outOfStock = stock.filter(item => item.quantity <= item.minQuantity);
        if (outOfStock.length > 0) {
          alertsList.push(`- Ha ${outOfStock.length} item(ns) no almoxarifado abaixo da quantidade minima reservada.`);
        }

        const inMaintenance = vehicles.filter(v => v.status === 'maintenance').length;
        if (inMaintenance > 0) {
          alertsList.push(`- Ha ${inMaintenance} veiculo(s) retido(s) ou em oficina no momento.`);
        }

        if (alertsList.length === 0) {
          alertsList.push('Nenhum alerta imediato prioritario detectado. Tudo operando conforme padroes estaveis.');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(50, 50, 50);
        alertsList.forEach(alert => {
          if (currentY > pageHeight - 15) {
            doc.addPage();
            currentY = 20;
          }
          doc.text(alert, 14, currentY);
          currentY += 6;
        });

        currentY += 6;
        drawSectionTitle('3. ULTIMOS LANÇAMENTOS E VIAGENS DE ESCALA');

        const recentTrips = trips.slice(0, 5).map(t => {
          const mDriverName = employees.find(e => e.id === t.driverId)?.name || t.driverId || 'N/A';
          return [
            t.startDate ? format(parseISO(t.startDate), 'dd/MM/yyyy HH:mm') : 'N/A',
            `${t.origin || 'N/A'} -> ${t.destination || 'N/A'}`,
            mDriverName,
            t.status === 'completed' ? 'Realizada' : 'Pendente'
          ];
        });

        if (recentTrips.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Data/Hora', 'Itinerario Roteiro', 'Motorista', 'Status']],
            body: recentTrips,
            theme: 'striped',
            headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(8.5);
          doc.setTextColor(120, 120, 120);
          doc.text('Nenhuma escala de viagem registrada nos ultimos dias.', 14, currentY);
          currentY += 10;
        }

        doc.save(`DM_Turismo_Dossie_Simplificado_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
        toast.success("Dossie Simplificado (.PDF) baixado!");

      } else {
        drawHeader(
          'DM TURISMO - DOSSIE COMPLETO DE OPERAÇÕES',
          'SÍNTESE COMPLETA, AUDITORIA E RELATÓRIO CORPORATIVO DE ATIVOS'
        );

        const totalVehicles = vehicles.length;
        const totalEmployees = employees.length;
        const totalTrips = trips.length;
        const totalMaint = maintenance.length;
        const totalFuelSpent = recentFuelLogs.reduce((sum, f) => sum + (f.cost || 0), 0);
        const totalLitres = recentFuelLogs.reduce((sum, f) => sum + (f.quantity || 0), 0);

        drawSectionTitle('1. SUMARIO DA ADMINISTRAÇAO E PERFORMANCE DE CAMPO');
        const summaryData = [
          ['Indicador de Ativo', 'Total Cadastrados', 'Indicador Fiscais/Financeiros', 'Valores Consolidados'],
          ['Veiculos Rastreados', `${totalVehicles} Unidades`, 'Consumo Total Combustivel', `${totalLitres.toFixed(1)} Litros`],
          ['Colaboradores Ativos', `${totalEmployees} Homologados`, 'Despesas em Combustivel', `R$ ${totalFuelSpent.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`],
          ['Manutencoes Executadas', `${totalMaint} Ordens`, 'Escalas de Viagens e Rotas', `${totalTrips} Realizadas/Progresso`],
        ];

        autoTable(doc, {
          startY: currentY,
          head: [summaryData[0]],
          body: summaryData.slice(1),
          theme: 'grid',
          headStyles: { fillColor: [24, 24, 27], textColor: [255, 255, 255], fontSize: 8.5 },
          styles: { fontSize: 8, cellPadding: 3 },
        });

        currentY = (doc as any).lastAutoTable.finalY + 12;

        drawSectionTitle('2. MAQUINARIO E DETALHES DE FROTA (CHASSIS/STATUS)');
        const fleetRows = vehicles.map(v => [
          v.plate?.toUpperCase() || 'N/A',
          v.model || 'N/A',
          (v.currentOdometer || 0).toLocaleString('pt-BR') + ' KM',
          v.status === 'available' ? 'Ativo/Liberado' : 'Afastado/Oficina'
        ]);

        if (fleetRows.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Placa', 'Marca / Modelo', 'Odometro', 'Status de Escala']],
            body: fleetRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.text('Não ha veiculos cadastrados para exibição.', 14, currentY);
          currentY += 10;
        }

        drawSectionTitle('3. RECURSOS HUMANOS, OPERADORES E DOCUMENTAÇAO');
        const staffRows = employees.map(e => [
          e.name,
          e.role,
          e.phone || 'N/A',
          e.licenseExpiration ? format(parseISO(e.licenseExpiration), 'dd/MM/yyyy') : 'N/A',
          e.status === 'active' ? 'Operante' : 'Desativado'
        ]);

        if (staffRows.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Nome Completo', 'Cargo / Função', 'Telefone', 'Vencimento CNH', 'Estado']],
            body: staffRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.text('Não ha funcionarios cadastrados no banco de dados.', 14, currentY);
          currentY += 10;
        }

        drawSectionTitle('4. FRETAMENTO COMERCIAL E ROTAS FIXADAS');
        const charterRows = charteredRoutes.map(c => [
          c.client || 'N/A',
          c.route || 'N/A',
          c.origin || 'N/A',
          c.destination || 'N/A',
          c.recurrence || 'Recorrente'
        ]);

        if (charterRows.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Cliente Adquirente', 'Etiqueta Rota', 'Origem', 'Destino', 'Recorrencia']],
            body: charterRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.text('Não ha rotas fixas de fretamento salvas no momento.', 14, currentY);
          currentY += 10;
        }

        drawSectionTitle('5. ALMOXARIFADO E INVENTARIO DE INSUMOS');
        const stockRows = stock.map(s => [
          s.name,
          s.category,
          `${s.quantity} ${s.unit}`,
          s.quantity <= s.minQuantity ? 'CRITICO' : 'SEGURO'
        ]);

        if (stockRows.length > 0) {
          autoTable(doc, {
            startY: currentY,
            head: [['Material / Peça', 'Categoria', 'Estoque Atual', 'Status']],
            body: stockRows,
            theme: 'striped',
            headStyles: { fillColor: [30, 30, 30], textColor: [255, 255, 255], fontSize: 8 },
            styles: { fontSize: 7.5, cellPadding: 2.5 },
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.text('Sem insumos catalogados no almoxarifado tecnico.', 14, currentY);
          currentY += 10;
        }

        doc.save(`DM_Turismo_Dossie_Completo_${format(new Date(), 'dd_MM_yyyy')}.pdf`);
        toast.success("Dossie Completo (.PDF) consolidado com sucesso!");
      }
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast.error("Ocorreu um erro ao processar o Dossie Operacional.");
    }
  };

  useEffect(() => {
    const handleParams = async () => {
      const url = new URL(window.location.href);
      
      const empId = url.searchParams.get('emp');
      const empEmail = url.searchParams.get('empEmail') || url.searchParams.get('email');
      if ((empId || empEmail) && employees.length > 0) {
        const emp = empId 
          ? employees.find(e => e.id === empId)
          : employees.find(e => e.email?.trim().toLowerCase() === empEmail?.trim().toLowerCase());
          
        if (emp) {
          setEmployeeContext(emp);
          handleNavigate('journey');
          toast.success(`Terminal Operacional: ${emp.name}`, {
            description: "Acesso direto autorizado. Suas escalas e jornadas estão prontas para acesso.",
            icon: <Users size={16} />
          });
          
          if (empId) url.searchParams.delete('emp');
          if (url.searchParams.has('empEmail')) url.searchParams.delete('empEmail');
          if (url.searchParams.has('email')) url.searchParams.delete('email');
          window.history.replaceState({}, document.title, url.pathname + url.search);
        }
      }

      // Handle explicit sections from PWA shortcuts
      const section = url.searchParams.get('section');
      if (section && sections.some(s => s.id === section)) {
        handleNavigate(section);
      }

      if (url.searchParams.get('shared') === 'true') {
        try {
          const dbRequest = indexedDB.open('dm-frotas-share', 1);
          dbRequest.onsuccess = () => {
            const db = dbRequest.result;
            if (!db.objectStoreNames.contains('files')) return;
            
            const transaction = db.transaction('files', 'readwrite');
            const store = transaction.objectStore('files');
            const request = store.getAll();
            
            request.onsuccess = async () => {
              const items = request.result;
              if (items.length > 0) {
                const attachments = await Promise.all(items.map(async (item: any) => {
                  const reader = new FileReader();
                  const dataUrl = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(item.file);
                  });
                  
                  let type: 'image' | 'pdf' | 'word' | 'excel' = 'image';
                  if (item.type.includes('pdf')) type = 'pdf';
                  else if (item.type.includes('word') || item.type.includes('officedocument.word')) type = 'word';
                  else if (item.type.includes('excel') || item.type.includes('sheet') || item.type.includes('csv')) type = 'excel';
                  
                  return {
                    name: item.name,
                    url: dataUrl,
                    type
                  };
                }));

                setSharedAttachments(attachments);
                handleNavigate('trips');
                setIsTripModalOpen(true);
                
                const clearTx = db.transaction('files', 'readwrite');
                clearTx.objectStore('files').clear();
                
                toast.success(`${attachments.length} arquivos compartilhados carregados!`);
              }
            };
          };
        } catch (err) {
          console.error("Error retrieving shared files:", err);
        }
        window.history.replaceState({}, document.title, "/");
      }
    };
    handleParams();
  }, [employees]);

  const maintenanceData = useMemo(() => {
    const last6Months = [...Array(6)].map((_, i) => {
      const date = subMonths(new Date(), i);
      return {
        month: format(date, 'MMM', { locale: ptBR }),
        start: startOfMonth(date),
        preventive: 0,
        corrective: 0,
        total: 0
      };
    }).reverse();

    maintenance.forEach(m => {
      const date = parseISO(m.completedAt || m.createdAt);
      const monthIndex = last6Months.findIndex(item => isSameMonth(item.start, date));
      if (monthIndex !== -1) {
        if (m.type === 'preventive') {
          last6Months[monthIndex].preventive += Number(m.cost || 0);
        } else {
          last6Months[monthIndex].corrective += Number(m.cost || 0);
        }
        last6Months[monthIndex].total += Number(m.cost || 0);
      }
    });

    return last6Months;
  }, [maintenance]);

  useEffect(() => {
    let unsubProfile: (() => void) | undefined;

    // Safety timeout to guarantee the app unlocks within max 1.2s even if Auth/Firestore is slow or offline
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      clearTimeout(loadingTimeout);
      setUser(user);
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = undefined;
      }

      if (user) {
        // Save minimal user object to allow instant offline login
        const minimalUser = {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
        };
        saveToLocalStorageAsync('dmturismo_cached_user', minimalUser);

        // Initialize FCM Foreground Alert Observer
        setupForegroundNotificationListener();
        
        // Quietly obtain device permission and store token
        requestNotificationPermission(user.uid).catch(err => {
          console.log('[FCM] Error acquiring token: ', err);
        });

        // Tentar recuperar perfil em cache para acelerar renderização imediata do painel principal (Sem Modo de Espera)
        const saved = localStorage.getItem('dmturismo_cached_profile');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed && parsed.uid === user.uid) {
              setProfile(parsed);
              setLoading(false);
            }
          } catch (e) {}
        }

        unsubProfile = dbCacheService.subscribeUserProfile(user.uid, (data: UserProfile) => {
          if (data) {
            if (data.requestedRole) {
              setSelectedPendingDesiredRole(data.requestedRole);
            }
            
            // Force super admin logic for specific email
            if (data.email === 'elizeuferron@gmail.com' && data.role !== 'Dono / Proprietário') {
              data.role = 'Dono / Proprietário';
            }

            // Immediately set the profile and stop the loading spinner
            setProfile(data);
            setLoading(false);

            // Se o e-mail estiver na ficha de colaborador, sincronizar de forma totalmente assíncrona (não-bloqueante)
            (async () => {
              try {
                // Usar DBCacheService para evitar getDocs e economizar quota de leitura
                const employees = await dbCacheService.getEmployees();
                const userEmail = user.email?.trim().toLowerCase();
                const empData = employees.find(e => e.email?.trim().toLowerCase() === userEmail);
                
                if (empData) {
                  if (data.role !== empData.role || JSON.stringify(data.permissions) !== JSON.stringify(empData.permissions)) {
                    await updateDoc(doc(db, 'users', user.uid), cleanUndefined({
                      role: empData.role,
                      permissions: empData.permissions || []
                    }));
                    // Note: onSnapshot will trigger again automatically when the document updates
                    toast.success(`Seu cadastro foi vinculado e autorizado como ${empData.role}!`);
                  }
                }
              } catch (err) {
                console.error("Erro ao sincronizar informações de colaborador: ", err);
              }
            })();
          } else {
            // Profile doesn't exist, create it in a non-blocking asynchronous way
            const isSuper = user.email === 'elizeuferron@gmail.com';
            const initialRole: UserRole = isSuper ? 'Dono / Proprietário' : 'Pendente de Liberação';
            const initialPermissions: string[] = [];

            const newProfile: UserProfile = {
              uid: user.uid,
              email: user.email!,
              displayName: user.displayName || 'Novo Usuário',
              role: initialRole,
              permissions: initialPermissions,
              photoURL: user.photoURL || undefined
            };

            const createProfileAndCheck = async () => {
              try {
                let finalRole: UserRole = initialRole;
                let finalPermissions: string[] = initialPermissions;

                try {
                  const q = query(collection(db, 'employees'), where('email', '==', user.email?.trim().toLowerCase()));
                  const empSnap = await getDocs(q);
                  if (!empSnap.empty) {
                    const empData = empSnap.docs[0].data() as Employee;
                    finalRole = empData.role as UserRole;
                    finalPermissions = empData.permissions || [];
                    toast.success(`Acesso pré-autorizado via e-mail do colaborador como ${finalRole}!`);
                  }
                } catch (err) {
                  console.error("Erro ao verificar acesso pré-autorizado:", err);
                }

                await setDoc(doc(db, 'users', user.uid), cleanUndefined({
                  ...newProfile,
                  role: finalRole,
                  permissions: finalPermissions,
                  createdAt: serverTimestamp()
                }));
                // onSnapshot will catch this new document and trigger the loaded state
              } catch (error) {
                console.error("Erro ao criar perfil:", error);
                setLoading(false);
              }
            };
            createProfileAndCheck();
          }
        });
      } else {
        localStorage.removeItem('dmturismo_cached_user');
        localStorage.removeItem('dmturismo_cached_profile');
        localStorage.removeItem('dmturismo_employee_context');
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, []);

  useEffect(() => {
    // Hydrate states from secondary IndexedDB cache for high-capacity offline speed (loads in 0ms)
    async function loadIndexedDBCaches() {
      try {
        const cachedFuelTanks = await dbCacheService.getCollectionFromCache('fuel_tanks');
        if (cachedFuelTanks && cachedFuelTanks.length > 0) {
          setFuelTanks(cachedFuelTanks);
        }

        const cachedFuelLogs = await dbCacheService.getCollectionFromCache('fuel_logs');
        if (cachedFuelLogs && cachedFuelLogs.length > 0) {
          setRecentFuelLogs(cachedFuelLogs);
        }

        const cachedFuelEntries = await dbCacheService.getCollectionFromCache('fuel_entries');
        if (cachedFuelEntries && cachedFuelEntries.length > 0) {
          setFuelEntries(cachedFuelEntries);
        }

        const cachedMaint = await dbCacheService.getCollectionFromCache('maintenance_logs');
        if (cachedMaint && cachedMaint.length > 0) {
          setMaintenance(cachedMaint);
        }

        const cachedStock = await dbCacheService.getCollectionFromCache('stock_items');
        if (cachedStock && cachedStock.length > 0) {
          setStock(cachedStock);
        }

        const cachedTransactions = await dbCacheService.getCollectionFromCache('financial_transactions');
        if (cachedTransactions && cachedTransactions.length > 0) {
          setTransactions(cachedTransactions);
        }

        const cachedRoutes = await dbCacheService.getCollectionFromCache('chartered_routes');
        if (cachedRoutes && cachedRoutes.length > 0) {
          setCharteredRoutes(cachedRoutes);
        }
      } catch (err) {
        console.warn('Erro ao carregar cache secundário do IndexedDB:', err);
      }
    }
    
    loadIndexedDBCaches();

    // Employee list is needed for the login page and access verification
    const unsubStaff = dbCacheService.subscribeEmployees((data) => {
      setEmployees(data as Employee[]);
      saveToLocalStorageAsync('dmturismo_cached_employees', data);
    });

    if (!user) return () => unsubStaff();

    const unsubVehicles = dbCacheService.subscribeVehicles((data) => {
      setVehicles(data as Vehicle[]);
      saveToLocalStorageAsync('dmturismo_cached_vehicles', data);
      setVehiclesLoading(false);
    });

    const unsubFuel = dbCacheService.subscribeCollection('fuel_tanks', (data) => {
      setFuelTanks(data as FuelTank[]);
      saveToLocalStorageAsync('dmturismo_cached_fuel_tanks', data);
    });

    const unsubLogs = dbCacheService.subscribeCollection('fuel_logs', (data) => {
      setRecentFuelLogs(data as FuelLog[]);
      saveToLocalStorageAsync('dmturismo_cached_fuel_logs', data);
    });

    const unsubEntries = dbCacheService.subscribeCollection('fuel_entries', (data) => {
      setFuelEntries(data as FuelEntry[]);
      saveToLocalStorageAsync('dmturismo_cached_fuel_entries', data);
    });

    const unsubMaint = dbCacheService.subscribeCollection('maintenance_logs', (data) => {
      setMaintenance(data as MaintenanceLog[]);
      saveToLocalStorageAsync('dmturismo_cached_maintenance', data);
    });

    const unsubStock = dbCacheService.subscribeCollection('stock_items', (data) => {
      setStock(data as StockItem[]);
      saveToLocalStorageAsync('dmturismo_cached_stock', data);
    });

    const unsubFinance = dbCacheService.subscribeCollection('financial_transactions', (data) => {
      setTransactions(data as FinancialTransaction[]);
      saveToLocalStorageAsync('dmturismo_cached_transactions', data);
    });

    const unsubTrips = dbCacheService.subscribeTrips((data) => {
      setTrips(data as Trip[]);
      saveToLocalStorageAsync('dmturismo_cached_trips', data);
      setTripsLoading(false);
    });

    const unsubFinanceDocs = dbCacheService.subscribeCollection('finance_documents', (data) => {
      setFinanceDocs(data);
      saveToLocalStorageAsync('dmturismo_cached_finance_docs', data);
    });

    const unsubRoutes = dbCacheService.subscribeCollection('chartered_routes', (data) => {
      setCharteredRoutes(data);
      saveToLocalStorageAsync('dmturismo_cached_chartered_routes', data);
    });
    
    // Listen for role permissions
    const unsubPermissions = dbCacheService.subscribeDocument('settings/permissions', (data) => {
      if (data && data.roles) {
        setRolePermissions(data.roles);
      }
    });

    return () => {
      unsubVehicles();
      unsubFuel();
      unsubLogs();
      unsubEntries();
      unsubMaint();
      unsubStock();
      unsubStaff();
      unsubFinance();
      unsubFinanceDocs();
      unsubTrips();
      unsubRoutes();
      unsubPermissions();
    };
  }, [user]);

  const login = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const logout = useCallback(() => {
    signOut(auth);
    setEmployeeContext(null);
    localStorage.removeItem('dmturismo_cached_user');
    localStorage.removeItem('dmturismo_cached_profile');
    localStorage.removeItem('dmturismo_employee_context');
  }, []);

  const handleSaveVehicle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const newOdometer = Number(data.currentOdometer);

    if (selectedVehicle) {
      // Allow odometer corrections if they type a lower value
      if (newOdometer < selectedVehicle.currentOdometer) {
        toast.info(`Correção de odômetro: O valor do veículo de placa ${selectedVehicle.plate} será corrigido de ${selectedVehicle.currentOdometer.toLocaleString('pt-BR')} KM para ${newOdometer.toLocaleString('pt-BR')} KM.`);
      }
    }

    setConfirmSaveVehicleData(data);
  };

  const handleConfirmSaveVehicle = async () => {
    if (!confirmSaveVehicleData) return;
    setFormLoading(true);
    const data = confirmSaveVehicleData;
    const newOdometer = Number(data.currentOdometer);
    const nowIso = new Date().toISOString();

    try {
      let vehicleId = selectedVehicle?.id || '';
      const vehiclePayload = {
        plate: String(data.plate || '').toUpperCase(),
        prefix: String(data.prefix || '').trim().toUpperCase(),
        brand: String(data.brand || '').toUpperCase(),
        model: String(data.model || '').toUpperCase(),
        year: String(data.year || ''),
        color: String(data.color || '').toUpperCase(),
        renavam: String(data.renavam || ''),
        chassi: String(data.chassi || '').toUpperCase(),
        responsibleDriverId: String(data.responsibleDriverId || ''),
        responsibleDriverName: String(data.responsibleDriverName || ''),
        capacity: Number(data.capacity || 0),
        currentOdometer: newOdometer,
        type: String(data.type || 'bus'),
        factoryYear: String(data.factoryYear || ''),
        licenseExpiration: String(data.licenseExpiration || ''),
        spvatExpiration: String(data.spvatExpiration || ''),
        tourismLicenseExpiration: String(data.tourismLicenseExpiration || ''),
        cadasturExpiration: String(data.cadasturExpiration || ''),
        anttExpiration: String(data.anttExpiration || ''),
        mercosulLicenseExpiration: String(data.mercosulLicenseExpiration || ''),
        detroArtespExpiration: String(data.detroArtespExpiration || ''),
        sieExpiration: String(data.sieExpiration || data.detroArtespExpiration || ''),
        municipalLicenseExpiration: String(data.municipalLicenseExpiration || ''),
        tacografoExpiration: String(data.tacografoExpiration || ''),
        insuranceExpiration: String(data.insuranceExpiration || ''),
        featured: data.featured === 'on',
        nextOilChangeKM: data.nextOilChangeKM ? Number(data.nextOilChangeKM) : null,
        nextOilChangeDate: String(data.nextOilChangeDate || ''),
        nextTireRotationKM: data.nextTireRotationKM ? Number(data.nextTireRotationKM) : null,
        nextTireRotationDate: String(data.nextTireRotationDate || ''),
        nextPreventiveMaintenanceDate: String(data.nextPreventiveMaintenanceDate || ''),
        status: selectedVehicle?.status || 'available',
        updatedAt: nowIso
      };

      if (selectedVehicle) {
        await setDoc(doc(db, 'vehicles', selectedVehicle.id), cleanUndefined({
          ...selectedVehicle,
          ...vehiclePayload
        }), { merge: true });
        toast.success('Veículo atualizado com sucesso!');
      } else {
        const docRef = await addDoc(collection(db, 'vehicles'), cleanUndefined({
          ...vehiclePayload,
          createdAt: nowIso
        }));
        vehicleId = docRef.id;
        await auditService.log(user.uid, user.email!, 'CREATE', 'VEHICLE', docRef.id, `Veículo ${data.plate} cadastrado`);
        toast.success('Veículo cadastrado com sucesso!');
      }

      // Sync local state immediately to avoid lag
      const localVehicle = {
        id: vehicleId,
        ...vehiclePayload
      } as Vehicle;

      setVehicles(prev => {
        const filtered = prev.filter(v => v.id !== vehicleId);
        return [localVehicle, ...filtered];
      });
      await dbCacheService.saveVehicles([localVehicle, ...vehicles.filter(v => v.id !== vehicleId)]);

      setIsVehicleModalOpen(false);
      setSelectedVehicle(null);
      setConfirmSaveVehicleData(null);
    } catch (error) {
      toast.error('Erro ao salvar veículo');
      handleFirestoreError(error, OperationType.WRITE, 'vehicles');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteFuelLog = async (logId: string) => {
    try {
      await deleteDoc(doc(db, 'fuel_logs', logId));
      toast.success('Abastecimento excluído com sucesso');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'fuel_logs');
    }
  };

  const handleSaveFuel = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const vehicleId = data.vehicleId as string;
    const tankId = data.fuelTankId as string;
    const arlaTankId = data.arlaTankId as string;
    const arlaQuantity = Math.floor(Number(data.arlaQuantity || 0));
    const isExternal = data.isExternal === 'true';
    const location = data.location as string;
    const quantity = Math.floor(Number(data.quantity || 0));
    const odometer = Number(data.odometer || 0);
    
    // Calculate final cost
    const pricePerLiter = Number(data.pricePerLiter || 0);
    let finalCost = Number(data.cost || 0);
    if (finalCost === 0) {
      if (isExternal && pricePerLiter > 0 && quantity > 0) {
        finalCost = Number((pricePerLiter * quantity).toFixed(2));
      } else if (quantity > 0) {
        // Standard diesel price for internal refuel if no cost is set
        finalCost = Number((quantity * 5.90).toFixed(2));
      }
    }

    if (!vehicleId || (!isExternal && !tankId)) {
      toast.error(isExternal ? 'Selecione um veículo' : 'Selecione um veículo e um tanque de origem');
      return;
    }

    if (isNaN(quantity) || quantity < 0) {
      toast.error('Quantidade inválida');
      return;
    }

    if (!navigator.onLine) {
      offlineQueue.enqueue('fuel_log', { ...data, cost: finalCost });
      toast.info('Modo Offline: Registro de abastecimento enfileirado para sincronização automática!');
      setIsFuelModalOpen(false);
      setIsExternalFuelModalOpen(false);
      setPrefilledVehicleIdForFuel(null);
      return;
    }

    let vehiclePlate = 'S/D';

    try {
      await runTransaction(db, async (transaction) => {
        // 1. Get vehicle reference
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        const vehicleSnapshot = await transaction.get(vehicleRef);
        if (!vehicleSnapshot.exists()) throw new Error('Veículo não encontrado');
        const vehicle = vehicleSnapshot.data() as Vehicle;
        vehiclePlate = vehicle.plate || 'S/D';

        // 2. Get tank reference (only if internal AND quantity > 0)
        let tankSnapshot = null;
        let tankRef = null;
        if (!isExternal && quantity > 0) {
          tankRef = doc(db, 'fuel_tanks', tankId);
          tankSnapshot = await transaction.get(tankRef);
          if (!tankSnapshot.exists()) throw new Error('Tanque não encontrado');
          const tank = tankSnapshot.data() as FuelTank;

          if (tank.currentLevel < quantity) {
            throw new Error(`Saldo insuficiente no tanque (${tank.currentLevel}L disponível)`);
          }
        }

        // 3. Get Arla tank reference (if requested and internal) - MUST BE READ BEFORE ANY WRITES
        let arlaTankSnapshot = null;
        let arlaTankRef = null;
        if (!isExternal && arlaTankId && arlaQuantity > 0) {
          arlaTankRef = doc(db, 'fuel_tanks', arlaTankId);
          arlaTankSnapshot = await transaction.get(arlaTankRef);
          if (!arlaTankSnapshot.exists()) throw new Error('Tanque de Arla não encontrado');
        }

        // --- ALL READS MUST BE ABOVE THIS LINE ---

        // 4. Register Fuel Log
        const logRef = doc(collection(db, 'fuel_logs'));
        const timestampValue = data.timestamp ? new Date(data.timestamp as string).toISOString() : new Date().toISOString();
        delete data.timestamp;
        
        transaction.set(logRef, cleanUndefined({
          ...data,
          quantity,
          odometer,
          cost: finalCost,
          isExternal: isExternal || false,
          location: location || 'Interno',
          timestamp: timestampValue
        }));

        // 5. Update Tank Level (only if internal and quantity > 0)
        if (!isExternal && quantity > 0 && tankSnapshot && tankRef) {
          const tank = tankSnapshot.data() as FuelTank;
          transaction.update(tankRef, cleanUndefined({
            currentLevel: tank.currentLevel - quantity,
            updatedAt: new Date().toISOString()
          }));
        }

        // 6. Update Vehicle Odometer (ONLY IF HIGHER)
        const vehicleUpdates: any = {
           lastFuel: {
             timestamp: timestampValue,
             quantity: quantity,
             cost: finalCost
           },
           updatedAt: new Date().toISOString()
        };
        
        if (odometer > (vehicle.currentOdometer || 0)) {
           vehicleUpdates.currentOdometer = odometer;
        }
        transaction.update(vehicleRef, cleanUndefined(vehicleUpdates));

        // 7. Update Arla Tank Level (if requested and internal)
        if (!isExternal && arlaTankSnapshot && arlaTankRef && arlaQuantity > 0) {
          const arlaTank = arlaTankSnapshot.data() as FuelTank;
          if (arlaTank.currentLevel < arlaQuantity) {
            throw new Error(`Saldo insuficiente no tanque de Arla (${arlaTank.currentLevel}L disponível)`);
          }

          transaction.update(arlaTankRef, cleanUndefined({
            currentLevel: arlaTank.currentLevel - arlaQuantity,
            updatedAt: new Date().toISOString()
          }));
        }

        // 8. Generate corresponding paid Financial Transaction (Despesa / Conta a pagar)
        if (finalCost > 0) {
          const finRef = doc(collection(db, 'financial_transactions'));
          transaction.set(finRef, cleanUndefined({
            type: 'payable',
            category: 'COMBUSTÍVEL',
            description: `ABASTECIMENTO AUTOMÁTICO - PLACA: ${vehicle.plate || 'S/D'} (${quantity}L)${location ? ' - POSTO: ' + location : ''}`,
            amount: finalCost,
            dueDate: timestampValue ? timestampValue.slice(0, 10) : new Date().toISOString().slice(0, 10),
            status: 'paid', // Completed refueling logs are considered paid/settled
            createdAt: new Date().toISOString()
          }));
        }
      });

      // Refueling logs are no longer added to news_feed as requested by the user

      // Forçar atualização imediata do cache do estado local e global para que todos os usuários vejam em tempo real
      try {
        const [updatedLogsSnapshot, updatedVehiclesSnapshot] = await Promise.all([
          getDocs(query(collection(db, 'fuel_logs'), orderBy('timestamp', 'desc'), limit(100))),
          getDocs(collection(db, 'vehicles'))
        ]);
        
        const updatedLogs = updatedLogsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as FuelLog));
        setRecentFuelLogs(updatedLogs);
        saveToLocalStorageAsync('dmturismo_cached_fuel_logs', updatedLogs);

        const updatedVehicles = updatedVehiclesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
        setVehicles(updatedVehicles);
        saveToLocalStorageAsync('dmturismo_cached_vehicles', updatedVehicles);
        await dbCacheService.saveVehicles(updatedVehicles);
        
        // Tocar os metadados para forçar a invalidação de cache inteligente em outros clientes online
        await dbCacheService.touchTripsMetadata();
      } catch (cacheErr) {
        console.warn('Erro ao atualizar cache de estado local:', cacheErr);
      }

      toast.success('Abastecimento registrado com sucesso!');
      setIsFuelModalOpen(false);
      setIsExternalFuelModalOpen(false);
      setPrefilledVehicleIdForFuel(null);
    } catch (error: any) {
      const message = error.message.includes('insuficiente') || error.message.includes('Km informado') 
        ? error.message 
        : 'Erro ao registrar abastecimento';
      toast.error(message);
      if (!error.message.includes('insuficiente') && !error.message.includes('Km informado')) {
        handleFirestoreError(error, OperationType.WRITE, 'fuel_logs');
      }
    }
  };

  const handleSaveTank = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const nowIso = new Date().toISOString();

    try {
      const payload = {
        name: String(data.name || '').toUpperCase(),
        fuelType: String(data.fuelType || data.type || ''),
        capacity: Number(data.capacity || 0),
        currentLevel: Number(data.currentLevel || 0),
        updatedAt: nowIso
      };

      const docRef = await addDoc(collection(db, 'fuel_tanks'), cleanUndefined({
        ...payload,
        createdAt: nowIso
      }));

      const localTank = {
        id: docRef.id,
        ...payload
      } as FuelTank;

      // Update local state instantly
      setFuelTanks(prev => [localTank, ...prev]);

      toast.success('Tanque cadastrado com sucesso!');
      setIsTankModalOpen(false);
    } catch (error) {
      toast.error('Erro ao cadastrar tanque');
      handleFirestoreError(error, OperationType.WRITE, 'fuel_tanks');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveRefill = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormLoading(true);
    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());
    const tankId = data.tankId as string;
    const quantity = Number(data.quantity || 0);
    const cost = Number(data.cost || 0);
    const nowIso = new Date().toISOString();

    if (!tankId) {
      toast.error('Selecione um tanque para reabastecer');
      setFormLoading(false);
      return;
    }

    if (isNaN(quantity) || quantity <= 0) {
      toast.error('Quantidade inválida');
      setFormLoading(false);
      return;
    }

    try {
      let entryId = '';
      await runTransaction(db, async (transaction) => {
        const tankRef = doc(db, 'fuel_tanks', tankId);
        const tankSnapshot = await transaction.get(tankRef);
        if (!tankSnapshot.exists()) throw new Error('Tanque não encontrado');
        const tank = tankSnapshot.data() as FuelTank;

        // Update Tank
        transaction.update(tankRef, {
          currentLevel: tank.currentLevel + quantity,
          updatedAt: nowIso
        });

        // Record entry log
        const entryRef = doc(collection(db, 'fuel_entries'));
        entryId = entryRef.id;
        transaction.set(entryRef, {
          ...data,
          quantity,
          cost,
          timestamp: nowIso
        });
      });

      // Update local fuel entries instantly
      const localEntry = {
        id: entryId,
        ...data,
        quantity,
        cost,
        timestamp: nowIso
      } as FuelEntry;

      setFuelEntries(prev => [localEntry, ...prev]);

      // Update local fuel tanks state instantly
      setFuelTanks(prev => {
        return prev.map(t => {
          if (t.id === tankId) {
            return {
              ...t,
              currentLevel: t.currentLevel + quantity,
              updatedAt: nowIso
            };
          }
          return t;
        });
      });

      toast.success('Entrada de combustível registrada!');
      setIsRefillModalOpen(false);
    } catch (error) {
      toast.error('Erro ao registrar entrada');
      handleFirestoreError(error, OperationType.WRITE, 'fuel_entries');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSaveEmployee = async (data: any) => {
    // Determine the target ID and if we are updating or creating
    let targetId = selectedEmployee?.id;
    let isUpdate = !!selectedEmployee;
    let existingEmp = null;

    if (!isUpdate) {
      // Check if matching CPF, email, or exact name exists to avoid duplicate cards
      const existingByCpf = data.cpf && data.cpf.trim() 
        ? employees.find((e: any) => e.cpf && e.cpf.trim() && e.cpf.replace(/\D/g, '') === data.cpf.replace(/\D/g, ''))
        : null;
      
      const existingByEmail = !existingByCpf && data.email && data.email.trim()
        ? employees.find((e: any) => e.email && e.email.trim().toLowerCase() === data.email.trim().toLowerCase())
        : null;
        
      const existingByName = !existingByCpf && !existingByEmail && data.name && data.name.trim()
        ? employees.find((e: any) => e.name && e.name.trim().toLowerCase() === data.name.trim().toLowerCase())
        : null;

      existingEmp = existingByCpf || existingByEmail || existingByName;
      if (existingEmp) {
        targetId = existingEmp.id;
        isUpdate = true;
      }
    }

    // Generate ID if it's a completely new employee
    if (!targetId) {
      targetId = doc(collection(db, 'employees')).id;
    }

    const nowIso = new Date().toISOString();
    const preparedEmp = isUpdate 
      ? { ...(selectedEmployee || existingEmp), ...data, updatedAt: nowIso }
      : { id: targetId, ...data, createdAt: nowIso, updatedAt: nowIso };

    // Compute next employees list
    let nextEmployees;
    if (isUpdate) {
      nextEmployees = employees.map(e => e.id === targetId ? preparedEmp : e);
    } else {
      nextEmployees = [...employees, preparedEmp];
    }

    // FIREBASE OPERATION: Save the document to Firestore
    try {
      setFormLoading(true);
      // Save the document to Firestore
      await setDoc(doc(db, 'employees', targetId), cleanUndefined(preparedEmp));

      // Automatically sync role and permissions to matching user account to instantly release access
      if (data.email?.trim()) {
        try {
          const userEmail = data.email.trim().toLowerCase();
          const usersRef = collection(db, 'users');
          const q = query(usersRef, where('email', '==', userEmail));
          const querySnapshot = await getDocs(q);
          for (const userDoc of querySnapshot.docs) {
            await updateDoc(doc(db, 'users', userDoc.id), cleanUndefined({
              role: data.role,
              permissions: data.permissions || []
            }));
          }
        } catch (syncErr) {
          console.error('Error auto-syncing user permissions:', syncErr);
        }
      }

      // Log audit trail
      await auditService.log(
        user?.uid || 'system', 
        user?.email || 'system', 
        isUpdate ? 'UPDATE' : 'CREATE', 
        'EMPLOYEE', 
        targetId, 
        isUpdate ? `Ficha do funcionário ${data.name} atualizada` : `Funcionário ${data.name} cadastrado`
      );

      // OPTIMISTIC UPDATE: Set React state and update both local caches instantly
      setEmployees(nextEmployees);
      saveToLocalStorageAsync('dmturismo_cached_employees', nextEmployees);
      dbCacheService.saveEmployees(nextEmployees).catch(err => console.error('[IndexedDB Cache] Error saving employees:', err));

      // Show success feedback
      toast.success(isUpdate ? 'Funcionário salvo com sucesso!' : 'Funcionário cadastrado com sucesso!');

      // Trigger WhatsApp Invitation if phone is provided
      if (data.phone) {
        const appUrl = window.location.origin;
        const shareUrl = `${appUrl}/?emp=${targetId}`;
        
        let permissionText = "Permissões padrão de " + (data.role || "Funcionário");
        if (data.permissions && data.permissions.length > 0) {
          const labels: Record<string, string> = {
            dashboard: "Painel",
            trips: "Trabalhos",
            fleet: "Gestão de Frotas",
            finance: "Financeiros",
            fuel: "Abastecimento",
            inventory: "Almoxarifado",
            gabinete: "Gabinete"
          };
          permissionText = data.permissions.map((p: string) => labels[p] || p).join(", ");
        }

        const message = isUpdate
          ? `🚀 *DM TURISMO PRO - ACESSO ATUALIZADO*%0A%0AOlá *${data.name}*! 👋%0A%0AO seu perfil e as permissões no sistema foram atualizados e estão pré-estabelecidos.%0A%0A💼 *CARGO:* ${data.role}%0A🔑 *AUTORIZAÇÕES:* ${permissionText}%0A%0A🔗 *SEU LINK EXCLUSIVO:*%0A${shareUrl}%0A%0A_DM Turismo - prazer em viajar bem_`
          : `🚀 *DM TURISMO PRO - TERMINAL DE OPERAÇÕES*%0A%0AOlá *${data.name}*! 👋%0A%0AO seu acesso personalizado para o aplicativo da DM Turismo foi pré-estabelecido com as suas credenciais e permissões.%0A%0A💼 *CARGO:* ${data.role}%0A🔑 *AUTORIZAÇÕES:* ${permissionText}%0A%0A🔗 *SEU LINK EXCLUSIVO:*%0A${shareUrl}%0A%0A*COMO INSTALAR / UTILIZAR:*%0A1. Abra o link acima no seu smartphone.%0A2. No menu do navegador, clique p em "Adicionar à Tela de Início" (para obter o ícone de Aplicativo PWA).%0A3. Todo o seu painel de relatórios, escalas de trabalho e jornadas estará acessível sem necessidade de novas configurações!%0A%0A_DM Turismo - prazer em viajar bem_`;

        const cleanPhone = data.phone.replace(/\D/g, '');
        const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
        const whatsappUrl = `https://wa.me/${formattedPhone}?text=${message}`;
        
        setTimeout(() => {
          if (window.confirm("Deseja enviar o link de acesso para o colaborador via WhatsApp?")) {
            window.open(whatsappUrl, '_blank');
          }
        }, 300);
      }

      // Close modal and reset selected employee
      setIsEmployeeModalOpen(false);
      setSelectedEmployee(null);
      setConfirmSaveEmployeeData(null);

    } catch (err) {
      console.error('Firestore Employee Sync Error:', err);
      toast.error('Erro ao salvar no banco de dados. Verifique sua conexão.');
      handleFirestoreError(err, OperationType.WRITE, 'employees');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteEmployee = async (id: string, name: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Excluir Funcionário',
      message: `Tem certeza que deseja remover ${name} do sistema? Esta ação é irreversível e removerá todos os acessos vinculados.`,
      onConfirm: async () => {
        setFormLoading(true);
        try {
          // Execute Firebase delete
          await deleteDoc(doc(db, 'employees', id));
          await auditService.log(user?.uid || 'system', user?.email || 'system', 'DELETE', 'EMPLOYEE', id, `Colaborador: ${name} excluído`);

          // Optimistically update state and cache immediately after Firestore success
          const nextEmployees = employees.filter(e => e.id !== id);
          setEmployees(nextEmployees);
          saveToLocalStorageAsync('dmturismo_cached_employees', nextEmployees);
          dbCacheService.saveEmployees(nextEmployees).catch(err => console.error(err));

          toast.success("Funcionário excluído com sucesso");
          setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          console.error('Error deleting employee:', error);
          toast.error('Erro ao excluir funcionário do banco de dados.');
          handleFirestoreError(error, OperationType.DELETE, 'employees');
        } finally {
          setFormLoading(false);
        }
      }
    });
  };

  const handleSaveMaintenance = async (data: any) => {
    setFormLoading(true);
    const vehicleId = data.vehicleId;
    const cost = Number(data.cost || 0);
    const odometer = Number(data.odometer || 0);
    const nowIso = new Date().toISOString();

    try {
      let logId = data.id || '';
      await runTransaction(db, async (transaction) => {
        const vehicleRef = doc(db, 'vehicles', vehicleId);
        const vehicleSnapshot = await transaction.get(vehicleRef);
        if (!vehicleSnapshot.exists()) throw new Error('Veículo não encontrado');

        // Create or Update log
        const logRef = data.id ? doc(db, 'maintenance_logs', data.id) : doc(collection(db, 'maintenance_logs'));
        logId = logRef.id;
        transaction.set(logRef, cleanUndefined({
          ...data,
          cost,
          odometer,
          vehicleId, // Ensure vehicleId is saved
          updatedAt: nowIso,
          createdAt: data.createdAt || nowIso
        }), { merge: true });

        // Update vehicle maintenance stats
        transaction.update(vehicleRef, cleanUndefined({
          lastMaintenanceDate: data.completedAt,
          lastMaintenanceKM: odometer,
          nextOilChangeKM: data.checklist?.oilChanged ? (odometer + 10000) : ((vehicleSnapshot.data() as Vehicle).nextOilChangeKM || null),
          nextPreventiveMaintenanceDate: data.nextPreventiveMaintenanceDate || null,
          nextMaintenanceKM: Number(data.nextMaintenanceKM) || null,
          updatedAt: nowIso
        }));
      });

      // Update maintenance local state immediately to avoid desync
      const localMaintenance = {
        id: logId,
        ...data,
        cost,
        odometer,
        vehicleId,
        createdAt: data.createdAt || nowIso,
        updatedAt: nowIso
      } as MaintenanceLog;

      setMaintenance(prev => {
        const filtered = prev.filter(m => m.id !== logId);
        return [localMaintenance, ...filtered];
      });

      // Update vehicles state locally as well for the specific vehicle!
      setVehicles(prev => {
        return prev.map(v => {
          if (v.id === vehicleId) {
            return {
              ...v,
              lastMaintenanceDate: data.completedAt,
              lastMaintenanceKM: odometer,
              nextOilChangeKM: data.checklist?.oilChanged ? (odometer + 10000) : (v.nextOilChangeKM || null),
              nextPreventiveMaintenanceDate: data.nextPreventiveMaintenanceDate || null,
              nextMaintenanceKM: Number(data.nextMaintenanceKM) || null,
              updatedAt: nowIso
            };
          }
          return v;
        });
      });

      toast.success('Manutenção registrada com sucesso!');
      setIsMaintenanceModalOpen(false);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao registrar manutenção');
      handleFirestoreError(error, OperationType.WRITE, 'maintenance_logs');
    } finally {
      setFormLoading(false);
    }
  };

  const handlePrintOS = (log: MaintenanceLog) => {
    setSelectedMaintenance(log);
    setIsMaintenanceRelatorioOpen(true);
  };

  const handlePrintBatchOS = useCallback(async (scope: 'week' | 'month') => {
    const today = startOfToday();
    const batchLogs = maintenance.filter(log => {
      const logDate = parseISO(log.completedAt || log.createdAt);
      return scope === 'week' 
        ? isSameWeek(logDate, today, { weekStartsOn: 0 }) 
        : isSameMonth(logDate, today);
    });

    if (batchLogs.length === 0) {
      toast.info(`Nenhuma Ordem de Serviço encontrada para ${scope === 'week' ? 'esta semana' : 'este mês'}.`);
      return;
    }

    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const doc = new jsPDF();
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    batchLogs.forEach((log, index) => {
      if (index > 0) doc.addPage();
      
      const vehicle = vehicles.find(v => v.id === log.vehicleId);
      let currentY = 25;

      // Header Section
      doc.setFillColor(245, 245, 245);
      doc.rect(0, 0, pageWidth, 45, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(30, 30, 30);
      doc.text("DM TURISMO", margin, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text("ORDEM DE SERVIÇO DE MANUTENÇÃO", margin, 35);
      
      doc.setFontSize(14);
      doc.setTextColor(26, 80, 241); // brand-accent hex approximation
      doc.text(`#${log.id?.substring(0, 8).toUpperCase() || 'NOVO'}`, pageWidth - margin - 40, 25);

      currentY = 60;

      // Vehicle Info Box
      doc.setDrawColor(230, 230, 230);
      doc.setLineWidth(0.5);
      doc.rect(margin, currentY, pageWidth - (2 * margin), 35);
      
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("DADOS DO VEÍCULO", margin + 5, currentY + 7);
      
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(`PLACA: ${vehicle?.plate || 'N/A'}`, margin + 5, currentY + 18);
      doc.text(`MODELO: ${vehicle?.model || 'N/A'}`, margin + 5, currentY + 28);
      doc.text(`KM ATUAL: ${log.odometer?.toLocaleString() || 'N/A'} KM`, pageWidth / 2, currentY + 18);
      doc.text(`TIPO: ${vehicle?.type?.toUpperCase() || 'N/A'}`, pageWidth / 2, currentY + 28);

      currentY += 45;

      // Service Details
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("DESCRIÇÃO DO SERVIÇO", margin, currentY);
      
      currentY += 8;
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.setFont("helvetica", "bold");
      doc.text(log.type === 'preventive' ? 'MANUTENÇÃO PREVENTIVA' : 'MANUTENÇÃO CORRETIVA', margin, currentY);
      
      currentY += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const splitDesc = doc.splitTextToSize(log.description || "Sem descrição detalhada.", pageWidth - (2 * margin));
      doc.text(splitDesc, margin, currentY);
      
      currentY += (splitDesc.length * 6) + 15;

      // Checklist section if exists
      if (log.checklist) {
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.text("CHECKLIST TÉCNICO", margin, currentY);
          currentY += 8;

          const activeChecks = Object.entries(log.checklist)
            .filter(([k, v]) => v === true && k !== 'others')
            .map(([k]) => {
                const labels: any = {
                    oilChanged: 'Troca de Óleo',
                    filtersChanged: 'Filtros',
                    frontPadsChanged: 'Pastilha Dianteira',
                    rearPadsChanged: 'Pastilha Traseira',
                    frontDiscsChanged: 'Disco Dianteiro',
                    rearDiscsChanged: 'Disco Traseira',
                    airConditioning: 'Ar Condicionado',
                    tires: 'Pneus',
                    suspension: 'Suspensão',
                    transmission: 'Transmissão'
                };
                return labels[k] || k;
            });

          if (activeChecks.length > 0) {
              const checkText = activeChecks.join(' | ');
              const splitChecks = doc.splitTextToSize(checkText, pageWidth - (2 * margin));
              doc.setTextColor(60, 60, 60);
              doc.text(splitChecks, margin, currentY);
              currentY += (splitChecks.length * 5) + 15;
          } else {
              currentY += 5;
          }
      }

      // Financials
      doc.setDrawColor(240, 240, 240);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 10;
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`VALOR TOTAL: R$ ${log.cost?.toLocaleString() || '0,00'}`, margin, currentY);
      doc.text(`DATA: ${format(parseISO(log.completedAt || log.createdAt), "dd/MM/yyyy")}`, pageWidth - margin - 40, currentY);

      // Signatures at bottom
      const footerY = pageHeight - 40;
      doc.line(margin, footerY, margin + 60, footerY);
      doc.line(pageWidth - margin - 60, footerY, pageWidth - margin, footerY);
      
      doc.setFontSize(8);
      doc.text("ASSINATURA RESPONSÁVEL", margin + 10, footerY + 5);
      doc.text("ASSINATURA MOTORISTA", pageWidth - margin - 50, footerY + 5);
    });

    doc.save(`ORDENS_SERVICO_${scope.toUpperCase()}_${format(new Date(), "ddMMyyyy")}.pdf`);
    toast.success(`PDF de OS ${scope === 'week' ? 'semanal' : 'mensal'} gerado com sucesso!`);
  }, [maintenance, vehicles]);
  
  const handleDeleteMaintenance = async (id: string) => {
    if (!id) return;
    try {
      setMaintenance(prev => prev.filter(m => m.id !== id));
      await dbCacheService.removeDocumentFromCollection('maintenance_logs', id);
      await deleteDoc(doc(db, 'maintenance_logs', id));
      toast.success('Registro de manutenção / O.S. excluído com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `maintenance_logs/${id}`);
    }
  };

  const handleFinancialSubmit = async (data: any) => {
    setFormLoading(true);
    const nowIso = new Date().toISOString();
    try {
      if (!navigator.onLine) {
        offlineQueue.enqueue('financial_transaction', data);
        toast.info('Modo Offline: Lançamento enfileirado para sincronização automática!');
        setIsFinancialModalOpen(false);
        return;
      }

      let localTransactions: FinancialTransaction[] = [];

      const propagatePayable = async (item: any) => {
        if (item.type !== 'payable' || !item.specializedFields) return;
        const { subType } = item.specializedFields;
        
        if (subType === 'fleet_maintenance' && item.specializedFields.vehicleId) {
          try {
            const maintenanceData = {
              vehicleId: item.specializedFields.vehicleId,
              description: `SERVIÇO DE MANUTENÇÃO: ${String(item.specializedFields.replacedParts || 'MANUTENÇÃO REGISTRADA VIA FINANCEIRO').toUpperCase()}`,
              type: item.specializedFields.maintenanceType || 'corrective',
              scheduledDate: item.dueDate,
              completedAt: item.dueDate,
              cost: Number(item.amount) || 0,
              mechanic: String(item.specializedFields.mechanicName || item.supplier || 'N/A').toUpperCase(),
              status: 'completed',
              createdAt: nowIso,
              updatedAt: nowIso
            };
            const maintDoc = await addDoc(collection(db, 'maintenance_logs'), cleanUndefined(maintenanceData));

            // Update local maintenance state instantly
            setMaintenance(prev => [{ id: maintDoc.id, ...maintenanceData } as MaintenanceLog, ...prev]);

            // Atualiza estatísticas do veículo correspondente
            const vehicleRef = doc(db, 'vehicles', item.specializedFields.vehicleId);
            await updateDoc(vehicleRef, cleanUndefined({
              lastMaintenanceDate: item.dueDate,
              updatedAt: nowIso
            }));

            // Update local vehicles state instantly
            setVehicles(prev => prev.map(v => {
              if (v.id === item.specializedFields.vehicleId) {
                return { ...v, lastMaintenanceDate: item.dueDate, updatedAt: nowIso };
              }
              return v;
            }));
          } catch (err) {
            console.error('Erro ao propagar manutenção de frota:', err);
          }
        } else if (subType === 'industrial_stock' && item.specializedFields.stockPartName) {
          try {
            const stockItemsRef = collection(db, 'stock_items');
            const snapshot = await getDocs(stockItemsRef);
            const partNameClean = String(item.specializedFields.stockPartName).toUpperCase();
            
            let stockItem = snapshot.docs.find(d => String(d.data().name || '').toUpperCase() === partNameClean);
            let stockItemId = '';
            
            const addedQty = Number(item.specializedFields.stockQuantity) || 0;
            let finalStockItem: any = null;
            
            if (stockItem) {
              stockItemId = stockItem.id;
              const currentQty = Number(stockItem.data().quantity) || 0;
              const updatePayload = {
                quantity: currentQty + addedQty,
                updatedAt: nowIso
              };
              await updateDoc(doc(db, 'stock_items', stockItem.id), cleanUndefined(updatePayload));

              finalStockItem = {
                id: stockItemId,
                ...stockItem.data(),
                ...updatePayload
              };
            } else {
              const newPayload = {
                name: partNameClean,
                category: 'PEÇAS / ESTOQUE',
                quantity: addedQty,
                unit: 'UN',
                minQuantity: 5,
                createdAt: nowIso,
                updatedAt: nowIso
              };
              const newStockDoc = await addDoc(collection(db, 'stock_items'), cleanUndefined(newPayload));
              stockItemId = newStockDoc.id;
              finalStockItem = { id: stockItemId, ...newPayload };
            }

            // Update local stock state instantly
            setStock(prev => {
              const filtered = prev.filter(s => s.id !== stockItemId);
              return [finalStockItem, ...filtered];
            });

            await addDoc(collection(db, 'stock_transactions'), cleanUndefined({
              itemId: stockItemId,
              itemName: partNameClean,
              category: 'PEÇAS / ESTOQUE',
              type: 'ENTRADA',
              quantity: addedQty,
              unit: 'UN',
              employeeId: 'SISTEMA',
              employeeName: 'COMPRA FINANCEIRA',
              justification: `COMPRA DE MATERIAL LANÇADA NO CONTAS A PAGAR. FORNECEDOR: ${String(item.supplier || 'N/A').toUpperCase()}`,
              timestamp: nowIso
            }));
          } catch (err) {
            console.error('Erro ao propagar estoque industrial:', err);
          }
        }
      };

      if (Array.isArray(data)) {
        for (const item of data) {
          const docRef = await addDoc(collection(db, 'financial_transactions'), cleanUndefined({
            ...item,
            createdAt: nowIso
          }));
          localTransactions.push({
            id: docRef.id,
            ...item,
            createdAt: nowIso
          } as FinancialTransaction);
          await propagatePayable(item);
        }
      } else {
        const docRef = await addDoc(collection(db, 'financial_transactions'), cleanUndefined({
          ...data,
          createdAt: nowIso
        }));
        localTransactions.push({
          id: docRef.id,
          ...data,
          createdAt: nowIso
        } as FinancialTransaction);
        await propagatePayable(data);
      }

      // Update local financial transactions state instantly!
      setTransactions(prev => [...localTransactions, ...prev]);

      toast.success('Lançamento realizado com sucesso!');
      setIsFinancialModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_transactions');
    } finally {
      setFormLoading(false);
    }
  };

  const handleSmartExtractFromModal = async (trip: Trip, attachment: any) => {
    if (attachment.type !== 'image' && attachment.type !== 'pdf') {
      toast.error("Formato não suportado para extração automática.");
      return;
    }

    setIsProcessingModalAttachment(attachment.name);
    try {
      const [header, base64Data] = attachment.url.split(',');
      const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';

      const extractedData = await geminiService.extractPassengers(base64Data, mimeType);

      if (extractedData && Array.isArray(extractedData)) {
        const newPassengers = extractedData.map((p: any) => ({
          name: String(p.name || '').toUpperCase(),
          document: String(p.document || 'S/D').toUpperCase()
        }));

        const updatedTrip = {
          ...trip,
          passengers: [...(trip.passengers || []), ...newPassengers],
          passengerCount: (trip.passengers?.length || 0) + newPassengers.length
        };

        await handleSaveTrip(updatedTrip);
        toast.success(`${newPassengers.length} passageiros adicionados à viagem!`);
      }
    } catch (error) {
      console.error("Modal AI Extraction Error:", error);
      toast.error("Erro ao processar arquivo.");
    } finally {
      setIsProcessingModalAttachment(null);
    }
  };

  const handleDeleteTrip = useCallback((trip: Trip) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Excluir Viagem',
      message: `Tem certeza que deseja excluir permanentemente a viagem "${trip.title}"? Todos os registros financeiros vinculados também serão removidos.`,
      onConfirm: async () => {
        try {
          setFormLoading(true);
          const tripRef = doc(db, 'trips', trip.id);
          await deleteDoc(tripRef);

          const linkedTransactions = transactions.filter(t => t.refId === trip.id && t.refType === 'trip');
          for (const t of linkedTransactions) {
            await deleteDoc(doc(db, 'financial_transactions', t.id));
          }

          // Update local state in real-time and notify subscribers immediately
          setTrips(prev => {
            const nextTrips = prev.filter(t => t.id !== trip.id);
            dbCacheService.saveTripsAndNotify(nextTrips).catch(err => console.error(err));
            return nextTrips;
          });

          await dbCacheService.touchTripsMetadata();
          await auditService.log(user!.uid, user!.email!, 'DELETE', 'TRIP', trip.id, `Viagem ${trip.title} excluída`);
          toast.success("Viagem Excluída", {
            description: "A viagem e seus registros vinculados foram removidos."
          });
          setIsOSModalOpen(false);
          setIsTripModalOpen(false);
          setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `trips/${trip.id}`);
        } finally {
          setFormLoading(false);
        }
      }
    });
  }, [transactions, user]);

  const handleDeleteVehicle = async (vehicleId: string, plate: string) => {
    setDeleteConfirm({
      isOpen: true,
      title: 'Excluir Veículo',
      message: `Tem certeza que deseja remover o veículo ${plate} da frota? Todos os históricos de manutenção e combustível vinculados serão perdidos permanentemente.`,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'vehicles', vehicleId));
          await auditService.log(user?.uid || 'system', user?.email || 'system', 'DELETE', 'VEHICLE', vehicleId, `Veículo ${plate} excluído`);
          toast.success("Veículo excluído");
          setIsDetailModalOpen(false);
          setSelectedVehicle(null);
          setDeleteConfirm(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, 'vehicles');
        }
      }
    });
  };

  const handleSaveTrip = useCallback(async (data: any) => {
    setFormLoading(true);
    try {
      const nowStr = new Date().toISOString();
      let tripId = '';
      const isNew = !selectedTrip;
      
      let tripStatus = data.status || 'scheduled';
      
      const startDateTime = data.startDate ? new Date(data.startDate).getTime() : 0;
      const endDateTime = data.endDate ? new Date(data.endDate).getTime() : 0;
      const currentDateTime = new Date().getTime();

      // If either start date or end date is in the past, force status to completed (FIM) unless cancelled
      if ((data.endDate && endDateTime < currentDateTime) || (data.startDate && startDateTime < currentDateTime)) {
        if (tripStatus !== 'cancelled') {
          tripStatus = 'completed';
        }
      }

      // Ensure the "Ficha de Serviço" and "Ficha da O.S. (Sistema)" are automatically created and saved as attachments for any trip status (new, scheduled, completed, saved)
      let updatedAttachments = [...(data.attachments || [])];
      
      const hasFichaOS = updatedAttachments.some(att => att.name === "Ficha da O.S. (Sistema)");
      if (!hasFichaOS) {
        updatedAttachments.push({
          name: "Ficha da O.S. (Sistema)",
          type: "pdf",
          url: "view-os"
        });
      }

      const hasFichaServico = updatedAttachments.some(att => att.name === "Ficha de Serviço");
      if (!hasFichaServico) {
        updatedAttachments.push({
          name: "Ficha de Serviço",
          type: "pdf",
          url: "view-os"
        });
      }

      const finalTripData = {
        ...data,
        status: tripStatus,
        attachments: updatedAttachments
      };
      
      if (selectedTrip && selectedTrip.id) {
        // Update existing trip
        tripId = selectedTrip.id;
        const tripRef = doc(db, 'trips', selectedTrip.id);
        await setDoc(tripRef, cleanUndefined({
          ...finalTripData,
          updatedAt: nowStr
        }), { merge: true });
        toast.success("Viagem Atualizada", {
          description: `Alterações em "${finalTripData.title}" salvas com sucesso.`
        });
      } else {
        // Create new trip
        const docRef = await addDoc(collection(db, 'trips'), cleanUndefined({
          ...finalTripData,
          createdAt: nowStr,
          updatedAt: nowStr
        }));
        tripId = docRef.id;

        const isCompletedLaunch = (selectedTrip as any)?.isCompletedLaunch || (finalTripData.status === 'completed' && !selectedTrip?.id);

        if (isCompletedLaunch) {
          await auditService.log(
            user.uid,
            user.email!,
            'CREATE',
            'TRIP',
            docRef.id,
            `Viagem realizada ${finalTripData.title} registrada diretamente no histórico de trabalhos e financeiro`
          );
          toast.success("Viagem Realizada Registrada", {
            description: `A viagem "${finalTripData.title}" foi salva com sucesso no histórico de trabalhos e financeiro.`
          });
        } else {
          await auditService.log(user.uid, user.email!, 'CREATE', 'TRIP', docRef.id, `Viagem ${finalTripData.title} agendada`);
          toast.success("Viagem Cadastrada", {
            description: `Operação "${finalTripData.title}" agendada com sucesso.`
          });
        }
      }

      // Update the local state in real-time immediately to distribute the information to fields and tools instantly
      const updatedLocalTrip = {
        id: tripId,
        ...finalTripData,
        createdAt: (selectedTrip && selectedTrip.id) ? selectedTrip.createdAt : nowStr,
        updatedAt: nowStr
      };

      setTrips(prev => {
        const nextTrips = [updatedLocalTrip, ...prev.filter(t => t.id !== tripId)];
        dbCacheService.saveTripsAndNotify(nextTrips).catch(err => console.error(err));
        return nextTrips;
      });

      // Sync financial values to financial_transactions
      const hasTripValue = finalTripData.tripValue !== undefined && finalTripData.tripValue !== '';
      const shouldSyncFinance = hasTripValue || tripStatus === 'completed';

      if (shouldSyncFinance) {
        const tripValueNum = hasTripValue ? Number(finalTripData.tripValue) : 0;
        const paymentStatus = finalTripData.paymentStatus || 'A Receber';
        const transactionData = {
          type: 'receivable' as const,
          category: 'Viagem',
          description: `RECEITA DE VIAGEM - ${finalTripData.title} (OS: ${finalTripData.osNumber || '---'})`,
          supplier: finalTripData.client || 'Avulso',
          amount: isNaN(tripValueNum) ? 0 : tripValueNum,
          dueDate: finalTripData.startDate ? finalTripData.startDate.split('T')[0] : new Date().toISOString().split('T')[0],
          status: (paymentStatus === 'Pago' ? 'paid' : 'pending') as 'paid' | 'pending',
          refId: tripId,
          refType: 'trip' as const,
          createdAt: nowStr,
          updatedAt: nowStr
        };

        const txQuery = query(
          collection(db, 'financial_transactions'), 
          where('refId', '==', tripId),
          where('refType', '==', 'trip')
        );
        const txSnap = await getDocs(txQuery);
        let txId = '';
        if (!txSnap.empty) {
          const txDoc = txSnap.docs[0];
          txId = txDoc.id;
          await setDoc(doc(db, 'financial_transactions', txDoc.id), cleanUndefined(transactionData), { merge: true });
        } else {
          const txDocRef = await addDoc(collection(db, 'financial_transactions'), cleanUndefined(transactionData));
          txId = txDocRef.id;
        }

        // Update local transactions state immediately to distribute financial info
        const updatedLocalTx = {
          id: txId || `local-tx-${tripId}`,
          ...transactionData
        };
        setTransactions(prev => {
          const filtered = prev.filter(tx => !(tx.refId === tripId && tx.refType === 'trip'));
          return [updatedLocalTx, ...filtered];
        });
      }

      await dbCacheService.touchTripsMetadata();
      setIsTripModalOpen(false);
      setSelectedTrip(null);
      if (isNew) {
        navigate('/trips');
      }
    } catch (error) {
      handleFirestoreError(error, selectedTrip ? OperationType.WRITE : OperationType.CREATE, 'trips');
    } finally {
      setFormLoading(false);
    }
  }, [selectedTrip, user]);

  const handleUpdateFinanceStatus = async (id: string, status: 'paid' | 'pending') => {
    try {
      await setDoc(doc(db, 'financial_transactions', id), cleanUndefined({ 
        status,
        paymentDate: status === 'paid' ? new Date().toISOString().split('T')[0] : null
      }), { merge: true });
      toast.success('Status atualizado!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'financial_transactions');
    }
  };

  const openFinancialModal = (type: 'payable' | 'receivable') => {
    setFinancialType(type);
    setIsFinancialModalOpen(true);
  };

  const openAddVehicle = () => {
    setSelectedVehicle(null);
    setIsVehicleModalOpen(true);
  };

  const openVehicleDetails = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsDetailModalOpen(true);
  };

  const openEditFromDetail = () => {
    setIsDetailModalOpen(false);
    setIsVehicleModalOpen(true);
  };

  const openEditVehicle = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setIsVehicleModalOpen(true);
  };

  const handleShareReport = async (reportTitle: string) => {
    const reportUrl = `${window.location.origin}/#gabinete/${reportTitle.toLowerCase()}`;
    const shareData = {
      title: `Gabinete DM Turismo: ${reportTitle}`,
      text: `Confira o dossiê de ${reportTitle.toLowerCase()} da DM Turismo.`,
      url: reportUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(reportUrl);
        toast.success(`Link do relatório de ${reportTitle} copiado!`);
      } catch (clipErr) {
        console.error('Clipboard share failed:', clipErr);
        toast.error('Erro ao compartilhar relatório.');
      }
    }
  };

  // Derived Memoized States
  const vehicleVencimentos = useMemo(() => {
    return vehicles.flatMap(v => [
      { 
        id: `${v.id}-lic`, 
        plate: v.plate, 
        label: 'Licenciamento', 
        date: v.licenseExpiration,
        icon: 'DETRAN'
      },
      { 
        id: `${v.id}-tour`, 
        plate: v.plate, 
        label: 'ANTT/Turismo', 
        date: v.tourismLicenseExpiration,
        icon: 'ANTT'
      },
      { 
        id: `${v.id}-antt`, 
        plate: v.plate, 
        label: 'ANTT Interestadual', 
        date: v.anttExpiration,
        icon: 'ANTT'
      },
      { 
        id: `${v.id}-cadastur`, 
        plate: v.plate, 
        label: 'CADASTUR', 
        date: v.cadasturExpiration,
        icon: 'MTUR'
      },
      { 
        id: `${v.id}-state`, 
        plate: v.plate, 
        label: 'Estadual (D/A)', 
        date: v.detroArtespExpiration,
        icon: 'EST'
      },
      { 
        id: `${v.id}-mun`, 
        plate: v.plate, 
        label: 'Lic. Municipal', 
        date: v.municipalLicenseExpiration,
        icon: 'MUN'
      },
      { 
        id: `${v.id}-taco`, 
        plate: v.plate, 
        label: 'Cronotacógrafo', 
        date: v.tacografoExpiration,
        icon: 'INM'
      },
      { 
        id: `${v.id}-ins`, 
        plate: v.plate, 
        label: 'Seguro APP', 
        date: v.insuranceExpiration,
        icon: 'SEG'
      }
    ]).filter(item => !!item.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
  }, [vehicles]);

  const driverVencimentos = useMemo(() => {
    return employees.filter(e => e.licenseExpiration).sort((a, b) => new Date(a.licenseExpiration!).getTime() - new Date(b.licenseExpiration!).getTime());
  }, [employees]);

  const filteredTrips = useMemo(() => {
    return trips.filter(t => {
      const matchesSearch = !tripSearch || 
        t.title.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.origin.toLowerCase().includes(tripSearch.toLowerCase()) ||
        t.destination.toLowerCase().includes(tripSearch.toLowerCase());
      
      const matchesStatus = tripStatusFilter === 'all' || t.status === tripStatusFilter;
      const matchesType = tripTypeFilter === 'all' || t.type === tripTypeFilter;
      
      let matchesDate = true;
      if (tripDateStart) {
        matchesDate = matchesDate && isAfter(parseISO(t.startDate), addDays(parseISO(tripDateStart), -1));
      }
      if (tripDateEnd) {
        matchesDate = matchesDate && isBefore(parseISO(t.startDate), addDays(parseISO(tripDateEnd), 1));
      }
      
      return matchesSearch && matchesStatus && matchesType && matchesDate;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [trips, tripSearch, tripStatusFilter, tripTypeFilter, tripDateStart, tripDateEnd]);

  const handleOpenAddVehicle = useCallback(() => {
    setSelectedVehicle(null);
    setIsVehicleModalOpen(true);
  }, []);

  const handleVehicleClick = useCallback((v: Vehicle) => {
    setSelectedVehicle(v);
    setIsDetailModalOpen(true);
  }, []);

  if (loading) return <SplashScreen />;

  if (!user && !employeeContext) {
    return (
      <Login 
        onSuccess={() => navigate('/dashboard')} 
        onEmployeeLogin={(emp) => {
          setEmployeeContext(emp);
          handleNavigate('journey');
          toast.success(`Terminal Operacional: ${emp.name}`, {
            description: "Acesso direto autorizado. Suas escalas e jornadas estão prontas para acesso.",
            icon: <Users size={16} />
          });
        }}
      />
    );
  }

  if (effectiveProfile?.role === 'Aguardando Liberação' || effectiveProfile?.role === 'Pendente de Liberação') {
    const handleSelectPendingRole = async (newRole: UserProfile['role']) => {
      setSelectedPendingDesiredRole(newRole);
      if (user) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            requestedRole: newRole
          });
          toast.success(`Cargo pretendido atualizado para ${newRole}!`);
        } catch (err) {
          console.error("Erro ao atualizar cargo pretendido:", err);
        }
      }
    };

    const handleRequestAccess = () => {
      const appUrl = window.location.origin;
      const email = effectiveProfile.email;
      const role = selectedPendingDesiredRole;
      
      const message = `Olá Elizeu Ferron, acabo de me cadastrar no aplicativo DM Turismo Pro com o e-mail: ${email}
      
Gostaria de solicitar a liberação do meu acesso ao sistema como ${role.toUpperCase()}.

⚡ LIBERAÇÃO RÁPIDA (1-CLIQUE):
Para liberar meu acesso como ${role.toUpperCase()} imediatamente em 1 clique, toque no link abaixo:
${appUrl}?approveEmail=${encodeURIComponent(email)}&role=${encodeURIComponent(role)}&auto=true

⚙️ ESCOLHER OUTRO CARGO:
Para abrir o aplicativo e escolher outra função antes de ativar, use este link:
${appUrl}?approveEmail=${encodeURIComponent(email)}`;

      const whatsappUrl = `https://wa.me/5549988095136?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
    };

    return (
      <div className="min-h-screen text-slate-100 flex items-center justify-center relative p-6 bg-zinc-950 font-sans">
        <div className="absolute inset-0 map-pattern opacity-5 pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-lg bg-zinc-900/60 border border-white/5 backdrop-blur-md rounded-[2.5rem] p-8 md:p-12 text-center shadow-2xl space-y-8 animate-in fade-in"
        >
          <div className="mx-auto w-20 h-20 bg-brand-accent/10 border border-brand-accent/20 rounded-3xl flex items-center justify-center text-brand-accent animate-pulse">
            <ShieldCheck size={40} />
          </div>

          <div className="space-y-3">
            <h1 className="text-3xl font-black uppercase tracking-tighter text-white font-display">
              Acesso <span className="text-brand-accent">Pendente</span>
            </h1>
            <p className="text-zinc-400 text-sm font-medium leading-relaxed max-w-sm mx-auto">
              Seu cadastro foi realizado com sucesso! Para garantir a segurança operacional da DM Turismo, o seu acesso precisa ser liberado antes de prosseguir.
            </p>
          </div>

          <div className="p-5 bg-zinc-950/50 border border-white/5 rounded-2xl text-left space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent block">Sua Função / Cargo</span>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Escolha a sua função na DM Turismo para pré-configurar seu painel e facilitar a liberação pelo proprietário:
            </p>
            <select
              value={selectedPendingDesiredRole}
              onChange={(e) => handleSelectPendingRole(e.target.value as UserProfile['role'])}
              className="w-full h-12 bg-zinc-900 border border-zinc-800 rounded-xl px-4 text-xs font-black text-zinc-300 uppercase outline-none focus:border-brand-accent cursor-pointer transition-all"
            >
              <option value="Motorista">Motorista</option>
              <option value="Gestor de Frotas">Gestor de Frotas</option>
              <option value="Coordenador Logístico">Coordenador Logístico</option>
              <option value="Administrativo">Administrativo</option>
              <option value="Limpeza / Conservação">Limpeza / Conservação</option>
              <option value="Visitante">Visitante</option>
            </select>
          </div>

          <div className="p-5 bg-zinc-950/50 border border-white/5 rounded-2xl text-left space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent block">Instruções para Liberação</span>
            <p className="text-xs text-zinc-500 font-medium leading-relaxed">
              Clique no botão abaixo para enviar uma solicitação direta ao proprietário <strong className="text-zinc-300">Elizeu Ferron</strong> solicitando a ativação das permissões para o seu e-mail:
            </p>
            <div className="text-xs font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 p-2.5 rounded-lg break-all select-all">
              {profile ? profile.email : user?.email}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleRequestAccess}
              className="flex-1 h-14 bg-brand-accent text-zinc-950 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:scale-105 hover:bg-white transition-all shadow-xl shadow-brand-accent/10 active:scale-95 cursor-pointer"
            >
              <Smartphone size={16} /> Solicitar Liberação
            </button>
            <button
              onClick={logout}
              className="px-6 h-14 bg-zinc-800/50 hover:bg-rose-500/20 hover:text-rose-400 border border-zinc-700/50 text-zinc-400 rounded-2xl font-black uppercase text-xs tracking-widest transition-all active:scale-95 cursor-pointer"
            >
              Sair
            </button>
          </div>

          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
            DM TURISMO • TODOS OS DIREITOS RESERVADOS
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center font-sans selection:bg-brand-accent/30 selection:text-white text-slate-100 relative overflow-hidden w-full h-screen">
      {/* Background ambient layout decoration */}
      <div className="absolute inset-0 map-pattern opacity-5 pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-brand-accent/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-sky-blue/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Floating Mode Toggle on Desktop */}
      <div className="fixed top-4 right-4 z-[90] hidden sm:flex items-center gap-1.5 p-1 bg-zinc-900/90 border border-white/5 rounded-2xl shadow-2xl backdrop-blur-md">
        <button
          onClick={() => setIsMobileMode(true)}
          className={cn(
            "p-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider cursor-pointer",
            isMobileMode 
              ? "bg-brand-accent text-zinc-950 shadow-md font-extrabold" 
              : "text-zinc-400 hover:text-white"
          )}
          title="Modo Celular"
        >
          <Smartphone size={13} />
          Celular
        </button>
        <button
          onClick={() => setIsMobileMode(false)}
          className={cn(
            "p-2 rounded-xl transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-wider cursor-pointer",
            !isMobileMode
              ? "bg-zinc-800 text-brand-accent border border-zinc-700/50"
              : "text-zinc-400 hover:text-white"
          )}
          title="Visualização Completa"
        >
          <LayoutDashboard size={13} />
          Expandido
        </button>
      </div>

      {/* Styled phone frame container on desktop screens */}
      <div className={cn(
        "transition-all duration-500 relative flex flex-col justify-center items-center w-full h-screen",
        isMobileMode 
          ? "sm:max-w-[420px] sm:h-[860px] sm:max-h-[94vh] sm:rounded-[3rem] sm:border-[10px] sm:border-zinc-900 sm:shadow-[0_0_80px_rgba(255,107,0,0.15)] bg-asphalt-950 sm:overflow-hidden border-0 sm:border border-white/5" 
          : "w-full h-screen"
      )}>
        {/* Realistic smartphone camera/speaker (Dynamic Island) on desktop simulator */}
        {isMobileMode && (
          <div className="absolute top-3 left-1/2 transform -translate-x-1/2 w-28 h-5.5 bg-zinc-900 rounded-full z-[100] hidden sm:flex items-center justify-center border border-white/5 shadow-inner">
            <div className="w-2 h-2 bg-zinc-950 rounded-full mr-2 border border-zinc-800" />
            <div className="w-7 h-1 bg-zinc-900 rounded-full opacity-60" />
          </div>
        )}

        {/* Home gesture handle at the bottom container */}
        {isMobileMode && (
          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-zinc-850 rounded-full z-[100] hidden sm:block opacity-40" />
        )}

        {/* The actual app contents */}
        <div className={cn(
          "w-full h-full flex flex-col relative overflow-hidden",
          isMobileMode && "sm:rounded-[2.4rem]"
        )}>

          {/* Main layout contents */}
          <div className="flex-1 flex min-h-0 w-full h-full travel-gradient overflow-hidden flex-row font-sans relative">
            <div className="absolute inset-0 map-pattern opacity-5 pointer-events-none" />
            
            <Suspense fallback={null}>
              <TripAlerts trips={trips} />
            </Suspense>
            <OfflineSync />
            
            <Sidebar 
              isOpen={sidebarOpen} 
              setIsOpen={setSidebarOpen} 
              activeSection={activeSection} 
              setActiveSection={handleNavigate}
              profile={effectiveProfile}
              logout={logout}
              vehicles={vehicles}
              maintenance={maintenance}
              trips={trips}
              transactions={transactions}
              stock={stock}
              charteredRoutes={charteredRoutes}
            />

            <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto relative z-10 transition-all duration-500">
              <header className="sticky top-0 z-40 bg-asphalt-950/80 backdrop-blur-2xl border-b border-white/5 px-4 sm:px-10 h-16 sm:h-24 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-3 sm:gap-6">
                  <button 
                    onClick={() => setSidebarOpen(!sidebarOpen)} 
                    className="p-2 sm:p-3.5 hover:bg-brand-accent hover:text-asphalt-950 rounded-xl sm:rounded-[1.25rem] text-zinc-400 transition-all bg-asphalt-900 border border-white/5 shadow-xl active:scale-95 group"
                  >
                    {sidebarOpen ? <ChevronRight className="rotate-180 group-hover:-translate-x-0.5 transition-transform" size={20} /> : <Bus size={20} />}
                  </button>
                  
                  {navStack.length > 1 && (
                    <button 
                      onClick={handleBack}
                      className="p-2 sm:p-3.5 hover:bg-white hover:text-zinc-950 rounded-xl text-zinc-400 transition-all bg-zinc-900 border border-zinc-700 shadow-xl active:scale-95 group flex items-center gap-2"
                      title="Voltar para seção anterior"
                    >
                      <ArrowLeft size={18} />
                      <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest leading-none">Voltar</span>
                    </button>
                  )}

                  <div 
                    className="cursor-pointer group flex flex-col pt-1"
                    onClick={() => setSidebarOpen(!sidebarOpen)}
                  >
                    <div className="flex flex-col">
                      <h2 className="text-2xl font-black text-white uppercase tracking-tighter group-hover:text-brand-accent transition-colors leading-none">
                        DM Turismo
                      </h2>
                      <span className="text-[9px] font-medium text-zinc-400 lowercase tracking-normal italic mt-1 font-sans leading-none block">
                        prazer em viajar bem
                      </span>
                    </div>
                    <span className="text-[10px] font-black text-zinc-300 uppercase tracking-[0.3em] mt-1.5 ">
                      {sections.find(s => s.id === activeSection)?.label}
                    </span>
                  </div>
          </div>
          
          <div className="flex items-center gap-3 sm:gap-6">


            {isSyncing ? (
              <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-emerald-500/10 rounded-xl border border-emerald-500/30 uppercase">
                <RefreshCw size={12} className="text-emerald-400 animate-spin" />
                <span className="text-[10px] font-black text-emerald-400 tracking-widest leading-none">Sincronizando Banco...</span>
              </div>
            ) : !isOnline ? (
              <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-orange-500/10 rounded-xl border border-orange-500/30 uppercase animate-pulse">
                <div className="w-2 h-2 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.8)]" />
                <span className="text-[10px] font-black text-orange-400 tracking-widest leading-none">Firestore Offline</span>
              </div>
            ) : (
              <div className="hidden lg:flex items-center gap-3 px-5 py-2.5 bg-asphalt-900 rounded-xl border border-white/5 uppercase">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
                <span className="text-[10px] font-black text-zinc-300 tracking-widest leading-none">Cloud Sync Active</span>
              </div>
            )}
            
            <button 
              onClick={() => setIsPermissionRequestsOpen(true)}
              className={cn(
                "p-3.5 relative rounded-xl text-zinc-400 border transition-all active:scale-95 shadow-xl cursor-pointer group animate-fade-in",
                isSyncing
                  ? "bg-emerald-950/20 border-emerald-500/50 hover:bg-emerald-900/30 text-emerald-400"
                  : isOfflineProlonged
                  ? "bg-rose-950/40 border-rose-500 border-2 hover:bg-rose-900/30 text-rose-400 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.6)]"
                  : !isOnline 
                  ? "bg-orange-950/40 border-orange-500/40 hover:bg-orange-900/30 text-orange-400 animate-pulse shadow-[0_0_20px_rgba(249,115,22,0.85),_0_0_6px_rgba(249,115,22,0.5)]" 
                  : "bg-asphalt-900 border-white/5 hover:bg-asphalt-800",
                shouldVibrateBell 
                  ? "animate-bell-vibrate text-orange-400 border-orange-500/40 shadow-[0_0_15px_rgba(249,115,22,0.5)]" 
                  : (activePendingRealtimeUsers && activePendingRealtimeUsers.length > 0)
                  ? "lg:animate-none animate-bell-oscillate"
                  : ""
              )}
              title={
                isSyncing 
                  ? "Sincronizando com Firestore..." 
                  : isOfflineProlonged
                  ? "Conexão Offline Prolongada • Verifique sua rede local"
                  : !isOnline 
                  ? "Firestore Offline • Alertas & Comunicados DM Turismo" 
                  : "Alertas & Comunicados DM Turismo"
              }
              id="alerts-notification-bell"
            >
              <Bell size={20} className={cn(
                "transition-all duration-500 ease-out transform-gpu", 
                animateBell ? "scale-140 rotate-12 text-emerald-400 font-bold" : "scale-100",
                isSyncing 
                  ? "text-emerald-400"
                  : isOfflineProlonged
                  ? "text-rose-400"
                  : !isOnline 
                  ? "text-orange-400" 
                  : "group-hover:text-brand-accent"
              )} />
              {isSyncing ? (
                <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 bg-emerald-500 rounded-full border border-zinc-950 shadow-[0_0_12px_rgba(16,185,129,0.9)] flex items-center justify-center animate-spin">
                  <RefreshCw size={8} className="text-zinc-950 stroke-[3px]" />
                </span>
              ) : isOfflineProlonged ? (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-rose-500 rounded-full border-2 border-zinc-950 shadow-[0_0_15px_rgba(244,63,94,0.95)] animate-bounce" />
              ) : !isOnline ? (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-orange-500 rounded-full border-2 border-zinc-950 shadow-[0_0_15px_rgba(249,115,22,0.95),_0_0_4px_rgba(249,115,22,0.6)] animate-bounce" />
              ) : (effectiveProfile?.role === 'Dono / Proprietário' || effectiveProfile?.email === 'elizeuferron@gmail.com') && realtimePendingUsers.length > 0 ? (
                <span className="absolute -top-1.5 -right-1.5 min-w-[1.25rem] h-5 px-1.5 bg-brand-accent text-zinc-950 text-[10px] font-black rounded-full flex items-center justify-center border-2 border-zinc-950 shadow-[0_0_10px_rgba(255,107,0,0.4)] animate-pulse">
                  {realtimePendingUsers.length}
                </span>
              ) : (
                <span className="absolute top-3.5 right-3.5 w-2.5 h-2.5 bg-brand-accent rounded-full border border-asphalt-950 shadow-sm shadow-brand-accent/40 animate-pulse animate-duration-1000" />
              )}
            </button>
          </div>
        </header>

        <div className="p-4 sm:p-8 md:p-12 max-w-7xl mx-auto w-full space-y-6 sm:space-y-12 pb-24">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="animate-spin text-brand-accent" size={32} />
            </div>
          }>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>

                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={
                  <PageTransition>
                    <Dashboard 
                      vehicles={vehicles}
                      employees={employees}
                      fuelLogs={recentFuelLogs}
                      maintenance={maintenance}
                      trips={trips}
                      user={effectiveProfile}
                      setActiveSection={handleNavigate}
                      onVehicleClick={(v) => {
                        setSelectedVehicle(v);
                        handleNavigate('fleet');
                      }}
                      onViewTrip={(trip) => {
                        setSelectedTrip(trip);
                        setIsOSModalOpen(true);
                      }}
                      onUpdateEmployeePhoto={async (employeeId, photoUrl) => {
                        try {
                          await setDoc(doc(db, 'employees', employeeId), cleanUndefined({ photoUrl }), { merge: true });
                          toast.success('Foto atualizada com sucesso!');
                        } catch (error) {
                          handleFirestoreError(error, OperationType.WRITE, 'employees');
                        }
                      }}
                      users={realtimeAllUsers}
                      onNewTrip={() => {
                        setSelectedTrip(null);
                        setIsTripModalOpen(true);
                      }}
                      onNewFuel={() => {
                        setPrefilledVehicleIdForFuel(null);
                        setIsFuelModalOpen(true);
                      }}
                      onNewMaintenance={() => {
                        setMaintenanceInitialData(null);
                        setIsMaintenanceModalOpen(true);
                      }}
                    />
                  </PageTransition>
                } />

                <Route path="/media-hub" element={<PageTransition><MediaHub /></PageTransition>} />



                <Route path="/staff" element={<Navigate to="/gabinete" replace />} />



              <Route path="/fleet" element={
                <PageTransition>
                  <UnifiedFleetManagement 
                    vehicles={vehicles}
                    maintenance={maintenance}
                    employees={employees}
                    trips={trips}
                    finance={transactions}
                    vehicleVencimentos={vehicleVencimentos}
                    driverVencimentos={driverVencimentos}
                    maintenanceData={maintenanceData}
                    onAddVehicle={handleOpenAddVehicle}
                    onVehicleClick={handleVehicleClick}
                    onAddMaintenance={() => {
                      setMaintenanceInitialData(null);
                      setIsMaintenanceModalOpen(true);
                    }}
                    onPrintOS={handlePrintOS}
                    onPrintBatchOS={handlePrintBatchOS}
                    onDeleteMaintenance={handleDeleteMaintenance}
                    onOpenMaintenanceAttachments={(log) => {
                      setSelectedMaintenanceForAttachments(log);
                      setIsMaintenanceAttachmentsModalOpen(true);
                    }}
                    isLoading={vehiclesLoading}
                    onAddEmployee={(defaultData?: any) => {
                      setSelectedEmployee((defaultData as Employee) || null);
                      setIsEmployeeModalOpen(true);
                    }}
                    onEditEmployee={(e) => {
                      setSelectedEmployee(e);
                      setIsEmployeeModalOpen(true);
                    }}
                    onDeleteEmployee={handleDeleteEmployee}
                    currentUserRole={effectiveProfile?.role}
                    currentUserEmail={user?.email}
                  />
                </PageTransition>
              } />

              <Route path="/vencimentos" element={<Navigate to="/fleet" replace />} />
              
              <Route path="/finance" element={
                <PageTransition>
                  <Finance 
                    trips={trips}
                    transactions={transactions}
                    vehicles={vehicles}
                    fuelLogs={recentFuelLogs}
                    maintenance={maintenance}
                    onAddTransaction={(type) => {
                      setFinancialType(type);
                      setIsFinancialModalOpen(true);
                    }}
                    onUpdateStatus={async (id, status) => {
                      try {
                        await setDoc(doc(db, 'financial_transactions', id), cleanUndefined({ status }), { merge: true });
                        toast.success('Status atualizado');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.UPDATE, 'financial_transactions');
                      }
                    }}
                    employees={employees}
                    onExportStaffToExcel={handleExportStaffToExcel}
                    onAddEmployee={(defaultData?: any) => {
                      setSelectedEmployee((defaultData as Employee) || null);
                      setIsEmployeeModalOpen(true);
                    }}
                    onEditEmployee={(e) => {
                      setSelectedEmployee(e);
                      setIsEmployeeModalOpen(true);
                    }}
                    onDeleteEmployee={handleDeleteEmployee}
                    onUpdateEmployeePhoto={async (employeeId, photoUrl) => {
                      try {
                        await setDoc(doc(db, 'employees', employeeId), cleanUndefined({ photoUrl }), { merge: true });
                        toast.success('Foto atualizada com sucesso!');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.WRITE, 'employees');
                      }
                    }}
                    user={effectiveProfile}
                    onEditTrip={(t) => {
                      setSelectedTrip(t);
                      setIsTripModalOpen(true);
                    }}
                    onDeleteTrip={handleDeleteTrip}
                    onViewOS={(t) => {
                      setSelectedTrip(t);
                      setIsOSModalOpen(true);
                    }}
                  />
                </PageTransition>
              } />
              <Route path="/trips" element={
                <PageTransition>
                  <TripsManagement 
                    trips={trips}
                    vehicles={vehicles}
                    employees={employees}
                    maintenance={maintenance}
                    tripSearch={tripSearch}
                    setTripSearch={setTripSearch}
                    tripStatusFilter={tripStatusFilter}
                    setTripStatusFilter={setTripStatusFilter}
                    tripTypeFilter={tripTypeFilter}
                    setTripTypeFilter={setTripTypeFilter}
                    tripDateStart={tripDateStart}
                    setTripDateStart={setTripDateStart}
                    tripDateEnd={tripDateEnd}
                    setTripDateEnd={setTripDateEnd}
                    onAddTrip={() => {
                      setSelectedTrip(null);
                      setIsTripModalOpen(true);
                    }}
                    onAddCompletedTrip={() => {
                      setSelectedTrip({ status: 'completed', isCompletedLaunch: true } as any);
                      setIsTripModalOpen(true);
                    }}
                    onEditTrip={(t) => {
                      setSelectedTrip(t);
                      setIsTripModalOpen(true);
                    }}
                    onDeleteTrip={handleDeleteTrip}
                    onViewOS={(t) => {
                      setSelectedTrip(t);
                      setIsOSModalOpen(true);
                    }}
                    onOpenAttachments={(t) => {
                      setSelectedTripForAttachments(t);
                      setIsAttachmentsModalOpen(true);
                    }}
                    onAddMaintenanceForVehicle={(vehicleId) => {
                      setMaintenanceInitialData({ vehicleId });
                      setIsMaintenanceModalOpen(true);
                    }}
                    isLoading={tripsLoading}
                    charteredRoutes={charteredRoutes}
                    currentUserRole={effectiveProfile?.role}
                    currentUserEmail={effectiveProfile?.email}
                  />
                </PageTransition>
              } />

              <Route path="/gabinete" element={
                <PageTransition>
                  <GabineteView 
                    vehicles={vehicles}
                    employees={employees}
                    fuelLogs={recentFuelLogs}
                    maintenance={maintenance}
                    trips={trips}
                    finance={transactions}
                    onShare={handleShareReport}
                    currentUserRole={effectiveProfile?.role}
                    onExportStaffToExcel={handleExportStaffToExcel}
                    onAddEmployee={(defaultData?: any) => {
                      setSelectedEmployee((defaultData as Employee) || null);
                      setIsEmployeeModalOpen(true);
                    }}
                    onEditEmployee={(e) => {
                      setSelectedEmployee(e);
                      setIsEmployeeModalOpen(true);
                    }}
                    onDeleteEmployee={handleDeleteEmployee}
                    onUpdateEmployeePhoto={async (employeeId, photoUrl) => {
                      try {
                        await setDoc(doc(db, 'employees', employeeId), cleanUndefined({ photoUrl }), { merge: true });
                        toast.success('Foto atualizada com sucesso!');
                      } catch (error) {
                        handleFirestoreError(error, OperationType.WRITE, 'employees');
                      }
                    }}
                    user={effectiveProfile}
                  />
                </PageTransition>
              } />

              <Route path="/criador" element={
                <ProtectedRoute permissionKey="criador" userProfile={effectiveProfile}>
                  <PageTransition>
                    <Criador 
                      user={effectiveProfile} 
                      vehicles={vehicles}
                      employees={employees}
                      fuelLogs={recentFuelLogs}
                      maintenance={maintenance}
                      trips={trips}
                      finance={transactions}
                      isShadowSplitOpen={isShadowSplitOpen}
                      setIsShadowSplitOpen={setIsShadowSplitOpen}
                    />
                  </PageTransition>
                </ProtectedRoute>
              } />

              <Route path="/os" element={<Navigate to="/fleet" replace />} />

              <Route path="/fuel" element={
                <PageTransition>
                  <FuelManagement 
                    fuelTanks={fuelTanks}
                    recentFuelLogs={recentFuelLogs}
                    fuelEntries={fuelEntries}
                    vehicles={vehicles}
                    employees={employees}
                    onOpenTankModal={() => setIsTankModalOpen(true)}
                    onOpenRefillModal={() => setIsRefillModalOpen(true)}
                    onOpenExternalFuelModal={() => setIsExternalFuelModalOpen(true)}
                    onOpenFuelModal={() => setIsFuelModalOpen(true)}
                    onEditFuelLog={(log) => toast.info('Funcionalidade de editar em breve!')}
                    onDeleteFuelLog={handleDeleteFuelLog}
                  />
                </PageTransition>
              } />

              <Route path="/maintenance" element={<Navigate to="/fleet" replace />} />

              <Route path="/inventory" element={
                <PageTransition>
                  <InventoryManagement userRole={effectiveProfile?.role} />
                </PageTransition>
              } />

              <Route path="/chamados" element={
                <PageTransition>
                  <ChamadoProprietario 
                    user={user} 
                    profile={effectiveProfile} 
                  />
                </PageTransition>
              } />

              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </AnimatePresence>

          {/* Bottom padding for mobile fab or spacing */}
          <div className="h-32" />
          </Suspense>
        </div>
      </main>

      {/* Split Screen Sombra Live Monitor */}
      <AnimatePresence>
        {isShadowSplitOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: isMobileMode ? "100%" : 480, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className={cn(
              "border-l border-white/5 bg-zinc-950/95 backdrop-blur-md flex flex-col h-full shrink-0 relative z-[45] shadow-2xl overflow-hidden",
              isMobileMode ? "fixed inset-0 z-[100]" : ""
            )}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]" />
                <span className="text-[10px] font-black text-zinc-300 uppercase tracking-widest">
                  Painel de Sombra Ativo (Live)
                </span>
              </div>
              <button
                onClick={() => setIsShadowSplitOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-asphalt-950">
              <ShadowLogVisualizer />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>


      <Modal 
        isOpen={isVehicleModalOpen} 
        onClose={() => {
          setIsVehicleModalOpen(false);
          setSelectedVehicle(null);
        }} 
        title={selectedVehicle ? "Editar Veículo" : "Cadastrar Novo Veículo"}
      >
        <Suspense fallback={FormLoader}>
          <VehicleForm onSubmit={handleSaveVehicle} initialData={liveSelectedVehicle} />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isFuelModalOpen} 
        onClose={() => {
          setIsFuelModalOpen(false);
          setPrefilledVehicleIdForFuel(null);
        }}
        title="Novo Abastecimento Interno"
      >
        <Suspense fallback={FormLoader}>
          <FuelForm 
            onSubmit={handleSaveFuel} 
            vehicles={vehicles}
            tanks={fuelTanks}
            employees={employees}
            isExternal={false}
            initialVehicleId={prefilledVehicleIdForFuel}
          />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isExternalFuelModalOpen} 
        onClose={() => {
          setIsExternalFuelModalOpen(false);
          setPrefilledVehicleIdForFuel(null);
        }}
        title="Novo Abastecimento Externo"
      >
        <Suspense fallback={FormLoader}>
          <FuelForm 
            onSubmit={handleSaveFuel} 
            vehicles={vehicles}
            tanks={fuelTanks}
            employees={employees}
            isExternal={true}
            initialVehicleId={prefilledVehicleIdForFuel}
          />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isTankModalOpen} 
        onClose={() => setIsTankModalOpen(false)}
        title="Cadastrar Novo Tanque"
      >
        <Suspense fallback={FormLoader}>
          <TankForm onSubmit={handleSaveTank} />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isRefillModalOpen} 
        onClose={() => setIsRefillModalOpen(false)}
        title="Registrar Entrada de Combustível"
      >
        <Suspense fallback={FormLoader}>
          <TankRefillForm 
            onSubmit={handleSaveRefill} 
            loading={formLoading} 
            tanks={fuelTanks}
          />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isEmployeeModalOpen} 
        onClose={() => {
          setIsEmployeeModalOpen(false);
          setSelectedEmployee(null);
        }}
        title={selectedEmployee ? "Editar Funcionário" : "Cadastrar Novo Funcionário"}
      >
        <Suspense fallback={FormLoader}>
          <EmployeeForm 
            onSubmit={handleSaveEmployee} 
            loading={formLoading} 
            initialData={liveSelectedEmployee} 
            currentUserRole={effectiveProfile?.role}
            currentUserEmail={user?.email}
          />
        </Suspense>
      </Modal>

      <Modal 
        isOpen={isMaintenanceModalOpen} 
        onClose={() => {
          setIsMaintenanceModalOpen(false);
          setMaintenanceInitialData(null);
        }}
        title="Nova Ordem de Serviço"
      >
        <Suspense fallback={FormLoader}>
          <MaintenanceForm 
            onSubmit={handleSaveMaintenance} 
            loading={formLoading}
            vehicles={vehicles}
            initialData={maintenanceInitialData}
            maintenanceHistory={maintenance}
          />
        </Suspense>
      </Modal>

      <Modal
        isOpen={isFinancialModalOpen}
        onClose={() => setIsFinancialModalOpen(false)}
        title={financialType === 'payable' ? 'Novo Lançamento: Contas a Pagar' : 'Novo Lançamento: Contas a Receber'}
      >
        <Suspense fallback={FormLoader}>
          <FinancialForm 
            type={financialType}
            onSubmit={handleFinancialSubmit}
            isLoading={formLoading}
          />
        </Suspense>
      </Modal>

      <Modal
        isOpen={isAttachmentsModalOpen}
        onClose={() => {
          setIsAttachmentsModalOpen(false);
          setSelectedTripForAttachments(null);
        }}
        title="Documentos e Anexos"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent">
              <Paperclip size={20} />
            </div>
            <div>
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{liveSelectedTripForAttachments?.title}</h4>
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">{liveSelectedTripForAttachments?.origin} → {liveSelectedTripForAttachments?.destination}</p>
            </div>
          </div>

          <AttachmentViewer 
            attachments={liveSelectedTripForAttachments?.attachments || []} 
            renderActions={(file) => {
              if (file.url === 'view-os') {
                return (
                  <button
                    onClick={() => {
                      setIsAttachmentsModalOpen(false);
                      setSelectedTrip(liveSelectedTripForAttachments);
                      setIsOSModalOpen(true);
                    }}
                    className="p-2.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-zinc-950 rounded-xl transition-all font-black text-[9px] uppercase tracking-wider flex items-center gap-1.5"
                    title="Visualizar Ordem de Serviço (Ficha)"
                  >
                    <Eye size={14} />
                    <span>VER OS</span>
                  </button>
                );
              }
              return (
                (file.type === 'image' || file.type === 'pdf') && (
                  <button
                    onClick={() => handleSmartExtractFromModal(liveSelectedTripForAttachments!, file)}
                    disabled={isProcessingModalAttachment === file.name}
                    className="p-2.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-zinc-950 rounded-xl transition-all group/ia"
                    title="Importar passageiros deste documento"
                  >
                    {isProcessingModalAttachment === file.name ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Sparkles size={16} className="group-hover/ia:animate-pulse" />
                    )}
                  </button>
                )
              );
            }}
          />

          <button
            onClick={() => setIsAttachmentsModalOpen(false)}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:text-white transition-all"
          >
            Fechar Visualização
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isMaintenanceAttachmentsModalOpen}
        onClose={() => {
          setIsMaintenanceAttachmentsModalOpen(false);
          setSelectedMaintenanceForAttachments(null);
        }}
        title="Anexos de Manutenção"
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <div className="w-10 h-10 bg-brand-accent/10 rounded-xl flex items-center justify-center text-brand-accent">
              <Wrench size={20} />
            </div>
            <div>
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">O.S. de {liveSelectedMaintenanceForAttachments?.description}</h4>
              <p className="text-[8px] font-bold text-zinc-500 uppercase tracking-[0.2em]">Custo: R$ {liveSelectedMaintenanceForAttachments?.cost?.toLocaleString()}</p>
            </div>
          </div>

          <AttachmentViewer attachments={liveSelectedMaintenanceForAttachments?.attachments || []} />

          <button
            onClick={() => setIsMaintenanceAttachmentsModalOpen(false)}
            className="w-full py-4 bg-zinc-900 border border-zinc-800 text-zinc-500 font-black text-[10px] uppercase tracking-[0.2em] rounded-2xl hover:text-white transition-all"
          >
            Fechar Visualização
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={isTripModalOpen}
        onClose={() => {
          setIsTripModalOpen(false);
          setSelectedTrip(null);
          setSharedAttachments([]);
        }}
        title={selectedTrip ? "Editar Viagem" : "Agendar Viagem"}
      >
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center p-8 text-center text-zinc-400 space-y-3">
            <Loader2 className="animate-spin text-brand-accent" size={28} />
            <p className="text-xs uppercase tracking-wider font-extrabold text-zinc-500">Carregando formulário e mapas...</p>
          </div>
        }>
          <TripForm 
            vehicles={vehicles}
            employees={employees}
            trips={trips}
            initialData={liveSelectedTrip}
            initialAttachments={sharedAttachments}
            onSubmit={(data) => {
              handleSaveTrip(data);
              setSharedAttachments([]);
            }}
            onCancel={() => {
              setIsTripModalOpen(false);
              setSelectedTrip(null);
              setSharedAttachments([]);
            }}
            loading={formLoading}
            onDelete={liveSelectedTrip ? () => handleDeleteTrip(liveSelectedTrip) : undefined}
          />
        </Suspense>
      </Modal>

      <Modal
        isOpen={isOSModalOpen}
        onClose={() => setIsOSModalOpen(false)}
        title="Ordem de Serviço"
      >
        {liveSelectedTrip && (
          <Suspense fallback={FormLoader}>
            <TripServiceOrder 
              trip={liveSelectedTrip}
              vehicle={vehicles.find(v => v.id === liveSelectedTrip.vehicleId)}
              driver={employees.find(e => e.id === liveSelectedTrip.driverId)}
              secondDriver={employees.find(e => e.id === liveSelectedTrip.secondDriverId)}
              onDelete={handleDeleteTrip}
            />
          </Suspense>
        )}
      </Modal>

      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedVehicle(null);
        }}
        title="Detalhes do Ativo"
      >
        {liveSelectedVehicle && (
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400 space-y-3">
              <Loader2 className="animate-spin text-brand-accent animate-duration-1000" size={32} />
              <p className="text-xs uppercase tracking-wider font-extrabold text-zinc-500">Montando Dossiê do Ativo...</p>
            </div>
          }>
            <VehicleDetail 
              vehicle={liveSelectedVehicle} 
              vehicles={vehicles}
              maintenanceHistory={maintenance} 
              fuelHistory={recentFuelLogs} 
              employees={employees}
              trips={trips}
              onEdit={openEditFromDetail}
              onAddMaintenance={() => {
                setMaintenanceInitialData({ vehicleId: liveSelectedVehicle?.id, odometer: liveSelectedVehicle?.currentOdometer });
                setIsMaintenanceModalOpen(true);
              }}
              onEditMaintenance={(log) => {
                setMaintenanceInitialData(log);
                setIsMaintenanceModalOpen(true);
              }}
              onDeleteMaintenance={handleDeleteMaintenance}
              onPrintOS={handlePrintOS}
              onDelete={() => handleDeleteVehicle(liveSelectedVehicle.id, liveSelectedVehicle.plate)}
              onSaveMaintenance={handleSaveMaintenance}
              isSavingMaintenance={formLoading}
              onAddTrip={(vId) => {
                setIsDetailModalOpen(false);
                setSelectedTrip({ vehicleId: vId, title: `Viagem Executiva - ${liveSelectedVehicle.plate}` } as any);
                setIsTripModalOpen(true);
              }}
              onAddFuel={(vId) => {
                setIsDetailModalOpen(false);
                setPrefilledVehicleIdForFuel(vId);
                setIsFuelModalOpen(true);
              }}
            />
          </Suspense>
        )}
      </Modal>
      <Modal
        isOpen={isMaintenanceRelatorioOpen}
        onClose={() => {
          setIsMaintenanceRelatorioOpen(false);
          setSelectedMaintenance(null);
        }}
        title="Relatório de Manutenção Técnica"
      >
        {liveSelectedMaintenance && (
          <Suspense fallback={FormLoader}>
            <MaintenanceServiceOrder 
              log={liveSelectedMaintenance}
              vehicle={vehicles.find(v => v.id === liveSelectedMaintenance.vehicleId)}
            />
          </Suspense>
        )}
      </Modal>
      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm(prev => ({ ...prev, isOpen: false }))}
        onConfirm={deleteConfirm.onConfirm}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
      />

      <ConfirmModal
        isOpen={!!confirmSaveVehicleData}
        onClose={() => setConfirmSaveVehicleData(null)}
        onConfirm={handleConfirmSaveVehicle}
        title="Revisão de Cadastro de Frota"
        message={`Deseja confirmar e persistir as alterações do veículo de placa "${confirmSaveVehicleData?.plate || ''}"? Por favor, revise todos os campos antes de confirmar.`}
        confirmLabel="Sim, Salvar no Firestore"
        confirmVariant="success"
      />


      
      <Suspense fallback={null}>
        <SyncSettings 
          isOpen={window.location.hash === '#sync-settings' || (window as any).isSyncSettingsOpen}
          onClose={() => {
            (window as any).isSyncSettingsOpen = false;
            window.location.hash = '';
          }}
        />
      </Suspense>
      
      <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("open-sync-settings", () => { (window as any).isSyncSettingsOpen = true; window.dispatchEvent(new Event("render")); });' }} />
      
       {/* Quick Approval Link Overlay */}
       <AnimatePresence>
         {pendingApprovalUser && (
           <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
             <motion.div
               initial={{ opacity: 0, scale: 0.95, y: 10 }}
               animate={{ opacity: 1, scale: 1, y: 0 }}
               exit={{ opacity: 0, scale: 0.95, y: 10 }}
               className="bg-zinc-900 border border-brand-accent/30 w-full max-w-md p-6 sm:p-8 rounded-[2rem] shadow-2xl relative space-y-6"
             >
               <button 
                 onClick={handleDismissApproval}
                 className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
               >
                 <X className="w-5 h-5" />
               </button>
 
               <div className="w-12 h-12 bg-brand-accent/20 border border-brand-accent/30 rounded-2xl flex items-center justify-center text-brand-accent shadow-lg shadow-brand-accent/5">
                 <ShieldCheck className="w-6 h-6 animate-pulse" />
               </div>
 
               <div className="space-y-1.5">
                 <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest block">Autorização Imediata</span>
                 <h3 className="text-xl font-black text-white uppercase tracking-tight">Liberar Novo Acesso</h3>
                 <p className="text-zinc-500 text-[11px] font-medium leading-relaxed">
                   O colaborador abaixo solicitou acesso ao sistema DM Turismo Pro. Escolha o nível de autorização adequado para ativá-lo imediatamente.
                 </p>
               </div>
 
               <div className="p-4 bg-zinc-950/80 border border-white/5 rounded-2xl space-y-2">
                 <div className="flex justify-between items-center">
                   <span className="text-[9px] font-black text-zinc-650 uppercase tracking-widest">Colaborador</span>
                   <span className="text-[8px] font-black text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded-full uppercase tracking-wider">Novo Cadastro</span>
                 </div>
                 <div className="space-y-1">
                   <p className="text-xs font-black text-white uppercase">{pendingApprovalUser.displayName || 'Sem Nome'}</p>
                   <p className="text-[10px] font-medium text-zinc-400 font-mono select-all break-all">{pendingApprovalUser.email}</p>
                 </div>
               </div>
 
               <div className="space-y-2">
                 <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1">Função / Nível de Acesso</label>
                 <select
                   value={approvalRole}
                   onChange={(e) => setApprovalRole(e.target.value as UserProfile['role'])}
                   className="w-full h-12 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs font-black text-zinc-300 uppercase outline-none focus:border-brand-accent cursor-pointer transition-all"
                 >
                   <option value="Motorista">Motorista (Padrão)</option>
                   <option value="Gestor de Frotas">Gestor de Frotas</option>
                   <option value="Coordenador Logístico">Coordenador Logístico</option>
                   <option value="Administrativo">Administrativo</option>
                   <option value="Limpeza / Conservação">Limpeza / Conservação</option>
                   <option value="Visitante">Visitante</option>
                   <option value="Dono / Proprietário">Dono / Proprietário (Acesso Total)</option>
                 </select>
               </div>
 
               <div className="flex gap-3 pt-2">
                 <button
                   type="button"
                   onClick={handleDismissApproval}
                   className="flex-1 h-12 bg-zinc-800 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer"
                 >
                   Cancelar
                 </button>
                 <button
                   type="button"
                   disabled={approving}
                   onClick={handleConfirmApproval}
                   className="flex-1 h-12 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/5 cursor-pointer disabled:opacity-50"
                 >
                   {approving ? (
                     <>
                       <Loader2 className="w-3.5 h-3.5 animate-spin" />
                       Liberando...
                     </>
                   ) : (
                     <>
                       <ShieldCheck className="w-3.5 h-3.5" />
                       Confirmar
                     </>
                   )}
                 </button>
               </div>
             </motion.div>
           </div>
         )}
       </AnimatePresence>

        {/* Real-time Dynamic Floating Notification for Elizeu Ferron */}
        <AnimatePresence>
          {(effectiveProfile?.role === 'Dono / Proprietário' || effectiveProfile?.email === 'elizeuferron@gmail.com') && !pendingApprovalUser && activePendingRealtimeUsers.length > 0 && (
            <div className="fixed bottom-6 right-6 md:right-8 md:bottom-8 z-[90] w-full max-w-sm px-4 md:px-0">
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.9 }}
                className="bg-zinc-900 border border-brand-accent/40 rounded-[2rem] p-5 shadow-2xl space-y-4 shadow-brand-accent/5 backdrop-blur-md relative overflow-hidden"
              >
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-24 h-24 bg-brand-accent/5 rounded-full blur-2xl -z-10 pointer-events-none" />

                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
                      <ShieldCheck className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest block font-sans">Solicitação Pendente</span>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight font-sans">Novo Cadastro Google</h4>
                    </div>
                  </div>
                  <button 
                    onClick={() => handleDismissRealtimeUser(activePendingRealtimeUsers[0].uid)}
                    className="p-1 px-2 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-white transition-colors cursor-pointer text-[10px] font-black uppercase tracking-widest font-sans"
                  >
                    Fechar
                  </button>
                </div>

                <div className="p-4 bg-zinc-950/80 border border-white/5 rounded-2xl space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest font-sans font-black">Colaborador</span>
                  </div>
                  <p className="text-xs font-black text-white uppercase font-sans">{activePendingRealtimeUsers[0].displayName || 'Sem Nome'}</p>
                  <p className="text-[10px] font-medium text-zinc-400 font-mono select-all truncate">{activePendingRealtimeUsers[0].email}</p>
                  {activePendingRealtimeUsers[0].requestedRole && (
                    <span className="text-[8px] font-black text-brand-accent bg-brand-accent/10 px-2 py-0.5 rounded uppercase tracking-wider mt-1.5 inline-block border border-brand-accent/20">
                      SOLICITADO: {activePendingRealtimeUsers[0].requestedRole}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block ml-1 font-sans font-black">Atribuir Função</label>
                  <select
                    value={realtimeApprovalRole}
                    onChange={(e) => setRealtimeApprovalRole(e.target.value as UserProfile['role'])}
                    className="w-full h-11 bg-zinc-950 border border-zinc-800 rounded-xl px-4 text-xs font-black text-zinc-300 uppercase outline-none focus:border-brand-accent cursor-pointer transition-all font-sans"
                  >
                    <option value="Motorista">Motorista (Padrão)</option>
                    <option value="Gestor de Frotas">Gestor de Frotas</option>
                    <option value="Coordenador Logístico">Coordenador Logístico</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="Limpeza / Conservação">Limpeza / Conservação</option>
                    <option value="Visitante">Visitante</option>
                    <option value="Dono / Proprietário">Dono / Proprietário (Acesso Total)</option>
                  </select>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    disabled={realtimeApprovingUid === activePendingRealtimeUsers[0].uid}
                    onClick={() => handleRealtimeApprove(activePendingRealtimeUsers[0], false)}
                    className="flex-1 h-11 bg-zinc-800/80 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer font-sans"
                  >
                    Não
                  </button>
                  <button
                    type="button"
                    disabled={realtimeApprovingUid === activePendingRealtimeUsers[0].uid}
                    onClick={() => handleRealtimeApprove(activePendingRealtimeUsers[0], true)}
                    className="flex-1 h-11 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-brand-accent/5 cursor-pointer disabled:opacity-50 font-sans"
                  >
                    {realtimeApprovingUid === activePendingRealtimeUsers[0].uid ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin font-sans" />
                    ) : (
                      "Sim"
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Central Alerts & Official Announcements Hub Modal */}
        <AnimatePresence>
          {isPermissionRequestsOpen && (
            <AlertsHubModal
              isOpen={isPermissionRequestsOpen}
              onClose={() => setIsPermissionRequestsOpen(false)}
              currentUser={effectiveProfile}
              realtimePendingUsers={realtimePendingUsers}
              realtimeAllUsers={realtimeAllUsers}
              handleRealtimeApprove={handleRealtimeApprove}
              handleUpdateUserRoleDirectly={handleUpdateUserRoleDirectly}
              maintenance={maintenance}
              vehicles={vehicles}
            />
          )}
        </AnimatePresence>

        {/* Changelog / Update Floating Message (Mensagem Suspensa) */}
        <AnimatePresence>
          {isChangelogOpen && user && effectiveProfile && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-md">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="bg-asphalt-950 border border-brand-accent/30 w-full max-w-lg p-6 sm:p-8 rounded-[2rem] shadow-2xl relative space-y-6"
              >
                <button 
                  onClick={() => {
                    setIsChangelogOpen(false);
                    try {
                      localStorage.setItem('dmturismo_changelog_seen_v3', 'true');
                    } catch (e) {
                      console.error(e);
                    }
                    toast.success('Mensagem fechada! Você não verá este aviso novamente de forma automática.');
                  }}
                  className="absolute top-6 right-6 p-2 text-zinc-400 hover:text-white transition-colors cursor-pointer rounded-full hover:bg-white/5"
                  title="Fechar e não mostrar novamente"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-brand-accent/20 border border-brand-accent/30 rounded-2xl flex items-center justify-center text-brand-accent shadow-lg shadow-brand-accent/5 shrink-0">
                    <Sparkles className="w-6 h-6 animate-pulse" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest block">DM Turismo Pro</span>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight font-display">Aplicativo Atualizado!</h3>
                  </div>
                </div>

                <div className="space-y-4">
                  <p className="text-zinc-400 text-xs font-medium leading-relaxed">
                    Compilamos com sucesso a versão mais recente do sistema diretamente do link de publicação oficial (<span className="text-brand-accent font-semibold underline">dm-turismo.run.app</span>). Confira as principais novidades e otimizações integradas:
                  </p>

                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-2 custom-scrollbar text-left">
                    <div className="p-3.5 bg-asphalt-900/60 border border-white/5 rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-brand-accent rounded-full shrink-0" />
                        <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">Lançamentos Financeiros Sem Trava</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium pl-3.5 leading-relaxed">
                        Qualquer pessoa do setor administrativo e donos/proprietários agora podem lançar e finalizar novas despesas ou transações financeiras diretamente e sem travas operacionais.
                      </p>
                    </div>

                    <div className="p-3.5 bg-asphalt-900/60 border border-white/5 rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-brand-accent rounded-full shrink-0" />
                        <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">Sinergia e Liberação de Acesso Automática</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium pl-3.5 leading-relaxed">
                        Ao editar ou criar a ficha de um funcionário, suas permissões e nível de acesso são sincronizados em tempo real com a respectiva conta de login (`users`), liberando na hora todos os módulos de forma transparente.
                      </p>
                    </div>

                    <div className="p-3.5 bg-asphalt-900/60 border border-white/5 rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-brand-accent rounded-full shrink-0" />
                        <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">Simplificação em 7 Módulos</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium pl-3.5 leading-relaxed">
                        Toda a árvore de privilégios e navegação do sistema foi simplificada em 7 pilares essenciais: Painel, Trabalhos, Gestão de Frotas, Financeiros, Abastecimento, Almoxarifado e Gabinete.
                      </p>
                    </div>

                    <div className="p-3.5 bg-asphalt-900/60 border border-white/5 rounded-xl space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-brand-accent rounded-full shrink-0" />
                        <span className="text-[10px] font-black uppercase text-zinc-300 tracking-wider">Ajuste de Segurança e Nota Fiscal</span>
                      </div>
                      <p className="text-[11px] text-zinc-500 font-medium pl-3.5 leading-relaxed">
                        Os limites de texto nas regras do Firestore (`firestore.rules`) foram expandidos para 1000 caracteres, permitindo salvar descrições ricas, detalhadas e categorias extensas geradas por IA.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    onClick={() => {
                      window.open('https://dm-turismo-874209116420.europe-west2.run.app', '_blank');
                    }}
                    className="flex-1 h-12 rounded-xl bg-brand-accent text-zinc-950 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white transition-all cursor-pointer shadow-lg shadow-brand-accent/10 active:scale-[0.98]"
                  >
                    <Globe className="w-4 h-4" />
                    Acessar App Publicado
                  </button>
                  <button
                    onClick={() => {
                      setIsChangelogOpen(false);
                      try {
                        localStorage.setItem('dmturismo_changelog_seen_v3', 'true');
                      } catch (e) {
                        console.error(e);
                      }
                      toast.success('Mensagem fechada! Você não verá este aviso novamente de forma automática.');
                    }}
                    className="h-12 px-6 rounded-xl bg-asphalt-900 border border-white/5 hover:border-white/10 text-zinc-400 hover:text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Entendi / Fechar
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
