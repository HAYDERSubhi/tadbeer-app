"use client";

import { useMemo, useState, Fragment } from 'react';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Trash2Icon, DollarSign, Loader2Icon, WalletCards, Search, Filter, Pencil, MoreHorizontal, X, CheckSquare, Square, Trash2, ArrowUpDown, SortAsc, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from '@/hooks/use-auth';
import { useMutation, useQuery } from '@tanstack/react-query';
import { deleteExpense, getExpenses } from '@/services/firestore';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';
import { useAppData } from '@/hooks/use-app-data';
import { format, compareDesc, parseISO } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';
import { useCategories } from '@/hooks/use-categories';
import { useIsMobile } from '@/hooks/use-mobile';
import EditExpenseForm from '@/components/expenses/edit-expense-form';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import Link from 'next/link';

export default function AllExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { householdId, isLoading: settingsLoading, isError, error, queryClient } = useAppData();

  // Load ALL expenses — the full history is needed for this page.
  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['expenses', user?.uid, householdId, 'all'],
    queryFn: () => getExpenses(user!.uid, householdId),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });
  const isLoading = settingsLoading || expensesLoading;
  const { categories, categoryMap, getIconComponent } = useCategories();
  const isMobile = useIsMobile();
  const { format: formatCurrency } = useCurrency();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const EditComponent = isMobile ? Sheet : Dialog;

  const deleteMutation = useMutation({
    mutationFn: (expenseId: string) => deleteExpense(user!.uid, expenseId, householdId),
    onSuccess: (_data, expenseId) => {
      // Instantly remove from ALL cache entries then invalidate for reconciliation.
      const removeFromCache = (key: unknown[]) => {
        queryClient.setQueryData<import('@/types').Expense[]>(key, old =>
          old ? old.filter(e => e.id !== expenseId) : old
        );
      };
      removeFromCache(['expenses', user?.uid, householdId, 'recent']);
      removeFromCache(['expenses', user?.uid, householdId, 'all']);
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      toast({ title: "تم الحذف", description: "تم حذف المصروف بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "لم نتمكن من حذف المصروف.", variant: "destructive" });
    }
  });

  const allSortedExpenses = useMemo(() => {
    if (!expenses) return [];
    const sorted = [...expenses].sort((a, b) => {
      let result = 0;
      if (sortBy === 'date') result = compareDesc(new Date(a.date), new Date(b.date));
      else if (sortBy === 'amount') result = b.amount - a.amount;
      else if (sortBy === 'category') result = (a.category || '').localeCompare(b.category || '', 'ar');
      return sortDir === 'asc' ? -result : result;
    });
    return sorted;
  }, [expenses, sortBy, sortDir]);

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

  const toggleSelectMode = () => {
    setIsSelectionMode(prev => !prev);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filteredExpenses.map(e => e.id)));
  };

  const deselectAll = () => setSelectedIds(new Set());

  const handleBulkDelete = async () => {
    if (!user || selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      await Promise.all([...selectedIds].map(id => deleteExpense(user.uid, id, householdId)));
      // Instantly remove deleted items from cache.
      const deletedIds = selectedIds;
      const removeFromCache = (key: unknown[]) => {
        queryClient.setQueryData<import('@/types').Expense[]>(key, old =>
          old ? old.filter(e => !deletedIds.has(e.id)) : old
        );
      };
      removeFromCache(['expenses', user.uid, householdId, 'recent']);
      removeFromCache(['expenses', user.uid, householdId, 'all']);
      queryClient.invalidateQueries({ queryKey: ['expenses', user.uid] });
      toast({ title: "تم الحذف", description: `تم حذف ${selectedIds.size} مصروف بنجاح.` });
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } catch {
      toast({ title: "خطأ", description: "لم نتمكن من حذف بعض المصاريف.", variant: "destructive" });
    } finally {
      setIsBulkDeleting(false);
    }
  };

  if (isError) return <FirestoreErrorAlert error={error} context="المصاريف" />;
  if (isLoading) return <div className="flex justify-center items-center h-[60vh]"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;

  const deleteTargetTitle = expenses.find(e => e.id === deleteConfirmId)?.title ?? '';

  return (
    <div className="space-y-4 pb-20">

      {/* Single-expense delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف المصروف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{deleteTargetTitle}"؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId && user) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              نعم، احذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
              <SelectTrigger className="h-8 text-xs flex-1">
                <SelectValue placeholder="كل الفئات" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الفئات</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="h-8 text-xs w-[90px]">
                <SortAsc className="h-3 w-3 ml-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">التاريخ</SelectItem>
                <SelectItem value="amount">المبلغ</SelectItem>
                <SelectItem value="category">الفئة</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline" size="sm" className="h-8 w-8 p-0 shrink-0"
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              title={sortDir === 'desc' ? 'تنازلي' : 'تصاعدي'}
            >
              <ArrowUpDown className={cn("h-3 w-3 transition-transform", sortDir === 'asc' && "rotate-180")} />
            </Button>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                <X className="h-3 w-3 ml-1" /> مسح
              </Button>
            )}
          </div>
          <div className="flex justify-end">
            <Button
              variant={isSelectionMode ? "default" : "outline"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={toggleSelectMode}
            >
              {isSelectionMode ? <X className="h-3 w-3 ml-1" /> : <CheckSquare className="h-3 w-3 ml-1" />}
              {isSelectionMode ? 'إلغاء التحديد' : 'تحديد متعدد'}
            </Button>
          </div>

          {/* Bulk Actions Bar */}
          {isSelectionMode && (
            <div className="flex items-center justify-between p-2 bg-muted/60 rounded-lg border animate-in fade-in">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAll}>
                  تحديد الكل ({filteredExpenses.length})
                </Button>
                {selectedIds.size > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={deselectAll}>
                    إلغاء الكل
                  </Button>
                )}
              </div>
              {selectedIds.size > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm" className="h-7 text-xs" disabled={isBulkDeleting}>
                      {isBulkDeleting
                        ? <Loader2Icon className="h-3 w-3 animate-spin ml-1" />
                        : <Trash2 className="h-3 w-3 ml-1" />
                      }
                      حذف ({selectedIds.size})
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                      <AlertDialogDescription>
                        هل أنت متأكد من حذف {selectedIds.size} مصروف؟ لا يمكن التراجع عن هذا الإجراء.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        نعم، احذف
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* FAB — Add expense */}
      <Link
        href="/add-expense"
        className="fixed bottom-20 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        aria-label="إضافة مصروف جديد"
      >
        <Plus className="h-6 w-6" />
      </Link>

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
                {formatCurrency(totalFiltered)}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filteredExpenses.length === 0 ? (
            <div className="px-6 py-16 text-center text-muted-foreground">
              <DollarSign className="mx-auto h-12 w-12 mb-4 opacity-30" />
              {hasFilters ? (
                <>
                  <h3 className="text-base font-semibold">لا توجد نتائج</h3>
                  <p className="text-sm mt-1">جرب تغيير معايير البحث</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>مسح الفلاتر</Button>
                </>
              ) : (
                <>
                  <h3 className="text-base font-semibold">لا توجد مصاريف مسجلة</h3>
                  <p className="text-sm mt-1">ابدأ بتسجيل أول مصروف لك</p>
                  <Link href="/add-expense">
                    <Button size="sm" className="mt-4 gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة مصروف
                    </Button>
                  </Link>
                </>
              )}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {filteredExpenses.map((expense) => {
                const categoryInfo = categoryMap[expense.category];
                const isSelected = selectedIds.has(expense.id);
                return (
                  <Fragment key={expense.id}>
                    <li
                      className={cn(
                        "flex items-center justify-between p-3 transition-colors",
                        isSelectionMode ? "cursor-pointer hover:bg-muted/50" : "hover:bg-muted/50",
                        isSelected && "bg-primary/5 border-r-2 border-primary"
                      )}
                      onClick={isSelectionMode ? () => toggleSelect(expense.id) : undefined}
                    >
                      {/* Checkbox in selection mode */}
                      {isSelectionMode && (
                        <div className="ml-2 shrink-0">
                          {isSelected
                            ? <CheckSquare className="h-5 w-5 text-primary" />
                            : <Square className="h-5 w-5 text-muted-foreground" />
                          }
                        </div>
                      )}

                      <div className="flex flex-1 items-center gap-3 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-muted text-lg">
                          {categoryInfo ? getIconComponent(categoryInfo.icon) : '💸'}
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-xs">{expense.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {categoryInfo?.name || 'غير معروفة'} · {format(parseISO(expense.date), "d MMM", { locale: arIQ })}
                          </p>
                          {expense.description && (
                            <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 italic">
                              {expense.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <p className="font-bold text-xs ml-2">{formatCurrency(expense.amount)}</p>
                        {!isSelectionMode && (
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
                                  onSelect={() => setDeleteConfirmId(expense.id)}
                                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
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
                        )}
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
