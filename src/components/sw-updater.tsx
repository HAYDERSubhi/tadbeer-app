'use client';

import { useEffect } from 'react';
import { reloadWhenIdle } from '@/lib/reload-when-idle';

// بصمة البناء — تتغير مع كل نشر على Vercel
const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'dev';
const STORAGE_KEY = 'tadbeer-build-id';

export function SWUpdater() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ── الشفاء الذاتي: عند تغيّر بصمة البناء، امسح كل الـ cache مرة واحدة ──
    const seen = localStorage.getItem(STORAGE_KEY);
    if (seen !== BUILD_ID) {
      localStorage.setItem(STORAGE_KEY, BUILD_ID);
      // أول تشغيل لهذا البناء على هذا الجهاز → نظّف المخزّن القديم
      if (seen !== null && 'caches' in window) {
        caches.keys()
          .then(keys => Promise.all(keys.map(k => caches.delete(k))))
          .then(() => reloadWhenIdle());
        return;
      }
    }

    if (!('serviceWorker' in navigator)) return;

    // إعادة تحميل فور استلام SW جديد للتحكم — مؤجّلة لحين إغلاق أي نافذة/معالج مفتوح
    const handleControllerChange = () => reloadWhenIdle();
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);

    // طلب فحص تحديثات SW عند كل فتح/عودة للتطبيق
    const checkForUpdate = () => {
      navigator.serviceWorker.getRegistration().then(reg => reg?.update());
    };
    checkForUpdate();

    const onVisible = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return null;
}
