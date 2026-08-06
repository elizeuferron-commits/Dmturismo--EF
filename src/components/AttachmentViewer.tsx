import React, { useState } from 'react';
import { 
  FileText, 
  Image as ImageIcon, 
  Download, 
  ExternalLink, 
  X, 
  Eye, 
  FileBox, 
  FileJson,
  FileSpreadsheet,
  FileCode,
  FileArchive
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ImageOptimizer } from './ImageOptimizer';

interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'pdf' | 'word' | 'excel' | string;
}

interface AttachmentViewerProps {
  attachments: Attachment[];
  onClose?: () => void;
  title?: string;
  renderActions?: (file: Attachment) => React.ReactNode;
}

/**
 * 🌑 COMPONENTE EM MODO SOMBRA
 * Visualizador de anexos com organização por categorias e suporte a preview.
 */
export const AttachmentViewer: React.FC<AttachmentViewerProps> = ({ 
  attachments, 
  onClose,
  title = "Documentos e Anexos",
  renderActions
}) => {
  const [selectedFile, setSelectedFile] = useState<Attachment | null>(null);

  const getFileIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'image': return <ImageIcon size={18} />;
      case 'pdf': return <FileText size={18} />;
      case 'excel':
      case 'spreadsheet': return <FileSpreadsheet size={18} />;
      case 'word':
      case 'document': return <FileBox size={18} />;
      default: return <FileText size={18} />;
    }
  };

  const categories = [
    { id: 'all', label: 'Tudo', icon: <FileBox size={14} /> },
    { id: 'image', label: 'Fotos', icon: <ImageIcon size={14} /> },
    { id: 'pdf', label: 'PDFs', icon: <FileText size={14} /> },
    { id: 'office', label: 'Office', icon: <FileSpreadsheet size={14} /> },
  ];

  const [activeTab, setActiveTab] = useState('all');

  const filteredAttachments = attachments.filter(file => {
    if (activeTab === 'all') return true;
    if (activeTab === 'image') return file.type === 'image';
    if (activeTab === 'pdf') return file.type === 'pdf';
    if (activeTab === 'office') return file.type === 'word' || file.type === 'excel';
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-black text-asphalt-500 uppercase tracking-[0.3em] flex items-center gap-2">
          <FileBox size={14} className="text-brand-accent" />
          {title}
        </h3>
        
        <div className="flex bg-asphalt-950/50 border border-asphalt-800 p-1 rounded-xl">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeTab === cat.id 
                  ? "bg-brand-accent text-asphalt-950 shadow-lg" 
                  : "text-asphalt-600 hover:text-asphalt-400"
              )}
            >
              {cat.icon}
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <div className={cn(
        "grid gap-3",
        filteredAttachments.length > 3 ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1"
      )}>
        {filteredAttachments.map((file, idx) => (
          <div 
            key={idx}
            className="group/file flex items-center justify-between p-4 bg-asphalt-900 border border-asphalt-800 hover:border-brand-accent/50 rounded-2xl transition-all"
          >
            <div className="flex items-center gap-4">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover/file:scale-110 overflow-hidden relative shrink-0",
                file.type === 'image' ? "bg-purple-500/10 text-purple-500" :
                file.type === 'pdf' ? "bg-rose-500/10 text-rose-500" :
                "bg-blue-500/10 text-blue-500"
              )}>
                {file.type === 'image' && file.url && file.url !== 'view-os' ? (
                  <ImageOptimizer
                    src={file.url}
                    alt={file.name}
                    maxWidth={100}
                    quality={0.7}
                    className="w-12 h-12 rounded-xl object-cover"
                    fallback={getFileIcon(file.type)}
                  />
                ) : (
                  getFileIcon(file.type)
                )}
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-black text-white uppercase tracking-tight truncate max-w-[180px]">
                  {file.name}
                </p>
                <p className="text-[9px] font-black text-asphalt-700 uppercase tracking-widest">
                  {file.type}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {renderActions && renderActions(file)}
              {file.type === 'image' && (
                <button 
                  onClick={() => setSelectedFile(file)}
                  className="p-2.5 bg-asphalt-800 text-asphalt-400 hover:bg-brand-accent hover:text-asphalt-950 rounded-xl transition-all shadow-sm"
                  title="Visualizar"
                >
                  <Eye size={16} />
                </button>
              )}
              {file.url !== 'view-os' && (
                <>
                  <a 
                    href={file.url}
                    download={file.name}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-asphalt-800 text-asphalt-400 hover:bg-emerald-500 hover:text-asphalt-950 rounded-xl transition-all shadow-sm"
                    title="Download"
                  >
                    <Download size={16} />
                  </a>
                  <a 
                    href={file.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 bg-asphalt-800 text-asphalt-400 hover:bg-asphalt-700 hover:text-white rounded-xl transition-all shadow-sm"
                    title="Abrir em Nova Aba"
                  >
                    <ExternalLink size={16} />
                  </a>
                </>
              )}
            </div>
          </div>
        ))}

        {filteredAttachments.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-asphalt-800 rounded-3xl">
            <FileBox size={32} className="text-asphalt-800 mx-auto mb-4" />
            <p className="text-[10px] font-black text-asphalt-700 uppercase tracking-widest">Nenhum arquivo nesta categoria</p>
          </div>
        )}
      </div>

      {/* Lightbox for Images */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md p-4 md:p-12"
            onClick={() => setSelectedFile(null)}
          >
            <button 
              className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-rose-500 text-white rounded-full transition-all"
              onClick={() => setSelectedFile(null)}
            >
              <X size={24} />
            </button>
            <motion.img 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedFile.url} 
              alt={selectedFile.name} 
              loading="lazy"
              className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-8 left-8 right-8 text-center">
              <p className="text-xl font-black text-white uppercase tracking-tighter shadow-sm">{selectedFile.name}</p>
              <div className="flex items-center justify-center gap-4 mt-6">
                 <a 
                   href={selectedFile.url} 
                   download 
                   className="px-6 py-3 bg-brand-accent text-asphalt-950 font-black text-xs uppercase tracking-widest rounded-xl hover:bg-white transition-all shadow-lg flex items-center gap-2"
                 >
                   <Download size={16} /> Baixar Imagem
                 </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
