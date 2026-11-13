// src/lib/api-auth.ts
// حارس الهوية لمسارات API — خادم فقط (يعتمد firebase-admin، لا يُستورَد في أي مكوّن عميل).
//
// ⛔ العطل الذي أُغلق به (رُصد بالفحص الشامل 2026-09-05):
//    خمسة مسارات تستدعي Gemini المدفوع — chat · coach · analyze · receipt · voice —
//    كانت تستقبل الطلبات من **أي شخص على الإنترنت** بلا أي تحقّق من الهوية ولا حدّ
//    للطلبات. من يفتح أدوات المطوّرين يرى العناوين خلال دقيقة، ويستطيع بعدها
//    استنزاف حساب الفوترة بلا سقف. باقي المسارات الثمانية كانت تتحقق بشكل سليم؛
//    هذه الخمسة وحدها نشأت من فصل Server Actions لأجل maxDuration وفقدت الحارس
//    في الطريق.
//
// نفس نمط التحقق المستخدم في push/subscribe و household/join و delete-account —
// وُحِّد هنا كي لا يتكرّر خمس مرات ولا ينسى أحدٌ إضافته لمسارٍ جديد.
//
// 🆕 2026-11-13: مسارات الذكاء لا تنادي requireUser مباشرةً بعد اليوم — تنادي
//    guardAiRequest / guardAiAction (أسفل الملف) التي تضيف الحدّ اليومي والأخطاء
//    الصادقة فوق الهوية. requireUser باقية للمسارات غير الذكية.
import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import type { AiErrorCode } from '@/types';

export type RequireUserResult =
  | { ok: true; uid: string; isAnonymous: boolean }
  | { ok: false; response: NextResponse };

type TokenCheck =
  | { ok: true; uid: string; isAnonymous: boolean }
  | { ok: false; status: 401 | 503; error: string };

/**
 * يتحقّق من رمز جلسة خام ويعيد uid صاحبه — القلب المشترك بين مسارات API
 * (الرمز في ترويسة Authorization) ودوالّ الخادم Server Actions (الرمز وسيطاً).
 *
 * ملاحظة: حسابات الزائر (المجهولة) لها رموز صحيحة تماماً وتمرّ من هنا بلا
 * مشكلة، فتجربة الزائر مع الذكاء تبقى كما هي — لكن بحدّ يومي أضيق (انظر أدناه).
 */
async function checkToken(token: string): Promise<TokenCheck> {
  if (!token) return { ok: false, status: 401, error: 'يجب تسجيل الدخول' };

  // ⚠️ يُفصَل عطل الإعداد عن الرمز غير الصالح — والسببان يبدوان واحداً بلا هذا الفصل.
  //    `adminAuth()` ترمي فوراً إن نقص أحد متغيّرات الخادم الثلاثة
  //    (FIREBASE_PROJECT_ID · FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY).
  //    لو عُوملت كرمز فاسد لقيل للمستخدم «أعد تسجيل الدخول» — نصيحة لن تنفعه
  //    أبداً لأن العطل في الخادم لا في جلسته، ولَظهر تعطّل خدمات الذكاء
  //    كلها بلا أي أثر يدلّ على السبب الحقيقي.
  //    (رُصد أثناء التحقق بالتشغيل 2026-09-05: المتغيّرات موجودة في Vercel فقط،
  //     فكل تحقق محلي كان يُرفَض برسالة تلوم جلسة المستخدم سليمةً.)
  let auth;
  try {
    auth = adminAuth();
  } catch (err) {
    console.error(
      '[api-auth] firebase-admin غير مهيّأ — تحقّق من متغيّرات الخادم:',
      err instanceof Error ? err.message : 'unknown'
    );
    return { ok: false, status: 503, error: 'الخدمة غير متاحة حالياً، حاول بعد قليل' };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      ok: true,
      uid: decoded.uid,
      isAnonymous: decoded.firebase?.sign_in_provider === 'anonymous',
    };
  } catch {
    return { ok: false, status: 401, error: 'جلسة غير صالحة، أعد تسجيل الدخول' };
  }
}

/**
 * يتحقّق من رمز الجلسة في ترويسة Authorization ويعيد uid صاحبه.
 * عند الفشل يعيد ردّاً جاهزاً بـ401/503 — يُعاد كما هو من المسار.
 */
export async function requireUser(request: Request): Promise<RequireUserResult> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const check = await checkToken(token);
  if (check.ok) return check;
  return {
    ok: false,
    response: NextResponse.json({ ok: false, error: check.error }, { status: check.status }),
  };
}

// ═════════════════════════════════════════════════════════════════════════
// حارس خدمات الذكاء الموحَّد — هوية + حدّ يومي + أخطاء صادقة (2026-11-13)
// ═════════════════════════════════════════════════════════════════════════
//
// ⛔ ثلاثة أعطال أُغلقت به معاً (رُصدت بالفحص الشامل 2026-11-13):
//  1) دالّتا خادم (recordExpenseAction · analyzeMonthlyTrendsAction) بقيتا
//     تناديان Gemini بلا أي تحقّق من الهوية بعد إصلاح 09-05 الذي أغلق مسارات
//     API الخمسة وحدها. Server Action = عنوان POST عامّ، لا يحمل رمز الجلسة
//     من تلقاء نفسه ⇒ الرمز يُمرَّر وسيطاً ويُتحقَّق منه هنا (guardAiAction).
//  2) لا سقف لعدد الطلبات: التحقق من الهوية وحده لا يحمي الفاتورة، لأن حساب
//     الزائر المجهول يُنشأ بضغطة ويمرّ من الحارس. ونفد الرصيد المدفوع فعلاً
//     (402 من Gemini على الإنتاج 2026-11-13) فتوقّفت خدمات الذكاء كلها.
//  3) نصّ خطأ Gemini الخام كان يُعاد إلى الهاتف (وفيه روابط الفوترة)، والواجهة
//     تلوم المستخدم («تأكد أن الصور واضحة») والعطل في رصيدنا نحن.
//
// الحدّ اليومي — قرار صاحب المشروع 2026-11-13: ٣٠ للمسجَّل و١٠ للزائر.
// يُطبَّق على ما يطلبه المستخدم بنفسه (active). وللبقية سلّتان مستقلّتان
// كي لا تأكل حصّته وهو لم يطلب شيئاً:
//   • passive — بطاقات تُحمَّل تلقائياً (المدرب · التحليل الذكي · رؤى الأشهر).
//   • light   — اقتراح الفئة أثناء كتابة اسم المصروف (نداء لكل عنوان).
// ⛔ لا تدمج السلال: فتح التطبيق مرّات قليلة كان سيستنفد حصّة الصوت والفاتورة.
//
// التخزين: `aiUsage/{uid}` = { day, active, passive, light } بتوقيت بغداد.
// مجموعة علوية لا تحت users/ عمداً — قواعد الأمان تسمح للمستخدم بالكتابة في
// كل ما تحت users/{uid} فكان سيصفّر عدّاده بنفسه. المجموعة بلا قاعدة ⇒ مقفلة
// أمام العملاء، ولا يكتبها إلا الخادم. وتُمحى مع الحساب في account-erasure.ts.

export type AiBucket = 'active' | 'passive' | 'light';

const AI_DAILY_LIMITS: Record<AiBucket, { user: number; guest: number }> = {
  active:  { user: 30,  guest: 10 },
  passive: { user: 40,  guest: 15 },
  light:   { user: 200, guest: 60 },
};

// نصوص يراها المستخدم — عربية بسيطة (قاعدة لغة التطبيق في CLAUDE.md).
const AI_MESSAGES: Record<AiErrorCode, string> = {
  ai_paused: 'الخدمات الذكية متوقفة مؤقتاً وستعود قريباً.',
  quota: 'وصلت إلى الحد اليومي للخدمات الذكية. يتجدّد الحد غداً.',
  auth: 'يجب تسجيل الدخول',
  error: 'تعذّر إتمام الطلب الآن. حاول مرة أخرى.',
};

export type AiFailure = { ok: false; code: AiErrorCode; error: string };

function baghdadDay(): string {
  // en-CA ⇒ YYYY-MM-DD. اليوم يُحسب بتوقيت بغداد لا بتوقيت الخادم (UTC).
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Baghdad' }).format(new Date());
}

/**
 * يحجز طلباً واحداً من حصّة اليوم. يعيد false إن استُنفدت.
 * ⚠️ الحجز **قبل** النداء وداخل معاملة عمداً: لو كان الفحص قبل والعدّ بعد،
 *    لمرّت ألف طلب متزامن كلها من الفحص قبل أن يُسجَّل أيّ منها.
 * ⚠️ عند تعطّل العدّاد نفسه نسمح بالطلب: عطل في العدّ لا يصحّ أن يُسقط
 *    خدمات الذكاء عن الجميع. الأثر يُسجَّل في سجلّ الخادم.
 */
async function reserveAiQuota(uid: string, isAnonymous: boolean, bucket: AiBucket): Promise<boolean> {
  const limit = isAnonymous ? AI_DAILY_LIMITS[bucket].guest : AI_DAILY_LIMITS[bucket].user;
  const day = baghdadDay();
  try {
    const db = adminDb();
    const ref = db.collection('aiUsage').doc(uid);
    return await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const sameDay = snap.exists && snap.get('day') === day;
      const counts = {
        active: sameDay ? Number(snap.get('active') ?? 0) : 0,
        passive: sameDay ? Number(snap.get('passive') ?? 0) : 0,
        light: sameDay ? Number(snap.get('light') ?? 0) : 0,
      };
      if (counts[bucket] >= limit) return false;
      counts[bucket] += 1;
      tx.set(ref, { day, ...counts, updatedAt: FieldValue.serverTimestamp() });
      return true;
    });
  } catch (err) {
    console.error('[api-auth] تعذّر عدّ حصّة الذكاء:', err instanceof Error ? err.message : 'unknown');
    return true;
  }
}

/** يعيد الطلب المحجوز إن لم يُخدَم (الذكاء متوقف) — كي لا يُحرَم المستخدم من حصّة لم يستعملها. */
async function refundAiQuota(uid: string, bucket: AiBucket): Promise<void> {
  try {
    await adminDb().collection('aiUsage').doc(uid).update({ [bucket]: FieldValue.increment(-1) });
  } catch {
    /* أفضل جهد — لا يستحق إفشال الردّ */
  }
}

/**
 * يصنّف خطأ نداء الذكاء إلى ردّ آمن للعرض.
 * ⛔ نصّ الخطأ الأصلي لا يغادر الخادم أبداً — يُسجَّل هنا فقط.
 */
function classifyAiError(error: unknown, tag: string): AiFailure {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  console.error(`[${tag}] AI error:`, raw);
  // توقّف من جهتنا لا من جهة المستخدم: رصيد منتهٍ، فوترة معطّلة، مفتاح مرفوض.
  // (Gemini يعيد نفاد الرصيد بـ402 وأحياناً بـ429 مع النصّ نفسه.)
  const paused = /\b402\b|payment required|prepayment credits|billing|api key|permission_denied/i.test(raw);
  const code: AiErrorCode = paused ? 'ai_paused' : 'error';
  return { ok: false, code, error: AI_MESSAGES[code] };
}

type AiGuardOk = {
  ok: true;
  uid: string;
  /** يحوّل أي خطأ من نداء الذكاء إلى ردّ آمن، ويعيد الحصّة إن كان الذكاء متوقفاً. */
  fail: (error: unknown) => Promise<AiFailure>;
};

async function openAiGuard(
  check: { uid: string; isAnonymous: boolean },
  bucket: AiBucket,
  tag: string
): Promise<AiGuardOk | AiFailure> {
  const allowed = await reserveAiQuota(check.uid, check.isAnonymous, bucket);
  if (!allowed) return { ok: false, code: 'quota', error: AI_MESSAGES.quota };
  return {
    ok: true,
    uid: check.uid,
    fail: async (error: unknown) => {
      const failure = classifyAiError(error, tag);
      if (failure.code === 'ai_paused') await refundAiQuota(check.uid, bucket);
      return failure;
    },
  };
}

/**
 * حارس مسارات API التي تنادي الذكاء: هوية ثم حصّة.
 * الأخطاء تُعاد بـ200 مع `{ok:false, code, error}` (توافقاً مع العملاء القائمين)؛
 * وفشل الهوية يبقى 401/503 كما كان.
 */
export async function guardAiRequest(
  request: Request,
  bucket: AiBucket,
  tag: string
): Promise<AiGuardOk | { ok: false; response: Response }> {
  const auth = await requireUser(request);
  if (!auth.ok) return auth;
  const guard = await openAiGuard(auth, bucket, tag);
  if (guard.ok) return guard;
  return { ok: false, response: Response.json(guard, { status: 200 }) };
}

/**
 * حارس دوالّ الخادم (Server Actions) التي تنادي الذكاء: الرمز يأتي وسيطاً
 * من العميل (`getActionToken` في lib/api-fetch.ts) لأن الدالّة لا ترى ترويسات.
 */
export async function guardAiAction(
  idToken: string,
  bucket: AiBucket,
  tag: string
): Promise<AiGuardOk | { ok: false; failure: AiFailure }> {
  const check = await checkToken(typeof idToken === 'string' ? idToken : '');
  if (!check.ok) {
    const code: AiErrorCode = check.status === 401 ? 'auth' : 'error';
    return { ok: false, failure: { ok: false, code, error: check.error } };
  }
  const guard = await openAiGuard(check, bucket, tag);
  if (guard.ok) return guard;
  return { ok: false, failure: guard };
}
