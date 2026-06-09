
// src/app/(main)/layout.tsx
"use client";

import { useEffect, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Terminal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AppDataProvider } from '@/hooks/use-app-data';
import { FinancialChatSheet } from '@/components/chat/financial-chat-sheet';
import { PwaUpdateBanner } from '@/components/pwa-update-banner';
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

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background animate-in fade-in duration-300">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
            <img src="/logo.png" alt="شعار تطبيق تدبير" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'contain' }} />
          </div>
          <h1 className="text-2xl font-bold text-primary tracking-wide">تدبير</h1>
          <div className="flex gap-1.5 mt-1">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/40 animate-bounce [animation-delay:0ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
            <span className="w-1.5 h-1.5 rounded-full bg-primary/80 animate-bounce [animation-delay:300ms]" />
          </div>
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في الاتصال بـ Firebase ({authError.code})</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">تعذر على التطبيق الاتصال بخدمات المصادقة في Firebase.</p>
            <p className="mt-4 leading-relaxed">
              يرجى التحقق من صحة بيانات الإعداد في ملف <code>.env</code> والتأكد من عدم وجود قيود على مفتاح API الخاص بك في Google Cloud.
            </p>
            <pre className="mt-4 rounded-md bg-slate-800/50 p-3 text-left font-mono text-xs text-slate-400 overflow-x-auto">
              {authError.message}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (user) {
    return (
      <AppDataProvider>
        <NotificationsRunner />
        <BadgeChecker />
        <PwaUpdateBanner />
        <OfflineIndicator />
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

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm">
          <img src="/logo.png" alt="شعار تطبيق تدبير" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'contain' }} />
        </div>
        <h1 className="text-2xl font-bold text-primary tracking-wide">تدبير</h1>
      </div>
    </div>
  );
}
