
// src/app/(main)/layout.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Terminal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AppDataProvider } from '@/hooks/use-app-data';
import { FinancialChatSheet } from '@/components/chat/financial-chat-sheet';
import { PwaUpdateBanner } from '@/components/pwa-update-banner';
import { PullToRefresh } from '@/components/pull-to-refresh';
import { SplashScreen } from '@/components/splash-screen';
import { OfflineIndicator } from '@/components/offline-indicator';
import { useSmartNotifications } from '@/hooks/use-smart-notifications';
import { useBadges } from '@/hooks/use-badges';

// Inner component so useSmartNotifications can access AppDataProvider context
function NotificationsRunner() {
  useSmartNotifications();
  return null;
}

// Badge checker runs silently inside AppDataProvider
function BadgeChecker() {
  useBadges();
  return null;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, authError } = useAuth();
  const router = useRouter();

  // Redirect to login once auth settles and there's no user.
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Auth configuration error — show immediately, no shell needed.
  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في الاتصال بـ Firebase ({authError.code})</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">تعذر على التطبيق الاتصال بخدمات المصادقة في Firebase.</p>
            <pre className="mt-4 rounded-md bg-slate-800/50 p-3 text-left font-mono text-xs text-slate-400 overflow-x-auto">
              {authError.message}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ── KEY CHANGE ──────────────────────────────────────────────────────────────
  // Render the app shell IMMEDIATELY — no full-page loading screen.
  // AppShell and PageNavigation are pure UI (no data dependency).
  // AppDataProvider queries are gated on !!user so they don't fire until
  // auth resolves; the page content shows skeletons in the meantime.
  // This eliminates the jarring 3-phase sequence:
  //   OLD: loading-screen → blank → skeleton → content
  //   NEW: shell (instant) → skeleton in-place → content
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <AppDataProvider>
      {user && <NotificationsRunner />}
      {user && <BadgeChecker />}
      {user && <SplashScreen />}
      <PwaUpdateBanner />
      <OfflineIndicator />
      <PullToRefresh />
      <AppShell>
        <main className="flex-1 p-4 sm:p-6">
          {children}
        </main>
        <PageNavigation />
        <FinancialChatSheet />
      </AppShell>
    </AppDataProvider>
  );
}
