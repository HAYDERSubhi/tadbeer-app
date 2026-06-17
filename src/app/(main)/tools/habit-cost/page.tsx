'use client';

import { useState } from 'react';
import { ChevronRight, Minus, Plus, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

type Period = 'day' | 'week' | 'month';

const PER_YEAR: Record<Period, number> = { day: 365, week: 52, month: 12 };
const PERIOD_LABEL: Record<Period, string> = { day: 'يومياً', week: 'أسبوعياً', month: 'شهرياً' };

const PRESETS: { id: string; emoji: string; label: string; period: Period; times: number }[] = [
  { id: 'coffee',  emoji: '☕', label: 'قهوة',          period: 'day',   times: 1 },
  { id: 'cig',     emoji: '🚬', label: 'سجائر',         period: 'day',   times: 1 },
  { id: 'energy',  emoji: '⚡', label: 'مشروب طاقة',    period: 'day',   times: 1 },
  { id: 'soda',    emoji: '🥤', label: 'مشروبات غازية', period: 'day',   times: 1 },
  { id: 'fast',    emoji: '🍔', label: 'وجبات سريعة',   period: 'week',  times: 2 },
  { id: 'taxi',    emoji: '🚕', label: 'تكسي',          period: 'day',   times: 2 },
  { id: 'subs',    emoji: '📱', label: 'اشتراكات',      period: 'month', times: 1 },
  { id: 'other',   emoji: '🛒', label: 'أخرى',          period: 'day',   times: 1 },
];

function fmt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

function displayAmount(raw: string): string {
  if (!raw) return '0';
  const [intPart, decPart] = raw.split('.');
  const formatted = parseInt(intPart || '0').toLocaleString('en-US');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

function barColor(pct: number, lo: number, hi: number) {
  if (pct <= lo) return 'bg-emerald-500';
  if (pct <= hi) return 'bg-amber-400';
  return 'bg-red-400';
}
function textColor(pct: number, lo: number, hi: number) {
  if (pct <= lo) return 'text-emerald-600 dark:text-emerald-400';
  if (pct <= hi) return 'text-amber-500';
  return 'text-red-500';
}

// لون الرقم السنوي بحسب نسبته من الدخل السنوي
function yearlyTextColor(yearlyPct: number, hasIncome: boolean) {
  if (!hasIncome) return 'text-foreground';
  if (yearlyPct <= 5)  return 'text-emerald-600 dark:text-emerald-400';
  if (yearlyPct <= 15) return 'text-amber-500';
  return 'text-red-500';
}

const INCOME_URL = '/settings#settings-profile';

export default function HabitCostPage() {
  const { userSettings, incomes, isLoading } = useAppData();

  const [preset, setPreset] = useState(PRESETS[0]);
  const [amount, setAmount] = useState('');
  const [times,  setTimes]  = useState(PRESETS[0].times);
  const [period, setPeriod] = useState<Period>(PRESETS[0].period);

  const cost = parseFloat(amount) || 0;

  const yearly  = cost * times * PER_YEAR[period];
  const monthly = yearly / 12;
  const fiveY   = yearly * 5;
  const tenY    = yearly * 10;
  const halfSaving = yearly / 2;

  const recurringIncome = (incomes ?? []).filter(i => i.type === 'recurring').reduce((s,i) => s + i.amount, 0);
  const monthlyIncome   = recurringIncome > 0 ? recurringIncome : (userSettings?.profile?.monthlyIncome ?? 0);
  const totalBudget     = userSettings?.budget?.totalBudget ?? 0;

  const dataReady = !isLoading;
  const hasIncome = dataReady && monthlyIncome > 0;
  const hasBudget = dataReady && totalBudget > 0;

  const yearlyIncome = monthlyIncome * 12;
  const yearlyPct    = hasIncome ? (yearly / yearlyIncome) * 100 : 0;
  const incomePct    = hasIncome ? (monthly / monthlyIncome) * 100 : 0;
  const budgetPct    = hasBudget ? (monthly / totalBudget)   * 100 : 0;

  const showResults = cost > 0;

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 10) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  function selectPreset(p: typeof PRESETS[number]) {
    setPreset(p);
    setTimes(p.times);
    setPeriod(p.period);
  }

  const displayLen = displayAmount(amount).length;

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-2 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">كم تكلفني عاداتي؟</h1>
          <p className="text-[11px] text-muted-foreground">تكلفة عادة متكررة على المدى الطويل</p>
        </div>
      </div>

      {/* ── اختيار العادة ── */}
      <div className="flex gap-2 px-1 pb-2 overflow-x-auto scrollbar-hide shrink-0">
        {PRESETS.map(p => (
          <button key={p.id} onClick={() => selectPreset(p)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border shrink-0 ${
              preset.id === p.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border text-muted-foreground bg-card hover:border-primary/50'
            }`}>
            <span>{p.emoji}</span><span>{p.label}</span>
          </button>
        ))}
      </div>

      {/* ── تكلفة المرة الواحدة ── */}
      <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground mb-1">تكلفة المرة الواحدة</p>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="text-muted-foreground text-base font-medium">د.ع</span>
          <span className={`font-bold leading-none transition-all ${
            displayLen > 9 ? 'text-3xl' : 'text-5xl'
          } ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {displayAmount(amount)}
          </span>
        </div>
      </div>

      {/* ── التكرار ── */}
      <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-2.5 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">كم مرة؟</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setTimes(t => Math.max(1, t - 1))}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="text-sm font-bold w-5 text-center">{times}</span>
              <button onClick={() => setTimes(t => Math.min(99, t + 1))}
                className="w-7 h-7 rounded-lg border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
            {(['day','week','month'] as Period[]).map(u => (
              <button key={u} onClick={() => setPeriod(u)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  period === u ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                }`}>
                {u === 'day' ? 'يوم' : u === 'week' ? 'أسبوع' : 'شهر'}
              </button>
            ))}
          </div>
        </div>
        {cost > 0 && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {preset.emoji} {times} {times === 1 ? 'مرة' : 'مرات'} {PERIOD_LABEL[period]} = {fmt(yearly)} د.ع سنوياً
          </p>
        )}
      </div>

      {/* ── النتائج ── */}
      <div className="flex-1 overflow-y-auto px-1 min-h-0 flex flex-col gap-2 pb-2">

        {!showResults && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-4xl mb-3">{preset.emoji}</p>
            <p className="text-sm text-muted-foreground">أدخل تكلفة المرة الواحدة</p>
            <p className="text-xs text-muted-foreground/60 mt-1">وسنحسب تكلفتها على المدى الطويل</p>
          </div>
        )}

        {showResults && (
          <>
            {/* البطل: التكلفة السنوية */}
            <div className="bg-card border border-border rounded-2xl px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">تكلفتها خلال سنة</p>
              <p className={`text-4xl font-bold leading-none ${yearlyTextColor(yearlyPct, hasIncome)}`}>
                {fmt(yearly)}
                <span className="text-base font-normal text-muted-foreground mr-2">د.ع</span>
              </p>
              {hasIncome && (
                <p className={`text-[11px] mt-1.5 font-medium ${yearlyTextColor(yearlyPct, hasIncome)}`}>
                  {yearlyPct.toFixed(1)}% من دخلك السنوي
                </p>
              )}
            </div>

            {/* شبكة الإسقاطات */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-muted/40 rounded-2xl px-2 py-3 text-center">
                <p className="text-sm font-bold">{fmt(monthly)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">شهرياً</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl px-2 py-3 text-center">
                <p className="text-sm font-bold text-amber-700 dark:text-amber-400">{fmt(fiveY)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">خلال 5 سنوات</p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-2xl px-2 py-3 text-center">
                <p className="text-sm font-bold text-red-600 dark:text-red-400">{fmt(tenY)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">خلال 10 سنوات</p>
              </div>
            </div>

            {/* ماذا لو؟ — سطر التوفير */}
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-2xl px-4 py-3">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 leading-relaxed">
                💡 لو قللت هذه العادة نصفها، ستوفر{' '}
                <span className="font-bold">{fmt(halfSaving)} د.ع</span> سنوياً
              </p>
            </div>

            {/* مقارنة بالدخل والميزانية */}
            {(hasIncome || hasBudget) && (
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-3">تكلفتها الشهرية مقارنةً بـ</p>
                <div className="flex flex-col gap-2.5">
                  {hasIncome && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">دخلك الشهري</span>
                        <span className={`text-xs font-bold ${textColor(incomePct, 5, 15)}`}>{incomePct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full w-full rounded-full origin-right transition-all duration-500 ${barColor(incomePct, 5, 15)}`}
                          style={{ transform: `scaleX(${Math.min(incomePct, 100) / 100})` }}
                        />
                      </div>
                    </div>
                  )}
                  {hasBudget && (
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-muted-foreground">ميزانيتك الشهرية</span>
                        <span className={`text-xs font-bold ${textColor(budgetPct, 10, 25)}`}>{budgetPct.toFixed(1)}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full w-full rounded-full origin-right transition-all duration-500 ${barColor(budgetPct, 10, 25)}`}
                          style={{ transform: `scaleX(${Math.min(budgetPct, 100) / 100})` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* دعوة لتسجيل الدخل عند غيابه */}
            {dataReady && !hasIncome && !hasBudget && (
              <Link href={INCOME_URL}
                className="flex items-center justify-center gap-2 text-xs text-primary border border-primary/30 rounded-xl px-4 py-2.5">
                <Settings className="h-3.5 w-3.5" />
                سجّل دخلك لمقارنة التكلفة بوضعك
              </Link>
            )}
          </>
        )}
      </div>

      {/* ── Numpad ── */}
      <div className="shrink-0 bg-background border-t border-border px-2 pt-2 pb-2">
        <div className="grid grid-cols-3 gap-1.5" dir="ltr">
          {keys.map((k, i) => (
            <button key={i} onClick={() => handleKey(k)}
              className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                k === '⌫' ? 'bg-muted/60 text-muted-foreground' : 'bg-card border border-border text-foreground hover:bg-muted/50'
              }`}>
              {k}
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
