import React, { useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';

interface ImageOptimizerProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | undefined | null;
  alt: string;
  className?: string;
  maxWidth?: number; // Target width to reduce large base64 strings to, e.g., 300
  quality?: number; // 0 to 1 for compression
  fallback?: React.ReactNode;
  targetFormat?: 'auto' | 'webp' | 'jpeg' | 'png' | 'preserve';
}

export interface FormatCompressionConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  targetFormat?: 'auto' | 'webp' | 'jpeg' | 'png' | 'preserve';
}

/**
 * Compresses an image based on its specific file format / MIME type:
 * - SVG / GIF: preserved without lossy rasterization (vectors & animation stay intact)
 * - PNG / WEBP: converted to image/webp (or image/png) preserving transparency with minimal footprint
 * - JPG / JPEG / HEIC / BMP: compressed as image/webp or image/jpeg with optimal quality curve
 */
export const compressImageByFormat = (
  file: File | string,
  options: FormatCompressionConfig = {}
): Promise<string> => {
  const {
    maxWidth = 800,
    maxHeight = 800,
    quality: userQuality,
    targetFormat = 'auto'
  } = options;

  return new Promise((resolve, reject) => {
    let mimeType = '';
    let fileName = '';

    if (typeof file !== 'string') {
      mimeType = (file.type || '').toLowerCase();
      fileName = (file.name || '').toLowerCase();
    } else if (file.startsWith('data:')) {
      const match = file.match(/^data:([^;]+);/);
      if (match) mimeType = match[1].toLowerCase();
    } else {
      const extMatch = file.match(/\.([a-z0-9]+)(?=[?#]|$)/i);
      if (extMatch) {
        const ext = extMatch[1].toLowerCase();
        if (ext === 'svg') mimeType = 'image/svg+xml';
        else if (ext === 'gif') mimeType = 'image/gif';
        else if (ext === 'png') mimeType = 'image/png';
        else if (ext === 'webp') mimeType = 'image/webp';
        else if (['jpg', 'jpeg'].includes(ext)) mimeType = 'image/jpeg';
      }
    }

    // Preserve SVGs and animated GIFs directly
    if (
      mimeType.includes('svg') || 
      mimeType.includes('gif') || 
      fileName.endsWith('.svg') || 
      fileName.endsWith('.gif')
    ) {
      if (typeof file === 'string') {
        resolve(file);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Falha ao ler SVG/GIF'));
      reader.readAsDataURL(file);
      return;
    }

    // Format-based export MIME selection and quality tuning
    let exportMime = 'image/jpeg';
    let compressionQuality = userQuality ?? 0.75;

    if (
      targetFormat === 'webp' || 
      (targetFormat === 'auto' && (mimeType.includes('png') || mimeType.includes('webp')))
    ) {
      exportMime = 'image/webp';
      compressionQuality = userQuality ?? (mimeType.includes('png') ? 0.80 : 0.75);
    } else if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      exportMime = 'image/jpeg';
      compressionQuality = userQuality ?? 0.72;
    } else if (mimeType.includes('png')) {
      exportMime = 'image/webp';
      compressionQuality = userQuality ?? 0.80;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }

        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(typeof file === 'string' ? file : '');
          return;
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL(exportMime, compressionQuality);

        // Fallback to JPEG if browser doesn't support WebP export via canvas
        if (exportMime === 'image/webp' && !dataUrl.startsWith('data:image/webp')) {
          dataUrl = canvas.toDataURL('image/jpeg', compressionQuality);
        }

        resolve(dataUrl);
      } catch (err) {
        if (typeof file === 'string') resolve(file);
        else {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        }
      }
    };

    img.onerror = () => {
      if (typeof file === 'string') resolve(file);
      else {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      }
    };

    if (typeof file === 'string') {
      img.src = file;
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    }
  });
};

/**
 * Compresses/resizes a high-res base64 image (or image file) to target dimensions.
 * Uses format-based compression strategy.
 */
export const optimizeImageBeforeUpload = (
  file: File | string,
  maxWidth = 400,
  quality = 0.7
): Promise<string> => {
  return compressImageByFormat(file, { maxWidth, quality, targetFormat: 'auto' });
};

// In-memory cache for compressed base64 URLs so we don't resize them on every render
const optimizedCache = new Map<string, string>();

/**
 * ImageOptimizer Component
 * Renders an optimized image. If the src is a massive base64 string or complex URL, 
 * it scales it down on-the-fly dynamically via HTML Canvas, caches the result, 
 * supports lazy loading, and utilizes srcset/sizes if appropriate.
 */
export const ImageOptimizer: React.FC<ImageOptimizerProps> = ({
  src,
  alt,
  className = '',
  maxWidth = 300,
  quality = 0.75,
  fallback,
  ...props
}) => {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  useEffect(() => {
    if (!src) {
      setDisplaySrc(null);
      setLoading(false);
      setError(false);
      return;
    }

    // 1. If it's a standard short URL (not base64), we can load it directly
    // and let the browser use standard loading/srcset optimizations if offered
    const isBase64 = src.startsWith('data:');
    const isHuge = isBase64 && src.length > 100 * 1024; // > 100KB is massive for an avatar/thumbnail in memory

    if (!isHuge) {
      setDisplaySrc(src);
      setLoading(false);
      setError(false);
      return;
    }

    // 2. Check the in-memory cache first to avoid re-rendering bottleneck
    const cacheKey = `${src.substring(0, 100)}_${src.length}_${maxWidth}_${quality}`;
    if (optimizedCache.has(cacheKey)) {
      setDisplaySrc(optimizedCache.get(cacheKey) || null);
      setLoading(false);
      setError(false);
      return;
    }

    // 3. Perform on-the-fly downscaling on a web canvas thread safely of the base64 image
    setLoading(true);
    let active = true;

    optimizeImageBeforeUpload(src, maxWidth, quality)
      .then((compressed) => {
        if (active) {
          optimizedCache.set(cacheKey, compressed);
          setDisplaySrc(compressed);
          setLoading(false);
        }
      })
      .catch((e) => {
        console.error('Image optimization failed on-the-fly:', e);
        if (active) {
          setDisplaySrc(src); // fallback to original high-res string if compression fails
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [src, maxWidth, quality]);

  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-zinc-800 ${className}`}>
        {fallback || <AlertCircle className="text-zinc-600 w-6 h-6" />}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center z-10">
          <Loader2 className="animate-spin text-brand-accent w-5 h-5" />
        </div>
      )}
      
      {error ? (
        <div className="absolute inset-0 bg-zinc-950 flex items-center justify-center z-10 text-rose-500/50">
          <AlertCircle className="w-5 h-5" />
        </div>
      ) : displaySrc ? (
        <img
          src={displaySrc}
          alt={alt}
          onError={() => setError(true)}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
          loading={props.loading || "lazy"}
          {...props}
        />
      ) : null}
    </div>
  );
};
