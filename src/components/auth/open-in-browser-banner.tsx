"use client";

import { useState, useEffect } from 'react';
import { Star, ExternalLink, Copy, Check } from 'lucide-react';

type Platform = 'android' | 'ios' | null;

/** شعار Chrome الملوّن الرسمي */
const ChromeLogo = () => (
  <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
    <path d="M10.144 16 A16 16 0 0 1 37.856 16" fill="none" stroke="#EA4335" strokeWidth="9" strokeLinecap="butt" />
    <path d="M37.856 16 A16 16 0 0 1 24 40" fill="none" stroke="#FBBC05" strokeWidth="9" strokeLinecap="butt" />
    <path d="M24 40 A16 16 0 0 1 10.144 16" fill="none" stroke="#34A853" strokeWidth="9" strokeLinecap="butt" />
    <circle cx="24" cy="24" r="10.5" fill="#fff" />
    <circle cx="24" cy="24" r="8" fill="#4285F4" />
  </svg>
);

/** شعار Safari (بوصلة زرقاء بإبرة حمراء) */
const SafariLogo = () => (
  <svg width="24" height="24" viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="21" fill="#1e88e5" />
    <circle cx="24" cy="24" r="18" fill="#fff" />
    <path d="M33 15 L29 29 L19 19 Z" fill="#ff5150" />
    <path d="M15 33 L29 29 L19 19 Z" fill="#d7dde3" />
    <circle cx="24" cy="24" r="1.8" fill="#1e88e5" />
  </svg>
);

/**
 * يظهر فقط داخل متصفّح إنستغرام/فيسبوك المدمج (WebView) — حيث يتعذّر تثبيت التطبيق.
 * أندرويد: زر يفتح Chrome مباشرة عبر intent://.
 * آيفون: زر ينسخ الرابط للصقه في Safari (آبل لا تسمح بالفتح التلقائي).
 * في المتصفّحات العادية (Chrome/Safari/أوبرا...) لا يظهر شيء إطلاقاً.
 */
export function OpenInBrowserBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    const ua = navigator.userAgent || '';
    const inApp = /FBAN|FBAV|FB_IAB|Instagram/i.test(ua);
    if (!inApp) return;
    if (/iPhone|iPad|iPod/i.test(ua)) setPlatform('ios');
    else if (/Android/i.test(ua)) setPlatform('android');
    else setPlatform('ios'); // افتراضياً طريقة النسخ (تعمل في كل مكان)
  }, []);

  if (!platform) return null;

  const isAndroid = platform === 'android';
  const browser = isAndroid ? 'Chrome' : 'Safari';

  const openInChrome = () => {
    const url = window.location.href;
    const noScheme = url.replace(/^https?:\/\//, '');
    window.location.href =
      `intent://${noScheme}#Intent;scheme=https;package=com.android.chrome;` +
      `S.browser_fallback_url=${encodeURIComponent(url)};end`;
  };

  const copyLink = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="space-y-3">
      {/* بطاقة الخروج للمتصفّح */}
      <div className="rounded-[14px] bg-amber-50 border border-amber-200 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="inline-flex items-center gap-1 bg-teal-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full">
            <Star className="h-3 w-3" /> موصى به
          </span>
          {isAndroid ? <ChromeLogo /> : <SafariLogo />}
        </div>

        <p className="text-[13px] font-semibold text-amber-900 leading-snug mb-2.5">
          لتثبيت التطبيق والتجربة الكاملة، افتحه في {browser}
        </p>

        {isAndroid ? (
          <button
            type="button"
            onClick={openInChrome}
            className="w-full h-11 rounded-[12px] bg-teal-600 hover:bg-teal-700 active:scale-[0.99] text-white text-[15px] font-semibold flex items-center justify-center gap-2 transition-all"
          >
            <ExternalLink className="h-[18px] w-[18px]" /> افتح في Chrome
          </button>
        ) : (
          <button
            type="button"
            onClick={copyLink}
            className="w-full h-11 rounded-[12px] bg-white border border-amber-300 active:scale-[0.99] text-amber-900 text-[13px] font-semibold flex items-center justify-center gap-2 transition-all"
          >
            {copied
              ? <><Check className="h-4 w-4 text-teal-600" /> تم النسخ — الصقه في Safari</>
              : <><Copy className="h-4 w-4" /> انسخ الرابط والصقه في Safari</>}
          </button>
        )}
      </div>

      {/* فاصل */}
      <div className="flex items-center gap-2">
        <span className="flex-1 h-px bg-white/35" />
        <span className="text-white/90 text-xs">أو أكمل من هنا</span>
        <span className="flex-1 h-px bg-white/35" />
      </div>
    </div>
  );
}
