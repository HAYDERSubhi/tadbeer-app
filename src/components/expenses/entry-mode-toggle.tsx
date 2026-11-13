"use client";

import { cn } from '@/lib/utils';

export type EntryMode = 'expense' | 'income';

// شريط التبديل أعلى شاشة الإضافة. «مصروف» أول عنصر فيظهر على اليمين دائماً (الاتجاه من `dir="rtl"`
// على الصفحة، بلا أي قلب يدوي).
const OPTIONS: { value: EntryMode; label: string }[] = [
  { value: 'expense', label: 'مصروف' },
  { value: 'income', label: 'دخل' },
];

export function EntryModeToggle({ value, onChange }: { value: EntryMode; onChange: (mode: EntryMode) => void }) {
  return (
    <div
      role="tablist"
      aria-label="نوع الإدخال"
      className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-xl bg-muted p-1"
    >
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-9 rounded-lg text-sm font-semibold transition-colors touch-manipulation',
            value === opt.value ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
