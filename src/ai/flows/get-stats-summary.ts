
// src/ai/flows/get-stats-summary.ts
'use server';
/**
 * @fileOverview An AI flow for calculating and summarizing financial statistics for a given period.
 * This flow performs aggregation on the server to reduce client-side load.
 *
 * - getStatsSummary - The main function to call.
 * - GetStatsSummaryInput - Input type for the function.
 * - GetStatsSummaryOutput - Return type for the function.
 */
import {ai} from '@/ai/genkit';
import {z} from 'genkit';
import type { Expense, UserSettings } from '@/types';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval, startOfYear, endOfYear, subDays } from 'date-fns';
import { arIQ } from 'date-fns/locale';

const PieChartDataItemSchema = z.object({
  name: z.string(),
  value: z.number(),
  key: z.string(),
  fill: z.string(),
  percentage: z.number(),
});

const TrendChartDataItemSchema = z.object({
  name: z.string(),
  expenses: z.number(),
});

const CategoryTrendDataSchema = z.object({
  categoryId: z.string(),
  categoryName: z.string(),
  categoryIcon: z.string(),
  total: z.number(),
  chartColor: z.string(),
  trendData: z.array(TrendChartDataItemSchema),
});

const CategorySummaryItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  icon: z.string(),
  total: z.number(),
  percentage: z.number(),
  chartColor: z.string(),
  budget: z.number().optional(),
});

const GetStatsSummaryInputSchema = z.object({
  expenses: z.array(z.any()).describe("The user's expenses, fetched on the client."),
  view: z.enum(['month', 'year']).describe("The time frame view, either 'month' or 'year'."),
  selectedPeriod: z.string().describe("The selected period, e.g., '2024-07' for month view or '2024' for year view."),
  userSettings: z.any().describe("The user's settings object, containing categories and budgets."),
});

const GetStatsSummaryOutputSchema = z.object({
  pieChartData: z.array(PieChartDataItemSchema),
  trendChartData: z.array(TrendChartDataItemSchema),
  categorySummary: z.array(CategorySummaryItemSchema),
  categoryTrends: z.array(CategoryTrendDataSchema),
  totalForPeriod: z.number(),
  filteredExpenses: z.array(z.any()), // We can be loose with the expense type here as it's for display only
  periodDescription: z.string(),
});

// Export types only, not schemas.
export type GetStatsSummaryInput = z.infer<typeof GetStatsSummaryInputSchema>;
export type GetStatsSummaryOutput = z.infer<typeof GetStatsSummaryOutputSchema>;

// It's a data processing flow that runs on the server.
export async function getStatsSummary(input: GetStatsSummaryInput): Promise<GetStatsSummaryOutput> {
    const { expenses, view, selectedPeriod, userSettings } = input;

    const categories = userSettings.categories || [];
    const categoryMap = categories.reduce((acc: any, cat: any) => {
        acc[cat.id] = cat;
        return acc;
    }, {});
    const categoryBudgets = userSettings.categoryBudgets || {};
    const chartColors = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'];

    let filteredExpenses: Expense[];
    let periodStart: Date, periodEnd: Date;
    let periodDescription = '';

    if (view === 'year') {
      const year = parseInt(selectedPeriod, 10);
      periodStart = startOfYear(new Date(year, 0, 1));
      periodEnd = endOfYear(new Date(year, 0, 1));
      periodDescription = `عام ${selectedPeriod}`;
    } else {
      const yearFromMonth = parseInt(selectedPeriod.substring(0, 4), 10);
      const monthFromMonth = parseInt(selectedPeriod.substring(5, 7), 10) - 1;
      periodStart = startOfMonth(new Date(yearFromMonth, monthFromMonth));
      periodEnd = endOfMonth(periodStart);
      periodDescription = `شهر ${format(periodStart, 'MMMM yyyy', { locale: arIQ })}`;
    }

    filteredExpenses = expenses.filter(exp => {
      try {
        return isWithinInterval(parseISO(exp.date), { start: periodStart, end: periodEnd });
      } catch {
        return false;
      }
    });

    const totalForPeriod = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const categoryTotals: { [key: string]: number } = {};
    filteredExpenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const pieChartData = Object.entries(categoryTotals)
      .map(([key, value], index) => {
          const categoryDetails = categoryMap[key];
          const colorIndex = categoryDetails ? parseInt(categoryDetails.color, 10) - 1 : index % 5;
          return {
            name: categoryMap[key]?.name || key,
            value: value,
            key: key,
            fill: `hsl(var(${chartColors[colorIndex % 5]}))`,
            percentage: totalForPeriod > 0 ? (value / totalForPeriod) * 100 : 0,
          };
      })
      .sort((a, b) => b.value - a.value);

    const categorySummary = pieChartData.map(item => ({
      id: item.key,
      name: categoryMap[item.key]?.name || item.key,
      icon: categoryMap[item.key]?.icon || '❓',
      total: item.value,
      percentage: item.percentage,
      chartColor: item.fill,
      budget: categoryBudgets[item.key],
    }));

    let trendChartData: {name: string, expenses: number}[] = [];
    const categoryTrends: GetStatsSummaryOutput['categoryTrends'] = [];
    
    // Select top 5 categories for trend analysis
    const topCategoryIds = categorySummary.slice(0, 5).map(c => c.id);

    if (view === 'year') {
      const monthlyTotals: { [key: string]: number } = {};
      const categoryMonthlyTotals: { [catId: string]: { [monthKey: string]: number } } = {};

      for (let i = 0; i < 12; i++) {
        const monthKey = format(new Date(parseInt(selectedPeriod), i, 1), 'yyyy-MM');
        monthlyTotals[monthKey] = 0;
        topCategoryIds.forEach(catId => {
            if (!categoryMonthlyTotals[catId]) categoryMonthlyTotals[catId] = {};
            categoryMonthlyTotals[catId][monthKey] = 0;
        });
      }

      filteredExpenses.forEach(exp => {
        const monthKey = format(parseISO(exp.date), 'yyyy-MM');
        if (monthlyTotals.hasOwnProperty(monthKey)) {
            monthlyTotals[monthKey] += exp.amount;
            if (topCategoryIds.includes(exp.category)) {
                categoryMonthlyTotals[exp.category][monthKey] += exp.amount;
            }
        }
      });
      
      trendChartData = Object.entries(monthlyTotals).map(([monthKey, total]) => ({
        name: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arIQ }),
        expenses: total,
      }));

      topCategoryIds.forEach(catId => {
        const categoryDetails = categoryMap[catId];
        if (categoryDetails) {
            categoryTrends.push({
                categoryId: catId,
                categoryName: categoryDetails.name,
                categoryIcon: categoryDetails.icon,
                total: categorySummary.find(c => c.id === catId)?.total || 0,
                chartColor: `var(--chart-${categoryDetails.color})`,
                trendData: Object.entries(categoryMonthlyTotals[catId]).map(([monthKey, total]) => ({
                    name: format(parseISO(`${monthKey}-01`), 'MMM', { locale: arIQ }),
                    expenses: total,
                })),
            });
        }
      });

    } else { // month view
      const dailyTotals: { [date: string]: number } = {};
      const categoryDailyTotals: { [catId: string]: { [dayKey: string]: number } } = {};

      let day = periodStart;
      while (day <= periodEnd) {
        const dayKey = format(day, 'd');
        dailyTotals[dayKey] = 0;
        topCategoryIds.forEach(catId => {
            if (!categoryDailyTotals[catId]) categoryDailyTotals[catId] = {};
            categoryDailyTotals[catId][dayKey] = 0;
        });
        day = subDays(day, -1);
      }
      
      filteredExpenses.forEach(exp => {
        const dayKey = format(parseISO(exp.date), 'd');
        if (dailyTotals.hasOwnProperty(dayKey)) {
            dailyTotals[dayKey] += exp.amount;
            if (topCategoryIds.includes(exp.category)) {
                categoryDailyTotals[exp.category][dayKey] += exp.amount;
            }
        }
      });
      
      trendChartData = Object.entries(dailyTotals).map(([dateStr, total]) => ({
        name: dateStr,
        expenses: total,
      }));

       topCategoryIds.forEach(catId => {
        const categoryDetails = categoryMap[catId];
        if (categoryDetails) {
            categoryTrends.push({
                categoryId: catId,
                categoryName: categoryDetails.name,
                categoryIcon: categoryDetails.icon,
                total: categorySummary.find(c => c.id === catId)?.total || 0,
                chartColor: `var(--chart-${categoryDetails.color})`,
                trendData: Object.entries(categoryDailyTotals[catId]).map(([dayKey, total]) => ({
                    name: dayKey,
                    expenses: total,
                })),
            });
        }
      });
    }

    return {
      pieChartData,
      trendChartData,
      categorySummary,
      categoryTrends,
      totalForPeriod,
      filteredExpenses,
      periodDescription,
    };
}
