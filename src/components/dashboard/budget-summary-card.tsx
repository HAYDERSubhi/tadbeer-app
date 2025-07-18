// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, addDays, getDaysInMonth, isToday, startOfWeek, isSameDay } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

// Reusable component for displaying a main statistic in the top section
const MainStatItem = ({ title, value, color, subtitle, subvalue, subcolor }: { title: string, value: string, color?: string, subtitle: string, subvalue: string, subcolor?: string }) => (
    <div className="flex flex-col items-center gap-2 text-center">
        <span className="text-sm sm:text-base text-muted-foreground">{title}</span>
        <span className={cn("text-2xl sm:text-3xl font-bold", color)}>
            {value}
        </span>
        <span className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</span>
        <span className={cn("text-base sm:text-lg font-semibold", subcolor)}>
            {subvalue}
        </span>
    </div>
);


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
            .filter(exp => isSameDay(new Date(exp.date), today))
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        const daysInMonth = getDaysInMonth(start);
        const weeklyTarget = budget.weeklyBudget || (totalBudget > 0 ? Math.round(totalBudget / (daysInMonth / 7)) : 0);

        const weeklySummaries = Array.from({ length: 4 }).map((_, index) => {
            const weekStart = addDays(start, index * 7);
            const weekEnd = addDays(weekStart, 6);
            
            const weekExpenses = monthlyExpenses.filter(exp => {
                const expDate = new Date(exp.date);
                return isWithinInterval(expDate, { start: weekStart, end: weekEnd });
            });

            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const progress = weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0;

            return {
                week: index + 1,
                spent,
                progress: progress > 100 ? 100 : progress,
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

    const formatCurrency = (value: number) => `${value.toLocaleString('ar-EG')}\u00A0د.ع`;

    return (
        <Card id="budget-summary-card" className="bg-card">
            <CardContent className="space-y-4 p-4 sm:p-6">
                
                {/* Section 1: Main Stats */}
                <div className="grid grid-cols-2 gap-4 text-center py-4">
                     <MainStatItem 
                        title="إجمالي الميزانية" 
                        value={formatCurrency(budgetData.totalBudget)}
                        color="text-foreground"
                        subtitle="المصروف الشهري"
                        subvalue={formatCurrency(budgetData.monthlySpent)}
                        subcolor="text-red-500 dark:text-red-400"
                    />
                    <MainStatItem 
                        title="الميزانية المتبقية" 
                        value={formatCurrency(Math.max(0, budgetData.remainingBudget))} 
                        color="text-green-600 dark:text-green-400"
                        subtitle="مصروف اليوم"
                        subvalue={formatCurrency(budgetData.dailySpent)}
                        subcolor="text-red-500 dark:text-red-400"
                    />
                </div>
                
                <Separator />

                {/* Section 2: Main Progress Bar */}
                <div className="pt-2 space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground px-1">
                        <span>المصروف: {formatCurrency(budgetData.monthlySpent)}</span>
                        <span>المتبقي: {formatCurrency(Math.max(0, budgetData.remainingBudget))}</span>
                    </div>
                    <Progress value={budgetData.spentPercentage} className="h-2.5" />
                </div>
                
                <Separator className="my-4" />
                
                {/* Section 3: Weekly Summary */}
                <div className="space-y-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: ~{formatCurrency(budgetData.weeklyTarget)}
                    </p>
                    <div className="grid grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-2">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="w-full space-y-2 text-center">
                                 <div className="flex flex-col-reverse sm:flex-row justify-between items-center px-1">
                                    <span className="text-xs text-muted-foreground">الأسبوع {week.week}</span>
                                    <span className="text-sm font-semibold">{formatCurrency(week.spent)}</span>
                                </div>
                                <Progress value={week.progress} className="h-2" />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}