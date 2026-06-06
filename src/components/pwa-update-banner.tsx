// src/components/pwa-update-banner.tsx
"use client";

import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function PwaUpdateBanner() {
  const [waitingSW, setWaitingSW] = useState<ServiceWorker | null>(null);
  const [visible, setVisible] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    const checkForWaiting = (reg: ServiceWorkerRegistration) => {
      if (reg.waiting) {
        setWaitingSW(reg.waiting);
        setVisible(true);
      }
    };

    navigator.serviceWorker.ready.then((reg) => {
      // Already waiting when page loaded
      checkForWaiting(reg);

      // New SW found and installed while page is open
      reg.addEventListener('updatefound', () => {
        const newSW = reg.installing;
        if (!newSW) return;
        newSW.addEventListener('statechange', () => {
          if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingSW(newSW);
            setVisible(true);
          }
        });
      });
    });

    // Listen for the controlling SW to change → reload to get fresh content
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const handleUpdate = () => {
    if (!waitingSW) return;
    setUpdating(true);
    // Tell the waiting SW to skip waiting → triggers controllerchange → reload
    waitingSW.postMessage({ type: 'SKIP_WAITING' });
  };

  if (!visible) return null;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-[100]',
        'flex items-center justify-between gap-3',
        'bg-primary text-primary-foreground',
        'px-4 py-2.5 shadow-md',
        'animate-in slide-in-from-top duration-300'
      )}
    >
      <div className="flex items-center gap-2 text-xs font-medium">
        <RefreshCw className={cn('h-4 w-4 shrink-0', updating && 'animate-spin')} />
        <span>يوجد تحديث جديد للتطبيق</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 px-3 text-xs font-bold"
          onClick={handleUpdate}
          disabled={updating}
        >
          {updating ? 'جاري التحديث...' : 'تحديث الآن'}
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
          onClick={() => setVisible(false)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
