import { collection, addDoc, serverTimestamp, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export interface AuditLog {
  id?: string;
  timestamp: any;
  userId: string;
  userEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
}

export const auditService = {
  async log(userId: string, userEmail: string, action: string, entityType: string, entityId: string, details: string) {
    const log: Omit<AuditLog, 'id'> = {
      timestamp: serverTimestamp(),
      userId,
      userEmail,
      action,
      entityType,
      entityId,
      details
    };

    try {
      await addDoc(collection(db, 'audit_logs'), log);
    } catch (error) {
      const errStr = (error as Error)?.message || '';
      if (errStr.includes('Quota') || errStr.includes('resource-exhausted')) {
        console.warn('Failed to log audit due to Quota limits. Silencing error.');
        return;
      }
      console.error('Failed to log audit:', error);
      handleFirestoreError(error, OperationType.CREATE, 'audit_logs');
    }
  },

  async getRecentLogs(limitCount = 50) {
    try {
      const q = query(
        collection(db, 'audit_logs'), 
        orderBy('timestamp', 'desc'), 
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      return [];
    }
  },

  async getLogsByEntity(entityType: string, entityId: string) {
    try {
      const q = query(
        collection(db, 'audit_logs'),
        where('entityType', '==', entityType),
        where('entityId', '==', entityId),
        orderBy('timestamp', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'audit_logs');
      return [];
    }
  }
};
