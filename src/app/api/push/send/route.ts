import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { getFirestore, collection, getDocs, query, where, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { startOfDay, endOfDay, subDays } from 'date-fns';

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

// Iraq is UTC+3
// morning   → 8 AM Iraq = 05:00 UTC
// afternoon → 2 PM Iraq = 11:00 UTC
// evening   → 8 PM Iraq = 17:00 UTC
const SLOT_UTC: Record<string, number> = {
  morning:   5,
  afternoon: 11,
  evening:   17,
};

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const slot = searchParams.get('slot') ?? 'evening';

  try {
    const subsSnap = await getDocs(collection(db, 'pushSubscriptions'));
    let sent = 0;
    let skipped = 0;

    for (const subDoc of subsSnap.docs) {
      const { subscription, userId } = subDoc.data() as {
        subscription: webpush.PushSubscription;
        userId: string;
      };
      if (!subscription || !userId) continue;

      // تحقق من إعداد المستخدم — هل يريد إشعاراً في هذا الوقت؟
      try {
        const settingsDoc = await getDoc(doc(db, 'users', userId, 'settings', 'main'));
        const notifications = settingsDoc.data()?.notifications ?? {};
        if (!notifications.dailyReminderEnabled) { skipped++; continue; }
        const userSlot = notifications.reminderSlot ?? 'evening';
        if (userSlot !== slot) { skipped++; continue; }
      } catch { skipped++; continue; }

      // لا ترسل إذا سجّل مصروفاً اليوم بالفعل
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd   = endOfDay(new Date()).toISOString();
      const expSnap = await getDocs(
        query(
          collection(db, 'users', userId, 'expenses'),
          where('date', '>=', todayStart),
          where('date', '<=', todayEnd)
        )
      );
      if (!expSnap.empty) { skipped++; continue; }

      // جلب مصاريف أمس لتخصيص نص الإشعار
      const yesterday = subDays(new Date(), 1);
      const yStart = startOfDay(yesterday).toISOString();
      const yEnd   = endOfDay(yesterday).toISOString();
      const ySnap = await getDocs(
        query(
          collection(db, 'users', userId, 'expenses'),
          where('date', '>=', yStart),
          where('date', '<=', yEnd)
        )
      );
      const yesterdayTotal = ySnap.docs.reduce((s, d) => s + (d.data().amount ?? 0), 0);

      const body = yesterdayTotal > 0
        ? `أمس أنفقت ${yesterdayTotal.toLocaleString('ar-IQ')} د.ع — اليوم ما الجديد؟`
        : 'لم تسجّل أي مصروف اليوم — دقيقة واحدة تكفي!';

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '🔔 تدبير',
            body,
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

    return NextResponse.json({ ok: true, slot, sent, skipped });
  } catch (err) {
    console.error('push send error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}
