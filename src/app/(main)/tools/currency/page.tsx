'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, RefreshCw, WifiOff } from 'lucide-react';
import Link from 'next/link';
import { useExchangeRates } from '@/hooks/use-exchange-rates';

const SUPPORTED = [
  { code: 'IQD', name: 'دينار عراقي',    symbol: 'د.ع',  flag: '🇮🇶' },
  { code: 'USD', name: 'دولار أمريكي',   symbol: '$',    flag: '🇺🇸' },
  { code: 'AED', name: 'درهم إماراتي',   symbol: 'د.إ',  flag: '🇦🇪' },
  { code: 'SAR', name: 'ريال سعودي',     symbol: 'ر.س',  flag: '🇸🇦' },
  { code: 'EUR', name: 'يورو',           symbol: '€',    flag: '🇪🇺' },
  { code: 'TRY', name: 'ليرة تركية',     symbol: '₺',    flag: '🇹🇷' },
];

function formatAmount(n: number, code: string): string {
  if (n === 0) return '0';
  if (code === 'IQD') return Math.round(n).toLocaleString('ar-IQ');
  return n.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

export default function CurrencyPage() {
  const { convert, loading, offline, updatedAt } = useExchangeRates();
  const [amount, setAmount] = useState('');
  const [fromCode, setFromCode] = useState('USD');

  const parsed = parseFloat(amount.replace(/,/g, '')) || 0;
  const others = SUPPORTED.filter(c => c.code !== fromCode);

  return (
    <div className="pb-24 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowRight className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">حاسبة العملات</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
            {offline && <WifiOff className="h-3 w-3" />}
            {loading
              ? 'جاري تحديث الأسعار...'
              : offline
              ? 'بدون إنترنت — سعر مؤقت'
              : updatedAt
              ? `آخر تحديث: ${formatTime(updatedAt)}`
              : ''}
            {loading && <RefreshCw className="h-3 w-3 animate-spin" />}
          </p>
        </div>
      </div>

      {/* Amount Input */}
      <div className="bg-card border border-border rounded-2xl p-5 mb-4">
        <p className="text-xs text-muted-foreground mb-3">المبلغ</p>
        <input
          type="number"
          inputMode="decimal"
          placeholder="0"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          className="w-full bg-transparent text-4xl font-bold text-foreground outline-none text-right placeholder:text-muted-foreground/30"
          autoFocus
        />
        {/* From currency selector */}
        <div className="flex flex-wrap gap-2 mt-4">
          {SUPPORTED.map(c => (
            <button
              key={c.code}
              onClick={() => setFromCode(c.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors border ${
                fromCode === c.code
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
              }`}
            >
              <span>{c.flag}</span>
              <span>{c.code}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-3">
        {others.map(c => {
          const result = parsed > 0 ? convert(parsed, fromCode, c.code) : null;
          return (
            <div
              key={c.code}
              className="bg-card border border-border rounded-2xl px-5 py-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.flag}</span>
                <div>
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                  <p className="text-xs font-medium text-foreground">{c.code}</p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-bold text-lg ${result ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {result !== null ? formatAmount(result, c.code) : '—'}
                </p>
                <p className="text-xs text-muted-foreground">{c.symbol}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Rate reference */}
      {!loading && parsed === 0 && (
        <div className="mt-6 bg-muted/40 rounded-xl p-4">
          <p className="text-xs text-muted-foreground text-center mb-3">أسعار اليوم</p>
          <div className="grid grid-cols-2 gap-y-2">
            {SUPPORTED.filter(c => c.code !== 'USD').map(c => {
              const rate = convert(1, 'USD', c.code);
              return (
                <div key={c.code} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{c.flag}</span>
                  <span>1$ = {formatAmount(rate, c.code)} {c.symbol}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
