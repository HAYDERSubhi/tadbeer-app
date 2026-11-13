// src/components/providers.tsx
"use client";

import * as React from 'react';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/hooks/use-auth';
import { QueryProvider } from '@/components/query-provider';
import { useSwUpdate } from '@/hooks/use-sw-update';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/track';

function SwUpdateWatcher() {
  useSwUpdate();
  return null;
}

/**
 * يكتم نافذة «Install» التي يعرضها **كروم نفسه** لأي موقع مؤهَّل كـ PWA.
 *
 * لماذا: أندرويد يُوجَّه إلى Google Play بقرار صاحب المشروع 2026-09-08، فظهور
 * نافذة كروم يناقض القرار — عرضان متنافسان على شاشة واحدة، ونافذة كروم **فوق**
 * لافتة المتجر فتسبقها إلى عين المستخدم.
 *
 * ⚠️ هذا السطر كان موجوداً ضمناً داخل `use-pwa-install` (كان يستدعي
 * `preventDefault` ليعرض لافتته بدل نافذة كروم)، **ففُقد سهواً** عند حذف الملف
 * في `5690343` — ورصده صاحب المشروع على هاتفه بعد ساعات. أُعيد وحده هنا: كتمٌ
 * فقط، بلا لافتة ولا زر ولا إحياء للتثبيت من المتصفّح.
 *
 * الكتم **غير مشروط بمنصّة** عمداً: هذا هو السلوك الذي كان قائماً قبل الحذف
 * بالضبط (الخطّاف القديم كان يكتمها للجميع)، فاستعادته حرفياً أسلم من إدخال
 * سلوك جديد على سطح المكتب لم يكن موجوداً.
 *
 * ⚠️ لا يمنع الإضافة اليدوية (⋮ ← «إضافة إلى الشاشة الرئيسية») — ولا يُفترض أن
 * يمنعها: ذاك خيار يبحث عنه المستخدم بنفسه، لا عرض يُدفع في وجهه.
 */
function BrowserInstallSuppressor() {
  React.useEffect(() => {
    const suppress = (e: Event) => e.preventDefault();
    window.addEventListener('beforeinstallprompt', suppress);
    return () => window.removeEventListener('beforeinstallprompt', suppress);
  }, []);
  return null;
}

/**
 * يسجّل مشاهدة الشاشة عند كل تنقّل داخلي (السبب الكامل في `lib/track.ts`).
 *
 * ⛔ يتخطّى أول عرض عمداً: تحميل المستند الأول يسجّله Firebase تلقائياً، وتسجيله
 * هنا أيضاً يضاعف مشاهدات صفحة الدخول.
 * ⚠️ لو فُعِّل لاحقاً خيار «Page changes based on browser history events» في إعدادات
 * GA4 (Enhanced measurement) تضاعفت المشاهدات — اختر أحدهما لا كليهما.
 * 📌 أرقام الصفحات قبل 2026-11-13 ناقصة بشدّة؛ لا تقارن مشاهدات ما قبله بما بعده.
 */
function RouteAnalytics() {
  const pathname = usePathname();
  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (pathname) trackPageView(pathname);
  }, [pathname]);
  return null;
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      disableTransitionOnChange
    >
      {/* خارج المزوّدين عمداً: يجب أن يكتم نافذة كروم في **كل** صفحة — التسجيل
          والدخول والهبوط أيضاً، لا داخل التطبيق فقط. */}
      <BrowserInstallSuppressor />
      <RouteAnalytics />
      <QueryProvider>
        <AuthProvider>
          <SwUpdateWatcher />
          {children}
          <Toaster />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
