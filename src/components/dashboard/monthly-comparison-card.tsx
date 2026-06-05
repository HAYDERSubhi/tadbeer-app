"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';
import {
  startOfMonth, endOfMonth, subMonths,
  isWithinInterval, parseISO, format
} from 'date-fns';
import { ar } from 'date-fns/locale';

export function MonthlyComparisonCard() {
  const { expenses, isLoading } = useAppData();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();

  const { current, previous, diff, pct, topCategories } = useMemo(() => {
    const now = new Date();
    const curStart = startOfMonth(now);
    const curEnd = endOfMonth(now);
    const prevStart = startOfMonth(subMonths(now, 1));
    const prevEnd = endOfMonth(subMonths(now, 1));

    const curExpenses = expenses.filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start: curStart, end: curEnd }); }
      catch { return false; }
    });

    const prevExpenses = expenses.filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start: prevStart, end: prevEnd }); }
      catch { return false; }
    });

    const current = curExpenses.reduce((s, e) => s + e.amount, 0);
    const previous = prevExpenses.reduce((s, e) => s + e.amount, 0);
    const diff = current - previous;
    const pct = previous > 0 ? Math.abs((diff / previous) * 100) : null;

    // Top 3 categories this month
    const catTotals: Record<string, number> = {};
    curExpenses.forEach(e => {
      catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
    });
    const topCategories = Object.entries(catTotals)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([id, amount]) => ({
        name: categoryMap[id]?.name || id,
        icon: categoryMap[id]?.icon || '💸',
        amount,
        pct: current > 0 ? (amount / current) * 100 : 0,
      }));

    return { current, previous, diff, pct, topCategories };
  }, [expenses, categoryMap]);

  if (isLoading) return null;
  if (expenses.length === 0) return null;

  const isUp = diff > 0;
  const isDown = diff < 0;
  const isEqual = diff === 0;

  const currentMonthName = format(new Date(), 'MMMM', { locale: ar });
  const prevMonthName = format(subMonths(new Date(), 1), 'MMMM', { locale: ar });

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          {isUp ? (
            <TrendingUp className="h-4 w-4 text-destructive" />
          ) : isDown ? (
            <TrendingDown className="h-4 w-4 text-green-500" />
          ) : (
            <Minus className="h-4 w-4 text-muted-foreground" />
          )}
          مقارنة شهرية
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Numbers Row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
            <p className="text-[10px] text-muted-foreground mb-1">{currentMonthName} (الحالي)</p>
            <p className="font-bold text-sm text-primary">{formatCurrency(current)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 border">
            <p className="text-[10px] text-muted-foreground mb-1">{prevMonthName} (الماضي)</p>
            <p className="font-bold text-sm">{formatCurrency(previous)}</p>
          </div>
        </div>

        {/* Verdict */}
        <div className={cn(
          "flex items-center justify-between p-3 rounded-lg text-xs font-semibold",
          isUp && "bg-destructive/10 text-destructive",
          isDown && "bg-green-500/10 text-green-700 dark:text-green-400",
          isEqual && "bg-muted text-muted-foreground"
        )}>
          <span>
            {isUp && `أنفقت أكثر بـ ${formatCurrency(Math.abs(diff))}`}
            {isDown && `وفّرت ${formatCurrency(Math.abs(diff))} مقارنة بالشهر الماضي 🎉`}
            {isEqual && 'نفس الإنفاق كالشهر الماضي'}
          </span>
          {pct !== null && (
            <span className="font-bold text-sm">
              {isUp ? '+' : isDown ? '-' : ''}{pct.toFixed(1)}%
            </span>
          )}
        </div>

        {/* Top Categories */}
        {topCategories.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-2 font-semibold">أعلى فئات الإنفاق هذا الشهر</p>
            <div className="space-y-2">
              {topCategories.map((cat, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-full">
                    <div className="flex justify-between text-xs mb-0.5">
                      <span className="font-medium">{cat.name}</span>
                      <span className="text-muted-foreground">{cat.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all"
                        style={{ width: `${Math.min(cat.pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
