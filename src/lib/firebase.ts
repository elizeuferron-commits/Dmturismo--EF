import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  getFirestore, 
  doc, 
  getDocFromServer, 
  setLogLevel 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import { toast } from 'sonner';
import firebaseConfig from '../../firebase-applet-config.json';

// Silence verbose firebase warnings in sandbox / iframe environments
setLogLevel('error');

const app = initializeApp(firebaseConfig);

// Initialize Firestore with experimental settings for sandboxed environments
// experimentalForceLongPolling is required in many iframe/sandboxed environments.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
} as any, firebaseConfig.firestoreDatabaseId || '(default)');

// Persistence is disabled in this sandboxed environment to prevent internal assertion failures (Unexpected state ID: b815)
// that often occur in iframes or multi-tab scenarios within AI Studio.

export const auth = getAuth();
export const storage = getStorage(app);

let messagingInstance: any = null;
try {
  // Safe initialization of Firebase Messaging to prevent throwing "messaging/unsupported-browser"
  messagingInstance = getMessaging(app);
} catch (error) {
  console.warn('[FCM] Firebase Messaging is not supported in this browser environment:', error);
}
export const messaging = messagingInstance;

// Connection tests and health checks disabled to save Firestore read quota
/*
async function testConnectionOnBoot() {
  if (typeof window === 'undefined') return;
  try {
    await getDocFromServer(doc(db, '_health_check', 'connection')).catch(() => {});
    console.log("[Firestore] Connection verified successfully.");
  } catch (error: any) {
    console.warn("[Firestore] Initial connection test failed:", error?.message);
  }
}
testConnectionOnBoot();
*/

// Global error listener to suppress persistent Firestore internal assertion errors
// that can happen asynchronously in sandboxed environments.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    const message = event.error?.message || event.message || '';
    if ((message.includes('FIRESTORE') && message.includes('INTERNAL ASSERTION FAILED')) || message.includes('Unexpected state (ID:')) {
      console.warn('[Firestore Global] Suppressed internal assertion:', message);
      event.preventDefault();
      event.stopPropagation();
    }
  });

  window.addEventListener('unhandledrejection', (event) => {
    const message = event.reason?.message || String(event.reason) || '';
    if ((message.includes('FIRESTORE') && message.includes('INTERNAL ASSERTION FAILED')) || message.includes('Unexpected state (ID:')) {
      console.warn('[Firestore Global] Suppressed unhandled internal assertion:', message);
      event.preventDefault();
      event.stopPropagation();
    }
  });
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: any, operationType: OperationType, path: string | null) {
  const errorString = error instanceof Error ? error.message : String(error);
  const errorCode = error?.code || '';

  const isPermissionDenied = errorCode === 'permission-denied' || 
                             errorString.includes('permission-denied') ||
                             errorString.includes('Missing or insufficient permissions');

  const isUnavailable = errorCode === 'unavailable' ||
                        errorString.includes('client is offline') ||
                        errorString.includes('Failed to get document because the client is offline') ||
                        errorString.includes('Could not reach Cloud Firestore backend');

  const isQuotaExceeded = errorCode === 'resource-exhausted' ||
                          errorString.includes('Quota limit exceeded') || 
                          errorString.includes('resource-exhausted') ||
                          errorString.includes('quota metric') ||
                          errorString.includes('Free daily read units per project');

  const isInternalAssertion = errorString.includes('INTERNAL ASSERTION FAILED') ||
                              errorString.includes('Unexpected state');

  const errInfo: FirestoreErrorInfo = {
    error: errorString,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };

  if (isQuotaExceeded) {
    console.error('Firestore Quota Exceeded (handled):', JSON.stringify(errInfo));
    // Use a persistent ID for the toast to avoid multiple notifications for the same error
    toast.error('Limite de uso diário do banco de dados atingido. Algumas informações podem não carregar até o reset da quota.', { 
      id: 'firestore-quota-error',
      duration: 10000 
    });
    return;
  }

  if (isInternalAssertion) {
    console.warn('Firestore Internal Assertion (ignored throw):', JSON.stringify(errInfo));
    return;
  }

  if (isPermissionDenied) {
    console.warn('Firestore Permission Denied (ignored throw):', JSON.stringify(errInfo));
    return;
  }

  if (isUnavailable) {
    console.warn('Firestore Unavailable/Offline (ignored throw):', JSON.stringify(errInfo));
    // Dispatch a global event so the UI can show a connection warning even if navigator.onLine is true
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('firestore-connectivity-lost', { detail: errInfo }));
    }
    return;
  }

  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function cleanUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map(item => cleanUndefined(item)) as any;
  }
  if (typeof obj === 'object') {
    const newObj: any = {};
    for (const key of Object.keys(obj)) {
      const val = (obj as any)[key];
      if (val !== undefined) {
        newObj[key] = cleanUndefined(val);
      }
    }
    return newObj;
  }
  return obj;
}
