// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
        
        return {
            totalBudget,
            monthlySpent: totalSpent,
            dailySpent,
            remainingBudget: remaining,
        };
    }, [expenses, userSettings]);

    return (
        <Card id="budget-summary-card">
            <CardHeader>
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <Progress value={(budgetData.monthlySpent / (budgetData.totalBudget || 1)) * 100} className="h-4" />
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm text-muted-foreground">صرفت</p>
                            <p className="text-xl font-bold text-destructive">{budgetData.monthlySpent.toLocaleString()} د.ع</p>
                        </div>
                        <div className="text-left">
                            <p className="text-sm text-muted-foreground">بقي</p>
                            <p className="text-xl font-bold text-green-600">{budgetData.remainingBudget.toLocaleString()} د.ع</p>
                        </div>
                    </div>
                    <div className="text-center text-sm text-muted-foreground pt-2 border-t">
                        إجمالي الميزانية: {budgetData.totalBudget.toLocaleString()} د.ع
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
