// src/ai/flows/analyze-spending-patterns.ts
'use server';
/**
 * @fileOverview An AI flow for analyzing spending patterns over a given period.
 * This flow provides data-driven analysis rather than coaching-style tips.
 *
 * - analyzeSpendingPatterns - A function that handles the analysis process.
 * - AnalyzeSpendingPatternsInput - The input type for the function.
 * - AnalyzeSpendingPatternsOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExpenseItemSchema = z.object({
  title: z.string(),
  amount: z.number(),
  category: z.string().describe("The category name, not the ID."),
  date: z.string(),
});

const AnalyzeSpendingPatternsInputSchema = z.object({
  expenses: z.array(ExpenseItemSchema)
    .describe("An array of the user's expenses for the specified period."),
  previousPeriodExpenses: z.array(ExpenseItemSchema).optional()
    .describe("Expenses from the PREVIOUS period (e.g. last month). Provided so the AI can identify trends and compare."),
  previousPeriodDescription: z.string().optional()
    .describe("A label for the previous period (e.g. 'شهر أيار 2026') for use in comparisons."),
  totalBudget: z.number().optional().describe("The user's total budget for the period (if applicable)."),
  periodDescription: z.string().describe("A description of the time period being analyzed (e.g., 'this month', 'the year 2023')."),
  appTone: z.enum(['formal', 'colloquial']).optional().describe("The desired tone. 'formal' = Modern Standard Arabic. 'colloquial' = friendly Iraqi dialect."),
});
export type AnalyzeSpendingPatternsInput = z.infer<typeof AnalyzeSpendingPatternsInputSchema>;

const AnalysisPointSchema = z.object({
    icon: z.enum(["TrendingUp", "TrendingDown", "Wallet", "PieChart"]).describe("A suitable Lucide icon name for the analysis point."),
    text: z.string().describe("The analytical observation, presented as a factual statement."),
});

const AnalyzeSpendingPatternsOutputSchema = z.object({
    performanceSummary: z.string().describe("A single, concise sentence summarizing the spending performance during the period. It should be neutral and data-driven."),
    highestSpendingCategory: z.object({
        category: z.string().describe("The name of the category with the highest spending."),
        amount: z.number().describe("The total amount spent in that category."),
        percentage: z.number().describe("The percentage of total spending that this category represents (0-100)."),
    }).describe("The single category with the highest total spending in the period."),
    keyObservations: z.array(AnalysisPointSchema).min(2).max(2).describe("Exactly two key, data-driven observations about the spending patterns. These should be analytical, not prescriptive advice."),
});
export type AnalyzeSpendingPatternsOutput = z.infer<typeof AnalyzeSpendingPatternsOutputSchema>;
export type AnalyzeSpendingPatternsResult = AnalyzeSpendingPatternsOutput | null;


export async function analyzeSpendingPatterns(input: AnalyzeSpendingPatternsInput): Promise<AnalyzeSpendingPatternsOutput | null> {
  // Return null (not a dummy object) so the caller can distinguish "no data" from a real result.
  if (input.expenses.length === 0) return null;
  return analyzeSpendingPatternsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'analyzeSpendingPatternsPrompt',
  input: {schema: AnalyzeSpendingPatternsInputSchema},
  output: {schema: AnalyzeSpendingPatternsOutputSchema},
  prompt: `You are a data analyst AI for a personal finance app. Analyze the user's spending and provide objective, data-driven insights. Do NOT give advice or coaching language — state facts only. All responses must be in Arabic.

**Tone:** {{#if (eq appTone "colloquial")}}Use friendly Iraqi dialect (عامية عراقية). Short and warm.{{else}}Use professional Modern Standard Arabic (فصحى).{{/if}}

---
**Current Period:** {{periodDescription}}
{{#if totalBudget}}**Budget:** {{totalBudget}} د.ع{{/if}}

**Current Period Expenses:**
{{#each expenses}}
- {{this.amount}} د.ع | "{{this.category}}" | {{this.date}} | "{{this.title}}"
{{/each}}

{{#if previousPeriodExpenses}}
---
**Previous Period ({{previousPeriodDescription}}) Expenses — for trend comparison only:**
{{#each previousPeriodExpenses}}
- {{this.amount}} د.ع | "{{this.category}}" | {{this.date}} | "{{this.title}}"
{{/each}}
{{/if}}

---
**Instructions:**

1. **performanceSummary** — One neutral sentence: total spent, and if previous period data exists, compare totals (e.g., "ارتفع إنفاقك بنسبة 12% مقارنةً بـ {{previousPeriodDescription}}").

2. **highestSpendingCategory** — Category with highest spend: name, amount, percentage of total.

3. **keyObservations** — Exactly 2 factual observations. Priority:
   - If previous period data exists: MUST include at least one trend comparison (e.g., "إنفاق فئة الطعام ارتفع 18% عن الشهر الماضي"). Icon: TrendingUp or TrendingDown.
   - Otherwise: two interesting facts about the current period distribution.
   - NEVER give advice. State facts only.

Respond strictly in the specified JSON format.
`,
});

const analyzeSpendingPatternsFlow = ai.defineFlow(
  {
    name: 'analyzeSpendingPatternsFlow',
    inputSchema: AnalyzeSpendingPatternsInputSchema,
    outputSchema: AnalyzeSpendingPatternsOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input, {
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });
    return output!;
  }
);
