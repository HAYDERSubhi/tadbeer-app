"use client";

/**
 * use-notifications-feed
 * يولّد قائمة إشعارات حية من البيانات الموجودة — بدون Firestore إضافي.
 * المصادر: ميزانية · فواتير · أوسمة · أهداف · سلسلة صفرية
 */

import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { getUserBadges } from '@/services/firestore';
import { getBadgeDef } from '@/lib/badges';
import { getUpcomingPayments } from '@/lib/billing-utils';
import { isThisMonth, parseISO, format, differenceInDays } from 'date-fns';

export type NotifType = 'budget' | 'bill' | 'badge' | 'goal' | 'streak';

export interface AppNotification {
  id: string;
  type: NotifType;
  title: string;
  body: string;
  date: Date;
  href: string;
  isNew: boolean;
}

const SEEN_KEY = 'tadbeer-notif-seen-at';

function fmt(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

function getSeenAt(): Date {
  try {
    const v = localStorage.getItem(SEEN_KEY);
    return v ? new Date(v) : new Date(0);
  } catch { return new Date(0); }
}

export function markNotificationsSeen() {
  try { localStorage.setItem(SEEN_KEY, new Date().toISOString()); } catch {}
}

export function useNotificationsFeed(): { notifications: AppNotification[]; unreadCount: number } {
  const { user } = useAuth();
  const { expenses, goals, userSettings } = useAppData();

  const { data: earnedBadges = [] } = useQuery({
    queryKey: ['badges', user?.uid],
    queryFn: () => getUserBadges(user!.uid),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const notifications = useMemo<AppNotification[]>(() => {
    const seenAt = getSeenAt();
    const now = new Date();
    const items: AppNotification[] = [];

    /* ── ١. تنبيه الميزانية ─────────────────────────────── */
    const budget = userSettings?.budget?.totalBudget;
    if (budget && budget > 0) {
      const monthTotal = expenses
        .filter(e => { try { return isThisMonth(parseISO(e.date)); } catch { return false; } })
        .reduce((s, e) => s + e.amount, 0);
      const pct = Math.round((monthTotal / budget) * 100);

      if (pct >= 90) {
        const remaining = budget - monthTotal;
        const date = now;
        items.push({
          id: `budget-${format(now, 'yyyy-MM')}`,
          type: 'budget',
          title: pct >= 100 ? 'تجاوزت ميزانية الشهر ⚠️' : `استهلكت ${pct}% من ميزانيتك`,
          body: remaining > 0
            ? `تبقّى ${fmt(remaining)} د.ع فقط من ميزانية ${format(now, 'MMMM')}`
            : `تجاوزت الميزانية بمقدار ${fmt(Math.abs(remaining))} د.ع`,
          date,
          href: '/',
          isNew: date > seenAt,
        });
      }
    }

    /* ── ٢. الفواتير القادمة (خلال 7 أيام) ─────────────── */
    const payments = userSettings?.recurringPayments ?? [];
    const upcoming = getUpcomingPayments(payments, 7);
    upcoming.forEach(({ payment, daysUntilDue }) => {
      const date = new Date(now);
      date.setDate(date.getDate() - Math.max(0, 1 - daysUntilDue));
      const whenMsg =
        daysUntilDue === 0 ? 'اليوم!' :
        daysUntilDue === 1 ? 'غداً' :
        `بعد ${daysUntilDue} أيام`;
      items.push({
        id: `bill-${payment.id}-${format(now, 'yyyy-MM')}`,
        type: 'bill',
        title: `فاتورة قادمة — ${payment.title}`,
        body: `${fmt(payment.amount)} د.ع — موعد الدفع ${whenMsg}`,
        date,
        href: '/',
        isNew: date > seenAt,
      });
    });

    /* ── ٣. الأوسمة المكتسبة ────────────────────────────── */
    earnedBadges.forEach((b: any) => {
      const def = getBadgeDef(b.badgeId);
      if (!def) return;
      const date = b.earnedAt?.toDate ? b.earnedAt.toDate() : new Date(b.earnedAt ?? now);
      items.push({
        id: `badge-${b.badgeId}`,
        type: 'badge',
        title: `وسام جديد — ${def.name} ${def.icon}`,
        body: def.description,
        date,
        href: '/achievements',
        isNew: date > seenAt,
      });
    });

    /* ── ٤. الأهداف (اكتملت أو اقتربت 80%+) ───────────── */
    goals.forEach(g => {
      if (!g.targetAmount || g.targetAmount <= 0) return;
      const saved = g.savedAmount ?? 0;
      const pct = Math.round((saved / g.targetAmount) * 100);
      if (pct < 80) return;

      const date = now;
      const done = pct >= 100;
      items.push({
        id: `goal-${g.id}`,
        type: 'goal',
        title: done ? `اكتمل هدف "${g.name}" 🎉` : `هدفك "${g.name}" اقترب!`,
        body: done
          ? `وصلت إلى ${fmt(g.targetAmount)} د.ع — أحسنت!`
          : `وصلت ${pct}% من ${fmt(g.targetAmount)} د.ع`,
        date,
        href: '/planner',
        isNew: date > seenAt,
      });
    });

    /* ── ترتيب: الأحدث أولاً ────────────────────────────── */
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [expenses, goals, userSettings, earnedBadges]);

  const unreadCount = notifications.filter(n => n.isNew).length;

  return { notifications, unreadCount };
}
