// src/components/dashboard/budget-summary-card.tsx
"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from '@/components/ui/progress';
import { useAppData } from '@/hooks/use-app-data';
import { startOfMonth, endOfMonth, isWithinInterval, getDaysInMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Button } from '../ui/button';
import { Eye, EyeOff } from 'lucide-react';

const DEFAULT_BUDGET_SETTINGS = { totalBudget: 0, weeklyBudget: 0, zeroSpendDaysTarget: 4 };

// Reusable component for displaying a single statistic item
const StatItem = ({ title, value, color }: { title: string, value: string, color?: string }) => (
    <div className="flex flex-col items-center gap-1 text-center">
        <span className="text-xs sm:text-sm text-muted-foreground">{title}</span>
        <span className={cn("text-lg sm:text-xl font-bold", color)}>
            {value}
        </span>
    </div>
);


export default function BudgetSummaryCard() {
    const { expenses, userSettings } = useAppData();
    const [isPrivacyMode, setIsPrivacyMode] = useState(false);

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
            .filter(exp => new Date(exp.date).getDate() === today.getDate())
            .reduce((sum, exp) => sum + exp.amount, 0);
        
        const remaining = totalBudget - totalSpent;
        const spentPercentage = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;
        
        const daysInMonth = getDaysInMonth(start);
        const weeklyTarget = budget.weeklyBudget || (totalBudget > 0 ? Math.round(totalBudget / (daysInMonth / 7)) : 0);

        const weeklySummaries = Array.from({ length: 4 }).map((_, index) => {
            const weekStart = new Date(start.getFullYear(), start.getMonth(), index * 7 + 1);
            const weekEnd = new Date(start.getFullYear(), start.getMonth(), (index + 1) * 7);
            
            const weekExpenses = monthlyExpenses.filter(exp => {
                const expDate = new Date(exp.date);
                return isWithinInterval(expDate, { start: weekStart, end: weekEnd });
            });

            const spent = weekExpenses.reduce((sum, exp) => sum + exp.amount, 0);
            const progress = weeklyTarget > 0 ? (spent / weeklyTarget) * 100 : 0;
            const isOverBudget = progress > 100;

            return {
                week: index + 1,
                spent,
                progress: isOverBudget ? 100 : progress,
                isOverBudget,
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
    const privacyPlaceholder = "•••••• د.ع";

    return (
        <Card id="budget-summary-card" className="bg-card">
            <CardHeader className="flex-row items-center justify-between p-4 pb-0 sm:p-6 sm:pb-0">
                {/* The title can be empty or have some text if needed later */}
                <CardTitle></CardTitle> 
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => setIsPrivacyMode(!isPrivacyMode)}>
                    {isPrivacyMode ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </Button>
            </CardHeader>
            <CardContent className="space-y-4 p-4 sm:p-6">
                
                {/* Section 1: Main Progress Bar */}
                <div className="pt-2 space-y-2">
                    <div className="flex justify-between text-xs sm:text-sm text-muted-foreground px-1">
                        <span>المصروف: {isPrivacyMode ? privacyPlaceholder : formatCurrency(budgetData.monthlySpent)}</span>
                        <span>المتبقي: {isPrivacyMode ? privacyPlaceholder : formatCurrency(Math.max(0, budgetData.remainingBudget))}</span>
                    </div>
                     <Progress 
                        value={isPrivacyMode ? 100 : budgetData.spentPercentage} 
                        className="h-4 sm:h-5" 
                        indicatorcolor={isPrivacyMode ? 'hsl(var(--muted))' : undefined}
                    />
                </div>

                {/* Section 2: Main Stats with '+' separator */}
                 <div className="relative grid grid-cols-2 grid-rows-2 gap-y-4 py-4">
                    {/* Vertical Separator */}
                    <div className="absolute top-0 bottom-0 left-1/2 w-px bg-border -translate-x-1/2"></div>
                    {/* Horizontal Separator */}
                    <div className="absolute left-4 right-4 top-1/2 h-px bg-border -translate-y-1/2"></div>

                    {/* Top-Right: إجمالي الميزانية */}
                    <div className="flex justify-center items-center">
                         <StatItem 
                            title="إجمالي الميزانية" 
                            value={isPrivacyMode ? privacyPlaceholder : formatCurrency(budgetData.totalBudget)}
                            color="text-foreground"
                        />
                    </div>
                     {/* Top-Left: الميزانية المتبقية */}
                    <div className="flex justify-center items-center">
                        <StatItem 
                            title="الميزانية المتبقية" 
                            value={isPrivacyMode ? privacyPlaceholder : formatCurrency(Math.max(0, budgetData.remainingBudget))} 
                            color="text-green-600 dark:text-green-400"
                        />
                    </div>
                    {/* Bottom-Right: المصروف الشهري */}
                    <div className="flex justify-center items-center">
                         <StatItem 
                            title="المصروف الشهري"
                            value={isPrivacyMode ? privacyPlaceholder : formatCurrency(budgetData.monthlySpent)}
                            color="text-orange-600 dark:text-orange-400"
                        />
                    </div>
                    {/* Bottom-Left: مصروف اليوم */}
                    <div className="flex justify-center items-center">
                        <StatItem 
                            title="مصروف اليوم"
                            value={isPrivacyMode ? privacyPlaceholder : formatCurrency(budgetData.dailySpent)}
                            color="text-orange-600 dark:text-orange-400"
                        />
                    </div>
                </div>
                
                <Separator />
                
                {/* Section 3: Weekly Summary */}
                <div className="space-y-4">
                    <p className="text-center text-sm font-medium text-muted-foreground">
                        الهدف الأسبوعي: ~{isPrivacyMode ? privacyPlaceholder : formatCurrency(budgetData.weeklyTarget)}
                    </p>
                    <div className="grid grid-cols-4 gap-x-3 sm:gap-x-4 gap-y-2">
                        {budgetData.weeklySummaries.map(week => (
                            <div key={week.week} className="w-full space-y-2 text-center">
                                 <div className="flex flex-col items-center">
                                    <span className="text-xs text-muted-foreground">الأسبوع {week.week}</span>
                                    <span className="text-sm font-semibold">{isPrivacyMode ? privacyPlaceholder : formatCurrency(week.spent)}</span>
                                </div>
                                <Progress 
                                    value={isPrivacyMode ? 100 : week.progress} 
                                    className="h-3 sm:h-4" 
                                    indicatorcolor={isPrivacyMode ? 'hsl(var(--muted))' : week.isOverBudget ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
