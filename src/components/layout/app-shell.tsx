
"use client";

import Link from 'next/link';
import { Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { InstallBanner } from './install-banner';
import { IosInstallBanner } from './ios-install-banner';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { canInstall, requestInstall } = usePWAInstall();
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const handleInstall = async () => {
    setBannerDismissed(true);
    await requestInstall();
  };

  const showBanner = canInstall && !bannerDismissed;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full bg-primary shadow-sm" style={{ marginTop: '-1px', paddingTop: '1px' }}>
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <img
              src="/logo.png"
              alt="شعار تطبيق تدبير"
              style={{
                width: 38, height: 38,
                objectFit: 'contain',
                filter: 'brightness(0) invert(1)',
                flexShrink: 0,
              }}
            />
            <span className="text-white">تدبير</span>
          </Link>
          <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
            <Link href="/settings" aria-label="الإعدادات">
              <Settings className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </header>

      {children}

      {showBanner && (
        <InstallBanner
          onInstall={handleInstall}
          onDismiss={() => setBannerDismissed(true)}
        />
      )}
      {!showBanner && <IosInstallBanner />}
    </div>
  );
}
