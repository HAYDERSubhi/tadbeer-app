"use client";

import { useState, useEffect } from 'react';
import { X, MoreVertical, ChevronUp } from 'lucide-react';

/**
 * ينبّه المستخدمين القادمين من داخل متصفّح فيسبوك/إنستغرام المدمج (جمهور إعلانات Meta)
 * لفتح التطبيق في متصفّحهم الحقيقي — لأن التثبيت على الشاشة الرئيسية ودخول جوجل (النافذة
 * المنبثقة) لا يعملان بشكل موثوق داخل المتصفّحات المدمجة. قياس وتوجيه فقط، بلا أي تغيير
 * على منطق الدخول. يظهر مرة لكل جلسة، وقابل للإغلاق.
 */
export function OpenInBrowserBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    // المتصفّحات المدمجة الأكثر تأثيراً على تدبير: فيسبوك وإنستغرام (Meta).
    const isInAppBrowser = /FBAN|FBAV|FB_IAB|Instagram/i.test(ua);
    // إن كان التطبيق مثبّتاً (PWA/TWA) فلا حاجة للتنبيه.
    const isStandalone =
      (typeof window !== 'undefined' &&
        window.matchMedia?.('(display-mode: standalone)').matches) ||
      (navigator as any).standalone === true;
    const dismissed = sessionStorage.getItem('open-in-browser-dismissed');

    if (isInAppBrowser && !isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    try { sessionStorage.setItem('open-in-browser-dismissed', '1'); } catch {}
    setVisible(false);
  };

  return (
    <div
      className="fixed inset-x-0 top-0 z-[60] px-3 animate-in slide-in-from-top-2 duration-300"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
      role="alert"
      aria-label="افتح التطبيق في متصفّحك"
    >
      {/* سهم يشير لأعلى نحو زر ⋮ في شريط المتصفّح المدمج (أعلى اليمين) */}
      <div className="flex justify-start pr-3 pt-1" aria-hidden="true">
        <ChevronUp
          className="h-6 w-6 text-white animate-bounce drop-shadow"
          strokeWidth={3}
        />
      </div>

      <div className="flex items-start gap-3 rounded-2xl bg-primary px-4 py-3 shadow-xl">
        {/* الشعار */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <img src="/logo.png" alt="تدبير" className="h-7 w-7 object-contain" />
        </div>

        {/* النص — يلتفّ بأمان مع الخطوط الكبيرة */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-snug text-white">
            افتح تدبير في متصفّحك
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-white/90">
            للتثبيت ودخول جوجل بسلاسة، اضغط زر{' '}
            <MoreVertical className="inline-block h-4 w-4 align-text-bottom" aria-hidden="true" />
            {' '}بالأعلى ثم «فتح في المتصفّح»
          </p>
        </div>

        {/* إغلاق */}
        <button
          type="button"
          onClick={handleDismiss}
          className="-mr-1 mt-0.5 flex-shrink-0 rounded-full p-1.5 text-white/70 transition-colors active:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
