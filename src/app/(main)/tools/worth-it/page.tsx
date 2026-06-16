'use client';

import { useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

function barColor(pct: number, lo: number, hi: number) {
  if (pct <= lo)  return 'bg-emerald-500';
  if (pct <= hi)  return 'bg-amber-400';
  return 'bg-red-400';
}

function textColor(pct: number, lo: number, hi: number) {
  if (pct <= lo)  return 'text-emerald-600 dark:text-emerald-400';
  if (pct <= hi)  return 'text-amber-500';
  return 'text-red-500';
}

function humanDuration(months: number): string {
  if (months <= 0)    return '—';
  if (months < 1/30)  return 'أقل من يوم';
  if (months < 0.25)  return `${Math.round(months * 30)} يوم`;
  if (months < 0.5)   return `${Math.round(months * 4)} أسبوع`;
  if (months < 1.5)   return 'شهر واحد';
  if (months < 12)    return `${months.toFixed(1)} شهر`;
  const y = months / 12;
  return y < 1.5 ? 'سنة كاملة' : `${y.toFixed(1)} سنة`;
}

function displayAmount(raw: string): string {
  if (!raw) return '0';
  const [intPart, decPart] = raw.split('.');
  const formatted = parseInt(intPart || '0').toLocaleString('en-US');
  return decPart !== undefined ? `${formatted}.${decPart}` : formatted;
}

// شريط يمتلئ من اليمين لليسار — origin-right + scaleX يضمن الاتجاه الصحيح في RTL
function Bar({ pct, lo, hi }: { pct: number; lo: number; hi: number }) {
  return (
    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
      <div
        className={`h-full w-full rounded-full transition-all duration-500 origin-right ${barColor(pct, lo, hi)}`}
        style={{ transform: `scaleX(${Math.min(pct, 100) / 100})` }}
      />
    </div>
  );
}

const INCOME_URL = '/settings#settings-profile';

export default function WorthItPage() {
  const { userSettings, incomes, isLoading } = useAppData();
  const [amount, setAmount] = useState('');

  // الدخل من مصادر الدخل المتكررة مباشرة — profile.monthlyIncome قد لا يكون متزامناً
  const recurringIncome = (incomes ?? [])
    .filter(i => i.type === 'recurring')
    .reduce((sum, i) => sum + i.amount, 0);
  const monthlyIncome = recurringIncome > 0
    ? recurringIncome
    : (userSettings?.profile?.monthlyIncome ?? 0);
  const totalBudget   = userSettings?.budget?.totalBudget ?? 0;

  const price = parseFloat(amount) || 0;

  const dataReady = !isLoading;
  const hasBudget = dataReady && totalBudget > 0;
  const hasIncome = dataReady && monthlyIncome > 0;
  const noData    = dataReady && !hasBudget && !hasIncome;

  const budgetMonths = hasBudget ? price / totalBudget : 0;
  const budgetPct    = hasBudget ? (price / totalBudget) * 100 : 0;
  const incomePct    = hasIncome ? (price / monthlyIncome) * 100 : 0;
  const incomeMonths = hasIncome ? price / monthlyIncome : 0;

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 12) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  const showResults = price > 0 && (hasBudget || hasIncome);
  const displayLen  = displayAmount(amount).length;

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">هل يستحق؟</h1>
          <p className="text-[11px] text-muted-foreground">ماذا يساوي هذا المبلغ من ميزانيتك ودخلك؟</p>
        </div>
        {noData && (
          <Link href={INCOME_URL}
            className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1.5 shrink-0">
            <Settings className="h-3 w-3" />
            سجّل دخلك
          </Link>
        )}
      </div>

      {/* ── تنبيه غياب البيانات ── */}
      {noData && (
        <div className="mx-1 mb-2 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            لم يُسجَّل دخل أو ميزانية.{' '}
            <Link href={INCOME_URL} className="underline font-semibold">أضف بياناتك</Link>
            {' '}لتحصل على مقارنة حقيقية.
          </p>
        </div>
      )}

      {/* ── حقل السعر ── */}
      <div className="mx-1 mb-2 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground mb-1">سعر منتج/خدمة</p>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="text-muted-foreground text-base font-medium">د.ع</span>
          <span className={`font-bold leading-none transition-all ${
            displayLen > 11 ? 'text-2xl' : displayLen > 8 ? 'text-3xl' : 'text-5xl'
          } ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {displayAmount(amount)}
          </span>
        </div>
      </div>

      {/* ── النتائج ── */}
      <div className="flex-1 px-1 min-h-0 overflow-y-auto flex flex-col gap-1.5 pb-1">

        {showResults && (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">

            {/* صف ١: ميزانية + دخل */}
            <div className="flex divide-x divide-x-reverse divide-border">
              {hasBudget && (
                <div className="flex-1 px-3 py-2.5 flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground">من الميزانية</p>
                  <p className={`text-lg font-bold leading-tight ${textColor(budgetPct, 25, 75)}`}>
                    {humanDuration(budgetMonths)}
                  </p>
                  <Bar pct={budgetPct} lo={25} hi={75} />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(totalBudget).toLocaleString('en-US')} د.ع
                    </span>
                    <span className={`text-[11px] font-bold ${textColor(budgetPct, 25, 75)}`}>
                      {budgetPct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
              {hasIncome && (
                <div className="flex-1 px-3 py-2.5 flex flex-col gap-1">
                  <p className="text-[10px] text-muted-foreground">من الدخل</p>
                  <p className={`text-lg font-bold leading-tight ${textColor(incomePct, 10, 30)}`}>
                    {humanDuration(incomeMonths)}
                  </p>
                  <Bar pct={incomePct} lo={10} hi={30} />
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-muted-foreground">
                      {Math.round(monthlyIncome).toLocaleString('en-US')} د.ع
                    </span>
                    <span className={`text-[11px] font-bold ${textColor(incomePct, 10, 30)}`}>
                      {incomePct.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

        {/* رسالة التجاوز */}
        {showResults && (budgetPct > 100 || incomePct > 100) && (
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl px-3 py-2.5 text-xs text-red-600 dark:text-red-400 leading-relaxed">
            {budgetPct > 100 && incomePct > 100
              ? '⚠️ هذا السعر يتجاوز ميزانيتك ودخلك الشهري بالكامل'
              : budgetPct > 100
              ? '⚠️ هذا السعر يتجاوز ميزانيتك الشهرية'
              : '⚠️ هذا السعر يتجاوز دخلك الشهري بالكامل'}
          </div>
        )}

        {/* placeholder */}
        {!showResults && !noData && (hasBudget || hasIncome) && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-4xl mb-3">💭</p>
            <p className="text-sm text-muted-foreground">أدخل سعر أي منتج تفكر بشرائه</p>
            <p className="text-xs text-muted-foreground/60 mt-1">وسنخبرك ماذا يساوي من ميزانيتك ودخلك</p>
          </div>
        )}

        {isLoading && (
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="flex gap-2">
              <div className="flex-1 h-24 bg-muted rounded-2xl" />
              <div className="flex-1 h-24 bg-muted rounded-2xl" />
            </div>
            <div className="h-20 bg-muted rounded-2xl" />
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
