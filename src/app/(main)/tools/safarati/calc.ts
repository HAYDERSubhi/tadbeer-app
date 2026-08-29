// سفراتي — حسابات الأداة (نقية، بلا React وبلا استدعاءات شبكة).
// كل مقارنات التواريخ بالتوقيت المحلي لا UTC — تدبير عانى من هذا الخطأ سابقاً
// بسلاسل التسجيل (use-logging-streak / use-zero-streak).

import { differenceInCalendarDays } from 'date-fns';
import type { Expense, Trip, TripCategory, TripStatus, TripType } from '@/types';

// ── أرقام إنكليزية بفواصل: 1,420,000 (لا أرقام هندية) ──
export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * تحويل نص حقل <input type="date"> (yyyy-MM-dd) إلى تاريخ **محلي**.
 * new Date('2026-08-29') يُفسَّر UTC فيقفز يوماً للخلف بتوقيت بغداد — لذلك نبني
 * التاريخ من أجزائه صراحةً.
 */
export function localDateFromInput(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** الاتجاه المعاكس: تاريخ → نص حقل <input type="date"> بالتوقيت المحلي. */
export function inputValueFromDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * تاريخ ووقت لحقل <input type="datetime-local"> — بالتوقيت المحلي.
 * toISOString() ممنوع هنا: يحوّل إلى UTC فيظهر الوقت مزاحاً ثلاث ساعات ببغداد.
 */
export function localDateTimeInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** الاتجاه المعاكس — قيمة datetime-local بلا لاحقة Z تُفسَّر محلياً وهو المطلوب. */
export function localDateTimeFromInput(value: string): Date | null {
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** بداية اليوم محلياً — لمقارنات التواريخ بلا أثر للوقت. */
export function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

// ═══════════════ الحالة ═══════════════

/**
 * الحالة الفعلية للعرض:
 * - COMPLETED فقط بتأكيد المستخدم الصريح (محفوظة بالمستند) — لا تحدث تلقائياً
 *   بانقضاء endDate.
 * - ACTIVE من startDate وحتى الإغلاق، **حتى لو تجاوزت النهاية المخطَّطة**.
 * - PLANNED قبل startDate.
 */
export function effectiveStatus(trip: Trip, today: Date = new Date()): TripStatus {
  if (trip.status === 'COMPLETED') return 'COMPLETED';
  const start = startOfLocalDay(new Date(trip.startDate));
  return startOfLocalDay(today) < start ? 'PLANNED' : 'ACTIVE';
}

/** الحالة المبدئية عند الإنشاء. */
export function initialStatus(startDate: Date, today: Date = new Date()): TripStatus {
  return startOfLocalDay(today) < startOfLocalDay(startDate) ? 'PLANNED' : 'ACTIVE';
}

// ═══════════════ عدّاد الأيام والمبالغ ═══════════════

/** «اليوم X من Y» — X محصورة بين ١ و Y. */
export function dayCounter(trip: Trip, today: Date = new Date()): { current: number; total: number } {
  const start = startOfLocalDay(new Date(trip.startDate));
  const end = startOfLocalDay(new Date(trip.endDate));
  const total = Math.max(1, differenceInCalendarDays(end, start) + 1);
  const raw = differenceInCalendarDays(startOfLocalDay(today), start) + 1;
  return { current: Math.min(Math.max(raw, 1), total), total };
}

/**
 * عدد أيام السفرة الفعلي (لحساب المتوسط اليومي): من البداية إلى الإغلاق إن وُجد
 * وإلا اليوم. **لا يقل عن ١ أبداً** — سفرة أُغلقت بيوم بدايتها = يوم واحد لا صفر،
 * فلا قسمة على صفر بأي حال.
 */
export function actualTripDays(trip: Trip, today: Date = new Date()): number {
  const start = startOfLocalDay(new Date(trip.startDate));
  const endRef = startOfLocalDay(trip.closedAt ? new Date(trip.closedAt) : today);
  return Math.max(1, differenceInCalendarDays(endRef, start) + 1);
}

export type TripTotals = {
  spent: number;
  remaining: number;   // سالب عند التجاوز
  percent: number;     // قد يتجاوز 100
  isOverBudget: boolean;
  overBy: number;      // المبلغ الفائض (0 إن لا تجاوز)
};

export function tripTotals(trip: Trip, expenses: Expense[]): TripTotals {
  const spent = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const remaining = trip.totalBudget - spent;
  const percent = trip.totalBudget > 0 ? (spent / trip.totalBudget) * 100 : 0;
  return {
    spent,
    remaining,
    percent,
    isOverBudget: percent >= 100,
    overBy: remaining < 0 ? Math.abs(remaining) : 0,
  };
}

/** «أين ذهبت ميزانيتي؟» — مجاميع التصنيفات مرتّبة تنازلياً (بلا أي سقف فرعي). */
export function categoryBreakdown(
  expenses: Expense[]
): { key: TripCategory; amount: number; share: number }[] {
  const totals = new Map<TripCategory, number>();
  let grand = 0;
  expenses.forEach(e => {
    const key = (e.tripCategory || 'other') as TripCategory;
    const amount = Number(e.amount) || 0;
    totals.set(key, (totals.get(key) || 0) + amount);
    grand += amount;
  });
  return [...totals.entries()]
    .map(([key, amount]) => ({ key, amount, share: grand > 0 ? (amount / grand) * 100 : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

/** أعلى يوم إنفاقاً (بالتاريخ المحلي بلا وقت). */
export function topSpendingDay(expenses: Expense[]): { date: Date; amount: number } | null {
  const byDay = new Map<string, { date: Date; amount: number }>();
  expenses.forEach(e => {
    const d = startOfLocalDay(new Date(e.date));
    const key = d.toDateString();
    const cur = byDay.get(key) || { date: d, amount: 0 };
    cur.amount += Number(e.amount) || 0;
    byDay.set(key, cur);
  });
  const all = [...byDay.values()];
  if (all.length === 0) return null;
  return all.sort((a, b) => b.amount - a.amount)[0];
}

/** مصاريف اليوم الحالي فقط (محلياً). */
export function todaysExpenses(expenses: Expense[], today: Date = new Date()): Expense[] {
  const key = startOfLocalDay(today).toDateString();
  return expenses
    .filter(e => startOfLocalDay(new Date(e.date)).toDateString() === key)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ═══════════════ تسميات ثابتة ═══════════════
// المصطلح المعتمد بكل نص يراه المستخدم: «سفرة/سفرات» حصراً — لا أي مرادف آخر.

export const TRIP_TYPE_LABEL: Record<TripType, string> = {
  abroad: 'سفر خارجي',
  domestic: 'سفرة داخلية',
  other: 'أخرى',
};

/** تسمية آمنة: أي نوع قديم غير معروف يُعرَض «أخرى» بلا كسر. */
export const tripTypeLabel = (t: string): string =>
  TRIP_TYPE_LABEL[t as TripType] ?? TRIP_TYPE_LABEL.other;

export const TRIP_CATEGORY_LABEL: Record<TripCategory, string> = {
  transport: 'تذاكر ومواصلات السفر',
  stay: 'السكن',
  food: 'الطعام والشراب',
  local: 'التنقّل المحلي',
  shopping: 'التسوّق والهدايا',
  activities: 'الترفيه والأنشطة',
  emergency: 'الطوارئ',
  other: 'أخرى',
};

export const TRIP_TYPES: TripType[] = ['abroad', 'domestic', 'other'];

export const TRIP_CATEGORIES: TripCategory[] = [
  'transport', 'stay', 'food', 'local', 'shopping', 'activities', 'emergency', 'other',
];
