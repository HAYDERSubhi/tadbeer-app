// src/hooks/use-pwa-install.tsx
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
      setInstallPrompt(e as BeforeInstallGpromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) {
      // This is a fallback for browsers that don't support the install prompt
      // or if the app is already installed.
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
  
  // This separate effect handles notification permission logic
  useEffect(() => {
    // Only run this logic once on component mount in a client-side context
    if (typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'default') {
        // We could proactively ask for permission here, but it's better UX
        // to ask when the user tries to enable a feature.
        // For now, we do nothing and let the settings page handle the request.
      }
    }
  }, []);

  return { canInstall: !!installPrompt, requestInstall: handleInstallClick };
};
