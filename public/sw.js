
// public/sw.js

// This file is intentionally kept simple for now.
// Its main purpose is to exist and be registered, which is a prerequisite
// for the browser to allow notification permissions.

self.addEventListener('install', (event) => {
  console.log('Service Worker: Fired event: install');
  // event.waitUntil(self.skipWaiting()); // Activate worker immediately
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Fired event: activate');
  // event.waitUntil(self.clients.claim()); // Become available to all pages
});

self.addEventListener('fetch', (event) => {
  // We are not caching anything for now, just logging the fetch event.
  // This is a network-first strategy.
  // console.log('Service Worker: Fired event: fetch', event.request.url);
  event.respondWith(fetch(event.request));
});
