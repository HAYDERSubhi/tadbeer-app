
"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChartIcon, TrendingUpIcon, BarChart3, ActivityIcon, ListOrdered, Sparkles } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, BarChart, Bar, LabelList } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartLegend, ChartLegendContent } from "@/components/ui/chart";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Expense } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, subDays, getYear, startOfYear, endOfYear, compareDesc, lastDayOfMonth } from 'date-fns';
import { arIQ } from 'date-fns/locale';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { financialCoach, type FinancialCoachOutput, type FinancialCoachInput } from '@/ai/flows/financial-coach';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAppData } from '@/hooks/use-app-data';
import { useCategories } from '@/hooks/use-categories';
import { InsightIcon } from '@/components/dashboard/insight-icon';

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
  icon: React.ReactNode;
  total: number;
  percentage: number;
  color: string;
  chartColor: string;
  budget?: number;
}

const formatValueForLabel = (value: any) => {
    const num = Number(value);
    if (isNaN(num) || num === 0) return '';
    if (num >= 1000000) {
      return `${(num / 1000000).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`;
    }
    return num.toLocaleString('en-US');
};

const CustomLabel = (props: any) => {
    const { x, y, value } = props;
    const formattedValue = formatValueForLabel(value);
    if (!formattedValue) return null;
  
    return (
      <text x={x} y={y} dy={-4} fill="hsl(var(--foreground))" fontSize={9} textAnchor="middle">
        {formattedValue}
      </text>
    );
};

export default function StatisticsPage() {
  const { expenses, userSettings, isLoading: isAppDataLoading } = useAppData();
  const { categories, categoryMap, getIconComponent } = useCategories();

  const categoryBudgets = userSettings?.categoryBudgets || {};

  // Filter state
  const [view, setView] = useState<'month' | 'year'>('month');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  
  const [activeDonutSlice, setActiveDonutSlice] = useState<PieChartDataItem | null>(null);

  // Insights state
  const [insights, setInsights] = useState<FinancialCoachOutput['insights'] | null>(null);
  const [isInsightsLoading, setIsInsightsLoading] = useState(true);

  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const chartConfig = useMemo(() => {
      const config: ChartConfig = {};
      categories.forEach(cat => {
          const defaultCat = Object.values(categoryMap).find(c => c.id === cat.id);
          config[cat.id] = { 
              label: cat.name, 
              color: defaultCat?.chartColor || 'hsl(var(--muted))',
              icon: () => getIconComponent(cat.icon),
          };
      });
      config.expenses = { label: "المصاريف", color: "hsl(var(--primary))" };
      return config;
  }, [categories, categoryMap, getIconComponent]);


  // Derive available years and months from expenses data.
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

    const categoryTotals: { [key: string]: number } = {};
    currentFilteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const pieData: PieChartDataItem[] = Object.entries(categoryTotals).map(([catKey, total]) => ({
      name: categoryMap[catKey]?.name || catKey,
      value: total,
      key: catKey,
      fill: chartConfig[catKey]?.color || 'hsl(var(--muted))',
    }));

    const summaryData: CategorySummaryItem[] = Object.entries(categoryTotals)
      .map(([catKey, total]) => {
        const categoryInfo = categoryMap[catKey];
        const budget = categoryBudgets[catKey];
        
        return {
          id: catKey,
          name: categoryInfo?.name || catKey,
          icon: categoryInfo ? getIconComponent(categoryInfo.icon) : '❓',
          total,
          percentage: totalExpensesInPeriod > 0 ? (total / totalExpensesInPeriod) * 100 : 0,
          color: categoryInfo?.color || 'bg-gray-400',
          chartColor: chartConfig[catKey]?.color || 'hsl(var(--muted))',
          budget,
        };
      })
      .sort((a, b) => b.total - a.total);

    let trendData: TrendChartDataItem[] = [];
    if (view === 'year') {
      const monthlyTotals: { [key: string]: number } = {};
      for (let i = 0; i < 12; i++) {
        const monthKey = format(new Date(selectedYear, i, 1), 'yyyy-MM');
        monthlyTotals[monthKey] = 0;
      }
      currentFilteredExpenses.forEach(exp => {
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
      const dailyTotals: { [date: string]: number } = {};
      let day = periodStart;
      while (day <= periodEnd) {
        const formattedDate = format(day, 'd');
        dailyTotals[formattedDate] = 0;
        day = subDays(day, -1);
      }
      currentFilteredExpenses.forEach(exp => {
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
    
    const lastSixMonths = availableMonths.length > 1 ? availableMonths.slice(0, 6).reverse() : [];
    let categoriesTrendData: any[] = [];

    if (lastSixMonths.length > 1) {
        const trendAnalysisExpenses = expenses.filter(exp => {
            try {
                const monthKey = format(parseISO(exp.date), 'yyyy-MM');
                return lastSixMonths.includes(monthKey);
            } catch { return false; }
        });

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
            
        categoriesTrendData = top6CategoryKeys.map(catKey => {
            const categoryInfo = categoryMap[catKey];
            if (!categoryInfo) return null;
            
            const monthlyTrend = lastSixMonths.map(monthKey => ({
                month: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arIQ }),
                amount: monthlyCategoryTotals[monthKey]?.[catKey] || 0,
            }));
            
            return {
                categoryId: catKey,
                categoryName: categoryInfo.name,
                categoryIcon: getIconComponent(categoryInfo.icon),
                totalAmount: totalSpendingInTrendPeriod[catKey],
                monthlyTrend: monthlyTrend,
            };
        }).filter(Boolean);
    }

    return {
      pieChartData: pieData,
      trendChartData: trendData,
      categorySummary: summaryData,
      totalForPeriod: totalExpensesInPeriod,
      topCategoriesTrendData: categoriesTrendData,
      filteredExpenses: currentFilteredExpenses,
    };
  }, [expenses, view, selectedYear, selectedMonth, categoryBudgets, availableMonths, categoryMap, getIconComponent, chartConfig]);
  
  const financialCoachInput = useMemo(() => {
    // Crucially, wait for all app data to be loaded before trying to create the input
    if (isAppDataLoading || !userSettings) return null;
    
    // Only generate insights if there are expenses to analyze for the period
    if (filteredExpenses.length === 0) return null;

    let totalBudgetForPeriod: number;
    let categoryBudgetsForPeriod: Record<string, number> = {};
    const daysInPeriod = view === 'year' ? 365 : format(lastDayOfMonth(parseISO(`${selectedMonth}-01`)), 'd');

    if (view === 'year') {
        totalBudgetForPeriod = (userSettings.budget?.totalBudget || 0) * 12;
        Object.entries(userSettings.categoryBudgets || {}).forEach(([key, value]) => {
            categoryBudgetsForPeriod[key] = value * 12;
        });
    } else {
        totalBudgetForPeriod = userSettings.budget?.totalBudget || 0;
        categoryBudgetsForPeriod = userSettings.categoryBudgets || {};
    }
    
    const input: FinancialCoachInput = {
        totalBudget: totalBudgetForPeriod,
        zeroSpendDaysTarget: Math.round((userSettings.budget?.zeroSpendDaysTarget || 4) * (Number(daysInPeriod) / 30)),
        expenses: filteredExpenses.map(e => ({
            title: e.title,
            amount: e.amount,
            category: categoryMap[e.category]?.name || e.category,
            date: format(new Date(e.date), 'yyyy-MM-dd'),
        })),
        appTone: userSettings.appTone || 'formal',
    };
    
    if (categoryBudgetsForPeriod) {
        input.categoryBudgets = categoryBudgetsForPeriod;
    }

    if (userSettings.profile) {
        input.userProfile = {
            monthlyIncome: userSettings.profile.monthlyIncome,
            familyMembers: userSettings.profile.familyMembers?.map(({ id, ...rest }) => rest) || [],
        };
    }
    
    return input;
  }, [filteredExpenses, userSettings, categoryMap, view, selectedMonth, isAppDataLoading]);

  useEffect(() => {
    const getInsights = async () => {
      // If there's no valid input, clear insights and stop loading.
      if (!financialCoachInput) {
        setInsights(null);
        setIsInsightsLoading(false);
        return;
      }
      
      // Start loading only when we are sure we will make a request.
      setIsInsightsLoading(true);
      try {
        const result = await financialCoach(financialCoachInput);
        setInsights(result.insights);
      } catch (e) {
        console.error("Failed to get financial insights for stats page", e);
        setInsights(null); // Clear insights on error
      } finally {
        setIsInsightsLoading(false);
      }
    };
    
    getInsights();
    
  }, [financialCoachInput]);


  if (expenses.length === 0 && !isAppDataLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
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
                                        {(availableMonths.length > 0 ? availableMonths : [format(new Date(), 'yyyy-MM')]).map(m => (
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
                                        {(availableYears.length > 0 ? availableYears : [new Date().getFullYear()]).map(y => (
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

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-xs">
            <PieChartIcon className="h-4 w-4 text-primary" />
            توزيع المصاريف
          </CardTitle>
           {pieChartData.length === 0 && <CardDescription className="text-xs">لا توجد مصاريف مسجلة في هذه الفترة.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[250px] flex justify-center">
          {pieChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[220px]">
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
                  outerRadius={70}
                  innerRadius={45}
                  labelLine={false}
                  onMouseEnter={(data) => {
                    setActiveDonutSlice(data.payload);
                  }}
                  onMouseLeave={() => {
                    setActiveDonutSlice(null);
                  }}
                  label={({ name, percent, x, y, payload }) => {
                    if (percent * 100 < 5) return null;
                     const displayName = name.length > 10 ? `${name.substring(0, 8)}...` : name;
                    return (
                        <text
                          x={x}
                          y={y}
                          textAnchor="middle"
                          dominantBaseline="central"
                          className="text-[8px] fill-foreground font-semibold pointer-events-none"
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
                      <p className="text-[10px] text-muted-foreground">{activeDonutSlice ? activeDonutSlice.name : 'الإجمالي'}</p>
                      <p className="text-base font-bold">{activeDonutSlice ? activeDonutSlice.value.toLocaleString() : totalForPeriod.toLocaleString()}&nbsp;د.ع</p>
                       {activeDonutSlice && totalForPeriod > 0 && (
                        <p className="text-[10px] font-semibold" style={{color: activeDonutSlice.fill}}>
                            {`${((activeDonutSlice.value / totalForPeriod) * 100).toFixed(1)}%`}
                        </p>
                      )}
                    </div>
                 </foreignObject>
                <ChartLegend content={<ChartLegendContent nameKey="name" className="text-[10px]" />} />
              </PieChart>
            </ChartContainer>
          ) : (<p className="text-muted-foreground self-center text-xs">لا توجد مصاريف لعرضها.</p>)}
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
            <Accordion type="single" collapsible className="w-full">
              {categorySummary.map(item => (
                <AccordionItem value={item.id} key={item.id} className="border-b" ref={(el) => (itemRefs.current[item.id] = el)}>
                  <AccordionTrigger 
                    className="p-3 hover:no-underline hover:bg-muted/50 transition-colors data-[state=open]:bg-muted/50"
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
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                         <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
                            {item.icon}
                         </span>
                         <div className="flex-1 min-w-0 text-right">
                              <p className="font-semibold text-[11px] truncate">{item.name}</p>
                              <p className="text-[10px] text-muted-foreground">{item.percentage.toFixed(1)}% من الإجمالي</p>
                         </div>
                      </div>
                      <div className='text-left ml-2'>
                        <p className="text-[11px] font-bold shrink-0">{item.total.toLocaleString()}&nbsp;د.ع</p>
                        {item.budget && (
                            <div className='w-16 mt-1'>
                                <Progress value={(item.total / item.budget) * 100} className="h-1" indicatorcolor={ (item.total/item.budget) > 1 ? 'hsl(var(--destructive))' : item.chartColor } />
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
                              .map(expense => (
                                  <li key={expense.id} className="flex justify-between items-center gap-2 text-xs animate-in fade-in duration-300">
                                      <div className="flex-1 min-w-0">
                                          <p className="font-medium text-foreground/90 truncate text-[11px]">{expense.title}</p>
                                          <p className="text-[10px] text-muted-foreground">{format(parseISO(expense.date), 'd MMM', { locale: arIQ })}</p>
                                      </div>
                                      <span className="font-semibold text-foreground/80 shrink-0 whitespace-nowrap text-[11px]">{expense.amount.toLocaleString()}&nbsp;د.ع</span>
                                  </li>
                              ))}
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
            {view === 'year' ? `شهريًا لعام ${selectedYear}` : trendChartData.length > 0 ? `يوميًا لشهر ${format(parseISO(`${selectedMonth}-01`), 'MMMM yyyy', { locale: arIQ })}` : ''}
          </CardDescription>
          {trendChartData.length === 0 && <CardDescription className="text-xs">لا توجد بيانات كافية لعرض الرسم البياني.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[220px]">
          {trendChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="w-full h-full">
              <LineChart data={trendChartData} margin={{ top: 20, right: 15, left: 15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} tick={{fontSize: 9}} />
                <YAxis hide={true} domain={['dataMin', 'dataMax + 5000']} />
                 <RechartsTooltip
                    contentStyle={{ direction: 'rtl' }}
                    formatter={(value: number, name: string) => [`${value.toLocaleString()} د.ع`, chartConfig.expenses.label ]}
                    labelFormatter={(label: string) => view === 'year' ? `الشهر: ${label}` : `اليوم: ${label}`}
                  />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 4 }} name={chartConfig.expenses.label}>
                    <LabelList content={<CustomLabel />} />
                </Line>
              </LineChart>
            </ChartContainer>
          ) : (<p className="text-muted-foreground text-center pt-10 text-xs">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-xs">
            <ActivityIcon className="h-4 w-4 text-primary" />
            تحليل اتجاهات الفئات
          </CardTitle>
          <CardDescription className="text-xs">
            نظرة على تطور الإنفاق في أعلى 6 فئات لديك خلال الشهور الماضية.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-3">
          {topCategoriesTrendData && topCategoriesTrendData.length > 0 ? (
            topCategoriesTrendData.map((catTrend) => (
              <div key={catTrend.categoryId} className="border-t pt-3 first:border-t-0 first:pt-0">
                <div className="mb-2">
                    <div className="flex items-center gap-2">
                        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lg")}>
                            {catTrend.categoryIcon}
                        </span>
                        <h3 className="font-semibold text-xs">{catTrend.categoryName}</h3>
                    </div>
                    <p className="text-xs font-bold text-muted-foreground mt-1">{catTrend.totalAmount.toLocaleString()}&nbsp;د.ع</p>
                </div>
                <div className="h-[150px] w-full">
                  <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer>
                       <LineChart data={catTrend.monthlyTrend} margin={{ top: 20, right: 10, left: 10, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} fontSize={9} />
                          <YAxis hide={true} domain={['dataMin', 'dataMax + 1000']} />
                          <RechartsTooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              contentStyle={{ direction: 'rtl', borderRadius: 'var(--radius)' }}
                              formatter={(value: number) => [`${value.toLocaleString()} د.ع`, null]}
                              labelFormatter={(label: string) => `الشهر: ${label}`}
                          />
                          <Line
                              type="monotone"
                              dataKey="amount"
                              stroke={chartConfig[catTrend.categoryId]?.color || 'hsl(var(--primary))'}
                              strokeWidth={2}
                              activeDot={{ r: 4 }}
                              dot={{r: 3, fill: chartConfig[catTrend.categoryId]?.color || 'hsl(var(--primary))'}}
                          >
                                <LabelList content={<CustomLabel />} />
                          </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </div>
              </div>
            ))
          ) : (
            <div className="flex items-center justify-center h-full py-10">
              <p className="text-muted-foreground text-center text-xs">
                لا توجد بيانات كافية لعرض اتجاهات الفئات (تحتاج لبيانات في شهرين على الأقل).
              </p>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="flex items-center gap-2 text-xs">
            <Sparkles className="h-4 w-4 text-primary" />
            نصائح ذكية
          </CardTitle>
          <CardDescription className="text-xs">تحليلات وتوصيات بناءً على إنفاقك في الفترة المحددة.</CardDescription>
        </CardHeader>
        <CardContent>
          {isInsightsLoading ? (
            <div className="space-y-4">
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
              <div className="flex items-center space-x-4 space-x-reverse"><Skeleton className="h-8 w-8 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /><Skeleton className="h-4 w-[200px]" /></div></div>
            </div>
          ) : insights && insights.length > 0 ? (
            <div className="space-y-3">
              {insights.map((insight, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                   <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                    insight.type === 'praise' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
                    insight.type === 'tip' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
                    insight.type === 'warning' && 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300',
                  )}>
                    <InsightIcon name={insight.icon} className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-semibold text-xs">{insight.title}</p>
                    <p className="text-xs text-muted-foreground">{insight.description}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground p-4 text-xs">
              {filteredExpenses.length > 0 
                ? "لا توجد نصائح حاليًا لهذه الفترة. قد يساعد تحديد ميزانية في الإعدادات."
                : "لا توجد مصاريف في هذه الفترة لتقديم نصائح حولها."
              }
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

    

    