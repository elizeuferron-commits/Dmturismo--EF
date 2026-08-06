const DB_NAME = 'DMImageCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'cached_images';

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = () => {
      console.error('[MediaCache] Failed to open IndexedDB:', request.error);
      reject(request.error);
    };
  });
};

export interface CachedImageItem {
  url: string;
  blob: Blob;
  mimeType: string;
  createdAt: string;
}

export const getCachedImage = async (url: string): Promise<Blob | null> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(url);

      request.onsuccess = () => {
        const result = request.result as CachedImageItem | undefined;
        resolve(result ? result.blob : null);
      };

      request.onerror = () => {
        console.error('[MediaCache] Error fetching from IndexedDB:', request.error);
        resolve(null);
      };
    });
  } catch (err) {
    console.error('[MediaCache] Failed to fetch image from cache:', err);
    return null;
  }
};

export const cacheImage = async (url: string, blob: Blob): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const item: CachedImageItem = {
        url,
        blob,
        mimeType: blob.type,
        createdAt: new Date().toISOString(),
      };
      store.put(item);

      tx.oncomplete = () => {
        resolve();
      };

      tx.onerror = () => {
        console.error('[MediaCache] Error saving to IndexedDB:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('[MediaCache] Failed to cache image:', err);
  }
};

/**
 * Gets a cached image as an Object URL.
 * If not cached, fetches it, caches it, and returns the Object URL.
 * Falls back to the original URL in case of CORS or network issues.
 */
export const getOrFetchImage = async (url: string): Promise<string> => {
  if (!url) return '';
  
  // If it's already a local Object URL, data URL or local resource, return as-is
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return url;
  }

  try {
    const cachedBlob = await getCachedImage(url);
    if (cachedBlob) {
      return URL.createObjectURL(cachedBlob);
    }

    // Fetch and cache
    const response = await fetch(url, { cache: 'force-cache' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const blob = await response.blob();
    
    // Check if it's actually an image
    if (blob.type.startsWith('image/')) {
      await cacheImage(url, blob);
      return URL.createObjectURL(blob);
    }
    
    return url;
  } catch (error) {
    // Elegant fallback to original URL (bypasses JS CORS via direct img render)
    console.warn(`[MediaCache] Failed to load/cache image from network: ${url}`, error);
    return url;
  }
};

/**
 * Get Cache Statistics
 */
export const getCacheStats = async (): Promise<{ count: number; sizeBytes: number }> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      let count = 0;
      let sizeBytes = 0;
      
      const request = store.openCursor();
      request.onsuccess = (event: any) => {
        const cursor = event.target.result;
        if (cursor) {
          count++;
          const item = cursor.value as CachedImageItem;
          if (item && item.blob) {
            sizeBytes += item.blob.size;
          }
          cursor.continue();
        } else {
          resolve({ count, sizeBytes });
        }
      };
      
      request.onerror = () => {
        console.error('[MediaCache] Error getting stats:', request.error);
        reject(request.error);
      };
    });
  } catch (err) {
    console.error('[MediaCache] Failed to get cache stats:', err);
    return { count: 0, sizeBytes: 0 };
  }
};

/**
 * Clear All Cached Images
 */
export const clearCache = async (): Promise<void> => {
  try {
    const db = await initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      tx.oncomplete = () => {
        console.log('[MediaCache] Image cache successfully cleared.');
        resolve();
      };

      tx.onerror = () => {
        console.error('[MediaCache] Error clearing cache:', tx.error);
        reject(tx.error);
      };
    });
  } catch (err) {
    console.error('[MediaCache] Failed to clear image cache:', err);
  }
};
