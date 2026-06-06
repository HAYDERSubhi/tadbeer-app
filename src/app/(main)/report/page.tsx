// src/app/(main)/report/page.tsx
"use client";

import { useMemo, useRef, useState } from 'react';
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { useCurrency } from '@/hooks/use-currency';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Share2, TrendingDown, TrendingUp, Target, Award, ChevronRight, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── Helpers ────────────────────────────────────────────────────────────────

function pct(value: number, total: number) {
    if (!total) return 0;
    return Math.min(Math.round((value / total) * 100), 100);
}

const CHART_COLORS = [
    '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6',
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
];

// ── Report Card Component (the shareable card) ─────────────────────────────

function ReportCard({
    month,
    totalSpent,
    totalBudget,
    topCategories,
    currency,
    householdName,
}: {
    month: Date;
    totalSpent: number;
    totalBudget: number;
    topCategories: { name: string; icon: string; amount: number; color: string }[];
    currency: (n: number) => string;
    householdName?: string;
}) {
    const remaining = totalBudget - totalSpent;
    const usagePct = pct(totalSpent, totalBudget);
    const monthLabel = format(month, 'MMMM yyyy', { locale: ar });
    const isOver = remaining < 0;

    return (
        <div
            id="report-card"
            className="relative overflow-hidden rounded-3xl select-none"
            style={{
                background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
                minHeight: 480,
                fontFamily: 'var(--font-geist-sans, sans-serif)',
            }}
        >
            {/* Decorative blobs */}
            <div className="absolute top-[-60px] right-[-60px] w-48 h-48 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
            <div className="absolute bottom-[-40px] left-[-40px] w-36 h-36 rounded-full opacity-15" style={{ background: 'radial-gradient(circle, #f59e0b, transparent)' }} />

            <div className="relative z-10 p-6 flex flex-col gap-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-slate-400">التقرير الشهري</p>
                        <h2 className="text-xl font-bold text-white">{monthLabel}</h2>
                        {householdName && (
                            <p className="text-xs text-indigo-400 mt-0.5">👨‍👩‍👧‍👦 {householdName}</p>
                        )}
                    </div>
                    <div className="text-3xl">📊</div>
                </div>

                {/* Total Spent */}
                <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <p className="text-xs text-slate-400 mb-1">إجمالي المصاريف</p>
                    <p className="text-3xl font-bold text-white">{currency(totalSpent)}</p>
                    {totalBudget > 0 && (
                        <div className="mt-3">
                            <div className="flex justify-between text-xs text-slate-400 mb-1">
                                <span>{usagePct}% من الميزانية</span>
                                <span className={isOver ? 'text-red-400' : 'text-emerald-400'}>
                                    {isOver ? `تجاوز بـ ${currency(Math.abs(remaining))}` : `متبقي ${currency(remaining)}`}
                                </span>
                            </div>
                            <div className="h-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                <div
                                    className="h-2 rounded-full transition-all"
                                    style={{
                                        width: `${usagePct}%`,
                                        background: isOver
                                            ? 'linear-gradient(90deg, #ef4444, #f97316)'
                                            : 'linear-gradient(90deg, #6366f1, #10b981)',
                                    }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Top categories */}
                {topCategories.length > 0 && (
                    <div>
                        <p className="text-xs text-slate-400 mb-3">أعلى الفئات إنفاقاً</p>
                        <div className="flex flex-col gap-2">
                            {topCategories.slice(0, 4).map((cat, i) => (
                                <div key={i} className="flex items-center gap-3">
                                    <span className="text-xl w-7">{cat.icon}</span>
                                    <div className="flex-1">
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-300">{cat.name}</span>
                                            <span className="text-slate-400">{currency(cat.amount)}</span>
                                        </div>
                                        <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                                            <div
                                                className="h-1.5 rounded-full"
                                                style={{
                                                    width: `${pct(cat.amount, totalSpent)}%`,
                                                    background: cat.color,
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-white/10">
                    <p className="text-[10px] text-slate-500">tadbeer.app</p>
                    <p className="text-[10px] text-slate-500">تدبير — إدارة ذكية لمصاريفك</p>
                </div>
            </div>
        </div>
    );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function ReportPage() {
    const { expenses, userSettings, household } = useAppData();
    const { categories } = useCategories();
    const { format: formatCurrency } = useCurrency();
    const { toast } = useToast();
    const [monthOffset, setMonthOffset] = useState(0); // 0 = current month, -1 = last month, etc.

    const selectedMonth = useMemo(() => {
        const now = new Date();
        return subMonths(now, -monthOffset);
    }, [monthOffset]);

    const monthExpenses = useMemo(() => {
        const start = startOfMonth(selectedMonth);
        const end = endOfMonth(selectedMonth);
        return expenses.filter(e => {
            try {
                return isWithinInterval(parseISO(e.date), { start, end });
            } catch { return false; }
        });
    }, [expenses, selectedMonth]);

    const totalSpent = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
    const totalBudget = userSettings?.budget?.totalBudget ?? 0;

    const topCategories = useMemo(() => {
        const catMap = new Map<string, number>();
        monthExpenses.forEach(e => catMap.set(e.category, (catMap.get(e.category) || 0) + e.amount));
        return [...catMap.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id, amount], i) => {
                const cat = categories.find(c => c.id === id);
                return {
                    name: cat?.name || id,
                    icon: cat?.icon || '📦',
                    amount,
                    color: CHART_COLORS[i % CHART_COLORS.length],
                };
            });
    }, [monthExpenses, categories]);

    const handleShare = async () => {
        const monthLabel = format(selectedMonth, 'MMMM yyyy', { locale: ar });
        const lines = [
            `📊 تقريري الشهري — ${monthLabel}`,
            ``,
            `💸 إجمالي المصاريف: ${formatCurrency(totalSpent)}`,
            totalBudget > 0 ? `🎯 الميزانية: ${formatCurrency(totalBudget)} (${pct(totalSpent, totalBudget)}% مستهلك)` : '',
            ``,
            topCategories.length > 0 ? `أعلى الفئات:` : '',
            ...topCategories.map(c => `  ${c.icon} ${c.name}: ${formatCurrency(c.amount)}`),
            ``,
            `📱 تابع مصاريفك مع تدبير — tadbeer.app`,
        ].filter(Boolean);

        const text = lines.join('\n');

        if (navigator.share) {
            try {
                await navigator.share({ title: `تقرير ${monthLabel}`, text });
            } catch {
                // user cancelled
            }
        } else {
            await navigator.clipboard.writeText(text);
            toast({ title: 'تم النسخ ✅', description: 'يمكنك لصق التقرير في أي مكان.' });
        }
    };

    const isCurrentMonth = monthOffset === 0;
    const isFuture = monthOffset > 0;

    return (
        <div className="space-y-4 pb-24">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h1 className="text-xl font-bold">التقرير الشهري</h1>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
                    <Share2 className="h-4 w-4" />
                    مشاركة
                </Button>
            </div>

            {/* Month navigation */}
            <div className="flex items-center justify-between rounded-xl border bg-card px-4 py-2">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setMonthOffset(o => o - 1)}
                >
                    <ChevronRight className="h-5 w-5" />
                </Button>
                <p className="font-semibold text-sm">
                    {isCurrentMonth ? 'هذا الشهر' : format(selectedMonth, 'MMMM yyyy', { locale: ar })}
                </p>
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isCurrentMonth}
                    onClick={() => setMonthOffset(o => Math.min(o + 1, 0))}
                >
                    <ChevronLeft className="h-5 w-5" />
                </Button>
            </div>

            {/* Report Card */}
            {isFuture ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                    <p className="text-lg">🔮</p>
                    <p className="text-sm">لا يمكن عرض تقرير مستقبلي</p>
                </div>
            ) : monthExpenses.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
                    <p className="text-lg">📭</p>
                    <p className="text-sm">لا توجد مصاريف لهذا الشهر</p>
                </div>
            ) : (
                <ReportCard
                    month={selectedMonth}
                    totalSpent={totalSpent}
                    totalBudget={totalBudget}
                    topCategories={topCategories}
                    currency={formatCurrency}
                    householdName={household?.name}
                />
            )}

            {/* Summary stats */}
            {monthExpenses.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl border bg-card p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{monthExpenses.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">عملية مسجلة</p>
                    </div>
                    <div className="rounded-xl border bg-card p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{topCategories.length}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">فئة مختلفة</p>
                    </div>
                    {totalBudget > 0 && (
                        <>
                            <div className="rounded-xl border bg-card p-3 text-center col-span-2">
                                <p className={cn(
                                    "text-2xl font-bold",
                                    totalSpent > totalBudget ? 'text-destructive' : 'text-emerald-500'
                                )}>
                                    {totalSpent > totalBudget
                                        ? `تجاوز +${formatCurrency(totalSpent - totalBudget)}`
                                        : `وفّرت ${formatCurrency(totalBudget - totalSpent)}`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-0.5">مقارنةً بالميزانية</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
