// src/lib/google-redirect.ts
// «عودة من جوجل قيد الإكمال» — علامة قصيرة العمر تمنع شاشة التسجيل من إظهار
// أزرارها للحظات بعد أن يختار المستخدم حسابه.
//
// لماذا (2026-11-14، فيديو المالك): الدخول بجوجل تحويلٌ كامل للصفحة. عند العودة
// يحتاج Firebase نحو ثلاث ثوانٍ ليُنهي getRedirectResult ويُحدّد المستخدم، وفي هذه
// المدة كانت الشاشة تعرض أزرار التسجيل من جديد ثم تقفز للرئيسية فجأة — فيظنّ
// المستخدم أن دخوله فشل. العلامة تُكتب قبل التحويل وتُمحى عند حسم النتيجة.
//
// ⛔ localStorage لا sessionStorage: العودة قد تفتح سياق تصفّح جديداً (TWA/Custom Tab).
// ⛔ تنتهي وحدها بعد ٤٥ ثانية: لا تُترك الشاشة عالقة على مؤشّر دوّار إن ضاعت النتيجة.
const KEY = 'tadbeer-google-redirect';
const TTL_MS = 45_000;
export const REDIRECT_SETTLED_EVENT = 'tadbeer-redirect-settled';

export function markGoogleRedirectPending(): void {
  try { localStorage.setItem(KEY, String(Date.now())); } catch {}
}

export function isGoogleRedirectPending(): boolean {
  try {
    const v = Number(localStorage.getItem(KEY));
    return v > 0 && Date.now() - v < TTL_MS;
  } catch { return false; }
}

export function clearGoogleRedirectPending(): void {
  try { localStorage.removeItem(KEY); } catch {}
  try { window.dispatchEvent(new Event(REDIRECT_SETTLED_EVENT)); } catch {}
}
