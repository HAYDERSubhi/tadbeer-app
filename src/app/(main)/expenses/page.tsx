"use client";

import { useMemo, useState, Fragment } from 'react';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Trash2Icon, DollarSign, Loader2Icon, WalletCards, Search, Filter, Pencil, MoreHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from '@/hooks/use-auth';
import { useMutation } from '@tanstack/react-query';
import { deleteExpense } from '@/services/firestore';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';
import { useAppData } from '@/hooks/use-app-data';
import { format, compareDesc, parseISO } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useCategories } from '@/hooks/use-categories';
import { useIsMobile } from '@/hooks/use-mobile';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { Badge } from '@/components/ui/badge';

export default function AllExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { expenses, isLoading, isError, error, queryClient } = useAppData();
  const { categories, categoryMap, getIconComponent } = useCategories();
  const isMobile = useIsMobile();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  const EditComponent = isMobile ? Sheet : Dialog;

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(user!.uid, expenseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      toast({ title: "تم الحذف", description: "تم حذف المصروف بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "لم نتمكن من حذف المصروف.", variant: "destructive" });
    }
  });

  const allSortedExpenses = useMemo(() => {
    if (!expenses) return [];
    return [...expenses].sort((a, b) => compareDesc(new Date(a.date), new Date(b.date)));
  }, [expenses]);

  const filteredExpenses = useMemo(() => {
    return allSortedExpenses.filter(expense => {
      const matchesSearch = searchQuery === '' ||
        expense.title.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' ||
        expense.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [allSortedExpenses, searchQuery, selectedCategory]);

  const totalFiltered = useMemo(() =>
    filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const hasFilters = searchQuery !== '' || selectedCategory !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
  };

  if (isError) return <FirestoreErrorAlert error={error} context="المصاريف" />;
  if (isLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 pb-20">

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن مصروف..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 ml-1" /> مسح
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <WalletCards className="h-4 w-4 text-primary" />
              {hasFilters ? `نتائج البحث (${filteredExpenses.length})` : `جميع المصاريف (${allSortedExpenses.length})`}
            </CardTitle>
            {filteredExpenses.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalFiltered.toLocaleString()} د.ع
              </Badge>
            )}
          </div>
          {hasFilters && (
            <CardDescription className="text-xs">
              إجمالي النتائج: {totalFiltered.toLocaleString()} د.ع
            </CardDescription>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <div className="px-6 py-16 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-30" />
              {hasFilters ? (
                <>
                  <h3 className="text-base font-semibold">لا توجد نتائج</h3>
                  <p className="text-sm mt-1">جرب تغيير معايير البحث</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
                    مسح الفلاتر
                  </Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold">لا توجد مصاريف مسجلة</h3>
                  <p className="text-sm mt-1">ابدأ بإضافة أول مصروف لك من الصفحة الرئيسية.</p>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredExpenses.map((expense) => {
                const categoryInfo = categoryMap[expense.category];
                return (
                  <Fragment key={expense.id}>
                    <li className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50">
                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-lg">
                          {categoryInfo ? getIconComponent(categoryInfo.icon) : '💸'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-xs">{expense.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryInfo?.name || 'غير معروفة'} · {format(parseISO(expense.date), "d MMM", { locale: ar })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <p className="font-bold text-xs ml-2">{expense.amount.toLocaleString()} د.ع</p>
                        <EditComponent
                          open={editingExpense?.id === expense.id}
                          onOpenChange={(open) => { if (!open) setEditingExpense(null); }}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => setEditingExpense(expense)}>
                                <Pencil className="ml-2 h-4 w-4" /> تعديل
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => { if (user) deleteMutation.mutate(expense.id); }}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2Icon className="ml-2 h-4 w-4" /> حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          {isMobile ? (
                            <SheetContent side="bottom" className="flex flex-col">
                              <SheetHeader><SheetTitle>تعديل المصروف</SheetTitle></SheetHeader>
                              <div className="overflow-y-auto px-2 pb-6">
                                {editingExpense?.id === expense.id && (
                                  <EditExpenseForm expense={expense} setOpen={(open) => { if (!open) setEditingExpense(null); }} />
                                )}
                              </div>
                            </SheetContent>
                          ) : (
                            <DialogContent>
                              {editingExpense?.id === expense.id && (
                                <EditExpenseForm expense={expense} setOpen={(open) => { if (!open) setEditingExpense(null); }} />
                              )}
                            </DialogContent>
                          )}
                        </EditComponent>
                      </div>
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
