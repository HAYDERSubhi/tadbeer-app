

"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChartIcon, TrendingUpIcon, ListOrderedIcon, DollarSign, Wand2, ActivityIcon } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, BarChart, Bar } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subDays, getYear, startOfYear, endOfYear, isAfter, compareDesc, differenceInDays } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { forecastExpenses, ForecastExpensesOutput } from '@/ai/flows/forecast-expenses';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAuth } from '@/hooks/use-auth';
import { useAppData } from '@/hooks/use-app-data';


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
  chartColor: string;
  budget?: number;
}

interface ForecastData {
  totalForecastAmount: number;
  categoryForecasts: {
    categoryName: string;
    predictedAmount: number;
  }[];
  advice: string;
}

export default function StatisticsPage() {
  const { user } = useAuth();
  const { expenses, userSettings } = useAppData();

  const categoryBudgets = userSettings?.categoryBudgets || {};

  // Filter state
  const [view, setView] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  
  const [activeDonutSlice, setActiveDonutSlice] = useState<PieChartDataItem | null>(null);

  // Forecast state
  const [forecast, setForecast] = useState<ForecastData | null>(null);
  const [isForecastLoading, setIsForecastLoading] = useState(true);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Derive available years and months from expenses data.
  // This is more efficient than using state and useEffect for derived data.
  const availableYears = useMemo(() => {
    if (expenses.length === 0) return [];
    const dates = expenses.map(e => {
        try { return parseISO(e.date); } catch { return null; }
    }).filter(Boolean) as Date[];
    return Array.from(new Set(dates.map(d => getYear(d)))).sort((a, b) => b - a);
  }, [expenses]);

  const availableMonths = useMemo(() => {
    if (expenses.length === 0) return [];
    const dates = expenses.map(e => {
        try { return parseISO(e.date); } catch { return null; }
    }).filter(Boolean) as Date[];
    return Array.from(new Set(dates.map(d => format(d, 'yyyy-MM')))).sort((a, b) => b.localeCompare(a));
  }, [expenses]);

  // This effect safely synchronizes the selected filter with the available options.
  // It runs only when the available options change (i.e., when expenses change).
  // Using the functional form of setState prevents an infinite loop.
  useEffect(() => {
    setSelectedYear(currentYear => {
        if (availableYears.length > 0 && !availableYears.includes(currentYear)) {
            return availableYears[0];
        }
        return currentYear;
    });
    
    setSelectedMonth(currentMonth => {
        if (availableMonths.length > 0 && !availableMonths.includes(currentMonth)) {
            return availableMonths[0];
        }
        return currentMonth;
    });
  }, [availableYears, availableMonths]);
  
  const {
    pieChartData,
    trendChartData,
    categorySummary,
    totalForPeriod,
    topCategoriesTrendData,
    filteredExpenses
  } = useMemo(() => {
    if (!expenses) {
      return {
        pieChartData: [],
        trendChartData: [],
        categorySummary: [],
        totalForPeriod: 0,
        topCategoriesTrendData: [],
        filteredExpenses: [],
      };
    }

    let currentFilteredExpenses: Expense[];
    let periodStart: Date, periodEnd: Date;

    if (view === 'year') {
      periodStart = startOfYear(new Date(selectedYear, 0, 1));
      periodEnd = endOfYear(new Date(selectedYear, 0, 1));
    } else {
      // 'month' view
      const yearFromMonth = parseInt(selectedMonth.substring(0, 4), 10);
      const monthFromMonth = parseInt(selectedMonth.substring(5, 7), 10) - 1;

      if(isNaN(yearFromMonth) || isNaN(monthFromMonth)) {
          periodStart = new Date();
          periodEnd = new Date();
      } else {
         periodStart = startOfMonth(new Date(yearFromMonth, monthFromMonth));
         periodEnd = endOfMonth(periodStart);
      }
    }

    currentFilteredExpenses = expenses.filter(exp => {
      try {
        const expenseDate = parseISO(exp.date);
        return isWithinInterval(expenseDate, { start: periodStart, end: periodEnd });
      } catch {
        return false;
      }
    });

    const totalExpensesInPeriod = currentFilteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    // Pie Chart & Category Summary Data
    const categoryTotals: { [key: string]: number } = {};
    currentFilteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const pieData: PieChartDataItem[] = Object.entries(categoryTotals).map(([catKey, total]) => ({
      name: defaultCategories[catKey as keyof typeof defaultCategories]?.name || catKey,
      value: total,
      key: catKey,
      fill: defaultCategories[catKey as keyof typeof defaultCategories]?.chartColor || 'hsl(var(--muted))',
    }));

    const summaryData: CategorySummaryItem[] = Object.entries(categoryTotals)
      .map(([catKey, total]) => {
        const categoryInfo = defaultCategories[catKey as keyof typeof defaultCategories];
        const budget = categoryBudgets[catKey];

        // If the category is not in our predefined list, create a temporary entry for it.
        const effectiveCategoryInfo = categoryInfo || {
            name: catKey, // Use the key as the name
            icon: '❓', // Default icon for unknown
            color: 'bg-gray-400',
            chartColor: 'hsl(var(--muted))',
        };

        return {
          id: catKey,
          name: effectiveCategoryInfo.name,
          icon: effectiveCategoryInfo.icon,
          total,
          percentage: totalExpensesInPeriod > 0 ? (total / totalExpensesInPeriod) * 100 : 0,
          color: effectiveCategoryInfo.color,
          chartColor: effectiveCategoryInfo.chartColor,
          budget,
        };
      })
      .sort((a, b) => b.total - a.total);

    // Trend Chart Data
    const trendSourceData = currentFilteredExpenses;

    let trendData: TrendChartDataItem[] = [];
    if (view === 'year') {
      const monthlyTotals: { [key: string]: number } = {}; // key: "YYYY-MM"
      for (let i = 0; i < 12; i++) {
        const monthKey = format(new Date(selectedYear, i, 1), 'yyyy-MM');
        monthlyTotals[monthKey] = 0;
      }
      trendSourceData.forEach(exp => {
        const monthKey = format(parseISO(exp.date), 'yyyy-MM');
        if (monthlyTotals.hasOwnProperty(monthKey)) {
          monthlyTotals[monthKey] += exp.amount;
        }
      });
      trendData = Object.entries(monthlyTotals).map(([monthKey, total]) => ({
        name: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arIQ }),
        expenses: total,
      }));
    } else {
      // 'month' view, show daily trend
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
      trendData = Object.entries(dailyTotals).map(([dateStr, total]) => ({
        name: dateStr,
        expenses: total,
      }));
    }
    
    // Top 6 categories trend data (OPTIMIZED)
    const lastSixMonths = availableMonths.length > 1 ? availableMonths.slice(0, 6).reverse() : [];
    let categoriesTrendData: any[] = [];

    if (lastSixMonths.length > 1) {
        const trendAnalysisExpenses = expenses.filter(exp => {
            try {
                const monthKey = format(parseISO(exp.date), 'yyyy-MM');
                return lastSixMonths.includes(monthKey);
            } catch { return false; }
        });

        // Pre-process data to avoid nested loops
        const monthlyCategoryTotals: Record<string, Record<string, number>> = {};
        lastSixMonths.forEach(monthKey => {
            monthlyCategoryTotals[monthKey] = {};
        });

        trendAnalysisExpenses.forEach(exp => {
            const monthKey = format(parseISO(exp.date), 'yyyy-MM');
            if (!monthlyCategoryTotals[monthKey]) {
                monthlyCategoryTotals[monthKey] = {};
            }
            monthlyCategoryTotals[monthKey][exp.category] = (monthlyCategoryTotals[monthKey][exp.category] || 0) + exp.amount;
        });
        
        // Calculate total spending per category over the period to find the top 6
        const totalSpendingInTrendPeriod: Record<string, number> = {};
        Object.values(monthlyCategoryTotals).forEach(categoryTotals => {
            Object.entries(categoryTotals).forEach(([catKey, amount]) => {
                totalSpendingInTrendPeriod[catKey] = (totalSpendingInTrendPeriod[catKey] || 0) + amount;
            });
        });
        
        const top6CategoryKeys = Object.entries(totalSpendingInTrendPeriod)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 6)
            .map(([key]) => key);
            
        // Build the final structure using the pre-processed data
        categoriesTrendData = top6CategoryKeys.map(catKey => {
            const categoryInfo = defaultCategories[catKey as keyof typeof defaultCategories] || defaultCategories.other;
            const monthlyTrend = lastSixMonths.map(monthKey => {
                const amount = monthlyCategoryTotals[monthKey]?.[catKey] || 0;
                return {
                    month: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arIQ }),
                    amount: amount,
                };
            });
            
            return {
                categoryId: catKey,
                categoryName: categoryInfo.name,
                categoryIcon: categoryInfo.icon,
                totalAmount: totalSpendingInTrendPeriod[catKey],
                monthlyTrend: monthlyTrend,
            };
        });
    }

    return {
      pieChartData: pieData,
      trendChartData: trendData,
      categorySummary: summaryData,
      totalForPeriod: totalExpensesInPeriod,
      topCategoriesTrendData: categoriesTrendData,
      filteredExpenses: currentFilteredExpenses,
    };
  }, [expenses, view, selectedYear, selectedMonth, categoryBudgets, availableMonths]);
  
  // Effect for fetching forecast
  useEffect(() => {
    const getForecast = async () => {
      // Need at least a few expenses to forecast
      if (expenses.length < 5) {
        setIsForecastLoading(false);
        setForecast(null);
        return;
      }
      
      setIsForecastLoading(true);

      const ninetyDaysAgo = subDays(new Date(), 90);
      const relevantExpenses = expenses.filter(exp => {
        try {
            return isAfter(parseISO(exp.date), ninetyDaysAgo);
        } catch { return false; }
      });
      
      // Still need some data in the last 90 days
      if(relevantExpenses.length < 5) {
         setIsForecastLoading(false);
         setForecast(null);
         return;
      }

      // Find the date of the first expense in the period to get an accurate duration
      const firstExpenseDate = relevantExpenses.reduce((oldest, exp) => {
        const expDate = parseISO(exp.date);
        return expDate < oldest ? expDate : oldest;
      }, new Date());

      const daysInPeriod = Math.max(differenceInDays(new Date(), firstExpenseDate), 1);
      
      const totalSpentInPeriod = relevantExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      const averageDailySpend = totalSpentInPeriod / daysInPeriod;
      const totalForecastAmount = Math.round(averageDailySpend * 30);

      const categoryTotals: { [key: string]: number } = {};
      relevantExpenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      });

      const categoryForecasts = Object.entries(categoryTotals)
        .map(([catKey, total]) => ({
          categoryName: defaultCategories[catKey as keyof typeof defaultCategories]?.name || catKey,
          predictedAmount: Math.round((total / daysInPeriod) * 30),
        }))
        .sort((a,b) => b.predictedAmount - a.predictedAmount)
        .slice(0, 5);

      try {
        const aiResult = await forecastExpenses({ 
          totalForecastAmount,
          categoryForecasts,
          historicalExpenses: relevantExpenses.slice(0, 20).map(e => ({ // send a sample for context
            amount: e.amount,
            category: defaultCategories[e.category as keyof typeof defaultCategories]?.name || e.category,
            date: format(new Date(e.date), 'yyyy-MM-dd'),
          })),
        });
        
        // Combine calculated data with AI advice
        setForecast({
            totalForecastAmount,
            categoryForecasts,
            advice: aiResult.advice,
        });
        
      } catch (e) {
        console.error("Failed to get forecast advice", e);
        // Fallback: Show calculated forecast even if AI fails
        setForecast({
            totalForecastAmount,
            categoryForecasts,
            advice: 'نوصي بمراجعة الفئات الأعلى إنفاقاً والنظر في وضع ميزانية لها.',
        });
      } finally {
        setIsForecastLoading(false);
      }
    };

    getForecast();
  }, [expenses]);

  const formatYAxisTick = (tick: any) => {
    const value = Number(tick);
    if (isNaN(value)) return tick;

    if (value >= 1000000) {
      return `${(value / 1000000).toLocaleString('ar-IQ', { maximumFractionDigits: 1 })} مليون`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toLocaleString('ar-IQ', { maximumFractionDigits: 0 })} ألف`;
    }
    return value.toLocaleString('ar-IQ');
  };

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <DollarSign className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-2xl font-display mb-2">لا توجد بيانات مصاريف لعرضها</h2>
        <p className="text-muted-foreground">ابدأ بإضافة بعض المصاريف لترى الإحصائيات هنا.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
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
                                                {format(parseISO(`${m}-01`), 'MMMM yyyy', {locale: arIQ})}
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
            <PieChartIcon className="h-5 w-5 text-primary" />
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
                    setActiveDonutSlice(data.payload);
                  }}
                  onMouseLeave={() => {
                    setActiveDonutSlice(null);
                  }}
                  label={({ name, percent, x, y, payload }) => {
                    if (percent * 100 < 5) return null; // Only show for larger slices to avoid clutter
                     const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                    return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[10px] fill-foreground font-semibold pointer-events-none"
                          style={{ fill: payload.fill }}
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
          ) : (<p className="text-muted-foreground self-center">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrderedIcon className="h-5 w-5 text-primary" />
            ملخص الفئات
          </CardTitle>
          <CardDescription>
            {categorySummary.length === 0 ? 'لا توجد مصاريف مسجلة في هذه الفترة.' : 'اضغط على فئة لعرض تفاصيلها.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {categorySummary.length > 0 ? (
            <Accordion type="single" collapsible className="w-full">
              {categorySummary.map(item => (
                <AccordionItem value={item.id} key={item.id} className="border-b" ref={(el) => (itemRefs.current[item.id] = el)}>
                  <AccordionTrigger 
                    className="p-4 hover:no-underline hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/50 text-base font-medium"
                    onClick={() => {
                      setTimeout(() => {
                        const itemEl = itemRefs.current[item.id];
                        if (itemEl && itemEl.dataset.state === 'open') {
                          itemEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                        }
                      }, 250);
                    }}
                  >
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                         <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-muted text-2xl">
                            {item.icon}
                         </span>
                         <div className="flex-1 min-w-0 text-right">
                              <p className="font-semibold truncate">{item.name}</p>
                              <p className="text-sm text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                         </div>
                      </div>
                      <div className='text-left ml-4'>
                        <p className="text-lg font-bold shrink-0">{item.total.toLocaleString()}&nbsp;د.ع</p>
                        {item.budget && (
                            <div className='w-24 mt-1'>
                                <Progress value={(item.total / item.budget) * 100} className="h-2" indicatorcolor={ (item.total/item.budget) > 1 ? 'hsl(var(--destructive))' : item.chartColor } />
                            </div>
                        )}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 bg-muted/20">
                      <ul className="space-y-3 pt-3 border-t">
                          {filteredExpenses
                              .filter(exp => exp.category === item.id)
                              .sort((a,b) => compareDesc(parseISO(a.date), parseISO(b.date)))
                              .map(expense => (
                                  <li key={expense.id} className="flex justify-between items-center gap-4 text-sm animate-in fade-in duration-300">
                                      <div className="flex-1 min-w-0">
                                          <p className="font-medium text-foreground/90 truncate">{expense.title}</p>
                                          <p className="text-xs text-muted-foreground">{format(parseISO(expense.date), 'd MMM', { locale: arIQ })}</p>
                                      </div>
                                      <span className="font-semibold text-foreground/80 shrink-0 whitespace-nowrap">{expense.amount.toLocaleString()}&nbsp;د.ع</span>
                                  </li>
                              ))}
                      </ul>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
                <div className="px-6 py-10 text-center text-muted-foreground">
                    <p>لا توجد مصاريف لعرضها.</p>
                </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-5 w-5 text-primary" />
            اتجاه المصاريف
          </CardTitle>
          <CardDescription>
            {view === 'year' ? `شهريًا لعام ${selectedYear}` : trendChartData.length > 0 ? `يوميًا لشهر ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: arIQ })}` : ''}
          </CardDescription>
          {trendChartData.length === 0 && <CardDescription>لا توجد بيانات كافية لعرض الرسم البياني.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[300px]">
          {trendChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={trendChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickFormatter={formatYAxisTick} tickLine={false} axisLine={false} tickMargin={8} width={60} />
                 <RechartsTooltip
                    contentStyle={{ direction: 'rtl' }}
                    formatter={(value: number, name: string) => [`${value.toLocaleString()} د.ع`, chartConfig.expenses.label ]}
                    labelFormatter={(label: string) => view === 'year' ? `الشهر: ${label}` : `اليوم: ${label}`}
                  />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 6 }} name={chartConfig.expenses.label} />
              </LineChart>
            </ChartContainer>
          ) : (<p className="text-muted-foreground text-center pt-10">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5 text-primary" />
            تحليل اتجاهات الفئات
          </CardTitle>
          <CardDescription>
            نظرة على تطور الإنفاق في أعلى 6 فئات لديك خلال الشهور الماضية.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {topCategoriesTrendData && topCategoriesTrendData.length > 0 ? (
            topCategoriesTrendData.map((catTrend) => (
              <div key={catTrend.categoryId} className="border-t pt-6 first:border-t-0 first:pt-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-xl", defaultCategories[catTrend.categoryId as keyof typeof defaultCategories]?.color)}>
                            {catTrend.categoryIcon}
                        </span>
                        <h3 className="text-lg font-semibold">{catTrend.categoryName}</h3>
                    </div>
                    <p className="text-lg font-bold text-muted-foreground mb-4">{catTrend.totalAmount.toLocaleString()}&nbsp;د.ع</p>
                </div>
                <div className="h-[200px] w-full">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer>
                       <LineChart data={catTrend.monthlyTrend} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={12} />
                          <YAxis tickFormatter={formatYAxisTick} tickLine={false} axisLine={false} tickMargin={8} fontSize={12} width={60} />
                          <RechartsTooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              contentStyle={{ direction: 'rtl', borderRadius: 'var(--radius)' }}
                              formatter={(value: number) => [`${value.toLocaleString()} د.ع`, null]}
                              labelFormatter={(label: string) => `الشهر: ${label}`}
                          />
                          <Line
                              type="monotone"
                              dataKey="amount"
                              stroke={`var(--color-${catTrend.categoryId})`}
                              strokeWidth={2.5}
                              activeDot={{ r: 6 }}
                          />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-muted-foreground text-center">
                لا توجد بيانات كافية لعرض اتجاهات الفئات (تحتاج لبيانات في شهرين على الأقل).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            تنبؤات المصاريف
          </CardTitle>
          <CardDescription>توقعات الإنفاق للشهر القادم بناءً على بياناتك التاريخية.</CardDescription>
        </CardHeader>
        <CardContent>
          {isForecastLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 space-x-reverse">
                  <Skeleton className="h-8 w-1/3" />
              </div>
              <div className="flex items-center space-x-4 space-x-reverse">
                  <Skeleton className="h-12 w-1/2" />
              </div>
              <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-[150px]" />
                <Skeleton className="h-10 w-full" />
              </div>
               <div className="space-y-2 pt-4">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-6 w-full" />
              </div>
            </div>
          ) : forecast ? (
             <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي المصروف المتوقع للشهر القادم</p>
                  <p className="text-3xl font-bold text-primary">{forecast.totalForecastAmount.toLocaleString()} د.ع</p>
                </div>
                
                <div className="space-y-2">
                  <p className="font-semibold">نصيحة ذكية:</p>
                  <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg border">{forecast.advice}</p>
                </div>

                <div className="space-y-3">
                    <p className="font-semibold">التوقعات حسب الفئة:</p>
                    <div className="space-y-4">
                        {forecast.categoryForecasts.sort((a,b) => b.predictedAmount - a.predictedAmount).map(catForecast => {
                            const categoryId = Object.keys(defaultCategories).find(key => defaultCategories[key as keyof typeof defaultCategories].name === catForecast.categoryName);
                            const categoryInfo = categoryId ? defaultCategories[categoryId as keyof typeof defaultCategories] : defaultCategories.other;
                            const percentage = forecast.totalForecastAmount > 0 ? (catForecast.predictedAmount / forecast.totalForecastAmount) * 100 : 0;

                            return (
                                <div key={catForecast.categoryName}>
                                    <div className="flex justify-between items-center mb-1">
                                        <div className="flex items-center gap-2">
                                            <span className="text-lg">{categoryInfo.icon}</span>
                                            <span className="text-sm font-medium">{catForecast.categoryName}</span>
                                        </div>
                                        <span className="text-sm font-semibold">{catForecast.predictedAmount.toLocaleString()} د.ع</span>
                                    </div>
                                    <Progress value={percentage} className="h-2" indicatorcolor={categoryInfo.chartColor} />
                                </div>
                            )
                        })}
                    </div>
                </div>

              </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              لا توجد بيانات كافية لإنشاء تنبؤ. أضف المزيد من المصاريف لتبدأ.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
