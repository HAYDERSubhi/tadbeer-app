// Custom service worker additions — merged into the Workbox SW by @ducanh2912/next-pwa
// Handles Web Push notifications sent from /api/push/send
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event: Event) => {
  const pushEvent = event as any;
  if (!pushEvent.data) return;

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } = {};
  try { data = pushEvent.data.json(); } catch { data = { body: pushEvent.data.text() }; }

  const title = data.title ?? 'تدبير';
  const options = {
    body: data.body ?? '',
    icon: data.icon ?? '/icon-192x192.png',
    badge: data.badge ?? '/icon-192x192.png',
    dir: 'rtl' as NotificationDirection,
    lang: 'ar',
    data: { url: data.url ?? '/' },
  };

  pushEvent.waitUntil((self as any).registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event: Event) => {
  const ne = event as any;
  ne.notification.close();
  const url: string = ne.notification.data?.url ?? '/';
  ne.waitUntil(
    (self as any).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients: any[]) => {
        const existing = clients.find((c: any) => c.url.includes((self as any).location.origin));
        if (existing) return existing.focus();
        return (self as any).clients.openWindow(url);
      })
  );
});
