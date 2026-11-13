// src/app/actions.ts
'use server';

// دوالّ الخادم (Server Actions) التي تنادي الذكاء المدفوع.
//
// ⛔ كل دالّة هنا عنوان POST عامّ يصل إليه أي شخص على الإنترنت — وهي لا ترى
//    ترويسة Authorization كما تراها مسارات API. فالقاعدة: **لا دالّة هنا بلا
//    `guardAiAction`**، والرمز يأتيها وسيطاً من العميل (`getActionToken`).
//
//    حتى 2026-11-13 كانت دالّتا هذا الملف المستعملتان تناديان Gemini بلا أي
//    تحقّق (بقيتا خارج إصلاح 09-05 الذي أغلق مسارات API الخمسة). ومعهما خمس
//    دوالّ أخرى غير مستعملة ومكشوفة بالطريقة نفسها (coach · chat · voice ·
//    spending patterns · stats summary) — حُذفت: نظائرها الحيّة مسارات API
//    محروسة في src/app/api/. ⛔ لا تُعِدها هنا.
//
// النتيجة تُعاد قيمةً لا استثناءً: Next.js يمحو نصّ الاستثناء في الإنتاج،
// فلا تصل الرسالة («متوقفة مؤقتاً» / «الحد اليومي») إلى الواجهة إلا هكذا.

import {
  recordExpenseWithText,
  type RecordExpenseWithTextInput,
  type RecordExpenseWithTextOutput,
} from '@/ai/flows/record-expense-text';
import {
  analyzeMonthlyTrends,
  type AnalyzeMonthlyTrendsInput,
  type AnalyzeMonthlyTrendsOutput,
} from '@/ai/flows/analyze-monthly-trends';
import { guardAiAction, type AiFailure } from '@/lib/api-auth';

export type RecordExpenseActionResult =
  | { ok: true; data: RecordExpenseWithTextOutput }
  | AiFailure;

/**
 * اقتراح الفئة من اسم المصروف (يُنادى أثناء الكتابة) — سلّة `light`.
 */
export async function recordExpenseAction(
  input: RecordExpenseWithTextInput,
  idToken: string
): Promise<RecordExpenseActionResult> {
  const guard = await guardAiAction(idToken, 'light', 'recordExpenseAction');
  if (!guard.ok) return guard.failure;
  try {
    const data = await recordExpenseWithText(input);
    return { ok: true, data };
  } catch (error) {
    return guard.fail(error);
  }
}

export type MonthlyTrendsActionResult =
  | { ok: true; data: AnalyzeMonthlyTrendsOutput }
  | AiFailure;

/**
 * بطاقة «رؤى ذكية — مقارنة الأشهر» في الرئيسية (تُحمَّل تلقائياً) — سلّة `passive`.
 */
export async function analyzeMonthlyTrendsAction(
  input: AnalyzeMonthlyTrendsInput,
  idToken: string
): Promise<MonthlyTrendsActionResult> {
  const guard = await guardAiAction(idToken, 'passive', 'analyzeMonthlyTrendsAction');
  if (!guard.ok) return guard.failure;
  try {
    const data = await analyzeMonthlyTrends(input);
    return { ok: true, data };
  } catch (error) {
    return guard.fail(error);
  }
}
