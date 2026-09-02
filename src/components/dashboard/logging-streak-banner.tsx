"use client";

import { useLoggingStreak } from '@/hooks/use-logging-streak';
import { useAppData } from '@/hooks/use-app-data';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

/**
 * صياغة عربية سليمة لعدد الأيام — الوصف يطابق المعدود:
 * يوم واحد · يومان متتاليان · 3 أيام متتالية · 11 يوماً متتالياً.
 * («2 أيام» و«11 أيام» ليستا عربية.)
 */
function daysStreakPhrase(days: number): string {
  if (days === 1) return 'يوم واحد';
  if (days === 2) return 'يومان متتاليان';
  if (days <= 10) return `${days} أيام متتالية`;
  return `${days} يوماً متتالياً`;
}

export function LoggingStreakBanner() {
  const { isExpensesFetched } = useAppData();
  const { streak, loggedToday, loggedYesterday } = useLoggingStreak();

  if (!isExpensesFetched) return null;

  // Don't show until user has at least 2 days of data
  if (streak < 2 && !loggedYesterday) return null;

  const isAtRisk = !loggedToday && loggedYesterday && streak > 0;
  const isActive = loggedToday && streak >= 2;

  if (!isActive && !isAtRisk) return null;

  return (
    <div
      className={cn(
        'flex items-center justify-between px-4 py-2 text-xs font-medium border-b',
        isAtRisk
          ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
          : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
      )}
    >
      {/* رمز واحد فقط: أيقونة اللهب. هي الوحيدة التي تحمل معلومة — لونها
          يتبدّل مع الحالة (أخضر للسلسلة القائمة، برتقالي عند خطر انقطاعها)،
          بخلاف إيموجي ثابتة. كان الشريط يعرض ثلاثة رموز، اثنان منها لهب. */}
      <span className="flex items-center gap-1.5">
        <Flame
          className={cn('h-3.5 w-3.5 shrink-0', isAtRisk ? 'text-amber-500' : 'text-emerald-500')}
          fill="currentColor"
        />
        {isAtRisk
          ? `استمر بالتسجيل! سجّل مصروف اليوم — ${daysStreakPhrase(streak)}`
          : `${daysStreakPhrase(streak)} من التسجيل`}
      </span>
    </div>
  );
}
