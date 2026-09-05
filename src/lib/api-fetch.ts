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
