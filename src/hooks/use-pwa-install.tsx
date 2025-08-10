
// src/hooks/use-pwa-install.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define the event type, as it's not standard in all TS lib versions
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const usePWAInstall = () => {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    // 1. Register the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
             console.log('Service Worker registered with scope:', registration.scope)
             // After successful registration, check for notification permission
             if ('Notification' in window) {
                if (Notification.permission === 'default') {
                    // We don't request permission here automatically.
                    // The user will trigger it from the settings page.
                }
             }
        })
        .catch((error) => console.error('Service Worker registration failed:', error));
    }

    // 2. Listen for the install prompt event
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const typedEvent = event as BeforeInstallPromptEvent;
      setInstallPrompt(typedEvent);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 3. Listen for when the app is installed
    const handleAppInstalled = () => {
      setIsInstallable(false);
      setInstallPrompt(null);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = useCallback(async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA installation');
    } else {
      console.log('User dismissed the PWA installation');
    }
    
    setInstallPrompt(null);
    setIsInstallable(false);

  }, [installPrompt]);

  return { isInstallable, handleInstallClick };
};
