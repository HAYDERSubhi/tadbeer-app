"use client";

/**
 * AiTrendsCard — Cross-month AI pattern analysis.
 * Compares current vs previous month and surfaces specific trend insights.
 * Lives in the stats page between SixMonthChart and MonthlyComparisonCard.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import {
  subMonths, startOfMonth, endOfMonth, isWithinInterval, parseISO, format,
} from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { analyzeMonthlyTrendsAction } from '@/app/actions';
import type { AnalyzeMonthlyTrendsInput } from '@/ai/flows/analyze-monthly-trends';

const ICON_MAP: Record<string, React.ElementType> = {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  Flame,
};

function buildMonthData(
  expenses: { date: string; amount: number; category: string }[],
  monthDate: Date,
  categoryMap: Record<string, { name: string; icon: string }>
) {
  const start = startOfMonth(monthDate);
  const end = endOfMonth(monthDate);

  const filtered = expenses.filter(e => {
    try { return isWithinInterval(parseISO(e.date), { start, end }); }
    catch { return false; }
  });

  const totalSpent = filtered.reduce((s, e) => s + e.amount, 0);

  const catTotals: Record<string, number> = {};
  filtered.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + e.amount;
  });

  const categories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, amount]) => ({
      name: categoryMap[id]?.name ?? id,
      amount,
      percentage: totalSpent > 0 ? Math.round((amount / totalSpent) * 100) : 0,
    }));

  return {
    monthLabel: format(monthDate, 'MMMM', { locale: arIQ }),
    totalSpent,
    categories,
  };
}

export function AiTrendsCard() {
  const { expenses, userSettings, isLoading } = useAppData();
  const { categoryMap } = useCategories();

  const input = useMemo((): AnalyzeMonthlyTrendsInput | null => {
    if (isLoading || expenses.length === 0) return null;
    const now = new Date();
    const prev = subMonths(now, 1);
    return {
      currentMonth: buildMonthData(expenses, now, categoryMap),
      previousMonth: buildMonthData(expenses, prev, categoryMap),
      budget: userSettings?.budget?.totalBudget,
      appTone: userSettings?.appTone ?? 'formal',
    };
  }, [expenses, categoryMap, userSettings, isLoading]);

  // Stable cache key — refresh only when monthly totals change
  const cacheKey = useMemo(() => {
    if (!input) return null;
    return `trends-${input.currentMonth.totalSpent}-${input.previousMonth.totalSpent}`;
  }, [input]);

  const { data, isLoading: isAiLoading } = useQuery({
    queryKey: ['ai-trends', cacheKey],
    queryFn: () => analyzeMonthlyTrendsAction(input!),
    enabled: !!input && !!cacheKey,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  // Don't render if not enough data in either month
  if (!isLoading && (!input || (input.currentMonth.totalSpent === 0 && input.previousMonth.totalSpent === 0))) {
    return null;
  }

  return (
    <Card className="relative overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          رؤى ذكية — مقارنة الأشهر
        </CardTitle>
        <CardDescription className="text-xs">
          تحليل مقارن بين {input?.currentMonth.monthLabel ?? '...'} و{input?.previousMonth.monthLabel ?? '...'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-2 pt-0">
        {isAiLoading || isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : data?.insights?.length ? (
          data.insights.map((insight, i) => {
            const IconComp = ICON_MAP[insight.icon] ?? Lightbulb;
            return (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-3 rounded-lg border px-3 py-2.5',
                  insight.sentiment === 'positive' && 'bg-emerald-50/60 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-800',
                  insight.sentiment === 'warning' && 'bg-amber-50/60 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800',
                  insight.sentiment === 'neutral' && 'bg-muted/40 border-border',
                )}
              >
                <IconComp
                  className={cn(
                    'h-4 w-4 mt-0.5 shrink-0',
                    insight.sentiment === 'positive' && 'text-emerald-600 dark:text-emerald-400',
                    insight.sentiment === 'warning' && 'text-amber-600 dark:text-amber-400',
                    insight.sentiment === 'neutral' && 'text-muted-foreground',
                  )}
                />
                <div className="min-w-0">
                  <p className={cn(
                    'font-semibold text-xs',
                    insight.sentiment === 'positive' && 'text-emerald-700 dark:text-emerald-300',
                    insight.sentiment === 'warning' && 'text-amber-700 dark:text-amber-300',
                    insight.sentiment === 'neutral' && 'text-foreground',
                  )}>
                    {insight.title}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    {insight.description}
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">
            لا توجد بيانات كافية للمقارنة حتى الآن.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
