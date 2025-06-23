
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3Icon, PieChartIcon, TrendingUpIcon, ListOrderedIcon, DollarSign, Loader2Icon, XCircle } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subDays, getYear, startOfYear, endOfYear, compareDesc } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Chart config using keys from defaultCategories
const chartConfig = Object.entries(defaultCategories).reduce((acc, [key, value]) => {
  acc[key as keyof typeof acc] = { label: value.name, color: value.chartColor };
  return acc;
}, {} as ChartConfig & { expenses: { label: string, color: string }});

chartConfig.expenses = { label: "المصاريف", color: "hsl(var(--accent))" };


interface PieChartDataItem {
  name: string;
  value: number;
  key: string; // category id
  fill: string;
}

interface TrendChartDataItem {
  name: string; // Date string or month string
  expenses: number;
}

interface CategorySummaryItem {
  id: string;
  name: string;
  icon: string;
  total: number;
  percentage: number;
  color: string;
  budget?: number;
}

export default function StatisticsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  // Filter state
  const [view, setView] = useState<'month' | 'year'>('month');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]); // "YYYY-MM" format
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [focusedCategory, setFocusedCategory] = useState<string | null>(null);

  // Chart data state
  const [pieChartData, setPieChartData] = useState<PieChartDataItem[]>([]);
  const [trendChartData, setTrendChartData] = useState<TrendChartDataItem[]>([]);
  const [categorySummary, setCategorySummary] = useState<CategorySummaryItem[]>([]);
  const [totalForPeriod, setTotalForPeriod] = useState(0);
  const [activeDonutSlice, setActiveDonutSlice] = useState<PieChartDataItem | null>(null);

  useEffect(() => {
    setIsMounted(true);
    
    const handleDataUpdate = () => {
        // Load expenses
        const storedExpenses = localStorage.getItem('expenses');
        const parsedExpenses = storedExpenses ? JSON.parse(storedExpenses) as Expense[] : [];
        setExpenses(parsedExpenses);

        // Load category budgets
        const storedCategoryBudgets = localStorage.getItem('categoryBudgets');
        const parsedCategoryBudgets = storedCategoryBudgets ? JSON.parse(storedCategoryBudgets) : {};
        setCategoryBudgets(parsedCategoryBudgets);

        if (parsedExpenses.length > 0) {
            const dates = parsedExpenses.map(e => parseISO(e.date));
            const uniqueYears = Array.from(new Set(dates.map(d => getYear(d)))).sort((a,b) => b-a);
            setAvailableYears(uniqueYears);

            const uniqueMonths = Array.from(new Set(dates.map(d => format(d, 'yyyy-MM')))).sort((a,b) => b.localeCompare(a));
            setAvailableMonths(uniqueMonths);
            
            if (uniqueYears.length > 0 && !uniqueYears.includes(selectedYear)) {
                setSelectedYear(uniqueYears[0]);
            }
            if (uniqueMonths.length > 0 && !uniqueMonths.includes(selectedMonth)) {
                setSelectedMonth(uniqueMonths[0]);
            }
        } else {
            setAvailableYears([]);
            setAvailableMonths([]);
        }
    };
    
    handleDataUpdate();
    setIsLoading(false);

    window.addEventListener('expensesUpdated', handleDataUpdate);
    window.addEventListener('budgetUpdated', handleDataUpdate);
    return () => {
        window.removeEventListener('expensesUpdated', handleDataUpdate);
        window.removeEventListener('budgetUpdated', handleDataUpdate);
    };

  }, []);

  useEffect(() => {
    if (expenses) {
      processChartData(expenses, view, selectedYear, selectedMonth, categoryBudgets, focusedCategory);
    } else {
      setPieChartData([]);
      setTrendChartData([]);
      setCategorySummary([]);
      setTotalForPeriod(0);
    }
  }, [expenses, view, selectedYear, selectedMonth, categoryBudgets, isMounted, focusedCategory]);

  const processChartData = (currentExpenses: Expense[], currentView: 'month' | 'year', year: number, monthStr: string, currentCategoryBudgets: Record<string, number>, focusedCategoryId: string | null) => {
    if (!isMounted) return;

    let filteredExpenses: Expense[];
    let periodStart: Date, periodEnd: Date;

    if (currentView === 'year') {
        periodStart = startOfYear(new Date(year, 0, 1));
        periodEnd = endOfYear(new Date(year, 0, 1));
    } else { // 'month' view
        periodStart = parseISO(`${monthStr}-01`);
        periodEnd = endOfMonth(periodStart);
    }

    filteredExpenses = currentExpenses.filter(exp => {
      try {
        const expenseDate = parseISO(exp.date);
        return isWithinInterval(expenseDate, { start: periodStart, end: periodEnd });
      } catch {
        return false;
      }
    });
    
    const totalExpensesInPeriod = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    setTotalForPeriod(totalExpensesInPeriod);

    // Pie Chart & Category Summary Data (always based on all expenses in period)
    const categoryTotals: { [key: string]: number } = {};
    filteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const pieData: PieChartDataItem[] = Object.entries(categoryTotals).map(([catKey, total]) => ({
      name: defaultCategories[catKey as keyof typeof defaultCategories]?.name || catKey,
      value: total,
      key: catKey,
      fill: defaultCategories[catKey as keyof typeof defaultCategories]?.chartColor || 'hsl(var(--muted))',
    }));
    setPieChartData(pieData);
    
    const summaryData: CategorySummaryItem[] = Object.entries(categoryTotals)
        .map(([catKey, total]) => {
            const categoryInfo = defaultCategories[catKey as keyof typeof defaultCategories] || defaultCategories.other;
            const budget = currentCategoryBudgets[catKey];
            return {
                id: catKey,
                name: categoryInfo.name,
                icon: categoryInfo.icon,
                total,
                percentage: totalExpensesInPeriod > 0 ? (total / totalExpensesInPeriod) * 100 : 0,
                color: categoryInfo.color,
                budget,
            };
        })
        .sort((a, b) => b.total - a.total);
    setCategorySummary(summaryData);


    // Trend Chart Data (based on focused category if one is selected)
    const trendSourceData = focusedCategoryId
        ? filteredExpenses.filter(exp => exp.category === focusedCategoryId)
        : filteredExpenses;
        
    if (currentView === 'year') {
        const monthlyTotals: { [key: string]: number } = {}; // key: "YYYY-MM"
        for (let i = 0; i < 12; i++) {
            const monthKey = format(new Date(year, i, 1), 'yyyy-MM');
            monthlyTotals[monthKey] = 0;
        }
        trendSourceData.forEach(exp => {
            const monthKey = format(parseISO(exp.date), 'yyyy-MM');
            if (monthlyTotals.hasOwnProperty(monthKey)) {
              monthlyTotals[monthKey] += exp.amount;
            }
        });

        const trendData = Object.entries(monthlyTotals).map(([monthKey, total]) => ({
            name: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arSA }),
            expenses: total,
        }));
        setTrendChartData(trendData);
    } else { // 'month' view, show daily trend
        const dailyTotals: { [date: string]: number } = {};
        let day = periodStart;
        while (day <= periodEnd) {
            const formattedDate = format(day, 'd');
            dailyTotals[formattedDate] = 0;
            day = subDays(day, -1); // next day
        }

        trendSourceData.forEach(exp => {
            const formattedDate = format(parseISO(exp.date), 'd');
            if (dailyTotals.hasOwnProperty(formattedDate)) {
                dailyTotals[formattedDate] += exp.amount;
            }
        });
        const trendData = Object.entries(dailyTotals).map(([dateStr, total]) => ({
            name: dateStr,
            expenses: total,
        }));
        setTrendChartData(trendData);
    }
  };
  
  if (!isMounted || isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2Icon className="h-12 w-12 animate-spin text-primary" /></div>;
  }

  if (expenses.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-display mb-2">لا توجد بيانات مصاريف لعرضها</h2>
        <p className="text-muted-foreground">ابدأ بإضافة بعض المصاريف لترى الإحصائيات هنا.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
       <Card>
            <CardContent className="p-4">
                <Tabs value={view} onValueChange={(v) => setView(v as 'month' | 'year')} className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="month">شهري</TabsTrigger>
                        <TabsTrigger value="year">سنوي</TabsTrigger>
                    </TabsList>
                    <TabsContent value="month" className="mt-4">
                        <div className="relative">
                           <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                <Tabs value={selectedMonth} onValueChange={setSelectedMonth} className="w-full">
                                    <TabsList>
                                        {(availableMonths.length > 0 ? availableMonths : [format(new Date(), 'yyyy-MM')]).map(m => (
                                            <TabsTrigger key={m} value={m} className="whitespace-nowrap">
                                                {format(parseISO(`${m}-01`), 'MMMM yyyy', {locale: arSA})}
                                            </TabsTrigger>
                                        ))}
                                    </TabsList>
                                </Tabs>
                           </div>
                        </div>
                    </TabsContent>
                    <TabsContent value="year" className="mt-4">
                         <div className="relative">
                           <div className="overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
                                <Tabs value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))} className="w-full">
                                    <TabsList>
                                        {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
                                            <TabsTrigger key={y} value={String(y)}>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" />
            توزيع المصاريف
          </CardTitle>
           {pieChartData.length === 0 && <CardDescription>لا توجد مصاريف مسجلة في هذه الفترة.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[350px] flex justify-center">
          {pieChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
              <PieChart>
                <RechartsTooltip
                  cursor={false}
                  content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="rounded-lg border bg-background p-2 shadow-sm">
                            <div className="grid grid-cols-2 gap-2">
                              <div className="flex flex-col">
                                <span className="text-[0.70rem] uppercase text-muted-foreground">
                                  {payload[0].payload.name}
                                </span>
                                <span className="font-bold text-muted-foreground">
                                  {payload[0].value?.toLocaleString()} د.ع
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      }
                      return null
                  }}
                />
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={70}
                  labelLine={false}
                  onMouseEnter={(data) => {
                    setActiveDonutSlice(data);
                  }}
                  onMouseLeave={() => {
                    setActiveDonutSlice(null);
                  }}
                  label={({ name, percent, x, y }) => {
                    if (percent * 100 < 8) return null; // Only show for larger slices to avoid clutter
                    const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                    return (
                      <text
                        x={x}
                        y={y}
                        textAnchor="middle"
                        dominantBaseline="central"
                        className="text-[10px] fill-primary-foreground font-semibold pointer-events-none"
                      >
                        <tspan x={x} dy="-0.5em">{displayName}</tspan>
                        <tspan x={x} dy="1.2em">{`${(percent * 100).toFixed(0)}%`}</tspan>
                      </text>
                    );
                  }}
                >
                  {pieChartData.map((entry) => (
                    <Cell key={`cell-${entry.key}`} fill={entry.fill} />
                  ))}
                </Pie>
                 <foreignObject width="100%" height="100%">
                    <div className="w-full h-full flex flex-col justify-center items-center text-center">
                      <p className="text-sm text-muted-foreground">{activeDonutSlice ? activeDonutSlice.name : 'الإجمالي'}</p>
                      <p className="text-2xl font-bold">{activeDonutSlice ? activeDonutSlice.value.toLocaleString() : totalForPeriod.toLocaleString()}&nbsp;د.ع</p>
                       {activeDonutSlice && totalForPeriod > 0 && (
                        <p className="text-sm font-semibold" style={{color: activeDonutSlice.fill}}>
                            {`${((activeDonutSlice.value / totalForPeriod) * 100).toFixed(1)}%`}
                        </p>
                      )}
                    </div>
                 </foreignObject>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          ) : (!isLoading && <p className="text-muted-foreground self-center">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
              <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="h-6 w-6 text-primary" />
                {focusedCategory ? `اتجاه مصاريف: ${defaultCategories[focusedCategory as keyof typeof defaultCategories]?.name}` : 'اتجاه المصاريف'}
              </CardTitle>
              {focusedCategory && (
                  <Button variant="ghost" size="sm" onClick={() => setFocusedCategory(null)} className="flex items-center gap-1 text-sm">
                      <XCircle className="h-4 w-4" />
                      عرض الكل
                  </Button>
              )}
          </div>
          <CardDescription>
            {view === 'year' ? `شهريًا لعام ${selectedYear}` : `يوميًا لشهر ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: arSA })}`}
          </CardDescription>
          {trendChartData.length === 0 && <CardDescription>لا توجد بيانات كافية لعرض الرسم البياني.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[300px]">
          {trendChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={trendChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickFormatter={(value) => `${(Number(value) / 1000)} ألف`} tickLine={false} axisLine={false} tickMargin={8} />
                 <RechartsTooltip
                    contentStyle={{ direction: 'rtl' }}
                    formatter={(value: number, name: string) => [`${value.toLocaleString()} د.ع`, chartConfig.expenses.label ]}
                    labelFormatter={(label: string) => view === 'year' ? `الشهر: ${label}` : `اليوم: ${label}`}
                  />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 6 }} name={chartConfig.expenses.label} />
              </LineChart>
            </ChartContainer>
          ) : (!isLoading && <p className="text-muted-foreground text-center pt-10">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrderedIcon className="h-6 w-6 text-primary" />
            ملخص الفئات
          </CardTitle>
          <CardDescription>
            {focusedCategory 
                ? 'تم تحديد فئة. قم بإلغاء الفلترة لعرض الملخص.' 
                : (categorySummary.length === 0 ? 'لا توجد مصاريف مسجلة في هذه الفترة.' : 'اضغط على فئة لعرض اتجاهها البياني.')
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {categorySummary.length > 0 && !focusedCategory ? (
            <ul className="divide-y divide-border">
                {categorySummary.map(item => (
                    <li 
                      key={item.id}
                      className="flex items-center justify-between p-4 cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => setFocusedCategory(item.id)}
                    >
                      <div className="flex items-center gap-4">
                         <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                            {item.icon}
                         </span>
                         <div>
                              <p className="font-semibold">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                         </div>
                      </div>
                      <p className="text-lg font-bold text-end shrink-0">{item.total.toLocaleString()}&nbsp;د.ع</p>
                    </li>
                ))}
            </ul>
          ) : (!isLoading && 
                <div className="px-6 py-10 text-center text-muted-foreground">
                    <p>{focusedCategory ? ' ' : 'لا توجد مصاريف لعرضها.'}</p>
                </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3Icon className="h-6 w-6 text-primary" />
            تنبؤات المصاريف
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-8">سيتم عرض تنبؤات المصاريف هنا قريباً.</p>
        </CardContent>
      </Card>
    </div>
  );
}

    