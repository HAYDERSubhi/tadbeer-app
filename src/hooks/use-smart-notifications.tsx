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
import { isThisMonth, parseISO, differenceInHours, format } from 'date-fns';

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
}
