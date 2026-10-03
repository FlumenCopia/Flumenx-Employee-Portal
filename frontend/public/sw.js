// Flumenx Service Worker & Native Notification Handler
const CACHE_NAME = 'flumenx-pwa-v2';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Let network handle dynamic API/page requests directly
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});

// Real-Time Web Push Notifications (Works even when the app/tab is closed)
self.addEventListener('push', (event) => {
  let data = { title: 'FLUMENX Notification', body: 'You have a new update.', url: '/' };
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body || data.message || '',
    icon: data.icon || '/flumenx-mark-only.png',
    badge: '/flumenx-mark-only.png',
    tag: data.tag || `flumenx-notif-${Date.now()}`,
    renotify: true,
    data: {
      url: data.url || data.link || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title || 'FLUMENX Portal', options));
});

// Handle Notification Clicks (Focuses app or opens directly to the relevant page)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it and navigate
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // Otherwise, open a new window at the destination URL
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Allow client pages to display background-persistent OS notifications via Service Worker
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data;
    self.registration.showNotification(title, options);
  }
});
