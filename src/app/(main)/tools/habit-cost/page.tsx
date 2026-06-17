'use client';

import { useState } from 'react';
import { ChevronRight, Minus, Plus, Settings, Pencil } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

type Period = 'day' | 'week' | 'month';

const PER_YEAR: Record<Period, number> = { day: 365, week: 52, month: 12 };
const PERIOD_AR: Record<Period, string> = { day: 'يوم', week: 'أسبوع', month: 'شهر' };

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

function yearlyTextColor(yearlyPct: number, hasIncome: boolean) {
  if (!hasIncome) return 'text-foreground';
  if (yearlyPct <= 5)  return 'text-emerald-600 dark:text-emerald-400';
  if (yearlyPct <= 15) return 'text-amber-500';
  return 'text-red-500';
}

const INCOME_URL = '/settings#settings-profile';

export default function HabitCostPage() {
  const { userSettings, incomes, isLoading } = useAppData();

  const [amount, setAmount] = useState('');
  const [times,  setTimes]  = useState(1);
  const [period, setPeriod] = useState<Period>('day');
  const [showResults, setShowResults] = useState(false);

  const cost = parseFloat(amount) || 0;

  const yearly     = cost * times * PER_YEAR[period];
  const monthly    = yearly / 12;
  const fiveY      = yearly * 5;
  const tenY       = yearly * 10;
  const halfSaving = yearly / 2;

  const recurringIncome = (incomes ?? []).filter(i => i.type === 'recurring').reduce((s,i) => s + i.amount, 0);
  const monthlyIncome   = recurringIncome > 0 ? recurringIncome : (userSettings?.profile?.monthlyIncome ?? 0);
  const totalBudget     = userSettings?.budget?.totalBudget ?? 0;

  const dataReady  = !isLoading;
  const hasIncome  = dataReady && monthlyIncome > 0;
  const hasBudget  = dataReady && totalBudget > 0;

  const yearlyIncome = monthlyIncome * 12;
  const yearlyPct    = hasIncome ? (yearly / yearlyIncome) * 100 : 0;
  const incomePct    = hasIncome ? (monthly / monthlyIncome) * 100 : 0;
  const budgetPct    = hasBudget ? (monthly / totalBudget)   * 100 : 0;

  function handleKey(k: string) {
    if (showResults) return;
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 10) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  function handleCalc() {
    if (cost > 0) setShowResults(true);
  }

  function handleEdit() {
    setShowResults(false);
  }

  const displayLen = displayAmount(amount).length;

  // ملخص التكرار — يظهر في وضع النتائج بدل بطاقة التكرار
  const freqSummary = `${times} ${times === 1 ? 'مرة' : 'مرات'} كل ${PERIOD_AR[period]}`;

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
        {showResults && (
          <button onClick={handleEdit}
            className="flex items-center gap-1.5 text-xs text-primary border border-primary/30 rounded-lg px-3 py-1.5 active:scale-95 transition-transform">
            <Pencil className="h-3 w-3" />
            تعديل
          </button>
        )}
      </div>

      {/* ── وضع الإدخال ── */}
      {!showResults && (
        <>
          {/* تكلفة المرة الواحدة */}
          <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-2 shrink-0">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">تكلفة المرة الواحدة</p>
              <div className="flex items-baseline gap-1.5">
                <span className={`font-bold leading-none transition-all ${
                  displayLen > 9 ? 'text-xl' : 'text-3xl'
                } ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
                  {displayAmount(amount)}
                </span>
                <span className="text-muted-foreground text-sm font-medium">د.ع</span>
              </div>
            </div>
          </div>

          {/* التكرار — جملة طبيعية */}
          <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-2.5 shrink-0">
            <div className="flex items-center justify-between gap-3">
              {/* عدد المرات */}
              <div className="flex items-center gap-2">
                <button onClick={() => setTimes(t => Math.max(1, t - 1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="text-base font-bold w-6 text-center">{times}</span>
                <button onClick={() => setTimes(t => Math.min(99, t + 1))}
                  className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <span className="text-xs text-muted-foreground">
                  {times === 1 ? 'مرة' : 'مرات'} كل
                </span>
              </div>

              {/* الوحدة */}
              <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
                {(['day','week','month'] as Period[]).map(u => (
                  <button key={u} onClick={() => setPeriod(u)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      period === u ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                    }`}>
                    {PERIOD_AR[u]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* لوحة المفاتيح */}
          <div className="shrink-0 bg-background border-t border-border px-2 pt-2 pb-1 mt-auto">
            <div className="grid grid-cols-3 gap-1.5" dir="ltr">
              {keys.map((k, i) => (
                <button key={i} onClick={() => handleKey(k)}
                  className={`h-12 rounded-xl text-lg font-semibold transition-all active:scale-95 ${
                    k === '⌫' ? 'bg-muted/60 text-muted-foreground' : 'bg-card border border-border text-foreground'
                  }`}>
                  {k}
                </button>
              ))}
            </div>
            {/* زر احسب */}
            <button
              onClick={handleCalc}
              disabled={cost === 0}
              className="w-full mt-2 h-12 rounded-xl text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-40
                bg-primary text-primary-foreground">
              احسب ←
            </button>
          </div>
        </>
      )}

      {/* ── وضع النتائج ── */}
      {showResults && (
        <div className="flex-1 overflow-y-auto px-1 min-h-0 flex flex-col gap-2 pb-2">

          {/* ملخص الإدخال */}
          <div className="mx-0 bg-muted/40 rounded-2xl px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{freqSummary}</span>
            <span className="text-sm font-bold">{displayAmount(amount)} د.ع</span>
          </div>

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

          {/* ماذا لو؟ */}
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

          {/* دعوة لتسجيل الدخل */}
          {dataReady && !hasIncome && !hasBudget && (
            <Link href={INCOME_URL}
              className="flex items-center justify-center gap-2 text-xs text-primary border border-primary/30 rounded-xl px-4 py-2.5">
              <Settings className="h-3.5 w-3.5" />
              سجّل دخلك لمقارنة التكلفة بوضعك
            </Link>
          )}
        </div>
      )}

    </div>
  );
}
