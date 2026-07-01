"use client";

import { X } from 'lucide-react';

interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-3 animate-in slide-in-from-bottom-2 duration-300"
      role="banner"
      aria-label="تثبيت التطبيق"
    >
      <div className="flex items-center gap-3 rounded-2xl bg-primary px-4 py-4 shadow-xl">
        {/* Icon */}
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
          <img
            src="/logo.png"
            alt="تدبير"
            className="h-9 w-9 object-contain"
          />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold leading-tight text-white">تدبير</p>
          <p className="text-sm text-white/85 mt-0.5">أضف التطبيق لشاشتك الرئيسية</p>
        </div>

        {/* Install button */}
        <button
          onClick={onInstall}
          className="flex-shrink-0 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-primary transition-opacity active:opacity-70 shadow-sm"
        >
          تثبيت
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-full p-2 text-white/70 transition-colors active:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
