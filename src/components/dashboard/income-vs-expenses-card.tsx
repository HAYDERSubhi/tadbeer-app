"use client";

// بطاقة الدخل في الرئيسية: رقمان منفصلان لا مجموعاً واحداً (قرار المالك 2026-11-13).
//   «المتوقَّع شهرياً»  = profile.monthlyIncome (تقدير المستخدم أو مجموع دخله المتكرر)
//   «المستلَم هذا الشهر» = مجموع ما سجّله بنفسه من دخل لمرة واحدة في الشهر الحالي
// ⛔ لا تجمعهما: من كتب تقديراً شهرياً ثم سجّل دخله اليومي يُعدّ دخله مرتين.
import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, HandCoins } from "lucide-react";
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export function IncomeVsExpensesCard() {
  const { expenses, incomes, userSettings, isLoading } = useAppData();
  const { format: formatCurrency } = useCurrency();

  const { expected, received, hasLoggedIncome, spent } = useMemo(() => {
    const now = new Date();
    const range = { start: startOfMonth(now), end: endOfMonth(now) };
    const inMonth = (iso: string) => {
      try { return isWithinInterval(parseISO(iso), range); } catch { return false; }
    };

    const oneTime = incomes.filter(i => i.type === 'one-time');
    return {
      expected: userSettings?.profile?.monthlyIncome || 0,
      received: oneTime.filter(i => inMonth(i.date)).reduce((s, i) => s + i.amount, 0),
      hasLoggedIncome: oneTime.length > 0,
      spent: expenses.filter(e => inMonth(e.date)).reduce((s, e) => s + e.amount, 0),
    };
  }, [expenses, incomes, userSettings]);

  // لا تظهر لمن لا دخل عنده مسجَّلاً ولا مقدَّراً — فلا زحام في الرئيسية بلا فائدة.
  if (isLoading || (expected <= 0 && !hasLoggedIncome)) return null;

  const columns = [
    expected > 0 && {
      key: 'expected', label: 'المتوقَّع شهرياً', value: expected,
      icon: <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />,
      bg: 'bg-green-500/10', text: 'text-green-600 dark:text-green-400',
    },
    hasLoggedIncome && {
      key: 'received', label: 'المستلَم هذا الشهر', value: received,
      icon: <HandCoins className="h-4 w-4 text-primary" />,
      bg: 'bg-primary/10', text: 'text-primary',
    },
    {
      key: 'spent', label: 'المصروف هذا الشهر', value: spent,
      icon: <TrendingDown className="h-4 w-4 text-destructive" />,
      bg: 'bg-destructive/10', text: 'text-destructive',
    },
  ].filter(Boolean) as { key: string; label: string; value: number; icon: React.ReactNode; bg: string; text: string }[];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className={columns.length === 3 ? 'grid grid-cols-3 divide-x divide-x-reverse divide-border' : 'grid grid-cols-2 divide-x divide-x-reverse divide-border'}>
          {columns.map(c => (
            <div key={c.key} className="flex flex-col items-center justify-center p-3 gap-1 text-center">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${c.bg}`}>{c.icon}</div>
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-xs font-bold ${c.text}`}><bdi>{formatCurrency(c.value)}</bdi></p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
