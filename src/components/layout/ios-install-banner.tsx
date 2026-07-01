"use client";

import { useState, useEffect } from 'react';
import { X, Share, ChevronDown } from 'lucide-react';

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    const dismissed = sessionStorage.getItem('ios-banner-dismissed');

    if (isIos && !isStandalone && !dismissed) {
      const t = setTimeout(() => setVisible(true), 2500);
      return () => clearTimeout(t);
    }
  }, []);

  if (!visible) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('ios-banner-dismissed', '1');
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 animate-in slide-in-from-bottom-2 duration-300"
      role="banner"
      aria-label="تثبيت التطبيق على iPhone"
    >
      <div className="flex items-start gap-3 rounded-2xl bg-primary px-4 py-4 shadow-xl">
        {/* Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <img src="/logo.png" alt="تدبير" className="h-9 w-9 object-contain" />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-white">ثبّت تدبير على جهازك</p>
          <p className="mt-1 text-sm leading-relaxed text-white/90">
            اضغط على{' '}
            <Share className="inline-block h-4 w-4 align-middle mx-0.5" />
            {' '}ثم اختر{' '}
            <span className="font-semibold">"أضف إلى الشاشة الرئيسية"</span>
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="mt-0.5 flex-shrink-0 rounded-full p-2 text-white/70 active:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* سهم نابض يشير لأسفل نحو زر المشاركة في شريط Safari السفلي */}
      <div className="flex justify-center mt-1" aria-hidden="true">
        <ChevronDown className="h-7 w-7 text-primary animate-bounce drop-shadow" strokeWidth={3} />
      </div>
    </div>
  );
}
