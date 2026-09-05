// src/app/api/feedback/digest/route.ts
// الملخّص الأسبوعي: شبكة أمان ثانية للملاحظات.
//
// لماذا: الإشعار الفوري يعتمد على خدمة بريد خارجية. لو تعثّرت في ملاحظة،
// تبقى الملاحظة محفوظة في Firestore — لكن صاحب التطبيق لا يعلم بوجودها.
// هذا حدث فعلاً: ستّ ملاحظات مخزّنة ولا علم له بأربع منها (2026-09-05).
// هذا المسار يقرأ من قاعدة البيانات مباشرةً لا من نظام البريد، فلكي تفوت
// ملاحظةٌ يجب أن يفشل الطريقان معاً.
//
// النافذة: من آخر تشغيل ناجح إلى الآن. وأوّل تشغيل بلا علامة سابقة يشمل
// **كل التاريخ** — وبه تصل الملاحظات القديمة المتراكمة منذ آب 2025.
import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { adminDb, adminAuth } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import {
  FEEDBACK_TYPE_LABELS, esc, ltr, feedbackTo, feedbackFrom, baghdadStamp,
} from '@/lib/feedback-mail';

export const runtime = 'nodejs';
export const maxDuration = 60;

/** موضع علامة آخر تشغيل — مستند إداريّ لا يقرأه أي عميل (القواعد تمنع). */
const MARKER = { col: 'meta', doc: 'feedbackDigest' };
/** سقف يمنع رسالة عملاقة لو تراكمت الملاحظات؛ الباقي يأتي بالأسبوع التالي. */
const MAX_ITEMS = 100;

type Note = {
  type?: string; subject?: string; details?: string; uid?: string;
  createdAt?: Timestamp; sentAt?: string;
};

export async function GET(req: NextRequest) {
  try {
    if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return NextResponse.json({ ok: false, error: 'مفتاح البريد غير مضبوط' }, { status: 500 });
    }

    const db = adminDb();
    const markerRef = db.collection(MARKER.col).doc(MARKER.doc);
    const markerSnap = await markerRef.get();
    const lastRunAt: Timestamp | null = markerSnap.exists
      ? (markerSnap.get('lastRunAt') as Timestamp | undefined) ?? null
      : null;

    // بلا علامة ⇒ أوّل تشغيل ⇒ كل التاريخ (وبه تصل المتراكمات القديمة).
    let q = db.collection('feedback').orderBy('createdAt', 'asc').limit(MAX_ITEMS + 1);
    if (lastRunAt) q = db.collection('feedback')
      .where('createdAt', '>', lastRunAt).orderBy('createdAt', 'asc').limit(MAX_ITEMS + 1);

    const snap = await q.get();
    const docs = snap.docs.slice(0, MAX_ITEMS);
    const truncated = snap.size > MAX_ITEMS;

    // لا ملاحظات ⇒ لا رسالة إطلاقاً. العلامة تُحدَّث كي لا تكبر النافذة.
    if (docs.length === 0) {
      await markerRef.set({ lastRunAt: Timestamp.now() }, { merge: true });
      return NextResponse.json({ ok: true, sent: false, count: 0 });
    }

    // هوية أصحاب الملاحظات تُجلب من Firebase Auth عبر uid — فحتى الملاحظات
    // القديمة التي لم تحفظ اسماً ولا بريداً يمكن الردّ عليها.
    const rows = await Promise.all(docs.map(async (d) => {
      const n = d.data() as Note;
      let name = 'مستخدم', email = '';
      if (n.uid) {
        try {
          const u = await adminAuth().getUser(n.uid);
          name = u.displayName || 'مستخدم';
          email = u.email || '';
        } catch { name = 'مستخدم (حُذف حسابه)'; }
      }
      const when = n.createdAt?.toDate ? baghdadStamp(n.createdAt.toDate()) : (n.sentAt || '—');
      return { n, name, email, when };
    }));

    const cards = rows.map(({ n, name, email, when }) => `
      <div style="background:white;border-right:4px solid #1a7a5e;border-radius:6px;padding:14px 16px;margin-bottom:12px;">
        <div style="font-size:13px;color:#777;margin-bottom:6px;">
          ${esc(FEEDBACK_TYPE_LABELS[n.type ?? 'other'] ?? FEEDBACK_TYPE_LABELS.other)}
          &nbsp;·&nbsp; ${esc(when)}
        </div>
        <div style="font-weight:bold;margin-bottom:8px;">${esc(n.subject || 'بدون موضوع')}</div>
        <div style="line-height:1.7;white-space:pre-wrap;margin-bottom:10px;">${esc(n.details || '')}</div>
        <div style="font-size:13px;color:#555;border-top:1px solid #eee;padding-top:8px;">
          ${esc(name)}${email ? `<br>${ltr(email)} &nbsp;<a href="mailto:${encodeURIComponent(email)}" style="color:#1a7a5e;">ردّ</a>` : ' — لا بريد، تعذّر الردّ'}
        </div>
      </div>`).join('');

    const period = lastRunAt
      ? `منذ ${esc(baghdadStamp(lastRunAt.toDate()))}`
      : 'كل الملاحظات المخزَّنة منذ البداية';

    const resend = new Resend(resendKey);
    await resend.emails.send({
      from: feedbackFrom(),
      to: feedbackTo(),
      subject: `[تدبير] ملخّص الملاحظات — ${docs.length}`,
      html: `
        <div dir="rtl" style="font-family:Arial,sans-serif;max-width:640px;margin:auto;background:#f9f9f9;padding:24px;border-radius:12px;">
          <div style="background:#1a7a5e;padding:16px 24px;border-radius:8px;margin-bottom:8px;">
            <h2 style="color:white;margin:0;font-size:18px;">🗂️ ملخّص ملاحظات المستخدمين</h2>
          </div>
          <p style="color:#666;font-size:13px;margin:0 0 16px;">
            ${docs.length} ملاحظة · ${period}
            ${truncated ? '<br><strong>وهناك المزيد — يصلك في الملخّص التالي.</strong>' : ''}
          </p>
          ${cards}
          <p style="text-align:center;color:#aaa;font-size:12px;margin-top:20px;">
            تصلك هذه الرسالة أسبوعياً، وتُقرأ من قاعدة البيانات مباشرةً — فلا تضيع ملاحظة إن تعثّر إشعارها الفوري.
          </p>
        </div>`,
    });

    // العلامة تُحدَّث بعد نجاح الإرسال فقط: لو فشل البريد تُعاد المحاولة
    // بالأسبوع القادم على النافذة نفسها ولا تُفقد ملاحظة.
    await markerRef.set({ lastRunAt: Timestamp.now() }, { merge: true });
    return NextResponse.json({ ok: true, sent: true, count: docs.length, truncated });
  } catch (err) {
    // لا يُسجَّل نصّ الملاحظات ولا بريد أصحابها — سجلّات الخادم تبقى للأبد.
    console.error('feedback digest error:', err instanceof Error ? err.message : 'unknown');
    return NextResponse.json({ ok: false, error: 'تعذّر إرسال الملخّص' }, { status: 500 });
  }
}
