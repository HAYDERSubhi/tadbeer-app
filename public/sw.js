
// public/sw.js

self.addEventListener('push', event => {
  const data = event.data ? event.data.json() : { title: 'تدبير', body: 'رسالة جديدة من تطبيق تدبير', icon: '/logo.png' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
          }
        }
        return client.focus();
      }
      return clients.openWindow('/');
    })
  );
});

// Basic service worker to enable PWA installation and offline capabilities
self.addEventListener('install', event => {
  console.log('Service Worker installing.');
  // You can add pre-caching logic here if needed
});

self.addEventListener('activate', event => {
  console.log('Service Worker activating.');
});

self.addEventListener('fetch', event => {
  // Basic fetch handler, can be expanded for caching strategies
  event.respondWith(fetch(event.request));
});
