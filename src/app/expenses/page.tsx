
"use client";

import { useMemo } from 'react';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { Trash2Icon, DollarSign, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from '@/hooks/use-auth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getExpenses, deleteExpense } from '@/services/firestore';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';

export default function AllExpensesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: expenses = [], isLoading, isError, error } = useQuery<Expense[], Error>({
    queryKey: ['expenses', user?.uid],
    queryFn: () => getExpenses(user!.uid),
    enabled: !!user,
  });

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
     return [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
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
                      const categoryInfo = defaultCategories[expense.category as keyof typeof defaultCategories] || defaultCategories.other;
                      return (
                      <li key={expense.id} className="group flex items-center justify-between p-4 transition-colors hover:bg-muted/50">
                          <div className="flex flex-1 items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-muted text-xl">
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
                              <div className="text-end">
                              <p className="font-semibold text-foreground">
                                  {expense.amount.toLocaleString()}&nbsp;د.ع
                              </p>
                              <p className="text-sm text-muted-foreground">
                                  {new Date(expense.date).toLocaleDateString('ar-IQ', { day: 'numeric', month: 'long', year: 'numeric' })}
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
