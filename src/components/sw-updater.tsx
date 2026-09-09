'use client';

import { useEffect } from 'react';
import { reloadWhenIdle } from '@/lib/reload-when-idle';

// بصمة البناء — تتغير مع كل نشر على Vercel
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const STORAGE_KEY = 'tadbeer-build-id';

export function SWUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── الشفاء الذاتي: عند تغيّر بصمة البناء، أسقِط مستندات HTML القديمة ──
    // ⛔ كان يمسح **كل** المخازن بما فيها الحفظ المسبق (`workbox-precache-*`)،
    // وهو مصدر `/~offline` وكل الأصول. فكان الجهاز يبقى **بلا أي مخزون** إلى أن
    // يُعيد عامل الخدمة تنزيل ~٤٫٦ م.ب — ومن قطع الشبكة في تلك الفجوة لم يجد
    // حتى صفحة «أنت غير متصل»، فرأى شاشة خطأ بيضاء (رُصد على هاتف صاحب المشروع
    // 2026-09-09). نحذف الآن مخزني HTML وحدهما، ونترك الحفظ المسبق لـ Workbox
    // يديره بنفسه — وهو يفعل ذلك صحيحاً عبر `cleanupOutdatedCaches`.
    // النظير في عامل الخدمة: `worker/index.ts` (يعمل حتى لو تعطّل جافاسكربت
    // الصفحة — وهذا هو الفرق: هذا الملف لا يعمل أصلاً حين تنكسر الصفحة).
    // الثلاثة نفسها المذكورة في `worker/index.ts` — أبقِهما متطابقتين.
    const STALE_HTML_CACHES = ['pages', 'pages-cache', 'start-url', 'rsc-cache'];
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== BUILD_ID) {
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      // أول تشغيل لهذا البناء على هذا الجهاز → أسقِط مستندات النسخة السابقة
      if (seen !== null && 'caches' in window) {
        caches.keys()
          .then(keys => Promise.all(
            keys.filter(k => STALE_HTML_CACHES.includes(k)).map(k => caches.delete(k))
          ))
          .then(() => reloadWhenIdle());
        return;
      }
    }

    if (!('serviceWorker' in navigator)) return;

    // إعادة تحميل فور استلام SW جديد للتحكم — مؤجّلة لحين إغلاق أي نافذة/معالج مفتوح
    const handleControllerChange = () => reloadWhenIdle();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // طلب فحص تحديثات SW عند كل فتح/عودة للتطبيق
    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then(reg => reg?.update());
    };
    checkForUpdate();

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
