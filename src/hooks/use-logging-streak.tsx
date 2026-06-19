// src/hooks/use-logging-streak.tsx
"use client";

import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { format, differenceInCalendarDays, parseISO, subDays } from 'date-fns';

export type LoggingStreakResult = {
  /** Consecutive days (including today) where the user logged at least one expense */
  streak: number;
  /** Did the user log any expense today? */
  loggedToday: boolean;
  /** Yesterday was logged (streak is alive even if today not yet logged) */
  loggedYesterday: boolean;
};

export function useLoggingStreak(): LoggingStreakResult {
  const { expenses } = useAppData();

  return useMemo(() => {
    if (expenses.length === 0) {
      return { streak: 0, loggedToday: false, loggedYesterday: false };
    }

    const today = new Date();
    const todayStr = format(today, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');

    const expenseDateSet = new Set(
      expenses.map(e => {
        try { return format(parseISO(e.date), 'yyyy-MM-dd'); } catch { return ''; }
      }).filter(Boolean)
    );

    const loggedToday = expenseDateSet.has(todayStr);
    const loggedYesterday = expenseDateSet.has(yesterdayStr);

    // Count consecutive days backwards from today
    let streak = 0;
    const cur = new Date(today);

    while (true) {
      const key = format(cur, 'yyyy-MM-dd');
      if (!expenseDateSet.has(key)) break;
      streak++;
      cur.setDate(cur.getDate() - 1);
      if (differenceInCalendarDays(today, cur) > 365) break;
    }

    return { streak, loggedToday, loggedYesterday };
  }, [expenses]);
}
