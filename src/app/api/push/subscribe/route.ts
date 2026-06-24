import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    // تحقّق من هوية المُرسِل — لا أحد يكتب اشتراكاً باسم غيره.
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'invalid session' }, { status: 401 });
    }

    const uid = decoded.uid;
    const body = (await req.json()) as { subscription: unknown };
    const { subscription } = body;
    if (!subscription) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    // admin SDK يتجاوز قواعد الأمان — المجموعة تبقى مقفلة أمام العملاء.
    await adminDb()
      .collection('pushSubscriptions')
      .doc(uid)
      .set({ subscription, userId: uid, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('push subscribe error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
