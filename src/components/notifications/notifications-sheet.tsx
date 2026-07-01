"use client";

import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Bell, TrendingUp, CreditCard, Trophy, Target, Flame, BellOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AppNotification, NotifType } from '@/hooks/use-notifications-feed';

/* ── أيقونة + لون حسب النوع ──────────────────────────── */
const TYPE_CONFIG: Record<NotifType, {
  Icon: React.ComponentType<{ className?: string }>;
  bg: string;
  iconColor: string;
}> = {
  budget:  { Icon: TrendingUp,  bg: 'bg-orange-100 dark:bg-orange-900/30',  iconColor: 'text-orange-500' },
  bill:    { Icon: CreditCard,  bg: 'bg-blue-100   dark:bg-blue-900/30',    iconColor: 'text-blue-500'   },
  badge:   { Icon: Trophy,      bg: 'bg-amber-100  dark:bg-amber-900/30',   iconColor: 'text-amber-500'  },
  goal:    { Icon: Target,      bg: 'bg-emerald-100 dark:bg-emerald-900/30', iconColor: 'text-emerald-500'},
  streak:  { Icon: Flame,       bg: 'bg-red-100    dark:bg-red-900/30',     iconColor: 'text-red-500'    },
};

/* ── تاريخ نسبي عربي ──────────────────────────────────── */
function relativeDate(date: Date): string {
  try {
    return formatDistanceToNow(date, { addSuffix: true, locale: ar });
  } catch {
    return '';
  }
}

/* ── بطاقة إشعار واحدة ────────────────────────────────── */
function NotifCard({ notif, onNavigate }: { notif: AppNotification; onNavigate: (href: string) => void }) {
  const cfg = TYPE_CONFIG[notif.type];
  const { Icon } = cfg;

  return (
    <button
      onClick={() => onNavigate(notif.href)}
      className={cn(
        'w-full flex items-start gap-3 px-4 py-3.5 text-right transition-colors active:bg-muted/60',
        notif.isNew ? 'bg-primary/5' : 'bg-transparent',
      )}
    >
      {/* أيقونة النوع */}
      <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5', cfg.bg)}>
        <Icon className={cn('h-5 w-5', cfg.iconColor)} />
      </div>

      {/* النص */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm leading-snug', notif.isNew ? 'font-semibold text-foreground' : 'font-medium text-foreground/90')}>
          {notif.title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{notif.body}</p>
        <p className="text-[11px] text-muted-foreground/60 mt-1">{relativeDate(notif.date)}</p>
      </div>

      {/* نقطة "جديد" */}
      {notif.isNew && (
        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
      )}
    </button>
  );
}

/* ── المكوّن الرئيسي ──────────────────────────────────── */
interface NotificationsSheetProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  notifications: AppNotification[];
}

export function NotificationsSheet({ open, onOpenChange, notifications }: NotificationsSheetProps) {
  const router = useRouter();

  const handleNavigate = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="top"
        className="rounded-b-2xl px-0 pt-0 max-h-[85dvh] flex flex-col"
      >
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <SheetTitle className="text-lg font-bold">الإشعارات</SheetTitle>
            {notifications.some(n => n.isNew) && (
              <span className="mr-auto text-xs text-primary font-medium">
                {notifications.filter(n => n.isNew).length} جديد
              </span>
            )}
          </div>
        </SheetHeader>

        {/* القائمة */}
        <ScrollArea className="flex-1">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
                <BellOff className="h-7 w-7 text-muted-foreground" />
              </div>
              <p className="text-base font-semibold text-foreground">لا توجد إشعارات</p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                ستظهر هنا تنبيهات الميزانية والفواتير والأوسمة وأهدافك المالية
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {notifications.map(n => (
                <NotifCard key={n.id} notif={n} onNavigate={handleNavigate} />
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
