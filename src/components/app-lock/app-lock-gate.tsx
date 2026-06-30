// src/components/app-lock/app-lock-gate.tsx
"use client";

import { useEffect, useState } from 'react';
import { isLockEnabled } from '@/lib/app-lock';
import { LockScreen } from './lock-screen';

/**
 * Wraps the authenticated app. Because this component mounts once per cold
 * start (client navigations don't remount the layout, and backgrounding the
 * PWA keeps it alive), the lock is asked ONLY when the app is freshly opened —
 * never on in-app navigation or when returning from another app.
 *
 * `null` (undetermined) → blank background for one frame while we read
 * localStorage on the client; this avoids both a hydration mismatch and any
 * flash of real content before the lock appears.
 */
export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    setLocked(isLockEnabled());
  }, []);

  if (locked === null) {
    return <div className="fixed inset-0 bg-background" />;
  }
  if (locked) {
    return <LockScreen onUnlock={() => setLocked(false)} />;
  }
  return <>{children}</>;
}
