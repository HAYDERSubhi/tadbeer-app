
// src/lib/constants.ts
import {
    Briefcase,
    ShoppingCart,
    Bus,
    UtensilsCrossed,
    GraduationCap,
    Gamepad2,
    HeartPulse,
    Car,
    Tv,
    Gift,
    Gem,
    Puzzle,
} from 'lucide-react';
import React from 'react';

type Category = {
    name: string;
    icon: React.ReactNode;
    color: string;
    chartColor: string;
    id: string;
};

export const CATEGORIES: Record<string, Category> = {
  "home_maintenance": { name: "إدامة المنزل", icon: React.createElement(Briefcase), color: "bg-gray-500", chartColor: "hsl(var(--chart-4))", id: "home_maintenance" },
  "home_supplies": { name: "مستلزمات منزلية", icon: React.createElement(ShoppingCart), color: "bg-green-500", chartColor: "hsl(var(--chart-2))", id: "home_supplies" },
  "transport": { name: "النقل والمواصلات", icon: React.createElement(Bus), color: "bg-blue-500", chartColor: "hsl(var(--chart-1))", id: "transport" },
  "food": { name: "الطعام والشراب", icon: React.createElement(UtensilsCrossed), color: "bg-orange-500", chartColor: "hsl(var(--chart-3))", id: "food" },
  "education": { name: "تعليم وتطوير", icon: React.createElement(GraduationCap), color: "bg-indigo-500", chartColor: "hsl(var(--chart-4))", id: "education" },
  "entertainment": { name: "ترفيه", icon: React.createElement(Gamepad2), color: "bg-purple-500", chartColor: "hsl(var(--chart-4))", id: "entertainment" },
  "health": { name: "العلاجات والصحة", icon: React.createElement(HeartPulse), color: "bg-rose-500", chartColor: "hsl(var(--chart-5))", id: "health" },
  "private_car": { name: "السيارة الخاصة", icon: React.createElement(Car), color: "bg-red-500", chartColor: "hsl(var(--chart-5))", id: "private_car" },
  "subscriptions": { name: "اشتراكات متفرقة", icon: React.createElement(Tv), color: "bg-cyan-500", chartColor: "hsl(var(--chart-2))", id: "subscriptions" },
  "gifts_donations": { name: "الهدايا والتبرعات", icon: React.createElement(Gift), color: "bg-pink-500", chartColor: "hsl(var(--chart-5))", id: "gifts_donations" },
  "personal_luxuries": { name: "الكماليات الشخصية", icon: React.createElement(Gem), color: "bg-teal-500", chartColor: "hsl(var(--chart-2))", id: "personal_luxuries" },
  "other": { name: "متفرقة", icon: React.createElement(Puzzle), color: "bg-stone-500", chartColor: "hsl(var(--chart-4))", id: "other" },
};
