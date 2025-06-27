// src/app/(main)/layout.tsx
"use client";

import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Loader2Icon, Terminal } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  // While checking for auth state, show a spinner.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // If loading is done and there's still no user, it means Firebase is not configured correctly.
  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في إعدادات Firebase</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              تعذر الاتصال بخدمات Firebase. قد يكون السبب هو عدم وجود مفتاح API صالح أو مشكلة في الإعدادات.
            </p>
            <p className="mt-2 leading-relaxed">
              نتيجة لذلك، تم تعطيل المزامنة السحابية وجميع ميزات حفظ البيانات. يرجى مراجعة إعدادات Firebase في ملف <code>.env</code> والتأكد من صحتها.
            </p>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If there is a user, render the main app layout.
  return (
    <AppShell>
      <div className="flex-1">
        {children}
      </div>
      <PageNavigation />
    </AppShell>
  );
}
