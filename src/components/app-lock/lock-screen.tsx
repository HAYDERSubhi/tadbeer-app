// src/components/app-lock/lock-screen.tsx
"use client";

import { useEffect, useState } from 'react';
import { PinKeypad } from './pin-keypad';
import { verifyPin, PIN_LENGTH } from '@/lib/app-lock';

/** Full-screen gate shown on a cold start when the app lock is enabled. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;
    let cancelled = false;
    verifyPin(pin).then(ok => {
      if (cancelled) return;
      if (ok) {
        onUnlock();
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          setPin('');
        }, 450);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [pin, onUnlock]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-12 bg-background p-6">
      <div className="flex flex-col items-center gap-3">
        <img
          src="/logo.png"
          alt="تدبير"
          className="h-20 w-20 object-contain dark:brightness-0 dark:invert"
        />
        <p className="text-sm text-muted-foreground">أدخل رمز القفل للمتابعة</p>
      </div>
      <PinKeypad value={pin} onChange={setPin} shake={shake} />
    </div>
  );
}
