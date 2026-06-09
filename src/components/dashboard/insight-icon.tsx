
// src/components/dashboard/insight-icon.tsx
"use client";

import { Trophy, Leaf, Flame, TrendingUp, Lightbulb, Vault, Baby, School, Bot } from 'lucide-react';

export const InsightIcon = ({ name, className }: { name: string; className?: string }) => {
  const icons: { [key: string]: React.ElementType } = {
    Trophy,
    Leaf,
    Flame,
    TrendingUp,
    Lightbulb,
    PiggyBank: Vault,
    Baby,
    School,
  };
  const LucideIcon = icons[name] || Bot; // Fallback to Bot icon to prevent crashes
  return <LucideIcon className={className} />;
};
