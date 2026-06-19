"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/use-auth';

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (loading) return null;
  if (user) return null;

  return (
    <div className="min-h-screen bg-background text-foreground" dir="rtl">

      {/* HERO */}
      <section className="bg-primary text-white px-6 py-14 text-center">
        <div className="flex items-center justify-center gap-3 mb-8">
          <img
            src="/logo.png"
            alt="شعار تدبير"
            className="w-12 h-12 object-contain"
            style={{ filter: 'brightness(0) invert(1)' }}
          />
          <span className="text-3xl font-semibold">تدبير</span>
        </div>
        <h1 className="text-2xl font-semibold leading-relaxed mb-4">
          تحكّم بمصاريفك<br />وحقّق أهدافك المالية
        </h1>
        <p className="text-white/80 text-sm leading-relaxed mb-8 max-w-xs mx-auto">
          تطبيق ذكي بالعربية الكاملة — سجّل بصوتك، تتبّع ميزانيتك، واحصل على تحليلات فورية
        </p>
        <Link
          href="/login"
          className="inline-block bg-white text-primary font-semibold text-base px-10 py-3.5 rounded-full"
        >
          ابدأ مجاناً ←
        </Link>
        <p className="text-white/60 text-xs mt-3">مجاني تماماً · بدون تثبيت</p>
      </section>

      {/* PHONE PREVIEW */}
      <section className="bg-primary/5 px-6 py-10 flex justify-center">
        <div className="relative w-52">
          <img
            src="/screenshots/screenshot-home.png"
            alt="واجهة تطبيق تدبير"
            className="w-full rounded-2xl shadow-lg border border-border"
            style={{ maxHeight: 420, objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
      </section>

      {/* FEATURES */}
      <section className="px-5 py-10">
        <p className="text-xs text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mb-3">المميزات</p>
        <h2 className="text-xl font-semibold text-foreground mb-6">كل ما تحتاجه في مكان واحد</h2>

        <div className="space-y-3">
          {[
            { icon: '🎤', title: 'سجّل بصوتك', desc: 'قل "دفعت 5000 أجرة" وتدبير يفهمك ويصنّف تلقائياً' },
            { icon: '📊', title: 'إحصائيات ذكية', desc: 'رسوم بيانية واضحة تُظهر أين تذهب فلوسك كل شهر' },
            { icon: '🎯', title: 'ميزانية شهرية', desc: 'حدّد ميزانيتك وتدبير ينبّهك قبل تجاوز الحد' },
            { icon: '🤖', title: 'مستشار الجيب', desc: 'اسأل بلغتك الطبيعية عن أي شيء في مصاريفك' },
          ].map((f) => (
            <div key={f.title} className="flex items-start gap-4 bg-muted/50 rounded-xl p-4">
              <div className="w-11 h-11 bg-primary/10 rounded-xl flex items-center justify-center text-2xl flex-shrink-0">
                {f.icon}
              </div>
              <div>
                <h3 className="font-semibold text-base text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SCREENSHOTS */}
      <section className="px-5 pb-10">
        <h2 className="text-xl font-semibold text-foreground mb-5">شاهد التطبيق بنفسك</h2>
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { src: '/screenshots/screenshot-stats.png', label: 'إحصائيات شهرية' },
            { src: '/screenshots/screenshot-chat.png', label: 'مستشار الجيب' },
            { src: '/screenshots/screenshot-home.png', label: 'الرئيسية' },
          ].map((s) => (
            <div key={s.label} className="flex-shrink-0 w-36">
              <img
                src={s.src}
                alt={s.label}
                className="w-full rounded-xl border border-border"
                style={{ height: 240, objectFit: 'cover', objectPosition: 'top' }}
              />
              <p className="text-xs text-muted-foreground text-center mt-2">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF */}
      <section className="bg-muted/50 py-8 text-center">
        <p className="text-4xl font-semibold text-primary">+54</p>
        <p className="text-sm text-muted-foreground mt-1">مستخدم نشط من العراق والعالم العربي</p>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 py-12 text-center">
        <p className="text-xs text-primary bg-primary/10 inline-block px-3 py-1 rounded-full mb-4">انضم الآن</p>
        <h2 className="text-xl font-semibold text-foreground mb-2">ابدأ رحلتك المالية اليوم</h2>
        <p className="text-sm text-muted-foreground mb-8">سجّل بحسابك وابدأ تتبّع مصاريفك في ثوانٍ</p>
        <Link
          href="/login"
          className="block bg-primary text-white font-semibold text-base px-10 py-4 rounded-full w-full max-w-xs mx-auto"
        >
          ابدأ مجاناً — بدون بطاقة
        </Link>
        <p className="text-xs text-muted-foreground mt-3">يعمل على الجوال والحاسوب · بدون تثبيت</p>
      </section>

    </div>
  );
}
