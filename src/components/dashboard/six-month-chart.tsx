"use client";

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { useAppData } from '@/hooks/use-app-data';
import { useCurrency } from '@/hooks/use-currency';
import {
  subMonths,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  format,
} from 'date-fns';
import { ar } from 'date-fns/locale';

const CustomTooltip = ({
  active,
  payload,
  label,
  formatCurrency,
  budget,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
  formatCurrency: (n: number) => string;
  budget: number;
}) => {
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value as number;
  const overBudget = budget > 0 && value > budget;
  return (
    <div className="rounded-lg border bg-background/95 shadow-lg p-2 text-xs min-w-[130px]">
      <p className="font-bold mb-1 border-b pb-1">{label}</p>
      <p className={overBudget ? 'text-destructive font-semibold' : 'text-foreground'}>
        {formatCurrency(value)}
      </p>
      {budget > 0 && (
        <p className="text-muted-foreground mt-0.5">
          {((value / budget) * 100).toFixed(0)}% من الميزانية
        </p>
      )}
    </div>
  );
};

export function SixMonthChart() {
  const { expenses, userSettings, isLoading } = useAppData();
  const { format: formatCurrency } = useCurrency();
  const budget = userSettings?.budget?.totalBudget ?? 0;

  const chartData = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const monthDate = subMonths(now, 5 - i); // oldest first
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);

      const total = expenses
        .filter(e => {
          try {
            return isWithinInterval(parseISO(e.date), { start, end });
          } catch {
            return false;
          }
        })
        .reduce((s, e) => s + e.amount, 0);

      return {
        name: format(monthDate, 'MMM', { locale: ar }),
        total,
        isCurrentMonth: i === 5,
      };
    });
  }, [expenses]);

  if (isLoading) return null;
  if (chartData.every(d => d.total === 0)) return null;

  const maxVal = Math.max(...chartData.map(d => d.total), budget);

  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="flex items-center gap-2 text-xs font-semibold">
          <TrendingUp className="h-4 w-4 text-primary" />
          مقارنة آخر 6 أشهر
        </CardTitle>
        <CardDescription className="text-xs">
          {budget > 0 ? 'الخط الأحمر يمثل الميزانية الشهرية' : 'إجمالي الإنفاق خلال آخر 6 أشهر'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 4, left: -20, bottom: 0 }}
            barCategoryGap="30%"
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="name"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickFormatter={v =>
                v >= 1_000_000
                  ? `${(v / 1_000_000).toFixed(1)}M`
                  : v >= 1_000
                  ? `${(v / 1_000).toFixed(0)}K`
                  : String(v)
              }
              tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }}
              domain={[0, maxVal * 1.15]}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted)/0.4)' }}
              content={
                <CustomTooltip formatCurrency={formatCurrency} budget={budget} />
              }
            />
            {budget > 0 && (
              <ReferenceLine
                y={budget}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 3"
                strokeWidth={1.5}
                label={{
                  value: 'الميزانية',
                  position: 'insideTopRight',
                  fontSize: 9,
                  fill: 'hsl(var(--destructive))',
                }}
              />
            )}
            <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={40}>
              {chartData.map((entry, index) => {
                const overBudget = budget > 0 && entry.total > budget;
                const isCurrent = entry.isCurrentMonth;
                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      overBudget
                        ? 'hsl(var(--destructive))'
                        : isCurrent
                        ? 'hsl(var(--primary))'
                        : 'hsl(var(--primary)/0.45)'
                    }
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-[10px] text-muted-foreground justify-center">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-primary" />
            الشهر الحالي
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3 h-2 rounded-sm bg-primary/45" />
            أشهر سابقة
          </div>
          {budget > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3 h-[2px] bg-destructive rounded-full" style={{ borderTop: '2px dashed' }} />
              <span className="inline-block w-3 border-t-2 border-dashed border-destructive" />
              تجاوز الميزانية
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
