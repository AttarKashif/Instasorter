const CACHE_NAME = 'instasorter-cache-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.svg',
];

// Install Event
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Navigation Requests (HTML / Client-side routes) -> Stale-While-Revalidate / Cache Fallback to /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match('/') || caches.match('/index.html');
        })
    );
    return;
  }

  // 2. Static Bundle Assets (JS, CSS, Web Fonts, Local SVG) -> Cache First with Network Refresh
  if (
    url.origin === location.origin &&
    (url.pathname.startsWith('/assets/') ||
     url.pathname.endsWith('.js') ||
     url.pathname.endsWith('.css') ||
     url.pathname.endsWith('.woff2') ||
     url.pathname.endsWith('.svg'))
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Fetch update in background (Stale-While-Revalidate)
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {/* offline silent failure */});
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Images and Dynamic Media -> Stale-While-Revalidate
  if (request.destination === 'image' || url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg)$/i)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
              const copy = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // Default Network First with Cache Fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Background Sync Listener (Triggers when connectivity is restored or browser runs sync in background)
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-thumbnails' || event.tag === 'sync-pending-posts') {
    event.waitUntil(processServiceWorkerBackgroundQueue());
  }
});

// Periodic Background Sync Listener (Triggers periodically by OS/Browser even when tab is closed)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'periodic-thumbnail-scrape') {
    event.waitUntil(processServiceWorkerBackgroundQueue());
  }
});

// Client Message Listener
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (event.data.type === 'OFFLOAD_BACKGROUND_QUEUE') {
    const posts = event.data.posts || [];
    if (posts.length > 0) {
      event.waitUntil(
        fetch('/api/queue-background-scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ posts }),
        }).catch((err) => console.warn('[SW] Background scrape offload error:', err))
      );
    }
  }
});

// Helper function to process background queue via server endpoint
async function processServiceWorkerBackgroundQueue() {
  try {
    console.log('[ServiceWorker] Executing background sync queue task...');
    // Request server to process any pending items in its server-side background queue
    const response = await fetch('/api/queue-background-scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts: [] }), // Triggers queue check / process
    });
    if (response.ok) {
      console.log('[ServiceWorker] Background sync queue successfully pinged.');
    }
  } catch (err) {
    console.warn('[ServiceWorker] Background sync failed:', err);
  }
}
