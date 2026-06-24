import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { adminDb } from '@/lib/firebase-admin';
import { startOfMonth, endOfMonth, getDaysInMonth, getDate } from 'date-fns';

export const runtime = 'nodejs';

let vapidReady = false;
function ensureVapid() {
  if (vapidReady) return;
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  vapidReady = true;
}

async function handler(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const dayOfMonth = getDate(now);
  const daysInMonth = getDaysInMonth(now);
  const daysLeft = daysInMonth - dayOfMonth;

  // يرسل فقط في آخر 5 أيام من الشهر
  if (daysLeft > 5) {
    return NextResponse.json({ ok: true, skipped: 'not end of month', daysLeft });
  }

  try {
    ensureVapid();
    const db = adminDb();
    const subsSnap = await db.collection('pushSubscriptions').get();
    let sent = 0;
    let skipped = 0;

    for (const subDoc of subsSnap.docs) {
      const { subscription, userId } = subDoc.data() as {
        subscription: webpush.PushSubscription;
        userId: string;
      };
      if (!subscription || !userId) continue;

      // تحقق أن المستخدم مفعّل التذكيرات
      try {
        const settingsSnap = await db.doc(`users/${userId}/settings/main`).get();
        const data = settingsSnap.data() ?? {};
        if (!data.notifications?.dailyReminderEnabled) { skipped++; continue; }

        // احسب إجمالي الإنفاق هذا الشهر مقارنةً بالميزانية
        const budget = data.budget?.totalBudget ?? 0;
        if (!budget) { skipped++; continue; }

        const monthStart = startOfMonth(now).toISOString();
        const monthEnd   = endOfMonth(now).toISOString();
        const expSnap = await db.collection(`users/${userId}/expenses`)
          .where('date', '>=', monthStart)
          .where('date', '<=', monthEnd)
          .get();
        const spent = expSnap.docs.reduce((s, d) => s + (d.data().amount ?? 0), 0);
        const remaining = budget - spent;

        // لا ترسل إذا تجاوز الميزانية بالفعل
        if (remaining <= 0) { skipped++; continue; }

        const body = daysLeft === 0
          ? `آخر يوم في الشهر — تبقى لك ${remaining.toLocaleString('ar-IQ')} د.ع. أحسنت!`
          : `تبقى ${daysLeft} أيام على نهاية الشهر — ميزانيتك المتبقية ${remaining.toLocaleString('ar-IQ')} د.ع 💪`;

        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: '📅 تدبير — ملخص الشهر',
            body,
            icon: '/icon-192x192.png',
            badge: '/icon-192x192.png',
            url: '/',
          })
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 410 || err?.statusCode === 404) {
          await subDoc.ref.delete();
        } else {
          skipped++;
        }
      }
    }

    return NextResponse.json({ ok: true, sent, skipped, daysLeft });
  } catch (err) {
    console.error('month-end push error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// Vercel Cron يستدعي عبر GET؛ نقبل POST أيضاً للاستدعاء اليدوي/الاختبار.
export { handler as GET, handler as POST };
