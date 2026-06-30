// src/components/app-lock/pin-keypad.tsx
"use client";

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PIN_LENGTH } from '@/lib/app-lock';

/**
 * Presentational numeric keypad for entering a PIN.
 * The parent owns `value` and reacts when it reaches PIN_LENGTH.
 */
export function PinKeypad({
  value,
  onChange,
  shake = false,
}: {
  value: string;
  onChange: (next: string) => void;
  shake?: boolean;
}) {
  const press = (digit: string) => {
    if (value.length < PIN_LENGTH) onChange(value + digit);
  };
  const backspace = () => onChange(value.slice(0, -1));

  return (
    <div className="flex flex-col items-center gap-10">
      {/* PIN dots */}
      <div className={cn('flex gap-4', shake && 'animate-pin-shake')}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-colors',
              i < value.length ? 'border-primary bg-primary' : 'border-muted-foreground/40'
            )}
          />
        ))}
      </div>

      {/* Number pad */}
      <div className="grid grid-cols-3 gap-x-6 gap-y-4">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
          <KeyButton key={n} onClick={() => press(String(n))}>
            {n}
          </KeyButton>
        ))}
        <span aria-hidden />
        <KeyButton onClick={() => press('0')}>0</KeyButton>
        <KeyButton onClick={backspace} aria-label="حذف">
          <Delete className="h-6 w-6" />
        </KeyButton>
      </div>
    </div>
  );
}

function KeyButton({
  children,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-muted/60 text-3xl font-semibold text-foreground transition-all active:scale-95 active:bg-primary/15"
      {...props}
    >
      {children}
    </button>
  );
}
