"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3Icon, PieChartIcon, TrendingUpIcon, ListOrderedIcon } from "lucide-react";
import {ResponsiveContainer, PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

const mockExpenseData = [
  { name: 'طعام', value: 40000, color: '#FF6384' },
  { name: 'مواصلات', value: 15000, color: '#36A2EB' },
  { name: 'تسوق', value: 25000, color: '#FFCE56' },
  { name: 'فواتير', value: 10000, color: '#4BC0C0' },
  { name: 'ترفيه', value: 5000, color: '#9966FF' },
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


export default function StatisticsPage() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <PieChartIcon className="h-6 w-6 text-primary" />
            توزيع المصاريف حسب الفئة
          </CardTitle>
        </CardHeader>
        <CardContent className="h-[300px]">
           <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mockExpenseData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {mockExpenseData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip formatter={(value: number) => `${value.toLocaleString()} د.ع`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
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
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(value) => `${(value / 1000)} ألف`} />
              <RechartsTooltip formatter={(value: number) => `${value.toLocaleString()} د.ع`} />
              <Legend />
              <Line type="monotone" dataKey="expenses" name="المصاريف" stroke="#FF6384" activeDot={{ r: 8 }} />
              <Line type="monotone" dataKey="budget" name="الميزانية" stroke="#36A2EB" />
            </LineChart>
          </ResponsiveContainer>
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
                    <li key={exp.name} className="flex justify-between items-center p-2 border-b">
                        <div>
                            <p className="font-medium">{exp.name}</p>
                            <p className="text-xs text-muted-foreground">{exp.category} - {new Date(exp.date).toLocaleDateString('ar-IQ')}</p>
                        </div>
                        <p className="font-semibold">{exp.amount.toLocaleString()} د.ع</p>
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
