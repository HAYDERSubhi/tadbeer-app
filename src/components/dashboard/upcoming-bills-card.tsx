"use client";

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, ChevronDown, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useAuth } from '@/hooks/use-auth';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';
import { useToast } from '@/hooks/use-toast';
import { useMutation } from '@tanstack/react-query';
import { addExpense } from '@/services/firestore';
import { getUpcomingPayments, isBillPaidThisCycle } from '@/lib/billing-utils';
import type { Expense, RecurringPayment } from '@/types';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';

const VISIBLE_COUNT = 2;

export function UpcomingBillsCard() {
  const { userSettings, expenses, householdId, queryClient } = useAppData();
  const { user } = useAuth();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();
  const { toast } = useToast();
  const [expanded, setExpanded] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    const payments = userSettings?.recurringPayments ?? [];
    return getUpcomingPayments(payments, 3);
  }, [userSettings?.recurringPayments]);

  // Same optimistic pattern as the manual add-expense form so the new expense
  // appears instantly (and flips the bill to "paid") before the server settles.
  const payMutation = useMutation({
    mutationFn: (newExpense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'uid'>) =>
      addExpense(user!.uid, newExpense, householdId),
    onMutate: async (newExpenseData) => {
      await queryClient.cancelQueries({ queryKey: ['expenses', user?.uid] });

      const prevRecent = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'recent']);
      const prevAll = queryClient.getQueryData<Expense[]>(['expenses', user?.uid, householdId, 'all']);

      const tempExpense: Expense = {
        ...newExpenseData,
        id: `temp-${Date.now()}`,
        uid: user!.uid,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (prevRecent) {
        queryClient.setQueryData<Expense[]>(['expenses', user?.uid, householdId, 'recent'], [tempExpense, ...prevRecent]);
      }
      if (prevAll) {
        queryClient.setQueryData<Expense[]>(['expenses', user?.uid, householdId, 'all'], [tempExpense, ...prevAll]);
      }
      return { prevRecent, prevAll };
    },
    onError: (_err, _vars, context) => {
      if (context?.prevRecent) {
        queryClient.setQueryData(['expenses', user?.uid, householdId, 'recent'], context.prevRecent);
      }
      if (context?.prevAll) {
        queryClient.setQueryData(['expenses', user?.uid, householdId, 'all'], context.prevAll);
      }
      toast({
        title: 'تعذّر تسجيل الدفعة',
        description: 'حدث خطأ أثناء الحفظ. يرجى التحقق من الاتصال والمحاولة مجدداً.',
        variant: 'destructive',
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: 'تم تسجيل الدفعة ✓',
        description: `سُجِّل "${variables.title}" كمصروف اليوم.`,
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses', user?.uid] });
      setPayingId(null);
    },
  });

  const handleMarkPaid = (payment: RecurringPayment) => {
    if (!user) return;
    setPayingId(payment.id);
    payMutation.mutate({
      title: payment.title,
      amount: payment.amount,
      category: payment.category,
      date: new Date().toISOString(),
    });
  };

  if (upcoming.length === 0) return null;

  const visible = expanded ? upcoming : upcoming.slice(0, VISIBLE_COUNT);
  const hiddenCount = upcoming.length - VISIBLE_COUNT;

  const urgencyLabel = (days: number) => {
    if (days === 0) return { label: 'اليوم!', cls: 'text-destructive font-bold' };
    if (days === 1) return { label: 'غداً', cls: 'text-orange-600 dark:text-orange-400 font-semibold' };
    return { label: `بعد ${days} أيام`, cls: 'text-amber-600 dark:text-amber-400' };
  };

  const urgencyBorder = (days: number) => {
    if (days === 0) return 'border-destructive/60 bg-destructive/5';
    if (days === 1) return 'border-orange-400/60 bg-orange-50/50 dark:bg-orange-950/20';
    return 'border-amber-300/50 bg-amber-50/30 dark:bg-amber-950/10';
  };

  return (
    <Card>
      <CardHeader className="py-3 pb-2">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          <Bell className="h-4 w-4 text-amber-500" />
          فواتير قادمة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {visible.map(({ payment, dueDate, daysUntilDue }) => {
          const { label, cls } = urgencyLabel(daysUntilDue);
          const catName = categoryMap[payment.category]?.name ?? payment.category;
          const paid = isBillPaidThisCycle(payment, expenses);
          const isThisPaying = payingId === payment.id && payMutation.isPending;

          return (
            <div
              key={payment.id}
              className={cn(
                'rounded-lg border transition-colors overflow-hidden',
                urgencyBorder(daysUntilDue)
              )}
            >
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-xs truncate">{payment.title}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {catName} · {format(dueDate, 'd MMM', { locale: arIQ })}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatCurrency(payment.amount)}</p>
                  <p className={cn('text-[10px]', cls)}>{label}</p>
                </div>
              </div>

              {paid ? (
                <div className="flex items-center justify-center gap-1.5 border-t border-border/40 py-2 text-xs font-semibold text-green-700 dark:text-green-400">
                  تم الدفع
                  <Check className="h-3.5 w-3.5" />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => handleMarkPaid(payment)}
                  disabled={isThisPaying}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-border/40 py-2.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5 active:bg-primary/10 disabled:opacity-50"
                >
                  {isThisPaying && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  تأكيد الدفع؟
                </button>
              )}
            </div>
          );
        })}

        {!expanded && hiddenCount > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="w-full flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1"
          >
            <ChevronDown className="h-3 w-3" />
            و{hiddenCount} فاتورة أخرى
          </button>
        )}
      </CardContent>
    </Card>
  );
}
