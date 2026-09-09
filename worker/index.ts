// Custom service worker additions — merged into the Workbox SW by @ducanh2912/next-pwa
// Handles Web Push notifications sent from /api/push/send
/* eslint-disable no-restricted-globals */

// ═══════════ إبطال صفحات HTML القديمة عند تفعيل نسخة جديدة ═══════════
// العطل (رصده صاحب المشروع على هاتفه 2026-09-09): فتح التطبيق بلا إنترنت بعد
// نشر نسخة جديدة ⇒ شاشة بيضاء «Application error: a client-side exception».
//
// السبب: مخزنا HTML (`pages-cache` للتنقّل و`start-url` للفتح البارد) يعيشان
// **عبر النشرات** بينما ملفات جافاسكربت لكل بناء لها بصمة في اسمها. فعند نشر
// نسخة جديدة يمحو Workbox الحفظ المسبق القديم (`cleanupOutdatedCaches`) بينما
// يبقى HTML القديم محفوظاً ⇒ يُقدَّم مستند قديم يطلب ملفات مبعثرة لم تعد موجودة
// لا في الجهاز ولا على الخادم (تحقّقت: ملفات البناء السابق تُرجع ٤٠٤) ⇒ ينهار
// جافاسكربت والصفحة بيضاء بلا أي رسالة مفهومة.
//
// الحلّ: عند تفعيل عامل خدمة جديد (ولا يحدث إلا بعد تنزيل بناء جديد بنجاح)
// نُسقِط مخزني HTML وحدهما. النتيجة: التنقّل بلا إنترنت لصفحة لم تُزَر بعد
// النشر يعرض `/~offline` بشكل تدبير — لا شاشة خطأ.
//
// ⛔ لا تُضِف الحفظ المسبق (`workbox-precache-*`) إلى هذه القائمة: هو مصدر
// `/~offline` نفسها وكل الأصول. محوه يترك الجهاز بلا شيء — وهذا هو الخطأ
// الذي كان في `sw-updater.tsx` (كان يمسح **كل** المخازن) وأُصلح معه.
// الثلاثة كلها تحفظ مستندات HTML وتعيش عبر النشرات — تحقّقت من محتواها فعلاً
// على بناء إنتاجي محلي (`text/html` داخل `pages` و`pages-cache`):
//   • `pages`       ← مخزن التنقّل الداخلي (`cacheOnFrontEndNav`) في `swe-worker`.
//     ⚠️ وهو **أخطرها**: يكتب الصفحة مرّة واحدة و`match` يمنع أي تحديث لاحق
//     (`if (await cache.match(url)) return;`) ⇒ يحتفظ بمستند بناء قديم بلا نهاية.
//   • `pages-cache` ← قاعدة NetworkFirst للتنقّل (تُحدَّث مع الشبكة، لكنها تبقى ٢٤ ساعة).
//   • `start-url`   ← مستند الفتح البارد من أيقونة التطبيق.
//   • `rsc-cache`   ← حمولات RSC لضغطات الروابط الداخلية (أُضيف 2026-09-09).
const STALE_HTML_CACHES = ['pages', 'pages-cache', 'start-url', 'rsc-cache'];

self.addEventListener('activate', (event: Event) => {
  const activateEvent = event as any;
  activateEvent.waitUntil(
    (self as any).caches
      .keys()
      .then((names: string[]) =>
        Promise.all(
          names
            .filter((n) => STALE_HTML_CACHES.includes(n))
            .map((n) => (self as any).caches.delete(n))
        )
      )
  );
});

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
