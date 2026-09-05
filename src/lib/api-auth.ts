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
import { NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

export type RequireUserResult =
  | { ok: true; uid: string }
  | { ok: false; response: NextResponse };

/**
 * يتحقّق من رمز الجلسة في ترويسة Authorization ويعيد uid صاحبه.
 * عند الفشل يعيد ردّاً جاهزاً بـ401 — يُعاد كما هو من المسار.
 *
 * ملاحظة: حسابات الزائر (المجهولة) لها رموز صحيحة تماماً وتمرّ من هنا بلا
 * مشكلة، فتجربة الزائر مع الذكاء تبقى كما هي بالضبط.
 */
export async function requireUser(request: Request): Promise<RequireUserResult> {
  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'يجب تسجيل الدخول' },
        { status: 401 }
      ),
    };
  }

  // ⚠️ يُفصَل عطل الإعداد عن الرمز غير الصالح — والسببان يبدوان واحداً بلا هذا الفصل.
  //    `adminAuth()` ترمي فوراً إن نقص أحد متغيّرات الخادم الثلاثة
  //    (FIREBASE_PROJECT_ID · FIREBASE_CLIENT_EMAIL · FIREBASE_PRIVATE_KEY).
  //    لو عُوملت كرمز فاسد لقيل للمستخدم «أعد تسجيل الدخول» — نصيحة لن تنفعه
  //    أبداً لأن العطل في الخادم لا في جلسته، ولَظهر تعطّل خدمات الذكاء الخمس
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
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'الخدمة غير متاحة حالياً، حاول بعد قليل' },
        { status: 503 }
      ),
    };
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    return { ok: true, uid: decoded.uid };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: 'جلسة غير صالحة، أعد تسجيل الدخول' },
        { status: 401 }
      ),
    };
  }
}
