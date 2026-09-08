import type { MetadataRoute } from 'next';

// النطاق الرسمي — tadbeer.app يحوّل بـ 308 إلى www فالروابط هنا يجب أن تكون بصيغة www
const BASE = 'https://www.tadbeer.app';

// خريطة الموقع تشمل الصفحات العامة فقط — الشاشات المحمية خلف تسجيل الدخول
// تعيد التوجيه إلى /signup فلا قيمة لفهرستها. (صفحة الهبوط رُفعت من المسار
// 2026-07-11 وحُذف ملفها 2026-09-09 — لا تُعِد ذكرها هنا.)
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
