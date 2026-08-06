import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { CharteredRoute } from '../components/charter/CharterTypes';
import { toast } from 'sonner';

const DB_NAME = 'dm_charter_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'pending_charter_routes';

export interface PendingRouteItem {
  id: string; // Temporary ID (e.g. offline_xxx)
  routeData: Omit<CharteredRoute, 'id'> & { createdAt?: any };
  timestamp: string;
}

export class CharterIndexedDBService {
  private static instance: CharterIndexedDBService;
  private db: IDBDatabase | null = null;
  private isSyncing = false;

  private constructor() {
    this.initDatabase();
    this.setupNetworkObserver();
  }

  public static getInstance(): CharterIndexedDBService {
    if (!CharterIndexedDBService.instance) {
      CharterIndexedDBService.instance = new CharterIndexedDBService();
    }
    return CharterIndexedDBService.instance;
  }

  private initDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const database = request.result;
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onerror = () => {
        console.error('Erro ao abrir IndexedDB de fretamento offline:', request.error);
        reject(request.error);
      };
    });
  }

  private setupNetworkObserver() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', async () => {
        console.log('Fretamento Offline: Detetado retorno de conexão. Iniciando sincronização automática...');
        await this.syncOfflineRoutes();
      });
    }
  }

  /**
   * Saves a new charter route to the local IndexedDB queue
   */
  public async saveOfflineRoute(routeData: Omit<CharteredRoute, 'id'>): Promise<string> {
    const database = await this.initDatabase();
    const tempId = `offline_route_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      const newItem: PendingRouteItem = {
        id: tempId,
        routeData,
        timestamp: new Date().toISOString()
      };

      const request = store.add(newItem);

      request.onsuccess = () => {
        // Dispatch local event to update UI components
        this.dispatchQueueChangedEvent();
        resolve(tempId);
      };

      request.onerror = () => {
        console.error('Erro ao salvar rota de fretamento no IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Retrieves all pending offline routes from the queue
   */
  public async getPendingRoutes(): Promise<PendingRouteItem[]> {
    const database = await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        console.error('Erro ao listar rotas offline do IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Deletes a route from the IndexedDB queue
   */
  public async deletePendingRoute(id: string): Promise<void> {
    const database = await this.initDatabase();

    return new Promise((resolve, reject) => {
      const transaction = database.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => {
        this.dispatchQueueChangedEvent();
        resolve();
      };

      request.onerror = () => {
        console.error('Erro ao deletar rota offline do IndexedDB:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Synchronizes all offline routes to Firestore
   */
  public async syncOfflineRoutes(): Promise<{ success: number; failed: number }> {
    if (this.isSyncing) return { success: 0, failed: 0 };
    
    const pending = await this.getPendingRoutes();
    if (pending.length === 0) return { success: 0, failed: 0 };

    this.isSyncing = true;
    const toastId = toast.loading(`Sincronizando ${pending.length} nova(s) rota(s) de fretamento offline para o servidor...`);
    
    let successCount = 0;
    let failedCount = 0;

    for (const item of pending) {
      try {
        // Create in Firestore
        await addDoc(collection(db, 'chartered_routes'), {
          ...item.routeData,
          createdAt: serverTimestamp(),
          status: item.routeData.status || 'active',
          runState: item.routeData.runState || 'idle'
        });

        // Add to successful sync log
        try {
          const syncHistory = JSON.parse(localStorage.getItem('dm_offline_sync_log_history') || '[]');
          if (!syncHistory.some((l: any) => l.id === item.id)) {
            syncHistory.unshift({
              id: item.id,
              type: 'charter_route',
              queuedTimestamp: item.timestamp,
              syncedTimestamp: new Date().toISOString(),
              summary: `Rota Fretamento: ${item.routeData.client || 'Sem Cliente'} - ${item.routeData.passengerCount || 0} passageiros`
            });
            localStorage.setItem('dm_offline_sync_log_history', JSON.stringify(syncHistory.slice(0, 20)));
            window.dispatchEvent(new CustomEvent('offline-sync-log-changed', { detail: syncHistory.slice(0, 20) }));
          }
        } catch (e) {
          console.error('Error logging successfully synced route:', e);
        }

        // Delete from IndexedDB upon successful upload
        await this.deletePendingRoute(item.id);
        successCount++;
      } catch (err: any) {
        console.error(`Erro ao sincronizar rota offline (${item.id}) no Firestore:`, err);
        failedCount++;
      }
    }

    toast.dismiss(toastId);

    if (successCount > 0) {
      toast.success(`${successCount} rota(s) de fretamento sincronizada(s) com sucesso!`, {
        description: 'Os dados da operação de fretamento estão atualizados com o servidor.'
      });
    }

    if (failedCount > 0) {
      toast.error(`Falha ao sincronizar ${failedCount} rotas. Elas permanecem salvas localmente.`);
    }

    this.isSyncing = false;
    this.dispatchQueueChangedEvent();
    
    return { success: successCount, failed: failedCount };
  }

  private async dispatchQueueChangedEvent() {
    try {
      const pending = await this.getPendingRoutes();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('offline-charter-routes-changed', { detail: pending }));
      }
    } catch (e) {
      console.error('Error dispatching charter queue change:', e);
    }
  }
}

export const charterIndexedDBService = CharterIndexedDBService.getInstance();
