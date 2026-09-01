// src/hooks/use-currency.ts
import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import type { CurrencyCode } from '@/types';
// الجدول انتقل إلى lib/constants ليقرأه الخادم أيضاً (مهام الإشعارات) بلا
// سحب تبعيات React. يُعاد تصديره هنا حفاظاً على مسار الاستيراد القديم.
import { CURRENCIES } from '@/lib/constants';

export { CURRENCIES };

export const useCurrency = () => {
  const { userSettings } = useAppData();

  const currency = useMemo(() => {
    const code: CurrencyCode = userSettings?.currency || 'IQD';
    return { code, ...CURRENCIES[code] };
  }, [userSettings?.currency]);

  const format = (amount: number): string => {
    const num = amount.toLocaleString();
    return currency.position === 'before'
      ? `${currency.symbol}${num}`
      : `${num} ${currency.symbol}`;
  };

  return { currency, format };
};
