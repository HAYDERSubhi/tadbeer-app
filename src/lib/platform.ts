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

/** معرّف حزمة تدبير على Google Play (TWA). */
export const PLAY_PACKAGE = 'app.tadbeer.www.twa';

/**
 * يفتح قسم التقييمات في تطبيق Google Play على أندرويد (وصفحة الويب لغيره).
 *
 * ⚠️ نسخة مشتركة للمواضع الجديدة (نافذة دعوة التقييم). زرّ «قيّم تدبير على المتجر» في
 * `settings/page.tsx` له نسخته الخاصة من المنطق نفسه (لم تُوحَّد: الملف بنهايات أسطر
 * CRLF فأي تعديل فيه يظهر كتغيير في كل أسطره). ⛔ لا تُبسِّطها إلى `market://` المجرَّدة —
 * سبب ذلك موثَّق في تعليق `handleRateClick` هناك (نافذة «Galaxy Store / Google Play»
 * على سامسونج). وأي تعديل هنا يوجب النظر في تلك النسخة أيضاً.
 */
export function openPlayReviews(): void {
  if (typeof window === 'undefined') return;
  if (!isAndroid()) {
    window.open(PLAY_STORE_URL, '_blank', 'noopener');
    return;
  }
  // لو غادرت الصفحة فقد التقط تطبيق المتجر الرابط — لا حاجة لخطة بديلة.
  let switchedAway = false;
  const markSwitched = () => { switchedAway = true; };
  window.addEventListener('pagehide', markSwitched, { once: true });
  window.addEventListener('blur', markSwitched, { once: true });

  window.location.href =
    `intent://details?id=${PLAY_PACKAGE}&showAllReviews=true` +
    `#Intent;scheme=market;package=com.android.vending` +
    `;S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end`;

  // شبكة أمان: متصفّح لا يفهم `intent://` لا يفعل شيئاً ولا يشغّل الـ fallback المدمج.
  setTimeout(() => {
    window.removeEventListener('pagehide', markSwitched);
    window.removeEventListener('blur', markSwitched);
    if (!switchedAway && document.visibilityState === 'visible') {
      window.location.href = PLAY_STORE_URL;
    }
  }, 1200);
}
