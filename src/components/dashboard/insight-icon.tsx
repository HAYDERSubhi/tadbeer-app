
// src/components/dashboard/insight-icon.tsx
"use client";

import { Trophy, Salad, CookingPot, TrendingUp, Lightbulb, PiggyBank, Baby, School, Sparkles } from 'lucide-react';

export const InsightIcon = ({ name, className }: { name: string; className?: string }) => {
  const icons: { [key: string]: React.ElementType } = {
    Trophy,
    Salad,
    CookingPot,
    TrendingUp,
    Lightbulb,
    PiggyBank,
    Baby,
    School,
  };
  const LucideIcon = icons[name] || Sparkles;
  return <LucideIcon className={className} />;
};
