self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // Retire pages cached by earlier releases. Authentication stays in browser storage.
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => /^(meowtrack-chat|database-chat)-v/.test(name))
        .map((name) => caches.delete(name)));
    } catch {
      // Cache storage can be unavailable in a restricted browser.
    } finally {
      await self.clients.claim();
    }
  })());
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
