// 서비스 워커 자동 해제 + 캐시 전부 삭제
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => self.registration.unregister())
  );
});
