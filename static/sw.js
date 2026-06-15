const CACHE_NAME = 'ourapp-v3-m19';
const STATIC_ASSETS = [
  '/',
  '/static/css/style.css',
  '/static/css/icons-3d.css',
  '/static/js/icons-3d.js',
  '/static/js/affiliate.js',
  '/static/js/home-ads.js',
  '/static/js/fortune.js',
  '/static/js/shopping-guide.js',
  '/static/js/nursing-room.js',
  '/static/js/finance-guide.js',
  '/static/js/app.js',
  '/static/manifest.json',
];

// 설치: 정적 파일 캐시
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 활성화: 이전 캐시 삭제
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 요청 처리
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // API 요청: 네트워크 우선, 실패 시 캐시
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // JS/CSS: 네트워크 우선 (개발·업데이트 반영)
  if (url.pathname.startsWith('/static/js/') || url.pathname.startsWith('/static/css/')) {
    e.respondWith(
      fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // 기타 정적 파일: 캐시 우선
  if (url.pathname.startsWith('/static/')) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return res;
      }))
    );
    return;
  }

  // HTML 페이지: 네트워크 우선
  e.respondWith(
    fetch(e.request).catch(() => caches.match('/'))
  );
});
