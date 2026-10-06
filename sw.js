const CACHE_NAME = 'medcare-pwa-v3';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

function isFirebaseBackend(url) {
  const host = url.hostname;
  return host.includes('firestore.googleapis.com')
    || host.includes('identitytoolkit.googleapis.com')
    || host.includes('securetoken.googleapis.com')
    || host.includes('firebaseinstallations.googleapis.com');
}

function shouldCache(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (isFirebaseBackend(url)) return false;
  if (request.mode === 'navigate') return true;
  if (['script', 'style', 'font', 'image', 'manifest'].includes(request.destination)) return true;
  return url.hostname === 'www.gstatic.com' || url.hostname === 'cdn.tailwindcss.com';
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (!shouldCache(request)) return;

  // Navegação: tenta a versão mais nova e usa o cache se estiver offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Dependências estáticas: cache-first. As requisições do Firestore continuam sob controle do SDK do Firebase.
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response && (response.ok || response.type === 'opaque')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
