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
  const { user, loading, authError } = useAuth();

  // PRIORITY 1: Handle authentication errors. This is the most critical state.
  if (authError) {
    // A single, unified error message for any auth failure.
    // This is more robust since guessing the exact cause (network, config, etc.) is difficult.
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في الاتصال بـ Firebase ({authError.code})</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              تعذر على التطبيق الاتصال بخدمات المصادقة في Firebase. لقد حاولنا الحلول الشائعة دون جدوى.
            </p>
            <p className="mt-4 leading-relaxed">
              يرجى التحقق مرة أخرى من النقاط التالية بعناية:
            </p>
            <ul className="my-2 list-disc list-inside space-y-2 text-sm">
                <li>
                    <strong>صحة بيانات الإعداد في ملف <code>.env</code></strong>: تأكد من أن جميع قيم <code>NEXT_PUBLIC_FIREBASE_...</code> مطابقة تمامًا لما هو موجود في إعدادات مشروعك في Firebase.
                </li>
                 <li>
                    <strong>النطاقات المعتمدة (Authorized Domains)</strong>: في قسم المصادقة (Authentication) في لوحة تحكم Firebase، تأكد من أن <code>localhost</code> موجود ومفعّل.
                </li>
                 <li>
                    <strong>قيود مفتاح API</strong>: في لوحة تحكم Google Cloud (المرتبطة بمشروع Firebase)، تأكد من أن مفتاح API ليس عليه قيود تمنع استخدامه من نطاق <code>localhost</code>.
                </li>
            </ul>
            <pre className="mt-2 rounded-md bg-slate-800/50 p-3 text-left font-mono text-xs text-slate-400 overflow-x-auto">
                {authError.message}
            </pre>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // PRIORITY 2: If there's no error, show a loading indicator while we wait for auth state.
  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <Loader2Icon className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  // PRIORITY 3: If loading is done and there's no error, but also no user, it's a fallback failure state.
  if (!user) {
    return (
       <div className="flex h-screen w-full items-center justify-center p-4">
        <Alert variant="destructive">
          <AlertTitle>فشل التحقق من الهوية</AlertTitle>
          <AlertDescription>
             تعذر تسجيل الدخول. يرجى تحديث الصفحة والمحاولة مرة أخرى.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // If all checks pass, render the main app layout.
  return (
    <AppShell>
      <div className="flex-1">
        {children}
      </div>
      <PageNavigation />
    </AppShell>
  );
}
