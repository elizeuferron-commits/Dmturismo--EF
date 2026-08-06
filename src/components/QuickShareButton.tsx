import React from 'react';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';

interface QuickShareButtonProps {
  media: {
    name: string;
    objectUrl: string;
    type: 'image' | 'video';
  };
}

/**
 * COMPONENTE: Botão de Compartilhamento Rápido (Web Share API)
 */
export const QuickShareButton: React.FC<QuickShareButtonProps> = ({ media }) => {
  const handleShare = async () => {
    if (!navigator.share) {
      toast.error('Seu navegador não suporta a função de compartilhamento nativa.');
      return;
    }

    try {
      // Tenta converter o ObjectURL para um arquivo (Blob)
      const response = await fetch(media.objectUrl);
      const blob = await response.blob();
      const file = new File([blob], media.name, { type: blob.type });

      await navigator.share({
        title: `DM Turismo: ${media.name}`,
        text: 'Confira este documento da DM Turismo',
        files: [file],
      });
      toast.success('Compartilhamento iniciado!');
    } catch (err) {
      console.error('Erro ao compartilhar:', err);
      // Se user cancelou, não mostrar erro importante
      if ((err as Error).name !== 'AbortError') {
         toast.error('Erro ao compartilhar o documento.');
      }
    }
  };

  return (
    <button
      onClick={handleShare}
      className="flex-1 sm:flex-initial px-4 py-2.5 bg-zinc-800 hover:bg-brand-accent hover:text-zinc-950 border border-zinc-700 text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
    >
      <Share2 size={12} />
      COMPARTILHAR
    </button>
  );
};
