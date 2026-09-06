// src/app/api/delete-account/route.ts
// Permanently deletes a user's account and all their data.
// Uses firebase-admin (bypasses security rules) and verifies the caller's token first.
//
// المنطق نفسه في src/lib/account-erasure.ts — مفصول كي يُختبَر على المحاكي
// محلياً، لأن متغيّرات admin في Vercel وحدها (فخّ ٢). هذا الملف: هوية + ترتيب.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, adminStorageBucket } from '@/lib/firebase-admin';
import { eraseAccountData } from '@/lib/account-erasure';

export const runtime = 'nodejs';
// ⚠️ كان هذا المسار بلا maxDuration — أي أنه يعمل بمهلة ١٠ ثوانٍ الافتراضية
//    بينما كل نظائره الثقيلة (حتى household/remove-member) أُعطيت ٦٠. مستخدم
//    قديم بمصاريف كثيرة كان حذفه ينقطع في منتصفه. (رُصد 2026-09-06.)
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ ok: false, error: 'يجب تسجيل الدخول' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ ok: false, error: 'جلسة غير صالحة، أعد تسجيل الدخول' }, { status: 401 });
    }

    const uid = decoded.uid;

    // نقص إعداد التخزين لا يمنع المستخدم من حذف حسابه — يُسجَّل الأثر ويُكمَل.
    let bucket = null;
    try {
      bucket = adminStorageBucket();
    } catch {
      bucket = null;
    }

    // ⛔ الترتيب مقصود ولا يُقلَب: البيانات أولاً ثم حساب المصادقة أخيراً.
    //    لو تعثّر شيء هنا، تُرمى الاستثناءات فيبقى الحساب قائماً ويعيد
    //    المستخدم المحاولة. العكس (حذف الحساب أولاً) يترك بياناته يتيمة
    //    في العائلة والتخزين بلا أي طريقة لبلوغها لاحقاً.
    //    والمسار قابل للإعادة: كل خطوة فيه تتحمّل أن تُنفَّذ مرّتين.
    const report = await eraseAccountData(adminDb(), bucket, uid);

    await adminAuth().deleteUser(uid);

    if (report.storageError) {
      // الحساب مُحي فعلاً — لكن ملفاته لم تُمحَ، وهذا يجب أن يُرى في السجلّ
      // لا أن يمرّ بصمت. الأثر مسجَّل في deletionResidue للإعادة.
      console.error('delete-account: storage cleanup failed for one account');
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    // بلا تسجيل للمعرّفات — سجلّات الخادم تبقى إلى الأبد.
    console.error('delete-account error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'فشل حذف الحساب، حاول مجدداً' }, { status: 500 });
  }
}
