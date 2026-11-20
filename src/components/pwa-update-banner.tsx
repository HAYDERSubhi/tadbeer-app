// src/components/pwa-update-banner.tsx
"use client";

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { reloadWhenIdle } from '@/lib/reload-when-idle';

// مؤشر «جارٍ تحديث التطبيق» — يظهر **عند بداية** تنزيل النسخة الجديدة لا عند نهايته.
//
// كان يظهر فقط حين تكتمل النسخة الجديدة (`installed`)، وتنزيلها صامت ويطول على شبكة
// الهاتف — فكان المستخدم لا يرى شيئاً دقيقة كاملة ثم يظهر شريط ثم تُعاد الصفحة
// (رصده المالك على هاتفه 2026-11-20: «ليس أول الفتح ولكن بعدها بدقيقة»).
// وزرّ «تحديث الآن» القديم كان بلا وظيفة: الإعداد `skipWaiting: true` يُفعِّل النسخة
// الجديدة وحدها فلا تبقى «بانتظار» أبداً. فصار المؤشر إعلاماً فقط: لا أزرار، ولا
// يحجب شيئاً (`pointer-events-none`)، شارة صغيرة وسط الأعلى لا شريطاً يغطّي الهيدر.
//
// ⛔ لا يظهر عند **أول تثبيت** لعامل الخدمة (لا `controller` بعد): ذاك ليس تحديثاً.
// ⛔ إعادة التحميل بعد التفعيل ليست هنا فقط: `use-sw-update` و`sw-updater` يستمعان
//    للحدث نفسه (`controllerchange`) — هذا المكوّن يعرض الحالة ولا يُغيّرها.
type Phase = 'idle' | 'downloading' | 'applying';

export function PwaUpdateBanner() {
  const [phase, setPhase] = useState<Phase>('idle');

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    const set = (p: Phase) => { if (!cancelled) setPhase(p); };
    // هل كان للصفحة عامل خدمة يتحكّم بها عند الفتح؟ بدونه فكل ما يحدث **أول تثبيت** لا تحديث.
    const hadController = !!navigator.serviceWorker.controller;

    const track = (sw: ServiceWorker) => {
      // لا مؤشر لأول تثبيت: هناك لا يوجد عامل قائم يتحكّم بالصفحة بعد.
      if (!navigator.serviceWorker.controller) return;
      const apply = () => {
        if (sw.state === 'installed' || sw.state === 'activating' || sw.state === 'activated') set('applying');
        else if (sw.state === 'redundant') set('idle'); // فشل التنزيل/أُلغي
        else set('downloading');
      };
      apply();
      sw.addEventListener('statechange', apply);
    };

    const onUpdateFound = (reg: ServiceWorkerRegistration) => () => {
      if (reg.installing) track(reg.installing);
    };

    let regRef: ServiceWorkerRegistration | null = null;
    let handler: (() => void) | null = null;

    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      regRef = reg;
      // تحديث بدأ قبل أن نُصغي (سباق قصير عند الفتح)
      if (reg.installing) track(reg.installing);
      handler = onUpdateFound(reg);
      reg.addEventListener('updatefound', handler);
    });

    // العامل الجديد تولّى التحكّم ⇒ ستُعاد الصفحة (تؤجَّلها `reloadWhenIdle` إن كانت نافذة مفتوحة).
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      if (hadController) set('applying'); // أول تثبيت: يُعاد التحميل (سلوك قديم) بلا مؤشر
      reloadWhenIdle();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      if (regRef && handler) regRef.removeEventListener('updatefound', handler);
    };
  }, []);

  if (phase === 'idle') return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[100] flex justify-center"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }}
    >
      <div
        role="status"
        aria-live="polite"
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1.5',
          'bg-primary text-primary-foreground text-xs font-medium shadow-md',
          'animate-in fade-in slide-in-from-top-2 duration-300'
        )}
      >
        <RefreshCw className="h-3.5 w-3.5 shrink-0 animate-spin" />
        <span>{phase === 'applying' ? 'اكتمل التحديث، جارٍ التطبيق…' : 'جارٍ تحديث التطبيق…'}</span>
      </div>
    </div>
  );
}
