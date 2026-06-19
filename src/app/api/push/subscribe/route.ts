import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, doc, setDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(app);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { subscription: unknown; userId: string };
    const { subscription, userId } = body;
    if (!subscription || !userId) {
      return NextResponse.json({ error: 'missing fields' }, { status: 400 });
    }

    await setDoc(
      doc(db, 'pushSubscriptions', userId),
      { subscription, userId, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('push subscribe error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
