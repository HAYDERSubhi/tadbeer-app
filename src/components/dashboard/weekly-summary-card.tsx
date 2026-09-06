"use client";

import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TrendingDown, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';
import { useAuth } from '@/hooks/use-auth';
import {
  parseISO,
  startOfWeek,
  endOfWeek,
  subWeeks,
  isWithinInterval,
  differenceInDays,
  getDay,
  format as formatDate,
} from 'date-fns';

// أسبوع تدبير يبدأ السبت وينتهي الجمعة. البطاقة تلخّص الأسبوع المنتهي، فموعدها
// السبت — أول يوم في الأسبوع الجديد — مرّة واحدة.
// والأحد فرصة أخيرة لمن لم يفتح التطبيق يوم السبت فلم تُعرض عليه أصلاً.
const WEEK_STARTS_ON = 6 as const;
const SATURDAY = 6;
const SUNDAY = 0;

// نافذة الظهور الممكنة (قبل النظر في حالة المستخدم): السبت أو الأحد.
export function isSummaryWindow(now: Date): boolean {
  const day = getDay(now);
  return day === SATURDAY || day === SUNDAY;
}

type SummaryState = {
  weekStart: string;
  shown?: boolean;     // عُرضت فعلاً على المستخدم في هذا الأسبوع
  dismissed?: boolean; // أغلقها المستخدم بنفسه
};

// القرار النهائي للظهور. حالةٌ من أسبوع سابق تُعامَل كأن لا حالة.
export function shouldShowOn(now: Date, state: SummaryState | null): boolean {
  if (!isSummaryWindow(now)) return false;
  const current = state?.weekStart === weekKey(now) ? state : null;
  if (current?.dismissed) return false;
  // الأحد لمن لم يرها السبت فقط
  if (getDay(now) === SUNDAY && current?.shown) return false;
  return true;
}

function getStorageKey(uid: string) {
  return `weekly-summary-dismissed-${uid}`;
}

// مفتاح الأسبوع = تاريخ السبت الذي بدأ به.
// ⚠️ كان المخزَّن رقمَ الأسبوع من getWeek، وهي تعدّ الأسبوع من الأحد افتراضاً —
// فالسبت والأحد يقعان عندها في «أسبوعين» مختلفين، وكان إغلاق البطاقة يوم السبت
// لا يمنع ظهورها ثانيةً يوم الأحد. تاريخ بداية الأسبوع لا يحتمل هذا اللبس.
export function weekKey(now: Date): string {
  return formatDate(startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON }), 'yyyy-MM-dd');
}

function readState(uid: string): SummaryState | null {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // الشكل القديم (رقم أسبوع) لا يطابق، فيُعامَل كأن لا حالة — بلا ضرر
    return typeof parsed?.weekStart === 'string' ? (parsed as SummaryState) : null;
  } catch {
    return null;
  }
}

// دمج مع حالة الأسبوع نفسه كي لا يمحو تسجيلُ «عُرضت» إغلاقَ المستخدم ولا العكس
function saveState(uid: string, patch: Partial<Omit<SummaryState, 'weekStart'>>) {
  try {
    const key = weekKey(new Date());
    const prev = readState(uid);
    const base: SummaryState = prev?.weekStart === key ? prev : { weekStart: key };
    localStorage.setItem(getStorageKey(uid), JSON.stringify({ ...base, ...patch }));
  } catch {}
}

export function WeeklySummaryCard() {
  const { user } = useAuth();
  const { expenses, isExpensesFetched } = useAppData();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();
  // null = لم يُقرَّر بعد. القرار يُتَّخذ مرّة واحدة بعد أن تُعرف هوية المستخدم،
  // ولا يُعاد حسابه بعدها — لأن تسجيل «عُرضت» كان سيُخفيها أمام صاحبها فوراً.
  const [allowed, setAllowed] = useState<boolean | null>(null);

  const data = useMemo(() => {
    if (!isExpensesFetched || !expenses.length) return null;

    const now = new Date();

    // خارج نافذة السبت/الأحد لا حاجة لأي حساب
    if (!isSummaryWindow(now)) return null;

    const weekStart = { weekStartsOn: WEEK_STARTS_ON };

    const lastWeekStart = startOfWeek(subWeeks(now, 1), weekStart);
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), weekStart);
    const prevWeekStart = startOfWeek(subWeeks(now, 2), weekStart);
    const prevWeekEnd = endOfWeek(subWeeks(now, 2), weekStart);

    // تحقق أن المستخدم مسجل منذ 14 يوم على الأقل
    const userCreatedAt = user?.metadata?.creationTime
      ? new Date(user.metadata.creationTime)
      : null;
    if (userCreatedAt && differenceInDays(now, userCreatedAt) < 14) return null;

    const lastWeekExpenses = expenses.filter((e) => {
      try {
        return isWithinInterval(parseISO(e.date), { start: lastWeekStart, end: lastWeekEnd });
      } catch { return false; }
    });

    // يجب وجود 3 مصاريف على الأقل الأسبوع الماضي
    if (lastWeekExpenses.length < 3) return null;

    // تحقق أن آخر مصروف منذ 14 يوم أو أقل
    const sortedByDate = [...expenses].sort(
      (a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()
    );
    const lastExpenseDate = sortedByDate[0] ? parseISO(sortedByDate[0].date) : null;
    if (lastExpenseDate && differenceInDays(now, lastExpenseDate) > 14) return null;

    const prevWeekExpenses = expenses.filter((e) => {
      try {
        return isWithinInterval(parseISO(e.date), { start: prevWeekStart, end: prevWeekEnd });
      } catch { return false; }
    });

    const lastWeekTotal = lastWeekExpenses.reduce((s, e) => s + e.amount, 0);
    const prevWeekTotal = prevWeekExpenses.reduce((s, e) => s + e.amount, 0);

    // أعلى فئة إنفاقاً الأسبوع الماضي
    const byCategory: Record<string, number> = {};
    lastWeekExpenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    });
    const topCategoryId = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0]?.[0];
    const topCategoryName = topCategoryId
      ? (categoryMap[topCategoryId]?.name ?? topCategoryId)
      : null;
    const topCategoryAmount = topCategoryId ? byCategory[topCategoryId] : 0;

    const diff = prevWeekTotal > 0
      ? Math.round(((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 100)
      : null;

    const isImproved = diff !== null && diff < 0;
    const isWorse = diff !== null && diff > 0;

    return {
      lastWeekTotal,
      prevWeekTotal,
      diff,
      isImproved,
      isWorse,
      topCategoryName,
      topCategoryAmount,
    };
  }, [expenses, isExpensesFetched, categoryMap, user]);

  useEffect(() => {
    if (!user || allowed !== null) return;
    setAllowed(shouldShowOn(new Date(), readState(user.uid)));
  }, [user, allowed]);

  const visible = !!data && allowed === true;

  // تسجيل أنها عُرضت فعلاً — عليه وحده يتوقف ظهورها يوم الأحد
  useEffect(() => {
    if (visible && user) saveState(user.uid, { shown: true });
  }, [visible, user]);

  const handleDismiss = () => {
    if (user) saveState(user.uid, { dismissed: true });
    setAllowed(false);
  };

  if (!visible || !data) return null;

  const { lastWeekTotal, prevWeekTotal, diff, isImproved, isWorse, topCategoryName, topCategoryAmount } = data;

  const maxBar = Math.max(lastWeekTotal, prevWeekTotal, 1);
  const lastWeekPct = Math.round((lastWeekTotal / maxBar) * 100);
  const prevWeekPct = Math.round((prevWeekTotal / maxBar) * 100);

  return (
    <Card dir="rtl">
      <CardHeader className="py-3 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          {isImproved
            ? <TrendingDown className="h-4 w-4 text-emerald-600" />
            : isWorse
            ? <TrendingUp className="h-4 w-4 text-red-500" />
            : <TrendingDown className="h-4 w-4 text-muted-foreground" />}
          ملخص الأسبوع الماضي
          {diff !== null && (
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded-full font-medium',
              isImproved
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300'
                : isWorse
                ? 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300'
                : 'bg-muted text-muted-foreground'
            )}>
              {isImproved
                ? <>أقل بـ <bdi>{Math.abs(diff)}%</bdi></>
                : isWorse
                ? <>أعلى بـ <bdi>{diff}%</bdi></>
                : 'مستقر'}
            </span>
          )}
        </CardTitle>
        <button
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="إغلاق"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* الأشرطة المقارنة */}
        {prevWeekTotal > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-24 shrink-0 text-start">قبل أسبوعين</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-muted-foreground/40 transition-all"
                  style={{ width: `${prevWeekPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-20 shrink-0"><bdi>{formatCurrency(prevWeekTotal)}</bdi></span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium w-24 shrink-0 text-start">الأسبوع الماضي</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isImproved ? 'bg-emerald-500' : isWorse ? 'bg-red-400' : 'bg-primary'
                  )}
                  style={{ width: `${lastWeekPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium w-20 shrink-0"><bdi>{formatCurrency(lastWeekTotal)}</bdi></span>
            </div>
          </div>
        )}

        {/* رسالة الاستنتاج */}
        <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed">
          {isImproved && diff !== null
            ? <>أحسنت — أنفقت أقل هذا الأسبوع. استمر على هذا المسار لتوفير <bdi>{formatCurrency(Math.round(prevWeekTotal - lastWeekTotal))}</bdi> إضافية.</>
            : isWorse && topCategoryName
            ? <>ارتفع إنفاقك هذا الأسبوع — الفئة الأعلى كانت {topCategoryName} بـ <bdi>{formatCurrency(topCategoryAmount)}</bdi>.</>
            : <>أنفقت <bdi>{formatCurrency(lastWeekTotal)}</bdi> الأسبوع الماضي.</>}
        </p>

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs h-8 text-muted-foreground"
          onClick={handleDismiss}
        >
          تم، شكراً
        </Button>
      </CardContent>
    </Card>
  );
}
