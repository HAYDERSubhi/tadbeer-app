// src/lib/push-server.ts
// أدوات خادمية مشتركة بين مهمتَي الإشعارات المجدولتين
// (/api/push/send و /api/push/month-end).
// ⚠️ خادم فقط — تعتمد على firebase-admin، فلا تُستورَد في أي مكوّن عميل.

import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import type { CurrencyCode } from '@/types';
import { CURRENCIES } from '@/lib/constants';

/**
 * كل مستخدمي تدبير في العراق، وتوقيت بغداد ثابت UTC+3 بلا توقيت صيفي.
 * خوادم Vercel تعمل بتوقيت UTC، فحساب «اليوم» بتوقيت الخادم يزيح حدود اليوم
 * ثلاث ساعات ويُسقِط المصاريف المسجَّلة بين منتصف الليل والثالثة فجراً.
 */
const TZ = 'Asia/Baghdad';
const FALLBACK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** إزاحة توقيت بغداد عن UTC بالمللي ثانية عند لحظة معيّنة. */
function tzOffsetMs(at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(at)
      .reduce<Record<string, string>>((acc, p) => {
        if (p.type !== 'literal') acc[p.type] = p.value;
        return acc;
      }, {});

    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second)
    );
    // formatToParts يعطي ثوانيَ صحيحة — قصّ المللي ثانية من الطرف الآخر
    // حتى لا تتسرّب إلى الإزاحة.
    const offset = asUtc - Math.floor(at.getTime() / 1000) * 1000;
    return Number.isFinite(offset) ? offset : FALLBACK_OFFSET_MS;
  } catch {
    // بيئة بلا بيانات مناطق زمنية كاملة — ارجع للإزاحة الثابتة.
    return FALLBACK_OFFSET_MS;
  }
}

/** الوقت المدني في بغداد ممثَّلاً كأنه UTC (لاستخراج اليوم والشهر منه). */
function baghdadCivil(at: Date): Date {
  return new Date(at.getTime() + tzOffsetMs(at));
}

export type DateRange = { start: Date; end: Date };

/** حدود «اليوم» بتوقيت بغداد، كلحظتين مطلقتين. */
export function baghdadDayRange(at: Date = new Date()): DateRange {
  const civil = baghdadCivil(at);
  const offset = tzOffsetMs(at);
  const midnight = Date.UTC(civil.getUTCFullYear(), civil.getUTCMonth(), civil.getUTCDate());
  return {
    start: new Date(midnight - offset),
    end: new Date(midnight - offset + DAY_MS - 1),
  };
}

/** حدود «أمس» بتوقيت بغداد. */
export function baghdadPreviousDayRange(at: Date = new Date()): DateRange {
  const today = baghdadDayRange(at);
  // منتصف نهار أمس — نقطة آمنة بعيدة عن أي حدّ.
  return baghdadDayRange(new Date(today.start.getTime() - DAY_MS / 2));
}

/** حدود الشهر الحالي بتوقيت بغداد + موقع اليوم منه. */
export function baghdadMonthInfo(at: Date = new Date()) {
  const civil = baghdadCivil(at);
  const offset = tzOffsetMs(at);
  const year = civil.getUTCFullYear();
  const month = civil.getUTCMonth();
  const dayOfMonth = civil.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  return {
    start: new Date(Date.UTC(year, month, 1) - offset),
    end: new Date(Date.UTC(year, month + 1, 1) - offset - 1),
    dayOfMonth,
    daysInMonth,
    daysLeft: daysInMonth - dayOfMonth,
  };
}

/**
 * مسار مصاريف المستخدم — المعمارية مزدوجة المسار: من ينضم لعائلة تنتقل
 * مصاريفه كلها إلى الحاوية المشتركة، فالبحث في users/{uid} وحده يفوّتها.
 */
export function expensesPath(uid: string, householdId?: string | null): string {
  return householdId ? `households/${householdId}/expenses` : `users/${uid}/expenses`;
}

/**
 * مصاريف ضمن مدى زمني.
 *
 * حقل `date` يُخزَّن Timestamp في كل مسارات الكتابة (addExpense و
 * addExpensesBatch)، ومقارنته بنص ISO لا تطابق أي مستند إطلاقاً لأن Firestore
 * يرتّب القيم حسب النوع أولاً (Timestamp قبل String) — وهذا بالضبط ما جعل فحص
 * «هل سجّل اليوم؟» يرجع دائماً «لا».
 *
 * الاستعلام النصّي يبقى شبكة أمان لأي مستند قديم نادر خُزِّن نصاً، ولا يُنفَّذ
 * إلا إذا خلا الاستعلام الأول.
 */
export async function fetchExpensesInRange(
  db: Firestore,
  path: string,
  range: DateRange
): Promise<QueryDocumentSnapshot[]> {
  const byTimestamp = await db
    .collection(path)
    .where('date', '>=', range.start)
    .where('date', '<=', range.end)
    .get();
  if (!byTimestamp.empty) return byTimestamp.docs;

  const byString = await db
    .collection(path)
    .where('date', '>=', range.start.toISOString())
    .where('date', '<=', range.end.toISOString())
    .get();
  return byString.docs;
}

/** مجموع مبالغ مجموعة مستندات مصاريف، متجاهلاً أي مبلغ غير رقمي. */
export function sumAmounts(docs: QueryDocumentSnapshot[]): number {
  return docs.reduce((total, d) => {
    const amount = d.data()?.amount;
    return total + (typeof amount === 'number' && Number.isFinite(amount) ? amount : 0);
  }, 0);
}

export type PushSettings = {
  householdId: string | null;
  dailyReminderEnabled: boolean;
  reminderSlot: string;
  totalBudget: number;
  currency: CurrencyCode;
};

/**
 * إعدادات المستخدم كما تراها الواجهة تماماً: التفضيلات الشخصية (الإشعارات)
 * من مستند المستخدم، والميزانية المشتركة من مستند العائلة عند وجودها.
 *
 * ⚠️ مستند المستخدم يحتفظ بنسخة قديمة من الميزانية بعد الانضمام لعائلة
 * (تُنسَخ إلى العائلة ولا تُحذف من الشخصي)، فقراءتها من المستند الشخصي وحده
 * تعطي رقماً خاطئاً أو صفراً — لذلك تُقرأ من العائلة عند وجودها.
 */
export async function resolvePushSettings(
  db: Firestore,
  uid: string
): Promise<PushSettings | null> {
  const userSnap = await db.doc(`users/${uid}/settings/main`).get();
  if (!userSnap.exists) return null;

  const userData = (userSnap.data() ?? {}) as Record<string, any>;
  const householdId: string | null = userData.householdId || null;

  let totalBudget = userData.budget?.totalBudget;
  if (householdId) {
    const hhSnap = await db.doc(`households/${householdId}/settings/main`).get();
    totalBudget = hhSnap.data()?.budget?.totalBudget;
  }

  // العملة تفضيل شخصي دائماً (تُحفَظ في مستند المستخدم حتى داخل العائلة)،
  // فيرى كل عضو الرمز الذي اختاره هو.
  const currency: CurrencyCode =
    userData.currency && userData.currency in CURRENCIES ? userData.currency : 'IQD';

  return {
    householdId,
    dailyReminderEnabled: !!userData.notifications?.dailyReminderEnabled,
    reminderSlot: userData.notifications?.reminderSlot ?? 'evening',
    totalBudget: typeof totalBudget === 'number' && Number.isFinite(totalBudget) ? totalBudget : 0,
    currency,
  };
}

/** تنسيق المبالغ بالأرقام اللاتينية — نفس ما تعرضه شاشات التطبيق. */
export function formatAmount(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(n));
}

/**
 * مبلغ مع رمز عملة المستخدم وموضعه الصحيح (د.ع بعد الرقم، $ قبله).
 * التطبيق لا يحوّل بين العملات — الرقم كما هو والرمز حسب اختيار المستخدم،
 * تماماً كما تعرضه الشاشات عبر use-currency.
 */
export function formatMoney(n: number, code: CurrencyCode = 'IQD'): string {
  const { symbol, position } = CURRENCIES[code] ?? CURRENCIES.IQD;
  const num = formatAmount(n);
  return position === 'before' ? `${symbol}${num}` : `${num} ${symbol}`;
}
