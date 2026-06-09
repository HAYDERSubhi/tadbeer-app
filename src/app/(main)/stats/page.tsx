
// src/app/(main)/stats/page.tsx
"use client";

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getExpenses } from '@/services/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChartIcon, TrendingUpIcon, ListOrdered, Loader2, BarChart, LineChartIcon } from "lucide-react";
import {
  ResponsiveContainer, PieChart as RechartsPieChart, Pie, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Sector, Cell,
} from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, parseISO, getYear, compareDesc } from 'date-fns';
import { arIQ, formatYearMonth } from '@/lib/arabic-date';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { InsightsCard } from './InsightsCard';
import { getStatsSummary } from '@/ai/flows/get-stats-summary';
import { CoachInsightsCard } from '@/components/dashboard/coach-insights-card';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { MonthlyComparisonCard } from '@/components/dashboard/monthly-comparison-card';
import { SixMonthChart } from '@/components/dashboard/six-month-chart';
import { AiTrendsCard } from '@/components/dashboard/ai-trends-card';
import { useCurrency } from '@/hooks/use-currency';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileBarChart } from 'lucide-react';

// ─── Pie chart active shape ───────────────────────────────────────────────────
const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  return (
    <g>
      <text x={cx} y={cy - 12} dy={8} textAnchor="middle" fill={fill} className="text-sm font-bold">
        {payload.name}
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="hsl(var(--foreground))" className="text-lg font-bold">
        {value.toLocaleString()}
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" fill="hsl(var(--muted-foreground))" className="text-xs">
        ({(percent * 100).toFixed(1)}%)
      </text>
      <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius}
        startAngle={startAngle} endAngle={endAngle} fill={fill} />
      <Sector cx={cx} cy={cy} startAngle={startAngle} endAngle={endAngle}
        innerRadius={outerRadius + 6} outerRadius={outerRadius + 10} fill={fill} />
    </g>
  );
};

const formatNumberShort = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (num >= 1_000) return (num / 1_000).toFixed(0) + 'K';
  return num.toString();
};

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function StatisticsPage() {
  const { user } = useAuth();
  const { userSettings, householdId, isLoading: isAppDataLoading } = useAppData();
  const { categories, getIconComponent } = useCategories();
  const { format: formatCurrency } = useCurrency();

  // Fetch ALL expenses (no startDate filter) — stats need the full history.
  const { data: expenses = [], isLoading: allExpensesLoading } = useQuery({
    queryKey: ['expenses', user?.uid, householdId, 'all'],
    queryFn: () => getExpenses(user!.uid, householdId),
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const [view, setView] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [activeIndex, setActiveIndex] = useState(0);
  const onPieEnter = useCallback((_: any, index: number) => setActiveIndex(index), []);

  // ── Derived period lists ──────────────────────────────────────────────────
  const availableYears = useMemo(() => {
    if (!expenses.length) return [new Date().getFullYear()];
    const years = expenses.map(e => {
      try { return getYear(parseISO(e.date)); } catch { return null; }
    }).filter((y): y is number => y !== null);
    return Array.from(new Set(years)).sort((a, b) => b - a);
  }, [expenses]);

  const availableMonths = useMemo(() => {
    if (!expenses.length) return [format(new Date(), 'yyyy-MM')];
    const months = expenses.map(e => {
      try { return format(parseISO(e.date), 'yyyy-MM'); } catch { return null; }
    }).filter((m): m is string => m !== null);
    return Array.from(new Set(months)).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // Correct selected period when available lists change
  const effectiveMonth = availableMonths.includes(selectedMonth)
    ? selectedMonth
    : (availableMonths[0] ?? format(new Date(), 'yyyy-MM'));

  const effectiveYear = availableYears.includes(selectedYear)
    ? selectedYear
    : (availableYears[0] ?? new Date().getFullYear());

  // ── Chart config ──────────────────────────────────────────────────────────
  const chartConfig = useMemo(() => {
    const config: ChartConfig = {};
    categories.forEach(cat => {
      config[cat.id] = {
        label: cat.name,
        icon: () => getIconComponent(cat.icon),
        color: `hsl(var(--chart-${cat.color}))`,
      };
    });
    config.expenses = { label: "المصاريف", color: "hsl(var(--primary))" };
    return config;
  }, [categories, getIconComponent]);

  // ── Core stats — computed synchronously, no server call, no loading state ─
  const statsData = useMemo(() => {
    if (!user || isAppDataLoading || allExpensesLoading || !userSettings) return null;
    if (!expenses.length) return null;
    try {
      return getStatsSummary({
        expenses,
        view,
        selectedPeriod: view === 'month' ? effectiveMonth : String(effectiveYear),
        userSettings,
      });
    } catch (err) {
      console.error('getStatsSummary failed:', err);
      return null;
    }
  }, [user, isAppDataLoading, allExpensesLoading, expenses, view, effectiveMonth, effectiveYear, userSettings]);

  const {
    pieChartData = [],
    trendChartData = [],
    categorySummary = [],
    categoryTrends = [],
    totalForPeriod = 0,
    filteredExpenses = [],
    periodDescription = '',
  } = statsData ?? {};

  // ── Loading / empty states ────────────────────────────────────────────────
  if (isAppDataLoading || allExpensesLoading) {
    return (
      <div className="flex justify-center items-center h-[60vh]">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  if (!expenses.length) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-6">
        <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">لا توجد بيانات لعرضها</h2>
        <p className="text-xs text-muted-foreground">ابدأ بإضافة بعض المصاريف لترى الإحصائيات هنا.</p>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 pb-24">

      {/* Monthly report shortcut */}
      <Link href="/report">
        <Button variant="outline" className="w-full gap-2 h-10">
          <FileBarChart className="h-4 w-4 text-primary" />
          عرض التقرير الشهري القابل للمشاركة
        </Button>
      </Link>

      {/* Period selector */}
      <Card>
        <CardContent className="p-3">
          <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'year')} className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-9">
              <TabsTrigger value="month" className="text-xs">شهري</TabsTrigger>
              <TabsTrigger value="year" className="text-xs">سنوي</TabsTrigger>
            </TabsList>

            <TabsContent value="month" className="mt-3">
              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <Tabs value={effectiveMonth} onValueChange={setSelectedMonth}>
                  <TabsList className="h-8 inline-flex w-auto gap-0.5">
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
              <div className="overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
                <Tabs value={String(effectiveYear)} onValueChange={v => setSelectedYear(Number(v))}>
                  <TabsList className="h-8 inline-flex w-auto gap-0.5">
                    {availableYears.map(y => (
                      <TabsTrigger key={y} value={String(y)} className="text-xs px-2.5 py-1 h-auto">
                        {y}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Always-visible dashboard cards */}
      <SixMonthChart />
      <AiTrendsCard />
      <MonthlyComparisonCard />

      {/* Period-specific stats — statsData is ready synchronously */}
      {!statsData ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      ) : (
        <>
          {/* ── Pie chart ──────────────────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <PieChartIcon className="h-4 w-4 text-primary" />
                توزيع المصاريف
              </CardTitle>
              <CardDescription className="text-xs">
                إجمالي الإنفاق في {periodDescription}:{' '}
                <span className="font-semibold text-foreground">{formatCurrency(totalForPeriod)}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              {pieChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-[240px]">
                  <RechartsPieChart>
                    <RechartsTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={pieChartData}
                      activeIndex={activeIndex}
                      activeShape={renderActiveShape}
                      cx="50%" cy="50%"
                      innerRadius={60} outerRadius={80}
                      dataKey="value"
                      onMouseEnter={onPieEnter}
                    >
                      {pieChartData.map((entry, i) => (
                        <Cell key={`cell-${i}`} fill={entry.fill} />
                      ))}
                    </Pie>
                  </RechartsPieChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-xs text-center py-10">لا توجد مصاريف لعرضها.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Category summary with accordion ─────────────────────── */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <ListOrdered className="h-4 w-4 text-primary" />
                ملخص الفئات
              </CardTitle>
              <CardDescription className="text-xs">
                {categorySummary.length === 0
                  ? 'لا توجد مصاريف مسجلة في هذه الفترة.'
                  : 'اضغط على فئة لعرض تفاصيلها.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {categorySummary.length > 0 ? (
                <Accordion
                  type="single"
                  collapsible
                  className="w-full"
                  onValueChange={value => {
                    const idx = categorySummary.findIndex(item => item.id === value);
                    if (idx !== -1) setActiveIndex(idx);
                  }}
                >
                  {categorySummary.map((item) => (
                    <AccordionItem value={item.id} key={item.id} className="border-b last:border-0">
                      <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/50">
                        <div className="flex items-center justify-between w-full gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span style={{ color: item.chartColor }} className="text-xl shrink-0">
                              {getIconComponent(item.icon)}
                            </span>
                            <div className="flex-1 min-w-0 text-right">
                              <p className="font-semibold text-sm truncate">{item.name}</p>
                              <p className="text-[11px] text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                            </div>
                          </div>
                          <div className="text-left shrink-0">
                            <p className="text-sm font-bold">{formatCurrency(item.total)}</p>
                            {item.budget && item.total > 0 && (
                              <div className="w-16 mt-1">
                                <Progress
                                  value={(item.total / item.budget) * 100}
                                  indicatorClassName={(item.total / item.budget) > 1 ? 'bg-destructive' : 'bg-primary'}
                                  className="h-1.5"
                                />
                              </div>
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
                            .map(expense => (
                              <li key={expense.id} className="flex justify-between items-center gap-2 text-xs">
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-foreground/90 truncate text-[12px]">{expense.title}</p>
                                  <p className="text-[11px] text-muted-foreground">
                                    {format(parseISO(expense.date), 'd MMM', { locale: arIQ })}
                                  </p>
                                </div>
                                <span className="font-semibold text-foreground/80 shrink-0 text-[12px]">
                                  {formatCurrency(expense.amount)}
                                </span>
                              </li>
                            ))}
                          {filteredExpenses.filter(e => e.category === item.id).length > 10 && (
                            <li className="text-center text-xs text-muted-foreground pt-1">
                              و{' '}{filteredExpenses.filter(e => e.category === item.id).length - 10}{' '}مصروف آخر...
                            </li>
                          )}
                        </ul>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              ) : (
                <div className="px-6 py-10 text-center text-muted-foreground text-xs">
                  لا توجد مصاريف لعرضها.
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Trend line chart ─────────────────────────────────────── */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUpIcon className="h-4 w-4 text-primary" />
                اتجاه المصاريف
              </CardTitle>
              <CardDescription className="text-xs">
                {trendChartData.length > 0
                  ? `إجمالي الإنفاق يوماً بيوم خلال ${periodDescription}`
                  : 'لا توجد بيانات كافية.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-4">
              {trendChartData.length > 0 ? (
                <ChartContainer config={chartConfig} className="w-full h-[240px]">
                  <LineChart
                    data={trendChartData}
                    margin={{ top: 20, right: 12, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{ fontSize: 9 }} />
                    <YAxis
                      tickLine={false} axisLine={false} tickMargin={6}
                      tickFormatter={v => formatNumberShort(v as number)}
                      tick={{ fontSize: 9 }}
                    />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null;
                        const total = payload.reduce((s, p) => s + (p.value as number), 0);
                        const breakdown = categoryTrends
                          .map(ct => ({
                            name: ct.categoryName,
                            value: ct.trendData.find(d => d.name === label)?.expenses ?? 0,
                            color: chartConfig[ct.categoryId]?.color,
                          }))
                          .filter(cb => cb.value > 0)
                          .sort((a, b) => b.value - a.value);
                        return (
                          <div className="p-2 rounded-lg border bg-background/95 shadow-lg text-xs min-w-[140px]">
                            <p className="font-bold mb-1">{label}</p>
                            <p className="text-primary font-semibold mb-2 pb-1.5 border-b">
                              الإجمالي: {formatCurrency(total)}
                            </p>
                            <div className="space-y-1">
                              {breakdown.map(cb => (
                                <div key={cb.name} className="flex justify-between gap-3">
                                  <span style={{ color: cb.color }} className="font-medium">{cb.name}</span>
                                  <span className="text-muted-foreground">{formatCurrency(cb.value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      stroke={chartConfig.expenses?.color}
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: chartConfig.expenses?.color, stroke: chartConfig.expenses?.color, strokeWidth: 1 }}
                      activeDot={{ r: 5, strokeWidth: 2 }}
                    />
                  </LineChart>
                </ChartContainer>
              ) : (
                <p className="text-muted-foreground text-center pt-10 text-xs">لا توجد مصاريف لعرضها.</p>
              )}
            </CardContent>
          </Card>

          {/* ── Category trends comparison ────────────────────────────── */}
          {categoryTrends.length > 0 && (() => {
            const allNames = categoryTrends[0].trendData.map(d => d.name);
            const merged = allNames.map(name => {
              const pt: Record<string, string | number> = { name };
              categoryTrends.forEach(ct => {
                pt[ct.categoryId] = ct.trendData.find(d => d.name === name)?.expenses ?? 0;
              });
              return pt;
            });
            return (
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <LineChartIcon className="h-4 w-4 text-primary" />
                    مقارنة الفئات
                  </CardTitle>
                  <CardDescription className="text-xs">
                    أعلى الفئات إنفاقاً خلال {periodDescription}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-4">
                  <ChartContainer config={chartConfig} className="w-full h-[220px]">
                    <LineChart data={merged} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 9 }} tickMargin={6} />
                      <YAxis
                        tickLine={false} axisLine={false}
                        tickFormatter={v => formatNumberShort(v as number)}
                        tick={{ fontSize: 9 }}
                      />
                      <RechartsTooltip
                        content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const nonZero = payload
                            .filter(p => (p.value as number) > 0)
                            .sort((a, b) => (b.value as number) - (a.value as number));
                          if (!nonZero.length) return null;
                          return (
                            <div className="p-2 rounded-lg border bg-background/95 shadow-lg text-xs space-y-1 min-w-[140px]">
                              <p className="font-bold border-b pb-1">{label}</p>
                              {nonZero.map(p => (
                                <div key={String(p.dataKey)} className="flex justify-between gap-3">
                                  <span style={{ color: p.color }} className="font-medium truncate">
                                    {chartConfig[p.dataKey as string]?.label ?? p.dataKey}
                                  </span>
                                  <span className="text-muted-foreground shrink-0">
                                    {formatCurrency(p.value as number)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          );
                        }}
                      />
                      {categoryTrends.map(ct => (
                        <Line
                          key={ct.categoryId}
                          type="monotone"
                          dataKey={ct.categoryId}
                          stroke={chartConfig[ct.categoryId]?.color}
                          strokeWidth={2}
                          dot={{ r: 2, fill: chartConfig[ct.categoryId]?.color }}
                          activeDot={{ r: 4 }}
                        />
                      ))}
                    </LineChart>
                  </ChartContainer>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3 justify-center">
                    {categoryTrends.map(ct => (
                      <div key={ct.categoryId} className="flex items-center gap-1.5 text-xs">
                        <span
                          className="inline-block w-3 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: chartConfig[ct.categoryId]?.color }}
                        />
                        <span className="text-muted-foreground">{ct.categoryName}</span>
                        <span className="font-semibold">{formatCurrency(ct.total)}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* ── AI insights ──────────────────────────────────────────── */}
          <InsightsCard
            key={`${view}-${effectiveMonth}-${effectiveYear}`}
            filteredExpenses={filteredExpenses}
            periodDescription={periodDescription}
          />

          {/* ── Financial coach ───────────────────────────────────────── */}
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
