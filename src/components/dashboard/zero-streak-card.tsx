// src/components/dashboard/zero-streak-card.tsx
"use client";

import { useZeroStreak } from '@/hooks/use-zero-streak';
import { cn } from '@/lib/utils';
import { Flame, ShieldCheck, TrendingDown } from 'lucide-react';

function getMessage(streak: number, spentToday: boolean): { title: string; sub: string } {
  if (spentToday) {
    return {
      title: 'أنفقت اليوم',
      sub: 'حافظ على الميزانية وابدأ streak جديداً غداً!',
    };
  }
  if (streak === 0) {
    return {
      title: 'لا توجد مصاريف بعد',
      sub: 'أضف مصاريفك لتبدأ متابعة أيامك الصفرية.',
    };
  }
  if (streak === 1) return { title: 'يوم صفري! 🎯', sub: 'بداية رائعة، واصل غداً!' };
  if (streak < 4)   return { title: `${streak} أيام صفرية 🔥`, sub: 'أنت على الطريق الصحيح!' };
  if (streak < 7)   return { title: `${streak} أيام صفرية 🔥`, sub: 'رائع! تحدّك أسبوع كامل!' };
  if (streak < 14)  return { title: `${streak} يوماً صفرياً 🔥`, sub: 'أسبوع كامل بدون إنفاق — أنت بطل!' };
  return             { title: `${streak} يوماً صفرياً 🏆`, sub: 'إنجاز استثنائي! استمر في التحدي!' };
}

export function ZeroStreakCard() {
  const { streak, spentToday, lastExpenseDate } = useZeroStreak();

  // Don't show if user has no data at all
  if (!lastExpenseDate && streak === 0) return null;

  const { title, sub } = getMessage(streak, spentToday);

  const isActive = !spentToday && streak > 0;
  const isBroken = spentToday;

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 flex items-center gap-4',
        isActive
          ? 'bg-gradient-to-l from-orange-500/10 to-amber-500/10 border border-orange-200 dark:border-orange-800'
          : isBroken
          ? 'bg-muted/40 border border-border'
          : 'bg-muted/40 border border-border'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 text-2xl',
          isActive
            ? 'bg-orange-500/15 text-orange-500'
            : isBroken
            ? 'bg-muted text-muted-foreground'
            : 'bg-muted text-muted-foreground'
        )}
      >
        {isActive ? (
          streak >= 7 ? '🏆' : '🔥'
        ) : isBroken ? (
          <TrendingDown className="w-7 h-7" />
        ) : (
          <ShieldCheck className="w-7 h-7" />
        )}
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'font-bold text-base leading-tight',
          isActive ? 'text-orange-600 dark:text-orange-400' : 'text-foreground'
        )}>
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{sub}</p>
      </div>

      {/* Streak number — big display */}
      {isActive && streak > 0 && (
        <div className="shrink-0 text-right">
          <p className="text-4xl font-black text-orange-500 leading-none">{streak}</p>
          <p className="text-[10px] text-orange-400 font-medium">يوم</p>
        </div>
      )}

      {/* Decorative glow for active streak */}
      {isActive && (
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-orange-400/10 blur-2xl pointer-events-none" />
      )}
    </div>
  );
}
