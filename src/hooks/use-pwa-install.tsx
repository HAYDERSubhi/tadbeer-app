
// src/hooks/use-pwa-install.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';

// Define the event type, as it's not in standard TS libs yet
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: Array<string>;
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

export const usePWAInstall = () => {
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const beforeInstallHandler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    };

    const appInstalledHandler = () => {
      deferredPrompt = null;
      setCanInstall(false);
    };

    window.addEventListener('beforeinstallprompt', beforeInstallHandler);
    window.addEventListener('appinstalled', appInstalledHandler);

    // Check if the app is already installed on initial load
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setCanInstall(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', beforeInstallHandler);
      window.removeEventListener('appinstalled', appInstalledHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return;
    }
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      deferredPrompt = null;
      setCanInstall(false);
    }
  }, []);

  return { canInstall, handleInstall };
};
