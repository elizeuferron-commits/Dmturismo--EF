import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { ImageIcon } from 'lucide-react';
import { getOrFetchImage } from '../services/mediaCacheService';

interface ProgressiveImageProps {
  src: string;
  placeholderSrc?: string; // Opt
  alt: string;
  className?: string;
  imgClassName?: string;
}

export const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  src,
  placeholderSrc,
  alt,
  className,
  imgClassName,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [cachedSrc, setCachedSrc] = useState<string>('');
  const imageRef = useRef<HTMLDivElement>(null);

  // Reset loaded status whenever src changes
  useEffect(() => {
    setIsLoaded(false);
  }, [src]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imageRef.current) {
      observer.observe(imageRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let activeObjectUrl: string | null = null;
    let isMounted = true;

    if (isVisible && src) {
      getOrFetchImage(src)
        .then((resolved) => {
          if (!isMounted) {
            if (resolved.startsWith('blob:')) {
              URL.revokeObjectURL(resolved);
            }
            return;
          }
          if (resolved.startsWith('blob:')) {
            activeObjectUrl = resolved;
          }
          setCachedSrc(resolved);
        })
        .catch(() => {
          if (isMounted) {
            setCachedSrc(src);
          }
        });
    } else {
      setCachedSrc(src || '');
    }

    return () => {
      isMounted = false;
      if (activeObjectUrl) {
        URL.revokeObjectURL(activeObjectUrl);
      }
    };
  }, [src, isVisible]);

  return (
    <div ref={imageRef} className={cn("relative overflow-hidden bg-zinc-900", className)}>
      {/* Low-Quality Image Placeholder (LQIP) rendered blurred in the background */}
      {placeholderSrc && !isLoaded && (
        <img
          src={placeholderSrc}
          alt="Carregando..."
          loading="lazy"
          className={cn("absolute inset-0 w-full h-full object-cover blur-md scale-105 select-none pointer-events-none transition-opacity duration-300", imgClassName)}
        />
      )}

      <AnimatePresence>
        {!isLoaded && !placeholderSrc && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-zinc-900"
          >
            {/* Simple skeleton/blur animation while loading */}
            <div className="animate-pulse bg-zinc-800 w-full h-full" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {isVisible && cachedSrc && (
        <motion.img
          initial={{ opacity: 0, filter: placeholderSrc ? 'none' : 'blur(10px)' }}
          animate={{ opacity: isLoaded ? 1 : 0, filter: isLoaded ? 'none' : (placeholderSrc ? 'none' : 'blur(10px)') }}
          transition={{ duration: 0.5 }}
          src={cachedSrc}
          alt={alt}
          loading="lazy"
          className={cn("w-full h-full object-cover", imgClassName)}
          onLoad={() => setIsLoaded(true)}
        />
      )}
    </div>
  );
};
