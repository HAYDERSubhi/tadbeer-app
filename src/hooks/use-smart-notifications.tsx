// src/hooks/use-smart-notifications.tsx
"use client";

/**
 * Smart notifications hook.
 * Triggers browser notifications for:
 *  1. Budget exceeded (checked after any expense mutation)
 *  2. Daily reminder if user hasn't opened the app in > 20 hours
 *  3. Monthly summary on the 1st of each month
 */

import { useEffect, useCallback } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { useZeroStreak } from '@/hooks/use-zero-streak';
import { isThisMonth, parseISO, differenceInHours, format } from 'date-fns';
import { getUpcomingPayments } from '@/lib/billing-utils';

const LAST_REMINDER_KEY = 'tadbeer-last-reminder';
const LAST_MONTHLY_KEY = 'tadbeer-last-monthly';

function formatNum(n: number) {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

async function requestPermission(): Promise<boolean> {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  const result = await Notification.requestPermission();
  return result === 'granted';
}

function sendNotification(title: string, body: string, icon = '/icon-192x192.png') {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    new Notification(title, { body, icon, dir: 'rtl', lang: 'ar' });
  } catch {
    // some browsers block new Notification() in service worker context
  }
}

export function useSmartNotifications() {
  const { expenses, userSettings } = useAppData();
  const { streak, spentToday } = useZeroStreak();

  /* ── Request permission once on mount ── */
  useEffect(() => {
    if (!userSettings?.notifications?.dailyReminderEnabled) return;
    requestPermission();
  }, [userSettings?.notifications?.dailyReminderEnabled]);

  /* ── Daily reminder: if app opened after 20h silence ── */
  useEffect(() => {
    if (!userSettings?.notifications?.dailyReminderEnabled) return;
    if (typeof window === 'undefined') return;

    const lastStr = localStorage.getItem(LAST_REMINDER_KEY);
    const now = new Date();

    if (lastStr) {
      const last = new Date(lastStr);
      if (differenceInHours(now, last) < 20) return;
    }

    // Check if there's any expense today
    const todayStr = format(now, 'yyyy-MM-dd');
    const hasTodayExpense = expenses.some(e => e.date.startsWith(todayStr));

    if (!hasTodayExpense) {
      requestPermission().then(granted => {
        if (granted) {
          sendNotification(
            '📝 تذكير يومي — تدبير',
            'لم تسجّل أي مصروف اليوم. خذ دقيقة لتتبع إنفاقك!'
          );
          localStorage.setItem(LAST_REMINDER_KEY, now.toISOString());
        }
      });
    } else {
      localStorage.setItem(LAST_REMINDER_KEY, now.toISOString());
    }
  }, [expenses, userSettings?.notifications?.dailyReminderEnabled]);

  /* ── Monthly summary: first day of month ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const now = new Date();
    if (now.getDate() !== 1) return;

    const monthKey = format(now, 'yyyy-MM');
    const lastMonthly = localStorage.getItem(LAST_MONTHLY_KEY);
    if (lastMonthly === monthKey) return;

    // Calculate last month's total
    const lastMonthExpenses = expenses.filter(e => {
      try {
        const d = parseISO(e.date);
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return d >= start && d <= end;
      } catch { return false; }
    });

    if (lastMonthExpenses.length === 0) return;

    const total = lastMonthExpenses.reduce((s, e) => s + e.amount, 0);
    const budget = userSettings?.budget?.totalBudget;

    requestPermission().then(granted => {
      if (granted) {
        const budgetMsg = budget
          ? ` (${Math.round((total / budget) * 100)}% من ميزانيتك)`
          : '';
        sendNotification(
          '📊 ملخص الشهر الماضي — تدبير',
          `أنفقت ${formatNum(total)} د.ع${budgetMsg}. شهر جديد، بداية جديدة! 💪`
        );
        localStorage.setItem(LAST_MONTHLY_KEY, monthKey);
      }
    });
  }, [expenses, userSettings]);

  /* ── Budget exceeded: check after expenses change ── */
  const checkBudgetAlert = useCallback(() => {
    const budget = userSettings?.budget?.totalBudget;
    if (!budget) return;

    const thisMonthTotal = expenses
      .filter(e => { try { return isThisMonth(parseISO(e.date)); } catch { return false; } })
      .reduce((s, e) => s + e.amount, 0);

    const pct = (thisMonthTotal / budget) * 100;

    // Alert at exactly crossing 90%
    const alertKey = `tadbeer-budget-alert-${format(new Date(), 'yyyy-MM')}`;
    const alerted = localStorage.getItem(alertKey);

    if (pct >= 90 && !alerted) {
      requestPermission().then(granted => {
        if (granted) {
          const remaining = budget - thisMonthTotal;
          sendNotification(
            '⚠️ تنبيه ميزانية — تدبير',
            remaining > 0
              ? `استهلكت ${Math.round(pct)}% من ميزانيتك. تبقى ${formatNum(remaining)} د.ع فقط.`
              : `تجاوزت ميزانيتك هذا الشهر بمقدار ${formatNum(Math.abs(remaining))} د.ع!`
          );
          localStorage.setItem(alertKey, '1');
        }
      });
    }
  }, [expenses, userSettings]);

  useEffect(() => {
    checkBudgetAlert();
  }, [checkBudgetAlert]);

  /* ── Bill reminders: notify 3 days before due date ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const payments = userSettings?.recurringPayments ?? [];
    const upcoming = getUpcomingPayments(payments, 3); // within 3 days
    if (upcoming.length === 0) return;

    const today = format(new Date(), 'yyyy-MM-dd');

    upcoming.forEach(({ payment, daysUntilDue }) => {
      // Fire once per payment per cycle (key includes payment id + due date)
      const key = `tadbeer-bill-notif-${payment.id}-${today}`;
      if (localStorage.getItem(key)) return;

      requestPermission().then(granted => {
        if (!granted) return;
        const whenMsg =
          daysUntilDue === 0 ? 'اليوم!' :
          daysUntilDue === 1 ? 'غداً' :
          `بعد ${daysUntilDue} أيام`;

        sendNotification(
          `🔔 فاتورة قادمة — ${payment.title}`,
          `موعد دفع ${formatNum(payment.amount)} د.ع ${whenMsg}`
        );
        localStorage.setItem(key, '1');
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userSettings?.recurringPayments]);

  /* ── Zero-spend streak: evening encouragement ── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (spentToday || streak === 0) return;

    // Only fire between 6 PM and 11 PM
    const hour = new Date().getHours();
    if (hour < 18 || hour >= 23) return;

    const streakKey = `tadbeer-streak-notif-${format(new Date(), 'yyyy-MM-dd')}`;
    if (localStorage.getItem(streakKey)) return;

    requestPermission().then(granted => {
      if (!granted) return;
      const msgs: Record<number, string> = {
        1: 'يوم صفري أول! 🎯 أتمم اليوم بدون مصاريف.',
        3: '3 أيام صفرية متتالية! 🔥 أنت رائع!',
        7: 'أسبوع كامل بدون إنفاق! 🏆 إنجاز استثنائي!',
      };
      const body = msgs[streak] ?? `🔥 ${streak} أيام صفرية — أتمم اليوم وحافظ على streak!`;
      sendNotification('تدبير — اليوم الصفري', body);
      localStorage.setItem(streakKey, '1');
    });
  }, [streak, spentToday]);
}
