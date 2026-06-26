// src/app/api/delete-account/route.ts
// Permanently deletes a user's account and all their Firestore data.
// Uses firebase-admin (bypasses security rules) and verifies the caller's token first.
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

async function deleteSubcollection(db: FirebaseFirestore.Firestore, basePath: string, colName: string) {
  const snap = await db.collection(`${basePath}/${colName}`).get();
  if (snap.empty) return;
  const BATCH_SIZE = 400;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

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
    const db = adminDb();
    const basePath = `users/${uid}`;

    // Delete all subcollections in parallel
    await Promise.all(
      ['expenses', 'goals', 'incomes', 'installmentPlans', 'debts', 'silftna'].map((col) =>
        deleteSubcollection(db, basePath, col)
      )
    );

    // Delete standalone documents (swallow errors if they don't exist)
    await Promise.allSettled([
      db.doc(`${basePath}/settings/main`).delete(),
      db.doc(`${basePath}/wedding/plan`).delete(),
      db.doc(basePath).delete(),
    ]);

    // Delete the Firebase Auth user (admin SDK has no re-auth requirement)
    await adminAuth().deleteUser(uid);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('delete-account error:', err);
    return NextResponse.json({ ok: false, error: 'فشل حذف الحساب، حاول مجدداً' }, { status: 500 });
  }
}
