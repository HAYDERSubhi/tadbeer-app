
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart3Icon, PieChartIcon, TrendingUpIcon, ListOrderedIcon, DollarSign, Loader2Icon } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import type { Expense } from '@/types';
import { format, subDays, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { arSA } from 'date-fns/locale';
import { CATEGORIES as defaultCategories } from '@/lib/constants';

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
  name: string; // Date string
  expenses: number;
}

export default function StatisticsPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMounted, setIsMounted] = useState(false);

  const [pieChartData, setPieChartData] = useState<PieChartDataItem[]>([]);
  const [trendChartData, setTrendChartData] = useState<TrendChartDataItem[]>([]);
  const [monthlyTrendData, setMonthlyTrendData] = useState<TrendChartDataItem[]>([]);
  const [largestExpenses, setLargestExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    setIsMounted(true);
    const storedExpenses = localStorage.getItem('expenses');
    if (storedExpenses) {
      try {
        const parsedExpenses = JSON.parse(storedExpenses) as Expense[];
        setExpenses(parsedExpenses);
        processChartData(parsedExpenses);
      } catch {
        setExpenses([]);
        processChartData([]);
      }
    }
    setIsLoading(false);

    const handleExpensesUpdate = () => {
        const updatedStoredExpenses = localStorage.getItem('expenses');
        if (updatedStoredExpenses) {
          try {
            const updatedParsedExpenses = JSON.parse(updatedStoredExpenses) as Expense[];
            setExpenses(updatedParsedExpenses);
            processChartData(updatedParsedExpenses);
          } catch {
            setExpenses([]);
            processChartData([]);
          }
        } else {
            setExpenses([]);
            processChartData([]);
        }
    };
    window.addEventListener('expensesUpdated', handleExpensesUpdate);
    return () => window.removeEventListener('expensesUpdated', handleExpensesUpdate);

  }, []);

  const processChartData = (currentExpenses: Expense[]) => {
    if (!currentExpenses || currentExpenses.length === 0) {
      setPieChartData([]);
      setTrendChartData([]);
      setLargestExpenses([]);
      setMonthlyTrendData([]);
      return;
    }
    
    const today = new Date();
    const startOfCurrentMonth = startOfMonth(today);
    const endOfCurrentMonth = endOfMonth(today);

    const monthlyExpenses = currentExpenses.filter(exp => {
      try {
        const expenseDate = parseISO(exp.date);
        return isWithinInterval(expenseDate, { start: startOfCurrentMonth, end: endOfCurrentMonth });
      } catch {
        return false;
      }
    });


    // Pie Chart Data (current month)
    const categoryTotals: { [key: string]: number } = {};
    monthlyExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });
    const pieData = Object.entries(categoryTotals).map(([catKey, total]) => ({
      name: defaultCategories[catKey as keyof typeof defaultCategories]?.name || catKey,
      value: total,
      key: catKey,
      fill: defaultCategories[catKey as keyof typeof defaultCategories]?.chartColor || 'hsl(var(--muted))',
    }));
    setPieChartData(pieData);

    // Trend Chart Data (last 7 days)
    const dailyTotals: { [date: string]: number } = {};
    for (let i = 6; i >= 0; i--) {
      const date = subDays(today, i);
      const formattedDate = format(date, 'MMM d', { locale: arSA });
      dailyTotals[formattedDate] = 0;
    }
    currentExpenses.forEach(exp => {
      try {
        const expenseDate = parseISO(exp.date);
        if (expenseDate >= subDays(today, 6)) { // consider expenses from last 7 days
          const formattedDate = format(expenseDate, 'MMM d', { locale: arSA });
          if (dailyTotals.hasOwnProperty(formattedDate)) {
               dailyTotals[formattedDate] += exp.amount;
          }
        }
      } catch (e) {
        // Ignore invalid dates
      }
    });
    const trendData = Object.entries(dailyTotals).map(([dateStr, total]) => ({
      name: dateStr,
      expenses: total,
    }));
    setTrendChartData(trendData);
    
    // Largest Expenses (current month)
    const sortedExpenses = [...monthlyExpenses].sort((a, b) => b.amount - a.amount);
    setLargestExpenses(sortedExpenses.slice(0, 3));

    // Monthly Trend Data (all time)
    const monthlyTotals: { [key: string]: number } = {}; // key: "YYYY-MM"
    currentExpenses.forEach(exp => {
      try {
        const monthKey = format(parseISO(exp.date), 'yyyy-MM');
        monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + exp.amount;
      } catch (e) {
        // Ignore invalid dates
      }
    });

    const trendDataForMonths = Object.entries(monthlyTotals)
      .sort(([monthA], [monthB]) => monthA.localeCompare(monthB))
      .map(([monthKey, total]) => {
          const monthDate = parseISO(`${monthKey}-01`);
          const monthName = format(monthDate, 'MMM yy', { locale: arSA });
          return {
              name: monthName,
              expenses: total,
          };
      });
    setMonthlyTrendData(trendDataForMonths);
  };

  if (!isMounted && isLoading) {
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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChartIcon className="h-6 w-6 text-primary" />
            توزيع مصاريف الشهر الحالي
          </CardTitle>
           {pieChartData.length === 0 && <CardDescription>لا توجد مصاريف مسجلة هذا الشهر.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[350px] flex justify-center">
          {pieChartData.length > 0 ? (
            <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent hideLabel formatter={(value, name, props) => `${props.payload.name}: ${Number(value).toLocaleString()} د.ع`} />}
                />
                <Pie
                  data={pieChartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  labelLine={false}
                  label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name }) => {
                    const RADIAN = Math.PI / 180;
                    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                    const x = cx + radius * Math.cos(-midAngle * RADIAN);
                    const y = cy + radius * Math.sin(-midAngle * RADIAN);
                    if (percent * 100 < 5) return null; // Hide small percentage labels
                    return (
                      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs fill-primary-foreground font-semibold">
                        {`${(percent * 100).toFixed(0)}%`}
                      </text>
                    );
                  }}
                >
                  {pieChartData.map((entry) => (
                    <Cell key={`cell-${entry.key}`} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          ) : (!isLoading && <p className="text-muted-foreground self-center">لا توجد مصاريف لعرضها في هذا الرسم.</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUpIcon className="h-6 w-6 text-primary" />
            اتجاه المصاريف (آخر 7 أيام)
          </CardTitle>
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
                    labelFormatter={(label: string) => `التاريخ: ${label}`}
                  />
                <ChartLegend content={<ChartLegendContent />} />
                <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 6 }} name={chartConfig.expenses.label} />
              </LineChart>
            </ChartContainer>
          ) : (!isLoading && <p className="text-muted-foreground text-center pt-10">لا توجد مصاريف لعرضها في هذا الرسم.</p>)}
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListOrderedIcon className="h-6 w-6 text-primary" />
            أكبر مصاريف الشهر الحالي (أعلى 3)
          </CardTitle>
          {largestExpenses.length === 0 && <CardDescription>لا توجد مصاريف مسجلة هذا الشهر.</CardDescription>}
        </CardHeader>
        <CardContent>
          {largestExpenses.length > 0 ? (
            <ul className="space-y-2">
                {largestExpenses.map(exp => {
                    const categoryInfo = defaultCategories[exp.category as keyof typeof defaultCategories] || defaultCategories.other;
                    return (
                        <li key={exp.id} className="flex justify-between items-center p-3 border-b last:border-b-0 rounded-md hover:bg-muted/50">
                            <div>
                                <p className="font-medium">{exp.title}</p>
                                <p className="text-xs text-muted-foreground">{categoryInfo.name} - {new Date(exp.date).toLocaleDateString('ar-IQ')}</p>
                            </div>
                            <p className="text-destructive font-semibold">{exp.amount.toLocaleString()} د.ع</p>
                        </li>
                    );
                })}
            </ul>
          ) : (!isLoading && <p className="text-muted-foreground text-center py-4">لا توجد مصاريف لعرضها.</p>)}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2">
                <TrendingUpIcon className="h-6 w-6 text-primary" />
                اتجاه المصاريف الشهرية
            </CardTitle>
            {monthlyTrendData.length < 2 && <CardDescription>تحتاج إلى بيانات شهرين على الأقل لعرض الاتجاه.</CardDescription>}
        </CardHeader>
        <CardContent className="h-[300px]">
            {monthlyTrendData.length > 1 ? (
              <ChartContainer config={chartConfig} className="w-full h-full">
                <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis tickFormatter={(value) => `${(Number(value) / 1000)} ألف`} tickLine={false} axisLine={false} tickMargin={8} />
                   <RechartsTooltip
                      contentStyle={{ direction: 'rtl' }}
                      formatter={(value: number, name: string) => [`${value.toLocaleString()} د.ع`, chartConfig.expenses.label ]}
                      labelFormatter={(label: string) => `الشهر: ${label}`}
                    />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 6 }} name={chartConfig.expenses.label} />
                </LineChart>
              </ChartContainer>
            ) : (!isLoading && <p className="text-muted-foreground text-center pt-10">لا توجد بيانات كافية لعرض اتجاه شهري.</p>)}
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
