// src/lib/constants.ts
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
