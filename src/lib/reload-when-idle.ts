// src/lib/reload-when-idle.ts
// يؤجّل window.location.reload() إذا كانت هناك نافذة/شيت مفتوحة (Radix Dialog/Sheet)
// كي لا يقطع تحديث الـ Service Worker المستخدم بمنتصف تعبئة نموذج أو معالج الإعداد.
// ينتظر حتى تُغلق النافذة ثم يُعيد التحميل مرة واحدة فقط.

export function reloadWhenIdle() {
  if (typeof document === "undefined") return;

  const hasOpenDialog = () => !!document.querySelector('[role="dialog"]');

  if (!hasOpenDialog()) {
    window.location.reload();
    return;
  }

  const observer = new MutationObserver(() => {
    if (!hasOpenDialog()) {
      observer.disconnect();
      window.location.reload();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
