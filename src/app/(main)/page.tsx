"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertCircleIcon, ArrowDownCircle, ArrowUpCircle, Edit3Icon, Trash2Icon, ListFilter, FilterXIcon } from "lucide-react";
import type { Expense } from '@/types';
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


// Mock categories for display
const mockCategories = {
  "food": { name: "طعام", icon: "🍔", color: "bg-red-500" },
  "transport": { name: "مواصلات", icon: "🚗", color: "bg-blue-500" },
  "shopping": { name: "تسوق", icon: "🛍️", color: "bg-green-500" },
  "bills": { name: "فواتير", icon: "🧾", color: "bg-yellow-500" },
  "other": { name: "أخرى", icon: "🧩", color: "bg-gray-500" },
};

const defaultCategories = Object.keys(mockCategories);

export default function DashboardPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  const [isMounted, setIsMounted] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<string[]>(defaultCategories);

  useEffect(() => {
    setIsMounted(true);
    const storedExpenses = localStorage.getItem('expenses');
    if (storedExpenses) {
      setExpenses(JSON.parse(storedExpenses));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isMounted) {
      localStorage.setItem('expenses', JSON.stringify(expenses));
    }
  }, [expenses, isMounted]);

  const handleDeleteExpense = (id: string) => {
    setExpenses(prevExpenses => prevExpenses.filter(expense => expense.id !== id));
    toast({
      title: "تم الحذف",
      description: "تم حذف المصروف بنجاح.",
      variant: "default",
    });
  };
  
  const totalBudget = 500000; // Example budget
  const currentExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const remainingBudget = totalBudget - currentExpenses;
  const budgetProgress = (currentExpenses / totalBudget) * 100;

  let progressColor = "bg-green-500";
  if (budgetProgress > 80 && budgetProgress <= 100) progressColor = "bg-yellow-500";
  else if (budgetProgress > 100) progressColor = "bg-red-500";

  if (!isMounted) {
    return null; // Or a loading spinner
  }
  
  const filteredExpenses = expenses.filter(expense => categoryFilter.includes(expense.category));

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl">ملخص الميزانية</CardTitle>
          <CardDescription>نظرة عامة على ميزانيتك الشهرية</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <span className="font-medium">الميزانية الشهرية:</span>
            <span className="font-bold text-lg">{totalBudget.toLocaleString()} د.ع</span>
          </div>
          <div className="flex justify-between items-center text-destructive">
            <span className="font-medium">المصاريف الحالية:</span>
            <span className="font-bold text-lg">{currentExpenses.toLocaleString()} د.ع</span>
          </div>
          <div className="flex justify-between items-center text-green-600 dark:text-green-400">
            <span className="font-medium">المبلغ المتبقي:</span>
            <span className="font-bold text-lg">{remainingBudget.toLocaleString()} د.ع</span>
          </div>
          <div>
            <Progress value={budgetProgress > 100 ? 100 : budgetProgress} className="h-3 [&>div]:bg-primary" />
            <p className="text-sm text-muted-foreground mt-1 text-right">
              {budgetProgress.toFixed(0)}% من الميزانية مستخدمة
            </p>
          </div>
          {budgetProgress > 100 && (
            <div className="flex items-center text-destructive p-2 bg-destructive/10 rounded-md">
              <AlertCircleIcon className="h-5 w-5 ml-2" />
              <p>لقد تجاوزت الميزانية المحددة!</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">المصاريف الأخيرة</CardTitle>
            <CardDescription>قائمة بأحدث المصاريف المسجلة</CardDescription>
          </div>
          <DropdownMenu dir="rtl">
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <ListFilter className="ml-2 h-4 w-4" />
                تصنيف
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>التصنيفات</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {Object.entries(mockCategories).map(([key, cat]) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={categoryFilter.includes(key)}
                  onCheckedChange={(checked) => {
                    setCategoryFilter(prev => 
                      checked ? [...prev, key] : prev.filter(c => c !== key)
                    );
                  }}
                >
                  {cat.name}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
               <DropdownMenuItem onSelect={() => setCategoryFilter(defaultCategories)} className="text-primary">
                <FilterXIcon className="mr-2 h-4 w-4" />
                إعادة تعيين الفلاتر
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p>جاري تحميل المصاريف...</p>
          ) : filteredExpenses.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">لا توجد مصاريف مسجلة حتى الآن أو تطابق الفلتر.</p>
          ) : (
            <ul className="space-y-3">
              {filteredExpenses.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((expense) => {
                const categoryInfo = mockCategories[expense.category as keyof typeof mockCategories] || mockCategories.other;
                return (
                  <li key={expense.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className={`text-2xl ${categoryInfo.icon.length > 1 ? 'p-1 rounded-md ' + categoryInfo.color : ''}`}>{categoryInfo.icon}</span>
                      <div>
                        <p className="font-medium">{expense.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(expense.date).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'long', day: 'numeric' })} - {categoryInfo.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={expense.isOutOfBudget ? "destructive" : "secondary"} className="whitespace-nowrap">
                        {expense.amount.toLocaleString()} د.ع
                      </Badge>
                       <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>هل أنت متأكد من الحذف؟</AlertDialogTitle>
                            <AlertDialogDescription>
                              لا يمكن التراجع عن هذا الإجراء. سيتم حذف هذا المصروف نهائياً.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>إلغاء</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDeleteExpense(expense.id)} className="bg-destructive hover:bg-destructive/90">
                              حذف
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                      {/* Edit button placeholder */}
                       {/* <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary" disabled>
                        <Edit3Icon className="h-4 w-4" />
                      </Button> */}
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
