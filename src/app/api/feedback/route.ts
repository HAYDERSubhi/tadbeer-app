// src/app/api/feedback/route.ts
// يُشعر صاحب التطبيق بملاحظة جديدة عبر Resend. الحفظ الدائم في Firestore
// يتم من العميل (addFeedback) — هذا المسار للإشعار وحده.
//
// ⚠️ ثلاث نقاط أمنية عولجت هنا (2026-09-05):
//   1) كان يثق بالعميل كلياً: أي طرف يستطيع نداء المسار بأي اسم وبريد.
//      الآن يُتحقَّق من رمز الجلسة، وتُؤخذ الهوية من الرمز لا من الجسم.
//   2) كان يُدرج نصّ المستخدم خاماً في HTML الرسالة، فيستطيع أي مستخدم
//      حقن رابط تصيّد في بريد يبدو صادراً من التطبيق. الآن يُهرَّب كل نصّ.
//   3) كان يُعيد تفاصيل خطأ الخادم إلى العميل. الآن رسالة عامّة.
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminAuth } from '@/lib/firebase-admin';
import { FEEDBACK_TYPE_LABELS, esc, isEmail, ltr, feedbackTo, feedbackFrom, baghdadStamp } from '@/lib/feedback-mail';

export const runtime = 'nodejs';

const MAX_SUBJECT = 200;
const MAX_DETAILS = 5000;

export async function POST(req: NextRequest) {
  try {
    // ── الهوية من رمز الجلسة، لا من جسم الطلب ──
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
    // حساب الضيف بلا بريد: تُقبل ملاحظته ولا يمكن الردّ عليها.
    const senderEmail = typeof decoded.email === 'string' ? decoded.email : '';
    const senderName = typeof decoded.name === 'string' && decoded.name ? decoded.name : 'مستخدم';

    const body = await req.json() as { type?: string; subject?: string; details?: string };
    const type = typeof body.type === 'string' && body.type in FEEDBACK_TYPE_LABELS ? body.type : 'other';
    const subject = (typeof body.subject === 'string' ? body.subject : '').trim().slice(0, MAX_SUBJECT) || 'بدون موضوع';
    const details = (typeof body.details === 'string' ? body.details : '').trim().slice(0, MAX_DETAILS);

    if (!details) {
      return NextResponse.json({ error: 'التفاصيل مطلوبة' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'مفتاح البريد غير مضبوط' }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const typeLabel = FEEDBACK_TYPE_LABELS[type];
    // الخادم يعمل بتوقيت غرينتش. بلا منطقة زمنية صريحة كانت ملاحظة الساعة
    // 2:49 صباحاً بتوقيت بغداد تُكتب «11:49 م» من **اليوم السابق** — أي أن
    // التاريخ نفسه خطأ لا الساعة فقط (مرصود في بريد حقيقي 2026-09-05).
    // ‏-u-nu-latn: أرقام لاتينية لا عربية-هندية — التطبيق كلّه يعرض 125,000
    // لا ١٢٥٬٠٠٠، والفاحص الآلي كان يرصد هذا السطر مخالفاً.
    const sentAt = baghdadStamp();
    // بلا عزل اتجاهي كان البريد يظهر «<<hayder@gmail.com» — الأقواس تنقلب
    // بصرياً حول نصّ لاتيني داخل فقرة عربية. سطران منفصلان أوضح وأسلم.
    const senderLine = senderEmail
      ? `${esc(senderName)}<br>${ltr(senderEmail)}`
      : `${esc(senderName)} — حساب ضيف، لا يمكن الردّ`;

    await resend.emails.send({
      from: feedbackFrom(),
      to: feedbackTo(),
      // ⭐ الردّ بضغطة واحدة: «رد» في صندوق البريد يذهب إلى المستخدم مباشرةً،
      //    من نفس العنوان الذي وصلت إليه الملاحظة. لا حاجة لنسخ بريده يدوياً.
      ...(senderEmail && isEmail(senderEmail) ? { replyTo: senderEmail } : {}),
      subject: `[تدبير] ${typeLabel}: ${subject}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#f9f9f9;padding:24px;border-radius:12px;">
          <div style="background:#1a7a5e;padding:16px 24px;border-radius:8px;margin-bottom:20px;">
            <h2 style="color:white;margin:0;font-size:18px;">📬 ملاحظة جديدة من مستخدم تدبير</h2>
          </div>
          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;overflow:hidden;">
            <tr style="background:#f0faf6;">
              <td style="padding:10px 16px;font-weight:bold;color:#555;width:30%;">النوع</td>
              <td style="padding:10px 16px;font-size:16px;">${typeLabel}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#555;">الموضوع</td>
              <td style="padding:10px 16px;">${esc(subject)}</td>
            </tr>
            <tr style="background:#f0faf6;">
              <td style="padding:10px 16px;font-weight:bold;color:#555;">المستخدم</td>
              <td style="padding:10px 16px;">${senderLine}</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#555;">التاريخ</td>
              <td style="padding:10px 16px;">${esc(sentAt)}</td>
            </tr>
          </table>
          <div style="background:white;border-right:4px solid #1a7a5e;padding:16px;margin-top:16px;border-radius:4px;">
            <p style="font-weight:bold;color:#555;margin:0 0 8px;">التفاصيل:</p>
            <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${esc(details)}</p>
          </div>
          <p style="text-align:center;color:#aaa;font-size:12px;margin-top:20px;">اضغط «رد» للإجابة على صاحب الملاحظة مباشرةً</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    // لا يُسجَّل نصّ الملاحظة ولا بريد صاحبها — سجلّات الخادم تبقى إلى الأبد.
    console.error('feedback route error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ error: 'تعذّر إرسال الإشعار' }, { status: 500 });
  }
}
