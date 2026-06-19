import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getFirestore, collection, getDocs, query, where, deleteDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { startOfDay, endOfDay } from 'date-fns';

// Initialize Firebase for server context
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

webpush.setVapidDetails(
  process.env.VAPID_EMAIL!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const subsSnap = await getDocs(collection(db, 'pushSubscriptions'));
    let sent = 0;
    let skipped = 0;

    for (const subDoc of subsSnap.docs) {
      const { subscription, userId } = subDoc.data() as { subscription: webpush.PushSubscription; userId: string };
      if (!subscription || !userId) continue;

      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd = endOfDay(new Date()).toISOString();
      const expSnap = await getDocs(
        query(
          collection(db, 'users', userId, 'expenses'),
          where('date', '>=', todayStart),
          where('date', '<=', todayEnd)
        )
      );

      if (!expSnap.empty) { skipped++; continue; }

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '🔥 تدبير — تذكير يومي',
            body: 'لم تسجّل أي مصروف اليوم. دقيقة واحدة تكفي! 💰',
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            url: '/',
          })
        );
        sent++;
      } catch (pushErr: any) {
        if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
          await deleteDoc(subDoc.ref);
        }
      }
    }

    return NextResponse.json({ ok: true, sent, skipped });
  } catch (err) {
    console.error('push send error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
