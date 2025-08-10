// src/lib/constants.ts
// Note: This file now represents the *default* categories for new users.
// The actual categories used in the app will be a combination of these and user-defined ones.

type DefaultCategory = {
    name: string;
    icon: string; // Storing icon name as string
    color: string;
    chartColor: string;
    id: string;
};

export const DEFAULT_CATEGORIES: Record<string, DefaultCategory> = {
  "food": { name: "الطعام والشراب", icon: "UtensilsCrossed", color: "bg-orange-500", chartColor: "hsl(var(--chart-1))", id: "food" },
  "transport": { name: "النقل والمواصلات", icon: "Bus", color: "bg-blue-500", chartColor: "hsl(var(--chart-2))", id: "transport" },
  "home_supplies": { name: "مستلزمات منزلية", icon: "ShoppingCart", color: "bg-green-500", chartColor: "hsl(var(--chart-3))", id: "home_supplies" },
  "health": { name: "العلاجات والصحة", icon: "HeartPulse", color: "bg-rose-500", chartColor: "hsl(var(--chart-4))", id: "health" },
  "subscriptions": { name: "اشتراكات متفرقة", icon: "Tv", color: "bg-cyan-500", chartColor: "hsl(var(--chart-5))", id: "subscriptions" },
  "personal_luxuries": { name: "الكماليات الشخصية", icon: "Gem", color: "bg-teal-500", chartColor: "hsl(var(--chart-1))", id: "personal_luxuries" },
  "private_car": { name: "السيارة الخاصة", icon: "Car", color: "bg-red-500", chartColor: "hsl(var(--chart-2))", id: "private_car" },
  "entertainment": { name: "ترفيه", icon: "Gamepad2", color: "bg-purple-500", chartColor: "hsl(var(--chart-3))", id: "entertainment" },
  "education": { name: "تعليم وتطوير", icon: "GraduationCap", color: "bg-indigo-500", chartColor: "hsl(var(--chart-4))", id: "education" },
  "gifts_donations": { name: "الهدايا والتبرعات", icon: "Gift", color: "bg-pink-500", chartColor: "hsl(var(--chart-5))", id: "gifts_donations" },
  "home_maintenance": { name: "إدامة المنزل", icon: "Briefcase", color: "bg-gray-500", chartColor: "hsl(var(--chart-1))", id: "home_maintenance" },
  "other": { name: "متفرقة", icon: "Puzzle", color: "bg-stone-500", chartColor: "hsl(var(--chart-2))", id: "other" },
};
