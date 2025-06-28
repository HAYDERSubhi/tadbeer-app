// src/app/(main)/layout.tsx
"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Loader2Icon, Terminal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, authError } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If not loading and no user is found, redirect to the login page.
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);


  // Show a loader while authentication state is being determined.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // Handle critical authentication configuration errors.
  if (authError) {
     return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في الاتصال بـ Firebase ({authError.code})</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              تعذر على التطبيق الاتصال بخدمات المصادقة في Firebase.
            </p>
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

  // If there is a user, render the main app shell.
  // The useEffect above will handle the case where the user logs out.
  if (user) {
    return (
      <AppShell>
        <div className="flex-1">
          {children}
        </div>
        <PageNavigation />
      </AppShell>
    );
  }

  // This is a fallback for the brief moment between the user state changing and the redirect effect firing.
  // Or for when the redirect is happening. It prevents a flash of unstyled content.
  return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
  );
}
