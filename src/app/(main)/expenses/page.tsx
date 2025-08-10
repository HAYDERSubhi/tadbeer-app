
"use client";

import { useMemo } from 'react';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Trash2Icon, DollarSign, Loader2Icon, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';
import { useAppData } from '@/hooks/use-app-data';
import { format, compareDesc, parseISO } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { useCategories } from '@/hooks/use-categories';

export default function AllExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { expenses, isLoading, isError, error, queryClient } = useAppData();
  const { categoryMap, getIconComponent } = useCategories();

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(user!.uid, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      toast({
        title: "تم الحذف",
        description: "تم حذف المصروف بنجاح.",
      });
    },
     onError: () => {
      toast({
        title: "خطأ",
        description: "لم نتمكن من حذف المصروف.",
        variant: "destructive",
      });
    }
  });

  const handleDeleteExpense = (expenseId: string) => {
    if (!user) return;
    deleteMutation.mutate(expenseId);
  };
  
  const allSortedExpenses = useMemo(() => {
     if (!expenses) return [];
     return [...expenses].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
  }, [expenses]);


  if (isError) {
    return <FirestoreErrorAlert error={error} context="المصاريف" />;
  }

  if (isLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 pb-20">
      <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <WalletCards className="h-4 w-4 text-primary" />
                جميع المصاريف
            </CardTitle>
            <CardDescription className="text-xs">
                هنا تجد قائمة كاملة بجميع مصاريفك المسجلة.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
              {allSortedExpenses.length === 0 ? (
                  <div className="px-6 py-20 text-center text-muted-foreground">
                      <DollarSign className="mx-auto h-12 w-12 mb-4" />
                      <h3 className="text-lg font-semibold">لا توجد مصاريف مسجلة</h3>
                      <p className="text-sm">ابدأ بإضافة أول مصروف لك من الصفحة الرئيسية.</p>
                  </div>
              ) : (
                  <ul className="divide-y divide-border">
                  {allSortedExpenses.map((expense) => {
                      const categoryInfo = categoryMap[expense.category];
                      return (
                      <li key={expense.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                          <div className="flex flex-1 items-center gap-3 min-w-0">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xl">
                              {categoryInfo ? getIconComponent(categoryInfo.icon) : '💸'}
                          </span>
                          <div className="min-w-0">
                              <p className="font-semibold truncate text-xs">{expense.title}</p>
                              <p className="text-xs text-muted-foreground">
                                  {categoryInfo?.name || 'فئة غير معروفة'}
                              </p>
                          </div>
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4">
                              <div className="text-end shrink-0">
                              <p className="font-semibold text-foreground text-xs sm:text-sm">
                                  {expense.amount.toLocaleString()}&nbsp;د.ع
                              </p>
                              <p className="text-xs text-muted-foreground">
                                  {format(parseISO(expense.date), "d MMM yyyy", { locale: arIQ })}
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
      </Card>
    </div>
  );
}

    
