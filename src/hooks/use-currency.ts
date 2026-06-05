// src/hooks/use-currency.ts
import { useMemo } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import type { CurrencyCode } from '@/types';

export const CURRENCIES: Record<CurrencyCode, { symbol: string; name: string; position: 'before' | 'after' }> = {
  IQD: { symbol: 'د.ع', name: 'دينار عراقي', position: 'after' },
  SAR: { symbol: 'ر.س', name: 'ريال سعودي', position: 'after' },
  KWD: { symbol: 'د.ك', name: 'دينار كويتي', position: 'after' },
  AED: { symbol: 'د.إ', name: 'درهم إماراتي', position: 'after' },
  EGP: { symbol: 'ج.م', name: 'جنيه مصري', position: 'after' },
  USD: { symbol: '$', name: 'دولار أمريكي', position: 'before' },
  EUR: { symbol: '€', name: 'يورو', position: 'before' },
  GBP: { symbol: '£', name: 'جنيه إسترليني', position: 'before' },
  TRY: { symbol: '₺', name: 'ليرة تركية', position: 'before' },
};

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
