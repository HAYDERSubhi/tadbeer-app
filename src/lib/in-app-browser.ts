// src/lib/in-app-browser.ts
// كشف المتصفّحات المدمجة (فيسبوك/إنستغرام/Android WebView الخام) —
// سياسة Google تمنع دخول OAuth داخلها نهائياً (disallowed_useragent)،
// فلا جدوى من محاولة popup أو redirect هناك: نرشد المستخدم للخروج بدلها.
// ملاحظة: تطبيق TWA (متجر Play) يعمل عبر Chrome Custom Tab بمعرّف Chrome
// الطبيعي (لا يحمل "; wv)") فلا يتأثر بهذا الكشف.
export function isInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /FBAN|FBAV|FB_IAB|Instagram|; wv\)/i.test(navigator.userAgent || '');
}
