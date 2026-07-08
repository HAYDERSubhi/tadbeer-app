'use server';
/**
 * @fileOverview AI flow for cross-month spending pattern analysis.
 * Compares current month vs previous month per category to surface
 * meaningful trends ("Food spending up 40% vs last month").
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MonthDataSchema = z.object({
  monthLabel: z.string().describe('Human-readable month name in Arabic, e.g. يونيو'),
  totalSpent: z.number(),
  categories: z.array(z.object({
    name: z.string(),
    amount: z.number(),
    percentage: z.number().describe('Percentage of total spending for this month (0-100)'),
  })),
});

const AnalyzeMonthlyTrendsInputSchema = z.object({
  currentMonth: MonthDataSchema,
  previousMonth: MonthDataSchema,
  budget: z.number().optional(),
  appTone: z.enum(['formal', 'colloquial']).optional(),
});
export type AnalyzeMonthlyTrendsInput = z.infer<typeof AnalyzeMonthlyTrendsInputSchema>;

const TrendInsightSchema = z.object({
  icon: z.enum(['TrendingUp', 'TrendingDown', 'AlertTriangle', 'CheckCircle', 'Lightbulb', 'Flame']),
  title: z.string().describe('Short Arabic title (max 5 words)'),
  description: z.string().describe('One clear Arabic sentence with specific numbers/percentages'),
  sentiment: z.enum(['positive', 'warning', 'neutral']),
});

const AnalyzeMonthlyTrendsOutputSchema = z.object({
  overallTrend: z.enum(['improving', 'worsening', 'stable']),
  insights: z.array(TrendInsightSchema).min(2).max(3),
});
export type AnalyzeMonthlyTrendsOutput = z.infer<typeof AnalyzeMonthlyTrendsOutputSchema>;

export async function analyzeMonthlyTrends(
  input: AnalyzeMonthlyTrendsInput
): Promise<AnalyzeMonthlyTrendsOutput> {
  // Guard: need data in at least one month
  if (input.currentMonth.totalSpent === 0 && input.previousMonth.totalSpent === 0) {
    return {
      overallTrend: 'stable',
      insights: [
        { icon: 'Lightbulb', title: 'لا توجد بيانات كافية', description: 'أضف مصاريف لشهرين على الأقل لرؤية تحليل مقارن.', sentiment: 'neutral' },
      ],
    };
  }
  return analyzeMonthlyTrendsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeMonthlyTrendsPrompt',
  input: { schema: AnalyzeMonthlyTrendsInputSchema },
  output: { schema: AnalyzeMonthlyTrendsOutputSchema },
  prompt: `You are a financial data analyst. Compare the user's spending between two months and generate concise, data-driven insights in Arabic. Always use specific numbers and percentages. Do NOT give generic advice — every insight must reference actual data.

Tone: {{#if (eq appTone "colloquial")}}Friendly Iraqi dialect (عامية عراقية).{{else}}Professional Modern Standard Arabic (فصحى).{{/if}}

**Data:**
Current month ({{currentMonth.monthLabel}}):
- Total: {{currentMonth.totalSpent}} د.ع
{{#each currentMonth.categories}}- {{this.name}}: {{this.amount}} د.ع ({{this.percentage}}%)
{{/each}}

Previous month ({{previousMonth.monthLabel}}):
- Total: {{previousMonth.totalSpent}} د.ع
{{#each previousMonth.categories}}- {{this.name}}: {{this.amount}} د.ع ({{this.percentage}}%)
{{/each}}

{{#if budget}}- Monthly budget: {{budget}} د.ع{{/if}}

**Instructions:**
1. Set overallTrend: "improving" if total spending decreased, "worsening" if it increased, "stable" if change < 5%.
2. Generate 2-3 insights:
   - Find the category with the BIGGEST % change between months (up or down). Always include this.
   - Note if overall spending trend is significant (>10% change).
   - If one category dominates spending (>40%), note it.
   - Each description MUST contain specific numbers (e.g., "زاد إنفاقك على الطعام من 150,000 إلى 210,000 د.ع بنسبة 40%").
3. Use sentiment: "positive" for decreases/improvements, "warning" for increases/overspending, "neutral" for observations.
4. Be concise — title max 5 words, description max 15 words.
`,
});

const analyzeMonthlyTrendsFlow = ai.defineFlow(
  {
    name: 'analyzeMonthlyTrendsFlow',
    inputSchema: AnalyzeMonthlyTrendsInputSchema,
    outputSchema: AnalyzeMonthlyTrendsOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input, {
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return output!;
  }
);
