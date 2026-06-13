'use client';

import { useEffect } from 'react';

export function SWUpdater() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // إعادة تحميل فور استلام SW جديد للتحكم
    const handleControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // طلب التحقق من تحديثات SW فوراً عند كل فتح للتطبيق
    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then(reg => {
        if (reg) reg.update();
      });
    };

    checkForUpdate(); // فحص فوري عند التحميل
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    });

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  return null;
}
