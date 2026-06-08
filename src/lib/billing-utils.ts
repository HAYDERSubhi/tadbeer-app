// src/lib/billing-utils.ts
// Shared utility for computing next due dates for recurring payments.

import { addMonths, addQuarters, addYears, startOfDay, isBefore } from 'date-fns';
import type { RecurringPayment } from '@/types';

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
