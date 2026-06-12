'use client';

import { useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function barColor(pct: number, thresholds: [number, number] = [25, 75]) {
  if (pct <= thresholds[0]) return 'bg-emerald-500';
  if (pct <= thresholds[1]) return 'bg-amber-400';
  return 'bg-red-400';
}

function humanDuration(months: number): string {
  if (months <= 0)   return '—';
  if (months < 1/30) return 'أقل من يوم';
  if (months < 0.25) return `${Math.round(months * 30)} يوم`;
  if (months < 0.5)  return `${Math.round(months * 4)} أسبوع`;
  if (months < 1.5)  return 'شهر واحد';
  if (months < 12)   return `${months.toFixed(1)} شهر`;
  const y = months / 12;
  return y < 1.5 ? 'سنة كاملة' : `${y.toFixed(1)} سنة`;
}

function displayAmount(raw: string): string {
  if (!raw) return '0';
  const [intPart, decPart] = raw.split('.');
  const formatted = parseInt(intPart || '0').toLocaleString('en-US');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

const INCOME_SETTINGS_URL = '/settings#settings-profile';

export default function WorthItPage() {
  const { userSettings, isLoading } = useAppData();
  const [amount, setAmount] = useState('');

  const monthlyIncome = userSettings?.profile?.monthlyIncome ?? 0;
  const totalBudget   = userSettings?.budget?.totalBudget ?? 0;

  const price = parseFloat(amount) || 0;

  const dataReady = !isLoading;
  const hasBudget = dataReady && totalBudget > 0;
  const hasIncome = dataReady && monthlyIncome > 0;
  const noData    = dataReady && !hasBudget && !hasIncome;

  // حسابات
  const budgetMonths = hasBudget ? price / totalBudget : 0;
  const budgetPct    = hasBudget ? (price / totalBudget) * 100 : 0;
  const incomePct    = hasIncome ? (price / monthlyIncome) * 100 : 0;
  const dailyIncome  = monthlyIncome / 22;
  const workDays     = dailyIncome > 0 ? price / dailyIncome : 0;
  const workHours    = workDays * 8;

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 12) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  const showResults = price > 0 && (hasBudget || hasIncome);

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">هل يستحق؟</h1>
          <p className="text-[11px] text-muted-foreground">ماذا يساوي هذا المبلغ من حياتك؟</p>
        </div>
        {noData && (
          <Link href={INCOME_SETTINGS_URL}
            className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1.5 shrink-0">
            <Settings className="h-3 w-3" />
            سجّل دخلك
          </Link>
        )}
      </div>

      {/* ── تنبيه غياب البيانات ── */}
      {noData && (
        <div className="mx-1 mb-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            لم يُسجَّل دخل أو ميزانية.{' '}
            <Link href={INCOME_SETTINGS_URL} className="underline font-semibold">أضف بياناتك</Link>
            {' '}لتحصل على مقارنة حقيقية.
          </p>
        </div>
      )}

      {/* ── حقل السعر ── */}
      <div className="mx-1 mb-3 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground mb-1">سعر المنتج</p>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="text-muted-foreground text-lg font-medium">د.ع</span>
          <span className={`font-bold leading-none ${displayAmount(amount).length > 9 ? 'text-3xl' : 'text-5xl'} ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {displayAmount(amount)}
          </span>
        </div>
      </div>

      {/* ── النتائج ── */}
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0">

        {showResults && (
          <>
            {/* بطاقة: الوقت من حياتك */}
            {hasBudget && (
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-3">يعادل من حياتك</p>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {humanDuration(budgetMonths)}
                </p>
                <p className="text-xs text-muted-foreground mb-3">من ميزانيتك الشهرية</p>
                <Bar pct={budgetPct} color={barColor(budgetPct)} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    ميزانيتك: {Math.round(totalBudget).toLocaleString('en-US')} د.ع
                  </span>
                  <span className={`text-[11px] font-semibold ${budgetPct > 75 ? 'text-red-500' : budgetPct > 25 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {budgetPct.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* بطاقة: من الدخل وأيام العمل */}
            {hasIncome && (
              <div className="bg-card border border-border rounded-2xl px-4 py-3">
                <p className="text-xs text-muted-foreground mb-3">من وقت عملك</p>
                <div className="flex gap-3 mb-3">
                  <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                    <p className="font-bold text-2xl text-foreground">
                      {workDays < 0.1 ? '< 1' : workDays < 1 ? workDays.toFixed(1) : Math.round(workDays).toLocaleString('en-US')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">يوم عمل</p>
                  </div>
                  <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                    <p className="font-bold text-2xl text-foreground">
                      {workHours < 1 ? '< 1' : Math.round(workHours).toLocaleString('en-US')}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">ساعة عمل</p>
                  </div>
                </div>
                <Bar pct={incomePct} color={barColor(incomePct, [10, 30])} />
                <div className="flex justify-between mt-1.5">
                  <span className="text-[11px] text-muted-foreground">
                    دخلك: {Math.round(monthlyIncome).toLocaleString('en-US')} د.ع / شهر
                  </span>
                  <span className={`text-[11px] font-semibold ${incomePct > 30 ? 'text-red-500' : incomePct > 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {incomePct.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </>
        )}

        {/* placeholder */}
        {!showResults && !noData && (hasBudget || hasIncome) && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl mb-3">💭</p>
            <p className="text-sm text-muted-foreground">أدخل سعر أي منتج تفكر بشرائه</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              وسنخبرك ماذا يساوي من حياتك
            </p>
          </div>
        )}

        {/* skeleton */}
        {isLoading && (
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-24 bg-muted rounded-2xl" />
            <div className="h-24 bg-muted rounded-2xl" />
          </div>
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
