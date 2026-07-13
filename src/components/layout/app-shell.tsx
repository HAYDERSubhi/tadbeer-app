
"use client";

import Link from 'next/link';
import { Settings, Share2, Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import React, { useState } from 'react';
import { usePWAInstall } from '@/hooks/use-pwa-install';
import { InstallBanner } from './install-banner';
import { IosInstallBanner } from './ios-install-banner';
import { LoggingStreakBanner } from '@/components/dashboard/logging-streak-banner';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useAuth } from '@/hooks/use-auth';
import { useNotificationsFeed, markNotificationsSeen } from '@/hooks/use-notifications-feed';
import { NotificationsSheet } from '@/components/notifications/notifications-sheet';
import { cn } from '@/lib/utils';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { canInstall, requestInstall } = usePWAInstall();
  const { user } = useAuth();
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { notifications, unreadCount } = useNotificationsFeed();
  usePushNotifications();

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) sessionStorage.setItem('tadbeer-ref', ref);
  }, []);

  const handleOpenNotif = () => {
    setNotifOpen(true);
    markNotificationsSeen();
  };

  const handleInstall = async () => {
    setBannerDismissed(true);
    await requestInstall();
  };

  const showBanner = canInstall && !bannerDismissed;

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 w-full bg-primary shadow-md" style={{ marginTop: '-1px', paddingTop: 'calc(1px + env(safe-area-inset-top))' }}>
        <div className="flex h-16 items-center justify-between px-5 sm:px-7">
          <Link href="/" className="flex items-center gap-3 text-xl font-semibold">
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

          <div className="flex items-center gap-1">
            {/* زر الإشعارات */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20 relative"
              aria-label="الإشعارات"
              onClick={handleOpenNotif}
            >
              <Bell className="h-5 w-5" strokeWidth={2.75} />
              {unreadCount > 0 && (
                <span className={cn(
                  "absolute top-1.5 right-1.5 flex items-center justify-center rounded-full bg-white text-primary font-bold leading-none",
                  unreadCount > 9
                    ? "h-4 w-4 text-[9px]"
                    : "h-3.5 w-3.5 text-[8px]"
                )}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Button>

            {/* زر المشاركة */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              aria-label="مشاركة التطبيق"
              onClick={() => {
                if (navigator.share) {
                  const shareUrl = user ? `https://www.tadbeer.app?ref=${user.uid}` : 'https://www.tadbeer.app';
                  navigator.share({
                    title: 'تدبير — تطبيقك المالي الذكي',
                    text: '🌴 جرّب تدبير — تطبيق إدارة المصاريف الذكي\n\nتتبّع إنفاقك، حدّد ميزانيتك، وحقّق أهدافك المالية بسهولة وبالعربية 💰',
                    url: shareUrl,
                  }).catch(() => {});
                } else {
                  const shareUrl = user ? `https://www.tadbeer.app?ref=${user.uid}` : 'https://www.tadbeer.app';
                  navigator.clipboard?.writeText(shareUrl).catch(() => {});
                }
              }}
            >
              <Share2 className="h-5 w-5" strokeWidth={2.75} />
            </Button>

            {/* زر الإعدادات */}
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" asChild>
              <Link href="/settings" aria-label="الإعدادات">
                <Settings className="h-5 w-5" strokeWidth={2.75} />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <LoggingStreakBanner />

      {children}

      <NotificationsSheet
        open={notifOpen}
        onOpenChange={setNotifOpen}
        notifications={notifications}
      />

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
