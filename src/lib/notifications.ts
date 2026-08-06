import { getToken, onMessage } from 'firebase/messaging';
import { messaging, db } from './firebase';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

// Standard fallback VAPID key or custom environment input
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export async function requestNotificationPermission(userId: string) {
  try {
    // 1. Support Service Worker registering for Background notification handling
    let serviceWorkerRegistration: ServiceWorkerRegistration | undefined;
    if ('serviceWorker' in navigator) {
      try {
        serviceWorkerRegistration = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
        if (!serviceWorkerRegistration) {
          serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
          console.log('[FCM] Service Worker registered:', serviceWorkerRegistration);
        }
      } catch (swErr) {
        console.warn('[FCM] Service worker registration failed/skipped in fallback sandbox:', swErr);
      }
    }

    // 2. Request browser permission
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('[FCM] Notification status: granted');
      
      if (!VAPID_KEY) {
        console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is missing. Push token retrieval may fail without it.');
      }

      if (!messaging) {
        console.warn('[FCM] Target messaging service is null or unsupported. Skipping token retrieval.');
        return null;
      }

      const token = await getToken(messaging, { 
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration
      });

      if (token) {
        console.log('[FCM] Token acquired:', token);
        // Store token in Firestore linked to user
        const firestore = db;
        await setDoc(doc(firestore, 'user_devices', userId), {
          token,
          userId,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        return token;
      } else {
        console.warn('[FCM] Token could not be fetched. Check VAPID credentials.');
      }
    } else {
      console.warn('[FCM] Permission denied or dismissed:', permission);
    }
  } catch (error) {
    console.error('[FCM] Error requesting notification permission:', error);
  }
  return null;
}

// Register foreground message observer. This will render an elegant toast inside the active page!
export function setupForegroundNotificationListener() {
  try {
    if (!messaging) {
      console.warn('[FCM] Messaging could not be initialized or is unsupported. Foreground listener skipped.');
      return;
    }
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground notification payload received:', payload);
      
      const title = payload.notification?.title || 'DM Turismo - Alerta';
      const body = payload.notification?.body || 'Nova mensagem recebida';
      
      // Trigger a beautiful, rich Toast
      toast.info(title, {
        description: body,
        duration: 8000,
        action: {
          label: 'Ver',
          onClick: () => {
            const type = payload.data?.type;
            if (type === 'trip_scheduled') {
              window.location.hash = '#trips';
            } else if (type === 'urgent_maintenance') {
              window.location.hash = '#fleet';
            }
          }
        }
      });
    });
    console.log('[FCM] Foreground receiver successfully bound.');
  } catch (err) {
    console.warn('[FCM] Foreground receiver skipped or failed (unsupported environment):', err);
  }
}
