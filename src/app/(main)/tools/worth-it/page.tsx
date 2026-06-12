'use client';

import { useState } from 'react';
import { ChevronRight, Settings } from 'lucide-react';
import Link from 'next/link';
import { useAppData } from '@/hooks/use-app-data';

const keys = ['7','8','9','4','5','6','1','2','3','.','0','⌫'];

function fmt(n: number) {
  return Math.round(n).toLocaleString('ar-IQ');
}

type Verdict = 'comfortable' | 'consider' | 'careful';

function getVerdict(incomePercent: number): Verdict {
  if (incomePercent <= 10) return 'comfortable';
  if (incomePercent <= 30) return 'consider';
  return 'careful';
}

const VERDICT_CONFIG = {
  comfortable: {
    icon: '✅',
    label: 'يستحق',
    desc: 'سعره مريح نسبة لدخلك',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    border: 'border-emerald-200 dark:border-emerald-800',
    text: 'text-emerald-700 dark:text-emerald-400',
  },
  consider: {
    icon: '🤔',
    label: 'فكّر مرتين',
    desc: 'يمكن تحمّله لكن ليس قراراً سهلاً',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-700 dark:text-amber-400',
  },
  careful: {
    icon: '⚠️',
    label: 'انتبه',
    desc: 'ثقيل على ميزانيتك الشهرية',
    bg: 'bg-red-50 dark:bg-red-950/40',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-700 dark:text-red-400',
  },
};

export default function WorthItPage() {
  const { userSettings } = useAppData();
  const [amount, setAmount] = useState('');

  const monthlyIncome   = userSettings?.profile?.monthlyIncome ?? 0;
  const totalBudget     = userSettings?.budget?.totalBudget ?? 0;
  // entertainment budget: 15% of total budget as reasonable default
  const entertainBudget = totalBudget * 0.15;

  const price = parseFloat(amount) || 0;
  const hasIncome = monthlyIncome > 0;

  // ── Calculations ──
  const dailyIncome    = monthlyIncome / 22;
  const workDays       = dailyIncome > 0 ? price / dailyIncome : 0;
  const workHours      = workDays * 8;
  const incomePercent  = monthlyIncome > 0 ? (price / monthlyIncome) * 100 : 0;
  const budgetPercent  = totalBudget > 0 ? (price / totalBudget) * 100 : 0;
  const entertainPct   = entertainBudget > 0 ? (price / entertainBudget) * 100 : 0;

  const verdict = price > 0 && hasIncome ? getVerdict(incomePercent) : null;
  const vc = verdict ? VERDICT_CONFIG[verdict] : null;

  function handleKey(k: string) {
    if (k === '⌫') { setAmount(p => p.slice(0, -1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 12) return;
    setAmount(p => (p === '0' && k !== '.') ? k : p + k);
  }

  function Bar({ pct, color }: { pct: number; color: string }) {
    const capped = Math.min(pct, 100);
    return (
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${capped}%` }}
        />
      </div>
    );
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
          <p className="text-[11px] text-muted-foreground">حوّل السعر إلى أيام عمل ونسب</p>
        </div>
        {!hasIncome && (
          <Link href="/settings" className="flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-lg px-2 py-1.5">
            <Settings className="h-3 w-3" />
            أضف راتبك
          </Link>
        )}
      </div>

      {/* ── No income warning ── */}
      {!hasIncome && (
        <div className="mx-1 mb-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 shrink-0">
          <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
            لم يُسجَّل راتب شهري بعد. أضفه من <Link href="/settings" className="underline font-semibold">الإعدادات</Link> لتحصل على نتائج مخصصة.
          </p>
        </div>
      )}

      {/* ── Amount input ── */}
      <div className="mx-1 mb-3 bg-card border border-border rounded-2xl px-4 py-3 shrink-0">
        <p className="text-xs text-muted-foreground mb-1">سعر المنتج</p>
        <div className="flex items-baseline gap-2 justify-end">
          <span className="text-muted-foreground text-lg font-medium">د.ع</span>
          <span className={`font-bold leading-none text-5xl ${amount ? 'text-foreground' : 'text-muted-foreground/25'}`}>
            {amount || '0'}
          </span>
        </div>
      </div>

      {/* ── Results ── */}
      <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2 min-h-0">

        {/* Verdict banner */}
        {vc && price > 0 && (
          <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${vc.bg} ${vc.border}`}>
            <span className="text-3xl">{vc.icon}</span>
            <div>
              <p className={`font-bold text-base ${vc.text}`}>{vc.label}</p>
              <p className="text-xs text-muted-foreground">{vc.desc}</p>
            </div>
          </div>
        )}

        {/* Work days card */}
        {hasIncome && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3">
            <p className="text-xs text-muted-foreground mb-2">يعادل من وقتك</p>
            <div className="flex gap-3">
              <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                <p className={`font-bold text-2xl ${price > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {price > 0 ? (workDays < 1 ? '< 1' : workDays.toFixed(1)) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">يوم عمل</p>
              </div>
              <div className="flex-1 bg-muted/40 rounded-xl p-3 text-center">
                <p className={`font-bold text-2xl ${price > 0 ? 'text-foreground' : 'text-muted-foreground/30'}`}>
                  {price > 0 ? (workHours < 1 ? '< 1' : workHours.toFixed(1)) : '—'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">ساعة عمل</p>
              </div>
            </div>
          </div>
        )}

        {/* Percentages */}
        {hasIncome && (
          <div className="bg-card border border-border rounded-2xl px-4 py-3 flex flex-col gap-3">
            <p className="text-xs text-muted-foreground">نسبة من ميزانيتك</p>

            <div className="flex flex-col gap-2.5">
              {/* Income */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-muted-foreground">من الراتب الشهري</span>
                  <span className={`text-xs font-bold ${incomePercent > 30 ? 'text-red-500' : incomePercent > 10 ? 'text-amber-500' : 'text-emerald-600'}`}>
                    {price > 0 ? `${incomePercent.toFixed(1)}%` : '—'}
                  </span>
                </div>
                <Bar pct={incomePercent}
                  color={incomePercent > 30 ? 'bg-red-400' : incomePercent > 10 ? 'bg-amber-400' : 'bg-emerald-500'} />
                {price > 0 && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    الراتب: {fmt(monthlyIncome)} د.ع
                  </p>
                )}
              </div>

              {/* Monthly budget */}
              {totalBudget > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">من ميزانية الشهر</span>
                    <span className={`text-xs font-bold ${budgetPercent > 50 ? 'text-red-500' : budgetPercent > 20 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {price > 0 ? `${budgetPercent.toFixed(1)}%` : '—'}
                    </span>
                  </div>
                  <Bar pct={budgetPercent}
                    color={budgetPercent > 50 ? 'bg-red-400' : budgetPercent > 20 ? 'bg-amber-400' : 'bg-emerald-500'} />
                </div>
              )}

              {/* Entertainment */}
              {entertainBudget > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-muted-foreground">من ميزانية الترفيه</span>
                    <span className={`text-xs font-bold ${entertainPct > 100 ? 'text-red-500' : entertainPct > 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
                      {price > 0 ? `${Math.min(entertainPct, 999).toFixed(0)}%` : '—'}
                    </span>
                  </div>
                  <Bar pct={entertainPct}
                    color={entertainPct > 100 ? 'bg-red-400' : entertainPct > 50 ? 'bg-amber-400' : 'bg-emerald-500'} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Placeholder when no amount */}
        {!price && hasIncome && (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-4xl mb-3">💭</p>
            <p className="text-sm text-muted-foreground">أدخل سعر أي منتج تفكر بشرائه</p>
            <p className="text-xs text-muted-foreground/60 mt-1">وسنخبرك كم يساوي من وقتك وراتبك</p>
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
