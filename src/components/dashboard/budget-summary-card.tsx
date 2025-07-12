// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, eachWeekOfInterval, addDays } from 'date-fns';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

// Helper to check if a date is today
function isToday(date: Date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

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
        const totalBudget = budget.totalBudget || 0;
        const dailySpent = monthlyExpenses
            .filter(exp => isToday(new Date(exp.date)))
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;

        const weeklyTarget = budget.weeklyBudget || (totalBudget / 4.33);

        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 6 }); // Week starts on Saturday for Iraq

        const weeklySummaries = weeks.map((weekStart, index) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 6 });
            const weekExpenses = monthlyExpenses.filter(exp => isWithinInterval(new Date(exp.date), { start: weekStart, end: weekEnd }));
            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            return {
                week: index + 1,
                spent,
                progress: weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0,
            };
        });
        
        return {
            totalBudget,
            monthlySpent: totalSpent,
            dailySpent,
            remainingBudget: remaining,
            weeklyTarget,
            weeklySummaries,
        };
    }, [expenses, userSettings]);

    return (
         <Card id="budget-summary-card" className="bg-yellow-50/50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/20">
            <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">إجمالي الميزانية</p>
                        <p className="font-bold text-lg">{budgetData.totalBudget.toLocaleString()}&nbsp;د.ع</p>
                    </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">المصروف الشهري</p>
                        <p className="font-bold text-lg text-red-600">{budgetData.monthlySpent.toLocaleString()}&nbsp;د.ع</p>
                    </div>
                     <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">مصروف اليوم</p>
                        <p className="font-bold text-lg">{budgetData.dailySpent.toLocaleString()}&nbsp;د.ع</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-xs text-muted-foreground">الميزانية المتبقية</p>
                        <p className="font-bold text-lg text-green-600">{budgetData.remainingBudget.toLocaleString()}&nbsp;د.ع</p>
                    </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: {budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="flex items-center gap-4">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="flex-1 space-y-2">
                                <Progress value={week.progress > 100 ? 100 : week.progress} className="h-3" indicatorcolor={week.progress > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">الأسبوع {week.week}</span>
                                    <span className="text-xs font-semibold">{week.spent.toLocaleString()}&nbsp;د.ع</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
