// src/hooks/use-sw-update.tsx
// Detects when a new service worker has taken control and reloads the page
// so users always see the latest version automatically.
"use client";

import { useEffect } from 'react';
import { reloadWhenIdle } from '@/lib/reload-when-idle';

export function useSwUpdate() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    // When a new SW activates and claims this client, reload once —
    // لكن نؤجّل لحين إغلاق أي نافذة/معالج مفتوح (لا نقطع onboarding أو نموذج نشط).
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      reloadWhenIdle();
    });

    // Also check for a waiting SW on mount and activate it immediately.
    navigator.serviceWorker.ready.then(reg => {
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed and waiting — activate it now.
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });
    });
  }, []);
}
