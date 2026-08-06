import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Smartphone, 
  Monitor, 
  Download, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Apple, 
  Chrome,
  ExternalLink,
  SmartphoneIcon
} from 'lucide-react';
import { Button } from './UI';

interface InstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInstall: () => void;
  isInstallable: boolean;
}

export const InstallModal = ({ isOpen, onClose, onInstall, isInstallable }: InstallModalProps) => {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  const isDesktop = !isIOS && !isAndroid;

  const downloadShortcut = () => {
    const appUrl = window.location.origin;
    const shortcutContent = `[InternetShortcut]\nURL=${appUrl}\nIDList=\nIconIndex=0\nIconFile=${appUrl}/logo.svg`;
    const blob = new Blob([shortcutContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DM_Turismo_Pro.url';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-[32px] shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-8 pb-4 flex items-center justify-between border-b border-zinc-800/50">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-brand-accent rounded-2xl flex items-center justify-center border border-brand-accent/20 shadow-[0_0_20px_rgba(255,107,0,0.3)] transform rotate-3">
                   <span className="text-zinc-950 font-black text-2xl">DM</span>
                </div>
                <div>
                  <h3 className="text-xl font-black text-white uppercase tracking-tighter">Instalar App Pro</h3>
                  <p className="text-[10px] font-black text-brand-accent uppercase tracking-[0.2em] mt-1">Terminal Executável (Mobile Mode)</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all"
              >
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            {/* Content */}
            <div className="p-8 space-y-6">
              {/* Context Summary */}
              <div className="bg-brand-accent/5 p-4 rounded-2xl border border-brand-accent/10">
                <p className="text-[10px] font-bold text-brand-accent uppercase tracking-widest text-center leading-relaxed">
                  Para facilitar o seu dia, coloque o ícone do DM Turismo na tela do seu celular. Ver as viagens será muito mais rápido!
                </p>
              </div>

              {/* Step by Step - Simple Mode */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
                   <div className="w-6 h-6 bg-brand-accent text-zinc-950 rounded-full flex items-center justify-center font-black text-xs">1</div>
                   <p className="text-sm font-black text-white uppercase tracking-tight">Abra este link no seu celular</p>
                </div>

                <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
                   <div className="w-6 h-6 bg-brand-accent text-zinc-950 rounded-full flex items-center justify-center font-black text-xs">2</div>
                   <p className="text-sm font-black text-white uppercase tracking-tight">
                     {isIOS ? 'Toque no botão de "Compartilhar" (quadrado com seta)' : 'Toque nos "3 pontinhos" lá em cima'}
                   </p>
                </div>

                <div className="flex items-center gap-3 border-b border-zinc-800 pb-2">
                   <div className="w-6 h-6 bg-brand-accent text-zinc-950 rounded-full flex items-center justify-center font-black text-xs">3</div>
                   <p className="text-sm font-black text-white uppercase tracking-tight italic">
                     {isIOS ? 'Clique em "Tela de Início"' : 'Clique em "Instalar Aplicativo"'}
                   </p>
                </div>

                <div className="flex items-center gap-3">
                   <div className="w-6 h-6 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center font-black text-xs">OK</div>
                   <p className="text-sm font-black text-white uppercase tracking-tight">Pronto! O ícone vai aparecer no seu celular.</p>
                </div>
              </div>

              {/* Action Button for those who can */}
              {isInstallable && (
                <div className="pt-4">
                  <Button onClick={onInstall} className="bg-white text-zinc-950 w-full flex items-center justify-center gap-3 py-6 rounded-2xl group transition-all active:scale-95 shadow-xl hover:shadow-white/5">
                    <Download size={20} className="group-hover:animate-bounce" />
                    <span className="text-sm font-black uppercase">Instalar Agora (Clique Aqui)</span>
                  </Button>
                </div>
              )}

              {/* Desktop Shortcut */}
              {isDesktop && (
                <div className="bg-zinc-800/30 p-6 rounded-3xl border border-dashed border-zinc-700">
                  <p className="text-zinc-500 text-[10px] font-medium leading-relaxed mb-4 text-center">
                    Está no computador? Clique abaixo para criar um atalho na sua área de trabalho.
                  </p>
                  <Button onClick={downloadShortcut} variant="secondary" className="w-full border-zinc-700 hover:border-zinc-500 py-3 rounded-2xl flex items-center justify-center gap-2">
                    <Download size={14} />
                    <span className="text-xs">Baixar Atalho para o PC</span>
                  </Button>
                </div>
              )}

              {/* Security Badge */}
              <div className="flex items-center gap-3 px-4 py-3 bg-zinc-950 rounded-2xl border border-zinc-800/50">
                <Monitor size={16} className="text-emerald-500" />
                <div className="flex flex-col">
                  <span className="text-[9px] font-black text-white uppercase tracking-wider">Multiplataforma</span>
                  <span className="text-[8px] font-bold text-zinc-500 uppercase">Windows • Android • iPhone</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 bg-zinc-950/50 flex items-center justify-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
              <p className="text-[10px] font-black text-zinc-600 uppercase tracking-widest">
                 Versão Digital Segura • DM Turismo Pro
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
