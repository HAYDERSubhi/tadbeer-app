// src/hooks/use-pwa-install.tsx
"use client";

import { useState, useEffect } from 'react';
import { useToast } from './use-toast';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

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
  const { toast } = useToast();

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      deferredPrompt = e as BeforeInstallPromptEvent;
      
      // Check if the toast has been shown before
      const hasSeenInstallPrompt = localStorage.getItem('hasSeenInstallPrompt');

      if (!hasSeenInstallPrompt) {
        // Show the install toast
        toast({
          title: "ثبّت التطبيق على جهازك!",
          description: "احصل على تجربة استخدام أفضل وأسرع بالوصول المباشر من شاشتك الرئيسية.",
          duration: 20000, // Make it stay longer
          action: (
            <Button
              onClick={() => {
                if (deferredPrompt) {
                  deferredPrompt.prompt();
                  deferredPrompt.userChoice.then(() => {
                    deferredPrompt = null;
                  });
                }
              }}
              className="mt-2 w-full sm:w-auto"
            >
              <Download className="ml-2 h-4 w-4" />
              تثبيت
            </Button>
          ),
        });
        localStorage.setItem('hasSeenInstallPrompt', 'true');
      }
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, [toast]);
};
