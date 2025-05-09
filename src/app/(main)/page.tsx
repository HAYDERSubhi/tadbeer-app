
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, Edit3Icon, DollarSign, FilePenLine, Mic, ScanLine, CircleIcon, CreditCardIcon } from "lucide-react";
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
import Image from 'next/image'; // For placeholder images if needed

// Mock categories for display
const mockCategories = {
  "food": { name: "طعام", icon: "🍔", color: "bg-orange-500" }, // Adjusted to orange like image
  "transport": { name: "مواصلات", icon: "🚗", color: "bg-red-500" }, // Taxi in image is orange/red
  "shopping": { name: "تسوق", icon: "🛍️", color: "bg-blue-500" }, // Shopping bag in image is blue
  "bills": { name: "فواتير", icon: "🧾", color: "bg-yellow-500" },
  "other": { name: "أخرى", icon: "🧩", color: "bg-gray-500" },
};


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
    IconComponent: CreditCardIcon, // Changed from Circle for better semantics, style will be handled
    formComponent: <div className="p-6 text-center"><p>سيتم إضافة مزامنة البطاقة الإلكترونية قريباً.</p><Image src="https://picsum.photos/200/150" alt="Coming soon" width={200} height={150} className="mx-auto mt-4 rounded-md" data-ai-hint="credit card technology" /></div>,
    iconBg: "bg-primary",
    iconColor: "text-primary-foreground"
  },
];


export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  const refreshExpenses = () => {
    const storedExpenses = localStorage.getItem('expenses');
    if (storedExpenses) {
      setExpenses(JSON.parse(storedExpenses));
    }
  };

  useEffect(() => {
    setIsMounted(true);
    refreshExpenses();
    setIsLoading(false);

    window.addEventListener('expensesUpdated', refreshExpenses);
    return () => {
      window.removeEventListener('expensesUpdated', refreshExpenses);
    };
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('expenses', JSON.stringify(expenses));
    }
  }, [expenses, isMounted]);
  
  const totalBudget = 5000000; // Example budget
  const currentExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const outOfBudgetExpenses = expenses.filter(exp => exp.isOutOfBudget).reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = totalBudget - currentExpenses;
  const budgetProgress = totalBudget > 0 ? (currentExpenses / totalBudget) * 100 : 0;

  // Mock data for weekly spending
  const expectedWeeklySpending = 1000000;
  const currentAverageWeeklySpending = 750000; // Example
  const weeklySpendingProgress = expectedWeeklySpending > 0 ? (currentAverageWeeklySpending / expectedWeeklySpending) * 100 : 0;


  if (!isMounted) {
    // return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
    return null; // Return null on server or during first client render to avoid hydration mismatch
  }
  
  const recentExpensesToDisplay = expenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3);

  return (
    <div className="space-y-6 pb-8">
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-xl sm:text-2xl">ملخص المصاريف الشهري</CardTitle>
            <Button variant="ghost" size="sm" className="text-xs px-2 py-1 h-auto" onClick={() => toast({ title: "قيد التطوير", description: "تعديل الميزانية سيكون متاحاً قريباً." })}>
              <Edit3Icon className="ml-1 h-3 w-3" />
              تعديل
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 text-sm sm:text-base">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-muted-foreground">الميزانية</p>
              <p className="font-bold text-lg">{totalBudget.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">المصروف</p>
              <p className="font-bold text-lg text-destructive">{currentExpenses.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">المتبقي</p>
              <p className="font-bold text-lg text-green-600 dark:text-green-400">{remainingBudget.toLocaleString()} د.ع</p>
            </div>
            <div>
              <p className="text-muted-foreground">خارج الميزانية</p>
              <p className="font-bold text-lg">{outOfBudgetExpenses.toLocaleString()} د.ع</p>
            </div>
          </div>
           {budgetProgress > 100 && (
            <div className="flex items-center text-destructive p-2 bg-destructive/10 rounded-md mt-4">
              <AlertCircleIcon className="h-5 w-5 ml-2" />
              <p>لقد تجاوزت الميزانية المحددة!</p>
            </div>
          )}
          <div className="pt-4">
            <h4 className="font-semibold mb-1 text-center sm:text-right">معدل الصرفيات الأسبوعي</h4>
            <p className="text-xs text-muted-foreground text-center sm:text-right">المتوقع: {expectedWeeklySpending.toLocaleString()} د.ع في الأسبوع</p>
            <Progress value={weeklySpendingProgress > 100 ? 100 : weeklySpendingProgress} className="h-3 my-2 [&>div]:bg-accent" />
            <div className="flex justify-between text-xs text-muted-foreground px-1">
              <span>٠ د.ع</span>
              <span>{currentAverageWeeklySpending.toLocaleString()} د.ع (الحالي)</span>
              <span>{expectedWeeklySpending.toLocaleString()} د.ع</span>
            </div>
             <p className="text-xs text-muted-foreground text-center mt-1">تفاصيل أكثر قريباً حول التقسيم الأسبوعي.</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl sm:text-2xl">طرق إدخال المصاريف</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {AddExpenseDialogs.map(({ label, IconComponent, formComponent, iconBg, iconColor }) => (
              <Dialog key={label}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="h-auto py-4 px-3 text-sm sm:text-base flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2">
                    <span className={cn("p-2 rounded-full", iconBg)}>
                      <IconComponent className={cn("h-5 w-5 sm:h-6 sm:w-6", iconColor)} />
                    </span>
                    <span>{label}</span>
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
            <CardTitle className="text-xl sm:text-2xl">المصاريف الأخيرة</CardTitle>
            <CardDescription className="text-xs sm:text-sm">أحدث 3 مصاريف مسجلة</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => toast({ title: "قيد التطوير", description: "صفحة عرض كل المصاريف ستتوفر قريباً." })}>
            عرض الكل
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-4">جاري تحميل المصاريف...</p>
          ) : recentExpensesToDisplay.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-2" />
              <p className="font-semibold">لا توجد مصاريف مسجلة حتى الآن.</p>
              <p className="text-sm">ابدأ بإضافة أول مصروف لك!</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {recentExpensesToDisplay.map((expense) => {
                const categoryInfo = mockCategories[expense.category as keyof typeof mockCategories] || mockCategories.other;
                return (
                  <li key={expense.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="font-semibold text-primary">
                      {expense.amount.toLocaleString()} د.ع
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div className="flex-grow">
                        <p className="font-medium">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString('ar-IQ', { month: 'short', day: 'numeric' })} - {new Date(expense.date).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </p>
                      </div>
                       <span className={`flex items-center justify-center text-xl h-10 w-10 rounded-full ${categoryInfo.color} text-white`}>
                        {categoryInfo.icon}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

