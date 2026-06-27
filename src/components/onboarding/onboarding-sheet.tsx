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

import { useState, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import {
  Wallet, Target, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, Baby, UserRound, Plus, Minus,
  Sparkles, Zap, Wrench, Info, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ONBOARDING_KEY = "tadbeer-onboarding-v1";
const TOTAL_STEPS    = 3;

type Phase = "welcome" | "steps" | "launch";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) =>
  n > 0 ? new Intl.NumberFormat("en-US").format(n) : "";

const parse = (s: string) => {
  const n = Number(s.replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

/* تنويه موحّد «ليش نسأل؟» — سبب جمع كل معلومة، بنبرة وأيقونة ثابتة */
const WhyNote = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-start gap-2 bg-primary/5 rounded-lg px-3 py-2">
    <Info className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
    <p className="text-[11px] text-primary/90 leading-relaxed">{children}</p>
  </div>
);

/* ─── Step indicators ─────────────────────────────────────── */
const steps = [
  { icon: Wallet, label: "الدخل" },
  { icon: Target, label: "الميزانية" },
  { icon: Users,  label: "الأسرة" },
];

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
  useEffect(() => {
    if (!user) return;
    // المعالج صار يُركَّب في الـ layout قبل اكتمال جلب الإعدادات — انتظر البيانات الحقيقية
    // قبل القرار، وإلا قد نفتحه لمستخدم عائد بناءً على القيم المؤقتة (دخل=0).
    if (!isSettingsFetched) return;
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    // مستخدم عائد لديه دخل مسجّل فعلاً (جهاز جديد/بعد مسح الكاش) → لا تُظهر المعالج
    if ((userSettings?.profile?.monthlyIncome ?? 0) > 0) {
      localStorage.setItem(ONBOARDING_KEY, "done");
      return;
    }
    // Wait a moment so the dashboard loads first
    const t = setTimeout(() => setOpen(true), 800);
    return () => clearTimeout(t);
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

            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>

            <h2 className="text-lg font-bold text-foreground">أهلاً، خلّينا نبدأ بدقيقة</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              تدبير يتابع أموالك بذكاء ويساعدك بإدارتها.
            </p>

            <div className="space-y-3 mt-5">
              {[
                { icon: Zap,    title: "تسجيل سريع",   sub: "أضف مصاريفك بالكتابة أو الصوت أو الفاتورة" },
                { icon: Target, title: "ميزانية ذكية", sub: "تنبيهات قبل ما تتجاوز حدّك الشهري" },
                { icon: Wrench, title: "أدوات مالية",  sub: "عملات، ديون، أقساط، وحاسبات تساعدك تقرّر" },
              ].map(({ icon: Icon, title, sub }) => (
                <div key={title} className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground leading-tight">{title}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{sub}</p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              className="w-full h-12 text-sm font-semibold mt-6"
              onClick={() => setPhase("steps")}
            >
              يلا نبدأ <ChevronLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        )}

        {/* ════════ الطور ٢: الخطوات الثلاث ════════ */}
        {phase === "steps" && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-base font-bold">إعداد تدبير</SheetTitle>
                {/* خطوة الدخل (0) إلزامية: لا «تخطّي». من خطوة الميزانية فصاعداً، «تخطّي»
                    يحفظ الدخل المُدخَل + ميزانية تلقائية بدل تجاهل كل شيء. */}
                {step > 0 && (
                  <button
                    onClick={handleFinish}
                    disabled={saving}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                  >
                    تخطّي الباقي
                  </button>
                )}
              </div>
              <SheetDescription className="text-xs text-right">
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
              <div className="flex justify-between mt-2">
                {steps.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <div key={i} className={cn(
                      "flex items-center gap-1 text-[10px] transition-colors",
                      i === step ? "text-primary font-semibold" :
                      i < step   ? "text-primary/60" : "text-muted-foreground"
                    )}>
                      {i < step
                        ? <CheckCircle2 className="h-3.5 w-3.5" />
                        : <Icon className="h-3.5 w-3.5" />}
                      {s.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step content */}
            <div className="px-5 min-h-[220px]">

              {/* ── Step 0: Income ─────────────────────────────── */}
              {step === 0 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-primary/5 rounded-xl p-4 space-y-1">
                    <div className="flex items-center gap-2 text-primary">
                      <Wallet className="h-5 w-5" />
                      <h3 className="font-bold text-sm">ما هو دخلك الشهري؟</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      ليش نسأل؟ منه نحسب نسبة إنفاقك وننبّهك قبل ما تتجاوز ميزانيتك.
                    </p>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Lock className="h-3 w-3 shrink-0" /> لا يُشارَك مع أحد.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">الدخل الشهري (د.ع)</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="مثال: 800,000"
                        value={income}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, "");
                          if (/^\d*$/.test(raw)) setIncome(fmt(Number(raw)) || "");
                        }}
                        className="h-12 text-base pl-16 font-mono"
                        autoFocus
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
                    </div>
                    {/* Quick picks — تسميات عربية واضحة بدل صيغة K الإنجليزية */}
                    <div className="flex gap-2 flex-wrap pt-1">
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
                            "px-3 py-1 rounded-full text-xs border transition-colors",
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
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Target className="h-5 w-5" />
                      <h3 className="font-bold text-sm">ما هي ميزانيتك الشهرية؟</h3>
                    </div>
                    <WhyNote>
                      ليش نسأل؟ هي خطّك الأحمر الشهري — منها يشتغل شريط الميزانية وتنبيهات التجاوز.
                    </WhyNote>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">الميزانية الشهرية (د.ع)</Label>
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder={parse(income) > 0 ? fmt(Math.round(parse(income) * 0.7)) : "مثال: 560,000"}
                        value={totalBudget}
                        onChange={e => {
                          const raw = e.target.value.replace(/,/g, "");
                          if (/^\d*$/.test(raw)) setTotalBudget(fmt(Number(raw)) || "");
                        }}
                        className="h-12 text-base pl-16 font-mono"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">د.ع</span>
                    </div>

                    {/* تلميح: الحقل اختياري ويُحسب تلقائياً إن تُرك فارغاً */}
                    <p className="text-[11px] text-muted-foreground/80">
                      اتركها فارغة وسنحسبها لك تلقائياً
                      {parse(income) > 0 && <> (70% من دخلك = {fmt(Math.round(parse(income) * 0.7))} د.ع)</>}
                    </p>

                    {/* Smart suggestion */}
                    {parse(income) > 0 && (
                      <div className="space-y-2 pt-1">
                        <p className="text-[11px] text-muted-foreground">اقتراحات بناءً على دخلك:</p>
                        <div className="flex gap-2 flex-wrap">
                          {[
                            { label: "70% (موصى به)", pct: 0.7 },
                            { label: "60% (توفير أكثر)", pct: 0.6 },
                            { label: "80%", pct: 0.8 },
                          ].map(({ label, pct }) => {
                            const val = Math.round(parse(income) * pct);
                            return (
                              <button
                                key={pct}
                                onClick={() => setTotalBudget(fmt(val))}
                                className={cn(
                                  "px-3 py-1.5 rounded-lg text-[11px] border transition-colors text-right",
                                  totalBudget === fmt(val)
                                    ? "bg-primary text-white border-primary"
                                    : "bg-muted border-transparent hover:border-primary/40"
                                )}
                              >
                                <span className="font-semibold">{fmt(val)}</span>
                                <span className="text-[10px] opacity-70 mr-1">— {label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Step 2: Family ─────────────────────────────── */}
              {step === 2 && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="bg-primary/5 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary">
                      <Users className="h-5 w-5" />
                      <h3 className="font-bold text-sm">حجم الأسرة</h3>
                    </div>
                    <WhyNote>
                      ليش نسأل؟ نخصّص لك توصيات أدقّ حسب عدد أفراد بيتك (اختياري).
                    </WhyNote>
                  </div>

                  <div className="space-y-4">
                    {/* Adults */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                          <UserRound className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">بالغون</p>
                          <p className="text-[11px] text-muted-foreground">أنت + الشريك/الزوجة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setAdults(a => Math.max(1, a - 1))}
                          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-lg">{adults}</span>
                        <button
                          onClick={() => setAdults(a => Math.min(6, a + 1))}
                          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
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
                          <p className="text-sm font-medium">أطفال</p>
                          <p className="text-[11px] text-muted-foreground">دون 18 سنة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setChildren(c => Math.max(0, c - 1))}
                          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                        <span className="w-6 text-center font-bold text-lg">{children}</span>
                        <button
                          onClick={() => setChildren(c => Math.min(10, c + 1))}
                          className="w-8 h-8 rounded-full border-2 border-gray-200 flex items-center justify-center hover:border-primary transition-colors"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Summary badge */}
                    <div className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-2">
                      <Users className="h-4 w-4 text-primary shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        أسرة مكوّنة من{" "}
                        <span className="font-bold text-foreground">
                          {adults + children === 1 ? "شخص واحد" : adults + children === 2 ? "شخصين" : `${adults + children} أشخاص`}
                        </span>
                        {" "}({adults === 1 ? "بالغ واحد" : adults === 2 ? "بالغين" : `${adults} بالغين`}
                        {children > 0 ? ` و${children === 1 ? "طفل واحد" : children === 2 ? "طفلين" : `${children} أطفال`}` : ""})
                      </p>
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
                  className="h-11 px-4"
                  onClick={() => setStep(s => s - 1)}
                  disabled={saving}
                >
                  <ChevronRight className="h-4 w-4 ml-1" />
                  السابق
                </Button>
              )}
              <Button
                className="flex-1 h-11 text-sm font-semibold"
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

            <h2 className="text-lg font-bold text-foreground">تم! حسابك جاهز</h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px]">
              سجّل أول مصروف وشوف تدبير يشتغل.
            </p>

            <Button
              className="w-full h-12 text-sm font-semibold mt-6"
              onClick={goAddExpense}
            >
              <Plus className="h-4 w-4 ml-2" /> سجّل أول مصروف
            </Button>

            <button
              onClick={dismiss}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors mt-4"
            >
              لاحقاً
            </button>
          </div>
        )}

      </SheetContent>
    </Sheet>
  );
}
