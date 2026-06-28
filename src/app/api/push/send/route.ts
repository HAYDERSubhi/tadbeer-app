import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { adminDb } from '@/lib/firebase-admin';
import { startOfDay, endOfDay, subDays } from 'date-fns';

export const runtime = 'nodejs';

// تهيئة VAPID كسولة داخل الطلب — حتى لا تنهار الوحدة بأكملها عند التحميل
// إن كان أي متغيّر مفقوداً (كان هذا سبب فشل الإشعارات).
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

  const { searchParams } = new URL(req.url);
  const slot = searchParams.get('slot') ?? 'evening';

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

      // تحقق من إعداد المستخدم — هل يريد إشعاراً في هذا الوقت؟
      try {
        const settingsSnap = await db.doc(`users/${userId}/settings/main`).get();
        const notifications = settingsSnap.data()?.notifications ?? {};
        if (!notifications.dailyReminderEnabled) { skipped++; continue; }
        const userSlot = notifications.reminderSlot ?? 'evening';
        if (userSlot !== slot) { skipped++; continue; }
      } catch { skipped++; continue; }

      // لا ترسل إذا سجّل مصروفاً اليوم بالفعل
      const todayStart = startOfDay(new Date()).toISOString();
      const todayEnd   = endOfDay(new Date()).toISOString();
      const expSnap = await db.collection(`users/${userId}/expenses`)
        .where('date', '>=', todayStart)
        .where('date', '<=', todayEnd)
        .get();
      if (!expSnap.empty) { skipped++; continue; }

      // جلب مصاريف أمس لتخصيص نص الإشعار
      const yesterday = subDays(new Date(), 1);
      const yStart = startOfDay(yesterday).toISOString();
      const yEnd   = endOfDay(yesterday).toISOString();
      const ySnap = await db.collection(`users/${userId}/expenses`)
        .where('date', '>=', yStart)
        .where('date', '<=', yEnd)
        .get();
      const yesterdayTotal = ySnap.docs.reduce((s, d) => s + (d.data().amount ?? 0), 0);

      // العنوان خطّاف قصير والنص داعم — بلا تكرار اسم التطبيق (يظهر أصلاً في الترويسة).
      const { title, body } = yesterdayTotal > 0
        ? {
            title: 'تتبّع إنفاقك اليوم 📊',
            body: `أمس أنفقت ${yesterdayTotal.toLocaleString('ar-IQ')} د.ع — ماذا عن اليوم؟`,
          }
        : {
            title: 'لم تسجّل أي مصروف اليوم 📝',
            body: 'دقيقة واحدة تكفي لتتبّع إنفاقك.',
          };

      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title,
            body,
            // بلا أيقونة كبيرة (large icon) — يكفي أيقونة التطبيق التي يعرضها النظام،
            // فلا يتكرّر الشعار. الـ badge أيقونة شفّافة (نخلات بيضاء) لشريط الحالة.
            badge: '/badge-96.png',
            url: '/',
          })
        );
        sent++;
      } catch (pushErr: any) {
        if (pushErr?.statusCode === 410 || pushErr?.statusCode === 404) {
          await subDoc.ref.delete();
        }
      }
    }

    return NextResponse.json({ ok: true, slot, sent, skipped });
  } catch (err) {
    console.error('push send error:', err);
    return NextResponse.json({ error: 'server error' }, { status: 500 });
  }
}

// Vercel Cron يستدعي عبر GET؛ نقبل POST أيضاً للاستدعاء اليدوي/الاختبار.
export { handler as GET, handler as POST };
