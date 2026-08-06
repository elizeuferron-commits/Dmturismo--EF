// sw.js (DM Turismo Service Worker Copy)
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Cache configuration for static assets
const CACHE_NAME = 'dm-turismo-static-v2';
const FONTS_CACHE_NAME = 'dm-turismo-fonts-v1';
const IMAGES_CACHE_NAME = 'dm-turismo-images-v1';
const SCRIPTS_CACHE_NAME = 'dm-turismo-scripts-v1';
const EXTERNAL_CACHE_NAME = 'dm-turismo-external-v2';
const PRE_CACHE_ASSETS = [
  '/',
  '/index.html',
  '/logo_dm.svg',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Pre-caching core static assets');
      return cache.addAll(PRE_CACHE_ASSETS).catch((err) => {
        console.warn('[SW] Pre-caching skipped on some assets, carrying on:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== FONTS_CACHE_NAME && cache !== IMAGES_CACHE_NAME && cache !== SCRIPTS_CACHE_NAME && cache !== EXTERNAL_CACHE_NAME) {
            console.log('[SW] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Cache fetch interceptor
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and secure/database real-time API integrations
  if (
    event.request.method !== 'GET' ||
    url.pathname.includes('/api/') ||
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('identitytoolkit.googleapis.com') ||
    url.hostname.includes('securetoken.googleapis.com') ||
    url.hostname.includes('fcmregistration.googleapis.com') ||
    url.hostname.includes('google.com') && !url.hostname.includes('fonts')
  ) {
    return;
  }

  // Estratégia dedicada para fontes (Cache-First)
  const isFont = url.hostname.includes('fonts.gstatic.com') || url.hostname.includes('fonts.googleapis.com');
  if (isFont) {
    event.respondWith(
      caches.open(FONTS_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // Estratégia dedicada para imagens (Unsplash e logos locais)
  const isImage = url.hostname.includes('images.unsplash.com') || 
                  url.pathname.endsWith('.svg') || 
                  url.pathname.endsWith('.png') || 
                  url.pathname.endsWith('.jpg') || 
                  url.pathname.endsWith('.ico');
  
  if (isImage) {
    const isLogoOrPwaIcon = 
      url.pathname === '/logo_dm.svg' || 
      url.pathname === '/manifest.json' || 
      url.pathname.endsWith('logo_dm.svg') ||
      url.pathname.endsWith('manifest.json');

    event.respondWith(
      caches.open(IMAGES_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          // Helper to clone response and inject Cache-Control headers
          const injectCacheControl = (response) => {
            if (!response || response.status !== 200 || response.type === 'opaque') return response;
            try {
              const headers = new Headers(response.headers);
              headers.set('Cache-Control', 'public, max-age=31536000, immutable');
              return response.blob().then((blob) => {
                return new Response(blob, {
                  status: response.status,
                  statusText: response.statusText,
                  headers: headers
                });
              });
            } catch (e) {
              return response;
            }
          };

          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && (networkResponse.status === 200 || networkResponse.status === 0)) {
              if (isLogoOrPwaIcon) {
                injectCacheControl(networkResponse.clone()).then((modifiedResponse) => {
                  cache.put(event.request, modifiedResponse);
                }).catch(() => {
                  cache.put(event.request, networkResponse.clone());
                });
              } else {
                cache.put(event.request, networkResponse.clone());
              }
            }
            return networkResponse;
          }).catch((err) => {
            console.warn('[SW] Image fetch failed:', err);
          });

          if (cachedResponse) {
            return isLogoOrPwaIcon ? injectCacheControl(cachedResponse) : cachedResponse;
          }

          return fetchPromise.then((netRes) => {
            return isLogoOrPwaIcon ? injectCacheControl(netRes) : netRes;
          });
        });
      })
    );
    return;
  }

  // Intercept requests for documents, images, icons, and bundler assets
  const isDocOrStaticAsset =
    PRE_CACHE_ASSETS.includes(url.pathname) ||
    url.pathname.includes('/assets/') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.ico');

  if (isDocOrStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Serve instantly from cache.
          // Hashed assets (/assets/) are constant and never change. We return immediately.
          const isHashedAsset = url.pathname.includes('/assets/');
          if (isHashedAsset) {
            return cachedResponse;
          }

          // Other dynamic static resources (e.g. Logo/Home) -> Stale-While-Revalidate: serve cached version, update in background
          const fetchPromise = fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
              return networkResponse;
            })
            .catch(() => {
              // Ignore background sync network failures
            });

          if (event.waitUntil) {
            event.waitUntil(fetchPromise);
          }

          return cachedResponse;
        }

        // Cache miss: fetch from network & save
        return fetch(event.request).then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }

          // Cache only valid standard static asset requests
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        }).catch(() => {
          // Offline fallback
        });
      })
    );
  }
});

// Initialize Firebase App inside service worker
firebase.initializeApp({
  apiKey: "AIzaSyABuLjbnATvaJS4XZQdHl5z1QS2EeOmcdU",
  authDomain: "gen-lang-client-0708969846.firebaseapp.com",
  projectId: "gen-lang-client-0708969846",
  storageBucket: "gen-lang-client-0708969846.firebasestorage.app",
  messagingSenderId: "874209116420",
  appId: "1:874209116420:web:69287af45af02934ae9051"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'DM Turismo - Alerta';
  const notificationOptions = {
    body: payload.notification?.body || 'Nova mensagem recebida',
    icon: '/logo_dm.svg',
    badge: '/logo_dm.svg',
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Event listener for user clicking on push alert
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Navigate to trips or fleet dashboard depending on the notification type
  const type = event.notification.data?.type;
  let targetUrl = '/';
  if (type === 'trip_scheduled') {
    targetUrl = '/#trips';
  } else if (type === 'urgent_maintenance') {
    targetUrl = '/#fleet';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window open with our app
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          // If possible, navigate to the specific section and focus the active window
          if (client.url && !client.url.includes('#') && targetUrl !== '/') {
            client.navigate(client.url + targetUrl);
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
