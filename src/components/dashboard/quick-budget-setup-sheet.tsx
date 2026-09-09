"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useAppData } from "@/hooks/use-app-data";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updateUserSettings } from "@/services/firestore";
import { requestAndSubscribePush } from "@/hooks/use-push-notifications";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, Wallet, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { normalizeDigits } from "@/lib/normalize-digits";
import type { CurrencyCode, ReminderSlot, UserSettings } from "@/types";

const fmt = (n: number) => (n > 0 ? new Intl.NumberFormat("en-US").format(n) : "");
const parse = (s: string) => {
  const n = Number(normalizeDigits(s).replace(/,/g, ""));
  return isNaN(n) || n < 0 ? 0 : n;
};

export default function QuickBudgetSetupSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const { userSettings, householdId } = useAppData();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [totalBudget, setTotalBudget] = useState("");
  const [income, setIncome] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("IQD");
  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(false);
  const [reminderSlot, setReminderSlot] = useState<ReminderSlot>("evening");
  const [budgetError, setBudgetError] = useState(false);

  // إعادة التعبئة من الإعدادات الحالية في كل مرة تُفتح فيها الشاشة.
  useEffect(() => {
    if (!open || !userSettings) return;
    setTotalBudget(fmt(userSettings.budget?.totalBudget || 0));
    setIncome(fmt(userSettings.profile?.monthlyIncome || 0));
    setCurrency(userSettings.currency || "IQD");
    setDailyReminderEnabled(userSettings.notifications?.dailyReminderEnabled ?? false);
    setReminderSlot(userSettings.notifications?.reminderSlot ?? "evening");
    setBudgetError(false);
  }, [open, userSettings]);

  const saveMutation = useMutation({
    mutationFn: (settings: Partial<UserSettings>) =>
      updateUserSettings(user!.uid, settings, householdId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["userSettings", user?.uid] });
      toast({ title: "تم الحفظ", description: "إعداداتك جاهزة الآن." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "تعذّر حفظ الإعدادات.", variant: "destructive" });
    },
  });

  // ⛔ لا تُعِد «شغّل الزرّ ثم اطلب الإذن ولا تبالِ بالنتيجة».
  // كان الزرّ يبقى مشغّلاً ويُحفظ الإعداد حتى لو رفض المستخدم إذن الإشعارات،
  // فيظنّ أن التذكير يعمل ولا يصله شيء أبداً — وعدٌ كاذب. وكان يضخّم أيضاً رقم
  // «المفعِّلين» الذي نقيس عليه نجاح التذكير (خط الأساس ١٦٪).
  // القاعدة: **لا يُحفظ التفعيل إلا بإذن ممنوح فعلاً.** الإطفاء لا يحتاج إذناً.
  const handleReminderToggle = async (checked: boolean) => {
    if (!checked) { setDailyReminderEnabled(false); return; }
    setDailyReminderEnabled(true);            // تغذية فورية للضغطة
    if (!user) return;
    const granted = await requestAndSubscribePush(user);
    if (!granted) {
      setDailyReminderEnabled(false);         // تراجع: لا نَعِد بما لا يصل
      toast({
        title: 'لم يُفعَّل التذكير',
        description: 'الإشعارات غير مسموحة لتدبير على هذا الجهاز. اسمح بها من إعدادات الهاتف ثم أعد المحاولة.',
      });
    }
  };

  const handleSave = () => {
    const budgetNum = parse(totalBudget);
    if (budgetNum <= 0) {
      setBudgetError(true);
      return;
    }
    const incomeNum = parse(income);

    saveMutation.mutate({
      budget: {
        totalBudget: budgetNum,
        weeklyBudget: 0,
        zeroSpendDaysTarget: userSettings?.budget?.zeroSpendDaysTarget || 4,
      },
      ...(incomeNum > 0 ? { profile: { monthlyIncome: incomeNum } } : {}),
      currency,
      notifications: { dailyReminderEnabled, reminderSlot },
    });
  };

  const formContent = (
    <div className="px-5 pb-6 space-y-6">
      {/* الحقل الأساسي: الميزانية */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-primary shrink-0" />
          <h3 className="font-bold text-base text-foreground">ما هي ميزانيتك الشهرية؟</h3>
        </div>
        <Input
          type="text"
          inputMode="numeric"
          placeholder="مثال: 500,000"
          value={totalBudget}
          onChange={(e) => {
            const raw = normalizeDigits(e.target.value).replace(/,/g, "");
            if (/^\d*$/.test(raw)) {
              setTotalBudget(fmt(Number(raw)) || "");
              setBudgetError(false);
            }
          }}
          className="h-14 text-2xl font-bold font-mono"
          autoFocus
        />
        {budgetError && (
          <p className="text-xs text-destructive">الميزانية مطلوبة لتفعيل التنبيهات.</p>
        )}
      </div>

      {/* ── التذكير اليومي — عنصر أساسي لا «إعداد إضافي» (رُفع 2026-09-09) ──
          كان آخر بند في القسم الاختياري، بأصغر خطّ في الشاشة (١١ بكسل رمادي).
          📊 القياس الذي أوجب رفعه (نسخة 2026-09-05، حسابات حقيقية بلا ضيوف):
          من **٢٧٨ فتحوا هذه الشاشة نفسها** وحدّدوا ميزانية، فعّل التذكير
          **٤٤ فقط (١٦٪)** — أي أن ٨٤٪ رأوا الزرّ وتركوه مطفأً. فالمشكلة
          موضعه وشكله لا اكتشافه.
          **خط الأساس للمقارنة: ١٦٪.** ⛔ لا تحكم على هذا التغيير بلا مقارنة به.
          ⚠️ ويبقى **مطفأً افتراضياً** عمداً: التشغيل التلقائي يطلب إذن النظام
          في لحظة لا يتوقّعها المستخدم، ومن يرفضه حينها يُغلق الباب نهائياً. */}
      <div className="space-y-3 rounded-xl border-2 border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bell className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <Label className="text-sm font-semibold text-foreground">تذكير يومي بتسجيل مصاريفك</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                رسالة قصيرة في وقت تختاره — تجعل التسجيل عادة.
              </p>
            </div>
          </div>
          <Switch
            checked={dailyReminderEnabled}
            onCheckedChange={handleReminderToggle}
            aria-label="التذكير اليومي"
          />
        </div>

        {dailyReminderEnabled && (
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: "morning", label: "صباحاً" },
              { key: "afternoon", label: "ظهراً" },
              { key: "evening", label: "مساءً" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setReminderSlot(key)}
                className={cn(
                  "rounded-lg border-2 py-2 text-xs font-semibold transition-colors",
                  reminderSlot === key
                    ? "border-primary bg-background text-foreground"
                    : "border-transparent bg-background/60 text-muted-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* الحقول الاختيارية — بخط أخفت للدلالة على أنها ثانوية */}
      <div className="space-y-5">
        <p className="text-xs font-medium text-muted-foreground">إعدادات إضافية (اختياري)</p>

        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">الدخل الشهري</Label>
          <Input
            type="text"
            inputMode="numeric"
            placeholder="مثال: 800,000"
            value={income}
            onChange={(e) => {
              const raw = normalizeDigits(e.target.value).replace(/,/g, "");
              if (/^\d*$/.test(raw)) setIncome(fmt(Number(raw)) || "");
            }}
            className="h-10 text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-normal text-muted-foreground">العملة</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as CurrencyCode)}>
            <SelectTrigger className="h-10 text-sm">
              <SelectValue placeholder="اختر العملة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="IQD">🇮🇶 دينار عراقي (د.ع)</SelectItem>
              <SelectItem value="SAR">🇸🇦 ريال سعودي (ر.س)</SelectItem>
              <SelectItem value="KWD">🇰🇼 دينار كويتي (د.ك)</SelectItem>
              <SelectItem value="AED">🇦🇪 درهم إماراتي (د.إ)</SelectItem>
              <SelectItem value="EGP">🇪🇬 جنيه مصري (ج.م)</SelectItem>
              <SelectItem value="USD">🇺🇸 دولار أمريكي ($)</SelectItem>
              <SelectItem value="EUR">🇪🇺 يورو (€)</SelectItem>
              <SelectItem value="GBP">🇬🇧 جنيه إسترليني (£)</SelectItem>
              <SelectItem value="TRY">🇹🇷 ليرة تركية (₺)</SelectItem>
            </SelectContent>
          </Select>
        </div>

      </div>

      <Button
        className="w-full h-12 text-base font-semibold"
        onClick={handleSave}
        disabled={saveMutation.isPending}
      >
        {saveMutation.isPending ? (
          <><Loader2 className="h-4 w-4 animate-spin ml-2" /> جاري الحفظ...</>
        ) : (
          "حفظ"
        )}
      </Button>
    </div>
  );

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl px-0 pb-0 max-h-[92dvh] overflow-y-auto"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <SheetHeader className="px-5 pt-5 pb-2 text-right">
            <SheetTitle className="text-lg font-bold">أكمل إعداد ميزانيتك</SheetTitle>
            <SheetDescription className="text-sm">خطوة واحدة لتفعيل التنبيهات الذكية.</SheetDescription>
          </SheetHeader>
          {formContent}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>أكمل إعداد ميزانيتك</DialogTitle>
          <DialogDescription>خطوة واحدة لتفعيل التنبيهات الذكية.</DialogDescription>
        </DialogHeader>
        {formContent}
      </DialogContent>
    </Dialog>
  );
}
