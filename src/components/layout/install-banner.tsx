"use client";

import { useState } from 'react';
import { X } from 'lucide-react';

interface InstallBannerProps {
  onInstall: () => void;
  onDismiss: () => void;
}

export function InstallBanner({ onInstall, onDismiss }: InstallBannerProps) {
  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2 animate-in slide-in-from-bottom-2 duration-300"
      role="banner"
      aria-label="تثبيت التطبيق"
    >
      <div className="flex items-center gap-3 rounded-xl bg-primary px-3 py-2.5 shadow-lg">
        {/* Icon */}
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white">
          <img
            src="/logo.png"
            alt="تدبير"
            className="h-7 w-7 object-contain"
          />
        </div>

        {/* Text */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight text-white">تدبير</p>
          <p className="truncate text-xs text-white/80">أضف التطبيق لشاشتك الرئيسية</p>
        </div>

        {/* Install button */}
        <button
          onClick={onInstall}
          className="flex-shrink-0 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-primary transition-opacity active:opacity-70"
        >
          تثبيت
        </button>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="flex-shrink-0 rounded-full p-1 text-white/70 transition-colors active:bg-white/20"
          aria-label="إغلاق"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
