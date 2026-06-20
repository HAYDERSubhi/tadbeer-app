// src/app/api/household/join/route.ts
// Server-side household join. The Firestore security rules (correctly) forbid a
// non-member from reading a household by invite code or adding themselves to it
// — a chicken-and-egg that makes client-side join impossible. This endpoint
// performs the join with admin privileges after verifying the caller's identity.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const runtime = 'nodejs';

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

    // 3. Guard: already a member?
    const members: Array<{ uid: string }> = hhData.members || [];
    if (members.some((m) => m.uid === uid)) {
      return NextResponse.json({ error: 'أنت بالفعل عضو في هذه العائلة' }, { status: 409 });
    }

    // 4. Add the caller to the household.
    const member = { uid, displayName, email, role: 'member', joinedAt: new Date().toISOString() };
    await hhDoc.ref.update({
      members: FieldValue.arrayUnion(member),
      memberUids: FieldValue.arrayUnion(uid),
    });

    // 5. Move the joiner's personal data into the shared bucket (stamped with
    //    their uid so they can take it back if they later leave).
    for (const col of ['expenses', 'goals', 'incomes']) {
      await moveSubcollection(db, `users/${uid}`, `households/${hhId}`, col, uid);
    }

    // 6. Link the user to the household.
    await db.doc(`users/${uid}/settings/main`).set({ householdId: hhId }, { merge: true });

    return NextResponse.json({ ok: true, householdId: hhId });
  } catch (err) {
    console.error('household join error:', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم، حاول مجدداً' }, { status: 500 });
  }
}
