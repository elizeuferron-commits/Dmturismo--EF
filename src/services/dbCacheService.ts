import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, doc, onSnapshot, getDocs, setDoc, getDoc } from 'firebase/firestore';

const DB_NAME = 'dm_turismo_collections_cache_db';
const DB_VERSION = 4;
const STORES = {
  vehicles: 'vehicles_cache',
  employees: 'employees_cache',
  trips: 'trips_cache',
  generic: 'generic_collections_cache',
  documents: 'generic_documents_cache'
};

export class DBCacheService {
  private static instance: DBCacheService;
  private db: IDBDatabase | null = null;

  // In-memory cache for fast SWR delivery (0ms retrieval)
  private static readonly MAX_VEHICLES_CACHE_SIZE = 100;
  private vehicleAccessMap: Map<string, number> = new Map();
  private cachedVehiclesInMemory: any[] | null = null;
  private cachedEmployeesInMemory: any[] | null = null;
  private cachedTripsInMemory: any[] | null = null;
  private cachedUsersInMemory: any[] | null = null;
  private cachedGenericInMemory: Record<string, any[]> = {};
  private cachedDocumentsInMemory: Record<string, any> = {};
  private currentUserProfile: any | null = null;

  // Event listener registries for SWR subscriptions
  private vehiclesListeners: ((vehicles: any[]) => void)[] = [];
  private employeesListeners: ((employees: any[]) => void)[] = [];
  private tripsListeners: ((trips: any[]) => void)[] = [];
  private usersListeners: ((users: any[]) => void)[] = [];
  private genericListeners: Record<string, ((data: any[]) => void)[]> = {};
  private documentListeners: Record<string, ((data: any) => void)[]> = {};

  // Active firestore subscription unsubscribers
  private vehiclesUnsubscribe: (() => void) | null = null;
  private employeesUnsubscribe: (() => void) | null = null;
  private tripsUnsubscribe: (() => void) | null = null;
  private usersUnsubscribe: (() => void) | null = null;
  private genericUnsubscribes: Record<string, (() => void) | null> = {};
  private documentUnsubscribes: Record<string, (() => void) | null> = {};
  private profileUnsubscribe: (() => void) | null = null;
  private profileListeners: ((profile: any) => void)[] = [];

  private isQuotaExceeded = false;
  private lastQuotaExceededTime = 0;
  private QUOTA_COOLDOWN = 15 * 60 * 1000; // 15 minutes cooldown

  private constructor() {}

  private checkQuotaStatus(): boolean {
    if (this.isQuotaExceeded) {
      const now = Date.now();
      if (now - this.lastQuotaExceededTime > this.QUOTA_COOLDOWN) {
        console.log('[SWR] Quota cooldown expired. Attempting to resume network sync.');
        this.isQuotaExceeded = false;
        return false;
      }
      return true;
    }
    return false;
  }

  private setQuotaExceeded() {
    if (!this.isQuotaExceeded) {
      console.warn('[SWR] Quota limit detected. Entering resilient cache mode. Network sync paused for 15 mins.');
      this.isQuotaExceeded = true;
      this.lastQuotaExceededTime = Date.now();
    }
  }

  public static getInstance(): DBCacheService {
    if (!DBCacheService.instance) {
      DBCacheService.instance = new DBCacheService();
    }
    return DBCacheService.instance;
  }

  public subscribeCollection(collectionName: string, onUpdate: (data: any[]) => void): () => void {
    if (collectionName === 'users') return this.subscribeUsers(onUpdate);
    
    if (!this.genericListeners[collectionName]) {
      this.genericListeners[collectionName] = [];
    }
    this.genericListeners[collectionName].push(onUpdate);

    // Initial data from memory
    if (this.cachedGenericInMemory[collectionName]) {
      onUpdate(this.cachedGenericInMemory[collectionName]);
    } else {
      // Initial data from IndexedDB
      this.getCollectionFromCache(collectionName).then(data => {
        if (data && data.length > 0 && !this.cachedGenericInMemory[collectionName]) {
          this.cachedGenericInMemory[collectionName] = data;
          onUpdate(data);
        }
      });
    }

    // Initialize real-time SWR listener on first subscriber
    if (this.genericListeners[collectionName].length === 1 && !this.checkQuotaStatus()) {
      this.startGenericCollectionListener(collectionName);
    }

    return () => {
      this.genericListeners[collectionName] = this.genericListeners[collectionName].filter(l => l !== onUpdate);
      if (this.genericListeners[collectionName].length === 0 && this.genericUnsubscribes[collectionName]) {
        this.genericUnsubscribes[collectionName]!();
        delete this.genericUnsubscribes[collectionName];
      }
    };
  }

  private startGenericCollectionCollectionListener(collectionName: string) {
    // Legacy name for backward compatibility during refactor if needed, 
    // but we use the one below.
  }

  private async startGenericCollectionListener(collectionName: string) {
    try {
      const q = collection(db, collectionName);
      let firestoreQuery: any = q;
      
      // Apply limits for high volume collections to save quota
      if (['audit_logs', 'storage_backup_logs', 'checklists', 'financial_transactions', 'fuel_logs', 'trip_history'].includes(collectionName)) {
        const { query: fsQuery, orderBy, limit } = await import('firebase/firestore');
        const sortField = collectionName === 'checklists' ? 'date' : 
                          collectionName === 'financial_transactions' ? 'createdAt' :
                          'timestamp';
        firestoreQuery = fsQuery(q, orderBy(sortField, 'desc'), limit(150));
      }

      this.genericUnsubscribes[collectionName] = onSnapshot(firestoreQuery, (snapshot) => {
        const list = snapshot.docs.map(docSnapshot => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
        }));
        this.cachedGenericInMemory[collectionName] = list;
        this.saveCollectionToCache(collectionName, list).catch(err => console.error(err));
        
        // Trigger global sync event for UI feedback
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dmturismo_firestore_sync', { detail: { collection: collectionName } }));
        }
        
        this.notifyGenericSubscribers(collectionName, list);
      }, (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn(`[SWR] Quota exceeded for generic collection ${collectionName}. Switching to offline cache.`);
          return;
        }
        handleFirestoreError(error, OperationType.LIST, collectionName);
      });
    } catch (err) {
      console.error(`[SWR] Error starting generic collection listener for ${collectionName}:`, err);
    }
  }

  public subscribeDocument(path: string, onUpdate: (data: any) => void): () => void {
    if (path.startsWith('users/')) {
      const uid = path.split('/')[1];
      return this.subscribeUserProfile(uid, onUpdate);
    }
    
    if (!this.documentListeners[path]) {
      this.documentListeners[path] = [];
    }
    this.documentListeners[path].push(onUpdate);

    // Initial data from memory
    if (this.cachedDocumentsInMemory[path]) {
      onUpdate(this.cachedDocumentsInMemory[path]);
    } else {
      // Initial data from IndexedDB
      this.getDocumentFromCache(path).then(data => {
        if (data && !this.cachedDocumentsInMemory[path]) {
          this.cachedDocumentsInMemory[path] = data;
          onUpdate(data);
        }
      });
    }

    // Initialize real-time SWR listener on first subscriber
    if (this.documentListeners[path].length === 1 && !this.checkQuotaStatus()) {
      this.startDocumentListener(path);
    }

    return () => {
      this.documentListeners[path] = this.documentListeners[path].filter(l => l !== onUpdate);
      if (this.documentListeners[path].length === 0 && this.documentUnsubscribes[path]) {
        this.documentUnsubscribes[path]!();
        delete this.documentUnsubscribes[path];
      }
    };
  }

  private startDocumentListener(path: string) {
    try {
      const docRef = doc(db, path);
      this.documentUnsubscribes[path] = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = { id: snapshot.id, ...snapshot.data() };
          this.cachedDocumentsInMemory[path] = data;
          this.saveDocumentToCache(path, data).catch(err => console.error(err));
          
          // Trigger global sync event for UI feedback
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('dmturismo_firestore_sync', { detail: { document: path } }));
          }
          
          this.notifyDocumentSubscribers(path, data);
        }
      }, (error) => {
        // Silent catch for quota errors
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn(`[SWR] Quota exceeded for document ${path}. Staying in offline mode with cached data.`);
          return;
        }
        handleFirestoreError(error, OperationType.GET, path);
      });
    } catch (err) {
      console.error(`[SWR] Error starting document listener for ${path}:`, err);
    }
  }

  private notifyDocumentSubscribers(path: string, data: any) {
    const listeners = this.documentListeners[path];
    if (listeners) {
      listeners.forEach(l => {
        try { l(data); } catch (e) { console.error(e); }
      });
    }
  }

  public subscribeUserProfile(uid: string, onUpdate: (profile: any) => void): () => void {
    this.profileListeners.push(onUpdate);

    if (this.currentUserProfile && this.currentUserProfile.uid === uid) {
      onUpdate(this.currentUserProfile);
    } else {
      this.getDocumentFromCache(`users/${uid}`).then(cached => {
        if (cached && !this.currentUserProfile) {
          onUpdate(cached);
        }
      });
    }

    if (this.profileListeners.length === 1 && !this.checkQuotaStatus()) {
      this.startProfileListener(uid);
    }

    return () => {
      this.profileListeners = this.profileListeners.filter(l => l !== onUpdate);
      if (this.profileListeners.length === 0 && this.profileUnsubscribe) {
        this.profileUnsubscribe();
        this.profileUnsubscribe = null;
      }
    };
  }

  private startProfileListener(uid: string) {
    try {
      const docRef = doc(db, 'users', uid);
      this.profileUnsubscribe = onSnapshot(docRef, (snapshot) => {
        if (snapshot.exists()) {
          const data = { uid: snapshot.id, ...snapshot.data() };
          this.currentUserProfile = data;
          this.saveDocumentToCache(`users/${uid}`, data).catch(e => console.error(e));
          this.notifyProfileSubscribers(data);
        }
      }, (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn('[SWR] Quota excedida ao carregar perfil. Usando cache resiliente.');
          return;
        }
        console.error("Erro no listener de perfil:", error);
      });
    } catch (err) {
      console.error(err);
    }
  }

  private notifyProfileSubscribers(profile: any) {
    this.profileListeners.forEach(l => {
      try { l(profile); } catch (e) { console.error(e); }
    });
  }

  private async revalidateCollectionInBackground(collectionName: string) {
    if (this.checkQuotaStatus()) return;
    try {
      const q = collection(db, collectionName);
      // For some collections we might want to limit to save quota even more
      let firestoreQuery = q;
      if (['fuel_logs', 'financial_transactions', 'fuel_entries', 'users', 'storage_backup_logs', 'checklists', 'audit_logs'].includes(collectionName)) {
        // These are high volume, limit to last 200 items for cache
        const { query, orderBy, limit } = await import('firebase/firestore');
        const sortField = collectionName === 'financial_transactions' ? 'createdAt' : 
                          collectionName === 'users' ? 'displayName' : 
                          collectionName === 'checklists' ? 'date' : 'timestamp';
        firestoreQuery = query(q, orderBy(sortField, 'desc'), limit(200)) as any;
      }

      const querySnapshot = await getDocs(firestoreQuery);
      const dataList = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      const current = this.cachedGenericInMemory[collectionName] || await this.getCollectionFromCache(collectionName);
      if (!isListEqual(current, dataList)) {
        this.cachedGenericInMemory[collectionName] = dataList;
        await this.saveCollectionToCache(collectionName, dataList);
        this.notifyGenericSubscribers(collectionName, dataList);
      }
    } catch (err) {
      // Silent catch for quota errors in background revalidation
      const errStr = (err as Error)?.message || '';
      if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
        this.setQuotaExceeded();
        console.warn(`[SWR] Quota exceeded during revalidation of ${collectionName}. Using stale cache.`);
        return;
      }
      console.warn(`[SWR] Revalidation error for ${collectionName}:`, err);
    }
  }

  public async removeDocumentFromCollection(collectionName: string, docId: string) {
    if (this.cachedGenericInMemory[collectionName]) {
      const updated = this.cachedGenericInMemory[collectionName].filter(item => item && item.id !== docId);
      this.cachedGenericInMemory[collectionName] = updated;
      await this.saveCollectionToCache(collectionName, updated).catch(err => console.error(err));
      this.notifyGenericSubscribers(collectionName, updated);
    }
  }

  private notifyGenericSubscribers(collectionName: string, data: any[]) {
    const listeners = this.genericListeners[collectionName];
    if (listeners) {
      listeners.forEach(l => {
        try { l(data); } catch (e) { console.error(e); }
      });
    }
  }

  private initDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      if (typeof window === 'undefined' || !window.indexedDB) {
        reject(new Error('IndexedDB not supported in this environment'));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORES.vehicles)) {
          database.createObjectStore(STORES.vehicles);
        }
        if (!database.objectStoreNames.contains(STORES.employees)) {
          database.createObjectStore(STORES.employees);
        }
        if (!database.objectStoreNames.contains(STORES.trips)) {
          database.createObjectStore(STORES.trips);
        }
        if (!database.objectStoreNames.contains(STORES.generic)) {
          database.createObjectStore(STORES.generic);
        }
        if (!database.objectStoreNames.contains(STORES.documents)) {
          database.createObjectStore(STORES.documents);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        console.error('Erro ao abrir IndexedDB de cache local:', request.error);
        reject(request.error);
      };
    });
  }

  // --- VEHICLES CACHE (SWR DESIGN WITH LRU PERSISTENCE LAYER) ---

  /**
   * Aplica ordenação LRU (Least Recently Used) e limita o número máximo de veículos no cache a 100 itens.
   */
  private applyVehicleLRU(vehicles: any[]): any[] {
    if (!vehicles || !Array.isArray(vehicles)) return [];

    const now = Date.now();
    const mapped = vehicles.map(v => {
      if (!v || typeof v !== 'object') return v;
      const id = v.id || v.plate;
      let lastAccessedAt = v._lastAccessedAt || (id ? this.vehicleAccessMap.get(id) : undefined);
      if (!lastAccessedAt) {
        lastAccessedAt = now;
      }
      if (id) {
        this.vehicleAccessMap.set(id, lastAccessedAt);
      }
      return {
        ...v,
        _lastAccessedAt: lastAccessedAt
      };
    });

    // Ordena do acesso mais recente para o mais antigo (LRU)
    mapped.sort((a, b) => (b._lastAccessedAt || 0) - (a._lastAccessedAt || 0));

    // Aplica o limite maximo de 100 veiculos
    if (mapped.length > DBCacheService.MAX_VEHICLES_CACHE_SIZE) {
      console.log(`[LRU Cache] Camada LRU aplicou limite de ${DBCacheService.MAX_VEHICLES_CACHE_SIZE} itens no cache de veículos (total retornado: ${mapped.length}).`);
      return mapped.slice(0, DBCacheService.MAX_VEHICLES_CACHE_SIZE);
    }

    return mapped;
  }

  /**
   * Atualiza o timestamp de acesso recente de um veículo no cache LRU
   */
  public touchVehicle(vehicleId: string): void {
    if (!vehicleId) return;
    const now = Date.now();
    this.vehicleAccessMap.set(vehicleId, now);

    if (this.cachedVehiclesInMemory) {
      const idx = this.cachedVehiclesInMemory.findIndex(v => v.id === vehicleId || v.plate === vehicleId);
      if (idx !== -1) {
        this.cachedVehiclesInMemory[idx]._lastAccessedAt = now;
        const updated = this.applyVehicleLRU(this.cachedVehiclesInMemory);
        this.cachedVehiclesInMemory = updated;
        this.saveVehicles(updated).catch(err => console.error('[LRU Touch Error]:', err));
      }
    }
  }

  /**
   * Obtém veículo do cache local e atualiza seu acesso na camada LRU
   */
  public getVehicleFromCache(vehicleId: string): any | null {
    if (!vehicleId || !this.cachedVehiclesInMemory) return null;
    const vehicle = this.cachedVehiclesInMemory.find(v => v.id === vehicleId || v.plate === vehicleId);
    if (vehicle) {
      this.touchVehicle(vehicleId);
      return vehicle;
    }
    return null;
  }

  /**
   * Retorna métricas e estatísticas da camada LRU do cache de veículos
   */
  public getVehiclesLRUStats(): {
    totalInMemory: number;
    maxLimit: number;
    oldestAccessedAt: number | null;
    newestAccessedAt: number | null;
  } {
    const list = this.cachedVehiclesInMemory || [];
    if (list.length === 0) {
      return { totalInMemory: 0, maxLimit: DBCacheService.MAX_VEHICLES_CACHE_SIZE, oldestAccessedAt: null, newestAccessedAt: null };
    }
    const timestamps = list.map(v => v._lastAccessedAt || 0).filter(t => t > 0);
    return {
      totalInMemory: list.length,
      maxLimit: DBCacheService.MAX_VEHICLES_CACHE_SIZE,
      oldestAccessedAt: timestamps.length > 0 ? Math.min(...timestamps) : null,
      newestAccessedAt: timestamps.length > 0 ? Math.max(...timestamps) : null
    };
  }

  public async getVehiclesFromCacheOnly(): Promise<any[]> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.vehicles], 'readonly');
        const store = transaction.objectStore(STORES.vehicles);
        const request = store.get('list');

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve([]);
            return;
          }

          if (Array.isArray(result)) {
            const lruList = this.applyVehicleLRU(result);
            resolve(lruList);
            return;
          }

          const { data, timestamp } = result;
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (timestamp && (Date.now() - timestamp > sevenDaysMs)) {
            console.log('[Cache TTL] Cache de veículos expirou (mais de 7 dias). Limpando...');
            this.clearStore(STORES.vehicles).catch(err => console.error(err));
            resolve([]);
          } else {
            const lruList = this.applyVehicleLRU(data || []);
            resolve(lruList);
          }
        };

        request.onerror = () => {
          console.error('Erro ao ler veículos do cache IndexedDB:', request.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  public async getVehicles(): Promise<any[]> {
    // Background revalidation
    if (!this.checkQuotaStatus()) {
      this.revalidateVehiclesInBackground().catch(err => console.error('[SWR] Vehicles background revalidation error:', err));
    }

    // Instant return of in-memory cache if available
    if (this.cachedVehiclesInMemory && this.cachedVehiclesInMemory.length > 0) {
      return this.cachedVehiclesInMemory;
    }

    // Instant return of IndexedDB cache
    const cached = await this.getVehiclesFromCacheOnly();
    if (cached && cached.length > 0) {
      this.cachedVehiclesInMemory = cached;
    }
    return cached;
  }

  public async saveVehicles(vehicles: any[]): Promise<void> {
    try {
      const lruVehicles = this.applyVehicleLRU(vehicles);
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.vehicles], 'readwrite');
        const store = transaction.objectStore(STORES.vehicles);
        const request = store.put({
          data: lruVehicles,
          timestamp: Date.now()
        }, 'list');

        request.onsuccess = () => {
          this.cachedVehiclesInMemory = lruVehicles;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao salvar veículos no cache IndexedDB com LRU:', e);
    }
  }

  private async revalidateVehiclesInBackground() {
    try {
      const q = collection(db, 'vehicles');
      const querySnapshot = await getDocs(q);
      const vehiclesList = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      const current = this.cachedVehiclesInMemory || await this.getVehiclesFromCacheOnly();
      const lruList = this.applyVehicleLRU(vehiclesList);
      if (!isListEqual(current, lruList)) {
        console.log('[SWR] Mudanças reais detectadas em veículos no Firestore em segundo plano. Sincronizando com camada LRU...');
        this.cachedVehiclesInMemory = lruList;
        await this.saveVehicles(lruList);
        this.notifyVehiclesSubscribers(lruList);
      }
    } catch (err) {
      const errStr = (err as Error)?.message || '';
      if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
        this.setQuotaExceeded();
        console.warn('[SWR] Quota excedida ao revalidar veículos. Usando cache LRU.');
        return;
      }
      console.warn('[SWR] Falha ao revalidar veículos em segundo plano:', err);
    }
  }

  public subscribeVehicles(onUpdate: (vehicles: any[]) => void): () => void {
    this.vehiclesListeners.push(onUpdate);

    // Yield stale data instantly from memory or IndexedDB
    if (this.cachedVehiclesInMemory) {
      onUpdate(this.cachedVehiclesInMemory);
    } else {
      this.getVehiclesFromCacheOnly()
        .then((vehicles) => {
          if (vehicles && vehicles.length > 0 && !this.cachedVehiclesInMemory) {
            this.cachedVehiclesInMemory = vehicles;
            onUpdate(vehicles);
          }
        })
        .catch(err => console.warn('[dbCache] Vehicles cache fetch failed:', err));
    }

    // Initialize real-time SWR listener on first subscriber
    if (this.vehiclesListeners.length === 1 && !this.checkQuotaStatus()) {
      this.startVehiclesListener();
    }

    return () => {
      this.vehiclesListeners = this.vehiclesListeners.filter((listener) => listener !== onUpdate);
      if (this.vehiclesListeners.length === 0 && this.vehiclesUnsubscribe) {
        this.vehiclesUnsubscribe();
        this.vehiclesUnsubscribe = null;
      }
    };
  }

  private startVehiclesListener() {
    try {
      const q = collection(db, 'vehicles');
      this.vehiclesUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[SWR] Atualizações em tempo real detectadas para veículos no Firestore.');
        const lruList = this.applyVehicleLRU(list);
        this.cachedVehiclesInMemory = lruList;
        this.saveVehicles(lruList).catch(err => console.error(err));
        
        // Trigger global sync event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dmturismo_firestore_sync', { detail: { collection: 'vehicles' } }));
        }
        
        this.notifyVehiclesSubscribers(lruList);
      }, (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn('[SWR] Quota excedida no listener de veículos. Mantendo modo offline.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'vehicles');
      });
    } catch (err) {
      console.error('[SWR] Erro ao iniciar escuta de veículos:', err);
    }
  }

  private notifyVehiclesSubscribers(vehicles: any[]) {
    this.vehiclesListeners.forEach((listener) => {
      try {
        listener(vehicles);
      } catch (err) {
        console.error('[SWR] Erro ao notificar assinante de veículos:', err);
      }
    });
  }

  // --- EMPLOYEES CACHE (SWR DESIGN) ---

  public async getEmployeesFromCacheOnly(): Promise<any[]> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.employees], 'readonly');
        const store = transaction.objectStore(STORES.employees);
        const request = store.get('list');

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve([]);
            return;
          }

          if (Array.isArray(result)) {
            resolve(result);
            return;
          }

          const { data, timestamp } = result;
          const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
          if (timestamp && (Date.now() - timestamp > sevenDaysMs)) {
            console.log('[Cache TTL] Cache de funcionários expirou (mais de 7 dias). Limpando...');
            this.clearStore(STORES.employees).catch(err => console.error(err));
            resolve([]);
          } else {
            resolve(data || []);
          }
        };

        request.onerror = () => {
          console.error('Erro ao ler funcionários do cache IndexedDB:', request.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  public async getEmployees(): Promise<any[]> {
    // Background revalidation
    if (!this.checkQuotaStatus()) {
      this.revalidateEmployeesInBackground().catch(err => console.error('[SWR] Employees background revalidation error:', err));
    }

    // Instant return of in-memory cache if available
    if (this.cachedEmployeesInMemory && this.cachedEmployeesInMemory.length > 0) {
      return this.cachedEmployeesInMemory;
    }

    // Instant return of IndexedDB cache
    const cached = await this.getEmployeesFromCacheOnly();
    if (cached && cached.length > 0) {
      this.cachedEmployeesInMemory = cached;
    }
    return cached;
  }

  public async saveEmployees(employees: any[]): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.employees], 'readwrite');
        const store = transaction.objectStore(STORES.employees);
        const request = store.put({
          data: employees,
          timestamp: Date.now()
        }, 'list');

        request.onsuccess = () => {
          this.cachedEmployeesInMemory = employees;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao salvar funcionários no cache IndexedDB:', e);
    }
  }

  private async revalidateEmployeesInBackground() {
    try {
      const q = collection(db, 'employees');
      const querySnapshot = await getDocs(q);
      const employeesList = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      const current = this.cachedEmployeesInMemory || await this.getEmployeesFromCacheOnly();
      if (!isListEqual(current, employeesList)) {
        console.log('[SWR] Mudanças reais detectadas em funcionários no Firestore em segundo plano. Sincronizando...');
        this.cachedEmployeesInMemory = employeesList;
        await this.saveEmployees(employeesList);
        this.notifyEmployeesSubscribers(employeesList);
      }
    } catch (err) {
      const errStr = (err as Error)?.message || '';
      if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
        this.setQuotaExceeded();
        console.warn('[SWR] Quota excedida ao revalidar funcionários. Usando cache.');
        return;
      }
      console.warn('[SWR] Falha ao revalidar funcionários em segundo plano:', err);
    }
  }

  public subscribeEmployees(onUpdate: (employees: any[]) => void): () => void {
    this.employeesListeners.push(onUpdate);

    // Yield stale data instantly from memory or IndexedDB
    if (this.cachedEmployeesInMemory) {
      onUpdate(this.cachedEmployeesInMemory);
    } else {
      this.getEmployeesFromCacheOnly()
        .then((employees) => {
          if (employees && employees.length > 0 && !this.cachedEmployeesInMemory) {
            this.cachedEmployeesInMemory = employees;
            onUpdate(employees);
          }
        })
        .catch(err => console.warn('[dbCache] Employees cache fetch failed:', err));
    }

    // Initialize real-time SWR listener on first subscriber
    if (this.employeesListeners.length === 1 && !this.checkQuotaStatus()) {
      this.startEmployeesListener();
    }

    return () => {
      this.employeesListeners = this.employeesListeners.filter((listener) => listener !== onUpdate);
      if (this.employeesListeners.length === 0 && this.employeesUnsubscribe) {
        this.employeesUnsubscribe();
        this.employeesUnsubscribe = null;
      }
    };
  }

  private startEmployeesListener() {
    try {
      const q = collection(db, 'employees');
      this.employeesUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        console.log('[SWR] Atualizações em tempo real detectadas para funcionários no Firestore.');
        this.cachedEmployeesInMemory = list;
        this.saveEmployees(list).catch(err => console.error(err));
        
        // Trigger global sync event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dmturismo_firestore_sync', { detail: { collection: 'employees' } }));
        }
        
        this.notifyEmployeesSubscribers(list);
      }, (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn('[SWR] Quota excedida no listener de funcionários. Mantendo modo offline.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'employees');
      });
    } catch (err) {
      console.error('[SWR] Erro ao iniciar escuta de funcionários:', err);
    }
  }

  private notifyEmployeesSubscribers(employees: any[]) {
    this.employeesListeners.forEach((listener) => {
      try {
        listener(employees);
      } catch (err) {
        console.error('[SWR] Erro ao notificar assinante de funcionários:', err);
      }
    });
  }

  public async clearStore(storeName: string): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete('list');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Erro ao limpar loja de cache ${storeName}:`, e);
    }
  }

  // --- TRIPS CACHE AND INTELLIGENT INVALIDATION ---

  public async getTripsFromCacheOnly(): Promise<any[]> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.trips], 'readonly');
        const store = transaction.objectStore(STORES.trips);
        const request = store.get('list');

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve([]);
            return;
          }

          if (Array.isArray(result)) {
            resolve(result);
            return;
          }

          const { data } = result;
          resolve(data || []);
        };

        request.onerror = () => {
          console.error('Erro ao ler viagens do cache IndexedDB:', request.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  public async getTrips(): Promise<any[]> {
    // Background SWR revalidation
    if (!this.checkQuotaStatus()) {
      this.revalidateTripsInBackground().catch(err => console.error('[SWR] Trips background revalidation error:', err));
    }

    if (this.cachedTripsInMemory && this.cachedTripsInMemory.length > 0) {
      return this.cachedTripsInMemory;
    }
    const cached = await this.getTripsFromCacheOnly();
    if (cached && cached.length > 0) {
      this.cachedTripsInMemory = cached;
    }
    return cached;
  }

  public async saveTrips(trips: any[]): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([STORES.trips], 'readwrite');
        const store = transaction.objectStore(STORES.trips);
        const request = store.put({
          data: trips,
          timestamp: Date.now()
        }, 'list');

        request.onsuccess = () => {
          this.cachedTripsInMemory = trips;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao salvar viagens no cache IndexedDB:', e);
    }
  }

  public async saveTripsAndNotify(trips: any[]): Promise<void> {
    this.cachedTripsInMemory = trips;
    await this.saveTrips(trips);
    this.notifyTripsSubscribers(trips);
  }

  public async getTripsMetadata(): Promise<{ lastChangedAt: string } | null> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.trips], 'readonly');
        const store = transaction.objectStore(STORES.trips);
        const request = store.get('metadata');

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          resolve(null);
        };
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async saveTripsMetadata(metadata: { lastChangedAt: string }): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise<void>((resolve, reject) => {
        const transaction = database.transaction([STORES.trips], 'readwrite');
        const store = transaction.objectStore(STORES.trips);
        const request = store.put(metadata, 'metadata');

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error('Erro ao salvar metadados de viagens no cache IndexedDB:', e);
    }
  }

  public subscribeTrips(onUpdate: (trips: any[]) => void): () => void {
    this.tripsListeners.push(onUpdate);

    if (this.cachedTripsInMemory) {
      onUpdate(this.cachedTripsInMemory);
    } else {
      this.getTripsFromCacheOnly()
        .then((trips) => {
          if (trips && trips.length > 0 && !this.cachedTripsInMemory) {
            this.cachedTripsInMemory = trips;
            onUpdate(trips);
          }
        })
        .catch(err => console.warn('[dbCache] Trips cache fetch failed:', err));
    }

    if (this.tripsListeners.length === 1 && !this.checkQuotaStatus()) {
      this.startTripsMetadataListener();
    }

    return () => {
      this.tripsListeners = this.tripsListeners.filter((listener) => listener !== onUpdate);
      if (this.tripsListeners.length === 0 && this.tripsUnsubscribe) {
        this.tripsUnsubscribe();
        this.tripsUnsubscribe = null;
      }
    };
  }

  private async startTripsMetadataListener() {
    try {
      const metaRef = doc(db, 'settings', 'trips_metadata');
      
      this.tripsUnsubscribe = onSnapshot(metaRef, async (snapshot) => {
        let serverLastChangedAt = '';
        if (snapshot.exists()) {
          serverLastChangedAt = snapshot.data().lastChangedAt || '';
        }

        const localMeta = await this.getTripsMetadata();
        const localLastChangedAt = localMeta ? localMeta.lastChangedAt : '';

        if (!serverLastChangedAt || serverLastChangedAt !== localLastChangedAt || !this.cachedTripsInMemory || this.cachedTripsInMemory.length === 0) {
          console.log('[Cache trips] Invalidação inteligente! Mudança real detetada no Firestore. Carregando dados atualizados...');
          await this.refreshTripsFromServer(serverLastChangedAt);
        } else {
          console.log('[Cache trips] Cache validado! Nenhum tráfego de rede gerado para a coleção trips.');
        }
      }, async (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn('[SWR] Quota excedida no listener de trips_metadata. Mantendo cache atual.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'trips_metadata');
      });
    } catch (err) {
      console.error('[Cache trips] Erro ao iniciar listener de metadados:', err);
    }
  }

  private async revalidateTripsInBackground() {
    if (this.checkQuotaStatus()) return;
    try {
      const metaRef = doc(db, 'settings', 'trips_metadata');
      const snapshot = await getDoc(metaRef);
      
      let serverLastChangedAt = '';
      if (snapshot.exists()) {
        serverLastChangedAt = snapshot.data().lastChangedAt || '';
      }

      const localMeta = await this.getTripsMetadata();
      const localLastChangedAt = localMeta ? localMeta.lastChangedAt : '';

      if (!serverLastChangedAt || serverLastChangedAt !== localLastChangedAt || !this.cachedTripsInMemory || this.cachedTripsInMemory.length === 0) {
        console.log('[SWR] Background revalidation: Trips lastChangedAt updated or cache empty.');
        await this.refreshTripsFromServer(serverLastChangedAt);
      }
    } catch (err) {
      console.warn('[SWR] Trips background revalidation failed:', err);
    }
  }

  public async refreshTripsFromServer(serverLastChangedAt?: string) {
    if (this.checkQuotaStatus()) return;
    try {
      const q = collection(db, 'trips');
      const querySnapshot = await getDocs(q);
      const tripsList = querySnapshot.docs.map(docSnapshot => ({
        id: docSnapshot.id,
        ...docSnapshot.data()
      }));

      let currentTrips = this.cachedTripsInMemory;
      if (!currentTrips) {
        currentTrips = await this.getTripsFromCacheOnly();
      }

      const isEqual = isListEqual(currentTrips || [], tripsList);

      if (!isEqual || !this.cachedTripsInMemory) {
        console.log('[Cache trips] Mudanças críticas detectadas nas viagens. Atualizando IndexedDB e notificando assinantes.');
        this.cachedTripsInMemory = tripsList;
        await this.saveTrips(tripsList);
        this.notifyTripsSubscribers(tripsList);
        
        // Trigger global sync event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('dmturismo_firestore_sync', { detail: { collection: 'trips' } }));
        }
      } else {
        console.log('[Cache trips] Cache validado: alterações triviais ou inexistentes. Ignorando IndexedDB/UI updates.');
      }
      
      let timestampToSave = serverLastChangedAt;
      if (!timestampToSave) {
        timestampToSave = new Date().toISOString();
        await this.touchTripsMetadata(timestampToSave);
      }

      await this.saveTripsMetadata({ lastChangedAt: timestampToSave });
    } catch (error) {
      console.error('[Cache trips] Erro ao buscar viagens do Firestore:', error);
    }
  }

  private notifyTripsSubscribers(trips: any[]) {
    this.tripsListeners.forEach((listener) => {
      try {
        listener(trips);
      } catch (err) {
        console.error('[Cache trips] Erro ao notificar assinante:', err);
      }
    });
  }

  public async touchTripsMetadata(forcedTimestamp?: string): Promise<void> {
    try {
      const metaRef = doc(db, 'settings', 'trips_metadata');
      await setDoc(metaRef, {
        lastChangedAt: forcedTimestamp || new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('[Cache Metadata] Erro ao atualizar metadados de trips:', err);
    }
  }

  // --- GENERIC COLLECTION CACHE (For scalable offline performance) ---

  public async getCollectionFromCache(storeName: string): Promise<any[]> {
    if (storeName === 'users') return this.getUsersFromCacheOnly();
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.generic], 'readonly');
        const store = transaction.objectStore(STORES.generic);
        const request = store.get(storeName);

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve([]);
            return;
          }
          const { data, timestamp } = result;
          // Clean cached items older than 30 days
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          if (timestamp && (Date.now() - timestamp > thirtyDaysMs)) {
            console.log(`[Cache TTL] Cache da coleção ${storeName} expirou. Limpando...`);
            this.clearGenericCache(storeName).catch(err => console.error(err));
            resolve([]);
          } else {
            resolve(data || []);
          }
        };

        request.onerror = () => {
          console.error(`Erro ao ler ${storeName} do cache IndexedDB:`, request.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  // --- DOCUMENT CACHE (Generic) ---

  public async getDocumentFromCache(path: string): Promise<any | null> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.documents], 'readonly');
        const store = transaction.objectStore(STORES.documents);
        const request = store.get(path);

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve(null);
            return;
          }
          const { data } = result;
          resolve(data || null);
        };

        request.onerror = () => {
          console.error(`Erro ao ler documento ${path} do cache IndexedDB:`, request.error);
          resolve(null);
        };
      });
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  public async saveDocumentToCache(path: string, data: any): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.documents], 'readwrite');
        const store = transaction.objectStore(STORES.documents);
        const request = store.put({
          data,
          timestamp: Date.now()
        }, path);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Erro ao salvar documento ${path} no cache IndexedDB:`, e);
    }
  }

  // --- USERS CACHE (SWR DESIGN) ---

  public async getUsersFromCacheOnly(): Promise<any[]> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve) => {
        const transaction = database.transaction([STORES.generic], 'readonly');
        const store = transaction.objectStore(STORES.generic);
        const request = store.get('users');

        request.onsuccess = () => {
          const result = request.result;
          if (!result) {
            resolve([]);
            return;
          }
          const { data } = result;
          resolve(data || []);
        };

        request.onerror = () => {
          console.error('Erro ao ler usuários do cache IndexedDB:', request.error);
          resolve([]);
        };
      });
    } catch (e) {
      console.error(e);
      return [];
    }
  }

  public async saveUsers(users: any[]): Promise<void> {
    await this.saveCollectionToCache('users', users);
  }

  public subscribeUsers(onUpdate: (users: any[]) => void): () => void {
    this.usersListeners.push(onUpdate);

    if (this.cachedUsersInMemory) {
      onUpdate(this.cachedUsersInMemory);
    } else {
      this.getUsersFromCacheOnly()
        .then((users) => {
          if (users && users.length > 0 && !this.cachedUsersInMemory) {
            this.cachedUsersInMemory = users;
            onUpdate(users);
          }
        })
        .catch(err => console.warn('[dbCache] Users cache fetch failed:', err));
    }

    if (this.usersListeners.length === 1 && !this.checkQuotaStatus()) {
      this.startUsersListener();
    }

    return () => {
      this.usersListeners = this.usersListeners.filter((listener) => listener !== onUpdate);
      if (this.usersListeners.length === 0 && this.usersUnsubscribe) {
        this.usersUnsubscribe();
        this.usersUnsubscribe = null;
      }
    };
  }

  private startUsersListener() {
    try {
      const q = collection(db, 'users');
      this.usersUnsubscribe = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map(d => ({ uid: d.id, ...d.data() }));
        console.log('[SWR] Atualizações em tempo real detectadas para usuários no Firestore.');
        this.cachedUsersInMemory = list;
        this.saveUsers(list).catch(err => console.error(err));
        this.notifyUsersSubscribers(list);
      }, (error) => {
        const errStr = error?.message || '';
        if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
          this.setQuotaExceeded();
          console.warn('[SWR] Quota excedida no listener de usuários. Mantendo cache offline.');
          return;
        }
        handleFirestoreError(error, OperationType.LIST, 'users');
      });
    } catch (err) {
      console.error('[SWR] Erro ao iniciar escuta de usuários:', err);
    }
  }

  private notifyUsersSubscribers(users: any[]) {
    this.usersListeners.forEach((listener) => {
      try {
        listener(users);
      } catch (err) {
        console.error('[SWR] Erro ao notificar assinante de usuários:', err);
      }
    });
  }

  public async saveCollectionToCache(storeName: string, data: any[]): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.generic], 'readwrite');
        const store = transaction.objectStore(STORES.generic);
        const request = store.put({
          data,
          timestamp: Date.now()
        }, storeName);

        request.onsuccess = () => {
          this.cachedGenericInMemory[storeName] = data;
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Erro ao salvar ${storeName} no cache IndexedDB:`, e);
    }
  }

  private async clearGenericCache(storeName: string): Promise<void> {
    try {
      const database = await this.initDatabase();
      return new Promise((resolve, reject) => {
        const transaction = database.transaction([STORES.generic], 'readwrite');
        const store = transaction.objectStore(STORES.generic);
        const request = store.delete(storeName);
        request.onsuccess = () => {
          delete this.cachedGenericInMemory[storeName];
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error(`Erro ao limpar ${storeName} do cache IndexedDB:`, e);
    }
  }

  public async clearAllCacheStores(): Promise<void> {
    this.cachedVehiclesInMemory = null;
    this.vehicleAccessMap.clear();
    this.cachedEmployeesInMemory = null;
    this.cachedTripsInMemory = null;
    this.cachedGenericInMemory = {};

    try {
      if (typeof window !== 'undefined' && window.indexedDB) {
        const database = await this.initDatabase();
        const storeNames = [STORES.vehicles, STORES.employees, STORES.trips, STORES.generic, STORES.documents];
        const transaction = database.transaction(storeNames, 'readwrite');
        storeNames.forEach(storeName => {
          try {
            transaction.objectStore(storeName).clear();
          } catch (e) {
            console.warn(`Erro ao limpar loja ${storeName}:`, e);
          }
        });
      }
    } catch (e) {
      console.warn('Erro ao limpar lojas IndexedDB:', e);
    }
  }
}

/**
 * Funcao global para limpar todo o cache da aplicacao (IndexedDB, LocalStorage, CacheStorage, Service Worker)
 */
export async function clearFullAppCache(): Promise<void> {
  console.log('[DM Cache] Iniciando limpeza total de cache...');
  
  // 1. Limpar IndexedDB Cache de Colecoes
  try {
    await DBCacheService.getInstance().clearAllCacheStores();
  } catch (e) {
    console.warn('Erro ao limpar IndexedDB collections:', e);
  }

  // 2. Limpar Cache do Media Hub
  try {
    if (typeof window !== 'undefined' && window.indexedDB) {
      window.indexedDB.deleteDatabase('DMImageCacheDB');
    }
  } catch (e) {
    console.warn('Erro ao deletar DB de imagens:', e);
  }

  // 3. Limpar localStorage de chaves da DM Turismo
  try {
    if (typeof window !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('dmturismo_') || key.startsWith('dm_') || key.includes('cache'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    }
  } catch (e) {
    console.warn('Erro ao limpar LocalStorage:', e);
  }

  // 4. Limpar Caches API (CacheStorage)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    }
  } catch (e) {
    console.warn('Erro ao limpar CacheStorage:', e);
  }

  // 5. Atualizar ou Unregister Service Workers se necessário
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const registration of registrations) {
        await registration.unregister();
      }
    }
  } catch (e) {
    console.warn('Erro ao cancelar registro do Service Worker:', e);
  }

  console.log('[DM Cache] Limpeza de cache concluida com sucesso!');
}

// Registrar helper global no window para facilitar invocação no console ou ferramentas de teste
if (typeof window !== 'undefined') {
  (window as any).clearAppCache = clearFullAppCache;
}

// Deep Comparison Helpers

export function isListEqual(list1: any[], list2: any[]): boolean {
  if (!list1 || !list2) return false;
  if (list1.length !== list2.length) return false;
  
  const map1 = new Map(list1.map(item => [item.id, item]));
  
  for (const item2 of list2) {
    const item1 = map1.get(item2.id);
    if (!item1) return false;
    
    if (!isDeepEqual(item1, item2)) return false;
  }
  
  return true;
}

function isDeepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;
  if (typeof obj1 !== 'object' || obj1 === null || typeof obj2 !== 'object' || obj2 === null) {
    return false;
  }
  
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    
    const val1 = obj1[key];
    const val2 = obj2[key];
    
    const isObjects = typeof val1 === 'object' && val1 !== null && typeof val2 === 'object' && val2 !== null;
    if (isObjects) {
      if (!isDeepEqual(val1, val2)) return false;
    } else if (val1 !== val2) {
      return false;
    }
  }
  return true;
}

// Backward Compatibility Helpers

export function areTripsCriticallyEqual(t1: any, t2: any): boolean {
  return isDeepEqual(t1, t2);
}

export function areTripListsCriticallyEqual(list1: any[], list2: any[]): boolean {
  return isListEqual(list1, list2);
}

export const dbCacheService = DBCacheService.getInstance();

