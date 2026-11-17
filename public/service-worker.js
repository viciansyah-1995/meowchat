self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.delete('meowtrack-chat-v2').then(() => self.clients.claim()));
});

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data?.json();
  } catch {
    return;
  }
  if (payload?.type !== 'chat-ping') return;

  event.waitUntil(self.registration.showNotification('Database', {
    body: 'Your deployment is Success!',
    icon: '/app-icon.jpg',
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const app = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (app) await app.focus();
    else await self.clients.openWindow('/');
  })());
});
