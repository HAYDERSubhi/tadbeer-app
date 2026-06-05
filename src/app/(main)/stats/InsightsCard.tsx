// src/app/(main)/stats/InsightsCard.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Bot, PieChart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { cn } from '@/lib/utils';
import { analyzeSpendingPatternsAction } from '@/app/actions';
import type { AnalyzeSpendingPatternsOutput, AnalyzeSpendingPatternsInput } from '@/ai/flows/analyze-spending-patterns';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import type { Expense } from '@/types';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery } from '@tanstack/react-query';

interface InsightsCardProps {
  filteredExpenses: Expense[];
  periodDescription: string;
}

const InsightIcon = ({ name, className }: { name: string; className?: string }) => {
  const icons: { [key: string]: React.ElementType } = {
    TrendingUp, TrendingDown, Wallet, PieChart,
  };
  const LucideIcon = icons[name] || Bot;
  return <LucideIcon className={className} />;
};

export function InsightsCard({ filteredExpenses, periodDescription }: InsightsCardProps) {
  const { userSettings, isLoading: isAppDataLoading } = useAppData();
  const { categoryMap } = useCategories();

  // Stable cache key based on actual expense data
  const cacheKey = useMemo(() => {
    const hash = filteredExpenses.map(e => `${e.id}:${e.amount}`).join('|');
    return `insights-${periodDescription}-${hash}`;
  }, [filteredExpenses, periodDescription]);

  const analysisInput = useMemo((): AnalyzeSpendingPatternsInput | null => {
    if (isAppDataLoading) return null;
    return {
      expenses: filteredExpenses.map(e => ({
        title: e.title,
        amount: e.amount,
        category: categoryMap[e.category]?.name || e.category,
        date: e.date,
      })),
      totalBudget: userSettings?.budget?.totalBudget,
      periodDescription,
    };
  }, [filteredExpenses, periodDescription, userSettings, categoryMap, isAppDataLoading]);

  const { data: analysis, isLoading: isAnalysisLoading } = useQuery({
    queryKey: ['spending-analysis', cacheKey],
    queryFn: () => analyzeSpendingPatternsAction(analysisInput!),
    enabled: !!analysisInput && !isAppDataLoading,
    staleTime: 1000 * 60 * 10,   // 10 minutes cache
    gcTime: 1000 * 60 * 30,      // 30 minutes in memory
    retry: 1,
  });

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs">
          <Bot className="h-4 w-4 text-primary" />
          التحليل الذكي
        </CardTitle>
        <CardDescription className="text-xs">تحليل رقمي لنمط إنفاقك في الفترة المحددة.</CardDescription>
      </CardHeader>
      <CardContent>
        {isAnalysisLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <Alert className="bg-muted/50 p-3">
              <AlertDescription className="text-xs text-foreground">
                {analysis.performanceSummary}
              </AlertDescription>
            </Alert>

            {analysis.highestSpendingCategory.amount > 0 && (
              <div className="p-3 rounded-lg border">
                <p className='text-xs text-muted-foreground'>أكبر بند للإنفاق</p>
                <div className="flex items-center justify-between">
                  <p className="font-bold text-sm">{analysis.highestSpendingCategory.category}</p>
                  <p className="font-bold text-sm text-primary">{analysis.highestSpendingCategory.amount.toLocaleString()}&nbsp;د.ع</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="w-full bg-secondary rounded-full h-1.5">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: `${analysis.highestSpendingCategory.percentage}%` }}></div>
                  </div>
                  <span>{analysis.highestSpendingCategory.percentage.toFixed(0)}%</span>
                </div>
              </div>
            )}

            <div>
              <h4 className="text-xs font-semibold mb-2">ملاحظات رئيسية:</h4>
              <div className="space-y-2">
                {analysis.keyObservations.map((obs, index) => (
                  <div key={index} className="flex items-start gap-3 text-xs">
                    <InsightIcon name={obs.icon} className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p>{obs.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground p-4 text-xs">
            لا توجد مصاريف في هذه الفترة لتقديم تحليل حولها.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
