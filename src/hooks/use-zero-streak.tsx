// src/hooks/use-zero-streak.tsx
"use client";

import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { format, differenceInCalendarDays, parseISO, isToday } from 'date-fns';

export type ZeroStreakResult = {
  streak: number;          // consecutive zero-spend days (0 = spent today)
  spentToday: boolean;     // did user log any expense today?
  lastExpenseDate: string | null; // ISO date of most recent expense
};

export function useZeroStreak(): ZeroStreakResult {
  const { expenses } = useAppData();

  return useMemo(() => {
    if (expenses.length === 0) {
      return { streak: 0, spentToday: false, lastExpenseDate: null };
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');

    // Build set of unique dates that have at least one expense
    const expenseDateSet = new Set(
      expenses.map(e => {
        try { return e.date.slice(0, 10); } catch { return ''; }
      }).filter(Boolean)
    );

    const spentToday = expenseDateSet.has(todayStr);

    // Find the most recent expense date
    const sortedDates = [...expenseDateSet].sort().reverse();
    const lastExpenseDate = sortedDates[0] ?? null;

    if (spentToday) {
      return { streak: 0, spentToday: true, lastExpenseDate };
    }

    // Count consecutive zero-spend days going backwards from today
    let streak = 0;
    let cur = new Date(today);

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
