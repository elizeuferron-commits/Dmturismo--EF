import React from 'react';
import { 
  X, 
  ChevronRight,
  Loader2 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const Modal = ({ isOpen, onClose, title, children }: ModalProps) => (
  <AnimatePresence>
    {isOpen && (
      <div className="contents">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-asphalt-950/70 backdrop-blur-md z-[100]" 
        />
        <motion.div 
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ type: "spring", stiffness: 250, damping: 30 }}
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-xl bg-asphalt-900 border border-asphalt-800 rounded-[2rem] shadow-2xl z-[101] overflow-hidden"
        >
          <div className="px-6 sm:px-10 py-5 sm:py-8 flex items-center justify-between border-b border-asphalt-800/40 bg-asphalt-900/50">
            <div>
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tighter leading-none">{title}</h3>
              <p className="text-[9px] font-black text-brand-accent uppercase tracking-widest mt-1.5 leading-none">Terminal de Operações</p>
            </div>
            <button onClick={onClose} className="p-2 sm:p-3 hover:bg-asphalt-800 rounded-xl transition-all active:scale-90 bg-asphalt-900 border border-asphalt-800 group">
              <X size={18} className="text-asphalt-700 group-hover:text-white" />
            </button>
          </div>
          <div className="p-6 sm:p-10 max-h-[75vh] overflow-y-auto bg-asphalt-900/20 tracking-tight">
            {children}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>
);

export const Input = ({ label, icon: Icon, ...props }: any) => (
  <div className="space-y-2 mb-6 last:mb-0">
    <label className="text-[10px] font-black text-asphalt-700 uppercase tracking-[0.2em] block ml-1">{label}</label>
    <div className="relative group">
      {Icon && <Icon className="absolute left-6 top-1/2 -translate-y-1/2 text-asphalt-700 group-focus-within:text-brand-accent transition-colors duration-300" size={18} />}
      <input 
        {...props}
        className={cn(
          "w-full pr-6 py-5 bg-asphalt-950 border border-asphalt-800 focus:border-brand-accent rounded-2xl font-bold text-white outline-none transition-all duration-300 placeholder:text-asphalt-800 text-sm shadow-inner",
          Icon ? "pl-16" : "pl-6"
        )}
      />
    </div>
  </div>
);

export const Select = ({ label, options, icon: Icon, ...props }: any) => (
  <div className="space-y-2 mb-6 last:mb-0">
    <label className="text-[10px] font-black text-asphalt-700 uppercase tracking-[0.2em] block ml-1">{label}</label>
    <div className="relative group">
      {Icon && <Icon className="absolute left-6 top-1/2 -translate-y-1/2 text-asphalt-700 group-focus-within:text-brand-accent pointer-events-none transition-colors duration-300" size={18} />}
      <select 
        {...props}
        className={cn(
          "w-full pr-12 py-5 bg-asphalt-950 border border-asphalt-800 focus:border-brand-accent rounded-2xl font-bold text-white outline-none transition-all duration-300 appearance-none text-sm",
          Icon ? "pl-16" : "pl-6"
        )}
      >
        {(options || []).map((opt: any) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled} className="bg-asphalt-900">{opt.label}</option>
        ))}
      </select>
      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-asphalt-700">
        <ChevronRight className="rotate-90" size={18} />
      </div>
    </div>
  </div>
);

export const Textarea = ({ label, ...props }: any) => (
  <div className="space-y-2 mb-6 last:mb-0">
    <label className="text-[10px] font-black text-asphalt-700 uppercase tracking-[0.2em] block ml-1">{label}</label>
    <textarea 
      {...props}
      rows={4}
      className="w-full px-6 py-5 bg-asphalt-950 border border-asphalt-800 focus:border-brand-accent rounded-2xl font-bold text-white outline-none transition-all duration-300 placeholder:text-asphalt-800 text-sm resize-none"
    />
  </div>
);

export const Button = ({ children, loading, variant = 'primary', className, ...props }: any) => (
  <button 
    disabled={loading}
    className={cn(
      "w-full py-4 px-6 rounded-2xl font-black uppercase text-xs tracking-widest transition-all duration-100 flex items-center justify-center gap-3 disabled:opacity-50 disabled:translate-y-0 disabled:shadow-none select-none cursor-pointer",
      variant === 'primary' ? "btn-3d-gold" : "btn-3d-blue",
      className
    )}
    {...props}
  >
    {loading ? <Loader2 className="animate-spin" size={18} /> : children}
  </button>
);

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmVariant?: 'danger' | 'primary' | 'success' | 'warning';
}

export const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirmar Exclusão', confirmVariant = 'danger' }: ConfirmModalProps) => {
  const [loading, setLoading] = React.useState(false);

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (error: any) {
      console.error("Erro na confirmação:", error);
      const msg = error?.message || '';
      if (msg.includes('insuficiente') || msg.includes('permission')) {
        toast.error('Erro de permissão para realizar esta ação.');
      } else {
        toast.error('Erro ao processar a ação. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case 'success':
        return 'bg-emerald-600 hover:bg-emerald-700 text-white font-black uppercase';
      case 'warning':
        return 'bg-amber-600 hover:bg-amber-700 text-white font-black uppercase';
      case 'primary':
        return 'bg-brand-accent hover:bg-brand-accent/80 text-white font-black uppercase';
      case 'danger':
      default:
        return 'bg-red-600 hover:bg-red-700 text-white font-black uppercase';
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-6">
        <p className="text-zinc-400 font-medium leading-relaxed">{message}</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button 
            onClick={handleConfirm}
            loading={loading}
            className={getVariantStyles()}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
