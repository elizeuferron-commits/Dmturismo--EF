import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  User, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  Filter,
  Search,
  MoreVertical,
  Flag,
  ArrowUpRight,
  ShieldCheck,
  Star,
  Zap,
  Lock,
  MessageCircle,
  Plus,
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { collection, addDoc, query, orderBy, updateDoc, doc, serverTimestamp, where, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: 'operational' | 'financial' | 'personnel' | 'urgent';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in_progress' | 'waiting' | 'resolved' | 'closed';
  requesterId: string;
  requesterName: string;
  requesterRole: string;
  assignedToId?: string;
  assignedToName?: string;
  createdAt: any;
  updatedAt: any;
  lastMessageAt: any;
  unreadCountOwner: number;
  unreadCountStaff: number;
  tags?: string[];
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderRole: string;
  createdAt: any;
  isOwner: boolean;
}

interface ChamadoProprietarioProps {
  user: any;
  profile: any;
}

export const ChamadoProprietario: React.FC<ChamadoProprietarioProps> = ({ user, profile }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  
  // New ticket form
  const [newTicketTitle, setNewTicketTitle] = useState('');
  const [newTicketDesc, setNewTicketDesc] = useState('');
  const [newTicketCategory, setNewTicketCategory] = useState<Ticket['category']>('operational');
  const [newTicketPriority, setNewTicketPriority] = useState<Ticket['priority']>('medium');

  const isOwner = 
    profile?.role === 'Dono / Proprietário' || 
    profile?.role === 'Gestor de Frotas' || 
    profile?.role === 'Coordenador Logístico' ||
    profile?.role === 'Administrativo' ||
    profile?.email === 'elizeuferron@gmail.com';

  // Listen for tickets
  useEffect(() => {
    setLoading(true);
    const filter = !isOwner ? (list: any[]) => list.filter(t => t.requesterId === user.uid) : undefined;
    
    const unsub = dbCacheService.subscribeCollection('tickets', (list) => {
      let filtered = list as Ticket[];
      if (!isOwner) {
        filtered = filtered.filter(t => t.requesterId === user.uid);
      }
      // Sort by lastMessageAt desc since subscribeCollection doesn't guarantee order
      filtered.sort((a, b) => {
        const da = a.lastMessageAt?.toDate?.() || new Date(a.lastMessageAt);
        const db_ = b.lastMessageAt?.toDate?.() || new Date(b.lastMessageAt);
        return db_.getTime() - da.getTime();
      });
      setTickets(filtered);
      setLoading(false);
    });

    return () => unsub();
  }, [user.uid, isOwner]);

  // Listen for messages of selected ticket
  useEffect(() => {
    if (!selectedTicket) {
      setMessages([]);
      return;
    }

    const path = `tickets/${selectedTicket.id}/messages`;
    const unsub = dbCacheService.subscribeCollection(path, (list) => {
      const sorted = (list as Message[]).sort((a, b) => {
        const da = a.createdAt?.toDate?.() || new Date(a.createdAt);
        const db_ = b.createdAt?.toDate?.() || new Date(b.createdAt);
        return da.getTime() - db_.getTime();
      });
      setMessages(sorted);
      
      // Mark as read
      if (isOwner && selectedTicket.unreadCountOwner > 0) {
        updateDoc(doc(db, 'tickets', selectedTicket.id), { unreadCountOwner: 0 });
      } else if (!isOwner && selectedTicket.unreadCountStaff > 0) {
        updateDoc(doc(db, 'tickets', selectedTicket.id), { unreadCountStaff: 0 });
      }
    });

    return () => unsub();
  }, [selectedTicket?.id, isOwner]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketTitle.trim() || !newTicketDesc.trim()) return;

    try {
      const ticketData = {
        title: newTicketTitle,
        description: newTicketDesc,
        category: newTicketCategory,
        priority: newTicketPriority,
        status: 'open',
        requesterId: user.uid,
        requesterName: profile?.displayName || user.email,
        requesterRole: profile?.role || 'Staff',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        lastMessageAt: serverTimestamp(),
        unreadCountOwner: 1,
        unreadCountStaff: 0
      };

      const docRef = await addDoc(collection(db, 'tickets'), ticketData);
      
      // Add initial message
      await addDoc(collection(db, `tickets/${docRef.id}/messages`), {
        text: newTicketDesc,
        senderId: user.uid,
        senderName: profile?.displayName || user.email,
        senderRole: profile?.role || 'Staff',
        createdAt: serverTimestamp(),
        isOwner: isOwner
      });

      toast.success('Chamado aberto com sucesso!');
      setIsNewTicketModalOpen(false);
      setNewTicketTitle('');
      setNewTicketDesc('');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao abrir chamado');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedTicket) return;

    const text = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, `tickets/${selectedTicket.id}/messages`), {
        text,
        senderId: user.uid,
        senderName: profile?.displayName || user.email,
        senderRole: profile?.role || 'Staff',
        createdAt: serverTimestamp(),
        isOwner: isOwner
      });

      await updateDoc(doc(db, 'tickets', selectedTicket.id), {
        lastMessageAt: serverTimestamp(),
        unreadCountOwner: isOwner ? 0 : (selectedTicket.unreadCountOwner + 1),
        unreadCountStaff: isOwner ? (selectedTicket.unreadCountStaff + 1) : 0,
        status: selectedTicket.status === 'open' && isOwner ? 'in_progress' : selectedTicket.status
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao enviar mensagem');
    }
  };

  const getPriorityColor = (priority: Ticket['priority']) => {
    switch (priority) {
      case 'critical': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      case 'high': return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
      case 'medium': return 'text-sky-500 bg-sky-500/10 border-sky-500/20';
      default: return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/20';
    }
  };

  const getStatusLabel = (status: Ticket['status']) => {
    switch (status) {
      case 'open': return 'Aberto';
      case 'in_progress': return 'Em Atendimento';
      case 'waiting': return 'Aguardando';
      case 'resolved': return 'Resolvido';
      case 'closed': return 'Fechado';
    }
  };

  return (
    <div className="h-full flex flex-col bg-asphalt-950/50 rounded-3xl border border-asphalt-800 overflow-hidden shadow-2xl backdrop-blur-xl">
      {/* Header */}
      <div className="p-6 border-b border-asphalt-800 flex items-center justify-between bg-gradient-to-r from-asphalt-900 to-asphalt-950">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-accent/10 border border-brand-accent/20 rounded-2xl flex items-center justify-center text-brand-accent shadow-lg shadow-brand-accent/5">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black uppercase tracking-wider text-white">
              {isOwner ? 'Gabinete de Chamados & Decisões' : 'Chamado Direto à Diretoria'}
            </h2>
            <p className="text-[10px] uppercase tracking-widest font-mono text-zinc-500 font-bold">
              {isOwner ? 'Gestão de solicitações internas e decisões críticas' : 'Canal direto para solicitações e reportes estratégicos'}
            </p>
          </div>
        </div>
        
        {!isOwner && (
          <button 
            onClick={() => setIsNewTicketModalOpen(true)}
            className="px-5 py-2.5 bg-brand-accent hover:bg-brand-accent/90 text-asphalt-950 text-[10px] font-black uppercase tracking-widest rounded-xl flex items-center gap-2 shadow-lg shadow-brand-accent/20 transition-all transform hover:-translate-y-0.5 active:scale-95"
          >
            <Plus size={14} /> Novo Chamado
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar Tickets List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-asphalt-800 flex flex-col bg-asphalt-900/30">
          <div className="p-4 border-b border-asphalt-800">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600" size={14} />
              <input 
                type="text" 
                placeholder="BUSCAR CHAMADOS..." 
                className="w-full bg-asphalt-950 border border-asphalt-800 rounded-xl py-2.5 pl-10 pr-4 text-[10px] uppercase font-mono tracking-widest text-white focus:outline-none focus:border-brand-accent/40 placeholder:text-zinc-700"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-asphalt-800 scrollbar-track-transparent">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-accent" />
                <span className="text-[8px] uppercase font-mono tracking-widest text-zinc-500">Sincronizando Chamados...</span>
              </div>
            ) : tickets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-zinc-600 px-6 text-center">
                <MessageSquare size={32} className="mb-3 opacity-20" />
                <p className="text-[10px] uppercase font-black tracking-widest leading-relaxed">Nenhum chamado registrado no momento.</p>
              </div>
            ) : (
              tickets.map(ticket => (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className={cn(
                    "w-full p-4 rounded-2xl border transition-all text-left group relative overflow-hidden",
                    selectedTicket?.id === ticket.id
                      ? "bg-brand-accent/5 border-brand-accent/30 shadow-lg shadow-brand-accent/5"
                      : "bg-transparent border-transparent hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={cn(
                      "text-[8px] font-black uppercase tracking-tighter px-1.5 py-0.5 rounded border",
                      getPriorityColor(ticket.priority)
                    )}>
                      {ticket.priority}
                    </span>
                    <span className="text-[9px] font-mono text-zinc-600 font-bold uppercase">
                      #{ticket.id.slice(-4)}
                    </span>
                  </div>
                  
                  <h4 className="text-xs font-bold text-zinc-200 line-clamp-1 mb-1 group-hover:text-white transition-colors">
                    {ticket.title}
                  </h4>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <User size={10} className="text-zinc-600" />
                    <span className="text-[10px] font-medium text-zinc-500 uppercase truncate">
                      {ticket.requesterName} • {ticket.requesterRole}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        ticket.status === 'open' ? 'bg-emerald-500' :
                        ticket.status === 'in_progress' ? 'bg-sky-500 animate-pulse' :
                        ticket.status === 'resolved' ? 'bg-brand-accent' : 'bg-zinc-700'
                      )} />
                      <span className="text-[9px] uppercase font-black tracking-widest text-zinc-400">
                        {getStatusLabel(ticket.status)}
                      </span>
                    </div>
                    
                    {((isOwner && ticket.unreadCountOwner > 0) || (!isOwner && ticket.unreadCountStaff > 0)) && (
                      <span className="bg-brand-accent text-asphalt-950 text-[9px] font-black px-1.5 py-0.5 rounded-full animate-bounce">
                        {isOwner ? ticket.unreadCountOwner : ticket.unreadCountStaff}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-asphalt-950/20">
          {selectedTicket ? (
            <>
              {/* Ticket Details Header */}
              <div className="p-6 border-b border-asphalt-800 bg-asphalt-900/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-black text-white">{selectedTicket.title}</h3>
                      <button className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                        <Star size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} className="text-zinc-500" />
                        <span className="text-[10px] uppercase font-mono text-zinc-500">
                          Iniciado em {selectedTicket.createdAt?.toDate ? format(selectedTicket.createdAt.toDate(), "dd 'de' MMM, HH:mm", { locale: ptBR }) : 'Sincronizando...'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Zap size={12} className="text-zinc-500" />
                        <span className="text-[10px] uppercase font-mono text-zinc-500 font-bold">
                          Categoria: {selectedTicket.category.toUpperCase()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {isOwner && selectedTicket.status !== 'resolved' && selectedTicket.status !== 'closed' && (
                      <button 
                        onClick={() => updateDoc(doc(db, 'tickets', selectedTicket.id), { status: 'resolved', updatedAt: serverTimestamp() })}
                        className="px-4 py-2 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent text-[9px] hover:text-asphalt-950 font-black uppercase tracking-widest rounded-xl transition-all"
                      >
                        Marcar como Resolvido
                      </button>
                    )}
                    <button className="p-2 bg-asphalt-800/50 border border-asphalt-700 rounded-xl text-zinc-400 hover:text-white transition-all">
                      <MoreVertical size={16} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-asphalt-800 scrollbar-track-transparent">
                {messages.map((msg, idx) => {
                  const isMe = msg.senderId === user.uid;
                  return (
                    <motion.div 
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex flex-col max-w-[80%]",
                        isMe ? "ml-auto items-end" : "mr-auto items-start"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                          {isMe ? 'VOCÊ' : msg.senderName.toUpperCase()} • {msg.senderRole.toUpperCase()}
                        </span>
                      </div>
                      <div className={cn(
                        "p-4 rounded-2xl shadow-xl border",
                        isMe 
                          ? "bg-brand-accent text-asphalt-950 border-brand-accent/20 rounded-tr-none" 
                          : "bg-asphalt-900 text-zinc-100 border-asphalt-800 rounded-tl-none"
                      )}>
                        <p className="text-[13px] leading-relaxed whitespace-pre-wrap font-medium">
                          {msg.text}
                        </p>
                      </div>
                      <span className="mt-1 text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">
                        {msg.createdAt?.toDate ? format(msg.createdAt.toDate(), "HH:mm") : '...'}
                      </span>
                    </motion.div>
                  );
                })}
              </div>

              {/* Message Input */}
              {selectedTicket.status !== 'closed' ? (
                <form onSubmit={handleSendMessage} className="p-6 border-t border-asphalt-800 bg-asphalt-900/20">
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="ESCREVA SUA MENSAGEM..."
                      className="w-full bg-asphalt-950 border border-asphalt-800 rounded-2xl py-4 pl-6 pr-16 text-xs text-white focus:outline-none focus:border-brand-accent/40 shadow-inner group-hover:border-asphalt-700 transition-all font-medium tracking-wide"
                    />
                    <button 
                      type="submit"
                      disabled={!newMessage.trim()}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 bg-brand-accent text-asphalt-950 rounded-xl hover:bg-brand-accent/90 disabled:opacity-20 disabled:grayscale transition-all shadow-lg shadow-brand-accent/10 active:scale-90"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </form>
              ) : (
                <div className="p-6 border-t border-asphalt-800 bg-asphalt-900/40 text-center">
                  <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 flex items-center justify-center gap-2">
                    <Lock size={12} /> ESTE CHAMADO FOI ENCERRADO E ARQUIVADO
                  </p>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-600">
              <div className="w-24 h-24 bg-asphalt-900 border-2 border-dashed border-asphalt-800 rounded-full flex items-center justify-center mb-6 text-asphalt-800">
                <MessageCircle size={40} />
              </div>
              <h3 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500 mb-2">Selecione um Chamado</h3>
              <p className="text-[10px] uppercase font-mono max-w-xs leading-relaxed">
                Clique em um item da lista lateral para visualizar o histórico de conversas e tomar decisões operacionais.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New Ticket Modal */}
      <AnimatePresence>
        {isNewTicketModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-300">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-asphalt-950 border border-asphalt-800 rounded-3xl w-full max-w-xl p-8 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-accent to-transparent opacity-50" />
              
              <button 
                onClick={() => setIsNewTicketModalOpen(false)}
                className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>

              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 bg-brand-accent/10 border border-brand-accent/20 rounded-xl flex items-center justify-center text-brand-accent">
                  <MessageSquare size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-wider text-white">Novo Chamado</h3>
                  <p className="text-[9px] uppercase tracking-widest font-mono text-zinc-500">Inicie uma nova solicitação direta à diretoria</p>
                </div>
              </div>

              <form onSubmit={handleCreateTicket} className="space-y-6">
                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2 font-mono">Assunto do Chamado</label>
                  <input 
                    type="text" 
                    value={newTicketTitle}
                    onChange={(e) => setNewTicketTitle(e.target.value)}
                    placeholder="EX: SOLICITAÇÃO DE VERBA EMERGENCIAL"
                    className="w-full bg-asphalt-900/50 border border-asphalt-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-brand-accent/40 font-bold tracking-wide uppercase"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2 font-mono">Categoria</label>
                    <select 
                      value={newTicketCategory}
                      onChange={(e) => setNewTicketCategory(e.target.value as Ticket['category'])}
                      className="w-full bg-asphalt-900/50 border border-asphalt-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-brand-accent/40 font-bold appearance-none uppercase"
                    >
                      <option value="operational">Operacional</option>
                      <option value="financial">Financeiro</option>
                      <option value="personnel">RH / Pessoal</option>
                      <option value="urgent">Urgência Crítica</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2 font-mono">Prioridade</label>
                    <select 
                      value={newTicketPriority}
                      onChange={(e) => setNewTicketPriority(e.target.value as Ticket['priority'])}
                      className="w-full bg-asphalt-900/50 border border-asphalt-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-brand-accent/40 font-bold appearance-none uppercase"
                    >
                      <option value="low">Baixa</option>
                      <option value="medium">Média</option>
                      <option value="high">Alta</option>
                      <option value="critical">Crítica / Imediata</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-zinc-500 tracking-widest block mb-2 font-mono">Descrição Detalhada</label>
                  <textarea 
                    value={newTicketDesc}
                    onChange={(e) => setNewTicketDesc(e.target.value)}
                    rows={4}
                    placeholder="DESCREVA O MOTIVO DO CHAMADO COM DETALHES..."
                    className="w-full bg-asphalt-900/50 border border-asphalt-800 rounded-2xl px-5 py-4 text-xs text-white focus:outline-none focus:border-brand-accent/40 font-medium tracking-wide resize-none"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-4 bg-brand-accent hover:bg-brand-accent/90 text-asphalt-950 text-xs font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-brand-accent/10 transition-all flex items-center justify-center gap-2 group"
                >
                  <Send size={16} className="group-hover:translate-x-1 transition-transform" /> 
                  Abrir Chamado Agora
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
