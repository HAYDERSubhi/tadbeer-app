// src/lib/constants.ts
// Note: This file now represents the *default* categories for new users.
// The actual categories used in the app will be a combination of these and user-defined ones.

type DefaultCategory = {
    name: string;
    icon: string; // Storing icon name as string
    id: string;
};

export const DEFAULT_CATEGORIES: Record<string, DefaultCategory> = {
  "food": { name: "الطعام والشراب", icon: "UtensilsCrossed", id: "food" },
  "transport": { name: "النقل والمواصلات", icon: "Bus", id: "transport" },
  "home_supplies": { name: "مستلزمات منزلية", icon: "ShoppingCart", id: "home_supplies" },
  "health": { name: "العلاجات والصحة", icon: "HeartPulse", id: "health" },
  "subscriptions": { name: "اشتراكات متفرقة", icon: "Tv", id: "subscriptions" },
  "personal_luxuries": { name: "الكماليات الشخصية", icon: "Gem", id: "personal_luxuries" },
  "private_car": { name: "السيارة الخاصة", icon: "Car", id: "private_car" },
  "entertainment": { name: "ترفيه", icon: "Gamepad2", id: "entertainment" },
  "education": { name: "تعليم وتطوير", icon: "GraduationCap", id: "education" },
  "gifts_donations": { name: "الهدايا والتبرعات", icon: "Gift", id: "gifts_donations" },
  "home_maintenance": { name: "إدامة المنزل", icon: "Briefcase", id: "home_maintenance" },
  "other": { name: "متفرقة", icon: "Puzzle", id: "other" },
};
