// src/lib/constants.ts
import type { CurrencyCode } from '@/types';
// Note: This file now represents the *default* categories for new users.
// The actual categories used in the app will be a combination of these and user-defined ones.

type DefaultCategory = {
    name: string;
    icon: string; // Storing icon name as string
    id: string;
    color: string; // Storing chart color index
};

export const DEFAULT_CATEGORIES: Record<string, DefaultCategory> = {
  "food": { name: "الطعام والشراب", icon: "UtensilsCrossed", id: "food", color: "1" },
  "transport": { name: "النقل والمواصلات", icon: "Bus", id: "transport", color: "2" },
  "home_supplies": { name: "مستلزمات منزلية", icon: "ShoppingCart", id: "home_supplies", color: "3" },
  "health": { name: "العلاجات والصحة", icon: "HeartPulse", id: "health", color: "4" },
  "subscriptions": { name: "اشتراكات متفرقة", icon: "Tv", id: "subscriptions", color: "5" },
  "personal_luxuries": { name: "الكماليات الشخصية", icon: "Gem", id: "personal_luxuries", color: "1" },
  "private_car": { name: "السيارة الخاصة", icon: "Car", id: "private_car", color: "2" },
  "entertainment": { name: "ترفيه", icon: "Gamepad2", id: "entertainment", color: "3" },
  "education": { name: "تعليم وتطوير", icon: "GraduationCap", id: "education", color: "4" },
  "gifts_donations": { name: "الهدايا والتبرعات", icon: "Gift", id: "gifts_donations", color: "5" },
  "home_maintenance": { name: "إدامة المنزل", icon: "Briefcase", id: "home_maintenance", color: "1" },
  "other": { name: "متفرقة", icon: "Puzzle", id: "other", color: "2" },
};

// ═══════════════ فئات نظامية — تُعرَض ولا تُختار ═══════════════
// «سفر» هي فئة أداة «سفراتي»: تُعيَّن برمجياً على مصاريف السفرات فقط، ولا تظهر
// بأي قائمة اختيار فئة، ولا تُمرَّر لاقتراح الفئة بالذكاء الاصطناعي، ولا تُحفظ
// ضمن فئات المستخدم بالإعدادات (راجع الحارس في services/firestore.ts).
//
// التعريف كامل عمداً (اسم + أيقونة Lucide + لون مخطط) لا معرّفاً عارياً: شاشتا
// الإحصائيات والتقرير الشهري تقرآن الثلاثة من هنا عبر use-categories، فلو نقص
// أحدها ظهرت الفئة بأيقونة احتياطية ولون عشوائي.
// الأيقونة Plane موجودة أصلاً بسجل category-icons.tsx — لم تُضَف أيقونة جديدة.
// اللون "2" من نفس نطاق "1".."5" المستعمل بالفئات الاثنتي عشرة أعلاه.
export const TRAVEL_CATEGORY_ID = 'سفر';

export const SYSTEM_CATEGORIES: Record<string, DefaultCategory> = {
  [TRAVEL_CATEGORY_ID]: { name: 'سفر', icon: 'Plane', id: TRAVEL_CATEGORY_ID, color: '2' },
};

/** معرّفات الفئات النظامية — للاستثناء السريع من قوائم الاختيار والحفظ. */
export const SYSTEM_CATEGORY_IDS = new Set<string>(Object.keys(SYSTEM_CATEGORIES));

// ── العملات ──────────────────────────────────────────────────────────────
// مصدر واحد للحقيقة: تستهلكه واجهة التطبيق عبر use-currency، ومهام الإشعارات
// المجدولة عبر lib/push-server. وُضِع هنا لأن هذا الملف بلا أي تبعية على
// React أو المتصفّح، فيصلح للخادم والعميل معاً.
// ملاحظة: التطبيق لا يحوّل المبالغ بين العملات — يعرض الرقم كما هو مع رمز
// العملة التي اختارها المستخدم.
export const CURRENCIES: Record<CurrencyCode, { symbol: string; name: string; position: 'before' | 'after' }> = {
  IQD: { symbol: 'د.ع', name: 'دينار عراقي', position: 'after' },
  SAR: { symbol: 'ر.س', name: 'ريال سعودي', position: 'after' },
  KWD: { symbol: 'د.ك', name: 'دينار كويتي', position: 'after' },
  AED: { symbol: 'د.إ', name: 'درهم إماراتي', position: 'after' },
  EGP: { symbol: 'ج.م', name: 'جنيه مصري', position: 'after' },
  USD: { symbol: '$', name: 'دولار أمريكي', position: 'before' },
  EUR: { symbol: '€', name: 'يورو', position: 'before' },
  GBP: { symbol: '£', name: 'جنيه إسترليني', position: 'before' },
  TRY: { symbol: '₺', name: 'ليرة تركية', position: 'before' },
};
