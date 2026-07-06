// تحويل الأرقام العربية/الفارسية إلى إنكليزية في حقول الإدخال الرقمية.
// يُستدعى قبل أي تنظيف أو parse حتى يتطابق سلوك الإدخال بالنوعين.
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/٫/g, '.')  // الفاصلة العشرية العربية
    .replace(/٬/g, ','); // فاصلة الآلاف العربية
}
