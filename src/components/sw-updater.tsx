'use client';

import { useEffect } from 'react';

// يُعيد تحميل الصفحة تلقائياً فور استلام Service Worker جديد للتحكم.
// هذا يضمن وصول التحديثات فوراً بدون تدخل يدوي من المستخدم.
export function SWUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleControllerChange = () => {
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
