
"use client";

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, DollarSign, FilePenLine, Mic, ScanLine, CreditCardIcon, FilterIcon, FilterXIcon, ListFilter, SortAscIcon, SortDescIcon, SettingsIcon, Trash2Icon, Loader2Icon } from "lucide-react";
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import ManualExpenseForm from '@/components/expenses/manual-expense-form';
import VoiceExpenseForm from '@/components/expenses/voice-expense-form';
import ReceiptScanForm from '@/components/expenses/receipt-scan-form';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { format, startOfWeek, endOfWeek, isWithinInterval } from 'date-fns';
import { CATEGORIES as defaultCategories } from '@/lib/constants';

const AddExpenseDialogs = [
  {
    label: "إدخال يدوي",
    IconComponent: FilePenLine,
    formComponent: <ManualExpenseForm />,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground"
  },
  {
    label: "إدخال صوتي",
    IconComponent: Mic,
    formComponent: <VoiceExpenseForm />,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground"
  },
  {
    label: "مسح الفاتورة",
    IconComponent: ScanLine,
    formComponent: <ReceiptScanForm />,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground"
  },
  {
    label: "بطاقة إلكترونية",
    IconComponent: CreditCardIcon,
    formComponent: <div className="p-6 text-center"><p>سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p><Image src="https://placehold.co/200x150.png" alt="Coming soon" width={200} height={150} className="mx-auto mt-4 rounded-md" data-ai-hint="credit card technology" /></div>,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground"
  },
];

interface UserBudgetSettings {
  totalBudget: number;
  weeklyBudget: number;
}

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<Record<string, { name: string; icon: string; color: string; id: string }>>(defaultCategories);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amountHighToLow' | 'amountLowToHigh'>('newest');
  const [userBudget, setUserBudget] = useState<UserBudgetSettings>({ totalBudget: 0, weeklyBudget: 0 });

  useEffect(() => {
    setIsMounted(true);
    
    const refreshData = () => {
      // Refresh Budget
      const storedBudget = localStorage.getItem('userBudgetSettings');
      if (storedBudget) {
        try {
          const parsedBudget = JSON.parse(storedBudget);
          setUserBudget(parsedBudget);
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
            localStorage.setItem('expenses', '[]'); 
          }
        } catch (error) {
          console.error("Failed to parse expenses from localStorage", error);
          setExpenses([]);
          toast({
            title: "خطأ في قراءة البيانات",
            description: "تم إعادة تعيين بيانات المصاريف بسبب وجود بيانات تالفة.",
            variant: "destructive",
          });
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
  }, [toast]);


  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('expenses', JSON.stringify(expenses));
    }
  }, [expenses, isMounted]);

  const handleDeleteExpense = (expenseId: string) => {
    if (!isMounted) return;
    const updatedExpenses = expenses.filter(exp => exp.id !== expenseId);
    setExpenses(updatedExpenses);
    toast({
      title: "تم الحذف",
      description: "تم حذف المصروف بنجاح.",
    });
  };

  const currentExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const outOfBudgetExpenses = expenses.filter(exp => exp.isOutOfBudget).reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = userBudget.totalBudget - currentExpenses;

  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 6 }); 
  const endOfCurrentWeek = endOfWeek(today, { weekStartsOn: 6 });

  const currentWeekExpensesTotal = expenses
    .filter(exp => {
      const expenseDate = new Date(exp.date);
      return isWithinInterval(expenseDate, { start: startOfCurrentWeek, end: endOfCurrentWeek });
    })
    .reduce((sum, exp) => sum + exp.amount, 0);
  
  const weeklySpendingProgress = userBudget.weeklyBudget > 0 ? (currentWeekExpensesTotal / userBudget.weeklyBudget) * 100 : 0;


  if (!isMounted || isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  const filteredExpenses = expenses.filter(expense => categoryFilter[expense.category as keyof typeof categoryFilter]);

  const sortedExpenses = [...filteredExpenses].sort((a, b) => {
    switch (sortOrder) {
      case 'newest':
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      case 'oldest':
        return new Date(a.date).getTime() - new Date(b.date).getTime();
      case 'amountHighToLow':
        return b.amount - a.amount;
      case 'amountLowToHigh':
        return a.amount - b.amount;
      default:
        return 0;
    }
  });

  const recentExpensesToDisplay = sortedExpenses.slice(0, 5);

  return (
    <div className="space-y-6 pb-16 sm:pb-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>ملخص المصاريف الشهري</CardTitle>
            <Link href="/settings">
              <Button variant="ghost" size="sm" className="text-xs px-2 py-1 h-auto">
                <SettingsIcon className="ml-1 h-3 w-3" />
                {userBudget.totalBudget > 0 ? 'تعديل الميزانية' : 'إعداد الميزانية'}
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm sm:text-base">
          {userBudget.totalBudget === 0 && (
            <div className="text-center p-4 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded-md">
              <p>لم تقم بتعيين ميزانية شهرية بعد.</p>
              <p className="text-xs">اذهب إلى <Link href="/settings" className="text-primary underline">الإعدادات</Link> لتعيين ميزانيتك.</p>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-muted-foreground">الميزانية</p>
              <p className="text-lg">{userBudget.totalBudget.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">المصروف</p>
              <p className="text-lg text-destructive">{currentExpenses.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">المتبقي</p>
              <p className={`text-lg ${remainingBudget >= 0 ? 'text-green-600 dark:text-green-400' : 'text-destructive'}`}>{remainingBudget.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">خارج الميزانية</p>
              <p className="text-lg">{outOfBudgetExpenses.toLocaleString()} د.ع</p>
            </div>
          </div>
           {currentExpenses > userBudget.totalBudget && userBudget.totalBudget > 0 && (
            <div className="flex items-center text-destructive p-2 bg-destructive/10 rounded-md mt-4">
              <AlertCircleIcon className="h-5 w-5 ml-2" />
              <p>لقد تجاوزت الميزانية المحددة!</p>
            </div>
          )}
          <div className="pt-4">
            <h4 className="mb-1 text-center sm:text-right">متابعة الصرف الأسبوعي</h4>
            {userBudget.weeklyBudget > 0 ? (
              <>
                <p className="text-xs text-muted-foreground text-center sm:text-right">المتوقع: {userBudget.weeklyBudget.toLocaleString()} د.ع هذا الأسبوع</p>
                <Progress value={weeklySpendingProgress > 100 ? 100 : weeklySpendingProgress} className="h-3 my-2 [&>div]:bg-accent" />
                <div className="flex justify-between text-xs text-muted-foreground px-1">
                  <span>٠ د.ع</span>
                  <span>{currentWeekExpensesTotal.toLocaleString()} د.ع (الحالي)</span>
                  <span>{userBudget.weeklyBudget.toLocaleString()} د.ع</span>
                </div>
              </>
            ) : (
                 <p className="text-xs text-muted-foreground text-center mt-1">
                    قم بتعيين ميزانية أسبوعية متوقعة من <Link href="/settings" className="text-primary underline">الإعدادات</Link> لمتابعة صرفك الأسبوعي.
                 </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>طرق إدخال المصاريف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {AddExpenseDialogs.map(({ label, IconComponent, formComponent, iconBg, iconColor }) => (
              <Dialog key={label}>
                <DialogTrigger asChild>
                   <Button variant="outline" className="w-full h-auto py-4 px-3 text-sm sm:text-base flex flex-row items-center justify-start gap-3">
                    <span className={cn("p-2.5 rounded-lg", iconBg)}>
                      <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6", iconColor)} />
                    </span>
                    <span className="flex-1 text-right">{label}</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle>{label}</DialogTitle>
                  </DialogHeader>
                  {formComponent}
                </DialogContent>
              </Dialog>
            ))}
          </div>
        </CardContent>
      </Card>


      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>المصاريف الأخيرة</CardTitle>
            <CardDescription className="text-xs sm:text-sm">أحدث المصاريف المسجلة</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <ListFilter className="ml-2 h-4 w-4" />
                  ترتيب حسب
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>ترتيب المصاريف</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setSortOrder('newest')}>
                  <SortDescIcon className="mr-2 h-4 w-4" /> الأحدث أولاً
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortOrder('oldest')}>
                  <SortAscIcon className="mr-2 h-4 w-4" /> الأقدم أولاً
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortOrder('amountHighToLow')}>
                  <SortDescIcon className="mr-2 h-4 w-4" /> المبلغ (من الأعلى للأقل)
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSortOrder('amountLowToHigh')}>
                  <SortAscIcon className="mr-2 h-4 w-4" /> المبلغ (من الأقل للأعلى)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="ml-2 h-4 w-4" />
                  تصنيف
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>تصنيف حسب الفئة</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {Object.entries(defaultCategories).map(([key, cat]) => (
                  <DropdownMenuCheckboxItem
                    key={key}
                    checked={!!categoryFilter[key]}
                    onCheckedChange={(checked) => {
                      setCategoryFilter(prev => {
                        const newFilter = { ...prev };
                        if (checked) {
                          newFilter[key] = cat;
                        } else {
                          const currentKeys = Object.keys(newFilter).filter(k => k !== key);
                          if (currentKeys.length === 0 && !checked) {
                            toast({ title: "تنبيه", description: "يجب اختيار فئة واحدة على الأقل."});
                            return prev; 
                          }
                          delete newFilter[key];
                        }
                        return newFilter;
                      });
                    }}
                  >
                    <span className={`inline-block ml-2 text-lg ${cat.color === 'bg-yellow-500' ? 'text-black' : 'text-white'}`}>{cat.icon}</span>
                    {cat.name}
                  </DropdownMenuCheckboxItem>
                ))}
                <DropdownMenuSeparator />
                 <DropdownMenuItem onSelect={() => setCategoryFilter(defaultCategories)} className="text-primary hover:!text-primary-foreground">
                  <FilterXIcon className="mr-2 h-4 w-4" />
                  إعادة تعيين الفلاتر
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent>
          {recentExpensesToDisplay.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-2" />
              <p>
                {Object.keys(categoryFilter).length !== Object.keys(defaultCategories).length ? "لا توجد مصاريف تطابق الفلتر الحالي." : "لا توجد مصاريف مسجلة حتى الآن."}
              </p>
              <p className="text-sm">
                {Object.keys(categoryFilter).length !== Object.keys(defaultCategories).length ? "جرب تغيير الفلاتر أو " : ""}
                ابدأ بإضافة أول مصروف لك!
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentExpensesToDisplay.map((expense) => {
                const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
                return (
                  <li key={expense.id} className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className={`flex-shrink-0 flex items-center justify-center text-xl h-10 w-10 rounded-full ${categoryInfo.color} ${categoryInfo.color === 'bg-yellow-500' ? 'text-black' : 'text-white'}`}>
                          {categoryInfo.icon}
                      </span>
                      <div className="flex-1 text-right min-w-0">
                          <p className="font-semibold truncate">{expense.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 truncate">
                              {new Date(expense.date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })}
                          </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 text-left flex-shrink-0">
                      <div className="font-bold text-primary whitespace-nowrap">
                          {expense.amount.toLocaleString()} د.ع
                      </div>
                      <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive/80"
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
         {filteredExpenses.length > 5 && (
           <CardFooter>
            <Button variant="outline" className="w-full mt-4" onClick={() => toast({ title: "قيد التطوير", description: "صفحة عرض كل المصاريف ستتوفر قريباً." })}>
              عرض كل المصاريف ({filteredExpenses.length})
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
