// DM Turismo Dashboard Component (Production Version) - Overloaded with Aggressive Lazy Loading
import React, { useState, useEffect, useMemo, useRef } from 'react';
import ReactPlayer from 'react-player';
import { 
  Cake, 
  MessageSquare, 
  Bell, 
  TrendingUp, 
  Bus, 
  Fuel, 
  Wrench,
  AlertTriangle,
  ChevronRight,
  Send,
  Clock,
  User as UserIcon,
  Plus,
  Sparkles,
  Share2,
  Camera,
  Upload,
  Newspaper,
  Maximize2,
  Trash2,
  Facebook,
  Instagram,
  Ghost,
  Bot as BotIcon,
  Smartphone,
  Play,
  X,
  Zap,
  Link as LinkIcon,
  Loader2,
  Youtube,
  GripVertical,
  Disc,
  Eye,
  EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, isBefore, parseISO, differenceInDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from './Cards';
import { cn } from '../lib/utils';
import { Employee, Vehicle, FuelLog, MaintenanceLog, Trip } from '../types';
import { ConfirmModal, Modal } from './UI';
import { collection, query, onSnapshot, doc, setDoc, getDoc, serverTimestamp, orderBy, limit, where, deleteDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { toast } from 'sonner';
import { dbCacheService } from '../services/dbCacheService';
import { FeaturedVideosSection } from './FeaturedVideosSection';
import { optimizeImageBeforeUpload } from './ImageOptimizer';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';


interface Card3DProps {
  id?: string;
  children?: React.ReactNode;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  style?: React.CSSProperties;
  draggable?: boolean;
  onDragStart?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (event: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (event: React.DragEvent<HTMLDivElement>) => void;
}

const Card3D: React.FC<Card3DProps> = ({ 
  id,
  children, 
  className, 
  onClick, 
  style, 
  draggable,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop
}) => {
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    const mouseX = e.clientX - rect.left - width / 2;
    const mouseY = e.clientY - rect.top - height / 2;
    
    // Smooth 3D tilt rotation
    const rX = -(mouseY / (height / 2)) * 6; // max 6 degrees tilt
    const rY = (mouseX / (width / 2)) * 6;
    
    setCoords({ x: rY, y: rX });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setCoords({ x: 0, y: 0 });
  };

  return (
    <motion.div
      id={id}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      draggable={draggable}
      onDragStart={onDragStart as any}
      onDragEnd={onDragEnd as any}
      onDragOver={onDragOver as any}
      onDrop={onDrop as any}
      animate={{
        rotateX: coords.y,
        rotateY: coords.x,
        scale: isHovered ? 1.015 : 1,
        boxShadow: isHovered 
          ? "0 25px 50px -12px rgba(0, 47, 190, 0.2), 0 0 40px rgba(0, 47, 190, 0.1)" 
          : "0 4px 10px rgba(0, 0, 0, 0.3)",
        borderColor: isHovered ? "rgba(212, 175, 55, 0.3)" : "rgba(255, 255, 255, 0.06)",
        backgroundColor: isHovered ? "rgba(10, 10, 12, 0.7)" : "rgba(9, 9, 11, 0.35)"
      }}
      transition={{ type: "spring", stiffness: 220, damping: 25, mass: 0.8 }}
      style={{ 
        transformStyle: "preserve-3d", 
        perspective: 1200,
        ...style 
      }}
      className={cn(
        "relative rounded-[2rem] border border-white/6 backdrop-blur-xl p-6 cursor-pointer transition-colors duration-300 overflow-hidden",
        className
      )}
    >
      {/* Soft overlay gradient glow */}
      <div 
        className="absolute inset-0 bg-gradient-to-tr from-[#002fbe]/5 to-[#D4AF37]/5 transition-opacity duration-300 pointer-events-none" 
        style={{ opacity: isHovered ? 1 : 0 }}
      />
      
      {/* Dynamic light spotlight following cursor position */}
      <div 
        className="absolute -inset-px opacity-0 transition duration-300 rounded-[2rem] pointer-events-none"
        style={{
          background: `radial-gradient(350px circle at ${coords.x * 25 + 160}px ${-coords.y * 25 + 120}px, rgba(212,175,55,0.06), transparent 80%)`,
          opacity: isHovered ? 1 : 0
        }}
      />

      <div style={{ transform: "translateZ(15px)", transformStyle: "preserve-3d" }} className="relative z-10 h-full w-full">
        {children}
      </div>
    </motion.div>
  );
};

const safeFormatDate = (timestamp: any, formatStr: string = "dd/MM/yyyy"): string => {
  if (!timestamp) return 'Agora';
  try {
    let date: Date;
    if (typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      date = parseISO(timestamp);
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else if (timestamp.seconds !== undefined) {
      date = new Date(timestamp.seconds * 1000);
    } else {
      date = new Date(timestamp);
    }
    if (isNaN(date.getTime())) {
      return 'Agora';
    }
    return format(date, formatStr, { locale: ptBR });
  } catch (e) {
    console.error("Error formatting date:", e, timestamp);
    return 'Agora';
  }
};

interface DashboardProps {
  vehicles: Vehicle[];
  employees: Employee[];
  fuelLogs: FuelLog[];
  maintenance: MaintenanceLog[];
  trips: Trip[];
  user: any;
  setActiveSection: (id: string) => void;
  onViewTrip: (trip: Trip) => void;
  onShowInstall?: () => void;
  onUpdateEmployeePhoto?: (id: string, photoUrl: string) => Promise<void>;
  onVehicleClick?: (vehicle: Vehicle) => void;
  users?: any[];
  onNewTrip?: () => void;
  onNewFuel?: () => void;
  onNewMaintenance?: () => void;
}

export const Dashboard = React.memo(({ 
  vehicles, 
  employees, 
  fuelLogs, 
  maintenance, 
  trips,
  user,
  setActiveSection,
  onViewTrip,
  onShowInstall,
  onUpdateEmployeePhoto,
  onVehicleClick,
  users = [],
  onNewTrip,
  onNewFuel,
  onNewMaintenance
}: DashboardProps) => {
  const [boardMessage, setBoardMessage] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [messages, setMessages] = useState<{id: string, text: string, sender: string, timestamp: any}[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [mediaShares, setMediaShares] = useState<{id: string, url: string, type: 'image' | 'video', caption?: string, ownerName: string, ownerId: string, createdAt: any}[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [isAddingMedia, setIsAddingMedia] = useState(false);
  const [newMedia, setNewMedia] = useState({ url: '', type: 'image' as 'image' | 'video', caption: '' });
  const [newsItems, setNewsItems] = useState<{id: string, title: string, content: string, imageUrl?: string, authorName: string, authorId: string, isUrgent?: boolean, createdAt: any}[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);
  const [isAddingNews, setIsAddingNews] = useState(false);
  const [newNews, setNewNews] = useState({ title: '', content: '', imageUrl: '', isUrgent: false });
  const [selectedVideo, setSelectedVideo] = useState<{url: string, title?: string, type?: 'image' | 'video'} | null>(null);
  const [playingShareVideoId, setPlayingShareVideoId] = useState<string | null>(null);
  const [shareVideoReadyId, setShareVideoReadyId] = useState<string | null>(null);
  const [modalVideoPlaying, setModalVideoPlaying] = useState(false);
  const [mediaAspect, setMediaAspect] = useState<'video' | 'portrait' | 'square' | 'auto'>('video');
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);
  
  // Birthday employee photo custom modal state
  const [targetBirthdayEmployee, setTargetBirthdayEmployee] = useState<any | null>(null);
  const [birthdayPhotoInput, setBirthdayPhotoInput] = useState('');
  const [loadingProfilePhoto, setLoadingProfilePhoto] = useState(false);
  const [birthdayShowCamera, setBirthdayShowCamera] = useState(false);
  const [birthdayCameraError, setBirthdayCameraError] = useState('');
  const birthdayVideoRef = React.useRef<HTMLVideoElement>(null);
  const birthdayCanvasRef = React.useRef<HTMLCanvasElement>(null);
  const [muralConfettis, setMuralConfettis] = useState<{ id: number, x: number, y: number, color: string, angle: number, size: number, rotation: number }[]>([]);
  const [showBirthdaysList, setShowBirthdaysList] = useState(true);

  const triggerCardConfetti = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const parent = e.currentTarget.closest('.mural-container-ref') || e.currentTarget.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    const offsetX = rect.left - (parentRect?.left || 0) + rect.width / 2;
    const offsetY = rect.top - (parentRect?.top || 0) + rect.height / 2;
    
    const colors = ['#ff6b00', '#ffffff', '#fb923c', '#fdba74', '#fed7aa', '#38bdf8', '#818cf8', '#f472b6', '#4ade80'];
    const newConfettis = Array.from({ length: 30 }).map((_, i) => ({
      id: Date.now() + i + Math.floor(Math.random() * 1000),
      x: offsetX,
      y: offsetY,
      color: colors[Math.floor(Math.random() * colors.length)],
      angle: Math.random() * 360,
      size: 4 + Math.random() * 8,
      rotation: Math.random() * 360
    }));
    
    setMuralConfettis(prev => [...prev, ...newConfettis]);
    
    setTimeout(() => {
      setMuralConfettis(prev => prev.filter(p => !newConfettis.some(n => n.id === p.id)));
    }, 1500);
  };

  // Aggressive Lazy Loading Intersection Observer Targets
  const [birthdaysVisible, setBirthdaysVisible] = useState(false);
  const [videosVisible, setVideosVisible] = useState(false);
  const [feedVisible, setFeedVisible] = useState(false);
  const [newsVisible, setNewsVisible] = useState(false);
  const [mediaVisible, setMediaVisible] = useState(false);

  const birthdaysRef = useRef<HTMLDivElement>(null);
  const videosRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const newsRef = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);

  // Drag and drop widgets system
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [widgetOrder, setWidgetOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('dashboard_widget_order');
    const defaultOrder = ['fleet', 'trips', 'staff', 'os', 'fuel', 'tires'];
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          if (!parsed.includes('tires')) {
            parsed.push('tires');
          }
          return parsed;
        }
      } catch (e) {
        console.warn('Error reading dashboard_widget_order:', e);
      }
    }
    return defaultOrder;
  });

  const [tireDossiers, setTireDossiers] = useState<any[]>([]);
  const [loadingTires, setLoadingTires] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    
    const unsubscribe = dbCacheService.subscribeDocument(`users_layouts/${user.uid}`, (data) => {
      if (data && Array.isArray(data.widgetOrder) && data.widgetOrder.length > 0) {
        let order = [...data.widgetOrder];
        if (!order.includes('tires')) {
          order.push('tires');
        }
        setWidgetOrder(order);
      }
    });

    return () => unsubscribe();
  }, [user?.uid]);

  useEffect(() => {
    const targets = [
      { ref: birthdaysRef, setVisible: setBirthdaysVisible },
      { ref: videosRef, setVisible: setVideosVisible },
      { ref: feedRef, setVisible: setFeedVisible },
      { ref: newsRef, setVisible: setNewsVisible },
      { ref: mediaRef, setVisible: setMediaVisible }
    ];

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const match = targets.find(t => t.ref.current === entry.target);
            if (match) {
              match.setVisible(true);
              observer.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '250px', // Pre-load widgets when they are within 250px of the viewport
        threshold: 0.01
      }
    );

    targets.forEach((t) => {
      if (t.ref.current) {
        observer.observe(t.ref.current);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  const [featuredVideos, setFeaturedVideos] = useState<{id: string, url: string, title: string}[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(true);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [currentTime, setCurrentTime] = useState(new Date());

  const startBirthdayCamera = async () => {
    setBirthdayShowCamera(true);
    setBirthdayCameraError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setTimeout(() => {
        if (birthdayVideoRef.current) {
          birthdayVideoRef.current.srcObject = stream;
          birthdayVideoRef.current.play().catch(err => console.error('Play camera error:', err));
        }
      }, 100);
    } catch (err) {
      console.error(err);
      setBirthdayCameraError('Não foi possível acessar a câmera do dispositivo.');
    }
  };

  const stopBirthdayCamera = () => {
    if (birthdayVideoRef.current && birthdayVideoRef.current.srcObject) {
      const stream = birthdayVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      birthdayVideoRef.current.srcObject = null;
    }
    setBirthdayShowCamera(false);
  };

  const captureBirthdayPhoto = async (empId: string) => {
    if (birthdayVideoRef.current && birthdayCanvasRef.current) {
      const context = birthdayCanvasRef.current.getContext('2d');
      if (context) {
        birthdayCanvasRef.current.width = birthdayVideoRef.current.videoWidth;
        birthdayCanvasRef.current.height = birthdayVideoRef.current.videoHeight;
        context.drawImage(birthdayVideoRef.current, 0, 0);
        const dataUrl = birthdayCanvasRef.current.toDataURL('image/jpeg');
        if (onUpdateEmployeePhoto) {
          await onUpdateEmployeePhoto(empId, dataUrl);
          toast.success('Foto capturada com sucesso!');
          stopBirthdayCamera();
          setTargetBirthdayEmployee(null);
        }
      }
    }
  };

  const handleFetchBirthdayUserProfilePhoto = async (emp: any) => {
    if (!emp?.email) {
      toast.error('Este colaborador não possui um e-mail cadastrado.');
      return;
    }
    setLoadingProfilePhoto(true);
    try {
      const q = query(collection(db, 'users'), where('email', '==', emp.email.trim().toLowerCase()));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.empty) {
        toast.error(`Nenhum usuário correspondente encontrado com o e-mail: ${emp.email}`);
      } else {
        const userData = querySnapshot.docs[0].data();
        if (userData.photoURL) {
          if (onUpdateEmployeePhoto) {
            await onUpdateEmployeePhoto(emp.id, userData.photoURL);
            toast.success('Foto de perfil importada com sucesso!');
            setTargetBirthdayEmployee(null);
            setBirthdayPhotoInput('');
          }
        } else {
          toast.error('O usuário correspondente existe, mas não possui nenhuma foto de perfil cadastrada.');
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Erro ao buscar foto.');
    } finally {
      setLoadingProfilePhoto(false);
    }
  };

  // Close video modal safely by stopping playback first
  const handleCloseVideoModal = () => {
    setModalVideoPlaying(false);
    setTimeout(() => {
      setSelectedVideo(null);
    }, 100); // Small delay to let player state settle
  };

  useEffect(() => {
    if (selectedVideo) {
      setModalVideoPlaying(true);
      
      // Default to standard widescreen video
      let detectedAspect: 'video' | 'portrait' | 'square' | 'auto' = 'video';
      const url = selectedVideo.url.toLowerCase();
      
      if (
        url.includes('shorts') || 
        url.includes('reel') || 
        url.includes('tiktok.com') || 
        url.includes('stories') ||
        url.includes('youtube.com/shorts')
      ) {
        detectedAspect = 'portrait';
        setMediaAspect('portrait');
      } else if (selectedVideo.url.startsWith('data:')) {
        if (selectedVideo.url.startsWith('data:image')) {
          const img = new Image();
          img.src = selectedVideo.url;
          img.onload = () => {
            if (img.height > img.width * 1.25) {
              setMediaAspect('portrait');
            } else if (Math.abs(img.width - img.height) < img.width * 0.15) {
              setMediaAspect('square');
            } else {
              setMediaAspect('video');
            }
          };
        } else if (selectedVideo.url.startsWith('data:video')) {
          const tempVideo = document.createElement('video');
          tempVideo.src = selectedVideo.url;
          tempVideo.onloadedmetadata = () => {
            if (tempVideo.videoHeight > tempVideo.videoWidth * 1.25) {
              setMediaAspect('portrait');
            } else if (Math.abs(tempVideo.videoWidth - tempVideo.videoHeight) < tempVideo.videoWidth * 0.15) {
              setMediaAspect('square');
            } else {
              setMediaAspect('video');
            }
          };
        }
      } else {
        setMediaAspect(detectedAspect);
      }
    }
  }, [selectedVideo]);

  const [deleteConfirm, setDeleteConfirm] = useState<{isOpen: boolean, id: string, type: 'media' | 'news' | 'message'}>({
    isOpen: false,
    id: '',
    type: 'message'
  });
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const isAdministrative = user?.role === 'Dono / Proprietário' || 
                          user?.role === 'Dono' || 
                          user?.role === 'Proprietário' || 
                          user?.role === 'Administrativo' || 
                          user?.role === 'Gestor de Frotas' ||
                          user?.role === 'Coordenador Logístico' ||
                          user?.role === 'admin' || 
                          user?.role === 'manager' ||
                          user?.email === 'elizeuferron@gmail.com';

  const isVisitor = user?.role === 'Visitante';
  const visitorExpired = useMemo(() => {
    if (!isVisitor || !user?.createdAt) return false;
    const createdDate = user.createdAt.toDate ? user.createdAt.toDate() : parseISO(user.createdAt);
    return differenceInDays(new Date(), createdDate) > 15;
  }, [user, isVisitor]);

  const canShare = isAdministrative && !isVisitor && !visitorExpired;

  const videoShares = useMemo(() => mediaShares.filter(m => m.type === 'video').slice(0, 4), [mediaShares]);
  const imageShares = useMemo(() => mediaShares.filter(m => m.type === 'image'), [mediaShares]);

  // Split Active Firestore Subscriptions - Only trigger when respective sections are intersected / visible
  
  // Notice board and feed messages
  useEffect(() => {
    if (!user || !feedVisible) return;

    const unsub = dbCacheService.subscribeDocument('settings/dashboard', (data) => {
      if (data) {
        setBoardMessage(data.message || '');
      }
    });

    const unsubMessages = dbCacheService.subscribeCollection('dashboard_messages', (msgs) => {
      setMessages(msgs);
      setLoadingMessages(false);
    });

    return () => {
      unsub();
      unsubMessages();
    };
  }, [user?.uid, feedVisible]);

  // Media shares (Mural de fotos)
  useEffect(() => {
    if (!user || !mediaVisible) return;

    const mediaQuery = query(
      collection(db, 'media_shares'),
      orderBy('createdAt', 'desc'),
      limit(12)
    );

    const unsubMedia = dbCacheService.subscribeCollection('media_shares', (media) => {
      const filtered = media.filter((item: any) => !item.deleted);
      setMediaShares(filtered);
      setLoadingMedia(false);
    });

    return () => {
      unsubMedia();
    };
  }, [user?.uid, mediaVisible]);

  // News feed (Informativo DM Turismo)
  useEffect(() => {
    if (!user || !newsVisible) return;

    const newsQuery = query(
      collection(db, 'news_feed'),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubNews = dbCacheService.subscribeCollection('news_feed', (news) => {
      const filtered = news.filter((item: any) => {
        if (item.deleted) return false;
        const titleUpper = (item.title || '').toUpperCase();
        const contentUpper = (item.content || '').toUpperCase();
        
        if (titleUpper.includes('ABASTECIMENTO') || contentUpper.includes('ABASTECIMENTO REGISTRADO')) return false;
        if (titleUpper.includes('CONTAS A PAGAR') || titleUpper.includes('CONTAS A RECEBER') || titleUpper.includes('FINANCEIRO') || titleUpper.includes('LANÇAMENTO')) return false;
        
        return true;
      });
      setNewsItems(filtered);
      setLoadingNews(false);
    });

    return () => {
      unsubNews();
    };
  }, [user?.uid, newsVisible]);

  // Featured videos (Vídeos Destaques)
  useEffect(() => {
    if (!user || !videosVisible) return;

    const unsubFeatured = dbCacheService.subscribeCollection('featured_videos', (vids) => {
      setFeaturedVideos(vids);
      setLoadingFeatured(false);
    });

    return () => unsubFeatured();
  }, [user?.uid, videosVisible]);

  // Tire Dossiers (Pneus)
  useEffect(() => {
    if (!user) return;

    const unsubTires = dbCacheService.subscribeCollection('tire_dossiers', (tires) => {
      setTireDossiers(tires);
      setLoadingTires(false);
    });

    return () => unsubTires();
  }, [user?.uid]);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!user) return;
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '0.5';
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.style.opacity = '1';
    setDraggedId(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!user) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    if (!user || !draggedId || draggedId === targetId) return;

    const currentIndex = widgetOrder.indexOf(draggedId);
    const targetIndex = widgetOrder.indexOf(targetId);

    if (currentIndex !== -1 && targetIndex !== -1) {
      const newOrder = [...widgetOrder];
      newOrder.splice(currentIndex, 1);
      newOrder.splice(targetIndex, 0, draggedId);
      
      setWidgetOrder(newOrder);
      localStorage.setItem('dashboard_widget_order', JSON.stringify(newOrder));
      
      if (user?.uid && auth.currentUser && auth.currentUser.uid === user.uid) {
        try {
          await setDoc(doc(db, 'users_layouts', user.uid), {
            widgetOrder: newOrder,
            updatedAt: serverTimestamp()
          }, { merge: true });
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users_layouts/${user.uid}`);
        }
      }

      toast.success('Métricas reordenadas com sucesso!', {
        description: 'Sua visualização personalizada do painel foi salva.',
        icon: '🎯'
      });
    }
  };

  const widgetData = useMemo(() => {
    const activeVehicles = vehicles?.filter(v => (v.status as string) === 'ativo' || (v.status as string) === 'active' || (v.status as string) === 'working' || v.status === 'available' || v.status === 'trip')?.length || 0;
    const scheduledTrips = trips?.filter(t => t.status === 'scheduled' || (t.status as string) === 'running' || t.status === 'active')?.length || 0;
    const pendingMaintenance = maintenance?.filter(m => m.status === 'pending' || ( m.status as string) === 'in_progress')?.length || 0;
    const totalEmployees = employees?.length || 0;
    const fuelCount = fuelLogs?.length || 0;

    return [
      {
        id: 'fleet',
        title: 'Status da Frota',
        value: `${vehicles?.length || 0} Veículos`,
        trend: `${activeVehicles} ativos em frota`,
        icon: Bus,
        color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        glow: 'hover:border-emerald-500/30' ,
        onClickSection: 'fleet'
      },
      {
        id: 'trips',
        title: 'Viagens Efetuadas',
        value: `${trips?.length || 0} Viagens`,
        trend: `${scheduledTrips} ativas ou agendadas`,
        icon: TrendingUp,
        color: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
        glow: 'hover:border-orange-500/30',
        onClickSection: 'trips'
      },
      {
        id: 'staff',
        title: 'Colaboradores',
        value: `${totalEmployees} Ativos`,
        trend: `${employees?.filter(e => (e.status as string) === 'ativo' || e.status === 'active')?.length || totalEmployees} em equipe`,
        icon: UserIcon,
        color: 'bg-sky-500/10 text-sky-450 border-sky-500/20',
        glow: 'hover:border-sky-500/30',
        onClickSection: 'staff'
      },
      {
        id: 'os',
        title: 'Manutenções e O.S.',
        value: `${maintenance?.length || 0} Ordens`,
        trend: `${pendingMaintenance} pendentes de execução`,
        icon: Wrench,
        color: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
        glow: 'hover:border-amber-500/30',
        onClickSection: 'fleet'
      },
      {
        id: 'fuel',
        title: 'Abastecimentos',
        value: `${fuelCount} Registros`,
        trend: `Combustível acumulado na base`,
        icon: Fuel,
        color: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
        glow: 'hover:border-rose-500/30',
        onClickSection: 'fuel'
      },
      {
        id: 'tires',
        title: 'Status de Pneus',
        value: `${tireDossiers?.length || 0} Pneus`,
        trend: `N: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'NOVO').length || 0} | R: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'RODANDO').length || 0} | RC: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'RECAPAGEM').length || 0} | SC: ${tireDossiers?.filter((d: any) => d.status?.toUpperCase() === 'SUCATA').length || 0}`,
        icon: Disc,
        color: 'bg-orange-500/10 text-brand-accent border-brand-accent/20',
        glow: 'hover:border-brand-accent/30',
        onClickSection: 'inventory'
      }
    ];
  }, [vehicles, trips, employees, maintenance, fuelLogs, tireDossiers]);

  const handleAddFeaturedVideo = async (video: {url: string, title: string, type?: 'image' | 'video'}) => {
    if (featuredVideos.length >= 4) {
      toast.error('Limite de mídias atingido.');
      return;
    }
    if (!video.url || !video.title) {
      toast.error('URL e título são obrigatórios.');
      return;
    }
    try {
      await setDoc(doc(collection(db, 'featured_videos')), {
        ...video,
        createdAt: serverTimestamp()
      });
      toast.success('Mídia adicionada com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'featured_videos');
    }
  };

  const handleDeleteFeaturedVideo = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'featured_videos', id));
      toast.success('Vídeo removido com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'featured_videos');
    }
  };

  const handleShareNews = async () => {
    if (!newNews.title.trim() || !newNews.content.trim()) {
      toast.error('Título e conteúdo são obrigatórios.');
      return;
    }

    try {
      await setDoc(doc(collection(db, 'news_feed')), {
        ...newNews,
        authorId: user.uid,
        authorName: user.displayName || user.email || 'Admin',
        createdAt: serverTimestamp()
      });
      setNewNews({ title: '', content: '', imageUrl: '', isUrgent: false });
      setIsAddingNews(false);
      toast.success('Notícia publicada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'news_feed');
    }
  };

  const handleShareMedia = async () => {
    if (!newMedia.url.trim()) {
      toast.error('Por favor, informe a URL ou selecione um arquivo.');
      return;
    }

    try {
      await setDoc(doc(collection(db, 'media_shares')), {
        ...newMedia,
        ownerId: user.uid,
        ownerName: user.displayName || user.email || 'Admin',
        createdAt: serverTimestamp()
      });
      setNewMedia({ url: '', type: 'image', caption: '' });
      setIsAddingMedia(false);
      toast.success('Mídia compartilhada com sucesso!');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'media_shares');
    }
  };

  const processDelete = async () => {
    const { id, type } = deleteConfirm;
    try {
      if (type === 'media') {
        await deleteDoc(doc(db, 'media_shares', id));
        toast.success('Mídia removida definitivamente!');
      } else if (type === 'news') {
        await deleteDoc(doc(db, 'news_feed', id));
        toast.success('Notícia excluída definitivamente!');
      } else if (type === 'message') {
        await deleteDoc(doc(db, 'dashboard_messages', id));
        toast.success('Mensagem removida.');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${type}/${id}`);
    }
  };

  const handleDeleteMedia = (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: 'media' });
  };

  const handleDeleteNews = (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: 'news' });
  };

  const handleDeleteMessage = (id: string) => {
    setDeleteConfirm({ isOpen: true, id, type: 'message' });
  };

  const handleSocialShare = (type: string, url: string, caption?: string) => {
    const text = encodeURIComponent(caption || 'Confira este momento da DM Turismo!');
    const shareUrl = encodeURIComponent(url);
    
    let platformUrl = '';
    switch(type) {
      case 'facebook':
        platformUrl = `https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`;
        break;
      case 'whatsapp':
        platformUrl = `https://wa.me/?text=${text}%20${shareUrl}`;
        break;
      default:
        if (navigator.share) {
          navigator.share({
            title: 'DM Turismo',
            text: caption,
            url: url
          }).catch((err) => {
            if (err.name !== 'AbortError') {
              console.error('Share error:', err);
              toast.error('Não foi possível compartilhar via sistema nativo.');
            }
          });
          return;
        }
    }
    
    if (platformUrl) window.open(platformUrl, '_blank');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video');
      
      if (isVideo) {
        if (file.size > 750 * 1024) {
          toast.error('Mídia recusada: Vídeos diretos devem ter menos de 750KB por limite do Firestore. Insira um "Link da Web" para alta resolução!');
          return;
        }
        
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewMedia({ ...newMedia, url: reader.result as string, type: 'video' });
        };
        reader.readAsDataURL(file);
      } else {
        // It's an image
        toast.info('Otimizando imagem para compartilhamento...', { duration: 1500 });
        optimizeImageBeforeUpload(file, 800, 0.75)
          .then((compressed) => {
            setNewMedia({ ...newMedia, url: compressed, type: 'image' });
            toast.success('Imagem otimizada com sucesso!');
          })
          .catch((err) => {
            console.error('Failed to optimize image share:', err);
            const reader = new FileReader();
            reader.onloadend = () => {
              setNewMedia({ ...newMedia, url: reader.result as string, type: 'image' });
            };
            reader.readAsDataURL(file);
          });
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      await setDoc(doc(collection(db, 'dashboard_messages')), {
        text: newMessage,
        sender: user?.displayName || user?.email || 'Sistema',
        timestamp: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'dashboard_messages');
    }
  };

  const { todayBirthdays, upcomingBirthdays } = useMemo(() => {
    const birthdayData = (employees || [])
      .filter(emp => emp.birthDate && emp.status !== 'inactive')
      .map(emp => {
        let birth: Date;
        const dateStr = emp.birthDate!;
        const matchIso = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        const matchBr = dateStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        
        if (matchIso) {
          birth = new Date(parseInt(matchIso[1], 10), parseInt(matchIso[2], 10) - 1, parseInt(matchIso[3], 10));
        } else if (matchBr) {
          birth = new Date(parseInt(matchBr[3], 10), parseInt(matchBr[2], 10) - 1, parseInt(matchBr[1], 10));
        } else {
          birth = parseISO(dateStr);
        }

        if (isNaN(birth.getTime())) {
          return null;
        }

        const thisYearBirth = new Date(today.getFullYear(), birth.getMonth(), birth.getDate());
        
        let nextBirth = thisYearBirth;
        if (isBefore(thisYearBirth, today) && !isSameDay(thisYearBirth, today)) {
          nextBirth = new Date(today.getFullYear() + 1, birth.getMonth(), birth.getDate());
        }
        
        return { 
          ...emp, 
          birthMonth: birth.getMonth(),
          daysUntil: differenceInDays(nextBirth, today),
          isToday: isSameDay(thisYearBirth, today),
          formattedBirth: format(birth, "dd 'de' MMMM", { locale: ptBR })
        };
      })
      .filter((emp): emp is NonNullable<typeof emp> => emp !== null);

    const todayList = birthdayData.filter(emp => emp.isToday);
    const upcomingList = birthdayData
      .filter(emp => !emp.isToday)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      todayBirthdays: todayList,
      upcomingBirthdays: upcomingList
    };
  }, [employees, today]);

  return (
    <div className="space-y-10 pb-20 w-full max-w-7xl mx-auto p-3 sm:p-6 md:p-8 min-h-screen bg-gradient-to-b from-[#002fbe]/40 via-zinc-950/98 to-zinc-950 font-sans relative overflow-hidden rounded-[2rem] md:rounded-[3rem] border border-blue-500/10 shadow-2xl">
      {/* Decorative royal blue subtle lights */}
      <div className="absolute top-0 left-1/4 right-1/4 h-96 bg-[#002fbe]/25 blur-[150px] rounded-full pointer-events-none" />

      {/* Modal de Vídeo */}
      <AnimatePresence>
        {selectedVideo && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/95 backdrop-blur-md"
              onClick={handleCloseVideoModal}
            />
            {(() => {
              const containerWidth = mediaAspect === 'portrait' ? 'max-w-sm' : mediaAspect === 'square' ? 'max-w-md' : 'max-w-2xl';
              const aspectClass = mediaAspect === 'portrait' ? 'aspect-[9/16]' : mediaAspect === 'square' ? 'aspect-square' : 'aspect-video';
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 30 }}
                  className={cn(
                    "w-full bg-zinc-950/95 rounded-[2.5rem] overflow-hidden relative z-10 border border-white/5 shadow-[0_0_80px_rgba(0,0,0,0.9)] flex flex-col p-2",
                    containerWidth
                  )}
                >
                  {/* Sleek Header Bar styled like News Feed Header / App Window */}
                  <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-zinc-900/40">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
                      <span className="text-[8px] font-black text-white/50 uppercase tracking-[0.25em] font-mono">Destaque DM Turismo</span>
                    </div>
                    <button 
                      onClick={handleCloseVideoModal}
                      className="w-7 h-7 bg-white/5 hover:bg-white hover:text-zinc-950 text-white rounded-lg flex items-center justify-center transition-all border border-white/5 cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>

                  {/* Dynamic Aspect Media Container */}
                  <div className={cn("w-full relative overflow-hidden bg-zinc-950 flex items-center justify-center rounded-[2rem] mt-2", aspectClass)}>
                    {selectedVideo.type === 'image' || (!selectedVideo.type && (
                      selectedVideo.url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || 
                      selectedVideo.url.includes('images.unsplash.com') ||
                      selectedVideo.url.includes('imgur.com') ||
                      selectedVideo.url.startsWith('data:image/') ||
                      !(ReactPlayer as any).canPlay(selectedVideo.url)
                    )) ? (
                      <img 
                        src={selectedVideo.url} 
                        alt={selectedVideo.title || 'Destaque'} 
                        className="w-full h-full object-contain rounded-[2rem]"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          const parent = e.currentTarget.parentElement;
                          if (parent) {
                            const errEl = document.createElement('p');
                            errEl.className = 'text-zinc-500 font-black uppercase tracking-widest text-[10px] text-center p-4';
                            errEl.innerText = 'Impossível carregar a imagem externa. Link indisponível ou bloqueado.';
                            parent.appendChild(errEl);
                          }
                        }}
                      />
                    ) : (ReactPlayer as any).canPlay(selectedVideo.url) ? (
                      <ReactPlayer 
                        url={selectedVideo.url}
                        width="100%"
                        height="100%"
                        className="absolute inset-0 w-full h-full [&_video]:object-contain [&_iframe]:object-contain [&_img]:object-contain"
                        controls
                        playing={modalVideoPlaying}
                        playsinline
                        onError={(e) => {
                          console.error('Video Player Error:', e);
                          setModalVideoPlaying(false);
                        }}
                        {...({} as any)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Formato de mídia não suportado: {selectedVideo.url}</p>
                      </div>
                    )}
                  </div>

                  {/* Caption block styled in news format */}
                  {selectedVideo.title && (
                    <div className="px-6 py-4 mt-2 bg-gradient-to-t from-zinc-950 to-zinc-900/40 rounded-2xl border border-white/5">
                      <span className="text-[7px] font-black text-brand-accent uppercase tracking-widest mb-1.5 block">Legenda da mídia</span>
                      <p className="text-white font-bold uppercase tracking-wide text-[10px] leading-relaxed font-sans">
                        {selectedVideo.title}
                      </p>
                    </div>
                  )}
                </motion.div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* Visitor Expiration Alert */}
      {isVisitor && visitorExpired && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-8 bg-zinc-950 border-2 border-brand-accent/50 rounded-[2.5rem] flex flex-col items-center justify-center text-center space-y-4 shadow-2xl relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-brand-accent/5 opacity-5 animate-pulse" />
          <div className="w-16 h-16 bg-brand-accent/10 rounded-2xl flex items-center justify-center text-brand-accent mb-2">
             <Ghost size={32} className="animate-bounce" />
          </div>
          <div className="space-y-1">
             <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Acesso Expirado</h2>
             <p className="text-xs font-bold text-zinc-500 uppercase tracking-widest max-w-md">Seu período experimental de 15 dias como Visitante chegou ao fim. Entre em contato com a gestão para liberar um acesso permanente.</p>
          </div>
          <button 
            onClick={() => window.open('https://wa.me/5511999999999', '_blank')}
            className="px-8 py-3 bg-brand-accent text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-white transition-all shadow-xl shadow-brand-accent/20"
          >
            Falar com Atendimento
          </button>
        </motion.div>
      )}

      {/* 1. Apresentação de Boas-Vindas */}
      <Card3D className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 bg-zinc-950/40 border border-white/10 p-6 sm:p-10 rounded-[2rem] sm:rounded-[3rem] relative overflow-hidden group backdrop-blur-md shadow-2xl hover:border-[#D4AF37]/30">
        <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none group-hover:opacity-20 transition-opacity">
           <img 
             src="https://images.unsplash.com/photo-1549317661-bd38cea8ce65?auto=format&fit=crop&q=60&w=500" 
             alt="Bus Decoration" 
             className="w-full h-full object-contain object-right"
             loading="lazy"
             decoding="async"
           />
        </div>

        <div className="space-y-4 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-accent/10 border border-brand-accent/20 rounded-full">
            <div className="w-2 h-2 bg-brand-accent rounded-full animate-pulse shadow-brand" />
            <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest leading-none">Painel de Controle Ativo</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl md:text-6xl font-black text-white uppercase tracking-tighter font-display leading-none">
              BEM-VINDO, <span className="text-brand-accent italic">{user?.displayName?.split(' ')[0] || 'GESTOR'}</span>
            </h1>
            <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-8 pt-2">
              <p className="text-zinc-500 font-black uppercase tracking-[0.4em] text-[10px] opacity-70">
                {format(currentTime, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              <div className="flex items-center gap-3 bg-zinc-950/50 px-4 py-2 rounded-2xl border border-white/5 backdrop-blur-md">
                <Clock size={14} className="text-brand-accent animate-pulse" />
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-white tabular-nums tracking-tighter">
                    {format(currentTime, "HH:mm")}
                  </span>
                  <span className="text-[10px] font-black text-brand-accent tabular-nums uppercase">
                    {format(currentTime, "ss")}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 relative z-10">
                <div className="flex items-center gap-3 bg-zinc-950/50 border border-white/5 px-4 py-2 rounded-2xl backdrop-blur-md">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <p className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{vehicles.length} Veículos na Base</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card3D>





      {/* 2. Vídeos Destaque */}
      <motion.div 
        ref={videosRef} 
        className="min-h-[150px]"
        initial={{ opacity: 0, y: 20 }}
        animate={videosVisible ? { opacity: 1, y: 0 } : {}}
      >
        {videosVisible ? (
          <FeaturedVideosSection 
            videos={featuredVideos}
            onDelete={handleDeleteFeaturedVideo}
            onAdd={handleAddFeaturedVideo}
            isAdmin={isAdministrative}
            onPlay={(v) => setSelectedVideo(v)}
          />
        ) : (
          <div className="bg-zinc-900/10 border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center text-center h-48 animate-pulse">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mb-3" />
            <p className="text-[10px] text-zinc-650 font-black uppercase tracking-widest">Vídeos em Destaque (Otimizado)</p>
          </div>
        )}
      </motion.div>

      {/* Seção Especial de Aniversariantes */}
      <motion.div 
        ref={birthdaysRef} 
        initial={{ opacity: 0, y: 20 }}
        animate={birthdaysVisible ? { opacity: 1, y: 0 } : {}}
        className={cn(
          "bg-zinc-950/40 rounded-[2rem] sm:rounded-[3rem] border border-white/10 p-5 sm:p-8 md:p-10 backdrop-blur-md relative overflow-hidden space-y-8 animate-in fade-in duration-500 min-h-[350px] shadow-2xl",
          !birthdaysVisible && "flex flex-col items-center justify-center animate-pulse"
        )}
      >
        {birthdaysVisible ? (
          <div className="relative w-full space-y-8">
            {/* Confetes Interativos do Mural */}
            {muralConfettis.map((c) => (
              <motion.div
                key={c.id}
                initial={{ x: c.x, y: c.y, scale: 0.1, opacity: 1, rotate: 0 }}
                animate={{ 
                  x: c.x + Math.cos(c.angle * (Math.PI / 180)) * 140 * (0.4 + Math.random() * 0.6), 
                  y: c.y + Math.sin(c.angle * (Math.PI / 180)) * 140 * (0.4 + Math.random() * 0.6) - 90,
                  scale: [1, 1.4, 0.3],
                  opacity: [1, 1, 0],
                  rotate: c.rotation + 360
                }}
                transition={{ duration: 1.4, ease: "easeOut" }}
                className="absolute pointer-events-none z-50 rounded-sm shadow-sm"
                style={{ 
                  backgroundColor: c.color, 
                  width: c.size, 
                  height: c.size,
                }}
              />
            ))}

            <div className="absolute top-0 right-0 p-12 opacity-[0.02] pointer-events-none">
              <Cake size={180} className="text-white rotate-12" />
            </div>

            {/* Header da Seção */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-accent/10 rounded-2xl border border-brand-accent/20 text-brand-accent">
                  <Cake size={20} className="animate-bounce" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider font-display">Mural de Aniversários</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">Homenagem festiva dos colaboradores • DM Turismo</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[8px] font-black px-3 py-1 bg-zinc-950 text-brand-accent border border-white/5 rounded-full uppercase tracking-widest font-mono">
                  ANIVERSARIANTES ATIVOS: {todayBirthdays.length + upcomingBirthdays.length}
                </span>
                <button
                  type="button"
                  onClick={() => setShowBirthdaysList(!showBirthdaysList)}
                  className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 rounded-xl text-[8.5px] font-black uppercase tracking-widest text-white hover:text-brand-accent flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
                >
                  {showBirthdaysList ? (
                    <>
                      <EyeOff size={11} />
                      Esconder Lista
                    </>
                  ) : (
                    <>
                      <Eye size={11} />
                      Exibir Lista
                    </>
                  )}
                </button>
              </div>
            </div>

            {showBirthdaysList ? (
              <>
                {/* 1. EM CIMA: DESTAQUE DO DIA */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-brand-accent rounded-full animate-ping" />
                    <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest font-sans">
                      {todayBirthdays.length > 0 ? "🎉 Aniversariante(s) de Hoje - Em Destaque!" : "🎈 Sem Aniversariantes Hoje"}
                    </h4>
                  </div>

                  {todayBirthdays.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {todayBirthdays.map((emp) => (
                        <Card3D 
                          key={emp.id}
                          className="relative bg-gradient-to-b from-zinc-950 to-zinc-900 border-2 border-[#D4AF37] rounded-[2.5rem] p-6 flex flex-col items-center text-center space-y-4 shadow-2xl overflow-hidden shadow-[#D4AF37]/10"
                        >
                          <div className="absolute inset-0 bg-gradient-to-b from-brand-accent/[0.04] to-transparent rounded-[2.5rem] pointer-events-none" />
                          <div className="absolute top-2 w-48 h-48 rounded-full bg-[#D4AF37]/15 blur-3xl pointer-events-none -translate-y-10 animate-pulse" />

                          <div className="absolute top-4 right-6 bg-[#D4AF37] text-zinc-950 px-3.5 py-1 text-[8.5px] font-black uppercase tracking-widest rounded-full shadow-lg border border-white/10 flex items-center gap-1.5 animate-pulse">
                            <Sparkles size={10} /> É Hoje!
                          </div>

                          {/* Foto Grande */}
                          <div className="relative mt-2">
                            <div className="w-32 h-32 md:w-36 md:h-36 rounded-[2.5rem] border-4 border-brand-accent overflow-hidden bg-zinc-900 relative transition-transform duration-500 hover:scale-105 group shadow-[0_10px_30px_rgba(255,107,0,0.25)]">
                              {emp.photoUrl ? (
                                <img 
                                  src={emp.photoUrl} 
                                  alt={emp.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
                                  <button 
                                    type="button"
                                    onClick={() => setTargetBirthdayEmployee(emp)}
                                    className="focus:outline-none flex flex-col items-center gap-1 group cursor-pointer"
                                  >
                                    <Plus size={32} className="text-zinc-650 group-hover:text-white transition-colors" />
                                    <span className="text-[8px] font-black text-zinc-670 group-hover:text-white transition-colors tracking-widest">ADD FOTO</span>
                                  </button>
                                </div>
                              )}
                              {emp.photoUrl && (
                                <button 
                                  type="button"
                                  onClick={() => setTargetBirthdayEmployee(emp)}
                                  className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 cursor-pointer w-full h-full focus:outline-none border-none duration-250"
                                >
                                  <Plus size={20} className="text-white" />
                                  <span className="text-[8px] font-black text-white uppercase tracking-widest">Alterar Foto</span>
                                </button>
                              )}
                            </div>
                            <div className="absolute -bottom-2 -right-2 bg-brand-accent text-zinc-950 w-10 h-10 rounded-2xl flex items-center justify-center shadow-lg transform rotate-6 border-2 border-zinc-950">
                              <Cake size={18} />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <h4 className="font-black text-xl text-white uppercase tracking-tight font-display">{emp.name}</h4>
                            <span className="text-[8px] font-black px-2 py-0.5 bg-brand-accent/10 text-brand-accent rounded-full uppercase tracking-widest border border-brand-accent/10 inline-block">{emp.role}</span>
                          </div>

                          {/* Ações de comemoração */}
                          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 z-10 w-full pt-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                triggerCardConfetti(e);
                                toast.success(`Parabéns enviado para ${emp.name}! 🎉`, { duration: 1500 });
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-brand-accent/10 hover:bg-brand-accent/25 border border-brand-accent/20 text-brand-accent hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95 animate-pulse"
                            >
                              <Sparkles size={11} className="shrink-0 animate-spin" />
                              Celebrar!
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                const defaultMsg = `Olá, ${emp.name}! 🎂 Passando para desejar um feliz aniversário! Nós da equipe DM Turismo lhe desejamos um dia fantástico, muito sucesso, saúde e realizações. Parabéns! 🎉`;
                                const cleanedPhone = emp.phone ? emp.phone.replace(/\D/g, '') : '';
                                const url = cleanedPhone
                                  ? `https://wa.me/55${cleanedPhone}?text=${encodeURIComponent(defaultMsg)}`
                                  : `https://wa.me/?text=${encodeURIComponent(defaultMsg)}`;
                                window.open(url, '_blank');
                              }}
                              className="w-full sm:w-auto px-4 py-2 bg-green-500/15 hover:bg-green-500 hover:text-zinc-950 border border-green-500/20 text-green-400 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-95"
                            >
                              <MessageSquare size={11} className="shrink-0" />
                              WhatsApp
                            </button>
                          </div>

                          <p className="text-[10px] text-zinc-450 font-medium leading-relaxed max-w-xs pt-1.5 border-t border-white/5 w-full">
                            Hoje completamos mais um ciclo de parceria e orgulho. <span className="text-zinc-350">A DM Turismo valoriza cada membro de sua frota e equipe!</span>
                          </p>
                        </Card3D>
                      ))}
                    </div>
                  ) : (
                    <div className="bg-gradient-to-r from-zinc-950/60 to-zinc-950/20 border border-dashed border-zinc-800 rounded-[2.5rem] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-zinc-900 border border-white/5 rounded-2xl text-zinc-550 shrink-0">
                          <Cake size={18} />
                        </div>
                        <div>
                          <h5 className="font-extrabold text-xs text-zinc-400 uppercase tracking-wider">Nenhum Celebrante Hoje</h5>
                          <p className="text-[9px] text-zinc-550 uppercase tracking-widest font-medium leading-normal">Toda a equipe está operacional e aguardando as próximas datas de aniversário.</p>
                        </div>
                      </div>
                      {upcomingBirthdays.length > 0 && (
                        <div className="bg-zinc-900/60 border border-white/5 px-4 py-3 rounded-2xl flex items-center gap-3 self-stretch sm:self-auto shrink-0">
                          <Clock size={14} className="text-brand-accent animate-pulse" />
                          <div className="text-left">
                            <span className="text-[8px] font-semibold text-zinc-500 block uppercase tracking-wider">Próximo na Sequência:</span>
                            <span className="text-[10.5px] font-black text-white uppercase font-sans">{upcomingBirthdays[0].name} (em {upcomingBirthdays[0].daysUntil} {upcomingBirthdays[0].daysUntil === 1 ? 'dia' : 'dias'})</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* 2. EM BAIXO: SEQUÊNCIA ATÉ O ÚLTIMO */}
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block font-sans">
                      📆 Sequência de Aniversários (Do Próximo até o Último)
                    </span>
                    <span className="text-[8px] font-black px-2.5 py-1 bg-zinc-950 text-brand-accent border border-white/5 rounded-full uppercase tracking-widest font-mono">
                      Próximos em fila ({upcomingBirthdays.length})
                    </span>
                  </div>

                  {upcomingBirthdays.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 pt-2">
                      {upcomingBirthdays.map((emp, idx) => {
                        const rotateClasses = [
                          '-rotate-1 hover:rotate-0 hover:-translate-y-2',
                          'rotate-1 hover:rotate-0 hover:-translate-y-2',
                          '-rotate-2 hover:rotate-0 hover:-translate-y-2',
                          'rotate-2 hover:rotate-0 hover:-translate-y-2'
                        ];
                        const rotateClass = rotateClasses[idx % rotateClasses.length];

                        return (
                          <Card3D 
                            key={emp.id} 
                            className={cn(
                              "relative bg-zinc-950 border border-white/10 p-3 pt-4 pb-5 rounded-lg shadow-xl shadow-black/8 w-full transition-all duration-300 flex flex-col items-center justify-between min-h-[235px] hover:border-[#D4AF37]/30",
                              rotateClass
                            )}
                          >
                            <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-3.5 bg-neutral-100/10 backdrop-blur-sm border-x border-white/5 rotate-[-2deg] opacity-70 shadow-xs" />
                            
                            {/* Square frame */}
                            <div className="relative w-full aspect-square bg-zinc-900 border border-white/5 rounded-md overflow-hidden shrink-0 group">
                              {emp.photoUrl ? (
                                <img 
                                  src={emp.photoUrl} 
                                  alt={emp.name} 
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                                  referrerPolicy="no-referrer"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900 text-zinc-500 group-hover:text-zinc-350 transition-colors">
                                  <Cake size={16} className="mb-0.5 text-zinc-650" />
                                  <span className="text-[8px] font-black tracking-widest uppercase font-mono">{emp.name.split(' ')[0]}</span>
                                </div>
                              )}

                              {/* Easy hover administrative overlay */}
                              <button
                                type="button"
                                onClick={() => setTargetBirthdayEmployee(emp)}
                                className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[8px] font-black text-white uppercase tracking-widest cursor-pointer border-none"
                              >
                                <Plus size={14} />
                                FOTO
                              </button>
                            </div>

                            {/* Polaroid bottom notes */}
                            <div className="w-full text-center mt-3 space-y-1">
                              <h5 className="font-extrabold text-[11px] text-white uppercase tracking-tight truncate w-full" title={emp.name}>
                                {emp.name}
                              </h5>
                              <p className="text-[7px] font-black text-zinc-550 uppercase tracking-widest truncate w-full leading-none">
                                {emp.role}
                              </p>
                              <div className="pt-1.5 flex flex-col items-center justify-center gap-1">
                                <span className="text-[8px] font-black text-brand-accent/90 uppercase tracking-wider font-mono bg-brand-accent/5 px-2 py-0.5 rounded border border-brand-accent/10">
                                  {emp.formattedBirth}
                                </span>
                                <span className="text-[7.5px] font-extrabold text-zinc-400 block leading-none">
                                  Em {emp.daysUntil} {emp.daysUntil === 1 ? 'dia' : 'dias'}
                                </span>
                              </div>
                            </div>

                            {/* Action footer */}
                            <div className="mt-3.5 flex items-center justify-center gap-2 w-full pt-1.5 border-t border-white/5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  triggerCardConfetti(e);
                                  toast.success(`Você enviou um abraço para ${emp.name}! 🎉`, { duration: 1500 });
                                }}
                                className="p-1.5 bg-zinc-900 hover:bg-brand-accent/10 border border-white/5 hover:border-brand-accent/30 rounded-lg text-zinc-400 hover:text-brand-accent transition-colors cursor-pointer flex items-center justify-center active:scale-95"
                                title="Engajar Parabéns 🎉"
                              >
                                <Sparkles size={11} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const defaultMsg = `Olá, ${emp.name}! 🎂 Parabéns antecipado de aniversário! Que seja um mês de vitórias e realizações. Abraço! 🎈`;
                                  const cleanedPhone = emp.phone ? emp.phone.replace(/\D/g, '') : '';
                                  const url = cleanedPhone
                                    ? `https://wa.me/55${cleanedPhone}?text=${encodeURIComponent(defaultMsg)}`
                                    : `https://wa.me/?text=${encodeURIComponent(defaultMsg)}`;
                                  window.open(url, '_blank');
                                }}
                                className="p-1.5 bg-zinc-900 hover:bg-green-500/10 border border-white/5 hover:border-green-500/30 rounded-lg text-zinc-400 hover:text-green-400 transition-colors cursor-pointer flex items-center justify-center active:scale-95"
                                title="Felicitar via WhatsApp 💬"
                              >
                                <MessageSquare size={11} />
                              </button>
                            </div>
                          </Card3D>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-zinc-950/20 border border-dashed border-zinc-800 rounded-[2rem] p-8 flex items-center text-center justify-center min-h-[160px]">
                      <p className="text-[10px] text-zinc-550 uppercase tracking-widest font-sans">Nenhum colega cadastrado com data de nascimento ativa</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center text-center py-12 border border-dashed border-zinc-800/60 rounded-3xl bg-zinc-950/20">
                <Cake size={28} className="text-zinc-650 mb-3 animate-pulse" />
                <h5 className="font-extrabold text-xs text-zinc-450 uppercase tracking-wider">A lista de aniversariantes está oculta</h5>
                <p className="text-[9px] text-zinc-550 uppercase tracking-widest font-medium mt-1">Clique no botão "Exibir Lista" acima para visualizar</p>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center w-full h-48 py-8 animate-pulse">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mb-3" />
            <p className="text-[10px] text-zinc-650 font-black uppercase tracking-widest">Aniversariantes da Equipe (Otimizado)</p>
          </div>
        )}
      </motion.div>

      {/* 3. Mural de Avisos (Board) & Feed de Discussões Directa */}
      <div ref={feedRef} className="grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-[350px]">
        {feedVisible ? (
          <>
            {/* Mural da Diretoria (Avisos Importantes) */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              <span className="text-[10px] font-black text-zinc-550 uppercase tracking-[0.25em] block leading-none font-mono">Quadro de Avisos</span>
              <Card3D className="flex-1 bg-zinc-950/40 border border-white/10 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-8 md:p-10 flex flex-col justify-between relative overflow-hidden backdrop-blur-md shadow-2xl hover:border-[#D4AF37]/30">
                 <div className="space-y-4 relative z-10">
                    <div className="flex items-center gap-3 border-b border-white/5 pb-4">
                       <div className="p-2.5 bg-brand-accent/15 text-brand-accent rounded-xl border border-brand-accent/25">
                          <Bell size={18} />
                       </div>
                       <h4 className="text-sm font-black text-white uppercase tracking-widest">Comunicado Geral</h4>
                    </div>
                    {boardMessage ? (
                       <p className="text-zinc-350 font-medium leading-relaxed text-xs">
                         {boardMessage}
                       </p>
                    ) : (
                       <p className="text-zinc-600 font-bold uppercase tracking-widest text-[9px] py-4 italic">Nenhum aviso importante fixado no momento.</p>
                    )}
                 </div>
                 
                 {isAdministrative && (
                    <div className="pt-6 border-t border-white/5 mt-6 relative z-10">
                       <span className="text-[8px] font-black text-zinc-550 uppercase tracking-widest block mb-2.5">Novo Aviso / Comunicado</span>
                       <div className="flex gap-2">
                          <input 
                            type="text" 
                            name="board_input"
                            id="board_input"
                            defaultValue={boardMessage}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                try {
                                  await setDoc(doc(db, 'settings', 'dashboard'), {
                                    message: e.currentTarget.value,
                                    updatedAt: serverTimestamp(),
                                    updatedBy: user?.displayName || user?.email || 'Admin'
                                  });
                                  toast.success('Mural de avisos atualizado!');
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.WRITE, 'settings/dashboard');
                                }
                              }
                            }}
                            placeholder="Digite o aviso e pressione Enter..."
                            className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-700 outline-none focus:border-brand-accent/60 transition-all font-bold"
                          />
                       </div>
                    </div>
                 )}
              </Card3D>
            </div>

            {/* Fórum / Feed de Discussões Directa */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              <span className="text-[10px] font-black text-zinc-550 uppercase tracking-[0.25em] block leading-none font-mono">Discussões Operacionais</span>
              <Card3D className="flex-1 bg-zinc-950/40 border border-white/10 rounded-[2rem] sm:rounded-[3rem] p-5 sm:p-8 md:p-10 flex flex-col relative overflow-hidden backdrop-blur-md shadow-2xl hover:border-[#D4AF37]/30">
                 {/* Mensagens Recentes */}
                 <div className="flex-1 overflow-y-auto space-y-4 max-h-[350px] pr-2 custom-scrollbar">
                     {loadingMessages ? (
                        <div className="flex flex-col items-center justify-center h-48">
                           <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                        </div>
                     ) : messages.length > 0 ? (
                        messages.map((msg) => (
                           <div key={msg.id} className="group relative flex items-start gap-4 p-4 bg-zinc-950/40 hover:bg-zinc-950/80 rounded-2xl border border-white/5 transition-all">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center text-[11px] font-black text-brand-accent uppercase shrink-0">
                                 {msg.sender.charAt(0)}
                              </div>
                              <div className="flex-1 min-w-0">
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="text-[10px] font-black text-white uppercase tracking-tight truncate">{msg.sender}</span>
                                    <span className="text-[7.5px] font-black text-zinc-680 uppercase tracking-widest font-mono">
                                       {safeFormatDate(msg.timestamp, "HH:mm")}
                                    </span>
                                 </div>
                                 <p className="text-zinc-350 font-medium text-xs leading-normal pr-8 select-text">{msg.text}</p>
                              </div>
                              
                              {/* Excluir Mensagem */}
                              {(isAdministrative || (user && msg.sender === (user.displayName || user.email))) && (
                                <button 
                                  onClick={() => handleDeleteMessage(msg.id)}
                                  className="absolute right-4 top-4 opacity-0 group-hover:opacity-100 p-1.5 text-zinc-700 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg cursor-pointer transition-all border border-transparent hover:border-rose-500/20"
                                  title="Excluir Mensagem"
                                >
                                   <Trash2 size={12} />
                                </button>
                              )}
                           </div>
                        ))
                     ) : (
                        <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                           <p className="text-zinc-650 font-black uppercase tracking-widest text-[9px] max-w-[200px] leading-normal italic">Nenhuma mensagem registrada no fórum operacional.</p>
                        </div>
                     )}
                 </div>

                 {/* Enviar Nova Mensagem */}
                 <form onSubmit={handleSendMessage} className="pt-6 border-t border-white/5 mt-6 flex gap-3">
                     <input 
                       type="text" 
                       value={newMessage}
                       onChange={(e) => setNewMessage(e.target.value)}
                       placeholder="Discuta algo com a equipe profissional..."
                       className="flex-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs text-white placeholder-zinc-700 outline-none focus:border-brand-accent transition-all font-bold"
                     />
                     <button 
                       type="submit"
                       className="px-6 bg-brand-accent hover:bg-white text-zinc-950 rounded-2xl flex items-center justify-center transition-all cursor-pointer active:scale-95 border-none shadow-lg shadow-brand-accent/10"
                     >
                       <Send size={14} className="stroke-[2.5]" />
                     </button>
                 </form>
              </Card3D>
            </div>
          </>
        ) : (
          <div className="lg:col-span-12 bg-zinc-900/10 border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center text-center h-48 animate-pulse">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mb-3" />
            <p className="text-[10px] text-zinc-650 font-black uppercase tracking-widest">Feed DM Turismo (Otimizado)</p>
          </div>
        )}
      </div>

      {/* 5. Informativo DM Turismo */}
      <div ref={newsRef} className="space-y-6 pt-10 border-t border-white/5 min-h-[300px]">
        {newsVisible ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                  <Newspaper className="text-brand-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider font-display">Informativo DM Turismo</h3>
                  <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1 opacity-70">Comunicados oficiais e notícias da empresa</p>
                </div>
              </div>
              {canShare && (
                <button 
                  onClick={() => setIsAddingNews(!isAddingNews)}
                  className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 border border-white/5 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-zinc-800 active:scale-95 shadow-xl glass-effect"
                >
                  {isAddingNews ? <Plus size={14} className="rotate-45" /> : <Newspaper size={14} />}
                  Nova Notícia
                </button>
              )}
            </div>

            {isAddingNews && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 sm:p-8 bg-zinc-950/85 border border-zinc-800 rounded-[2rem] sm:rounded-[3rem] space-y-6 shadow-2xl relative"
              >
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Título da Notícia</label>
                      <input 
                       type="text"
                       value={newNews.title}
                       onChange={(e) => setNewNews({...newNews, title: e.target.value})}
                       placeholder="EX: Nova Unidade em São Paulo Inaugurada..."
                       className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-brand-accent transition-all"
                      />
                      <label className="text-[10px] font-black text-zinc-550 uppercase tracking-widest">URL da Imagem (Opcional)</label>
                      <input 
                       type="text"
                       value={newNews.imageUrl}
                       onChange={(e) => setNewNews({...newNews, imageUrl: e.target.value})}
                       placeholder="https://imagem.da.noticia.jpg"
                       className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-brand-accent transition-all"
                      />
                      <div className="flex items-center gap-3 pt-2">
                         <input 
                           type="checkbox" 
                           id="urgent"
                           checked={newNews.isUrgent}
                           onChange={(e) => setNewNews({...newNews, isUrgent: e.target.checked})}
                           className="w-4 h-4 accent-amber-500" 
                         />
                         <label htmlFor="urgent" className="text-[10px] font-black text-amber-500 uppercase tracking-widest font-mono">Notícia Urgente?</label>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Conteúdo</label>
                      <textarea 
                       value={newNews.content}
                       onChange={(e) => setNewNews({...newNews, content: e.target.value})}
                       placeholder="Detalhes da notícia..."
                       className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-xs font-bold text-white h-[180px] resize-none transition-all focus:border-brand-accent"
                      />
                    </div>
                 </div>
                 <div className="flex justify-end pt-4 border-t border-zinc-800">
                   <button 
                     onClick={handleShareNews}
                     className="px-12 py-4 bg-brand-accent text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-brand-accent/20"
                   >Publicar Notícia</button>
                 </div>
              </motion.div>
            )}

            {newsItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {newsItems.map((news) => (
                     <Card3D 
                       key={news.id}
                       className={cn(
                         "bg-zinc-900/60 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col group hover:border-brand-accent/30 transition-all backdrop-blur-sm",
                         news.isUrgent && "border-amber-500/30 bg-amber-500/5 shadow-[0_0_50px_rgba(245,158,11,0.05)]"
                       )}
                     >
                       {news.imageUrl && (
                          <div className="h-48 overflow-hidden grayscale group-hover:grayscale-0 transition-all duration-700">
                             <img 
                               src={news.imageUrl} 
                               alt={news.title} loading="lazy" decoding="async"
                               className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                               referrerPolicy="no-referrer"
                             />
                          </div>
                       )}
                       <div className="p-8 flex-1 flex flex-col">
                          <div className="flex items-center justify-between mb-4">
                             <span className="text-[8px] font-black text-brand-accent uppercase tracking-[0.2em] opacity-70">Informativo oficial</span>
                             <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest">
                               {safeFormatDate(news.createdAt, "dd/MM/yyyy")}
                             </span>
                          </div>
                          {news.isUrgent && (
                            <div className="mb-4 flex items-center gap-2 px-3 py-1 bg-amber-500/10 rounded-full w-fit border border-amber-500/20">
                              <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse shadow-amber" />
                              <span className="text-[9px] font-black text-amber-500 uppercase tracking-widest">Urgente</span>
                            </div>
                          )}
                          <h4 className="text-lg font-black text-white uppercase tracking-tighter mb-4 group-hover:text-brand-accent transition-colors font-display leading-tight">
                            {news.title}
                          </h4>
                          <p className="text-[13px] text-zinc-400 font-medium leading-relaxed line-clamp-4 flex-1">
                            {news.content}
                          </p>
                          <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between">
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-xl bg-zinc-950 flex items-center justify-center border border-white/5 overflow-hidden shadow-inner">
                                   <UserIcon size={14} className="text-zinc-650" />
                                </div>
                                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">{news.authorName}</span>
                             </div>
                             <div className="flex items-center gap-2">
                                {(isAdministrative || (user && news.authorId === user.uid)) && (
                                  <button 
                                    onClick={() => handleDeleteNews(news.id)}
                                    className="p-2 text-zinc-700 hover:text-rose-500 transition-colors bg-zinc-950 rounded-lg border border-white/5"
                                    title="Excluir Notícia"
                                  >
                                     <Trash2 size={16} />
                                  </button>
                                )}
                             </div>
                          </div>
                       </div>
                     </Card3D>
                  ))}
              </div>
            ) : (
              <div className="bg-zinc-900/20 border border-dashed border-zinc-855 rounded-[2.5rem] p-12 flex flex-col items-center text-center justify-center min-h-[120px]">
                 <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Nenhuma notícia ou comunicado institucional disponível.</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-zinc-900/10 border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center text-center h-48 animate-pulse">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mb-3" />
            <p className="text-[10px] text-zinc-650 font-black uppercase tracking-widest">Informativo DM Turismo (Otimizado)</p>
          </div>
        )}
      </div>

      {/* 6. Mural de Fotos */}
      <div ref={mediaRef} className="space-y-6 pt-10 border-t border-white/5 min-h-[250px]">
        {mediaVisible ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-brand-accent/10 rounded-xl border border-brand-accent/20">
                  <Camera className="text-brand-accent" size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-wider font-display">Mural de Fotos</h3>
                  <p className="text-[10px] font-black text-zinc-550 uppercase tracking-widest mt-1 opacity-70">Momentos compartilhados em imagem pela equipe</p>
                </div>
              </div>
              {!isVisitor && !visitorExpired && (
                <button 
                  onClick={() => { setIsAddingMedia(!isAddingMedia); setNewMedia(prev => ({ ...prev, type: 'image' })); }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-brand-accent/20 travel-button"
                >
                  {isAddingMedia && newMedia.type === 'image' ? <Plus size={14} className="rotate-45" /> : <Camera size={14} />}
                  Compartilhar Foto
                </button>
              )}
            </div>

            {isAddingMedia && newMedia.type === 'image' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="p-6 sm:p-8 bg-zinc-950/85 border border-zinc-800 rounded-[2rem] sm:rounded-[3rem] space-y-6 shadow-2xl relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-8 opacity-5">
                   <Share2 size={120} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Upload ou Link Direto da Imagem</label>
                    <div className="relative group">
                      <input 
                        type="text"
                        value={newMedia.url}
                        onChange={(e) => setNewMedia({...newMedia, url: e.target.value, type: 'image'})}
                        placeholder="Cole o link da imagem ou use o botão à direita"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-brand-accent pr-32"
                      />
                      <label className="absolute right-2 top-2 bottom-2 px-4 bg-zinc-900 hover:bg-brand-accent text-white hover:text-zinc-950 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all border border-white/5 active:scale-95 group-hover:border-brand-accent/50">
                        <Upload size={14} />
                        <span className="text-[9px] font-black uppercase tracking-widest">Upload</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
                      </label>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-zinc-550 uppercase tracking-widest">Legenda / Descrição</label>
                    <textarea 
                      value={newMedia.caption}
                      onChange={(e) => setNewMedia({...newMedia, caption: e.target.value})}
                      placeholder="Compartilhe algo sobre este registro..."
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6 text-xs font-bold text-white h-[100px] resize-none focus:border-brand-accent"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-4 border-t border-zinc-800">
                   <button 
                     onClick={handleShareMedia}
                     className="px-12 py-4 bg-brand-accent text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl shadow-brand-accent/20 active:scale-95"
                   >
                     Compartilhar Foto
                   </button>
                </div>
              </motion.div>
            )}

            {imageShares.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                 {imageShares.map((media) => (
                    <motion.div 
                      key={media.id}
                      layoutId={media.id}
                      className="group relative aspect-square bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden hover:border-brand-accent/50 transition-all cursor-pointer shadow-xl"
                      onClick={() => setSelectedVideo({ url: media.url, title: media.caption, type: 'image' })}
                    >
                        <img 
                          src={media.url} 
                          alt={media.caption} loading="lazy" decoding="async" 
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity p-4 flex flex-col justify-end">
                           <p className="text-[10px] font-bold text-white line-clamp-2 mb-2 leading-tight">{media.caption}</p>
                           <div className="flex items-center justify-between gap-1">
                              <span className="text-[8px] font-black text-brand-accent uppercase truncate mr-1">{media.ownerName}</span>
                              <div className="flex items-center gap-1.5 shrink-0 z-10">
                                <button 
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    navigator.clipboard.writeText(media.url);
                                    toast.success('Link da imagem em resolução original copiado!');
                                  }}
                                  className="p-1.5 bg-brand-accent/20 hover:bg-brand-accent text-brand-accent hover:text-zinc-950 rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                  title="Copiar link na resolução normal/original"
                                >
                                   <LinkIcon size={12} />
                                </button>
                                {(isAdministrative || (user && media.ownerId === user.uid)) && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteMedia(media.id); }}
                                    className="p-1.5 bg-rose-500/20 hover:bg-rose-500 text-rose-500 hover:text-white rounded-lg transition-all flex items-center justify-center cursor-pointer"
                                    title="Excluir Mídia"
                                  >
                                     <Trash2 size={12} />
                                  </button>
                                )}
                              </div>
                           </div>
                        </div>
                    </motion.div>
                 ))}
              </div>
            ) : (
              <div className="bg-zinc-900/20 border border-dashed border-zinc-850 rounded-[2.5rem] p-12 flex flex-col items-center text-center justify-center min-h-[120px]">
                 <p className="text-xs text-zinc-550 font-bold uppercase tracking-widest">Nenhuma foto compartilhada no Mural de fotos.</p>
              </div>
            )}
          </>
        ) : (
          <div className="bg-zinc-900/10 border border-white/5 rounded-[3rem] p-8 flex flex-col items-center justify-center text-center h-48 animate-pulse">
            <Loader2 className="w-6 h-6 text-zinc-700 animate-spin mb-3" />
            <p className="text-[10px] text-zinc-650 font-black uppercase tracking-widest">Mural de Fotos (Otimizado)</p>
          </div>
        )}
      </div>

      {/* Confirm Registration Deletion */}
      <ConfirmModal 
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, isOpen: false })}
        onConfirm={processDelete}
        title={`Excluir ${deleteConfirm.type === 'media' ? 'Mídia' : deleteConfirm.type === 'news' ? 'Notícia' : 'Mensagem'}`}
        message="Tem certeza que deseja remover este item? Esta ação não poderá ser desfeita e removerá os dados permanentemente do servidor."
      />

      {/* Modal Customizado para Alteração de Foto do Aniversariante */}
      <Modal 
        isOpen={!!targetBirthdayEmployee} 
        onClose={() => { 
          setTargetBirthdayEmployee(null); 
          stopBirthdayCamera(); 
          setBirthdayPhotoInput('');
        }} 
        title="Configurar Foto do Mural"
      >
        <div className="space-y-6 pt-2">
          {targetBirthdayEmployee && (
            <div className="flex items-center gap-4 p-4 bg-zinc-950/40 border border-zinc-850 rounded-2xl">
              <div className="w-12 h-12 rounded-xl border border-white/10 shrink-0 overflow-hidden bg-zinc-900">
                {targetBirthdayEmployee.photoUrl ? (
                  <img src={targetBirthdayEmployee.photoUrl} alt="Atual" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-zinc-650 bg-zinc-900 font-extrabold text-base">
                    {targetBirthdayEmployee.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-black text-sm text-white uppercase tracking-tight truncate">{targetBirthdayEmployee.name}</h4>
                <p className="text-[10px] font-black text-brand-accent/90 uppercase tracking-widest">{targetBirthdayEmployee.role}</p>
                {targetBirthdayEmployee.email && (
                  <p className="text-[9px] font-semibold text-zinc-500 font-mono lower-case truncate">{targetBirthdayEmployee.email}</p>
                )}
              </div>
            </div>
          )}

          {!birthdayShowCamera ? (
            <div className="space-y-4">
              {/* Opção para Excluir Foto Atual */}
              {targetBirthdayEmployee?.photoUrl && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest block font-mono">Remover Imagem / Limpar Foto</span>
                  <button
                    type="button"
                    onClick={async () => {
                      if (onUpdateEmployeePhoto && targetBirthdayEmployee) {
                        try {
                          await onUpdateEmployeePhoto(targetBirthdayEmployee.id, '');
                          toast.success('Foto removida do mural!');
                          setTargetBirthdayEmployee(null);
                        } catch (err) {
                           console.error(err);
                           toast.error('Erro ao remover foto.');
                        }
                      }
                    }}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-rose-500/10 hover:bg-rose-500 text-rose-550 hover:text-white border border-rose-500/20 hover:border-rose-500 rounded-2xl cursor-pointer transition-all active:scale-98 text-[11px] font-black uppercase tracking-widest font-sans"
                  >
                    <Trash2 size={14} className="shrink-0" />
                    Excluir Imagem do Mural
                  </button>
                </div>
              )}

              {/* Opção 1: Upload de Arquivo */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Dispositivo Local</span>
                <label className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-white text-zinc-355 hover:text-zinc-950 border border-zinc-800 rounded-2xl cursor-pointer transition-all active:scale-98 text-[11px] font-black uppercase tracking-widest">
                  <Upload size={14} className="shrink-0" />
                  Enviar do Computador ou Celular
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && targetBirthdayEmployee && onUpdateEmployeePhoto) {
                        toast.info('Otimizando imagem para o mural...', { duration: 1500 });
                        optimizeImageBeforeUpload(file, 400, 0.75)
                          .then(async (compressed) => {
                            await onUpdateEmployeePhoto(targetBirthdayEmployee.id, compressed);
                            toast.success('Foto enviada com sucesso!');
                            setTargetBirthdayEmployee(null);
                          })
                          .catch((err) => {
                            console.error('Failed to optimize image:', err);
                            toast.error('Erro ao processar imagem.');
                          });
                      }
                    }}
                  />
                </label>
              </div>

              {/* Opção 2: Câmera do Dispositivo */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Webcam / Câmera Integrada</span>
                <button
                  type="button"
                  onClick={startBirthdayCamera}
                  className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-brand-accent text-zinc-355 hover:text-zinc-955 border border-zinc-800 hover:border-brand-accent/55 rounded-2xl cursor-pointer transition-all active:scale-98 text-[11px] font-black uppercase tracking-widest"
                >
                  <Camera size={14} className="shrink-0" />
                  Capturar com a Câmera Integrada
                </button>
              </div>

              {/* Opção 3: Importar foto de usuário */}
              {targetBirthdayEmployee?.email && (
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block font-mono">Usuários do Sistema</span>
                  <button
                    type="button"
                    disabled={loadingProfilePhoto}
                    onClick={() => handleFetchBirthdayUserProfilePhoto(targetBirthdayEmployee)}
                    className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-brand-accent/15 border border-zinc-850 hover:border-brand-accent/40 text-zinc-350 hover:text-brand-accent rounded-2xl cursor-pointer transition-all active:scale-98 text-[11px] font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    <UserIcon size={14} className="shrink-0" />
                    {loadingProfilePhoto ? 'Buscando foto de perfil...' : 'Importar Foto de Perfil do Usuário'}
                  </button>
                </div>
              )}

              {/* Opção 4: Link Externo */}
              <div className="space-y-1.5">
                <span className="text-[9px] font-black text-zinc-555 uppercase tracking-widest block font-mono">Endereço da Web / Link Pronto</span>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    value={birthdayPhotoInput}
                    onChange={(e) => setBirthdayPhotoInput(e.target.value)}
                    placeholder="https://exemplo.com/mural-pronto.jpg"
                    className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white placeholder-zinc-700 outline-none focus:border-brand-accent/60 transition-all font-bold"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!birthdayPhotoInput.trim()) {
                        toast.error('Informe um link válido.');
                        return;
                      }
                      if (onUpdateEmployeePhoto && targetBirthdayEmployee) {
                        await onUpdateEmployeePhoto(targetBirthdayEmployee.id, birthdayPhotoInput.trim());
                        toast.success('Foto externa vinculada com sucesso!');
                        setBirthdayPhotoInput('');
                        setTargetBirthdayEmployee(null);
                      }
                    }}
                    className="px-4 bg-brand-accent text-zinc-950 rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          ) : (
            // Câmera aberta no modal
            <div className="space-y-4">
              <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-zinc-800 flex items-center justify-center">
                {birthdayCameraError ? (
                  <p className="text-zinc-555 text-[10px] font-black uppercase tracking-widest text-center px-4 leading-normal">{birthdayCameraError}</p>
                ) : (
                  <video 
                    ref={birthdayVideoRef} 
                    playsInline 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <canvas ref={birthdayCanvasRef} className="hidden" />

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={stopBirthdayCamera}
                  className="px-5 py-2.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer"
                >
                  Voltar
                </button>
                {!birthdayCameraError && (
                  <button
                    type="button"
                    onClick={() => captureBirthdayPhoto(targetBirthdayEmployee?.id)}
                    className="px-5 py-2.5 bg-brand-accent text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  >
                    Tirar Foto
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Menu de Ações Rápidas (Floating Action Button) - Modo Sombra Integrado */}
      <div className="fixed bottom-6 right-6 md:right-8 md:bottom-8 z-[80] flex flex-col items-end">
        {/* Backdrop escurecido e desfocado para foco visual */}
        <AnimatePresence>
          {isQuickActionsOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[75] transition-all"
              onClick={() => setIsQuickActionsOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Grupo de botões suspensos */}
        <div className="relative z-[80] flex flex-col items-end gap-3.5 select-none pointer-events-auto">
          <AnimatePresence>
            {isQuickActionsOpen && (
              <motion.div
                initial="hidden"
                animate="visible"
                exit="hidden"
                variants={{
                  visible: {
                    transition: {
                      staggerChildren: 0.05,
                      delayChildren: 0.05
                    }
                  },
                  hidden: {
                    transition: {
                      staggerChildren: 0.05,
                      staggerDirection: -1
                    }
                  }
                }}
                className="flex flex-col items-end gap-3.5 mb-2"
              >
                {/* Ação 1: Nova Viagem */}
                {onNewTrip && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 15, scale: 0.9 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                      onNewTrip();
                      setIsQuickActionsOpen(false);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="px-4 py-2 bg-zinc-955/95 border border-white/5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md opacity-90 group-hover:opacity-100 transition-opacity">
                      Nova Viagem
                    </span>
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-brand-accent shadow-xl hover:text-white transition-colors group-hover:border-brand-accent/40">
                      <Bus size={18} />
                    </div>
                  </motion.div>
                )}

                {/* Ação 2: Novo Abastecimento */}
                {onNewFuel && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 15, scale: 0.9 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                      onNewFuel();
                      setIsQuickActionsOpen(false);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="px-4 py-2 bg-zinc-955/95 border border-white/5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md opacity-90 group-hover:opacity-100 transition-opacity">
                      Novo Abastecimento
                    </span>
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-brand-accent shadow-xl hover:text-white transition-colors group-hover:border-brand-accent/40">
                      <Fuel size={18} />
                    </div>
                  </motion.div>
                )}

                {/* Ação 3: Nova O.S. */}
                {onNewMaintenance && (
                  <motion.div
                    variants={{
                      hidden: { opacity: 0, y: 15, scale: 0.9 },
                      visible: { opacity: 1, y: 0, scale: 1 }
                    }}
                    className="flex items-center gap-3 cursor-pointer group"
                    onClick={() => {
                      onNewMaintenance();
                      setIsQuickActionsOpen(false);
                    }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="px-4 py-2 bg-zinc-955/95 border border-white/5 rounded-xl text-white text-[10px] font-black uppercase tracking-widest shadow-xl backdrop-blur-md opacity-90 group-hover:opacity-100 transition-opacity">
                      Nova O.S. (Ordem de Serviço)
                    </span>
                    <div className="w-12 h-12 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-brand-accent shadow-xl hover:text-white transition-colors group-hover:border-brand-accent/40">
                      <Wrench size={18} />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Botão de Controle Principal */}
          <motion.button
            onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
            className="w-14 h-14 rounded-full bg-brand-accent text-zinc-950 flex items-center justify-center shadow-2xl shadow-brand-accent/20 hover:scale-105 active:scale-95 transition-all cursor-pointer relative overflow-hidden group border border-white/15"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {/* Background dynamic light flash */}
            <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 pointer-events-none" />
            
            <motion.div
              animate={{ rotate: isQuickActionsOpen ? 135 : 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="relative z-10 flex items-center justify-center"
            >
              <Plus size={24} className="stroke-[3]" />
            </motion.div>
          </motion.button>
        </div>
      </div>
    </div>
  );
});
