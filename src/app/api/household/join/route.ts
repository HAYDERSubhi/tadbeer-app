// src/app/api/household/join/route.ts
// Server-side household join. The Firestore security rules (correctly) forbid a
// non-member from reading a household by invite code or adding themselves to it
// — a chicken-and-egg that makes client-side join impossible. This endpoint
// performs the join with admin privileges after verifying the caller's identity.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
// نقل تاريخ مصاريف طويل يتجاوز مهلة ١٠ ثوانٍ الافتراضية — وهو بالضبط الانقطاع
// الذي كان يترك المنضمّ ببيانات مقسومة. نفس مهلة نظائره (remove-member · delete-account).
export const maxDuration = 60;

const BATCH_SIZE = 400;

// Moves every doc of a subcollection from one path to another, stamping the
// creator uid when missing. Copy-then-delete guarantees no data loss if
// interrupted; preserving doc ids makes a retry idempotent.
async function moveSubcollection(
  db: FirebaseFirestore.Firestore,
  fromBase: string,
  toBase: string,
  col: string,
  stampUid: string,
): Promise<number> {
  const snap = await db.collection(`${fromBase}/${col}`).get();
  const docs = snap.docs;
  if (docs.length === 0) return 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach((d) => {
      const data = d.data();
      batch.set(db.doc(`${toBase}/${col}/${d.id}`), { ...data, uid: data.uid || stampUid });
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
    // 1. Verify the caller's identity from the Authorization bearer token.
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

    const uid = decoded.uid;
    const displayName = decoded.name || 'مستخدم';
    const email = decoded.email || '';

    const body = (await req.json()) as { code?: string };
    const code = (body.code || '').toUpperCase().trim();
    if (!code) {
      return NextResponse.json({ error: 'أدخل رمز الدعوة' }, { status: 400 });
    }

    const db = adminDb();

    // 2. Find the household by invite code (admin read bypasses rules).
    const snap = await db.collection('households').where('inviteCode', '==', code).limit(1).get();
    if (snap.empty) {
      return NextResponse.json({ error: 'كود الدعوة غير صحيح أو منتهي الصلاحية' }, { status: 404 });
    }

    const hhDoc = snap.docs[0];
    const hhId = hhDoc.id;
    const hhData = hhDoc.data();

    // 3. هل هو عضو أصلاً؟
    // ⛔ كان هذا الموضع يردّ 409 «أنت بالفعل عضو» ويتوقّف (حتى 2026-11-13).
    //    والعطل: الخطوة ٤ تضيفه عضواً **قبل** نقل بياناته (٥) وربط إعداداته (٦).
    //    فلو انقطع الطلب بينهما (مهلة، شبكة) صار عضواً ببيانات مقسومة بين
    //    المسارين وبلا ارتباط — وكل إعادة محاولة تُرفض هنا، فلا مخرج له.
    //    الآن: العضو القائم **يُكمَل** له ما لم يكتمل. الخطوات ٥ و٦ تتحمّل
    //    الإعادة أصلاً (نقل بمعرّفات محفوظة · merge)، فمن كان مكتملاً لا يتغيّر
    //    عنده شيء.
    const members: Array<{ uid: string }> = hhData.members || [];
    const alreadyMember = members.some((m) => m.uid === uid);

    // 3ب. عضو في عائلة **أخرى**؟ يُرفض — وإلا نُقلت بياناته الشخصية إلى العائلة
    //     الجديدة وبقي اسمه وبياناته السابقة في القديمة (عضوية مزدوجة).
    //     الارتباط المسجَّل لا يكفي وحده: قد يكون أثراً قديماً لعائلة حُذفت أو
    //     أُخرج منها، فيُتحقَّق من عضويته الفعلية فيها.
    const settingsRef = db.doc(`users/${uid}/settings/main`);
    const linkedHhId = (await settingsRef.get()).get('householdId') as string | null | undefined;
    if (linkedHhId && linkedHhId !== hhId) {
      const other = await db.doc(`households/${linkedHhId}`).get();
      const otherUids: string[] = other.exists ? other.get('memberUids') || [] : [];
      if (otherUids.includes(uid)) {
        return NextResponse.json(
          { error: 'أنت عضو في عائلة أخرى. غادرها أولاً ثم انضم بهذا الرمز.' },
          { status: 409 }
        );
      }
    }

    // 4. Add the caller to the household (skipped when resuming an interrupted join).
    if (!alreadyMember) {
      const member = { uid, displayName, email, role: 'member', joinedAt: new Date().toISOString() };
      await hhDoc.ref.update({
        members: FieldValue.arrayUnion(member),
        memberUids: FieldValue.arrayUnion(uid),
      });
    }

    // 5. Move the joiner's personal data into the shared bucket (stamped with
    //    their uid so they can take it back if they later leave).
    for (const col of ['expenses', 'goals', 'incomes']) {
      await moveSubcollection(db, `users/${uid}`, `households/${hhId}`, col, uid);
    }

    // 6. Link the user to the household.
    await settingsRef.set({ householdId: hhId }, { merge: true });

    return NextResponse.json({ ok: true, householdId: hhId });
  } catch (err) {
    console.error('household join error:', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم، حاول مجدداً' }, { status: 500 });
  }
}
