// src/components/app-lock/app-lock-setting.tsx
"use client";

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { isLockEnabled } from '@/lib/app-lock';
import { AppLockDialog } from './app-lock-dialog';

/** "الأمان" row in Settings → التخصيص: toggle the device app lock. */
export function AppLockSetting() {
  const [enabled, setEnabled] = useState(false);
  const [dialog, setDialog] = useState<null | 'setup' | 'disable'>(null);

  // Read after mount to avoid SSR/localStorage mismatch.
  useEffect(() => {
    setEnabled(isLockEnabled());
  }, []);

  return (
    <div>
      <h3 className="mb-3 text-sm font-medium">الأمان</h3>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <div className="flex items-center gap-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
          <div className="space-y-0.5">
            <Label className="text-sm font-medium">قفل التطبيق</Label>
            <p className="text-xs text-muted-foreground">
              {enabled
                ? 'يُطلب رمز من 4 أرقام عند فتح التطبيق.'
                : 'فعّل لطلب رمز من 4 أرقام عند فتح التطبيق.'}
            </p>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={v => setDialog(v ? 'setup' : 'disable')}
          aria-label="قفل التطبيق"
        />
      </div>

      {dialog && (
        <AppLockDialog
          mode={dialog}
          onClose={() => setDialog(null)}
          onDone={() => {
            setEnabled(isLockEnabled());
            setDialog(null);
          }}
        />
      )}
    </div>
  );
}
