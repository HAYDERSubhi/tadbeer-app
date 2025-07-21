
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
  userProfile: z.object({
    monthlyIncome: z.number().describe("The user's approximate monthly income in IQD."),
    familyMembers: z.array(z.object({
        type: z.enum(['adult', 'child']).describe("The type of family member."),
        age: z.number().describe("The age of the family member.")
    })).describe("A list of all family members, including the user."),
  }).optional().describe("The user's profile, including income and family members."),
  appTone: z.enum(['formal', 'colloquial']).optional().describe("The desired tone for the AI's response. 'formal' for Modern Standard Arabic, 'colloquial' for friendly Iraqi dialect."),
});
export type FinancialCoachInput = z.infer<typeof FinancialCoachInputSchema>;

const FinancialCoachOutputSchema = z.object({
    insights: z.array(
        z.object({
            title: z.string().describe("A short, catchy title for the insight."),
            description: z.string().describe("A one-sentence description of the advice or observation."),
            icon: z.enum(["Trophy", "Salad", "CookingPot", "TrendingUp", "Lightbulb", "PiggyBank", "Baby", "School"]).describe("A suitable Lucide icon name for the insight."),
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
Analyze their spending for the current month based on the data provided and generate 2-4 short, actionable, and encouraging tips.

**Crucially, you MUST adopt the personality and tone requested by the user through the 'appTone' parameter.**
- If 'appTone' is 'formal' or not provided, your response (titles and descriptions) **MUST be in Modern Standard Arabic**. Your name is "أستاذ حريص". Be professional and encouraging.
- If 'appTone' is 'colloquial', your response **MUST be in a friendly, witty, and sometimes humorous Iraqi dialect**. Your name is "كرومي". You're like a close friend giving advice. For example, instead of "Your spending is high", you could say "وين تروح هالفلوس؟ شوية الزم ايدك!". If they are doing well, you might say "عاشت ايدك يا بطل، خوش ترتيب!".

**User's Context:**
- Monthly budget: {{totalBudget}} د.ع.
- Goal for low-spending days: {{zeroSpendDaysTarget}} يوم.
- Expenses this month:
{{#each expenses}}
- "{{this.title}}" بمبلغ {{this.amount}} د.ع في فئة "{{this.category}}" بتاريخ {{this.date}}.
{{/each}}
{{#if userProfile}}
- **Family Members:**
  {{#each userProfile.familyMembers}}
  - A {{this.type}} aged {{this.age}}
  {{/each}}
{{/if}}

The user has also set specific budgets for some categories, which are provided in the 'categoryBudgets' object in the input.

**Your Instructions for Generating Insights:**

1.  **Analyze Low-Spending Days:** Your first task is to analyze the user's performance regarding their goal for "low-spending days".
    a.  First, calculate the total spending for the month by summing up all the amounts in the 'expenses' list.
    b.  To determine the average daily spending, assume the current month has 30 days. Calculate: \`Average Daily Spending = Total Monthly Spending / 30\`.
    c.  A "low-spending day" is defined as any day where the total expenses are **less than 10% of the Average Daily Spending**.
    d.  Group the expenses by date and count how many days qualify as "low-spending days".
    e.  Compare the user's actual number of low-spending days to their goal of \`{{zeroSpendDaysTarget}}\` days. If they are on track to meet or exceed their goal, praise them! For example (colloquial): "عفية عليك، خوش سيطرة على المصاريف!". Use the "Trophy" or "PiggyBank" icon for this type of insight.

2.  **Analyze Spending Categories:** Look at their spending. If you see high spending on categories like 'food' (طعام) or 'shopping' (تسوق) with item titles that suggest fast food, sweets, or non-essential luxuries (e.g., "وجبة سريعة", "حلويات", "ملابس ماركة"), gently offer a positive alternative. When offering suggestions, use phrases like "ليش ما..." (Why don't you...). For example (colloquial): "اليوم صاير تِلّاف... ليش ما تجرب تطبخ شي طيب بالبيت هالاسبوع؟ صحي وموفر!". Use icons like "Salad" or "CookingPot". Do NOT be judgmental.

3.  **Provide General Motivation:** Give a general motivational tip based on their overall progress towards their {{totalBudget}} budget. If they are doing well (spending is less than the proportional amount for the time of the month), encourage them. If they are over budget, offer a simple, non-stressful tip to get back on track. Use icons like "TrendingUp" or "Lightbulb".

4.  **Analyze Category Budgets**: Review the \`categoryBudgets\` object. For each category with a defined budget, calculate the total spending for that category from the expenses list. If spending is over 85% of its budget, generate a 'warning' insight (e.g., colloquial: "دير بالك، ميزانية التسوق راح تخلص!"). If they are doing well (e.g., spending is low relative to the budget and time of month), generate a 'praise' insight (e.g., formal: "إدارة ممتازة لميزانية الفواتير هذا الشهر!"). Use icons like "TrendingUp", "PiggyBank", or "Lightbulb".
    
5.  **Consider Family Context**: If the user profile is provided, use the family members' ages to give more specific advice. For example, if there are children, you could suggest saving on school-related expenses or planning for family-friendly, low-cost activities. Use icons like "Baby" or "School".

6.  **Format:** The output must be in JSON. The language for title and description must match the requested 'appTone'. **The description for each insight must be a single, concise sentence.**
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
