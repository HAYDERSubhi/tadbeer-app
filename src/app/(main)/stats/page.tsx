// src/app/(main)\stats\page.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getExpenses } from '@/services/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  PieChartIcon, TrendingUpIcon, ListOrdered, Loader2,
  BarChart2, LineChartIcon, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import {
  PieChart as RechartsPieChart, Pie, LineChart, Line,
  BarChart as RechartsBarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Cell, Label,
} from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  format, parseISO, getYear, compareDesc,
  startOfMonth, endOfMonth, startOfYear, endOfYear,
  isWithinInterval, subMonths,
} from 'date-fns';
import { arIQ, formatYearMonth } from '@/lib/arabic-date';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { InsightsCard } from './InsightsCard';
import { getStatsSummary } from '@/ai/flows/get-stats-summary';
import { CoachInsightsCard } from '@/components/dashboard/coach-insights-card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { SixMonthChart } from '@/components/dashboard/six-month-chart';
import { useCurrency } from '@/hooks/use-currency';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(0) + 'K';
  return n.toString();
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const { user } = useAuth();
  const { userSettings, householdId, isLoading: isAppDataLoading } = useAppData();
  const { categories, getIconComponent } = useCategories();
  const { format: formatCurrency } = useCurrency();

  // Full history — no date filter
  const { data: expenses = [], isLoading: allExpensesLoading } = useQuery({
    queryKey: ['expenses', user?.uid, householdId, 'all'],
    queryFn: () => getExpenses(user!.uid, householdId),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const [view, setView]           = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear]   = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));

  // ── Available period lists ────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    if (!expenses.length) return [new Date().getFullYear()];
    const s = new Set(expenses.map(e => { try { return getYear(parseISO(e.date)); } catch { return null; } }).filter((y): y is number => y !== null));
    return Array.from(s).sort((a, b) => b - a);
  }, [expenses]);

  const availableMonths = useMemo(() => {
    if (!expenses.length) return [format(new Date(), 'yyyy-MM')];
    const s = new Set(expenses.map(e => { try { return format(parseISO(e.date), 'yyyy-MM'); } catch { return null; } }).filter((m): m is string => m !== null));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  const effectiveMonth = availableMonths.includes(selectedMonth) ? selectedMonth : (availableMonths[0] ?? format(new Date(), 'yyyy-MM'));
  const effectiveYear  = availableYears.includes(selectedYear)   ? selectedYear  : (availableYears[0] ?? new Date().getFullYear());

  // ── Chart config ──────────────────────────────────────────────────────────
  const chartConfig = useMemo((): ChartConfig => {
    const cfg: ChartConfig = {};
    categories.forEach(c => {
      cfg[c.id] = { label: c.name, icon: () => getIconComponent(c.icon), color: `hsl(var(--chart-${c.color}))` };
    });
    cfg.expenses = { label: 'المصاريف', color: 'hsl(var(--primary))' };
    return cfg;
  }, [categories, getIconComponent]);

  // ── Core stats (synchronous, no server call) ──────────────────────────────
  const statsData = useMemo(() => {
    if (!user || isAppDataLoading || allExpensesLoading || !userSettings || !expenses.length) return null;
    try {
      return getStatsSummary({ expenses, view, selectedPeriod: view === 'month' ? effectiveMonth : String(effectiveYear), userSettings });
    } catch (e) {
      console.error('getStatsSummary:', e);
      return null;
    }
  }, [user, isAppDataLoading, allExpensesLoading, expenses, view, effectiveMonth, effectiveYear, userSettings]);

  // ── Previous period total (for the comparison badge) ─────────────────────
  const prevTotal = useMemo(() => {
    if (!expenses.length) return 0;
    let s: Date, e: Date;
    if (view === 'month') {
      const [y, m] = effectiveMonth.split('-').map(Number);
      const prev = subMonths(new Date(y, m - 1, 1), 1);
      s = startOfMonth(prev); e = endOfMonth(prev);
    } else {
      s = startOfYear(new Date(effectiveYear - 1, 0, 1));
      e = endOfYear(new Date(effectiveYear - 1, 0, 1));
    }
    // Same definition as totalForPeriod: out-of-budget expenses excluded,
    // so the comparison badge compares like with like.
    return expenses
      .filter(exp => !exp.isOutOfBudget)
      .filter(exp => { try { return isWithinInterval(parseISO(exp.date), { start: s, end: e }); } catch { return false; } })
      .reduce((sum, exp) => sum + exp.amount, 0);
  }, [expenses, view, effectiveMonth, effectiveYear]);

  const {
    pieChartData    = [],
    trendChartData  = [],
    categorySummary = [],
    categoryTrends  = [],
    totalForPeriod  = 0,
    outOfBudgetTotal = 0,
    filteredExpenses = [],
    periodDescription = '',
  } = statsData ?? {};

  const diffPct = prevTotal > 0 ? ((totalForPeriod - prevTotal) / prevTotal) * 100 : null;

  // ── Loading / empty ───────────────────────────────────────────────────────
  if (isAppDataLoading || allExpensesLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;
  }
  if (!expenses.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">لا توجد بيانات لعرضها</h2>
        <p className="text-xs text-muted-foreground">ابدأ بإضافة بعض المصاريف لترى الإحصائيات هنا.</p>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">

      {/* ── التقرير الشهري ── */}
      <Link href="/report">
        <Button variant="outline" className="w-full gap-2 h-10">
          <FileBarChart className="h-4 w-4 text-primary" />
          عرض التقرير الشهري القابل للمشاركة
        </Button>
      </Link>

      {/* ── اختيار الفترة ── */}
      <Card>
        <CardContent className="p-3">
          <Tabs value={view} onValueChange={v => setView(v as 'month' | 'year')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="month" className="text-xs">شهري</TabsTrigger>
              <TabsTrigger value="year"  className="text-xs">سنوي</TabsTrigger>
            </TabsList>

            <TabsContent value="month" className="mt-3">
              <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
                <Tabs value={effectiveMonth} onValueChange={setSelectedMonth}>
                  <TabsList className="h-8 inline-flex w-auto">
                    {availableMonths.map(m => (
                      <TabsTrigger key={m} value={m} className="whitespace-nowrap text-xs px-2.5 py-1 h-auto">
                        {formatYearMonth(m)}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </TabsContent>

            <TabsContent value="year" className="mt-3">
              <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
                <Tabs value={String(effectiveYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <TabsList className="h-8 inline-flex w-auto">
                    {availableYears.map(y => (
                      <TabsTrigger key={y} value={String(y)} className="text-xs px-2.5 py-1 h-auto">{y}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── مخطط الستة أشهر (سياق تاريخي عام) ── */}
      <SixMonthChart />

      {/* ── بعد هذا كل شيء خاص بالفترة المختارة ── */}
      {!statsData ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <>

          {/* ── بطاقة ملخص الفترة ── */}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">{periodDescription}</p>
              <div className="flex items-end justify-between">
                <p className="text-2xl font-bold tracking-tight">{formatCurrency(totalForPeriod)}</p>
                {diffPct !== null && (
                  <div className={cn(
                    "flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full",
                    diffPct > 0  ? "bg-destructive/10 text-destructive"
                    : diffPct < 0 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                  )}>
                    {diffPct > 0 ? <TrendingUp className="h-3 w-3" />
                    : diffPct < 0 ? <TrendingDown className="h-3 w-3" />
                    : <Minus className="h-3 w-3" />}
                    {Math.abs(diffPct).toFixed(1)}%
                    <span className="font-normal opacity-70">عن الفترة السابقة</span>
                  </div>
                )}
              </div>
              {prevTotal > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  الفترة السابقة: {formatCurrency(prevTotal)}
                </p>
              )}
              {outOfBudgetTotal > 0 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  + {formatCurrency(outOfBudgetTotal)} مصاريف خارج الميزانية (غير مشمولة بالإجمالي أعلاه)
                </p>
              )}
            </CardContent>
          </Card>

          {/* ── الدائرة البيانية + ليجند ── */}
          {pieChartData.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <PieChartIcon className="h-4 w-4 text-primary" />
                  توزيع المصاريف
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-4 px-4">
                {/* Donut chart — no interactive active shape */}
                <div className="flex justify-center">
                  <ChartContainer config={chartConfig} className="w-full max-w-[220px] h-[220px]">
                    <RechartsPieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%" cy="50%"
                        innerRadius={65} outerRadius={95}
                        dataKey="value"
                        paddingAngle={2}
                        strokeWidth={0}
                        isAnimationActive={true}
                      >
                        {pieChartData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                        <Label
                          content={({ viewBox }) => {
                            const vb = viewBox as { cx?: number; cy?: number };
                            const cx = vb?.cx ?? 110;
                            const cy = vb?.cy ?? 110;
                            return (
                              <g>
                                <text x={cx} y={cy - 8} textAnchor="middle" dominantBaseline="middle"
                                  className="fill-foreground font-bold" style={{ fontSize: 15, fontWeight: 700 }}>
                                  {fmt(totalForPeriod)}
                                </text>
                                <text x={cx} y={cy + 12} textAnchor="middle" dominantBaseline="middle"
                                  className="fill-muted-foreground" style={{ fontSize: 10 }}>
                                  الإجمالي
                                </text>
                              </g>
                            );
                          }}
                        />
                      </Pie>
                    </RechartsPieChart>
                  </ChartContainer>
                </div>

                {/* Legend rows */}
                <div className="mt-3 space-y-2">
                  {pieChartData.map(item => (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="shrink-0 w-2.5 h-2.5 rounded-full" style={{ background: item.fill }} />
                      <span className="flex-1 text-xs truncate">{item.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{item.percentage.toFixed(1)}%</span>
                      <span className="text-xs font-semibold shrink-0 min-w-[60px] text-left">{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── ملخص الفئات (accordion) ── */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListOrdered className="h-4 w-4 text-primary" />
                ملخص الفئات
              </CardTitle>
              <CardDescription className="text-xs">
                {categorySummary.length > 0 ? 'اضغط على فئة لعرض مصاريفها.' : 'لا توجد مصاريف في هذه الفترة.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {categorySummary.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                  {categorySummary.map(item => (
                    <AccordionItem key={item.id} value={item.id} className="border-b last:border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/40 data-[state=open]:bg-muted/40 transition-colors">
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span style={{ color: item.chartColor }} className="text-xl shrink-0">
                              {getIconComponent(item.icon)}
                            </span>
                            <div className="text-right flex-1 min-w-0">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              <p className="text-[11px] text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-sm font-bold">{formatCurrency(item.total)}</p>
                            {item.budget && item.total > 0 && (
                              <Progress
                                value={Math.min((item.total / item.budget) * 100, 100)}
                                indicatorClassName={(item.total / item.budget) > 1 ? 'bg-destructive' : 'bg-primary'}
                                className="h-1.5 w-16 mt-1"
                              />
                            )}
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-4 pb-3 bg-muted/20">
                        <ul className="space-y-2 pt-2 border-t">
                          {filteredExpenses
                            .filter(e => e.category === item.id)
                            .sort((a, b) => compareDesc(parseISO(a.date), parseISO(b.date)))
                            .slice(0, 10)
                            .map(exp => (
                              <li key={exp.id} className="flex justify-between items-start gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-[12px] font-medium truncate">{exp.title}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {format(parseISO(exp.date), 'd MMM', { locale: arIQ })}
                                  </p>
                                </div>
                                <span className="text-[12px] font-semibold shrink-0">{formatCurrency(exp.amount)}</span>
                              </li>
                            ))}
                          {filteredExpenses.filter(e => e.category === item.id).length > 10 && (
                            <li className="text-center text-xs text-muted-foreground pt-1">
                              و {filteredExpenses.filter(e => e.category === item.id).length - 10} مصروف آخر
                            </li>
                          )}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <p className="text-center text-xs text-muted-foreground px-4 py-8">لا توجد مصاريف لعرضها.</p>
              )}
            </CardContent>
          </Card>

          {/* ── اتجاه الإنفاق (يومي/شهري) ── */}
          {trendChartData.length > 0 && (
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUpIcon className="h-4 w-4 text-primary" />
                  اتجاه الإنفاق
                </CardTitle>
                <CardDescription className="text-xs">
                  {view === 'month' ? 'الإنفاق اليومي' : 'الإنفاق الشهري'} خلال {periodDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-4 px-2">
                <ChartContainer config={chartConfig} className="w-full h-[220px]">
                  <LineChart data={trendChartData} margin={{ top: 16, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 9 }} />
                    <YAxis tickLine={false} axisLine={false} tickFormatter={v => fmt(v as number)} tick={{ fontSize: 9 }} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const total = payload.reduce((s, p) => s + (p.value as number), 0);
                        const breakdown = categoryTrends
                          .map(ct => ({ name: ct.categoryName, value: ct.trendData.find(d => d.name === label)?.expenses ?? 0, color: chartConfig[ct.categoryId]?.color }))
                          .filter(x => x.value > 0).sort((a, b) => b.value - a.value);
                        return (
                          <div className="p-2 rounded-lg border bg-background/95 shadow-lg text-xs min-w-[130px]">
                            <p className="font-bold mb-1">{label}</p>
                            <p className="text-primary font-semibold mb-1.5 pb-1.5 border-b">{formatCurrency(total)}</p>
                            {breakdown.map(b => (
                              <div key={b.name} className="flex justify-between gap-2">
                                <span style={{ color: b.color }} className="font-medium">{b.name}</span>
                                <span className="text-muted-foreground">{formatCurrency(b.value)}</span>
                              </div>
                            ))}
                          </div>
                        );
                      }}
                    />
                    <Line type="monotone" dataKey="expenses" stroke={chartConfig.expenses?.color}
                      strokeWidth={2.5} dot={{ r: 2.5, fill: chartConfig.expenses?.color, strokeWidth: 0 }}
                      activeDot={{ r: 5, strokeWidth: 2 }} />
                  </LineChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* ── مقارنة الفئات ── */}
          {categoryTrends.length > 1 && (() => {
            const names = categoryTrends[0].trendData.map(d => d.name);
            const merged = names.map(name => {
              const pt: Record<string, string | number> = { name };
              categoryTrends.forEach(ct => { pt[ct.categoryId] = ct.trendData.find(d => d.name === name)?.expenses ?? 0; });
              return pt;
            });
            return (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    مقارنة الفئات
                  </CardTitle>
                  <CardDescription className="text-xs">أعلى الفئات إنفاقاً خلال {periodDescription}</CardDescription>
                </CardHeader>
                <CardContent className="pb-4 px-2">
                  <ChartContainer config={chartConfig} className="w-full h-[200px]">
                    <RechartsBarChart data={merged} margin={{ top: 8, right: 8, left: -18, bottom: 0 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} tickMargin={6} />
                      <YAxis tickLine={false} axisLine={false} tickFormatter={v => fmt(v as number)} tick={{ fontSize: 9 }} />
                      <RechartsTooltip
                        cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const nz = [...payload].filter(p => (p.value as number) > 0).reverse();
                          if (!nz.length) return null;
                          const total = nz.reduce((s, p) => s + (p.value as number), 0);
                          return (
                            <div className="p-2 rounded-lg border bg-background/95 shadow-lg text-xs min-w-[130px]">
                              <p className="font-bold border-b pb-1 mb-1">{label}</p>
                              {nz.map(p => (
                                <div key={String(p.dataKey)} className="flex justify-between gap-2">
                                  <span style={{ color: p.fill }} className="font-medium truncate">{chartConfig[p.dataKey as string]?.label ?? p.dataKey}</span>
                                  <span className="text-muted-foreground shrink-0">{formatCurrency(p.value as number)}</span>
                                </div>
                              ))}
                              <div className="flex justify-between gap-2 border-t pt-1 mt-1">
                                <span className="font-semibold">الإجمالي</span>
                                <span className="font-semibold shrink-0">{formatCurrency(total)}</span>
                              </div>
                            </div>
                          );
                        }}
                      />
                      {categoryTrends.map(ct => (
                        <Bar key={ct.categoryId} dataKey={ct.categoryId} stackId="stack"
                          fill={chartConfig[ct.categoryId]?.color}
                          radius={categoryTrends.indexOf(ct) === categoryTrends.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                          maxBarSize={36} />
                      ))}
                    </RechartsBarChart>
                  </ChartContainer>
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-3 justify-center">
                    {categoryTrends.map(ct => (
                      <div key={ct.categoryId} className="flex items-center gap-1.5 text-xs">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: chartConfig[ct.categoryId]?.color }} />
                        <span className="text-muted-foreground">{ct.categoryName}</span>
                        <span className="font-semibold">{formatCurrency(ct.total)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── التحليل الذكي ── */}
          <InsightsCard
            key={`insights-${view}-${effectiveMonth}-${effectiveYear}`}
            filteredExpenses={filteredExpenses}
            periodDescription={periodDescription}
            allExpenses={expenses}
            selectedPeriod={view === 'month' ? effectiveMonth : String(effectiveYear)}
            view={view}
          />

          {/* ── نصائح المدرب الذكي ── */}
          <CoachInsightsCard
            key={`coach-${view}-${effectiveMonth}-${effectiveYear}`}
            filteredExpenses={filteredExpenses}
            userSettings={userSettings}
            categoryMap={Object.fromEntries(categories.map(c => [c.id, { name: c.name, icon: c.icon }]))}
            periodDescription={periodDescription}
            selectedPeriod={view === 'month' ? effectiveMonth : String(effectiveYear)}
          />

        </>
      )}
    </div>
  );
}
