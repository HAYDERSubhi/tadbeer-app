'use client';

import { useState } from 'react';
import { ChevronRight, WifiOff, ArrowLeftRight } from 'lucide-react';
import Link from 'next/link';
import { useExchangeRates } from '@/hooks/use-exchange-rates';

const CURRENCIES = [
  { code: 'IQD', name: 'دينار عراقي',   symbol: 'د.ع', flag: '🇮🇶' },
  { code: 'USD', name: 'دولار أمريكي',  symbol: '$',   flag: '🇺🇸' },
  { code: 'AED', name: 'درهم إماراتي',  symbol: 'د.إ', flag: '🇦🇪' },
  { code: 'SAR', name: 'ريال سعودي',    symbol: 'ر.س', flag: '🇸🇦' },
  { code: 'EUR', name: 'يورو',          symbol: '€',   flag: '🇪🇺' },
  { code: 'TRY', name: 'ليرة تركية',    symbol: '₺',   flag: '🇹🇷' },
];

function fmt(n: number, code: string): string {
  if (!n) return '—';
  if (code === 'IQD') return Math.round(n).toLocaleString('ar-IQ');
  return n.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

export default function CurrencyPage() {
  const { convert, loading, offline, updatedAt } = useExchangeRates();
  const [amount, setAmount] = useState('');
  const [from, setFrom] = useState('IQD');

  const num = parseFloat(amount) || 0;
  const fromCur = CURRENCIES.find(c => c.code === from)!;
  const others = CURRENCIES.filter(c => c.code !== from);

  function handleKey(k: string) {
    if (k === '⌫') {
      setAmount(p => p.slice(0, -1));
    } else if (k === '.' && amount.includes('.')) {
      // ignore second dot
    } else if (amount === '0' && k !== '.') {
      setAmount(k);
    } else {
      if (amount.length >= 12) return;
      setAmount(p => p + k);
    }
  }

  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] pb-0 max-w-md mx-auto overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-2 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold leading-tight">حاسبة العملات</h1>
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            {offline && <WifiOff className="h-3 w-3" />}
            {loading ? 'جاري التحديث...' : offline ? 'بدون إنترنت' : updatedAt ? `آخر تحديث ${fmtTime(updatedAt)}` : ''}
          </p>
        </div>
      </div>

      {/* From currency selector — horizontal scroll */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-hide shrink-0">
        {CURRENCIES.map(c => (
          <button
            key={c.code}
            onClick={() => setFrom(c.code)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0 ${
              from === c.code
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground bg-card hover:border-primary/50'
            }`}
          >
            <span>{c.flag}</span>
            <span>{c.code}</span>
          </button>
        ))}
      </div>

      {/* Amount display */}
      <div className="mx-4 mb-3 bg-card border border-border rounded-2xl px-5 py-4 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{fromCur.name}</span>
          <span className="text-xs font-medium text-muted-foreground">{fromCur.flag} {fromCur.code}</span>
        </div>
        <div className="flex items-baseline gap-3 justify-end mt-1">
          <span className="text-muted-foreground text-xl font-medium">{fromCur.symbol}</span>
          <span className={`font-bold leading-none ${amount ? 'text-5xl text-foreground' : 'text-5xl text-muted-foreground/25'}`}>
            {amount || '0'}
          </span>
        </div>
      </div>

      {/* Results — scrollable */}
      <div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 min-h-0">
        {others.map((c, i) => {
          const val = num > 0 ? convert(num, from, c.code) : null;
          const isTop = i < 2; // highlight top 2 (IQD & USD usually)
          return (
            <button
              key={c.code}
              onClick={() => { setFrom(c.code); setAmount(val ? fmt(val, c.code).replace(/,/g,'') : ''); }}
              className="w-full bg-card border border-border rounded-2xl px-5 py-3.5 flex items-center justify-between active:scale-[0.98] transition-transform"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{c.flag}</span>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                  <p className="text-xs font-semibold text-muted-foreground/70">{c.code}</p>
                </div>
              </div>
              <div className="text-left">
                <p className={`font-bold text-lg leading-tight ${val ? 'text-foreground' : 'text-muted-foreground/20'}`}>
                  {val !== null ? fmt(val, c.code) : '—'}
                </p>
                <p className="text-xs text-muted-foreground text-left">{c.symbol}</p>
              </div>
            </button>
          );
        })}

        {/* Rate reference when empty */}
        {num === 0 && (
          <div className="mt-2 rounded-xl bg-muted/40 p-3 grid grid-cols-2 gap-1.5">
            {CURRENCIES.filter(c => c.code !== 'USD').map(c => (
              <div key={c.code} className="text-xs text-muted-foreground flex items-center gap-1">
                <span>{c.flag}</span>
                <span>1$ = {fmt(convert(1,'USD',c.code), c.code)} {c.symbol}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Custom numpad — always visible above nav */}
      <div className="shrink-0 bg-background border-t border-border px-3 pt-2 pb-3">
        <div className="grid grid-cols-3 gap-1.5" dir="ltr">
          {keys.map((k, i) => (
            <button
              key={i}
              onClick={() => k && handleKey(k)}
              className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k === '⌫'
                  ? 'bg-muted/60 text-muted-foreground text-base'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}
            >
              {k === '⌫' ? '⌫' : k}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
