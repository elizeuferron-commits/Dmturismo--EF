import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  Newspaper, 
  Trash2, 
  X, 
  Search, 
  ShieldCheck, 
  ChevronRight, 
  Loader2, 
  AlertTriangle, 
  CheckCircle, 
  Info, 
  Plus, 
  Send,
  Sparkles,
  Megaphone
} from 'lucide-react';
import { UserProfile, MaintenanceLog, Vehicle } from '../types';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { toast } from 'sonner';
import { format, parseISO, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AlertsHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  realtimePendingUsers: UserProfile[];
  realtimeAllUsers: UserProfile[];
  handleRealtimeApprove: (targetUser: UserProfile, approve: boolean, customRole?: UserProfile['role']) => Promise<void>;
  handleUpdateUserRoleDirectly: (targetUser: UserProfile, newRole: UserProfile['role']) => Promise<void>;
  maintenance: MaintenanceLog[];
  vehicles: Vehicle[];
}

export const AlertsHubModal: React.FC<AlertsHubModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  realtimePendingUsers,
  realtimeAllUsers,
  handleRealtimeApprove,
  handleUpdateUserRoleDirectly,
  maintenance = [],
  vehicles = []
}) => {
  // Modal tabs: 'comunicados' | 'alertas' | 'solicitacoes'
  const isOwner = currentUser?.role === 'Dono / Proprietário' || 
                  (currentUser?.role as string) === 'Dono' || 
                  (currentUser?.role as string) === 'Proprietário' || 
                  currentUser?.role === 'Gestor de Frotas' ||
                  currentUser?.role === 'Coordenador Logístico' ||
                  currentUser?.role === 'Administrativo' ||
                  currentUser?.email === 'elizeuferron@gmail.com';
  const [activeTab, setActiveTab] = useState<'comunicados' | 'alertas' | 'solicitacoes'>(
    isOwner && realtimePendingUsers.length > 0 ? 'solicitacoes' : 'comunicados'
  );

  // Search filter for access center
  const [modalSearchTerm, setModalSearchTerm] = useState('');
  const [expandedRealtimeUid, setExpandedRealtimeUid] = useState<string | null>(null);

  // News feed state
  const [newsItems, setNewsItems] = useState<{
    id: string;
    title: string;
    content: string;
    imageUrl?: string;
    authorName: string;
    authorId: string;
    isUrgent?: boolean;
    createdAt: any;
  }[]>([]);
  const [loadingNews, setLoadingNews] = useState(true);

  // New announcement posting states
  const [isAddingNews, setIsAddingNews] = useState(false);
  const [newNews, setNewNews] = useState({ title: '', content: '', imageUrl: '', isUrgent: false });
  const [submittingNews, setSubmittingNews] = useState(false);

  // Fetch announcements from Firestore feed
  useEffect(() => {
    if (!isOpen) return;

    setLoadingNews(true);
    const unsubNews = dbCacheService.subscribeCollection('news_feed', (items: any[]) => {
      // Sort by createdAt desc manually as subscribeCollection doesn't guarantee order
      const sorted = [...items].sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const db_ = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return db_.getTime() - da.getTime();
      });

      const filteredItems = sorted.filter((item: any) => 
        !item.title?.toUpperCase().includes('ABASTECIMENTO') && 
        !item.content?.toUpperCase().includes('ABASTECIMENTO REGISTRADO')
      );
      setNewsItems(filteredItems);
      setLoadingNews(false);
    });

    return () => {
      unsubNews();
    };
  }, [isOpen]);

  // Handle posting a brand new official notice/announcement
  const handlePostNews = async () => {
    if (!newNews.title.trim() || !newNews.content.trim()) {
      toast.error('Preencha pelo menos o título e conteúdo do comunicado.');
      return;
    }

    try {
      setSubmittingNews(true);
      const newDocRef = doc(collection(db, 'news_feed'));
      await setDoc(newDocRef, {
        title: newNews.title,
        content: newNews.content,
        imageUrl: newNews.imageUrl || '',
        isUrgent: newNews.isUrgent,
        authorId: currentUser?.uid || 'system',
        authorName: currentUser?.displayName || 'Administrador',
        createdAt: new Date()
      });

      setNewNews({ title: '', content: '', imageUrl: '', isUrgent: false });
      setIsAddingNews(false);
      toast.success('Comunicado publicado com sucesso para toda a equipe!');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.WRITE, 'news_feed');
      toast.error('Falha ao registrar novo comunicado.');
    } finally {
      setSubmittingNews(false);
    }
  };

  const handleDeleteNews = async (id: string) => {
    if (!confirm('Deseja realmente remover este comunicado permanentemente?')) return;
    try {
      await deleteDoc(doc(db, 'news_feed', id));
      toast.success('Comunicado removido.');
    } catch (err: any) {
      handleFirestoreError(err, OperationType.DELETE, `news_feed/${id}`);
      toast.error('Erro ao remover comunicado.');
    }
  };

  // Build reactive list of urgent operational alerts to supply dynamic health insight
  const operationalAlerts = React.useMemo(() => {
    const alerts: {
      id: string;
      title: string;
      description: string;
      severity: 'high' | 'medium' | 'info';
      date?: string;
      category: string;
    }[] = [];

    // Overdue general maintenances
    const now = new Date();
    maintenance.forEach(m => {
      if (m.status === 'pending') {
        try {
          const schedDate = parseISO(m.scheduledDate);
          if (isAfter(now, schedDate)) {
            const vehicle = vehicles.find(v => v.id === m.vehicleId);
            alerts.push({
              id: `maint-overdue-${m.id}`,
              title: 'Ordem de Manutenção em Atraso',
              description: `A manutenção ${m.type === 'corrective' ? 'Corretiva' : 'Preventiva'} do veículo ${
                vehicle ? `${vehicle.plate.toUpperCase()} (${vehicle.model})` : 'desconhecido'
              } está agendada para ${format(schedDate, 'dd/MM/yyyy')} e encontra-se pendente de conclusão.`,
              severity: m.type === 'corrective' ? 'high' : 'medium',
              date: m.scheduledDate,
              category: 'Manutenção'
            });
          }
        } catch {
          // Skip invalid date
        }
      }
    });

    // Pending User Requests alerts for entire team
    if (realtimePendingUsers.length > 0) {
      alerts.push({
        id: 'system-pending-users',
        title: 'Novas Solicitações de Cadastro',
        description: `Existem ${realtimePendingUsers.length} colaborador(es) aguardando liberação de login administrativa no sistema.`,
        severity: 'medium',
        category: 'Controle de Acesso'
      });
    }

    // Standard road warnings and team tips/standard operation safety procedures
    alerts.push({
      id: 'default-warning-point',
      title: 'Controle Obrigatório de Jornada',
      description: 'Lembrete diário: Todos os motoristas devem assinalar o ponto digital precisamente ao iniciar, pausar e finalizar viagens fretadas.',
      severity: 'info',
      category: 'Segurança & RH'
    });

    alerts.push({
      id: 'default-warning-winter',
      title: 'Direção Defensiva Integrada',
      description: 'Condições meteorológicas variáveis. Redobrem a atenção no asfalto molhado e respeitem os limites regulamentares de velocidade.',
      severity: 'info',
      category: 'Trânsito'
    });

    return alerts;
  }, [maintenance, vehicles, realtimePendingUsers]);

  // Filter permission center list
  const filteredModalUsers = realtimeAllUsers.filter(u => {
    const matchesSearch = u.displayName?.toLowerCase().includes(modalSearchTerm.toLowerCase()) ||
                          u.email?.toLowerCase().includes(modalSearchTerm.toLowerCase());
    
    if (activeTab !== 'solicitacoes') return false;

    if (activeModalTab === 'pendentes') {
      return (u.role === 'Pendente de Liberação' || u.role === 'Aguardando Liberação') && matchesSearch;
    } else {
      return (u.role !== 'Pendente de Liberação' && u.role !== 'Aguardando Liberação') && matchesSearch;
    }
  });

  const [activeModalTab, setActiveModalTab] = useState<'pendentes' | 'historico'>('pendentes');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-950/85 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-zinc-90 w-full max-w-2xl h-[85vh] sm:h-[80vh] bg-zinc-900 border border-brand-accent/20 rounded-[2.5rem] shadow-2xl relative flex flex-col overflow-hidden"
      >
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 bg-zinc-850 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="p-6 sm:p-8 border-b border-white/5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent">
              <Bell className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest block">Atalhos Operacionais</span>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Alertas & Comunicados</h3>
            </div>
          </div>

          {/* Tab Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-zinc-950 p-1.5 rounded-2xl border border-white/5 gap-1.5">
            <button
              onClick={() => setActiveTab('comunicados')}
              className={`py-3 px-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'comunicados' 
                  ? 'bg-brand-accent text-zinc-950 shadow-md' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <Megaphone size={12} />
              <span>Notas & Comunicados ({newsItems.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('alertas')}
              className={`py-3 px-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'alertas' 
                  ? 'bg-brand-accent text-zinc-950 shadow-md' 
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-900/50'
              }`}
            >
              <AlertTriangle size={12} />
              <span>Sinal de Frota ({operationalAlerts.filter(a => a.severity !== 'info').length})</span>
            </button>

            {isOwner && (
              <button
                onClick={() => setActiveTab('solicitacoes')}
                className={`py-3 px-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeTab === 'solicitacoes' 
                    ? 'bg-brand-accent text-zinc-950 shadow-md animate-pulse border border-brand-accent/40' 
                    : 'text-zinc-450 hover:text-white hover:bg-zinc-900/50'
                }`}
              >
                <ShieldCheck size={12} />
                <span>Liberações ({realtimePendingUsers.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Dynamic Body Content */}
        <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-4">
          
          {/* TAB 1: NEWS AND COMPANY ANNOUNCEMENTS BULLETIN */}
          {activeTab === 'comunicados' && (
            <div className="space-y-4">
              {/* Creator Trigger: News Feed Posting */}
              {isOwner && (
                <div className="bg-zinc-950/40 p-4 border border-zinc-800 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center bg-zinc-950 px-3 py-1.5 rounded-xl">
                    <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest flex items-center gap-1">
                      <Sparkles size={11} /> Área Administrativa
                    </span>
                    <button 
                      onClick={() => setIsAddingNews(!isAddingNews)}
                      className="text-[9px] font-black text-zinc-400 hover:text-white uppercase tracking-widest flex items-center gap-1 transition-all cursor-pointer"
                    >
                      {isAddingNews ? 'Fechar Criador' : 'Escrever Quadro de Aviso'}
                    </button>
                  </div>

                  {isAddingNews && (
                    <div className="space-y-3 animate-fade-in pt-1">
                      <input 
                        type="text"
                        placeholder="Título do aviso oficial..."
                        value={newNews.title}
                        onChange={(e) => setNewNews({ ...newNews, title: e.target.value })}
                        className="w-full h-11 bg-zinc-900 border border-white/5 rounded-xl px-4 text-xs font-black uppercase tracking-wider text-white placeholder-zinc-550 outline-none focus:border-brand-accent"
                      />
                      
                      <div className="flex items-center gap-4">
                        <input 
                          type="text"
                          placeholder="Link de imagem opcional..."
                          value={newNews.imageUrl}
                          onChange={(e) => setNewNews({ ...newNews, imageUrl: e.target.value })}
                          className="flex-1 h-11 bg-zinc-900 border border-white/5 rounded-xl px-4 text-xs font-medium text-zinc-300 placeholder-zinc-550 outline-none focus:border-brand-accent"
                        />
                        
                        <label className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-zinc-900 border border-white/5 rounded-xl h-11 select-none text-xs">
                          <input 
                            type="checkbox"
                            checked={newNews.isUrgent}
                            onChange={(e) => setNewNews({ ...newNews, isUrgent: e.target.checked })}
                            className="accent-brand-accent w-4 h-4 rounded mt-0.5"
                          />
                          <span className="text-[10px] font-black text-brand-accent uppercase tracking-wider">Aviso Urgente</span>
                        </label>
                      </div>

                      <textarea 
                        placeholder="Mensagem corporativa detalhada para toda a equipe..."
                        value={newNews.content}
                        onChange={(e) => setNewNews({ ...newNews, content: e.target.value })}
                        rows={3}
                        className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-xs font-medium text-zinc-300 placeholder-zinc-550 outline-none focus:border-brand-accent"
                      />

                      <button
                        onClick={handlePostNews}
                        disabled={submittingNews}
                        className="w-full h-11 bg-brand-accent hover:bg-white text-zinc-950 font-black uppercase tracking-widest text-[10px] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        {submittingNews ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <>
                            <Send size={12} />
                            <span>Postar no Quadro e Notificar</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Announcements Feed Lists */}
              {loadingNews ? (
                <div className="flex justify-center items-center py-12">
                  <Loader2 className="animate-spin text-brand-accent" size={24} />
                </div>
              ) : newsItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-2">
                  <Newspaper className="text-zinc-650" size={36} />
                  <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">Quadro de Avisos Vazio</p>
                  <p className="text-[10px] text-zinc-550">Não há comunicados institucionais recentes registrados.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {newsItems.map((news) => (
                    <div 
                      key={news.id}
                      className={`p-4 border rounded-[1.5rem] transition-all relative ${
                        news.isUrgent 
                          ? 'bg-amber-500/5 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.02)]' 
                          : 'bg-zinc-950/20 border-white/5 hover:border-zinc-800'
                      }`}
                    >
                      {/* Trash action button */}
                      {isOwner && (
                        <button 
                          onClick={() => handleDeleteNews(news.id)}
                          className="absolute top-4 right-4 p-2 text-zinc-600 hover:text-red-500 transition-colors bg-black/20 hover:bg-black/40 rounded-lg cursor-pointer"
                          title="Remover comunicado"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}

                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          {news.isUrgent && (
                            <span className="bg-amber-500 text-zinc-950 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-widest">
                              Urgente
                            </span>
                          )}
                          <span className="text-[9px] font-mono text-zinc-500">
                            {news.createdAt ? format(news.createdAt.toDate ? news.createdAt.toDate() : parseISO(news.createdAt), "dd/MM/yyyy HH:mm") : 'Recente'}
                          </span>
                        </div>

                        <h4 className="text-xs font-black text-white uppercase tracking-wide pr-6">{news.title}</h4>
                        <p className="text-[11px] text-zinc-400 font-medium leading-relaxed whitespace-pre-wrap">{news.content}</p>

                        <div className="pt-2 border-t border-white/5 flex items-center justify-between">
                          <span className="text-[9px] font-black text-zinc-550 uppercase tracking-widest">Canal: {news.authorName}</span>
                          <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest font-mono">Oficial DM</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: SYSTEM DYNAMIC REALTIME ALERTS AND SAFETY RULES */}
          {activeTab === 'alertas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-zinc-950 px-4 py-2.5 rounded-2xl border border-white/5">
                <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Monitoramento Reativo de Frota</span>
                <span className="text-[8px] font-mono text-zinc-500">Sinal Permanente</span>
              </div>

              {operationalAlerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-12 space-y-2">
                  <CheckCircle className="text-emerald-500 animate-bounce" size={32} />
                  <p className="text-xs font-black text-white uppercase tracking-widest">Nenhum Alerta Crítico</p>
                  <p className="text-[10px] text-zinc-500">A frota corporativa e as operações funcionais operam em total normalidade.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {operationalAlerts.map(alert => (
                    <div 
                      key={alert.id}
                      className={`p-4 border rounded-[1.5rem] flex items-start gap-3.5 transition-all ${
                        alert.severity === 'high'
                          ? 'bg-red-500/5 border-red-500/15 text-red-100'
                          : alert.severity === 'medium'
                            ? 'bg-amber-500/5 border-amber-500/15 text-amber-100'
                            : 'bg-zinc-950/30 border-white/5 text-zinc-300'
                      }`}
                    >
                      <div className={`p-2 rounded-xl mt-0.5 shrink-0 border ${
                        alert.severity === 'high'
                          ? 'bg-red-500/10 border-red-500/20 text-red-400'
                          : alert.severity === 'medium'
                            ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
                            : 'bg-zinc-900 border-zinc-800 text-brand-accent'
                      }`}>
                        {alert.severity === 'high' || alert.severity === 'medium' ? (
                          <AlertTriangle size={15} />
                        ) : (
                          <Info size={15} />
                        )}
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-450">{alert.category}</span>
                          <span className={`w-1 h-1 rounded-full ${alert.severity === 'high' ? 'bg-red-500' : alert.severity === 'medium' ? 'bg-amber-500' : 'bg-brand-accent'}`} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">{alert.title}</h4>
                        <p className="text-[11px] text-zinc-400 font-medium leading-relaxed">{alert.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: ADMIN-ONLY REGISTRATION APPROVAL & ROLE MANAGER */}
          {activeTab === 'solicitacoes' && isOwner && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Embedded Mini Tabs */}
                <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5 select-none shrink-0 self-start">
                  <button
                    onClick={() => setActiveModalTab('pendentes')}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                      activeModalTab === 'pendentes' 
                        ? 'bg-brand-accent text-zinc-950 shadow-md' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Pendentes ({realtimePendingUsers.length})
                  </button>
                  <button
                    onClick={() => setActiveModalTab('historico')}
                    className={`px-3 py-1.5 text-[9px] font-black uppercase tracking-widest rounded-lg transition-all cursor-pointer ${
                      activeModalTab === 'historico' 
                        ? 'bg-brand-accent text-zinc-950 shadow-md' 
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    Liberados ({realtimeAllUsers.length - realtimePendingUsers.length})
                  </button>
                </div>

                {/* SubSearch */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-550" />
                  <input
                    type="text"
                    placeholder="Filtrar por nome ou e-mail..."
                    value={modalSearchTerm}
                    onChange={(e) => setModalSearchTerm(e.target.value)}
                    className="w-full h-9 bg-zinc-950 border border-white/5 rounded-xl pl-9 pr-4 text-[11px] font-medium text-zinc-300 outline-none focus:border-brand-accent transition-colors placeholder-zinc-650"
                  />
                </div>
              </div>

              {/* List */}
              <div className="space-y-3">
                {filteredModalUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
                    <Search className="text-zinc-700" size={24} />
                    <p className="text-[11px] font-black text-white uppercase tracking-wider">Nenhum registro encontrado</p>
                    <p className="text-[9px] text-zinc-500">
                      Não há itens correspondentes com os termos digitados.
                    </p>
                  </div>
                ) : (
                  filteredModalUsers.map(item => {
                    const isPending = item.role === 'Pendente de Liberação' || item.role === 'Aguardando Liberação';
                    return (
                      <div 
                        key={item.uid}
                        onClick={() => {
                          if (activeModalTab === 'pendentes') {
                            setExpandedRealtimeUid(expandedRealtimeUid === item.uid ? null : item.uid);
                          }
                        }}
                        className={`p-4 bg-zinc-950/30 border border-white/5 hover:border-brand-accent/20 rounded-2xl transition-all flex flex-col gap-3 ${
                          activeModalTab === 'pendentes' ? 'cursor-pointer select-none group' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${
                                isPending
                                  ? 'bg-brand-accent animate-pulse'
                                  : item.role === 'Visitante'
                                    ? 'bg-zinc-600'
                                    : 'bg-emerald-500'
                              }`} />
                              <h4 className="text-xs font-black text-white uppercase truncate">{item.displayName || 'Sem Nome'}</h4>
                            </div>
                            <p className="text-[10px] font-mono text-zinc-500 truncate">{item.email}</p>
                          </div>

                          {activeModalTab !== 'pendentes' && (
                            <div className="flex flex-col gap-1 w-full sm:w-44 shrink-0" onClick={(e) => e.stopPropagation()}>
                              <span className="text-[8px] font-black text-zinc-550 uppercase tracking-widest ml-1">Alterar Função</span>
                              <select
                                value={item.role}
                                onChange={(e) => handleUpdateUserRoleDirectly(item, e.target.value as any)}
                                className="h-9 w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 text-[10px] font-black text-zinc-300 uppercase outline-none focus:border-brand-accent cursor-pointer transition-all"
                              >
                                <option value="Motorista">Motorista (Padrão)</option>
                                <option value="Gestor de Frotas">Gestor de Frotas</option>
                                <option value="Coordenador Logístico">Coordenador Logístico</option>
                                <option value="Administrativo">Administrativo</option>
                                <option value="Limpeza / Conservação">Limpeza / Conservação</option>
                                <option value="Visitante">Visitante</option>
                                <option value="Dono / Proprietário">Proprietário (Total)</option>
                                <option value="Pendente de Liberação">Pendente de Liberação</option>
                              </select>
                            </div>
                          )}
                        </div>

                        {activeModalTab === 'pendentes' && (
                          <div className="w-full">
                            {expandedRealtimeUid === item.uid ? (
                              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 mt-1 bg-zinc-900 border border-brand-accent/20 rounded-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                <div className="space-y-1 text-left">
                                  <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest block">Painel de Decisão</span>
                                  <p className="text-[10px] font-black text-white uppercase">
                                    Aprovar como { (item.requestedRole || 'Motorista').toUpperCase() }?
                                  </p>
                                </div>
                                <div className="flex gap-3 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleRealtimeApprove(item, false)}
                                    className="h-10 px-4 bg-zinc-800 hover:bg-zinc-750 hover:text-red-500 text-zinc-400 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer"
                                  >
                                    Rejeitar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRealtimeApprove(item, true, item.requestedRole || 'Motorista')}
                                    className="h-10 px-5 bg-brand-accent hover:bg-white text-zinc-950 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all flex items-center justify-center cursor-pointer shadow-md"
                                  >
                                    Confirmar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex justify-between items-center text-[9px] font-black text-zinc-500 uppercase tracking-widest group-hover:text-brand-accent transition-colors pl-1 pt-2 border-t border-white/5">
                                <span>Ver detalhes de autorização</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform text-zinc-550" />
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-zinc-950 border-t border-white/5 flex items-center justify-between shrink-0">
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest font-mono">
            Sistemas DM Turismo • Versão Pro
          </span>
          <button
            onClick={onClose}
            className="h-10 px-5 bg-zinc-805 hover:bg-zinc-750 text-zinc-400 hover:text-white rounded-xl font-black uppercase text-[10px] tracking-widest transition-all cursor-pointer font-sans"
          >
            Fechar Janela
          </button>
        </div>
      </motion.div>
    </div>
  );
};
