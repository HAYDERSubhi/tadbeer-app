"use client";

/**
 * OnboardingSheet — First-time setup wizard (shown once after signup).
 *
 * تجربة دخول واحدة من ٥ شاشات داخل نفس الـ Sheet (بلا فتح/إغلاق بينها):
 *   0. ترحيب  (قيمة + ٣ نقاط، بلا إدخال)            ← phase: 'welcome'
 *   1. الميزانية (إلزامية)                          ┐ phase: 'steps'
 *   2. الأسرة   (يخصّص توصيات الذكاء)                 ┘
 *
 * ⛔ خطوة «الدخل» حُذفت بقرار المالك 2026-11-14: الميزانية هي ما تبني عليه الرئيسية
 *   (المتبقي، الشريط، التنبيهات)، والدخل سؤال حساس يتردّد فيه الناس، وصاحب الدخل
 *   اليومي لا يعرفه أصلاً. الدخل يُسجَّل لاحقاً (الإعدادات · «دخل» في شاشة الإضافة).
 *   لا تُعِدها بلا قراره. والمعالج **لا يكتب** monthlyIncome إطلاقاً كي لا يمسح قيمة قائمة.
 *   4. انطلاق  («تم» + زر يقود مباشرة لأول مصروف)     ← phase: 'launch'
 *
 * بعد أول مصروف تبدأ «الجولة التعريفية» (مكوّن منفصل، غير ممسوس هنا).
 * Persisted in Firestore via updateUserSettings.
 * Completion flag stored in localStorage so it never shows again.
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { track } from "@/lib/track";
import { useAppData } from "@/hooks/use-app-data";
import { useToast } from "@/hooks/use-toast";
import { updateUserSettings } from "@/services/firestore";
import type { UserSettings } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Target, Users, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, Baby, UserRound, Plus, Minus,
  Sparkles, Zap, Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/normalize-digits";
import { useKeyboardFit } from "@/hooks/use-keyboard-fit";
import { useIsMobile } from "@/hooks/use-mobile";
import { isNewSignup } from "@/lib/new-signup";

const ONBOARDING_KEY = "tadbeer-onboarding-v1";
const TOTAL_STEPS    = 2;

type Phase = "welcome" | "steps" | "launch";

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) =>
  n > 0 ? new Intl.NumberFormat("en-US").format(n) : "";

const parse = (s: string) => {
  const n = Number(normalizeDigits(s).replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

/* الميزانية كما تُحفظ — مصدر واحد للحفظ الجزئي والإنهاء */
const budgetPayload = (total: number) => ({
  totalBudget: total,
  weeklyBudget: Math.round(total / 4),
  zeroSpendDaysTarget: 4,
}) as UserSettings["budget"];

/* عناوين الخطوات — تُعرض في عدّاد التقدّم */
const stepTitles = ["الميزانية", "الأسرة"];

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
  // الهاتف: الورقة ترتفع فوق لوحة المفاتيح، وزرّ «التالي» يبقى ظاهراً (فيديو المالك 2026-11-14).
  const isMobile = useIsMobile();
  const kbBox = useKeyboardFit(open && isMobile);
  // لوحة المفاتيح مفتوحة؟ ⇒ نُخفي الأسطر الثانوية كي يتّسع الحقل وزرّ «التالي» معاً فوقها.
  // (فيديو المالك 2026-11-14 الثاني: كان الحقل يُدفَع تحت الزرّ ويُقصّ نصفه خلف اللوحة.)
  const kbOpen = !!kbBox && typeof window !== "undefined" && kbBox.height < window.innerHeight * 0.8;
  // زرّ ✓ في لوحة الأرقام يتقدّم خطوة بدل أن يغلق اللوحة فقط.
  const onEnterNext = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (canProceed() && !saving) next();
  };

  /* form state */
  const [totalBudget,  setTotalBudget]  = useState("");
  const [adults,       setAdults]       = useState(1);
  const [children,     setChildren]     = useState(0);

  /* show only once, only for users who haven't set a budget yet */
  const decidedRef = useRef(false);
  useEffect(() => {
    if (decidedRef.current) return;       // قرار الفتح يُتّخذ مرة واحدة فقط
    if (!user) return;
    // حساب أُنشئ الآن في هذه الجلسة ⇒ لا إعدادات له يقيناً: افتح فوراً بلا انتظار الجلب
    // (كان المستخدم الجديد ينتظر ~٤ ثوانٍ أمام هيكل تحميل). السبب في lib/new-signup.ts.
    if (!localStorage.getItem(ONBOARDING_KEY) && isNewSignup(user.uid)) {
      decidedRef.current = true;
      setOpen(true);
      return;
    }
    // المعالج صار يُركَّب في الـ layout قبل اكتمال جلب الإعدادات — انتظر البيانات الحقيقية
    // قبل القرار، وإلا قد نفتحه لمستخدم عائد بناءً على القيم المؤقتة (دخل=0).
    if (!isSettingsFetched) return;
    decidedRef.current = true;             // قرّرنا الآن — لا نُعيد التقييم مع كل تغيّر لاحق لـ userSettings
    if (localStorage.getItem(ONBOARDING_KEY)) return;
    // مستخدم عائد = له ميزانية. (كان الشرط «دخل وميزانية» قبل حذف خطوة الدخل 2026-11-14؛
    // لو بقي لعاد المعالج لكل من لا دخل له.) الميزانية تُحفظ فور تجاوز خطوتها.
    const hasBudget = (userSettings?.budget?.totalBudget ?? 0) > 0;
    if (hasBudget) {
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

      const budget = parse(totalBudget);
      // ⛔ لا monthlyIncome هنا (انظر رأس الملف)، والميزانية تُكتب فقط إن أُدخلت —
      // التخطّي لا يكتب ميزانية صفراً فوق شيء قائم.
      await updateUserSettings(user.uid, {
        profile: { familyMembers } as UserSettings["profile"],
        ...(budget > 0 ? { budget: budgetPayload(budget) } : {}),
      });
      track(budget > 0 ? "onboarding_finish" : "onboarding_skip");

      localStorage.setItem(ONBOARDING_KEY, "done");
      // ⚠️ لا نُطلِق onboarding-complete هنا: الـ Sheet لا يُغلَق بهذي اللحظة، فقط ينتقل
      // لطور «الانطلاق» ويبقى مفتوحاً. لو أطلقناه هنا، الجولة التعريفية (المستمعة لهذا
      // الحدث بالرئيسية) تحاول تفتح فوق شاشة «الانطلاق» وهي ما زالت مفتوحة وتحجب أزرارها
      // («سجّل أول مصروف»/«لاحقاً» يصيران بلا استجابة). الحدث يُطلَق فقط من goAddExpense
      // و dismiss — اللحظتان الحقيقيتان لإغلاق الـ Sheet.
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
  // هنا فعلياً يُغلَق الـ Sheet، فهذي اللحظة الصحيحة لإطلاق onboarding-complete (تُفعِّل
  // الجولة التعريفية لو المستخدم عاد للرئيسية لاحقاً بلا مصروف محفوظ).
  const goAddExpense = () => {
    // حدّث الإعدادات الآن (عند الخروج) فقط — لا أثناء عرض الانطلاق (يُفكِّك الـ Sheet).
    if (user) queryClient.invalidateQueries({ queryKey: ["userSettings", user.uid] });
    setOpen(false);
    window.dispatchEvent(new CustomEvent('onboarding-complete'));
    router.push("/add-expense");
  };

  const canProceed = () => {
    if (step === 0) return parse(totalBudget) >= 1000;  // الميزانية إلزامية
    return true;
  };

  const next = () => {
    // عند تجاوز خطوة الميزانية (الإلزامية): احفظها فوراً (دمج جزئي آمن) كي لا تضيع
    // مهما أُغلق المعالج لاحقاً — حتى عبر الـ ✕. الأسرة تُحفظ عند الإنهاء.
    if (step === 0 && user) {
      updateUserSettings(user.uid, { budget: budgetPayload(parse(totalBudget)) }).catch(() => {});
      track("onboarding_budget_set");
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
        style={kbBox ? { bottom: kbBox.bottom, maxHeight: Math.round(kbBox.height * 0.92) } : undefined}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >

        {/* ════════ الطور ١: ترحيب ════════ */}
        {phase === "welcome" && (
          <div className="px-5 pt-2 pb-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <SheetHeader className="text-start space-y-0">
              <SheetTitle className="sr-only">مرحباً بك في تدبير</SheetTitle>
              <SheetDescription className="sr-only">شاشة ترحيب قبل إعداد حسابك</SheetDescription>
            </SheetHeader>

            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>

            <h2 className="text-xl font-bold text-foreground">أهلاً بك، لنبدأ بدقيقة واحدة</h2>
            <p className="text-base text-muted-foreground mt-1.5 leading-relaxed">
              تدبير يتابع أموالك بذكاء ويساعدك على إدارتها.
            </p>

            <div className="space-y-4 mt-6">
              {[
                { icon: Zap,    title: "تسجيل سريع",   sub: "أضف مصاريفك بالكتابة أو الصوت أو الفاتورة" },
                { icon: Target, title: "ميزانية ذكية", sub: "تنبيهات قبل أن تتجاوز حدّك الشهري" },
                { icon: Wrench, title: "أدوات مالية",  sub: "ديون، أقساط، وحاسبات تساعدك على القرار" },
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
              لنبدأ <ChevronLeft className="h-5 w-5 ms-1" />
            </Button>

            <button
              onClick={handleFinish}
              disabled={saving}
              className="w-full text-center text-sm font-semibold text-primary hover:opacity-80 transition-opacity disabled:opacity-50 mt-3 py-1"
            >
              {saving ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="h-4 w-4 animate-spin" /> جاري الحفظ...</span>
              ) : (
                "تخطّي الإعداد والمتابعة للتطبيق"
              )}
            </button>
          </div>
        )}

        {/* ════════ الطور ٢: الخطوتان ════════ */}
        {phase === "steps" && (
          <>
            {/* Header */}
            <SheetHeader className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-bold">إعداد تدبير</SheetTitle>
                <button
                  onClick={handleFinish}
                  disabled={saving}
                  className="text-base font-semibold text-primary hover:opacity-80 transition-opacity disabled:opacity-50"
                >
                  تخطّ الباقي
                </button>
              </div>
              <SheetDescription className={cn("text-base text-start", kbOpen && "sr-only")}>
                خطوتان سريعتان لتفعيل ميزات الميزانية
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
              <p className="text-base text-muted-foreground mt-2">
                الخطوة {step + 1} من {TOTAL_STEPS} — <span className="text-primary font-semibold">{stepTitles[step]}</span>
              </p>
            </div>

            {/* Step content */}
            <div className={cn("px-5", !kbOpen && "min-h-[220px]")}>


              {/* ── Step 0: Budget (إلزامية) ───────────────────── */}
              {step === 0 && (
                <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Target className="h-5 w-5 text-primary shrink-0" />
                      <h3 className="font-bold text-lg text-foreground">ما هي ميزانيتك الشهرية؟</h3>
                    </div>
                    <p className={cn("text-base text-muted-foreground leading-relaxed", kbOpen && "hidden")}>
                      منها نحسب المتبقي وتنبيهات التجاوز.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="text"
                        inputMode="numeric"
                        enterKeyHint="next"
                        onKeyDown={onEnterNext}
                        placeholder="مثال: 800,000"
                        // ⛔ لا فتح تلقائي للوحة المفاتيح على الهاتف (تحجب رأس الورقة).
                        autoFocus={!isMobile}
                        value={totalBudget}
                        onChange={e => {
                          const raw = normalizeDigits(e.target.value).replace(/,/g, "");
                          if (/^\d*$/.test(raw)) setTotalBudget(fmt(Number(raw)) || "");
                        }}
                        className="h-14 text-2xl font-bold pe-16 font-mono placeholder:text-base placeholder:font-normal placeholder:font-sans placeholder:text-muted-foreground/60"
                      />
                      <span className="absolute end-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">د.ع</span>
                    </div>

                  </div>
                </div>
              )}

              {/* ── Step 1: Family ─────────────────────────────── */}
              {step === 1 && (
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
            {/* لاصق بأسفل الورقة: يبقى ظاهراً فوق لوحة المفاتيح مهما طال المحتوى */}
            <div className="px-5 py-4 flex gap-3 border-t mt-4 sticky bottom-0 bg-background">
              {step > 0 && (
                <Button
                  variant="outline"
                  className="h-12 px-5 text-sm"
                  onClick={() => setStep(s => s - 1)}
                  disabled={saving}
                >
                  <ChevronRight className="h-4 w-4 me-1" />
                  السابق
                </Button>
              )}
              <Button
                className="flex-1 h-12 text-base font-semibold"
                onClick={next}
                disabled={!canProceed() || saving}
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin me-2" /> جاري الحفظ...</>
                ) : step === TOTAL_STEPS - 1 ? (
                  <><CheckCircle2 className="h-4 w-4 me-2" /> إنهاء الإعداد</>
                ) : (
                  <>التالي <ChevronLeft className="h-4 w-4 ms-1" /></>
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
              سجّل أول مصروف لترى تدبير يعمل.
            </p>

            <Button
              className="w-full h-12 text-base font-semibold mt-7"
              onClick={goAddExpense}
            >
              <Plus className="h-5 w-5 me-2" /> سجّل أول مصروف
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
