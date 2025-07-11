// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ArrowDown, ArrowUp } from 'lucide-react';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

export default function BudgetSummaryCard() {
    const { expenses, userSettings, incomes } = useAppData();

    const {
        totalSpent,
        totalIncome,
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

        const currentMonthIncomes = incomes.filter(inc => {
             try {
                const incomeDate = new Date(inc.date);
                return isWithinInterval(incomeDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
            } catch {
                return false;
            }
        });
        
        const spent = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
        const earned = currentMonthIncomes.reduce((sum, inc) => sum + inc.amount, 0);
        const budgetTotal = budget.totalBudget;
        const remaining = budgetTotal - spent;
        const percentage = budgetTotal > 0 ? Math.round((spent / budgetTotal) * 100) : 0;

        return {
            totalSpent: spent,
            totalIncome: earned,
            remainingBudget: remaining,
            budgetPercentage: percentage,
        };
    }, [expenses, incomes, userSettings]);

    const radius = 60;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (budgetPercentage / 100) * circumference;

    return (
        <Card id="budget-summary-card" className="shadow-lg">
            <CardHeader>
                <CardTitle>ملخص الميزانية الشهرية</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center justify-around gap-8">
                {/* Center Circular Progress */}
                <div className="relative w-48 h-48 flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                        <circle
                            className="text-muted"
                            strokeWidth="12"
                            stroke="currentColor"
                            fill="transparent"
                            r={radius}
                            cx="96"
                            cy="96"
                        />
                        <circle
                            className="text-primary"
                            strokeWidth="12"
                            strokeDasharray={circumference}
                            strokeDashoffset={strokeDashoffset}
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="transparent"
                            r={radius}
                            cx="96"
                            cy="96"
                            style={{ transition: 'stroke-dashoffset 0.5s ease-out' }}
                        />
                    </svg>
                    <div className="absolute flex flex-col items-center text-center">
                        <span className="text-xs text-muted-foreground">المتبقي</span>
                        <span className="text-2xl font-bold text-primary">
                            {remainingBudget.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground">د.ع</span>
                    </div>
                </div>

                {/* Side Stats */}
                <div className="grid grid-cols-2 gap-6 text-center w-full md:w-auto">
                    <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center gap-2">
                           <div className="p-2 bg-red-100 dark:bg-red-900/50 rounded-full">
                                <ArrowUp className="h-5 w-5 text-red-500" />
                           </div>
                           <p className="text-sm text-muted-foreground">المصروفات</p>
                        </div>
                        <p className="text-lg font-bold mt-2">
                            {totalSpent.toLocaleString()} د.ع
                        </p>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-center justify-center gap-2">
                            <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-full">
                                <ArrowDown className="h-5 w-5 text-green-500" />
                            </div>
                            <p className="text-sm text-muted-foreground">الدخل</p>
                        </div>
                        <p className="text-lg font-bold mt-2">
                            {totalIncome.toLocaleString()} د.ع
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

    