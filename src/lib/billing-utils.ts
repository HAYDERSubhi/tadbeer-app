// src/lib/billing-utils.ts
// Shared utility for computing next due dates for recurring payments.

import {
  addMonths, addQuarters, addYears,
  subMonths, subQuarters, subYears,
  startOfDay, endOfDay, isBefore, isWithinInterval, parseISO,
} from 'date-fns';
import type { RecurringPayment, Expense } from '@/types';

/**
 * Given a recurring payment, returns its next due Date (today or in the future).
 * Returns null for one-time payments that are already past.
 */
export function getNextDueDate(payment: RecurringPayment): Date | null {
  const start = startOfDay(new Date(payment.startDate));
  const today = startOfDay(new Date());

  if (payment.frequency === 'one-time') {
    return isBefore(start, today) ? null : start;
  }

  let next = new Date(start);

  // Advance until next >= today
  const maxIterations = 200;
  let i = 0;
  while (isBefore(next, today) && i < maxIterations) {
    if (payment.frequency === 'monthly') {
      next = addMonths(next, 1);
    } else if (payment.frequency === 'quarterly') {
      next = addQuarters(next, 1);
    } else if (payment.frequency === 'annually') {
      next = addYears(next, 1);
    } else {
      break;
    }
    i++;
  }

  return next;
}

/**
 * Returns upcoming payments sorted by due date (soonest first),
 * filtered to those due within `withinDays` days from today.
 */
export function getUpcomingPayments(
  payments: RecurringPayment[],
  withinDays = 7
): Array<{ payment: RecurringPayment; dueDate: Date; daysUntilDue: number }> {
  const today = startOfDay(new Date());
  const cutoff = addDays(today, withinDays);

  const result: Array<{ payment: RecurringPayment; dueDate: Date; daysUntilDue: number }> = [];

  for (const p of payments) {
    const dueDate = getNextDueDate(p);
    if (!dueDate) continue;
    if (isBefore(cutoff, dueDate)) continue; // beyond window
    const daysUntilDue = Math.round((dueDate.getTime() - today.getTime()) / 86400000);
    result.push({ payment: p, dueDate, daysUntilDue });
  }

  return result.sort((a, b) => a.daysUntilDue - b.daysUntilDue);
}

// Helper because addDays from date-fns needs to be imported here too
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/** Normalize a title for comparison: trim, collapse spaces, lowercase. */
function normalizeTitle(title: string): string {
  return (title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * Returns true if an expense matching this recurring payment (same normalized
 * title + amount + category) was already logged within the payment's current
 * billing cycle — i.e. the window [previous occurrence, next due date].
 *
 * Used to decide whether the "تم الدفع" action is still available or the bill
 * is already marked paid for this cycle. No schema change: the source of truth
 * is the expenses list itself.
 */
export function isBillPaidThisCycle(
  payment: RecurringPayment,
  expenses: Expense[]
): boolean {
  const nextDue = getNextDueDate(payment);
  if (!nextDue) return false;

  // Window = (midpoint between the previous and next due dates, next due date].
  // Starting at the midpoint (not a full interval back) cleanly separates one
  // cycle from the next, so last cycle's payment can never satisfy this one,
  // while still tolerating an early payment well before the due date.
  // For one-time bills the window is open-ended in the past.
  let cycleStart: Date;
  if (payment.frequency === 'one-time') {
    cycleStart = new Date(0);
  } else {
    let prevDue: Date;
    if (payment.frequency === 'monthly') {
      prevDue = subMonths(nextDue, 1);
    } else if (payment.frequency === 'quarterly') {
      prevDue = subQuarters(nextDue, 1);
    } else if (payment.frequency === 'annually') {
      prevDue = subYears(nextDue, 1);
    } else {
      return false;
    }
    cycleStart = new Date((prevDue.getTime() + nextDue.getTime()) / 2);
  }

  const start = startOfDay(cycleStart);
  const end = endOfDay(nextDue);
  const title = normalizeTitle(payment.title);

  return expenses.some(exp => {
    if (exp.amount !== payment.amount) return false;
    if (exp.category !== payment.category) return false;
    if (normalizeTitle(exp.title) !== title) return false;
    try {
      return isWithinInterval(parseISO(exp.date), { start, end });
    } catch {
      return false;
    }
  });
}
