
// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth, addDays, isSameDay } from 'date-fns';

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

        const weeklyTarget = budget.weeklyBudget || (totalBudget / 4);

        // --- 4-Week Logic ---
        const daysInMonth = getDaysInMonth(today);
        const weekLength = daysInMonth / 4; 
        const weeklySummaries = [];

        for (let i = 0; i < 4; i++) {
            const weekStart = addDays(start, i * weekLength);
            const weekEnd = (i === 3) ? end : addDays(weekStart, weekLength - 1);

            const weekExpenses = monthlyExpenses.filter(exp => 
                isWithinInterval(new Date(exp.date), { start: weekStart, end: weekEnd })
            );
            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            weeklySummaries.push({
                week: i + 1,
                spent,
                progress: weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0,
            });
        }
        
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
         <Card id="budget-summary-card">
            <CardHeader>
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex justify-between text-lg font-bold">
                        <span className="text-green-600">{budgetData.remainingBudget.toLocaleString()}&nbsp;د.ع متبقي</span>
                        <span className="text-red-600">{budgetData.monthlySpent.toLocaleString()}&nbsp;د.ع</span>
                    </div>
                    <Progress value={(budgetData.monthlySpent / budgetData.totalBudget) * 100} className="h-4" indicatorcolor={budgetData.monthlySpent > budgetData.totalBudget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>من أصل {budgetData.totalBudget.toLocaleString()} د.ع</span>
                        <span>مصروف اليوم: {budgetData.dailySpent.toLocaleString()} د.ع</span>
                    </div>
                </div>

                <div className="border-t border-border/50 pt-4 space-y-3">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: {budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="flex items-center gap-4">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="flex-1 space-y-2">
                                <Progress value={week.progress > 100 ? 100 : week.progress} className="h-2" indicatorcolor={week.progress > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
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

