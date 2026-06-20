// src/app/api/feedback/route.ts
// Saves feedback and emails the founder. Uses Resend only — no firebase-admin
// needed here since we trust the uid sent by the authenticated client and the
// real data persistence is handled client-side via Firestore SDK.
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const runtime = 'nodejs';

const FOUNDER_EMAIL = 'hayder.subhi@gmail.com';

const TYPE_LABELS: Record<string, string> = {
  suggestion: '💡 اقتراح ميزة',
  bug: '🐛 إبلاغ عن مشكلة',
  compliment: '❤️ إطراء',
  other: '💬 أخرى',
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      type?: string;
      subject?: string;
      details?: string;
      displayName?: string;
      email?: string;
    };

    const type = body.type || 'other';
    const subject = (body.subject || '').trim() || 'بدون موضوع';
    const details = (body.details || '').trim();
    const displayName = body.displayName || 'مستخدم';
    const email = body.email || 'مجهول';

    if (!details) {
      return NextResponse.json({ error: 'التفاصيل مطلوبة' }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ error: 'مفتاح البريد غير مضبوط' }, { status: 500 });
    }

    const resend = new Resend(resendKey);
    const typeLabel = TYPE_LABELS[type] || TYPE_LABELS.other;
    const sentAt = new Date().toLocaleString('ar-IQ');

    await resend.emails.send({
      from: 'تدبير <onboarding@resend.dev>',
      to: FOUNDER_EMAIL,
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
              <td style="padding:10px 16px;">${subject}</td>
            </tr>
            <tr style="background:#f0faf6;">
              <td style="padding:10px 16px;font-weight:bold;color:#555;">المستخدم</td>
              <td style="padding:10px 16px;">${displayName} &lt;${email}&gt;</td>
            </tr>
            <tr>
              <td style="padding:10px 16px;font-weight:bold;color:#555;">التاريخ</td>
              <td style="padding:10px 16px;">${sentAt}</td>
            </tr>
          </table>
          <div style="background:white;border-right:4px solid #1a7a5e;padding:16px;margin-top:16px;border-radius:4px;">
            <p style="font-weight:bold;color:#555;margin:0 0 8px;">التفاصيل:</p>
            <p style="margin:0;line-height:1.7;white-space:pre-wrap;">${details}</p>
          </div>
          <p style="text-align:center;color:#aaa;font-size:12px;margin-top:20px;">تدبير — مساعدك المالي الذكي</p>
        </div>
      `,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('feedback route error:', err);
    return NextResponse.json({ error: `فشل إرسال البريد: ${String(err)}` }, { status: 500 });
  }
}
