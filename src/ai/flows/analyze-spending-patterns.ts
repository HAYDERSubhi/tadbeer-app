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

const AnalyzeSpendingPatternsInputSchema = z.object({
  expenses: z.array(
      z.object({
          title: z.string(),
          amount: z.number(),
          category: z.string().describe("The category name, not the ID."),
          date: z.string(),
      })
  ).describe("An array of the user's expenses for the specified period."),
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


export async function analyzeSpendingPatterns(input: AnalyzeSpendingPatternsInput): Promise<AnalyzeSpendingPatternsOutput> {
  // If no expenses, return a default empty state to avoid calling the AI.
  if (input.expenses.length === 0) {
    return {
        performanceSummary: "لا توجد بيانات إنفاق لهذه الفترة.",
        highestSpendingCategory: { category: "N/A", amount: 0, percentage: 0 },
        keyObservations: [
            { icon: "Wallet", text: "أضف بعض المصاريف لبدء التحليل." },
            { icon: "PieChart", text: "لا يمكن إنشاء ملاحظات بدون بيانات." }
        ]
    };
  }
  return analyzeSpendingPatternsFlow(input);
}


const prompt = ai.definePrompt({
  name: 'analyzeSpendingPatternsPrompt',
  input: {schema: AnalyzeSpendingPatternsInputSchema},
  output: {schema: AnalyzeSpendingPatternsOutputSchema},
  prompt: `You are a data analyst AI for a personal finance app. Your task is to analyze a user's spending for a specific period and provide objective, data-driven insights. Do NOT give advice or use coaching language. Stick to the facts from the data. All responses must be in Arabic.

{{#if appTone}}
**Tone:** {{#if (eq appTone "colloquial")}}Use a friendly, natural Iraqi dialect (عامية عراقية). Keep it short and warm.{{else}}Use clear, professional Modern Standard Arabic (فصحى).{{/if}}
{{/if}}

**Period to Analyze:** {{periodDescription}}
{{#if totalBudget}}
**Budget for this period:** {{totalBudget}} د.ع
{{/if}}

**Expense Data:**
{{#each expenses}}
- {{this.amount}} د.ع in "{{this.category}}" on {{this.date}} for "{{this.title}}".
{{/each}}

**Instructions:**
1.  Calculate Key Metrics:
    -   Total spending for the period.
    -   Spending for each category.
    -   The category with the highest spending.
    -   The percentage of the total spending for the highest category.

2.  Generate 'performanceSummary': Write one neutral, data-driven sentence summarizing the user's spending. Example: "إجمالي إنفاقك خلال هذه الفترة بلغ 1,250,000 د.ع." Or if a budget is present: "لقد أنفقت 85% من ميزانيتك المحددة لهذه الفترة."

3.  Identify 'highestSpendingCategory': Find the single category with the most spending. Fill in the 'category' name, total 'amount', and its 'percentage' of the total spend.

4.  Generate 'keyObservations' (Exactly 2):
    -   These must be factual observations based on the provided data ONLY.
    -   Do NOT give advice (e.g., avoid "حاول تقليل..."). Instead, state facts (e.g., "ثلث إنفاقك كان على فئة الطعام.").
    -   Pick the two most interesting or significant data points.
    -   Good Example Observation: "شكلت فئتا الطعام والمواصلات معًا 55% من إجمالي مصاريفك." (Icon: PieChart)
    -   Good Example Observation: "الإنفاق على الترفيه شهد زيادة ملحوظة في الأسبوع الأخير من الشهر." (Icon: TrendingUp)
    -   Bad Example Observation (Coaching): "يجب عليك مراقبة إنفاقك على التسوق."

Provide the final output strictly in the specified JSON format.
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
