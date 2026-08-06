import React, { useState, useEffect } from 'react';
import { 
  Eye, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  Circle, 
  FileText, 
  Code, 
  Compass, 
  FolderOpen,
  ArrowRight,
  Sparkles,
  Info,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Bot,
  Zap,
  Check,
  Send,
  Calendar,
  DollarSign
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

interface Feature {
  title: string;
  files: string[];
  status: 'completed' | 'pending';
  subItems: { title: string; desc: string }[];
}

interface Section {
  title: string;
  features: Feature[];
}

export const ShadowLogVisualizer: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ shadowLog: string; startingPoint: string } | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [activeTab, setActiveTab] = useState<'visualizer' | 'raw_shadow' | 'starting_point' | 'simulador'>('visualizer');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedFeatures, setExpandedFeatures] = useState<Record<string, boolean>>({});

  // Simulator States
  const [simSelectedFeature, setSimSelectedFeature] = useState<'ponto' | 'chat' | 'fretamento_rapido'>('ponto');
  
  // 1. Ponto States
  const [simPointFilled, setSimPointFilled] = useState(false);
  const [simPointSigned, setSimPointSigned] = useState(false);

  // 2. Chat States
  const [simChatModel, setSimChatModel] = useState<'gemini-3.5-flash' | 'gemini-3.1-pro-preview' | 'gemini-3.1-flash-lite'>('gemini-3.5-flash');
  const [simThinkingMode, setSimThinkingMode] = useState(false);
  const [simChatInput, setSimChatInput] = useState('');
  const [simChatMessages, setSimChatMessages] = useState<{ role: 'user' | 'model', text: string }[]>([
    { role: 'model', text: 'Olá! Sou o Assistente IA do Ambiente Sombra. Qual documento ou fluxo deseja testar hoje?' }
  ]);
  const [simChatLoading, setSimChatLoading] = useState(false);

  // 3. Fretamento States
  const [simModoRapido, setSimModoRapido] = useState(true);
  const [simFretamentoCliente, setSimFretamentoCliente] = useState('');
  const [simFretamentoData, setSimFretamentoData] = useState('2026-07-13');
  const [simFretamentoValor, setSimFretamentoValor] = useState('1500.00');
  const [simFretamentoSalvo, setSimFretamentoSalvo] = useState(false);

  // Send message using the live proxy API
  const handleSendSimChat = async () => {
    if (!simChatInput.trim() || simChatLoading) return;
    const userMsg = { role: 'user' as const, text: simChatInput };
    setSimChatMessages(prev => [...prev, userMsg]);
    const textToSend = simChatInput;
    setSimChatInput('');
    setSimChatLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: textToSend,
          model: simChatModel,
          thinking: simThinkingMode,
          history: simChatMessages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          })),
          systemInstruction: 'Você é o Consultor DM Pro do ambiente Sombra. Ajude o usuário a testar novos fluxos e simulações do sistema DM Turismo.'
        })
      });

      if (!response.ok) {
        throw new Error('Falha na resposta da API');
      }

      const resData = await response.json();
      setSimChatMessages(prev => [...prev, { role: 'model', text: resData.text || 'Erro ao processar resposta.' }]);
    } catch (err: any) {
      toast.error('Erro na simulação do Consultor IA');
      setSimChatMessages(prev => [...prev, { role: 'model', text: `⚠️ [SIMULADOR] Ocorreu um erro de conexão: ${err.message}` }]);
    } finally {
      setSimChatLoading(false);
    }
  };

  // Instant local cache hydration for offline resilience and fast boot
  useEffect(() => {
    try {
      const cached = localStorage.getItem('dm_cached_shadow_log_data');
      if (cached) {
        const json = JSON.parse(cached);
        setData(json);
        if (json.shadowLog) {
          setSections(parseMarkdown(json.shadowLog));
        }
        setLoading(false);
      }
    } catch (e) {
      console.warn('Erro ao carregar log de sombra cacheado localmente:', e);
    }
    fetchShadowLog();
  }, []);

  const fetchShadowLog = async () => {
    try {
      const response = await fetch('/api/shadow-log');
      if (!response.ok) throw new Error('Erro ao carregar os dados de log do servidor.');
      const json = await response.json();
      setData(json);
      localStorage.setItem('dm_cached_shadow_log_data', JSON.stringify(json));
      
      if (json.shadowLog) {
        const parsed = parseMarkdown(json.shadowLog);
        setSections(parsed);
      }
    } catch (error: any) {
      console.warn('Falha ao carregar log de sombra em tempo real (provavelmente offline):', error);
      // Only toast error if we have no cached data at all
      const cached = localStorage.getItem('dm_cached_shadow_log_data');
      if (!cached) {
        toast.error('Não foi possível carregar os logs de sincronização paralela (Modo Sombra). Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  const parseMarkdown = (md: string): Section[] => {
    const lines = md.split('\n');
    const sectionsList: Section[] = [];
    let currentSection: Section | null = null;
    let currentFeature: Feature | null = null;

    for (let line of lines) {
      const trimmed = line.trim();
      if (line.startsWith('## ')) {
        if (currentSection) {
          if (currentFeature) {
            currentSection.features.push(currentFeature);
            currentFeature = null;
          }
          sectionsList.push(currentSection);
        }
        currentSection = {
          title: line.replace('## ', '').trim(),
          features: []
        };
      } else if (trimmed.startsWith('- [x]') || trimmed.startsWith('- [ ]')) {
        if (currentFeature && currentSection) {
          currentSection.features.push(currentFeature);
        }
        const isCompleted = trimmed.startsWith('- [x]');
        let content = trimmed.substring(5).trim();
        
        let title = content;
        let files: string[] = [];
        
        const boldMatch = content.match(/^\*\*(.*?)\*\*/);
        if (boldMatch) {
          title = boldMatch[1];
        }
        
        const backtickMatches = content.match(/`([^`]+)`/g);
        if (backtickMatches) {
          files = backtickMatches.map(m => m.replace(/`/g, ''));
          files.forEach(f => {
            title = title.replace(`(${f})`, '').replace(f, '').trim();
          });
          title = title.replace(/\(\s*\)/g, '').trim();
          title = title.replace(/[:.]+$/, '').trim();
        }

        currentFeature = {
          title,
          files,
          status: isCompleted ? 'completed' : 'pending',
          subItems: []
        };
      } else if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
        if (currentFeature) {
          const itemContent = trimmed.substring(1).trim();
          let subTitle = "";
          let subDesc = itemContent;
          const subBoldMatch = itemContent.match(/^\*\*(.*?)\*\*/);
          if (subBoldMatch) {
            subTitle = subBoldMatch[1].replace(/[:.]+$/, '').trim();
            subDesc = itemContent.replace(/^\*\*(.*?)\*\*/, '').trim();
            subDesc = subDesc.replace(/^[:\s-]+/, '').trim();
          }
          currentFeature.subItems.push({
            title: subTitle,
            desc: subDesc
          });
        }
      }
    }

    if (currentSection) {
      if (currentFeature) {
        currentSection.features.push(currentFeature);
      }
      sectionsList.push(currentSection);
    }

    return sectionsList;
  };

  const toggleExpand = (featureTitle: string) => {
    setExpandedFeatures(prev => ({
      ...prev,
      [featureTitle]: !prev[featureTitle]
    }));
  };

  // Classify modules automatically based on files affected or title
  const getCategory = (feature: Feature): string => {
    const combinedText = (feature.title + ' ' + feature.files.join(' ')).toLowerCase();
    if (combinedText.includes('app.tsx') || combinedText.includes('carregamento') || combinedText.includes('swr')) return 'Core / SWR';
    if (combinedText.includes('finance') || combinedText.includes('vencimento') || combinedText.includes('faturamento')) return 'Financeiro';
    if (combinedText.includes('trip') || combinedText.includes('viagem') || combinedText.includes('escala')) return 'Turismo / Viagens';
    if (combinedText.includes('vehicle') || combinedText.includes('maintenance') || combinedText.includes('frota') || combinedText.includes('manutenção') || combinedText.includes('oficina')) return 'Frota & Oficina';
    if (combinedText.includes('gabinete') || combinedText.includes('relatório') || combinedText.includes('dossiê')) return 'Gabinete Executivo';
    if (combinedText.includes('gemini') || combinedText.includes('ia') || combinedText.includes('leitor')) return 'IA Gemini';
    if (combinedText.includes('sidebar') || combinedText.includes('gesture') || combinedText.includes('tátil')) return 'Interface UI';
    return 'Geral';
  };

  const categories = ['all', 'Core / SWR', 'Financeiro', 'Turismo / Viagens', 'Frota & Oficina', 'Gabinete Executivo', 'IA Gemini', 'Interface UI', 'Geral'];

  // Filter features based on search and category selection
  const filteredSections = sections.map(section => {
    const features = section.features.filter(feature => {
      const matchesSearch = feature.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            feature.files.some(f => f.toLowerCase().includes(searchTerm.toLowerCase())) ||
                            feature.subItems.some(si => si.title.toLowerCase().includes(searchTerm.toLowerCase()) || si.desc.toLowerCase().includes(searchTerm.toLowerCase()));
      const featureCategory = getCategory(feature);
      const matchesCategory = selectedCategory === 'all' || featureCategory === selectedCategory;
      return matchesSearch && matchesCategory;
    });
    return { ...section, features };
  }).filter(s => s.features.length > 0);

  const totalFeaturesCount = sections.reduce((acc, s) => acc + s.features.length, 0);
  const completedFeaturesCount = sections.reduce((acc, s) => acc + s.features.filter(f => f.status === 'completed').length, 0);
  const completionPercentage = totalFeaturesCount > 0 ? Math.round((completedFeaturesCount / totalFeaturesCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Banner de Cabeçalho do Monitor Sombra */}
      <div className="relative p-6 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
          <Eye size={120} className="text-white" />
        </div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_25px_rgba(16,185,129,0.15)] animate-pulse">
              <Eye className="text-emerald-400 w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tighter italic flex items-center gap-2">
                Monitor do <span className="text-emerald-400">Ambiente Sombra</span>
              </h2>
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">
                Visualização Real da Linha Paralela de Desenvolvimento
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            {/* Medidor de Sincronização */}
            <div className="bg-zinc-900/80 border border-zinc-800 px-4 py-2 rounded-xl flex items-center gap-3">
              <span className="text-[9px] font-black text-zinc-400 uppercase tracking-widest">Sincronização:</span>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                <span className="text-[8px] font-black text-emerald-400 uppercase tracking-wider">Ativa 100%</span>
              </div>
            </div>

            <button 
              onClick={fetchShadowLog}
              disabled={loading}
              className="p-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-800 rounded-xl transition-all cursor-pointer flex items-center gap-2"
              title="Sincronizar Arquivo de Logs"
            >
              <RefreshCw size={14} className={loading ? "animate-spin text-emerald-400" : ""} />
            </button>
          </div>
        </div>

        {/* Stats Grid de Progresso Sombra */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-white/5">
          <div className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Ações Mapeadas</span>
            <p className="text-xl font-black text-white mt-1">{totalFeaturesCount}</p>
          </div>
          <div className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl">
            <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Implementadas Sombra</span>
            <p className="text-xl font-black text-emerald-400 mt-1">{completedFeaturesCount}</p>
          </div>
          <div className="p-4 bg-zinc-900/30 border border-white/5 rounded-2xl col-span-2">
            <div className="flex justify-between items-center text-[8px] font-black text-zinc-500 uppercase tracking-widest">
              <span>Fidelidade de Entrega Sombra</span>
              <span className="text-emerald-400">{completionPercentage}%</span>
            </div>
            <div className="h-2 bg-zinc-950 rounded-full overflow-hidden mt-2.5 border border-white/5">
              <motion.div 
                className="h-full bg-emerald-500 shadow-[0_0_10px_#10b981]" 
                initial={{ width: 0 }}
                animate={{ width: `${completionPercentage}%` }}
                transition={{ duration: 1 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Menu de Abas Internas */}
      <div className="flex flex-wrap gap-2.5 p-1.5 bg-zinc-950/60 border border-white/5 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('visualizer')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'visualizer' 
              ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Layers size={12} />
          Painel de Sincronização Sombra
        </button>
        <button
          onClick={() => setActiveTab('simulador')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'simulador' 
              ? 'bg-zinc-800 text-amber-400 border border-zinc-700/50 shadow-[0_0_15px_rgba(251,191,36,0.1)]' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Sparkles size={12} className="text-amber-400 animate-pulse" />
          🔬 Simulador de Recursos (Live Preview)
        </button>
        <button
          onClick={() => setActiveTab('raw_shadow')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'raw_shadow' 
              ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Code size={12} />
          Ver SHADOW_LOG.md Completo
        </button>
        <button
          onClick={() => setActiveTab('starting_point')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
            activeTab === 'starting_point' 
              ? 'bg-zinc-800 text-emerald-400 border border-zinc-700/50' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <FileText size={12} />
          Ver PONTO_DE_PARTIDA.md
        </button>
      </div>

      {/* Conteúdo do Monitor */}
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <RefreshCw className="text-emerald-400 w-10 h-10 animate-spin" />
            <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Sincronizando com os arquivos Sombra do Sistema...</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeTab === 'visualizer' && (
              <motion.div 
                key="visualizer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Filtros e Barra de Busca */}
                <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                  {/* Busca */}
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-3.5 text-zinc-600 w-4 h-4" />
                    <input 
                      type="text" 
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Filtrar por ferramenta, arquivo, termo técnico..."
                      className="w-full bg-zinc-950/80 border border-white/5 focus:border-emerald-500/40 rounded-2xl p-3.5 pl-11 text-xs font-bold text-white placeholder:text-zinc-600 transition-all outline-none"
                    />
                  </div>

                  {/* Filtros Rápidos */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest shrink-0">Domínio:</span>
                    <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1 lg:pb-0 scrollbar-none">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`px-3 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                            selectedCategory === cat 
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                              : 'bg-zinc-950/40 text-zinc-500 border border-white/5 hover:text-zinc-300'
                          }`}
                        >
                          {cat === 'all' ? 'Todos' : cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Lista de Seções do Backlog */}
                {filteredSections.length > 0 ? (
                  <div className="space-y-8">
                    {filteredSections.map((section, sidx) => (
                      <div key={sidx} className="space-y-4">
                        <div className="flex items-center gap-3 border-b border-white/5 pb-2">
                          <FolderOpen className="text-zinc-600 w-4 h-4" />
                          <h3 className="text-xs font-black text-zinc-400 uppercase tracking-widest">
                            {section.title}
                          </h3>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {section.features.map((feature, fidx) => {
                            const isExpanded = !!expandedFeatures[feature.title];
                            const category = getCategory(feature);
                            return (
                              <div 
                                key={fidx} 
                                className={`p-5 rounded-2xl border transition-all ${
                                  feature.status === 'completed' 
                                    ? 'bg-zinc-950/40 border-white/5 hover:border-emerald-500/20' 
                                    : 'bg-zinc-950/20 border-dashed border-white/5 hover:border-amber-500/20'
                                }`}
                              >
                                {/* Header do Card */}
                                <div className="flex items-start justify-between gap-4">
                                  <div className="space-y-1.5 flex-1">
                                    <div className="flex flex-wrap gap-2 items-center">
                                      <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded text-[7px] font-black uppercase tracking-wider">
                                        {category}
                                      </span>
                                      {feature.status === 'completed' ? (
                                        <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded text-[7px] font-black uppercase tracking-wider flex items-center gap-1">
                                          <CheckCircle2 size={8} /> Sincronizada
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded text-[7px] font-black uppercase tracking-wider flex items-center gap-1">
                                          <Circle size={8} /> Pendente Sombra
                                        </span>
                                      )}
                                    </div>
                                    <h4 className="text-xs font-black text-white uppercase tracking-tight leading-snug">
                                      {feature.title}
                                    </h4>
                                  </div>

                                  <button 
                                    onClick={() => toggleExpand(feature.title)}
                                    className="p-1.5 bg-zinc-900 hover:bg-zinc-850 rounded-lg text-zinc-500 hover:text-white transition-all cursor-pointer"
                                  >
                                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                  </button>
                                </div>

                                {/* Arquivos Afetados */}
                                {feature.files.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mt-3">
                                    {feature.files.map((file, idx) => (
                                      <span 
                                        key={idx} 
                                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-zinc-900/60 border border-white/5 rounded-lg text-[8px] font-mono text-zinc-400 hover:text-emerald-400 transition-colors"
                                      >
                                        <Code size={10} className="text-zinc-600 shrink-0" />
                                        {file}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Sub Itens Técnicos */}
                                {isExpanded && feature.subItems.length > 0 && (
                                  <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-4 pt-4 border-t border-white/5 space-y-3.5"
                                  >
                                    {feature.subItems.map((sub, idx) => (
                                      <div key={idx} className="space-y-1 bg-zinc-900/20 p-3 rounded-xl border border-white/5">
                                        {sub.title && (
                                          <h5 className="text-[9.5px] font-black text-zinc-300 uppercase tracking-wide flex items-center gap-1.5">
                                            <ArrowRight size={10} className="text-emerald-500 shrink-0" />
                                            {sub.title}
                                          </h5>
                                        )}
                                        <p className="text-[10px] text-zinc-500 font-medium leading-relaxed tracking-tight pl-3.5">
                                          {sub.desc}
                                        </p>
                                      </div>
                                    ))}
                                  </motion.div>
                                )}

                                {/* Botão para expandir indicando subitens */}
                                {!isExpanded && feature.subItems.length > 0 && (
                                  <button 
                                    onClick={() => toggleExpand(feature.title)}
                                    className="mt-3.5 text-[8.5px] font-black text-emerald-400 uppercase tracking-widest hover:text-emerald-300 flex items-center gap-1 transition-all"
                                  >
                                    Ver {feature.subItems.length} detalhe{feature.subItems.length > 1 ? 's' : ''} técnico{feature.subItems.length > 1 ? 's' : ''} 
                                    <ArrowRight size={10} className="translate-y-0.5" />
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-12 border border-dashed border-zinc-800 rounded-3xl text-center flex flex-col items-center justify-center gap-3">
                    <Search className="text-zinc-700 w-10 h-10" />
                    <p className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em]">Nenhuma alteração encontrada com os filtros atuais</p>
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'raw_shadow' && (
              <motion.div 
                key="raw_shadow"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Code size={14} className="text-zinc-500" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Leitor do Arquivo de Especificação Sombra</span>
                  </div>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">Modo Somente Leitura</span>
                </div>
                <div className="p-6 overflow-x-auto max-h-[600px] custom-scrollbar">
                  <pre className="font-mono text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed select-all">
                    {data?.shadowLog || "Nenhum dado de log sombra encontrado no arquivo original."}
                  </pre>
                </div>
              </motion.div>
            )}

            {activeTab === 'starting_point' && (
              <motion.div 
                key="starting_point"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl"
              >
                <div className="bg-zinc-900/50 border-b border-white/5 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-zinc-500" />
                    <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Referência de Estado Inicial</span>
                  </div>
                  <span className="text-[8px] font-black text-zinc-600 uppercase tracking-wider">Modo Somente Leitura</span>
                </div>
                <div className="p-6 overflow-x-auto max-h-[600px] custom-scrollbar">
                  <pre className="font-mono text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed select-all">
                    {data?.startingPoint || "Nenhum dado de ponto de partida encontrado no arquivo original."}
                  </pre>
                </div>
              </motion.div>
            )}

            {activeTab === 'simulador' && (
              <motion.div 
                key="simulador"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 lg:grid-cols-12 gap-6"
              >
                {/* Seleção de Recursos na Esquerda */}
                <div className="lg:col-span-4 space-y-3">
                  <div className="bg-zinc-950 border border-white/5 p-4 rounded-2xl">
                    <h4 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest mb-3">Recursos em Homologação</h4>
                    
                    <div className="space-y-2">
                      <button
                        onClick={() => setSimSelectedFeature('ponto')}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          simSelectedFeature === 'ponto'
                            ? 'bg-zinc-900 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                            : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <Calendar size={14} className={simSelectedFeature === 'ponto' ? 'text-amber-400' : 'text-zinc-500'} />
                          <span className={`text-[10px] font-black uppercase tracking-wider ${simSelectedFeature === 'ponto' ? 'text-white' : 'text-zinc-400'}`}>
                            Ponto Fiel (Regra Unificada)
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-normal">
                          Geração automática de jornadas padrão da operadora Ana Paula em lote.
                        </p>
                      </button>

                      <button
                        onClick={() => setSimSelectedFeature('chat')}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          simSelectedFeature === 'chat'
                            ? 'bg-zinc-900 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                            : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <Bot size={14} className={simSelectedFeature === 'chat' ? 'text-amber-400' : 'text-zinc-500'} />
                          <span className={`text-[10px] font-black uppercase tracking-wider ${simSelectedFeature === 'chat' ? 'text-white' : 'text-zinc-400'}`}>
                            Consultor IA (Alta Cognição)
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-normal">
                          Sandbox com seleção dinâmica de modelos e raciocínio profundo habilitado.
                        </p>
                      </button>

                      <button
                        onClick={() => setSimSelectedFeature('fretamento_rapido')}
                        className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                          simSelectedFeature === 'fretamento_rapido'
                            ? 'bg-zinc-900 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                            : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 mb-1">
                          <Zap size={14} className={simSelectedFeature === 'fretamento_rapido' ? 'text-amber-400' : 'text-zinc-500'} />
                          <span className={`text-[10px] font-black uppercase tracking-wider ${simSelectedFeature === 'fretamento_rapido' ? 'text-white' : 'text-zinc-400'}`}>
                            Fretamento Modo Zap
                          </span>
                        </div>
                        <p className="text-[9px] text-zinc-500 leading-normal">
                          Formulário super ágil ocultando dados redundantes via preenchimento inteligente.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div className="p-4 bg-zinc-950/30 border border-white/5 rounded-2xl text-[9px] text-zinc-500 leading-relaxed">
                    💡 <span className="font-bold text-zinc-400">Nota de Homologação:</span> Este simulador interage diretamente com as APIs de retaguarda do sistema, fornecendo um ambiente em tempo real no aiStudio.
                  </div>
                </div>

                {/* Área de Visualização e Teste Interativo */}
                <div className="lg:col-span-8 bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden flex flex-col min-h-[500px]">
                  {/* Topo do Playground */}
                  <div className="bg-zinc-900/40 border-b border-white/5 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-[0_0_8px_#f59e0b]" />
                      <span className="text-[10px] font-black text-white uppercase tracking-widest">
                        {simSelectedFeature === 'ponto' && "Playground: Ponto Fiel Unificado"}
                        {simSelectedFeature === 'chat' && "Playground: Consultor IA Cognitivo"}
                        {simSelectedFeature === 'fretamento_rapido' && "Playground: Lançador Zap Fretamento"}
                      </span>
                    </div>
                    <span className="text-[8px] font-black text-amber-400/80 bg-amber-400/10 px-2.5 py-1 rounded-full uppercase tracking-wider border border-amber-400/20">
                      Homologação Sombra
                    </span>
                  </div>

                  {/* Conteúdo Específico */}
                  <div className="p-6 flex-1 flex flex-col justify-between">
                    
                    {/* 1. PLAYGROUND DO PONTO FIEL */}
                    {simSelectedFeature === 'ponto' && (
                      <div className="space-y-6 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                            <div>
                              <h5 className="text-[12px] font-bold text-white uppercase tracking-wide">Regra Unificada de Ponto (Padrão Ana Paula)</h5>
                              <p className="text-[9px] text-zinc-400">Validação reativa de jornada de trabalho (Seg-Sex: 08h-18h, Sáb: 08h-12h)</p>
                            </div>
                            <button
                              onClick={() => {
                                setSimPointFilled(true);
                                toast.success("Folha preenchida com o padrão Ana Paula!");
                              }}
                              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-amber-400 hover:text-amber-300 border border-amber-500/20 rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                            >
                              Preenchimento Automático
                            </button>
                          </div>

                          {simPointFilled ? (
                            <div className="border border-white/5 rounded-2xl overflow-hidden bg-zinc-950/60 max-h-[240px] overflow-y-auto custom-scrollbar">
                              <table className="w-full text-left text-[9px]">
                                <thead className="bg-zinc-900/50 text-zinc-400 font-bold uppercase tracking-wider border-b border-white/5">
                                  <tr>
                                    <th className="p-2.5">Dia</th>
                                    <th className="p-2.5">Dia Semana</th>
                                    <th className="p-2.5 text-center">Entrada 1</th>
                                    <th className="p-2.5 text-center">Saída 1</th>
                                    <th className="p-2.5 text-center">Entrada 2</th>
                                    <th className="p-2.5 text-center">Saída 2</th>
                                    <th className="p-2.5 text-right">Status</th>
                                  </tr>
                                </thead>
                                <tbody className="text-zinc-300 divide-y divide-white/5 font-mono">
                                  {Array.from({ length: 6 }).map((_, i) => {
                                    const dia = i + 1;
                                    const isSabado = dia === 4;
                                    const isDomingo = dia === 5;
                                    return (
                                      <tr key={dia} className={isDomingo ? "bg-zinc-900/20 text-zinc-500" : "hover:bg-zinc-900/30"}>
                                        <td className="p-2.5 font-bold">0{dia}/07/2026</td>
                                        <td className="p-2.5 font-sans">
                                          {dia === 1 && "Segunda-feira"}
                                          {dia === 2 && "Terça-feira"}
                                          {dia === 3 && "Quarta-feira"}
                                          {dia === 4 && "Sábado (Especial)"}
                                          {dia === 5 && "Domingo (Descanso)"}
                                          {dia === 6 && "Segunda-feira"}
                                        </td>
                                        <td className="p-2.5 text-center">{isDomingo ? "---" : "08:00"}</td>
                                        <td className="p-2.5 text-center">{isDomingo ? "---" : isSabado ? "12:00" : "11:30"}</td>
                                        <td className="p-2.5 text-center">{isDomingo || isSabado ? "---" : "13:00"}</td>
                                        <td className="p-2.5 text-center">{isDomingo || isSabado ? "---" : "18:00"}</td>
                                        <td className="p-2.5 text-right">
                                          {isDomingo ? (
                                            <span className="text-[8px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded uppercase font-sans">Folga</span>
                                          ) : (
                                            <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded uppercase font-sans">Ok</span>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="py-12 border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center text-center bg-zinc-950/20">
                              <Calendar className="w-10 h-10 text-zinc-600 mb-2 animate-pulse" />
                              <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider mb-1">Folha de Ponto Vazia</p>
                              <p className="text-[9px] text-zinc-500 max-w-xs">Clique em "Preenchimento Automático" para simular a escala de ponto inteligente.</p>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                if (!simPointFilled) {
                                  toast.error("Preencha o ponto primeiro!");
                                  return;
                                }
                                setSimPointSigned(true);
                                toast.success("Folha de Ponto assinada eletronicamente na Sombra!");
                              }}
                              className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer flex items-center gap-2 ${
                                simPointSigned 
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                  : "bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-white/5"
                              }`}
                            >
                              {simPointSigned ? <Check size={12} /> : null}
                              {simPointSigned ? "Assinatura Validada" : "Assinar Digitalmente"}
                            </button>
                            {simPointSigned && (
                              <span className="text-[8px] text-emerald-400 uppercase font-bold animate-pulse">
                                Certificado IP: 187.15.22.1
                              </span>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              if (!simPointFilled) {
                                toast.error("Por favor, preencha a folha primeiro!");
                                return;
                              }
                              toast.info("Geração de arquivo simulado de folha executado com sucesso!");
                            }}
                            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer"
                          >
                            Exportar para Excel (.xlsx)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 2. PLAYGROUND DO CONSULTOR IA */}
                    {simSelectedFeature === 'chat' && (
                      <div className="space-y-4 flex-1 flex flex-col justify-between">
                        {/* Controles de Configuração da IA */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-zinc-900/30 border border-white/5 rounded-2xl">
                          <div>
                            <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1.5">Modelo Gemini Sombra</label>
                            <select
                              value={simChatModel}
                              onChange={(e) => setSimChatModel(e.target.value as any)}
                              className="w-full bg-zinc-950 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500/50"
                            >
                              <option value="gemini-3.5-flash">Gemini 3.5 Flash (Velocidade)</option>
                              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Alta Cognição)</option>
                              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash-Lite (Eficiente)</option>
                            </select>
                          </div>
                          <div className="flex items-center justify-between sm:justify-start gap-3 pt-4 sm:pt-0">
                            <div>
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-0.5">Raciocínio Avançado</span>
                              <span className="text-[9px] text-zinc-400 leading-none">Alta profundidade (Thinking)</span>
                            </div>
                            <button
                              onClick={() => setSimThinkingMode(!simThinkingMode)}
                              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${
                                simThinkingMode ? 'bg-amber-500' : 'bg-zinc-800'
                              }`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform absolute shadow ${
                                simThinkingMode ? 'translate-x-7' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>
                        </div>

                        {/* Corpo do Chat */}
                        <div className="border border-white/5 rounded-2xl bg-zinc-950/60 p-4 h-[220px] overflow-y-auto custom-scrollbar flex flex-col gap-3 font-sans">
                          {simChatMessages.map((msg, i) => (
                            <div
                              key={i}
                              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-[10px] leading-relaxed ${
                                msg.role === 'user'
                                  ? 'bg-zinc-800 text-white self-end rounded-tr-none'
                                  : 'bg-zinc-900/50 text-zinc-300 self-start rounded-tl-none border border-white/5'
                              }`}
                            >
                              <p className="whitespace-pre-wrap">{msg.text}</p>
                            </div>
                          ))}
                          {simChatLoading && (
                            <div className="bg-zinc-900/50 text-zinc-400 self-start rounded-2xl rounded-tl-none px-4 py-2.5 text-[10px] flex items-center gap-2 border border-white/5">
                              <RefreshCw size={10} className="animate-spin text-amber-400" />
                              <span>Pensando profundamente...</span>
                            </div>
                          )}
                        </div>

                        {/* Input de Envio */}
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="Pergunte ao Consultor Sombra (ex: 'Como funciona a regra da Ana Paula?')"
                            value={simChatInput}
                            onChange={(e) => setSimChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSendSimChat(); }}
                            disabled={simChatLoading}
                            className="flex-1 bg-zinc-900 border border-white/5 rounded-xl px-4 py-3 text-[10px] font-medium text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/40"
                          />
                          <button
                            onClick={handleSendSimChat}
                            disabled={simChatLoading}
                            className="p-3 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black rounded-xl cursor-pointer active:scale-95 transition-all"
                          >
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* 3. PLAYGROUND DO FRETAMENTO RÁPIDO */}
                    {simSelectedFeature === 'fretamento_rapido' && (
                      <div className="space-y-4 flex-1 flex flex-col justify-between">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-white/5 rounded-2xl">
                            <div>
                              <h5 className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                                <Zap size={12} className="text-amber-400" />
                                Modo Lançador Zap Ativo
                              </h5>
                              <p className="text-[9px] text-zinc-500">Oculta dados adicionais (veículo, motorista) para rapidez na garagem.</p>
                            </div>
                            <button
                              onClick={() => setSimModoRapido(!simModoRapido)}
                              className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${
                                simModoRapido ? 'bg-amber-500' : 'bg-zinc-800'
                              }`}
                            >
                              <div className={`w-4 h-4 bg-white rounded-full transition-transform absolute shadow ${
                                simModoRapido ? 'translate-x-7' : 'translate-x-1'
                              }`} />
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div>
                              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Fretante / Cliente</label>
                              <input
                                type="text"
                                placeholder="ex: Braskem Refinaria"
                                value={simFretamentoCliente}
                                onChange={(e) => setSimFretamentoCliente(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white placeholder-zinc-600 focus:outline-none focus:border-amber-500/40"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Data Única</label>
                              <input
                                type="date"
                                value={simFretamentoData}
                                onChange={(e) => setSimFretamentoData(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500/40"
                              />
                            </div>
                            <div>
                              <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-1">Valor do Frete (R$)</label>
                              <input
                                type="text"
                                placeholder="1500.00"
                                value={simFretamentoValor}
                                onChange={(e) => setSimFretamentoValor(e.target.value)}
                                className="w-full bg-zinc-900 border border-white/5 rounded-xl px-3 py-2.5 text-[10px] font-bold text-white focus:outline-none focus:border-amber-500/40 font-mono"
                              />
                            </div>
                          </div>

                          {!simModoRapido && (
                            <div className="p-4 border border-dashed border-white/10 rounded-2xl space-y-3 bg-zinc-900/10">
                              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block">Campos Avançados (Desbloqueados)</span>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-3 bg-zinc-950 border border-white/5 rounded-xl text-[9px] text-zinc-400">
                                  🚌 <span className="font-bold">Veículo:</span> Auto-designado por padrão Sombra
                                </div>
                                <div className="p-3 bg-zinc-950 border border-white/5 rounded-xl text-[9px] text-zinc-400">
                                  👤 <span className="font-bold">Motorista:</span> Escala automática rotativa
                                </div>
                              </div>
                            </div>
                          )}

                          {simFretamentoSalvo && (
                            <div className="p-4 bg-zinc-900/40 border border-white/5 rounded-2xl font-mono text-[9px] text-emerald-400 space-y-1 animate-fade-in">
                              <p className="font-sans font-bold text-zinc-300">✅ JSON DO BUFFER SOMBRA EXPORTADO COM SUCESSO:</p>
                              <pre className="text-zinc-500 whitespace-pre-wrap mt-2 select-all">
{JSON.stringify({
  action: "CREATE_TRIP_SHADOW_BUFFER",
  payload: {
    cliente: simFretamentoCliente || "FRETANTE RÁPIDO PADRÃO",
    data: simFretamentoData,
    valor: parseFloat(simFretamentoValor) || 0,
    modo_zap: simModoRapido,
    designacoes: simModoRapido ? "AUTO_RESERVED" : "MANUAL"
  }
}, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>

                        <div className="pt-4 border-t border-white/5 flex justify-end gap-3">
                          {simFretamentoSalvo && (
                            <button
                              onClick={() => {
                                setSimFretamentoCliente('');
                                setSimFretamentoSalvo(false);
                              }}
                              className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 rounded-xl text-[9px] font-black uppercase tracking-wider active:scale-95 transition-all cursor-pointer"
                            >
                              Limpar Registro
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (!simFretamentoCliente.trim()) {
                                toast.error("Insira o nome do Cliente!");
                                return;
                              }
                              setSimFretamentoSalvo(true);
                              toast.success("Viagem cadastrada no buffer Sombra com preenchimento Zap!");
                            }}
                            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black rounded-xl text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                          >
                            <Zap size={11} />
                            Salvar Viagem na Sombra
                          </button>
                        </div>
                      </div>
                    )}

                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Informativo de Blindagem */}
      <div className="p-5 bg-zinc-950/40 border border-white/5 rounded-2xl flex gap-3 text-zinc-500 leading-normal text-[10px] font-medium">
        <Info size={16} className="text-emerald-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-black text-zinc-400 uppercase tracking-wider">🛡️ Blindagem de Produção Ativa</p>
          <p>
            O Modo Sombra protege a integridade do código em produção. Toda nova rotina ou melhoria gerada reside nos arquivos sombra e registros de backlog, e somente será movida para a aplicação principal quando houver o acionamento gerencial expresso pelo operador.
          </p>
        </div>
      </div>
    </div>
  );
};
