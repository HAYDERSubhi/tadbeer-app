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
    let errorTitle: string;
    let errorMessage: React.ReactNode;

    switch (authError.code) {
      case 'auth/admin-restricted-operation':
        errorTitle = `خطأ في المصادقة: عملية محظورة (${authError.code})`;
        errorMessage = (
          <>
            <p className="leading-relaxed">
              رفض Firebase طلب المصادقة المجهولة. هذا عادة يعني أن طريقة تسجيل الدخول هذه غير مفعلة في مشروعك.
            </p>
            <p className="mt-4 font-bold leading-relaxed">
              لحل المشكلة، يرجى اتباع الخطوات التالية:
            </p>
            <ol className="my-2 list-decimal list-inside space-y-3">
              <li>
                اذهب إلى <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline">لوحة تحكم Firebase</a> واختر مشروعك.
              </li>
              <li>
                من القائمة الجانبية، اذهب إلى <strong>Authentication</strong>.
              </li>
              <li>
                إذا كانت هذه المرة الأولى، اضغط على زر <strong>Get started</strong>.
              </li>
              <li>
                انتقل إلى تبويب <strong>Sign-in method</strong> (طرق تسجيل الدخول).
              </li>
              <li>
                في قائمة "Sign-in providers"، ابحث عن <strong>Anonymous</strong> (مجهول) واضغط عليها.
              </li>
              <li>
                قم بتفعيلها (Enable) ثم اضغط على <strong>Save</strong> (حفظ).
              </li>
            </ol>
            <p className="mt-4 leading-relaxed">
              بعد تفعيل المصادقة المجهولة، قم بتحديث هذه الصفحة.
            </p>
          </>
        );
        break;
      
      case 'auth/network-request-failed':
        errorTitle = `خطأ في الاتصال بالشبكة (${authError.code})`;
        errorMessage = (
          <>
            <p className="leading-relaxed">
              تعذر على متصفحك الاتصال بخوادم المصادقة في Firebase.
            </p>
            <p className="mt-4 leading-relaxed">
              هذا الخطأ له سببان شائعان:
            </p>
            <ol className="my-2 list-decimal list-inside space-y-3">
              <li>
                <strong>مشكلة في إعدادات Firebase:</strong> لم يتم السماح لـ <code>localhost</code> بالوصول إلى مشروعك.
                <br />
                <span className="font-semibold text-foreground/80">الحل:</span> اذهب إلى قسم المصادقة (Authentication) في لوحة تحكم Firebase، ثم تبويب (Settings)، وأضف <code>localhost</code> إلى قائمة النطاقات المعتمدة (Authorized domains).
              </li>
              <li>
                <strong>مشكلة في متصفحك أو شبكتك:</strong> إضافة في المتصفح (مثل مانع الإعلانات) أو جدار حماية في شبكتك يمنع الاتصال.
                <br />
                <span className="font-semibold text-foreground/80">الحل:</span> جرب تعطيل إضافات المتصفح مؤقتًا، أو افتح التطبيق في وضع التصفح المتخفي.
              </li>
            </ol>
          </>
        );
        break;

      default:
        errorTitle = `خطأ في الاتصال بـ Firebase (${authError.code})`;
        errorMessage = (
          <>
            <p className="leading-relaxed">
              تعذر على التطبيق الاتصال بخدمات المصادقة في Firebase.
            </p>
            <p className="mt-4 leading-relaxed">
              يرجى التحقق من صحة بيانات الإعداد في ملف <code>.env</code> والتأكد من عدم وجود قيود على مفتاح API الخاص بك في Google Cloud.
            </p>
          </>
        );
    }

    return (
      <div className="flex h-screen w-full items-center justify-center bg-background p-4 sm:p-8">
        <Alert variant="destructive" className="max-w-2xl text-right">
          <Terminal className="h-4 w-4" />
          <AlertTitle>{errorTitle}</AlertTitle>
          <AlertDescription>
            {errorMessage}
            <pre className="mt-4 rounded-md bg-slate-800/50 p-3 text-left font-mono text-xs text-slate-400 overflow-x-auto">
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
