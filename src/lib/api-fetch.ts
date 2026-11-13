// src/lib/api-fetch.ts
// نداء مسارات API مع رمز هوية المستخدم — عميل فقط.
//
// يقابل حارس الخادم في `lib/api-auth.ts`. وُحِّد هنا لسببين:
//   1) المواضع الخمسة التي تنادي خدمات الذكاء كانت تكرّر نفس fetch حرفياً،
//      فتوحيدها يمنع أن يُنسى الرمز في موضع دون آخر.
//   2) بعض هذه المواضع دوالّ عادية خارج مكوّنات React (fetchCoach و
//      fetchAnalysis)، فلا تستطيع استعمال useAuth — و`auth` كائن وحدة
//      مفرد يعمل في الحالتين.

import { auth } from '@/lib/firebase';
import type { AiErrorCode } from '@/types';

/**
 * مثل fetch تماماً، مع إضافة ترويسة Authorization إن كان هناك مستخدم.
 *
 * ⚠️ `await auth.authStateReady()` ضروري ولا يُحذف: عند الفتح البارد تبقى
 *    `currentUser` فارغة لجزء من الثانية ريثما تستعيد Firebase الجلسة من
 *    التخزين. لو قرأناها مباشرةً لخرج الطلب أحياناً بلا رمز فيُرفض بـ401 —
 *    عطل متقطّع يظهر عند أول فتح فقط ويصعب تشخيصه لاحقاً. الانتظار يحسمه.
 *    وهي تعود فوراً بعد أول استقرار، فلا كلفة على النداءات التالية.
 */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

  if (auth) {
    await auth.authStateReady();
    const user = auth.currentUser;
    if (user) {
      // getIdToken يعيد الرمز المخزَّن ويجدّده تلقائياً إن قارب انتهاء صلاحيته.
      const token = await user.getIdToken();
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  return fetch(url, { ...init, headers });
}

// ─────────────────────────────────────────────────────────────────────────
// خدمات الذكاء: رمز لدوالّ الخادم + قراءة موحَّدة للردّ (2026-11-13)
// ─────────────────────────────────────────────────────────────────────────
/**
 * رمز الجلسة لتمريره وسيطاً إلى دوالّ الخادم (Server Actions) — فهي لا ترى
 * ترويسة Authorization، وحارسها `guardAiAction` يتحقّق من هذا الرمز.
 * يعيد نصّاً فارغاً بلا مستخدم (فيرفض الخادم الطلب بـ«يجب تسجيل الدخول»).
 */
export async function getActionToken(): Promise<string> {
  if (!auth) return '';
  await auth.authStateReady(); // نفس سبب الانتظار في authedFetch أعلاه
  return (await auth.currentUser?.getIdToken()) ?? '';
}

const AI_GENERIC_ERROR = 'تعذّر إتمام الطلب الآن. حاول مرة أخرى.';

/**
 * خطأ من خدمة ذكاء **نصّه آمن للعرض كما هو** — الخادم لا يعيد إلا رسائل
 * عربية جاهزة (راجع AI_MESSAGES في lib/api-auth.ts)، فلا حاجة لنصّ بديل.
 * أخطاء الشبكة والمهلة ليست AiError، ولكل واجهة رسالتها لها.
 */
export class AiError extends Error {
  code: AiErrorCode;
  constructor(message: string, code: AiErrorCode) {
    super(message);
    this.name = 'AiError';
    this.code = code;
  }
}

/** الذكاء غير متاح لهذا المستخدم الآن (متوقف من جهتنا، أو بلغ حدّه اليومي) — إعادة المحاولة لن تنفع. */
export function isAiUnavailable(err: unknown): err is AiError {
  return err instanceof AiError && (err.code === 'ai_paused' || err.code === 'quota');
}

type AiResult<T> = { ok: true; data: T } | { ok: false; error?: string; code?: AiErrorCode };

/** يفكّ نتيجة خدمة ذكاء (مسار API أو دالّة خادم): يعيد البيانات أو يرمي AiError. */
export function unwrapAi<T>(result: AiResult<T> | null | undefined): T {
  if (result && result.ok && result.data != null) return result.data;
  const failure = result && !result.ok ? result : undefined;
  throw new AiError(failure?.error || AI_GENERIC_ERROR, failure?.code ?? 'error');
}

/** يقرأ ردّ مسار ذكاء (`{ok, data}` أو `{ok:false, code, error}`) — يرمي AiError عند الفشل. */
export async function readAi<T>(res: Response): Promise<T> {
  let json: AiResult<T> | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }
  return unwrapAi(json);
}

/**
 * سياسة إعادة المحاولة لاستعلامات الذكاء في React Query: مرّة واحدة للأعطال
 * العابرة، ولا إعادة حين يكون الذكاء غير متاح (كانت الإعادة تضاعف الطلبات بلا فائدة).
 */
export function aiQueryRetry(failureCount: number, error: unknown): boolean {
  return !isAiUnavailable(error) && failureCount < 1;
}
