"use client";

// صفّ دخلٍ مسجَّل — يُستعمل في «آخر الحركات» بالرئيسية (density="home") وفي شاشة المصاريف عند
// ترشيح «دخل» (density="page"). التعديل والحذف هنا مرّة واحدة كي لا يتكرّرا في الشاشتين.
//
// ⛔ بلا علامة «+» عمداً (قرار المالك 2026-11-14): «500,000+» تُقرأ «نصف مليون فأكثر». يتميّز الدخل
// بوسم «دخل» + أيقونة + اللون الأخضر، والمصاريف بلا أي علامة.
// الحذف والتعديل يعملان بلا إنترنت: وعد Firestore لا يُحسم دون الخادم، فلا ننتظره (نفس منطق شاشة المصروف).
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { HandCoins, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { IncomeEntryForm } from '@/components/expenses/income-entry-form';
import { arIQ } from '@/lib/arabic-date';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { deleteIncome } from '@/services/firestore';
import type { Income } from '@/types';

export function IncomeRow({ income, density = 'home' }: { income: Income; density?: 'home' | 'page' }) {
  const { user } = useAuth();
  const { householdId } = useAppData();
  const { format: formatCurrency } = useCurrency();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const EditComponent = isMobile ? Sheet : Dialog;
  const isPage = density === 'page';

  const dateLabel = (() => {
    try { return format(parseISO(income.date), 'd MMM', { locale: arIQ }); } catch { return ''; }
  })();

  const handleDelete = async () => {
    if (!user) return;
    const key = ['incomes', user.uid, householdId];
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['incomes', user.uid] });
    // يُزال من الذاكرة فوراً ليختفي الصفّ، ثم يُصحَّح عند الخادم.
    queryClient.setQueryData<Income[]>(key, old => (old ? old.filter(i => i.id !== income.id) : old));
    const request = deleteIncome(user.uid, income.id, householdId, income.scope);

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      request.then(refresh).catch(() => {});
      toast({ title: 'تم الحذف', description: 'تم حذف الدخل.' });
      return;
    }
    try {
      await request;
      refresh();
      toast({ title: 'تم الحذف', description: 'تم حذف الدخل.' });
    } catch {
      refresh(); // يعيد الصفّ إن لم يُحذف فعلاً
      toast({ title: 'خطأ', description: 'لم نتمكن من حذف الدخل.', variant: 'destructive' });
    }
  };

  return (
    <>
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-1">
              <Trash2 className="h-5 w-5 text-destructive" />
            </div>
            <AlertDialogTitle>حذف الدخل</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف <span className="font-medium text-foreground">«{income.title}»</span> نهائياً
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              حذف
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <li className={cn('flex items-center rounded-lg transition-colors', isPage ? 'p-3 hover:bg-muted/50' : 'p-2 hover:bg-muted/50')}>
        <div className="flex flex-1 items-center gap-3 min-w-0">
          <span
            className={cn(
              'flex shrink-0 items-center justify-center text-green-600 dark:text-green-400',
              isPage && 'h-9 w-9 rounded-md border bg-green-500/10',
            )}
          >
            <HandCoins className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <p className="font-semibold truncate text-xs">{income.title}</p>
              <span className="shrink-0 rounded-full bg-green-500/10 px-2 text-xs font-semibold text-green-700 dark:text-green-400">
                دخل
              </span>
            </div>
            {isPage && dateLabel && <p className="text-xs text-muted-foreground">{dateLabel}</p>}
          </div>
        </div>

        <div className={cn('flex items-center', isPage ? 'gap-1' : 'gap-2')}>
          <p className={cn('font-bold text-green-600 dark:text-green-400', isPage ? 'text-xs me-2' : 'text-sm')}>
            <bdi>{formatCurrency(income.amount)}</bdi>
          </p>
          <EditComponent open={isEditOpen} onOpenChange={setIsEditOpen}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className={cn('shrink-0', isPage ? 'h-10 w-10' : 'h-8 w-8')} aria-label="خيارات الدخل">
                  <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setIsEditOpen(true)}>
                  <Pencil className="me-2 h-4 w-4" /> تعديل
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => setIsDeleteOpen(true)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="me-2 h-4 w-4" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {isMobile ? (
              <SheetContent side="bottom" className="flex flex-col">
                <SheetHeader><SheetTitle>تعديل الدخل</SheetTitle></SheetHeader>
                <div className="overflow-y-auto px-2 pb-6">
                  {isEditOpen && <IncomeEntryForm income={income} onDone={() => setIsEditOpen(false)} />}
                </div>
              </SheetContent>
            ) : (
              <DialogContent>
                <DialogHeader><DialogTitle>تعديل الدخل</DialogTitle></DialogHeader>
                {isEditOpen && <IncomeEntryForm income={income} onDone={() => setIsEditOpen(false)} />}
              </DialogContent>
            )}
          </EditComponent>
        </div>
      </li>
    </>
  );
}
