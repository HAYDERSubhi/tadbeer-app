"use client";

import { useMemo, useState } from 'react';
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
  getWeek,
  getYear,
  differenceInDays,
  getDay,
} from 'date-fns';

function getStorageKey(uid: string) {
  return `weekly-summary-dismissed-${uid}`;
}

function isDismissedThisWeek(uid: string): boolean {
  try {
    const raw = localStorage.getItem(getStorageKey(uid));
    if (!raw) return false;
    const { week, year } = JSON.parse(raw);
    const now = new Date();
    return week === getWeek(now) && year === getYear(now);
  } catch {
    return false;
  }
}

function dismissThisWeek(uid: string) {
  try {
    const now = new Date();
    localStorage.setItem(
      getStorageKey(uid),
      JSON.stringify({ week: getWeek(now), year: getYear(now) })
    );
  } catch {}
}

export function WeeklySummaryCard() {
  const { user } = useAuth();
  const { expenses, isExpensesFetched } = useAppData();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();
  const [dismissed, setDismissed] = useState(() =>
    user ? isDismissedThisWeek(user.uid) : true
  );

  const data = useMemo(() => {
    if (!isExpensesFetched || !expenses.length) return null;

    const now = new Date();
    const dayOfWeek = getDay(now); // 0=Sun, 6=Sat

    // يظهر فقط يوم السبت (6) أو الأحد (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) return null;

    const weekStart = { weekStartsOn: 6 as const };

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

  const handleDismiss = () => {
    if (user) dismissThisWeek(user.uid);
    setDismissed(true);
  };

  if (!data || dismissed) return null;

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
              {isImproved ? `أقل بـ ${Math.abs(diff)}%` : isWorse ? `أعلى بـ ${diff}%` : 'مستقر'}
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
              <span className="text-[10px] text-muted-foreground w-24 shrink-0 text-right">قبل أسبوعين</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-muted-foreground/40 transition-all"
                  style={{ width: `${prevWeekPct}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-20 shrink-0">{formatCurrency(prevWeekTotal)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium w-24 shrink-0 text-right">الأسبوع الماضي</span>
              <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    isImproved ? 'bg-emerald-500' : isWorse ? 'bg-red-400' : 'bg-primary'
                  )}
                  style={{ width: `${lastWeekPct}%` }}
                />
              </div>
              <span className="text-[10px] font-medium w-20 shrink-0">{formatCurrency(lastWeekTotal)}</span>
            </div>
          </div>
        )}

        {/* رسالة الاستنتاج */}
        <p className="text-[11px] text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 leading-relaxed">
          {isImproved && diff !== null
            ? `أحسنت — أنفقت أقل هذا الأسبوع. استمر على هذا المسار لتوفير ${formatCurrency(Math.round((prevWeekTotal - lastWeekTotal)))} إضافية.`
            : isWorse && topCategoryName
            ? `ارتفع إنفاقك هذا الأسبوع — الفئة الأعلى كانت ${topCategoryName} بـ ${formatCurrency(topCategoryAmount)}.`
            : `أنفقت ${formatCurrency(lastWeekTotal)} الأسبوع الماضي.`}
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
