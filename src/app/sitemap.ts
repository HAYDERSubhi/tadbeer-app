import type { MetadataRoute } from 'next';

// النطاق الرسمي — tadbeer.app يحوّل بـ 308 إلى www فالروابط هنا يجب أن تكون بصيغة www
const BASE = 'https://www.tadbeer.app';

// خريطة الموقع تشمل الصفحات العامة فقط — الشاشات المحمية خلف تسجيل الدخول
// تعيد التوجيه لصفحة الهبوط فلا قيمة لفهرستها.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/landing`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE}/signup`, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE}/login`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
