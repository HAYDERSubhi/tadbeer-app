'use server';
/**
 * @fileOverview A financial coach AI that provides personalized tips.
 *
 * - financialCoach - A function that analyzes spending and provides advice.
 * - FinancialCoachInput - The input type for the financialCoach function.
 * - FinancialCoachOutput - The return type for the financialCoach function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const FinancialCoachInputSchema = z.object({
  totalBudget: z.number().describe("The user's total monthly budget in IQD."),
  zeroSpendDaysTarget: z.number().describe("The user's monthly goal for low-spending days."),
  expenses: z.array(
      z.object({
          title: z.string(),
          amount: z.number(),
          category: z.string(),
          date: z.string(),
      })
  ).describe("An array of the user's expenses for the current month."),
  categoryBudgets: z.record(z.string(), z.number()).optional().describe("A map of category IDs to their specific monthly budget in IQD. The key is the category ID and the value is the budget amount."),
});
export type FinancialCoachInput = z.infer<typeof FinancialCoachInputSchema>;

const FinancialCoachOutputSchema = z.object({
    insights: z.array(
        z.object({
            title: z.string().describe("A short, catchy title for the insight."),
            description: z.string().describe("A one-sentence description of the advice or observation."),
            icon: z.enum(["Trophy", "Salad", "CookingPot", "TrendingUp", "Lightbulb", "PiggyBank"]).describe("A suitable Lucide icon name for the insight."),
            type: z.enum(['praise', 'tip', 'warning']).describe("The type of insight, used for styling."),
        })
    ).describe("An array of 2-4 personalized financial insights."),
});
export type FinancialCoachOutput = z.infer<typeof FinancialCoachOutputSchema>;


export async function financialCoach(input: FinancialCoachInput): Promise<FinancialCoachOutput> {
  // If no expenses, return an empty array to avoid calling the AI unnecessarily.
  if (input.expenses.length === 0) {
    return { insights: [] };
  }
  return financialCoachFlow(input);
}


const prompt = ai.definePrompt({
    name: 'financialCoachPrompt',
    input: {schema: FinancialCoachInputSchema},
    output: {schema: FinancialCoachOutputSchema},
    prompt: `You are a friendly and encouraging financial coach for an Iraqi user. Your goal is to help them stick to their budget and build healthy spending habits.
Analyze their spending for the current month based on the data provided and generate 2-4 short, actionable, and encouraging tips in Arabic. Speak in a positive and motivational tone.

User's monthly budget: {{totalBudget}} د.ع.
User's monthly goal for low-spending days: {{zeroSpendDaysTarget}} يوم.
Their expenses this month:
{{#each expenses}}
- "{{this.title}}" بمبلغ {{this.amount}} د.ع في فئة "{{this.category}}" بتاريخ {{this.date}}.
{{/each}}

The user has also set specific budgets for some categories, which are provided in the 'categoryBudgets' object in the input.

Here are your instructions for generating insights:

1.  **Analyze Low-Spending Days:** Calculate the number of days with very low or zero spending. A low-spending day has total expenses under 15,000 IQD. Compare this to their goal of {{zeroSpendDaysTarget}} days. If they are on track, praise them! (e.g., "أداء رائع في الأيام الموفرة!"). Use the "Trophy" or "PiggyBank" icon for this.

2.  **Analyze Spending Categories:** Look at their spending. If you see high spending on categories like 'food' (طعام) or 'shopping' (تسوق) with item titles that suggest fast food, sweets, or non-essential luxuries (e.g., "وجبة سريعة", "حلويات", "ملابس ماركة"), gently offer a positive alternative. For example, "لاحظت بعض المصاريف على الوجبات الجاهزة. ما رأيك بتجربة وجبة ممتعة مطبوخة في البيت هذا الأسبوع؟ إنها رائعة لمحفظتك وصحتك!". Use icons like "Salad" or "CookingPot". Do NOT be judgmental.

3.  **Provide General Motivation:** Give a general motivational tip based on their overall progress towards their {{totalBudget}} budget. If they are doing well (spending is less than the proportional amount for the time of the month), encourage them. If they are over budget, offer a simple, non-stressful tip to get back on track. Use icons like "TrendingUp" or "Lightbulb".

4.  **Analyze Category Budgets**: Review the \`categoryBudgets\` object. For each category with a defined budget, calculate the total spending for that category from the expenses list. If spending is over 85% of its budget, generate a 'warning' insight (e.g., "تنبيه: قاربت على استهلاك ميزانية التسوق!"). If they are doing well (e.g., spending is low relative to the budget and time of month), generate a 'praise' insight (e.g., "إدارة ممتازة لميزانية الفواتير هذا الشهر!"). Use icons like "TrendingUp", "PiggyBank", or "Lightbulb".

5.  **Format:** The output must be in JSON. The language for title and description must be Arabic.
`,
});

const financialCoachFlow = ai.defineFlow(
  {
    name: 'financialCoachFlow',
    inputSchema: FinancialCoachInputSchema,
    outputSchema: FinancialCoachOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
