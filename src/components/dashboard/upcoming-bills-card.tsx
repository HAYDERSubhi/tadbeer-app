"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bell, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';
import { getUpcomingPayments } from '@/lib/billing-utils';
import { format } from 'date-fns';
import { arIQ } from '@/lib/arabic-date';

export function UpcomingBillsCard() {
  const { userSettings } = useAppData();
  const { categoryMap } = useCategories();
  const { format: formatCurrency } = useCurrency();

  const upcoming = useMemo(() => {
    const payments = userSettings?.recurringPayments ?? [];
    return getUpcomingPayments(payments, 7);
  }, [userSettings?.recurringPayments]);

  if (upcoming.length === 0) return null;

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
        {upcoming.map(({ payment, dueDate, daysUntilDue }) => {
          const { label, cls } = urgencyLabel(daysUntilDue);
          const catName = categoryMap[payment.category]?.name ?? payment.category;
          const catIcon = categoryMap[payment.category]?.icon ?? '💸';

          return (
            <div
              key={payment.id}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2 transition-colors',
                urgencyBorder(daysUntilDue)
              )}
            >
              <span className="text-xl shrink-0">{catIcon}</span>
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
          );
        })}
      </CardContent>
    </Card>
  );
}
