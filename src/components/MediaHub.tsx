import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';

const ReactPlayer = lazy(() => import('react-player'));
import { motion, AnimatePresence } from 'motion/react';
import { 
  Play, 
  X, 
  Instagram, 
  Youtube, 
  Video, 
  Plus, 
  Trash2, 
  Link as LinkIcon,
  Smartphone,
  Facebook,
  Lock,
  Upload,
  Image as ImageIcon,
  CheckCircle2,
  AlertTriangle,
  Film,
  Maximize2,
  FolderOpen,
  Share2,
  Copy
} from 'lucide-react';
import { cn } from '../lib/utils';
import { ProgressiveImage } from './ProgressiveImage';
import { Card } from './Cards';
import { toast } from 'sonner';
import { optimizeImageBeforeUpload, compressImageByFormat } from './ImageOptimizer';

// ==========================================
// INDEXEDDB DATABASE ENGINE FOR LOCAL GALLERY
// ==========================================
interface LocalMediaItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  size: number;
  createdAt: string;
  file: Blob;
  thumbnail?: string; // base64 string of highly compressed image
}

interface RenderableLocalMedia {
  id: string;
  name: string;
  type: 'image' | 'video';
  size: number;
  createdAt: string;
  objectUrl: string; // generated on demand or during load (video)
  thumbnailUrl?: string; // base64 string of highly compressed image
  file?: Blob; // original file blob
}

const DB_NAME = 'EFMediaHubDB';
const DB_VERSION = 1;
const STORE_NAME = 'media';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const saveLocalMediaToDB = async (item: LocalMediaItem): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  },);
};

const getLocalMediaFromDB = async (): Promise<LocalMediaItem[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

const deleteLocalMediaFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

// ==========================================
// MEDIA HUB CORE COMPONENT
// ==========================================
interface MediaItem {
  id: string;
  url: string;
  type: 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'other';
  title?: string;
  caption?: string;
}

export interface FloatingPostedMedia {
  id: string;
  name: string;
  type: 'image' | 'video' | 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'other';
  urlOrObjectUrl: string;
  size?: number;
  isExternal: boolean;
}

export const MediaHub = () => {
  // Navigation Tabs: external social mídias vs. local gallery
  const [activeTab, setActiveTab] = useState<'social_links' | 'local_gallery'>('social_links');
  const [justPostedMedia, setJustPostedMedia] = useState<FloatingPostedMedia | null>(null);

  // External Social Links List state (persisted to localStorage)
  const [mediaList, setMediaList] = useState<MediaItem[]>(() => {
    try {
      const saved = localStorage.getItem('dm_media_links');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error parsing saved social streams:', e);
    }
    // Default system links for starter display
    return [
      {
        id: '1',
        url: 'https://www.youtube.com/watch?v=aqz-KE-BPKQ',
        type: 'youtube',
        title: 'DM TURISMO - APRESENTAÇÃO INSTITUCIONAL 2026',
      },
      {
        id: '2',
        url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE',
        type: 'youtube',
        title: 'TREINAMENTO DE SEGURANÇA E DIREÇÃO DEFENSIVA',
      }
    ];
  });

  const [isAddingSocial, setIsAddingSocial] = useState(false);
  const [newUrl, setNewUrl] = useState('');

  // Local Device Gallery states
  const [localMediaList, setLocalMediaList] = useState<RenderableLocalMedia[]>([]);
  const [galleryPermission, setGalleryPermission] = useState<'prompt' | 'granted' | 'denied'>(() => {
    const saved = localStorage.getItem('dm_gallery_permission');
    return (saved as 'prompt' | 'granted' | 'denied') || 'prompt';
  });
  const [dragActive, setDragActive] = useState(false);
  const [isAddingLocal, setIsAddingLocal] = useState(false);
  const [isLoadingLocal, setIsLoadingLocal] = useState(false);

  // Hidden File Inputs & Dialog triggers
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lightbox & Video Player Overlays states
  const [activeLightboxMedia, setActiveLightboxMedia] = useState<RenderableLocalMedia | null>(null);

  const closeLightbox = () => {
    if (activeLightboxMedia && activeLightboxMedia.thumbnailUrl && activeLightboxMedia.objectUrl) {
      URL.revokeObjectURL(activeLightboxMedia.objectUrl);
    }
    setActiveLightboxMedia(null);
  };

  // Sync social links with localStorage
  useEffect(() => {
    localStorage.setItem('dm_media_links', JSON.stringify(mediaList));
  }, [mediaList]);

  // Load and construct local media object URLs on mount or permission granted
  useEffect(() => {
    let activeUrls: string[] = [];

    const loadLocalGallery = async () => {
      if (galleryPermission !== 'granted') return;
      setIsLoadingLocal(true);
      try {
        const rawItems = await getLocalMediaFromDB();
        // Sort newest first
        rawItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        const renderables = rawItems.map(item => {
          // Only create objectURL immediately if it's a video, or an image without a pre-computed thumbnail
          let objectUrl = '';
          if (item.type === 'video' || !item.thumbnail) {
            objectUrl = URL.createObjectURL(item.file);
            activeUrls.push(objectUrl);
          }
          return {
            id: item.id,
            name: item.name,
            type: item.type,
            size: item.size,
            createdAt: item.createdAt,
            objectUrl,
            thumbnailUrl: item.thumbnail,
            file: item.file
          };
        });
        setLocalMediaList(renderables);
      } catch (err) {
        console.error('Error loading files from local IndexedDB:', err);
        toast.error('Erro ao acessar base de dados de arquivos locais.');
      } finally {
        setIsLoadingLocal(false);
      }
    };

    loadLocalGallery();

    // Revoke all active object URLs on cleanup to avoid massive browser memory leaks
    return () => {
      activeUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [galleryPermission]);

  // Detect Social Platform from URL helper
  const detectType = (url: string): MediaItem['type'] => {
    if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('facebook.com')) return 'facebook';
    return 'other';
  };

  // Add External Social Media link
  const handleAddSocialMedia = async () => {
    if (!newUrl.trim()) return;

    try {
      const rp = (await import('react-player')).default;
      if (!rp.canPlay(newUrl)) {
        toast.error('O link fornecido não é suportado ou está no formato incorreto.');
        return;
      }

      const type = detectType(newUrl);
      const newItem: MediaItem = {
        id: Math.random().toString(36).substring(2, 11),
        url: newUrl,
        type,
        title: `VÍDEO COMPARTILHADO (${type.toUpperCase()})`,
      };

      setMediaList([newItem, ...mediaList]);
      setNewUrl('');
      setIsAddingSocial(false);
      toast.success('Mídia de link externo adicionada com sucesso!');

      // Abre a janela flutuante com a mídia recém-postada e botão de compartilhar
      setJustPostedMedia({
        id: newItem.id,
        name: newItem.title || `VÍDEO COMPARTILHADO (${type.toUpperCase()})`,
        type: newItem.type,
        urlOrObjectUrl: newItem.url,
        isExternal: true
      });
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar o link do vídeo.');
    }
  };

  // Remove Social Media Link
  const handleRemoveSocialItem = (id: string) => {
    setMediaList(mediaList.filter(item => item.id !== id));
    toast.success('Link removido do Media Hub.');
  };

  // Handle requesting photo/video gallery permissions
  const handleRequestGalleryPermission = () => {
    // Elegant simulated verification trigger
    toast.promise(
      new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 1200);
      }),
      {
        loading: 'Solicitando permissão ao aparelho...',
        success: () => {
          localStorage.setItem('dm_gallery_permission', 'granted');
          setGalleryPermission('granted');
          // Automatically trigger the hidden file selector right after granting for high UI convenience!
          setTimeout(() => {
            fileInputRef.current?.click();
          }, 400);
          return 'Acesso à galeria autorizado com sucesso!';
        },
        error: 'Erro ao solicitar permissão de segurança.'
      }
    );
  };

  // Reject / Deny Gallery Permission helper
  const handleDenyGalleryPermission = () => {
    localStorage.setItem('dm_gallery_permission', 'prompt');
    setGalleryPermission('prompt');
    toast.info('Permissão para galeria redefinida.');
  };

  // Formatter for byte sizes
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Handle files chosen from the local device gallery
  const processFiles = async (files: FileList) => {
    if (files.length === 0) return;

    setIsLoadingLocal(true);
    let successfullySavedCount = 0;
    let lastRenderable: RenderableLocalMedia | null = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');

      if (!isImage && !isVideo) {
        toast.error(`Tipo do arquivo '${file.name}' não é suportado. Selecione apenas imagens ou vídeos.`);
        continue;
      }

      // Check max size (let's suggest 50MB warning, but handle up to what browser allows)
      if (file.size > 50 * 1024 * 1024) {
        toast.warning(`O arquivo '${file.name}' possui mais de 50MB. Pode ocorrer atraso ao carregar do banco offline.`);
      }

      try {
        const fileId = 'local_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now();
        
        let thumbnail = '';
        if (isImage) {
          try {
            thumbnail = await compressImageByFormat(file, { maxWidth: 350, quality: 0.7, targetFormat: 'auto' });
          } catch (compErr) {
            console.warn('[MediaHub] Failed to pre-generate thumbnail:', compErr);
          }
        }

        const localItem: LocalMediaItem = {
          id: fileId,
          name: file.name,
          type: isImage ? 'image' : 'video',
          size: file.size,
          createdAt: new Date().toISOString(),
          file: file, // Store Blob directly!
          thumbnail: thumbnail || undefined
        };

        // Save to IndexedDB
        await saveLocalMediaToDB(localItem);

        // Generate immediate objectURL only if video or if thumbnail failed
        const objectUrl = (isVideo || !thumbnail) ? URL.createObjectURL(file) : '';
        const renderable: RenderableLocalMedia = {
          id: localItem.id,
          name: localItem.name,
          type: localItem.type,
          size: localItem.size,
          createdAt: localItem.createdAt,
          objectUrl,
          thumbnailUrl: thumbnail || undefined,
          file: file
        };

        // Prepends to current list view síncronamente
        setLocalMediaList(prev => [renderable, ...prev]);
        successfullySavedCount++;
        lastRenderable = renderable;
      } catch (err) {
        console.error('Error saving local file to IndexedDB:', err);
        toast.error(`Falha ao processar arquivo '${file.name}' do aparelho.`);
      }
    }

    setIsLoadingLocal(false);
    if (successfullySavedCount > 0) {
      toast.success(`${successfullySavedCount} arquivo(s) adicionado(s) da galeria com sucesso!`);
      
      // Abre a janela flutuante com a mídia recém-postada e botão de compartilhar
      if (lastRenderable) {
        setJustPostedMedia({
          id: (lastRenderable as RenderableLocalMedia).id,
          name: (lastRenderable as RenderableLocalMedia).name,
          type: (lastRenderable as RenderableLocalMedia).type,
          urlOrObjectUrl: (lastRenderable as RenderableLocalMedia).thumbnailUrl || (lastRenderable as RenderableLocalMedia).objectUrl,
          size: (lastRenderable as RenderableLocalMedia).size,
          isExternal: false
        });
      }
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  // Delete dynamic device image or video
  const handleRemoveLocalItem = async (item: RenderableLocalMedia) => {
    try {
      await deleteLocalMediaFromDB(item.id);
      URL.revokeObjectURL(item.objectUrl);
      setLocalMediaList(localMediaList.filter(m => m.id !== item.id));
      toast.success('Mídia física excluída da galeria do aparelho!');
    } catch (err) {
      console.error('Failed to remove local item from DB:', err);
      toast.error('Erro ao deletar arquivo.');
    }
  };

  // Compartilhamento de Mídia Recém-Postada
  const handleShareJustPosted = async (media: FloatingPostedMedia) => {
    const textToShare = `Confira esta mídia no DM Turismo Media Hub: "${media.name}"`;
    const shareUrl = media.isExternal ? media.urlOrObjectUrl : window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'DM Turismo - Media Hub',
          text: textToShare,
          url: shareUrl,
        });
        toast.success('Módulo de compartilhamento do aparelho ativado!');
      } catch (err) {
        console.log('Share canceled or failed', err);
      }
    } else {
      // Fallback: clipboard representation
      try {
        await navigator.clipboard.writeText(media.urlOrObjectUrl);
        toast.success('Link de mídia selecionado e copiado!');
      } catch (err) {
        toast.error('Erro de permissão ao copiar link.');
      }
    }
  };

  const handleShareWhatsApp = (media: FloatingPostedMedia) => {
    const baseText = `Confira a nova mídia "${media.name}" no Media Hub da DM Turismo!`;
    const shareUrl = media.isExternal ? media.urlOrObjectUrl : window.location.origin;
    const text = encodeURIComponent(`${baseText} Link: ${shareUrl}`);
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
    toast.success('Abrindo chat do WhatsApp...');
  };

  return (
    <div className="space-y-8">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">DM Media Hub</h2>
          <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-1">
            Painel corporativo multimídia integrado ao aparelho do colaborador
          </p>
        </div>

        {/* SELETOR DE ATUAÇÃO (Abas de Rede Social vs Galeria do Aparelho) */}
        <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-2xl">
          <button
            onClick={() => setActiveTab('social_links')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'social_links' 
                ? "bg-zinc-800 text-brand-accent shadow-md border border-zinc-700/30" 
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Video size={13} />
            Links das Redes
          </button>
          
          <button
            onClick={() => setActiveTab('local_gallery')}
            className={cn(
              "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2",
              activeTab === 'local_gallery' 
                ? "bg-zinc-800 text-brand-accent shadow-md border border-zinc-700/30" 
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <FolderOpen size={13} />
            Galeria do Aparelho
          </button>
        </div>
      </div>

      {/* ==========================================
          ABA 1: REDES SOCIAIS E EMBEDS EXTERNOS
          ========================================== */}
      {activeTab === 'social_links' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <div className="flex justify-between items-center bg-zinc-900/40 p-4 border border-zinc-850 rounded-2xl">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest pl-2">
              Streaming de Redes Sociais Ativas ({mediaList.length})
            </span>
            <button 
              onClick={() => setIsAddingSocial(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-brand-accent text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest hover:scale-102 transition-all shadow-lg shadow-brand-accent/20 cursor-pointer"
            >
              <Plus size={14} /> Adicionar Link
            </button>
          </div>

          <AnimatePresence>
            {isAddingSocial && (
              <motion.div 
                initial={{ opacity: 0, y: -15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="p-8 bg-zinc-900 border border-zinc-800 rounded-[2rem] shadow-2xl space-y-6"
              >
                <div className="space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-white uppercase">Incorporar Video de Rede Social</h4>
                    <p className="text-[9px] text-zinc-500 font-bold uppercase mt-1">
                      Compatível com YouTube, Instagram, Face, Vimeo e TikTok.
                    </p>
                  </div>
                  <div className="relative">
                    <input 
                      type="text"
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="Cole a URL do vídeo (ex: https://www.youtube.com/watch?v=...)"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-4 text-xs font-bold text-white focus:border-brand-accent transition-all pl-12"
                    />
                    <LinkIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-700" />
                  </div>
                </div>
                <div className="flex gap-4">
                  <button 
                    onClick={handleAddSocialMedia}
                    className="flex-1 py-4 bg-white hover:bg-brand-accent text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Confirmar e Integrar
                  </button>
                  <button 
                    onClick={() => setIsAddingSocial(false)}
                    className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    Mudar de Ideia
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* GRID DE MÍDIAS DE REDE */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mediaList.map((item) => (
              <motion.div 
                key={item.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative bg-zinc-950 border border-zinc-850 rounded-[2rem] overflow-hidden hover:border-brand-accent/40 transition-all shadow-xl flex flex-col justify-between"
              >
                <div className="aspect-video bg-zinc-900 relative">
                  <Suspense fallback={
                    <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-2">
                      <div className="w-8 h-8 border-2 border-zinc-850 border-t-brand-accent rounded-full animate-spin" />
                      <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Carregando Player...</span>
                    </div>
                  }>
                    <ReactPlayer 
                      url={item.url}
                      width="100%"
                      height="100%"
                      className="absolute inset-0 w-full h-full"
                      light={true} 
                      playIcon={
                        <div className="w-14 h-14 bg-brand-accent rounded-full flex items-center justify-center text-zinc-900 shadow-2xl scale-100 group-hover:scale-105 transition-transform">
                          <Play size={24} fill="currentColor" className="ml-1" />
                        </div>
                      }
                      onError={(e) => console.error('ReactPlayer error on render URL:', e)}
                      {...({} as any)}
                    />
                  </Suspense>
                  
                  {/* Badge de Plataforma */}
                  <div className="absolute top-4 left-4 p-2 bg-black/60 backdrop-blur-md rounded-xl border border-white/10">
                    {item.type === 'youtube' && <Youtube size={16} className="text-rose-500" />}
                    {item.type === 'instagram' && <Instagram size={16} className="text-pink-500" />}
                    {item.type === 'tiktok' && <Smartphone size={16} className="text-emerald-400" />}
                    {item.type === 'facebook' && <Facebook size={16} className="text-blue-500" />}
                    {item.type === 'other' && <Video size={16} className="text-brand-accent" />}
                  </div>

                  {/* Deletar Link */}
                  <button 
                    onClick={() => handleRemoveSocialItem(item.id)}
                    className="absolute top-4 right-4 p-2 bg-rose-500/10 text-rose-500 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-500 hover:text-white border border-rose-500/20 cursor-pointer"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                
                <div className="p-6 space-y-2">
                  <h4 className="text-[10px] font-black text-brand-accent uppercase tracking-widest">
                    {item.title}
                  </h4>
                  <p className="text-[11px] font-semibold text-zinc-500 truncate">
                    {item.url}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {mediaList.length === 0 && !isAddingSocial && (
            <div className="p-20 bg-zinc-950/40 border-2 border-dashed border-zinc-900 rounded-[2.57rem] flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center text-zinc-700">
                <Video size={30} />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-black text-zinc-500 uppercase">Nenhum feed ativo</h3>
                <p className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                  Toque em "Adicionar Link" para incorporar vídeos corporativos das redes
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          ABA 2: GALERIA LOCAL DO APARELHO
          ========================================== */}
      {activeTab === 'local_gallery' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          
          {/* CASO 1: AINDA NÃO SOLICITOU PERMISSÃO / MOSTRAR TELA DE PEDIDO DE AUTORIZAÇÃO */}
          {galleryPermission !== 'granted' && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-10 bg-zinc-900 border border-zinc-800 rounded-[2.5rem] text-center max-w-3xl mx-auto space-y-8 shadow-2xl"
            >
              <div className="flex justify-center">
                <div className="relative w-24 h-24 bg-zinc-950 border border-zinc-800 rounded-full flex items-center justify-center text-zinc-700">
                  <Smartphone size={40} className="text-zinc-500" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 bg-zinc-800 border border-zinc-700 rounded-full flex items-center justify-center text-rose-500 animate-pulse">
                    <Lock size={15} />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-black text-white uppercase tracking-tight">
                  Autorização de Acesso à Galeria
                </h3>
                <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                  Para importar fotos de veículos da frota, boletins de faturamento, mídias de viagens e vídeos gravados em serviço directly do armazenamento do seu smartphone ou notebook, o aplicativo da <b className="text-brand-accent">DM Turismo</b> requer permissão de acesso ao repositório local.
                </p>
                <div className="p-4 bg-zinc-950/60 rounded-2xl border border-zinc-800 text-[10px] text-zinc-500 font-bold uppercase tracking-wider text-left space-y-1">
                  <span className="block text-zinc-400">🛡️ POLÍTICA DE SEGURANÇA E PRIVACIDADE DE DADOS:</span>
                  <span className="block">1. Suas fotos e vídeos não são sincronizados para servidores remotos sem supervisão.</span>
                  <span className="block">2. O armazenamento físico dos binários ocorre de forma isolada em um banco sandbox criptografado do próprio navegador.</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <button
                  onClick={handleRequestGalleryPermission}
                  className="px-8 py-4 bg-brand-accent text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-white hover:scale-102 transition-all shadow-xl shadow-brand-accent/15 cursor-pointer"
                >
                  🔓 AUTORIZAR ACESSO À GALERIA
                </button>
                {galleryPermission === 'denied' && (
                  <button
                    onClick={handleDenyGalleryPermission}
                    className="px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
                  >
                    REDEFINIR PERMISSÃO
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {/* CASO 2: PERMISSÃO CONCEDIDA / EXIBIR DASHBOARD DA GALERIA */}
          {galleryPermission === 'granted' && (
            <div className="space-y-8">
              
              {/* ÁREA DE DUPLO CARREGAMENTO (DRAG & DROP + INPUT TRADICIONAL) */}
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "p-12 border-2 border-dashed rounded-[3rem] text-center flex flex-col items-center justify-center space-y-4 cursor-pointer transition-all hover:scale-[1.01]",
                  dragActive 
                    ? "border-brand-accent bg-brand-accent/5" 
                    : "border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/50 hover:border-zinc-700"
                )}
              >
                <input 
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInputChange}
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                />

                <div className="w-16 h-16 bg-zinc-950 border border-zinc-850 rounded-2xl flex items-center justify-center text-zinc-500 shadow-xl">
                  {dragActive ? (
                    <Upload size={30} className="text-brand-accent animate-bounce" />
                  ) : (
                    <FolderOpen size={30} className="text-brand-accent" />
                  )}
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider">
                    {dragActive ? "Solte para iniciar o upload!" : "Carregar fotos e vídeos da galeria corporativa"}
                  </h4>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                    Arraste os arquivos aqui ou toque para procurar no seu smartphone / tablet.
                  </p>
                </div>

                <button 
                  type="button"
                  className="px-5 py-2.5 bg-zinc-950 text-brand-accent rounded-xl text-[9px] font-black uppercase tracking-widest pointer-events-none border border-zinc-800 shadow-xl"
                >
                  SELECIONAR ARQUIVOS DA GALERIA
                </button>
              </div>

              {/* BARRA DE LISTAGEM DE STATUS LOCAL */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-850 pb-4">
                <div>
                  <h4 className="text-xs font-black text-white uppercase tracking-widest">
                    Fotos e Vídeos Ativos no Aparelho ({localMediaList.length})
                  </h4>
                  <p className="text-[9px] text-zinc-500 font-bold uppercase mt-0.5">
                    Banco de mídia persistido offline no navegador do dispositivo
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      localStorage.setItem('dm_gallery_permission', 'prompt');
                      setGalleryPermission('prompt');
                      toast.success('Permissão revogada para testes de fluxo!');
                    }}
                    className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-[8px] font-black text-zinc-500 hover:text-white uppercase tracking-wider transition-all cursor-pointer border border-zinc-800"
                    title="Simular revogação para testar o modal de regras"
                  >
                    🔒 Simular Bloqueio
                  </button>
                </div>
              </div>

              {/* GRID DOS ITENS DA GALERIA LOCAL */}
              {isLoadingLocal ? (
                <div className="py-20 text-center space-y-4">
                  <div className="w-10 h-10 border-2 border-brand-accent border-t-transparent rounded-full animate-spin mx-auto"></div>
                  <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                    Leitura física na base de dados criptografada...
                  </p>
                </div>
              ) : localMediaList.length === 0 ? (
                <div className="p-16 bg-zinc-950/20 border-2 border-dashed border-zinc-900 rounded-[2rem] flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 bg-zinc-900 rounded-xl flex items-center justify-center text-zinc-700">
                    <ImageIcon size={28} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-xs font-black text-zinc-500 uppercase">Armazenamento local vazio</h3>
                    <p className="text-[9px] font-bold text-zinc-700 uppercase tracking-widest leading-relaxed">
                      Nenhuma foto de frota, planilha de viagens ou gravação foi encontrada.<br />
                      Importe mídias acima para começar.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {localMediaList.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group relative bg-zinc-950 border border-zinc-850 rounded-[2rem] overflow-hidden hover:border-brand-accent/50 transition-all shadow-lg flex flex-col"
                    >
                      {/* ÁREA DE EXIBIÇÃO DE MÍDIA COMPLETAMENTE PERSISTIDA */}
                      <div className="aspect-square bg-zinc-900 relative overflow-hidden flex items-center justify-center">
                        {item.type === 'image' ? (
                          <ProgressiveImage
                            src={item.thumbnailUrl || item.objectUrl}
                            alt={item.name}
                            className="w-full h-full"
                            imgClassName="group-hover:scale-105 transition-transform duration-500"
                          />
                        ) : (
                          <div className="w-full h-full relative flex items-center justify-center bg-zinc-950">
                            {/* Simple video poster view with audio icon */}
                            <video 
                              src={item.objectUrl} 
                              className="w-full h-full object-cover brightness-75"
                              preload="metadata"
                            />
                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center transition-colors group-hover:bg-black/20">
                              <div className="w-12 h-12 bg-brand-accent rounded-full flex items-center justify-center text-zinc-950 shadow-xl group-hover:scale-110 transition-transform">
                                <Play size={20} fill="currentColor" className="ml-0.5" />
                              </div>
                            </div>
                          </div>
                        )}

                        {/* BADGE OPERACIONAL */}
                        <div className="absolute top-3 left-3 px-2 py-0.5 bg-black/70 backdrop-blur-md border border-white/10 rounded-lg flex items-center gap-1">
                          {item.type === 'image' ? (
                            <>
                              <ImageIcon size={10} className="text-emerald-500" />
                              <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">FOTO</span>
                            </>
                          ) : (
                            <>
                              <Film size={10} className="text-brand-accent" />
                              <span className="text-[8px] font-black text-brand-accent uppercase tracking-widest">VÍDEO</span>
                            </>
                          )}
                        </div>

                        {/* HOVER ACTIONS OVERLAY */}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between p-4">
                          <div className="flex justify-end gap-2">
                            {/* Delete Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveLocalItem(item);
                              }}
                              className="p-2 bg-rose-500 text-white rounded-lg hover:bg-rose-600 hover:scale-105 transition-all shadow-md cursor-pointer"
                              title="Deletar permanentemente"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>

                          {/* Zoom Viewer Trigger */}
                          <button
                            onClick={() => {
                              let targetMedia = { ...item };
                              if (!targetMedia.objectUrl && targetMedia.file) {
                                targetMedia.objectUrl = URL.createObjectURL(targetMedia.file);
                              }
                              setActiveLightboxMedia(targetMedia);
                            }}
                            className="w-full py-2 bg-brand-accent text-zinc-950 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white transition-all transform translate-y-2 group-hover:translate-y-0 duration-300 shadow-lg cursor-pointer flex items-center justify-center gap-1"
                          >
                            <Maximize2 size={10} /> Ampliar Mídia
                          </button>
                        </div>
                      </div>

                      {/* RODAPÉ DO PRODUTO METADADOS */}
                      <div className="p-4 space-y-1">
                        <h5 className="text-[10px] font-black text-white uppercase tracking-tight truncate" title={item.name}>
                          {item.name}
                        </h5>
                        <div className="flex justify-between items-center text-[8px] text-zinc-500 font-bold uppercase tracking-widest">
                          <span>{formatBytes(item.size)}</span>
                          <span>{new Date(item.createdAt).toLocaleDateString('pt-BR')}</span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ==========================================
          MODAL LIGHTBOX CINEMÁTICO UNIVERSAL
          ========================================== */}
      <AnimatePresence>
        {activeLightboxMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/95 backdrop-blur-sm shadow-2xl"
          >
            <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2.5rem] w-full max-w-4xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">
                    Visualizador de Galeria DM
                  </h4>
                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-0.5">
                    Nome: {activeLightboxMedia.name} | Tamanho: {formatBytes(activeLightboxMedia.size)}
                  </p>
                </div>
                <button
                  onClick={closeLightbox}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 hover:scale-105 rounded-xl transition-all text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Dynamic Player Stage */}
              <div className="flex-1 bg-zinc-950 p-4 flex items-center justify-center min-h-[40vh] max-h-[65vh] overflow-hidden">
                {activeLightboxMedia.type === 'image' ? (
                  <ProgressiveImage
                    src={activeLightboxMedia.objectUrl}
                    placeholderSrc={activeLightboxMedia.thumbnailUrl}
                    alt={activeLightboxMedia.name}
                    className="max-w-full max-h-[60vh] rounded-2xl shadow-2xl"
                    imgClassName="object-contain"
                  />
                ) : (
                  <video
                    src={activeLightboxMedia.objectUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-[60vh] rounded-2xl shadow-2xl"
                  />
                )}
              </div>

              {/* Rodapé formatativo */}
              <div className="p-6 border-t border-zinc-800 bg-zinc-900/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">
                  Data de Captação: {new Date(activeLightboxMedia.createdAt).toLocaleString('pt-BR')}
                </div>
                <div className="flex gap-3 w-full sm:w-auto">
                  <a
                    href={activeLightboxMedia.objectUrl}
                    download={activeLightboxMedia.name}
                    className="flex-1 sm:flex-initial text-center px-4 py-2.5 bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-black text-brand-accent rounded-xl transition-all cursor-pointer"
                  >
                    BAIXAR NO APARELHO
                  </a>
                  <button
                    onClick={() => {
                       // Try native clipboard copy
                       if (navigator.clipboard) {
                         navigator.clipboard.writeText(activeLightboxMedia.objectUrl);
                         toast.success('Link temporário copiado para área de transferência!');
                       } else {
                         toast.error('Erro de permissão no navegador.');
                       }
                    }}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-brand-accent text-zinc-950 hover:bg-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer"
                  >
                    COPIAR LINK LOC
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ==========================================
            JANELA FLUTUANTE DE NOVA MÍDIA PUBLICADA + COMPARTILHAMENTO (SHADOW MODE SPEC)
            ========================================== */}
        {justPostedMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/90 backdrop-blur-md shadow-2xl"
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              className="relative bg-zinc-900 border-2 border-brand-accent/50 rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header de Sucesso */}
              <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-gradient-to-r from-zinc-900 via-brand-accent/5 to-zinc-900">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-brand-accent/10 border border-brand-accent/30 flex items-center justify-center text-brand-accent">
                    <CheckCircle2 size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-brand-accent uppercase tracking-widest block">
                      ✨ SUCESSO COLETIVO
                    </span>
                    <h4 className="text-sm font-black text-white uppercase tracking-tight">
                      Mídia Publicada com Sucesso!
                    </h4>
                  </div>
                </div>
                <button
                  onClick={() => setJustPostedMedia(null)}
                  className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Resumo da mídia publicada */}
              <div className="p-6 bg-zinc-950/60 border-b border-zinc-850/50 flex items-center justify-between text-xs text-zinc-400 font-medium">
                <div className="truncate pr-4">
                  <span className="text-[10px] font-black text-zinc-600 block uppercase tracking-widest">
                    ALVO ADICIONADO
                  </span>
                  <span className="text-white font-black truncate block uppercase">{justPostedMedia.name}</span>
                </div>
                <div className="shrink-0 text-right text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
                  <span>{justPostedMedia.isExternal ? 'LINK SOCIAL' : 'LOCAL DEVICE'}</span>
                  <span className="block text-[8px] text-zinc-600 mt-0.5">
                    {justPostedMedia.size ? formatBytes(justPostedMedia.size) : 'ESTÁVEL'}
                  </span>
                </div>
              </div>

              {/* Media Preview Stage inside floating window */}
              <div className="flex-1 bg-zinc-950 h-64 p-4 flex items-center justify-center overflow-hidden border-b border-zinc-850">
                {justPostedMedia.isExternal ? (
                  <div className="w-full h-full rounded-2xl overflow-hidden relative border border-zinc-850/30">
                    <Suspense fallback={
                      <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-2">
                        <div className="w-8 h-8 border-2 border-zinc-850 border-t-brand-accent rounded-full animate-spin" />
                        <span className="text-[9px] font-black tracking-widest text-zinc-500 uppercase">Preparando Vídeo...</span>
                      </div>
                    }>
                      <ReactPlayer
                        url={justPostedMedia.urlOrObjectUrl}
                        width="100%"
                        height="100%"
                        className="absolute inset-0 w-full h-full"
                        controls={true}
                        {...({} as any)}
                      />
                    </Suspense>
                  </div>
                ) : justPostedMedia.type === 'image' ? (
                  <img
                    src={justPostedMedia.urlOrObjectUrl}
                    alt={justPostedMedia.name}
                    loading="lazy"
                    className="max-h-56 max-w-full object-contain rounded-xl shadow-xl"
                  />
                ) : (
                  <video
                    src={justPostedMedia.urlOrObjectUrl}
                    controls
                    autoPlay
                    className="max-h-56 max-w-full rounded-xl shadow-xl"
                  />
                )}
              </div>

              {/* Compartilhar Seção dedicada */}
              <div className="p-8 space-y-6 bg-zinc-900/50">
                <div className="text-center space-y-1">
                  <h5 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">
                    Como deseja compartilhar este boletim / mídia?
                  </h5>
                  <p className="text-[9px] font-bold text-zinc-600 uppercase tracking-wider">
                    Transmita status operacional e faturamento com as equipes de tráfego
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Share button native overlay */}
                  <button
                    onClick={() => handleShareJustPosted(justPostedMedia)}
                    className="px-4 py-3.5 bg-brand-accent text-zinc-950 hover:bg-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-brand-accent/10"
                  >
                    <Share2 size={14} /> Compartilhar App
                  </button>

                  {/* Share button WhatsApp */}
                  <button
                    onClick={() => handleShareWhatsApp(justPostedMedia)}
                    className="px-4 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Play size={10} fill="currentColor" className="rotate-90" /> WhatsApp
                  </button>

                  {/* Share button Copy link */}
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(justPostedMedia.urlOrObjectUrl);
                        toast.success('Link copiado para área de transferência!');
                      } else {
                        toast.error('Erro de permissão no navegador.');
                      }
                    }}
                    className="px-4 py-3.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Copy size={13} /> Copiar Link
                  </button>
                </div>

                <div className="pt-2 border-t border-zinc-850 flex justify-end">
                  <button
                    onClick={() => setJustPostedMedia(null)}
                    className="px-6 py-3 bg-zinc-950 hover:bg-zinc-850 text-zinc-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all cursor-pointer border border-zinc-800"
                  >
                    CONCLUIR E FECHAR
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

