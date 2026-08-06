import { collection, addDoc, doc, runTransaction } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Vehicle, FuelTank } from '../types';

export interface OfflineQueueItem {
  id: string;
  type: 'financial_transaction' | 'fuel_log';
  payload: any;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  errorMessage?: string;
  attempts?: number;
}

const STORAGE_KEY = 'dm_offline_actions_queue';

export const offlineQueue = {
  getQueue(): OfflineQueueItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error parsing offline queue:', e);
      return [];
    }
  },

  saveQueue(queue: OfflineQueueItem[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    } catch (e) {
      console.error('Error saving offline queue:', e);
    }
    window.dispatchEvent(new CustomEvent('offline-queue-changed', { detail: queue }));
  },

  getSyncedLog(): any[] {
    try {
      const data = localStorage.getItem('dm_offline_sync_log_history');
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error parsing sync log:', e);
      return [];
    }
  },

  addSyncedLog(logItem: { id: string; type: 'financial_transaction' | 'fuel_log' | 'charter_route'; queuedTimestamp: string; syncedTimestamp: string; summary: string }) {
    try {
      const logs = this.getSyncedLog();
      if (logs.some((l: any) => l.id === logItem.id)) return;
      logs.unshift(logItem);
      const trimmed = logs.slice(0, 20);
      localStorage.setItem('dm_offline_sync_log_history', JSON.stringify(trimmed));
      window.dispatchEvent(new CustomEvent('offline-sync-log-changed', { detail: trimmed }));
    } catch (e) {
      console.error('Error saving sync log:', e);
    }
  },

  enqueue(type: 'financial_transaction' | 'fuel_log', payload: any) {
    const queue = this.getQueue();
    const newItem: OfflineQueueItem = {
      id: `${type}_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0
    };
    queue.push(newItem);
    this.saveQueue(queue);
    return newItem;
  },

  removeItem(id: string) {
    const queue = this.getQueue();
    const filtered = queue.filter(item => item.id !== id);
    this.saveQueue(filtered);
  },

  updateItemStatus(id: string, status: 'pending' | 'syncing' | 'failed', errorMessage?: string) {
    const queue = this.getQueue();
    const item = queue.find(i => i.id === id);
    if (item) {
      item.status = status;
      if (errorMessage !== undefined) {
        item.errorMessage = errorMessage;
      }
      if (status === 'failed') {
        item.attempts = (item.attempts || 0) + 1;
      }
      this.saveQueue(queue);
    }
  },

  async processQueue(): Promise<{ success: number; failed: number }> {
    const queue = this.getQueue();
    const pending = queue.filter(item => item.status === 'pending' || item.status === 'failed');
    
    let success = 0;
    let failed = 0;

    for (const item of pending) {
      this.updateItemStatus(item.id, 'syncing');
      try {
        if (item.type === 'financial_transaction') {
          await this.syncFinancial(item.payload);
        } else if (item.type === 'fuel_log') {
          await this.syncFuel(item.payload);
        }
        
        // Log successful sync before removal
        this.addSyncedLog({
          id: item.id,
          type: item.type,
          queuedTimestamp: item.timestamp,
          syncedTimestamp: new Date().toISOString(),
          summary: item.type === 'fuel_log'
            ? `Abastecimento: ${item.payload.quantity || 0}L (R$ ${item.payload.cost || 0})`
            : `Transação: ${item.payload.description || (item.payload.type === 'income' ? 'Receita' : 'Despesa')} (R$ ${item.payload.amount || 0})`
        });
        
        // Remove item if successfully synced
        this.removeItem(item.id);
        success++;
      } catch (err: any) {
        console.error(`Failed to sync offline item ${item.id}:`, err);
        this.updateItemStatus(item.id, 'failed', err.message || String(err));
        failed++;
      }
    }

    return { success, failed };
  },

  async syncFinancial(payload: any) {
    if (Array.isArray(payload)) {
      for (const item of payload) {
        await addDoc(collection(db, 'financial_transactions'), {
          ...item,
          createdAt: item.createdAt || new Date().toISOString()
        });
      }
    } else {
      await addDoc(collection(db, 'financial_transactions'), {
        ...payload,
        createdAt: payload.createdAt || new Date().toISOString()
      });
    }
  },

  async syncFuel(payload: any) {
    const { vehicleId, fuelTankId, arlaTankId, arlaQuantity: arlaQ, isExternal, location, quantity: q, odometer: o, cost: c, ...rest } = payload;
    
    const arlaQuantity = Number(arlaQ || 0);
    const quantity = Number(q || 0);
    const odometer = Number(o || 0);
    const cost = Number(c || 0);

    await runTransaction(db, async (transaction) => {
      // 1. Get vehicle reference
      const vehicleRef = doc(db, 'vehicles', vehicleId);
      const vehicleSnapshot = await transaction.get(vehicleRef);
      if (!vehicleSnapshot.exists()) throw new Error('Veículo não encontrado');
      const vehicle = vehicleSnapshot.data() as Vehicle;

      // 2. Get tank reference (only if internal AND quantity > 0)
      let tankSnapshot = null;
      let tankRef = null;
      if (!isExternal && quantity > 0) {
        if (!fuelTankId) throw new Error('ID do tanque de combustível é obrigatório para abastecimento interno');
        tankRef = doc(db, 'fuel_tanks', fuelTankId);
        tankSnapshot = await transaction.get(tankRef);
        if (!tankSnapshot.exists()) throw new Error('Tanque não encontrado');
        const tank = tankSnapshot.data() as FuelTank;

        if (tank.currentLevel < quantity) {
          throw new Error(`Saldo insuficiente no tanque (${tank.currentLevel}L disponível)`);
        }
      }

      // 3. Get Arla tank reference (if requested and internal)
      let arlaTankSnapshot = null;
      let arlaTankRef = null;
      if (!isExternal && arlaTankId && arlaQuantity > 0) {
        arlaTankRef = doc(db, 'fuel_tanks', arlaTankId);
        arlaTankSnapshot = await transaction.get(arlaTankRef);
        if (!arlaTankSnapshot.exists()) throw new Error('Tanque de Arla não encontrado');
      }

      // --- ALL READS ABOVE ---

      // 4. Register Fuel Log
      const logRef = doc(collection(db, 'fuel_logs'));
      const timestampValue = rest.timestamp || new Date().toISOString();
      delete rest.timestamp;

      transaction.set(logRef, {
        ...rest,
        vehicleId,
        fuelTankId: fuelTankId || null,
        arlaTankId: arlaTankId || null,
        arlaQuantity,
        isExternal: isExternal || false,
        location: location || 'Interno',
        quantity,
        odometer,
        cost,
        timestamp: timestampValue
      });

      // 5. Update Tank Level (only if internal and quantity > 0)
      if (!isExternal && quantity > 0 && tankSnapshot && tankRef) {
        const tank = tankSnapshot.data() as FuelTank;
        transaction.update(tankRef, {
          currentLevel: tank.currentLevel - quantity,
          updatedAt: new Date().toISOString()
        });
      }

      // 6. Update Vehicle Odometer (ONLY IF HIGHER)
      const vehicleUpdates: any = {
        lastFuel: {
          timestamp: timestampValue,
          quantity: quantity,
          cost: cost
        },
        updatedAt: new Date().toISOString()
      };
      
      if (odometer > (vehicle.currentOdometer || 0)) {
        vehicleUpdates.currentOdometer = odometer;
      }
      transaction.update(vehicleRef, vehicleUpdates);

      // 7. Update Arla Tank Level (if requested and internal)
      if (!isExternal && arlaTankSnapshot && arlaTankRef && arlaQuantity > 0) {
        const arlaTank = arlaTankSnapshot.data() as FuelTank;
        if (arlaTank.currentLevel < arlaQuantity) {
          throw new Error(`Saldo insuficiente no tanque de Arla (${arlaTank.currentLevel}L disponível)`);
        }

        transaction.update(arlaTankRef, {
          currentLevel: arlaTank.currentLevel - arlaQuantity,
          updatedAt: new Date().toISOString()
        });
      }
    });
  }
};
