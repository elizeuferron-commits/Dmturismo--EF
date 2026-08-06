import { collection, getDocs, addDoc, query, orderBy, limit, serverTimestamp, Timestamp, writeBatch, doc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { dbCacheService } from './dbCacheService';
import LZString from 'lz-string';

const COLLECTIONS_TO_BACKUP = [
  'users',
  'vehicles',
  'employees',
  'fuel_tanks',
  'fuel_logs',
  'fuel_entries',
  'maintenance_logs',
  'stock_items',
  'checklists',
  'financial_transactions',
  'trips'
];

export interface BackupRecord {
  id?: string;
  timestamp: Timestamp;
  createdBy: string;
  data: Record<string, any[]>;
  size: number;
  isCompressed?: boolean;
}

export function getFridayExportDate(now: Date): string {
  const date = new Date(now.getTime());
  const day = date.getDay(); // 0 is Sunday, ..., 5 is Friday, 6 is Saturday
  
  // If today is Friday:
  if (day === 5) {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    if (hours < 23 || (hours === 23 && minutes < 59)) {
      // It's Friday but before 23:59, so the latest valid Friday export date is the previous Friday (7 days ago)
      date.setDate(date.getDate() - 7);
    }
  } else {
    // It's another day. Find the most recent Friday.
    const diff = (day + 2) % 7; // e.g. Sat (6 + 2)%7 = 1; Sun (0 + 2)%7 = 2; Mon (1 + 2)%7 = 3; etc.
    const daysToSubtract = diff === 0 ? 7 : diff;
    date.setDate(date.getDate() - daysToSubtract);
  }
  
  // Format as YYYY-MM-DD
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export const backupService = {
  async performFullBackup(userEmail: string): Promise<string> {
    const backupData: Record<string, any[]> = {};
    let totalItems = 0;

    for (const colName of COLLECTIONS_TO_BACKUP) {
      try {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        totalItems += snap.docs.length;
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, colName);
      }
    }

    const jsonString = JSON.stringify(backupData);
    const compressed = LZString.compressToUTF16(jsonString);
    const compressedSizeBytes = new Blob([compressed]).size;

    console.log(`[Backup] Original size: ${new Blob([jsonString]).size} bytes. Compressed size: ${compressedSizeBytes} bytes.`);

    if (compressedSizeBytes > 1000000) {
      console.warn('[Backup] Compressed size still exceeds 1MB. Backup might fail.');
    }

    const backupRecord = {
      timestamp: serverTimestamp(),
      createdBy: userEmail,
      data: compressed,
      size: totalItems,
      isCompressed: true
    };

    try {
      const docRef = await addDoc(collection(db, 'backups'), backupRecord);
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'backups');
      throw error; // reachable? handleFirestoreError throws
    }
  },

  async getLastBackup(): Promise<BackupRecord | null> {
    const path = 'backups';
    try {
      const q = query(collection(db, path), orderBy('timestamp', 'desc'), limit(1));
      const snap = await getDocs(q);
      if (snap.empty) return null;
      
      const docData = snap.docs[0].data() as any;
      let data = docData.data;

      if (docData.isCompressed && typeof data === 'string') {
        try {
          const decompressed = LZString.decompressFromUTF16(data);
          if (decompressed) {
            data = JSON.parse(decompressed);
          }
        } catch (e) {
          console.error('Erro ao descompactar backup:', e);
        }
      }

      return { 
        id: snap.docs[0].id, 
        ...docData,
        data
      } as BackupRecord;
    } catch (error) {
      console.error('Erro ao buscar último backup:', error);
      handleFirestoreError(error, OperationType.LIST, path);
      return null;
    }
  },

  async triggerCloudBackup(): Promise<any> {
    const user = auth.currentUser;
    if (!user) throw new Error("Usuário não autenticado");

    const idToken = await user.getIdToken();
    
    const projectId = "gen-lang-client-0708969846";
    const region = "us-east1"; // Default region for current environment
    
    // Check if we are running in the AI Studio cloud sandbox to grab the hash portion
    let hash = "707517084471"; // Fallback to current run hash
    const hostname = window.location.hostname;
    const match = hostname.match(/-([0-9]+)\.([a-z0-9-]+)\.run\.app/);
    if (match) {
      hash = match[1];
    }

    const urls = [
      `https://triggermanualbackup-${hash}.${region}.run.app`,
      `https://${region}-${projectId}.cloudfunctions.net/triggerManualBackup`,
      `https://us-central1-${projectId}.cloudfunctions.net/triggerManualBackup`
    ];

    let lastError = null;
    for (const url of urls) {
      try {
        console.log(`[Backup] Fetching manual backup from URL: ${url}`);
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          return data;
        } else {
          const text = await response.text();
          console.warn(`[Backup] Failed URL: ${url}. Status: ${response.status}. Error: ${text}`);
          lastError = new Error(`Status ${response.status}: ${text}`);
        }
      } catch (err) {
        console.warn(`[Backup] Network error on URL: ${url}`, err);
        lastError = err;
      }
    }

    throw lastError || new Error("Não foi possível conectar a nenhuma das instâncias da Cloud Function de Backup.");
  },

  async performDataStorageBackup(userEmail: string): Promise<{ success: boolean; paths: string[] }> {
    const collectionsToBackup = ['vehicles', 'employees', 'maintenance_logs'];
    const backupData: Record<string, any[]> = {};
    const dateStr = new Date().toISOString().split('T')[0];
    const timestampStr = new Date().toISOString();
    const uploadedPaths: string[] = [];

    // Fetch collections favoring cache to save quota
    for (const colName of collectionsToBackup) {
      try {
        let data: any[] = [];
        if (colName === 'vehicles') data = await dbCacheService.getVehicles();
        else if (colName === 'employees') data = await dbCacheService.getEmployees();
        else data = await dbCacheService.getCollectionFromCache(colName);
        
        // If cache is empty, try one-time fetch if quota allows
        if (!data || data.length === 0) {
          try {
            const snap = await getDocs(collection(db, colName));
            data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } catch (e) {
            console.warn(`[Storage Backup] Quota likely exceeded for ${colName}, backup will be incomplete.`, e);
          }
        }
        backupData[colName] = data || [];
      } catch (error) {
        console.error(`[Storage Backup] Erro ao buscar ${colName}:`, error);
        backupData[colName] = [];
      }
    }

    const { ref, uploadString } = await import('firebase/storage');
    const { storage } = await import('../lib/firebase');

    // 1. Upload JSON containing all three collections
    const jsonString = JSON.stringify({
      backupTimestamp: timestampStr,
      createdBy: userEmail,
      data: backupData
    }, null, 2);

    const jsonPath = `backups/${dateStr}/dados_completos_${dateStr}.json`;
    
    // 2. CSV conversion helper
    const convertToCSV = (data: any[]): string => {
      if (!data || !data.length) return '';
      const headersSet = new Set<string>();
      data.forEach(obj => Object.keys(obj).forEach(k => headersSet.add(k)));
      const headers = Array.from(headersSet);
      
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          let val = row[header];
          if (val === undefined || val === null) return '""';
          if (typeof val === 'object') val = JSON.stringify(val);
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }
      return csvRows.join('\r\n');
    };

    let storageOffline = false;
    try {
      const jsonRef = ref(storage, jsonPath);
      await uploadString(jsonRef, jsonString, 'raw', { contentType: 'application/json' });
      uploadedPaths.push(jsonPath);

      // 3. Upload CSV files for each collection
      for (const colName of collectionsToBackup) {
        const csvString = convertToCSV(backupData[colName]);
        const csvPath = `backups/${dateStr}/${colName}_${dateStr}.csv`;
        const csvRef = ref(storage, csvPath);
        await uploadString(csvRef, csvString, 'raw', { contentType: 'text/csv' });
        uploadedPaths.push(csvPath);
      }
    } catch (storageError: any) {
      storageOffline = true;
      console.warn('[Storage Backup] Firebase Storage is currently offline, unconfigured or unreachable. Skipping file upload:', storageError?.message || storageError);
    }

    // Register log in Firestore
    try {
      await addDoc(collection(db, 'storage_backup_logs'), {
        timestamp: timestampStr,
        date: dateStr,
        createdBy: userEmail,
        paths: uploadedPaths,
        formats: ['JSON', 'CSV'],
        collections: collectionsToBackup,
        success: true,
        storageOffline
      });
    } catch (err) {
      console.error("[Storage Backup] Erro ao registrar log no Firestore:", err);
    }

    return { success: true, paths: uploadedPaths };
  },

  async checkAndTriggerDailyStorageBackup(userEmail: string): Promise<boolean> {
    try {
      const dateStr = new Date().toISOString().split('T')[0];
      // Try cache first for logs
      const cachedLogs = await dbCacheService.getCollectionFromCache('storage_backup_logs');
      const alreadyDoneCached = cachedLogs && cachedLogs.some(l => l.date === dateStr && l.success === true);
      
      if (alreadyDoneCached) return false;

      // If not in cache, try Firestore but handle quota
      let alreadyDone = false;
      try {
        const snap = await getDocs(collection(db, 'storage_backup_logs'));
        alreadyDone = snap.docs.some(doc => doc.data().date === dateStr && doc.data().success === true);
      } catch (e) {
        console.warn("[Storage Backup] Quota limit reached during log check. Proceeding with backup based on local cache state.");
      }
      
      if (!alreadyDone) {
        console.log(`[Storage Backup] Iniciando backup automático diário para o dia ${dateStr}...`);
        await this.performDataStorageBackup(userEmail);
        return true;
      }
      return false;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.toLowerCase().includes('offline') || 
          errMsg.toLowerCase().includes('failed to get document') || 
          errMsg.toLowerCase().includes('unreachable') || 
          errMsg.toLowerCase().includes('unavailable')) {
        console.warn("[Storage Backup] Não foi possível verificar o backup diário automático pois o Firestore está offline.");
      } else {
        console.error("[Storage Backup] Erro ao verificar/disparar backup diário:", error);
      }
      return false;
    }
  },

  async performFridayExport(userEmail: string, fridayDateStr: string): Promise<{ success: boolean; paths: string[] }> {
    const collectionsToExport = ['trips', 'fuel_logs'];
    const exportData: Record<string, any[]> = {};
    const timestampStr = new Date().toISOString();
    const uploadedPaths: string[] = [];

    const [year, month] = fridayDateStr.split('-');
    const folderPath = `exports/${year}/${month}`;

    // Fetch collections favoring cache to save quota
    for (const colName of collectionsToExport) {
      try {
        let data: any[] = [];
        if (colName === 'trips') data = await dbCacheService.getTrips();
        else data = await dbCacheService.getCollectionFromCache(colName);

        if (!data || data.length === 0) {
          try {
            const snap = await getDocs(collection(db, colName));
            data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          } catch (e) {
            console.warn(`[Friday Export] Quota likely exceeded for ${colName}, export will be based on last known data.`);
          }
        }
        exportData[colName] = data || [];
      } catch (error) {
        console.error(`[Friday Export] Erro ao buscar ${colName}:`, error);
        exportData[colName] = [];
      }
    }

    const { ref, uploadString } = await import('firebase/storage');
    const { storage } = await import('../lib/firebase');

    // CSV conversion helper
    const convertToCSV = (data: any[]): string => {
      if (!data || !data.length) return '';
      const headersSet = new Set<string>();
      data.forEach(obj => Object.keys(obj).forEach(k => headersSet.add(k)));
      const headers = Array.from(headersSet);
      
      const csvRows = [headers.join(',')];
      
      for (const row of data) {
        const values = headers.map(header => {
          let val = row[header];
          if (val === undefined || val === null) return '""';
          if (typeof val === 'object') {
            if (val && typeof val === 'object' && 'seconds' in val && 'nanoseconds' in val) {
              const seconds = (val as any).seconds;
              val = new Date(seconds * 1000).toISOString();
            } else {
              val = JSON.stringify(val);
            }
          }
          const escaped = ('' + val).replace(/"/g, '""');
          return `"${escaped}"`;
        });
        csvRows.push(values.join(','));
      }
      return csvRows.join('\r\n');
    };

    let storageOffline = false;
    try {
      // Upload CSV files for each collection
      for (const colName of collectionsToExport) {
        const csvString = convertToCSV(exportData[colName]);
        const csvPath = `${folderPath}/${colName}_${fridayDateStr}.csv`;
        const csvRef = ref(storage, csvPath);
        await uploadString(csvRef, csvString, 'raw', { contentType: 'text/csv' });
        uploadedPaths.push(csvPath);
      }
    } catch (storageError: any) {
      storageOffline = true;
      console.warn('[Friday Export] Firebase Storage is currently offline, unconfigured or unreachable. Skipping file export:', storageError?.message || storageError);
    }

    // Register log in Firestore under storage_backup_logs
    try {
      await addDoc(collection(db, 'storage_backup_logs'), {
        timestamp: timestampStr,
        date: `friday_export_${fridayDateStr}`,
        createdBy: userEmail,
        paths: uploadedPaths,
        formats: ['CSV'],
        collections: collectionsToExport,
        success: true,
        storageOffline
      });
    } catch (err) {
      console.error("[Friday Export] Erro ao registrar log no Firestore:", err);
    }

    return { success: true, paths: uploadedPaths };
  },

  async checkAndTriggerFridayExport(userEmail: string): Promise<boolean> {
    try {
      const now = new Date();
      const fridayDateStr = getFridayExportDate(now);
      const targetLogDate = `friday_export_${fridayDateStr}`;

      // Try cache first
      const cachedLogs = await dbCacheService.getCollectionFromCache('storage_backup_logs');
      if (cachedLogs && cachedLogs.some(l => l.date === targetLogDate && l.success === true)) {
        return false;
      }
      
      // Query to check if the Friday export has already been done
      let alreadyDone = false;
      try {
        const snap = await getDocs(collection(db, 'storage_backup_logs'));
        alreadyDone = snap.docs.some(doc => doc.data().date === targetLogDate && doc.data().success === true);
      } catch (e) {
        console.warn("[Friday Export] Quota exceeded during check. Using cache-only decision.");
      }
      
      if (!alreadyDone) {
        console.log(`[Friday Export] Iniciando exportação automática de sexta-feira para a data ${fridayDateStr}...`);
        await this.performFridayExport(userEmail, fridayDateStr);
        return true;
      }
      return false;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.toLowerCase().includes('offline') || 
          errMsg.toLowerCase().includes('failed to get document') || 
          errMsg.toLowerCase().includes('unreachable') || 
          errMsg.toLowerCase().includes('unavailable')) {
        console.warn("[Friday Export] Não foi possível verificar a exportação automática configurada pois o Firestore está offline.");
      } else {
        console.error("[Friday Export] Erro ao verificar/disparar exportação de sexta-feira:", error);
      }
      return false;
    }
  },

  async checkAndTriggerConfiguredBackup(userEmail: string, frequency: string): Promise<boolean> {
    if (frequency === 'desativado') {
      console.log('[Storage Backup] Backup automático desativado por configuração.');
      return false;
    }
    try {
      const now = new Date();
      
      // Fetch logs favoring cache
      let logs: any[] = [];
      const cachedLogs = await dbCacheService.getCollectionFromCache('storage_backup_logs');
      if (cachedLogs && cachedLogs.length > 0) {
        logs = cachedLogs;
      } else {
        try {
          const snap = await getDocs(collection(db, 'storage_backup_logs'));
          logs = snap.docs.map(doc => doc.data());
        } catch (e) {
          console.warn("[Storage Backup] Quota exceeded on logs check. Using empty log state.");
        }
      }

      logs = logs.filter(l => l.success === true && l.formats && l.formats.includes('JSON'));

      if (logs.length > 0) {
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const lastLog = logs[0];
        const lastTime = new Date(lastLog.timestamp).getTime();
        const diffMs = now.getTime() - lastTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (frequency === 'diario' && diffDays < 1) {
          return false;
        }
        if (frequency === 'semanal' && diffDays < 7) {
          return false;
        }
        if (frequency === 'mensal' && diffDays < 30) {
          return false;
        }
      }

      console.log(`[Storage Backup] Iniciando backup automático (${frequency}) para o dia ${now.toISOString().split('T')[0]}...`);
      await this.performDataStorageBackup(userEmail);
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.toLowerCase().includes('offline') || 
          errMsg.toLowerCase().includes('failed to get document') || 
          errMsg.toLowerCase().includes('unreachable') || 
          errMsg.toLowerCase().includes('unavailable')) {
        console.warn("[Storage Backup] Não foi possível verificar o backup automático configurado pois o Firestore está offline.");
      } else {
        console.error("[Storage Backup] Erro ao verificar/disparar backup configurado:", error);
      }
      return false;
    }
  },

  async checkAndTriggerConfiguredExport(userEmail: string, frequency: string): Promise<boolean> {
    if (frequency === 'desativado') {
      console.log('[Friday Export] Exportação automática desativada por configuração.');
      return false;
    }
    try {
      const now = new Date();

      // Fetch logs favoring cache
      let logs: any[] = [];
      const cachedLogs = await dbCacheService.getCollectionFromCache('storage_backup_logs');
      if (cachedLogs && cachedLogs.length > 0) {
        logs = cachedLogs;
      } else {
        try {
          const snap = await getDocs(collection(db, 'storage_backup_logs'));
          logs = snap.docs.map(doc => doc.data());
        } catch (e) {
          console.warn("[Friday Export] Quota exceeded on logs check. Using empty log state.");
        }
      }

      logs = logs.filter(l => l.success === true && l.date && l.date.startsWith('friday_export_'));

      if (logs.length > 0) {
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        const lastLog = logs[0];
        const lastTime = new Date(lastLog.timestamp).getTime();
        const diffMs = now.getTime() - lastTime;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);

        if (frequency === 'semanal' && diffDays < 7) {
          return false;
        }
        if (frequency === 'quinzenal' && diffDays < 14) {
          return false;
        }
        if (frequency === 'mensal' && diffDays < 30) {
          return false;
        }
      }

      const dateStr = now.toISOString().split('T')[0];
      console.log(`[Friday Export] Iniciando exportação automática (${frequency}) para a data ${dateStr}...`);
      await this.performFridayExport(userEmail, dateStr);
      return true;
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      if (errMsg.toLowerCase().includes('offline') || 
          errMsg.toLowerCase().includes('failed to get document') || 
          errMsg.toLowerCase().includes('unreachable') || 
          errMsg.toLowerCase().includes('unavailable')) {
        console.warn("[Friday Export] Não foi possível verificar a exportação automática configurada pois o Firestore está offline.");
      } else {
        console.error("[Friday Export] Erro ao verificar/disparar exportação configurada:", error);
      }
      return false;
    }
  },

  async exportAppDataJSON(userEmail: string): Promise<{ fileName: string; totalItems: number }> {
    const backupData: Record<string, any[]> = {};
    let totalItems = 0;

    for (const colName of COLLECTIONS_TO_BACKUP) {
      try {
        const snap = await getDocs(collection(db, colName));
        backupData[colName] = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        totalItems += snap.docs.length;
      } catch (error) {
        console.warn(`[Export App Data] Erro ao buscar coleção ${colName}:`, error);
        backupData[colName] = [];
      }
    }

    const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const fileName = `DM_Turismo_Dados_App_${dateStr}.json`;
    const exportPayload = {
      appName: "DM Turismo Pro",
      version: "0.3.0",
      exportedAt: new Date().toISOString(),
      exportedBy: userEmail,
      totalRecords: totalItems,
      data: backupData
    };

    this.downloadAsJSON(exportPayload, fileName);
    return { fileName, totalItems };
  },

  async importJSONBackup(
    rawJson: any,
    userEmail: string
  ): Promise<{ success: boolean; totalImported: number; collectionsSummary: Record<string, number> }> {
    const rawDataPayload = rawJson?.data || rawJson;
    if (!rawDataPayload || typeof rawDataPayload !== 'object') {
      throw new Error('Formato do arquivo JSON de backup inválido.');
    }

    let totalImported = 0;
    const collectionsSummary: Record<string, number> = {};

    for (const colName of COLLECTIONS_TO_BACKUP) {
      const items = rawDataPayload[colName];
      if (Array.isArray(items) && items.length > 0) {
        let colCount = 0;
        const chunkSize = 400;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = writeBatch(db);

          for (const item of chunk) {
            if (!item || typeof item !== 'object') continue;
            const docId = item.id || doc(collection(db, colName)).id;
            const cleanData = { ...item };
            delete cleanData.id;

            const docRef = doc(db, colName, docId);
            batch.set(docRef, cleanData, { merge: true });
            colCount++;
          }

          await batch.commit();
        }

        totalImported += colCount;
        collectionsSummary[colName] = colCount;
      }
    }

    try {
      const { auditService } = await import('./auditService');
      await auditService.log(
        'SYSTEM',
        userEmail || 'USUARIO_SISTEMA',
        'IMPORT_APP_DATA',
        'System',
        'DataTransfer',
        `Importação de backup concluída: ${totalImported} registros sincronizados.`
      );
    } catch (err) {
      console.warn('Erro ao registrar auditoria de importação:', err);
    }

    return { success: true, totalImported, collectionsSummary };
  },

  downloadAsJSON(data: any, fileName: string) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
};
