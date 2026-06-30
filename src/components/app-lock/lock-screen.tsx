// src/components/app-lock/lock-screen.tsx
"use client";

import { useEffect, useState } from 'react';
import { PinKeypad } from './pin-keypad';
import { verifyPin, disableLock, PIN_LENGTH } from '@/lib/app-lock';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/** Full-screen gate shown on a cold start when the app lock is enabled. */
export function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const { user, signOutUser } = useAuth();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [shake, setShake] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const isGuest = !!user?.isAnonymous;

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

  // Recovery path: clear the lock and sign out so the user proves account
  // ownership by logging in again. The (main) layout redirects to /landing
  // once auth resolves to null.
  const handleForgot = async () => {
    try {
      disableLock();
      await signOutUser();
    } catch {
      toast({
        title: 'تعذّر تسجيل الخروج',
        description: 'تحقق من الاتصال وحاول مجدداً.',
        variant: 'destructive',
      });
    }
  };

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

      <button
        type="button"
        onClick={() => setShowForgot(true)}
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        نسيت الرمز؟
      </button>

      <AlertDialog open={showForgot} onOpenChange={setShowForgot}>
        <AlertDialogContent className="text-right">
          <AlertDialogHeader>
            <AlertDialogTitle>نسيت الرمز؟</AlertDialogTitle>
            <AlertDialogDescription className="leading-relaxed">
              {isGuest
                ? 'سنسجّل خروجك لتدخل من جديد ويُلغى القفل. تنبيه: أنت تستخدم حساب زائر، فستُفقد بياناتك المؤقتة على هذا الجهاز. هل تريد المتابعة؟'
                : 'سنسجّل خروجك لتدخل بحسابك من جديد ويُلغى القفل. بياناتك محفوظة في حسابك ولن تتأثر. هل تريد المتابعة؟'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForgot}
              className={isGuest ? 'bg-destructive hover:bg-destructive/90' : ''}
            >
              تسجيل الخروج
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
