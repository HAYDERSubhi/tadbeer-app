'use client';

import { useState, useEffect } from 'react';
import { ChevronRight, WifiOff, Pencil, Check, X, Info } from 'lucide-react';
import Link from 'next/link';
import { useExchangeRates, getIQDMarketRate, saveIQDMarketRate, getIQDMarketRateSavedAt } from '@/hooks/use-exchange-rates';

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
  if (n > 0 && n < 0.01) return n.toLocaleString('ar-IQ', { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  return n.toLocaleString('ar-IQ', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' });
}

function displayAmount(raw: string): string {
  if (!raw) return '0';
  const [intPart, decPart] = raw.split('.');
  const formatted = parseInt(intPart || '0').toLocaleString('en-US');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

export default function CurrencyPage() {
  const { rates, loading, offline, updatedAt } = useExchangeRates();
  const [amount, setAmount]     = useState('');
  const [from, setFrom]         = useState('IQD');
  const [rateType, setRateType] = useState<'official' | 'market'>('market');
  const [showSourceInfo, setShowSourceInfo] = useState(false);
  const [marketRate, setMarketRate]     = useState(1480);
  const [marketRateSavedAt, setMarketRateSavedAt] = useState<number | null>(null);
  const [editingRate, setEditingRate]   = useState(false);
  const [editValue, setEditValue]       = useState('');

  useEffect(() => {
    setMarketRate(getIQDMarketRate());
    setMarketRateSavedAt(getIQDMarketRateSavedAt());
  }, []);

  const num = parseFloat(amount) || 0;
  const TWO_DAYS = 48 * 60 * 60 * 1000;
  const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
  const isStaleCache = !offline && updatedAt != null && (Date.now() - updatedAt) > TWO_DAYS;
  const isStaleMarketRate = marketRateSavedAt != null && (Date.now() - marketRateSavedAt) > SEVEN_DAYS;
  const fromCur = CURRENCIES.find(c => c.code === from)!;
  const others  = CURRENCIES.filter(c => c.code !== from);
  const iqdInvolved = from === 'IQD' || others.some(c => c.code === 'IQD');
  const effectiveIQDRate = rateType === 'market' ? marketRate : (rates['IQD'] ?? 1310);

  function convertWithRate(val: number, fromCode: string, toCode: string): number {
    if (fromCode === toCode) return val;
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
    if (v > 100 && v < 10_000_000) {
      saveIQDMarketRate(v);
      setMarketRate(v);
      setMarketRateSavedAt(Date.now());
    }
    setEditingRate(false);
  }

  const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

  return (
    // الحاوية الرئيسية: ارتفاع ثابت = الشاشة ناقص header التطبيق وpadding وnav
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto">

      {/* ══ القسم العلوي: قابل للتمرير ══ */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-0">

        {/* ── Header ── */}
        <div className="px-1 pt-1 pb-2 shrink-0">
          <div className="flex items-center gap-3">
            <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="h-6 w-6" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-bold leading-tight">حاسبة العملات</h1>
              <div className="flex items-center gap-1">
                {offline && <WifiOff className="h-3 w-3 text-muted-foreground" />}
                <p className="text-[11px] text-muted-foreground">
                  {loading ? 'جاري التحديث...' : offline ? 'بدون إنترنت — أسعار محفوظة' : isStaleCache ? `⚠️ الأسعار قديمة — آخر تحديث ${fmtTime(updatedAt!)}` : updatedAt ? `آخر تحديث ${fmtTime(updatedAt)}` : ''}
                </p>
                {!loading && (
                  <button
                    onClick={() => setShowSourceInfo(v => !v)}
                    className="text-muted-foreground/60 active:text-primary transition-colors p-0.5"
                    aria-label="معلومات المصدر"
                  >
                    <Info className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* بطاقة معلومات المصدر */}
          {showSourceInfo && (
            <div className="mt-2 mx-0 bg-muted/60 border border-border rounded-xl px-3 py-2.5 text-[11px] text-muted-foreground leading-relaxed">
              <p className="font-semibold text-foreground mb-1">مصدر الأسعار</p>
              <p>• الأسعار الرسمية من <span className="font-medium text-foreground">ExchangeRate-API</span> — تتجمع من البنوك المركزية وأسواق الصرف الدولية</p>
              <p>• للعراق: سعر البنك المركزي العراقي (رسمي) فقط — سعر السوق يُدخله المستخدم يدوياً</p>
              <p>• تتحدث الأسعار مرة واحدة كل 24 ساعة</p>
              <p className="mt-1.5 text-[10px] text-muted-foreground/70">الأسعار استرشادية للاطلاع فقط · غير مخصصة للتداول الرسمي</p>
            </div>
          )}
        </div>

        {/* ── Currency selector ── */}
        <div className="flex gap-2 px-1 pb-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden shrink-0">
          {CURRENCIES.map(c => (
            <button key={c.code} onClick={() => setFrom(c.code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0 ${
                from === c.code
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'border-border text-muted-foreground bg-card active:bg-muted'
              }`}>
              <span>{c.flag}</span><span>{c.code}</span>
            </button>
          ))}
        </div>

        {/* ── Rate toggle + compact info line ── */}
        {iqdInvolved && (
          <div className="mx-1 mb-2 shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl p-1 mb-1">
              {(['market','official'] as const).map(t => (
                <button key={t} onClick={() => setRateType(t)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    rateType === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}>
                  {t === 'market' ? '🏪 سعر السوق' : '🏦 السعر الرسمي'}
                </button>
              ))}
            </div>

            {/* Rate info — single compact line, no card */}
            <div className="flex items-center px-1 py-0.5">
              {rateType === 'market' && (
                editingRate ? (
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-muted-foreground shrink-0">🏪 1$ =</span>
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
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs text-muted-foreground">🏪 سعر السوق:</span>
                    <span className="text-xs font-bold text-foreground">1$ = {marketRate.toLocaleString('ar-IQ')} د.ع</span>
                    {isStaleMarketRate && <span className="text-[10px] text-amber-500">⚠️ قديم</span>}
                    <button onClick={() => { setEditValue(String(marketRate)); setEditingRate(true); }}
                      className="flex items-center gap-0.5 text-[10px] text-primary mr-auto">
                      <Pencil className="h-3 w-3"/>تعديل
                    </button>
                  </div>
                )
              )}
              {rateType === 'official' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">🏦 السعر الرسمي:</span>
                  <span className="text-xs font-bold text-foreground">1$ = {(rates['IQD'] ?? 1310).toLocaleString('ar-IQ')} د.ع</span>
                </div>
              )}
            </div>
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
        <div className="px-1 flex flex-col gap-2 pb-2">
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

      </div>{/* ══ نهاية القسم العلوي ══ */}

      {/* ══ النمباد: ثابت دائماً في الأسفل، لا يتأثر بمحتوى الأعلى ══ */}
      <div className="shrink-0 bg-background border-t border-border px-2 pt-1.5 pb-1.5">
        <div className="grid grid-cols-3 gap-1" dir="ltr">
          {keys.map((k, i) => (
            <button key={i} onClick={() => handleKey(k)}
              className={`h-11 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k === '⌫'
                  ? 'bg-muted/60 text-muted-foreground'
                  : 'bg-card border border-border text-foreground'
              }`}>
              {k}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
