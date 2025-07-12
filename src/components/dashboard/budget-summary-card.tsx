
// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, startOfWeek, endOfWeek, eachWeekOfInterval, addDays } from 'date-fns';

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
        
        // Weekly progress calculation
        const weeks = eachWeekOfInterval({ start, end }, { weekStartsOn: 6 }); // Week starts on Saturday for MENA
        const weeklyProgress = weeks.map((weekStart, index) => {
            const weekEnd = endOfWeek(weekStart, { weekStartsOn: 6 });
            const weeklyExpenses = monthlyExpenses.filter(exp => isWithinInterval(new Date(exp.date), { start: weekStart, end: weekEnd }));
            const weeklyTotal = weeklyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const weeklyBudget = totalBudget / 4; // Simplified weekly budget
            return {
                name: `الأسبوع ${index + 1}`,
                spent: weeklyTotal,
                progress: weeklyBudget > 0 ? (weeklyTotal / weeklyBudget) * 100 : 0
            }
        });

        return {
            totalBudget,
            monthlySpent: totalSpent,
            dailySpent,
            remainingBudget: remaining,
            weeklyProgress,
        };
    }, [expenses, userSettings]);
    
    // Check if isToday is imported
    const isToday = (date: Date) => {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    };

    return (
        <Card id="budget-summary-card" className="bg-gradient-to-br from-yellow-50/50 to-orange-50/50 dark:from-yellow-900/10 dark:to-orange-900/10">
            <CardHeader className="pb-4">
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">إجمالي الميزانية</p>
                        <p className="font-bold text-lg">{budgetData.totalBudget.toLocaleString()} د.ع</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">المصروف الشهري</p>
                        <p className="font-bold text-lg text-destructive">{budgetData.monthlySpent.toLocaleString()} د.ع</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">مصروف اليوم</p>
                        <p className="font-bold text-lg">{budgetData.dailySpent.toLocaleString()} د.ع</p>
                    </div>
                    <div className="p-3 bg-background/50 rounded-lg">
                        <p className="text-sm text-muted-foreground">المتبقي</p>
                        <p className="font-bold text-lg text-green-600 dark:text-green-400">{budgetData.remainingBudget.toLocaleString()} د.ع</p>
                    </div>
                </div>

                <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-center text-sm text-muted-foreground">التقدم الأسبوعي</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                        {budgetData.weeklyProgress.map((week, index) => (
                            <div key={index} className="space-y-1">
                                <div className="flex justify-between items-baseline">
                                    <span className="text-xs font-medium">{week.name}</span>
                                    <span className="text-xs text-muted-foreground">{week.spent.toLocaleString()} د.ع</span>
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

// Helper to check if a date is today
function isToday(date: Date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}
