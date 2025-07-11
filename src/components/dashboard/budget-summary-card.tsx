// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

export default function BudgetSummaryCard() {
    const { expenses, userSettings } = useAppData();

    const {
        totalSpent,
        remainingBudget,
        budgetPercentage,
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
        
        const spent = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const budgetTotal = budget.totalBudget;
        const remaining = budgetTotal - spent;
        const percentage = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0;

        return {
            totalSpent: spent,
            remainingBudget: remaining,
            budgetPercentage: percentage,
        };
    }, [expenses, userSettings]);

    return (
        <Card id="budget-summary-card">
            <CardHeader>
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
                <CardDescription>هنا يمكنك رؤية المبلغ المتبقي من ميزانيتك لهذا الشهر.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex justify-between items-baseline">
                    <span className="text-2xl font-bold">{remainingBudget.toLocaleString()}<span className="text-sm font-normal text-muted-foreground"> د.ع متبقي</span></span>
                    <span className="text-sm text-muted-foreground">{userSettings?.budget?.totalBudget?.toLocaleString()} د.ع</span>
                </div>
                <Progress value={budgetPercentage} className="h-3" />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{totalSpent.toLocaleString()} د.ع منصرف</span>
                    <span>{budgetPercentage}%</span>
                </div>
            </CardContent>
        </Card>
    );
}

    
