// This is a minimal service worker file to make the app installable.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
});

self.addEventListener('fetch', (event) => {
  // We are not adding any offline caching for now.
  // This fetch handler is the minimum required for installability.
  event.respondWith(fetch(event.request));
});
