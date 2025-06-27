// src/app/(main)/layout.tsx
"use client";

import { useAuth } from '@/hooks/use-auth';
import AppShell from '@/components/layout/app-shell';
import PageNavigation from '@/components/layout/page-navigation';
import { Loader2Icon, Terminal, ShieldAlert } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, authError } = useAuth();

  // PRIORITY 1: Handle authentication errors. This is the most critical state.
  if (authError) {
    // Specific, helpful message for network errors, which are often caused by unauthorized domains.
    if (authError.code === 'auth/network-request-failed') {
       return (
        <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
          <Alert variant="destructive" className="max-w-2xl text-right">
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>خطأ في الاتصال بـ Firebase</AlertTitle>
            <AlertDescription>
              <p className="leading-relaxed">
                فشل الاتصال بخوادم المصادقة. غالبًا ما يحدث هذا الخطأ لأن النطاق الذي يعمل عليه التطبيق (مثل localhost) غير مضاف إلى قائمة "النطاقات المعتمدة" في مشروع Firebase الخاص بك.
              </p>
              <p className="mt-4 leading-relaxed">
                لحل المشكلة، يرجى اتباع الخطوات التالية:
              </p>
              <ol className="my-2 list-decimal list-inside space-y-2 rounded-md bg-slate-800/50 p-4 text-left text-slate-300">
                  <li>اذهب إلى لوحة تحكم Firebase وانتقل إلى قسم <strong>Authentication</strong>.</li>
                  <li>اضغط على زر <strong>Get started</strong>.</li>
                  <li>اختر تبويب <strong>Settings</strong>.</li>
                  <li>ضمن <strong>Authorized domains</strong>, اضغط على <strong>Add domain</strong> وأضف <code>localhost</code>.</li>
              </ol>
               <p className="leading-relaxed">
                  بعد إضافة النطاق، يرجى تحديث هذه الصفحة.
              </p>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // Default error message for other auth errors (like invalid API key or missing config).
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>خطأ في إعدادات Firebase ({authError.code})</AlertTitle>
          <AlertDescription>
            <p className="leading-relaxed">
              تعذر الاتصال بخدمات Firebase. قد يكون السبب هو عدم اكتمال معلومات الربط في ملف الإعدادات أو وجود خطأ في التكوين.
            </p>
             <p className="mt-4 leading-relaxed">
             لحل المشكلة، يرجى مراجعة ملف <code>.env</code> والتأكد من أن جميع القيم التي أضفتها من إعدادات مشروعك في Firebase صحيحة.
            </p>
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
