// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, addDays, getDaysInMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

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
        const totalBudget = budget.totalBudget || 0;
        const dailySpent = monthlyExpenses
            .filter(exp => new Date(exp.date).toDateString() === today.toDateString())
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        const weeklyTarget = budget.weeklyBudget || (totalBudget > 0 ? totalBudget / 4 : 0);
        
        // Simplified and stable 4-week calculation
        const daysInMonth = getDaysInMonth(start);
        const weekLength = Math.ceil(daysInMonth / 4);
        const weeklySummaries = Array.from({ length: 4 }).map((_, index) => {
            const weekStart = addDays(start, index * weekLength);
            const weekEnd = addDays(weekStart, weekLength - 1);
            const weekExpenses = monthlyExpenses.filter(exp => 
                isWithinInterval(new Date(exp.date), { start: weekStart, end: weekEnd })
            );
            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);

            let progressColor = "bg-primary";
            if(weeklyTarget > 0) {
                 const percentage = (spent / weeklyTarget) * 100;
                 if (percentage > 90) progressColor = "bg-red-500";
                 else if (percentage > 60) progressColor = "bg-yellow-400";
            }

            return {
                week: index + 1,
                spent,
                progress: weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0,
                progressColor
            };
        });
        
        return {
            totalBudget,
            monthlySpent: totalSpent,
            dailySpent,
            remainingBudget: remaining < 0 ? 0 : remaining,
            spentPercentage,
            weeklyTarget,
            weeklySummaries,
        };
    }, [expenses, userSettings]);

    const StatItem = ({ label, value, color }: { label: string, value: number, color?: string }) => (
        <div className="flex flex-col items-center gap-1 flex-1">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className={cn("text-xl font-bold", color)}>
                {value.toLocaleString()}&nbsp;د.ع
            </span>
        </div>
    );

    return (
        <Card id="budget-summary-card" className="bg-gradient-to-br from-yellow-50/50 via-orange-50/50 to-transparent dark:from-yellow-900/10 dark:via-orange-900/10">
            <CardContent className="space-y-4 p-4">
                <div className="flex justify-around items-center">
                    <StatItem label="إجمالي الميزانية" value={budgetData.totalBudget} color="text-foreground" />
                    <Separator orientation="vertical" className="h-10" />
                    <StatItem label="المصروف الشهري" value={budgetData.monthlySpent} color="text-red-500" />
                    <Separator orientation="vertical" className="h-10" />
                    <StatItem label="مصروف اليوم" value={budgetData.dailySpent} color="text-red-500" />
                    <Separator orientation="vertical" className="h-10" />
                    <StatItem label="الميزانية المتبقية" value={budgetData.remainingBudget} color="text-green-600" />
                </div>
                
                <div className="pt-2 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>المنصرف: {budgetData.monthlySpent.toLocaleString()} د.ع</span>
                        <span>المتبقي: {budgetData.remainingBudget.toLocaleString()} د.ع</span>
                    </div>
                    <Progress value={budgetData.spentPercentage} className="h-2" />
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: {budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="flex flex-col sm:flex-row items-center gap-4">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="flex-1 w-full space-y-2">
                                <Progress value={week.progress > 100 ? 100 : week.progress} className="h-2" indicatorcolor={cn(week.progressColor)} />
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