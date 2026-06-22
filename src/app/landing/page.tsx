"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

const INPUT_METHODS = [
  {
    icon: '🎤',
    title: 'بصوتك',
    badge: 'الأسرع',
    desc: 'قل "دفعت 5000 أجرة" وتدبير يفهمك ويصنّف تلقائياً',
    color: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
    badgeColor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300',
  },
  {
    icon: '✏️',
    title: 'يدوياً',
    badge: 'الأدق',
    desc: 'أدخل المبلغ والتصنيف والملاحظة بشكل كامل ومتحكم',
    color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    badgeColor: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  {
    icon: '📄',
    title: 'من فاتورة',
    badge: 'الأذكى',
    desc: 'صوّر فاتورتك وتدبير يقرأها ويستخرج البيانات تلقائياً',
    color: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
    badgeColor: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  },
];

const FEATURES = [
  { icon: '📊', title: 'تحليل ذكي', desc: 'رسوم بيانية واضحة مع نصائح AI تساعدك على التوفير' },
  { icon: '🎯', title: 'ميزانية شهرية', desc: 'حدّد ميزانيتك وتدبير ينبّهك قبل تجاوز الحد' },
  { icon: '👨‍👩‍👧', title: 'حساب عائلي', desc: 'شارك ميزانيتك مع أفراد عائلتك في حساب مشترك واحد' },
  { icon: '🏆', title: 'شارات وإنجازات', desc: 'اكسب شارات عند تحقيق أهدافك المالية' },
];

const TOOLS = [
  { icon: '🤔', title: 'هل يستحق؟', desc: 'قيّم أي قرار شراء قبل الدفع' },
  { icon: '💱', title: 'العملات', desc: 'تحويل فوري IQD · USD · AED · SAR' },
  { icon: '☕', title: 'تكلفة عاداتي', desc: 'اكتشف كم تكلفك عاداتك سنوياً' },
  { icon: '📦', title: 'أقساطي', desc: 'احسب قسطك الشهري لأي قرض' },
  { icon: '💍', title: 'حاسبة زواجي', desc: 'خطط لميزانية زفافك بذكاء' },
  { icon: '💳', title: 'دفتر الديون', desc: 'تتبع ما لك وما عليك بسهولة' },
];

const SCREENSHOTS = [
  { src: '/screenshots/screenshot-home.jpg', label: 'الرئيسية' },
  { src: '/screenshots/screenshot-stats.jpg', label: 'الإحصائيات' },
  { src: '/screenshots/screenshot-analysis.jpg', label: 'التحليل الذكي' },
  { src: '/screenshots/screenshot-tools.jpg', label: 'الأدوات' },
  { src: '/screenshots/screenshot-settings.jpg', label: 'الإعدادات' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/');
  }, [user, loading, router]);

  if (loading || user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative bg-primary overflow-hidden px-6 pt-12 pb-16 text-center">
        {/* subtle background circles */}
        <div className="absolute top-[-60px] left-[-60px] w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-[-40px] right-[-40px] w-36 h-36 rounded-full bg-white/5 pointer-events-none" />

        <div className="relative z-10">
          <div className="flex items-center justify-center gap-2.5 mb-6">
            <img src="/logo.png" alt="شعار تدبير" className="w-10 h-10 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />
            <span className="text-white text-2xl font-bold tracking-wide">تدبير</span>
          </div>

          <div className="inline-block bg-white/15 text-white/90 text-xs px-3 py-1 rounded-full mb-4">
            مجاني تماماً · عربي 100٪
          </div>

          <h1 className="text-white text-2xl font-bold leading-snug mb-3">
            تحكّم بمصاريفك<br />وحقّق أهدافك المالية
          </h1>
          <p className="text-white/75 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
            سجّل مصاريفك بصوتك أو يدوياً أو من فاتورة — وتدبير يتولى الباقي
          </p>

          <Link
            href="/login"
            className="inline-block bg-white text-primary font-bold text-sm px-10 py-3.5 rounded-full shadow-lg"
          >
            ابدأ مجاناً ←
          </Link>
          <p className="text-white/50 text-xs mt-3">بدون تثبيت · يعمل على جميع الأجهزة</p>
        </div>
      </section>

      {/* ── INPUT METHODS ────────────────────────────── */}
      <section className="px-5 py-10">
        <div className="text-center mb-6">
          <span className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full">3 طرق للإدخال</span>
          <h2 className="text-xl font-bold text-foreground mt-2">سجّل كيف تشاء</h2>
          <p className="text-sm text-muted-foreground mt-1">اختر الطريقة الأنسب لك — كلها سريعة وسهلة</p>
        </div>

        <div className="space-y-3">
          {INPUT_METHODS.map((m) => (
            <div key={m.title} className={`flex items-start gap-4 rounded-2xl border p-4 ${m.color}`}>
              <div className="w-12 h-12 bg-white/70 dark:bg-white/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 shadow-sm">
                {m.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-sm text-foreground">{m.title}</h3>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${m.badgeColor}`}>{m.badge}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── PHONE PREVIEW (hero screenshot) ─────────── */}
      <section className="bg-primary/5 flex justify-center px-6 py-10">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 blur-2xl rounded-full scale-75 translate-y-4" />
          <img
            src="/screenshots/screenshot-home.jpg"
            alt="واجهة تطبيق تدبير"
            className="relative w-52 rounded-3xl shadow-2xl border-2 border-primary/20"
            style={{ maxHeight: 440, objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
      </section>

      {/* ── GROWTH BADGE ─────────────────────────────── */}
      <section className="bg-primary text-white py-7 text-center">
        <div className="flex items-center justify-center gap-2 mb-1">
          <span className="text-2xl">📈</span>
          <p className="text-xl font-bold">ينمو شهرياً</p>
        </div>
        <p className="text-white/70 text-sm">مجتمع عربي متنامٍ من العراق والعالم العربي</p>
      </section>

      {/* ── FEATURES ─────────────────────────────────── */}
      <section className="px-5 py-10">
        <div className="text-center mb-6">
          <span className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full">المميزات</span>
          <h2 className="text-xl font-bold text-foreground mt-2">كل ما تحتاجه في مكان واحد</h2>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-muted/50 rounded-2xl p-4 flex flex-col gap-2">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-xl">
                {f.icon}
              </div>
              <h3 className="font-semibold text-sm text-foreground">{f.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SCREENSHOTS CAROUSEL ─────────────────────── */}
      <section className="py-8 bg-muted/30">
        <div className="px-5 mb-4">
          <h2 className="text-xl font-bold text-foreground">شاهد التطبيق بنفسك</h2>
          <p className="text-sm text-muted-foreground mt-1">اسحب لمشاهدة المزيد</p>
        </div>
        <div className="flex gap-3 overflow-x-auto px-5 pb-3 scrollbar-hide snap-x snap-mandatory">
          {SCREENSHOTS.map((s) => (
            <div key={s.label} className="flex-shrink-0 w-40 snap-start">
              <img
                src={s.src}
                alt={s.label}
                className="w-full rounded-2xl border border-border shadow-sm"
                style={{ height: 260, objectFit: 'cover', objectPosition: 'top' }}
              />
              <p className="text-xs text-muted-foreground text-center mt-2 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TOOLS SECTION ────────────────────────────── */}
      <section className="px-5 py-10">
        <div className="text-center mb-6">
          <span className="text-xs text-primary bg-primary/10 px-3 py-1 rounded-full">الأدوات المالية</span>
          <h2 className="text-xl font-bold text-foreground mt-2">أدوات سريعة لقرارات أذكى</h2>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {TOOLS.map((t) => (
            <div key={t.title} className="bg-muted/40 rounded-2xl p-3 text-center flex flex-col items-center gap-1.5">
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-2xl">
                {t.icon}
              </div>
              <p className="text-xs font-semibold text-foreground leading-tight">{t.title}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIAL / TRUST ──────────────────────── */}
      <section className="mx-5 mb-10 bg-primary/5 border border-primary/20 rounded-2xl p-5">
        <p className="text-sm text-foreground leading-relaxed text-center">
          "أخيراً تطبيق مالي عربي يفهمني — سجّل بصوتي وصنّف تلقائياً بدون تعقيد"
        </p>
        <p className="text-xs text-muted-foreground text-center mt-3">— مستخدم من العراق</p>
      </section>

      {/* ── FINAL CTA ────────────────────────────────── */}
      <section className="px-5 pb-14 text-center">
        <div className="bg-primary rounded-3xl px-6 py-8">
          <span className="text-xs bg-white/20 text-white px-3 py-1 rounded-full">انضم الآن</span>
          <h2 className="text-white text-xl font-bold mt-3 mb-1">ابدأ رحلتك المالية اليوم</h2>
          <p className="text-white/70 text-sm mb-6">سجّل وابدأ تتبّع مصاريفك في ثوانٍ</p>
          <Link
            href="/login"
            className="block bg-white text-primary font-bold text-sm py-3.5 rounded-full shadow"
          >
            ابدأ مجاناً — سجّل الآن
          </Link>
          <p className="text-white/50 text-xs mt-3">يعمل على الجوال والحاسوب · بدون تثبيت</p>
        </div>
      </section>

    </div>
  );
}
