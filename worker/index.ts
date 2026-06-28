// Custom service worker additions — merged into the Workbox SW by @ducanh2912/next-pwa
// Handles Web Push notifications sent from /api/push/send
/* eslint-disable no-restricted-globals */

self.addEventListener('push', (event: Event) => {
  const pushEvent = event as any;
  if (!pushEvent.data) return;

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string } = {};
  try { data = pushEvent.data.json(); } catch { data = { body: pushEvent.data.text() }; }

  const title = data.title ?? 'تدبير';
  const options: {
    body: string;
    badge: string;
    dir: NotificationDirection;
    lang: string;
    data: { url: string };
    icon?: string;
  } = {
    body: data.body ?? '',
    badge: data.badge ?? '/badge-96.png',
    dir: 'rtl' as NotificationDirection,
    lang: 'ar',
    data: { url: data.url ?? '/' },
  };

  // الأيقونة الكبيرة (large icon) تُضاف فقط إن أُرسلت صراحةً، حتى لا يتكرّر
  // الشعار بجانب أيقونة التطبيق التي يعرضها النظام تلقائياً.
  if (data.icon) options.icon = data.icon;

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
