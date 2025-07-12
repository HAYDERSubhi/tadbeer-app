// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

export default function BudgetSummaryCard() {
    const { expenses, userSettings } = useAppData();

    const budgetData = useMemo(() => {
        const today = new Date();
        const start = startOfMonth(today);
        const end = endOfMonth(today);
        const budget = userSettings?.budget || DEFAULT_BUDGET_SETTINGS;

        const monthlyExpenses = expenses.filter(exp => {
            try {
                return isWithinInterval(new Date(exp.date), { start, end });
            } catch {
                return false;
            }
        });
        
        const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const budgetTotal = budget.totalBudget;
        const remaining = budgetTotal - totalSpent;
        const progress = budgetTotal > 0 ? (totalSpent / budgetTotal) * 100 : 0;

        return {
            totalBudget: budgetTotal,
            monthlySpent: totalSpent,
            remainingBudget: remaining,
            progress: progress,
        };
    }, [expenses, userSettings]);

    return (
        <Card id="budget-summary-card">
            <CardHeader>
                <CardTitle className="text-xl">ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="space-y-2">
                    <Progress value={budgetData.progress} className="h-3" indicatorcolor={budgetData.progress > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                    <div className="flex justify-between items-baseline text-sm">
                        <div className="text-right">
                           <p className="text-muted-foreground">المصروف</p>
                           <p className="font-bold text-lg text-red-500">{budgetData.monthlySpent.toLocaleString()} د.ع</p>
                        </div>
                        <div className="text-left">
                            <p className="text-muted-foreground">المتبقي</p>
                            <p className="font-bold text-lg text-green-600 dark:text-green-400">{budgetData.remainingBudget.toLocaleString()} د.ع</p>
                        </div>
                    </div>
                </div>
                 <div className="text-center text-xs text-muted-foreground pt-2 border-t border-border/50">
                    من إجمالي ميزانية قدرها <span className="font-semibold text-foreground">{budgetData.totalBudget.toLocaleString()} د.ع</span>
                </div>
            </CardContent>
        </Card>
    );
}
