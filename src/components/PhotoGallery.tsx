import React, { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, collection, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { dbCacheService } from '../services/dbCacheService';
import { Camera, Upload, Trash2, X, ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, FileSearch, CheckCircle2, Sparkles } from 'lucide-react';
import { optimizeImageBeforeUpload, ImageOptimizer } from './ImageOptimizer';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface PhotoGalleryProps {
  collectionName: 'employees' | 'vehicles' | 'trips';
  documentId: string;
  vehiclePlate?: string; // Optional context for AI scanning
}

interface GalleryPhoto {
  id: string;
  url: string;
  createdAt: string;
  caption?: string;
  plate?: string;
  metadata?: any; // To store AI extracted data if any
}

export const PhotoGallery: React.FC<PhotoGalleryProps> = ({ collectionName, documentId, vehiclePlate }) => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [uploading, setUploading] = useState<boolean>(false);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [activePhotoIndex, setActivePhotoIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Sync gallery in real-time
  useEffect(() => {
    if (!documentId) return;

    setLoading(true);
    const path = `${collectionName}/${documentId}`;
    
    const unsubscribe = dbCacheService.subscribeDocument(path, (data) => {
      if (data) {
        setPhotos(data.gallery || data.photos || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [collectionName, documentId]);

  // 🚀 OPTIMIZATION: Advanced Image Preloading Strategy
  // Injects <link rel="preload"> tags and preloads photos into browser cache
  useEffect(() => {
    if (photos.length === 0) return;

    const preloadLinks: HTMLLinkElement[] = [];

    // 1. Preload first 8 photos (above-the-fold thumbnails) as they are critical for initial render
    const criticalThumbnails = photos.slice(0, 8);
    criticalThumbnails.forEach(photo => {
      // Standard Link Preload (Modern Browsers)
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = photo.url;
      document.head.appendChild(link);
      preloadLinks.push(link);

      // Legacy Object Preload (Fallback)
      const img = new Image();
      img.src = photo.url;
    });

    // 2. Predictive Preloading for Lightbox (Active, Next and Previous)
    if (activePhotoIndex !== null) {
      const indicesToPreload = Array.from(new Set([
        activePhotoIndex,
        (activePhotoIndex + 1) % photos.length,
        (activePhotoIndex - 1 + photos.length) % photos.length
      ]));

      indicesToPreload.forEach(idx => {
        if (photos[idx]) {
          const link = document.createElement('link');
          link.rel = 'preload';
          link.as = 'image';
          link.href = photos[idx].url;
          document.head.appendChild(link);
          preloadLinks.push(link);

          const img = new Image();
          img.src = photos[idx].url;
        }
      });
    }

    // Cleanup on unmount or state change
    return () => {
      preloadLinks.forEach(link => {
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      });
    };
  }, [photos, activePhotoIndex]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>, capture: boolean, shouldScan: boolean = false) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    if (shouldScan) setIsScanning(true);

    const docRef = doc(db, collectionName, documentId);

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Use ImageOptimizer to compress photo to a reasonable size (~100KB)
        const compressedBase64 = await optimizeImageBeforeUpload(file, 1200, 0.8);

        let aiData = null;
        let finalCaption = capture ? 'Foto de Celular' : file.name || 'Foto enviada';

        // Trigger AI Scanning if requested
        if (shouldScan) {
          try {
            const base64Data = compressedBase64.split(',')[1];
            const mimeType = file.type;

            const response = await fetch('/api/vehicle/scan-document', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                base64Data, 
                mimeType,
                plate: vehiclePlate 
              })
            });

            if (response.ok) {
              aiData = await response.json();
              if (aiData.documentName) {
                finalCaption = `[DOC] ${aiData.documentName}`;
                
                // 🛠️ DATA DISTRIBUTION: Automatically update vehicle technical fields
                if (collectionName === 'vehicles') {
                  const updates: any = {};
                  if (aiData.extractedRenavam) updates.renavam = aiData.extractedRenavam;
                  if (aiData.extractedChassi) updates.chassi = aiData.extractedChassi;
                  if (aiData.extractedPlate) updates.plate = aiData.extractedPlate;
                  if (aiData.extractedBrand) updates.brand = aiData.extractedBrand;
                  if (aiData.extractedModel) updates.model = aiData.extractedModel;
                  if (aiData.extractedYear) updates.factoryYear = aiData.extractedYear;
                  if (aiData.extractedCapacity) updates.capacity = Number(aiData.extractedCapacity);
                  
                  // Update specific expiration dates if identified
                  if (aiData.targetVehicleField && aiData.validityDate) {
                    updates[aiData.targetVehicleField] = aiData.validityDate;
                  }

                  if (Object.keys(updates).length > 0) {
                    await updateDoc(docRef, updates);
                    toast.success('Dados técnicos do veículo sincronizados via IA!');
                  }
                }

                // If validity is found and it's a vehicle, we might want to register this in finance_documents too
                if (aiData.validityDate) {
                   await addDoc(collection(db, 'finance_documents'), {
                     name: aiData.documentName,
                     category: 'veiculos',
                     vehicleId: documentId,
                     dueDate: aiData.validityDate,
                     status: 'pendente',
                     createdAt: new Date().toISOString(),
                     metadata: {
                       renavam: aiData.extractedRenavam,
                       chassi: aiData.extractedChassi,
                       observations: aiData.observations,
                       source: 'AI_SCAN_GALLERY'
                     }
                   });
                   toast.success(`Documento "${aiData.documentName}" identificado com vencimento em ${new Date(aiData.validityDate).toLocaleDateString()}! Registrado no financeiro.`);
                }
              }
            }
          } catch (scanErr) {
            console.error('AI Scan Error in Gallery:', scanErr);
            toast.error('Foto salva, mas houve um erro na análise de IA.');
          }
        }

        const newPhoto: GalleryPhoto = {
          id: `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
          url: compressedBase64,
          createdAt: new Date().toISOString(),
          caption: finalCaption,
          plate: vehiclePlate || aiData?.extractedPlate || undefined,
          metadata: aiData
        };

        // Standard Firestore array update
        await updateDoc(docRef, {
          gallery: arrayUnion(newPhoto)
        });
      }

      if (!shouldScan) {
        toast.success(capture ? 'Foto capturada com sucesso!' : 'Fotos enviadas com sucesso!');
      }
    } catch (error: any) {
      console.error('Error uploading photos:', error);
      toast.error('Erro ao salvar as fotos na galeria.');
    } finally {
      setUploading(false);
      setIsScanning(false);
      // Reset input element value
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoToDelete: GalleryPhoto, event: React.MouseEvent) => {
    event.stopPropagation();
    
    if (!window.confirm('Tem certeza que deseja excluir esta foto da galeria?')) {
      return;
    }

    const docRef = doc(db, collectionName, documentId);

    try {
      await updateDoc(docRef, {
        gallery: arrayRemove(photoToDelete)
      });
      
      if (activePhotoIndex !== null) {
        setActivePhotoIndex(null);
      }
      toast.success('Foto removida com sucesso!');
    } catch (error: any) {
      console.error('Error deleting photo:', error);
      toast.error('Erro ao remover a foto.');
    }
  };

  const handleNextPhoto = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (activePhotoIndex === null) return;
    setActivePhotoIndex((prev) => (prev !== null && prev < photos.length - 1 ? prev + 1 : 0));
  };

  const handlePrevPhoto = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (activePhotoIndex === null) return;
    setActivePhotoIndex((prev) => (prev !== null && prev > 0 ? prev - 1 : photos.length - 1));
  };

  return (
    <div id="photo-gallery-root" className="space-y-6">
      {/* Gallery Header / Control Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <ImageIcon size={16} className="text-brand-accent" />
              Galeria de Fotos
            </h3>
            {vehiclePlate && (
              <span className="px-2.5 py-0.5 bg-brand-accent/10 border border-brand-accent/30 text-brand-accent text-[9px] font-black uppercase rounded-lg">
                PLACA: {vehiclePlate}
              </span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 font-medium">Fotos operacionais, vistorias e documentos capturados para a placa de veículo correspondente</p>
        </div>

        {/* Dynamic Buttons to upload or take photos directly */}
        <div className="flex items-center gap-2">
          {/* SCAN BUTTON: Escanear Documento */}
          <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-emerald-500 active:scale-95 cursor-pointer transition-all shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
            <Sparkles size={14} className="animate-pulse" />
            Escanear Documento
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, false, true)}
              disabled={uploading}
            />
          </label>

          {/* CAMERA BUTTON: Tirar Foto */}
          <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-brand-accent text-zinc-950 font-black text-[9px] uppercase tracking-widest rounded-xl hover:scale-105 active:scale-95 cursor-pointer transition-all shadow-lg shadow-brand-accent/20">
            <Camera size={14} />
            Tirar Foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, true)}
              disabled={uploading}
            />
          </label>

          {/* GALLERY BUTTON: Escolher Arquivo */}
          <label className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 bg-zinc-800 text-white font-black text-[9px] uppercase tracking-widest rounded-xl hover:bg-zinc-700 active:scale-95 cursor-pointer transition-all border border-white/5">
            <Upload size={14} />
            Enviar Imagem
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handlePhotoUpload(e, false)}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Loader2 className="animate-spin text-brand-accent" size={24} />
          <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Sincronizando galeria...</span>
        </div>
      ) : photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 px-4 rounded-2xl border border-dashed border-zinc-800 bg-zinc-900/10 text-center gap-3">
          <ImageIcon size={32} className="text-zinc-700" />
          <div className="space-y-1">
            <p className="text-[10px] font-black text-zinc-400 uppercase tracking-wider">Nenhuma foto cadastrada</p>
            <p className="text-[9px] text-zinc-600 max-w-xs mx-auto">Utilize os botões acima para tirar fotos do celular ou enviar arquivos direto para o fichário.</p>
          </div>
        </div>
      ) : (
        /* Photo Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          <AnimatePresence mode="popLayout">
            {photos.map((photo, index) => (
              <motion.div
                key={photo.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative aspect-square bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden cursor-pointer"
                onClick={() => setActivePhotoIndex(index)}
              >
                <ImageOptimizer
                  src={photo.url}
                  alt={photo.caption || ''}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  maxWidth={300}
                  quality={0.7}
                  loading={index < 8 ? "eager" : "lazy"}
                />
                
                {/* Overlay with details */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-3 flex flex-col justify-end">
                  <div className="flex items-center gap-1.5 mb-1">
                    {photo.caption?.startsWith('[DOC]') && <Sparkles size={10} className="text-brand-accent" />}
                    <p className="text-[9px] font-black text-white uppercase truncate tracking-wider">
                      {photo.caption}
                    </p>
                  </div>
                  <p className="text-[8px] font-medium text-zinc-400 font-mono">
                    {new Date(photo.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>

                {/* Quick Delete Button */}
                <button
                  onClick={(e) => handleDeletePhoto(photo, e)}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-rose-600/90 text-zinc-400 hover:text-white rounded-lg transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm shadow-md"
                  title="Excluir Foto"
                >
                  <Trash2 size={12} />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Uploading Status Overlay */}
      {uploading && (
        <div className="flex items-center gap-3 px-5 py-4 bg-zinc-900/80 border border-white/5 rounded-2xl backdrop-blur-md shadow-2xl animate-in fade-in zoom-in-95">
          <div className="relative">
            <Loader2 size={18} className="animate-spin text-brand-accent" />
            {isScanning && <Sparkles size={10} className="absolute -top-1 -right-1 text-emerald-500 animate-pulse" />}
          </div>
          <div className="space-y-0.5">
            <span className="block text-[10px] font-black uppercase tracking-widest text-white">
              {isScanning ? 'Inteligência Artificial Analisando...' : 'Otimizando Imagem...'}
            </span>
            <span className="block text-[8px] font-medium text-zinc-500 uppercase tracking-tighter">
              {isScanning ? 'Identificando documento e datas de validade' : 'Reduzindo tamanho do arquivo sem perda de qualidade'}
            </span>
          </div>
        </div>
      )}

      {/* Full Screen Lightbox Modal */}
      <AnimatePresence>
        {activePhotoIndex !== null && photos[activePhotoIndex] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 backdrop-blur-md z-[9999] flex flex-col justify-between p-4 md:p-8"
            onClick={() => setActivePhotoIndex(null)}
          >
            {/* Header */}
            <div className="flex items-center justify-between w-full z-10">
              <div className="space-y-0.5">
                <span className="text-[10px] font-black text-brand-accent uppercase tracking-widest">
                  Ficha de {collectionName === 'employees' ? 'Colaborador' : collectionName === 'vehicles' ? 'Veículo' : 'Viagem'}
                </span>
                <h4 className="text-sm font-black text-white uppercase tracking-wider">
                  {photos[activePhotoIndex].caption}
                </h4>
                <p className="text-[9px] font-mono text-zinc-500">
                  {new Date(photos[activePhotoIndex].createdAt).toLocaleString('pt-BR')}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Delete in lightbox */}
                <button
                  onClick={(e) => handleDeletePhoto(photos[activePhotoIndex], e)}
                  className="p-3 bg-zinc-900/80 hover:bg-rose-600/90 text-zinc-400 hover:text-white rounded-xl transition-all border border-white/5"
                  title="Excluir Foto"
                >
                  <Trash2 size={16} />
                </button>
                {/* Close */}
                <button
                  onClick={() => setActivePhotoIndex(null)}
                  className="p-3 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-xl transition-all border border-white/5"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Photo Container */}
            <div className="relative flex-1 flex items-center justify-center max-h-[80vh] my-4">
              {/* Previous Button */}
              {photos.length > 1 && (
                <button
                  onClick={handlePrevPhoto}
                  className="absolute left-0 p-3 md:p-4 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full transition-all border border-white/5 shadow-xl hover:scale-105 active:scale-95"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* Main Image */}
              <motion.img
                key={photos[activePhotoIndex].id}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                src={photos[activePhotoIndex].url}
                alt={photos[activePhotoIndex].caption || ''}
                className="max-w-full max-h-full object-contain rounded-2xl shadow-2xl border border-white/10"
                onClick={(e) => e.stopPropagation()}
                loading="eager"
              />

              {/* Next Button */}
              {photos.length > 1 && (
                <button
                  onClick={handleNextPhoto}
                  className="absolute right-0 p-3 md:p-4 bg-zinc-900/80 hover:bg-zinc-800 text-white rounded-full transition-all border border-white/5 shadow-xl hover:scale-105 active:scale-95"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>

            {/* Footer / Caption & Counter */}
            <div className="flex items-center justify-between w-full text-zinc-500 font-mono text-[10px] uppercase z-10 border-t border-white/5 pt-4">
              <span>{collectionName.toUpperCase()} GALLERY</span>
              <span>{activePhotoIndex + 1} de {photos.length}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
