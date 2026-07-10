// src/lib/category-icons.tsx
// سجلّ مركزي لأيقونات الفئات (Lucide، خطّية أحادية اللون) — مصدر واحد
// يستهلكه getIconComponent (للعرض في كل مكان) ومنتقي الأيقونات في نافذة الفئة.
// أي فئة يضيفها المستخدم تُخزَّن باسم الأيقونة (مثل "Coffee") فتُرسم بنفس ثيم
// الفئات الافتراضية تماماً بدل الإيموجي الملوّن.

import {
  Briefcase, ShoppingCart, Bus, UtensilsCrossed, GraduationCap, Gamepad2,
  HeartPulse, Car, Tv, Gift, Gem, Puzzle,
  Coffee, Pizza, Apple, ShoppingBag, Shirt, Home, Building2, Lightbulb,
  Wrench, Fuel, Plane, Train, Bike, Baby, Cat, Dog, Pill, Stethoscope,
  Book, Pencil, Music, Headphones, Smartphone, Laptop, Film, Camera,
  Dumbbell, Scissors, Sparkles, Wifi, Phone, CreditCard, Wallet, Landmark,
  PiggyBank, Receipt, Cake, PartyPopper, Palette, Bath, Flower2, Umbrella,
  Zap, Flame, Bed, Sofa, Footprints, Watch, Glasses,
  type LucideIcon,
} from 'lucide-react';

// الترتيب مقصود (طعام → بيت → تنقّل → صحة → تعليم → ترفيه → أدوات → مال) —
// أول 12 مفتاحاً هي أيقونات الفئات الافتراضية نفسها.
export const CATEGORY_ICON_MAP: Record<string, LucideIcon> = {
  UtensilsCrossed, Coffee, Pizza, Apple, ShoppingCart, ShoppingBag,
  Home, Building2, Lightbulb, Wrench, Bath, Sofa, Bed, Flower2,
  Car, Bus, Train, Bike, Plane, Fuel,
  HeartPulse, Pill, Stethoscope, Dumbbell,
  GraduationCap, Book, Pencil, Baby,
  Gamepad2, Tv, Film, Music, Headphones, Camera,
  Gift, PartyPopper, Cake, Sparkles,
  Shirt, Footprints, Watch, Glasses, Scissors, Palette, Gem,
  Smartphone, Laptop, Phone, Wifi, Zap, Flame,
  Cat, Dog, Umbrella,
  Briefcase, CreditCard, Wallet, Landmark, PiggyBank, Receipt,
  Puzzle,
};

// قائمة الأسماء المرتّبة لعرضها في شبكة المنتقي.
export const CATEGORY_ICON_NAMES: string[] = Object.keys(CATEGORY_ICON_MAP);
