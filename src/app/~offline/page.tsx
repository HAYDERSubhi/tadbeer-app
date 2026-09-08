"use client";

import { WifiOff, Check, RotateCw, Home } from 'lucide-react';
import Link from 'next/link';

/**
 * الصفحة البديلة عند تعذّر الوصول لشاشة غير محفوظة بلا إنترنت.
 * كانت شاشة كروم السوداء «This site can't be reached» (رصدها صاحب المشروع على
 * هاتفه 2026-09-08 بعد فصل الإنترنت والضغط على «يدوي»).
 *
 * ⚠️ المسار `~offline` **إلزامي بهذا الاسم**: مكتبة `@ducanh2912/next-pwa` تبحث
 * عن `src/app/~offline/page.*` حرفياً لموجّه App. ولا يصلح `_offline` لأن أي
 * مجلد يبدأ بـ`_` في App Router مجلد خاص لا يُنشئ مساراً. **لا تُعِد تسميته.**
 *
 * ⚠️ **قائمة «يمكنك الآن» عهدٌ لا زينة.** كُتب فيها «تسجيل مصروف يدوياً» بعد أن
 * أُصلح تجمّد زر الحفظ بلا إنترنت في نفس الدفعة. أي تغيير يكسر أحد هذه البنود
 * يوجب حذف بنده من هنا — وإلا صارت الصفحة تَعِد بما لا يحدث، وهو العيب نفسه
 * الذي جاءت لتُصلحه.
 *
 * الصفحة **خارج مجموعة `(main)`** عمداً: لا هيدر ولا شريط سفلي ولا `AppShell` —
 * فتلك تعتمد على المصادقة وبيانات المستخدم، ولا يصحّ أن تعتمد عليها صفحةُ عطل.
 */
export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-10 text-center">
      <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-[28px] bg-primary/10">
        <WifiOff className="h-12 w-12 text-primary" strokeWidth={1.7} />
      </div>

      <h1 className="text-[25px] font-bold leading-snug text-foreground">
        هذه الشاشة
        <br />
        تحتاج إنترنت
      </h1>
      <p className="mt-3 text-[16.5px] leading-relaxed text-muted-foreground">
        مصاريفك محفوظة ولم يضع منها شيء.
      </p>

      <div className="mt-7 w-full max-w-xs text-start">
        <h2 className="mb-3 text-[15px] font-bold text-foreground">يمكنك الآن:</h2>
        {['تسجيل مصروف يدوياً', 'عرض مصاريفك وميزانيتك', 'تعديل أو حذف مصروف'].map((item) => (
          <div key={item} className="flex items-center gap-3 py-1.5 text-[16.5px]">
            <Check className="h-5 w-5 shrink-0 text-primary" strokeWidth={2.4} />
            <span>{item}</span>
          </div>
        ))}
      </div>

      <div className="mt-7 flex w-full max-w-xs flex-col gap-3">
        {/* الرئيسية هي الشاشة الوحيدة المضمونة الحفظ دائماً (start-url) */}
        <Link
          href="/"
          className="flex h-[52px] items-center justify-center gap-2 rounded-[15px] bg-primary text-[17px] font-bold text-primary-foreground"
        >
          <Home className="h-5 w-5" />
          العودة إلى الرئيسية
        </Link>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex h-[52px] items-center justify-center gap-2 rounded-[15px] border bg-card text-[17px] text-foreground"
        >
          <RotateCw className="h-5 w-5" />
          إعادة المحاولة
        </button>
      </div>
    </main>
  );
}
