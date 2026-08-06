import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let adminAuth: Auth | null = null;

/**
 * Initializes and returns the Firebase Admin App instance safely on the server-side.
 * Supports service account JSON from FIREBASE_SERVICE_ACCOUNT / FIREBASE_SERVICE_ACCOUNT_KEY env vars,
 * or falls back to Application Default Credentials (ADC) / default project configuration.
 */
export function getAdminApp(): App {
  if (adminApp) {
    return adminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
    return adminApp;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GCP_PROJECT || firebaseConfig.projectId;
  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;

  if (serviceAccountRaw) {
    try {
      const serviceAccount = typeof serviceAccountRaw === 'string'
        ? JSON.parse(serviceAccountRaw)
        : serviceAccountRaw;

      adminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId,
        storageBucket: firebaseConfig.storageBucket
      });
      console.log('[FirebaseAdmin] Initialized with Service Account Key.');
      return adminApp;
    } catch (err) {
      console.warn('[FirebaseAdmin] Failed to parse service account JSON, falling back to default credentials:', err);
    }
  }

  adminApp = initializeApp({
    projectId,
    storageBucket: firebaseConfig.storageBucket
  });
  console.log(`[FirebaseAdmin] Initialized with default credentials for project ${projectId}.`);
  return adminApp;
}

/**
 * Lazy getter for Admin Firestore database instance.
 * Targets the configured database ID (e.g. custom database) when specified.
 */
export function getAdminFirestore(): Firestore {
  if (!adminDb) {
    const app = getAdminApp();
    const databaseId = process.env.FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId || '(default)';
    adminDb = getFirestore(app, databaseId);
  }
  return adminDb;
}

/**
 * Lazy getter for Admin Auth instance.
 */
export function getAdminAuth(): Auth {
  if (!adminAuth) {
    const app = getAdminApp();
    adminAuth = getAuth(app);
  }
  return adminAuth;
}
