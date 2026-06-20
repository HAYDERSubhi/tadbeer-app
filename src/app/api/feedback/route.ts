// src/app/api/feedback/route.ts
import { NextRequest, NextResponse } from 'next/server';

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
    // Lazy-import so any init error is caught inside the try block
    const { adminDb, adminAuth } = await import('@/lib/firebase-admin');
    const { FieldValue } = await import('firebase-admin/firestore');
    const { Resend } = await import('resend');

    // 1. Verify identity
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 });

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'جلسة غير صالحة' }, { status: 401 });
    }

    const body = await req.json() as { type?: string; subject?: string; details?: string };
    const type = body.type || 'other';
    const subject = (body.subject || '').trim() || 'بدون موضوع';
    const details = (body.details || '').trim();

    if (!details) {
      return NextResponse.json({ error: 'التفاصيل مطلوبة' }, { status: 400 });
    }

    const db = adminDb();
    const sentAt = new Date().toISOString();

    // 2. Save to Firestore
    await db.collection('feedback').add({
      uid: decoded.uid,
      email: decoded.email || 'مجهول',
      displayName: decoded.name || 'مستخدم',
      type,
      subject,
      details,
      sentAt,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 3. Send email via Resend (non-blocking — don't fail if email errors)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        const resend = new Resend(resendKey);
        const typeLabel = TYPE_LABELS[type] || TYPE_LABELS.other;
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
                  <td style="padding:10px 16px;">${decoded.name || 'مستخدم'} &lt;${decoded.email || 'مجهول'}&gt;</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:bold;color:#555;">التاريخ</td>
                  <td style="padding:10px 16px;">${new Date(sentAt).toLocaleString('ar-IQ')}</td>
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
      } catch (emailErr) {
        // Email failure is logged but doesn't fail the request — data is already saved
        console.error('Resend email error:', emailErr);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('feedback route error:', err);
    return NextResponse.json({ error: 'حدث خطأ في الخادم، حاول مجدداً' }, { status: 500 });
  }
}
