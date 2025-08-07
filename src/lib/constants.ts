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
  "home_maintenance": { name: "إدامة المنزل", icon: "Briefcase", color: "bg-gray-500", chartColor: "hsl(var(--chart-4))", id: "home_maintenance" },
  "home_supplies": { name: "مستلزمات منزلية", icon: "ShoppingCart", color: "bg-green-500", chartColor: "hsl(var(--chart-2))", id: "home_supplies" },
  "transport": { name: "النقل والمواصلات", icon: "Bus", color: "bg-blue-500", chartColor: "hsl(var(--chart-1))", id: "transport" },
  "food": { name: "الطعام والشراب", icon: "UtensilsCrossed", color: "bg-orange-500", chartColor: "hsl(var(--chart-3))", id: "food" },
  "education": { name: "تعليم وتطوير", icon: "GraduationCap", color: "bg-indigo-500", chartColor: "hsl(var(--chart-4))", id: "education" },
  "entertainment": { name: "ترفيه", icon: "Gamepad2", color: "bg-purple-500", chartColor: "hsl(var(--chart-4))", id: "entertainment" },
  "health": { name: "العلاجات والصحة", icon: "HeartPulse", color: "bg-rose-500", chartColor: "hsl(var(--chart-5))", id: "health" },
  "private_car": { name: "السيارة الخاصة", icon: "Car", color: "bg-red-500", chartColor: "hsl(var(--chart-5))", id: "private_car" },
  "subscriptions": { name: "اشتراكات متفرقة", icon: "Tv", color: "bg-cyan-500", chartColor: "hsl(var(--chart-2))", id: "subscriptions" },
  "gifts_donations": { name: "الهدايا والتبرعات", icon: "Gift", color: "bg-pink-500", chartColor: "hsl(var(--chart-5))", id: "gifts_donations" },
  "personal_luxuries": { name: "الكماليات الشخصية", icon: "Gem", color: "bg-teal-500", chartColor: "hsl(var(--chart-2))", id: "personal_luxuries" },
  "other": { name: "متفرقة", icon: "Puzzle", color: "bg-stone-500", chartColor: "hsl(var(--chart-4))", id: "other" },
};
