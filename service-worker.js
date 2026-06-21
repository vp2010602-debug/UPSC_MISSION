/* Mission UPSC AI OS V29.0 PWA service worker */
const VERSION = 'v29.0.0';
const SHELL_CACHE = `mission-upsc-shell-${VERSION}`;
const RUNTIME_CACHE = `mission-upsc-runtime-${VERSION}`;
const CORE_ASSETS = [
  './',
  './index.html',
  './offline.html',
  './styles.css',
  './pwa-v284.css',
  './responsive-v285.css',
  './v286-polish.css',
  './v287-usability.css',
  './v288-login-ui.css',
  './v289-workspace-fix.css',
  './v290-jarvis-saarathi.css',
  './app.js',
  './firebase-config.js',
  './jarvis-v2811.js',
  './jarvis-v2823.js',
  './jarvis-v285.js',
  './v286-polish.js',
  './v287-usability.js',
  './v289-workspace-fix.js',
  './v290-jarvis-saarathi.js',
  './pwa-v284.js',
  './manifest.webmanifest',
  './assets/icons/jarvis-icon-192-v287.png',
  './assets/icons/jarvis-icon-512-v287.png',
  './assets/icons/jarvis-maskable-512-v287.png',
  './assets/icons/jarvis-apple-touch-v287.png',
  './assets/icons/jarvis-favicon-v287.png',
  './assets/jarvis-emblem.png',
  './assets/jarvis-logo-full.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('mission-upsc-') && ![SHELL_CACHE, RUNTIME_CACHE].includes(k)).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

function isPrivateOrDynamic(url) {
  return /googleapis\.com|firebaseio\.com|firestore\.googleapis\.com|identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com|generativelanguage\.googleapis\.com|localhost:11434|api\/generate|api\/chat/i.test(url.href);
}

async function navigationResponse(request) {
  try {
    const fresh = await fetch(request);
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put('./index.html', fresh.clone()).catch(() => {});
    return fresh;
  } catch (error) {
    return (await caches.match('./index.html', {ignoreSearch:true})) || (await caches.match('./offline.html'));
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request, {ignoreSearch:true});
  const fetchPromise = fetch(request).then(async response => {
    if (response && (response.ok || response.type === 'opaque')) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  }).catch(() => null);
  return cached || (await fetchPromise) || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request));
    return;
  }

  if (isPrivateOrDynamic(url)) {
    event.respondWith(fetch(request).catch(() => new Response(JSON.stringify({offline:true,error:'Network required for cloud sync or AI.'}), {status:503,headers:{'Content-Type':'application/json'}})));
    return;
  }

  const sameOrigin = url.origin === self.location.origin;
  const firebaseCdn = url.hostname === 'www.gstatic.com' && url.pathname.includes('/firebasejs/');
  if (sameOrigin || firebaseCdn) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

self.addEventListener('message', event => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') self.skipWaiting();
  if (data.type === 'CACHE_APP_SHELL') {
    event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(CORE_ASSETS)).then(() => {
      event.source?.postMessage({type:'CACHE_COMPLETE',version:VERSION});
    }));
  }
  if (data.type === 'CLEAR_RUNTIME_CACHE') {
    event.waitUntil(caches.delete(RUNTIME_CACHE).then(() => {
      event.source?.postMessage({type:'RUNTIME_CACHE_CLEARED'});
    }));
  }
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification?.data?.url || './?section=dailyCommandV261';
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for (const client of windows) {
      if ('focus' in client) {
        client.navigate(target).catch(() => {});
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(target);
  })());
});
