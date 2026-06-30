// src/components/app-lock/app-lock-dialog.tsx
"use client";

import { useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { PinKeypad } from './pin-keypad';
import { setPin as savePin, verifyPin, disableLock, PIN_LENGTH } from '@/lib/app-lock';
import { useToast } from '@/hooks/use-toast';

type Mode = 'setup' | 'disable';

/**
 * Full-screen overlay used from Settings to either create a PIN (setup:
 * enter → confirm) or remove the lock (disable: verify the current PIN first).
 */
export function AppLockDialog({
  mode,
  onClose,
  onDone,
}: {
  mode: Mode;
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [first, setFirst] = useState('');
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);

  const fail = () => {
    setShake(true);
    setTimeout(() => {
      setShake(false);
      setPin('');
    }, 450);
  };

  useEffect(() => {
    if (pin.length !== PIN_LENGTH) return;

    if (mode === 'disable') {
      verifyPin(pin).then(ok => {
        if (ok) {
          disableLock();
          toast({ title: 'تم إيقاف القفل' });
          onDone();
        } else {
          fail();
        }
      });
      return;
    }

    // setup
    if (step === 'enter') {
      setFirst(pin);
      setPin('');
      setStep('confirm');
    } else if (pin === first) {
      savePin(pin).then(() => {
        toast({ title: 'تم تفعيل القفل ✓', description: 'سيُطلب الرمز عند فتح التطبيق.' });
        onDone();
      });
    } else {
      toast({ title: 'الرمزان غير متطابقين', description: 'حاول مرة أخرى.', variant: 'destructive' });
      setFirst('');
      setStep('enter');
      fail();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin]);

  const title =
    mode === 'disable'
      ? 'أدخل الرمز لإيقاف القفل'
      : step === 'enter'
        ? 'أنشئ رمزاً من 4 أرقام'
        : 'أعد إدخال الرمز للتأكيد';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-background">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted"
          aria-label="رجوع"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
        <span className="text-sm font-semibold">قفل التطبيق</span>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-12 p-6">
        <p className="text-base font-medium">{title}</p>
        <PinKeypad value={pin} onChange={setPin} shake={shake} />
      </div>
    </div>
  );
}
