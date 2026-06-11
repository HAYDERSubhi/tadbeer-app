// src/lib/duplicate-check.ts
// Central duplicate-expense detection, used by all entry forms BEFORE saving.
// Policy (user decision): a duplicate = same amount + same category +
// same normalized title + same calendar day.

import { isSameDay, parseISO } from 'date-fns';
import type { Expense } from '@/types';

/** Normalize an Arabic/Latin title for comparison: trim, collapse spaces, lowercase. */
function normalizeTitle(title: string): string {
  return (title || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

export interface ExpenseCandidate {
  title: string;
  amount: number;
  category: string;
  /** ISO string or Date */
  date: string | Date;
}

/**
 * Returns the first existing expense that matches the candidate
 * (amount + category + normalized title + same calendar day), or null.
 * Temp optimistic entries (id starting with "temp-") are ignored.
 */
export function findDuplicateExpense(
  existing: Expense[],
  candidate: ExpenseCandidate
): Expense | null {
  const candidateDate = typeof candidate.date === 'string' ? parseISO(candidate.date) : candidate.date;
  const candidateTitle = normalizeTitle(candidate.title);

  for (const e of existing) {
    if (e.id?.startsWith('temp-')) continue;
    if (e.amount !== candidate.amount) continue;
    if (e.category !== candidate.category) continue;
    if (normalizeTitle(e.title) !== candidateTitle) continue;
    try {
      if (isSameDay(parseISO(e.date), candidateDate)) return e;
    } catch {
      // unparsable stored date — not comparable, skip
    }
  }
  return null;
}
