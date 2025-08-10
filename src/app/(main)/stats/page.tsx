// src/app/(main)/stats/page.tsx
"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChartIcon, TrendingUpIcon, ListOrdered, Loader2, BarChart, AreaChart } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Sector, Area } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, getYear, startOfYear, endOfYear, compareDesc } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { InsightsCard } from './InsightsCard';
import { getStatsSummaryAction } from '@/app/actions';
import type { GetStatsSummaryOutput } from '@/ai/flows/get-stats-summary';
import { useAuth } from '@/hooks/use-auth';
import { Skeleton } from '@/components/ui/skeleton';

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
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
    </g>
  );
};

export default function StatisticsPage() {
  const { user } = useAuth();
  const { expenses, userSettings, isLoading: isAppDataLoading } = useAppData();
  const { categories, getIconComponent } = useCategories();
  
  const [view, setView] =useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  
  const [activeIndex, setActiveIndex] = useState(0);

  const [statsData, setStatsData] = useState<GetStatsSummaryOutput | null>(null);
  const [isStatsLoading, setIsStatsLoading] = useState(true);

  const availableYears = useMemo(() => {
    if (!expenses || expenses.length === 0) return [new Date().getFullYear()];
    const dates = expenses.map(e => {
        try { return parseISO(e.date); } catch { return null; }
    }).filter(Boolean) as Date[];
    return Array.from(new Set(dates.map(d => getYear(d)))).sort((a, b) => b - a);
  }, [expenses]);

  const availableMonths = useMemo(() => {
    if (!expenses || expenses.length === 0) return [format(new Date(), 'yyyy-MM')];
    const dates = expenses.map(e => {
        try { return parseISO(e.date); } catch { return null; }
    }).filter(Boolean) as Date[];
    return Array.from(new Set(dates.map(d => format(d, 'yyyy-MM')))).sort((a, b) => b.localeCompare(a));
  }, [expenses]);
  
  const chartConfig = useMemo(() => {
      const config: ChartConfig = {};
      const chartColors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];
      categories.forEach(cat => {
          const colorIndex = parseInt(cat.color, 10) - 1;
          config[cat.id] = { 
              label: cat.name, 
              icon: () => getIconComponent(cat.icon),
              color: `hsl(var(${chartColors[colorIndex % 5]}))`,
          };
      });
      config.expenses = { label: "المصاريف", color: "hsl(var(--primary))" };
      return config;
  }, [categories, getIconComponent]);
  
  useEffect(() => {
    if (!user || isAppDataLoading) return;

    const fetchStats = async () => {
        setIsStatsLoading(true);
        try {
            const result = await getStatsSummaryAction({
                expenses,
                view,
                selectedPeriod: view === 'month' ? selectedMonth : String(selectedYear),
                userSettings,
            });
            setStatsData(result);
        } catch (error) {
            console.error("Failed to fetch stats summary:", error);
            setStatsData(null);
        } finally {
            setIsStatsLoading(false);
        }
    };

    fetchStats();
  }, [user, view, selectedMonth, selectedYear, userSettings, isAppDataLoading, expenses]);

  useEffect(() => {
    if (availableYears.length > 0 && !availableYears.includes(selectedYear)) {
        setSelectedYear(availableYears[0]);
    }
    if (availableMonths.length > 0 && !availableMonths.includes(selectedMonth)) {
        setSelectedMonth(availableMonths[0]);
    }
  }, [availableYears, availableMonths, selectedYear, selectedMonth]);
  
  const onPieEnter = useCallback((_: any, index: number) => {
    setActiveIndex(index);
  }, []);
  
  const { pieChartData, trendChartData, categorySummary, totalForPeriod, filteredExpenses, periodDescription } = useMemo(() => {
     if (!statsData) return { pieChartData: [], trendChartData: [], categorySummary: [], totalForPeriod: 0, filteredExpenses: [], periodDescription: '' };
     return {
        ...statsData,
        categorySummary: statsData.categorySummary.map(summary => ({
            ...summary,
            icon: getIconComponent(summary.icon)
        }))
     }
  }, [statsData, getIconComponent]);


  if (isAppDataLoading) {
    return <div className="flex justify-center items-center h-[60vh]"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (expenses.length === 0 && !isAppDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <BarChart className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-bold mb-2">لا توجد بيانات لعرضها</h2>
        <p className="text-xs text-muted-foreground">ابدأ بإضافة بعض المصاريف لترى الإحصائيات هنا.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4 pb-24">
       <Card>
            <CardContent className="p-3">
                <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'year')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 h-9">
                        <TabsTrigger value="month" className="text-xs">شهري</TabsTrigger>
                        <TabsTrigger value="year" className="text-xs">سنوي</TabsTrigger>
                    </TabsList>
                    <TabsContent value="month" className="mt-3">
                        <div className="relative">
                           <div className="overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
                                <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="w-full">
                                    <TabsList className="h-8">
                                        {availableMonths.map(m => (
                                            <TabsTrigger key={m} value={m} className="whitespace-nowrap text-xs px-2 py-1 h-auto">
                                                {format(parseISO(`${m}-01`), 'MMMM yyyy', {locale: arIQ})}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                           </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="year" className="mt-3">
                         <div className="relative">
                           <div className="overflow-x-auto pb-2 -mx-3 px-3 scrollbar-hide">
                                <Tabs value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))} className="w-full">
                                    <TabsList className="h-8">
                                        {availableYears.map(y => (
                                            <TabsTrigger key={y} value={String(y)} className="text-xs px-2 py-1 h-auto">
                                                {y}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                           </div>
                        </div>
                    </TabsContent>
                </Tabs>
            </CardContent>
        </Card>
      
      {isStatsLoading ? (
        <div className="space-y-4">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
            <Card>
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-xs">
                        <PieChartIcon className="h-4 w-4 text-primary" />
                        توزيع المصاريف
                    </CardTitle>
                     <CardDescription className="text-xs">
                        إجمالي الإنفاق في {periodDescription}: {totalForPeriod.toLocaleString()} د.ع
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {pieChartData.length > 0 ? (
                       <ChartContainer config={chartConfig} className="w-full h-[250px]">
                            <ResponsiveContainer>
                                <PieChart>
                                    <RechartsTooltip
                                        cursor={false}
                                        content={<ChartTooltipContent hideLabel />}
                                    />
                                    <Pie
                                        data={pieChartData}
                                        activeIndex={activeIndex}
                                        activeShape={renderActiveShape}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        dataKey="value"
                                        onMouseEnter={onPieEnter}
                                    >
                                        {pieChartData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                        </ChartContainer>
                    ) : (<p className="text-muted-foreground text-xs text-center py-10">لا توجد مصاريف لعرضها.</p>)}
                </CardContent>
            </Card>
      
            <Card>
                <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-xs">
                    <ListOrdered className="h-4 w-4 text-primary" />
                    ملخص الفئات
                </CardTitle>
                <CardDescription className="text-xs">
                    {categorySummary.length === 0 ? 'لا توجد مصاريف مسجلة في هذه الفترة.' : 'اضغط على فئة لعرض تفاصيلها.'}
                </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                {categorySummary.length > 0 ? (
                    <Accordion type="single" collapsible className="w-full" onValueChange={(value) => {
                        const newIndex = categorySummary.findIndex(item => item.id === value);
                        if (newIndex !== -1) setActiveIndex(newIndex);
                    }}>
                    {categorySummary.map((item) => (
                        <AccordionItem value={item.id} key={item.id} className="border-b">
                        <AccordionTrigger 
                            className="p-3 hover:no-underline hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/50"
                        >
                            <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span style={{ color: item.chartColor }} className="font-bold text-lg">{item.icon}</span>
                                <div className="flex-1 min-w-0 text-right">
                                    <p className="font-semibold text-xs truncate">{item.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                                </div>
                            </div>
                            <div className='text-left ml-2'>
                                <p className="text-xs font-bold shrink-0">{item.total.toLocaleString()}&nbsp;د.ع</p>
                                {item.budget && (item.total / item.budget) > 0 && (
                                    <div className='w-16 mt-1 h-1.5 bg-secondary rounded-full'>
                                        <div 
                                          className={`h-1.5 rounded-full ${(item.total/item.budget) > 1 ? 'bg-destructive' : 'bg-primary'}`}
                                          style={{ width: `${Math.min((item.total / item.budget) * 100, 100)}%`}}
                                        />
                                    </div>
                                )}
                            </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent className="px-3 pb-3 bg-muted/20">
                            <ul className="space-y-2 pt-2 border-t">
                                {filteredExpenses
                                    .filter(exp => exp.category === item.id)
                                    .sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date)))
                                    .slice(0, 10) // Show top 10 for brevity
                                    .map(expense => (
                                        <li key={expense.id} className="flex justify-between items-center gap-2 text-xs animate-in fade-in duration-300">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-foreground/90 truncate text-[11px]">{expense.title}</p>
                                                <p className="text-[10px] text-muted-foreground">{format(parseISO(expense.date), 'd MMM', { locale: arIQ })}</p>
                                            </div>
                                            <span className="font-semibold text-foreground/80 shrink-0 whitespace-nowrap text-[11px]">{expense.amount.toLocaleString()}&nbsp;د.ع</span>
                                        </li>
                                    ))}
                                {filteredExpenses.filter(exp => exp.category === item.id).length > 10 && (
                                    <li className="text-center text-xs text-muted-foreground pt-1">... و المزيد</li>
                                )}
                            </ul>
                        </AccordionContent>
                        </AccordionItem>
                    ))}
                    </Accordion>
                ) : (
                    <div className="px-6 py-10 text-center text-muted-foreground text-xs">
                        <p>لا توجد مصاريف لعرضها.</p>
                    </div>
                )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-xs">
                    <TrendingUpIcon className="h-4 w-4 text-primary" />
                    اتجاه المصاريف
                </CardTitle>
                <CardDescription className="text-xs">
                    {trendChartData.length > 0 ? `اتجاه الإنفاق خلال ${periodDescription}` : 'لا توجد بيانات كافية.'}
                </CardDescription>
                </CardHeader>
                <CardContent className="h-[250px]">
                {trendChartData.length > 0 ? (
                    <ChartContainer config={chartConfig} className="w-full h-full">
                        <AreaChart data={trendChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{fontSize: 9}} />
                            <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `${(value as number / 1000)}k`} tick={{fontSize: 9}} />
                            <RechartsTooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const total = payload.reduce((sum, item) => sum + (item.value as number), 0);
                                        return (
                                            <div className="p-2 rounded-lg border bg-background/95 shadow-lg text-xs">
                                                <p className="font-bold mb-1">{label}</p>
                                                <p className="text-primary font-semibold">الإجمالي: {total.toLocaleString()} د.ع</p>
                                                <div className="mt-1 border-t pt-1 space-y-1">
                                                {filteredExpenses
                                                    .filter(e => format(parseISO(e.date), view === 'year' ? 'MMM' : 'd', { locale: arIQ }) === label)
                                                    .reduce((acc, curr) => {
                                                        const existing = acc.find(item => item.category === curr.category);
                                                        if (existing) {
                                                            existing.amount += curr.amount;
                                                        } else {
                                                            acc.push({ category: curr.category, amount: curr.amount });
                                                        }
                                                        return acc;
                                                    }, [] as { category: string, amount: number}[])
                                                    .sort((a,b) => b.amount - a.amount)
                                                    .slice(0,3)
                                                    .map(item => (
                                                        <div key={item.category} className="flex justify-between items-center gap-2">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-2 h-2 rounded-full" style={{backgroundColor: chartConfig[item.category]?.color || '#ccc'}} />
                                                                <span>{chartConfig[item.category]?.label}</span>
                                                            </div>
                                                            <span>{item.amount.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" fill="var(--color-expenses)" fillOpacity={0.1} />
                        </AreaChart>
                    </ChartContainer>
                ) : (<p className="text-muted-foreground text-center pt-10 text-xs">لا توجد مصاريف لعرضها.</p>)}
                </CardContent>
            </Card>
      
            <InsightsCard
                key={`${view}-${selectedMonth}-${selectedYear}`}
                filteredExpenses={filteredExpenses}
                periodDescription={periodDescription}
            />
        </>
      )}
      
    </div>
  );
}
