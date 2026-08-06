import React, { useState, useEffect } from 'react';
import { 
  Lightbulb, 
  Search, 
  TrendingUp, 
  Cpu, 
  ArrowRight, 
  Check, 
  Zap, 
  Layers, 
  Wrench, 
  AlertTriangle, 
  Clock, 
  Sparkles, 
  X, 
  Bus, 
  DollarSign, 
  MapPin, 
  Navigation,
  FileText,
  Fuel,
  Users,
  MessageSquare,
  ChevronRight,
  ThumbsUp,
  Play
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { geminiService } from '../services/geminiService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Suggestion {
  id: string;
  category: 'frota' | 'financeiro' | 'fretamento' | 'combustivel' | 'os' | 'custom';
  title: string;
  shortDesc: string;
  detailedDesc: string;
  benefits: string[];
  impact: 'high' | 'medium';
  complexity: 'low' | 'medium' | 'high';
  timeReduction: string; // e.g. "90%", "85%"
  currentProcess: string;
  optimizedProcess: string;
  status: 'available' | 'shadow_activated' | 'merged';
}

export const OptimizationSuggestions: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'frota' | 'financeiro' | 'fretamento' | 'combustivel' | 'os'>('all');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [activeSimulation, setActiveSimulation] = useState<Suggestion | null>(null);
  const [isSimulatingShadow, setIsSimulatingShadow] = useState(false);
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [simulationStep, setSimulationStep] = useState('');
  const [customBrief, setCustomBrief] = useState('');
  const [isGeneratingIdea, setIsGeneratingIdea] = useState(false);

  // Initial built-in suggestions tailored for DM Turismo
  const initialSuggestions: Suggestion[] = [
    {
      id: 'checklist-pwa',
      category: 'frota',
      title: 'Checklist Operacional Digital Pré-Viagem',
      shortDesc: 'Substituição de planilhas de papel por vistorias digitais simplificadas feitas pelo motorista no celular.',
      detailedDesc: 'Mapeamento dinâmico de itens fundamentais (pneus, óleos, luzes, Arla, limpeza) que o motorista deve responder s/n no início de sua jornada, com upload ativo de foto caso reporte anomalia.',
      benefits: [
        'Zera custos de papelaria e preenchimentos manuais atrasados',
        'Alerta preventivo crítico em tempo real para a equipe de manutenção de mecânica',
        'Aumenta em até 30% a identificação prévia de desgaste de componentes'
      ],
      impact: 'high',
      complexity: 'low',
      timeReduction: '92%',
      currentProcess: 'Motorista assina folha de papel na garagem, despachante recolhe final do mês e transcreve anomalias para o planejador com atraso de até 15 dias.',
      optimizedProcess: 'Motorista abre celular em 1 clique, confirma os itens em 90 segundos. Se houver falha (ex: farol queimado), a oficina recebe na hora o plano de ação preventiva no painel.',
      status: 'available'
    },
    {
      id: 'extrato-ofx',
      category: 'financeiro',
      title: 'Conciliação de Extratos Bancários OFX Inteligente',
      shortDesc: 'Importação assistida de arquivos bancários operacionais de extratos eliminando digitação contábil diária.',
      detailedDesc: 'Permite carregar o extrato fornecido pelos bancos em formato padrão OFX para que o motor de inteligência cruze datas, valores e identifique transações recorrentes de forma totalmente assistida.',
      benefits: [
        'Eliminação completa de erros em lançamentos manuais repetidos',
        'Conciliação automatizada de receitas de fretamento e despesas de diesel nos postos',
        'Visão em tempo real do fluxo de caixa e capital de giro gerencial'
      ],
      impact: 'high',
      complexity: 'medium',
      timeReduction: '85%',
      currentProcess: 'O financeiro confere o estrato bancário na tela do notebook e digita e altera dezenas de transações de entrada e saída, uma a uma, direto no sistema todo início de dia.',
      optimizedProcess: 'O gestor arrasta o arquivo .OFX em um contêiner no aplicativo. O sistema analisa, aponta as conciliações exatas com os lançamentos de faturamento operacional e lista pendentes em segundos para validação em lote.',
      status: 'available'
    },
    {
      id: 'escala-recorrente',
      category: 'fretamento',
      title: 'Gerenciador Operacional de Viagens Recorrentes',
      shortDesc: 'Agendamento de grades consecutivas mensais com motoristas vinculados para faturamento fidedigno.',
      detailedDesc: 'Criação de grades fixas de linhas de fretamento para suprir clientes contínuos (ex: transportes industriais diários de turnos). Habilita replicação automática de datas e faturamento unificado.',
      benefits: [
        'Organiza preventivamente a logística de rodízio de motoristas de escala',
        'Zera o retrabalho ao lançar 30 dias de viagens recorrentes em um único lote',
        'Facilidade imediata na consolidação e cálculo de cobrança de contratos'
      ],
      impact: 'high',
      complexity: 'medium',
      timeReduction: '95%',
      currentProcess: 'O operador digita manualmente e escala o motorista e o veículo em dezenas de viagens repetitivas todos os dias do mês na planilha ou agenda.',
      optimizedProcess: 'Configura o itinerário base, escala preferencial, horário de turnos e vigência. O sistema planeja, aloca e abre todo o mês no painel de faturamento instantaneamente.',
      status: 'available'
    },
    {
      id: 'crly-sensor',
      category: 'frota',
      title: 'Leitor Inteligente de CRLV e Vencimentos via OCR',
      shortDesc: 'Monitoramento automático com processamento de alertas preventivos de licenças e impostos.',
      detailedDesc: 'Sistema automatizado que fotografa ou lê o arquivo de licenciamento para identificar a placa, número do chassi e carregar as datas críticas de vencimento de seguros e taxas governamentais.',
      benefits: [
        'Zera o risco de apreensão de veículos em rodovias estaduais',
        'Atualização sem esforço das validades da ANTT, CADASTUR, DETRO e vistorias',
        'Fidelidade e automação na emissão das certidões de segurança da frota'
      ],
      impact: 'medium',
      complexity: 'medium',
      timeReduction: '80%',
      currentProcess: 'O gestor anota em sua agenda ou planilhas as dezenas de licenças federais (ANTT) e vistorias anuais, precisando abrir manual e periodicamente arquivos impressos para conferência.',
      optimizedProcess: 'Arrasta o PDF emitido pelo DETRAN/Órgão. A inteligência extrai instantaneamente as datas limites, gera alertas acromáticos progressivos no painel de frotas e programa notificação de lembrete.',
      status: 'available'
    },
    {
      id: 'cobranca-whatsapp',
      category: 'financeiro',
      title: 'Régua de Cobrança Preventiva e Kit Pix via WhatsApp',
      shortDesc: 'Redução do tempo médio de liquidação por meio de envio proativo de resumos gerenciais e cobrança.',
      detailedDesc: 'Gera um link dinâmico de cobrança ou texto formatado de forma elegante com detalhes das viagens faturadas no período, anexando a chave Pix cadastrada da DM Turismo no topo da mensagem para facilitar o financeiro do cliente.',
      benefits: [
        'Acelera o fluxo de recebíveis da empresa em média em 7 dias',
        'Evita cobranças constrangedoras ou esquecimento administrativo do parceiro',
        'Demonstrativo visualmente organizado e muito bem aceito por compradores corporativos'
      ],
      impact: 'high',
      complexity: 'low',
      timeReduction: '75%',
      currentProcess: 'Financeiro exporta PDF, envia mensagem sem formatação adequada por WhatsApp, digita a chave de transferência por texto informal e acompanha passivamente.',
      optimizedProcess: 'Ao fechar o faturamento, clique no botão WhatsApp gera a estrutura executiva formalizada, kit pix de transferência resumido fidedignamente e controle de status de envio.',
      status: 'available'
    },
    {
      id: 'ocr-combustivel',
      category: 'combustivel',
      title: 'Scanner Inteligente de Cupom com Validação IA',
      shortDesc: 'Eliminação da entrada de dados redundantes de óleo diesel externo através de leitura por câmera.',
      detailedDesc: 'Captura dados essenciais dos recibos de postos credenciados (litros, valor unitário do diesel, total em reais, placa) diretamente pela câmera do celular do motorista, de maneira rápida na estrada.',
      benefits: [
        'Segurança na verificação de quilometragem e volume pago no bico',
        'Zera o tempo administrativo digitando cupons fiscais rasurados e manchados',
        'Auditoria rigorosa de desvios de consumo médio em rota operada'
      ],
      impact: 'medium',
      complexity: 'high',
      timeReduction: '88%',
      currentProcess: 'O motorista guarda o ticket de abastecimento no porta-luvas, entrega na garagem final de semana, o gestor acumula cupons desgastados e digita um a um no sistema.',
      optimizedProcess: 'Motorista tira foto no ato em seu celular na estrada. Os dados são extraídos em 2 segundos e lançados na central de controle financeiro do respectivo veículo como despesa de transporte.',
      status: 'available'
    },
    {
      id: 'eficiencia-combustivel',
      category: 'combustivel',
      title: 'Detector de Consumo Anômalo e Eficiência Térmica',
      shortDesc: 'Auditoria preditiva estatística cruzando média de consumo histórico e rodagem ativa.',
      detailedDesc: 'Mapeamento inteligente do padrão saudável de KM/L para cada chassi em operação. Se um veículo registrar desvio desfavorável severo, notifica para calibração, troca de bicos injetores ou treinamento de pilotagem.',
      benefits: [
        'Economia imediata de até 15% na conta acumulada de diesel e ARLA 32',
        'Identificação de desgastes severos de motores antes de falhas mecânicas em rodovias',
        'Criação de ranking saudável de condução econômica entre motoristas da garagem'
      ],
      impact: 'high',
      complexity: 'medium',
      timeReduction: '70%',
      currentProcess: 'O gestor calcula o rendimento de forma manual, comparando odômetros de forma passiva, muitas vezes detectando vazamentos ou perdas operacionais apenas meses depois.',
      optimizedProcess: 'Painel estatístico monitora após cada abastecimento, plota gráfico de dispersão térmica de consumo e emite sinalização de alerta âmbar caso o rendimento fuja da média cadastrada.',
      status: 'available'
    },
    {
      id: 'contrato-express',
      category: 'os',
      title: 'Gerador Automático de Contratos e Links de Assinatura',
      shortDesc: 'Emissão legal de contratos de fretamento e turismo vinculados à Ordem de Serviço em segundos.',
      detailedDesc: 'Ao planejar uma viagem de turismo avulso ou executiva, o sistema gera o memorial contratual formal em formato PDF no padrão legal do CADASTUR e ANTT, evitando confecção de minutas do zero.',
      benefits: [
        'Resguardo financeiro e jurídico completo contra cancelamento imprevisto ou desistência de última hora',
        'Fácil compartilhamento de faturas e termos legais diretamente via WhatsApp',
        'Profissionalismo impecável que fortalece a marca DM Turismo frente a agências de turismo'
      ],
      impact: 'high',
      complexity: 'low',
      timeReduction: '90%',
      currentProcess: 'O gestor busca um modelo de contrato no Word, preenche manualmente todos os dados cadastrais da empresa e do cliente, salva para PDF e anexa ao e-mail comercial.',
      optimizedProcess: 'Uma vez criada a viagem/itinerário base no faturamento, clique unificado gera o contrato de prestação de serviço, anexa as regras operacionais gerais e envia para assinatura rápida em lote.',
      status: 'available'
    },
    {
      id: 'passageiros-lote',
      category: 'os',
      title: 'Validador e Importador de Passageiros em Lote',
      shortDesc: 'Upload ou colagem direta de planilhas de manifesto operacional de viagens exigido pela fiscalização.',
      detailedDesc: 'Habilita o usuário a colar um texto corrido contendo nomes, e-mails, RGs e CPFs ou importar diretamente um modelo de tabela em Excel. O software realiza o tratamento de duplicidades e estruturação fidedigna.',
      benefits: [
        'Zera mais de 30 minutos de digitação manual extenuante de passageiros por viagem',
        'Estruturação legal impecável do manifesto de tráfego, evitando multas e atraso no embarque',
        'Armazenamento seguro e unificado de listas passadas para re-alocações em viagens futuras'
      ],
      impact: 'medium',
      complexity: 'low',
      timeReduction: '94%',
      currentProcess: 'O operador insere o nome de até 46 passageiros, seus documentos (RG com órgão emissor e CPF) um por um de forma individualizada na tela de emissão da OS.',
      optimizedProcess: 'O comprador ou agência fornece sua lista do Excel. O operador copia e cola o bloco de texto na caixa inteligente. Em 1 segundo o manifesto de tráfego completo está gerado, limpo e validado.',
      status: 'available'
    }
  ];

  // Load shadow_activated status from local storage to keep state persistent across session
  useEffect(() => {
    const loadedSugs = localStorage.getItem('dm_optimization_suggestions');
    if (loadedSugs) {
      try {
        setSuggestions(JSON.parse(loadedSugs));
      } catch (e) {
        setSuggestions(initialSuggestions);
      }
    } else {
      setSuggestions(initialSuggestions);
    }
  }, []);

  const saveSuggestionsState = (updated: Suggestion[]) => {
    setSuggestions(updated);
    localStorage.setItem('dm_optimization_suggestions', JSON.stringify(updated));
  };

  const handleOpenSimulation = (sug: Suggestion) => {
    setActiveSimulation(sug);
  };

  const handleActivateShadow = async (id: string) => {
    setIsSimulatingShadow(true);
    setSimulationProgress(0);
    
    const stepsList = [
      'Analisando arquitetura relacional...',
      'Gerando modelo shadow.tsx adaptado...',
      'Simulando endpoints no ambiente paralelo...',
      'Definindo persistência offline integrada...',
      'Sincronizando com log no SHADOW_LOG.md...',
    ];

    for (let i = 0; i <= 100; i += 10) {
      setSimulationProgress(i);
      const stepMsg = stepsList[Math.floor(i / (100 / stepsList.length))] || 'Finalizando...';
      setSimulationStep(stepMsg);
      await new Promise(r => setTimeout(r, 180 + Math.random() * 200));
    }

    // Mark as shadow activated
    const updated = suggestions.map(s => {
      if (s.id === id) {
        return { ...s, status: 'shadow_activated' as const };
      }
      return s;
    });

    saveSuggestionsState(updated);
    setIsSimulatingShadow(false);
    
    // Update activeSimulation pointer
    const updatedActive = updated.find(s => s.id === id);
    if (updatedActive) setActiveSimulation(updatedActive);

    toast.success('Funcionalidade preparada com sucesso no Modo Sombra!');
  };

  // Process custom brainstorm brief using AI
  const handleGenerateCustomIdea = async () => {
    if (!customBrief.trim() || isGeneratingIdea) return;
    setIsGeneratingIdea(true);
    toast.info('Consultor DM Turismo Pro está analisando e detalhando sua ideia operacional...');

    try {
      const prompt = `Analise a seguinte ideia de atualização gerencial/operacional para o aplicativo de turismo de Elizeu Ferron (DM Turismo): "${customBrief}".
      Gere um objeto JSON estruturado contendo a sugestão detalhada. Retorne APENAS um objeto JSON válido (sem carácteres em volta de markdown, sem 'json' no topo, apenas abre chaves { e fecha chaves }, sem blocos de código markdown) no seguinte formato:
      {
        "id": "slug-gerado-curto",
        "category": "Escolha entre 'frota', 'financeiro', 'fretamento', 'combustivel', 'os'",
        "title": "Título operacional claro e atrativo",
        "shortDesc": "Resumo de 1 frase de impacto",
        "detailedDesc": "Explicação técnica de como a rotina seria otimizada fidedignamente no sistema",
        "benefits": [
          "Benefício de impacto real 1",
          "Benefício de impacto real 2",
          "Benefício de impacto real 3"
        ],
        "impact": "high ou medium",
        "complexity": "low ou medium ou high",
        "timeReduction": "Porcentagem estimada de redução de esforço (ex: '85%')",
        "currentProcess": "Como o processo costuma ser moroso e doloroso de forma convencional/física",
        "optimizedProcess": "Como seria a fluidez do processo digital centralizado dentro do aplicativo"
      }`;

      const sysInstruction = "Você é o Engenheiro Analista Líder da DM Turismo. Sua prioridade máxima é estruturar otimizações reais para facilitar o dia a dia do operador e motoristas.";
      const aiResponse = await geminiService.generateText(prompt, sysInstruction);
      
      // Clean up markdown block if existing
      let cleanJson = aiResponse.trim();
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(cleanJson);
      const newSug: Suggestion = {
        ...parsed,
        id: parsed.id || `custom-${Date.now()}`,
        status: 'available'
      };

      const updated = [...suggestions, newSug];
      saveSuggestionsState(updated);
      setCustomBrief('');
      toast.success('Ideia operacional analisada e integrada ao painel de sugestões com sucesso!');
    } catch (e) {
      console.error(e);
      toast.error('Não foi possível estruturar sua ideia automaticamente. Verifique o texto inserido e tente novamente.');
    } finally {
      setIsGeneratingIdea(false);
    }
  };

  const getCategoryIcon = (cat: Suggestion['category']) => {
    switch (cat) {
      case 'frota': return <Bus size={16} className="text-cyan-400" />;
      case 'financeiro': return <DollarSign size={16} className="text-emerald-400" />;
      case 'fretamento': return <MapPin size={16} className="text-brand-accent" />;
      case 'combustivel': return <Fuel size={16} className="text-amber-500" />;
      case 'os': return <FileText size={16} className="text-purple-400" />;
      default: return <Lightbulb size={16} className="text-white" />;
    }
  };

  const getCategoryLabel = (cat: Suggestion['category']) => {
    switch (cat) {
      case 'frota': return 'Gestão de Frotas';
      case 'financeiro': return 'Financeiro & Contas';
      case 'fretamento': return 'Fretamento Contínuo';
      case 'combustivel': return 'Rastreio Diesel';
      case 'os': return 'Ordens de Serviço';
      default: return 'Customizado';
    }
  };

  // Filter recommendations
  const filteredSuggestions = suggestions.filter(s => {
    const matchesCategory = selectedCategory === 'all' || s.category === selectedCategory;
    const matchesSearch = s.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.shortDesc.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          s.detailedDesc.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Promo banner de Otimização */}
      <div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950 border border-white/5 rounded-[2rem] p-6 sm:p-10 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-72 h-72 bg-brand-accent/5 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-48 h-48 bg-indigo-500/5 rounded-full blur-[60px] pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex items-center gap-2 px-3 py-1 bg-brand-accent/15 border border-brand-accent/25 rounded-full w-fit">
              <Sparkles size={12} className="text-brand-accent animate-pulse" />
              <span className="text-[9px] font-black uppercase text-brand-accent tracking-widest">Otimização de Alto Impacto</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight leading-tight">
              Acelere a Operação da <span className="text-brand-accent italic">DM Turismo</span>
            </h2>
            <p className="text-zinc-400 text-xs sm:text-sm font-medium tracking-tight leading-relaxed">
              Mapeamos sugestões críticas para cada ferramenta do seu sistema, desenhadas especificamente para eliminar digitações desnecessárias, prevenir falhas de faturamento e agilizar o tráfego dos veículos na garagem e na rodovia.
            </p>
          </div>
          <div className="flex flex-row items-center gap-3">
            <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center">
              <span className="text-2xl font-black text-brand-accent">90%</span>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider mt-1 text-center leading-none">Menos Esforço<br />Operacional</span>
            </div>
            <div className="bg-zinc-900/90 border border-zinc-800 p-4 rounded-2xl flex flex-col items-center">
              <span className="text-2xl font-black text-emerald-400">100%</span>
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-wider mt-1 text-center leading-none">Fidelidade de<br />Faturamento</span>
            </div>
          </div>
        </div>
      </div>

      {/* Caixa de Criação de Idéia pelo Gestor (Otimizador Personalizado) */}
      <div className="bg-zinc-950/40 border border-zinc-850 rounded-[2.2rem] p-6 lg:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-accent/10 rounded-xl border border-brand-accent/15">
            <Cpu size={18} className="text-brand-accent animate-spin-slow" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">Tem uma ideia operacional em mente?</h3>
            <p className="text-[10px] font-medium text-zinc-500">O Consultor do Criador ajuda a formatar sua ideia operando como pré-projeto do sistema.</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={customBrief}
            onChange={(e) => setCustomBrief(e.target.value)}
            disabled={isGeneratingIdea}
            placeholder="Ex: Quero um sistema onde o motorista consiga assinar a OS deslizando o dedo sobre a tela e salve na planilha..."
            className="flex-1 px-5 py-4 bg-zinc-950 border border-zinc-800 hover:border-zinc-700 focus:border-brand-accent focus:ring-1 focus:ring-brand-accent text-zinc-300 placeholder-zinc-600 rounded-2xl text-xs font-medium tracking-tight outline-none transition-all disabled:opacity-50"
          />
          <button
            onClick={handleGenerateCustomIdea}
            disabled={isGeneratingIdea || !customBrief.trim()}
            className="px-6 py-4 bg-brand-accent hover:bg-brand-accent/90 disabled:bg-zinc-900 text-zinc-950 disabled:text-zinc-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-brand-accent/10 hover:shadow-brand-accent/20 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center gap-2 shrink-0 md:w-fit w-full"
          >
            {isGeneratingIdea ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-950 border-t-transparent rounded-full animate-spin" />
                <span>Formatando...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="text-zinc-950 animate-pulse" />
                <span>Adicionar Sugestão</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Barra de Filtro & Busca */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-4 justify-between pt-2">
        {/* Filtro de Categorias */}
        <div className="flex flex-wrap gap-2">
          {([
            { id: 'all', label: 'Todas as Áreas' },
            { id: 'frota', label: 'Garagem & Frota' },
            { id: 'financeiro', label: 'Financeiro' },
            { id: 'fretamento', label: 'Fretamento' },
            { id: 'combustivel', label: 'Combustível' },
            { id: 'os', label: 'Ordens de Serviço / OS' }
          ] as const).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={cn(
                "px-4.5 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border cursor-pointer transition-all duration-300",
                selectedCategory === cat.id
                  ? "bg-brand-accent text-zinc-950 border-brand-accent shadow-md shadow-brand-accent/20"
                  : "bg-zinc-950/70 border-zinc-900 text-zinc-500 hover:text-zinc-300 hover:border-zinc-800"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Campo de Busca */}
        <div className="relative w-full lg:max-w-xs shrink-0 bg-zinc-950/80 rounded-xl overflow-hidden border border-zinc-900">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar sugestão..."
            className="w-full pl-10 pr-4 py-2.5 bg-transparent text-zinc-350 text-xs font-semibold outline-none placeholder-zinc-600 focus:text-white"
          />
          <Search size={14} className="absolute left-3.5 top-3.5 text-zinc-600" />
        </div>
      </div>

      {/* Grid de Sugestões de Alterações */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <AnimatePresence>
          {filteredSuggestions.map((sug) => {
            const isShadowActive = sug.status === 'shadow_activated';
            return (
              <motion.div
                layout
                key={sug.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "bg-zinc-950/40 hover:bg-zinc-950/70 border rounded-[2rem] p-6 flex flex-col h-[320px] justify-between transition-all duration-300 shadow-md relative overflow-hidden group hover:-translate-y-1",
                  isShadowActive 
                    ? "border-emerald-500/25 shadow-emerald-950/10 hover:border-emerald-500/40" 
                    : "border-zinc-900 hover:border-zinc-800/80"
                )}
              >
                {/* Elementos de Brilho de Fundo */}
                <div className="absolute top-0 right-0 w-20 h-20 -mr-10 -mt-10 bg-brand-accent/5 rounded-full blur-xl group-hover:bg-brand-accent/10 transition-all duration-300" />
                {isShadowActive && (
                  <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl animate-pulse" />
                )}

                {/* Top Section */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-zinc-900 border border-zinc-800 rounded-lg group-hover:scale-105 transition-transform">
                        {getCategoryIcon(sug.category)}
                      </div>
                      <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                        {getCategoryLabel(sug.category)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-1.5">
                      {isShadowActive ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[7px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                          <Check size={8} className="text-emerald-400" />
                          Modo Sombra
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[7px] font-black uppercase text-zinc-400 tracking-wider">
                          Mapeada
                        </span>
                      )}
                      
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[7px] font-black uppercase tracking-wider",
                        sug.impact === 'high' 
                          ? "bg-brand-accent/10 border border-brand-accent/20 text-brand-accent" 
                          : "bg-cyan-500/10 border border-cyan-500/20 text-cyan-400"
                      )}>
                        {sug.impact === 'high' ? 'Alto Impacto' : 'Médio Impacto'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-sm font-black text-white uppercase tracking-tight leading-tight group-hover:text-brand-accent transition-colors">
                      {sug.title}
                    </h4>
                    <p className="text-[11px] text-zinc-400 line-clamp-3 font-medium leading-relaxed tracking-tight">
                      {sug.shortDesc}
                    </p>
                  </div>
                </div>

                {/* Bottom Section */}
                <div className="pt-4 border-t border-zinc-900/50 flex items-center justify-between mt-auto">
                  <div className="flex flex-col">
                    <span className="text-[14px] font-black text-brand-accent leading-none">-{sug.timeReduction}</span>
                    <span className="text-[7px] font-black text-zinc-600 uppercase tracking-widest mt-0.5">Tempo Gasto</span>
                  </div>

                  <button
                    onClick={() => handleOpenSimulation(sug)}
                    className="px-4.5 py-3.5 bg-zinc-900 group-hover:bg-brand-accent text-zinc-300 group-hover:text-zinc-950 border border-zinc-850 hover:border-brand-accent rounded-xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 hover:shadow-md hover:shadow-brand-accent/15"
                  >
                    <span>Abrir Ficha Técnica</span>
                    <ChevronRight size={12} className="transition-transform duration-300 group-hover:translate-x-0.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {filteredSuggestions.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center border border-zinc-900 bg-zinc-950/20 rounded-[2.5rem] text-center max-w-sm mx-auto">
            <AlertTriangle className="text-zinc-600 w-10 h-10 mb-4 animate-bounce" />
            <p className="text-zinc-400 text-xs font-black uppercase tracking-wider">Nenhuma sugestão localizada</p>
            <p className="text-zinc-600 text-[10px] font-medium mt-1 leading-snug">
              Experimente alterar os filtros de categoria ou redefinir o termo digitado na barra de pesquisa.
            </p>
          </div>
        )}
      </div>

      {/* Modal Ficha Técnica & Simulação de Fluxo de Trabalho */}
      <AnimatePresence>
        {activeSimulation && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-950 border border-zinc-850 rounded-[2.5rem] max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative scrollbar-none"
            >
              {/* Fechar */}
              <button
                onClick={() => {
                  if (!isSimulatingShadow) setActiveSimulation(null);
                }}
                disabled={isSimulatingShadow}
                className="absolute top-6 right-6 p-2 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                <X size={16} />
              </button>

              {/* Conteúdo */}
              <div className="p-8 sm:p-10 space-y-8">
                {/* Cabeçalho */}
                <div className="space-y-3 pr-8">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-brand-accent/15 border border-brand-accent/25 rounded-full text-[8px] font-black uppercase tracking-widest text-brand-accent flex items-center gap-1.5">
                      <Zap size={10} className="text-brand-accent" />
                      Ficha de Otimização Operacional
                    </span>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                      activeSimulation.category === 'frota' ? "bg-cyan-500/10 border-cyan-500/20 text-cyan-400" :
                      activeSimulation.category === 'financeiro' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      activeSimulation.category === 'fretamento' ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                      activeSimulation.category === 'combustivel' ? "bg-amber-500/10 border-amber-500/20 text-amber-500" :
                      "bg-purple-500/10 border-purple-500/20 text-purple-400"
                    )}>
                      {getCategoryLabel(activeSimulation.category)}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight mt-1.5 leading-snug">
                    {activeSimulation.title}
                  </h3>
                  <p className="text-zinc-550 text-[10px] uppercase font-black tracking-widest">
                    Impacto Estimado: <strong className="text-white font-extrabold">{activeSimulation.impact === 'high' ? 'MÁXIMO' : 'MODERADO'}</strong> • Complexidade de Integração: <strong className="text-white font-extrabold">{activeSimulation.complexity.toUpperCase()}</strong>
                  </p>
                </div>

                {/* Resumo */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black text-zinc-650 uppercase tracking-widest border-b border-zinc-900 pb-1.5">Justificativa & Engenharia do Processo</h4>
                  <p className="text-zinc-300 text-xs font-semibold leading-relaxed tracking-tight">
                    {activeSimulation.detailedDesc}
                  </p>
                </div>

                {/* Comparação Físico x Digital */}
                <div className="space-y-4 bg-zinc-900/60 border border-zinc-850 rounded-2xl p-6">
                  <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Clock size={12} className="text-brand-accent" />
                    Simulador de Redução de Impacto por Viagem / Operação
                  </h4>
                  
                  {/* Processo Atual */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase text-zinc-500">
                      <span>Processo Atual (Físico / Redundante)</span>
                      <span className="text-rose-400 font-bold">Lento / Sujeito a Perdas</span>
                    </div>
                    <div className="h-6 bg-zinc-950 rounded-lg overflow-hidden flex items-center px-3 relative border border-zinc-850">
                      <div className="h-full bg-rose-500/10 absolute left-0 top-0 w-full rounded-r-lg border-r-2 border-rose-500" />
                      <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-wider relative z-10 truncate">
                        Fluxo Manual: Conferências, papéis, digitação, redigitação
                      </span>
                    </div>
                  </div>

                  {/* Processo Otimizado */}
                  <div className="space-y-1.5 mt-4">
                    <div className="flex items-center justify-between text-[9px] font-black uppercase text-zinc-500">
                      <span>Processo Otimizado (Digital / IA Atomizado)</span>
                      <span className="text-emerald-400 font-bold">-{activeSimulation.timeReduction} do Tempo Total</span>
                    </div>
                    <div className="h-6 bg-zinc-950 rounded-lg overflow-hidden flex items-center px-3 relative border border-zinc-850">
                      <div className="h-full bg-emerald-500/20 absolute left-0 top-0 rounded-r-lg border-r-2 border-emerald-500" style={{ width: '12%' }} />
                      <span className="text-[8px] font-bold text-emerald-400 uppercase tracking-wider relative z-10 truncate pl-1">
                        Fluxo Ágil: Auto-geração em 1 Clique fidedignamente
                      </span>
                    </div>
                  </div>
                </div>

                {/* Detalhes de Fluxo (Lado a Lado) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="p-5 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-rose-500 font-black text-[9px] uppercase tracking-wider">
                      <AlertTriangle size={12} />
                      Rotina Atual
                    </div>
                    <p className="text-[10px] text-zinc-400 leading-relaxed font-semibold tracking-tight">
                      {activeSimulation.currentProcess}
                    </p>
                  </div>
                  <div className="p-5 bg-zinc-900/40 border border-zinc-900/80 rounded-2xl space-y-2">
                    <div className="flex items-center gap-2 text-emerald-500 font-black text-[9px] uppercase tracking-wider">
                      <Check size={12} />
                      Rotina Otimizada
                    </div>
                    <p className="text-[10px] text-zinc-350 leading-relaxed font-semibold tracking-tight">
                      {activeSimulation.optimizedProcess}
                    </p>
                  </div>
                </div>

                {/* Benefícios */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-zinc-650 uppercase tracking-widest border-b border-zinc-900 pb-1.5">Ganhos de Produtividade Esperados</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {activeSimulation.benefits.map((ben, idx) => (
                      <div key={idx} className="p-4 bg-zinc-950 border border-zinc-900 rounded-xl flex items-start gap-2.5">
                        <ThumbsUp size={12} className="text-brand-accent shrink-0 mt-0.5" />
                        <span className="text-[10px] font-bold text-zinc-300 tracking-tight leading-normal uppercase">
                          {ben}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ações Inteligentes */}
                <div className="pt-6 border-t border-zinc-900/80 flex flex-col sm:flex-row gap-3 items-center justify-end">
                  {isSimulatingShadow ? (
                    <div className="w-full space-y-3 bg-zinc-900 p-5 rounded-2xl border border-zinc-800">
                      <div className="flex items-center justify-between text-[9px] font-black uppercase text-zinc-400 leading-none">
                        <span className="animate-pulse">{simulationStep}</span>
                        <span>{simulationProgress}%</span>
                      </div>
                      <div className="h-1 bg-zinc-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-300"
                          style={{ width: `${simulationProgress}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setActiveSimulation(null)}
                        className="px-6 py-3.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-400 hover:text-white border border-zinc-850 hover:border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer w-full sm:w-auto"
                      >
                        Fechar Ficha
                      </button>

                      {activeSimulation.status === 'available' ? (
                        <button
                          type="button"
                          onClick={() => handleActivateShadow(activeSimulation.id)}
                          className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 border border-emerald-400 hover:border-emerald-355 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/15 hover:shadow-emerald-500/25 cursor-pointer flex items-center justify-center gap-2 w-full sm:w-auto"
                        >
                          <Play size={12} className="text-zinc-950 fill-zinc-950" />
                          <span>Ativar Modo Sombra</span>
                        </button>
                      ) : (
                        <div className="px-6 py-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase text-emerald-400 tracking-widest flex items-center gap-2 justify-center w-full sm:w-auto">
                          <Check size={14} className="text-emerald-400" />
                          <span>Preparada no Ambiente Paralelo</span>
                        </div>
                      )}
                    </>
                  )}
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
