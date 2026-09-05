// src/lib/feedback-mail.ts
// مشترك بين إشعار الملاحظة الفورية (api/feedback) والملخّص الأسبوعي
// (api/feedback/digest). خادميّ فقط — لا تستورده في مكوّن عميل.

/** أنواع الملاحظة كما تظهر في البريد. */
export const FEEDBACK_TYPE_LABELS: Record<string, string> = {
  suggestion: '💡 اقتراح ميزة',
  bug: '🐛 إبلاغ عن مشكلة',
  compliment: '❤️ إطراء',
  other: '💬 أخرى',
};

/**
 * يمنع حقن HTML من نصّ المستخدم في جسم الرسالة.
 * ⛔ كل نصّ يكتبه المستخدم يمرّ من هنا قبل الإدراج — بدونه يستطيع أي مستخدم
 *    وضع رابط تصيّد في بريد يبدو صادراً من التطبيق.
 */
export const esc = (s: string) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** بريد صالح الشكل فقط — وإلا رفضته خدمة البريد وأسقطت الرسالة كلها. */
export const isEmail = (s: string) =>
  /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/.test(s);

/**
 * الوجهة والمُرسِل من البيئة: تحويل الإشعارات إلى hello@tadbeer.app لا يحتاج
 * نشر كود — يكفي ضبط المتغيّرين في Vercel بعد توثيق النطاق في Resend.
 */
export const feedbackTo = () => process.env.FEEDBACK_TO || 'hayder.subhi@gmail.com';
export const feedbackFrom = () => process.env.FEEDBACK_FROM || 'تدبير <onboarding@resend.dev>';

/** التاريخ بتوقيت بغداد وبأرقام لاتينية — الخادم يعمل بغرينتش. */
export const baghdadStamp = (d: Date = new Date()) =>
  d.toLocaleString('ar-IQ-u-nu-latn', { timeZone: 'Asia/Baghdad' });

/** بريد المُرسِل معزول الاتجاه — بدونه تنقلب الأقواس حول النصّ اللاتيني. */
export const ltr = (s: string) =>
  `<span dir="ltr" style="unicode-bidi:isolate;color:#1a7a5e;">${esc(s)}</span>`;
