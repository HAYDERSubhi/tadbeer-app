'use client';

import { useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

type Verdict = 'comfortable' | 'consider' | 'careful';

// Verdict based on budget months (primary) or income % (fallback)
function getVerdictByMonths(months: number): Verdict {
  if (months <= 0.25) return 'comfortable';
  if (months <= 0.75) return 'consider';
  return 'careful';
}

function getVerdictByIncome(pct: number): Verdict {
  if (pct <= 10) return 'comfortable';
  if (pct <= 30) return 'consider';
  return 'careful';
}

const VC = {
  comfortable: {
    icon: '✅', label: 'يستحق',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  consider: {
    icon: '🤔', label: 'فكّر مرتين',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
  },
  careful: {
    icon: '⚠️', label: 'انتبه',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
  },
};

function formatMonths(months: number): string {
  if (months < 0.1) return 'أقل من أسبوع';
  if (months < 0.5) return `${Math.round(months * 4)} أسبوع`;
  if (months < 1.5) return 'شهر واحد';
  if (months < 12) return `${months.toFixed(1)} شهر`;
  const years = months / 12;
  return years < 2 ? 'سنة كاملة' : `${years.toFixed(1)} سنة`;
}

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

const INCOME_SETTINGS_URL = '/settings#settings-profile';

export default function WorthItPage() {
  const { userSettings, isLoading } = useAppData();
  const [amount, setAmount] = useState('');

  const monthlyIncome  = userSettings?.profile?.monthlyIncome ?? 0;
  const totalBudget    = userSettings?.budget?.totalBudget ?? 0;

  const price = parseFloat(amount) || 0;

  const dataReady = !isLoading;
  const hasBudget = dataReady && totalBudget > 0;
  const hasIncome = dataReady && monthlyIncome > 0;
  const hasData   = hasBudget || hasIncome;
  const noData    = dataReady && !hasData;

  // Primary: budget months / Secondary: income %
  const budgetMonths = hasBudget ? price / totalBudget : 0;
  const incomePct    = hasIncome ? (price / monthlyIncome) * 100 : 0;

  const dailyIncome  = monthlyIncome / 22;
  const workDays     = dailyIncome > 0 ? price / dailyIncome : 0;
  const workHours    = workDays * 8;

  const verdict = price > 0 && hasData
    ? (hasBudget ? getVerdictByMonths(budgetMonths) : getVerdictByIncome(incomePct))
    : null;
  const vc = verdict ? VC[verdict] : null;

  // Human-readable "months of life" sentence
  function lifePhrase(): string {
    if (!price || !hasBudget) return '';
    if (budgetMonths < 0.1) return 'أقل من أسبوع من معيشتك';
    if (budgetMonths < 1)   return `${formatMonths(budgetMonths)} من معيشتك`;
    return `يعادل ${formatMonths(budgetMonths)} من معيشتك`;
  }

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 12) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-10rem)] max-w-md mx-auto overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-1 pt-1 pb-3 shrink-0">
        <Link href="/tools" className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="h-6 w-6" />
        </Link>
        <div className="flex-1">
          <h1 className="text-lg font-bold">هل يستحق؟</h1>
          <p className="text-[11px] text-muted-foreground">قيّم أي شراء بأشهر من حياتك</p>
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
            لم يُسجَّل دخل أو ميزانية بعد.{' '}
            <Link href={INCOME_SETTINGS_URL} className="underline font-semibold">
              أضف بياناتك
            </Link>{' '}
            لتحصل على مقارنة حقيقية بحياتك.
          </p>
        </div>
      )}

      {/* ── حقل السعر ── */}
      <div className="mx-1 mb-3 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground mb-1">سعر المنتج</p>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="text-muted-foreground text-lg font-medium">د.ع</span>
          <span className={`font-bold leading-none text-5xl ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {amount || '0'}
          </span>
        </div>
      </div>

      {/* ── النتائج ── */}
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0">

        {/* الحكم + جملة "أشهر من معيشتك" */}
        {vc && price > 0 && (
          <div className={`rounded-2xl border px-4 py-3 ${vc.bg} ${vc.border}`}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{vc.icon}</span>
              <p className={`font-bold text-lg ${vc.text}`}>{vc.label}</p>
            </div>
            {hasBudget && (
              <p className="text-sm font-semibold text-foreground leading-snug">
                {lifePhrase()}
              </p>
            )}
            {!hasBudget && hasIncome && (
              <p className="text-sm font-semibold text-foreground">
                {incomePct.toFixed(1)}% من دخلك الشهري
              </p>
            )}
          </div>
        )}

        {/* مقارنة بالميزانية — الكارت الرئيسي */}
        {hasBudget && price > 0 && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-3">مقارنة بميزانيتك</p>
            <div className="mb-2">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-muted-foreground">من ميزانية الشهر</span>
                <span className={`text-xs font-bold ${
                  budgetMonths > 0.75 ? 'text-red-500' : budgetMonths > 0.25 ? 'text-amber-500' : 'text-emerald-600'
                }`}>
                  {(budgetMonths * 100).toFixed(0)}%
                </span>
              </div>
              <Bar
                pct={budgetMonths * 100}
                color={budgetMonths > 0.75 ? 'bg-red-400' : budgetMonths > 0.25 ? 'bg-amber-400' : 'bg-emerald-500'}
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                ميزانيتك الشهرية: {Math.round(totalBudget).toLocaleString('ar-IQ')} د.ع
              </p>
            </div>
          </div>
        )}

        {/* أيام وساعات العمل */}
        {hasIncome && price > 0 && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">يعادل من وقتك</p>
            <div className="flex gap-3">
              <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                <p className="font-bold text-2xl text-foreground">
                  {workDays < 1 ? '< 1' : workDays.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">يوم عمل</p>
              </div>
              <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                <p className="font-bold text-2xl text-foreground">
                  {workHours < 1 ? '< 1' : workHours.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ساعة عمل</p>
              </div>
            </div>
            {hasBudget && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-xs text-muted-foreground">من الدخل الشهري</span>
                  <span className={`text-xs font-bold ${
                    incomePct > 30 ? 'text-red-500' : incomePct > 10 ? 'text-amber-500' : 'text-emerald-600'
                  }`}>
                    {incomePct.toFixed(1)}%
                  </span>
                </div>
                <Bar
                  pct={incomePct}
                  color={incomePct > 30 ? 'bg-red-400' : incomePct > 10 ? 'bg-amber-400' : 'bg-emerald-500'}
                />
              </div>
            )}
          </div>
        )}

        {/* placeholder */}
        {!price && hasData && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-4xl mb-3">💭</p>
            <p className="text-sm text-muted-foreground">أدخل سعر أي منتج تفكر بشرائه</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {hasBudget ? 'وسنخبرك كم شهراً من معيشتك يساوي' : 'وسنخبرك كم يساوي من دخلك ووقتك'}
            </p>
          </div>
        )}

        {/* skeleton أثناء التحميل */}
        {isLoading && (
          <div className="flex flex-col gap-2 animate-pulse">
            <div className="h-20 bg-muted rounded-2xl" />
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
