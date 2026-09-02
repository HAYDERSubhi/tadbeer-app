// src/hooks/use-pwa-install.tsx
// وظيفته الوحيدة: زر «ثبّت التطبيق» (beforeinstallprompt).
//
// كان هنا نظام تذكير ثالث يرسل «لا تنس تسجيل مصاريفك!» الساعة الثامنة مساءً
// وأُزيل عمداً. أسبابه:
//   • لم يكن يفحص إطلاقاً هل سجّل المستخدم اليوم — يرسل بلا شرط، وهو ذاته
//     العطل الذي صُحّح في مهمة الخادم وفي use-smart-notifications.
//   • كان الوحيد الذي يرسل عبر registration.showNotification، أي الوحيد الذي
//     يصل أجهزة أندرويد فعلاً — فكان أوسع الثلاثة أثراً وأقلّها صحّة.
//   • مؤقّته بلا تنظيف: تبديل الإعداد يراكم مؤقّتات، وهو يعيد جدولة نفسه بلا
//     نهاية ما دامت الصفحة مفتوحة.
//   • مهمة الخادم (api/push/send) تؤدّي الغرض وتزيد: تصل والتطبيق مغلق،
//     وتفحص التسجيل، وتحترم الوقت الذي اختاره المستخدم بدل فرض الثامنة.
// طلب إذن الإشعارات مغطّى في الإعدادات و use-push-notifications و
// use-smart-notifications، فلم يُفقَد بالحذف.
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  const { toast } = useToast();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) {
      toast({
        title: "التطبيق مثبت بالفعل",
        description: "يمكنك إضافة التطبيق إلى شاشتك الرئيسية من قائمة المتصفح.",
      });
      return;
    }
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      toast({ title: "تم التثبيت بنجاح!", description: "تمت إضافة تدبير إلى شاشتك الرئيسية." });
    }
    setInstallPrompt(null);
  }, [installPrompt, toast]);

  return { canInstall: !!installPrompt, requestInstall: handleInstallClick };
};
