import React, { useState, useRef } from 'react';
import { Camera, FileSearch, Loader2, CheckCircle2, AlertCircle, X, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface ScannedData {
  description?: string;
  supplier?: string;
  amount?: number;
  dueDate?: string;
  barcode?: string;
}

interface DocumentScannerProps {
  onScanComplete: (data: ScannedData) => void;
  onClose: () => void;
}

/**
 * COMPONENTE DE SCANNER DE DOCUMENTOS
 * Fornece interface para escanear documentos financeiros usando a API Gemini,
 * com filtro de contraste aplicado automaticamente para imagens.
 */
export const DocumentScanner: React.FC<DocumentScannerProps> = ({ onScanComplete, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Função para aplicar filtro de contraste
  const applyContrast = (imgSrc: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(imgSrc);
          return;
        }

        // Aplica o filtro de contraste (Ex: 150%)
        ctx.filter = 'contrast(150%)';
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      };
      img.src = imgSrc;
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('Por favor, selecione uma imagem (JPG, PNG) ou um documento PDF.');
      return;
    }

    setFileName(file.name);
    setSelectedMimeType(file.type);

    const reader = new FileReader();
    reader.onload = async (event) => {
      const resultData = event.target?.result as string;
      if (file.type.startsWith('image/')) {
        // Aplica o contraste automaticamente apenas para imagens
        const filteredImage = await applyContrast(resultData);
        setPreview(filteredImage);
      } else {
        // Para PDF, não aplica contraste, apenas guarda o DataURL
        setPreview(resultData);
      }
    };
    reader.readAsDataURL(file);
  };

  const processImage = async () => {
    if (!preview) return;

    setIsScanning(true);
    try {
      const base64Data = preview.split(',')[1];
      const mimeType = selectedMimeType || preview.split(',')[0].split(':')[1].split(';')[0];

      const response = await fetch('/api/finance/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base64Data, mimeType })
      });

      if (!response.ok) throw new Error('Falha ao processar documento');

      const data = await response.json();
      
      toast.success(mimeType === 'application/pdf' 
        ? 'PDF processado e interpretado com sucesso!' 
        : 'Imagem processada (com realce de contraste) com sucesso!'
      );
      onScanComplete(data);
    } catch (error) {
      console.error('Scan error:', error);
      toast.error('Erro ao ler documento. Tente novamente ou preencha manualmente.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleClear = () => {
    setPreview(null);
    setSelectedMimeType(null);
    setFileName(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-accent/10 flex items-center justify-center text-brand-accent">
              <Camera size={20} />
            </div>
            <div>
              <h3 className="font-bold text-lg text-white">Scanner Inteligente</h3>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-medium">Auto-Contraste & Suporte PDF</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          {!preview ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-800 rounded-2xl p-12 text-center hover:border-brand-accent/50 hover:bg-brand-accent/5 transition-all cursor-pointer group"
            >
              <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                <FileSearch className="text-zinc-500 group-hover:text-brand-accent" size={32} />
              </div>
              <p className="text-zinc-300 font-medium">Clique para selecionar ou tirar foto</p>
              <p className="text-zinc-500 text-sm mt-2">Suporta JPG, PNG, PDF</p>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileSelect} 
                className="hidden" 
                accept="image/*,application/pdf" 
                capture="environment" 
              />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="relative rounded-2xl overflow-hidden border border-zinc-800 h-64 bg-black">
                {selectedMimeType === 'application/pdf' ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-4 bg-zinc-950">
                    <FileText className="text-red-500 animate-pulse animate-duration-1000" size={56} />
                    <p className="text-zinc-200 font-bold text-sm truncate max-w-xs">{fileName || 'Documento.pdf'}</p>
                    <span className="text-[10px] font-black text-red-500/80 uppercase tracking-widest bg-red-500/10 px-2.5 py-1 rounded-md font-mono">Documento PDF</span>
                  </div>
                ) : (
                  <img src={preview} alt="Preview Contrastado" className="w-full h-full object-contain" />
                )}
                <button 
                  onClick={handleClear}
                  className="absolute top-2 right-2 p-2 bg-zinc-900/80 hover:bg-red-500 text-white rounded-full transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleClear}
                  disabled={isScanning}
                  className="flex-1 py-4 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-2xl font-bold transition-all disabled:opacity-50 uppercase text-xs tracking-widest"
                >
                  Trocar Arquivo
                </button>
                <button
                  onClick={processImage}
                  disabled={isScanning}
                  className="flex-[2] py-4 bg-brand-accent text-zinc-950 rounded-2xl font-black shadow-lg shadow-brand-accent/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3 uppercase text-xs tracking-widest"
                >
                  {isScanning ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Analisando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={18} />
                      Confirmar e Iniciar Leitura
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
            <AlertCircle className="text-blue-400 shrink-0" size={18} />
            <p className="text-xs text-blue-300/70 leading-relaxed font-sans">
              Suporta imagens e documentos em formato PDF. Filtro de contraste automático aplicado apenas em imagens para melhorar a legibilidade. Sempre confira os dados antes de salvar.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
