// src/hooks/use-zero-streak.tsx
"use client";

import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { format, differenceInCalendarDays, parseISO } from 'date-fns';

export type ZeroStreakResult = {
  /** Consecutive COMPLETED zero-spend days, counted backwards from yesterday.
      Today is never included — a day only counts once it has fully ended. */
  streak: number;
  spentToday: boolean;     // did user log any expense today (local time)?
  lastExpenseDate: string | null; // local yyyy-MM-dd of most recent expense
};

export function useZeroStreak(): ZeroStreakResult {
  const { expenses } = useAppData();

  return useMemo(() => {
    if (expenses.length === 0) {
      return { streak: 0, spentToday: false, lastExpenseDate: null };
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Build set of unique LOCAL dates that have at least one expense.
    // parseISO + format converts the stored UTC instant to the user's local
    // day — slicing the raw ISO string would shift expenses entered between
    // midnight and ~3am (Baghdad UTC+3) to the previous day, making the card
    // celebrate a "zero day" while today's list clearly shows spending.
    const expenseDateSet = new Set(
      expenses.map(e => {
        try { return format(parseISO(e.date), 'yyyy-MM-dd'); } catch { return ''; }
      }).filter(Boolean)
    );

    const spentToday = expenseDateSet.has(todayStr);

    // Find the most recent expense date
    const sortedDates = [...expenseDateSet].sort().reverse();
    const lastExpenseDate = sortedDates[0] ?? null;

    // Count consecutive zero-spend days going backwards from YESTERDAY.
    // Today is still in progress and must not be counted or celebrated —
    // only fully completed days qualify.
    let streak = 0;
    const cur = new Date(today);
    cur.setDate(cur.getDate() - 1); // start at yesterday

    while (true) {
      const key = format(cur, 'yyyy-MM-dd');
      if (expenseDateSet.has(key)) break; // hit a spend day — stop
      streak++;
      cur.setDate(cur.getDate() - 1);
      // Safety: don't go back more than 365 days
      if (differenceInCalendarDays(today, cur) > 365) break;
    }

    return { streak, spentToday, lastExpenseDate };
  }, [expenses]);
}
