import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Play, Trash2, Plus, Youtube, Image as ImageIcon, Video, Link as LinkIcon, Sparkles, Upload, X, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { optimizeImageBeforeUpload } from './ImageOptimizer';
import ReactPlayer from 'react-player';

// This is a component for the Featured Media section supporting both photos and videos.
interface FeaturedMedia {
  id: string;
  url: string;
  title: string;
  thumbnail?: string;
  type?: 'image' | 'video';
}

export const FeaturedVideosSection = ({ 
  videos, 
  onDelete, 
  onAdd, 
  isAdmin,
  onPlay 
}: { 
  videos: FeaturedMedia[]; 
  onDelete: (id: string) => void; 
  onAdd: (media: {url: string, title: string, type: 'image' | 'video'}) => void;
  isAdmin: boolean;
  onPlay: (media: {url: string, title: string, type?: 'image' | 'video'}) => void;
}) => {
  const [newMedia, setNewMedia] = useState({ url: '', title: '', type: 'video' as 'image' | 'video' });
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);
  const [playerReadyId, setPlayerReadyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const detectedType = file.type.startsWith('image') ? 'image' : 'video';

    if (detectedType === 'image') {
      setUploading(true);
      optimizeImageBeforeUpload(file, 800, 0.75)
        .then((compressed) => {
          setNewMedia(prev => ({
            ...prev,
            url: compressed,
            type: 'image'
          }));
          setUploading(false);
        })
        .catch((err) => {
          console.error('Failed to optimize featured image:', err);
          // Fallback
          const reader = new FileReader();
          reader.onloadend = () => {
            setNewMedia(prev => ({
              ...prev,
              url: reader.result as string,
              type: 'image'
            }));
            setUploading(false);
          };
          reader.onerror = () => {
            alert("Erro ao ler o arquivo selecionado.");
            setUploading(false);
          };
          reader.readAsDataURL(file);
        });
    } else {
      // It is a video
      // Firestore has a physical limit of 1,048,576 bytes per document
      if (file.size > 750 * 1024) {
        alert("O arquivo de vídeo selecionado é muito grande para postagem direta (" + (file.size / (1024 * 1024)).toFixed(2) + "MB).\n\nPara garantir estabilidade, carregar instantaneamente nos celulares e respeitar os limites do servidor Firestore (1MB por postagem), por favor informe um 'Link da Web' (do YouTube, Instagram, TikTok, Reels, Google Drive ou similar) ou envie um vídeo cortado/reduzido extremamente curto de até 750KB.");
        return;
      }

      setUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewMedia(prev => ({
          ...prev,
          url: reader.result as string,
          type: 'video'
        }));
        setUploading(false);
      };
      reader.onerror = () => {
        alert("Erro ao ler o arquivo selecionado.");
        setUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  // Auto detect type on URL change to provide smooth operator experience
  const handleUrlChange = (url: string) => {
    let type = newMedia.type;
    const isImg = url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || 
                  url.includes('images.unsplash.com') ||
                  url.includes('imgur.com') ||
                  url.startsWith('data:image/');
    if (isImg) {
      type = 'image';
    } else {
      type = 'video';
    }
    setNewMedia(prev => ({ ...prev, url, type }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
         <div className="flex items-center gap-3">
           <div className="p-2 bg-brand-accent/10 border border-brand-accent/20 rounded-xl text-brand-accent">
             <Sparkles size={16} className="animate-pulse" />
           </div>
           <div>
             <h3 className="text-xl font-black text-white uppercase tracking-wider font-display">Mídias em Destaque</h3>
             <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest mt-0.5">Vídeos e fotos oficiais da DM Turismo para a equipe</p>
           </div>
         </div>
         {isAdmin && (
           <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.2em] bg-zinc-900 border border-white/5 px-3 py-1 rounded-full">
             {videos.length}/4 ATIVOS
           </span>
         )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {videos.map((item) => {
          // Detect type safely
          const isImage = item.type === 'image' || 
                          item.url.match(/\.(jpeg|jpg|gif|png|webp|svg)($|\?)/i) || 
                          item.url.includes('images.unsplash.com') ||
                          item.url.includes('imgur.com') ||
                          item.url.startsWith('data:image/');

          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900/40 border border-white/5 rounded-[2.5rem] overflow-hidden group hover:border-brand-accent/30 transition-all backdrop-blur-sm relative shadow-2xl flex flex-col justify-between"
            >
              <div 
                className="aspect-video relative group/item cursor-pointer overflow-hidden bg-zinc-950 flex items-center justify-center font-sans" 
                onClick={() => {
                  if (isImage) {
                    onPlay({ url: item.url, title: item.title, type: 'image' });
                  } else if (playingVideoId !== item.id) {
                    setPlayingVideoId(item.id);
                  }
                }}
              >
                {isImage ? (
                  <>
                    <img 
                      src={item.url} 
                      alt={item.title} 
                      className="w-full h-full object-cover group-hover/item:scale-110 transition-transform duration-750 ease-out cursor-pointer" 
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/30 group-hover/item:bg-black/10 transition-colors pointer-events-none" />
                    <div className="absolute top-3 left-3 p-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-white pointer-events-none">
                      <ImageIcon size={14} />
                    </div>
                  </>
                ) : playingVideoId === item.id ? (
                  <div className="absolute inset-0 w-full h-full z-20 bg-zinc-950">
                    <ReactPlayer 
                      url={item.url}
                      width="100%"
                      height="100%"
                      className="absolute inset-0 w-full h-full [&_video]:object-contain [&_iframe]:object-contain [&_img]:object-contain"
                      playing={playerReadyId === item.id}
                      onReady={() => setPlayerReadyId(item.id)}
                      controls={true} {...({} as any)}
                    />
                    {playerReadyId !== item.id && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950/80 gap-2 z-10">
                        <Loader2 className="w-8 h-8 text-brand-accent animate-spin" />
                        <p className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">Iniciando...</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPlayerReadyId(null);
                        setPlayingVideoId(null);
                      }}
                      className="absolute top-3 right-3 p-1.5 bg-zinc-900/90 hover:bg-white text-zinc-400 hover:text-zinc-950 rounded-xl border border-white/10 hover:scale-105 transition-all z-30 cursor-pointer flex items-center justify-center shadow-lg"
                      title="Fechar Reprodutor"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full cursor-pointer relative">
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-30 group-hover/item:opacity-40 transition-opacity pointer-events-none">
                      <Youtube size={64} className="text-zinc-650" />
                    </div>
                    <div className="absolute inset-0 bg-black/45 group-hover/item:bg-black/20 transition-colors pointer-events-none" />
                    <div className="absolute inset-0 flex items-center justify-center z-12 pointer-events-none">
                      <div className="w-12 h-12 bg-brand-accent rounded-full flex items-center justify-center text-zinc-950 shadow-2xl group-hover/item:scale-110 transition-all duration-300">
                        <Play size={20} fill="currentColor" className="ml-0.5" />
                      </div>
                    </div>
                    <div className="absolute top-3 left-3 p-1.5 bg-black/60 backdrop-blur-md rounded-xl border border-white/10 text-brand-accent z-12 pointer-events-none">
                      <Video size={14} />
                    </div>
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <p className="text-[11px] font-black text-white uppercase tracking-wider line-clamp-2 leading-snug">{item.title}</p>
                {isAdmin && (
                  <div className="flex justify-end pt-3 mt-3 border-t border-white/5">
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDelete(item.id); }} 
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-rose-500/20"
                    >
                      <Trash2 size={12} />
                      Excluir
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {isAdmin && videos.length < 4 && (
          <div className="bg-zinc-900/10 border-2 border-dashed border-zinc-800 rounded-[2.5rem] p-6 flex flex-col justify-between gap-4 min-h-[180px] shadow-inner">
            <div className="space-y-3">
              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Novo Destaque Visual</span>
              
              {/* Selector segment */}
              <div className="flex bg-zinc-950 p-1 rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setNewMedia(prev => ({ ...prev, type: 'video' }))}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    newMedia.type === 'video' ? "bg-brand-accent text-zinc-950 animate-pulse" : "text-zinc-500 hover:text-white"
                  )}
                >
                  <Video size={10} />
                  Vídeo
                </button>
                <button
                  type="button"
                  onClick={() => setNewMedia(prev => ({ ...prev, type: 'image' }))}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                    newMedia.type === 'image' ? "bg-brand-accent text-zinc-950" : "text-zinc-500 hover:text-white"
                  )}
                >
                  <ImageIcon size={10} />
                  Foto / Imagem
                </button>
              </div>

              {/* Media File Picker directly opening user files/gallery */}
              <div className="space-y-2">
                <input 
                  type="file"
                  ref={fileInputRef}
                  accept={newMedia.type === 'image' ? 'image/*' : 'video/*'}
                  className="hidden"
                  onChange={handleFileUpload}
                />
                
                {newMedia.url ? (
                  <div className="relative h-64 w-full rounded-2xl overflow-hidden bg-zinc-950 border border-brand-accent/20 flex items-center justify-center group/preview select-none">
                    {newMedia.type === 'image' ? (
                      <img 
                        src={newMedia.url} 
                        className="w-full h-full object-contain animate-fade-in" 
                        alt="Preview" 
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="relative w-full h-full bg-zinc-950">
                        {newMedia.url.startsWith('data:') ? (
                          <video 
                            src={newMedia.url} 
                            controls 
                            className="w-full h-full object-contain" 
                          />
                        ) : (
                          <ReactPlayer 
                            url={newMedia.url} 
                            width="100%" 
                            height="100%" 
                            className="absolute inset-0 w-full h-full [&_video]:object-contain [&_iframe]:object-contain [&_img]:object-contain" 
                            controls 
                            {...({} as any)}
                          />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setNewMedia(prev => ({ ...prev, url: '' }))}
                      className="absolute top-2 right-2 p-1.5 bg-black/80 hover:bg-rose-500 rounded-lg text-white transition-colors cursor-pointer z-30"
                    >
                      <X size={12} />
                    </button>
                    {newMedia.url.startsWith('data:') && (
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center z-25">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="px-3 py-1.5 bg-black/80 hover:bg-brand-accent text-white hover:text-zinc-950 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer"
                        >
                          Substituir
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full flex flex-col items-center justify-center py-4 bg-zinc-950 hover:bg-zinc-900 border border-zinc-800 hover:border-brand-accent/20 rounded-2xl text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-white transition-all cursor-pointer select-none"
                  >
                    {uploading ? (
                      <Loader2 size={16} className="animate-spin text-brand-accent mb-1" />
                    ) : (
                      <Upload size={16} className="text-zinc-500 mb-1 shrink-0" />
                    )}
                    {uploading ? "Carregando mídia..." : `Abrir Galeria (${newMedia.type === 'image' ? 'Foto' : 'Vídeo'})`}
                  </button>
                )}
              </div>

              {/* URL input fallback if not base64 file */}
              {!newMedia.url.startsWith('data:') && (
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-zinc-650 uppercase tracking-widest block text-center">Ou informe um link da web</span>
                  <input 
                    placeholder={newMedia.type === 'video' ? "URL do Vídeo (YouTube, Instagram, etc.)" : "URL da Foto / Imagem Externa"}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white font-bold placeholder-zinc-600 focus:border-brand-accent transition-all"
                    value={newMedia.url}
                    onChange={e => handleUrlChange(e.target.value)}
                  />
                </div>
              )}
              <input 
                placeholder="Título ou legenda do destaque..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-white font-bold placeholder-zinc-600 focus:border-brand-accent transition-all"
                value={newMedia.title}
                onChange={e => setNewMedia({...newMedia, title: e.target.value})}
              />
            </div>
            
            <button 
              onClick={() => { 
                if (!newMedia.url.trim() || !newMedia.title.trim()) {
                  alert('Por favor, preencha todos os campos.');
                  return;
                }
                onAdd(newMedia); 
                setNewMedia({url: '', title: '', type: 'video'}); 
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-brand-accent hover:bg-white text-zinc-950 hover:text-zinc-900 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-brand-accent/10"
            >
              <Plus size={12} />
              Adicionar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
