// src/app/api/household/remove-member/route.ts
// إزالة عضو من العائلة — على الخادم، تماماً كنظيرتها join.
//
// ⛔ العطل الذي عالجه هذا المسار (2026-09-05): كانت الإزالة تتم من المتصفّح،
//    وتنتهي بكتابة في `users/{memberUid}/settings/main` لمسح ارتباطه بالعائلة.
//    وقواعد الأمان تمنع (بحق) أن يكتب مستخدمٌ في مستند مستخدمٍ آخر، فكانت
//    تُرفض دائماً. النتيجة ثلاثة أضرار:
//      1) المالك يرى «خطأ» رغم أن الإزالة نُفِّذت جزئياً.
//      2) إعدادات العضو تبقى مشيرة إلى عائلة لم يعد فيها ⇒ كل قراءة يحاولها
//         تطبيقه تُرفض في كل فتحة، إلى الأبد.
//      3) والأخطر: **بياناته لم تكن تُعاد إليه إطلاقاً** — الانضمام ينقل
//         مصاريفه وأهدافه ودخله إلى العائلة، والإزالة كانت تتركها محبوسة
//         هناك في مكان لم يعد يملك قراءته. المغادرة الطوعية تُعيدها، والإزالة
//         لا. هذا المسار يسوّي السلوكين.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BATCH_SIZE = 400;
const OWNED_COLLECTIONS = ['expenses', 'goals', 'incomes'] as const;

/**
 * ينقل ما يملكه العضو وحده (المطابق لـ uid) من مسار إلى آخر.
 * نسخ ثم حذف: لو انقطع التنفيذ بين الخطوتين تبقى نسخة كاملة في الوجهة ولا
 * تُفقد وثيقة. وحفظ المعرّفات كما هي يجعل إعادة المحاولة آمنة.
 * يطابق سلوك `_moveSubcollection({ filterUid })` في المغادرة الطوعية.
 */
async function moveOwnedDocs(
  db: FirebaseFirestore.Firestore,
  fromBase: string,
  toBase: string,
  col: string,
  ownerUid: string,
): Promise<number> {
  const snap = await db.collection(`${fromBase}/${col}`).get();
  const docs = snap.docs.filter((d) => d.data().uid === ownerUid);
  if (docs.length === 0) return 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      batch.set(db.doc(`${toBase}/${col}/${d.id}`), d.data());
    });
    await batch.commit();
  }
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(db.doc(`${fromBase}/${col}/${d.id}`)));
    await batch.commit();
  }
  return docs.length;
}

export async function POST(req: NextRequest) {
  try {
    // ── 1. هوية المُنادي من رمز الجلسة، لا من جسم الطلب ──
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'يجب تسجيل الدخول' }, { status: 401 });
    }
    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'جلسة غير صالحة، أعد تسجيل الدخول' }, { status: 401 });
    }
    const callerUid = decoded.uid;

    const body = (await req.json()) as { householdId?: string; memberUid?: string };
    const householdId = typeof body.householdId === 'string' ? body.householdId.trim() : '';
    const memberUid = typeof body.memberUid === 'string' ? body.memberUid.trim() : '';
    if (!householdId || !memberUid) {
      return NextResponse.json({ error: 'طلب غير مكتمل' }, { status: 400 });
    }

    const db = adminDb();
    const hhRef = db.doc(`households/${householdId}`);
    const hhSnap = await hhRef.get();

    // ── 2. الصلاحية: المالك وحده، ولا نكشف وجود العائلة لغيره ──
    // نفس الردّ 403 للعائلة غير الموجودة وللمُنادي غير المالك: من ليس مالكاً
    // لا يعرف حتى إن كان المعرّف صحيحاً.
    const hh = hhSnap.exists ? hhSnap.data()! : null;
    if (!hh || hh.ownerId !== callerUid) {
      return NextResponse.json({ error: 'لا تملك صلاحية إزالة الأعضاء' }, { status: 403 });
    }

    // ── 3. حواجز المنطق ──
    if (memberUid === callerUid) {
      // إزالة المالك نفسه تترك العائلة بلا مالك. المغادرة لها مسارها الخاص.
      return NextResponse.json({ error: 'لا يمكنك إزالة نفسك — استخدم «مغادرة العائلة»' }, { status: 400 });
    }
    const members: Array<{ uid: string }> = Array.isArray(hh.members) ? hh.members : [];
    const member = members.find((m) => m?.uid === memberUid);
    if (!member) {
      // إمّا أُزيل سلفاً وإمّا لم يكن عضواً — الحالتان لا تحتاجان عملاً.
      return NextResponse.json({ ok: true, alreadyRemoved: true });
    }

    // ── 4. أعِد بياناته إليه **قبل** إسقاط عضويته ──
    // الترتيب مقصود: لو انقطع التنفيذ هنا يبقى عضواً وبياناته عادت — حالة
    // قابلة للتصحيح بلا فقدان. العكس (إسقاط العضوية أولاً) يترك بياناته
    // محبوسة في مكان لا يقرؤه.
    let moved = 0;
    for (const col of OWNED_COLLECTIONS) {
      moved += await moveOwnedDocs(db, `households/${householdId}`, `users/${memberUid}`, col, memberUid);
    }

    // ── 5. أسقط العضوية ──
    await hhRef.update({
      members: FieldValue.arrayRemove(member),
      memberUids: FieldValue.arrayRemove(memberUid),
    });

    // ── 6. وامسح ارتباطه بالعائلة — هذه هي الكتابة التي كانت تُرفض ──
    await db.doc(`users/${memberUid}/settings/main`).set({ householdId: null }, { merge: true });

    return NextResponse.json({ ok: true, movedDocs: moved });
  } catch (err) {
    // بلا تسجيل للمعرّفات — سجلّات الخادم تبقى إلى الأبد.
    console.error('household remove-member error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'حدث خطأ في الخادم، حاول مجدداً' }, { status: 500 });
  }
}
