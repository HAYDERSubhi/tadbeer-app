
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
      <div className="flex h-screen w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <img src="/logo.png" alt="شعار تطبيق تدبير" width={80} height={80} style={{ width: 80, height: 80, objectFit: 'contain' }} />
          <h1 className="text-3xl font-bold text-primary">تدبير</h1>
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
        <PwaUpdateBanner />
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
    <div className="flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center gap-4 animate-pulse">
        <img src="/logo.png" alt="شعار تطبيق تدبير" width={80} height={80} style={{ width: 80, height: 80, objectFit: 'contain' }} />
        <h1 className="text-3xl font-bold text-primary">تدبير</h1>
      </div>
    </div>
  );
}
