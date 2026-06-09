// src/lib/arabic-date.ts
// Custom date-fns locale that extends the standard Arabic locale (ar) with
// Levantine/Iraqi month names used in Iraq, Syria, Lebanon, and Jordan.
//
// Standard Arabic (Egyptian):  يناير فبراير مارس أبريل مايو يونيو ...
// Iraqi/Levantine (this file):  كانون الثاني شباط آذار نيسان أيار حزيران ...

import { ar } from 'date-fns/locale';
import type { Locale } from 'date-fns';

// Full month names (Levantine/Iraqi)
export const IRAQI_MONTHS_FULL = [
  'كانون الثاني', // January
  'شباط',         // February
  'آذار',          // March
  'نيسان',         // April
  'أيار',          // May
  'حزيران',        // June
  'تموز',          // July
  'آب',            // August
  'أيلول',         // September
  'تشرين الأول',  // October
  'تشرين الثاني', // November
  'كانون الأول',  // December
] as const;

// Abbreviated month names (used in short charts and labels)
export const IRAQI_MONTHS_SHORT = [
  'كانون ث', // January
  'شباط',    // February
  'آذار',     // March
  'نيسان',    // April
  'أيار',     // May
  'حزيران',   // June
  'تموز',     // July
  'آب',       // August
  'أيلول',    // September
  'تشرين أ',  // October
  'تشرين ث',  // November
  'كانون أ',  // December
] as const;

// ── Custom date-fns locale ────────────────────────────────────────────────────
// Extends the base `ar` locale, replacing only the month localization so
// ALL format() calls that use this locale (including PPP, MMMM, MMM, LLL, etc.)
// automatically produce Iraqi month names.

export const arIQ: Locale = {
  ...ar,
  localize: {
    ...ar.localize,
    month: (monthIndex: number, options?: { width?: string; context?: string }): string => {
      const width = options?.width;
      if (width === 'abbreviated' || width === 'short' || width === 'narrow') {
        return IRAQI_MONTHS_SHORT[monthIndex] ?? IRAQI_MONTHS_FULL[monthIndex];
      }
      return IRAQI_MONTHS_FULL[monthIndex];
    },
  },
};

// ── Helper utilities ──────────────────────────────────────────────────────────

/** Returns the full Iraqi month name for a 0-based month index (0 = January). */
export function getIraqiMonthName(monthIndex: number): string {
  return IRAQI_MONTHS_FULL[monthIndex] ?? '';
}

/** Returns the abbreviated Iraqi month name for a 0-based month index. */
export function getIraqiMonthShort(monthIndex: number): string {
  return IRAQI_MONTHS_SHORT[monthIndex] ?? '';
}

/**
 * Formats a yyyy-MM string (e.g. "2025-06") into a display label.
 * Returns e.g. "حزيران 2025".
 */
export function formatYearMonth(yearMonth: string): string {
  try {
    const [year, month] = yearMonth.split('-').map(Number);
    return `${IRAQI_MONTHS_FULL[month - 1]} ${year}`;
  } catch {
    return yearMonth;
  }
}
