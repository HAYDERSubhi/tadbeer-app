"use client";

import { useMemo } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Vault } from "lucide-react";
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';
import { startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';

export function IncomeVsExpensesCard() {
  const { expenses, incomes, isLoading } = useAppData();
  const { format: formatCurrency } = useCurrency();

  const { totalIncome, totalExpenses, savings, savingsRate, hasData } = useMemo(() => {
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const monthlyExpenses = expenses.filter(e => {
      try { return isWithinInterval(parseISO(e.date), { start, end }); }
      catch { return false; }
    });

    const monthlyIncomes = incomes.filter(i => {
      if (i.type === 'recurring') return true;
      try { return isWithinInterval(parseISO(i.date), { start, end }); }
      catch { return false; }
    });

    const totalIncome = monthlyIncomes.reduce((s, i) => s + i.amount, 0);
    const totalExpenses = monthlyExpenses.reduce((s, e) => s + e.amount, 0);
    const savings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (savings / totalIncome) * 100 : 0;
    const hasData = totalIncome > 0 || totalExpenses > 0;

    return { totalIncome, totalExpenses, savings, savingsRate, hasData };
  }, [expenses, incomes]);

  if (isLoading || !hasData) return null;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="grid grid-cols-3 divide-x divide-x-reverse divide-border">

          <div className="flex flex-col items-center justify-center p-3 gap-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500/10">
              <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-[10px] text-muted-foreground">الدخل</p>
            <p className="text-xs font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalIncome)}
            </p>
          </div>

          <div className="flex flex-col items-center justify-center p-3 gap-1">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-destructive/10">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <p className="text-[10px] text-muted-foreground">المصاريف</p>
            <p className="text-xs font-bold text-destructive">
              {formatCurrency(totalExpenses)}
            </p>
          </div>

          <div className={cn(
            "flex flex-col items-center justify-center p-3 gap-1",
            savings >= 0 ? "bg-primary/5" : "bg-destructive/5"
          )}>
            <div className={cn(
              "flex items-center justify-center w-8 h-8 rounded-full",
              savings >= 0 ? "bg-primary/10" : "bg-destructive/10"
            )}>
              <Vault className={cn("h-4 w-4", savings >= 0 ? "text-primary" : "text-destructive")} />
            </div>
            <p className="text-[10px] text-muted-foreground">التوفير</p>
            <p className={cn("text-xs font-bold", savings >= 0 ? "text-primary" : "text-destructive")}>
              {savings >= 0 ? '+' : ''}{formatCurrency(savings)}
            </p>
            {totalIncome > 0 && (
              <p className="text-[9px] text-muted-foreground">
                {savingsRate.toFixed(0)}% من الدخل
              </p>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
