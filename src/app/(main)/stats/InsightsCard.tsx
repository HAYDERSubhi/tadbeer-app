// src/app/(main)/stats/InsightsCard.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, TrendingDown, TrendingUp, Wallet, PieChart, AlertCircle, RefreshCw } from "lucide-react";
import { analyzeSpendingPatternsAction } from '@/app/actions';
import type { AnalyzeSpendingPatternsInput } from '@/ai/flows/analyze-spending-patterns';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import type { Expense } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from 'date-fns';
import { formatYearMonth } from '@/lib/arabic-date';

interface InsightsCardProps {
  filteredExpenses: Expense[];
  periodDescription: string;
  /** All expenses — used to derive previous period for trend comparison */
  allExpenses?: Expense[];
  /** The selected period key e.g. "2026-05" or "2026" */
  selectedPeriod?: string;
  view?: 'month' | 'year';
}

const IconMap: Record<string, React.ElementType> = { TrendingUp, TrendingDown, Wallet, PieChart };

export function InsightsCard({
  filteredExpenses,
  periodDescription,
  allExpenses = [],
  selectedPeriod,
  view = 'month',
}: InsightsCardProps) {
  const { userSettings, isLoading: isAppDataLoading } = useAppData();
  const { categoryMap } = useCategories();

  // ── Previous period expenses for trend comparison ─────────────────────────
  const { prevExpenses, prevDescription } = useMemo(() => {
    if (!allExpenses.length || !selectedPeriod) return { prevExpenses: [], prevDescription: '' };

    let prevStart: Date, prevEnd: Date, prevDesc: string;

    if (view === 'month' && selectedPeriod.length === 7) {
      const [y, m] = selectedPeriod.split('-').map(Number);
      const prevMonth = subMonths(new Date(y, m - 1, 1), 1);
      prevStart = startOfMonth(prevMonth);
      prevEnd   = endOfMonth(prevMonth);
      prevDesc  = formatYearMonth(format(prevMonth, 'yyyy-MM'));
    } else {
      const year = parseInt(selectedPeriod, 10);
      prevStart = new Date(year - 1, 0, 1);
      prevEnd   = new Date(year - 1, 11, 31, 23, 59, 59);
      prevDesc  = `عام ${year - 1}`;
    }

    const prev = allExpenses.filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start: prevStart, end: prevEnd }); }
      catch { return false; }
    });

    return { prevExpenses: prev, prevDescription: prevDesc };
  }, [allExpenses, selectedPeriod, view]);

  // ── Build AI input ────────────────────────────────────────────────────────
  const analysisInput = useMemo((): AnalyzeSpendingPatternsInput | null => {
    if (isAppDataLoading || filteredExpenses.length === 0) return null;

    const mapExpense = (e: Expense) => ({
      title: e.title,
      amount: e.amount,
      category: categoryMap[e.category]?.name || e.category,
      date: format(parseISO(e.date), 'yyyy-MM-dd'),
    });

    return {
      expenses: filteredExpenses.map(mapExpense),
      ...(prevExpenses.length > 0 && {
        previousPeriodExpenses: prevExpenses.map(mapExpense),
        previousPeriodDescription: prevDescription,
      }),
      totalBudget: userSettings?.budget?.totalBudget,
      periodDescription,
      appTone: userSettings?.appTone ?? 'formal',
    };
  }, [filteredExpenses, prevExpenses, prevDescription, periodDescription, userSettings, categoryMap, isAppDataLoading]);

  // Stable cache key — changes when the actual expense data changes
  const cacheKey = useMemo(() => {
    if (!analysisInput) return null;
    const hash = filteredExpenses.map(e => `${e.id}:${e.amount}`).join('|').slice(0, 300);
    return `insights-${periodDescription}-${hash}`;
  }, [analysisInput, filteredExpenses, periodDescription]);

  const { data: analysis, isLoading, isError, refetch } = useQuery({
    queryKey: ['spending-analysis', cacheKey],
    queryFn: () => analyzeSpendingPatternsAction(analysisInput!),
    enabled: !!analysisInput && !!cacheKey,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
    retry: 1,
  });

  // ── Empty state ───────────────────────────────────────────────────────────
  if (filteredExpenses.length === 0) return null;

  // ── Card ──────────────────────────────────────────────────────────────────
  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Bot className="h-4 w-4 text-primary" />
          التحليل الذكي
        </CardTitle>
        <CardDescription className="text-xs">
          {prevExpenses.length > 0
            ? `تحليل مقارن مع ${prevDescription}`
            : `تحليل إنفاق ${periodDescription}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : isError || !analysis ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">تعذّر جلب التحليل. تحقق من اتصالك بالإنترنت.</p>
            <Button size="sm" variant="outline" className="gap-2 text-xs h-8" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
              إعادة المحاولة
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Summary */}
            <div className="rounded-lg bg-muted/50 px-3 py-2.5">
              <p className="text-xs text-foreground leading-relaxed">{analysis.performanceSummary}</p>
            </div>

            {/* Highest spending category */}
            {analysis.highestSpendingCategory.amount > 0 && (
              <div className="rounded-lg border px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground mb-1">أعلى فئة إنفاقاً</p>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-bold text-sm">{analysis.highestSpendingCategory.category}</p>
                  <p className="font-bold text-sm text-primary">
                    {analysis.highestSpendingCategory.amount.toLocaleString()} د.ع
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(analysis.highestSpendingCategory.percentage, 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {analysis.highestSpendingCategory.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* Key observations */}
            <div className="space-y-2">
              {analysis.keyObservations.map((obs, i) => {
                const Icon = IconMap[obs.icon] ?? Bot;
                return (
                  <div key={i} className="flex items-start gap-2.5 text-xs">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <p className="leading-relaxed">{obs.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
