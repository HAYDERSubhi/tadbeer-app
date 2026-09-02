// src/lib/arabic-plural.ts
// صياغة العدد مع معدوده بالعربية.
//
// «2 أيام» و«5 يوم» و«11 أيام» ليست عربية، لكنها تنتج تلقائياً حين يُلصَق رقم
// متغيّر بجمع ثابت. تكرّر هذا في نصوص يقرأها المستخدم أكثر من مرة، فوُحِّد هنا
// بدل أن تُكتب دالة صياغة في كل ملف.
//
// قاعدة التمييز العربية:
//   1        → مفرد بلا رقم        «يوم واحد»
//   2        → مثنّى بلا رقم        «يومان»
//   3 – 10   → رقم + جمع تكسير      «5 أيام»
//   11 فأكثر → رقم + مفرد منصوب     «15 يوماً»
//
// الصفر يعامَل معاملة 11 فأكثر («0 يوماً») — وهي صياغة صحيحة، لكن الأنسب عادةً
// أن يتولّى المستدعي الصفر بنصّ خاص («اليوم»، «لا شيء») قبل النداء.

// ⚠️ المثنّى وحده يتغيّر بموقعه الإعرابي، وهذا ما يُنسى غالباً:
//   مرفوع (مبتدأ/فاعل)        → «يومان متتاليان من التسجيل»
//   مجرور أو منصوب (بعد حرف)  → «بعد يومين» · «متأخر يومين»
// كتابة «بعد يومان» خطأ صريح، لذلك يأخذ النداء موقع الكلمة في الجملة.

export type ArabicForms = {
  /** المفرد كاملاً بلا رقم — «يوم واحد» · «شارة واحدة» */
  one: string;
  /** المثنّى المرفوع بلا رقم — «يومان» · «شارتان» */
  two: string;
  /** المثنّى المجرور/المنصوب بلا رقم — «يومين» · «شارتين» */
  twoOblique: string;
  /** جمع التكسير بلا رقم، يُسبَق بالعدد 3–10 — «أيام» · «شارات» */
  few: string;
  /** المفرد المنصوب بلا رقم، يُسبَق بالعدد 11+ — «يوماً» · «شارة» */
  many: string;
};

/** موقع العبارة من الجملة — يؤثّر على المثنّى وحده. */
export type ArabicCase = 'nominative' | 'oblique';

/**
 * @example arabicPlural(2, DAY)              → «يومان»            (مرفوع)
 * @example arabicPlural(2, DAY, 'oblique')   → «يومين»            (بعد «بعد»)
 * @example arabicPlural(5, DAY)              → «5 أيام»
 * @example arabicPlural(15, DAY)             → «15 يوماً»
 */
export function arabicPlural(
  count: number,
  forms: ArabicForms,
  grammaticalCase: ArabicCase = 'nominative'
): string {
  const n = Math.abs(Math.trunc(count));
  if (n === 1) return forms.one;
  if (n === 2) return grammaticalCase === 'oblique' ? forms.twoOblique : forms.two;
  if (n >= 3 && n <= 10) return `${n} ${forms.few}`;
  return `${n} ${forms.many}`;
}

/* ── صيغ جاهزة للمعدودات المتكرّرة في التطبيق ─────────────────────────── */

export const DAY: ArabicForms   = { one: 'يوم واحد',   two: 'يومان',  twoOblique: 'يومين',  few: 'أيام',  many: 'يوماً' };
export const BADGE: ArabicForms = { one: 'شارة واحدة', two: 'شارتان', twoOblique: 'شارتين', few: 'شارات', many: 'شارة' };
export const SHARE: ArabicForms = { one: 'سهم واحد',   two: 'سهمان',  twoOblique: 'سهمين',  few: 'أسهم',  many: 'سهماً' };
export const TIME: ArabicForms  = { one: 'مرة واحدة',  two: 'مرتان',  twoOblique: 'مرتين',  few: 'مرات',  many: 'مرة' };
export const MONTH: ArabicForms = { one: 'شهر واحد',   two: 'شهران',  twoOblique: 'شهرين',  few: 'أشهر',  many: 'شهراً' };
