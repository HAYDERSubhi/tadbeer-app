
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, DollarSign, FilePenLine, Mic, ScanLine, CreditCardIcon, SettingsIcon, Trash2Icon, Loader2Icon, ChevronLeft } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import VoiceExpenseForm from '@/components/expenses/voice-expense-form';
import ReceiptScanForm from '@/components/expenses/receipt-scan-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { startOfWeek, endOfWeek, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';
import { CATEGORIES as defaultCategories } from '@/lib/constants';

// Grouping the dialogs for easier mapping
const AddExpenseDialogs = [
  {
    label: "إدخال يدوي",
    description: "أضف مصروفاً جديداً بنفسك",
    IconComponent: FilePenLine,
    formComponent: <ManualExpenseForm />,
    iconBg: "bg-blue-100 dark:bg-blue-900/50",
    iconColor: "text-blue-600 dark:text-blue-300"
  },
  {
    label: "إدخال صوتي",
    description: "سجل مصروفك بصوتك",
    IconComponent: Mic,
    formComponent: <VoiceExpenseForm />,
    iconBg: "bg-rose-100 dark:bg-rose-900/50",
    iconColor: "text-rose-600 dark:text-rose-300"
  },
  {
    label: "مسح الفاتورة",
    description: "التقط صورة لفاتورتك",
    IconComponent: ScanLine,
    formComponent: <ReceiptScanForm />,
    iconBg: "bg-teal-100 dark:bg-teal-900/50",
    iconColor: "text-teal-600 dark:text-teal-300"
  },
  {
    label: "بطاقة إلكترونية",
    description: "مزامنة تلقائية (قريباً)",
    IconComponent: CreditCardIcon,
    formComponent: <div className="p-6 text-center"><p>سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p><Image src="https://placehold.co/200x150.png" alt="Coming soon" width={200} height={150} className="mx-auto mt-4 rounded-md" data-ai-hint="credit card technology" /></div>,
    iconBg: "bg-amber-100 dark:bg-amber-900/50",
    iconColor: "text-amber-600 dark:text-amber-300"
  },
];

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
}

// Main Dashboard Component
export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [userBudget, setUserBudget] = useState<UserBudgetSettings>({ totalBudget: 0, weeklyBudget: 0 });

  useEffect(() => {
    setIsMounted(true);
    
    const refreshData = () => {
      // Refresh Budget
      const storedBudget = localStorage.getItem('userBudgetSettings');
      if (storedBudget) {
        try {
          setUserBudget(JSON.parse(storedBudget));
        } catch {
          setUserBudget({ totalBudget: 0, weeklyBudget: 0 });
        }
      } else {
         setUserBudget({ totalBudget: 0, weeklyBudget: 0 });
      }

      // Refresh Expenses
      const storedExpenses = localStorage.getItem('expenses');
      if (storedExpenses) {
        try {
          const parsedExpenses = JSON.parse(storedExpenses);
           if (Array.isArray(parsedExpenses)) {
            setExpenses(parsedExpenses);
          } else {
             setExpenses([]);
          }
        } catch (error) {
          console.error("Failed to parse expenses from localStorage", error);
          setExpenses([]);
          localStorage.setItem('expenses', '[]');
        }
      } else {
        setExpenses([]);
      }
    };
    
    refreshData();
    setIsLoading(false);

    window.addEventListener('expensesUpdated', refreshData);
    window.addEventListener('budgetUpdated', refreshData);
    
    return () => {
      window.removeEventListener('expensesUpdated', refreshData);
      window.removeEventListener('budgetUpdated', refreshData);
    };
  }, []);

  const handleDeleteExpense = (expenseId: string) => {
    if (!isMounted) return;
    const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
    setExpenses(updatedExpenses);
    localStorage.setItem('expenses', JSON.stringify(updatedExpenses));
    toast({
      title: "تم الحذف",
      description: "تم حذف المصروف بنجاح.",
    });
  };
  
  const today = new Date();
  const startOfCurrentMonth = startOfMonth(today);
  const endOfCurrentMonth = endOfMonth(today);
  
  const monthlyExpenses = expenses.filter(exp => {
    try {
        const expenseDate = new Date(exp.date);
        return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
    } catch {
        return false;
    }
  });

  const currentExpenses = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = userBudget.totalBudget - currentExpenses;

  if (!isMounted || isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const sortedExpenses = [...monthlyExpenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const recentExpensesToDisplay = sortedExpenses.slice(0, 5);
  const allExpensesCount = sortedExpenses.length;

  return (
    <div className="space-y-8 pb-24 sm:pb-8">
      
      {/* Hero Balance Card */}
      <Card className="text-center shadow-lg border-primary/20 bg-card">
        <CardHeader>
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-foreground">ملخص الشهر</h2>
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <SettingsIcon className="ml-2 h-4 w-4" />
                إدارة الميزانية
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center gap-2">
          <p className="text-muted-foreground">المتبقي من الميزانية</p>
          <p className={`text-5xl font-bold ${remainingBudget >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>
            {remainingBudget.toLocaleString()}<span className="text-2xl font-normal"> د.ع</span>
          </p>
          {currentExpenses > userBudget.totalBudget && userBudget.totalBudget > 0 && (
            <div className="flex items-center text-destructive text-sm mt-2">
              <AlertCircleIcon className="h-4 w-4 ml-1" />
              <span>لقد تجاوزت الميزانية!</span>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex flex-col gap-4 pt-4 border-t">
           <Progress value={userBudget.totalBudget > 0 ? (currentExpenses / userBudget.totalBudget) * 100 : 0} className="h-2" />
           <div className="w-full grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div className="text-right">
                <p className="text-muted-foreground">المصروف</p>
                <p className="font-semibold text-destructive">{currentExpenses.toLocaleString()} د.ع</p>
              </div>
              <div className="text-left">
                <p className="text-muted-foreground">الميزانية</p>
                <p className="font-semibold">{userBudget.totalBudget.toLocaleString()} د.ع</p>
              </div>
           </div>
        </CardFooter>
      </Card>
      
      {userBudget.totalBudget === 0 && !isLoading && (
        <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
            <p>لم تقم بتعيين ميزانية شهرية بعد.</p>
            <p className="text-sm">اذهب إلى <Link href="/settings" className="text-primary underline font-semibold">الإعدادات</Link> لتعيين ميزانيتك.</p>
        </div>
      )}

      {/* Add Expense Horizontal Scroll */}
      <div>
        <h2 className="text-xl font-bold tracking-tight mb-4">إضافة مصروف جديد</h2>
        <div className="relative">
          <div className="flex w-full space-x-4 space-x-reverse overflow-x-auto pb-4 -mx-4 px-4 scrollbar-hide">
            {AddExpenseDialogs.map(({ label, description, IconComponent, formComponent, iconBg, iconColor }) => (
              <Dialog key={label}>
                <DialogTrigger asChild>
                  <div className="flex-shrink-0 w-48 cursor-pointer">
                    <Card className="h-full hover:border-primary hover:shadow-md transition-all">
                      <CardContent className="p-4 flex flex-col items-center justify-center text-center gap-3">
                        <span className={cn("p-3 rounded-full", iconBg)}>
                           <IconComponent className={cn("h-7 w-7", iconColor)} />
                        </span>
                        <div className="flex-1">
                          <p className="font-semibold">{label}</p>
                          <p className="text-xs text-muted-foreground">{description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle as="h2">{label}</DialogTitle>
                  </DialogHeader>
                  {formComponent}
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Expenses List */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>أحدث المصاريف</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recentExpensesToDisplay.length === 0 ? (
            <div className="px-6 py-10 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4" />
              <h3 className="text-lg font-semibold">لا توجد مصاريف بعد</h3>
              <p className="text-sm">ابدأ بإضافة أول مصروف لك من الأعلى!</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {recentExpensesToDisplay.map((expense) => {
                const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
                return (
                  <li key={expense.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                    <div className="flex flex-1 items-center gap-4">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-muted/25 text-xl">
                          {categoryInfo.icon}
                      </span>
                      <div>
                          <p className="font-semibold">{expense.title}</p>
                          <p className="text-sm text-muted-foreground">
                              {categoryInfo.name}
                          </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-foreground whitespace-nowrap">
                              {expense.amount.toLocaleString()}&nbsp;د.ع
                          </p>
                          <p className="text-sm text-muted-foreground">
                              {new Date(expense.date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long' })}
                          </p>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                            onClick={() => handleDeleteExpense(expense.id)}
                            aria-label="حذف المصروف"
                        >
                            <Trash2Icon className="h-4 w-4" />
                        </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
         {allExpensesCount > 5 && (
           <CardFooter className="border-t p-4">
            <Button variant="outline" className="w-full" onClick={() => toast({ title: "قيد التطوير", description: "صفحة عرض كل المصاريف ستتوفر قريباً." })}>
              عرض كل المصاريف ({allExpensesCount})
              <ChevronLeft className="mr-2 h-4 w-4"/>
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
