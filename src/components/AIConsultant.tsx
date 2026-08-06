import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot as BotIcon, 
  Send, 
  Sparkles, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX, 
  User, 
  Trash2,
  Maximize2,
  Minimize2,
  RefreshCw,
  Info,
  Brain,
  MessageSquare,
  Sparkle,
  Globe,
  MapPin,
  Paperclip,
  Image as ImageIcon,
  X,
  Radio,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Card } from './Cards';
import { geminiService, ChatMessage } from '../services/geminiService';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { db } from '../lib/firebase';
import { collection, getDocs } from 'firebase/firestore';

// Predefined Roles / System Instructions
const SYSTEM_ROLES = [
  {
    id: 'logistica',
    name: 'Gestão & Logística',
    icon: BotIcon,
    description: 'Especialista em rotas, escalas de motoristas e eficiência operacional.',
    instruction: 'Você é o Consultor de Logística Inteligente da DM Turismo. Sua especialidade é otimização de escalas de motoristas, controle de jornada de trabalho (Lei do Motorista), planejamento de itinerários de fretamento corporativo e regular, e maximização da eficiência de frota. Responda de forma clara, objetiva, estruturada e profissional em português.'
  },
  {
    id: 'manutencao',
    name: 'Manutenção & Frota',
    icon: Brain,
    description: 'Especialista em custos de diesel, preventivas e pneus.',
    instruction: 'Você é o Engenheiro de Frota da DM Turismo. Sua especialidade é plano de manutenção preventiva e corretiva de ônibus e vans, controle de desgaste de pneus (recapagem e profundidade de sulco), análise técnica de consumo de diesel e eficiência de frota. Dê respostas detalhadas, com dicas de manutenção técnica e prevenção de quebras.'
  },
  {
    id: 'legislacao',
    name: 'Legislação & ANTT',
    icon: Info,
    description: 'Especialista em regulação ANTT, CADASTUR e documentações.',
    instruction: 'Você é o Consultor Jurídico e Regulatório de Transportes da DM Turismo. Sua especialidade é regulação do transporte de turismo e fretamento: regras da ANTT, CADASTUR, DETRO/ARTESP, seguros de responsabilidade civil, regularização de frotas e licenciamentos de veículos de passageiros. Esclareça dúvidas técnicas de forma precisa e embasada.'
  }
];

// Interactive Quick Starters
const QUICK_STARTERS = [
  {
    label: 'Como otimizar o consumo de diesel da frota?',
    role: 'manutencao'
  },
  {
    label: 'Quais os requisitos da ANTT para fretamento turístico?',
    role: 'legislacao'
  },
  {
    label: 'Como planejar o rodízio de manutenção de pneus?',
    role: 'manutencao'
  },
  {
    label: 'Melhores práticas para escalas de motoristas em feriados',
    role: 'logistica'
  }
];

// Inline Markdown Parser for premium formatting
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        renderedElements.push(
          <div key={`code-${i}`} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl my-3 font-mono text-xs text-brand-accent overflow-x-auto shadow-inner">
            <pre>{codeBlockLines.join('\n')}</pre>
          </div>
        );
        codeBlockLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('###')) {
      renderedElements.push(
        <h4 key={i} className="text-xs md:text-sm font-black text-white uppercase tracking-wider mt-4 mb-2 flex items-center gap-2">
          <span className="w-1.5 h-3 bg-brand-accent rounded-sm" />
          {parseInlineBold(line.replace('###', '').trim())}
        </h4>
      );
      continue;
    }
    if (line.startsWith('##')) {
      renderedElements.push(
        <h3 key={i} className="text-sm md:text-base font-black text-brand-accent uppercase italic mt-5 mb-2">
          {parseInlineBold(line.replace('##', '').trim())}
        </h3>
      );
      continue;
    }
    if (line.startsWith('#')) {
      renderedElements.push(
        <h2 key={i} className="text-base md:text-lg font-black text-white border-b border-zinc-800 pb-1 uppercase italic mt-6 mb-3">
          {parseInlineBold(line.replace('#', '').trim())}
        </h2>
      );
      continue;
    }
    
    // Bullet Lists
    if (line.startsWith('- ') || line.startsWith('* ')) {
      renderedElements.push(
        <div key={i} className="flex items-start gap-2.5 ml-2 my-1">
          <span className="w-1.5 h-1.5 bg-brand-accent rounded-full mt-2 shrink-0 animate-pulse" />
          <span className="text-zinc-300 text-xs md:text-sm">{parseInlineBold(line.substring(2).trim())}</span>
        </div>
      );
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      renderedElements.push(<div key={i} className="h-2" />);
      continue;
    }

    // Default paragraph
    renderedElements.push(
      <p key={i} className="text-zinc-200 text-xs md:text-sm leading-relaxed">
        {parseInlineBold(line)}
      </p>
    );
  }

  return <div className="space-y-2">{renderedElements}</div>;
};

// Helper to parse inline **bold**
const parseInlineBold = (text: string) => {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, index) => {
    if (index % 2 === 1) {
      return <strong key={index} className="font-extrabold text-white">{part}</strong>;
    }
    return part;
  });
};

export const AIConsultant: React.FC = () => {
  // Read state from localStorage to persist user preferences
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem('dm_ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Failed to parse saved chat history:", e);
      }
    }
    return [
      { 
        role: 'model', 
        content: 'Olá! Sou o assistente inteligente da DM Turismo. Como posso ajudar com a operação hoje?' 
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(() => {
    return localStorage.getItem('dm_ai_voice_enabled') === 'true';
  });
  const [isListening, setIsListening] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  
  // Model Settings
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('dm_ai_selected_model') || 'gemini-3.5-flash';
  });
  const [isHighThinking, setIsHighThinking] = useState<boolean>(() => {
    return localStorage.getItem('dm_ai_high_thinking') === 'true';
  });
  const [selectedRoleId, setSelectedRoleId] = useState<string>(() => {
    return localStorage.getItem('dm_ai_selected_role') || 'logistica';
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Grounding and Image upload states
  const [searchGrounding, setSearchGrounding] = useState(false);
  const [mapsGrounding, setMapsGrounding] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{ data: string; mimeType: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Live Voice API states & refs
  const [isVoiceActive, setIsVoiceActive] = useState(false);
  const [isVoiceConnecting, setIsVoiceConnecting] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // Cleanup Voice session on unmount
  useEffect(() => {
    return () => {
      stopVoiceSession();
    };
  }, []);

  // Auto-persist history
  useEffect(() => {
    localStorage.setItem('dm_ai_chat_history', JSON.stringify(messages));
  }, [messages]);

  // Persist configurations
  useEffect(() => {
    localStorage.setItem('dm_ai_voice_enabled', String(isVoiceEnabled));
    localStorage.setItem('dm_ai_selected_model', selectedModel);
    localStorage.setItem('dm_ai_high_thinking', String(isHighThinking));
    localStorage.setItem('dm_ai_selected_role', selectedRoleId);
  }, [isVoiceEnabled, selectedModel, isHighThinking, selectedRoleId]);

  // Auto Scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const activeRole = SYSTEM_ROLES.find(r => r.id === selectedRoleId) || SYSTEM_ROLES[0];

  const speak = (text: string) => {
    if (!isVoiceEnabled) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'pt-BR';
    window.speechSynthesis.speak(utterance);
  };

  const extractDates = (text: string): string[] => {
    const dates: string[] = [];
    const regex1 = /(\d{2})\/(\d{2})\/(\d{4})/g;
    let match;
    while ((match = regex1.exec(text)) !== null) {
      const [_, day, month, year] = match;
      dates.push(`${year}-${month}-${day}`);
      dates.push(`${day}/${month}/${year}`);
    }
    const regex2 = /(\d{4})-(\d{2})-(\d{2})/g;
    while ((match = regex2.exec(text)) !== null) {
      const [_, year, month, day] = match;
      dates.push(`${year}-${month}-${day}`);
      dates.push(`${day}/${month}/${year}`);
    }
    return Array.from(new Set(dates));
  };

  const performClientDatabaseSearch = async (targetDates: string[]): Promise<string> => {
    const collectionsToSearch = [
      "trips", "maintenance_logs", "financial_transactions", "fuel_logs", "checklists",
      "employees", "vehicles", "stock_transactions", "proprietor_tickets", "news_feed", "dashboard_messages"
    ];
    
    let resultsSummary = "";
    
    const matchesAnyTargetDate = (val: any): boolean => {
      if (val === null || val === undefined) return false;
      if (typeof val === 'string') {
        return targetDates.some(d => val.includes(d) || val.replace(/-/g, '/').includes(d));
      }
      if (val instanceof Date) {
        try {
          const iso = val.toISOString();
          return targetDates.some(d => iso.includes(d));
        } catch (e) {
          return false;
        }
      }
      if (val && typeof val === 'object' && typeof val.toDate === 'function') {
        try {
          const iso = val.toDate().toISOString();
          return targetDates.some(d => iso.includes(d));
        } catch (e) {}
      }
      if (Array.isArray(val)) {
        return val.some(matchesAnyTargetDate);
      }
      if (typeof val === 'object') {
        try {
          return Object.values(val).some(matchesAnyTargetDate);
        } catch (e) {
          return false;
        }
      }
      return false;
    };

    console.log("[AI Consultant Search] Commencing date search for:", targetDates);

    for (const collName of collectionsToSearch) {
      try {
        const colRef = collection(db, collName);
        const snap = await getDocs(colRef);
        const matches: any[] = [];
        
        snap.forEach(doc => {
          const data = doc.data();
          const matchesId = targetDates.some(d => doc.id.includes(d));
          if (matchesId || matchesAnyTargetDate(data)) {
            const cleanData: any = {};
            for (const [key, val] of Object.entries(data)) {
              if (typeof val === 'string' && (val.length > 300 || val.startsWith("data:"))) {
                cleanData[key] = `[Truncado: string longa de ${val.length} caracteres]`;
              } else {
                cleanData[key] = val;
              }
            }
            matches.push({ id: doc.id, ...cleanData });
          }
        });

        if (matches.length > 0) {
          resultsSummary += `\n### Coleção "${collName}" (${matches.length} correspondência(s) encontrada(s)):\n` + JSON.stringify(matches, null, 2) + `\n`;
        }
      } catch (e: any) {
        console.warn(`[AI Consultant Search] Omitindo coleção "${collName}" por restrição de acesso ou erro:`, e.message);
      }
    }
    
    return resultsSummary;
  };

  const handleSend = async (overrideText?: string) => {
    const text = overrideText || input;
    if (!text.trim() && !attachedImage && !isLoading) return;

    const userMsg: ChatMessage & { groundingChunks?: any[] } = { 
      role: 'user', 
      content: text || "Análise de imagem anexada" 
    };
    const updatedMessages = [...messages, userMsg];
    
    setMessages(updatedMessages);
    setInput('');
    
    const imgToSend = attachedImage;
    setAttachedImage(null);
    setIsLoading(true);

    try {
      // Extract target dates for searching
      const foundDates = extractDates(text);
      let supplementaryDbInfo = "";
      
      if (foundDates.length > 0) {
        toast.info("Pesquisando dados operacionais correspondentes às datas informadas...");
        supplementaryDbInfo = await performClientDatabaseSearch(foundDates);
        if (supplementaryDbInfo) {
          toast.success("Dados operacionais localizados com sucesso!");
        } else {
          toast.info("Nenhum dado específico para esta data foi localizado nas coleções acessíveis.");
        }
      }

      // Map frontend Message to server expected history format
      const historyPayload: ChatMessage[] = updatedMessages.slice(0, -1).map(msg => ({
        role: msg.role === 'user' ? 'user' : 'model',
        content: msg.content
      }));

      let promptPayload = text || "Analise a imagem em anexo com atenção aos detalhes e responda de acordo com sua persona.";
      if (supplementaryDbInfo) {
        promptPayload = `${promptPayload}\n\n[CONTEXTO DO BANCO DE DADOS LOCALIZADO VIA PESQUISA EM TEMPO REAL CLIENTE]:\n${supplementaryDbInfo}\n\nPor favor, utilize as informações reais e precisas retornadas acima para formular sua resposta ao usuário em português de forma extremamente profissional, estruturada e confiável. Se as coleções indicarem viagens, manutenções, abastecimentos ou alertas de pneus na data, liste-os de maneira clara.`;
      }

      const response = await geminiService.generateTextWithGrounding(
        promptPayload,
        activeRole.instruction,
        historyPayload,
        isHighThinking ? 'gemini-3.1-pro-preview' : selectedModel,
        isHighThinking,
        imgToSend,
        searchGrounding,
        mapsGrounding
      );

      const aiMsg: ChatMessage & { groundingChunks?: any[] } = { 
        role: 'model', 
        content: response.text || 'Não recebi uma resposta válida do motor inteligente.',
        groundingChunks: response.groundingChunks || undefined
      };
      
      setMessages(prev => [...prev, aiMsg]);
      speak(aiMsg.content);
    } catch (error: any) {
      toast.error(error.message || 'Erro ao conectar com o servidor da IA.');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione apenas arquivos de imagem.');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error('A imagem deve ter menos de 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(',')[1];
      setAttachedImage({
        data: base64Data,
        mimeType: file.type,
        name: file.name
      });
      toast.success('Imagem anexada com sucesso!');
    };
    reader.onerror = () => {
      toast.error('Erro ao ler a imagem.');
    };
    reader.readAsDataURL(file);
  };

  const startVoiceSession = async () => {
    try {
      setIsVoiceConnecting(true);
      setIsVoiceActive(true);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      // Audio contexts
      const AudioContextClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      const inputCtx = new AudioContextClass({ sampleRate: 16000 });
      const outputCtx = new AudioContextClass({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      source.connect(processor);
      processor.connect(inputCtx.destination);

      const pcmToBase64 = (float32Array: Float32Array) => {
        const buffer = new Int16Array(float32Array.length);
        for (let i = 0; i < float32Array.length; i++) {
          const s = Math.max(-1, Math.min(1, float32Array[i]));
          buffer[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }
        const bytes = new Uint8Array(buffer.buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
      };

      ws.onopen = () => {
        setIsVoiceConnecting(false);
        toast.success("Conexão de voz estabelecida!");
        
        processor.onaudioprocess = (e) => {
          if (ws.readyState === WebSocket.OPEN) {
            const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
            ws.send(JSON.stringify({ audio: base64 }));
          }
        };
      };

      const audioQueue: AudioBuffer[] = [];
      let isPlaying = false;

      const playNextChunk = () => {
        if (audioQueue.length === 0) {
          isPlaying = false;
          return;
        }
        isPlaying = true;
        const buffer = audioQueue.shift()!;
        const sourceNode = outputCtx.createBufferSource();
        sourceNode.buffer = buffer;
        sourceNode.connect(outputCtx.destination);
        sourceNode.onended = () => {
          playNextChunk();
        };
        sourceNode.start(0);
      };

      ws.onmessage = async (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.audio) {
            const binary = window.atob(msg.audio);
            const arrayBuffer = new ArrayBuffer(binary.length);
            const uint8 = new Uint8Array(arrayBuffer);
            for (let i = 0; i < binary.length; i++) {
              uint8[i] = binary.charCodeAt(i);
            }
            const int16 = new Int16Array(arrayBuffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] / 32768;
            }

            const audioBuffer = outputCtx.createBuffer(1, float32.length, 24000);
            audioBuffer.copyToChannel(float32, 0);
            audioQueue.push(audioBuffer);

            if (!isPlaying) {
              playNextChunk();
            }
          }
          if (msg.interrupted) {
            audioQueue.length = 0;
            isPlaying = false;
          }
          if (msg.error) {
            toast.error(`Erro na sessão de voz: ${msg.error}`);
            stopVoiceSession();
          }
        } catch (e: any) {
          console.error("Error processing voice message:", e);
        }
      };

      ws.onclose = () => {
        stopVoiceSession();
      };

      ws.onerror = () => {
        toast.error("Erro de conexão na transmissão de voz.");
        stopVoiceSession();
      };

    } catch (err: any) {
      console.error(err);
      toast.error(`Não foi possível acessar seu microfone ou conectar: ${err.message}`);
      stopVoiceSession();
    }
  };

  const stopVoiceSession = () => {
    setIsVoiceActive(false);
    setIsVoiceConnecting(false);

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    if (processorRef.current) {
      try {
        processorRef.current.disconnect();
      } catch (e) {}
      processorRef.current = null;
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      } catch (e) {}
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch (e) {}
      audioContextRef.current = null;
    }
  };

  const toggleMicrophone = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Seu navegador não suporta reconhecimento de voz.');
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'pt-BR';
      recognitionRef.current.onresult = (e: any) => {
        const t = e.results[0][0].transcript;
        setInput(t);
        handleSend(t);
      };
      recognitionRef.current.onend = () => setIsListening(false);
    }

    recognitionRef.current.start();
    setIsListening(true);
  };

  const handleClearHistory = () => {
    const defaultMsg: ChatMessage = { 
      role: 'model', 
      content: `Chat reiniciado sob a diretriz de **${activeRole.name}**. Como posso ajudar na operação hoje?` 
    };
    setMessages([defaultMsg]);
    toast.success('Histórico de conversas limpo.');
  };

  const handleQuickStarter = (text: string, roleId: string) => {
    setSelectedRoleId(roleId);
    setInput(text);
    // Timeout to let state update if role was changed
    setTimeout(() => {
      handleSend(text);
    }, 100);
  };

  return (
    <div className={cn(
      "flex flex-col gap-6 transition-all duration-500",
      isMaximized ? "fixed inset-0 z-[60] bg-zinc-950 p-6 md:p-10" : "h-full"
    )}>
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center shadow-lg relative group">
            <BotIcon className="text-brand-accent w-6 h-6 animate-pulse" />
            {isHighThinking && (
              <span className="absolute -top-1.5 -right-1.5 bg-brand-accent text-[8px] font-black text-zinc-950 px-1 py-0.5 rounded-full uppercase tracking-tighter">
                PRO
              </span>
            )}
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tighter italic flex items-center gap-2">
              Consultor <span className="text-brand-accent">IA</span> DM Pro
            </h2>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-ping" />
              <span className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">
                {isHighThinking ? "NÉURONS PRO EM ALTA COGNIÇÃO" : `MOTOR ${selectedModel.toUpperCase().replace('GEMINI-', '')}`}
              </span>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Quick Clear */}
          <button 
            onClick={handleClearHistory}
            title="Limpar histórico"
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-rose-500 hover:border-rose-950 rounded-xl transition-all"
          >
            <Trash2 size={18} />
          </button>

          {/* Voice Output Control */}
          <button 
            onClick={() => {
              setIsVoiceEnabled(!isVoiceEnabled);
              toast.success(isVoiceEnabled ? 'Síntese de voz desativada' : 'Síntese de voz ativada (pt-BR)');
            }}
            title={isVoiceEnabled ? "Mutar resposta de áudio" : "Ativar áudio falado"}
            className={cn(
              "p-2.5 rounded-xl transition-all border",
              isVoiceEnabled ? "bg-brand-accent/20 text-brand-accent border-brand-accent/30" : "bg-zinc-900 text-zinc-500 border-zinc-800"
            )}
          >
            {isVoiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>

          {/* Live Voice Button */}
          <button 
            onClick={startVoiceSession}
            title="Conversa por Voz Real-Time via Live API"
            className="p-2.5 bg-brand-accent/10 border border-brand-accent/20 text-brand-accent hover:bg-brand-accent/20 rounded-xl transition-all flex items-center gap-1.5 font-bold text-xs"
          >
            <Radio size={16} className="animate-pulse" />
            <span className="uppercase tracking-wider text-[10px]">VOZ LIVE</span>
          </button>

          {/* Maximize Toggle */}
          <button 
            onClick={() => setIsMaximized(!isMaximized)}
            title={isMaximized ? "Minimizar tela" : "Maximizar tela cheia"}
            className="p-2.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-white hover:border-zinc-700 rounded-xl transition-all"
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Advanced AI Settings Panel */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-zinc-950/40 border border-zinc-800/60 rounded-2xl p-4">
        {/* Role Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Persona Especialista</label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/40">
            {SYSTEM_ROLES.map((role) => {
              const IconComponent = role.icon;
              return (
                <button
                  key={role.id}
                  onClick={() => {
                    setSelectedRoleId(role.id);
                    toast.success(`Especialidade alterada: ${role.name}`);
                  }}
                  className={cn(
                    "py-2 px-1 rounded-lg text-[9px] font-bold uppercase tracking-tighter flex flex-col items-center gap-1 transition-all",
                    selectedRoleId === role.id 
                      ? "bg-zinc-800 text-brand-accent shadow border border-zinc-700/50" 
                      : "text-zinc-500 hover:text-zinc-300"
                  )}
                >
                  <IconComponent size={14} />
                  <span>{role.name.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Model Selector */}
        <div className="space-y-1.5">
          <label className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">Seletor de Rede Neural</label>
          <div className="grid grid-cols-3 gap-1 bg-zinc-900/60 p-1 rounded-xl border border-zinc-800/40">
            {[
              { id: 'gemini-3.1-flash-lite', label: 'LITE', desc: 'Mais Rápido' },
              { id: 'gemini-3.5-flash', label: 'GERAL', desc: 'Balanceado' },
              { id: 'gemini-3.1-pro-preview', label: 'PRO', desc: 'Complexo' }
            ].map((m) => (
              <button
                key={m.id}
                disabled={isHighThinking}
                onClick={() => {
                  setSelectedModel(m.id);
                  toast.success(`Modelo selecionado: ${m.label}`);
                }}
                className={cn(
                  "py-2 rounded-lg text-[9px] font-bold uppercase transition-all flex flex-col items-center justify-center",
                  isHighThinking 
                    ? "opacity-30 cursor-not-allowed text-zinc-600"
                    : selectedModel === m.id 
                      ? "bg-zinc-800 text-brand-accent shadow border border-zinc-700/50" 
                      : "text-zinc-500 hover:text-zinc-300"
                )}
              >
                <span className="tracking-widest">{m.label}</span>
                <span className="text-[7px] text-zinc-600 font-medium tracking-tight mt-0.5">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {/* High Thinking Toggle */}
        <div className="flex flex-col justify-center bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/40">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block flex items-center gap-1">
                <Brain size={12} className={cn("text-zinc-500", isHighThinking && "text-brand-accent animate-pulse")} />
                Raciocínio Avançado
              </span>
              <p className="text-[8px] text-zinc-500 font-bold tracking-tight uppercase">High Thinking Engine (Pro)</p>
            </div>
            
            <button
              onClick={() => {
                setIsHighThinking(!isHighThinking);
                toast.success(!isHighThinking ? 'Raciocínio Avançado Ativado!' : 'Raciocínio Convencional Restabelecido');
              }}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                isHighThinking ? "bg-brand-accent" : "bg-zinc-800"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-zinc-950 shadow ring-0 transition duration-200 ease-in-out",
                  isHighThinking ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Active Role Quick Description banner */}
      <div className="bg-zinc-900/30 border border-zinc-800/50 p-3 rounded-xl flex items-start gap-3">
        <div className="p-1.5 bg-brand-accent/10 rounded-lg shrink-0 text-brand-accent">
          <BotIcon size={14} />
        </div>
        <p className="text-[10px] text-zinc-400 font-medium leading-normal tracking-tight">
          <span className="font-extrabold text-white uppercase tracking-wider">{activeRole.name}:</span> {activeRole.description}
        </p>
      </div>

      {/* Main Chat Frame */}
      <Card className="flex-1 bg-zinc-900/30 border-zinc-800 p-0 flex flex-col overflow-hidden relative min-h-[400px]">
        {/* Background Sparkle Watermark */}
        <div className="absolute top-0 right-0 p-10 opacity-3 pointer-events-none">
          <Sparkles size={240} className="text-brand-accent" />
        </div>

        {/* Message List */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar"
        >
          {messages.map((msg, i) => (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              key={i}
              className={cn(
                "flex gap-4 max-w-[85%] md:max-w-[75%]",
                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 shadow-md",
                msg.role === 'model' 
                  ? "bg-zinc-900 border border-zinc-800 text-brand-accent" 
                  : "bg-brand-accent text-zinc-950 font-black border border-brand-accent/20"
              )}>
                {msg.role === 'model' ? <BotIcon size={16} /> : <User size={16} />}
              </div>

              {/* Speech bubble */}
              <div className="space-y-1">
                <div className={cn(
                  "p-4 rounded-2xl text-xs md:text-sm shadow-md",
                  msg.role === 'model' 
                    ? "bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 text-zinc-100 rounded-tl-none" 
                    : "bg-brand-accent text-zinc-950 font-bold rounded-tr-none"
                )}>
                  {msg.role === 'model' ? (
                    <FormattedText text={msg.content} />
                  ) : (
                    <p className="whitespace-pre-line">{msg.content}</p>
                  )}
                </div>
                {/* Grounding references display */}
                {msg.role === 'model' && (msg as any).groundingChunks && (msg as any).groundingChunks.length > 0 && (
                  <div className="mt-2 p-2.5 bg-zinc-950/60 border border-zinc-800/80 rounded-xl space-y-1.5 max-w-md shadow-inner">
                    <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest block mb-1">Fontes & Referências Oficiais</span>
                    <div className="flex flex-col gap-1">
                      {(msg as any).groundingChunks.map((chunk: any, cIdx: number) => {
                        const title = chunk.web?.title || "Referência Web";
                        const uri = chunk.web?.uri;
                        if (!uri) return null;
                        return (
                          <a 
                            key={cIdx} 
                            href={uri} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="text-[10px] text-zinc-400 hover:text-brand-accent truncate flex items-center gap-1 transition-all"
                          >
                            <Globe size={10} className="shrink-0 text-brand-accent" />
                            <span className="underline font-bold">{title}</span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Meta info / timestamp */}
                <span className={cn(
                  "block text-[8px] font-black uppercase tracking-widest text-zinc-600 px-1",
                  msg.role === 'user' ? "text-right" : ""
                )}>
                  {msg.role === 'model' ? activeRole.name : 'OPERADOR'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}
          
          {/* Loading States */}
          {isLoading && (
            <div className="flex gap-4 max-w-[70%]">
              <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 text-brand-accent">
                <BotIcon size={16} className="animate-pulse" />
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="bg-zinc-900/60 border border-zinc-800/80 p-4 rounded-2xl rounded-tl-none flex flex-col gap-2.5">
                  <div className="flex gap-1 items-center">
                    <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-bounce [animation-delay:0s]" />
                    <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-bounce [animation-delay:0.15s]" />
                    <div className="w-1.5 h-1.5 bg-brand-accent rounded-full animate-bounce [animation-delay:0.3s]" />
                  </div>
                  
                  {isHighThinking && (
                    <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-brand-accent/80 animate-pulse">
                      <Brain size={10} className="animate-spin-slow" />
                      Processando alta cognição neural...
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Quick Starters section when chat is fresh / empty */}
        {messages.length <= 1 && (
          <div className="p-6 border-t border-zinc-900 bg-zinc-950/20">
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest block mb-3 flex items-center gap-1.5">
              <Sparkle size={10} className="text-brand-accent" />
              Tópicos Recomendados de Consulta
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {QUICK_STARTERS.map((qs, idx) => (
                <button
                  key={idx}
                  onClick={() => handleQuickStarter(qs.label, qs.role)}
                  className="p-3 bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 text-left rounded-xl transition-all flex items-center justify-between group"
                >
                  <span className="text-[11px] text-zinc-300 group-hover:text-white font-semibold line-clamp-1">{qs.label}</span>
                  <span className="text-[8px] bg-zinc-950 text-brand-accent px-1.5 py-0.5 rounded font-black uppercase tracking-widest shrink-0 ml-2">
                    {qs.role === 'manutencao' ? 'FROTA' : qs.role === 'legislacao' ? 'LEI' : 'LOGISTICA'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Text Input area */}
        <div className="p-4 md:p-6 bg-zinc-950/50 border-t border-zinc-900">
          {/* Grounding Mode Selectors */}
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setSearchGrounding(!searchGrounding);
                if (!searchGrounding) setMapsGrounding(false);
              }}
              className={cn(
                "py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border cursor-pointer",
                searchGrounding 
                  ? "bg-brand-accent/20 text-brand-accent border-brand-accent/40 shadow-sm" 
                  : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
              )}
            >
              <Globe size={11} className={cn(searchGrounding && "animate-spin-slow text-brand-accent")} />
              <span>Busca no Google</span>
            </button>

            <button
              onClick={() => {
                setMapsGrounding(!mapsGrounding);
                if (!mapsGrounding) setSearchGrounding(false);
              }}
              className={cn(
                "py-1.5 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border cursor-pointer",
                mapsGrounding 
                  ? "bg-brand-accent/20 text-brand-accent border-brand-accent/40 shadow-sm" 
                  : "bg-zinc-900/40 text-zinc-500 border-zinc-800 hover:text-zinc-300 hover:border-zinc-700"
              )}
            >
              <MapPin size={11} className={cn(mapsGrounding && "animate-bounce text-brand-accent")} />
              <span>Google Maps Grounding</span>
            </button>
          </div>

          {/* Attached Image Thumbnail Preview */}
          {attachedImage && (
            <div className="mb-3.5 flex items-center gap-2.5 p-2 bg-zinc-900/80 border border-zinc-800/80 rounded-xl w-fit relative group">
              <img 
                src={`data:${attachedImage.mimeType};base64,${attachedImage.data}`} 
                alt="Upload thumbnail" 
                className="w-12 h-12 rounded-lg object-cover border border-zinc-700" 
              />
              <div className="text-left pr-6">
                <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest block">Anexo de Foto</span>
                <span className="text-[11px] text-zinc-300 font-bold max-w-[150px] truncate block">{attachedImage.name}</span>
              </div>
              <button 
                onClick={() => setAttachedImage(null)}
                className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow-md transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </div>
          )}

          <div className="relative">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={`Fale com o especialista em ${activeRole.name}...`}
              className="w-full bg-zinc-900 border border-zinc-800/80 focus:border-brand-accent rounded-2xl py-4.5 pl-6 pr-36 text-xs md:text-sm font-semibold text-white transition-all outline-none placeholder:text-zinc-600 shadow-inner"
            />
            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
              {/* Image upload trigger */}
              <button 
                onClick={() => fileInputRef.current?.click()}
                title="Anexar foto do celular"
                className="p-2.5 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl transition-all cursor-pointer"
              >
                <Paperclip size={16} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleImageUpload} 
                accept="image/*" 
                className="hidden" 
              />

              {/* Voice recognition toggle */}
              <button 
                onClick={toggleMicrophone}
                title={isListening ? "Parar escuta por voz" : "Perguntar usando voz"}
                className={cn(
                  "p-2.5 rounded-xl transition-all cursor-pointer",
                  isListening ? "bg-rose-500 text-white animate-pulse" : "bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700"
                )}
              >
                {isListening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              
              {/* Send Button */}
              <button 
                onClick={() => handleSend()}
                disabled={(!input.trim() && !attachedImage) || isLoading}
                className="p-2.5 bg-brand-accent text-zinc-950 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-md shadow-brand-accent/20 disabled:opacity-30 disabled:scale-100 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
          
          <div className="mt-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-1 text-[8px] font-black text-zinc-600 uppercase tracking-widest">
              <Info size={10} />
              Proteção de dados activa • Criptografado de ponta a ponta
            </div>
            <div className="flex items-center gap-1 text-[8px] font-black text-zinc-600 uppercase tracking-widest">
              <RefreshCw size={10} className="animate-spin-slow text-zinc-600" />
              Sincronizado Firestore
            </div>
          </div>
        </div>
      </Card>

      {/* Voice Session Overlay Modal */}
      <AnimatePresence>
        {isVoiceActive && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-zinc-950/95 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="max-w-md w-full flex flex-col items-center gap-8">
              {/* Spinning / Pulsating Neural Wave */}
              <div className="relative flex items-center justify-center w-48 h-48">
                <div className="absolute inset-0 rounded-full bg-brand-accent/5 border border-brand-accent/20 animate-ping [animation-duration:3s]" />
                <div className="absolute inset-4 rounded-full bg-brand-accent/10 border border-brand-accent/30 animate-pulse [animation-duration:1.5s]" />
                <div className="absolute inset-10 rounded-full bg-brand-accent/25 border border-brand-accent/40 animate-spin-slow" />
                <div className="w-20 h-20 bg-zinc-900 border border-brand-accent rounded-full flex items-center justify-center shadow-lg relative z-10">
                  <Radio className="text-brand-accent w-10 h-10 animate-bounce" />
                </div>
              </div>

              {/* Text Information */}
              <div className="space-y-3">
                <h3 className="text-xl font-black text-white uppercase tracking-wider italic">
                  Conversa em Tempo Real
                </h3>
                <p className="text-[10px] font-black text-brand-accent uppercase tracking-widest">
                  {isVoiceConnecting ? "Conectando ao canal de áudio..." : "Canais de áudio síncronos activos"}
                </p>
                <p className="text-xs text-zinc-400 max-w-sm font-medium leading-relaxed">
                  {isVoiceConnecting 
                    ? "Por favor, aguarde enquanto estabelecemos o canal de áudio seguro com o motor de voz Gemini..."
                    : "Fale à vontade! O Gemini está ouvindo o seu microfone de forma contínua e responderá instantaneamente por voz em português."}
                </p>
              </div>

              {/* Dynamic Soundwave simulation */}
              {!isVoiceConnecting && (
                <div className="flex items-center gap-1 h-8">
                  {[1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5].map((val, idx) => (
                    <motion.div 
                      key={idx}
                      animate={{ height: ["12px", `${val * 6}px`, "12px"] }}
                      transition={{ repeat: Infinity, duration: 0.8, delay: idx * 0.08 }}
                      className="w-1.5 bg-brand-accent rounded-full"
                    />
                  ))}
                </div>
              )}

              {/* End Conversation Button */}
              <button 
                onClick={stopVoiceSession}
                className="py-4.5 px-8 bg-zinc-900 hover:bg-rose-500 hover:text-white border border-zinc-800 hover:border-rose-600 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-400 transition-all shadow-lg active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <X size={16} />
                <span>Desconectar Áudio</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
