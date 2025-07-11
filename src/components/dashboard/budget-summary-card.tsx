// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, format, getDaysInMonth, addDays } from 'date-fns';

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
        
        const todaysExpenses = monthlyExpenses.filter(exp => format(new Date(exp.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'));
        
        const totalSpent = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const todaySpent = todaysExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const budgetTotal = budget.totalBudget;
        const remaining = budgetTotal - totalSpent;

        // Consistent 4-week budget cycle
        const weeklyBudget = budgetTotal > 0 ? budgetTotal / 4 : 0;
        
        const daysInMonth = getDaysInMonth(today);
        // Divide the month into 4 periods. Can be fractional days.
        const periodLength = daysInMonth / 4; 
        
        const weeklyExpenses = Array.from({ length: 4 }).map((_, index) => {
            const periodStart = addDays(start, index * periodLength);
            const periodEnd = addDays(start, (index + 1) * periodLength - 1);
            
            const expensesInPeriod = monthlyExpenses.filter(exp => {
                const expDate = new Date(exp.date);
                return isWithinInterval(expDate, { start: periodStart, end: periodEnd });
            });

            const spentInPeriod = expensesInPeriod.reduce((sum, exp) => sum + exp.amount, 0);
            return {
                name: `الأسبوع ${index + 1}`,
                spent: spentInPeriod,
                progress: weeklyBudget > 0 ? (spentInPeriod / weeklyBudget) * 100 : 0,
            };
        });

        return {
            totalBudget: budgetTotal,
            monthlySpent: totalSpent,
            todaySpent,
            remainingBudget: remaining,
            weeklyTarget: weeklyBudget,
            weeks: weeklyExpenses,
        };
    }, [expenses, userSettings]);

    return (
        <Card id="budget-summary-card" className="bg-gradient-to-tr from-yellow-50/50 to-amber-100/30 dark:from-yellow-900/10 dark:to-amber-900/20 shadow-lg">
            <CardContent className="p-4 sm:p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">إجمالي الميزانية</p>
                        <p className="text-base sm:text-lg font-bold text-gray-800 dark:text-gray-200">{budgetData.totalBudget.toLocaleString()} د.ع</p>
                    </div>
                     <div className="p-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">المصروف الشهري</p>
                        <p className="text-base sm:text-lg font-bold text-red-500">{budgetData.monthlySpent.toLocaleString()} د.ع</p>
                    </div>
                    <div className="p-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">مصروف اليوم</p>
                        <p className="text-base sm:text-lg font-bold text-red-500">{budgetData.todaySpent.toLocaleString()} د.ع</p>
                    </div>
                    <div className="p-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">الميزانية المتبقية</p>
                        <p className="text-base sm:text-lg font-bold text-green-600 dark:text-green-400">{budgetData.remainingBudget.toLocaleString()} د.ع</p>
                    </div>
                </div>

                <div className="border-t border-black/10 dark:border-white/10 pt-4 space-y-3">
                    <p className="text-center text-sm text-muted-foreground font-semibold">
                        الهدف الأسبوعي: {budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                        {budgetData.weeks.map(week => (
                            <div key={week.name} className="space-y-1">
                                <div className="flex justify-between items-baseline text-xs">
                                    <span className="font-semibold">{week.name}</span>
                                    <span>{week.spent.toLocaleString()} د.ع</span>
                                </div>
                                <Progress value={week.progress} className="h-2" indicatorcolor={week.progress > 100 ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'} />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
