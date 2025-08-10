// public/sw.js

// Listen for the install event, which is fired when the service worker is installed.
self.addEventListener('install', (event) => {
  // The service worker is installed.
  console.log('Service Worker installing.');
});

// Listen for the activate event, which is fired when the service worker is activated.
self.addEventListener('activate', (event) => {
  // The service worker is activated.
  console.log('Service Worker activating.');
});

// Listen for push events, which are sent by the server.
self.addEventListener('push', (event) => {
  console.log('Push event received.');
  if (event.data) {
    const data = event.data.json();
    const title = data.title || 'تطبيق تدبير';
    const options = {
      body: data.body || 'لا تنس تسجيل مصروفاتك اليومية.',
      icon: '/logo.png', // Path to your app icon
      badge: '/logo.png', // Path to a smaller badge icon
      dir: 'rtl',
      lang: 'ar',
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

// Listen for notification click events.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/')
  );
});
