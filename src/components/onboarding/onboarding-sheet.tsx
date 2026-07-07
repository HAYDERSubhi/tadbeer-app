"use client";

/**
 * OnboardingSheet — First-time setup wizard (shown once after signup).
 *
 * تجربة دخول واحدة من ٥ شاشات داخل نفس الـ Sheet (بلا فتح/إغلاق بينها):
 *   0. ترحيب  (قيمة + ٣ نقاط، بلا إدخال)            ← phase: 'welcome'
 *   1. الدخل   (يفعّل تتبّع الميزانية — إلزامي)        ┐
 *   2. الميزانية (إجمالي، يُحسب تلقائياً إن تُرك فارغاً) ├ phase: 'steps'
 *   3. الأسرة   (يخصّص توصيات الذكاء)                 ┘
 *   4. انطلاق  («تم» + زر يقود مباشرة لأول مصروف)     ← phase: 'launch'
 *
 * بعد أول مصروف تبدأ «الجولة التعريفية» (مكوّن منفصل، غير ممسوس هنا).
 * Persisted in Firestore via updateUserSettings.
 * Completion flag stored in localStorage so it never shows again.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { useToast } from "@/hooks/use-toast";
import { updateUserSettings } from "@/services/firestore";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Wallet, Target, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, Baby, UserRound, Plus, Minus,
  Sparkles, Zap, Wrench, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/normalize-digits";

const ONBOARDING_KEY = "tadbeer-onboarding-v1";
const TOTAL_STEPS    = 3;

type Phase = "welcome" | "steps" | "launch";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) =>
  n > 0 ? new Intl.NumberFormat("en-US").format(n) : "";

const parse = (s: string) => {
  const n = Number(normalizeDigits(s).replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

/* عناوين الخطوات — تُعرض في عدّاد التقدّم */
const stepTitles = ["الدخل", "الميزانية", "الأسرة"];

export default function OnboardingSheet() {
  const { user }          = useAuth();
  const { userSettings, isSettingsFetched } = useAppData();
  const queryClient       = useQueryClient();
  const router            = useRouter();
  const { toast }         = useToast();

  const [open, setOpen]   = useState(false);
  const [phase, setPhase] = useState<Phase>("welcome");
  const [step, setStep]   = useState(0);
  const [saving, setSaving] = useState(false);

  /* form state */
  const [income,       setIncome]       = useState("");
  const [totalBudget,  setTotalBudget]  = useState("");
  const [adults,       setAdults]       = useState(1);
  const [children,     setChildren]     = useState(0);

  /* show only once, only for users who haven't set income yet */
  const decidedRef = useRef(false);
  useEffect(() => {
    if (decidedRef.current) return;       // قرار الفتح يُتّخذ مرة واحدة فقط
    if (!user) return;
    // المعالج صار يُركَّب في الـ layout قبل اكتمال جلب الإعدادات — انتظر البيانات الحقيقية
    // قبل القرار، وإلا قد نفتحه لمستخدم عائد بناءً على القيم المؤقتة (دخل=0).
    if (!isSettingsFetched) return;
    decidedRef.current = true;             // قرّرنا الآن — لا نُعيد التقييم مع كل تغيّر لاحق لـ userSettings
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    // مستخدم عائد = دخل **وميزانية** مسجّلان معاً. الميزانية لا تُكتب إلا عند إنهاء
    // المعالج (handleFinish يحسبها 70% تلقائياً إن تُركت فارغة)، بينما الدخل يُحفظ
    // جزئياً فور تجاوز خطوته — فوجود دخل بلا ميزانية يعني معالجاً انقطع بمنتصفه
    // (إعادة تحميل بسبب تحديث SW، إغلاق تاب...) → أعد فتحه ليُكمل (الدخل يُعبّأ مسبقاً).
    const hasIncome = (userSettings?.profile?.monthlyIncome ?? 0) > 0;
    const hasBudget = (userSettings?.budget?.totalBudget    ?? 0) > 0;
    if (hasIncome && hasBudget) {
      localStorage.setItem(ONBOARDING_KEY, "done");
      return;
    }
    // افتح فوراً فور جهوزية الإعدادات — بلا مؤقّت (كان المؤقّت يُلغى عند إعادة تشغيل الـ effect
    // مع كل إعادة جلب خلفية فيتأخّر الظهور ~ثانية وتُكشَف اللوحة). أنميشن الـ Sheet يتكفّل بالسلاسة.
    setOpen(true);
  }, [user, userSettings, isSettingsFetched]);

  /* pre-fill if user already has some data */
  useEffect(() => {
    if (!userSettings) return;
    if (userSettings.profile?.monthlyIncome)
      setIncome(fmt(userSettings.profile.monthlyIncome));
    if (userSettings.budget?.totalBudget)
      setTotalBudget(fmt(userSettings.budget.totalBudget));
    const members = userSettings.profile?.familyMembers || [];
    setAdults(Math.max(1, members.filter(m => m.type === "adult").length || 1));
    setChildren(members.filter(m => m.type === "child").length || 0);
  }, [userSettings]);

  const dismiss = () => {
    // نُحدّث الإعدادات هنا (عند الخروج) لا بعد الحفظ مباشرة: إعادة الجلب تقلب
    // pageReady=false في اللوحة فتُفكِّك هذا الـ Sheet — لو فعلناها أثناء «الانطلاق» تختفي شاشته.
    if (user) queryClient.invalidateQueries({ queryKey: ["userSettings", user.uid] });
    localStorage.setItem(ONBOARDING_KEY, "done");
    setOpen(false);
    window.dispatchEvent(new CustomEvent('onboarding-complete'));
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const familyMembers = [
        ...Array.from({ length: adults },   (_, i) => ({ id: `adult-${i}`,   type: "adult"  as const, age: 30 })),
        ...Array.from({ length: children }, (_, i) => ({ id: `child-${i}`,   type: "child"  as const, age: 8  })),
      ];

      await updateUserSettings(user.uid, {
        profile: {
          monthlyIncome: parse(income),
          familyMembers,
        },
        budget: {
          totalBudget:         parse(totalBudget) || Math.round(parse(income) * 0.7),
          weeklyBudget:        Math.round((parse(totalBudget) || parse(income) * 0.7) / 4),
          zeroSpendDaysTarget: 4,
        },
      });

      localStorage.setItem(ONBOARDING_KEY, "done");
      window.dispatchEvent(new CustomEvent('onboarding-complete'));
      // ⚠️ لا نستدعي invalidateQueries هنا: إعادة جلب الإعدادات تقلب pageReady=false
      // في اللوحة فتُفكِّك هذا الـ Sheet ويختفي طور «الانطلاق». نؤجّلها إلى لحظة الخروج
      // (goAddExpense / dismiss). البيانات محفوظة في Firestore فعلاً؛ التحديث المرئي يكفي عند الخروج.
      // الحفظ نجح → انتقل لشاشة الانطلاق (لا نغلق): القاعدة الذهبية #1.
      setPhase("launch");
    } catch (e) {
      console.error("Onboarding save failed:", e);
      // فشل الحفظ → ابقَ على الخطوة وأعلم المستخدم بدل التقدّم بصمت.
      toast({
        title: "تعذّر الحفظ",
        description: "تحقّق من اتصالك وحاول مجدداً.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // زر «سجّل أول مصروف»: أغلق الـ Sheet ثم انتقل (القاعدة الذهبية #3) — انتقال ناعم بلا overlay عالق.
  const goAddExpense = () => {
    // حدّث الإعدادات الآن (عند الخروج) فقط — لا أثناء عرض الانطلاق (يُفكِّك الـ Sheet).
    if (user) queryClient.invalidateQueries({ queryKey: ["userSettings", user.uid] });
    setOpen(false);
    router.push("/add-expense");
  };

  // من شاشة الترحيب مباشرة: تخطّي الخطوات الثلاث كاملة والذهاب فوراً لتسجيل أول مصروف
  // (بلا المرور بشاشة «الانطلاق»). يحفظ نفس القيم الافتراضية التي يحفظها «تخطّي الباقي».
  const skipToAddExpense = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserSettings(user.uid, {
        profile: { monthlyIncome: parse(income), familyMembers: [] },
        budget: {
          totalBudget:         parse(totalBudget) || Math.round(parse(income) * 0.7),
          weeklyBudget:        Math.round((parse(totalBudget) || parse(income) * 0.7) / 4),
          zeroSpendDaysTarget: 4,
        },
      });
      localStorage.setItem(ONBOARDING_KEY, "done");
      window.dispatchEvent(new CustomEvent('onboarding-complete'));
      queryClient.invalidateQueries({ queryKey: ["userSettings", user.uid] });
      setOpen(false);
      router.push("/add-expense");
    } catch (e) {
      console.error("Onboarding skip-to-app failed:", e);
      toast({
        title: "تعذّر الحفظ",
        description: "تحقّق من اتصالك وحاول مجدداً.",
        variant: "destructive",
      });
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (step === 0) return parse(income) >= 1000;     // must enter income
    if (step === 1) return true;                       // budget optional (auto-calc)
    return true;
  };

  const next = () => {
    // عند تجاوز خطوة الدخل (الإلزامية): احفظ الدخل فوراً (دمج جزئي آمن) كي لا يضيع
    // مهما أُغلق المعالج لاحقاً — حتى عبر الـ ✕. الميزانية/الأسرة تُحفظان عند الإنهاء.
    if (step === 0 && user) {
      updateUserSettings(user.uid, { profile: { monthlyIncome: parse(income) } }).catch(() => {});
    }
    if (step < TOTAL_STEPS - 1) setStep(s => s + 1);
    else handleFinish();
  };

  /* ── render ──────────────────────────────────────────────── */
  // ⚠️ الـ Sheet يبقى مركَّباً طوال الأطوار؛ نبدّل المحتوى الداخلي فقط (القاعدة الذهبية #2 — لا وميض).
  // زر الإغلاق ✕ ومقبض السحب يأتيان جاهزَين من SheetContent — لا نكرّرهما.
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) dismiss(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl px-0 pb-0 max-h-[92dvh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >

        {/* ════════ الطور ١: ترحيب ════════ */}
        {phase === "welcome" && (
          <div className="px-5 pt-2 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SheetHeader className="text-right space-y-0">
              <SheetTitle className="sr-only">مرحباً بك في تدبير</SheetTitle>
              <SheetDescription className="sr-only">شاشة ترحيب قبل إعداد حسابك</SheetDescription>
            </SheetHeader>

            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-foreground">أهلاً، خلّينا نبدأ بدقيقة</h2>
            <p className="text-base text-muted-foreground mt-1.5 leading-relaxed">
              تدبير يتابع أموالك بذكاء ويساعدك بإدارتها.
            </p>

            <div className="space-y-4 mt-6">
              {[
                { icon: Zap,    title: "تسجيل سريع",   sub: "أضف مصاريفك بالكتابة أو الصوت أو الفاتورة" },
                { icon: Target, title: "ميزانية ذكية", sub: "تنبيهات قبل ما تتجاوز حدّك الشهري" },
                { icon: Wrench, title: "أدوات مالية",  sub: "عملات، ديون، أقساط، وحاسبات تساعدك تقرّر" },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-3.5">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-foreground leading-tight">{title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-13 text-base font-semibold mt-7"
              onClick={() => setPhase("steps")}
              disabled={saving}
            >
              يلا نبدأ <ChevronLeft className="h-5 w-5 mr-1" />
            </Button>

            <button
              onClick={skipToAddExpense}
              disabled={saving}
              className="w-full text-center text-sm font-semibold text-primary hover:opacity-80 transition-opacity disabled:opacity-50 mt-3 py-1"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> جاري التحضير...</span>
              ) : (
                "تخطّي الإعداد والمتابعة للتطبيق"
              )}
            </button>
          </div>
        )}

        {/* ════════ الطور ٢: الخطوات الثلاث ════════ */}
        {phase === "steps" && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-bold">إعداد تدبير</SheetTitle>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                >
                  تخطّي الباقي
                </button>
              </div>
              <SheetDescription className="text-sm text-right">
                3 خطوات سريعة لتفعيل كل ميزات الميزانية
              </SheetDescription>
            </SheetHeader>

            {/* Progress bar — تعبئة تبدأ من اليمين (RTL): عنصر بعرض نسبي يلتصق بحافة البداية
                (اليمين في العربية) بدل translateX الذي لا ينقلب مع الاتجاه. */}
            <div className="px-5 pb-4">
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                الخطوة {step + 1} من {TOTAL_STEPS} — <span className="text-primary font-semibold">{stepTitles[step]}</span>
              </p>
            </div>

            {/* Step content */}
            <div className="px-5 min-h-[220px]">

              {/* ── Step 0: Income ─────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Wallet className="h-5 w-5 text-primary shrink-0" />
                        <h3 className="font-bold text-lg text-foreground">ما هو دخلك الشهري؟</h3>
                      </div>
                      <button
                        onClick={handleFinish}
                        disabled={saving}
                        className="text-sm font-semibold text-primary hover:opacity-80 transition-opacity disabled:opacity-50 shrink-0"
                      >
                        تخطي
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 leading-relaxed">
                      منه نحسب تنبيهات ميزانيتك <Lock className="h-3.5 w-3.5 shrink-0" /> لا يُشارَك مع أحد
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="مثال: 800,000"
                        value={income}
                        onChange={e => {
                          const raw = normalizeDigits(e.target.value).replace(/,/g, "");
                          if (/^\d*$/.test(raw)) setIncome(fmt(Number(raw)) || "");
                        }}
                        className="h-14 text-2xl font-bold pl-16 font-mono"
                        autoFocus
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">د.ع</span>
                    </div>
                    {/* Quick picks — تسميات عربية واضحة بدل صيغة K الإنجليزية */}
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { v: 500_000,   label: "500 ألف" },
                        { v: 750_000,   label: "750 ألف" },
                        { v: 1_000_000, label: "مليون" },
                        { v: 1_500_000, label: "مليون ونصف" },
                      ].map(({ v, label }) => (
                        <button
                          key={v}
                          onClick={() => setIncome(fmt(v))}
                          className={cn(
                            "px-4 py-2 rounded-full text-sm border transition-colors",
                            income === fmt(v)
                              ? "bg-primary text-white border-primary"
                              : "bg-muted border-transparent hover:border-primary/40"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Step 1: Budget ─────────────────────────────── */}
              {step === 1 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-bold text-lg text-foreground">ما هي ميزانيتك الشهرية؟</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      خطّك الأحمر الشهري — منها تشتغل تنبيهات التجاوز.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={parse(income) > 0 ? fmt(Math.round(parse(income) * 0.7)) : "مثال: 560,000"}
                        value={totalBudget}
                        onChange={e => {
                          const raw = normalizeDigits(e.target.value).replace(/,/g, "");
                          if (/^\d*$/.test(raw)) setTotalBudget(fmt(Number(raw)) || "");
                        }}
                        className="h-14 text-2xl font-bold pl-16 font-mono"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">د.ع</span>
                    </div>

                    {/* تلميح: الحقل اختياري ويُحسب تلقائياً إن تُرك فارغاً */}
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      اتركها فارغة وسنحسبها لك تلقائياً
                      {parse(income) > 0 && <> (70% من دخلك = <span className="font-semibold text-foreground">{fmt(Math.round(parse(income) * 0.7))}</span> د.ع)</>}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: Family ─────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-bold text-lg text-foreground">حجم الأسرة</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      نخصّص لك توصيات أدقّ حسب عدد أفراد بيتك (اختياري).
                    </p>
                  </div>

                  <div className="space-y-5">
                    {/* Adults */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-base font-medium">بالغون</p>
                          <p className="text-sm text-muted-foreground">أنت + الشريك/الزوجة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAdults(a => Math.max(1, a - 1))}
                          className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center font-bold text-lg">{adults}</span>
                        <button
                          onClick={() => setAdults(a => Math.min(6, a + 1))}
                          className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Children */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                          <Baby className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                          <p className="text-base font-medium">أطفال</p>
                          <p className="text-sm text-muted-foreground">دون 18 سنة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setChildren(c => Math.max(0, c - 1))}
                          className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="w-6 text-center font-bold text-lg">{children}</span>
                        <button
                          onClick={() => setChildren(c => Math.min(10, c + 1))}
                          className="w-11 h-11 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Navigation buttons */}
            <div className="px-5 py-5 flex gap-3 border-t mt-4">
              {step > 0 && (
                <Button
                  variant="outline"
                  className="h-12 px-5 text-sm"
                  onClick={() => setStep(s => s - 1)}
                  disabled={saving}
                >
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
              )}
              <Button
                className="flex-1 h-12 text-base font-semibold"
                onClick={next}
                disabled={!canProceed() || saving}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحفظ...</>
                ) : step === TOTAL_STEPS - 1 ? (
                  <><CheckCircle2 className="h-4 w-4 ml-2" /> إنهاء الإعداد</>
                ) : (
                  <>التالي <ChevronLeft className="h-4 w-4 mr-1" /></>
                )}
              </Button>
            </div>
          </>
        )}

        {/* ════════ الطور ٣: انطلاق ════════ */}
        {phase === "launch" && (
          <div className="px-5 pt-4 pb-7 flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SheetHeader className="text-center space-y-0">
              <SheetTitle className="sr-only">تم إعداد حسابك</SheetTitle>
              <SheetDescription className="sr-only">سجّل أول مصروف لتبدأ</SheetDescription>
            </SheetHeader>

            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-9 w-9 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="text-xl font-bold text-foreground">تم! حسابك جاهز</h2>
            <p className="text-base text-muted-foreground mt-2 leading-relaxed max-w-[280px]">
              سجّل أول مصروف وشوف تدبير يشتغل.
            </p>

            <Button
              className="w-full h-12 text-base font-semibold mt-7"
              onClick={goAddExpense}
            >
              <Plus className="h-5 w-5 ml-2" /> سجّل أول مصروف
            </Button>

            <button
              onClick={dismiss}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors mt-4 py-1"
            >
              لاحقاً
            </button>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
