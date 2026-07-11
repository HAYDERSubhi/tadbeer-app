"use client";

import { useState, useEffect } from 'react';
import { X, MoreVertical, ExternalLink } from 'lucide-react';

/**
 * ينبّه المستخدمين القادمين من داخل متصفّح فيسبوك/إنستغرام المدمج (جمهور إعلانات Meta)
 * لفتح التطبيق في متصفّحهم الحقيقي — لأن دخول جوجل والتثبيت لا يعملان بشكل موثوق داخل
 * المتصفّحات المدمجة. توجيه فقط، بلا أي تغيير على منطق الدخول. بطاقة بيضاء ضمن تدفّق
 * الصفحة (لا تتراكب مع المحتوى)، مرة لكل جلسة، وقابلة للإغلاق.
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
      className="px-3 pt-3 animate-in fade-in slide-in-from-top-1 duration-300"
      role="alert"
      aria-label="افتح في المتصفّح"
    >
      <div className="flex items-center gap-2.5 rounded-xl border border-black/5 bg-white px-3 py-2.5 shadow-lg">
        {/* أيقونة "فتح خارجي" */}
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ExternalLink className="h-4 w-4" strokeWidth={2.5} />
        </div>

        {/* نص قصير — يلتفّ بأمان مع الخطوط الكبيرة */}
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-gray-800">
          <span className="font-bold">للدخول:</span> اضغط{' '}
          <MoreVertical className="inline-block h-4 w-4 align-text-bottom text-primary" aria-hidden="true" />
          {' '}بالأعلى ثم «فتح في المتصفّح»
          <span className="text-gray-400"> · Open in Chrome</span>
        </p>

        {/* إغلاق */}
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-full p-1 text-gray-400 transition-colors active:bg-gray-100"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
