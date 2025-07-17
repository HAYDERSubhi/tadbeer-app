// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, addDays, getDaysInMonth, isToday } from 'date-fns';
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
            .filter(exp => isToday(new Date(exp.date)))
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        const daysInMonth = getDaysInMonth(start);
        const weekLength = Math.ceil(daysInMonth / 4);
        const weeklyTarget = budget.weeklyBudget || (totalBudget > 0 ? Math.round(totalBudget / (daysInMonth / 7)) : 0);

        const weeklySummaries = Array.from({ length: 4 }).map((_, index) => {
            const weekStart = addDays(start, index * weekLength);
            // Ensure the week end doesn't go past the end of the month
            const weekEndUncapped = addDays(weekStart, weekLength - 1);
            const weekEnd = weekEndUncapped > end ? end : weekEndUncapped;
            
            const weekExpenses = monthlyExpenses.filter(exp => 
                isWithinInterval(new Date(exp.date), { start: weekStart, end: weekEnd })
            );
            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            
            const progress = weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0;

            let progressColor = "bg-primary";
            if (progress > 90) progressColor = "bg-destructive";
            else if (progress > 60) progressColor = "bg-amber-500";

            return {
                week: index + 1,
                spent,
                progress: progress > 100 ? 100 : progress,
                progressColor
            };
        });
        
        return {
            totalBudget,
            monthlySpent: totalSpent,
            dailySpent,
            remainingBudget: remaining,
            spentPercentage,
            weeklyTarget,
            weeklySummaries,
        };
    }, [expenses, userSettings]);

    const StatItem = ({ label, value, color, size = 'md' }: { label: string, value: number, color?: string, size?: 'md' | 'lg' }) => (
        <div className="flex flex-col items-center gap-1">
            <span className={cn(
                "text-muted-foreground",
                size === 'md' ? 'text-xs' : 'text-sm'
            )}>
                {label}
            </span>
            <span className={cn(
                "font-bold",
                size === 'md' ? 'text-base' : 'text-xl',
                color
            )}>
                {value.toLocaleString()}&nbsp;د.ع
            </span>
        </div>
    );

    return (
        <Card id="budget-summary-card" className="bg-card">
            <CardContent className="space-y-4 p-4">
                
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-2 text-center">
                    <StatItem label="إجمالي الميزانية" value={budgetData.totalBudget} color="text-foreground" size="lg" />
                    <StatItem label="الميزانية المتبقية" value={Math.max(0, budgetData.remainingBudget)} color="text-green-600 dark:text-green-400" size="lg" />
                    <StatItem label="المصروف الشهري" value={budgetData.monthlySpent} color="text-red-500 dark:text-red-400" />
                    <StatItem label="مصروف اليوم" value={budgetData.dailySpent} color="text-red-500 dark:text-red-400" />
                </div>
                
                {/* Main Progress Bar */}
                <div className="pt-2 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>المصروف: {budgetData.monthlySpent.toLocaleString()} د.ع</span>
                        <span>المتبقي: {Math.max(0, budgetData.remainingBudget).toLocaleString()} د.ع</span>
                    </div>
                    <Progress value={budgetData.spentPercentage} className="h-3" />
                </div>
                
                <Separator />
                
                {/* Weekly Summary */}
                <div className="space-y-3">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: {budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="w-full space-y-2">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-muted-foreground">الأسبوع {week.week}</span>
                                    <span className="text-xs font-semibold">{week.spent.toLocaleString()}&nbsp;د.ع</span>
                                </div>
                                <Progress value={week.progress} className="h-2" indicatorcolor={cn(week.progressColor)} />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
