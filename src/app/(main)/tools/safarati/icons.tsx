// سفراتي — أيقونات الأداة.
// قاعدة مقفلة: أيقونات Lucide خطّية أحادية اللون حصراً — صفر إيموجي ملوّن داخل شاشات
// الأداة، مطابقةً لسجل أيقونات الفئات المركزي الذي استبدل الإيموجي عمداً.

import {
  Plane, Car, Puzzle,
  Bed, UtensilsCrossed, Bus, ShoppingBag, Camera, Umbrella,
  type LucideIcon,
} from 'lucide-react';
import type { TripCategory, TripType } from '@/types';

export const TRIP_TYPE_ICON: Record<TripType, LucideIcon> = {
  abroad: Plane,
  domestic: Car,
  other: Puzzle,
};

/** أيقونة آمنة: أي نوع قديم غير معروف يرسم أيقونة «أخرى» بلا كسر. */
export const tripTypeIcon = (t: string): LucideIcon => TRIP_TYPE_ICON[t as TripType] ?? Puzzle;

export const TRIP_CATEGORY_ICON: Record<TripCategory, LucideIcon> = {
  transport: Plane,
  stay: Bed,
  food: UtensilsCrossed,
  local: Bus,
  shopping: ShoppingBag,
  activities: Camera,
  emergency: Umbrella,
  other: Puzzle,
};
