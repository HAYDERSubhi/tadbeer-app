"use client";

/**
 * شبكة الأمان الأخيرة: تحلّ محلّ شاشة Next.js البيضاء
 * «Application error: a client-side exception has occurred».
 *
 * لماذا وُجدت (2026-09-09): رصد صاحب المشروع على هاتفه أن فتح التطبيق بلا
 * إنترنت والضغط على أي صفحة **عدا الرئيسية** يعطي تلك الشاشة البيضاء
 * بالإنجليزية. ولا يكفي إصلاح السبب الجذري وحده: أي خطأ جافاسكربت آخر —
 * ملف ناقص، بيانات غائبة، عطل لم يُتوقَّع — كان سيُظهر الشاشة نفسها.
 *
 * ⛔ **لا تحذف هذا الملف ولا تُفرغه.** غيابه يعني عودة الشاشة البيضاء
 * الإنجليزية لكل خطأ غير ممسوك، وهي أسوأ ما يراه مستخدم عربي غير تقني:
 * لا يفهمها، ولا تخبره أن بياناته سليمة، ولا تعطيه أي مخرج.
 *
 * ⚠️ `global-error` يستبدل `layout.tsx` الجذري بالكامل، فيجب أن يكتب
 * `<html>` و`<body>` بنفسه — ولهذا `dir="rtl"` و`lang="ar"` مكرَّرتان هنا
 * عمداً، وليست تكراراً سهواً.
 *
 * ⚠️ وهو **لا يستورد شيئاً من التطبيق** (لا مكوّنات، ولا أيقونات، ولا
 * `next/link`): لو كان سبب العطل ملفاً ناقصاً، فاستيراد ملف آخر قد يفشل هو
 * أيضاً فتُصبح شاشة العطل نفسها معطَّلة. الأنماط سطرية لنفس السبب.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // بلا إنترنت هو الحالة الغالبة هنا، فالرسالة تتبدّل لتصدق في الحالتين.
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;

  return (
    <html lang="ar" dir="rtl">
      <body style={{ margin: 0, background: '#F8FAFC', fontFamily: 'system-ui, sans-serif' }}>
        <main
          style={{
            minHeight: '100dvh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 24px',
            textAlign: 'center',
            color: '#0F172A',
          }}
        >
          <div
            style={{
              width: 96, height: 96, borderRadius: 28,
              background: 'rgba(20, 163, 154, 0.10)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 24, fontSize: 44, lineHeight: 1,
            }}
            aria-hidden="true"
          >
            {offline ? '📴' : '⚠️'}
          </div>

          <h1 style={{ fontSize: 25, fontWeight: 700, lineHeight: 1.4, margin: 0 }}>
            {offline ? (
              <>هذه الشاشة<br />تحتاج إنترنت</>
            ) : (
              <>حدث خلل مؤقت<br />في هذه الشاشة</>
            )}
          </h1>

          <p style={{ marginTop: 12, fontSize: 16.5, lineHeight: 1.7, color: '#64748B' }}>
            مصاريفك محفوظة ولم يضع منها شيء.
          </p>

          <button
            onClick={() => reset()}
            style={{
              marginTop: 28, width: '100%', maxWidth: 320, height: 52,
              borderRadius: 14, border: 'none', background: '#14A39A',
              color: '#fff', fontSize: 16.5, fontWeight: 700, cursor: 'pointer',
            }}
          >
            إعادة المحاولة
          </button>

          {/* رابط عادي لا `next/link`: نريد تحميلاً كاملاً يعيد بناء التطبيق من الصفر */}
          <a
            href="/"
            style={{
              marginTop: 12, width: '100%', maxWidth: 320, height: 52,
              borderRadius: 14, border: '1px solid #E2E8F0', background: '#fff',
              color: '#334155', fontSize: 16.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              textDecoration: 'none',
            }}
          >
            العودة إلى الرئيسية
          </a>
        </main>
      </body>
    </html>
  );
}
