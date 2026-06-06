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
        'fixed top-0 left-0 right-0 z-[99] flex items-center justify-center gap-2 py-2 text-xs font-medium transition-all duration-300',
        isOffline
          ? 'bg-orange-500 text-white animate-in slide-in-from-top'
          : 'bg-green-500 text-white'
      )}
    >
      <WifiOff className={cn('h-3.5 w-3.5', !isOffline && 'hidden')} />
      {isOffline
        ? 'أنت غير متصل — يمكنك الاستمرار وسيتزامن عند عودة الإنترنت'
        : '✓ عاد الاتصال بالإنترنت'}
    </div>
  );
}
