import React, { useState, useEffect, memo, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Bus, 
  Fuel, 
  Wrench, 
  Users,
  Package,
  LogOut,
  Calendar,
  TrendingUp,
  Briefcase,
  Bell,
  Share2,
  DollarSign,
  Plus,
  FileText,
  Sparkles,
  Bot as BotIcon,
  Route,
  Smartphone,
  SquareCheck,
  Clock,
  GraduationCap,
  Sun,
  Moon,
  Pin,
  PinOff,
  MessageSquare,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import { toast } from 'sonner';
import { hasPermission } from '../lib/permissions';

interface SidebarProps {
  isOpen: boolean;
  setIsOpen: (val: boolean) => void;
  activeSection: string;
  setActiveSection: (id: string) => void;
  profile: UserProfile | null;
  logout: () => void;
  vehicles?: any[];
  maintenance?: any[];
  trips?: any[];
  transactions?: any[];
  stock?: any[];
  charteredRoutes?: any[];
}

/**
 * Sidebar unificada com item centralizado para Gestão de Frota.
 * Versão Sombra (Shadow Version) com transição de spring, arrastar para fechar e puxar para atualizar.
 */
export const Sidebar = memo(({ 
  isOpen, 
  setIsOpen, 
  activeSection, 
  setActiveSection, 
  profile, 
  logout,
  vehicles = [],
  maintenance = [],
  trips = [],
  transactions = [],
  stock = [],
  charteredRoutes = []
}: SidebarProps) => {
  const runningRoutesCount = useMemo(() => {
    return charteredRoutes.filter(r => r.runState === 'running').length;
  }, [charteredRoutes]);

  const fleetAlertsCount = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    const vehiclesAlerts = vehicles.filter(v => {
      if (v.status === 'maintenance') return true;
      const expirations = [
        v.licenseExpiration,
        v.tourismLicenseExpiration,
        v.cadasturExpiration,
        v.anttExpiration,
        v.detroArtespExpiration,
        v.insuranceExpiration,
        v.tacografoExpiration
      ];
      return expirations.some(exp => exp && exp < today);
    }).length;

    const pendingLogs = maintenance.filter(m => m.status === 'pending').length;
    return vehiclesAlerts + pendingLogs;
  }, [vehicles, maintenance]);

  const { activeTripsCount, pendingOSCount } = useMemo(() => {
    let active = 0;
    let scheduled = 0;
    trips.forEach(t => {
      if (t.runState === 'running' || t.status === 'active') {
        active++;
      }
      if (t.status === 'scheduled') {
        scheduled++;
      }
    });
    return { activeTripsCount: active, pendingOSCount: scheduled };
  }, [trips]);

  const pendingFinanceCount = useMemo(() => {
    return transactions.filter(t => t.status === 'pending' || t.status === 'overdue').length;
  }, [transactions]);

  const lowStockCount = useMemo(() => {
    return stock.filter(s => {
      const quantity = parseFloat(s.quantity) || 0;
      const minQuantity = parseFloat(s.minQuantity) || 0;
      return quantity <= minQuantity;
    }).length;
  }, [stock]);

  const [pinnedSections, setPinnedSections] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('sidebar-pinned-sections') || '[]');
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('sidebar-pinned-sections', JSON.stringify(pinnedSections));
  }, [pinnedSections]);

  const togglePin = (e: React.MouseEvent, sectionId: string) => {
    e.stopPropagation();
    setPinnedSections(prev => 
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  // High contrast / dynamic theme mode
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme-contrast') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-mode');
    } else {
      root.classList.remove('light-mode');
    }
    localStorage.setItem('theme-contrast', theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    toast.success(nextTheme === 'light' ? 'Modo Luz (Alto Contraste) Ativado!' : 'Modo Escuro Ativado!', {
      description: nextTheme === 'light' 
        ? 'Interface otimizada para ambientes externos de alta luminosidade.' 
        : 'Interface clássica dark ativa.',
      duration: 3000,
    });
  };

  // Gestures Detection: Drag to close and Pull-to-Refresh
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchCurrentX, setTouchCurrentX] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [dragY, setDragY] = useState<number>(0);
  const [isPulling, setIsPulling] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const navRef = React.useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchCurrentX(e.targetTouches[0].clientX);

    // If we are at the top of scroll in the navigation list, allow pull to refresh
    if (navRef.current && navRef.current.scrollTop === 0) {
      setTouchStartY(e.targetTouches[0].clientY);
      setIsPulling(true);
    } else {
      setTouchStartY(null);
      setIsPulling(false);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchCurrentX(e.targetTouches[0].clientX);

    if (isPulling && touchStartY !== null) {
      const currentY = e.targetTouches[0].clientY;
      const diffY = currentY - touchStartY;
      if (diffY > 0) {
        // Logarithmic/resistant drag factor so it resists more as you drag further down
        const resistance = Math.min(diffY * 0.45, 90);
        setDragY(resistance);
      }
    }
  };

  const handleTouchEnd = () => {
    if (touchStartX !== null && touchCurrentX !== null) {
      const diffX = touchStartX - touchCurrentX;
      // Swipe left fallback
      if (diffX > 60) {
        setIsOpen(false);
        toast.success('Caixa lateral fechada!', {
          description: 'Você recolheu o menu deslizando o dedo.',
          duration: 2000,
        });
      }
    }

    if (isPulling && dragY > 65) {
      setIsRefreshing(true);
      toast.promise(
        new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
            window.location.reload();
          }, 1500);
        }),
        {
          loading: 'Atualizando aplicativo...',
          success: 'Aplicativo recarregado!',
          error: 'Falha ao atualizar.',
        }
      );
    }

    setTouchStartX(null);
    setTouchCurrentX(null);
    setTouchStartY(null);
    setIsPulling(false);
    setDragY(0);
  };

  const getBadgeInfo = (sectionId: string) => {
    switch (sectionId) {
      case 'fleet':
        return fleetAlertsCount > 0 ? {
          count: fleetAlertsCount,
          className: "bg-rose-500/15 text-rose-500 border border-rose-500/20 font-mono text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse"
        } : null;
      case 'trips':
        const totalTripsCount = activeTripsCount + runningRoutesCount;
        return totalTripsCount > 0 ? {
          count: totalTripsCount,
          className: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 font-mono text-[9px] font-black px-2 py-0.5 rounded-full animate-pulse"
        } : null;
      case 'os':
        return pendingOSCount > 0 ? {
          count: pendingOSCount,
          className: "bg-sky-500/15 text-sky-400 border border-sky-500/20 font-mono text-[9px] font-black px-2 py-0.5 rounded-full"
        } : null;
      case 'finance':
        return pendingFinanceCount > 0 ? {
          count: pendingFinanceCount,
          className: "bg-amber-500/15 text-amber-500 border border-amber-500/20 font-mono text-[9px] font-black px-2 py-0.5 rounded-full"
        } : null;
      case 'inventory':
        return lowStockCount > 0 ? {
          count: lowStockCount,
          className: "bg-red-500/15 text-red-500 border border-red-500/20 font-mono text-[9px] font-black px-2 py-0.5 rounded-full"
        } : null;
      default:
        return null;
    }
  };

  const allSections = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'trips', label: 'Trabalhos', icon: Route },
    { id: 'fleet', label: 'Frota', icon: Bus },
    { id: 'finance', label: 'Financeiros', icon: DollarSign },
    { id: 'fuel', label: 'Abastecimento', icon: Fuel },
    { id: 'criador', label: 'Criador', icon: Sparkles },
    { id: 'inventory', label: 'Almoxarifado', icon: Package },
    { id: 'gabinete', label: 'Gabinete', icon: Briefcase },
    { id: 'chamados', label: 'Chamados', icon: MessageSquare },
  ];

  // Filters sections based on roles/permissions
  const sections = allSections.filter(section => hasPermission(profile?.role, section.id, profile?.email, profile?.permissions, profile?.displayName));

  const sortedSections = useMemo(() => {
    const pinned = sections.filter(s => pinnedSections.includes(s.id));
    const unpinned = sections.filter(s => !pinnedSections.includes(s.id));
    return [...pinned, ...unpinned];
  }, [sections, pinnedSections]);

  const handleShareApp = async () => {
    const shareData = {
      title: 'DM Turismo',
      text: 'Inteligência Operacional de Alto Desempenho',
      url: window.location.origin,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        throw new Error('Web Share API not supported');
      }
    } catch (err) {
      try {
        await navigator.clipboard.writeText(window.location.origin);
        toast.success('Link de acesso copiado!', {
          description: 'O link foi copiado para sua área de transferência.',
          icon: '📋'
        });
      } catch (clipErr) {
        toast.error('Não foi possível compartilhar ou copiar o link.');
      }
    }
  };

  return (
    <div className="contents">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            key="sidebar-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-45 lg:hidden"
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.aside
            key="sidebar-aside"
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 26 }}
            drag="x"
            dragDirectionLock
            dragConstraints={{ left: -300, right: 0 }}
            dragElastic={{ left: 0.15, right: 0 }}
            onDragEnd={(event, info) => {
              // If dragged left past 80px or velocity is high negative, close the drawer
              if (info.offset.x < -80 || info.velocity.x < -200) {
                setIsOpen(false);
                toast.success('Caixa lateral fechada!', {
                  description: 'Você recolheu o menu deslizando o dedo.',
                  duration: 2000,
                });
              }
            }}
            className={cn(
              "fixed lg:sticky top-0 left-0 h-screen w-[280px] sm:w-[300px] shrink-0 bg-asphalt-950 border-r border-asphalt-800 z-50 flex flex-col overflow-hidden shadow-2xl touch-pan-y"
            )}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Pull to Refresh Indicator */}
            <div 
              className="absolute left-0 right-0 flex items-center justify-center pointer-events-none transition-all duration-200 z-[60]"
              style={{ 
                top: 15, 
                opacity: dragY > 15 ? 1 : 0,
                transform: `translateY(${Math.min(dragY - 45, 0)}px)` 
              }}
            >
              <div className="bg-asphalt-900/95 border border-white/10 rounded-full px-3.5 py-2 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.5)] flex items-center gap-2 backdrop-blur-md">
                <RefreshCw 
                  size={12} 
                  className={cn(
                    "text-brand-accent transition-transform duration-100", 
                    isRefreshing ? "animate-spin" : ""
                  )} 
                  style={{ transform: !isRefreshing ? `rotate(${dragY * 4.5}deg)` : undefined }} 
                />
                <span className="text-[8px] font-black uppercase text-brand-accent tracking-widest">
                  {dragY > 60 ? "Solte para atualizar" : "Puxe para atualizar"}
                </span>
              </div>
            </div>

            {/* Vertical pull layout offset */}
            <motion.div 
              animate={{ y: dragY }} 
              transition={isPulling ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 28 }}
              className="flex-1 flex flex-col min-h-0 relative z-10"
            >
              <div 
                className="p-8 flex items-center gap-4 cursor-pointer hover:bg-white/5 transition-colors border-b border-white/5"
                onClick={() => setIsOpen(false)}
              >
                <div className="w-12 h-12 bg-asphalt-900 border border-white/10 rounded-2xl flex items-center justify-center transform rotate-3 shadow-xl shrink-0 overflow-hidden group-hover:rotate-0 transition-transform">
                  <Bus className="w-7 h-7 text-brand-accent transform -rotate-3 group-hover:rotate-0 transition-transform" />
                </div>
                <div className="flex flex-col">
                  <span className="text-2xl font-black text-white tracking-tighter uppercase whitespace-nowrap leading-none font-display">DM Turismo</span>
                  <span className="text-[9px] font-medium text-zinc-400 lowercase tracking-normal italic mt-1 font-sans leading-none">prazer em viajar bem</span>
                  <span className="text-[8px] font-black text-sky-blue uppercase tracking-widest mt-1.5 opacity-60">Inteligência Operacional</span>
                </div>
                <div className="flex gap-2 ml-auto shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                     onClick={(e) => {
                       e.stopPropagation();
                       try {
                         localStorage.setItem('dmturismo_changelog_seen_v3', 'false');
                       } catch (err) {
                         console.error(err);
                       }
                       window.open('https://dm-turismo-874209116420.europe-west2.run.app', '_blank');
                       window.dispatchEvent(new CustomEvent('open-changelog'));
                     }}
                     className="text-[9px] font-black uppercase text-zinc-950 hover:bg-white transition-all bg-gradient-to-b from-[#FCD34D] to-[#D4AF37] border-t border-white/20 shadow-[0_2px_0_#856404] active:translate-y-[2px] active:shadow-none px-3 py-2 rounded-xl cursor-pointer">
                     Atualizar
                  </button>
                  <button
                     onClick={(e) => {
                       e.stopPropagation();
                       window.dispatchEvent(new CustomEvent('open-sync-settings'));
                     }}
                     className="text-[9px] font-black uppercase text-zinc-450 hover:text-brand-accent transition-all bg-asphalt-900 border border-white/5 hover:border-brand-accent/30 px-3 py-2 rounded-xl">
                     Config
                  </button>
                </div>
              </div>

              <nav 
                ref={navRef}
                className="flex-1 px-6 space-y-2 mt-2 overflow-y-auto custom-scrollbar sidebar-navigation"
              >
                {sortedSections.map((section) => {
                  const badge = getBadgeInfo(section.id);
                  const isPinned = pinnedSections.includes(section.id);
                  return (
                    <div key={section.id} className="relative group/item flex items-center">
                      <button
                        onClick={(e) => togglePin(e, section.id)}
                        className="absolute left-0 top-3.5 z-20 opacity-0 group-hover/item:opacity-100 p-1 text-zinc-600 hover:text-brand-accent transition-all"
                      >
                        {isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                      </button>
                      <button
                        onClick={() => {
                          setActiveSection(section.id);
                          setIsOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-4 pl-9 pr-5 py-3.5 lg:py-4 rounded-xl font-bold transition-all text-xs text-left justify-start group relative overflow-hidden",
                          activeSection === section.id 
                            ? "bg-zinc-800 text-brand-accent shadow-lg border border-zinc-700" 
                            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200"
                        )}
                      >
                        <section.icon 
                          size={20} 
                          strokeWidth={2.5} 
                          className={cn(
                            "transition-transform group-hover:scale-110 shrink-0",
                            activeSection === section.id ? "text-brand-accent" : "text-zinc-500 group-hover:text-zinc-300"
                          )} 
                        />
                        <span className="relative z-10 uppercase tracking-wider flex-1 truncate">{section.label}</span>
                        {badge && (
                          <span className={cn("relative z-10 shrink-0 select-none", badge.className)}>
                            {badge.count}
                          </span>
                        )}
                        {activeSection === section.id && (
                          <div className="ml-1 w-1 h-3 bg-brand-accent rounded-full shrink-0" />
                        )}
                        {isPinned && !activeSection && (
                          <div className="absolute right-2 top-2">
                             <Pin size={8} className="text-brand-accent" />
                          </div>
                        )}
                      </button>
                    </div>
                  );
                })}

                <div className="pt-4 mt-4 border-t border-asphalt-800/50" />
              </nav>

              <div className="p-6 bg-asphalt-900/50 backdrop-blur-md border-t border-white/5 mt-auto">
                {/* Box de Perfil com Seletor de Contraste Integrado */}
                <div className="flex items-center justify-between p-3.5 bg-asphalt-900 border border-white/5 rounded-2xl mb-6 group cursor-pointer hover:bg-asphalt-800 transition-all shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <img 
                      src={profile?.photoURL || `https://ui-avatars.com/api/?name=${profile?.displayName}`} 
                      className="w-10 h-10 rounded-xl border border-white/10 shadow-md grayscale group-hover:grayscale-0 transition-all shrink-0"
                      alt="Avatar"
                    />
                    <div className="overflow-hidden">
                      <p className="text-xs font-black text-white truncate leading-none mb-1.5 uppercase tracking-tight">{profile?.displayName}</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-pulse" />
                        <p className="text-[9px] text-zinc-500 uppercase font-black tracking-[0.1em]">{profile?.role}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Seletor de Contraste - Daylight Optimization */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTheme();
                    }}
                    className="p-2 ml-1 bg-asphalt-950 hover:bg-white/10 text-zinc-400 hover:text-brand-accent border border-white/5 rounded-xl transition-all hover:scale-105 active:scale-95 shadow-inner shrink-0"
                    title={theme === 'dark' ? 'Ativar Modo Luz (Contraste Elevado para Alta Luminosidade)' : 'Ativar Modo Escuro Regular'}
                  >
                    {theme === 'dark' ? (
                      <Sun size={15} className="text-brand-accent" />
                    ) : (
                      <Moon size={15} className="text-brand-accent" />
                    )}
                  </button>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={handleShareApp}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-4.5 sm:py-4 bg-asphalt-900 hover:bg-sky-blue text-zinc-400 hover:text-asphalt-950 rounded-2xl font-black text-[9px] transition-all active:scale-95 border border-white/5 hover:border-transparent uppercase tracking-widest group"
                  >
                    <Share2 size={16} strokeWidth={2.5} />
                    ID Digital
                  </button>
                  <button 
                    onClick={logout}
                    className="w-16 h-12 sm:h-auto flex items-center justify-center text-zinc-500 hover:text-rose-500 hover:bg-rose-500/5 bg-asphalt-900 rounded-2xl transition-all active:scale-95 border border-white/5 hover:border-rose-500/30 font-bold"
                    title="Sair"
                  >
                    <LogOut size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
});
