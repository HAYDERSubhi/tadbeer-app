
// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, startOfDay, endOfDay } from 'date-fns';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

export default function BudgetSummaryCard() {
    const { expenses, userSettings } = useAppData();

    const {
        currentExpenses,
        remainingBudget,
        weeklySpending,
        userBudget,
        dailySpend,
    } = useMemo(() => {
        const today = new Date();
        const startOfCurrentMonth = startOfMonth(today);
        const endOfCurrentMonth = endOfMonth(today);
        
        const budget = userSettings?.budget || DEFAULT_BUDGET_SETTINGS;

        const currentMonthExpenses = expenses.filter(exp => {
            try {
                const expenseDate = new Date(exp.date);
                return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
            } catch {
                return false;
            }
        });
        
        const startOfToday = startOfDay(today);
        const endOfToday = endOfDay(today);

        const spendToday = expenses
            .filter(exp => {
                try {
                    const expenseDate = new Date(exp.date);
                    return isWithinInterval(expenseDate, { start: startOfToday, end: endOfToday });
                } catch {
                    return false;
                }
            })
            .reduce((sum, exp) => sum + exp.amount, 0);

        const totalCurrentExpenses = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);

        const budgetRemaining = budget.totalBudget - totalCurrentExpenses;

        const weeklyIntervals = [
          { start: startOfCurrentMonth, end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 7, 23, 59, 59) },
          { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 8), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 14, 23, 59, 59) },
          { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 15), end: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 21, 23, 59, 59) },
          { start: new Date(startOfCurrentMonth.getFullYear(), startOfCurrentMonth.getMonth(), 22), end: endOfCurrentMonth }
        ];

        const spendingByWeek = weeklyIntervals.map(interval =>
            currentMonthExpenses
                .filter(exp => {
                    try {
                        return isWithinInterval(new Date(exp.date), interval);
                    } catch {
                        return false;
                    }
                })
                .reduce((sum, exp) => sum + exp.amount, 0)
        );

        return {
            currentExpenses: totalCurrentExpenses,
            remainingBudget: budgetRemaining,
            weeklySpending: spendingByWeek,
            userBudget: budget,
            dailySpend: spendToday,
        };
    }, [expenses, userSettings]);

    const weeklyTarget = userBudget.totalBudget > 0 ? userBudget.totalBudget / 4 : 0;
    
    return (
        <Card id="budget-summary-card" className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-background shadow-lg rounded-2xl">
            <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-6 text-center text-sm">
                    <div>
                        <p className="text-muted-foreground text-xs">إجمالي الميزانية</p>
                        <p className="font-semibold">{userBudget.totalBudget.toLocaleString()} د.ع</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">المصروف الشهري</p>
                        <p className="font-semibold text-destructive">{currentExpenses.toLocaleString()} د.ع</p>
                    </div>
                    <div>
                        <p className="text-muted-foreground text-xs">مصروف اليوم</p>
                        <p className="font-semibold text-amber-500">{dailySpend.toLocaleString()} د.ع</p>
                    </div>
                     <div>
                        <p className="text-muted-foreground text-xs">الميزانية المتبقية</p>
                        <p className="font-semibold text-primary">{remainingBudget.toLocaleString()} د.ع</p>
                    </div>
                </div>
                <div className="space-y-4 pt-4 border-t">
                    <div className="grid grid-cols-4 gap-4">
                        {weeklySpending.map((spend, i) => {
                            const percentage = weeklyTarget > 0 ? Math.min((spend / weeklyTarget) * 100, 100) : 0;
                            let progressColor = 'hsl(var(--chart-2))'; // Green
                            if (percentage > 85) {
                                progressColor = 'hsl(var(--destructive))'; // Red
                            } else if (percentage > 50) {
                                progressColor = 'hsl(var(--primary))'; // Yellow
                            }

                            return (
                                <div key={i} className="flex flex-col items-center text-center gap-2">
                                    <p className="text-xs text-muted-foreground">الأسبوع {i + 1}</p>
                                    <Progress value={percentage} className="h-2 w-full" indicatorcolor={progressColor} />
                                    <p className="text-xs font-bold">{spend.toLocaleString()} د.ع</p>
                                </div>
                            )
                        })}
                    </div>
                    <div className="text-center pt-2">
                        <p className="text-xs text-muted-foreground">الهدف الأسبوعي: <span className="font-semibold text-foreground">{weeklyTarget > 0 ? weeklyTarget.toLocaleString() : '---'} د.ع</span></p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
