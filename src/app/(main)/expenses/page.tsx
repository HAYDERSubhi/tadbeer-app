"use client";

import { useMemo, useState, Fragment, useEffect } from 'react';
import type { Expense } from '@/types';
import { useToast } from "@/hooks/use-toast";
import { Trash2Icon, DollarSign, Loader2Icon, WalletCards, Search, Filter, Pencil, MoreHorizontal, X, CheckSquare, Square, Trash2, ArrowUpDown, SortAsc, Plus, CalendarDays, HandCoins } from "lucide-react";
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
import { deleteExpense, deleteExpensesBatch, getExpenses } from '@/services/firestore';
import FirestoreErrorAlert from '@/components/errors/firestore-error-alert';
import { useAppData } from '@/hooks/use-app-data';
import { format, compareDesc, parseISO, isBefore, startOfMonth, isValid } from 'date-fns';
import { arIQ, formatYearMonth } from '@/lib/arabic-date';
import { useCategories } from '@/hooks/use-categories';
import { useIsMobile } from '@/hooks/use-mobile';
import dynamic from 'next/dynamic';
import { Badge } from '@/components/ui/badge';
import { IncomeRow } from '@/components/expenses/income-row';
import { EntryModeToggle, type EntryMode } from '@/components/expenses/entry-mode-toggle';

// تحميل كسول — النموذج لا يظهر إلا داخل نافذة منبثقة بضغطة المستخدم.
const EditExpenseForm = dynamic(() => import('@/components/expenses/edit-expense-form'), {
  loading: () => (
    <div className="flex items-center justify-center py-10">
      <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
    </div>
  ),
  ssr: false,
});
import { cn } from '@/lib/utils';
import { useCurrency } from '@/hooks/use-currency';
import Link from 'next/link';

export default function AllExpensesPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { householdId, incomes, isLoading: settingsLoading, isError, error, queryClient } = useAppData();

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
  // عرض «دخل» ترشيحٌ لا شاشة جديدة (قرار المالك 2026-11-14): الدخل لا يظهر مع المصاريف في قائمة واحدة
  // كي لا يختلط مجموع المصاريف ولا يتعطّل الترتيب والتحديد المتعدد. الافتراضي المصاريف دائماً.
  const [view, setView] = useState<EntryMode>('expense');
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'income') setView('income');
  }, []);
  // القائمة تفتح على **الشهر الحالي** لا على كل التاريخ (طلب مستخدم 2026-11-05:
  // «عند بداية كل شهر يختفي الشهر الماضي ويتحوّل إلى الأرشفة»). الشهور السابقة
  // تُختار من القائمة، و'all' يعيد السلوك القديم. لا شيء يُحذف ولا يُنقل في
  // القاعدة — هذا عرض فقط.
  const currentMonthKey = format(new Date(), 'yyyy-MM');
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonthKey);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'category'>('date');
  const [sortDir, setSortDir] = useState<'desc' | 'asc'>('desc');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(50);

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

  // الدخل المسجَّل بتاريخ (المتكرر ليس استلاماً بيوم)، الأحدث أولاً.
  const oneTimeIncomes = useMemo(() =>
    incomes
      .filter(i => i.type === 'one-time' && isValid(parseISO(i.date)))
      .sort((a, b) => compareDesc(new Date(a.date), new Date(b.date))),
    [incomes]);

  // الشهور التي فيها مصاريف فعلاً (الأحدث أولاً) + الشهر الحالي دائماً. وفي عرض الدخل: شهور الدخل.
  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonthKey]);
    const source: { date: string }[] = view === 'income' ? oneTimeIncomes : allSortedExpenses;
    source.forEach(e => {
      try { keys.add(format(parseISO(e.date), 'yyyy-MM')); } catch { /* تاريخ تالف — يظهر تحت «كل الشهور» */ }
    });
    return Array.from(keys).sort().reverse();
  }, [allSortedExpenses, oneTimeIncomes, view, currentMonthKey]);

  // نفس قاعدة المصاريف: البحث النصّي يتخطّى الشهر ويبحث في كل التاريخ.
  const filteredIncomes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return oneTimeIncomes.filter(inc => {
      if (q !== '' && !inc.title.toLowerCase().includes(q)) return false;
      if (selectedMonth === 'all' || q !== '') return true;
      try { return format(parseISO(inc.date), 'yyyy-MM') === selectedMonth; } catch { return false; }
    });
  }, [oneTimeIncomes, searchQuery, selectedMonth]);
  const totalIncomeFiltered = useMemo(() => filteredIncomes.reduce((sum, i) => sum + i.amount, 0), [filteredIncomes]);
  // يظهر الترشيح لمن سجّل دخلاً فقط (غيرهم لا يتغيّر عندهم شيء)؛ ويبقى ظاهراً إن حذف آخر دخل وهو داخله.
  const showViewToggle = oneTimeIncomes.length > 0 || view === 'income';

  const filteredExpenses = useMemo(() => {
    return allSortedExpenses.filter(expense => {
      // البحث يشمل الوصف لا الاسم وحده: مصاريف الفاتورة الواحدة تتشارك وصفاً
      // موحّداً «فاتورة: اسم المحل» بينما أسماؤها مختلفة، فبحث واحد يجمعها كلها
      // ويجعل «تحديد الكل» يعمل عليها دفعةً واحدة. بلا هذا كان تصحيح فاتورة
      // من ٤٥ عنصراً يتطلّب ٤٥ ضغطة يدوية (حادثة 2026-09-03).
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = q === '' ||
        expense.title.toLowerCase().includes(q) ||
        (expense.description ?? '').toLowerCase().includes(q);
      const matchesCategory = selectedCategory === 'all' ||
        expense.category === selectedCategory;
      // ⛔ البحث النصّي يتخطّى الشهر عمداً ويبحث في كل التاريخ: من يبحث عن مصروف
      //    قديم ولا يجده سيظنّه ضاع. (وبه يبقى جمع عناصر فاتورة قديمة بالبحث يعمل.)
      let matchesMonth = selectedMonth === 'all' || q !== '';
      if (!matchesMonth) {
        try { matchesMonth = format(parseISO(expense.date), 'yyyy-MM') === selectedMonth; } catch { matchesMonth = false; }
      }
      return matchesSearch && matchesCategory && matchesMonth;
    });
  }, [allSortedExpenses, searchQuery, selectedCategory, selectedMonth]);

  const totalFiltered = useMemo(() =>
    filteredExpenses.reduce((sum, e) => sum + e.amount, 0),
    [filteredExpenses]
  );

  const hasFilters = searchQuery !== '' || selectedCategory !== 'all';

  // إعادة تعيين العرض عند تغيير الفلتر أو الترتيب
  useEffect(() => { setVisibleCount(50); }, [searchQuery, selectedCategory, selectedMonth, sortBy, sortDir, view]);

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
      // Atomic batch — all selected items deleted together or none.
      await deleteExpensesBatch(user.uid, [...selectedIds], householdId);
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

  const deleteTarget = expenses.find(e => e.id === deleteConfirmId);
  const deleteTargetTitle = deleteTarget?.title ?? '';
  // Deleting from a closed month silently rewrites historical reports — warn.
  const deleteTargetIsPastMonth = (() => {
    if (!deleteTarget) return false;
    try { return isBefore(parseISO(deleteTarget.date), startOfMonth(new Date())); }
    catch { return false; }
  })();

  return (
    <div className="space-y-4 pb-20">

      {/* Single-expense delete confirmation */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-1">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>حذف المصروف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-medium text-foreground">«{deleteTargetTitle}»</span> نهائياً
              {deleteTargetIsPastMonth && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400 text-xs">
                  هذا المصروف من شهر منتهٍ — حذفه سيؤثر على تقاريرك السابقة
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId && user) deleteMutation.mutate(deleteConfirmId);
                setDeleteConfirmId(null);
              }}
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel onClick={() => setDeleteConfirmId(null)}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Search & Filter */}
      <Card>
        <CardContent className="p-4 space-y-3">
          {showViewToggle && (
            <EntryModeToggle
              value={view}
              onChange={(mode) => {
                setView(mode);
                if (isSelectionMode) { setIsSelectionMode(false); setSelectedIds(new Set()); }
              }}
              className="mx-0 mt-0"
              ariaLabel="نوع السجلات المعروضة"
            />
          )}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={view === 'income' ? 'ابحث باسم مصدر الدخل...' : 'ابحث بالاسم أو اسم المحل...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>
          {/* الشهر المعروض — الحالي افتراضياً، والسابقة أرشيف يُختار من هنا */}
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-9 text-sm flex-1" aria-label="الشهر المعروض">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(key => (
                  <SelectItem key={key} value={key}>
                    {formatYearMonth(key)}{key === currentMonthKey ? ' (الشهر الحالي)' : ''}
                  </SelectItem>
                ))}
                <SelectItem value="all">كل الشهور</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {view === 'expense' && (<>
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
                      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-1">
                        <Trash2 className="h-5 w-5 text-destructive" />
                      </div>
                      <AlertDialogTitle>حذف {selectedIds.size} مصروف</AlertDialogTitle>
                      <AlertDialogDescription>
                        سيتم حذف العناصر المحددة نهائياً
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        حذف
                      </AlertDialogAction>
                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          )}
          </>)}
        </CardContent>
      </Card>

      {/* FAB — Add expense */}
      <Link
        href={view === 'income' ? '/add-expense?mode=income' : '/add-expense'}
        className="fixed bottom-20 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 active:scale-95 transition-all"
        aria-label={view === 'income' ? 'إضافة دخل جديد' : 'إضافة مصروف جديد'}
      >
        <Plus className="h-6 w-6" />
      </Link>

      {/* Results — المصاريف */}
      {view === 'expense' && (
      <Card>
        <CardHeader className="py-3 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm font-bold">
              <WalletCards className="h-4 w-4 text-primary" />
              {searchQuery.trim() !== ''
                ? `نتائج البحث في كل الشهور (${filteredExpenses.length})`
                : hasFilters
                  ? `نتائج البحث (${filteredExpenses.length})`
                  : selectedMonth === 'all'
                    ? `جميع المصاريف (${filteredExpenses.length})`
                    : `مصاريف ${formatYearMonth(selectedMonth)} (${filteredExpenses.length})`}
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
              ) : allSortedExpenses.length > 0 ? (
                <>
                  {/* الشهر المختار فارغ لكن للمستخدم مصاريف في شهور أخرى — «لا توجد
                      مصاريف مسجلة» كانت ستكون كاذبة هنا وتوهمه بضياع بياناته. */}
                  <h3 className="text-base font-semibold">لا توجد مصاريف في هذا الشهر</h3>
                  <p className="text-sm mt-1">مصاريف الشهور السابقة محفوظة — اخترها من قائمة الشهر</p>
                  <Button variant="outline" size="sm" className="mt-4" onClick={() => setSelectedMonth('all')}>عرض كل الشهور</Button>
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
            <>
            <ul className="divide-y divide-border">
              {filteredExpenses.slice(0, visibleCount).map((expense) => {
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
                            <p className="text-xs text-muted-foreground/70 truncate mt-0.5 italic">
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
                                <Button variant="ghost" size="icon" className="h-10 w-10">
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
            {filteredExpenses.length > visibleCount && (
              <div className="p-3 border-t text-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary w-full h-9"
                  onClick={() => setVisibleCount(c => c + 50)}
                >
                  تحميل المزيد ({filteredExpenses.length - visibleCount} متبقٍ)
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>
      )}

      {/* Results — الدخل (ترشيح «دخل») */}
      {view === 'income' && (
        <Card>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-sm font-bold">
                <HandCoins className="h-4 w-4 text-green-600 dark:text-green-400" />
                {searchQuery.trim() !== ''
                  ? `نتائج البحث في كل الشهور (${filteredIncomes.length})`
                  : selectedMonth === 'all'
                    ? `كل الدخل (${filteredIncomes.length})`
                    : `دخل ${formatYearMonth(selectedMonth)} (${filteredIncomes.length})`}
              </CardTitle>
              {filteredIncomes.length > 0 && (
                <Badge variant="secondary" className="text-xs text-green-700 dark:text-green-400">
                  <bdi>{formatCurrency(totalIncomeFiltered)}</bdi>
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {filteredIncomes.length === 0 ? (
              <div className="px-6 py-16 text-center text-muted-foreground">
                <HandCoins className="mx-auto h-12 w-12 mb-4 opacity-30" />
                {searchQuery.trim() !== '' ? (
                  <>
                    <h3 className="text-base font-semibold">لا توجد نتائج</h3>
                    <p className="text-sm mt-1">جرب تغيير كلمة البحث</p>
                  </>
                ) : oneTimeIncomes.length > 0 ? (
                  <>
                    <h3 className="text-base font-semibold">لا يوجد دخل مسجَّل في هذا الشهر</h3>
                    <Button variant="outline" size="sm" className="mt-4" onClick={() => setSelectedMonth('all')}>عرض كل الشهور</Button>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-semibold">لا يوجد دخل مسجَّل</h3>
                    <Link href="/add-expense?mode=income">
                      <Button size="sm" className="mt-4 gap-2"><Plus className="h-4 w-4" />تسجيل دخل</Button>
                    </Link>
                  </>
                )}
              </div>
            ) : (
              <>
                <ul className="divide-y divide-border">
                  {filteredIncomes.slice(0, visibleCount).map(inc => (
                    <IncomeRow key={inc.id} income={inc} density="page" />
                  ))}
                </ul>
                {filteredIncomes.length > visibleCount && (
                  <div className="p-3 border-t text-center">
                    <Button variant="ghost" size="sm" className="text-xs text-primary w-full h-9" onClick={() => setVisibleCount(c => c + 50)}>
                      تحميل المزيد ({filteredIncomes.length - visibleCount} متبقٍ)
                    </Button>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
