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
              تعذر الاتصال بخدمات Firebase. قد يكون السبب هو عدم اكتمال معلومات الربط في ملف الإعدادات.
            </p>
             <p className="mt-4 leading-relaxed">
             لحل المشكلة، يرجى مراجعة ملف <code>.env</code> والتأكد من إضافة القيم الصحيحة للمتغيرات التالية من إعدادات مشروعك في Firebase:
            </p>
            <ul className="my-2 list-disc list-inside rounded-md bg-slate-800/50 p-3 text-left font-mono text-sm text-slate-300">
                <li>NEXT_PUBLIC_FIREBASE_API_KEY</li>
                <li>NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN</li>
                <li>NEXT_PUBLIC_FIREBASE_PROJECT_ID</li>
                <li>NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET</li>
                <li>NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID</li>
                <li>NEXT_PUBLIC_FIREBASE_APP_ID</li>
            </ul>
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
