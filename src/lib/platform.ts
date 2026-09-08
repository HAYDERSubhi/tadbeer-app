// src/lib/platform.ts
// فحوص المنصّة المشتركة بين كل مواضع الترويج لـ Google Play.
//
// ⚠️ مصدر واحد للحقيقة عمداً: نفس الشرط يُستعمل في مكانين على الأقل
// (رابط صفحة التسجيل · لافتة داخل التطبيق). لو كُتب مرّتين لانحرف أحدهما عن
// الآخر بصمت، فظهر الترويج في موضع دون موضع بلا سبب مفهوم.
//
// كلاهما يُستدعى داخل useEffect لا وقت الرسم — لأن `navigator` و`window`
// غير موجودين على الخادم، والقرار المبني عليهما يُحدث اختلاف خادم/عميل.

/** جهاز أندرويد؟ (لا وجود لـ Google Play على آيفون، فترويجه هناك تشويش محض) */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent || '');
}

/**
 * التطبيق مفتوح كنسخة مثبَّتة؟ (PWA من المتصفّح أو TWA من المتجر — لا نفرّق
 * بينهما، وقد ثبت 2026-09-08 أن التفريق غير ممكن أصلاً).
 * من هو داخل نسخة مثبَّتة لا يُدعى لتثبيتها من جديد.
 */
export function isAppInstalled(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

/** هل نروّج متجر Play لهذا المستخدم الآن؟ أندرويد **و**غير مثبِّت. */
export function shouldPromotePlayStore(): boolean {
  return isAndroid() && !isAppInstalled();
}

/** صفحة تدبير على Google Play. */
export const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=app.tadbeer.www.twa';
