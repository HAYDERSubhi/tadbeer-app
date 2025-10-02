// src/hooks/use-pwa-install.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';
import { useAppData } from './use-app-data'; // Import useAppData

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
  
  // Get user settings to check if reminders are enabled
  const { userSettings } = useAppData();

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
  
  // This effect handles the notification logic
  useEffect(() => {
    // Ensure this runs only on the client
    if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
        return;
    }

    const reminderEnabled = userSettings?.notifications?.dailyReminderEnabled;

    if (!reminderEnabled) {
      return;
    }
    
    const checkAndSendNotification = async () => {
        if (Notification.permission === 'granted') {
            const registration = await navigator.serviceWorker.ready;
            
            const now = new Date();
            const targetTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 20, 0, 0, 0); // 8:00 PM today

            // If it's already past 8 PM, schedule for tomorrow
            if (now > targetTime) {
                targetTime.setDate(targetTime.getDate() + 1);
            }
            
            const delay = targetTime.getTime() - now.getTime();

            // Clear any existing reminders before setting a new one
            await registration.getNotifications({ tag: 'daily-reminder' }).then(notifications => {
                notifications.forEach(notification => notification.close());
            });
            
            // This timeout is a simple way to schedule. A more robust solution might use a service worker with alarms.
            // For this app's purpose, this client-side scheduling is sufficient.
            setTimeout(() => {
                registration.showNotification('لا تنس تسجيل مصاريفك!', {
                    body: 'خصص دقيقة لتسجيل مصاريفك اليومية في تطبيق تدبير.',
                    icon: '/icons/icon-192x192.png',
                    tag: 'daily-reminder', // A tag to prevent multiple notifications
                    renotify: true,
                });
                // After showing, schedule for the next day
                checkAndSendNotification(); 
            }, delay);
            
        } else if (Notification.permission === 'default') {
            // This is handled in settings, but as a fallback:
            Notification.requestPermission();
        }
    };
    
    checkAndSendNotification();

  }, [userSettings?.notifications?.dailyReminderEnabled]);

  return { canInstall: !!installPrompt, requestInstall: handleInstallClick };
};
