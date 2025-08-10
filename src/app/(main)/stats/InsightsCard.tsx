// src/app/(main)/stats/InsightsCard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sparkles } from "lucide-react";
import { cn } from '@/lib/utils';
import { financialCoach, type FinancialCoachOutput, type FinancialCoachInput } from '@/ai/flows/financial-coach';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { InsightIcon } from '@/components/dashboard/insight-icon';
import type { Expense } from '@/types';
import { format } from 'date-fns';

interface InsightsCardProps {
  filteredExpenses: Expense[];
}

export function InsightsCard({ filteredExpenses }: InsightsCardProps) {
  const { userSettings, isLoading: isAppDataLoading } = useAppData();
  const { categoryMap } = useCategories();
  
  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);

  const financialCoachInput = useMemo(() => {
    if (isAppDataLoading) return null;
    
    if (filteredExpenses.length === 0) return { isEmpty: true };
    
    // Note: Budget calculations for periods are simplified here.
    // A more complex app might prorate budgets based on the period.
    const totalBudgetForPeriod = userSettings?.budget?.totalBudget || 0;
    
    const input: FinancialCoachInput = {
        totalBudget: totalBudgetForPeriod,
        zeroSpendDaysTarget: userSettings?.budget?.zeroSpendDaysTarget || 4,
        expenses: filteredExpenses.map(e => ({
            title: e.title,
            amount: e.amount,
            category: categoryMap[e.category]?.name || e.category,
            date: format(new Date(e.date), 'yyyy-MM-dd'),
        })),
        appTone: userSettings?.appTone || 'formal',
        categoryBudgets: userSettings?.categoryBudgets || {},
    };
    
    if (userSettings?.profile) {
        input.userProfile = {
            monthlyIncome: userSettings.profile.monthlyIncome,
            familyMembers: userSettings.profile.familyMembers?.map(({ id, ...rest }) => rest) || [],
        };
    }
    
    return input;
  }, [filteredExpenses, userSettings, categoryMap, isAppDataLoading]);

  useEffect(() => {
    if (isAppDataLoading) return;
  
    const getInsights = async () => {
      if (!financialCoachInput) {
          setIsInsightsLoading(true);
          return;
      }
      if ('isEmpty' in financialCoachInput && financialCoachInput.isEmpty) {
        setInsights(null);
        setIsInsightsLoading(false);
        return;
      }
      
      setIsInsightsLoading(true);
      try {
        const result = await financialCoach(financialCoachInput as FinancialCoachInput);
        setInsights(result.insights);
      } catch (e) {
        console.error("Failed to get financial insights for stats page", e);
        setInsights(null);
      } finally {
        setIsInsightsLoading(false);
      }
    };
    
    getInsights();
  }, [financialCoachInput, isAppDataLoading]);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs">
          <Sparkles className="h-4 w-4 text-primary" />
          نصائح ذكية
        </CardTitle>
        <CardDescription className="text-xs">تحليلات وتوصيات بناءً على إنفاقك في الفترة المحددة.</CardDescription>
      </CardHeader>
      <CardContent>
        {isInsightsLoading ? (
          <div className="space-y-4">
            <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
            <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
          </div>
        ) : insights && insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map((insight, index) => (
              <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                 <span className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                  insight.type === 'praise' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                  insight.type === 'tip' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                  insight.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                )}>
                  <InsightIcon name={insight.icon} className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-xs">{insight.title}</p>
                  <p className="text-xs text-muted-foreground">{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground p-4 text-xs">
            {filteredExpenses.length > 0 
              ? "لا توجد نصائح حاليًا لهذه الفترة. قد يساعد تحديد ميزانية في الإعدادات."
              : "لا توجد مصاريف في هذه الفترة لتقديم نصائح حولها."
            }
          </p>
        )}
      </CardContent>
    </Card>
  );
}
