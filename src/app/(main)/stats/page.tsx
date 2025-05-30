
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3Icon, PieChartIcon, TrendingUpIcon, ListOrderedIcon } from "lucide-react";
import {ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import type { ChartConfig } from "@/components/ui/chart";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";


const mockExpenseDataRaw = [
  { name: 'طعام', value: 40000, key: 'food' },
  { name: 'مواصلات', value: 15000, key: 'transport' },
  { name: 'تسوق', value: 25000, key: 'shopping' },
  { name: 'فواتير', value: 10000, key: 'bills' },
  { name: 'ترفيه', value: 5000, key: 'entertainment' },
];

const mockTrendData = [
  { name: 'الأسبوع 1', expenses: 50000, budget: 60000 },
  { name: 'الأسبوع 2', expenses: 45000, budget: 60000 },
  { name: 'الأسبوع 3', expenses: 60000, budget: 60000 },
  { name: 'الأسبوع 4', expenses: 55000, budget: 60000 },
];

const mockLargestExpenses = [
    { name: "عشاء فاخر", amount: 75000, date: "2024-07-15", category: "طعام" },
    { name: "تذكرة طيران", amount: 250000, date: "2024-07-10", category: "سفر" },
    { name: "هاتف جديد", amount: 1200000, date: "2024-07-05", category: "إلكترونيات" },
];

const chartConfig = {
  food: { label: "طعام", color: "hsl(var(--chart-1))" },
  transport: { label: "مواصلات", color: "hsl(var(--chart-2))" },
  shopping: { label: "تسوق", color: "hsl(var(--chart-3))" },
  bills: { label: "فواتير", color: "hsl(var(--chart-4))" },
  entertainment: { label: "ترفيه", color: "hsl(var(--chart-5))" },
  expenses: { label: "المصاريف", color: "hsl(var(--chart-1))" },
  budget: { label: "الميزانية", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;


export default function StatisticsPage() {
  return (
    <div className="space-y-6 pb-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PieChartIcon className="h-6 w-6 text-primary" />
            توزيع المصاريف حسب الفئة
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[350px] flex justify-center">
          <ChartContainer config={chartConfig} className="mx-auto aspect-square max-h-[300px]">
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent hideLabel formatter={(value, name, props) => `${props.payload.name}: ${Number(value).toLocaleString()} د.ع`} />}
              />
              <Pie
                data={mockExpenseDataRaw}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                labelLine={false}
                label={({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }) => {
                  const RADIAN = Math.PI / 180;
                  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
                  const x = cx + radius * Math.cos(-midAngle * RADIAN);
                  const y = cy + radius * Math.sin(-midAngle * RADIAN);
                  return (
                    <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="text-xs fill-primary-foreground">
                      {`${(percent * 100).toFixed(0)}%`}
                    </text>
                  );
                }}
              >
                {mockExpenseDataRaw.map((entry) => (
                  <Cell key={`cell-${entry.key}`} fill={`var(--color-${entry.key})`} />
                ))}
              </Pie>
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <TrendingUpIcon className="h-6 w-6 text-primary" />
            اتجاه المصاريف
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
          <ChartContainer config={chartConfig} className="w-full h-full">
            <LineChart data={mockTrendData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickFormatter={(value) => `${(value / 1000)} ألف`} tickLine={false} axisLine={false} tickMargin={8} />
              <ChartTooltip
                cursor={true}
                content={<ChartTooltipContent formatter={(value, name) => `${chartConfig[name as keyof typeof chartConfig]?.label || name}: ${Number(value).toLocaleString()} د.ع`} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Line type="monotone" dataKey="expenses" strokeWidth={2} stroke="var(--color-expenses)" activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="budget" strokeWidth={2} stroke="var(--color-budget)" activeDot={{ r: 6 }} />
            </LineChart>
          </ChartContainer>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <ListOrderedIcon className="h-6 w-6 text-primary" />
            أكبر المصاريف
          </CardTitle>
        </CardHeader>
        <CardContent>
            <ul className="space-y-2">
                {mockLargestExpenses.map(exp => (
                    <li key={exp.name} className="flex justify-between items-center p-3 border-b last:border-b-0 rounded-md hover:bg-muted/50">
                        <div>
                            <p className="font-medium">{exp.name}</p>
                            <p className="text-xs text-muted-foreground">{exp.category} - {new Date(exp.date).toLocaleDateString('ar-IQ')}</p>
                        </div>
                        <p className="font-semibold text-destructive">{exp.amount.toLocaleString()} د.ع</p>
                    </li>
                ))}
            </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
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
