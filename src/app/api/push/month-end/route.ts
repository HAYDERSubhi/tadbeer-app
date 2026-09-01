import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { adminDb } from '@/lib/firebase-admin';
import {
  baghdadMonthInfo,
  expensesPath,
  fetchExpensesInRange,
  formatAmount,
  resolvePushSettings,
  sumAmounts,
} from '@/lib/push-server';

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

/** صياغة عربية سليمة للمدّة المتبقية (المدى هنا من يوم إلى خمسة). */
function remainingDaysPhrase(daysLeft: number): string {
  if (daysLeft === 1) return 'يوم واحد';
  if (daysLeft === 2) return 'يومان';
  return `${daysLeft} أيام`;
}

async function handler(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // حدود الشهر وموقع اليوم منه بتوقيت بغداد لا بتوقيت الخادم.
  const month = baghdadMonthInfo();
  const daysLeft = month.daysLeft;

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

      try {
        // تحقق أن المستخدم مفعّل التذكيرات.
        // الميزانية تُقرأ من العائلة عند وجودها — المستند الشخصي يحتفظ بنسخة
        // قديمة منها بعد الانضمام، وقراءتها منه تعطي رقماً خاطئاً.
        const settings = await resolvePushSettings(db, userId);
        if (!settings || !settings.dailyReminderEnabled) { skipped++; continue; }

        const budget = settings.totalBudget;
        if (!budget) { skipped++; continue; }

        // احسب إجمالي الإنفاق هذا الشهر مقارنةً بالميزانية.
        // ⚠️ عند فشل القراءة لا نرسل — رقم متبقٍّ خاطئ أسوأ من عدم الإرسال.
        const path = expensesPath(userId, settings.householdId);
        let spent: number;
        try {
          spent = sumAmounts(await fetchExpensesInRange(db, path, month));
        } catch (readErr) {
          console.error('month-end: spending lookup failed', userId, readErr);
          skipped++;
          continue;
        }

        const remaining = budget - spent;

        // لا ترسل إذا تجاوز الميزانية بالفعل
        if (remaining <= 0) { skipped++; continue; }

        const body = daysLeft === 0
          ? `آخر يوم في الشهر — تبقى لك ${formatAmount(remaining)} د.ع. أحسنت!`
          : `تبقى ${remainingDaysPhrase(daysLeft)} على نهاية الشهر — ميزانيتك المتبقية ${formatAmount(remaining)} د.ع 💪`;

        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: 'ملخص نهاية الشهر 📅',
            body,
            // بلا أيقونة كبيرة لتفادي تكرار الشعار؛ الـ badge أيقونة شفّافة لشريط الحالة.
            badge: '/badge-96.png',
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
