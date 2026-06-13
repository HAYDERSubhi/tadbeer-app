'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, WifiOff, Pencil, Check, X } from 'lucide-react';
import Link from 'next/link';
import { useExchangeRates, getIQDMarketRate, saveIQDMarketRate } from '@/hooks/use-exchange-rates';

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

// تنسيق المبلغ المُدخل بفواصل آلاف مع الحفاظ على الكسور العشرية
function displayAmount(raw: string): string {
  if (!raw) return '0';
  const [intPart, decPart] = raw.split('.');
  const formatted = parseInt(intPart || '0').toLocaleString('en-US');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

export default function CurrencyPage() {
  const { rates, convert, loading, offline, updatedAt } = useExchangeRates();
  const [amount, setAmount]     = useState('');
  const [from, setFrom]         = useState('IQD');
  // 'official' uses API rate, 'market' uses user-saved rate
  const [rateType, setRateType] = useState<'official' | 'market'>('market');
  const [marketRate, setMarketRate]   = useState(1480);
  const [editingRate, setEditingRate] = useState(false);
  const [editValue, setEditValue]     = useState('');

  useEffect(() => { setMarketRate(getIQDMarketRate()); }, []);

  const num = parseFloat(amount) || 0;
  const fromCur = CURRENCIES.find(c => c.code === from)!;
  const others  = CURRENCIES.filter(c => c.code !== from);

  // IQD is involved when from=IQD or converting to IQD
  const iqdInvolved = from === 'IQD' || others.some(c => c.code === 'IQD');

  // Returns IQD per USD based on selected rate type
  const effectiveIQDRate = rateType === 'market' ? marketRate : (rates['IQD'] ?? 1310);

  function convertWithRate(val: number, fromCode: string, toCode: string): number {
    if (fromCode === toCode) return val;
    // Override IQD rate with effective rate
    const ratesOverride = { ...rates, IQD: effectiveIQDRate };
    const inUSD = val / (ratesOverride[fromCode] ?? 1);
    return inUSD * (ratesOverride[toCode] ?? 1);
  }

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 12) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  function confirmMarketRate() {
    const v = parseFloat(editValue);
    if (v > 100) { saveIQDMarketRate(v); setMarketRate(v); }
    setEditingRate(false);
  }

  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
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

      {/* ── Currency selector ── */}
      <div className="flex gap-2 px-1 pb-2 overflow-x-auto scrollbar-hide shrink-0">
        {CURRENCIES.map(c => (
          <button key={c.code} onClick={() => setFrom(c.code)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0 ${
              from === c.code
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground bg-card hover:border-primary/50'
            }`}>
            <span>{c.flag}</span><span>{c.code}</span>
          </button>
        ))}
      </div>

      {/* ── IQD rate type toggle + market rate editor ── */}
      {iqdInvolved && (
        <div className="mx-1 mb-2 shrink-0">
          {/* Toggle */}
          <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1 mb-1.5">
            {(['market','official'] as const).map(t => (
              <button key={t} onClick={() => setRateType(t)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  rateType === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}>
                {t === 'market' ? '🏪 سعر السوق' : '🏦 السعر الرسمي'}
              </button>
            ))}
          </div>

          {/* Market rate row */}
          {rateType === 'market' && (
            <div className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-3 py-2">
              {editingRate ? (
                <div className="flex items-center gap-2 flex-1">
                  <span className="text-xs text-muted-foreground shrink-0">1$ =</span>
                  <input
                    type="number" inputMode="numeric"
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    className="flex-1 bg-transparent text-sm font-bold text-foreground outline-none border-b border-primary w-0"
                    autoFocus
                    onKeyDown={e => e.key === 'Enter' && confirmMarketRate()}
                  />
                  <span className="text-xs text-muted-foreground shrink-0">د.ع</span>
                  <button onClick={confirmMarketRate} className="text-primary"><Check className="h-4 w-4"/></button>
                  <button onClick={() => setEditingRate(false)} className="text-muted-foreground"><X className="h-4 w-4"/></button>
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">سعر السوق المحلي</p>
                    <p className="text-sm font-bold text-foreground">
                      1$ = {marketRate.toLocaleString('ar-IQ')} <span className="text-xs font-normal text-muted-foreground">د.ع</span>
                    </p>
                  </div>
                  <button onClick={() => { setEditValue(String(marketRate)); setEditingRate(true); }}
                    className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1 hover:bg-primary/5">
                    <Pencil className="h-3 w-3"/>تعديل
                  </button>
                </>
              )}
            </div>
          )}

          {rateType === 'official' && (
            <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl px-3 py-2">
              <span className="text-lg">🏦</span>
              <div>
                <p className="text-xs text-blue-700 dark:text-blue-400 font-medium">السعر الرسمي للبنك المركزي</p>
                <p className="text-sm font-bold text-foreground">
                  1$ = {(rates['IQD'] ?? 1310).toLocaleString('ar-IQ')} <span className="text-xs font-normal text-muted-foreground">د.ع</span>
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Amount display ── */}
      <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">{fromCur.name}</span>
          <span className="text-xs font-medium text-muted-foreground">{fromCur.flag} {fromCur.code}</span>
        </div>
        <div className="flex items-baseline gap-3 justify-end">
          <span className="text-muted-foreground text-lg font-medium">{fromCur.symbol}</span>
          <span className={`font-bold leading-none ${
            displayAmount(amount).length > 11 ? 'text-2xl' : displayAmount(amount).length > 8 ? 'text-3xl' : 'text-5xl'
          } ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {displayAmount(amount)}
          </span>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0">
        {others.map(c => {
          const val = num > 0 ? convertWithRate(num, from, c.code) : null;
          return (
            <button key={c.code}
              onClick={() => { setFrom(c.code); setAmount(val ? (c.code === 'IQD' ? String(Math.round(val)) : val.toFixed(2)) : ''); }}
              className="w-full bg-card border border-border rounded-2xl px-4 py-3 flex items-center justify-between active:scale-[0.98] transition-transform">
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
                <p className="text-xs text-muted-foreground">{c.symbol}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Numpad ── */}
      <div className="shrink-0 bg-background border-t border-border px-2 pt-2 pb-2">
        <div className="grid grid-cols-3 gap-1.5" dir="ltr">
          {keys.map((k, i) => (
            <button key={i} onClick={() => handleKey(k)}
              className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k === '⌫'
                  ? 'bg-muted/60 text-muted-foreground'
                  : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}>
              {k}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
