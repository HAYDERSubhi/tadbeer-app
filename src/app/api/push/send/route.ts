import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { adminDb } from '@/lib/firebase-admin';
import {
  baghdadDayRange,
  baghdadPreviousDayRange,
  expensesPath,
  fetchExpensesInRange,
  formatAmount,
  resolvePushSettings,
  sumAmounts,
} from '@/lib/push-server';

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

    // حدود اليوم وأمس بتوقيت بغداد — تُحسَب مرّة واحدة فيرى كل المستخدمين
    // نفس اليوم مهما طال تنفيذ المهمة.
    const today = baghdadDayRange();
    const yesterday = baghdadPreviousDayRange();

    let sent = 0;
    let skipped = 0;

    for (const subDoc of subsSnap.docs) {
      const { subscription, userId } = subDoc.data() as {
        subscription: webpush.PushSubscription;
        userId: string;
      };
      if (!subscription || !userId) continue;

      // تحقق من إعداد المستخدم — هل يريد إشعاراً في هذا الوقت؟
      let settings;
      try {
        settings = await resolvePushSettings(db, userId);
      } catch (err) {
        console.error('push send: settings read failed', userId, err);
        skipped++;
        continue;
      }
      if (!settings || !settings.dailyReminderEnabled) { skipped++; continue; }
      if (settings.reminderSlot !== slot) { skipped++; continue; }

      // المسار المزدوج: عضو العائلة مصاريفه في الحاوية المشتركة لا الشخصية.
      const path = expensesPath(userId, settings.householdId);

      // لا ترسل إذا سُجِّل مصروف اليوم بالفعل.
      // ⚠️ عند فشل القراءة لا نرسل — تفويت تذكير أهون من اتّهام المستخدم
      // بأنه لم يسجّل شيئاً وهو سجّل.
      let loggedToday: number;
      try {
        loggedToday = (await fetchExpensesInRange(db, path, today)).length;
      } catch (err) {
        console.error('push send: today lookup failed', userId, err);
        skipped++;
        continue;
      }
      if (loggedToday > 0) { skipped++; continue; }

      // جلب مصاريف أمس لتخصيص نص الإشعار (فشلها يُسقِط التخصيص فقط).
      let yesterdayTotal = 0;
      try {
        yesterdayTotal = sumAmounts(await fetchExpensesInRange(db, path, yesterday));
      } catch (err) {
        console.error('push send: yesterday lookup failed', userId, err);
      }

      const isShared = !!settings.householdId;

      // العنوان خطّاف قصير والنص داعم — بلا تكرار اسم التطبيق (يظهر أصلاً في الترويسة).
      const { title, body } = yesterdayTotal > 0
        ? {
            title: 'تتبّع إنفاقك اليوم 📊',
            body: isShared
              ? `أمس سجّلت عائلتك ${formatAmount(yesterdayTotal)} د.ع — ماذا عن اليوم؟`
              : `أمس أنفقت ${formatAmount(yesterdayTotal)} د.ع — ماذا عن اليوم؟`,
          }
        : {
            title: isShared ? 'لم يُسجَّل أي مصروف اليوم 📝' : 'لم تسجّل أي مصروف اليوم 📝',
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
