
// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, addDays, getDaysInMonth, isToday, startOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

// Reusable component for displaying a main statistic in the top section
const MainStatItem = ({ label, value, color, secondaryLabel, secondaryValue, secondaryColor }: { label: string, value: number, color?: string, secondaryLabel: string, secondaryValue: number, secondaryColor?: string }) => (
    <div className="flex flex-col items-center gap-2">
        <div className="text-center">
            <span className="text-base text-muted-foreground">{label}</span>
            <span className={cn("block text-3xl font-bold", color)}>
                {value.toLocaleString()}&nbsp;د.ع
            </span>
        </div>
        <div className="text-center mt-1">
             <span className="text-xs text-muted-foreground">{secondaryLabel}</span>
             <span className={cn("block text-lg font-semibold", secondaryColor)}>
                {secondaryValue.toLocaleString()}&nbsp;د.ع
            </span>
        </div>
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
            .filter(exp => isToday(new Date(exp.date)))
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        const daysInMonth = getDaysInMonth(start);
        const weeklyTarget = budget.weeklyBudget || (totalBudget > 0 ? Math.round(totalBudget / (daysInMonth / 7)) : 0);

        const weeklySummaries = Array.from({ length: 4 }).map((_, index) => {
            // Ensure weeks start on a consistent day, e.g., Sunday. Adjust locale if needed.
            const monthStartDay = start.getDay(); // 0 for Sunday
            const firstWeekStartDate = addDays(start, -monthStartDay);
            const weekStart = addDays(firstWeekStartDate, index * 7);
            const weekEnd = addDays(weekStart, 6);
            
            const weekExpenses = monthlyExpenses.filter(exp => {
                const expDate = new Date(exp.date);
                // Only include expenses that fall within the current month, even if the week boundaries extend slightly outside
                return isWithinInterval(expDate, { start: weekStart, end: weekEnd }) && isWithinInterval(expDate, {start, end});
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

    return (
        <Card id="budget-summary-card" className="bg-card">
            <CardContent className="space-y-4 p-4">
                
                {/* Main Stats Grid */}
                <div className="grid grid-cols-2 gap-4 text-center py-4">
                    <MainStatItem 
                        label="إجمالي الميزانية" 
                        value={budgetData.totalBudget} 
                        color="text-foreground"
                        secondaryLabel="المصروف الشهري"
                        secondaryValue={budgetData.monthlySpent}
                        secondaryColor="text-red-500 dark:text-red-400"
                    />
                     <MainStatItem 
                        label="الميزانية المتبقية" 
                        value={Math.max(0, budgetData.remainingBudget)} 
                        color="text-green-600 dark:text-green-400"
                        secondaryLabel="مصروف اليوم"
                        secondaryValue={budgetData.dailySpent}
                        secondaryColor="text-red-500 dark:text-red-400"
                    />
                </div>
                
                {/* Main Progress Bar */}
                <div className="pt-2 space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground px-1">
                        <span>المصروف: {budgetData.monthlySpent.toLocaleString()} د.ع</span>
                        <span>المتبقي: {Math.max(0, budgetData.remainingBudget).toLocaleString()} د.ع</span>
                    </div>
                    <Progress value={budgetData.spentPercentage} className="h-2.5" />
                </div>
                
                <Separator className="my-4" />
                
                {/* Weekly Summary */}
                <div className="space-y-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: ~{budgetData.weeklyTarget.toLocaleString(undefined, { maximumFractionDigits: 0 })} د.ع
                    </p>
                    <div className="grid grid-cols-4 gap-x-4 gap-y-2">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="w-full space-y-2 text-center">
                                <div className="flex justify-between items-baseline px-1">
                                    <span className="text-xs text-muted-foreground">الأسبوع {week.week}</span>
                                    <span className="text-sm font-semibold">{week.spent.toLocaleString()}&nbsp;د.ع</span>
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
