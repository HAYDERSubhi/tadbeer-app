// src/components/offline-indicator.tsx
"use client";

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const update = () => {
      const offline = !navigator.onLine;
      setIsOffline(offline);
      if (offline) setShowBanner(true);
      // Hide banner 3 seconds after coming back online
      else setTimeout(() => setShowBanner(false), 3000);
    };

    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!showBanner) return null;

  return (
    <div
      className={cn(
        // ⚠️ **ليس `fixed`** — كان `fixed top-0 z-[99]` فيطفو **فوق** هيدر التطبيق
        // (`sticky top-0 z-50`) ويقصّ الشعار والأيقونات. رصده صاحب المشروع في
        // لقطة من هاتفه 2026-09-08. الآن يُركَّب **داخل** الهيدر فوق صفّه، فيدفعه
        // للأسفل بدل تغطيته، ويرث حشوة `env(safe-area-inset-top)` من الهيدر نفسه.
        'flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all duration-300',
        isOffline
          ? 'bg-orange-500 text-white animate-in slide-in-from-top'
          : 'bg-green-500 text-white'
      )}
    >
      <WifiOff className={cn('h-3.5 w-3.5', !isOffline && 'hidden')} />
      {/* ⚠️ لا تُعِد «يمكنك الاستمرار وسيتزامن عند عودة الإنترنت»: كانت وعداً
          كاذباً — لم يكن المستخدم يستطيع بلوغ أي شاشة أخرى أصلاً بلا إنترنت. */}
      {isOffline
        ? 'أنت غير متصل — بياناتك محفوظة'
        : '✓ عاد الاتصال بالإنترنت'}
    </div>
  );
}
