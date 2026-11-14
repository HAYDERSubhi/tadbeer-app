// src/lib/new-signup.ts
// علامة «حساب أُنشئ الآن» — يضعها مسار التسجيل (جوجل · البريد · الزائر) لحظة الإنشاء.
//
// لماذا (2026-11-14، فيديو المالك): معالج الترحيب ينتظر جلب الإعدادات من Firestore كي لا
// يُفتح لمستخدم عائد، فكان المستخدم الجديد يحدّق ~٤ ثوانٍ في هيكل تحميل رمادي قبل ظهوره.
// والحساب الجديد لا إعدادات له يقيناً، فلا داعي للانتظار.
// ⛔ sessionStorage عمداً: تخصّ هذه الجلسة وحدها، ولا تفتح المعالج لاحقاً لحساب عائد.
const KEY = 'tadbeer-new-signup';

export function markNewSignup(uid: string): void {
  try { sessionStorage.setItem(KEY, uid); } catch {}
}

export function isNewSignup(uid: string): boolean {
  try { return sessionStorage.getItem(KEY) === uid; } catch { return false; }
}
