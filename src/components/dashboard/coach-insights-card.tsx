// src/components/dashboard/coach-insights-card.tsx
"use client";

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Link as LinkIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { InsightIcon } from '@/components/dashboard/insight-icon';
import { financialCoachAction } from '@/app/stats-actions';
import type { FinancialCoachInput } from '@/ai/flows/financial-coach';
import type { Expense, UserSettings } from '@/types';
import { format, parseISO } from 'date-fns';

interface CoachInsightsCardProps {
  filteredExpenses: Expense[];
  userSettings: UserSettings;
  categoryMap: Record<string, { name: string; icon: string }>;
  periodDescription: string;
  selectedPeriod: string; // 'yyyy-MM' or 'yyyy'
}

export function CoachInsightsCard({
  filteredExpenses,
  userSettings,
  categoryMap,
  periodDescription,
  selectedPeriod,
}: CoachInsightsCardProps) {
  const budget = userSettings?.budget?.totalBudget ?? 0;
  const isBudgetSet = budget > 0;

  const coachInput = useMemo((): FinancialCoachInput | null => {
    if (!isBudgetSet || filteredExpenses.length === 0) return null;

    // Derive day context from the selected period
    const periodDate = selectedPeriod.length === 7
      ? new Date(`${selectedPeriod}-01`)
      : new Date(`${selectedPeriod}-01-01`);
    const now = new Date();
    const isCurrentMonth = format(now, 'yyyy-MM') === selectedPeriod;
    const dayOfMonth = isCurrentMonth ? now.getDate() : new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
    const daysInMonth = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 0).getDate();
    const daysLeftInMonth = isCurrentMonth ? daysInMonth - now.getDate() + 1 : 1;
    const currentDate = format(isCurrentMonth ? now : new Date(periodDate.getFullYear(), periodDate.getMonth(), dayOfMonth), 'yyyy-MM-dd');

    const input: FinancialCoachInput = {
      totalBudget: budget,
      zeroSpendDaysTarget: userSettings?.budget?.zeroSpendDaysTarget ?? 4,
      currentDate,
      dayOfMonth,
      daysLeftInMonth,
      expenses: filteredExpenses.map(e => ({
        title: e.title,
        amount: e.amount,
        category: categoryMap[e.category]?.name || e.category,
        date: format(parseISO(e.date), 'yyyy-MM-dd'),
      })),
      appTone: userSettings?.appTone || 'formal',
    };

    const categoryBudgets = userSettings?.categoryBudgets;
    if (categoryBudgets) {
      const named: Record<string, number> = {};
      Object.entries(categoryBudgets).forEach(([id, amt]) => {
        named[categoryMap[id]?.name || id] = amt as number;
      });
      input.categoryBudgets = named;
    }

    const profile = userSettings?.profile;
    if (profile) {
      input.userProfile = {
        monthlyIncome: profile.monthlyIncome,
        familyMembers: profile.familyMembers?.map(({ id, ...rest }: any) => rest) ?? [],
      };
    }

    return input;
  }, [filteredExpenses, userSettings, categoryMap, budget, isBudgetSet, selectedPeriod]);

  const cacheKey = useMemo(() => {
    if (!coachInput) return null;
    const hash = filteredExpenses.map(e => `${e.id}:${e.amount}`).join('|').slice(0, 200);
    return `coach-stats-${selectedPeriod}-${budget}-${hash}`;
  }, [coachInput, selectedPeriod, budget, filteredExpenses]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['coach-stats', cacheKey],
    queryFn: () => financialCoachAction(coachInput!),
    enabled: !!coachInput,
    staleTime: 1000 * 60 * 15,
    gcTime: 1000 * 60 * 60,
    retry: 1,
  });

  const insights = data?.insights ?? [];

  // Don't render card if not useful
  if (!isBudgetSet || filteredExpenses.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-xs text-muted-foreground">
          {!isBudgetSet ? (
            <div className="flex flex-col items-center gap-2">
              <p>حدد ميزانيتك أولاً لتفعيل نصائح المدرب.</p>
              <Button size="sm" variant="outline" asChild className="text-xs h-8">
                <Link href="/settings">الإعدادات</Link>
              </Button>
            </div>
          ) : (
            <p>لا توجد مصاريف في هذه الفترة لتحليلها.</p>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Sparkles className="h-4 w-4 text-primary" />
            نصائح المدرب الذكي
          </CardTitle>
          {!isLoading && (
            <CardDescription className="text-[10px]">{periodDescription}</CardDescription>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-xs text-muted-foreground">تعذّر الاتصال بالمدرب الذكي.</p>
            <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => refetch()}>
              إعادة المحاولة
            </Button>
          </div>
        ) : insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  insight.type === 'praise'  && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                  insight.type === 'tip'     && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                  insight.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                )}>
                  <InsightIcon name={insight.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-sm">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground py-4">
            جارٍ تحليل بياناتك...
          </p>
        )}
      </CardContent>
    </Card>
  );
}
